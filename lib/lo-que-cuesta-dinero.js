"use strict";

const FRENO = require("./freno");
const { registra } = require("./registra");

/**
 * Los dos endpoints que cuestan dinero por llamada, con freno.
 *
 * ## Qué pasaba
 *
 * `/api/analyze` y `/api/find-listing` son los dos más caros del sistema y
 * estaban **abiertos a Internet sin sesión y sin freno**:
 *
 *   · **`/api/analyze`** acepta `body.prompt` —una cadena arbitraria de quien
 *     llama— y la manda a Gemini con la clave del proyecto. El navegador
 *     construye el prompt entero (`src/utils/analysisFlows.js`) y el servidor lo
 *     relaya sin mirarlo, añadiéndole instrucciones detrás. 8.192 tokens de
 *     salida por llamada, con reintento.
 *
 *     O sea: cualquiera podía usar la clave de Gemini como si fuera suya, para
 *     lo que quisiera, sin límite. Y lo que más duele no es la factura: si
 *     alguien genera contenido que viola las políticas de Google a través de esa
 *     clave, **el incumplimiento es del proyecto**, y eso no se paga, se pierde.
 *
 *     Y hay una tercera consecuencia, invisible: al agotarse la cuota el análisis
 *     cae al respaldo determinista, que contesta 200 con un análisis de aspecto
 *     normal. Quemar la cuota empeora el producto **sin que nada dé error**.
 *
 *   · **`/api/find-listing`** golpea siete portales externos, DuckDuckGo y
 *     r.jina.ai en cada llamada, durante hasta 300 segundos. Ahí lo caro no es la
 *     factura: es que alguien puede hacer que **los portales de los que depende
 *     el producto bloqueen las IPs de Vercel**.
 *
 * ## Por qué un freno por IP y no pedir sesión
 *
 * Porque el cuestionario **no exige sesión** —comprobado— y pedirla rompería el
 * flujo anónimo, que es por donde entra la gente. El freno no cambia nada para
 * quien usa la web: los límites están puestos muy por encima de lo que hace una
 * persona y muy por debajo de lo que hace un abuso.
 *
 * ## Y por qué vive aquí y no en cada endpoint
 *
 * Revisando los 53 manejadores me equivoqué dos veces porque las defensas viven
 * en capas distintas: dije que un endpoint no tenía freno cuando lo tenía en otro
 * mecanismo, y que otro no acotaba su límite cuando lo acotaba una capa más
 * abajo. Si eso le pasa a quien revisa con intención, le pasa a quien toca el
 * código con prisa.
 *
 * Así que los dos frenos caros están juntos, con su motivo, en un sitio que se
 * lee de una vez.
 */

/**
 * Cuántas veces cabe.
 *
 * Una persona contesta el cuestionario y pide un análisis; si no le gusta, lo
 * repite. Cinco por hora sobra para eso. Y por IP, no por usuario, porque no hay
 * usuario: el flujo es anónimo.
 *
 * Los números son generosos a propósito: el objetivo no es racionar, es que no
 * se pueda usar la clave de Gemini como un servicio gratuito.
 */
const LIMITES = {
  /** El que manda un prompt a Gemini. */
  analisis: { veces: 20, segundos: 60 * 60 },
  /** El que rasca siete portales durante cuatro minutos. */
  busqueda: { veces: 12, segundos: 60 * 60 },
};

/**
 * El tope del prompt, en caracteres.
 *
 * El de un perfil completo mide unos 6.000 y gasta 2.729 tokens de salida
 * —medido contra la API—. Cuarenta mil deja sitio de sobra para el prompt real y
 * cierra la puerta a mandar un libro y que lo pague el proyecto.
 */
const TOPE_DEL_PROMPT = 40000;

/** De quién viene, para contarle sus intentos. */
function deQuienViene(req) {
  const cabecera = String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return cabecera || String(req?.socket?.remoteAddress || "") || "desconocida";
}

/**
 * Cuenta un intento y, si se ha pasado, contesta 429 y devuelve `true`.
 *
 * Quien llama tiene que salirse si esto devuelve `true`:
 *
 *     if (await seHaPasado(pool, req, res, "analisis")) return undefined;
 *
 * Si el freno falla —la base no contesta— **se deja pasar**. Cerrar la puerta por
 * un fallo del portero dejaría el producto caído; el riesgo de un abuso durante
 * ese rato es menor que el de no funcionar.
 */
async function seHaPasado(pool, req, res, cual) {
  const limite = LIMITES[cual];
  if (!limite || !pool) return false;

  let resultado;
  try {
    resultado = await FRENO.pide(pool, `caro-${cual}`, deQuienViene(req), limite);
  } catch (error) {
    await registra(`freno-caro: no se pudo contar un intento de ${cual}`, error);
    return false;
  }

  if (resultado.paso) return false;

  res.setHeader("Retry-After", String(Math.max(1, resultado.enSegundos || 60)));
  res.status(429).json({
    error: "Has hecho muchas consultas seguidas. Espera un momento y vuelve a intentarlo.",
  });
  return true;
}

/**
 * Si el prompt es demasiado largo, contesta 400 y devuelve `true`.
 *
 * Se mira **antes** del freno: rechazar algo enorme no debe gastar un intento de
 * quien se ha equivocado, ni una consulta a la base.
 */
function elPromptEsEnorme(prompt, res) {
  if (typeof prompt !== "string" || prompt.length <= TOPE_DEL_PROMPT) return false;

  res.status(400).json({ error: "La consulta es demasiado larga." });
  return true;
}

module.exports = { seHaPasado, elPromptEsEnorme, LIMITES, TOPE_DEL_PROMPT, deQuienViene };
