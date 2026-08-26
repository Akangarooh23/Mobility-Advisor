// Cron: checks all active alerts against marketplace offers.
// Sends email via Resend when new matches are found. Tracks sent offers in
// market_alert_notifications to avoid resending the same offer twice.
// Triggered daily by Vercel cron via /api/cron-alert-check.

const { listAllActiveAlerts, getNotifiedOfferIds, insertNotifications } = require("../alertsStore");
const { Pool } = require("pg");
const { MARCA, remitente } = require("../marca");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) return null;
    _pool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

const APP_BASE_URL = (process.env.APP_BASE_URL || MARCA.sitioUrl).replace(/\/$/, "");

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── SQL matching for marketplace VO offers ──────────────────────────────────

async function findVoMatches(alert, pool, already) {
  const conds = ["is_active = TRUE"];
  const vals = [];

  const push = (val, expr) => { vals.push(val); conds.push(expr.replace("?", `$${vals.length}`)); };

  if (alert.brand)       push(`%${alert.brand.toLowerCase()}%`,       `lower(COALESCE(brand,''))    LIKE ?`);
  if (alert.model)       push(`%${alert.model.toLowerCase()}%`,       `lower(COALESCE(model,''))    LIKE ?`);
  if (alert.fuel)        push(`%${alert.fuel.toLowerCase()}%`,        `lower(COALESCE(fuel,''))     LIKE ?`);
  if (alert.transmission)push(alert.transmission.toLowerCase(),       `lower(COALESCE(transmission,'')) = ?`);
  if (alert.color)       push(`${alert.color.toLowerCase()}%`,        `lower(COALESCE(color,''))    LIKE ?`);
  if (alert.minPrice)    push(alert.minPrice,  `COALESCE(sale_price, price) >= ?`);
  if (alert.maxPrice)    push(alert.maxPrice,  `COALESCE(sale_price, price) <= ?`);
  if (alert.minYear)     push(alert.minYear,   `year >= ?`);
  if (alert.maxYear)     push(alert.maxYear,   `year <= ?`);
  if (alert.minMileage)  push(alert.minMileage, `mileage >= ?`);
  if (alert.maxMileage)  push(alert.maxMileage, `mileage <= ?`);
  if (alert.mode === "renting") conds.push(`(renting12m > 0 OR renting24m > 0 OR renting36m > 0)`);

  const where = `WHERE ${conds.join(" AND ")}`;
  const { rows } = await pool.query(
    `SELECT id::text, title, brand, model, year, mileage, fuel,
            COALESCE(sale_price, price)::numeric AS price, image_url AS image
     FROM moveadvisor_marketplace_vo_offers ${where}
     ORDER BY updated_at DESC NULLS LAST LIMIT 50`,
    vals
  ).catch(() => ({ rows: [] }));

  return rows.filter(r => !already.has(String(r.id)));
}

// ── SQL matching for import (DE) offers ────────────────────────────────────

async function findImportMatches(alert, pool, already) {
  if (alert.mode === "renting") return [];

  const conds = ["country = 'DE'", "import_published = TRUE", "price IS NOT NULL"];
  const vals = [];

  const push = (val, expr) => { vals.push(val); conds.push(expr.replace("?", `$${vals.length}`)); };

  if (alert.brand)     push(`%${alert.brand.toLowerCase()}%`, `lower(COALESCE(brand,'')) LIKE ?`);
  if (alert.model)     push(`%${alert.model.toLowerCase()}%`, `lower(COALESCE(model,'')) LIKE ?`);
  if (alert.fuel)      push(`%${alert.fuel.toLowerCase()}%`,  `lower(COALESCE(fuel,''))  LIKE ?`);
  if (alert.maxPrice)  push(alert.maxPrice,  `price <= ?`);
  if (alert.maxMileage)push(alert.maxMileage, `mileage <= ?`);
  if (alert.minYear)   push(alert.minYear,   `year >= ?`);
  if (alert.maxYear)   push(alert.maxYear,   `year <= ?`);

  const where = `WHERE ${conds.join(" AND ")}`;
  const { rows } = await pool.query(
    `SELECT id::text, title, brand, model, year, mileage, fuel,
            (price::numeric + COALESCE(import_cost,0)) AS price, image_url AS image
     FROM moveadvisor_market_offers ${where}
     ORDER BY import_score DESC NULLS LAST LIMIT 20`,
    vals
  ).catch(() => ({ rows: [] }));

  return rows
    .map(r => ({ ...r, id: `import_${r.id}`, isImport: true }))
    .filter(r => !already.has(r.id));
}

// ── Email ───────────────────────────────────────────────────────────────────

function buildOfferCard(o) {
  const price = o.price ? `${Number(o.price).toLocaleString("es-ES")} €` : "";
  const meta = [o.year, o.mileage ? `${Number(o.mileage).toLocaleString("es-ES")} km` : null, o.fuel]
    .filter(Boolean).join(" · ");
  const link = `${APP_BASE_URL}/marketplace-vo/${encodeURIComponent(o.id)}`;
  const imgTag = o.image
    ? `<img src="${esc(o.image)}" width="540" style="width:100%;height:180px;object-fit:cover;display:block;border-radius:10px 10px 0 0;" />`
    : `<div style="width:100%;height:80px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:32px;border-radius:10px 10px 0 0;">🚗</div>`;

  return `
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      ${imgTag}
      <div style="padding:16px 18px;">
        ${o.isImport ? '<span style="font-size:11px;font-weight:700;background:#0891b2;color:#fff;padding:2px 8px;border-radius:999px;margin-bottom:8px;display:inline-block;">🇩🇪 Importación</span>' : ""}
        <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;margin-top:6px;">${esc(o.title)}</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:12px;">${esc(meta)}</div>
        ${price ? `<div style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:14px;">${esc(price)}</div>` : ""}
        <a href="${esc(link)}"
           style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;
                  text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:700;">
          Ver oferta →
        </a>
      </div>
    </div>`;
}

function buildEmailHtml(alert, offers) {
  const cards = offers.slice(0, 5).map(buildOfferCard).join("");
  const count = Math.min(offers.length, 5);
  const plural = count === 1 ? "nueva oferta" : "nuevas ofertas";

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 16px;">

    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:10px;">🔔</div>
      <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 6px;">
        ${count} ${esc(plural)} para tu alerta
      </h1>
      <p style="font-size:14px;color:#64748b;margin:0;">${esc(alert.title || "Alerta de mercado")}</p>
    </div>

    ${cards}

    <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
      <a href="${esc(APP_BASE_URL)}/marketplace-vo"
         style="font-size:13px;color:#2563eb;text-decoration:none;font-weight:600;">
        Ver todas las ofertas del marketplace →
      </a>
      <p style="font-size:11px;color:#94a3b8;margin:16px 0 0;line-height:1.6;">
        Recibes este email porque tienes alertas activas en ${MARCA.nombre}.<br>
        Puedes gestionarlas desde tu perfil de usuario.
      </p>
    </div>

  </div>
</body></html>`;
}

async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    remitente();

  if (!apiKey) {
    console.log(`[cron-alerts] Sin RESEND_API_KEY — email a ${to}: ${subject}`);
    return true;
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error(`[cron-alerts] Resend error ${resp.status}: ${body}`);
  }
  return resp.ok;
}

// ── Handler ─────────────────────────────────────────────────────────────────

/**
 * Quién puede disparar esta tarea.
 *
 * Antes era `if (cronSecret && ...)`: sin la variable puesta no se comprobaba
 * nada y la dirección quedaba abierta. La condición estaba escrita al revés —el
 * secreto habilitaba la defensa en vez de exigirla—, así que olvidarse de
 * configurarlo no daba ningún error, solo quitaba la cerradura.
 *
 * Ahora es el mismo criterio que usa `cron-condition-report-ready`: con secreto,
 * se exige; sin él, solo pasa la llamada que viene de Vercel Cron.
 */
function autorizado(req) {
  const secreto = String(process.env.CRON_SECRET || "").trim();
  if (secreto) return String(req.headers?.authorization || "") === `Bearer ${secreto}`;
  return String(req.headers?.["user-agent"] || "").toLowerCase().includes("vercel-cron");
}

module.exports = async function cronAlertCheckHandler(req, res) {
  if (!autorizado(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pool = getPool();
  if (!pool) {
    return res.status(200).json({ ok: false, warning: "No database configured" });
  }

  const summary = { checked: 0, emailed: 0, skipped: 0, newMatches: 0 };

  try {
    const alerts = await listAllActiveAlerts();
    summary.checked = alerts.length;

    for (const alert of alerts) {
      if (!alert.userEmail) { summary.skipped++; continue; }

      const already = await getNotifiedOfferIds(alert.id, alert.userEmail);
      const [voMatches, importMatches] = await Promise.all([
        findVoMatches(alert, pool, already),
        findImportMatches(alert, pool, already),
      ]);
      const newMatches = [...voMatches, ...importMatches];

      if (!newMatches.length) { summary.skipped++; continue; }

      summary.newMatches += newMatches.length;

      const subject = `🔔 ${newMatches.length === 1 ? "Nueva oferta" : `${newMatches.length} nuevas ofertas`} para tu alerta: ${alert.title || alert.brand || "mercado VO"}`;
      const html = buildEmailHtml(alert, newMatches);
      const sent = await sendEmail(alert.userEmail, subject, html);

      if (sent) {
        await insertNotifications(alert.id, alert.userEmail, newMatches.map(o => String(o.id)));
        summary.emailed++;
      } else {
        summary.skipped++;
      }
    }

    console.log(`[cron-alerts] done:`, summary);
    return res.status(200).json({ ok: true, ...summary });

  } catch (err) {
    console.error("[cron-alerts] error:", err?.message);
    return res.status(500).json({ ok: false, error: err?.message });
  }
};
