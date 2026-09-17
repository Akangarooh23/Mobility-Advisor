"use strict";

/**
 * «Quiero comprarlo»: el comprador dice, al acabar la visita, que se queda el
 * coche de un particular.
 *
 * Es el principio de la venta, no el final. Aquí se recoge lo que hace falta
 * para el contrato y el cambio de nombre —su DNI o NIE y su domicilio—, si va a
 * financiar, y se abre la venta en el encargo: el anuncio se reserva y al
 * vendedor se le dice que no lo enseñe a nadie más.
 *
 * Lo que viene después se lleva desde el ERP: la financiación, si la pide, va
 * primero; luego el ingreso del precio, la gestoría y la liberación al
 * vendedor.
 */

/** Las mismas columnas que crea el ERP (`lib/venta-en-curso.ts`). */
const ENSURE_COLUMNAS = `
  ALTER TABLE erp_encargos_venta
    ADD COLUMN IF NOT EXISTS venta_estado TEXT,
    ADD COLUMN IF NOT EXISTS venta_booking_id TEXT,
    ADD COLUMN IF NOT EXISTS venta_iniciada_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS venta_anulada_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS venta_motivo_anulacion TEXT,
    ADD COLUMN IF NOT EXISTS comprador_nombre TEXT,
    ADD COLUMN IF NOT EXISTS comprador_dni TEXT,
    ADD COLUMN IF NOT EXISTS comprador_domicilio TEXT,
    ADD COLUMN IF NOT EXISTS comprador_email TEXT,
    ADD COLUMN IF NOT EXISTS comprador_telefono TEXT,
    ADD COLUMN IF NOT EXISTS precio_venta NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS venta_financia BOOLEAN,
    ADD COLUMN IF NOT EXISTS financiacion_estado TEXT,
    ADD COLUMN IF NOT EXISTS financiacion_entidad TEXT,
    ADD COLUMN IF NOT EXISTS financiacion_importe NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS financiacion_decidida_at TIMESTAMPTZ`;

/** Cuántos días después de la visita se puede decir que se compra. */
const DIAS_PARA_DECIDIR = 14;

const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

const nt = (v) => String(v ?? "").trim();

/**
 * El DNI o NIE, limpio y con su letra comprobada. Cadena vacía si no vale.
 *
 * Se comprueba la letra: un número mal escrito en el contrato no lo ve nadie
 * hasta que Tráfico devuelve la transferencia, semanas después.
 */
function elDocumento(valor) {
  const d = nt(valor).toUpperCase().replace(/[\s.-]/g, "");
  let m = d.match(/^(\d{8})([A-Z])$/);
  if (m) return LETRAS[Number(m[1]) % 23] === m[2] ? d : "";
  m = d.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (m) {
    const numero = Number(`${"XYZ".indexOf(m[1])}${m[2]}`);
    return LETRAS[numero % 23] === m[3] ? d : "";
  }
  return "";
}

/** Qué falta o está mal en lo que ha rellenado. Cadena vacía si está todo. */
function faltaParaComprar({ dni, direccion, codigoPostal, ciudad, financia }) {
  if (!elDocumento(dni)) return "El DNI o NIE no es válido: revisa el número y la letra.";
  if (nt(direccion).length < 5) return "Falta tu dirección: calle y número.";
  if (!/^\d{5}$/.test(nt(codigoPostal))) return "El código postal tiene que tener cinco cifras.";
  if (nt(ciudad).length < 2) return "Falta la ciudad.";
  if (typeof financia !== "boolean") return "Dinos si vas a financiarlo.";
  return "";
}

/** El domicilio en una línea, como va en el contrato. */
function elDomicilio({ direccion, codigoPostal, ciudad }) {
  return `${nt(direccion)}, ${nt(codigoPostal)} ${nt(ciudad)}`;
}

/**
 * Por qué esta visita no puede acabar en compra desde aquí. Vacío si puede.
 *
 * Solo la de un coche de particular (`idcar-` con dueño), confirmada, que ya ha
 * empezado y no hace más de dos semanas. Y sin otro resultado ya apuntado: si
 * dijo que no fue, no se compra desde un enlace viejo.
 */
function porQueNoPuedeComprar(b, ahora = new Date()) {
  if (!b) return "No encontramos esa visita.";
  if (!String(b.offer_id || "").startsWith("idcar-") || !b.seller_email) {
    return "Este coche no se compra desde aquí. Escríbenos y te ayudamos.";
  }
  if (b.status !== "confirmed") return "Esa visita no llegó a confirmarse.";
  const empieza = new Date(b.starts_at).getTime();
  if (!Number.isFinite(empieza) || empieza > ahora.getTime()) return "Tu visita todavía no ha sido.";
  if (ahora.getTime() - empieza > DIAS_PARA_DECIDIR * 86400000) return "Ha pasado demasiado tiempo desde la visita. Escríbenos y lo vemos.";
  if (b.resultado && b.resultado !== "compro") return "Ya nos dijiste cómo fue la visita. Si has cambiado de idea, escríbenos.";
  return "";
}

/** La visita, con su encargo y lo que hace falta para decidir y escribir. */
const SQL_LA_VISITA = `
  SELECT b.id, b.offer_id, b.vehicle_title, b.starts_at, b.ends_at, b.status, b.resultado,
         b.buyer_name, b.buyer_email, b.buyer_phone, b.seller_email, b.quiere_financiar,
         e.id AS encargo_id, e.cliente_nombre, e.cliente_email,
         to_jsonb(e)->>'venta_estado' AS venta_estado,
         to_jsonb(e)->>'venta_booking_id' AS venta_booking_id,
         COALESCE(NULLIF(to_jsonb(e)->>'clausula_precio', '')::numeric, e.precio_referencia) AS precio,
         o.price AS precio_anuncio
    FROM vehicle_visit_bookings b
    LEFT JOIN erp_encargos_venta e
           ON 'idcar-' || e.vehicle_id = b.offer_id AND e.cerrado_at IS NULL
    LEFT JOIN moveadvisor_marketplace_vo_offers o ON o.id = b.offer_id
   WHERE b.id = $1 AND b.token_buyer = $2`;

module.exports = {
  ENSURE_COLUMNAS,
  DIAS_PARA_DECIDIR,
  elDocumento,
  faltaParaComprar,
  elDomicilio,
  porQueNoPuedeComprar,
  SQL_LA_VISITA,
};
