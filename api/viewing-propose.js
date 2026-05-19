"use strict";

const { proposeSlots, sendBuyerProposalEmail } = require("../lib/viewingStore");

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

module.exports = async function viewingProposeHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const token = normalizeText(body.token);
  const slots  = Array.isArray(body.slots) ? body.slots.filter(s => typeof s === "string" && s.length > 0).slice(0, 3) : [];

  if (!token) return res.status(400).json({ error: "token requerido" });
  if (slots.length === 0) return res.status(400).json({ error: "Debes proponer al menos una franja horaria" });

  try {
    const appointment = await proposeSlots(token, slots);
    if (!appointment) {
      return res.status(404).json({ error: "Solicitud no encontrada, token inválido o ya procesada" });
    }

    appointment.proposed_slots = slots;
    await sendBuyerProposalEmail({ appointment, tokenBuyer: appointment.token_buyer });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[viewing-propose] error:", err.message);
    return res.status(500).json({ error: "Error al proponer fechas: " + err.message });
  }
};
