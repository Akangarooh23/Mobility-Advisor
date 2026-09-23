"use strict";

const { Pool } = require("pg");
const { identidadDeLaPeticion } = require("./identidad");
const FRENO = require("../freno");
const { MARCA, remitente, respuestaA, correoInterno } = require("../marca");
const { plantilla, parrafo, datos, aviso } = require("../correo");
const {
  createViewingRequest, getByToken, proposeSlots, confirmSlot,
  sendSellerRequestEmail, sendBuyerProposalEmail, sendConfirmationEmails,
} = require("../viewingStore");

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

/**
 * Desde qué dirección llega la petición.
 *
 * Detrás de Vercel, la de verdad es la primera de `x-forwarded-for`: las de
 * después son los saltos intermedios. `socket.remoteAddress` sería siempre la
 * del proxy, es decir, la misma para todo el mundo.
 */
function quienLlama(req) {
  const cadena = normalizeText(req?.headers?.["x-forwarded-for"]);
  if (cadena) return cadena.split(",")[0].trim();
  return normalizeText(req?.socket?.remoteAddress) || "";
}
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function sendViewingLeadEmails({ name, email, message, vehicle_title }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = remitente();
  const internalEmail = process.env.INTERNAL_LEADS_EMAIL || correoInterno();
  if (!apiKey) return;

  const clientHtml = plantilla({
    titulo: "Hemos recibido tu solicitud",
    cuerpo:
      parrafo(`Hola <strong>${esc(name)}</strong>,`) +
      parrafo(`Tu solicitud de visita para <strong>${esc(vehicle_title)}</strong> ha quedado registrada.`) +
      aviso("Te llamamos en menos de dos horas laborables", "Para acordar contigo el día y la hora."),
  });

  const internalHtml = plantilla({
    titulo: "Nueva solicitud de visita",
    cuerpo: datos([
      ["Vehículo", esc(vehicle_title)],
      ["Cliente", esc(name)],
      ["Email", `<a href="mailto:${esc(email)}">${esc(email)}</a>`],
      ["Mensaje", esc(message)],
    ]),
    pie: "Aviso interno del equipo.",
  });

  const results = await Promise.allSettled([
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, reply_to: respuestaA(), to: email, subject: `Solicitud recibida — ${vehicle_title || MARCA.nombre}`, html: clientHtml }),
    }),
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: internalEmail, subject: `Nueva visita — ${vehicle_title || "sin vehículo"}`, html: internalHtml }),
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
  /*
   * Con sesión, el correo es el de la sesión. Sin sesión, el que escriba.
   *
   * Esta ruta **tiene** que quedar abierta: es por donde entra un comprador que
   * ve un anuncio y pide visita, y todavía no tiene cuenta. Cerrarla con sesión
   * sería cerrar la puerta de entrada del negocio.
   *
   * Lo que sí se cierra es la suplantación: quien ha entrado con su cuenta no
   * puede pedir una visita a nombre de otro —y que al vendedor le llegue el
   * correo de esa persona—, porque el suyo manda sobre lo que venga escrito.
   *
   * Lo otro que hacía falta, el freno por ritmo, está unas líneas más abajo.
   */
  const { email: correoDeSesion } = await identidadDeLaPeticion(req, { cuerpo: body });
  const buyerEmail   = correoDeSesion || normalizeText(body.buyer_email).toLowerCase();
  const buyerName    = normalizeText(body.buyer_name);
  const buyerMessage = normalizeText(body.buyer_message).slice(0, 500);

  if (!offerId) return res.status(400).json({ error: "offer_id requerido" });
  if (!buyerEmail || !buyerEmail.includes("@")) return res.status(400).json({ error: "Email de comprador inválido" });

  const pool = getPool();

  /*
   * El freno que faltaba.
   *
   * Cada llamada a esto manda un correo al vendedor y otro al comprador. Sin
   * freno, mil llamadas son mil correos al vendedor desde su propio anuncio: no
   * hace falta entrar en ninguna cuenta para amargarle el día, ni para quemar
   * la reputación del dominio desde el que salen.
   *
   * Por correo y por IP, como el login. Y por IP también, porque el correo lo
   * escribe quien llama y cambiarlo es gratis.
   */
  const porCorreo = await FRENO.pide(pool, "visita", buyerEmail, FRENO.LIMITES.visita);
  const porIp     = await FRENO.pide(pool, "visita-ip", quienLlama(req), FRENO.LIMITES.visitaPorIp);
  if (!porCorreo.paso || !porIp.paso) {
    const espera = Math.max(porCorreo.enSegundos, porIp.enSegundos);
    try { await pool.end(); } catch {}
    res.setHeader("Retry-After", String(espera));
    return res.status(429).json({ error: "Has pedido varias visitas seguidas. Espera un momento." });
  }

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
