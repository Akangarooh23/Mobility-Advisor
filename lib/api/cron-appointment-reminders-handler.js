const { Pool } = require("pg");
const avisosPush = require("../avisos-push");
const { MARCA, remitente, respuestaA } = require("../marca");
const { deReserva, laFranja } = require("../citas");
const { plantilla, parrafo, datos, boton, opciones, enlace } = require("../correo");
const { SSL_POSTGRES } = require("../postgres-ssl");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 3, ssl: SSL_POSTGRES });
  }
  return _pool;
}

const esc = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function formatDate(dateVal) {
  try {
    const iso = dateVal instanceof Date
      ? dateVal.toISOString().slice(0, 10)
      : String(dateVal).slice(0, 10);
    return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return String(dateVal);
  }
}

async function sendEmail(lead, type) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = remitente();
  if (!apiKey) return;

  const apptDate = formatDate(lead.appointment_date);

  /*
   * Los datos de la cita, y una fila que cambia de sentido.
   *
   * En una visita a un concesionario el cliente va a un sitio y pregunta por
   * alguien: «Pregunta por» dice lo que hay que decir. En una entrega a
   * domicilio no va a ninguna parte — viene alguien a su puerta— y esa misma
   * fila le estaba diciendo que preguntara por sí mismo, que es lo que sale al
   * rellenarla con el contacto del expediente.
   *
   * Lo que necesita saber es **quién le lleva el coche**, para abrir la puerta.
   */
  const esEntrega = String(lead.lead_type || "visit") !== "visit";
  const cita = datos([
    ["Fecha", esc(apptDate)],
    ["Hora", esc(lead.appointment_time)],
    ["Dirección", esc(lead.appointment_address)],
    [esEntrega ? "Te lo lleva" : "Pregunta por", esc(lead.appointment_contact)],
  ]);

  const hola = parrafo(`Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,`);
  // Que sea «la visita para ver el coche» o «tu cita» depende de para qué es.
  //
  // Los avisos se mandaban solo a las visitas, porque el texto era de visita.
  // Pero la condicion que importa es que haya una cita confirmada con fecha:
  // si un trabajador queda con alguien para entregarle un coche de importacion,
  // ese cliente merece el mismo aviso. Lo que cambia es como se le llama.
  const esVisita = !esEntrega;
  const loQueEs = esVisita ? "la visita para ver" : "tu cita por";

  /*
   * Una entrega a domicilio muchas veces no tiene hora, y no es un descuido.
   *
   * La pone el conductor el mismo dia, cuando llama antes de llegar: nosotros
   * sabemos el dia porque nos lo dio el transportista al aceptar el viaje, y la
   * hora no la sabe nadie todavia.
   *
   * Sin decirlo, el cliente recibe un recordatorio de una cita sin hora y la
   * pregunta es inmediata. Con esto, la respuesta ya esta en el correo. Y se
   * dice solo cuando falta la hora: repetirlo con una hora escrita al lado
   * haria dudar de la hora.
   */
  const sinHora = !esVisita && !String(lead.appointment_time || "").trim();
  const loDeLaHora = sinHora
    ? parrafo("La hora exacta la pone el transportista: te llama antes de llegar. Tiene que haber alguien para recibir el coche y firmar la entrega.", 14)
    : "";
  // Una visita reservada con el calendario no se gestiona desde el panel de
  // solicitudes: tiene su propia pagina, con el testigo que le permite mover o
  // anular la cita sin contrasena.
  const gestionar = enlace("Gestionar mi cita", lead.gestionar_url || `${MARCA.sitioUrl}/panel/solicitudes`);

  let html, subject;

  if (type === "day_before") {
    subject = `Tu cita es mañana — ${lead.vehicle_title || MARCA.nombre}`;
    html = plantilla({
      titulo: "Tu cita es mañana",
      cuerpo:
        hola +
        parrafo(`Mañana tienes ${loQueEs} <strong>${esc(lead.vehicle_title)}</strong>.`) +
        cita +
        loDeLaHora +
        parrafo("Si necesitas cancelar o cambiar la fecha, puedes hacerlo desde tu panel antes de la cita.", 14) +
        gestionar,
    });
  } else if (type === "day_of") {
    subject = `Tu cita es hoy — ${lead.vehicle_title || MARCA.nombre}`;
    html = plantilla({
      titulo: "Tu cita es hoy",
      cuerpo:
        hola +
        parrafo(`Hoy tienes ${loQueEs} <strong>${esc(lead.vehicle_title)}</strong>. Te esperamos.`) +
        cita +
        loDeLaHora +
        gestionar,
    });
  } else if (type === "recordatorio_resultado") {
    /*
     * La segunda —y última— vez que se le pregunta.
     *
     * El de después de la visita se manda en la hora siguiente a acabar, que
     * es cuando lo tiene decidido; pero quien lo lee con el móvil en la mano
     * y decide mañana no tenía quien se lo recordara, y la ventana para
     * contestar es de catorce días. Este sale a las 48 horas y solo a quien
     * no ha dicho nada.
     *
     * No hay un tercero a propósito: dos correos por una visita son un
     * recordatorio; tres son perseguir a alguien, y quien no contesta dos
     * veces ya ha contestado.
     */
    const suEnlace = String(lead.gestionar_url || "");
    const puedeContestar = esVisita && suEnlace.includes("/mi-cita?");
    const comoFue = (r) => suEnlace.replace("/mi-cita?", "/como-fue?") + `&r=${r}`;
    const coche = esc(lead.vehicle_title || MARCA.nombre);

    if (lead.comprar_url && puedeContestar) {
      subject = `¿Te quedas con ${lead.vehicle_title || MARCA.nombre}?`;
      html = plantilla({
        titulo: "¿Lo has decidido?",
        cuerpo:
          hola +
          parrafo(`Hace un par de días viste <strong>${coche}</strong> y no nos has dicho nada. Con un toque nos vale:`) +
          opciones([
            { texto: "Quiero comprarlo",       url: lead.comprar_url },
            { texto: "Lo vi y no me lo quedo", url: comoFue("fue") },
            { texto: "No fui",                 url: comoFue("no_fue") },
          ]) +
          parrafo(`Quien lo vende está esperando saberlo, y el coche sigue a la venta mientras tanto. Este es el último correo que te mandamos por esta visita.`, 14),
      });
    } else {
      subject = `¿Qué tal fue la visita? — ${lead.vehicle_title || MARCA.nombre}`;
      html = plantilla({
        titulo: "¿Nos cuentas cómo fue?",
        cuerpo:
          hola +
          parrafo(`Hace un par de días viste <strong>${coche}</strong>. Cuéntanos en un toque cómo fue:`) +
          opciones([
            { texto: "No fui",                 url: comoFue("no_fue") },
            { texto: "Lo vi y no me lo quedé", url: comoFue("fue") },
            { texto: "Me lo quedé",            url: comoFue("compro") },
          ]) +
          parrafo("Es el último correo que te mandamos por esta visita.", 14),
      });
    }
  } else if (type === "followup") {
    subject = esVisita
      ? `¿Qué tal fue la visita? — ${lead.vehicle_title || MARCA.nombre}`
      : `¿Qué tal fue? — ${lead.vehicle_title || MARCA.nombre}`;
    /*
     * Las tres respuestas, cuando la cita es una visita del marketplace.
     *
     * Antes esto solo decia «respondenos a este correo». Contestar escribiendo
     * significa que alguien lea el correo y lo apunte a mano, y lo que no se
     * apunta no existe: la visita se quedaba confirmada para siempre y nadie
     * sabia si el cliente llego a ir.
     *
     * Solo salen si hay enlace suyo —`gestionar_url` trae la cita y su testigo—
     * y solo para visitas: en una entrega a domicilio la pregunta no es esa.
     */
    const suEnlace = String(lead.gestionar_url || "");
    const puedeContestar = esVisita && suEnlace.includes("/mi-cita?");
    const comoFue = (r) => suEnlace.replace("/mi-cita?", "/como-fue?") + `&r=${r}`;

    /*
     * En el coche de un particular la pregunta es otra: ¿te lo quedas?
     *
     * Sale al acabar la hora de la visita, no al día siguiente, porque es
     * cuando lo tiene decidido. «Quiero comprarlo» empieza la compra; las otras
     * dos solo lo apuntan.
     */
    if (esVisita && lead.comprar_url && puedeContestar) {
      subject = `¿Te lo quedas? — ${lead.vehicle_title || MARCA.nombre}`;
      html = plantilla({
        titulo: "¿Te lo quedas?",
        cuerpo:
          hola +
          parrafo(`Acabas de ver <strong>${esc(lead.vehicle_title)}</strong>. Dinos qué quieres hacer:`) +
          opciones([
            { texto: "Quiero comprarlo",          url: lead.comprar_url },
            { texto: "Lo vi y no me lo quedo",    url: comoFue("fue") },
            { texto: "No fui",                     url: comoFue("no_fue") },
          ]) +
          parrafo("Si lo compras, te reservamos el coche y nos ponemos con el cambio de nombre. Si tienes dudas, respóndenos a este correo.", 14),
      });
    } else html = plantilla({
      titulo: esVisita ? "¿Qué tal fue la visita?" : "¿Qué tal fue?",
      cuerpo:
        hola +
        parrafo(`Esperamos que ${loQueEs} <strong>${esc(lead.vehicle_title)}</strong> fuera bien.`) +
        (puedeContestar
          ? parrafo("Cuéntanos en un toque cómo fue. Nos vale para saber si hay que seguir contando con quien tiene el coche.") +
            opciones([
              { texto: "No fui",                  url: comoFue("no_fue") },
              { texto: "Lo vi y no me lo quedé",  url: comoFue("fue") },
              { texto: "Me lo quedé",             url: comoFue("compro") },
            ]) +
            parrafo("Y si te ha quedado alguna duda, respóndenos a este correo y lo vemos.", 14)
          : parrafo("Si quieres seguir adelante o te ha quedado alguna duda, respóndenos a este correo y lo vemos.") +
            // Quien reservo con el calendario puede no tener cuenta: mandarle al
            // panel de solicitudes es mandarle a una pagina que no es suya.
            boton("Hablar con el equipo", suEnlace || `${MARCA.sitioUrl}/panel/solicitudes`) +
            (suEnlace
              ? ""
              : parrafo("Y si has decidido no seguir, puedes cancelar la solicitud desde tu panel cuando quieras.", 14))),
    });
  }


  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, reply_to: respuestaA(), to: lead.user_email, subject, html }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${err.message || JSON.stringify(err)}`);
  }
}

/**
 * Las reservas que toca avisar hoy.
 *
 * Solo las confirmadas: una pendiente es una solicitud sobre un horario que
 * nadie ha publicado, y recordarle a alguien una cita que todavia no le hemos
 * dado es peor que no decirle nada.
 */
async function reservasQueAvisar(pool, columna, condicionFecha) {
  const { rows } = await pool.query(
    `SELECT id, buyer_email, buyer_name, vehicle_title, starts_at, ends_at, token_buyer, meeting_place, meeting_contact,
            offer_id, seller_email, token_seller
       FROM vehicle_visit_bookings
      WHERE status = 'confirmed'
        AND ${condicionFecha}
        AND ${columna} IS NULL
        AND COALESCE(buyer_email, '') <> ''`
  );
  return rows;
}

/**
 * Quién puede disparar esta tarea. Mismo criterio que las otras dos: con
 * `CRON_SECRET` puesto se exige, y sin él solo pasa la llamada de Vercel Cron.
 *
 * Antes la condición estaba al revés —`if (cronSecret && ...)`—, así que no
 * tener la variable configurada dejaba la dirección abierta sin avisar.
 */
function autorizado(req) {
  const secreto = String(process.env.CRON_SECRET || "").trim();
  if (secreto) return String(req.headers?.authorization || "") === `Bearer ${secreto}`;
  return String(req.headers?.["user-agent"] || "").toLowerCase().includes("vercel-cron");
}

/**
 * El mismo recordatorio, en el móvil.
 *
 * Detrás del correo y nunca en su lugar: el correo lleva la dirección, la hora
 * y a quién preguntar, y se puede enseñar en la puerta. Esto es el codazo.
 *
 * No se espera nada de él —ni se mira si ha salido— porque el recordatorio que
 * cuenta ya se ha mandado, y un fallo aquí no puede impedir que la cita se
 * marque como avisada y acabe recordándose dos veces.
 */
/**
 * El recordatorio al vendedor particular.
 *
 * En el coche de un particular la visita la confirma él y la hace él: es quien
 * abre la puerta y enseña el coche. Recordárselo solo al comprador era dejar
 * sin aviso a la mitad de la cita. En los de concesionario no: ahí se llama.
 *
 * Con el nombre de quien viene y sin su teléfono ni su correo, como al
 * confirmarla. Con su enlace, por si al final no puede.
 */
function esDeParticular(reserva) {
  return Boolean(reserva?.seller_email) && String(reserva?.offer_id || "").startsWith("idcar-");
}

async function recordatorioAlVendedor(reserva, tipo) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const hoy = tipo === "day_of";
  const dia = formatDate(reserva.starts_at);
  const franja = laFranja(reserva.starts_at, reserva.ends_at);
  const coche = reserva.vehicle_title || "tu coche";
  const sitio = String(MARCA.sitioUrl || "").replace(/\/$/, "");
  const suEnlace = reserva.token_seller
    ? `${sitio}/cita-vendedor?id=${encodeURIComponent(reserva.id)}&token=${encodeURIComponent(reserva.token_seller)}`
    : `${sitio}/panel/solicitudes`;
  const html = plantilla({
    titulo: hoy ? "Hoy vienen a ver tu coche" : "Mañana vienen a ver tu coche",
    cuerpo:
      parrafo(`${hoy ? "Hoy" : "Mañana"} vienen a ver <strong>${esc(coche)}</strong>.`) +
      datos([
        ["Fecha", esc(dia)],
        ["Hora", esc(franja)],
        ["Dónde", esc(reserva.meeting_place)],
        ["Viene", esc(reserva.buyer_name)],
      ]) +
      parrafo("Ten el coche a mano y los papeles cerca. Si al final no puedes, cancélala cuanto antes desde tu enlace: se lo decimos nosotros.", 14) +
      boton("Ver la visita", suEnlace),
  });
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente(), reply_to: respuestaA(), to: reserva.seller_email,
      subject: `${hoy ? "Hoy" : "Mañana"} vienen a ver tu coche — ${coche}`,
      html,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${err.message || JSON.stringify(err)}`);
  }
  await avisosPush
    .enviaAviso([reserva.seller_email], {
      titulo: hoy ? "Hoy vienen a ver tu coche" : "Mañana vienen a ver tu coche",
      cuerpo: [franja, reserva.meeting_place, reserva.buyer_name && `viene ${reserva.buyer_name}`].filter(Boolean).join(" · "),
      datos: { pantalla: "visitas" },
    })
    .catch(() => {});
}

async function avisoAlMovil(lead, cuando) {
  const coche = String(lead.vehicle_title || "").trim();
  const hora = String(lead.appointment_time || "").trim();
  const esEntrega = String(lead.lead_type || "visit") !== "visit";
  const loQueEs = esEntrega ? "la entrega" : "la visita";

  await avisosPush
    .enviaAviso([lead.user_email], {
      titulo: cuando === "hoy" ? "Tu cita es hoy" : "Tu cita es mañana",
      cuerpo: [coche || loQueEs, hora ? `a las ${hora}` : "", lead.appointment_address || ""]
        .filter(Boolean)
        .join(" · "),
      // Una visita abre sus visitas; una entrega, sus citas.
      datos: { pantalla: esEntrega ? "citas" : "visitas", leadId: String(lead.id || "") },
    })
    .catch(() => {});
}

module.exports = async function cronAppointmentReminders(req, res) {
  if (!autorizado(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pool = getPool();

  /*
   * Cada hora pasa solo para el seguimiento de las visitas: «¿te lo quedas?»
   * sale al acabar la visita, no a la mañana siguiente. Los recordatorios y las
   * citas de los leads siguen en la pasada de las 8:00.
   */
  const soloSeguimiento = String(req.query?.solo || "") === "seguimiento";

  let leadsTomorrow = [], leadsToday = [], leadsYesterday = [];
  if (!soloSeguimiento) {
  try {
    const [r1, r2, r3] = await Promise.all([
      // 24h reminder: appointment is tomorrow
      //
      // Vale también para una entrega de importación.
      //
      // Antes solo se miraba «Cita confirmada», y ese no es un estado por el que
      // pase una importación: sus etapas son las suyas. Para que el cliente
      // recibiera el aviso había que sacar el expediente de su etapa, y entonces
      // desaparecía del tablero de Importaciones. Lo que importa no es el estado
      // sino que haya un día apalabrado.
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title, lead_type,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE (status = 'Cita confirmada' OR lead_type = 'import')
          AND appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND reminder_sent_at IS NULL
          AND user_email <> ''
      `),
      // Same-day reminder: appointment is today. Igual: también las entregas.
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title, lead_type,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE (status = 'Cita confirmada' OR lead_type = 'import')
          AND appointment_date = CURRENT_DATE
          AND reminder_day_of_sent_at IS NULL
          AND user_email <> ''
      `),
      // Post-visit: appointment date has passed → mark as "Visita realizada" + send follow-up
      //
      // Aquí las importaciones se quedan fuera, a propósito. Este paso cambia el
      // estado, y a un expediente de importación lo dejaría en «En proceso», que
      // no es ninguna de sus etapas: se saldría del tablero. Además ya tiene su
      // correo propio cuando se marca Entregado, que dice lo que hay que decir.
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title, lead_type,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE status = 'Cita confirmada'
          AND appointment_date < CURRENT_DATE
          AND followup_sent_at IS NULL
          AND user_email <> ''
      `),
    ]);
    leadsTomorrow  = r1.rows;
    leadsToday     = r2.rows;
    leadsYesterday = r3.rows;
  } catch (err) {
    console.error("[cron-reminders] DB query error:", err.message);
    return res.status(500).json({ error: "DB error", detail: err.message });
  }
  }

  const results = [];

  for (const lead of leadsTomorrow) {
    try {
      await sendEmail(lead, "day_before");
      await avisoAlMovil(lead, "mañana");
      await pool.query(`UPDATE moveadvisor_market_leads SET reminder_sent_at = NOW() WHERE id = $1`, [lead.id]);
      results.push({ id: lead.id, type: "day_before", ok: true });
    } catch (err) {
      results.push({ id: lead.id, type: "day_before", ok: false, error: err.message });
      console.error(`[cron-reminders] day_before error for ${lead.id}:`, err.message);
    }
  }

  for (const lead of leadsToday) {
    try {
      await sendEmail(lead, "day_of");
      await avisoAlMovil(lead, "hoy");
      await pool.query(`UPDATE moveadvisor_market_leads SET reminder_day_of_sent_at = NOW() WHERE id = $1`, [lead.id]);
      results.push({ id: lead.id, type: "day_of", ok: true });
    } catch (err) {
      results.push({ id: lead.id, type: "day_of", ok: false, error: err.message });
      console.error(`[cron-reminders] day_of error for ${lead.id}:`, err.message);
    }
  }

  for (const lead of leadsYesterday) {
    try {
      // El estado de despues, con el nombre que le toque: a una solicitud de
      // importacion no se le puede poner «Visita realizada», porque no la hubo.
      const hecha = String(lead.lead_type || "visit") === "visit" ? "Visita realizada" : "En proceso";
      await Promise.all([
        pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = $2, followup_sent_at = NOW()
           WHERE id = $1`,
          [lead.id, hecha]
        ),
        sendEmail(lead, "followup"),
      ]);
      results.push({ id: lead.id, type: "followup", ok: true });
    } catch (err) {
      results.push({ id: lead.id, type: "followup", ok: false, error: err.message });
      console.error(`[cron-reminders] followup error for ${lead.id}:`, err.message);
    }
  }

  /*
   * La marca del recordatorio se crea sola la primera vez.
   *
   * Es la misma costumbre que la compra: la columna se añade aquí y no en una
   * migración que alguien tiene que acordarse de lanzar. Es idempotente, cuesta
   * un parpadeo y si falla —una base sin permisos para alterar— el resto de la
   * pasada sigue: lo único que no saldría es este recordatorio.
   */
  try {
    await pool.query(
      "ALTER TABLE vehicle_visit_bookings ADD COLUMN IF NOT EXISTS recordatorio_resultado_at TIMESTAMPTZ"
    );
  } catch (err) {
    console.error("[cron-reminders] sin la columna del recordatorio:", err.message);
  }

  // ── Y las visitas reservadas desde el marketplace ─────────────────────────
  //
  // Viven en otra tabla y hasta ahora no recibian ningun aviso: el cron solo
  // miraba los leads. Se recorren igual, con las mismas plantillas, y cada envio
  // deja su marca para no repetirse.
  const DE_RESERVAS = [
    ["day_before", "reminder_sent_at",        "starts_at::date = CURRENT_DATE + 1"],
    /*
     * «Tu cita es hoy» solo si aun no ha empezado.
     *
     * La pasada diaria es a las 10:00 de Madrid, y sin esta condicion una
     * visita de las 9:00 recibia «hoy te esperamos» cuando ya habia terminado
     * —y al vendedor «hoy vienen a ver tu coche»—, seguido del «¿que tal fue?»
     * en la misma vuelta. Quien tiene la visita a primera hora ya recibio el
     * aviso de la vispera.
     */
    ["day_of",     "reminder_day_of_sent_at", "starts_at::date = CURRENT_DATE AND starts_at > NOW()"],
    // Con ventana: sin ella, la primera vez que esto corra saldria un «¿que tal
    // fue la visita?» a todo el que tenga una reserva pasada sin avisar —hay una
    // de hace un mes—. Y un seguimiento a destiempo no es un seguimiento.
    // Al acabar la hora de la visita: la tarea pasa cada hora para esto.
    ["followup",   "followup_sent_at",        "ends_at <= NOW() AND ends_at > NOW() - INTERVAL '3 days'"],
    /*
     * Y el recordatorio, a las 48 horas de la visita.
     *
     * Solo a quien no ha contestado —`resultado IS NULL`—, solo si el primero
     * llegó a salir, y solo dentro de los catorce días en que «quiero
     * comprarlo» todavía funciona: recordarle algo que ya no puede hacer es
     * mandarle a una página que dice que ha pasado demasiado tiempo.
     */
    ["recordatorio_resultado", "recordatorio_resultado_at",
      "ends_at <= NOW() - INTERVAL '48 hours' AND ends_at > NOW() - INTERVAL '13 days'" +
      " AND resultado IS NULL AND followup_sent_at IS NOT NULL"],
  ];

  for (const [tipo, columna, condicion] of DE_RESERVAS) {
    if (soloSeguimiento && !["followup", "recordatorio_resultado"].includes(tipo)) continue;
    let reservas = [];
    try {
      reservas = await reservasQueAvisar(pool, columna, condicion);
    } catch (err) {
      console.error(`[cron-reminders] no se han podido leer las reservas (${tipo}):`, err.message);
      continue;
    }
    for (const reserva of reservas) {
      try {
        const comoLead = deReserva(reserva, { sitioUrl: MARCA.sitioUrl });
        await sendEmail(comoLead, tipo);

        /*
         * El seguimiento también suena, y en el coche de un particular
         * sobre todo.
         *
         * Estaba fuera a propósito —«¿qué tal fue?» no es algo que haya que
         * saber con el móvil sonando—, y para un concesionario sigue siendo
         * verdad. Pero en el de un particular la pregunta es «¿te lo quedas?»,
         * y de esa respuesta sale la compra: el coche se le reserva a quien
         * conteste, y los demás se quedan sin él. Eso sí merece el aviso.
         */
        if (["followup", "recordatorio_resultado"].includes(tipo) && comoLead.comprar_url) {
          await avisosPush
            .enviaAviso([reserva.buyer_email], {
              titulo: tipo === "followup" ? "¿Te lo quedas?" : "¿Lo has decidido?",
              cuerpo: `${reserva.vehicle_title || "El coche"} · dinos qué quieres hacer`,
              datos: { pantalla: "visitas" },
            })
            .catch(() => {});
        }

        // Y al móvil, como las citas de los leads.
        if (!["followup", "recordatorio_resultado"].includes(tipo)) {
          await avisoAlMovil(
            {
              id: reserva.id,
              user_email: reserva.buyer_email,
              vehicle_title: reserva.vehicle_title,
              appointment_time: laFranja(reserva.starts_at, reserva.ends_at),
              appointment_address: reserva.meeting_place || "",
              lead_type: "visit",
            },
            tipo === "day_of" ? "hoy" : "mañana"
          );
          /*
           * Y al vendedor, si es un particular. En su propio try: si falla su
           * correo, el del comprador ya salió y no se puede repetir mañana.
           */
          if (esDeParticular(reserva)) {
            try {
              await recordatorioAlVendedor(reserva, tipo);
              results.push({ id: reserva.id, type: tipo, origen: "reserva-vendedor", ok: true });
            } catch (err) {
              results.push({ id: reserva.id, type: tipo, origen: "reserva-vendedor", ok: false, error: err.message });
              console.error(`[cron-reminders] ${tipo} al vendedor de ${reserva.id}:`, err.message);
            }
          }
        }
        await pool.query(
          `UPDATE vehicle_visit_bookings SET ${columna} = NOW() WHERE id = $1`,
          [reserva.id]
        );
        results.push({ id: reserva.id, type: tipo, origen: "reserva", ok: true });
      } catch (err) {
        results.push({ id: reserva.id, type: tipo, origen: "reserva", ok: false, error: err.message });
        console.error(`[cron-reminders] ${tipo} de la reserva ${reserva.id}:`, err.message);
      }
    }
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
};
