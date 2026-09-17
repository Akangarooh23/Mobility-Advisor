/**
 * La hora de una visita, como se enseña: «10:00».
 *
 * Una visita es a una hora concreta. Enseñar «10:00 – 11:00» o «10:00 – 14:00»
 * hacía creer que la cita era un rango. Solo una reserva vieja —de cuando se
 * reservaba la franja entera del vendedor— dura más de una hora, y entonces se
 * dice el rango para no mentir sobre lo que se guardó.
 *
 * `formatea` es la función de hora de cada pantalla, para que todas la escriban
 * igual que el resto de su página.
 */
const UNA_HORA = 60 * 60 * 1000;

export function horaDeLaVisita(inicio, fin, formatea) {
  const a = formatea(inicio);
  if (!fin) return a;
  const dura = new Date(fin).getTime() - new Date(inicio).getTime();
  if (!(dura > UNA_HORA)) return a;
  return `${a} – ${formatea(fin)}`;
}
