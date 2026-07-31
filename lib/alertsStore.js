// PostgreSQL store for market alerts.
// Tables are auto-created on first use so no manual DDL is needed.

const { Pool } = require("pg");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not configured");
    _pool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

let _schemaEnsured = false;
async function ensureSchema(pool) {
  if (_schemaEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_alerts (
      id           TEXT        NOT NULL,
      user_email   TEXT        NOT NULL,
      mode         TEXT        NOT NULL DEFAULT 'ambos',
      brand        TEXT,
      model        TEXT,
      query_text   TEXT,
      min_price    NUMERIC,
      max_price    NUMERIC,
      min_year     INT,
      max_year     INT,
      min_mileage  INT,
      max_mileage  INT,
      fuel         TEXT,
      transmission TEXT,
      displacement TEXT,
      location     TEXT,
      color        TEXT,
      title        TEXT,
      notify_by_email BOOLEAN NOT NULL DEFAULT TRUE,
      seen_count   INT         NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, user_email)
    );
    CREATE TABLE IF NOT EXISTS market_alert_notifications (
      id         SERIAL      PRIMARY KEY,
      alert_id   TEXT        NOT NULL,
      user_email TEXT        NOT NULL,
      offer_id   TEXT        NOT NULL,
      notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (alert_id, user_email, offer_id)
    );
  `);
  _schemaEnsured = true;
}

function rowToAlert(r) {
  return {
    id:           r.id,
    mode:         r.mode,
    brand:        r.brand        || "",
    model:        r.model        || "",
    query:        r.query_text   || "",
    minPrice:     r.min_price    != null ? Number(r.min_price)   : null,
    maxPrice:     r.max_price    != null ? Number(r.max_price)   : null,
    minYear:      r.min_year     != null ? Number(r.min_year)    : null,
    maxYear:      r.max_year     != null ? Number(r.max_year)    : null,
    minMileage:   r.min_mileage  != null ? Number(r.min_mileage) : null,
    maxMileage:   r.max_mileage  != null ? Number(r.max_mileage) : null,
    fuel:         r.fuel         || "",
    transmission: r.transmission || "",
    displacement: r.displacement || "",
    location:     r.location     || "",
    color:        r.color        || "",
    title:        r.title        || "",
    notifyByEmail: Boolean(r.notify_by_email),
    seenCount:    Number(r.seen_count || 0),
    createdAt:    r.created_at,
  };
}

async function upsertAlert(userEmail, alert) {
  const pool = getPool();
  await ensureSchema(pool);
  await pool.query(
    `INSERT INTO market_alerts
       (id, user_email, mode, brand, model, query_text,
        min_price, max_price, min_year, max_year, min_mileage, max_mileage,
        fuel, transmission, displacement, location, color, title, notify_by_email, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
     ON CONFLICT (id, user_email) DO UPDATE SET
       mode=EXCLUDED.mode, brand=EXCLUDED.brand, model=EXCLUDED.model,
       query_text=EXCLUDED.query_text,
       min_price=EXCLUDED.min_price, max_price=EXCLUDED.max_price,
       min_year=EXCLUDED.min_year, max_year=EXCLUDED.max_year,
       min_mileage=EXCLUDED.min_mileage, max_mileage=EXCLUDED.max_mileage,
       fuel=EXCLUDED.fuel, transmission=EXCLUDED.transmission,
       displacement=EXCLUDED.displacement, location=EXCLUDED.location,
       color=EXCLUDED.color, title=EXCLUDED.title,
       notify_by_email=EXCLUDED.notify_by_email, updated_at=NOW()`,
    [
      alert.id, userEmail,
      alert.mode || "ambos",
      alert.brand      || null, alert.model     || null, alert.query || null,
      alert.minPrice   || null, alert.maxPrice  || null,
      alert.minYear    || null, alert.maxYear   || null,
      alert.minMileage || null, alert.maxMileage || null,
      alert.fuel       || null, alert.transmission || null, alert.displacement || null,
      alert.location   || null, alert.color     || null,
      alert.title      || null, alert.notifyByEmail !== false,
    ]
  );
  return listAlerts(userEmail);
}

async function listAlerts(userEmail) {
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query(
    `SELECT * FROM market_alerts WHERE user_email=$1 ORDER BY created_at DESC LIMIT 20`,
    [userEmail]
  );
  return rows.map(rowToAlert);
}

async function removeAlert(userEmail, alertId) {
  const pool = getPool();
  await pool.query(
    `DELETE FROM market_alerts WHERE id=$1 AND user_email=$2`,
    [alertId, userEmail]
  );
  return listAlerts(userEmail);
}

async function updateSeenCount(userEmail, alertId, seenCount) {
  const pool = getPool();
  await pool.query(
    `UPDATE market_alerts SET seen_count=$1, updated_at=NOW() WHERE id=$2 AND user_email=$3`,
    [seenCount, alertId, userEmail]
  );
}

async function listAllActiveAlerts() {
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query(
    `SELECT * FROM market_alerts WHERE notify_by_email=TRUE ORDER BY created_at DESC`
  );
  return rows.map(r => ({ ...rowToAlert(r), userEmail: r.user_email }));
}

async function getNotifiedOfferIds(alertId, userEmail) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT offer_id FROM market_alert_notifications WHERE alert_id=$1 AND user_email=$2`,
    [alertId, userEmail]
  );
  return new Set(rows.map(r => r.offer_id));
}

async function insertNotifications(alertId, userEmail, offerIds) {
  if (!offerIds || !offerIds.length) return;
  const pool = getPool();
  const placeholders = offerIds.map((_, i) => `($1,$2,$${i + 3})`).join(",");
  await pool.query(
    `INSERT INTO market_alert_notifications (alert_id, user_email, offer_id)
     VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    [alertId, userEmail, ...offerIds]
  );
}

module.exports = {
  upsertAlert,
  listAlerts,
  removeAlert,
  updateSeenCount,
  listAllActiveAlerts,
  getNotifiedOfferIds,
  insertNotifications,
};
