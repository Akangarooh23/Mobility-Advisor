/**
 * Una cita, venga de donde venga. Lado del servidor.
 *
 * Hay tres sitios donde puede vivir la cita de alguien:
 *
 *   · `vehicle_visit_bookings` — la reservo el cliente con el calendario del
 *     marketplace. Guarda `starts_at` y un testigo para abrirla sin contrasena.
 *   · `moveadvisor_market_leads` — la puso un trabajador sobre una solicitud.
 *     Guarda `appointment_date` y `appointment_time` por separado.
 *   · `moveadvisor_viewing_appointments` — entre particulares. Guarda
 *     `confirmed_slot`.
 *
 * No se unifican las tablas y no es un descuido: un lead es una conversacion de
 * venta que *puede* tener cita, no una cita. Lo que si sobraba era traducir cada
 * una a mano en cada sitio —llego a estar escrito cuatro veces, con tres nombres
 * distintos— y eso es lo que vive aqui.
 *
 * Hay otro modulo igual en `src/utils/citas.js` para el navegador, porque Create
 * React App no deja importar nada de fuera de `src/` y esto es CommonJS. Es la
 * misma forma en los dos lados; si se toca uno, se toca el otro.
 */

/** El estado que ve el cliente, a partir del que guarda la base. */
const ESTADO = {
  pending: "Pendiente de aprobación",
  confirmed: "Cita confirmada",
  cancelled: "Cancelado",
};

/**
 * Los pasos que puede dar una visita, y como se cuentan.
 *
 * El estado —pendiente, confirmada, cancelada— dice donde esta. Esto dice como
 * ha llegado hasta ahi, que es lo que hacia falta para que quien abre una cita
 * sepa si ya se llamo al concesionario sin tener que preguntar.
 *
 * La lista vive aqui y no en un CHECK de la base a proposito: va a crecer, y una
 * migracion por cada paso nuevo es peor que una lista en codigo.
 */
const PASO = {
  solicitada:               "El cliente pidió la visita",
  concesionario_contactado: "Hablado con el concesionario",
  horas_propuestas:         "El concesionario propone otras horas",
  whatsapp_enviado:         "Mandado al cliente por WhatsApp",
  cliente_respondio:        "El cliente eligió una hora",
  confirmada:               "Cita confirmada",
  movida:                   "Cita movida a otra hora",
  cancelada:                "Cita cancelada",
  concesionario_avisado:    "Avisado el concesionario de que el cliente va",
};

/** Como se lee un paso. Si es uno que no conocemos, se enseña tal cual. */
function comoSeLee(evento) {
  return PASO[String(evento || "")] || String(evento || "");
}

/** El estado legible de una reserva del calendario. */
function estadoDeReserva(status) {
  return ESTADO[String(status || "")] || String(status || "");
}

/**
 * Una reserva del calendario, contada como la cuenta un lead.
 *
 * Los huecos que no tiene —direccion, persona por la que preguntar— se quedan
 * vacios a proposito: quien pinta ya sabe no enseñar una fila vacia, y rellenarla
 * con un guion seria inventarse un dato.
 */
function deReserva(b, { sitioUrl = "" } = {}) {
  const cuando = new Date(b.starts_at);
  return {
    id: b.id,
    user_email: b.buyer_email,
    contact_name: b.buyer_name,
    vehicle_title: b.vehicle_title,
    appointment_date: b.starts_at,
    appointment_time: cuando.toLocaleTimeString("es-ES", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
    }),
    appointment_address: b.meeting_place || "",
    appointment_contact: b.meeting_contact || "",
    // La suya, con su testigo: quien reservo con el calendario puede no tener
    // cuenta, y mandarle al panel de solicitudes es mandarle a una pagina que no
    // es suya.
    gestionar_url: b.token_buyer
      ? `${String(sitioUrl).replace(/\/$/, "")}/mi-cita?id=${encodeURIComponent(b.id)}&token=${encodeURIComponent(b.token_buyer)}`
      : "",
  };
}

module.exports = { ESTADO, PASO, comoSeLee, estadoDeReserva, deReserva };
