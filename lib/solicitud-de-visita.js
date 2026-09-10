"use strict";

/**
 * Pedir visita sin tener cuenta.
 *
 * El comprador que llega de coches.net no se va a registrar para ver tres
 * huecos. Pero **la sesión no estaba ahí por pereza**: se puso a propósito
 * porque antes cualquiera podía reservar a nombre de otro —y hacer que a esa
 * persona le llegaran los correos de una cita que no pidió— o llenar el
 * calendario de un vendedor desde una terminal.
 *
 * Así que la cuenta no se quita: se **sustituye** por algo que demuestra lo
 * mismo. Quien no ha entrado deja sus datos y recibe un correo con un enlace;
 * hasta que lo pulsa no hay reserva. Un clic en su bandeja prueba que el correo
 * es suyo, que es exactamente lo que probaba la sesión.
 *
 * ## Por qué el hueco NO se aparta mientras tanto
 *
 * Apartarlo obligaría a soltarlo después —con su reloj, su barrido y su
 * momento en que se cae—, y mientras tanto bastaría con pedir seis veces para
 * dejar un coche sin horas sin haber confirmado ni un correo. Sin apartarlo,
 * pedir no cuesta nada y no consigue nada: **gana quien confirma primero**. Si
 * al pulsar el enlace el hueco ya se lo llevó otro, se le dice y se le enseñan
 * los que quedan.
 *
 * Quien sí ha entrado no pasa por aquí: de ese ya sabemos el correo y reserva
 * directamente, como hasta ahora.
 */

const crypto = require("crypto");

/**
 * Cuánto vale el enlace.
 *
 * Un día. Lo bastante para quien lo mira por la noche, lo bastante poco para
 * que un enlace filtrado no sirva la semana que viene. Y no importa alargarlo:
 * como el hueco no está apartado, una solicitud caducada no tenía retenido
 * nada de nadie.
 */
const HORAS_DE_VALIDEZ = 24;

const ENSURE_TABLA = `
  CREATE TABLE IF NOT EXISTS vehicle_visit_requests (
    id              TEXT PRIMARY KEY,
    offer_id        TEXT NOT NULL,
    availability_id TEXT NOT NULL,
    buyer_email     TEXT NOT NULL,
    buyer_name      TEXT NOT NULL DEFAULT '',
    buyer_phone     TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    source          TEXT NOT NULL DEFAULT 'marketplace',
    quiere_financiar BOOLEAN NOT NULL DEFAULT FALSE,
    token           TEXT NOT NULL,
    expira_at       TIMESTAMPTZ NOT NULL,
    confirmada_at   TIMESTAMPTZ,
    booking_id      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

/** El token se busca por sí solo, y hay que poder encontrarlo rápido. */
const ENSURE_INDICE = `
  CREATE INDEX IF NOT EXISTS ix_visit_requests_token
    ON vehicle_visit_requests (token)`;

/**
 * Y la misma pregunta, en la reserva.
 *
 * El comprador contesta «¿te interesaría financiarlo?» aquí, en la solicitud, y
 * de aquí no salía: al confirmar el enlace se creaba la reserva y el dato se
 * quedaba en esta tabla, que en el ERP no la mira nadie. La respuesta se
 * apuntaba y se tiraba.
 *
 * Importa porque es la operación que deja margen y la que se atiende a mano:
 * quien la vende necesita saber a quién llamar antes de la visita, no
 * descubrirlo en el parking.
 */
const ENSURE_EN_LA_RESERVA = `
  ALTER TABLE vehicle_visit_bookings
    ADD COLUMN IF NOT EXISTS quiere_financiar BOOLEAN NOT NULL DEFAULT FALSE`;

/**
 * Cuántas solicitudes sin confirmar aguanta un mismo correo a la vez.
 *
 * No es contra el que se equivoca: es contra el que pide veinte para que el
 * vendedor reciba veinte correos. Tres deja pedir dos coches y rectificar uno;
 * a partir de ahí ya no es alguien buscando coche.
 */
const SIN_CONFIRMAR_A_LA_VEZ = 3;

const SQL_CUANTAS_SIN_CONFIRMAR = `
  SELECT COUNT(*)::int AS n
    FROM vehicle_visit_requests
   WHERE lower(buyer_email) = lower($1)
     AND confirmada_at IS NULL
     AND expira_at > NOW()`;

const SQL_GUARDA = `
  INSERT INTO vehicle_visit_requests
    (id, offer_id, availability_id, buyer_email, buyer_name, buyer_phone,
     notes, source, quiere_financiar, token, expira_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() + ($11 || ' hours')::interval)
  RETURNING *`;

/**
 * La solicitud por su token, si todavía vale.
 *
 * Una ya confirmada no vuelve a valer: si no, reenviar el enlace crearía una
 * segunda cita para la misma persona y el mismo hueco.
 */
const SQL_POR_TOKEN = `
  SELECT * FROM vehicle_visit_requests
   WHERE token = $1 AND confirmada_at IS NULL AND expira_at > NOW()`;

const SQL_MARCA_CONFIRMADA = `
  UPDATE vehicle_visit_requests
     SET confirmada_at = NOW(), booking_id = $2
   WHERE id = $1 AND confirmada_at IS NULL
  RETURNING id`;

function nt(v) {
  return typeof v === "string" ? v.trim() : "";
}

/** Un correo con forma de correo. No valida que exista: eso lo hace el enlace. */
function pareceUnCorreo(v) {
  const s = nt(v);
  return s.length > 4 && s.length < 255 && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(s);
}

/**
 * Qué falta para poder pedir la visita, o cadena vacía si no falta nada.
 *
 * El teléfono se exige: la mitad de lo que compra el vendedor es que le
 * llevemos compradores con los que se pueda hablar, y un correo suelto no lo
 * es. El nombre también — quien va a abrirle la puerta de su casa a alguien
 * tiene derecho a saber a quién.
 */
function faltaParaPedirla({ slotId, offerId, buyerEmail, buyerName, buyerPhone } = {}) {
  if (!nt(slotId) || !nt(offerId)) return "No sabemos qué hueco es.";
  if (!pareceUnCorreo(buyerEmail)) return "Escribe un correo válido: ahí te mandamos el enlace.";
  if (!nt(buyerName)) return "Escribe tu nombre.";
  if (nt(buyerPhone).replace(/\D/g, "").length < 9) return "Escribe un teléfono para poder avisarte.";
  return "";
}

function nuevoToken() {
  return crypto.randomUUID();
}

/** La dirección que se le manda. */
function elEnlace(sitioUrl, token) {
  return `${String(sitioUrl || "").replace(/\/+$/, "")}/confirmar-visita?t=${encodeURIComponent(token)}`;
}

/**
 * El correo que prueba que la dirección es suya.
 *
 * Dice desde el asunto que **todavía no hay cita**. Un asunto que diera la cita
 * por hecha haría que quien no pulsa se presentara igual, y el vendedor no
 * estaría esperándole.
 */
function elCorreoDeConfirmacion({ vehicleTitle, cuando, enlace }) {
  const coche = nt(vehicleTitle) || "el coche";
  return {
    subject: `Confirma tu visita a ${coche}`,
    html: [
      `<p>Has pedido ver <strong>${coche}</strong>${cuando ? ` el ${cuando}` : ""}.</p>`,
      `<p><strong>Todavía no está reservada.</strong> Pulsa aquí para confirmar que este`,
      ` correo es tuyo y pedimos la hora al vendedor:</p>`,
      `<p><a href="${enlace}">Confirmar la visita</a></p>`,
      `<p>El enlace vale ${HORAS_DE_VALIDEZ} horas. Si no has sido tú, no hagas nada:`,
      ` sin pulsarlo no se reserva nada y nadie se entera.</p>`,
    ].join(""),
  };
}

module.exports = {
  HORAS_DE_VALIDEZ,
  SIN_CONFIRMAR_A_LA_VEZ,
  ENSURE_TABLA,
  ENSURE_INDICE,
  ENSURE_EN_LA_RESERVA,
  SQL_CUANTAS_SIN_CONFIRMAR,
  SQL_GUARDA,
  SQL_POR_TOKEN,
  SQL_MARCA_CONFIRMADA,
  pareceUnCorreo,
  faltaParaPedirla,
  nuevoToken,
  elEnlace,
  elCorreoDeConfirmacion,
};
