"use strict";

const { Pool } = require("pg");
const {
  createViewingRequest, getByToken, proposeSlots, confirmSlot,
  sendSellerRequestEmail, sendBuyerProposalEmail, sendConfirmationEmails,
} = require("../lib/viewingStore");

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

function resolveRoute(req) {
  const explicit = normalizeText(req.query?.route || "").toLowerCase();
  if (explicit) return explicit;
  const url = String(req.url || "").toLowerCase();
  if (url.includes("viewing-request")) return "request";
  if (url.includes("viewing-propose")) return "propose";
  if (url.includes("viewing-confirm")) return "confirm";
  if (url.includes("viewing-get"))     return "get";
  return "";
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
  let vehicleTitle = "", vehicleImage = "", sellerEmail = "";
  try {
    const offerRes = await pool.query(
      `SELECT seller, seller_type, title, image_url FROM moveadvisor_marketplace_vo_offers WHERE id = $1 AND is_active = TRUE`,
      [offerId]
    );
    if (!offerRes.rows.length) { await pool.end(); return res.status(404).json({ error: "Oferta no encontrada" }); }
    const offer = offerRes.rows[0];
    if (normalizeText(offer.seller_type) !== "particular") {
      await pool.end();
      return res.status(422).json({ error: "Este vehículo es de CarsWise — para visitas usa el formulario de contacto habitual" });
    }
    vehicleTitle = normalizeText(offer.title);
    vehicleImage = normalizeText(offer.image_url);
    sellerEmail  = normalizeText(offer.seller).toLowerCase();
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
  switch (resolveRoute(req)) {
    case "request": return handleRequest(req, res);
    case "propose":  return handlePropose(req, res);
    case "confirm":  return handleConfirm(req, res);
    case "get":      return handleGet(req, res);
    default:         return res.status(404).json({ error: "Viewing route not found" });
  }
};
