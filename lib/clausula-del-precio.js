"use strict";

/**
 * La cláusula del precio de salida, que el cliente firma y sube desde su panel.
 *
 * Es el papel que dice a qué precio sale su coche. Firmarlo le abre la única
 * puerta que tiene para irse sin pagar nada: pasados 30 días desde el mandato
 * puede retirar el encargo sin coste. Sin firmarlo, retirarlo cuesta 150 € en
 * cualquier momento.
 *
 * Va **después del taller**, porque el precio se fija con lo que diga: un coche
 * que sale «con reparos» no vale lo mismo que uno limpio.
 *
 * Lo que se acepta y cómo se comprueba es lo mismo que el mandato —el documento
 * se manda igual, en `.doc`, y volverá igual: en PDF, en Word o en una foto del
 * papel firmado—, así que las reglas se reutilizan en vez de copiarse. Dos
 * copias serían dos sitios donde arreglar el día que Word vuelva a etiquetar mal
 * un fichero.
 */
const { porQueNoSePuedeSubir, TIPOS, EXTENSIONES, TAMANO_MAXIMO } = require("./mandato-firmado");

/** Dónde se guarda, para que el ERP lo enseñe en la ficha del encargo. */
const AMBITO = "encargo";
const PAPEL = "clausula_precio_firmada";

/**
 * Su encargo, buscado por su correo.
 *
 * Por el correo del cliente y no solo por el identificador: el identificador
 * viaja por la red y no prueba nada. Y con el estado del taller, porque este
 * papel no se puede firmar antes — si llegara antes, es que alguien guardó un
 * enlace viejo.
 */
const SQL_SU_ENCARGO = `
  SELECT e.id, e.clausula_id, e.clausula_firmada_at, e.precio_referencia,
         e.firmado_at, e.firma_como, v.plate,
         tal.estado AS taller_estado
    FROM erp_encargos_venta e
    LEFT JOIN moveadvisor_user_vehicles v ON v.id = e.vehicle_id
    LEFT JOIN LATERAL (
      SELECT rt.estado FROM erp_revisiones_taller rt
       WHERE rt.vehicle_id = e.vehicle_id
       ORDER BY rt.created_at DESC LIMIT 1
    ) tal ON TRUE
   WHERE e.id = $1
     AND lower(e.cliente_email) = lower($2)
     AND e.cerrado_at IS NULL`;

/**
 * Se marca aceptado, y se enciende `acepto_el_precio`.
 *
 * Esa casilla la marcábamos nosotros a mano, que es exactamente lo que el
 * mandato vino a quitar para la firma: un dato que el ERP se escribía a sí
 * mismo. Ahora la enciende el documento firmado.
 *
 * Y `libre_desde` se recalcula aquí: es la fecha desde la que puede irse gratis,
 * y sale de la firma del **mandato** más los 30 días, no de esta. Sin esto, el
 * cliente aceptaría el precio y el ERP seguiría diciendo que no tiene plazo.
 *
 * Solo si no estaba ya aceptada: firmar dos veces no reescribe la primera fecha.
 */
const SQL_MARCA_ACEPTADA = `
  UPDATE erp_encargos_venta
     SET clausula_firmada_at = NOW(),
         acepto_el_precio = TRUE,
         libre_desde = CASE WHEN firmado_at IS NOT NULL
                            THEN firmado_at + INTERVAL '30 days'
                            ELSE libre_desde END,
         updated_at = NOW()
   WHERE id = $1 AND clausula_firmada_at IS NULL AND cerrado_at IS NULL
  RETURNING id, clausula_firmada_at, libre_desde`;

/** Y el documento queda guardado donde el ERP lo enseña. */
const SQL_GUARDA_DOCUMENTO = `
  INSERT INTO erp_documentos (ambito, ambito_id, papel, nombre, tipo, ruta, tamano, subido_por)
  VALUES ('${AMBITO}', $1, '${PAPEL}', $2, $3, $4, $5, $6)`;

/**
 * Por qué no se le puede pedir todavía.
 *
 * Gemela de `porQueNoSeLePuedePedir` del ERP. Aquí solo se comprueba lo que hace
 * falta para no aceptar una subida imposible; la frase larga la escribe el ERP.
 */
function porQueNoTocaTodavia(e) {
  if (!e) return "No encontramos ese encargo.";
  if (!e.firmado_at) return "Primero hay que firmar el mandato.";
  if (String(e.taller_estado || "") !== "Hecha") {
    return "El coche todavía no ha pasado por el taller: el precio se fija con lo que diga.";
  }
  if (!(Number(e.precio_referencia) > 0)) return "Todavía no hay un precio acordado.";
  return "";
}

module.exports = {
  AMBITO,
  PAPEL,
  TIPOS,
  EXTENSIONES,
  TAMANO_MAXIMO,
  porQueNoSePuedeSubir,
  porQueNoTocaTodavia,
  SQL_SU_ENCARGO,
  SQL_MARCA_ACEPTADA,
  SQL_GUARDA_DOCUMENTO,
};
