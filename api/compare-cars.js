/**
 * Comparador de coches.
 *
 * Recibe entre dos y cinco vehículos con marca, modelo, versión, potencia y
 * año, y devuelve una puntuación por coche y una recomendación razonada.
 *
 * Sobre lo que puede y no puede afirmar: la comparación se hace sobre datos
 * generales de mercado, no sobre las unidades concretas que el usuario esté
 * mirando. No sabe el estado real de ningún coche, ni sus kilómetros, ni su
 * historial. Eso lo dice la respuesta y lo repite la pantalla, porque un
 * comparador que da un ganador sin decir sobre qué compara invita a confiar
 * más de lo que puede sostener.
 */

const MAXIMO = 5;
const MINIMO = 2;

function texto(v) {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function normalizarCoches(entrada) {
  if (!Array.isArray(entrada)) return [];
  return entrada
    .slice(0, MAXIMO)
    .map((c, i) => ({
      id: texto(c?.id) || `coche-${i + 1}`,
      marca: texto(c?.marca),
      modelo: texto(c?.modelo),
      version: texto(c?.version),
      cv: Number.parseInt(texto(c?.cv), 10) || null,
      anio: Number.parseInt(texto(c?.anio), 10) || null,
    }))
    .filter((c) => c.marca && c.modelo);
}

function etiqueta(c) {
  return [c.marca, c.modelo, c.version, c.cv ? `${c.cv} CV` : "", c.anio || ""]
    .filter(Boolean)
    .join(" ");
}

function construirPrompt(coches, idioma) {
  const lista = coches
    .map((c, i) => `${i + 1}. id=${c.id} · ${etiqueta(c)}`)
    .join("\n");

  const enEspanol = idioma !== "en";

  return `Eres un asesor de compra de coches en España. Compara estos ${coches.length} vehículos y di cuál conviene más.

VEHÍCULOS:
${lista}

Devuelve SOLO un JSON válido con esta forma exacta:

{
  "ganador_id": "<el id del coche que recomiendas>",
  "resumen": "<2-3 frases: por qué gana ese y para quién>",
  "criterios": ["<4 criterios que has usado para puntuar>"],
  "coches": [
    {
      "id": "<id>",
      "puntuacion": <0-100>,
      "puesto": <1 = mejor>,
      "titular": "<una frase que resuma este coche>",
      "fuerte": ["<2-3 puntos fuertes>"],
      "flojo": ["<2-3 puntos débiles>"],
      "detalle": {
        "fiabilidad": <0-100>,
        "coste_uso": <0-100>,
        "equipamiento": <0-100>,
        "prestaciones": <0-100>,
        "valor_reventa": <0-100>
      }
    }
  ],
  "cara_a_cara": "<un párrafo comparando directamente el ganador con el segundo: qué se gana y qué se pierde eligiendo uno u otro>",
  "cuando_elegir_otro": [
    { "id": "<id de un coche que no gana>", "motivo": "<en qué caso concreto sería mejor elección>" }
  ],
  "limites": "<qué NO puede saber esta comparación>"
}

REGLAS:
- Un objeto en "coches" por cada vehículo de la lista, con su id exacto. Ninguno se queda fuera.
- Las puntuaciones tienen que discriminar: si dos coches empatan, desempata y explica por qué.
- "puesto" va de 1 a ${coches.length}, sin repetir.
- En "limites" di con claridad que la comparación es sobre datos generales de modelo, y que no incluye el estado real, los kilómetros ni el historial de ninguna unidad concreta; que eso solo lo dice una revisión del coche.
- No inventes precios de unidades concretas ni ofertas.
- Escribe en ${enEspanol ? "español de España" : "inglés"}, en frases, sin exclamaciones.
- Devuelve solo el JSON, sin texto alrededor.`;
}

function extraerJson(bruto) {
  const t = String(bruto || "").replace(/```json|```/gi, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  const candidato = a !== -1 && b > a ? t.slice(a, b + 1) : t;
  try {
    return JSON.parse(candidato);
  } catch {
    try {
      return JSON.parse(candidato.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

/** Comprueba que la respuesta sirve antes de enseñarla. */
function esUtil(r, coches) {
  if (!r || typeof r !== "object") return false;
  if (!Array.isArray(r.coches) || r.coches.length !== coches.length) return false;
  const ids = new Set(coches.map((c) => c.id));
  if (!r.coches.every((c) => ids.has(c?.id))) return false;
  if (!ids.has(r.ganador_id)) return false;
  return r.coches.every((c) => Number.isFinite(Number(c?.puntuacion)));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      code: "API_KEY_MISSING",
      error: "El comparador no está configurado en este entorno.",
    });
  }

  let cuerpo;
  try {
    cuerpo = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: "Cuerpo de la petición no válido." });
  }

  const coches = normalizarCoches(cuerpo.coches);
  const idioma = cuerpo.uiLanguage === "en" ? "en" : "es";

  if (coches.length < MINIMO) {
    return res.status(400).json({
      code: "POCOS_COCHES",
      error: `Hacen falta al menos ${MINIMO} coches con marca y modelo para comparar.`,
    });
  }

  try {
    // Los alias «-latest» siguen al modelo vigente; los nombres con version se
    // retiran cada pocos meses y dejan la llamada rota.
    // gemini-flash-latest queda fuera a proposito: hoy no responde —la peticion
    // se queda colgada indefinidamente en vez de dar error—, y como alias que
    // es puede volver a apuntar a algo roto en cualquier momento. Los nombres
    // con version responden en menos de un segundo.
    const modelos = [
      "models/gemini-2.5-flash",
      "models/gemini-flash-lite-latest",
      "models/gemini-2.5-flash-lite",
    ];

    // Un modelo que no contesta no puede llevarse por delante toda la peticion:
    // se corta y se prueba el siguiente.
    const LIMITE_MS = 20000;

    const prompt = construirPrompt(coches, idioma);
    let ultimoError = { estado: 502, datos: { error: "No se pudo completar la comparación." } };

    for (const modelo of modelos) {
      const corte = new AbortController();
      const reloj = setTimeout(() => corte.abort(), LIMITE_MS);
      let respuesta;
      try {
        respuesta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          signal: corte.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 2600,
              responseMimeType: "application/json",
              temperature: 0.35,
            },
          }),
        }
      );
      } catch (e) {
        clearTimeout(reloj);
        ultimoError = { estado: 504, datos: { code: "SIN_RESPUESTA", error: "El proveedor no respondio a tiempo." } };
        continue;
      }
      clearTimeout(reloj);

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        ultimoError = { estado: respuesta.status, datos: datos || { error: "Error del proveedor." } };
        continue;
      }

      const bruto = datos?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parseado = extraerJson(bruto);

      if (esUtil(parseado, coches)) {
        // Se devuelve tambien la etiqueta de cada coche para que la pantalla no
        // tenga que reconstruirla y no puedan descuadrarse.
        const porId = Object.fromEntries(coches.map((c) => [c.id, etiqueta(c)]));
        return res.status(200).json({
          ...parseado,
          coches: parseado.coches.map((c) => ({ ...c, etiqueta: porId[c.id] || c.id })),
        });
      }

      ultimoError = { estado: 502, datos: { code: "RESPUESTA_INCOMPLETA", error: "La comparación llegó incompleta." } };
    }

    return res.status(ultimoError.estado).json(ultimoError.datos);
  } catch (e) {
    return res.status(500).json({ error: "Error inesperado en la comparación.", detail: e.message });
  }
};
