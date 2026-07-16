// Lead de importación: cliente solicita un coche DE desde la ficha pública.
// Guarda el lead en moveadvisor_market_leads (aparece en el panel del ERP) y
// avisa por email (interno + confirmación al cliente) con la fianza del 30%.

const { Pool } = require("pg");

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
  const from = process.env.RESEND_FROM_EMAIL || "CarsWise <onboarding@resend.dev>";
  const internalEmail = process.env.INTERNAL_LEADS_EMAIL || "akangarooh23@gmail.com";

  const clientHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#0891b2">Solicitud de importación recibida</h2>
      <p>Hola <strong>${esc(name)}</strong>,</p>
      <p>Hemos recibido tu solicitud para importar <strong>${esc(title)}</strong>.</p>
      <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:16px;margin:20px 0;font-size:14px;color:#155e75">
        Para reservar este vehículo de importación se requiere una <strong>fianza del 30%</strong>: <strong>${eur(deposit)}</strong>.
        Te contactaremos para explicarte el proceso y confirmar la disponibilidad.
      </div>
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;
  const internalHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2>🌍 Nueva solicitud de IMPORTACIÓN</h2>
      <p><strong>Vehículo:</strong> ${esc(title)}</p>
      <p><strong>Precio importado estimado:</strong> ${eur(price)}</p>
      <p><strong>Fianza 30%:</strong> ${eur(deposit)}</p>
      <p><strong>Cliente:</strong> ${esc(name)} — <a href="mailto:${esc(email)}">${esc(email)}</a></p>
    </div>`;

  await Promise.allSettled([
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject: `Solicitud de importación — ${title || "CarsWise"}`, html: clientHtml }),
    }),
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: internalEmail, subject: `🌍 Lead importación: ${title || "sin vehículo"}`, html: internalHtml }),
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
    await pool.query(
      `INSERT INTO moveadvisor_market_leads
         (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal, contact_name, contact_when)
       VALUES ($1, $2, 'import', $3, $4, $5, 'importacion', $6, $7)`,
      [leadId, email, offerId, title, `/marketplace-vo/${offerId}`, name, contactWhen]
    );

    sendEmails({ name, email, title, price: importPrice, deposit })
      .catch((err) => console.error("[import-lead] email error:", err?.message));

    return res.status(200).json({ ok: true, id: leadId, deposit });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Error al registrar la solicitud: " + (err?.message || "") });
  }
};
