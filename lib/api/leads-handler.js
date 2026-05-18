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

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_market_leads (
      id             VARCHAR(64)  PRIMARY KEY,
      user_email     VARCHAR(255) NOT NULL,
      lead_type      VARCHAR(40)  NOT NULL DEFAULT 'info',
      vehicle_id     VARCHAR(255),
      vehicle_title  VARCHAR(255) NOT NULL DEFAULT '',
      vehicle_url    TEXT         NOT NULL DEFAULT '',
      portal         VARCHAR(100) NOT NULL DEFAULT '',
      contact_name   VARCHAR(255) NOT NULL DEFAULT '',
      contact_phone  VARCHAR(80)  NOT NULL DEFAULT '',
      contact_when   VARCHAR(80)  NOT NULL DEFAULT '',
      status         VARCHAR(80)  NOT NULL DEFAULT 'Pendiente',
      erp_notes      TEXT         NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE moveadvisor_market_leads
      ADD COLUMN IF NOT EXISTS erp_response         TEXT         NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS appointment_date     DATE,
      ADD COLUMN IF NOT EXISTS appointment_time     VARCHAR(10)  NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS appointment_address  TEXT         NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS appointment_contact  VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS notified_at          TIMESTAMPTZ
  `);
}

function parseBody(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw || "{}")); } catch { return {}; }
}

const ALLOWED_TYPES = ["info", "visit", "question"];
const TYPE_LABELS   = { info: "Solicitar información", visit: "Agendar visita", question: "Preguntar sobre el coche" };

module.exports = async function leadsHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = parseBody(req.body);
  const { name, phone, email, when, type, vehicle_id, vehicle_title, vehicle_url, portal } = body;

  if (!email || !phone || !name) {
    return res.status(400).json({ error: "name, phone y email son obligatorios" });
  }

  const leadType = ALLOWED_TYPES.includes(type) ? type : "info";
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const pool = getPool();
    await ensureTable(pool);
    await pool.query(
      `INSERT INTO moveadvisor_market_leads
         (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal,
          contact_name, contact_phone, contact_when)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        email.toLowerCase().trim(),
        leadType,
        vehicle_id || null,
        vehicle_title || "",
        vehicle_url || "",
        portal || "",
        name || "",
        phone || "",
        when || "",
      ]
    );

    return res.status(201).json({
      ok: true,
      id,
      message: `Solicitud de "${TYPE_LABELS[leadType]}" recibida. Te contactaremos en menos de 2 horas.`,
    });
  } catch (err) {
    console.error("[leads-handler] DB error:", err.message);
    return res.status(500).json({ error: "Error al guardar la solicitud" });
  }
};
