const { Pool } = require("pg");
const crypto = require("crypto");

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) return null;
  _pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  return _pool;
}

function normalize(v) {
  return typeof v === "string" ? v.trim() : "";
}

function jsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

// ── Email helpers ─────────────────────────────────────────────────────────────

const FROM_EMAIL   = "CarsWise <citas@carswiseai.com>";
const OPS_EMAIL    = "anapicazokangaroo@gmail.com";
const SITE_URL     = process.env.SITE_URL || "https://www.carswiseai.com";

async function sendEmail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[visit-booking] RESEND_API_KEY not set — skipping email"); return; }
  const body = { from: FROM_EMAIL, to, subject, html };
  if (attachments && attachments.length) body.attachments = attachments;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${errBody.message || JSON.stringify(errBody)}`);
  }
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function dtIcs(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildIcs(booking) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CarsWise AI//Visitas//ES",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTART:${dtIcs(booking.starts_at)}`,
    `DTEND:${dtIcs(booking.ends_at)}`,
    `SUMMARY:Visita: ${booking.vehicle_title || booking.offer_id}`,
    `DESCRIPTION:Cita confirmada para ver el vehículo.\\nID: ${booking.id}`,
    `UID:${booking.id}@carswiseai.com`,
    `ORGANIZER;CN=CarsWise:mailto:citas@carswiseai.com`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function emailBase(title, content) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)}
  .header{background:#0f172a;padding:28px 32px;display:flex;align-items:center;gap:12px}
  .logo{color:#fff;font-size:20px;font-weight:800;letter-spacing:-.3px}
  .logo span{color:#38bdf8}
  .body{padding:32px}
  h1{margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:800}
  .sub{color:#64748b;font-size:14px;margin:0 0 24px}
  .card{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:24px}
  .card-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;font-size:14px;color:#334155}
  .card-row:last-child{margin-bottom:0}
  .card-label{font-weight:700;color:#0f172a;min-width:80px;flex-shrink:0}
  .btn{display:inline-block;background:#0ea5e9;color:#fff!important;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;margin-bottom:24px}
  .btn-danger{background:#ef4444}
  .footer{padding:20px 32px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;text-align:center}
</style></head>
<body><div class="wrap">
  <div class="header"><div class="logo">Cars<span>Wise</span></div></div>
  <div class="body">${content}</div>
  <div class="footer">CarsWise AI · <a href="https://www.carswiseai.com" style="color:#94a3b8">carswiseai.com</a></div>
</div></body></html>`;
}

async function sendBookingEmails(booking, opts = {}) {
  const { isReschedule = false } = opts;
  const dateStr = fmtDate(booking.starts_at);
  const timeStr = fmtTime(booking.starts_at);
  const vehicle = booking.vehicle_title || booking.offer_id;
  const manageUrl = `${SITE_URL}/mi-cita?id=${booking.id}&token=${booking.token_buyer}`;
  const icsContent = buildIcs(booking);
  const icsAttachment = {
    filename: "cita-carswiseai.ics",
    content: Buffer.from(icsContent).toString("base64"),
  };

  const buyerHeading  = isReschedule ? "🗓 Cita reprogramada"  : "✅ Cita confirmada";
  const buyerSubtitle = isReschedule
    ? "Tu visita ha sido reprogramada al siguiente horario."
    : "Tu visita está reservada. Guarda esta fecha en tu calendario.";
  const subjectBuyer  = isReschedule
    ? `🗓 Cita reprogramada — ${vehicle} — ${dateStr}`
    : `✅ Cita confirmada — ${vehicle} — ${dateStr}`;

  // ── Email al comprador ──────────────────────────────────────────────────
  const buyerHtml = emailBase(isReschedule ? "Cita reprogramada" : "Cita confirmada", `
    <h1>${buyerHeading}</h1>
    <p class="sub">${buyerSubtitle}</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Vehículo</span><span>${vehicle}</span></div>
      <div class="card-row"><span class="card-label">Fecha</span><span>${dateStr}</span></div>
      <div class="card-row"><span class="card-label">Hora</span><span>${timeStr}</span></div>
      ${booking.seller_email ? `<div class="card-row"><span class="card-label">Vendedor</span><span>${booking.seller_email}</span></div>` : ""}
    </div>
    <a href="${manageUrl}" class="btn">Gestionar mi cita →</a>
    <p style="font-size:13px;color:#64748b">Adjuntamos un archivo .ics para añadir la cita a tu calendario. Si necesitas cancelarla usa el botón de arriba.</p>
  `);

  // ── Email al vendedor particular ────────────────────────────────────────
  const isParticular = booking.source === "marketplace" && booking.seller_email;
  const sellerHtml = emailBase("Nueva reserva de visita", `
    <h1>📅 Nueva reserva de visita</h1>
    <p class="sub">Un comprador ha reservado una visita para ver tu vehículo.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Vehículo</span><span>${vehicle}</span></div>
      <div class="card-row"><span class="card-label">Fecha</span><span>${dateStr}</span></div>
      <div class="card-row"><span class="card-label">Hora</span><span>${timeStr}</span></div>
      <div class="card-row"><span class="card-label">Comprador</span><span>${booking.buyer_name || "–"}</span></div>
      ${booking.buyer_phone ? `<div class="card-row"><span class="card-label">Teléfono</span><span><strong>${booking.buyer_phone}</strong></span></div>` : ""}
      <div class="card-row"><span class="card-label">Email</span><span>${booking.buyer_email}</span></div>
      ${booking.notes ? `<div class="card-row"><span class="card-label">Notas</span><span><em>${booking.notes}</em></span></div>` : ""}
    </div>
    <p style="font-size:13px;color:#64748b">El comprador recibirá tus datos de contacto. Asegúrate de estar disponible a la hora acordada.</p>
  `);

  // ── Email al equipo CarsWise (ofertas profesionales) ────────────────────
  const opsHtml = emailBase("Nueva cita recibida", `
    <h1>🚗 Nueva cita recibida</h1>
    <p class="sub">Un usuario ha reservado una visita para un vehículo de CarsWise.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Oferta</span><span style="font-family:monospace;font-size:12px">${booking.offer_id}</span></div>
      <div class="card-row"><span class="card-label">Vehículo</span><span>${vehicle}</span></div>
      <div class="card-row"><span class="card-label">Fecha</span><span>${dateStr}</span></div>
      <div class="card-row"><span class="card-label">Hora</span><span>${timeStr}</span></div>
      <div class="card-row"><span class="card-label">Comprador</span><span>${booking.buyer_name || "–"} / ${booking.buyer_phone || "–"}</span></div>
      <div class="card-row"><span class="card-label">Email</span><span>${booking.buyer_email}</span></div>
      ${booking.notes ? `<div class="card-row"><span class="card-label">Notas</span><span><em>${booking.notes}</em></span></div>` : ""}
    </div>
    <a href="${SITE_URL.replace("www.", "erp.")}/marketplace" class="btn">Ver en ERP →</a>
  `);

  const sends = [];

  // Buyer
  sends.push(sendEmail({
    to: booking.buyer_email,
    subject: subjectBuyer,
    html: buyerHtml,
    attachments: [icsAttachment],
  }).catch((e) => console.error("[email] buyer:", e.message)));

  // Seller (particular) OR ops (professional)
  if (isParticular) {
    sends.push(sendEmail({
      to: booking.seller_email,
      subject: `📅 Nueva visita para tu vehículo — ${dateStr} a las ${timeStr}`,
      html: sellerHtml,
    }).catch((e) => console.error("[email] seller:", e.message)));
  } else {
    sends.push(sendEmail({
      to: OPS_EMAIL,
      subject: `🚗 Nueva cita — ${vehicle} — ${dateStr} ${timeStr}`,
      html: opsHtml,
    }).catch((e) => console.error("[email] ops:", e.message)));
  }

  await Promise.allSettled(sends);
}

async function sendCancelEmails(booking) {
  const dateStr = fmtDate(booking.starts_at);
  const timeStr = fmtTime(booking.starts_at);
  const vehicle = booking.vehicle_title || booking.offer_id;

  const buyerCancelHtml = emailBase("Cita cancelada", `
    <h1>❌ Cita cancelada</h1>
    <p class="sub">Tu visita ha sido cancelada correctamente.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Vehículo</span><span>${vehicle}</span></div>
      <div class="card-row"><span class="card-label">Fecha</span><span>${dateStr}</span></div>
      <div class="card-row"><span class="card-label">Hora</span><span>${timeStr}</span></div>
    </div>
    <a href="${SITE_URL}/marketplace-vo/${booking.offer_id}" class="btn">Ver vehículo de nuevo →</a>
    <p style="font-size:13px;color:#64748b">Puedes reservar otra franja horaria en cualquier momento desde la ficha del vehículo.</p>
  `);

  const notifyCancelHtml = emailBase("Cita cancelada por el comprador", `
    <h1>Cita cancelada</h1>
    <p class="sub">El comprador ha cancelado su visita.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Vehículo</span><span>${vehicle}</span></div>
      <div class="card-row"><span class="card-label">Fecha</span><span>${dateStr}</span></div>
      <div class="card-row"><span class="card-label">Hora</span><span>${timeStr}</span></div>
      <div class="card-row"><span class="card-label">Comprador</span><span>${booking.buyer_name || "–"} · ${booking.buyer_email}</span></div>
    </div>
    <p style="font-size:13px;color:#64748b">La franja horaria ha quedado libre de nuevo automáticamente.</p>
  `);

  const sends = [
    sendEmail({
      to: booking.buyer_email,
      subject: `Cita cancelada — ${vehicle}`,
      html: buyerCancelHtml,
    }).catch((e) => console.error("[email] cancel-buyer:", e.message)),
  ];

  const notifyTo = booking.seller_email || OPS_EMAIL;
  sends.push(sendEmail({
    to: notifyTo,
    subject: `Cita cancelada — ${vehicle} — ${dateStr}`,
    html: notifyCancelHtml,
  }).catch((e) => console.error("[email] cancel-notify:", e.message)));

  await Promise.allSettled(sends);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedProfessionalSlots(offerId) {
  const pool = getPool();
  if (!pool) return [];
  const now  = new Date();
  const rows = [];
  const end  = new Date(now);
  end.setDate(end.getDate() + 84); // 12 semanas (~3 meses)

  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  while (d <= end) {
    const dow = d.getDay(); // 0=Dom, 1=Lun … 5=Vie, 6=Sáb
    if (dow >= 1 && dow <= 5) {
      for (let h = 9; h < 18; h++) {
        const s = new Date(d); s.setHours(h, 0, 0, 0);
        const e = new Date(d); e.setHours(h + 1, 0, 0, 0);
        if (s > now) rows.push([s.toISOString(), e.toISOString()]);
      }
    }
    d.setDate(d.getDate() + 1);
  }

  if (!rows.length) return [];

  const startsArr = rows.map((r) => r[0]);
  const endsArr   = rows.map((r) => r[1]);
  const ins = await pool.query(
    `INSERT INTO vehicle_visit_availability (offer_id, starts_at, ends_at, source)
     SELECT $1, s, e, 'auto'
     FROM unnest($2::timestamptz[], $3::timestamptz[]) AS t(s, e)
     RETURNING id, offer_id, starts_at, ends_at, status, source`,
    [offerId, startsArr, endsArr]
  );
  return ins.rows;
}

async function getSlots(offerId) {
  const pool = getPool();
  if (!pool || !offerId) return [];
  const now = new Date().toISOString();
  const r = await pool.query(
    `SELECT id, offer_id, starts_at, ends_at, status, source
     FROM vehicle_visit_availability
     WHERE offer_id = $1
       AND status = 'available'
       AND starts_at > $2
     ORDER BY starts_at ASC
     LIMIT 60`,
    [offerId, now]
  );
  // Para ofertas profesionales (no idcar-) sin slots: generar L-V 9-18h automáticamente
  if (r.rows.length === 0 && !offerId.startsWith('idcar-')) {
    return seedProfessionalSlots(offerId);
  }
  return r.rows;
}

async function addSlot({ offerId, startsAt, endsAt, source }) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  // Prevent overlapping slots for same offer
  const overlap = await pool.query(
    `SELECT id FROM vehicle_visit_availability
     WHERE offer_id = $1
       AND status != 'blocked'
       AND tstzrange(starts_at, ends_at) && tstzrange($2::timestamptz, $3::timestamptz)
     LIMIT 1`,
    [offerId, startsAt, endsAt]
  );
  if (overlap.rows.length) throw new Error("overlap");
  const r = await pool.query(
    `INSERT INTO vehicle_visit_availability (offer_id, starts_at, ends_at, source)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [offerId, startsAt, endsAt, source || "marketplace"]
  );
  return r.rows[0];
}

async function deleteSlot(slotId, offerId) {
  const pool = getPool();
  if (!pool) return;
  // Only delete if still available (not already booked)
  await pool.query(
    `DELETE FROM vehicle_visit_availability
     WHERE id = $1 AND offer_id = $2 AND status = 'available'`,
    [slotId, offerId]
  );
}

async function bookSlot({ slotId, offerId, vehicleTitle, buyerEmail, buyerName, buyerPhone, sellerEmail, notes, source }) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");

  // Atomic: check + mark booked in a transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const slotRes = await client.query(
      `SELECT * FROM vehicle_visit_availability
       WHERE id = $1 AND offer_id = $2 AND status = 'available'
       FOR UPDATE`,
      [slotId, offerId]
    );
    if (!slotRes.rows.length) throw new Error("slot_unavailable");
    const slot = slotRes.rows[0];

    await client.query(
      `UPDATE vehicle_visit_availability SET status = 'booked' WHERE id = $1`,
      [slotId]
    );

    const tokenBuyer  = crypto.randomUUID();
    const tokenSeller = crypto.randomUUID();
    const bookRes = await client.query(
      `INSERT INTO vehicle_visit_bookings
         (availability_id, offer_id, vehicle_title, starts_at, ends_at,
          buyer_email, buyer_name, buyer_phone, seller_email,
          status, token_buyer, token_seller, notes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',$10,$11,$12,$13)
       RETURNING *`,
      [
        slotId, offerId, vehicleTitle || "", slot.starts_at, slot.ends_at,
        buyerEmail, buyerName || "", buyerPhone || "", sellerEmail || null,
        tokenBuyer, tokenSeller, notes || "", source || "marketplace",
      ]
    );

    await client.query("COMMIT");
    const bk = bookRes.rows[0];
    // Fire emails async (don't block response)
    sendBookingEmails(bk).catch(() => {});
    return bk;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function cancelBooking(bookingId, token) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  const r = await pool.query(
    `UPDATE vehicle_visit_bookings
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND (token_buyer = $2 OR token_seller = $2)
       AND status != 'cancelled'
     RETURNING *`,
    [bookingId, token]
  );
  if (!r.rows.length) throw new Error("not_found");
  const booking = r.rows[0];
  // Free the slot
  await pool.query(
    `UPDATE vehicle_visit_availability SET status = 'available'
     WHERE id = $1`,
    [booking.availability_id]
  );
  sendCancelEmails(booking).catch(() => {});
  return booking;
}

async function rescheduleBooking(bookingId, token, newSlotId) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify booking ownership
    const bRes = await client.query(
      `SELECT * FROM vehicle_visit_bookings
       WHERE id = $1 AND (token_buyer = $2 OR token_seller = $2)
         AND status = 'confirmed'
       FOR UPDATE`,
      [bookingId, token]
    );
    if (!bRes.rows.length) throw new Error("not_found");
    const booking = bRes.rows[0];

    // Check new slot availability
    const sRes = await client.query(
      `SELECT * FROM vehicle_visit_availability
       WHERE id = $1 AND offer_id = $2 AND status = 'available'
       FOR UPDATE`,
      [newSlotId, booking.offer_id]
    );
    if (!sRes.rows.length) throw new Error("slot_unavailable");
    const newSlot = sRes.rows[0];

    // Free old slot
    await client.query(
      `UPDATE vehicle_visit_availability SET status = 'available' WHERE id = $1`,
      [booking.availability_id]
    );
    // Book new slot
    await client.query(
      `UPDATE vehicle_visit_availability SET status = 'booked' WHERE id = $1`,
      [newSlotId]
    );
    // Update booking
    const updated = await client.query(
      `UPDATE vehicle_visit_bookings
       SET availability_id = $1, starts_at = $2, ends_at = $3,
           status = 'rescheduled', updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newSlotId, newSlot.starts_at, newSlot.ends_at, bookingId]
    );

    await client.query("COMMIT");
    const bk = updated.rows[0];
    sendBookingEmails(bk, { isReschedule: true }).catch(() => {});
    return bk;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function getBookingsByOffer(offerId) {
  const pool = getPool();
  if (!pool) return [];
  const r = await pool.query(
    `SELECT b.*, a.starts_at AS slot_starts, a.ends_at AS slot_ends
     FROM vehicle_visit_bookings b
     JOIN vehicle_visit_availability a ON a.id = b.availability_id
     WHERE b.offer_id = $1
       AND b.status != 'cancelled'
     ORDER BY b.starts_at ASC`,
    [offerId]
  );
  return r.rows;
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function visitAvailabilityHandler(req, res) {
  const method  = (req.method || "GET").toUpperCase();
  const route   = normalize(req.query?.route);
  const body    = jsonBody(req);

  // ── GET /api/visit-availability?offerId=X  → available slots for buyer
  if (method === "GET" && !route) {
    const offerId = normalize(req.query?.offerId);
    if (!offerId) return res.status(400).json({ ok: false, error: "offerId required" });
    try {
      const slots = await getSlots(offerId);
      return res.status(200).json({ ok: true, slots });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=add_slot  (seller adds availability)
  if (method === "POST" && route === "add_slot") {
    const { offerId, startsAt, endsAt, source } = body;
    if (!offerId || !startsAt || !endsAt) return res.status(400).json({ ok: false, error: "offerId, startsAt, endsAt required" });
    try {
      const slot = await addSlot({ offerId, startsAt, endsAt, source });
      return res.status(200).json({ ok: true, slot });
    } catch (e) {
      if (e.message === "overlap") return res.status(409).json({ ok: false, error: "El horario se solapa con otro existente" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── DELETE /api/visit-availability?route=delete_slot&slotId=X&offerId=Y
  if (method === "DELETE" && route === "delete_slot") {
    const slotId  = normalize(req.query?.slotId  || body.slotId);
    const offerId = normalize(req.query?.offerId || body.offerId);
    if (!slotId || !offerId) return res.status(400).json({ ok: false, error: "slotId and offerId required" });
    try {
      await deleteSlot(slotId, offerId);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=book  (buyer books a slot)
  if (method === "POST" && route === "book") {
    const { slotId, offerId, vehicleTitle, buyerEmail, buyerName, buyerPhone, sellerEmail, notes, source } = body;
    if (!slotId || !offerId || !buyerEmail) return res.status(400).json({ ok: false, error: "slotId, offerId, buyerEmail required" });
    try {
      const booking = await bookSlot({ slotId, offerId, vehicleTitle, buyerEmail, buyerName, buyerPhone, sellerEmail, notes, source });
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "slot_unavailable") return res.status(409).json({ ok: false, error: "Este horario ya no está disponible" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=cancel  (buyer or seller cancels)
  if (method === "POST" && route === "cancel") {
    const { bookingId, token } = body;
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const booking = await cancelBooking(bookingId, token);
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "not_found") return res.status(404).json({ ok: false, error: "Cita no encontrada o ya cancelada" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=reschedule  (change to new slot)
  if (method === "POST" && route === "reschedule") {
    const { bookingId, token, newSlotId } = body;
    if (!bookingId || !token || !newSlotId) return res.status(400).json({ ok: false, error: "bookingId, token and newSlotId required" });
    try {
      const booking = await rescheduleBooking(bookingId, token, newSlotId);
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "not_found") return res.status(404).json({ ok: false, error: "Cita no encontrada" });
      if (e.message === "slot_unavailable") return res.status(409).json({ ok: false, error: "El nuevo horario ya no está disponible" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── GET /api/visit-availability?route=bookings&offerId=X  (seller/ERP admin)
  if (method === "GET" && route === "bookings") {
    const offerId = normalize(req.query?.offerId);
    if (!offerId) return res.status(400).json({ ok: false, error: "offerId required" });
    try {
      const bookings = await getBookingsByOffer(offerId);
      return res.status(200).json({ ok: true, bookings });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // GET /api/visit-availability?route=booking_detail&bookingId=X&token=Y
  if (method === "GET" && route === "booking_detail") {
    const bookingId = normalize(req.query?.bookingId);
    const token     = normalize(req.query?.token);
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const pool = getPool();
      if (!pool) return res.status(500).json({ ok: false, error: "No DB" });
      const r = await pool.query(
        `SELECT id, offer_id, vehicle_title, starts_at, ends_at, buyer_name, buyer_email, status, notes, created_at
         FROM vehicle_visit_bookings
         WHERE id = $1 AND (token_buyer = $2 OR token_seller = $2)`,
        [bookingId, token]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: "Cita no encontrada" });
      return res.status(200).json({ ok: true, booking: r.rows[0] });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(404).json({ ok: false, error: "Route not found" });
};
