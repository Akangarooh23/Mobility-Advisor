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

const TYPE_LABEL = {
  oil_change:  "Cambio de aceite / Revisión menor",
  brakes:      "Revisión de frenos",
  tires:       "Neumáticos",
  inspection:  "Revisión mayor",
  itv:         "Revisión ITV",
  general:     "Cita de taller",
  other:       "Cita de taller",
};

const STATUS_LABEL = {
  scheduled: "Solicitud enviada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show:   "No presentado",
};

module.exports = async function userErpAppointmentsApi(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const userId = String(req.query.userId || "").trim().toLowerCase();
  if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

  try {
    const db = getPool();
    const result = await db.query(
      `SELECT id, user_id, type, scheduled_at, status, notes, created_at
       FROM erp_appointments
       WHERE lower(user_id) = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const appointments = result.rows.map((row) => {
      const workshopMatch = row.notes ? row.notes.match(/^Taller:\s*([^·]+)/) : null;
      const workshopName = workshopMatch ? workshopMatch[1].trim() : null;
      return {
        id:           row.id,
        user_id:      row.user_id,
        type:         row.type,
        status:       row.status,
        typeLabel:    TYPE_LABEL[row.type] || "Cita de taller",
        statusLabel:  STATUS_LABEL[row.status] || row.status,
        workshopName,
        notes:        row.notes || null,
        scheduledAt:  row.scheduled_at
          ? new Date(row.scheduled_at).toLocaleString("es-ES", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : null,
        createdAt: row.created_at,
      };
    });

    return res.json({ ok: true, appointments });
  } catch (err) {
    console.error("[user-erp-appointments] db error:", err.message);
    return res.status(500).json({ ok: false, error: "db_error", detail: err.message });
  }
};
