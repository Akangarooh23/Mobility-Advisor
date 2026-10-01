const { elPoolObligatorio } = require("../postgres");
const { MARCA } = require("../marca");

let _pool = null;
function getPool() {
  return elPoolObligatorio();
}

let _tableReady = false;

function parseBody(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw || "{}")); } catch { return {}; }
}

/**
 * Hasta dónde se guarda cada campo.
 *
 * ## Por qué hacía falta
 *
 * Este endpoint **no pide sesión** —es analítica de la web pública, y tiene que
 * aceptar visitas anónimas— y escribía **quince columnas de texto sin ningún tope**.
 * Las quince son `text` en Postgres, o sea sin límite por el lado de la base.
 *
 * El tope real era entonces el del cuerpo de la petición, que lo pone Vercel y está
 * en unos 4 MB. O sea que una sola petición podía guardar cuatro megas de texto.
 *
 * Y eso no es teórico, es aritmética. Medido contra la base el 1 de octubre:
 *
 *     moveadvisor_funnel_events   1.696 kB   ~2.102 filas
 *
 * La tabla entera pesa 1,7 MB. **Una petición abusiva la más que duplica.** Repetida,
 * es la factura de Neon.
 *
 * ## De dónde salen los números
 *
 * De lo que hay guardado de verdad, no de lo que me pareciera razonable. Lo más largo
 * en las 2.102 filas:
 *
 *     landing_url  1.168     offer_title  54     utm_*  34     anon_id  26
 *
 * Así que los topes de abajo van entre dos y seis veces por encima del máximo real. No
 * están apretados: están puestos para que no quepa un abuso, no para que no quepa un
 * caso legítimo. Si alguno empieza a recortar algo de verdad, el sitio donde se nota
 * es la propia analítica, y el número se sube.
 *
 * ## Lo que esto NO arregla
 *
 * El ritmo. Nada impide mandar un millón de eventos de 2 kB en vez de uno de 4 MB.
 * `lib/freno.js` existe y se usa en el login, pero ponerle freno a la analítica es una
 * decisión con coste —demasiado apretado y se pierden visitas de verdad, que es el
 * dato por el que existe la tabla—, así que queda dicho en el informe y no hecho aquí.
 */
const TOPES = {
  anon_id: 100,
  user_email: 254,   // el máximo de una dirección de correo según la RFC 5321
  utm: 200,
  landing_url: 2000, // lo que aguanta una URL en la práctica
  offer_id: 100,
  offer_title: 300,
  corto: 60,         // `modality` y `section`, que son palabras
};

/** Texto recortado. Mismo ayudante que `error-del-navegador-handler`. */
function texto(valor, tope) {
  return String(valor == null ? "" : valor).slice(0, tope);
}

/**
 * Lo mismo, pero dejando `NULL` cuando no hay nada.
 *
 * Importa la diferencia: en estas columnas `''` y `NULL` no significan lo mismo. Las
 * consultas del embudo cuentan `WHERE offer_title IS NOT NULL`, así que convertir un
 * ausente en cadena vacía cambiaría los números del panel sin que nadie toque el panel.
 */
function oNada(valor, tope) {
  if (valor == null || valor === "") return null;
  return texto(valor, tope);
}

const ALLOWED_EVENTS = ["landing", "marketplace_view", "offer_view", "register", "login", "lead_request", "identify", "page_view"];

module.exports = async function funnelEventHandler(req, res) {
  const origin = req.headers.origin || "";
  // El dominio nuevo faltaba. Hoy no se nota porque la web llama a
  // /api/funnel-event con ruta relativa y eso es mismo origen, donde el
  // navegador ni mira estas cabeceras. Se nota el día que llame otro sitio.
  //
  // Los cuatro dominios propios están porque durante el cambio de popcar.tech
  // a popcar.com.es los dos responden, y el redirect de uno al otro no arrastra
  // el origin: quien llegue por el viejo seguirá mandando el viejo.
  const allowedOrigins = new Set([
    MARCA.sitioUrl,
    `https://${MARCA.dominio}`,
    `https://www.${MARCA.dominioAnterior}`,
    `https://${MARCA.dominioAnterior}`,
    "https://carswiseai.com",
    "https://www.carswiseai.com",
    "http://localhost:3000",
    "http://localhost:3001",
  ]);
  res.setHeader("Access-Control-Allow-Origin", allowedOrigins.has(origin) ? origin : MARCA.sitioUrl);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = parseBody(req.body);
  const {
    anon_id,
    user_id,
    user_email,
    event_type,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_url,
    offer_id,
    offer_title,
    modality,
    section,
  } = body;

  if (!event_type || !ALLOWED_EVENTS.includes(event_type)) {
    return res.status(400).json({ error: "event_type inválido" });
  }

  const id = `fe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO moveadvisor_funnel_events
         (id, anon_id, user_id, user_email, event_type,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          landing_url, offer_id, offer_title, modality, section)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        texto(anon_id, TOPES.anon_id),
        oNada(user_id, TOPES.offer_id),
        user_email ? texto(user_email, TOPES.user_email).toLowerCase().trim() : null,
        event_type,
        texto(utm_source,   TOPES.utm),
        texto(utm_medium,   TOPES.utm),
        texto(utm_campaign, TOPES.utm),
        texto(utm_content,  TOPES.utm),
        texto(utm_term,     TOPES.utm),
        texto(landing_url,  TOPES.landing_url),
        oNada(offer_id,     TOPES.offer_id),
        oNada(offer_title,  TOPES.offer_title),
        oNada(modality,     TOPES.corto),
        oNada(section,      TOPES.corto),
      ]
    );
    // Retroactively enrich previous anonymous events from the same browser session
    const normalizedEmail = user_email ? user_email.toLowerCase().trim() : null;
    if (normalizedEmail && String(anon_id || "")) {
      pool.query(
        `UPDATE moveadvisor_funnel_events
         SET user_email = $1
         WHERE anon_id = $2 AND (user_email IS NULL OR user_email = '')`,
        [normalizedEmail, String(anon_id)]
      ).catch((e) => console.error("[funnel-event-handler] retroactive enrich error:", e.message));
    }

    return res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("[funnel-event-handler] DB error:", err.message);
    return res.status(500).json({ error: "Error al registrar evento" });
  }
};

/*
 * Para las pruebas. Mismo motivo que `cookieSegura` en `api/auth.js`: la decisión
 * —cuánto se guarda de cada campo— se puede comprobar sin levantar una base.
 */
module.exports.TOPES = TOPES;
module.exports.texto = texto;
module.exports.oNada = oNada;
