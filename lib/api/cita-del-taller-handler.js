"use strict";

/**
 * El cliente dice, desde su panel, que no puede ir al taller ese día.
 *
 * Antes solo podía contestar al correo, y un correo contestado se queda en una
 * bandeja de entrada: la cita seguía en pie en el ERP, nadie la movía y el día
 * señalado el coche no aparecía. Eso cuesta la cita, retrasa su anuncio y no lo
 * sabe nadie hasta que llama el taller.
 *
 * Aquí se apunta en la propia revisión, que es lo que mira quien la atiende, y
 * de ahí sale solo el aviso del panel del ERP.
 *
 * ## Dos cosas y no más
 *
 * Pedir que se la cambiemos o pedir que se la quitemos. No hay «elige otra
 * hora»: las horas las da el taller por teléfono y nosotros no las tenemos, así
 * que ofrecer un calendario sería prometer algo que no se puede cumplir. Lo que
 * se recoge es la intención y el motivo; lo demás es una llamada.
 *
 * ## Lo que esto no hace
 *
 * No cancela nada por su cuenta. La revisión sigue siendo obligatoria para
 * publicar el coche, y quitarla desde aquí dejaría un encargo que no puede
 * avanzar sin que nadie se entere. Lo que hace es que alguien lo sepa.
 */
const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../postgres-ssl");
const { identidadDeLaPeticion } = require("./identidad");

/** Lo que puede pedir. Gemelo del `LO_QUE_PUEDE_PEDIR` del ERP. */
const LO_QUE_PUEDE_PEDIR = ["cambio", "cancelar"];

/** Lo que cabe escribir como motivo. Más es un correo, no una casilla. */
const LARGO_MAXIMO_DEL_MOTIVO = 500;

/**
 * Su coche y su cita, comprobando que el coche es suyo.
 *
 * El identificador del vehículo viaja por la red y no prueba nada: sin este
 * `lower(user_email) = $2`, cualquiera con una sesión podría mover la cita de
 * otro escribiendo su identificador.
 */
const SQL_SU_CITA = `
  SELECT r.id, r.estado
    FROM erp_revisiones_taller r
    JOIN moveadvisor_user_vehicles v ON v.id = r.vehicle_id
   WHERE r.vehicle_id = $1
     AND lower(v.user_email) = $2
     AND r.estado <> 'Hecha'
   ORDER BY r.created_at DESC
   LIMIT 1`;

const SQL_LO_QUE_PIDE = `
  UPDATE erp_revisiones_taller
     SET cliente_pidio = $2,
         cliente_pidio_at = NOW(),
         cliente_motivo = $3,
         updated_at = NOW()
   WHERE id = $1`;

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 5, ssl: SSL_POSTGRES });
  }
  return _pool;
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") { try { return JSON.parse(body); } catch { return {}; } }
  return body;
}

module.exports = async function citaDelTallerHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const { email } = await identidadDeLaPeticion(req, { cuerpo: body });
  if (!email) {
    return res.status(401).json({ ok: false, error: "Inicia sesión para cambiar tu cita." });
  }

  const vehicleId = String(body.vehicle_id || "").trim();
  const pide = String(body.pide || "").trim().toLowerCase();
  const motivo = String(body.motivo || "").trim().slice(0, LARGO_MAXIMO_DEL_MOTIVO);

  if (!vehicleId) {
    return res.status(400).json({ ok: false, error: "Falta de qué coche es." });
  }
  if (!LO_QUE_PUEDE_PEDIR.includes(pide)) {
    return res.status(400).json({ ok: false, error: "No sabemos qué quieres pedir." });
  }

  const pool = getPool();
  try {
    const suya = await pool.query(SQL_SU_CITA, [vehicleId, email.toLowerCase()]);
    const cita = suya.rows[0];
    if (!cita) {
      /*
       * O el coche no es suyo, o esa revisión ya está hecha.
       *
       * Se contesta lo mismo en los dos casos y sin decir cuál: al que prueba
       * con el identificador de otro no se le confirma que exista.
       */
      return res.status(404).json({ ok: false, error: "No encontramos esa cita." });
    }

    await pool.query(SQL_LO_QUE_PIDE, [cita.id, pide, motivo]);

    return res.status(200).json({ ok: true, data: { pide, motivo } });
  } catch (e) {
    console.error("[cita-taller] no se ha podido apuntar:", e.message);
    return res.status(500).json({ ok: false, error: "No hemos podido apuntarlo. Prueba otra vez." });
  }
};

module.exports.LO_QUE_PUEDE_PEDIR = LO_QUE_PUEDE_PEDIR;
module.exports.LARGO_MAXIMO_DEL_MOTIVO = LARGO_MAXIMO_DEL_MOTIVO;
module.exports.SQL_SU_CITA = SQL_SU_CITA;
