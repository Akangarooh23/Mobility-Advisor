const crypto = require("crypto");
const {
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
  resolveAccount,
  updateBillingState,
} = require("../billingStore");
const { resolvePlanById, resolvePlanByStripePriceId } = require("../billingCatalog");
function getGenerateSellReport() {
  return require("../sellReportGenerator").generateSellReport;
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

async function upsertInvoiceToPostgres(email, invoice) {
  const pool = getWebhookPgPool();
  if (!pool || !email || !invoice?.id) return;
  try {
    await pool.query(
      `INSERT INTO moveadvisor_user_invoices (id, email, number, date, amount, status, pdf_url, description)
       VALUES ($1, lower($2), $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status      = EXCLUDED.status,
         pdf_url     = EXCLUDED.pdf_url,
         amount      = EXCLUDED.amount,
         description = EXCLUDED.description`,
      [
        invoice.id,
        email,
        invoice.number || "",
        invoice.date || null,
        invoice.amount || 0,
        invoice.status || "",
        invoice.pdfUrl || "",
        invoice.description || "",
      ]
    );
  } catch (e) {
    console.error("[webhook] upsertInvoiceToPostgres error:", e.message);
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
    return r.rows[0] || {};
  } catch { return {}; }
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
  function ln(x1, y1, x2, y2) { page.drawLine({ start:{x:x1,y:H-y1}, end:{x:x2,y:H-y2}, thickness:0.5, color:c("#e2e8f0") }); }
  function dt(str, x, y, size, font, color) { page.drawText(String(str||""), { x, y:H-y-size*0.78, size, font, color }); }

  const amount   = Number(invoiceRecord.amount || 0);
  const base     = parseFloat((amount / 1.21).toFixed(2));
  const iva      = parseFloat((amount - base).toFixed(2));
  const fmtEur   = (n) => n.toFixed(2) + " EUR";
  const clientName = [userProfile.name, userProfile.apellidos].filter(Boolean).join(" ") || invoiceRecord.email || "";
  const concept  = invoiceRecord.description || "Servicio CarsWise AI";
  const date     = invoiceRecord.date ? new Date(invoiceRecord.date).toLocaleDateString("es-ES") : "";

  // Header
  dt("CarsWise", 50, 50, 22, rb, c("#1e40af"));
  dt("www.carswiseai.com · hola@carswiseai.com", 50, 76, 8.5, ri, c("#64748b"));
  dt("FACTURA", 545, 50, 22, rb, c("#0f172a"));  // right-align approx
  dt(`N\xba: ${invoiceRecord.number || invoiceRecord.id}`, 545, 80, 9.5, ri, c("#475569"));
  dt(`Fecha: ${date}`, 545, 94, 9.5, ri, c("#475569"));
  ln(50, 115, 545, 115);

  // Client block
  dt("FACTURADO A", 50, 130, 8.5, rb, c("#94a3b8"));
  dt(clientName, 50, 145, 11, rb, c("#0f172a"));
  let ly = 162;
  const clientLines = [
    invoiceRecord.email,
    userProfile.phone,
    userProfile.tax_id ? `NIF/CIF: ${userProfile.tax_id}` : "",
    userProfile.billing_street,
    [userProfile.billing_postal_code, userProfile.billing_province].filter(Boolean).join(" "),
  ].filter(Boolean);
  clientLines.forEach(l => { dt(l, 50, ly, 9, ri, c("#475569")); ly += 13; });

  // Items table
  const tY = 250;
  fr(50, tY, 495, 24, c("#f8fafc"));
  dt("CONCEPTO", 60, tY + 7, 8.5, rb, c("#475569"));
  dt("IMPORTE", 480, tY + 7, 8.5, rb, c("#475569"));
  ln(50, tY + 24, 545, tY + 24);
  dt(concept, 60, tY + 34, 10, ri, c("#0f172a"));
  dt(fmtEur(base), 480, tY + 34, 10, ri, c("#0f172a"));
  ln(50, tY + 54, 545, tY + 54);

  // Totals
  const totY = tY + 64;
  dt("Base imponible:", 370, totY, 9, ri, c("#475569"));
  dt(fmtEur(base), 480, totY, 9, ri, c("#475569"));
  dt("IVA (21%):", 370, totY + 15, 9, ri, c("#475569"));
  dt(fmtEur(iva), 480, totY + 15, 9, ri, c("#475569"));
  fr(370, totY + 30, 175, 22, c("#1e40af"));
  dt("TOTAL:", 380, totY + 37, 11, rb, rgb(1,1,1));
  dt(fmtEur(amount), 480, totY + 37, 11, rb, rgb(1,1,1));

  // Pagada stamp
  dt("PAGADA", 60, totY + 78, 11, rb, c("#16a34a"));

  // Footer
  ln(50, 750, 545, 750);
  dt("CarsWise AI S.L. \xb7 Este documento tiene validez de factura.", 50, 758, 8, ri, c("#94a3b8"));

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function sendInvoiceEmail({ to, pdfBuffer, invoiceRecord }) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  const from   = normalizeText(process.env.RESEND_FROM_EMAIL) || "CarsWise AI <noreply@carswiseai.com>";
  if (!apiKey || !pdfBuffer) return;

  const invoiceNum = invoiceRecord.number || invoiceRecord.id || "CW";
  const concept    = invoiceRecord.description || "Servicio CarsWise AI";
  const amount     = Number(invoiceRecord.amount || 0).toFixed(2);

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <div style="background:#1C2B33;padding:20px 24px;border-radius:8px 8px 0 0">
        <span style="font-size:18px;font-weight:700;color:#fff">CarsWise<span style="color:#BA7517">.</span></span>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px">
        <h2 style="margin:0 0 8px;font-size:20px">Tu factura está lista</h2>
        <p style="color:#64748b;margin:0 0 24px">Adjunto encontrarás la factura en PDF correspondiente a tu compra.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr style="background:#f8fafc"><td style="padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:700">N.º FACTURA</td><td style="padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:700">CONCEPTO</td><td style="padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:700">TOTAL</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 12px;font-weight:600">${invoiceNum}</td><td style="padding:10px 12px">${concept}</td><td style="padding:10px 12px;font-weight:700;color:#1e40af">${amount} EUR</td></tr>
        </table>
        <p style="font-size:12px;color:#94a3b8;margin:0">CarsWise AI · <a href="https://carswiseai.com" style="color:#94a3b8">carswiseai.com</a></p>
      </div>
    </div>`;

  const payload = {
    from,
    to: [to],
    subject: `Factura ${invoiceNum} — CarsWise AI`,
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
  const from   = normalizeText(process.env.RESEND_FROM_EMAIL) || "CarsWise AI <noreply@carswiseai.com>";
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
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1C2B33;">
      <div style="background:#1C2B33;padding:28px 32px 24px;border-bottom:4px solid #BA7517;">
        <span style="font-size:20px;font-weight:800;color:#fff;">CarsWise<span style="color:#E0A33C;">.</span></span>
        <span style="font-size:11px;color:#9FB0BA;margin-left:10px;letter-spacing:0.06em;">TASACIÓN DE MERCADO</span>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">Tu informe está listo</h1>
        <p style="color:#6B7780;margin:0 0 24px;">Adjunto a este email encontrarás el PDF con el análisis completo de mercado para <strong>${vehicleLabel}</strong>.</p>
        <div style="background:#FBF4E9;border:1.5px solid #BA7517;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#BA7517;font-weight:700;margin-bottom:6px;">Precio óptimo de venta</div>
          <div style="font-size:36px;font-weight:800;color:#1C2B33;line-height:1;">${priceStr}</div>
          <div style="font-size:12px;color:#6B7780;margin-top:6px;">Basado en ${reportData.comparables || 0} comparables · Confianza ${reportData.confidence || 0}%</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
          <div style="background:#fff;border:1px solid #ECEEF0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#137370;">${reportData.comparables || "–"}</div>
            <div style="font-size:11px;color:#6B7780;margin-top:4px;">Unidades en portales</div>
          </div>
          <div style="background:#fff;border:1px solid #ECEEF0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#137370;">${reportData.days != null ? reportData.days + " d." : "–"}</div>
            <div style="font-size:11px;color:#6B7780;margin-top:4px;">Días medianos de venta</div>
          </div>
          <div style="background:#fff;border:1px solid #ECEEF0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#BA7517;">${reportData.demand || "–"}</div>
            <div style="font-size:11px;color:#6B7780;margin-top:4px;">Nivel de demanda</div>
          </div>
        </div>
        <p style="font-size:13px;color:#6B7780;">El PDF adjunto incluye el análisis completo por portales, histograma de precios, estrategia de venta y recomendaciones personalizadas.</p>
        <p style="font-size:12px;color:#9AA3AB;margin-top:24px;">Este informe es válido durante 30 días desde su emisión · CarsWise AI · <a href="https://www.carswiseai.com" style="color:#137370;">www.carswiseai.com</a></p>
      </div>
    </div>`;

  const payload = {
    from,
    to: [to],
    subject: `Tu informe de tasación — ${vehicleLabel}`,
    html,
    ...(pdfBuffer ? { attachments: [{ filename: `Informe_Tasacion_CarsWise.pdf`, content: pdfBuffer.toString("base64") }] } : {}),
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
  const from   = normalizeText(process.env.RESEND_FROM_EMAIL) || "CarsWise AI <noreply@carswiseai.com>";
  if (!apiKey) { console.warn("[valuation_fleet] RESEND_API_KEY not set."); return; }

  const count = vehicles.length;
  const rows = vehicles.map((v, i) => {
    const r = reports[i];
    const label = [v.brand, v.model, v.year].filter(Boolean).join(" ") || `Vehículo ${i + 1}`;
    const price = r?.reportData?.priceOptimal
      ? new Intl.NumberFormat("es-ES").format(r.reportData.priceOptimal) + " €"
      : "–";
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1C2B33;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#137370;font-weight:700;">${price}</td>${v.plate ? `<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#6B7780;">${v.plate}</td>` : "<td></td>"}</tr>`;
  }).join("");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1C2B33;">
      <div style="background:#1C2B33;padding:28px 32px 24px;border-bottom:4px solid #BA7517;">
        <span style="font-size:20px;font-weight:800;color:#fff;">CarsWise<span style="color:#E0A33C;">.</span></span>
        <span style="font-size:11px;color:#9FB0BA;margin-left:10px;letter-spacing:0.06em;">TASACIÓN DE FLOTA</span>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">Tus ${count} informes están listos</h1>
        <p style="color:#6B7780;margin:0 0 24px;">Adjunto a este email encontrarás ${count} informes PDF, uno por cada vehículo analizado.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#fafafa;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead><tr style="background:#f0fafa;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7780;letter-spacing:0.06em;text-transform:uppercase;">Vehículo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7780;letter-spacing:0.06em;text-transform:uppercase;">Precio óptimo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7780;letter-spacing:0.06em;text-transform:uppercase;">Matrícula</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#9AA3AB;">Cada PDF incluye análisis por portales, histograma de precios, estrategia de venta y recomendaciones. Válido 30 días · CarsWise AI</p>
      </div>
    </div>`;

  const attachments = reports
    .map((r, i) => {
      if (!r?.pdfBuffer) return null;
      const v = vehicles[i] || {};
      const name = [v.brand, v.model, v.plate].filter(Boolean).join("_").replace(/\s+/g, "_") || `vehiculo_${i + 1}`;
      return { filename: `Informe_Tasacion_${name}.pdf`, content: r.pdfBuffer.toString("base64") };
    })
    .filter(Boolean);

  const payload = { from, to: [to], subject: `Tus ${count} informes de tasación — CarsWise`, html };
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

  if (webhookSecret) {
    const isValid = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
    if (!isValid) {
      return res.status(400).json({ error: "Firma de webhook no valida." });
    }
  }

  const event = safeJsonParse(rawBody);
  const eventType = normalizeText(event?.type);
  const eventData = event?.data?.object || {};

  if (!eventType) {
    return res.status(400).json({ error: "Evento de Stripe invalido." });
  }

  if (eventType === "checkout.session.completed") {
    const email = normalizeText(eventData?.customer_email || eventData?.customer_details?.email).toLowerCase();
    const customerId = normalizeText(eventData?.customer);
    const subscriptionId = normalizeText(eventData?.subscription);
    const planId = normalizeText(eventData?.metadata?.plan_id).toLowerCase();

    // ── Valuation one-time payment ──────────────────────────────────────────
    if (planId === "valuation" && email) {
      const meta = eventData?.metadata || {};
      const vehicle = {
        brand:           normalizeText(meta.veh_brand),
        model:           normalizeText(meta.veh_model),
        version:         normalizeText(meta.veh_version),
        year:            meta.veh_year    ? Number(meta.veh_year)    : null,
        mileage:         meta.veh_mileage ? Number(meta.veh_mileage) : null,
        fuel:            normalizeText(meta.veh_fuel),
        plate:           normalizeText(meta.veh_plate),
        damageLevel:     normalizeText(meta.veh_damage),
        damageDescription: normalizeText(meta.veh_damage_desc),
        province:        normalizeText(meta.veh_province),
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
          await sendInvoiceEmail({ to: email, pdfBuffer: invoicePdf, invoiceRecord });
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
        mileage:  v.k ? Number(v.k) : null,
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
          description: `Informe de Tasación de Flota · ${count} vehículo${count !== 1 ? "s" : ""}`,
        };
        await upsertInvoiceToPostgres(email, invoiceRecord);
        appendOrUpdateInvoice(email, invoiceRecord);
        try {
          const userProfile = await getUserProfile(email);
          const invoicePdf = await generateInvoicePdf(invoiceRecord, userProfile);
          await sendInvoiceEmail({ to: email, pdfBuffer: invoicePdf, invoiceRecord });
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
          planLabel: normalizeText(resolvedPlan?.label) || normalizeText(currentAccount?.billingState?.planLabel) || "Plan CarsWise",
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