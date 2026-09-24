"use strict";

/**
 * El cerebro elige entre las ofertas que de verdad quedan.
 *
 * ## El hueco que llena esto
 *
 * El circuito tenía dos de las tres etapas. Las preguntas estrechan en SQL
 * —de 2.360.000 anuncios a 181 con el perfil medido— y la mediana juzga el
 * precio comparando cada coche con lo que se pide por su mismo modelo, año y
 * tramo de kilómetros. Las dos son mediciones.
 *
 * Lo que no había era **nadie que mirase las ofertas que quedaron**. El modelo
 * intervenía antes, escribiendo cinco nombres de coche de memoria, y la
 * búsqueda salía a buscar esos nombres. Así que el resultado podía cumplir
 * todo lo que se pidió y no ser lo que le conviene a quien pregunta: nadie
 * había leído sus respuestas subjetivas —qué uso le da, con quién viaja,
 * cuánto tiempo lo quiere— teniendo los coches reales delante.
 *
 * ## Lo que hace y lo que no
 *
 * **No juzga precios.** Eso ya está resuelto con la mediana, y pedirle a un
 * modelo que estime lo que vale un coche es sustituir una medición por una
 * impresión. Cada candidata llega con su diferencia contra el mercado ya
 * calculada y con cuántos comparables la sostienen.
 *
 * **No filtra.** Todas las que recibe cumplen ya lo que el cliente pidió. Si
 * descartara por kilómetros o por precio estaría repitiendo un trabajo hecho,
 * y haciéndolo peor.
 *
 * Elige cuáles enseñar y escribe por qué ese coche para esta persona, que es
 * lo único que sabe hacer mejor que una consulta: entender que quien hace
 * ciudad con dos sillas y lo quiere ocho años no encaja igual en un utilitario
 * que en un familiar, aunque los dos estén igual de bien de precio.
 *
 * ## Si falla, no pasa nada
 *
 * Devuelve `null` y se sigue con el orden que traía, que es el de calidad
 * precio. Quedarse sin ofertas por no poder explicarlas sería mucho peor que
 * enseñarlas sin explicación.
 */

const LA_API = "https://api.anthropic.com/v1/messages";
const EL_MODELO = "claude-sonnet-5";

/**
 * Y el de Google, para cuando no hay clave de Anthropic.
 *
 * El proyecto ya paga Gemini —lo usa el análisis— y no tener clave de
 * Anthropic no puede significar quedarse sin este paso. Se prefiere Anthropic
 * cuando está: razona mejor eligiendo, que es justo lo que se le pide aquí.
 * Pero el encargo y la comprobación de lo que contesta son los mismos, así que
 * cambiar de uno a otro no cuesta nada.
 */
const LA_API_DE_GOOGLE = "https://generativelanguage.googleapis.com/v1beta/models";
const EL_MODELO_DE_GOOGLE = "gemini-2.5-flash";

/**
 * Y los de repuesto, porque el primero dice que no a menudo.
 *
 * Medido con la clave de producción: `gemini-2.5-flash` contestó 503 en una
 * prueba y 429 en la siguiente, con dos minutos de diferencia. No es que la
 * clave esté mal —la lista de modelos se lee sin problema— es que ese modelo
 * se satura y limita el ritmo.
 *
 * El análisis ya hacía esto mismo, probando varios en orden. Aquí igual: si
 * uno dice que está ocupado, se pregunta al siguiente antes de rendirse.
 */
const LOS_MODELOS_DE_GOOGLE = [
  EL_MODELO_DE_GOOGLE,
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
];

/** Las respuestas que significan «ahora no», no «esto está mal». */
const AHORA_NO = [429, 500, 502, 503, 504];

/** Cuántas candidatas se le enseñan. */
const LAS_CANDIDATAS = 45;

/**
 * Cuánto se le espera.
 *
 * La búsqueda entera va justa contra el tope de Vercel, así que este paso no
 * puede ser el que la mate: si tarda más de esto se sigue sin él.
 */
const LO_QUE_SE_LE_ESPERA_MS = 25000;

/**
 * Las respuestas que no se pueden meter en un WHERE.
 *
 * Las duras —precio, kilómetros, combustible— no se le pasan como criterio
 * porque ya están aplicadas; se le dicen como contexto para que sepa de qué
 * presupuesto se habla, no para que vuelva a filtrar.
 */
const LO_SUBJETIVO = [
  "perfil",
  "uso_principal",
  "entorno_uso",
  "uso_km_anuales",
  "km_anuales",
  "ocupantes",
  "horizonte_tenencia",
  "horizonte",
  "carga_trabajo",
  "garaje",
  "zbe_impacto",
  "marca_preferencia",
  "gestion_riesgo",
  "flexibilidad",
];

const texto = (v) => String(v ?? "").trim();
const cifra = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("es-ES") : "?");

/** Una oferta, en una línea que el modelo pueda leer sin gastarse el contexto. */
function comoSeLeCuenta(oferta, n) {
  const partes = [
    n + ".",
    [oferta.brand, oferta.model, oferta.version].filter(Boolean).join(" "),
    oferta.year ? String(oferta.year) : "",
    Number.isFinite(Number(oferta.mileage)) ? cifra(oferta.mileage) + " km" : "",
    Number.isFinite(Number(oferta.price)) ? cifra(oferta.price) + " EUR" : "",
    texto(oferta.fuel),
    texto(oferta.transmission),
    Number.isFinite(Number(oferta.powerCv)) ? oferta.powerCv + " CV" : "",
    texto(oferta.province),
    /*
     * Y si viene de fuera, que lo sepa: su diferencia contra el mercado está
     * calculada contra coches ya matriculados en España, así que parte de ese
     * descuento es la matriculación que falta por pagar.
     */
    texto(oferta.country) && texto(oferta.country).toUpperCase() !== "ES" ? "IMPORTADO" : "",
  ].filter(Boolean);

  /*
   * Y lo que vale en su mercado, que es el dato que le evita opinar de precio.
   */
  const mercado = oferta.mercado;
  if (mercado && Number.isFinite(Number(mercado.diferencia))) {
    const dif = Number(mercado.diferencia);
    partes.push(
      dif > 0
        ? cifra(dif) + " EUR por debajo de su mercado (" + (mercado.comparables || "?") + " comparables)"
        : cifra(Math.abs(dif)) + " EUR por encima de su mercado"
    );
  }

  return partes.join(" · ");
}

/** Lo que ha contestado, de lo que no cabe en una consulta. */
function comoSeCuentaElCliente(answers) {
  const suyas = answers || {};
  return LO_SUBJETIVO
    .map((clave) => {
      const valor = suyas[clave];
      const plano = Array.isArray(valor) ? valor.join(", ") : texto(valor);
      return plano ? "- " + clave + ": " + plano : "";
    })
    .filter(Boolean)
    .join("\n");
}

function elEncargo(ofertas, answers, cuantas) {
  const lasOfertas = ofertas.map((o, i) => comoSeLeCuenta(o, i + 1)).join("\n");

  return [
    "Eres el consejero de coches de una web española. Alguien ha contestado un test y estas son sus respuestas sobre cómo va a usar el coche:",
    "",
    comoSeCuentaElCliente(answers),
    "",
    "Estas son las ofertas reales que quedan. TODAS cumplen ya lo que pidió de precio, kilómetros, combustible, provincia y demás: eso está filtrado en la base de datos antes de llegar aquí, así que no descartes ninguna por esos motivos.",
    "",
    lasOfertas,
    "",
    "Elige " + cuantas + " y ordénalas de mejor a peor para esta persona en concreto.",
    "",
    "Cómo elegir:",
    "- El precio ya está juzgado: la diferencia contra su mercado sale de comparar cada coche con lo que se pide por su mismo modelo, año y tramo de kilómetros. Úsala, no la recalcules ni estimes precios por tu cuenta.",
    "- Lo que aportas tú es el encaje: el uso que le va a dar, con quién viaja, cuánto tiempo lo quiere, si tiene garaje, si entra en zonas restringidas.",
    "- Que no sean cuatro veces el mismo coche.",
    "- Una marcada como IMPORTADO está más barata en parte porque todavía hay que matricularla en España, con su impuesto y su ITV. No la trates como el chollo que aparenta, y si la eliges dilo en la frase.",
    "",
    "Y escribe por qué ESE coche para ESTA persona. Una frase, y con una condición que no es negociable: tiene que NOMBRAR algo que ha contestado y unirlo a algo concreto de ese coche.",
    "",
    "Así no, porque vale para cualquiera y para cualquier coche:",
    "- «excelente precio y buen equilibrio entre equipamiento y coste»",
    "- «un compacto versátil y fiable, con un precio ajustado»",
    "- «moderno, eficiente y con un kilometraje bajo»",
    "",
    "Así sí, porque solo vale para esta persona:",
    "- «haces ciudad a diario y lo quieres más de siete años: el cambio automático y los 58.000 km te dejan margen de sobra»",
    "- «sin garaje, un gasolina te evita el problema de la recarga, y con 130 CV no vas justo cuando salís los cinco»",
    "",
    "Español de España, en frase, sin signos de exclamación y sin adjetivos de anuncio.",
    "",
    "Contesta solo con JSON, sin nada alrededor:",
    '{"elegidas":[{"n":1,"porque":"..."}]}',
  ].join("\n");
}

/**
 * Lo que dice el modelo, comprobado contra lo que se le dio.
 *
 * Un número que no existe, uno repetido o una respuesta que no es JSON no
 * pueden tumbar la búsqueda: se quedan fuera y se sigue con lo que valga.
 */
function loQueSePuedeCreer(respuesta, cuantasHay, cuantas) {
  const crudo = texto(respuesta);
  let leido = null;

  /*
   * Envuelto en comillas de codigo, o con una frase delante.
   *
   * Medido contra la API: Gemini devuelve el JSON dentro de ```json casi
   * siempre, y a veces con un «Aqui tienes» por delante. Se quita lo de fuera
   * y, si aun asi no se puede leer, se coge lo que hay entre la primera llave
   * y la ultima.
   */
  for (const intento of [
    () => crudo.replace(/^```(?:json)?/i, "").replace(/```$/, ""),
    () => crudo.slice(crudo.indexOf("{"), crudo.lastIndexOf("}") + 1),
  ]) {
    try {
      leido = JSON.parse(intento());
      break;
    } catch {
      leido = null;
    }
  }

  if (!leido) return null;

  const elegidas = Array.isArray(leido && leido.elegidas) ? leido.elegidas : [];
  const vistas = new Set();
  const buenas = [];

  for (const una of elegidas) {
    const n = Number(una && una.n);
    if (!Number.isInteger(n) || n < 1 || n > cuantasHay || vistas.has(n)) continue;
    vistas.add(n);
    buenas.push({ indice: n - 1, porque: texto(una && una.porque) });
    if (buenas.length >= cuantas) break;
  }

  return buenas.length ? buenas : null;
}

/** Se lo pregunta a Anthropic. Devuelve lo que diga, en texto. */
async function loQueDiceAnthropic(encargo, apiKey, fetchImpl, signal) {
  const respuesta = await fetchImpl(LA_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: EL_MODELO,
      max_tokens: 1500,
      messages: [{ role: "user", content: encargo }],
    }),
    signal,
  });

  if (!respuesta.ok) {
    console.warn("[el-cerebro-elige] Anthropic ha contestado " + respuesta.status);
    return "";
  }

  const datos = await respuesta.json();
  return ((datos && datos.content) || []).map((t) => texto(t && t.text)).join("");
}

/**
 * O a Google, que es la clave que hay, probando modelos hasta que uno conteste.
 *
 * Solo se pasa al siguiente cuando la respuesta significa «ahora no»: si el
 * modelo dice que la clave no vale o que la petición está mal, insistir con
 * otro sería repetir el mismo error cuatro veces.
 */
async function loQueDiceGoogle(encargo, apiKey, fetchImpl, signal) {
  const cuerpo = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: encargo }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  });

  for (const modelo of LOS_MODELOS_DE_GOOGLE) {
    const url = LA_API_DE_GOOGLE + "/" + modelo + ":generateContent?key=" + encodeURIComponent(apiKey);
    const respuesta = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: cuerpo,
      signal,
    });

    if (respuesta.ok) {
      const datos = await respuesta.json();
      const partes = (((datos || {}).candidates || [])[0] || {}).content || {};
      return ((partes.parts) || []).map((t) => texto(t && t.text)).join("");
    }

    console.warn("[el-cerebro-elige] " + modelo + " ha contestado " + respuesta.status);
    if (!AHORA_NO.includes(respuesta.status)) {
      return "";
    }
  }

  return "";
}

/**
 * Elige entre las ofertas y explica cada una.
 *
 * Devuelve `[{ oferta, porque }]` en el orden que dice el modelo, o `null` si
 * no hay clave, si falla, si tarda demasiado o si contesta algo que no se
 * puede creer. En todos esos casos quien llama sigue con lo que traía.
 */
async function elCerebroElige(opciones) {
  const {
    ofertas = [],
    answers = {},
    cuantas = 4,
    apiKey = process.env.ANTHROPIC_API_KEY,
    geminiKey = process.env.GEMINI_API_KEY,
    fetchImpl = typeof fetch === "function" ? fetch : null,
  } = opciones || {};

  const candidatas = (Array.isArray(ofertas) ? ofertas : []).slice(0, LAS_CANDIDATAS);

  /*
   * Anthropic si esta, y si no el que ya se paga.
   *
   * Se prefiere Anthropic porque razona mejor eligiendo, que es lo que se le
   * pide aqui. Pero no tener esa clave no puede significar quedarse sin el
   * paso entero: el encargo y la comprobacion de lo que contesta son los
   * mismos para los dos.
   */
  const quienElige = apiKey ? "anthropic" : geminiKey ? "google" : null;

  /*
   * Con cuatro candidatas y cuatro huecos no hay nada que elegir, y la llamada
   * costaria dinero para devolver las mismas cuatro.
   */
  if (!quienElige || !fetchImpl || candidatas.length <= cuantas) {
    return null;
  }

  const corta = new AbortController();
  const reloj = setTimeout(() => corta.abort(), LO_QUE_SE_LE_ESPERA_MS);

  try {
    const encargo = elEncargo(candidatas, answers, cuantas);
    const dicho = quienElige === "anthropic"
      ? await loQueDiceAnthropic(encargo, apiKey, fetchImpl, corta.signal)
      : await loQueDiceGoogle(encargo, geminiKey, fetchImpl, corta.signal);

    const buenas = loQueSePuedeCreer(dicho, candidatas.length, cuantas);

    if (!buenas) return null;

    return buenas.map(({ indice, porque }) => ({ oferta: candidatas[indice], porque }));
  } catch (err) {
    console.warn("[el-cerebro-elige] no ha podido elegir:", err && err.message);
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

module.exports = {
  elCerebroElige,
  comoSeLeCuenta,
  comoSeCuentaElCliente,
  loQueSePuedeCreer,
  elEncargo,
  LAS_CANDIDATAS,
  LO_SUBJETIVO,
  EL_MODELO,
  EL_MODELO_DE_GOOGLE,
};
