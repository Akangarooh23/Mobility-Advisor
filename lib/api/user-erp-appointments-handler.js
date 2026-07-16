/**
 * GET /api/user-erp-appointments?userId=email
 * Devuelve las citas de mantenimiento del usuario desde erp_appointments (BD compartida).
 */
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

const ERP_TYPE_LABEL = {
  oil_change:  "Revisión menor",
  brakes:      "Revisión de frenos",
  tires:       "Neumáticos",
  inspection:  "Inspección",
  itv:         "Revisión ITV",
  general:     "Revisión general",
  other:       "Cita de mantenimiento",
};

const ERP_STATUS_LABEL = {
  scheduled:  "Pendiente de confirmación",
  confirmed:  "Confirmada",
  completed:  "Completada",
  cancelled:  "Cancelada",
  no_show:    "No presentado",
};

function formatScheduledAt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  const hour  = String(d.getHours()).padStart(2, "0");
  const min   = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hour}:${min}`;
}

module.exports = async function userErpAppointmentsHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = String(req.query?.userId || "").trim().toLowerCase();
  if (!userId) return res.status(400).json({ error: "userId required" });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, workshop_name, scheduled_at, type, status, notes, created_at
       FROM erp_appointments
       WHERE LOWER(user_id) = $1
       ORDER BY scheduled_at DESC
       LIMIT 30`,
      [userId]
    );

    const appointments = rows.map((r) => ({
      id:            String(r.id),
      workshopName:  r.workshop_name || "",
      scheduledAt:   formatScheduledAt(r.scheduled_at),
      type:          r.type || "other",
      typeLabel:     ERP_TYPE_LABEL[r.type] || "Cita de mantenimiento",
      status:        r.status || "scheduled",
      statusLabel:   ERP_STATUS_LABEL[r.status] || r.status,
      notes:         r.notes || "",
      createdAt:     formatScheduledAt(r.created_at),
    }));

    return res.status(200).json({ ok: true, appointments });
  } catch (err) {
    console.error("[user-erp-appointments] DB error:", err.message);
    return res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
};
