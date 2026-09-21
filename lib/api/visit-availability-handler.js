const { Pool } = require("pg");
const crypto = require("crypto");
const { MARCA, correoInterno, remitente } = require("../marca");
const { plantilla, parrafo, datos, aviso, boton, esc } = require("../correo");
const { identidadDeLaPeticion } = require("./identidad");
const { esUnaHoraPropuesta } = require("../citas");
const { SSL_POSTGRES } = require("../postgres-ssl");
const SV = require("../solicitud-de-visita");
const avisosPush = require("../avisos-push");
const HUECOS = require("../huecos-de-visita");
const COMPRA = require("../quiero-comprarlo");

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) return null;
  _pool = new Pool({ connectionString: conn, ssl: SSL_POSTGRES });
  return _pool;
}

let solicitudesListas = false;
/** La tabla de solicitudes, creada la primera vez que hace falta. */
async function preparaSolicitudes(pool) {
  if (solicitudesListas) return;
  await pool.query(SV.ENSURE_TABLA);
  await pool.query(SV.ENSURE_INDICE).catch(() => {});
  // La columna va en la reserva, que es la tabla que mira el ERP. Sin ella, la
  // respuesta se queda en la solicitud y no la lee nadie.
  await pool.query(SV.ENSURE_EN_LA_RESERVA).catch(() => {});
  // Y las de la UTM en la solicitud: la tabla ya existe en produccion, asi que
  // el CREATE TABLE IF NOT EXISTS no las anade.
  await pool.query(SV.ENSURE_UTM_EN_LA_SOLICITUD).catch(() => {});
  solicitudesListas = true;
}

function normalize(v) {
  return typeof v === "string" ? v.trim() : "";
}

function jsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

// ── Email helpers ─────────────────────────────────────────────────────────────

const FROM_EMAIL   = MARCA.remitentePorDefecto;
// Se pregunta en cada uso y no al cargar el modulo: en una funcion
// serverless el modulo se cachea y el valor se quedaria del primer arranque.
const opsEmail = () => process.env.OPS_EMAIL || correoInterno();
const SITE_URL     = process.env.SITE_URL || MARCA.sitioUrl;

/**
 * Manda el correo y, si se le dice qué poner, avisa también al móvil.
 *
 * El aviso va solo en los correos a una persona —el comprador, el vendedor—,
 * nunca en los del equipo: por eso es opcional y no sale del asunto. Y va
 * después del correo: si Resend falla no hay aviso, y si el aviso falla el
 * correo ya salió. `enviaAviso` no lanza nunca.
 */
async function sendEmail({ to, subject, html, attachments, movil }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[visit-booking] RESEND_API_KEY not set — skipping email"); return; }
  const body = { from: FROM_EMAIL, to, subject, html };
  if (attachments && attachments.length) body.attachments = attachments;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${errBody.message || JSON.stringify(errBody)}`);
  }
  if (movil && movil.titulo) {
    await avisosPush
      .enviaAviso([to], { titulo: movil.titulo, cuerpo: movil.cuerpo || "", datos: { pantalla: movil.pantalla || "visitas" } })
      .catch(() => {});
  }
}

// La zona del cliente, no la del servidor. En Vercel el servidor corre en UTC, y
// sin esto a una visita de las 18:00 el correo le ponia las 16:00: el ERP la
// enseñaba bien —lo pinta el navegador— y el correo dos horas antes.
const ZONA = "Europe/Madrid";
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
}
/**
 * La franja entera: «de 10:00 a 14:00».
 *
 * Una visita se pide sobre una franja, no sobre una hora. Poner solo la de
 * empezar —«Hora 10:00»— le hacía creer al comprador que le esperaban a las
 * diez en punto, cuando la ventana que le enseñó la web era de cuatro horas.
 */
function fmtFranja(inicio, fin) {
  const a = fmtTime(inicio);
  if (!fin) return a;
  // Una visita es a una hora: «10:00». Solo una reserva vieja, de antes de
  // ofrecer las franjas hora a hora, dura más, y entonces se dice el rango.
  const dura = new Date(fin).getTime() - new Date(inicio).getTime();
  if (!(dura > HUECOS.DURACION_MS)) return a;
  const b = fmtTime(fin);
  return a === b ? a : `de ${a} a ${b}`;
}

/**
 * Si la visita es al coche de un particular.
 *
 * Entonces la confirma **él**, no nosotros: es quien enseña el coche, en su
 * casa y a su hora, y quien sabe si esa mañana puede. En las de concesionario,
 * renting o importación se llama y se confirma desde el ERP, como siempre.
 *
 * Se reconoce por las dos cosas a la vez: el anuncio es de un coche de garaje
 * (`idcar-`) y tiene el correo de su dueño.
 */
function esDeParticular(booking) {
  return Boolean(booking?.seller_email) && String(booking?.offer_id || "").startsWith("idcar-");
}

/** La página donde el dueño confirma o propone otra hora. La llave es su testigo. */
function enlaceDelVendedor(booking) {
  return `${SITE_URL}/cita-vendedor?id=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(booking.token_seller)}`;
}

function dtIcs(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildIcs(booking) {
  // El ORGANIZER tiene que ser la misma dirección desde la que sale el correo.
  // Si no coinciden, Gmail y Outlook tratan la invitación como suplantada y no
  // enseñan los botones de aceptar. Estaba escrita a mano, así que al cambiar
  // el remitente se habrían separado sin que saltara nada.
  const coincidencia = /<([^>]+)>/.exec(remitente());
  const direccionRemitente = (coincidencia ? coincidencia[1] : remitente()).trim();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${MARCA.nombre}//Visitas//ES`,
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTART:${dtIcs(booking.starts_at)}`,
    `DTEND:${dtIcs(booking.ends_at)}`,
    `SUMMARY:Visita: ${booking.vehicle_title || booking.offer_id}`,
    `DESCRIPTION:Cita confirmada para ver el vehículo.\\nID: ${booking.id}`,
    `UID:${booking.id}@${MARCA.dominioUid}`,
    `ORGANIZER;CN=${MARCA.nombre}:mailto:${direccionRemitente}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

// `emailBase` vivía aquí: metía todo el formato en un <style> —que no todos
// los clientes de correo respetan— y llevaba el logotipo de la marca anterior
// escrito a mano. Ahora se usa la maqueta común, igual que el resto.

async function sendBookingEmails(booking, opts = {}) {
  const { isReschedule = false } = opts;
  const dateStr = fmtDate(booking.starts_at);
  const timeStr = fmtTime(booking.starts_at);
  const vehicle = booking.vehicle_title || booking.offer_id;
  const manageUrl = `${SITE_URL}/mi-cita?id=${booking.id}&token=${booking.token_buyer}`;
  const icsContent = buildIcs(booking);
  const icsAttachment = {
    filename: "cita-popcar.ics",
    content: Buffer.from(icsContent).toString("base64"),
  };

  // Una solicitud sobre un horario que nadie ha publicado no es una cita.
  //
  // Decirle «confirmada» y adjuntarle el calendario es prometerle algo que
  // todavía no ha dicho nadie: puede que el concesionario cierre ese día. Se le
  // cuenta lo que hay —la hemos pedido, te confirmamos— y el .ics sale cuando
  // alguien la confirma de verdad desde el ERP.
  const pendiente = booking.status === "pending";
  const particular = esDeParticular(booking);
  const franja = fmtFranja(booking.starts_at, booking.ends_at);

  // El encabezado lo pone ahora la maqueta; aquí solo queda lo que se dice.
  // Pendiente manda sobre «reprogramada»: al cambiar de hora la visita vuelve a
  // estar por aprobar, y decirle que ya esta reprogramada seria prometerle una
  // hora que nadie ha acordado todavia.
  const buyerSubtitle = pendiente
    ? (particular
        ? (isReschedule
            ? "Hemos cambiado tu visita a la franja que has elegido. Se la hemos pasado a quien tiene el coche, y te escribimos en cuanto la confirme o te proponga otra hora."
            : "Hemos recibido tu solicitud y se la hemos pasado a quien tiene el coche. Te escribimos en cuanto la confirme o te proponga otra hora.")
        : isReschedule
          ? "Hemos cambiado tu visita a la hora que has elegido. Nos falta confirmarla con quien tiene el coche, y te escribimos en cuanto lo tengamos."
          : "Hemos recibido tu solicitud. Nos falta confirmar ese horario con quien tiene el coche, y te escribimos en cuanto lo tengamos.")
    : isReschedule
      ? "Tu visita ha sido reprogramada al siguiente horario."
      : "Tu visita está reservada. Guarda esta fecha en tu calendario.";
  const subjectBuyer  = pendiente
    ? (isReschedule
        ? `Hemos cambiado tu visita — ${vehicle}`
        : `Hemos recibido tu solicitud de visita — ${vehicle}`)
    : isReschedule
      ? `Tu cita se ha movido — ${vehicle} — ${dateStr}`
      : `Cita confirmada — ${vehicle} — ${dateStr}`;

  // ── Email al comprador ──────────────────────────────────────────────────
  const buyerHtml = plantilla({
    titulo: pendiente ? (isReschedule ? 'Hemos cambiado tu visita' : 'Hemos recibido tu solicitud') : isReschedule ? 'Tu cita se ha movido' : 'Tu cita está confirmada',
    cuerpo:
      parrafo(buyerSubtitle) +
      datos([
        ['Vehículo', esc(vehicle)],
        [pendiente ? 'Día que pides' : 'Fecha', esc(dateStr)],
        ['Hora', esc(particular ? franja : timeStr)],
      ]) +
      boton(pendiente ? 'Ver mi solicitud' : 'Gestionar mi cita', manageUrl) +
      (pendiente
        ? parrafo('Si ese horario no puede ser, te proponemos otro. No hace falta que hagas nada.', 14)
        : parrafo('Va adjunto un archivo para añadir la cita a tu calendario.', 14)),
  });

  // ── Email al vendedor particular ────────────────────────────────────────
  /*
   * Al vendedor no se le escribe con la visita pendiente.
   *
   * Se le escribía nada más pedirla, con un «alguien ha reservado una visita» y
   * el teléfono y el correo del comprador. Pero una solicitud no es una visita:
   * nadie ha hablado todavía con quien la pide. Y a ese vendedor le prometimos
   * al publicar que filtramos y solo le pasamos las visitas que valen la pena:
   * pasarle cada solicitud con los datos del que la hace es lo contrario.
   *
   * Se le escribe desde el ERP al confirmarla, con el día, la hora y el nombre
   * de quien va. Mientras está pendiente, el aviso va al equipo, que es quien
   * tiene que llamar y confirmarla.
   */
  /*
   * En el coche de un particular, sí: se le escribe al pedirla, porque es él
   * quien la confirma. Con el nombre de quien quiere verlo y lo que haya
   * escrito, pero sin su teléfono ni su correo: la conversación pasa por
   * nosotros, y así la confirma o propone otra hora sin tener que llamar a
   * nadie.
   */
  const avisaAlVendedor = pendiente && particular;
  const sellerHtml = plantilla({
    titulo: isReschedule ? 'Han cambiado la hora de una visita' : 'Alguien quiere ver tu coche',
    cuerpo:
      parrafo(isReschedule
        ? 'Quien quería ver tu coche ha cambiado la franja. Dinos si te viene bien.'
        : 'Alguien quiere ver tu coche. Dinos si te viene bien esa franja o proponle otra.') +
      datos([
        ['Vehículo', esc(vehicle)],
        ['Día', esc(dateStr)],
        ['Hora', esc(franja)],
        ['Quién', esc(booking.buyer_name)],
        ['Mensaje', esc(booking.notes)],
      ]) +
      boton('Confirmar o proponer otra hora', booking.token_seller ? enlaceDelVendedor(booking) : `${SITE_URL}/panel/vehiculos`) +
      parrafo('Hasta que no la confirmes, al comprador no le damos la visita por hecha. Si no puedes en ninguna hora cercana, desde el mismo enlace puedes rechazarla.', 14),
  });

  // ── Email al equipo (ofertas profesionales) ─────────────────────────────
  const opsHtml = plantilla({
    titulo: pendiente ? 'Cita por confirmar' : 'Nueva cita recibida',
    cuerpo:
      (pendiente
        // Sin decir de dónde salió el hueco: en los coches de garaje lo publicó
        // su dueño, y «lo generó el sistema» le hacía pensar que no hay nadie
        // detrás a quien preguntar.
        ? (particular
            ? aviso('La confirma el vendedor', 'Es el coche de un particular: le hemos escrito para que la confirme o proponga otra hora. No hay que hacer nada salvo que no conteste.')
            : aviso('Hay que confirmarla', 'El cliente ya sabe que está pendiente. Confírmala o proponle otra desde la Agenda del ERP.'))
        : '') +
      datos([
        ['Oferta', esc(booking.offer_id)],
        ['Vehículo', esc(vehicle)],
        ['Fecha', esc(dateStr)],
        ['Hora', esc(timeStr)],
        ['Comprador', esc(booking.buyer_name)],
        ['Teléfono', esc(booking.buyer_phone)],
        ['Email', esc(booking.buyer_email)],
        ['Notas', esc(booking.notes)],
      ]) +
      // Antes apuntaba a `erp.popcar.tech`, que nunca se creó: el botón llevaba
      // a un 404. La dirección vive en la marca, como el resto.
      boton('Abrir la Agenda del ERP', `${MARCA.urlErp}/bookings`),
    pie: 'Aviso interno del equipo.',
  });

  const sends = [];

  // Buyer
  sends.push(sendEmail({
    to: booking.buyer_email,
    subject: subjectBuyer,
    html: buyerHtml,
    // El calendario solo cuando la cita es cierta: un .ics en el movil de
    // alguien es una cita cerrada, y una solicitud pendiente no lo es.
    ...(pendiente ? {} : { attachments: [icsAttachment] }),
    movil: {
      titulo: pendiente ? "Hemos recibido tu solicitud de visita" : "Tu visita ha cambiado de hora",
      cuerpo: `${vehicle} · ${dateStr} a las ${timeStr}`,
    },
  }).catch((e) => console.error("[email] buyer:", e.message)));

  // Al vendedor particular, para que la confirme.
  if (avisaAlVendedor) {
    sends.push(sendEmail({
      to: booking.seller_email,
      subject: `${isReschedule ? 'Han cambiado la visita' : 'Alguien quiere ver tu coche'} — ${dateStr}, ${franja}`,
      html: sellerHtml,
      movil: { titulo: "Alguien quiere ver tu coche", cuerpo: `${dateStr}, ${franja}. Confírmala o propón otra hora.`, pantalla: "visitas" },
    }).catch((e) => console.error("[email] seller:", e.message)));
  }
  // Y al equipo siempre: en las profesionales para confirmarla, en las de
  // particular para saber que existe si el vendedor no contesta.
  sends.push(sendEmail({
    to: opsEmail(),
    subject: `${particular && pendiente ? 'Visita pedida (la confirma el vendedor)' : 'Nueva cita'} — ${vehicle} — ${dateStr} ${timeStr}`,
    html: opsHtml,
  }).catch((e) => console.error("[email] ops:", e.message)));

  await Promise.allSettled(sends);
}

async function sendCancelEmails(booking) {
  const dateStr = fmtDate(booking.starts_at);
  const timeStr = fmtTime(booking.starts_at);
  const vehicle = booking.vehicle_title || booking.offer_id;

  const buyerCancelHtml = plantilla({
    titulo: 'Tu cita queda cancelada',
    cuerpo:
      datos([
        ['Vehículo', esc(vehicle)],
        ['Fecha', esc(dateStr)],
        ['Hora', esc(timeStr)],
      ]) +
      boton('Ver el vehículo', `${SITE_URL}/marketplace-vo/${booking.offer_id}`) +
      parrafo('Puedes reservar otra hora cuando quieras desde la ficha del vehículo.', 14),
  });

  /*
   * Al vendedor, solo si ya sabía de la visita.
   *
   * Se le cuenta al confirmarla, no al pedirla. Si el comprador cancela una que
   * seguía pendiente, escribirle «cita cancelada» con el correo del comprador es
   * contarle a la vez una visita que no filtramos y los datos de quien la pidió.
   * Entonces se entera el equipo, que es quien la tenía en la Agenda.
   *
   * Y aunque lo supiera, el correo del comprador no va: al confirmar se le da
   * el nombre y nada más, y cancelar no es motivo para darle más.
   */
  /*
   * En una de particular el vendedor lo sabe siempre: se le escribe al pedirla.
   * Y si la ha cancelado él, no hay que contárselo.
   */
  const laCancelaElVendedor = booking.la_cancela === "vendedor";
  const elVendedorLoSabia = Boolean(booking.seller_email) && !laCancelaElVendedor
    && (esDeParticular(booking) || booking.estado_anterior !== "pending");

  const notifyCancelHtml = plantilla({
    // Si la cancela el vendedor, el aviso va al equipo y lo dice.
    titulo: laCancelaElVendedor ? 'El vendedor ha rechazado la visita' : 'Cita cancelada por el comprador',
    cuerpo:
      datos([
        ['Vehículo', esc(vehicle)],
        ['Fecha', esc(dateStr)],
        ['Hora', esc(timeStr)],
        ['Comprador', esc(booking.buyer_name)],
        ...(elVendedorLoSabia ? [] : [['Email', esc(booking.buyer_email)]]),
      ]) +
      parrafo('La hora ha quedado libre otra vez.', 14),
  });

  const buyerHtmlSiLaCancelaElVendedor = plantilla({
    titulo: 'Esa visita no puede ser',
    cuerpo:
      parrafo('Quien tiene el coche no puede enseñarlo en esa franja. Elige otra hora desde la ficha: las que salen son las que tiene libres.') +
      datos([
        ['Vehículo', esc(vehicle)],
        ['Día que pediste', esc(dateStr)],
      ]) +
      boton('Elegir otra hora', `${SITE_URL}/marketplace-vo/${booking.offer_id}`),
  });

  const sends = [
    sendEmail({
      to: booking.buyer_email,
      subject: laCancelaElVendedor ? `Esa visita no puede ser — ${vehicle}` : `Cita cancelada — ${vehicle}`,
      html: laCancelaElVendedor ? buyerHtmlSiLaCancelaElVendedor : buyerCancelHtml,
      movil: { titulo: "Tu visita queda cancelada", cuerpo: `${vehicle} · ${dateStr} a las ${timeStr}` },
    }).catch((e) => console.error("[email] cancel-buyer:", e.message)),
  ];

  const notifyTo = elVendedorLoSabia ? booking.seller_email : opsEmail();
  sends.push(sendEmail({
    to: notifyTo,
    subject: `Cita cancelada — ${vehicle} — ${dateStr}`,
    html: notifyCancelHtml,
    // Al vendedor sí; al buzón del equipo, no.
    ...(elVendedorLoSabia
      ? { movil: { titulo: "Se ha cancelado una visita a tu coche", cuerpo: `${dateStr} a las ${timeStr}. La hora vuelve a estar libre.`, pantalla: "visitas" } }
      : {}),
  }).catch((e) => console.error("[email] cancel-notify:", e.message)));

  await Promise.allSettled(sends);
}

// ── El cliente elige una de las horas que se le propusieron ───────────────────

/**
 * Las horas que se le propusieron, de la ultima propuesta del rastro.
 *
 * No hay tabla de propuestas: la propuesta ya se apunta como un paso del rastro
 * —`horas_propuestas`, con las horas en `datos`— y esa es la fuente. Una tabla
 * aparte diria lo mismo y habria que mantener las dos a la vez.
 *
 * Manda la ultima: si se le propusieron horas dos veces, las buenas son las de
 * la segunda vez.
 */
async function horasPropuestas(cliente, bookingId) {
  const r = await cliente.query(
    `SELECT datos FROM visit_booking_events
      WHERE booking_id = $1 AND evento = 'horas_propuestas'
      ORDER BY created_at DESC LIMIT 1`,
    [bookingId]
  );
  if (!r.rows.length) return [];
  const horas = r.rows[0]?.datos?.horas;
  if (!Array.isArray(horas)) return [];
  return horas.filter((h) => !Number.isNaN(new Date(h).getTime()));
}

/**
 * Lo que se le enseña al cliente cuando abre el enlace del correo.
 *
 * Va sin sesion: el token de su cita es la llave, la misma que abre `/mi-cita`.
 * Devuelve tambien el estado, porque el caso normal de abrirlo dos veces es que
 * ya haya elegido, y entonces hay que decirselo en vez de pedirselo otra vez.
 */
async function propuestaDeVisita(bookingId, token) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  const r = await pool.query(
    `SELECT id, offer_id, vehicle_title, starts_at, ends_at, buyer_name, status,
            meeting_place, meeting_contact
       FROM vehicle_visit_bookings
      WHERE id = $1 AND token_buyer = $2`,
    [bookingId, token]
  );
  if (!r.rows.length) throw new Error("not_found");
  // El pool vale de cliente para leer: no hace falta reservar una conexion
  // para una sola consulta que no va en transaccion.
  const horas = await horasPropuestas(pool, bookingId);
  return { booking: r.rows[0], horas };
}

/**
 * Los tres finales de una visita. La misma lista que en el ERP.
 *
 * La columna `resultado` la escriben las dos aplicaciones, y tiene un CHECK en
 * la base que solo admite estos tres: aunque esto se equivocara, no entraria
 * una cuarta cosa.
 */
const COMO_ACABO = ["no_fue", "fue", "compro"];

/**
 * Cuanto tiempo despues de la visita vale el enlace del correo.
 *
 * El seguimiento sale entre el mismo dia y tres dias despues, asi que dos
 * semanas dan de sobra para contestar sin prisa. Pasado eso no se acepta: un
 * enlace viejo reabriendo un caso cerrado hace mas daño que el dato que trae.
 */
const DIAS_PARA_CONTESTAR = 14;

/**
 * El cliente dice como acabo su visita, desde el correo de seguimiento.
 *
 * El correo ya le preguntaba «¿que tal fue?» y le pedia que contestara
 * escribiendo. Contestar escribiendo significa que alguien lea el correo y lo
 * apunte a mano, y lo que no se apunta no existe: con tres botones lo dice el
 * en un toque y queda escrito.
 *
 * Cuatro reglas, y las cuatro por lo mismo —que este dato acaba en una factura
 * de 200 € a un concesionario—:
 *
 *  - **No pisa lo que ya hay.** Si un trabajador la cerro, gano el: hablo con
 *    el concesionario, y eso vale mas que el recuerdo del cliente.
 *  - **Solo confirmadas y ya empezadas.** De una que no llego a ser no hay nada
 *    que contar.
 *  - **Con fecha de caducidad**, la de arriba.
 *  - **No emite nada.** Deja el resultado escrito y quien factura sigue siendo
 *    una persona en el ERP, que ademas ve que esto lo dijo el cliente.
 */
async function diceComoAcabo(bookingId, token, resultado) {
  if (!COMO_ACABO.includes(resultado)) throw new Error("resultado_invalido");
  const pool = getPool();
  if (!pool) throw new Error("No DB");

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const bRes = await cliente.query(
      `SELECT id, status, starts_at, resultado, vehicle_title, offer_id
         FROM vehicle_visit_bookings
        WHERE id = $1 AND token_buyer = $2
        FOR UPDATE`,
      [bookingId, token]
    );
    if (!bRes.rows.length) throw new Error("not_found");
    const booking = bRes.rows[0];

    if (booking.status !== "confirmed") throw new Error("sin_confirmar");
    const empezo = new Date(booking.starts_at).getTime();
    if (!Number.isFinite(empezo) || empezo > Date.now()) throw new Error("todavia_no");
    if (Date.now() - empezo > DIAS_PARA_CONTESTAR * 86400000) throw new Error("fuera_de_plazo");
    if (booking.resultado) throw new Error("ya_cerrada");

    const actualizada = await cliente.query(
      `UPDATE vehicle_visit_bookings
          SET resultado = $2, resultado_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [bookingId, resultado]
    );
    // Con actor «cliente», que es lo que distingue esto de una llamada. En el
    // ERP se ve en el rastro y en la fila, para que quien va a facturar sepa de
    // donde sale el dato.
    await cliente.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'resultado','cliente',$2)`,
      [bookingId, JSON.stringify({ resultado, por: "el enlace del correo de seguimiento" })]
    );

    await cliente.query("COMMIT");
    return actualizada.rows[0];
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

/**
 * El cliente acepta una de las horas y la visita queda confirmada.
 *
 * Es el mismo final que el boton «El cliente ha elegido hora» del ERP, pero
 * dado por el: contesta al correo pinchando y no hay que esperar a que un
 * trabajador lo teclee. Queda confirmada de verdad —con calendario— porque las
 * horas las ha dado el concesionario y la ha elegido el: los dos que tenian que
 * decir que si ya lo han dicho.
 *
 * La hora tiene que ser una de las propuestas. Sin esa comprobacion, el enlace
 * seria una forma de ponerse la hora que uno quiera sobre un calendario que
 * nadie ha acordado.
 */
async function aceptaHoraPropuesta(bookingId, token, startsAt) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  const cuando = new Date(startsAt);
  if (Number.isNaN(cuando.getTime())) throw new Error("hora_invalida");
  // Las horas se propusieron futuras, pero el correo se abre cuando se abre:
  // una semana despues, la 1 de la lista puede haber pasado ya.
  if (cuando.getTime() < Date.now()) throw new Error("hora_pasada");

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const bRes = await cliente.query(
      `SELECT * FROM vehicle_visit_bookings
        WHERE id = $1 AND token_buyer = $2 AND status != 'cancelled'
        FOR UPDATE`,
      [bookingId, token]
    );
    if (!bRes.rows.length) throw new Error("not_found");
    const booking = bRes.rows[0];
    // Si mientras tanto la ha confirmado un trabajador, no se toca: se le dice
    // lo que hay. Moverla aqui seria pisar una hora ya acordada por telefono.
    if (booking.status === "confirmed") throw new Error("ya_confirmada");

    const horas = await horasPropuestas(cliente, bookingId);
    if (!esUnaHoraPropuesta(horas, cuando.toISOString())) throw new Error("hora_no_propuesta");

    const fin = new Date(cuando.getTime() + 3600000);

    // Nadie mas a esa hora con ese coche. El hueco se crea si no existe, asi
    // que sin esto se podian poner dos visitas al mismo coche a la misma hora.
    const ocupada = await cliente.query(
      `SELECT id FROM vehicle_visit_bookings
        WHERE offer_id = $1 AND starts_at = $2 AND id != $3 AND status IN ('pending','confirmed')
        LIMIT 1`,
      [booking.offer_id, cuando.toISOString(), bookingId]
    );
    if (ocupada.rows.length) throw new Error("hora_ocupada");

    // El hueco de esa hora: se aprovecha si ya existe libre y si no se crea.
    // Lleva `source` de ERP porque es lo que es, una hora que ha puesto una
    // persona hablando con el concesionario.
    // Solo un hueco de una hora: una franja que empieza a esa hora es más
    // larga, y marcarla ocupada cerraría toda la mañana.
    const existente = await cliente.query(
      `SELECT id FROM vehicle_visit_availability
        WHERE offer_id = $1 AND starts_at = $2 AND status = 'available'
          AND ends_at - starts_at <= INTERVAL '1 hour' LIMIT 1`,
      [booking.offer_id, cuando.toISOString()]
    );
    const hueco = existente.rows.length
      ? existente.rows[0].id
      : (await cliente.query(
          `INSERT INTO vehicle_visit_availability (offer_id, starts_at, ends_at, source, status)
           VALUES ($1, $2, $3, 'erp', 'available') RETURNING id`,
          [booking.offer_id, cuando.toISOString(), fin.toISOString()]
        )).rows[0].id;

    await cliente.query(`UPDATE vehicle_visit_availability SET status = 'booked' WHERE id = $1`, [hueco]);
    if (booking.availability_id && booking.availability_id !== hueco) {
      await cliente.query(`UPDATE vehicle_visit_availability SET status = 'available' WHERE id = $1`, [booking.availability_id]);
    }

    // Se limpian las marcas de aviso: la cita es otra, y si no nadie recibiria
    // el recordatorio de la vispera porque ya se dio por mandado.
    const actualizada = await cliente.query(
      `UPDATE vehicle_visit_bookings
          SET availability_id = $1, starts_at = $2, ends_at = $3,
              status = 'confirmed', updated_at = NOW(),
              reminder_sent_at = NULL, reminder_day_of_sent_at = NULL, followup_sent_at = NULL
        WHERE id = $4
        RETURNING *`,
      [hueco, cuando.toISOString(), fin.toISOString(), bookingId]
    );

    // Dos pasos y no uno: que conteste y que quede confirmada son cosas
    // distintas, y el rastro tiene que poder contar quien hizo cada una.
    await cliente.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'cliente_respondio','cliente',$2)`,
      [bookingId, JSON.stringify({ eligio: cuando.toISOString(), por: "el enlace del correo" })]
    );
    await cliente.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'confirmada','cliente',$2)`,
      [bookingId, JSON.stringify({ por: "el propio cliente, eligiendo una de las horas propuestas" })]
    );

    await cliente.query("COMMIT");
    const bk = actualizada.rows[0];
    await sendEleccionEmails(bk).catch((e) => console.error("[visitas] correo de la hora elegida:", e.message));
    return bk;
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

/**
 * Los dos correos de cuando el cliente elige hora.
 *
 * Al cliente, su confirmacion con el calendario. Y al equipo, aviso de que ha
 * contestado: alguien tiene que decirselo al concesionario, que de esto no se
 * entera solo.
 */
async function sendEleccionEmails(booking) {
  const dia     = fmtDate(booking.starts_at);
  const hora    = fmtTime(booking.starts_at);
  const vehicle = booking.vehicle_title || booking.offer_id;
  const manageUrl = `${SITE_URL}/mi-cita?id=${booking.id}&token=${booking.token_buyer}`;

  const alCliente = plantilla({
    titulo: "Tu visita está confirmada",
    cuerpo:
      parrafo("Has elegido esta hora y ya está confirmada. Te esperamos.") +
      datos([
        ["Vehículo", esc(vehicle)],
        ["Día", esc(dia)],
        ["Hora", esc(hora)],
        ["Dónde", esc(booking.meeting_place || "")],
        ["Pregunta por", esc(booking.meeting_contact || "")],
      ]) +
      (booking.meeting_place ? "" : parrafo("Te confirmaremos la dirección exacta antes de la visita.", 14)) +
      boton("Ver mi cita", manageUrl) +
      parrafo("Va adjunto un archivo para añadirla a tu calendario. Si no puedes venir, entra en tu panel, en Solicitudes: desde ahí cambias el día y la hora o cancelas la visita.", 14),
  });

  const alEquipo = plantilla({
    titulo: "El cliente ha elegido hora",
    cuerpo:
      aviso("Avisa a quien tiene el coche", "La visita ya está confirmada en el sistema, pero a quien tiene el coche hay que decírselo: de esto no se entera solo.") +
      datos([
        ["Oferta", esc(booking.offer_id)],
        ["Vehículo", esc(vehicle)],
        ["Día", esc(dia)],
        ["Hora", esc(hora)],
        ["Cliente", esc(booking.buyer_name)],
        ["Teléfono", esc(booking.buyer_phone)],
      ]) +
      boton("Abrir la Agenda del ERP", `${MARCA.urlErp}/bookings`),
    pie: "Aviso interno del equipo.",
  });

  await Promise.allSettled([
    sendEmail({
      to: booking.buyer_email,
      subject: `Tu visita está confirmada — ${vehicle} — ${dia}`,
      html: alCliente,
      movil: { titulo: "Tu visita está confirmada", cuerpo: `${vehicle} · ${dia} a las ${hora}` },
      attachments: [{ filename: "cita-popcar.ics", content: Buffer.from(buildIcs(booking)).toString("base64") }],
    }).catch((e) => console.error("[email] eleccion-cliente:", e.message)),
    /*
     * En la de un particular, a él: las horas las propuso él y tiene que saber
     * cuál ha elegido. Al equipo no le toca avisar a nadie.
     */
    esDeParticular(booking)
      ? sendEmail(correoDeVisitaConfirmadaAlVendedor(booking, "Ha elegido una de las horas que propusiste."))
          .catch((e) => console.error("[email] eleccion-vendedor:", e.message))
      : sendEmail({
          to: opsEmail(),
          subject: `Ha elegido hora — ${vehicle} — ${dia} ${hora}`,
          html: alEquipo,
        }).catch((e) => console.error("[email] eleccion-ops:", e.message)),
  ]);
}


// ── El vendedor particular confirma, propone otra hora o la rechaza ──────────

/** El correo al vendedor de una visita que ya está cerrada, con su calendario. */
function correoDeVisitaConfirmadaAlVendedor(booking, porQue) {
  const vehicle = booking.vehicle_title || booking.offer_id;
  const dia = fmtDate(booking.starts_at);
  const franja = fmtFranja(booking.starts_at, booking.ends_at);
  return {
    to: booking.seller_email,
    subject: `Visita confirmada — ${vehicle} — ${dia}, ${franja}`,
    html: plantilla({
      titulo: "Tienes una visita confirmada",
      cuerpo:
        parrafo(porQue) +
        datos([
          ["Vehículo", esc(vehicle)],
          ["Día", esc(dia)],
          ["Hora", esc(franja)],
          ["Dónde", esc(booking.meeting_place || "")],
          ["Viene", esc(booking.buyer_name)],
        ]) +
        boton("Ver la visita", enlaceDelVendedor(booking)) +
        parrafo("Va adjunto un archivo para añadirla a tu calendario. Si al final no puedes, entra en el mismo enlace y cancélala: se lo decimos nosotros.", 14),
    }),
    attachments: [{ filename: "visita-popcar.ics", content: Buffer.from(buildIcs(booking)).toString("base64") }],
    movil: { titulo: "Tienes una visita confirmada", cuerpo: `${dia}, ${franja}${booking.buyer_name ? ` · viene ${booking.buyer_name}` : ""}`, pantalla: "visitas" },
  };
}

/**
 * Lo que ve el vendedor al abrir su enlace.
 *
 * Sin el correo ni el teléfono del comprador: el nombre y lo que escribió. La
 * llave es su testigo, que solo llega a su correo.
 */
async function laVisitaParaElVendedor(bookingId, token) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  const r = await pool.query(
    `SELECT b.id, b.offer_id, b.vehicle_title, b.starts_at, b.ends_at, b.status,
            b.buyer_name, b.notes, b.meeting_place, b.meeting_contact, b.seller_email,
            v.vehicle_location
       FROM vehicle_visit_bookings b
       LEFT JOIN moveadvisor_user_vehicles v ON 'idcar-' || v.id = b.offer_id
      WHERE b.id = $1 AND b.token_seller = $2`,
    [bookingId, token]
  );
  if (!r.rows.length) throw new Error("not_found");
  const b = r.rows[0];
  const horas = await horasPropuestas(pool, bookingId);
  return {
    booking: {
      id: b.id, offer_id: b.offer_id, vehicle_title: b.vehicle_title,
      starts_at: b.starts_at, ends_at: b.ends_at, status: b.status,
      buyer_name: b.buyer_name, notes: b.notes,
      meeting_place: b.meeting_place, meeting_contact: b.meeting_contact,
    },
    // Lo que ya sabemos de dónde está el coche, para no hacérselo escribir.
    donde_sugerido: normalize(b.vehicle_location),
    horas_propuestas: horas,
  };
}

/**
 * El vendedor confirma la visita.
 *
 * Solo una pendiente: una confirmada ya está, y una cancelada no se resucita
 * desde un enlace viejo. Con dónde es y por quién preguntar, que son lo que el
 * comprador necesita para llegar.
 */
async function vendedorConfirma(bookingId, token, { donde, preguntarPor } = {}) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  const lugar = normalize(donde).slice(0, 200);
  if (!lugar) throw new Error("falta_donde");

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const bRes = await cliente.query(
      `SELECT * FROM vehicle_visit_bookings WHERE id = $1 AND token_seller = $2 FOR UPDATE`,
      [bookingId, token]
    );
    if (!bRes.rows.length) throw new Error("not_found");
    const antes = bRes.rows[0];
    if (antes.status === "confirmed") throw new Error("ya_confirmada");
    if (antes.status !== "pending") throw new Error("no_pendiente");
    if (new Date(antes.starts_at).getTime() < Date.now()) throw new Error("hora_pasada");

    const r = await cliente.query(
      `UPDATE vehicle_visit_bookings
          SET status = 'confirmed', meeting_place = $2, meeting_contact = $3, updated_at = NOW(),
              reminder_sent_at = NULL, reminder_day_of_sent_at = NULL, followup_sent_at = NULL
        WHERE id = $1
        RETURNING *`,
      [bookingId, lugar, normalize(preguntarPor).slice(0, 120)]
    );
    await cliente.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'confirmada','vendedor',$2)`,
      [bookingId, JSON.stringify({ por: "el propio vendedor, desde su enlace", donde: lugar })]
    );
    await cliente.query("COMMIT");

    const bk = r.rows[0];
    const vehicle = bk.vehicle_title || bk.offer_id;
    const dia = fmtDate(bk.starts_at);
    const franja = fmtFranja(bk.starts_at, bk.ends_at);
    await Promise.allSettled([
      sendEmail({
        to: bk.buyer_email,
        subject: `Tu visita está confirmada — ${vehicle} — ${dia}`,
        html: plantilla({
          titulo: "Tu visita está confirmada",
          cuerpo:
            parrafo("Quien tiene el coche te espera.") +
            datos([
              ["Vehículo", esc(vehicle)],
              ["Día", esc(dia)],
              ["Hora", esc(franja)],
              ["Dónde", esc(bk.meeting_place)],
              ["Pregunta por", esc(bk.meeting_contact || "")],
            ]) +
            boton("Ver mi cita", `${SITE_URL}/mi-cita?id=${bk.id}&token=${bk.token_buyer}`) +
            parrafo("Va adjunto un archivo para añadirla a tu calendario. Si no puedes venir, desde tu cita la cambias o la cancelas.", 14),
        }),
        attachments: [{ filename: "cita-popcar.ics", content: Buffer.from(buildIcs(bk)).toString("base64") }],
        movil: { titulo: "Tu visita está confirmada", cuerpo: `${vehicle} · ${dia}, ${franja}`, pantalla: "visitas" },
      }).catch((e) => console.error("[email] vendedor-confirma-comprador:", e.message)),
      sendEmail(correoDeVisitaConfirmadaAlVendedor(bk, "Has confirmado esta visita. Te dejamos el calendario."))
        .catch((e) => console.error("[email] vendedor-confirma-vendedor:", e.message)),
    ]);
    return bk;
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

/** Cuántas horas puede proponer de una vez: las justas para elegir sin agobiar. */
const HORAS_A_PROPONER = 3;

/**
 * El vendedor no puede en esa franja y propone otras horas.
 *
 * Se apunta en el rastro como `horas_propuestas` —el mismo paso que cuando las
 * propone el ERP para un concesionario—, y así el comprador las elige con la
 * misma página y el mismo correo que ya existían.
 */
async function vendedorProponeHoras(bookingId, token, horas) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  const limpias = [...new Set((Array.isArray(horas) ? horas : [])
    .map((h) => new Date(h))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > Date.now())
    .map((d) => d.toISOString()))]
    .sort()
    .slice(0, HORAS_A_PROPONER);
  if (!limpias.length) throw new Error("sin_horas");

  const r = await pool.query(
    `SELECT * FROM vehicle_visit_bookings WHERE id = $1 AND token_seller = $2`,
    [bookingId, token]
  );
  if (!r.rows.length) throw new Error("not_found");
  const bk = r.rows[0];
  if (bk.status !== "pending") throw new Error("no_pendiente");

  await pool.query(
    `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'horas_propuestas','vendedor',$2)`,
    [bookingId, JSON.stringify({ horas: limpias, por: "el propio vendedor, desde su enlace" })]
  );

  const vehicle = bk.vehicle_title || bk.offer_id;
  const enlace = (h) => `${SITE_URL}/elegir-hora?id=${encodeURIComponent(bk.id)}&token=${encodeURIComponent(bk.token_buyer)}&h=${encodeURIComponent(h)}`;
  await sendEmail({
    to: bk.buyer_email,
    subject: `Te proponen otra hora para ver el coche — ${vehicle}`,
    html: plantilla({
      titulo: "Te proponen otra hora",
      cuerpo:
        parrafo(`A quien tiene el coche no le viene bien el ${esc(fmtDate(bk.starts_at))}. Te propone estas horas: elige la que te venga bien y queda confirmada.`) +
        limpias.map((h) => boton(`${fmtDate(h)} a las ${fmtTime(h)}`, enlace(h))).join("") +
        parrafo("Si ninguna te encaja, desde tu cita puedes pedir otra franja o cancelarla.", 14),
    }),
    movil: { titulo: "Te proponen otra hora para tu visita", cuerpo: `${vehicle} · elige una de las ${limpias.length}`, pantalla: "visitas" },
  }).catch((e) => console.error("[email] vendedor-propone:", e.message));

  return { booking: bk, horas: limpias };
}

// ── «Quiero comprarlo» ───────────────────────────────────────────────────────

const eurosDe = (n) => (Number(n) > 0 ? `${Math.round(Number(n)).toLocaleString("es-ES")} €` : "");

let columnasDeLaVentaListas = false;
async function preparaLaVenta(pool) {
  if (columnasDeLaVentaListas) return;
  await pool.query(COMPRA.ENSURE_COLUMNAS);
  columnasDeLaVentaListas = true;
}

/**
 * Lo que ve el comprador al abrir «Quiero comprarlo»: el coche, el precio y si
 * todavía puede decirlo. Con su testigo, sin sesión, como el resto de su cita.
 */
async function laCompraDeLaVisita(bookingId, token) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  await preparaLaVenta(pool).catch(() => {});
  const r = await pool.query(COMPRA.SQL_LA_VISITA, [bookingId, token]);
  const b = r.rows[0];
  if (!b) throw new Error("not_found");
  const yaEsSuya = b.venta_estado === "en_curso" && String(b.venta_booking_id) === String(b.id);
  return {
    coche: b.vehicle_title || "el coche",
    precio: Number(b.precio) || Number(b.precio_anuncio) || null,
    dia: b.starts_at,
    nombre: b.buyer_name || "",
    quiere_financiar: Boolean(b.quiere_financiar),
    ya_la_ha_pedido: yaEsSuya,
    // Si otro ya ha dicho que lo compra, este no puede: se le dice.
    no_puede: yaEsSuya ? ""
      : b.venta_estado === "en_curso" ? "Este coche ya tiene una compra en curso."
      : COMPRA.porQueNoPuedeComprar(b)
        || (b.encargo_id ? "" : "Este coche no se compra desde aquí. Escríbenos y te ayudamos."),
  };
}

/**
 * El comprador dice que se lo queda.
 *
 * En una transacción, con la visita bloqueada: la visita pasa a «compró», el
 * encargo abre la venta con sus datos y el anuncio se reserva. Si otro
 * comprador ya abrió la venta de ese coche, gana el primero.
 */
async function quiereComprarlo(bookingId, token, datos) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  const falta = COMPRA.faltaParaComprar(datos);
  if (falta) { const e = new Error("datos"); e.detalle = falta; throw e; }
  await preparaLaVenta(pool);

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const r = await cliente.query(`${COMPRA.SQL_LA_VISITA} FOR UPDATE OF b`, [bookingId, token]);
    const b = r.rows[0];
    const noPuede = COMPRA.porQueNoPuedeComprar(b);
    if (noPuede) { const e = new Error("no_puede"); e.detalle = noPuede; throw e; }
    if (!b.encargo_id) { const e = new Error("no_puede"); e.detalle = "Este coche no se compra desde aquí. Escríbenos y te ayudamos."; throw e; }

    /*
     * El candado que decide quién gana es el del encargo, no el de la visita.
     *
     * Arriba se bloquea la visita, y la visita es **distinta para cada
     * comprador**: dos que vieron el mismo coche pulsando «quiero comprarlo» a
     * la vez leían los dos `venta_estado` vacío, pasaban los dos, y el segundo
     * pisaba el DNI y el domicilio del primero mientras a los dos se les decía
     * «el coche queda reservado para ti». Aquí se bloquea el encargo y se
     * relee su estado ya con el candado puesto, que es lo único que serializa
     * a los dos. No vale hacerlo en la consulta de arriba: el encargo entra por
     * un LEFT JOIN y Postgres no deja bloquear el lado que puede ser nulo.
     */
    const elEncargo = await cliente.query(
      `SELECT to_jsonb(e)->>'venta_estado'     AS venta_estado,
              to_jsonb(e)->>'venta_booking_id' AS venta_booking_id
         FROM erp_encargos_venta e WHERE e.id = $1 FOR UPDATE`,
      [b.encargo_id]
    );
    b.venta_estado = elEncargo.rows[0]?.venta_estado || null;
    b.venta_booking_id = elEncargo.rows[0]?.venta_booking_id || null;

    if (b.venta_estado === "en_curso") {
      if (String(b.venta_booking_id) === String(b.id)) { await cliente.query("ROLLBACK"); return { ya: true, visita: b }; }
      const e = new Error("no_puede"); e.detalle = "Este coche ya tiene una compra en curso."; throw e;
    }

    const financia = datos.financia === true;
    await cliente.query(
      `UPDATE vehicle_visit_bookings
          SET resultado = 'compro', resultado_at = COALESCE(resultado_at, NOW()),
              quiere_financiar = $2, updated_at = NOW()
        WHERE id = $1`,
      [b.id, financia]
    );
    await cliente.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'resultado','cliente',$2)`,
      [b.id, JSON.stringify({ resultado: "compro", por: "quiero comprarlo, desde su correo", financia })]
    );
    await cliente.query(
      `UPDATE erp_encargos_venta
          SET venta_estado = 'en_curso', venta_booking_id = $2, venta_iniciada_at = NOW(),
              venta_anulada_at = NULL, venta_motivo_anulacion = NULL,
              comprador_nombre = $3, comprador_dni = $4, comprador_domicilio = $5,
              comprador_email = $6, comprador_telefono = $7, precio_venta = $8,
              venta_financia = $9, financiacion_estado = $10,
              financiacion_entidad = NULL, financiacion_importe = NULL, financiacion_decidida_at = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [
        b.encargo_id, String(b.id), b.buyer_name || "", COMPRA.elDocumento(datos.dni),
        COMPRA.elDomicilio(datos), b.buyer_email || "", b.buyer_phone || "",
        Number(b.precio) || Number(b.precio_anuncio) || null,
        financia, financia ? "en_estudio" : null,
      ]
    );
    // Reservado: fuera del escaparate. Si la venta se anula, el ERP lo vuelve a publicar.
    await cliente.query(
      `UPDATE moveadvisor_marketplace_vo_offers SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [b.offer_id]
    );

    /*
     * Y las visitas que quedaban a ese coche se anulan.
     *
     * Al vendedor se le dice «no lo enseñes a nadie más», pero al otro
     * comprador con hora para el miércoles no se le decía nada: el recordatorio
     * seguía saliendo y se presentaba a ver un coche ya reservado. Se anulan
     * aquí, con la venta, y se les escribe después de confirmar la
     * transacción.
     */
    const otras = await cliente.query(
      `UPDATE vehicle_visit_bookings
          SET status = 'cancelled', updated_at = NOW()
        WHERE offer_id = $1 AND id <> $2
          AND status IN ('pending','confirmed') AND ends_at > NOW()
        RETURNING id, offer_id, vehicle_title, starts_at, ends_at, buyer_email, buyer_name`,
      [b.offer_id, b.id]
    );
    for (const o of otras.rows) {
      await cliente.query(
        `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'cancelada','sistema',$2)`,
        [o.id, JSON.stringify({ por: "el coche se ha reservado para otro comprador" })]
      ).catch((e) => console.error("[compra] sin rastro de la visita anulada:", e.message));
    }

    await cliente.query("COMMIT");

    await correosDeLaCompra(b, financia).catch((e) => console.error("[compra] correos:", e.message));
    await avisaDeQueYaEstaReservado(otras.rows).catch((e) => console.error("[compra] aviso a las otras visitas:", e.message));
    return { ya: false, visita: b };
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

/** Al comprador, al vendedor y al equipo. Cada uno en su `catch`: la venta ya está abierta. */
/**
 * A quien tenia hora para ver un coche que acaba de quedar reservado.
 *
 * Se entera por nosotros y no plantandose alli. Se le manda a la ficha de otros
 * coches: la de este ya no esta en el escaparate.
 */
async function avisaDeQueYaEstaReservado(reservas = []) {
  await Promise.allSettled(
    reservas
      .filter((r) => r.buyer_email)
      .map((r) => {
        const coche = r.vehicle_title || "el coche";
        return sendEmail({
          to: r.buyer_email,
          subject: `Ese coche ya esta reservado — ${coche}`,
          html: plantilla({
            titulo: "Ese coche ya esta reservado",
            cuerpo:
              parrafo(`Hola${r.buyer_name ? ` ${esc(r.buyer_name)}` : ""}, lo sentimos: otra persona se ha quedado <strong>${esc(coche)}</strong>, asi que tu visita queda anulada.`) +
              datos([
                ["Vehiculo", esc(coche)],
                ["Tu visita era", `${esc(fmtDate(r.starts_at))}, ${esc(fmtTime(r.starts_at))}`],
              ]) +
              boton("Ver otros coches", `${SITE_URL}/marketplace-vo`) +
              parrafo("Si buscas algo parecido, escribenos y te avisamos en cuanto entre uno.", 14),
          }),
          movil: { titulo: "Tu visita queda anulada", cuerpo: `${coche} ya esta reservado.` },
        });
      })
  );
}

async function correosDeLaCompra(b, financia) {
  const coche = b.vehicle_title || "el coche";
  const precio = eurosDe(Number(b.precio) || Number(b.precio_anuncio));
  await Promise.allSettled([
    sendEmail({
      to: b.buyer_email,
      subject: `Nos ponemos con tu compra — ${coche}`,
      html: plantilla({
        titulo: "Nos ponemos con tu compra",
        cuerpo:
          parrafo(`Hola${b.buyer_name ? ` ${esc(b.buyer_name)}` : ""}, gracias. El coche queda <strong>reservado para ti</strong> y ya no se enseña a nadie más.`) +
          datos([["Vehículo", esc(coche)], ["Precio", esc(precio)]]) +
          (financia
            ? aviso("Primero, tu financiación", "La estudiamos con la entidad y te escribimos en cuanto conteste. Hasta entonces no tienes que pagar nada.")
            : parrafo("Te escribimos con los datos para el ingreso del precio. En cuanto esté, nos ponemos con el cambio de nombre.")),
      }),
      movil: { titulo: "Nos ponemos con tu compra", cuerpo: `${coche} queda reservado para ti.` },
    }),
    sendEmail({
      to: b.seller_email,
      subject: `Hay un comprador para tu coche — ${coche}`,
      html: plantilla({
        titulo: "Hay un comprador para tu coche",
        cuerpo:
          parrafo(`${b.buyer_name ? esc(b.buyer_name) : "Quien fue a verlo"} ha dicho que compra <strong>${esc(coche)}</strong>${precio ? ` por ${esc(precio)}` : ""}.`) +
          aviso("No lo enseñes a nadie más", "Lo hemos reservado y quitado de la venta. Si alguien te llama por él, dile que está reservado.") +
          parrafo(financia
            ? "El comprador va a financiarlo: primero lo estudia la entidad. Te contamos cada paso."
            : "El siguiente paso es el ingreso del precio. Te contamos cada paso.", 14),
      }),
      movil: { titulo: "Hay un comprador para tu coche", cuerpo: "Lo hemos reservado: no lo enseñes a nadie más." },
    }),
    sendEmail({
      to: opsEmail(),
      subject: `Venta en curso — ${coche}${financia ? " (financia)" : ""}`,
      html: plantilla({
        titulo: "Venta en curso",
        cuerpo:
          aviso(financia ? "Quiere financiar" : "Sin financiar",
            financia ? "La financiación va primero: hasta que la entidad conteste no se pide el ingreso." : "Lo siguiente es el ingreso del precio.") +
          datos([
            ["Vehículo", esc(coche)], ["Precio", esc(precio)],
            ["Comprador", esc(b.buyer_name)], ["Teléfono", esc(b.buyer_phone)], ["Correo", esc(b.buyer_email)],
          ]) +
          boton("Abrir IDCars en el ERP", `${MARCA.urlErp}/idcars`),
        pie: "Aviso interno del equipo.",
      }),
    }),
  ]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedProfessionalSlots(offerId) {
  const pool = getPool();
  if (!pool) return [];
  const now  = new Date();
  const rows = [];
  const end  = new Date(now);
  end.setDate(end.getDate() + 84); // 12 semanas (~3 meses)

  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  while (d <= end) {
    const dow = d.getDay(); // 0=Dom, 1=Lun … 5=Vie, 6=Sáb
    if (dow >= 1 && dow <= 5) {
      for (let h = 9; h < 18; h++) {
        const s = new Date(d); s.setHours(h, 0, 0, 0);
        const e = new Date(d); e.setHours(h + 1, 0, 0, 0);
        if (s > now) rows.push([s.toISOString(), e.toISOString()]);
      }
    }
    d.setDate(d.getDate() + 1);
  }

  if (!rows.length) return [];

  const startsArr = rows.map((r) => r[0]);
  const endsArr   = rows.map((r) => r[1]);
  const ins = await pool.query(
    `INSERT INTO vehicle_visit_availability (offer_id, starts_at, ends_at, source)
     SELECT $1, s, e, 'auto'
     FROM unnest($2::timestamptz[], $3::timestamptz[]) AS t(s, e)
     RETURNING id, offer_id, starts_at, ends_at, status, source`,
    [offerId, startsArr, endsArr]
  );
  return ins.rows;
}

async function getSlots(offerId) {
  const pool = getPool();
  if (!pool || !offerId) return [];
  const now = new Date().toISOString();
  // Las que acaban después de ahora, no las que empiezan: de una franja de
  // 10:00 a 14:00 a las 11:30 quedan las 12:00 y las 13:00.
  const r = await pool.query(
    `SELECT id, offer_id, starts_at, ends_at, status, source
     FROM vehicle_visit_availability
     WHERE offer_id = $1
       AND status = 'available'
       AND ends_at > $2
     ORDER BY starts_at ASC
     LIMIT 60`,
    [offerId, now]
  );
  // Para ofertas profesionales (no idcar-) sin slots: generar L-V 9-18h automáticamente
  if (r.rows.length === 0 && !offerId.startsWith('idcar-')) {
    return seedProfessionalSlots(offerId);
  }
  /*
   * Las franjas de varias horas se ofrecen hora a hora, sin las ya reservadas.
   * Una visita es a una hora: reservar la franja entera dejaba la cita «de
   * 10:00 a 14:00» y nadie más podía ir esa mañana.
   */
  /*
   * Un coche reservado no ofrece horas.
   *
   * Al abrirse una compra se le pone `is_active = FALSE` y sale del escaparate,
   * pero esto no lo miraba: quien tuviera la ficha abierta —o llamara a la API
   * de frente— seguia pudiendo pedir visita a un coche ya vendido.
   */
  const vendido = await pool.query(
    `SELECT 1 FROM moveadvisor_marketplace_vo_offers
      WHERE id = $1 AND is_active = FALSE LIMIT 1`,
    [offerId]
  );
  if (vendido.rows.length) return [];

  const reservas = await reservasVivas(pool, offerId);
  return r.rows
    .flatMap((franja) => HUECOS.loQueSeOfrece(franja, reservas))
    .filter((h) => new Date(h.starts_at).getTime() > Date.now());
}

/** Las visitas pedidas o confirmadas de un anuncio, para saber qué horas están cogidas. */
async function reservasVivas(cliente, offerId) {
  const r = await cliente.query(
    `SELECT starts_at, ends_at, status FROM vehicle_visit_bookings
      WHERE offer_id = $1 AND status IN ('pending','confirmed') AND ends_at > NOW()`,
    [offerId]
  );
  return r.rows;
}

/**
 * El hueco que se reserva: la franja, y la hora de dentro si es de varias.
 *
 * Con la franja bloqueada (`FOR UPDATE`): dos personas pidiendo las 10:00 a
 * la vez no pueden coger las dos la misma hora. Lanza `slot_unavailable` si la
 * franja no está libre o la hora ya no vale.
 */
async function elHuecoQueSeReserva(cliente, slotId, offerId) {
  const { franjaId, hora } = HUECOS.leeElHueco(slotId);
  const slotRes = await cliente.query(
    `SELECT * FROM vehicle_visit_availability
     WHERE id = $1 AND offer_id = $2 AND status = 'available'
     FOR UPDATE`,
    [franjaId, offerId]
  );
  if (!slotRes.rows.length) throw new Error("slot_unavailable");
  const franja = slotRes.rows[0];
  if (!HUECOS.esDeVariasHoras(franja)) {
    return { franja, starts_at: franja.starts_at, ends_at: franja.ends_at, ocupaLaFranja: true };
  }
  const inicio = HUECOS.laHoraQueSeReserva(franja, hora, await reservasVivas(cliente, offerId));
  if (!inicio) throw new Error("slot_unavailable");
  return {
    franja,
    starts_at: inicio,
    ends_at: new Date(new Date(inicio).getTime() + HUECOS.DURACION_MS).toISOString(),
    // La franja sigue libre: quedan sus otras horas.
    ocupaLaFranja: false,
  };
}

async function addSlot({ offerId, startsAt, endsAt, source }) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  // Prevent overlapping slots for same offer
  const overlap = await pool.query(
    `SELECT id FROM vehicle_visit_availability
     WHERE offer_id = $1
       AND status != 'blocked'
       AND tstzrange(starts_at, ends_at) && tstzrange($2::timestamptz, $3::timestamptz)
     LIMIT 1`,
    [offerId, startsAt, endsAt]
  );
  if (overlap.rows.length) throw new Error("overlap");
  const r = await pool.query(
    `INSERT INTO vehicle_visit_availability (offer_id, starts_at, ends_at, source)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [offerId, startsAt, endsAt, source || "marketplace"]
  );
  return r.rows[0];
}

/**
 * Quitar un hueco de los que se ofrecen.
 *
 * Lo que llega no es siempre una fila: desde que una franja se abre hora a
 * hora, el identificador puede ser `<franja>@<hora>`, y entonces lo que se
 * quita es **esa hora**, no la mañana entera. El `DELETE ... WHERE id = $1` de
 * antes recibia ese texto contra una columna UUID y contestaba un 500; la
 * pantalla, que no miraba la respuesta, borraba la fila de su lista y la franja
 * seguia ahi al recargar.
 *
 * Y la franja no se borra si tiene visitas dentro: las visitas apuntan a su
 * fila (`availability_id`, con `ON DELETE CASCADE`), asi que borrarla se
 * llevaria por delante citas confirmadas sin decir nada. Para quitar una hora
 * de una franja con visitas, la fila se **recorta**: se queda con el trozo que
 * las contiene y el otro se inserta aparte.
 *
 * Lanza `hora_reservada` si esa hora ya la tiene alguien y `tiene_visitas` si
 * se pide quitar una franja entera que las tiene.
 */
async function deleteSlot(slotId, offerId) {
  const pool = getPool();
  if (!pool) return;
  const { franjaId, hora } = HUECOS.leeElHueco(slotId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `SELECT * FROM vehicle_visit_availability
       WHERE id = $1 AND offer_id = $2 AND status = 'available'
       FOR UPDATE`,
      [franjaId, offerId]
    );
    // Ni existe ni esta libre: no hay nada que quitar, y decirlo como error
    // solo asustaria a quien toca dos veces la papelera.
    if (!r.rows.length) { await client.query("ROLLBACK"); return; }
    const franja = r.rows[0];
    const vivas = await reservasVivas(client, offerId);

    if (hora && HUECOS.sePisa(hora, vivas)) throw new Error("hora_reservada");

    const trozos = hora ? HUECOS.loQueQuedaAlQuitar(franja, hora) : [];
    const visitasDentro = vivas.filter((v) => HUECOS.seSolapan(franja, v));

    if (!trozos.length) {
      if (visitasDentro.length) throw new Error("tiene_visitas");
      await client.query(
        `DELETE FROM vehicle_visit_availability WHERE id = $1`,
        [franjaId]
      );
    } else {
      // La fila se queda con el trozo donde estan las visitas, si hay: asi su
      // `availability_id` sigue apuntando a un rato que las contiene.
      const conVisitas = trozos.find((t) => visitasDentro.some((v) => HUECOS.seSolapan(t, v)));
      const seQueda = conVisitas || trozos[0];
      await client.query(
        `UPDATE vehicle_visit_availability SET starts_at = $2, ends_at = $3 WHERE id = $1`,
        [franjaId, seQueda.starts_at, seQueda.ends_at]
      );
      for (const t of trozos.filter((x) => x !== seQueda)) {
        await client.query(
          `INSERT INTO vehicle_visit_availability (offer_id, starts_at, ends_at, status, source)
           VALUES ($1, $2, $3, 'available', $4)`,
          [offerId, t.starts_at, t.ends_at, franja.source || "marketplace"]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// `sellerEmail` ya no se recibe: lo resuelve el servidor (ver abajo).
async function bookSlot({ slotId, offerId, vehicleTitle, buyerEmail, buyerName, buyerPhone, notes, source, quiereFinanciar, utm }) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");

  // Atomic: check + mark booked in a transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const hueco = await elHuecoQueSeReserva(client, slotId, offerId);
    const slot = hueco.franja;

    // El correo del vendedor sale de la oferta, no de lo que mande el
    // navegador: es a donde va el aviso, y dejarlo llegar de fuera permitía
    // que cualquiera se hiciera mandar la visita de otro. Además la API
    // pública ya no devuelve ese correo, así que el navegador no lo tiene.
    const ofertaRes = await client.query(
      `SELECT seller FROM moveadvisor_marketplace_vo_offers WHERE id = $1`,
      [offerId]
    );
    const correoVendedor = String(ofertaRes.rows[0]?.seller || "").trim().toLowerCase();
    const sellerEmail = correoVendedor.includes("@") ? correoVendedor : null;

    if (hueco.ocupaLaFranja) {
      await client.query(
        `UPDATE vehicle_visit_availability SET status = 'booked' WHERE id = $1`,
        [slot.id]
      );
    }

    // Una visita siempre nace pendiente. Siempre.
    //
    // Antes dependía de quién hubiera publicado el hueco: si lo puso una
    // persona desde el ERP se daba por acordado. Pero que una hora esté
    // publicada no significa que el concesionario haya dicho que sí a *esta*
    // visita, con este coche y esta persona. Alguien tiene que llamarle, y hasta
    // que lo haga al cliente no se le promete nada ni se le manda el .ics.
    //
    // De dónde salió el hueco sigue guardándose, y la Agenda del ERP lo enseña:
    // una hora que se inventó el sistema no es lo mismo que una que publicó
    // alguien, aunque las dos haya que aprobarlas.
    const estado = "pending";

    const tokenBuyer  = crypto.randomUUID();
    const tokenSeller = crypto.randomUUID();
    const bookRes = await client.query(
      `INSERT INTO vehicle_visit_bookings
         (availability_id, offer_id, vehicle_title, starts_at, ends_at,
          buyer_email, buyer_name, buyer_phone, seller_email,
          status, token_buyer, token_seller, notes, source, quiere_financiar,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$14,$10,$11,$12,$13,$15,
               $16,$17,$18,$19,$20)
       RETURNING *`,
      [
        slot.id, offerId, vehicleTitle || "", hueco.starts_at, hueco.ends_at,
        buyerEmail, buyerName || "", buyerPhone || "", sellerEmail || null,
        tokenBuyer, tokenSeller, notes || "", source || "marketplace", estado,
        // Lo que contesto a «¿te interesaria financiarlo?». Viaja hasta aqui
        // porque es en la reserva donde lo mira el ERP: en la solicitud se
        // quedaba guardado y no lo leia nadie.
        quiereFinanciar === true,
        /*
         * Y de donde vino, en el orden de `SV.UTM`.
         *
         * Es la tabla que mira el ERP. Sin esto, el comprador que llega de
         * coches.net, pide cita y no deja lead aparece como si hubiera salido
         * de la nada — y ese es justo el camino del que viene del portal.
         */
        ...SV.UTM.map((c) => (utm ?? {})[c] ?? ""),
      ]
    );

    // El primer paso del rastro. Va dentro de la transaccion: una reserva sin
    // su «solicitada» seria una cita que aparece de la nada.
    await client.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'solicitada','cliente',$2)`,
      [bookRes.rows[0].id, JSON.stringify({ origen: source || "marketplace", hueco: slot.source })]
    ).catch((e) => console.error("[visitas] sin rastro de la solicitud:", e.message));

    await client.query("COMMIT");
    const bk = bookRes.rows[0];
    /*
     * Se espera a que salga el correo, y no es un detalle.
     *
     * Aquí ponía «fire emails async (don't block response)»: se lanzaba el envío
     * y se contestaba sin esperarlo. En un servidor normal funciona. En Vercel
     * no: en cuanto la función responde se congela, y la llamada a Resend se
     * queda cortada a medias. Ni el comprador recibía «hemos recibido tu
     * solicitud» ni el vendedor el aviso — sin un solo error en ninguna parte,
     * porque el `.catch(() => {})` se tragaba hasta eso.
     *
     * Pasaba igual al cancelar, al cambiar de hora y al elegir una de las
     * propuestas. Las cuatro esperan ahora.
     *
     * La reserva ya está guardada en la base antes de esto, así que un correo
     * que falle se apunta y no la deshace: el `.catch` se queda, lo que cambia
     * es el `await`. Cuesta medio segundo más en contestar.
     */
    await sendBookingEmails(bk).catch((e) => console.error("[visitas] correo de la solicitud:", e.message));
    return bk;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function cancelBooking(bookingId, token) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");
  // Con el estado de antes: una visita que seguía pendiente no se la habíamos
  // contado al vendedor, y su cancelación tampoco hay que contársela.
  const antes = await pool.query(
    `SELECT status FROM vehicle_visit_bookings WHERE id = $1`,
    [bookingId]
  );
  const r = await pool.query(
    `UPDATE vehicle_visit_bookings
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND (token_buyer = $2 OR token_seller = $2)
       AND status != 'cancelled'
     RETURNING *`,
    [bookingId, token]
  );
  if (!r.rows.length) throw new Error("not_found");
  const booking = {
    ...r.rows[0],
    estado_anterior: antes.rows[0]?.status || "",
    // Quién la cancela cambia lo que se dice y a quién.
    la_cancela: r.rows[0].token_seller === token ? "vendedor" : "comprador",
  };
  // Free the slot
  await pool.query(
    `UPDATE vehicle_visit_availability SET status = 'available'
     WHERE id = $1`,
    [booking.availability_id]
  );
  // Al rastro, como todo lo demas. Una visita cancelada desaparece de la
  // Agenda —alli solo se listan las vivas—, y sin esta linea nadie puede saber
  // despues si la quito el cliente, cuando, ni si hubo que llamarle.
  await pool.query(
    booking.la_cancela === "vendedor"
      ? `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'cancelada','vendedor',$2)`
      : `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'cancelada','cliente',$2)`,
    [bookingId, JSON.stringify({ por: booking.la_cancela === "vendedor" ? "el propio vendedor, desde su enlace" : "el propio cliente, desde su cita" })]
  ).catch((e) => console.error("[visitas] sin rastro de la cancelacion:", e.message));
  await sendCancelEmails(booking).catch((e) => console.error("[visitas] correo de la cancelacion:", e.message));
  return booking;
}

async function rescheduleBooking(bookingId, token, newSlotId) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify booking ownership
    // Vale para una pendiente y para una confirmada.
    //
    // Pedia 'confirmed', y desde que toda visita nace pendiente eso dejaba al
    // cliente sin poder cambiar la hora de lo que acababa de pedir: el boton
    // salia en su cita y contestaba «cita no encontrada».
    /*
     * Solo con el testigo del comprador.
     *
     * Aceptaba tambien el del vendedor, y mover la hora no es cosa suya: el
     * vendedor confirma, propone horas o rechaza, y para eso tiene sus propias
     * rutas. Con el testigo de su correo podia cambiarle la hora al comprador,
     * el rastro quedaba como «movida por el propio cliente» y al comprador le
     * llegaba «hemos cambiado tu visita a la franja que has elegido» para una
     * franja que no habia elegido.
     */
    const bRes = await client.query(
      `SELECT * FROM vehicle_visit_bookings
       WHERE id = $1 AND token_buyer = $2
         AND status != 'cancelled'
       FOR UPDATE`,
      [bookingId, token]
    );
    if (!bRes.rows.length) throw new Error("not_found");
    const booking = bRes.rows[0];

    // Free old slot. Antes que mirar la nueva: si se mueve a otra hora de la
    // misma franja, la suya no puede contar como ocupada.
    await client.query(
      `UPDATE vehicle_visit_availability SET status = 'available' WHERE id = $1`,
      [booking.availability_id]
    );
    await client.query(
      `UPDATE vehicle_visit_bookings SET status = 'cancelled' WHERE id = $1`,
      [bookingId]
    );
    // Check new slot availability
    const hueco = await elHuecoQueSeReserva(client, newSlotId, booking.offer_id);
    const newSlot = { ...hueco.franja, starts_at: hueco.starts_at, ends_at: hueco.ends_at };
    // Book new slot
    if (hueco.ocupaLaFranja) {
      await client.query(
        `UPDATE vehicle_visit_availability SET status = 'booked' WHERE id = $1`,
        [hueco.franja.id]
      );
    }
    // Vuelve a quedar pendiente, no en un estado propio.
    //
    // Estaba en 'rescheduled', y ese estado no lo miraba nadie: la Agenda pide
    // 'confirmed' y 'pending', los recordatorios piden 'confirmed' y el panel del
    // cliente no sabia traducirlo. Un cliente que movia su cita desaparecia del
    // radar y nadie volvia a saber de ella.
    //
    // Y ademas es lo correcto: la hora nueva la ha elegido el, sobre huecos que
    // tampoco ha acordado el concesionario. Toda visita se aprueba, tambien
    // esta.
    //
    // Se limpian las marcas de aviso: la cita es otra, y si no, nadie recibiria
    // el recordatorio de la vispera de la fecha nueva.
    const updated = await client.query(
      `UPDATE vehicle_visit_bookings
       SET availability_id = $1, starts_at = $2, ends_at = $3,
           status = 'pending', updated_at = NOW(),
           reminder_sent_at = NULL, reminder_day_of_sent_at = NULL, followup_sent_at = NULL
       WHERE id = $4
       RETURNING *`,
      [hueco.franja.id, newSlot.starts_at, newSlot.ends_at, bookingId]
    );

    await client.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'movida','cliente',$2)`,
      [bookingId, JSON.stringify({ a: newSlot.starts_at, por: 'el propio cliente' })]
    ).catch((e) => console.error("[visitas] sin rastro del cambio de hora:", e.message));

    await client.query("COMMIT");
    const bk = updated.rows[0];
    await sendBookingEmails(bk, { isReschedule: true }).catch((e) => console.error("[visitas] correo del cambio de hora:", e.message));
    return bk;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Si ese anuncio es del coche de quien pregunta. */
async function esSuCoche(offerId, email) {
  const pool = getPool();
  if (!pool) return false;
  const id = String(offerId || "");
  if (!id.startsWith("idcar-")) return false;
  const r = await pool.query(
    `SELECT 1 FROM moveadvisor_user_vehicles WHERE id = $1 AND lower(user_email) = lower($2) LIMIT 1`,
    [id.slice("idcar-".length), email]
  );
  return r.rows.length > 0;
}

async function getBookingsByOffer(offerId) {
  const pool = getPool();
  if (!pool) return [];
  const r = await pool.query(
    `SELECT b.*, a.starts_at AS slot_starts, a.ends_at AS slot_ends
     FROM vehicle_visit_bookings b
     -- LEFT: una visita puede quedarse sin hueco si alguien lo borra.
     LEFT JOIN vehicle_visit_availability a ON a.id = b.availability_id
     WHERE b.offer_id = $1
       AND b.status != 'cancelled'
     ORDER BY b.starts_at ASC`,
    [offerId]
  );
  return r.rows;
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function visitAvailabilityHandler(req, res) {
  const method  = (req.method || "GET").toUpperCase();
  const body    = jsonBody(req);
  const route   = normalize(req.query?.route) || normalize(body?.route);

  // ── GET /api/visit-availability?offerId=X  → available slots for buyer
  if (method === "GET" && !route) {
    const offerId = normalize(req.query?.offerId);
    if (!offerId) return res.status(400).json({ ok: false, error: "offerId required" });
    try {
      const slots = await getSlots(offerId);
      return res.status(200).json({ ok: true, slots });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=add_slot  (seller adds availability)
  if (method === "POST" && route === "add_slot") {
    const { offerId, startsAt, endsAt, source } = body;
    if (!offerId || !startsAt || !endsAt) return res.status(400).json({ ok: false, error: "offerId, startsAt, endsAt required" });
    try {
      const slot = await addSlot({ offerId, startsAt, endsAt, source });
      return res.status(200).json({ ok: true, slot });
    } catch (e) {
      if (e.message === "overlap") return res.status(409).json({ ok: false, error: "El horario se solapa con otro existente" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=add_bulk_slots  (seller adds recurring slots)
  if (method === "POST" && route === "add_bulk_slots") {
    const { offerId, slots: incoming, source } = body;
    if (!offerId || !Array.isArray(incoming) || !incoming.length) {
      return res.status(400).json({ ok: false, error: "offerId y slots[] requeridos" });
    }
    const pool = getPool();
    if (!pool) return res.status(500).json({ ok: false, error: "No DB" });
    try {
      const inserted = [];
      const skipped  = [];
      for (const s of incoming) {
        const { startsAt, endsAt } = s || {};
        if (!startsAt || !endsAt) continue;
        const overlap = await pool.query(
          `SELECT id FROM vehicle_visit_availability
           WHERE offer_id = $1 AND status != 'blocked'
             AND starts_at < $3::timestamptz AND ends_at > $2::timestamptz`,
          [offerId, startsAt, endsAt]
        );
        if (overlap.rows.length) { skipped.push(s); continue; }
        const r = await pool.query(
          `INSERT INTO vehicle_visit_availability (offer_id, starts_at, ends_at, status, source)
           VALUES ($1, $2, $3, 'available', $4) RETURNING *`,
          [offerId, startsAt, endsAt, source || "marketplace"]
        );
        inserted.push(r.rows[0]);
      }
      return res.status(200).json({ ok: true, inserted: inserted.length, skipped: skipped.length, slots: inserted });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── DELETE /api/visit-availability?route=delete_slot&slotId=X&offerId=Y
  if (method === "DELETE" && route === "delete_slot") {
    const slotId  = normalize(req.query?.slotId  || body.slotId);
    const offerId = normalize(req.query?.offerId || body.offerId);
    if (!slotId || !offerId) return res.status(400).json({ ok: false, error: "slotId and offerId required" });
    try {
      await deleteSlot(slotId, offerId);
      return res.status(200).json({ ok: true });
    } catch (e) {
      // Lo que no se puede quitar no es un fallo del servidor, y la pantalla
      // tiene que poder decir por que.
      const dicho = {
        hora_reservada: "Esa hora ya la tiene alguien: anula su visita primero.",
        tiene_visitas: "Esa franja tiene visitas dentro: anulalas primero.",
      }[e.message];
      if (dicho) return res.status(409).json({ ok: false, error: dicho });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=book  (buyer books a slot)
  if (method === "POST" && route === "book") {
    // sellerEmail ya no se acepta desde fuera: lo resuelve bookSlot.
    const { slotId, offerId, vehicleTitle, buyerName, buyerPhone, notes, source } = body;

    // Para pedir visita hay que haber entrado, y el correo sale de la sesion.
    //
    // Antes se cogia del cuerpo sin comprobar nada: cualquiera podia reservar a
    // nombre de otro —y hacer que le llegaran los correos de su cita— o llenar
    // el calendario de un concesionario desde una terminal. Una cita compromete
    // a una persona a estar en un sitio; eso no puede pedirlo un desconocido.
    // El campo del cuerpo aquí se llama `buyerEmail`, no `email`: se le pasa con
    // el nombre que espera para que fuera de producción siga pudiéndose probar
    // con curl. En producción da igual, porque manda la sesión.
    const { email: buyerEmail } = await identidadDeLaPeticion(req, { cuerpo: { email: body.buyerEmail } });
    if (!buyerEmail) {
      /*
       * Sin sesión no se reserva aquí: se pide, y se confirma desde el correo.
       *
       * Este 409 no es un fallo, es el camino de al lado. Quien no ha entrado
       * tiene que usar `route=solicitar`, que manda un enlace y no aparta el
       * hueco hasta que se pulsa. La sesión probaba que el correo era suyo;
       * ese clic prueba lo mismo.
       */
      return res.status(409).json({
        ok: false, error: "pide_por_correo",
        detalle: "Sin sesión, la visita se pide con route=solicitar y se confirma desde el correo.",
      });
    }
    if (!slotId || !offerId) return res.status(400).json({ ok: false, error: "slotId, offerId required" });
    try {
      const booking = await bookSlot({ slotId, offerId, vehicleTitle, buyerEmail, buyerName, buyerPhone, notes, source, quiereFinanciar: body.quiereFinanciar === true, utm: SV.laUtm(body) });
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "slot_unavailable") return res.status(409).json({ ok: false, error: "Este horario ya no está disponible" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=solicitar  (sin cuenta)
  //
  // Se guarda la solicitud y se le manda un enlace. No se aparta el hueco: gana
  // quien confirma primero, y así pedir no cuesta nada y no consigue nada.
  if (method === "POST" && route === "solicitar") {
    const falta = SV.faltaParaPedirla({
      slotId: body.slotId, offerId: body.offerId,
      buyerEmail: body.buyerEmail, buyerName: body.buyerName, buyerPhone: body.buyerPhone,
    });
    if (falta) return res.status(400).json({ ok: false, error: falta });

    const pool = getPool();
    if (!pool) return res.status(500).json({ ok: false, error: "No DB" });
    try {
      await preparaSolicitudes(pool);

      const cuantas = await pool.query(SV.SQL_CUANTAS_SIN_CONFIRMAR, [body.buyerEmail]);
      if ((cuantas.rows[0]?.n ?? 0) >= SV.SIN_CONFIRMAR_A_LA_VEZ) {
        return res.status(429).json({
          ok: false,
          error: "Tienes varias visitas sin confirmar. Mira tu correo y confirma esas antes de pedir otra.",
        });
      }

      // Que el hueco exista y siga libre. No se aparta, pero enseñarle un
      // enlace para una hora que ya no está es hacerle perder el viaje.
      const { franjaId, hora } = HUECOS.leeElHueco(body.slotId);
      const laFranja = await pool.query(
        `SELECT id, starts_at, ends_at FROM vehicle_visit_availability
          WHERE id = $1 AND offer_id = $2 AND status = 'available'`,
        [franjaId, body.offerId]
      );
      // Y la hora de dentro, si es una franja: la que eligió, libre.
      let hueco = laFranja;
      if (laFranja.rows.length && HUECOS.esDeVariasHoras(laFranja.rows[0])) {
        const inicio = HUECOS.laHoraQueSeReserva(laFranja.rows[0], hora, await reservasVivas(pool, body.offerId));
        hueco = inicio
          ? { rows: [{ starts_at: inicio, ends_at: new Date(new Date(inicio).getTime() + HUECOS.DURACION_MS).toISOString() }] }
          : { rows: [] };
      }
      if (!hueco.rows.length) {
        return res.status(409).json({ ok: false, error: "Este horario ya no está disponible" });
      }

      const token = SV.nuevoToken();
      const utm = SV.laUtm(body);
      await pool.query(SV.SQL_GUARDA, [
        crypto.randomUUID(), normalize(body.offerId), normalize(body.slotId),
        normalize(body.buyerEmail), normalize(body.buyerName), normalize(body.buyerPhone),
        normalize(body.notes), normalize(body.source) || "marketplace",
        body.quiereFinanciar === true, token, String(SV.HORAS_DE_VALIDEZ),
        /*
         * De donde vino, en el orden de `SV.UTM`.
         *
         * Se guarda ya en la solicitud y no solo al confirmar: entre pedir la
         * visita y pulsar el enlace del correo pasa hasta un dia, y para
         * entonces el navegador que traia la UTM puede ser otro -o el mismo con
         * la sesion vencida-. Aqui es donde el dato existe.
         */
        ...SV.UTM.map((c) => utm[c]),
      ]);

      const { subject, html } = SV.elCorreoDeConfirmacion({
        vehicleTitle: body.vehicleTitle,
        dia: fmtDate(hueco.rows[0].starts_at),
        franja: fmtFranja(hueco.rows[0].starts_at, hueco.rows[0].ends_at),
        enlace: SV.elEnlace(SITE_URL, token),
      });
      await sendEmail({ to: normalize(body.buyerEmail), subject, html });

      return res.status(200).json({ ok: true, pendienteDeConfirmar: true });
    } catch (e) {
      console.error("[visitas] no se ha podido pedir la visita:", e.message);
      return res.status(500).json({ ok: false, error: "No se ha podido pedir la visita" });
    }
  }

  // ── POST /api/visit-availability  route=confirmar  (el enlace del correo)
  if (method === "POST" && route === "confirmar") {
    const token = normalize(req.query?.t || body.token);
    if (!token) return res.status(400).json({ ok: false, error: "Falta el enlace" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ ok: false, error: "No DB" });
    try {
      await preparaSolicitudes(pool);
      const r = await pool.query(SV.SQL_POR_TOKEN, [token]);
      const s = r.rows[0];
      if (!s) {
        return res.status(410).json({
          ok: false, error: "Este enlace ya no vale. Pide la visita otra vez y te mandamos uno nuevo.",
        });
      }

      /*
       * Ahora sí se reserva, con el correo que ya está probado.
       *
       * Puede fallar porque otro haya confirmado antes ese mismo hueco: es lo
       * que se decidió al no apartarlo. Se le dice y se le manda a elegir otro.
       */
      let booking;
      try {
        booking = await bookSlot({
          slotId: s.availability_id, offerId: s.offer_id, vehicleTitle: body.vehicleTitle,
          buyerEmail: s.buyer_email, buyerName: s.buyer_name, buyerPhone: s.buyer_phone,
          notes: s.notes, source: s.source,
          // Lo que contesto al pedir la visita. Sin pasarlo aqui se queda en la
          // solicitud, que es la tabla que en el ERP no mira nadie.
          quiereFinanciar: s.quiere_financiar === true,
          /*
           * La que se guardó al pedirla, no la del navegador que pulsa el
           * enlace.
           *
           * Entre pedir la visita y confirmarla pasa hasta un día: puede ser
           * otro dispositivo, o el mismo con la sesión ya vencida. Leerla ahí
           * daría «directo» justo para el que vino del portal, que es el único
           * al que importa medir.
           */
          utm: SV.laUtm(s),
        });
      } catch (e) {
        if (e.message === "slot_unavailable") {
          return res.status(409).json({
            ok: false, error: "Se te ha adelantado alguien con esa hora. Elige otra y te la guardamos.",
            offerId: s.offer_id,
          });
        }
        throw e;
      }

      // Marcada después de reservar: si se marcara antes y la reserva fallara,
      // el enlace quedaría gastado sin haber conseguido nada.
      await pool.query(SV.SQL_MARCA_CONFIRMADA, [s.id, String(booking.id)]).catch(() => {});
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      console.error("[visitas] no se ha podido confirmar la visita:", e.message);
      return res.status(500).json({ ok: false, error: "No se ha podido confirmar la visita" });
    }
  }

  // ── POST /api/visit-availability  route=cancel  (buyer or seller cancels)
  if (method === "POST" && route === "cancel") {
    const { bookingId, token } = body;
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const booking = await cancelBooking(bookingId, token);
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "not_found") return res.status(404).json({ ok: false, error: "Cita no encontrada o ya cancelada" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=reschedule  (change to new slot)
  if (method === "POST" && route === "reschedule") {
    const { bookingId, token, newSlotId } = body;
    if (!bookingId || !token || !newSlotId) return res.status(400).json({ ok: false, error: "bookingId, token and newSlotId required" });
    try {
      const booking = await rescheduleBooking(bookingId, token, newSlotId);
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "not_found") return res.status(404).json({ ok: false, error: "Cita no encontrada" });
      if (e.message === "slot_unavailable") return res.status(409).json({ ok: false, error: "El nuevo horario ya no está disponible" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── GET /api/visit-availability?route=propuesta&bookingId=X&token=Y
  //    Lo que abre el enlace del correo: la cita y las horas que se le proponen.
  if (method === "GET" && route === "propuesta") {
    const bookingId = normalize(req.query?.bookingId);
    const token     = normalize(req.query?.token);
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const datosDeLaPropuesta = await propuestaDeVisita(bookingId, token);
      return res.status(200).json({ ok: true, ...datosDeLaPropuesta });
    } catch (e) {
      if (e.message === "not_found") return res.status(404).json({ ok: false, error: "Cita no encontrada" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=elegir_hora
  //    El cliente acepta una de las horas propuestas. Queda confirmada.
  //
  //    Es POST y no un enlace directo a proposito: los lectores de correo abren
  //    solos los enlaces para comprobarlos, y una cita no puede quedar
  //    confirmada porque un antivirus haya mirado el mensaje.
  if (method === "POST" && route === "elegir_hora") {
    const { bookingId, token, startsAt } = body;
    if (!bookingId || !token || !startsAt) return res.status(400).json({ ok: false, error: "bookingId, token and startsAt required" });
    try {
      const booking = await aceptaHoraPropuesta(bookingId, token, startsAt);
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "not_found")        return res.status(404).json({ ok: false, error: "Cita no encontrada" });
      if (e.message === "ya_confirmada")    return res.status(409).json({ ok: false, error: "Esta visita ya está confirmada" });
      if (e.message === "hora_no_propuesta") return res.status(409).json({ ok: false, error: "Esa hora ya no es una de las que te proponemos" });
      if (e.message === "hora_ocupada")      return res.status(409).json({ ok: false, error: "Alguien acaba de coger esa hora. Elige otra." });
      if (e.message === "hora_pasada")       return res.status(409).json({ ok: false, error: "Esa hora ya ha pasado. Escríbenos y te damos otra." });
      if (e.message === "hora_invalida")    return res.status(400).json({ ok: false, error: "La hora no se entiende" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST /api/visit-availability  route=como_fue
  //    El cliente dice como acabo su visita, desde el correo de seguimiento.
  //
  //    POST y no un enlace directo, por lo mismo que elegir_hora: los lectores
  //    de correo abren solos los enlaces, y una visita no puede quedar cerrada
  //    como «no fue» porque un antivirus haya mirado el mensaje.
  if (method === "POST" && route === "como_fue") {
    const { bookingId, token, resultado } = body;
    if (!bookingId || !token || !resultado) return res.status(400).json({ ok: false, error: "bookingId, token and resultado required" });
    try {
      const booking = await diceComoAcabo(bookingId, token, resultado);
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "not_found")          return res.status(404).json({ ok: false, error: "Cita no encontrada" });
      if (e.message === "resultado_invalido") return res.status(400).json({ ok: false, error: "Esa respuesta no vale" });
      if (e.message === "sin_confirmar")      return res.status(409).json({ ok: false, error: "Esta visita no llegó a confirmarse" });
      if (e.message === "todavia_no")         return res.status(409).json({ ok: false, error: "Tu visita todavía no ha sido" });
      if (e.message === "fuera_de_plazo")     return res.status(409).json({ ok: false, error: "Ha pasado mucho tiempo. Escríbenos y lo vemos" });
      if (e.message === "ya_cerrada")         return res.status(409).json({ ok: false, error: "Ya lo teníamos apuntado" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── GET route=compra: lo que ve el comprador en «Quiero comprarlo»
  if (method === "GET" && route === "compra") {
    const bookingId = normalize(req.query?.bookingId);
    const token     = normalize(req.query?.token);
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      return res.status(200).json({ ok: true, ...(await laCompraDeLaVisita(bookingId, token)) });
    } catch (e) {
      if (e.message === "not_found") return res.status(404).json({ ok: false, error: "No encontramos esa visita" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST route=quiero_comprarlo: el comprador se lo queda
  //    POST, no un enlace: un lector de correo que abre el enlace no puede
  //    comprar un coche.
  if (method === "POST" && route === "quiero_comprarlo") {
    const { bookingId, token } = body;
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const r = await quiereComprarlo(bookingId, token, {
        dni: body.dni, direccion: body.direccion, codigoPostal: body.codigoPostal,
        ciudad: body.ciudad, financia: body.financia,
      });
      return res.status(200).json({ ok: true, ya_estaba: r.ya });
    } catch (e) {
      if (e.message === "datos") return res.status(400).json({ ok: false, error: e.detalle });
      if (e.message === "no_puede") return res.status(409).json({ ok: false, error: e.detalle });
      console.error("[compra]", e.message);
      return res.status(500).json({ ok: false, error: "No se ha podido guardar. Prueba otra vez." });
    }
  }

  // ── GET /api/visit-availability?route=vendedor&bookingId=X&token=Y
  //    Lo que ve el vendedor particular al abrir su enlace.
  if (method === "GET" && route === "vendedor") {
    const bookingId = normalize(req.query?.bookingId);
    const token     = normalize(req.query?.token);
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      return res.status(200).json({ ok: true, ...(await laVisitaParaElVendedor(bookingId, token)) });
    } catch (e) {
      if (e.message === "not_found") return res.status(404).json({ ok: false, error: "No encontramos esa visita" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST route=vendedor_confirma  (el vendedor particular dice que sí)
  //    POST, no un enlace directo: los lectores de correo abren solos los
  //    enlaces, y una visita no puede quedar confirmada porque un antivirus
  //    haya mirado el mensaje.
  if (method === "POST" && route === "vendedor_confirma") {
    const { bookingId, token, donde, preguntarPor } = body;
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const booking = await vendedorConfirma(bookingId, token, { donde, preguntarPor });
      return res.status(200).json({ ok: true, booking: { id: booking.id, status: booking.status, starts_at: booking.starts_at, ends_at: booking.ends_at, meeting_place: booking.meeting_place } });
    } catch (e) {
      if (e.message === "not_found")     return res.status(404).json({ ok: false, error: "No encontramos esa visita" });
      if (e.message === "falta_donde")   return res.status(400).json({ ok: false, error: "Dinos dónde es la visita, para que el comprador sepa llegar" });
      if (e.message === "ya_confirmada") return res.status(409).json({ ok: false, error: "Esta visita ya está confirmada" });
      if (e.message === "no_pendiente")  return res.status(409).json({ ok: false, error: "Esta visita ya no está pendiente" });
      if (e.message === "hora_pasada")   return res.status(409).json({ ok: false, error: "Esa franja ya ha pasado" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── POST route=vendedor_propone  (el vendedor propone otras horas)
  if (method === "POST" && route === "vendedor_propone") {
    const { bookingId, token, horas } = body;
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const r = await vendedorProponeHoras(bookingId, token, horas);
      return res.status(200).json({ ok: true, horas: r.horas });
    } catch (e) {
      if (e.message === "not_found")    return res.status(404).json({ ok: false, error: "No encontramos esa visita" });
      if (e.message === "sin_horas")    return res.status(400).json({ ok: false, error: "Propón al menos una hora que no haya pasado" });
      if (e.message === "no_pendiente") return res.status(409).json({ ok: false, error: "Esta visita ya no está pendiente" });
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── GET /api/visit-availability?route=bookings&offerId=X  (el dueño del coche)
  //
  // Contestaba a cualquiera: con el id del anuncio, que es público, devolvía
  // el correo y el teléfono de cada comprador y los testigos que permiten
  // cancelar sus visitas. Ahora solo al dueño del coche, con su sesión, y solo
  // lo que necesita para verlas y contestarlas.
  if (method === "GET" && route === "bookings") {
    const offerId = normalize(req.query?.offerId);
    if (!offerId) return res.status(400).json({ ok: false, error: "offerId required" });
    const { email } = await identidadDeLaPeticion(req);
    if (!email) return res.status(401).json({ ok: false, error: "Hace falta iniciar sesión" });
    try {
      if (!(await esSuCoche(offerId, email))) return res.status(403).json({ ok: false, error: "Ese coche no es tuyo" });
      const bookings = (await getBookingsByOffer(offerId)).map((b) => ({
        id: b.id, starts_at: b.starts_at, ends_at: b.ends_at, status: b.status,
        buyer_name: b.buyer_name, notes: b.notes, meeting_place: b.meeting_place,
        token_seller: b.token_seller,
      }));
      return res.status(200).json({ ok: true, bookings });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // GET /api/visit-availability?route=booking_detail&bookingId=X&token=Y
  if (method === "GET" && route === "booking_detail") {
    const bookingId = normalize(req.query?.bookingId);
    const token     = normalize(req.query?.token);
    if (!bookingId || !token) return res.status(400).json({ ok: false, error: "bookingId and token required" });
    try {
      const pool = getPool();
      if (!pool) return res.status(500).json({ ok: false, error: "No DB" });
      /*
       * Su cita, y solo con su testigo.
       *
       * Devuelve `buyer_email`, y aceptaba tambien el testigo del vendedor:
       * desde que al vendedor particular se le manda su enlace por correo, con
       * ese testigo podia leer el correo del comprador. Quien pinta esto es
       * `/mi-cita` y `/como-fue`, que son del comprador; el vendedor tiene
       * `route=vendedor`, que va con lista blanca y sin datos de contacto.
       */
      const r = await pool.query(
        `SELECT id, offer_id, vehicle_title, starts_at, ends_at, buyer_name, buyer_email, status, notes, created_at,
                meeting_place, meeting_contact, resultado
         FROM vehicle_visit_bookings
         WHERE id = $1 AND token_buyer = $2`,
        [bookingId, token]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: "Cita no encontrada" });
      return res.status(200).json({ ok: true, booking: r.rows[0] });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(404).json({ ok: false, error: "Route not found" });
};

/** Para poder probar a quién se escribe sin mandar correos de verdad. */
module.exports.sendBookingEmails = sendBookingEmails;
module.exports.sendCancelEmails = sendCancelEmails;
module.exports.fmtFranja = fmtFranja;
module.exports.esDeParticular = esDeParticular;
