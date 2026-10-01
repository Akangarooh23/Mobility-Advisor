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
 * Lo que aguanta una IP entera, que no es una persona.
 *
 * ## Por qué hacían falta dos cuentas
 *
 * El freno contaba solo por IP, y el comentario de arriba decía «y por IP, no
 * por usuario, porque no hay usuario: el flujo es anónimo». Eso dejó de ser
 * verdad: ahora hay cuentas.
 *
 * Y contar por IP rompe donde más gente hay. En **datos móviles** los
 * operadores meten miles de clientes detrás de una sola dirección: con doce a
 * la hora, doce personas con la misma operadora dejan sin buscar a la
 * decimotercera, que no ha hecho nada. Lo mismo en una oficina, un
 * concesionario o una universidad, que salen todos por la misma IP.
 *
 * Esa persona ve «has hecho muchas consultas seguidas» habiendo hecho una, y
 * se va.
 *
 * ## Cómo se cuenta ahora
 *
 * Quien ha entrado con su cuenta tiene **su propia cuota**, vaya por donde
 * vaya: se cuenta contra su sesión. Y la IP sigue contando siempre, pero con
 * un techo mucho más alto, como red de seguridad: ahí no se trata de racionar
 * a nadie, sino de que no se pueda usar la clave del proyecto como un servicio
 * gratuito desde un script.
 *
 * El número sale de lo que cuesta: cada búsqueda es una llamada al cerebro,
 * las medianas de mercado y las fichas de los portales. Sesenta a la hora
 * desde una sola dirección ya no es una oficina, es un robot.
 */
const LO_QUE_AGUANTA_UNA_IP = {
  analisis: { veces: 80, segundos: 60 * 60 },
  busqueda: { veces: 60, segundos: 60 * 60 },
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

/** El nombre de la galleta de sesión. Tiene que ser el mismo que en `api/auth.js`. */
const LA_GALLETA_DE_LA_SESION = "moveadvisor_session";

/**
 * Quién es, si ha entrado con su cuenta.
 *
 * Devuelve una clave estable para esa sesión, o `null` si viene de forma
 * anónima. **No se valida la sesión y es a propósito**: aquí no hace falta
 * saber quién es, solo que es alguien distinto del de al lado. Comprobarla
 * contra la base costaría una consulta en cada petición para no decidir nada
 * más.
 *
 * Y quien se invente una galleta para estrenar cuota se topa con el techo de
 * su IP, que se cuenta igual.
 *
 * Se guarda el resumen y no el testigo: esta clave acaba escrita en
 * `frenos_de_ritmo`, y una sesión en claro en una tabla es una sesión que se
 * puede robar de ahí.
 */
function quienEs(req) {
  const galletas = String(req?.headers?.cookie || "");
  const trozo = galletas.split(";").map((g) => g.trim())
    .find((g) => g.startsWith(LA_GALLETA_DE_LA_SESION + "="));

  const testigo = trozo ? decodeURIComponent(trozo.slice(LA_GALLETA_DE_LA_SESION.length + 1)) : "";
  if (!testigo) return null;

  return "s:" + require("node:crypto").createHash("sha256").update(testigo).digest("hex").slice(0, 32);
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

  /*
   * Dos cuentas, y la de la persona manda sobre la de su red.
   *
   * Quien ha entrado con su cuenta gasta de SU cuota, aunque comparta IP con
   * media oficina. Quien viene anónimo gasta de la de su IP, que por eso es
   * mucho más alta: detrás de una sola dirección móvil puede haber miles.
   */
  const suya = quienEs(req);
  const cuentas = suya
    ? [{ clave: suya, limite }, { clave: deQuienViene(req), limite: LO_QUE_AGUANTA_UNA_IP[cual] }]
    : [{ clave: deQuienViene(req), limite: LO_QUE_AGUANTA_UNA_IP[cual] }];

  let frenado = null;
  for (const cuenta of cuentas) {
    if (!cuenta.limite) continue;

    let resultado;
    try {
      resultado = await FRENO.pide(pool, `caro-${cual}`, cuenta.clave, cuenta.limite);
    } catch (error) {
      await registra(`freno-caro: no se pudo contar un intento de ${cual}`, error);
      continue;
    }

    // Se cuentan las dos siempre, para que la de la red no se quede sin contar.
    if (!resultado.paso && !frenado) frenado = resultado;
  }

  if (!frenado) return false;

  const segundos = Math.max(1, frenado.enSegundos || 60);
  res.setHeader("Retry-After", String(segundos));
  res.status(429).json({ error: comoSeLeDiceQueEspere(segundos) });
  return true;
}

/**
 * Cuánto tiene que esperar, dicho en minutos.
 *
 * Antes decía «espera un momento», y un momento no es nada: el servidor sabe
 * los segundos exactos —los tiene delante, en `Retry-After`— y no los usaba.
 * Quien lee «espera un momento» vuelve a los diez segundos, se lo encuentra
 * otra vez y se va creyendo que está roto.
 */
function comoSeLeDiceQueEspere(segundos) {
  const minutos = Math.ceil(segundos / 60);

  if (minutos <= 1) return "Has hecho muchas consultas seguidas. Vuelve a intentarlo en un minuto.";
  return `Has hecho muchas consultas seguidas. Vuelve a intentarlo en ${minutos} minutos.`;
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

module.exports = {
  seHaPasado,
  elPromptEsEnorme,
  LIMITES,
  LO_QUE_AGUANTA_UNA_IP,
  TOPE_DEL_PROMPT,
  deQuienViene,
  quienEs,
  comoSeLeDiceQueEspere,
};
