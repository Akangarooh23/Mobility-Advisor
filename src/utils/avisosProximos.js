/**
 * Lo que cuenta la campana: las citas que le vienen a alguien.
 *
 * La traducción de cada origen a una cita vive en `citas.js`, que es el único
 * sitio donde se sabe que unas guardan `starts_at` y otras `appointment_date`.
 * Aquí solo queda la regla de esta pantalla.
 *
 * Se queda fuera todo lo que no tiene fecha —peticiones de información, alertas
 * de mercado, novedades—: una campana que siempre tiene un número deja de
 * mirarse en dos semanas, y entonces no avisa de nada.
 */
import { proximas } from "./citas";

export function avisosProximos(solicitudes = [], ahora = new Date()) {
  return proximas(solicitudes, ahora);
}

/** Cuántas hay. Es el número de la campana. */
export function cuantosAvisos(solicitudes = [], ahora = new Date()) {
  return avisosProximos(solicitudes, ahora).length;
}
