/**
 * En qué pestaña del panel cae una solicitud de importación.
 *
 * Las pestañas se escribieron para visitas —pendiente, en curso, finalizada— y
 * una importación tiene sus propias etapas: fianza pagada, pedido a Alemania,
 * transporte, trámites, entrega. Ninguna de esas estaba contemplada, así que la
 * solicitud **no caía en ningún grupo y desaparecía de la pantalla**.
 *
 * Ocurría en el peor momento posible: justo después de pagar. El cliente suelta
 * cuatro mil euros, vuelve a su panel y su coche ya no está por ninguna parte.
 *
 * Aquí, y no dentro de la pantalla, porque es una regla que hay que poder
 * comprobar: cada etapa que exista tiene que tener su sitio.
 */

/** Las etapas de una importación, en orden. Las mismas que el ERP. */
export const ETAPAS_IMPORTACION = [
  "Pendiente",
  "Contactado",
  "Depósito retenido",
  "Verificado y pagado",
  "En transporte",
  "En trámites",
  "Entregado",
];

/**
 * El grupo de una etapa de importación, o null si no es una de ellas.
 *
 * Antes de la fianza, es algo que está esperando respuesta: pendiente. Desde que
 * la paga hasta que lo tiene, el coche está en marcha: en curso. Entregado se
 * acabó.
 */
export function grupoDeImportacion(status) {
  if (status === "Pendiente" || status === "Contactado") return "pendiente";
  if (status === "Entregado") return "finalizadas";
  if (ETAPAS_IMPORTACION.includes(status)) return "en_curso";
  return null;
}
