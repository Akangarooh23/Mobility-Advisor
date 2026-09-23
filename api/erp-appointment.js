/**
 * Una cita de taller, apuntada desde la web o desde la app.
 *
 * ── Lo que estaba mal, y eran dos cosas ───────────────────────────────────
 *
 * **1. No pedía nada.** Ni sesión, ni secreto, con `Access-Control-Allow-Origin`
 * en comodín, y el dueño de la cita salía del cuerpo de la petición: mandando
 * un `userId` cualquiera se escribían citas en la agenda de otro, o se llenaba
 * la tabla desde fuera. Ahora manda la sesión y el `userId` del cuerpo se
 * ignora.
 *
 * **2. Guardaba un correo en `user_id`.** La columna dice identificador y
 * llevaba `ana@ejemplo.com`. Por eso la ficha de cliente del ERP —que cruza
 * `a.user_id = mu.id`— contaba cero citas siempre, aunque las hubiera. Y desde
 * que la columna tiene declarada su relación con la tabla de usuarios, escribir
 * un correo ahí ya no es solo raro: la base lo rechaza y la cita no se guarda.
 *
 * Se guarda el identificador, que es lo que pide la relación y lo que cruza el
 * ERP. Quien lea citas viejas escritas con el correo sigue encontrándolas: el
 * listado mira las dos cosas.
 */
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

/**
 * El identificador del usuario de la sesión.
 *
 * La sesión suele traerlo; si no, se busca por su correo, que es lo único que
 * se sabe seguro de quien ha entrado. Sin identificador no se escribe nada: la
 * columna tiene una relación declarada y escribir ahí un correo la rompe.
 */
async function quienEs(db, identidad) {
  if (identidad.userId) return identidad.userId;
  const { rows } = await db.query(
    "SELECT id FROM moveadvisor_users WHERE lower(email) = $1 LIMIT 1",
    [identidad.email]
  );
  return rows[0]?.id || "";
}

module.exports = async function erpAppointmentApi(req, res) {
  if (aplicaCors(req, res)) return undefined;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const identidad = await identidadDeLaPeticion(req, { cuerpo: req.body || {} });
  if (!identidad.email) return res.status(401).json({ ok: false, error: "sin_sesion" });

  // `userId` del cuerpo no se mira: la cita es de quien la pide.
  const { scheduledAt, appointmentType, workshopName, notes } = req.body || {};
  if (!scheduledAt) {
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
    const userId = await quienEs(db, identidad);
    if (!userId) return res.status(403).json({ ok: false, error: "usuario_no_encontrado" });

    const result = await db.query(
      `INSERT INTO erp_appointments (user_id, scheduled_at, type, workshop_name, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', NOW(), NOW())
       RETURNING id, status, created_at`,
      [userId, scheduledAt, type, workshopName || null, notesStr]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("[erp-appointment] db error:", err.message);
    return res.status(500).json({ ok: false, error: "db_error" });
  }
};
