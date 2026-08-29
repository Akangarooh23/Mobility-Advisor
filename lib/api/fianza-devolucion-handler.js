/**
 * Devolver la fianza de una importacion.
 *
 * La fianza se devuelve si al final no se hace el pedido. El cobro esta en
 * Stripe, y la clave de Stripe vive aqui y solo aqui: el ERP no la tiene ni debe
 * tenerla. Asi que quien devuelve es esto, y el ERP lo pide.
 *
 * Va con un secreto compartido en la cabecera, no con sesion de usuario: quien
 * llama no es una persona con cuenta, es la otra mitad del sistema. Sin el
 * secreto puesto no se atiende a nadie —fallar cerrado—, porque lo que hay
 * detras es devolver dinero.
 *
 * Lo que hace, en este orden:
 *
 *   1. Comprueba que la fianza esta cobrada y no devuelta ya.
 *   2. Pide la devolucion a Stripe sobre el cobro guardado.
 *   3. Solo si Stripe dice que si: lo deja escrito y emite la rectificativa.
 *   4. Y le escribe al cliente.
 *
 * El orden importa. Marcar antes de que Stripe confirme deja un expediente que
 * dice «devuelta» con el dinero todavia en la cuenta.
 */
const { MARCA, remitente, respuestaA } = require("../marca");
const { plantilla, parrafo, datos, esc } = require("../correo");

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) return null;
  const { Pool } = require("pg");
  _pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  return _pool;
}

const nt = (v) => String(v ?? "").trim();

/** El siguiente numero de una serie. El contador es el mismo que usa el ERP. */
async function siguienteNumero(pool, serie) {
  const year = new Date().getFullYear();
  const r = await pool.query(
    `INSERT INTO moveadvisor_invoice_counters (series, year, last_n)
     VALUES ($1, $2, 1)
     ON CONFLICT (series, year) DO UPDATE
       SET last_n = moveadvisor_invoice_counters.last_n + 1
     RETURNING last_n`,
    [serie, year]
  );
  return `${serie}-${year}-${String(r.rows[0]?.last_n || 1).padStart(4, "0")}`;
}

async function avisaAlCliente({ email, nombre, coche, importe, motivo, numero }) {
  const apiKey = nt(process.env.RESEND_API_KEY);
  if (!apiKey || !email) return;
  const html = plantilla({
    titulo: "Te devolvemos la fianza",
    cuerpo:
      parrafo(`Hola <strong>${esc(nombre) || "cliente"}</strong>,`) +
      parrafo(`No seguimos adelante con la importacion de <strong>${esc(coche)}</strong>, asi que te devolvemos la fianza.`) +
      datos([
        ["Importe", `${Number(importe).toLocaleString("es-ES")} €`],
        ["Motivo", esc(motivo) || "No se ha hecho el pedido"],
        ["Factura rectificativa", esc(numero)],
      ]) +
      parrafo("Vuelve a tu tarjeta por el mismo sitio por el que pagaste. Tu banco puede tardar unos dias en enseñarlo.", 14),
  });
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente(),
      reply_to: respuestaA(),
      to: email,
      subject: `Te devolvemos la fianza — ${coche || MARCA.nombre}`,
      html,
    }),
  }).catch((e) => console.error("[fianza-devolucion] correo:", e.message));
}

module.exports = async function fianzaDevolucionHandler(req, res) {
  if ((req.method || "POST").toUpperCase() !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secreto = nt(process.env.INTERNAL_API_SECRET);
  if (!secreto) {
    console.error("[fianza-devolucion] INTERNAL_API_SECRET sin configurar: no se atiende.");
    return res.status(503).json({ ok: false, error: "Devoluciones sin configurar." });
  }
  if (nt(req.headers?.authorization) !== `Bearer ${secreto}`) {
    return res.status(401).json({ ok: false, error: "No autorizado." });
  }

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const leadId = nt(body.leadId);
  const motivo = nt(body.motivo).slice(0, 300);
  if (!leadId) return res.status(400).json({ ok: false, error: "Falta la solicitud." });

  const pool = getPool();
  if (!pool) return res.status(500).json({ ok: false, error: "Sin base de datos." });

  let lead;
  try {
    const r = await pool.query(
      `SELECT id, user_email, contact_name, vehicle_title, deposit_quoted,
              deposit_paid_at, deposit_payment_ref, deposit_refunded_at
         FROM moveadvisor_market_leads WHERE id = $1 AND lead_type = 'import'`,
      [leadId]
    );
    lead = r.rows[0];
  } catch (e) {
    return res.status(500).json({ ok: false, error: "No se ha podido leer la solicitud." });
  }
  if (!lead) return res.status(404).json({ ok: false, error: "Esa solicitud de importacion no existe." });
  if (!lead.deposit_paid_at) return res.status(409).json({ ok: false, error: "Esa fianza no esta cobrada." });
  if (lead.deposit_refunded_at) return res.status(409).json({ ok: false, error: "Esa fianza ya se devolvio." });
  if (!nt(lead.deposit_payment_ref)) {
    return res.status(409).json({
      ok: false,
      error: "sin_cobro_guardado",
      detail: "No hay cobro guardado de esta fianza, asi que no se puede devolver desde aqui. Hazlo desde Stripe y marcalo despues.",
    });
  }

  // Stripe primero. Marcar antes dejaria un expediente que dice «devuelta» con
  // el dinero todavia en la cuenta.
  const clave = nt(process.env.STRIPE_SECRET_KEY);
  if (!clave) return res.status(503).json({ ok: false, error: "Sin clave de Stripe." });
  let devolucion;
  try {
    const r = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        payment_intent: nt(lead.deposit_payment_ref),
        reason: "requested_by_customer",
        "metadata[lead_id]": leadId,
      }).toString(),
    });
    devolucion = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: nt(devolucion?.error?.message) || "Stripe no ha aceptado la devolucion." });
    }
  } catch (e) {
    return res.status(502).json({ ok: false, error: "No se ha podido hablar con Stripe." });
  }

  // Devuelto de verdad: ahora se escribe.
  const importe = Number(lead.deposit_quoted || 0);
  let numero = "";
  try {
    await pool.query(
      `UPDATE moveadvisor_market_leads
          SET deposit_refunded_at = NOW(), deposit_refund_ref = $2
        WHERE id = $1`,
      [leadId, nt(devolucion?.id)]
    );
  } catch (e) {
    console.error("[fianza-devolucion] devuelta en Stripe pero sin marcar:", e.message);
  }
  try {
    numero = await siguienteNumero(pool, "RECT");
    await pool.query(
      `INSERT INTO moveadvisor_user_invoices
         (id, email, number, date, amount, status, description, cw_invoice_number, cw_paid_at)
       VALUES ($1, lower($2), $3, NOW(), $4, 'Devuelta', $5, $3, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        `rect-${leadId}`,
        nt(lead.user_email),
        numero,
        -importe,
        `Devolucion de fianza${lead.vehicle_title ? ` · ${nt(lead.vehicle_title)}` : ""}`,
      ]
    );
  } catch (e) {
    console.error("[fianza-devolucion] sin rectificativa:", e.message);
  }

  avisaAlCliente({
    email: nt(lead.user_email),
    nombre: nt(lead.contact_name),
    coche: nt(lead.vehicle_title),
    importe,
    motivo,
    numero,
  }).catch(() => {});

  return res.status(200).json({ ok: true, importe, rectificativa: numero, refund: nt(devolucion?.id) });
};
