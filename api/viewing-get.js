"use strict";

const { getByToken } = require("../lib/viewingStore");

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

module.exports = async function viewingGetHandler(req, res) {
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
        id: row.id,
        offer_id: row.offer_id,
        vehicle_title: row.vehicle_title,
        vehicle_image: row.vehicle_image,
        buyer_name: row.buyer_name,
        buyer_message: row.buyer_message,
        status: row.status,
        proposed_slots: Array.isArray(row.proposed_slots) ? row.proposed_slots : [],
        confirmed_slot: row.confirmed_slot || null,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error("[viewing-get] error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
