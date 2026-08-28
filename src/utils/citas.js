/**
 * Una cita, venga de donde venga.
 *
 * Hay tres sitios donde puede vivir la cita de alguien:
 *
 *   · `vehicle_visit_bookings` — la reservó el cliente con el calendario del
 *     marketplace. Guarda `starts_at` y un testigo para abrirla sin contraseña.
 *   · `moveadvisor_market_leads` — la puso un trabajador sobre una solicitud.
 *     Guarda `appointment_date` y `appointment_time` por separado.
 *   · `moveadvisor_viewing_appointments` — entre particulares. Guarda
 *     `confirmed_slot`.
 *
 * No se unifican las tablas y no es un descuido: un lead es una conversación de
 * venta que *puede* tener cita, no una cita. Lo que sí sobraba era traducir cada
 * una a mano en cada pantalla —llegó a estar escrito cuatro veces, con tres
 * nombres distintos— y eso es lo que vive aquí.
 *
 * Este módulo es el del navegador. Hay otro igual en `lib/citas.js` para el
 * servidor, porque Create React App no deja importar nada de fuera de `src/` y
 * `lib/` es CommonJS. Es la misma forma en los dos lados; si se toca uno, se
 * toca el otro.
 */

/** El estado que ve el cliente, a partir del que guarda la base. */
export const ESTADO = {
  pending: "Pendiente de aprobación",
  confirmed: "Cita confirmada",
  cancelled: "Cancelado",
};

/** Los que quieren decir que ya no hay nada a lo que ir. */
export const ANULADOS = ["Cancelado", "Descartado", "cancelled"];

export function meta(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

/**
 * Cuándo es, en fecha, o null si no se puede saber.
 *
 * Cada origen la guarda a su manera. La hora puede faltar: entonces vale el día
 * entero y se toma el final, para no dar por pasada una cita que es hoy más
 * tarde.
 */
export function cuandoEs(item) {
  const m = meta(item?.meta);

  const directa = m.starts_at || m.confirmed_slot;
  if (directa) {
    const d = new Date(directa);
    return isNaN(d) ? null : d;
  }

  if (m.appointment_date) {
    const dia = String(m.appointment_date).slice(0, 10);
    const hora = /^\d{1,2}:\d{2}/.test(String(m.appointment_time || "")) ? m.appointment_time : "23:59";
    const d = new Date(`${dia}T${String(hora).padStart(5, "0")}:00`);
    return isNaN(d) ? null : d;
  }

  return null;
}

/** ¿Sigue en pie? */
export function enPie(item) {
  return Boolean(item) && !ANULADOS.includes(item.status);
}

/**
 * Una cita en la forma que usan las pantallas.
 *
 * Devuelve null si eso no es una cita —una petición de información no lo es— o
 * si no se puede saber cuándo.
 */
export function comoCita(item) {
  if (!enPie(item)) return null;
  const cuando = cuandoEs(item);
  if (!cuando) return null;
  const m = meta(item.meta);
  return {
    id: item.id,
    titulo: item.title || "Vehículo",
    cuando,
    pendiente: item.status === ESTADO.pending,
    // Solo las del marketplace se abren con testigo, sin contraseña.
    enlace: m.booking_id && m.token_buyer
      ? `/mi-cita?id=${encodeURIComponent(m.booking_id)}&token=${encodeURIComponent(m.token_buyer)}`
      : "",
  };
}

/** Las que aún no han pasado, de la más próxima a la más lejana. */
export function proximas(items = [], ahora = new Date()) {
  return (Array.isArray(items) ? items : [])
    .map(comoCita)
    .filter((c) => c && c.cuando > ahora)
    .sort((a, b) => a.cuando - b.cuando);
}
