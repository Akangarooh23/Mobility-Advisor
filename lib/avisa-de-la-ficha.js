"use strict";

/**
 * Avisar al ERP de que el cliente ha subido su ficha técnica.
 *
 * ## Por qué hace falta
 *
 * El lector de fichas técnicas vive en el ERP, y allí se enganchó a la subida
 * de documentos **del ERP** — que es el lado que no usa nadie. La ficha la sube
 * el cliente, desde su panel, y por ese camino no se leía nunca: seguía
 * dependiendo de que alguien se acordara de pulsar un botón, que es justo lo
 * que se venía a quitar.
 *
 * Así que en cuanto la ficha queda guardada, se avisa. El ERP la lee, la guarda
 * y la contradicción existe **antes** de que nadie tase el coche.
 *
 * ## Lo que no hace
 *
 * No espera a que la lectura acabe para nada: lo que devuelve no se mira. Si el
 * ERP no contesta, el coche del cliente ya está guardado y lo suyo ha salido
 * bien — perder la lectura es una molestia para nosotros, no para él.
 *
 * Por lo mismo va con un tope corto. Un cliente esperando a que su coche se
 * guarde no puede quedarse mirando la pantalla porque el lector de otro sistema
 * vaya lento.
 */

/** Lo que se espera al ERP antes de seguir sin él. */
const ESPERA_MS = 8000;

/** El nombre con el que se guarda la ficha técnica. */
const LA_FICHA = "technical_sheet";

/**
 * Si eso que se acaba de guardar trae ficha técnica.
 *
 * Se mira lo **guardado**, no lo que venía en la petición: lo que viene puede
 * no haberse llegado a guardar, y avisar de una ficha que no existe hace que el
 * ERP se ponga a buscarla para nada.
 */
function traeFichaTecnica(vehiculo) {
  const docs = vehiculo && vehiculo.technicalSheetDocuments;
  return Array.isArray(docs) && docs.length > 0;
}

/**
 * Avisa al ERP. No lanza nunca y no devuelve nada que haya que mirar.
 *
 * Sin `ERP_API_URL` o sin `INTERNAL_API_SECRET` se calla: en local no hay ERP
 * al lado, y reventar por eso dejaría sin guardar coches por una lectura que es
 * de apoyo.
 */
async function avisaDeLaFicha(vehiculo) {
  if (!traeFichaTecnica(vehiculo)) return;

  const id = String((vehiculo && vehiculo.id) || "").trim();
  const erp = String(process.env.ERP_API_URL || "").trim().replace(/\/$/, "");
  const secreto = String(process.env.INTERNAL_API_SECRET || "").trim();
  if (!id || !erp || !secreto) return;

  const corta = new AbortController();
  const reloj = setTimeout(() => corta.abort(), ESPERA_MS);
  try {
    await fetch(`${erp}/api/interno/ficha-tecnica`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secreto}` },
      body: JSON.stringify({ vehicleId: id }),
      signal: corta.signal,
    });
  } catch (err) {
    // Se apunta y se sigue: el coche del cliente ya está guardado.
    console.error("[ficha] no se ha podido avisar al ERP:", err && err.message);
  } finally {
    clearTimeout(reloj);
  }
}

module.exports = { ESPERA_MS, LA_FICHA, traeFichaTecnica, avisaDeLaFicha };
