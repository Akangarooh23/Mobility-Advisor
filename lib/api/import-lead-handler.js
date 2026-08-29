// Lead de importación: cliente solicita un coche DE desde la ficha pública.
// Guarda el lead en moveadvisor_market_leads (aparece en el panel del ERP) y
// avisa por email (interno + confirmación al cliente) con la fianza del 30%.

const { Pool } = require("pg");
const { MARCA, remitente, respuestaA, correoInterno } = require("../marca");
const { plantilla, parrafo, datos, aviso } = require("../correo");

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const connString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connString) return null;
  _pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _pool;
}

function norm(v) { return typeof v === "string" ? v.trim() : ""; }
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function eur(n) { return `${Math.round(Number(n) || 0).toLocaleString("es-ES")} €`; }

async function sendEmails({ name, email, title, price, deposit }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = remitente();
  const internalEmail = process.env.INTERNAL_LEADS_EMAIL || correoInterno();

  const clientHtml = plantilla({
    titulo: "Hemos recibido tu solicitud de importación",
    cuerpo:
      parrafo(`Hola <strong>${esc(name)}</strong>,`) +
      parrafo(`Tu solicitud para importar <strong>${esc(title)}</strong> ha quedado registrada.`) +
      // La fianza es la condición que hay que aceptar para que esto avance: va
      // destacada, no dentro de un párrafo.
      aviso(
        `Reservarlo pide una fianza del 30 %: ${eur(deposit)}`,
        "Te llamamos para explicarte el proceso y confirmar la disponibilidad."
      ),
  });

  const internalHtml = plantilla({
    titulo: "Nueva solicitud de importación",
    cuerpo: datos([
      ["Vehículo", esc(title)],
      ["Precio importado estimado", eur(price)],
      ["Fianza 30 %", eur(deposit)],
      ["Cliente", esc(name)],
      ["Email", `<a href="mailto:${esc(email)}">${esc(email)}</a>`],
    ]),
    pie: "Aviso interno del equipo.",
  });

  await Promise.allSettled([
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, reply_to: respuestaA(), to: email, subject: `Solicitud de importación — ${title || MARCA.nombre}`, html: clientHtml }),
    }),
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: internalEmail, subject: `Lead de importación — ${title || "sin vehículo"}`, html: internalHtml }),
    }),
  ]);
}

module.exports = async function importLeadHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  const offerId = norm(body.offer_id);
  const name    = norm(body.name);
  const email   = norm(body.email).toLowerCase();
  const phone   = norm(body.phone);
  const message = norm(body.message).slice(0, 500);

  if (!offerId) return res.status(400).json({ ok: false, error: "offer_id requerido" });
  if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "Email inválido" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ ok: false, error: "Sin base de datos" });

  try {
    const offerRes = await pool.query(
      `SELECT title, price::numeric AS price, import_cost
       FROM moveadvisor_market_offers WHERE id = $1 AND country = 'DE' AND import_published = TRUE`,
      [offerId]
    );
    if (!offerRes.rows.length) return res.status(404).json({ ok: false, error: "Oferta de importación no encontrada" });
    const offer = offerRes.rows[0];
    const importPrice = Math.round(Number(offer.price || 0) + Number(offer.import_cost || 0));
    const deposit = Math.round(importPrice * 0.30);
    const title = norm(offer.title);

    const leadId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const contactWhen = [phone ? `Tel: ${phone}` : "", message].filter(Boolean).join(" · ").slice(0, 500);
    // La fianza se guarda, no solo se manda.
    //
    // Es lo que se le ha prometido al cliente en el correo. El precio de la
    // oferta puede cambiar despues, o la oferta dejar de estar publicada, y
    // entonces ya no habria forma de saber que numero se le dio. Quien atienda
    // el lead tiene que ver esa cifra, no una recalculada hoy.
    await pool.query(
      `INSERT INTO moveadvisor_market_leads
         (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal, contact_name, contact_when,
          deposit_quoted)
       VALUES ($1, $2, 'import', $3, $4, $5, 'importacion', $6, $7, $8)`,
      [leadId, email, offerId, title, `/marketplace-vo/${offerId}`, name, contactWhen, deposit]
    );

    sendEmails({ name, email, title, price: importPrice, deposit })
      .catch((err) => console.error("[import-lead] email error:", err?.message));

    return res.status(200).json({ ok: true, id: leadId, deposit });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Error al registrar la solicitud: " + (err?.message || "") });
  }
};
