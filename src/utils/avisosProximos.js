/**
 * Lo que cuenta la campana: las citas que le vienen a alguien.
 *
 * Solo las **confirmadas**. Una visita pendiente de aprobación es una precita:
 * la ha pedido, pero nadie ha dicho todavía que sí, y ponerle un número en la
 * campana es prometerle una cita que quizá no llegue a existir. Sigue viéndola
 * en Solicitudes, con su estado, que es donde toca.
 *
 * La traducción de cada origen a una cita vive en `citas.js`, que es el único
 * sitio donde se sabe que unas guardan `starts_at` y otras `appointment_date`.
 *
 * Se queda fuera todo lo que no tiene fecha —peticiones de información, alertas
 * de mercado, novedades—: una campana que siempre tiene un número deja de
 * mirarse en dos semanas, y entonces no avisa de nada.
 */
import { citasEnFirme } from "./citas";

export function avisosProximos(solicitudes = [], ahora = new Date()) {
  return citasEnFirme(solicitudes, ahora);
}

/** Cuántas hay. Es el número de la campana. */
export function cuantosAvisos(solicitudes = [], ahora = new Date()) {
  return avisosProximos(solicitudes, ahora).length;
}
