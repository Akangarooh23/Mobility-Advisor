"use strict";

const { Pool } = require("pg");
const crypto = require("crypto");

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_viewing_appointments (
      id             VARCHAR(64)   PRIMARY KEY,
      offer_id       VARCHAR(255)  NOT NULL,
      vehicle_title  VARCHAR(255)  NOT NULL DEFAULT '',
      vehicle_image  TEXT          NOT NULL DEFAULT '',
      buyer_email    VARCHAR(255)  NOT NULL,
      buyer_name     VARCHAR(255)  NOT NULL DEFAULT '',
      buyer_message  TEXT          NOT NULL DEFAULT '',
      seller_email   VARCHAR(255)  NOT NULL,
      status         VARCHAR(40)   NOT NULL DEFAULT 'pending_seller',
      proposed_slots JSONB         NOT NULL DEFAULT '[]',
      confirmed_slot TIMESTAMPTZ,
      token_seller   VARCHAR(64),
      token_buyer    VARCHAR(64),
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);
}

async function createViewingRequest({ offerId, vehicleTitle, vehicleImage, buyerEmail, buyerName, buyerMessage, sellerEmail }) {
  const pool = getPool();
  try {
    await ensureTable(pool);
    const id = generateToken().slice(0, 32);
    const tokenSeller = generateToken();
    const tokenBuyer = generateToken();
    await pool.query(
      `INSERT INTO moveadvisor_viewing_appointments
         (id, offer_id, vehicle_title, vehicle_image, buyer_email, buyer_name, buyer_message, seller_email, token_seller, token_buyer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, normalizeText(offerId), normalizeText(vehicleTitle), normalizeText(vehicleImage),
       normalizeText(buyerEmail).toLowerCase(), normalizeText(buyerName),
       normalizeText(buyerMessage), normalizeText(sellerEmail).toLowerCase(),
       tokenSeller, tokenBuyer]
    );
    return { id, tokenSeller, tokenBuyer };
  } finally {
    await pool.end();
  }
}

async function getByToken(token) {
  const pool = getPool();
  try {
    await ensureTable(pool);
    const res = await pool.query(
      `SELECT * FROM moveadvisor_viewing_appointments WHERE token_seller = $1 OR token_buyer = $1 LIMIT 1`,
      [normalizeText(token)]
    );
    return res.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function proposeSlots(tokenSeller, slots) {
  const pool = getPool();
  try {
    await ensureTable(pool);
    const res = await pool.query(
      `UPDATE moveadvisor_viewing_appointments
       SET proposed_slots = $1, status = 'pending_buyer', updated_at = NOW()
       WHERE token_seller = $2 AND status = 'pending_seller'
       RETURNING *`,
      [JSON.stringify(slots), normalizeText(tokenSeller)]
    );
    return res.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function confirmSlot(tokenBuyer, slot) {
  const pool = getPool();
  try {
    await ensureTable(pool);
    const res = await pool.query(
      `UPDATE moveadvisor_viewing_appointments
       SET confirmed_slot = $1, status = 'confirmed', updated_at = NOW()
       WHERE token_buyer = $2 AND status = 'pending_buyer'
       RETURNING *`,
      [slot, normalizeText(tokenBuyer)]
    );
    return res.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function listBySellerEmail(email) {
  const pool = getPool();
  try {
    await ensureTable(pool);
    const res = await pool.query(
      `SELECT id, offer_id, vehicle_title, vehicle_image, buyer_name, buyer_message,
              status, proposed_slots, confirmed_slot, created_at, updated_at
       FROM moveadvisor_viewing_appointments
       WHERE seller_email = $1
       ORDER BY created_at DESC LIMIT 30`,
      [normalizeText(email).toLowerCase()]
    );
    return res.rows || [];
  } finally {
    await pool.end();
  }
}

// ─── Email helpers ─────────────────────────────────────────────────────────────

const BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.carswiseai.com";
const FROM = process.env.ALERT_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "CarsWise <notificaciones@carswiseai.com>";

function escapeHtml(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatSlot(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  } catch { return iso; }
}

async function sendResendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[viewingEmail] simulado → ${to}: ${subject}`);
    return;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data?.message || "Resend error " + resp.status);
  }
}

async function sendSellerRequestEmail({ appointment, tokenSeller }) {
  const proposeUrl = `${BASE_URL}/cita/proponer?token=${tokenSeller}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;">
      <h2 style="color:#2563eb;">🚗 Alguien quiere ver tu vehículo</h2>
      <p>El comprador <strong>${escapeHtml(appointment.buyer_name || appointment.buyer_email)}</strong> quiere visitar tu vehículo:</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:14px;margin:12px 0;">
        <strong>${escapeHtml(appointment.vehicle_title)}</strong>
      </div>
      ${appointment.buyer_message ? `<p style="color:#475569;font-style:italic;">"${escapeHtml(appointment.buyer_message)}"</p>` : ""}
      <p>Propón hasta 3 franjas horarias disponibles para que el comprador elija la que más le convenga.</p>
      <a href="${proposeUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Proponer fechas disponibles</a>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px;">Si no has publicado ningún vehículo o este email te ha llegado por error, ignóralo.</p>
    </div>`;
  await sendResendEmail({ to: appointment.seller_email, subject: `Solicitud de visita · ${appointment.vehicle_title}`, html });
}

async function sendBuyerProposalEmail({ appointment, tokenBuyer }) {
  const confirmUrl = `${BASE_URL}/cita/confirmar?token=${tokenBuyer}`;
  const slots = Array.isArray(appointment.proposed_slots) ? appointment.proposed_slots : [];
  const slotsHtml = slots.map(s => `<li style="margin:6px 0;"><strong>${escapeHtml(formatSlot(s))}</strong></li>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;">
      <h2 style="color:#16a34a;">📅 El vendedor propone estas fechas</h2>
      <p>El vendedor del vehículo <strong>${escapeHtml(appointment.vehicle_title)}</strong> ha propuesto las siguientes franjas horarias:</p>
      <ul style="padding-left:20px;">${slotsHtml}</ul>
      <p>Accede al enlace para elegir la fecha que más te convenga y confirmar la cita.</p>
      <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Elegir fecha y confirmar</a>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px;">Si no reconoces esta solicitud, ignora este email.</p>
    </div>`;
  await sendResendEmail({ to: appointment.buyer_email, subject: `El vendedor propone fechas · ${appointment.vehicle_title}`, html });
}

async function sendConfirmationEmails({ appointment }) {
  const slot = formatSlot(appointment.confirmed_slot);
  const buyerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;">
      <h2 style="color:#16a34a;">✅ Cita confirmada</h2>
      <p>Tu visita al vehículo <strong>${escapeHtml(appointment.vehicle_title)}</strong> está confirmada.</p>
      <div style="background:#dcfce7;border-radius:10px;padding:14px;margin:12px 0;">
        <strong>📅 ${escapeHtml(slot)}</strong>
      </div>
      <p>El vendedor se pondrá en contacto contigo para confirmar el punto de encuentro. Si necesitas gestionar la cita, contacta con CarsWise.</p>
    </div>`;
  const sellerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;">
      <h2 style="color:#16a34a;">✅ Cita confirmada para tu vehículo</h2>
      <p>El comprador <strong>${escapeHtml(appointment.buyer_name || appointment.buyer_email)}</strong> ha confirmado la visita a:</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:14px;margin:12px 0;">
        <strong>${escapeHtml(appointment.vehicle_title)}</strong>
      </div>
      <div style="background:#dcfce7;border-radius:10px;padding:14px;margin:12px 0;">
        <strong>📅 ${escapeHtml(slot)}</strong>
      </div>
      <p>Prepárate para la visita. CarsWise puede ayudarte con la gestión de la venta si lo necesitas.</p>
    </div>`;
  await Promise.all([
    sendResendEmail({ to: appointment.buyer_email, subject: `✅ Cita confirmada · ${appointment.vehicle_title}`, html: buyerHtml }),
    sendResendEmail({ to: appointment.seller_email, subject: `✅ Cita confirmada · ${appointment.vehicle_title}`, html: sellerHtml }),
  ]);
}

module.exports = {
  createViewingRequest,
  getByToken,
  proposeSlots,
  confirmSlot,
  listBySellerEmail,
  sendSellerRequestEmail,
  sendBuyerProposalEmail,
  sendConfirmationEmails,
};
