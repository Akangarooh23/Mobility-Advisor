const { Pool } = require("pg");
const crypto = require("crypto");
const { MARCA, correoInterno } = require("../marca");
const { plantilla, parrafo, datos, aviso, boton, esc } = require("../correo");
const { identidadDeLaPeticion } = require("./identidad");
const { esUnaHoraPropuesta } = require("../citas");

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) return null;
  _pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  return _pool;
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

async function sendEmail({ to, subject, html, attachments }) {
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
function dtIcs(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildIcs(booking) {
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
    `UID:${booking.id}@popcar.tech`,
    `ORGANIZER;CN=${MARCA.nombre}:mailto:notifications@popcar.tech`,
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

  // El encabezado lo pone ahora la maqueta; aquí solo queda lo que se dice.
  // Pendiente manda sobre «reprogramada»: al cambiar de hora la visita vuelve a
  // estar por aprobar, y decirle que ya esta reprogramada seria prometerle una
  // hora que nadie ha acordado todavia.
  const buyerSubtitle = pendiente
    ? (isReschedule
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
        ['Hora', esc(timeStr)],
      ]) +
      boton(pendiente ? 'Ver mi solicitud' : 'Gestionar mi cita', manageUrl) +
      (pendiente
        ? parrafo('Si ese horario no puede ser, te proponemos otro. No hace falta que hagas nada.', 14)
        : parrafo('Va adjunto un archivo para añadir la cita a tu calendario.', 14)),
  });

  // ── Email al vendedor particular ────────────────────────────────────────
  const isParticular = booking.source === "marketplace" && booking.seller_email;
  const sellerHtml = plantilla({
    titulo: 'Nueva reserva de visita',
    cuerpo:
      parrafo('Alguien ha reservado una visita para ver tu vehículo.') +
      datos([
        ['Vehículo', esc(vehicle)],
        ['Fecha', esc(dateStr)],
        ['Hora', esc(timeStr)],
        ['Comprador', esc(booking.buyer_name)],
        ['Teléfono', esc(booking.buyer_phone)],
        ['Email', esc(booking.buyer_email)],
        ['Notas', esc(booking.notes)],
      ]) +
      parrafo('El comprador tiene tus datos de contacto. Asegúrate de estar disponible a esa hora.', 14),
  });

  // ── Email al equipo (ofertas profesionales) ─────────────────────────────
  const opsHtml = plantilla({
    titulo: pendiente ? 'Cita por confirmar' : 'Nueva cita recibida',
    cuerpo:
      (pendiente
        ? aviso('Hay que confirmarla', 'Ese horario lo generó el sistema, no lo publicó nadie. El cliente ya sabe que está pendiente. Confírmala o proponle otra desde la Agenda del ERP.')
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
  }).catch((e) => console.error("[email] buyer:", e.message)));

  // Seller (particular) OR ops (professional)
  if (isParticular) {
    sends.push(sendEmail({
      to: booking.seller_email,
      subject: `Nueva visita para tu vehículo — ${dateStr} a las ${timeStr}`,
      html: sellerHtml,
    }).catch((e) => console.error("[email] seller:", e.message)));
  } else {
    sends.push(sendEmail({
      to: opsEmail(),
      subject: `Nueva cita — ${vehicle} — ${dateStr} ${timeStr}`,
      html: opsHtml,
    }).catch((e) => console.error("[email] ops:", e.message)));
  }

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

  const notifyCancelHtml = plantilla({
    titulo: 'Cita cancelada por el comprador',
    cuerpo:
      datos([
        ['Vehículo', esc(vehicle)],
        ['Fecha', esc(dateStr)],
        ['Hora', esc(timeStr)],
        ['Comprador', esc(booking.buyer_name)],
        ['Email', esc(booking.buyer_email)],
      ]) +
      parrafo('La hora ha quedado libre otra vez.', 14),
  });

  const sends = [
    sendEmail({
      to: booking.buyer_email,
      subject: `Cita cancelada — ${vehicle}`,
      html: buyerCancelHtml,
    }).catch((e) => console.error("[email] cancel-buyer:", e.message)),
  ];

  const notifyTo = booking.seller_email || opsEmail();
  sends.push(sendEmail({
    to: notifyTo,
    subject: `Cita cancelada — ${vehicle} — ${dateStr}`,
    html: notifyCancelHtml,
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
    const existente = await cliente.query(
      `SELECT id FROM vehicle_visit_availability
        WHERE offer_id = $1 AND starts_at = $2 AND status = 'available' LIMIT 1`,
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
    sendEleccionEmails(bk).catch(() => {});
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
      attachments: [{ filename: "cita-popcar.ics", content: Buffer.from(buildIcs(booking)).toString("base64") }],
    }).catch((e) => console.error("[email] eleccion-cliente:", e.message)),
    sendEmail({
      to: opsEmail(),
      subject: `Ha elegido hora — ${vehicle} — ${dia} ${hora}`,
      html: alEquipo,
    }).catch((e) => console.error("[email] eleccion-ops:", e.message)),
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
  const r = await pool.query(
    `SELECT id, offer_id, starts_at, ends_at, status, source
     FROM vehicle_visit_availability
     WHERE offer_id = $1
       AND status = 'available'
       AND starts_at > $2
     ORDER BY starts_at ASC
     LIMIT 60`,
    [offerId, now]
  );
  // Para ofertas profesionales (no idcar-) sin slots: generar L-V 9-18h automáticamente
  if (r.rows.length === 0 && !offerId.startsWith('idcar-')) {
    return seedProfessionalSlots(offerId);
  }
  return r.rows;
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

async function deleteSlot(slotId, offerId) {
  const pool = getPool();
  if (!pool) return;
  // Only delete if still available (not already booked)
  await pool.query(
    `DELETE FROM vehicle_visit_availability
     WHERE id = $1 AND offer_id = $2 AND status = 'available'`,
    [slotId, offerId]
  );
}

// `sellerEmail` ya no se recibe: lo resuelve el servidor (ver abajo).
async function bookSlot({ slotId, offerId, vehicleTitle, buyerEmail, buyerName, buyerPhone, notes, source }) {
  const pool = getPool();
  if (!pool) throw new Error("No DB");

  // Atomic: check + mark booked in a transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const slotRes = await client.query(
      `SELECT * FROM vehicle_visit_availability
       WHERE id = $1 AND offer_id = $2 AND status = 'available'
       FOR UPDATE`,
      [slotId, offerId]
    );
    if (!slotRes.rows.length) throw new Error("slot_unavailable");
    const slot = slotRes.rows[0];

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

    await client.query(
      `UPDATE vehicle_visit_availability SET status = 'booked' WHERE id = $1`,
      [slotId]
    );

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
          status, token_buyer, token_seller, notes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$14,$10,$11,$12,$13)
       RETURNING *`,
      [
        slotId, offerId, vehicleTitle || "", slot.starts_at, slot.ends_at,
        buyerEmail, buyerName || "", buyerPhone || "", sellerEmail || null,
        tokenBuyer, tokenSeller, notes || "", source || "marketplace", estado,
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
    // Fire emails async (don't block response)
    sendBookingEmails(bk).catch(() => {});
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
  const r = await pool.query(
    `UPDATE vehicle_visit_bookings
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND (token_buyer = $2 OR token_seller = $2)
       AND status != 'cancelled'
     RETURNING *`,
    [bookingId, token]
  );
  if (!r.rows.length) throw new Error("not_found");
  const booking = r.rows[0];
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
    `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'cancelada','cliente',$2)`,
    [bookingId, JSON.stringify({ por: 'el propio cliente, desde su cita' })]
  ).catch((e) => console.error("[visitas] sin rastro de la cancelacion:", e.message));
  sendCancelEmails(booking).catch(() => {});
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
    const bRes = await client.query(
      `SELECT * FROM vehicle_visit_bookings
       WHERE id = $1 AND (token_buyer = $2 OR token_seller = $2)
         AND status != 'cancelled'
       FOR UPDATE`,
      [bookingId, token]
    );
    if (!bRes.rows.length) throw new Error("not_found");
    const booking = bRes.rows[0];

    // Check new slot availability
    const sRes = await client.query(
      `SELECT * FROM vehicle_visit_availability
       WHERE id = $1 AND offer_id = $2 AND status = 'available'
       FOR UPDATE`,
      [newSlotId, booking.offer_id]
    );
    if (!sRes.rows.length) throw new Error("slot_unavailable");
    const newSlot = sRes.rows[0];

    // Free old slot
    await client.query(
      `UPDATE vehicle_visit_availability SET status = 'available' WHERE id = $1`,
      [booking.availability_id]
    );
    // Book new slot
    await client.query(
      `UPDATE vehicle_visit_availability SET status = 'booked' WHERE id = $1`,
      [newSlotId]
    );
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
      [newSlotId, newSlot.starts_at, newSlot.ends_at, bookingId]
    );

    await client.query(
      `INSERT INTO visit_booking_events (booking_id, evento, actor, datos) VALUES ($1,'movida','cliente',$2)`,
      [bookingId, JSON.stringify({ a: newSlot.starts_at, por: 'el propio cliente' })]
    ).catch((e) => console.error("[visitas] sin rastro del cambio de hora:", e.message));

    await client.query("COMMIT");
    const bk = updated.rows[0];
    sendBookingEmails(bk, { isReschedule: true }).catch(() => {});
    return bk;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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
      return res.status(401).json({ ok: false, error: "Inicia sesión para pedir una visita." });
    }
    if (!slotId || !offerId) return res.status(400).json({ ok: false, error: "slotId, offerId required" });
    try {
      const booking = await bookSlot({ slotId, offerId, vehicleTitle, buyerEmail, buyerName, buyerPhone, notes, source });
      return res.status(200).json({ ok: true, booking });
    } catch (e) {
      if (e.message === "slot_unavailable") return res.status(409).json({ ok: false, error: "Este horario ya no está disponible" });
      return res.status(500).json({ ok: false, error: e.message });
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

  // ── GET /api/visit-availability?route=bookings&offerId=X  (seller/ERP admin)
  if (method === "GET" && route === "bookings") {
    const offerId = normalize(req.query?.offerId);
    if (!offerId) return res.status(400).json({ ok: false, error: "offerId required" });
    try {
      const bookings = await getBookingsByOffer(offerId);
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
      const r = await pool.query(
        `SELECT id, offer_id, vehicle_title, starts_at, ends_at, buyer_name, buyer_email, status, notes, created_at,
                meeting_place, meeting_contact
         FROM vehicle_visit_bookings
         WHERE id = $1 AND (token_buyer = $2 OR token_seller = $2)`,
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
