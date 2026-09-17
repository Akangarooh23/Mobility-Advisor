"use strict";

/**
 * Las horas en que se puede pedir una visita.
 *
 * Hay dos clases de hueco en `vehicle_visit_availability`:
 *
 *   · **De una hora**, los de concesionario, renting e importación. Se reservan
 *     enteros y quedan ocupados.
 *   · **Franjas de varias horas**, las que pone el dueño particular de un coche:
 *     «el sábado de 10:00 a 14:00 puedo enseñarlo». Eso no es una cita: es
 *     cuándo está disponible.
 *
 * Una franja se reservaba entera. Quien elegía «10:00» se quedaba con la cita
 * «de 10:00 a 14:00» —un rango, no una hora—, y nadie más podía ir esa mañana.
 * Ahora una franja se ofrece **hora a hora**: el comprador elige las 10:00, la
 * visita es de 10:00 a 11:00, y las 11:00, 12:00 y 13:00 siguen libres.
 *
 * Cada hora se identifica como `<id de la franja>@<hora ISO>`. Así las
 * pantallas siguen mandando un solo identificador, como con los huecos de una
 * hora, y el servidor sabe de qué franja sale y a qué hora es.
 */

/** Lo que dura una visita. */
const DURACION_MS = 60 * 60 * 1000;

const SEPARADOR = "@";

/** El identificador de una hora concreta dentro de una franja. */
function idDeHora(franjaId, inicio) {
  return `${franjaId}${SEPARADOR}${new Date(inicio).toISOString()}`;
}

/**
 * De qué franja es y a qué hora, a partir del identificador que manda la
 * pantalla. Un hueco de una hora trae solo su id, y entonces `hora` es null.
 */
function leeElHueco(slotId) {
  const texto = String(slotId || "");
  const i = texto.indexOf(SEPARADOR);
  if (i < 0) return { franjaId: texto, hora: null };
  const hora = new Date(texto.slice(i + 1));
  return {
    franjaId: texto.slice(0, i),
    hora: Number.isNaN(hora.getTime()) ? null : hora.toISOString(),
  };
}

/** Si el hueco es una franja de varias horas y no una hora suelta. */
function esDeVariasHoras(franja) {
  const d = new Date(franja?.ends_at).getTime() - new Date(franja?.starts_at).getTime();
  return Number.isFinite(d) && d > DURACION_MS;
}

/** Las horas en punto de una franja en que cabe una visita entera, que no han pasado. */
function lasHoras(franja, ahora = new Date()) {
  const inicio = new Date(franja?.starts_at).getTime();
  const fin = new Date(franja?.ends_at).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return [];
  const horas = [];
  for (let t = inicio; t + DURACION_MS <= fin; t += DURACION_MS) {
    if (t > ahora.getTime()) horas.push(new Date(t).toISOString());
  }
  return horas;
}

/** Si una visita a esa hora se pisa con alguna de estas reservas. */
function sePisa(inicioIso, reservas) {
  const a = new Date(inicioIso).getTime();
  const b = a + DURACION_MS;
  return (reservas || []).some((r) => {
    if (!["pending", "confirmed"].includes(String(r.status || ""))) return false;
    const ra = new Date(r.starts_at).getTime();
    const rb = new Date(r.ends_at || ra + DURACION_MS).getTime();
    return ra < b && rb > a;
  });
}

/**
 * Lo que se le ofrece al comprador de un hueco.
 *
 * Una franja se abre en sus horas libres, cada una con su identificador. Un
 * hueco de una hora se devuelve tal cual. Las horas ya reservadas no salen.
 */
function loQueSeOfrece(franja, reservas = [], ahora = new Date()) {
  if (!esDeVariasHoras(franja)) return [franja];
  return lasHoras(franja, ahora)
    .filter((h) => !sePisa(h, reservas))
    .map((h) => ({
      ...franja,
      id: idDeHora(franja.id, h),
      franja_id: franja.id,
      starts_at: h,
      ends_at: new Date(new Date(h).getTime() + DURACION_MS).toISOString(),
    }));
}

/**
 * La hora que se reserva de una franja.
 *
 * La que se eligió si vale —está dentro, en punto, no ha pasado y está libre—.
 * Si no se eligió ninguna (una pantalla vieja que manda solo la franja), la
 * primera libre. `null` si no hay ninguna.
 */
function laHoraQueSeReserva(franja, hora, reservas = [], ahora = new Date()) {
  const libres = lasHoras(franja, ahora).filter((h) => !sePisa(h, reservas));
  if (hora) return libres.includes(new Date(hora).toISOString()) ? new Date(hora).toISOString() : null;
  return libres[0] || null;
}

module.exports = {
  DURACION_MS,
  idDeHora,
  leeElHueco,
  esDeVariasHoras,
  lasHoras,
  sePisa,
  loQueSeOfrece,
  laHoraQueSeReserva,
};
