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

/** Las pestañas que existen en el panel. Un grupo tiene que ser una de estas. */
export const PESTANAS = ["pendiente", "en_curso", "finalizadas", "contratadas", "canceladas"];

/**
 * El grupo de una etapa de importación, o null si no es una de ellas.
 *
 * Antes de la fianza, es algo que está esperando respuesta: pendiente. Desde que
 * la paga hasta que lo tiene, el coche está en marcha: en curso.
 *
 * Y entregado va a **contratadas**, no a finalizadas. Estuvo en finalizadas y
 * era el sitio equivocado: esa pestaña recoge visitas que ya pasaron —fui a ver
 * un coche y se acabó—, y una importación entregada es lo contrario, un coche
 * comprado, pagado y con su factura. La propia pestaña lo dice: «aquí
 * aparecerán los vehículos que hayas comprado o contratado en renting».
 *
 * El corte se pone en la entrega y no en la fianza a propósito: mientras el
 * coche está de camino, lo que el cliente quiere ver es por dónde va, y eso es
 * «en curso». Contratadas es para lo que ya es suyo.
 */
export function grupoDeImportacion(status) {
  if (status === "Pendiente" || status === "Contactado") return "pendiente";
  if (status === "Entregado") return "contratadas";
  if (ETAPAS_IMPORTACION.includes(status)) return "en_curso";
  return null;
}
