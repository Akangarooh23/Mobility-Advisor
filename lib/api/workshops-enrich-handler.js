const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

const PLACES_FIELDS = [
  "formatted_phone_number",
  "opening_hours",
  "rating",
  "user_ratings_total",
  "website",
  "photos",
].join(",");

function isOpenNow(periods) {
  if (!Array.isArray(periods) || !periods.length) return null;
  const now = new Date();
  const day = now.getDay(); // 0=Sunday … 6=Saturday
  const currentTime = now.getHours() * 100 + now.getMinutes();

  for (const period of periods) {
    if (period.open?.day !== day) continue;
    const openTime = parseInt(period.open.time || "0000", 10);
    if (!period.close) return true; // 24h

    // If close is the next day, treat as open until midnight (covers overnight)
    if (period.close.day !== day) {
      if (currentTime >= openTime) return true;
      continue;
    }
    const closeTime = parseInt(period.close.time || "2400", 10);
    if (currentTime >= openTime && currentTime < closeTime) return true;
  }
  return false;
}

function buildShape(w) {
  const hours = w.opening_hours || null;
  return {
    phone:        w.phone        || null,
    rating:       w.rating       ? Number(w.rating) : null,
    ratingCount:  w.rating_count || null,
    website:      w.website      || null,
    weekdayText:  hours?.weekday_text || null,
    openNow:      hours?.periods ? isOpenNow(hours.periods) : null,
    photoRef:     Array.isArray(w.photos) ? (w.photos[0] || null) : null,
  };
}

async function fetchPlacesDetails(placeId, apiKey) {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=${encodeURIComponent(PLACES_FIELDS)}` +
    `&language=es` +
    `&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== "OK") throw new Error(`Places status: ${body.status}`);
  return body.result;
}

module.exports = async function workshopsEnrichHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt(req.query?.id || "", 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "id required" });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, source, external_id, phone, rating, rating_count, website, opening_hours, photos, enriched_at
       FROM workshop_locations WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Workshop not found" });

    const w = rows[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (w.enriched_at && new Date(w.enriched_at) > thirtyDaysAgo) {
      return res.status(200).json({ ok: true, enriched: buildShape(w) });
    }

    // Non-Google workshops don't have a place_id — return what we have
    if (w.source !== "google" || !w.external_id) {
      await client.query(`UPDATE workshop_locations SET enriched_at = NOW() WHERE id = $1`, [id]);
      return res.status(200).json({ ok: true, enriched: buildShape(w) });
    }

    const apiKey = process.env.GOOGLE_PLACES_KEY;
    if (!apiKey) return res.status(500).json({ error: "GOOGLE_PLACES_KEY not set" });

    let result;
    try {
      result = await fetchPlacesDetails(w.external_id, apiKey);
    } catch (err) {
      console.error("[workshops-enrich] Places API error:", err.message);
      return res.status(200).json({ ok: true, enriched: buildShape(w) });
    }

    const phone        = result.formatted_phone_number || w.phone || null;
    const rating       = result.rating != null ? Math.round(result.rating * 10) / 10 : null;
    const ratingCount  = result.user_ratings_total || null;
    const website      = result.website || null;
    const openingHours = result.opening_hours
      ? { weekday_text: result.opening_hours.weekday_text || [], periods: result.opening_hours.periods || [] }
      : null;
    const photos = result.photos?.slice(0, 2).map((p) => p.photo_reference) || null;

    await client.query(
      `UPDATE workshop_locations
       SET phone = $1, rating = $2, rating_count = $3, website = $4,
           opening_hours = $5, photos = $6, enriched_at = NOW()
       WHERE id = $7`,
      [phone, rating, ratingCount, website,
       openingHours ? JSON.stringify(openingHours) : null,
       photos       ? JSON.stringify(photos)       : null,
       id]
    );

    return res.status(200).json({
      ok: true,
      enriched: {
        phone,
        rating,
        ratingCount,
        website,
        weekdayText:  openingHours?.weekday_text || null,
        openNow:      openingHours?.periods ? isOpenNow(openingHours.periods) : null,
        photoRef:     photos?.[0] || null,
      },
    });
  } finally {
    client.release();
  }
};
