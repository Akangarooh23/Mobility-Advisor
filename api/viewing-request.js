"use strict";

const { Pool } = require("pg");
const { createViewingRequest, sendSellerRequestEmail } = require("../lib/viewingStore");

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

module.exports = async function viewingRequestHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const offerId    = normalizeText(body.offer_id);
  const buyerEmail = normalizeText(body.buyer_email).toLowerCase();
  const buyerName  = normalizeText(body.buyer_name);
  const buyerMessage = normalizeText(body.buyer_message).slice(0, 500);

  if (!offerId) return res.status(400).json({ error: "offer_id requerido" });
  if (!buyerEmail || !buyerEmail.includes("@")) return res.status(400).json({ error: "Email de comprador inválido" });

  // Resolve seller email and vehicle data from the offer
  const pool = getPool();
  let vehicleTitle = "";
  let vehicleImage = "";
  let sellerEmail  = "";
  try {
    const offerRes = await pool.query(
      `SELECT seller, seller_type, title, image_url FROM moveadvisor_marketplace_vo_offers WHERE id = $1 AND is_active = TRUE`,
      [offerId]
    );
    if (!offerRes.rows.length) {
      await pool.end();
      return res.status(404).json({ error: "Oferta no encontrada" });
    }
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

  if (!sellerEmail || !sellerEmail.includes("@")) {
    return res.status(422).json({ error: "Este anuncio no tiene vendedor con email registrado" });
  }
  if (sellerEmail === buyerEmail) {
    return res.status(422).json({ error: "No puedes solicitar una visita a tu propio vehículo" });
  }

  try {
    const { id, tokenSeller } = await createViewingRequest({
      offerId, vehicleTitle, vehicleImage, buyerEmail, buyerName, buyerMessage, sellerEmail,
    });

    await sendSellerRequestEmail({
      appointment: { seller_email: sellerEmail, buyer_email: buyerEmail, buyer_name: buyerName || buyerEmail, buyer_message: buyerMessage, vehicle_title: vehicleTitle },
      tokenSeller,
    });

    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error("[viewing-request] error:", err.message);
    return res.status(500).json({ error: "Error al crear la solicitud: " + err.message });
  }
};
