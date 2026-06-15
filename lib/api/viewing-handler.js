"use strict";

const { Pool } = require("pg");
const {
  createViewingRequest, getByToken, proposeSlots, confirmSlot,
  sendSellerRequestEmail, sendBuyerProposalEmail, sendConfirmationEmails,
} = require("../viewingStore");

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function sendViewingLeadEmails({ name, email, message, vehicle_title }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "CarsWise <onboarding@resend.dev>";
  const internalEmail = process.env.INTERNAL_LEADS_EMAIL || "akangarooh23@gmail.com";
  if (!apiKey) return;

  const clientHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#2563eb">Hemos recibido tu solicitud</h2>
      <p>Hola <strong>${esc(name)}</strong>,</p>
      <p>Tu solicitud de <strong>visita</strong> para el vehículo <strong>${esc(vehicle_title)}</strong> ha sido recibida correctamente.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:20px 0;font-size:14px;color:#1e40af">
        ⏱️ Te contactaremos en menos de <strong>2 horas</strong>.
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const internalHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2>🔔 Nueva solicitud de visita — Marketplace VO</h2>
      <p><strong>Vehículo:</strong> ${esc(vehicle_title)}</p>
      <p><strong>Cliente:</strong> ${esc(name)} — <a href="mailto:${esc(email)}">${esc(email)}</a></p>
      ${message ? `<p><strong>Mensaje:</strong> ${esc(message)}</p>` : ""}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">CarsWise ERP</p>
    </div>`;

  const results = await Promise.allSettled([
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject: `Solicitud recibida — ${vehicle_title || "CarsWise"}`, html: clientHtml }),
    }),
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: internalEmail, subject: `🔔 Nueva visita: ${vehicle_title || "sin vehículo"}`, html: internalHtml }),
    }),
  ]);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[viewing-handler] email[${i}] error:`, r.reason?.message);
  });
}

async function handleRequest(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  const offerId      = normalizeText(body.offer_id);
  const buyerEmail   = normalizeText(body.buyer_email).toLowerCase();
  const buyerName    = normalizeText(body.buyer_name);
  const buyerMessage = normalizeText(body.buyer_message).slice(0, 500);

  if (!offerId) return res.status(400).json({ error: "offer_id requerido" });
  if (!buyerEmail || !buyerEmail.includes("@")) return res.status(400).json({ error: "Email de comprador inválido" });

  const pool = getPool();
  let vehicleTitle = "", vehicleImage = "", sellerEmail = "", sellerType = "";
  try {
    const offerRes = await pool.query(
      `SELECT seller, seller_type, title, image_url FROM moveadvisor_marketplace_vo_offers WHERE id = $1 AND is_active = TRUE`,
      [offerId]
    );
    if (!offerRes.rows.length) { await pool.end(); return res.status(404).json({ error: "Oferta no encontrada" }); }
    const offer = offerRes.rows[0];
    vehicleTitle = normalizeText(offer.title);
    vehicleImage = normalizeText(offer.image_url);
    sellerEmail  = normalizeText(offer.seller).toLowerCase();
    sellerType   = normalizeText(offer.seller_type);

    // Professional/CarsWise offers → save as marketplace lead so it appears in the panel
    if (sellerType !== "particular") {
      const leadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await pool.query(
        `INSERT INTO moveadvisor_market_leads
           (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal, contact_name, contact_when)
         VALUES ($1, $2, 'visit', $3, $4, $5, 'marketplace-vo', $6, $7)`,
        [leadId, buyerEmail, offerId, vehicleTitle, `/marketplace-vo/${offerId}`, buyerName, buyerMessage]
      );
      await pool.end();
      sendViewingLeadEmails({ name: buyerName, email: buyerEmail, message: buyerMessage, vehicle_title: vehicleTitle })
        .catch(err => console.error("[viewing-handler] email error:", err.message));
      return res.status(200).json({ ok: true, id: leadId });
    }

    await pool.end();
  } catch (err) {
    try { await pool.end(); } catch {}
    return res.status(500).json({ error: "Error al resolver la oferta: " + err.message });
  }

  if (!sellerEmail || !sellerEmail.includes("@")) return res.status(422).json({ error: "Este anuncio no tiene vendedor con email registrado" });
  if (sellerEmail === buyerEmail) return res.status(422).json({ error: "No puedes solicitar una visita a tu propio vehículo" });

  try {
    const { id, tokenSeller } = await createViewingRequest({ offerId, vehicleTitle, vehicleImage, buyerEmail, buyerName, buyerMessage, sellerEmail });
    await sendSellerRequestEmail({ appointment: { seller_email: sellerEmail, buyer_email: buyerEmail, buyer_name: buyerName || buyerEmail, buyer_message: buyerMessage, vehicle_title: vehicleTitle }, tokenSeller });
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    return res.status(500).json({ error: "Error al crear la solicitud: " + err.message });
  }
}

async function handlePropose(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  const token = normalizeText(body.token);
  const slots = Array.isArray(body.slots) ? body.slots.filter(s => typeof s === "string" && s.length > 0).slice(0, 3) : [];
  if (!token) return res.status(400).json({ error: "token requerido" });
  if (slots.length === 0) return res.status(400).json({ error: "Debes proponer al menos una franja horaria" });

  try {
    const appointment = await proposeSlots(token, slots);
    if (!appointment) return res.status(404).json({ error: "Solicitud no encontrada, token inválido o ya procesada" });
    appointment.proposed_slots = slots;
    await sendBuyerProposalEmail({ appointment, tokenBuyer: appointment.token_buyer });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Error al proponer fechas: " + err.message });
  }
}

async function handleConfirm(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  const token = normalizeText(body.token);
  const slot  = normalizeText(body.slot);
  if (!token) return res.status(400).json({ error: "token requerido" });
  if (!slot)  return res.status(400).json({ error: "Debes seleccionar una franja horaria" });

  try {
    const appointment = await confirmSlot(token, slot);
    if (!appointment) return res.status(404).json({ error: "Solicitud no encontrada, token inválido o ya confirmada" });
    await sendConfirmationEmails({ appointment });
    return res.status(200).json({ ok: true, slot: appointment.confirmed_slot });
  } catch (err) {
    return res.status(500).json({ error: "Error al confirmar la cita: " + err.message });
  }
}

async function handleGet(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const token = normalizeText(req.query?.token || "");
  if (!token) return res.status(400).json({ error: "token requerido" });

  try {
    const row = await getByToken(token);
    if (!row) return res.status(404).json({ error: "Solicitud no encontrada" });
    const isSellerToken = row.token_seller === token;
    return res.status(200).json({
      ok: true,
      role: isSellerToken ? "seller" : "buyer",
      appointment: {
        id: row.id, offer_id: row.offer_id, vehicle_title: row.vehicle_title,
        vehicle_image: row.vehicle_image, buyer_name: row.buyer_name,
        buyer_message: row.buyer_message, status: row.status,
        proposed_slots: Array.isArray(row.proposed_slots) ? row.proposed_slots : [],
        confirmed_slot: row.confirmed_slot || null, created_at: row.created_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = async function viewingRouter(req, res) {
  const route = String(req.query?.route || "").toLowerCase();
  switch (route) {
    case "viewing-request":
    case "request":  return handleRequest(req, res);
    case "viewing-propose":
    case "propose":  return handlePropose(req, res);
    case "viewing-confirm":
    case "confirm":  return handleConfirm(req, res);
    case "viewing-get":
    case "get":      return handleGet(req, res);
    default:         return res.status(404).json({ error: "Viewing route not found" });
  }
};
