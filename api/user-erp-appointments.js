const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../lib/postgres-ssl");
const { aplicaCors } = require("../lib/cors");
const { identidadDeLaPeticion } = require("../lib/api/identidad");

let pool;
function getPool() {
  if (!pool) {
    const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!cs) throw new Error("No DATABASE_URL configured");
    pool = new Pool({
      connectionString: cs,
      ssl: SSL_POSTGRES,
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-PopCar-Client");
  // Ver la nota de `api/erp-appointment.js`: el comodín no sirve en cuanto la
  // petición lleva credenciales, y `aplicaCors` lo sustituye por el origen
  // concreto cuando está en la lista.
  if (aplicaCors(req, res)) return undefined;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  /*
   * De quién son las citas lo dice la sesión, no la dirección.
   *
   * Antes bastaba con poner `?userId=` y el correo de cualquiera para leer sus
   * citas de taller: el taller, la fecha, el tipo y las notas, sin haber
   * entrado. El único que lo llamaba era el panel, y siempre con el correo de
   * quien tiene la sesión abierta, así que exigirla no cambia nada para él.
   * Es la misma regla que la de las facturas (`lib/api/identidad.js`).
   */
  const { email: userId } = await identidadDeLaPeticion(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Sesión no válida." });

  try {
    const db = getPool();
    // Auto-create table on first use
    await db.query(`
      CREATE TABLE IF NOT EXISTS erp_appointments (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, agent TEXT,
        workshop_name TEXT, scheduled_at TIMESTAMPTZ NOT NULL,
        type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const result = await db.query(
      `SELECT id, user_id, type, scheduled_at, status, notes, created_at, workshop_name
       FROM erp_appointments
       WHERE lower(user_id) = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const appointments = result.rows.map((row) => {
      const workshopMatch = row.notes ? row.notes.match(/^Taller:\s*([^·]+)/) : null;
      // Primero la columna, que es donde lo guarda la app al pedir hora; las notas
      // con «Taller: …» son de las citas antiguas.
      const workshopName = row.workshop_name || (workshopMatch ? workshopMatch[1].trim() : null);
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
        // La fecha tal cual, para ordenar. La de arriba ya viene escrita en
        // español y no se puede comparar con otra.
        scheduledAtIso: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      };
    });

    return res.json({ ok: true, appointments });
  } catch (err) {
    console.error("[user-erp-appointments] db error:", err.message);
    return res.status(500).json({ ok: false, error: "db_error", detail: err.message });
  }
};
