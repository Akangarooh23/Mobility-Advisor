const { Pool } = require("pg");

let pool;
function getPool() {
  if (!pool) {
    // Must point to the ERP's own database, not the main app DB
    const cs = process.env.ERP_DATABASE_URL || process.env.ERP_POSTGRES_URL;
    if (!cs) throw new Error("ERP_DATABASE_URL not configured");
    pool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
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
    // Table is owned and created by the ERP's ensureSchema() — no CREATE TABLE here
    const result = await db.query(
      `INSERT INTO erp_appointments (user_id, scheduled_at, type, workshop_name, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', NOW(), NOW())
       RETURNING id, status, created_at`,
      [String(userId).toLowerCase(), scheduledAt, type, workshopName || null, notesStr]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("[erp-appointment] db error:", err.message);
    return res.status(500).json({ ok: false, error: "db_error", detail: err.message });
  }
};
