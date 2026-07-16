const { Pool } = require("pg");

let pool;
function getPool() {
  if (!pool) {
    const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!cs) throw new Error("No DATABASE_URL configured");
    pool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}

async function ensureTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS erp_appointments (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      agent         TEXT,
      workshop_name TEXT,
      scheduled_at  TIMESTAMPTZ NOT NULL,
      type          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'scheduled',
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

const TYPE_MAP = [
  ["revision itv", "itv"],
  ["neumaticos", "tires"],
  ["frenos", "brakes"],
  ["aceite", "oil_change"],
  ["revision menor", "oil_change"],
  ["revision mayor", "inspection"],
  ["inspeccion", "inspection"],
];

function mapAppointmentType(raw = "") {
  const n = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  for (const [key, val] of TYPE_MAP) {
    if (n.includes(key)) return val;
  }
  return "general";
}

module.exports = async function erpAppointmentApi(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const { userId, scheduledAt, appointmentType, workshopName, notes } = req.body || {};
  if (!userId || !scheduledAt) {
    return res.status(400).json({ ok: false, error: "missing_required_fields" });
  }

  const type = mapAppointmentType(appointmentType || "");
  const notesParts = [
    workshopName ? `Taller: ${workshopName}` : null,
    notes || null,
  ].filter(Boolean);
  const notesStr = notesParts.length ? notesParts.join(" · ") : null;

  try {
    const db = getPool();
    await ensureTable(db);
    const result = await db.query(
      `INSERT INTO erp_appointments (id, user_id, scheduled_at, type, notes, status, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'scheduled', NOW())
       RETURNING id, status, created_at`,
      [String(userId).toLowerCase(), scheduledAt, type, notesStr]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("[erp-appointment] db error:", err.message);
    return res.status(500).json({ ok: false, error: "db_error", detail: err.message });
  }
};
