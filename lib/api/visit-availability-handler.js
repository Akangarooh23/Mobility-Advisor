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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    return bookRes.rows[0];
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
    return updated.rows[0];
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

  return res.status(404).json({ ok: false, error: "Route not found" });
};
