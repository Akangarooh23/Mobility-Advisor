const { Pool } = require("pg");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 5 });
  }
  return _pool;
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
  const meta = JSON.stringify({ name, phone, when: when || "", vehicle_url: vehicle_url || "", portal: portal || "" });
  const title = vehicle_title || "Vehículo sin título";

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO moveadvisor_user_appointments
         (id, user_email, vehicle_id, appointment_type, title, meta, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pendiente', NOW(), NOW())`,
      [id, email.toLowerCase().trim(), vehicle_id || "", leadType, title, meta]
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
