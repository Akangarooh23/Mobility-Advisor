const crypto = require("crypto");
const { MARCA, COLOR, remitente, respuestaA, correoSoporte } = require("../marca");
const {
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
  resolveAccount,
  updateBillingState,
} = require("../billingStore");
const { resolvePlanById, resolvePlanByStripePriceId } = require("../billingCatalog");
const { uploadBufferToSupabase, getPublicUrl } = require("../supabaseStorage");
const { plantilla, parrafo, datos, esc } = require("../correo");
function getGenerateSellReport() {
  return require("../sellReportGenerator").generateSellReport;
}

const DAMAGE_LABEL = {
  "sell.damageNone":     "Sin daños",
  "sell.damageMinor":    "Daños leves",
  "sell.damageModerate": "Daños moderados",
  "sell.damageMajor":    "Daños graves",
};
function resolveDamageLevel(raw) {
  return DAMAGE_LABEL[raw] || raw || null;
}

let _webhookPgPool = null;
function getWebhookPgPool() {
  if (_webhookPgPool) return _webhookPgPool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  const { Pool } = require("pg");
  _webhookPgPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _webhookPgPool;
}

async function syncPlanToPostgres(email, planId, status, extra = {}) {
  const pool = getWebhookPgPool();
  if (!pool || !email) return;
  try {
    await pool.query(
      `UPDATE moveadvisor_users
       SET plan_id = $1, plan_status = $2, plan_updated_at = NOW(),
           stripe_customer_id      = COALESCE(NULLIF($4, ''), stripe_customer_id),
           stripe_subscription_id  = COALESCE(NULLIF($5, ''), stripe_subscription_id),
           next_billing_date       = CASE WHEN $6::text <> '' THEN $6::timestamptz ELSE next_billing_date END,
           cancel_at_period_end    = COALESCE($7, cancel_at_period_end)
       WHERE lower(email) = lower($3)`,
      [
        planId || "free",
        status || "inactivo",
        email,
        extra.stripeCustomerId || "",
        extra.stripeSubscriptionId || "",
        extra.nextBillingDate || "",
        extra.cancelAtPeriodEnd ?? null,
      ]
    );
  } catch (e) {
    console.error("[webhook] syncPlanToPostgres error:", e.message);
  }
}

/**
 * El siguiente número de una serie de facturas.
 *
 * El contador vive en la misma tabla que usa el ERP, así que las series no se
 * pisan aunque los números los pida uno u otro. Se lleva por año: FIA-2026-0001.
 */
async function siguienteNumeroDeFactura(pool, serie) {
  const year = new Date().getFullYear();
  const r = await pool.query(
    `INSERT INTO moveadvisor_invoice_counters (series, year, last_n)
     VALUES ($1, $2, 1)
     ON CONFLICT (series, year) DO UPDATE
       SET last_n = moveadvisor_invoice_counters.last_n + 1
     RETURNING last_n`,
    [serie, year]
  );
  const n = r.rows[0]?.last_n || 1;
  return `${serie}-${year}-${String(n).padStart(4, "0")}`;
}

/**
 * La fianza de una importación, cobrada.
 *
 * Es el paso que abre el expediente: hasta que no está, no se pide el coche a
 * Alemania. Aquí se deja constancia de las tres cosas que pasan a la vez:
 *
 *   · la solicitud queda con la fianza cobrada y su fecha,
 *   · el expediente pasa a «Depósito retenido», que es lo que ve el cliente,
 *   · y se emite su factura, con serie propia —FIA— porque una fianza no es
 *     una venta ni una suscripción: es una entrega a cuenta que además se
 *     devuelve si no se hace el pedido.
 *
 * Si algo de esto falla, el dinero ya está cobrado: por eso cada paso va por
 * separado y lo que falle se queda escrito en el registro, en vez de tirar la
 * respuesta al webhook y que Stripe lo reintente veinte veces.
 */
async function depositoRecibido({ leadId, email, importe, fee, sessionId, cobroRef }) {
  const pool = getWebhookPgPool();
  if (!pool || !leadId) return;

  let coche = "";
  // Marcar solo si no estaba marcada.
  //
  // Esto llega por dos caminos —el aviso de Stripe y la vuelta del pago— y a
  // veces llegan los dos. Con `WHERE deposit_paid_at IS NULL`, quien marca es
  // exactamente uno: el segundo no encuentra fila y se para aquí, sin emitir
  // una segunda factura ni mandar otro correo por el mismo cobro.
  let primeraVez = false;
  try {
    const r = await pool.query(
      `UPDATE moveadvisor_market_leads
          SET deposit_paid_at = NOW(),
              -- El cobro en Stripe: sin esto no se puede devolver despues, que
              -- es lo que hay que hacer si no se llega a pedir el coche.
              deposit_payment_ref = NULLIF($2, ''),
              status = CASE WHEN status IN ('Pendiente','Contactado') THEN 'Depósito retenido' ELSE status END
        WHERE id = $1 AND deposit_paid_at IS NULL
        RETURNING vehicle_title`,
      [leadId, cobroRef || '']
    );
    primeraVez = r.rowCount > 0;
    coche = normalizeText(r.rows[0]?.vehicle_title);
  } catch (e) {
    console.error("[fianza] no se ha podido marcar la solicitud:", e.message);
    return;
  }

  if (!primeraVez) {
    console.log(`[deposito] ${leadId} ya estaba recibido: no se emite otra factura`);
    return;
  }

  /**
   * Se factura **nuestro servicio**, no el depósito entero.
   *
   * De los 20.999 € que ingresa, 18.000 son del concesionario alemán y están de
   * paso: no son ingreso nuestro y facturarlos sería declarar una venta de un
   * coche que no hemos vendido. Lo nuestro son los 3.000 € del servicio.
   *
   * Por eso la serie cambia de FIA a **SRV**: una fianza era otra cosa, y el
   * nombre de la serie sale en el número de la factura del cliente.
   *
   * El tratamiento definitivo del resto del dinero —cómo se refleja que está en
   * nuestra cuenta y no es nuestro— lo tiene que decir la gestoría. Esto es lo
   * que se puede sostener mientras tanto.
   */
  const importeFacturado = Math.round(Number(fee) || 0);
  if (!(importeFacturado > 0)) {
    console.warn(`[deposito] ${leadId} sin fee: no se emite factura. El dinero está marcado igual.`);
    return;
  }

  try {
    const numero = await siguienteNumeroDeFactura(pool, "SRV");
    const factura = {
      id: `srv-${leadId}`,
      number: numero,
      date: new Date().toISOString(),
      amount: importeFacturado,
      status: "Pagada",
      pdfUrl: "",
      description: `Servicio de importación${coche ? ` · ${coche}` : ""}`,
    };

    // La fila primero: si el PDF falla, el cliente tiene su factura en el panel
    // igualmente, y esa pantalla sabe generarla al vuelo.
    await upsertInvoiceToPostgres(email, factura);
    await pool.query(
      `UPDATE moveadvisor_user_invoices SET cw_invoice_number = $2 WHERE id = $1`,
      [factura.id, numero]
    ).catch(() => {});
    appendOrUpdateInvoice(email, factura);

    try {
      const perfil = await getUserProfile(email);
      const pdf = await generateInvoicePdf(factura, perfil);
      await markInvoiceGenerated(factura.id);
      await uploadInvoicePdfAndSaveUrl(factura.id, pdf, factura.number);
      await sendInvoiceEmail({ to: email, pdfBuffer: pdf, invoiceRecord: factura });
      await markInvoiceSent(factura.id);
    } catch (e) {
      // Sin PDF no se pierde nada importante: la factura existe y se puede
      // descargar desde su panel, que la arma en el momento.
      console.error("[fianza] factura emitida pero sin PDF ni correo:", e.message);
    }
    console.log(`[fianza] cobrada ${importe} € de ${email} · factura ${numero} · sesion ${sessionId}`);
  } catch (e) {
    console.error("[fianza] no se ha podido emitir la factura:", e.message);
  }
}
async function upsertInvoiceToPostgres(email, invoice) {
  const pool = getWebhookPgPool();
  if (!pool || !email || !invoice?.id) return;
  try {
    await pool.query(
      `INSERT INTO moveadvisor_user_invoices
         (id, email, number, date, amount, status, pdf_url, description, cw_paid_at)
       VALUES ($1, lower($2), $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status      = EXCLUDED.status,
         pdf_url     = EXCLUDED.pdf_url,
         amount      = EXCLUDED.amount,
         description = EXCLUDED.description,
         cw_paid_at  = COALESCE(moveadvisor_user_invoices.cw_paid_at, EXCLUDED.cw_paid_at)`,
      [
        invoice.id,
        email,
        invoice.number || "",
        invoice.date || null,
        invoice.amount || 0,
        invoice.status || "",
        invoice.pdfUrl || "",
        invoice.description || "",
        invoice.date || new Date().toISOString(),
      ]
    );
  } catch (e) {
    console.error("[webhook] upsertInvoiceToPostgres error:", e.message);
  }
}

async function markInvoiceGenerated(invoiceId) {
  const pool = getWebhookPgPool();
  if (!pool || !invoiceId) return;
  try {
    await pool.query(
      `UPDATE moveadvisor_user_invoices SET cw_generated_at = NOW() WHERE id = $1`,
      [invoiceId]
    );
  } catch (e) {
    console.error("[webhook] markInvoiceGenerated error:", e.message);
  }
}

async function markInvoiceSent(invoiceId) {
  const pool = getWebhookPgPool();
  if (!pool || !invoiceId) return;
  try {
    await pool.query(
      `UPDATE moveadvisor_user_invoices SET cw_sent_at = NOW() WHERE id = $1`,
      [invoiceId]
    );
  } catch (e) {
    console.error("[webhook] markInvoiceSent error:", e.message);
  }
}

async function uploadInvoicePdfAndSaveUrl(invoiceId, pdfBuffer, invoiceNumber) {
  try {
    const safeNum = (invoiceNumber || invoiceId).replace(/[^a-zA-Z0-9\-_]/g, "_");
    // Con un trozo al azar en el nombre.
    //
    // El fichero queda en un almacen publico, y con el numero de factura por toda
    // ruta bastaba con saber uno para pedir los demas: van seguidos. Esto no hace
    // privado el fichero —eso es cosa del cubo—, pero deja de poder listarse a
    // ciegas. Lo mismo que hace el ERP cuando genera una factura.
    const alAzar = require("crypto").randomBytes(8).toString("hex");
    const path = `invoices/${safeNum}-${alAzar}.pdf`;
    await uploadBufferToSupabase(pdfBuffer, "application/pdf", path);
    const publicUrl = getPublicUrl(path);
    const pool = getWebhookPgPool();
    if (pool && publicUrl) {
      await pool.query(
        `UPDATE moveadvisor_user_invoices SET pdf_url = $1 WHERE id = $2`,
        [publicUrl, invoiceId]
      );
    }
    return publicUrl;
  } catch (e) {
    console.error("[webhook] uploadInvoicePdf error:", e.message);
    return "";
  }
}

async function getUserProfile(email) {
  const pool = getWebhookPgPool();
  if (!pool || !email) return {};
  try {
    const r = await pool.query(
      `SELECT name, apellidos, phone, tax_id, billing_street, billing_postal_code, billing_province
       FROM moveadvisor_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    return { ...(r.rows[0] || {}), email };
  } catch { return { email }; }
}

async function generateInvoicePdf(invoiceRecord, userProfile = {}) {
  const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
  const doc = await PDFDocument.create();
  const rb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ri = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595.28, 841.89]);
  const W = 595.28, H = 841.89;

  function c(hex) {
    const s = hex.replace("#", "");
    return rgb(parseInt(s.slice(0,2),16)/255, parseInt(s.slice(2,4),16)/255, parseInt(s.slice(4,6),16)/255);
  }
  function fr(x, y, w, h, color) { page.drawRectangle({ x, y: H-y-h, width: w, height: h, color }); }
  function ln(x1, y1, x2, y2) { page.drawLine({ start:{x:x1,y:H-y1}, end:{x:x2,y:H-y2}, thickness:0.5, color:c("#E4E4DF") }); }
  function dt(str, x, y, size, font, color) { page.drawText(String(str||""), { x, y:H-y-size*0.78, size, font, color }); }

  const amount   = Number(invoiceRecord.amount || 0);
  const base     = parseFloat((amount / 1.21).toFixed(2));
  const iva      = parseFloat((amount - base).toFixed(2));
  const fmtEur   = (n) => n.toFixed(2) + " EUR";
  const clientName = [userProfile.name, userProfile.apellidos].filter(Boolean).join(" ") || invoiceRecord.email || "";
  const concept  = invoiceRecord.description || `Servicio ${MARCA.nombre}`;
  const date     = invoiceRecord.date ? new Date(invoiceRecord.date).toLocaleDateString("es-ES") : "";

  // Header
  const rightEdge = W - 50;
  function rtx(str, y, size, font) {
    const w = font.widthOfTextAtSize(String(str || ""), size);
    return rightEdge - w;
  }
  // Barra amarilla y nombre en negro: el amarillo como texto no se lee en papel.
  fr(50, 50, 6, 26, c(COLOR.amarillo));
  dt(MARCA.nombre, 66, 50, 22, rb, c(COLOR.negro));
  dt([MARCA.sitio, correoSoporte()].filter(Boolean).join(" · "), 66, 76, 8.5, ri, c(COLOR.textoSuave));
  const facturaLabel = "FACTURA";
  dt(facturaLabel, rtx(facturaLabel, 50, 22, rb), 50, 22, rb, c("#111111"));
  const numLabel = `N\xba: ${invoiceRecord.number || invoiceRecord.id}`;
  dt(numLabel, rtx(numLabel, 80, 9.5, ri), 80, 9.5, ri, c(COLOR.textoSuave));
  const fechaLabel = `Fecha: ${date}`;
  dt(fechaLabel, rtx(fechaLabel, 94, 9.5, ri), 94, 9.5, ri, c(COLOR.textoSuave));
  ln(50, 115, 545, 115);

  // Client block
  dt("FACTURADO A", 50, 130, 8.5, rb, c("#96968F"));
  dt(clientName, 50, 145, 11, rb, c("#111111"));
  let ly = 162;
  const clientLines = [
    invoiceRecord.email,
    userProfile.phone,
    userProfile.tax_id ? `NIF/CIF: ${userProfile.tax_id}` : "",
    userProfile.billing_street,
    [userProfile.billing_postal_code, userProfile.billing_province].filter(Boolean).join(" "),
  ].filter(Boolean);
  clientLines.forEach(l => { dt(l, 50, ly, 9, ri, c(COLOR.textoSuave)); ly += 13; });

  // Items table
  const tY = 250;
  fr(50, tY, 495, 24, c("#F7F7F3"));
  dt("CONCEPTO", 60, tY + 7, 8.5, rb, c(COLOR.textoSuave));
  dt("IMPORTE", 480, tY + 7, 8.5, rb, c(COLOR.textoSuave));
  ln(50, tY + 24, 545, tY + 24);
  dt(concept, 60, tY + 34, 10, ri, c("#111111"));
  dt(fmtEur(base), 480, tY + 34, 10, ri, c("#111111"));
  ln(50, tY + 54, 545, tY + 54);

  // Totals
  const totY = tY + 64;
  dt("Base imponible:", 370, totY, 9, ri, c(COLOR.textoSuave));
  dt(fmtEur(base), 480, totY, 9, ri, c(COLOR.textoSuave));
  dt("IVA (21%):", 370, totY + 15, 9, ri, c(COLOR.textoSuave));
  dt(fmtEur(iva), 480, totY + 15, 9, ri, c(COLOR.textoSuave));
  fr(370, totY + 30, 175, 22, c(COLOR.amarillo));
  dt("TOTAL:", 380, totY + 37, 11, rb, c(COLOR.negro));
  dt(fmtEur(amount), 480, totY + 37, 11, rb, c(COLOR.negro));

  // Pagada stamp
  dt("PAGADA", 60, totY + 78, 11, rb, c(COLOR.negro));

  // Footer
  ln(50, 750, 545, 750);
  // La razón social, no la marca: es la entidad inscrita y la factura tiene que
  // seguir diciéndola mientras la sociedad se llame así.
  dt(`${MARCA.razonSocial} \xb7 Este documento tiene validez de factura.`, 50, 758, 8, ri, c(COLOR.textoTenue));

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function sendInvoiceEmail({ to, pdfBuffer, invoiceRecord }) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  const from   = remitente();
  if (!apiKey || !pdfBuffer) return;

  const invoiceNum = invoiceRecord.number || invoiceRecord.id || "CW";
  const concept    = invoiceRecord.description || `Servicio ${MARCA.nombre}`;
  const amount     = Number(invoiceRecord.amount || 0).toFixed(2);

  // Ya estaba en los colores de la marca, pero con su propia maqueta: si mañana
  // cambia el pie, este no se enteraba.
  const html = plantilla({
    titulo: "Tu factura está lista",
    cuerpo:
      parrafo("Va adjunta en PDF.") +
      datos([
        ["Nº de factura", esc(invoiceNum)],
        ["Concepto", esc(concept)],
        ["Total", `${esc(amount)} €`],
      ]),
  });

  const payload = {
    from,
    reply_to: respuestaA(),
    to: [to],
    subject: `Factura ${invoiceNum} — ${MARCA.nombre}`,
    html,
    attachments: [{
      filename: `Factura_${invoiceNum}.pdf`,
      content: pdfBuffer.toString("base64"),
    }],
  };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || "Error enviando factura por email.");
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRawBody(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return "";
}

function safeJsonParse(value) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
}

function parseStripeSignature(header = "") {
  const parts = String(header || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const values = {};
  parts.forEach((part) => {
    const [key, val] = part.split("=");
    if (key && val) values[key] = val;
  });

  return { timestamp: values.t || "", signature: values.v1 || "" };
}

function verifyStripeSignature(rawBody = "", header = "", webhookSecret = "") {
  const { timestamp, signature } = parseStripeSignature(header);
  if (!timestamp || !signature || !webhookSecret) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(payload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function resolvePlanLabel(planId = "") {
  return normalizeText(resolvePlanById(planId)?.label) || "Plan MoveAdvisor";
}

function toIsoDateFromEpoch(seconds) {
  const safe = Number(seconds || 0);
  if (!Number.isFinite(safe) || safe <= 0) return "";
  return new Date(safe * 1000).toISOString();
}

function normalizeStripeSubscriptionStatus(status = "") {
  const normalized = normalizeText(status).toLowerCase();

  if (normalized === "active" || normalized === "trialing") {
    return "activa";
  }

  if (normalized === "past_due" || normalized === "unpaid" || normalized === "incomplete") {
    return "pendiente";
  }

  if (normalized === "canceled" || normalized === "incomplete_expired") {
    return "cancelado";
  }

  return normalized || "inactiva";
}

function resolvePlanFromSubscriptionObject(subscription = {}) {
  const subscriptionPlanId = normalizeText(subscription?.metadata?.plan_id).toLowerCase();
  if (subscriptionPlanId) {
    const planById = resolvePlanById(subscriptionPlanId);
    if (planById) {
      return planById;
    }
  }

  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  for (const item of items) {
    const candidatePriceId = normalizeText(item?.price?.id);
    if (!candidatePriceId) {
      continue;
    }

    const planByPrice = resolvePlanByStripePriceId(candidatePriceId);
    if (planByPrice) {
      return planByPrice;
    }
  }

  return null;
}

async function sendValuationEmail({ to, pdfBuffer, reportData, vehicle: vehFallback }) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  const from   = remitente();
  if (!apiKey) {
    console.warn("[valuation] RESEND_API_KEY not set, skipping email.");
    return;
  }

  const veh = reportData.vehicle || vehFallback || {};
  const vehicleLabel = [veh.brand, veh.model, veh.year ? `(${veh.year})` : ""].filter(Boolean).join(" ") || "tu vehículo";
  const priceStr = reportData.priceOptimal
    ? new Intl.NumberFormat("es-ES").format(reportData.priceOptimal) + " €"
    : "–";

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111111;">
      <div style="background:#111111;padding:28px 32px 24px;border-bottom:4px solid #FFC400;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#FFC400">Pop</span><span style="color:#fff">Car</span></span>
        <span style="font-size:11px;color:#9A9A93;margin-left:10px;letter-spacing:0.06em;">TASACIÓN DE MERCADO</span>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">Tu informe está listo</h1>
        <p style="color:#5E5E59;margin:0 0 24px;">Adjunto a este email encontrarás el PDF con el análisis completo de mercado para <strong>${vehicleLabel}</strong>.</p>
        <div style="background:#FFF6D9;border:1.5px solid #FFC400;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6B5200;font-weight:700;margin-bottom:6px;">Precio óptimo de venta</div>
          <div style="font-size:36px;font-weight:800;color:#111111;line-height:1;">${priceStr}</div>
          <div style="font-size:12px;color:#5E5E59;margin-top:6px;">Basado en ${reportData.comparables || 0} comparables · Confianza ${reportData.confidence || 0}%</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
          <div style="background:#fff;border:1px solid #E4E4DF;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#111111;">${reportData.comparables || "–"}</div>
            <div style="font-size:11px;color:#5E5E59;margin-top:4px;">Unidades en portales</div>
          </div>
          <div style="background:#fff;border:1px solid #E4E4DF;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#111111;">–</div>
            <div style="font-size:11px;color:#5E5E59;margin-top:4px;">Días medios de venta</div>
          </div>
          <div style="background:#fff;border:1px solid #E4E4DF;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#6B5200;">${reportData.demand || "–"}</div>
            <div style="font-size:11px;color:#5E5E59;margin-top:4px;">Nivel de demanda</div>
          </div>
        </div>
        <p style="font-size:13px;color:#5E5E59;">El PDF adjunto incluye el análisis completo por portales, histograma de precios, estrategia de venta y recomendaciones personalizadas.</p>
        <p style="font-size:12px;color:#96968F;margin-top:24px;">Este informe es válido durante 30 días desde su emisión · ${MARCA.nombre} · <a href="${MARCA.sitioUrl}" style="color:#111111;">${MARCA.sitio}</a></p>
      </div>
    </div>`;

  const payload = {
    from,
    reply_to: respuestaA(),
    to: [to],
    subject: `Tu informe de mercado — ${vehicleLabel}`,
    html,
    ...(pdfBuffer ? { attachments: [{ filename: `Informe_de_Mercado_${MARCA.nombre}.pdf`, content: pdfBuffer.toString("base64") }] } : {}),
  };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    console.error("[valuation] Resend error:", err);
    throw new Error(err?.message || "Error enviando email de tasacion.");
  }
}

async function sendFleetEmail({ to, reports, vehicles }) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  const from   = remitente();
  if (!apiKey) { console.warn("[valuation_fleet] RESEND_API_KEY not set."); return; }

  const count = vehicles.length;
  const rows = vehicles.map((v, i) => {
    const r = reports[i];
    const label = [v.brand, v.model, v.year].filter(Boolean).join(" ") || `Vehículo ${i + 1}`;
    const price = r?.reportData?.priceOptimal
      ? new Intl.NumberFormat("es-ES").format(r.reportData.priceOptimal) + " €"
      : "–";
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#111111;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#111111;font-weight:700;">${price}</td>${v.plate ? `<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#5E5E59;">${v.plate}</td>` : "<td></td>"}</tr>`;
  }).join("");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111111;">
      <div style="background:#111111;padding:28px 32px 24px;border-bottom:4px solid #FFC400;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#FFC400">Pop</span><span style="color:#fff">Car</span></span>
        <span style="font-size:11px;color:#9A9A93;margin-left:10px;letter-spacing:0.06em;">TASACIÓN DE FLOTA</span>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">Tus ${count} informes están listos</h1>
        <p style="color:#5E5E59;margin:0 0 24px;">Adjunto a este email encontrarás ${count} informes PDF, uno por cada vehículo analizado.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#fafafa;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead><tr style="background:#FFF6D9;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5E5E59;letter-spacing:0.06em;text-transform:uppercase;">Vehículo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5E5E59;letter-spacing:0.06em;text-transform:uppercase;">Precio óptimo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5E5E59;letter-spacing:0.06em;text-transform:uppercase;">Matrícula</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#96968F;">Cada PDF incluye análisis por portales, histograma de precios, estrategia de venta y recomendaciones. Válido 30 días · ${MARCA.nombre}</p>
      </div>
    </div>`;

  const attachments = reports
    .map((r, i) => {
      if (!r?.pdfBuffer) return null;
      const v = vehicles[i] || {};
      const name = [v.brand, v.model, v.plate].filter(Boolean).join("_").replace(/\s+/g, "_") || `vehiculo_${i + 1}`;
      return { filename: `Informe_de_Mercado_${name}.pdf`, content: r.pdfBuffer.toString("base64") };
    })
    .filter(Boolean);

  const payload = { from, reply_to: respuestaA(), to: [to], subject: `Tus ${count} informes de mercado — ${MARCA.nombre}`, html };
  if (attachments.length) payload.attachments = attachments;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || "Error enviando email de flota.");
  }
}

module.exports = async function billingWebhookHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = normalizeText(process.env.STRIPE_WEBHOOK_SECRET);
  const rawBody = normalizeRawBody(req.rawBody) || JSON.stringify(req.body || {});
  const signatureHeader = normalizeText(req.headers?.["stripe-signature"]);

  /**
   * Sin secreto no se atiende a nadie.
   *
   * Antes la verificación era `if (webhookSecret) { ... }`: si la variable no
   * estaba puesta, no se comprobaba la firma y se aceptaba cualquier cuerpo.
   * Y lo que hay detrás no es un contador de visitas: `checkout.session.completed`
   * escribe `plan_id` y `plan_status` en la ficha del usuario. Cualquiera que
   * conociera la dirección podía regalarse un plan de pago con una petición.
   *
   * Fallar cerrado además se nota: Stripe reintenta lo que devuelve error y lo
   * enseña en rojo en su panel. Fallar abierto no se notaba nunca.
   */
  if (!webhookSecret) {
    console.error("[billing-webhook] STRIPE_WEBHOOK_SECRET sin configurar: no se atiende el evento.");
    return res.status(500).json({ error: "Webhook sin configurar." });
  }

  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    return res.status(400).json({ error: "Firma de webhook no valida." });
  }

  const event = safeJsonParse(rawBody);
  const eventType = normalizeText(event?.type);
  const eventData = event?.data?.object || {};

  if (!eventType) {
    return res.status(400).json({ error: "Evento de Stripe invalido." });
  }

  /**
   * Una transferencia no llega cuando el cliente termina la pantalla.
   *
   * Con tarjeta, `checkout.session.completed` significa cobrado. Con
   * transferencia significa **«ya tiene los datos de la cuenta»**: la sesión
   * queda en `unpaid` y el dinero llega horas o días después, y entonces Stripe
   * manda `checkout.session.async_payment_succeeded`.
   *
   * Si se marcara con el `completed`, el expediente diría que hay dinero
   * dentro desde el momento en que el cliente vio un IBAN. Y con ese estado se
   * coge un avión para ir a ver un coche.
   */
  const TERMINO_LA_PANTALLA = eventType === "checkout.session.completed";
  const LLEGO_EL_DINERO = eventType === "checkout.session.async_payment_succeeded";

  if (eventType === "checkout.session.async_payment_failed") {
    const meta = eventData?.metadata || {};
    console.warn(`[deposito] la transferencia de ${normalizeText(meta.lead_id)} no ha salido`);
    return res.status(200).json({ received: true });
  }

  if (TERMINO_LA_PANTALLA || LLEGO_EL_DINERO) {
    const email = normalizeText(eventData?.customer_email || eventData?.customer_details?.email).toLowerCase();
    const customerId = normalizeText(eventData?.customer);
    const subscriptionId = normalizeText(eventData?.subscription);
    const planId = normalizeText(eventData?.metadata?.plan_id).toLowerCase();

    // ── El depósito de una importación ──────────────────────────────────────
    if (planId === "deposito" || planId === "fianza") {
      const meta = eventData?.metadata || {};
      const correo = email || normalizeText(meta.customer_email).toLowerCase();
      /**
       * Solo cuando el dinero está de verdad.
       *
       * Con transferencia, el `completed` llega con la sesión sin pagar: es el
       * momento en que el cliente ve el IBAN, no el momento en que transfiere.
       * Se mira `payment_status`, que es lo que dice si hay dinero.
       */
      const pagado = LLEGO_EL_DINERO || normalizeText(eventData?.payment_status) === "paid";
      if (!pagado) {
        console.log(`[deposito] ${normalizeText(meta.lead_id)}: instrucciones dadas, sin dinero todavía`);
        return res.status(200).json({ received: true });
      }
      await depositoRecibido({
        leadId: normalizeText(meta.lead_id),
        email: correo,
        importe: Number(meta.importe || 0) || Math.round(Number(eventData?.amount_total || 0) / 100),
        // Lo nuestro del depósito: lo único que se factura.
        fee: Number(meta.fee || 0) || 0,
        sessionId: normalizeText(eventData?.id),
        cobroRef: normalizeText(eventData?.payment_intent),
      });
      return res.status(200).json({ received: true });
    }

    // ── Valuation one-time payment ──────────────────────────────────────────
    if (planId === "valuation" && email) {
      const meta = eventData?.metadata || {};
      const vehicle = {
        brand:            normalizeText(meta.veh_brand),
        model:            normalizeText(meta.veh_model),
        version:          normalizeText(meta.veh_version),
        year:             meta.veh_year    ? Number(meta.veh_year)    : null,
        mileage:          meta.veh_mileage ? Number(String(meta.veh_mileage).replace(/\./g, "").replace(/,/g, ".")) : null,
        fuel:             normalizeText(meta.veh_fuel),
        transmission:    normalizeText(meta.veh_transmission),
        color:           normalizeText(meta.veh_color),
        owners:          normalizeText(meta.veh_owners),
        serviceHistory:  normalizeText(meta.veh_service_history),
        powerCv:         meta.veh_power_cv ? Number(meta.veh_power_cv) : null,
        itvStatus:       normalizeText(meta.veh_itv_status),
        plate:            normalizeText(meta.veh_plate),
        damageLevel:      resolveDamageLevel(normalizeText(meta.veh_damage)),
        damageDescription: normalizeText(meta.veh_damage_desc),
        province:         normalizeText(meta.veh_province),
      };
      let pdfBuffer = null, reportData = {};
      try {
        ({ pdfBuffer, reportData } = await getGenerateSellReport()(vehicle));
        console.log(`[valuation] PDF generated for ${vehicle.brand} ${vehicle.model}`);
      } catch (pdfErr) {
        console.error("[valuation] PDF generation failed, sending email without attachment:", pdfErr?.message);
      }
      try {
        await sendValuationEmail({ to: email, pdfBuffer, reportData, vehicle });
        console.log(`[valuation] Email sent to ${email}`);
      } catch (mailErr) {
        console.error("[valuation] Email error:", mailErr?.message);
      }
      try {
        const sessionId = normalizeText(eventData?.id);
        const amountEur = (eventData?.amount_total || 1000) / 100;
        const year = new Date().getFullYear();
        const invoiceNum = `CW-${year}-${sessionId.slice(-6).toUpperCase()}`;
        const invoiceRecord = {
          id: sessionId || `val-${Date.now()}`,
          number: invoiceNum,
          date: new Date().toISOString(),
          amount: amountEur,
          status: "Pagada",
          pdfUrl: "",
          description: "Informe de Valor de Mercado Avanzado",
        };
        await upsertInvoiceToPostgres(email, invoiceRecord);
        appendOrUpdateInvoice(email, invoiceRecord);
        try {
          const userProfile = await getUserProfile(email);
          const invoicePdf = await generateInvoicePdf(invoiceRecord, userProfile);
          await markInvoiceGenerated(invoiceRecord.id);
          await uploadInvoicePdfAndSaveUrl(invoiceRecord.id, invoicePdf, invoiceRecord.number);
          await sendInvoiceEmail({ to: email, pdfBuffer: invoicePdf, invoiceRecord });
          await markInvoiceSent(invoiceRecord.id);
          console.log(`[valuation] Factura enviada a ${email}`);
        } catch (mailErr) {
          console.error("[valuation] Error enviando factura:", mailErr?.message);
        }
      } catch (invErr) {
        console.error("[valuation] Error creating invoice record:", invErr?.message);
      }
      return res.status(200).json({ ok: true, received: true, eventType });
    }

    // ── Fleet valuation payment ─────────────────────────────────────────────
    if (planId === "valuation_fleet" && email) {
      const meta = eventData?.metadata || {};
      const chunks = parseInt(meta.fleet_chunks || "0", 10);
      let fleetJson = "";
      for (let i = 0; i < chunks; i++) fleetJson += normalizeText(meta[`fleet_${i}`] || "");
      let vehicles = [];
      try { vehicles = JSON.parse(fleetJson); } catch { /* malformed */ }
      if (!vehicles.length) {
        console.error("[valuation_fleet] No vehicle data in metadata.");
        return res.status(200).json({ ok: true, received: true, eventType });
      }
      const fullVehicles = vehicles.map((v) => ({
        brand:    v.b || "",
        model:    v.m || "",
        year:     v.y ? Number(v.y) : null,
        mileage:  v.k ? Number(String(v.k).replace(/\./g, "").replace(/,/g, ".")) : null,
        fuel:     v.f || "",
        plate:    v.p || "",
        province: v.pr || "",
      }));
      let reports = [];
      try {
        const generateSellReport = getGenerateSellReport();
        reports = await Promise.all(fullVehicles.map((v) => generateSellReport(v)));
        console.log(`[valuation_fleet] ${reports.length} PDFs generated`);
      } catch (pdfErr) {
        console.error("[valuation_fleet] PDF generation failed, sending email without attachments:", pdfErr?.message);
      }
      try {
        await sendFleetEmail({ to: email, reports, vehicles: fullVehicles });
        console.log(`[valuation_fleet] Email sent to ${email}`);
      } catch (mailErr) {
        console.error("[valuation_fleet] Email error:", mailErr?.message);
      }
      try {
        const sessionId = normalizeText(eventData?.id);
        const amountEur = (eventData?.amount_total || 0) / 100;
        const year = new Date().getFullYear();
        const invoiceNum = `CW-${year}-${sessionId.slice(-6).toUpperCase()}`;
        const count = fullVehicles.length;
        const invoiceRecord = {
          id: sessionId || `fleet-${Date.now()}`,
          number: invoiceNum,
          date: new Date().toISOString(),
          amount: amountEur,
          status: "Pagada",
          pdfUrl: "",
          description: `Informe de Mercado de Flota · ${count} vehículo${count !== 1 ? "s" : ""}`,
        };
        await upsertInvoiceToPostgres(email, invoiceRecord);
        appendOrUpdateInvoice(email, invoiceRecord);
        try {
          const userProfile = await getUserProfile(email);
          const invoicePdf = await generateInvoicePdf(invoiceRecord, userProfile);
          await markInvoiceGenerated(invoiceRecord.id);
          await uploadInvoicePdfAndSaveUrl(invoiceRecord.id, invoicePdf, invoiceRecord.number);
          await sendInvoiceEmail({ to: email, pdfBuffer: invoicePdf, invoiceRecord });
          await markInvoiceSent(invoiceRecord.id);
          console.log(`[valuation_fleet] Factura enviada a ${email}`);
        } catch (mailErr) {
          console.error("[valuation_fleet] Error enviando factura:", mailErr?.message);
        }
      } catch (invErr) {
        console.error("[valuation_fleet] Error creating invoice record:", invErr?.message);
      }
      return res.status(200).json({ ok: true, received: true, eventType });
    }

    const resolvedPlan = resolvePlanById(planId);
    const resolvedPlanId = normalizeText(resolvedPlan?.id).toLowerCase();
    const resolvedPlanLabel = normalizeText(resolvedPlan?.label) || resolvePlanLabel(resolvedPlanId);

    if (email) {
      const newPlanId = resolvedPlanId || normalizeText(resolveAccount(email)?.billingState?.planId).toLowerCase() || "free";
      updateBillingState(email, {
        planId: newPlanId,
        planLabel: resolvedPlanLabel,
        status: "activa",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });
      await syncPlanToPostgres(email, newPlanId, "activa", {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });
    }
  }

  if (eventType === "customer.subscription.updated" || eventType === "customer.subscription.created" || eventType === "customer.subscription.deleted") {
    const customerId = normalizeText(eventData?.customer);
    const subscriptionId = normalizeText(eventData?.id);
    const email = getEmailByStripeCustomerId(customerId) || getEmailByStripeSubscriptionId(subscriptionId);

    if (email) {
      const resolvedPlan = resolvePlanFromSubscriptionObject(eventData);
      const currentAccount = resolveAccount(email);
      const newPlanId = normalizeText(resolvedPlan?.id).toLowerCase() || normalizeText(currentAccount?.billingState?.planId).toLowerCase() || "free";
      const newStatus = normalizeStripeSubscriptionStatus(eventData?.status);

      // Never downgrade an already-active plan to a transient/intermediate status.
      // checkout.session.completed is the authoritative source for initial activation.
      const currentDbStatus = normalizeText(currentAccount?.billingState?.status).toLowerCase();
      const ACTIVE_DB = new Set(["activa", "trialing"]);
      const DOWNGRADE_BLOCKED = new Set(["pendiente"]);
      if (ACTIVE_DB.has(currentDbStatus) && DOWNGRADE_BLOCKED.has(newStatus)) {
        console.log(`[webhook] blocking status downgrade ${currentDbStatus} → ${newStatus} for ${email}`);
      } else {
        updateBillingState(email, {
          planId: newPlanId,
          planLabel: normalizeText(resolvedPlan?.label) || normalizeText(currentAccount?.billingState?.planLabel) || `Plan ${MARCA.nombre}`,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: newStatus,
          nextBillingDate: toIsoDateFromEpoch(eventData?.current_period_end),
          cancelAtPeriodEnd: Boolean(eventData?.cancel_at_period_end),
        });
        await syncPlanToPostgres(email, newPlanId, newStatus, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          nextBillingDate: toIsoDateFromEpoch(eventData?.current_period_end),
          cancelAtPeriodEnd: Boolean(eventData?.cancel_at_period_end),
        });
      }
    }
  }

  if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
    const customerId = normalizeText(eventData?.customer);
    const email =
      normalizeText(eventData?.customer_email).toLowerCase() ||
      getEmailByStripeCustomerId(customerId);

    if (email) {
      const invoiceData = {
        id: normalizeText(eventData?.id),
        number: normalizeText(eventData?.number),
        date: toIsoDateFromEpoch(eventData?.created),
        amount: Number(eventData?.amount_paid || eventData?.amount_due || 0) / 100,
        status: eventType === "invoice.paid" ? "Pagada" : "Pago fallido",
        pdfUrl: normalizeText(eventData?.invoice_pdf || eventData?.hosted_invoice_url),
      };
      appendOrUpdateInvoice(email, invoiceData);
      await upsertInvoiceToPostgres(email, invoiceData);
    }
  }

  return res.status(200).json({ ok: true, received: true, eventType });
};

// Anotar una fianza cobrada no puede depender solo de que llegue el aviso de
// Stripe: al volver del pago se confirma también por el otro lado, y esa
// pantalla necesita hacer exactamente esto mismo.
module.exports.depositoRecibido = depositoRecibido;