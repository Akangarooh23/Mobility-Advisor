"use strict";

const authHandler = require("../../api/auth");
const { Pool } = require("pg");

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

function normalizeText(v) { return typeof v === "string" ? v.trim() : ""; }

module.exports = async function vehiclePublishHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  if (!sessionEmail) return res.status(401).json({ error: "Sesión no válida" });

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const vehicleId = normalizeText(body.vehicleId);
  const action    = normalizeText(body.action).toLowerCase() || "publish";
  if (!vehicleId) return res.status(400).json({ error: "vehicleId requerido" });

  const pool = getPool();
  try {
    const offerId = `idcar-${vehicleId}`;

    // Look up vehicle — match on email OR user_id to handle account changes
    const vRes = await pool.query(
      `SELECT v.*, u.id AS uid
       FROM moveadvisor_user_vehicles v
       LEFT JOIN moveadvisor_users u ON lower(u.email) = $1
       WHERE v.id = $2 AND (lower(v.user_email) = $1 OR v.user_id = u.id)`,
      [sessionEmail, vehicleId]
    );
    const v = vRes.rows[0] || null;

    // ── UNPUBLISH ──────────────────────────────────────────────────────────────
    if (action === "unpublish") {
      if (!v) {
        // Fallback: unpublish directly via the marketplace record's seller field
        const mpUpd = await pool.query(
          `UPDATE moveadvisor_marketplace_vo_offers
           SET is_active = FALSE, updated_at = NOW()
           WHERE id = $1 AND lower(COALESCE(seller, '')) = lower($2)
           RETURNING id`,
          [offerId, sessionEmail]
        ).catch(() => ({ rows: [] }));

        await pool.end();
        if (mpUpd.rows.length > 0) {
          return res.status(200).json({ ok: true, action: "unpublished", offer_id: offerId });
        }
        return res.status(404).json({ error: "Vehículo no encontrado o no pertenece a tu cuenta" });
      }

      const vehiclePlate = normalizeText(v.plate).toUpperCase();

      // 1. Deactivate the user's listing in the marketplace table
      await pool.query(
        `UPDATE moveadvisor_marketplace_vo_offers SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
        [offerId]
      );

      // 2. Also clear is_listed in vehicle_states (belt-and-suspenders)
      await pool.query(
        `UPDATE moveadvisor_user_vehicle_states SET is_listed = FALSE WHERE vehicle_id = $1`,
        [vehicleId]
      ).catch(() => {});

      // 3. Deactivate dealer/scraper records for the same car
      //    3a. By plate (precise)
      if (vehiclePlate) {
        await pool.query(
          `UPDATE moveadvisor_marketplace_vo_offers
           SET is_active = FALSE, updated_at = NOW()
           WHERE upper(COALESCE(matricula,'')) = $1
             AND seller_type != 'particular'
             AND id != $2`,
          [vehiclePlate, offerId]
        ).catch(() => {});
      }
      //    3b. By brand + model + year (fallback when scraper didn't store the plate)
      if (v.brand && v.model && v.year) {
        await pool.query(
          `UPDATE moveadvisor_marketplace_vo_offers
           SET is_active = FALSE, updated_at = NOW()
           WHERE lower(COALESCE(brand,'')) = lower($1)
             AND lower(COALESCE(model,'')) = lower($2)
             AND year = $3
             AND seller_type != 'particular'
             AND id != $4`,
          [v.brand, v.model, Number(v.year), offerId]
        ).catch(() => {});
      }

      await pool.end();
      return res.status(200).json({ ok: true, action: "unpublished", offer_id: offerId });
    }

    // ── PUBLISH ────────────────────────────────────────────────────────────────
    if (!v) {
      await pool.end();
      return res.status(404).json({ error: "Vehículo no encontrado o no pertenece a tu cuenta" });
    }

    const price = parseFloat(String(body.price || v.price || 0)) || 0;
    if (!price) {
      await pool.end();
      return res.status(400).json({ error: "Indica un precio de venta antes de publicar" });
    }

    const allPhotosRes = await pool.query(
      `SELECT file_url FROM moveadvisor_user_vehicle_files
       WHERE vehicle_id = $1 AND file_type = 'photo' AND file_url != ''
       ORDER BY created_at ASC LIMIT 20`,
      [vehicleId]
    ).catch(() => ({ rows: [] }));
    const allPhotoUrls = allPhotosRes.rows.map((r) => r.file_url);

    const title = normalizeText(v.title) || [v.brand, v.model, v.year].filter(Boolean).join(" ");
    const existing = await pool.query(
      `SELECT id, image_url FROM moveadvisor_marketplace_vo_offers WHERE id = $1`, [offerId]
    );

    // Preserve a manually chosen primary photo if it's still in the photo list
    const savedPrimary = normalizeText(existing.rows[0]?.image_url);
    let imageUrl, imageUrls;
    if (savedPrimary && allPhotoUrls.includes(savedPrimary)) {
      const reordered = [savedPrimary, ...allPhotoUrls.filter((u) => u !== savedPrimary)];
      imageUrl  = savedPrimary;
      imageUrls = JSON.stringify(reordered);
    } else {
      imageUrl  = allPhotoUrls[0] || "";
      imageUrls = JSON.stringify(allPhotoUrls);
    }

    // Persist price back to the vehicle record if it was provided in the request
    if (price && (!v.price || parseFloat(v.price) !== price)) {
      await pool.query(
        `UPDATE moveadvisor_user_vehicles SET price = $1 WHERE id = $2`,
        [String(price), vehicleId]
      ).catch(() => {});
    }

    const plate = normalizeText(v.plate).toUpperCase();

    if (existing.rows.length) {
      await pool.query(
        `UPDATE moveadvisor_marketplace_vo_offers SET
           title=$1, brand=$2, model=$3, year=$4, price=$5,
           mileage=$6, fuel=$7, color=$8, description=$9,
           image_url=$10, image_urls=$11, matricula=$12,
           seller_type='particular', is_active=TRUE, updated_at=NOW()
         WHERE id=$13`,
        [title, v.brand||'', v.model||'', Number(v.year)||0, price,
         Number(v.mileage)||0, v.fuel||'', v.color||'', v.notes||'',
         imageUrl, imageUrls, plate, offerId]
      );
    } else {
      await pool.query(
        `INSERT INTO moveadvisor_marketplace_vo_offers
           (id,title,brand,model,year,price,mileage,fuel,color,
            description,image_url,image_urls,seller,seller_type,location,
            power,displacement,has_guarantee_seal,portal_score,warranty_months,
            available_for_purchase,renting_available,renting_km_year,
            has_stock_management,is_active,matricula,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'particular','',
                 $14,0,FALSE,0,0,TRUE,FALSE,0,FALSE,TRUE,$15,NOW(),NOW())`,
        [offerId, title, v.brand||'', v.model||'', Number(v.year)||0, price,
         Number(v.mileage)||0, v.fuel||'', v.color||'', v.notes||'',
         imageUrl, imageUrls, sessionEmail, `${v.cv||''} CV`.trim(), plate]
      );
    }

    // Also set is_listed = TRUE to keep vehicle_states in sync
    await pool.query(
      `UPDATE moveadvisor_user_vehicle_states SET is_listed = TRUE WHERE vehicle_id = $1`,
      [vehicleId]
    ).catch(() => {});

    // Hide dealer/scraper records for this same car (by plate, then by brand+model+year)
    if (plate) {
      await pool.query(
        `UPDATE moveadvisor_marketplace_vo_offers
         SET is_active = FALSE, updated_at = NOW()
         WHERE upper(COALESCE(matricula,'')) = $1
           AND seller_type != 'particular'
           AND id != $2`,
        [plate, offerId]
      ).catch(() => {});
    }
    if (v.brand && v.model && v.year) {
      await pool.query(
        `UPDATE moveadvisor_marketplace_vo_offers
         SET is_active = FALSE, updated_at = NOW()
         WHERE lower(COALESCE(brand,'')) = lower($1)
           AND lower(COALESCE(model,'')) = lower($2)
           AND year = $3
           AND seller_type != 'particular'
           AND id != $4`,
        [v.brand, v.model, Number(v.year), offerId]
      ).catch(() => {});
    }

    await pool.end();
    return res.status(200).json({ ok: true, action: "published", offer_id: offerId });
  } catch (err) {
    console.error("[vehicle-publish] error:", err.message);
    try { await pool.end(); } catch {}
    return res.status(500).json({ error: "Error al publicar: " + err.message });
  }
};
