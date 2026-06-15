const { Pool } = require("pg");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

let _tableReady = false;

async function ensureTable(pool) {
  if (_tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_funnel_events (
      id            VARCHAR(64)  PRIMARY KEY,
      anon_id       VARCHAR(64)  NOT NULL DEFAULT '',
      user_id       VARCHAR(64),
      user_email    VARCHAR(255),
      event_type    VARCHAR(80)  NOT NULL,
      utm_source    VARCHAR(255) NOT NULL DEFAULT '',
      utm_medium    VARCHAR(255) NOT NULL DEFAULT '',
      utm_campaign  VARCHAR(255) NOT NULL DEFAULT '',
      utm_content   VARCHAR(255) NOT NULL DEFAULT '',
      utm_term      VARCHAR(255) NOT NULL DEFAULT '',
      landing_url   TEXT         NOT NULL DEFAULT '',
      offer_id      VARCHAR(255),
      offer_title   VARCHAR(255),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  _tableReady = true;
}

function parseBody(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw || "{}")); } catch { return {}; }
}

const ALLOWED_EVENTS = ["landing", "marketplace_view", "offer_view", "register", "login", "lead_request"];

module.exports = async function funnelEventHandler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = new Set([
    "https://carswiseai.com",
    "https://www.carswiseai.com",
    "http://localhost:3000",
    "http://localhost:3001",
  ]);
  res.setHeader("Access-Control-Allow-Origin", allowedOrigins.has(origin) ? origin : "https://carswiseai.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = parseBody(req.body);
  const {
    anon_id,
    user_id,
    user_email,
    event_type,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_url,
    offer_id,
    offer_title,
  } = body;

  if (!event_type || !ALLOWED_EVENTS.includes(event_type)) {
    return res.status(400).json({ error: "event_type inválido" });
  }

  const id = `fe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pool = getPool();
    await ensureTable(pool);
    await pool.query(
      `INSERT INTO moveadvisor_funnel_events
         (id, anon_id, user_id, user_email, event_type,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          landing_url, offer_id, offer_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        String(anon_id || ""),
        user_id || null,
        user_email ? user_email.toLowerCase().trim() : null,
        event_type,
        utm_source   || "",
        utm_medium   || "",
        utm_campaign || "",
        utm_content  || "",
        utm_term     || "",
        landing_url  || "",
        offer_id     || null,
        offer_title  || null,
      ]
    );
    return res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("[funnel-event-handler] DB error:", err.message);
    return res.status(500).json({ error: "Error al registrar evento" });
  }
};
