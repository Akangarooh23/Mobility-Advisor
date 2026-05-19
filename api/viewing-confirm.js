"use strict";

const { confirmSlot, sendConfirmationEmails } = require("../lib/viewingStore");

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

module.exports = async function viewingConfirmHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const token = normalizeText(body.token);
  const slot  = normalizeText(body.slot);

  if (!token) return res.status(400).json({ error: "token requerido" });
  if (!slot)  return res.status(400).json({ error: "Debes seleccionar una franja horaria" });

  try {
    const appointment = await confirmSlot(token, slot);
    if (!appointment) {
      return res.status(404).json({ error: "Solicitud no encontrada, token inválido o ya confirmada" });
    }

    await sendConfirmationEmails({ appointment });

    return res.status(200).json({ ok: true, slot: appointment.confirmed_slot });
  } catch (err) {
    console.error("[viewing-confirm] error:", err.message);
    return res.status(500).json({ error: "Error al confirmar la cita: " + err.message });
  }
};
