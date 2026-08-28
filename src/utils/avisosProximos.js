/**
 * Las citas que le vienen a alguien, sin importar de dónde salgan.
 *
 * Hay dos sistemas de visitas en paralelo: las que reserva el cliente con el
 * calendario del marketplace, que guardan `starts_at`, y las que le pone un
 * trabajador sobre una solicitud, que guardan `appointment_date` y
 * `appointment_time`. Para quien las tiene son lo mismo: sitios donde hay que
 * estar un día a una hora.
 *
 * Esto es lo que cuenta la campana. Se queda fuera todo lo que no tiene fecha
 * —peticiones de información, alertas de mercado, novedades—: una campana que
 * siempre tiene un número deja de mirarse en dos semanas, y entonces no avisa
 * de nada.
 */

function parseMeta(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

/** Cuándo es, en fecha, o null si no se puede saber. */
function cuandoEs(item) {
  const meta = parseMeta(item.meta);

  if (meta.starts_at) {
    const d = new Date(meta.starts_at);
    return isNaN(d) ? null : d;
  }

  if (meta.appointment_date) {
    // La hora puede venir vacía: entonces vale el día entero, y se toma el
    // final para no dar por pasada una cita que es hoy más tarde.
    const dia  = String(meta.appointment_date).slice(0, 10);
    const hora = /^\d{1,2}:\d{2}/.test(String(meta.appointment_time || "")) ? meta.appointment_time : "23:59";
    const d = new Date(`${dia}T${String(hora).padStart(5, "0")}:00`);
    return isNaN(d) ? null : d;
  }

  return null;
}

const CANCELADOS = ["Cancelado", "Descartado", "cancelled"];

/**
 * Las citas futuras, de la más próxima a la más lejana.
 *
 * `ahora` se pasa para poder probarlo: una prueba que dependa del reloj del
 * día que se ejecuta no prueba nada.
 */
export function avisosProximos(solicitudes = [], ahora = new Date()) {
  return (Array.isArray(solicitudes) ? solicitudes : [])
    .filter((s) => s && !CANCELADOS.includes(s.status))
    .map((s) => {
      const cuando = cuandoEs(s);
      if (!cuando) return null;
      const meta = parseMeta(s.meta);
      return {
        id: s.id,
        titulo: s.title || "Vehículo",
        cuando,
        pendiente: s.status === "Pendiente de confirmar",
        // Las del marketplace se abren con su testigo, sin contraseña.
        enlace: meta.booking_id && meta.token_buyer
          ? `/mi-cita?id=${encodeURIComponent(meta.booking_id)}&token=${encodeURIComponent(meta.token_buyer)}`
          : "",
      };
    })
    .filter((v) => v && v.cuando > ahora)
    .sort((a, b) => a.cuando - b.cuando);
}

/** Cuántas hay. Es el número de la campana. */
export function cuantosAvisos(solicitudes = [], ahora = new Date()) {
  return avisosProximos(solicitudes, ahora).length;
}
