const JSON5 = require("json5");
const { jsonrepair } = require("jsonrepair");

function sanitizeJsonStringContent(input) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && (ch === "\n" || ch === "\r")) {
      result += "\\n";
      continue;
    }

    result += ch;
  }

  return result;
}

function extractJsonCandidate(rawText) {
  const text = String(rawText || "")
    .replace(/```json|```/gi, "")
    .trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function parseGeminiJson(text) {
  const candidate = sanitizeJsonStringContent(
    extractJsonCandidate(text)
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  );

  try {
    return JSON.parse(candidate);
  } catch {}

  try {
    return JSON5.parse(candidate);
  } catch {}

  try {
    const repaired = jsonrepair(candidate);
    return JSON.parse(repaired);
  } catch {}

  try {
    const singleQuotedKeys = candidate.replace(/([{,]\s*)'([^'\\]+?)'\s*:/g, '$1"$2":');
    return JSON.parse(singleQuotedKeys);
  } catch {}

  try {
    const repaired = candidate
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(repaired);
  } catch {}

  return null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeAlternative(item) {
  return {
    tipo: normalizeText(item?.tipo),
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
    titulo: normalizeText(item?.titulo),
    razon: normalizeText(item?.razon),
  };
}

function normalizeAdvisorResult(value) {
  const main = value?.solucion_principal || {};

  return {
    alineacion_pct: Number.isFinite(Number(value?.alineacion_pct)) ? Number(value.alineacion_pct) : 0,
    solucion_principal: {
      tipo: normalizeText(main.tipo),
      score: Number.isFinite(Number(main.score)) ? Number(main.score) : 0,
      titulo: normalizeText(main.titulo),
      resumen: normalizeText(main.resumen),
      ventajas: normalizeStringArray(main.ventajas),
      inconvenientes: normalizeStringArray(main.inconvenientes),
      coste_estimado: normalizeText(main.coste_estimado),
      empresas_recomendadas: normalizeStringArray(main.empresas_recomendadas),
      etiqueta_dgt: normalizeText(main.etiqueta_dgt),
      tension_principal: normalizeText(main.tension_principal),
    },
    alternativas: Array.isArray(value?.alternativas)
      ? value.alternativas.map(normalizeAlternative).filter((item) => item.titulo || item.razon)
      : [],
    tco_aviso: normalizeText(value?.tco_aviso),
    consejo_experto: normalizeText(value?.consejo_experto),
    siguiente_paso: normalizeText(value?.siguiente_paso),
    propulsiones_viables: normalizeStringArray(value?.propulsiones_viables),
  };
}

function isCompleteAdvisorResult(value) {
  const normalized = normalizeAdvisorResult(value);
  const main = normalized.solucion_principal;

  return Boolean(
    normalized.alineacion_pct > 0 &&
      main.tipo &&
      main.score > 0 &&
      main.titulo &&
      main.resumen &&
      main.ventajas.length >= 2 &&
      main.inconvenientes.length >= 1 &&
      main.coste_estimado &&
      main.empresas_recomendadas.length >= 1 &&
      normalized.alternativas.length >= 1 &&
      normalized.tco_aviso &&
      normalized.consejo_experto &&
      normalized.siguiente_paso &&
      normalized.propulsiones_viables.length >= 1
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function includesAnswer(value, expected) {
  return asArray(value).includes(expected);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getVehicleProfile(answers) {
  if (answers.ocupantes === "7") {
    return "un familiar grande o un monovolumen";
  }

  if (answers.carroceria === "suv_crossover") {
    return "un SUV compacto racional";
  }

  if (answers.carroceria === "berlina_familiar") {
    return "una berlina o un familiar eficiente";
  }

  return "un compacto equilibrado";
}

function getViablePropulsions(answers) {
  const propulsions = [];
  const noGarage = answers.garaje === "sin_garaje";
  const ownCharger = answers.garaje === "garaje_cargador";
  const highwayUse = answers.entorno_uso === "autopista";
  const highZbe = answers.zbe_impacto === "alta";

  if (ownCharger && !highwayUse) {
    propulsions.push("electrico", "PHEV", "hibrido");
  } else if (ownCharger) {
    propulsions.push("PHEV", "hibrido", "gasolina eficiente");
  } else if (noGarage) {
    propulsions.push("hibrido", highZbe ? "PHEV" : "gasolina eficiente");
  } else {
    propulsions.push("hibrido", "PHEV", "gasolina eficiente");
  }

  if (answers.propulsion_preferida === "electrico" && ownCharger && !propulsions.includes("electrico")) {
    propulsions.unshift("electrico");
  }

  if (answers.propulsion_preferida === "gasolina" && !propulsions.includes("gasolina eficiente")) {
    propulsions.push("gasolina eficiente");
  }

  return [...new Set(propulsions)].slice(0, 3);
}

function getPrimaryType(answers) {
  const flexibility = answers.flexibilidad;
  const lowKm = answers.km_anuales === "menos_10k";
  const cityUse = answers.entorno_uso === "ciudad";
  const dailyCommute = includesAnswer(answers.uso_principal, "trabajo_diario");

  if (flexibility === "propiedad_contado") {
    return "compra_contado";
  }

  if (flexibility === "propiedad_financiada") {
    return "compra_financiada";
  }

  if (flexibility === "renting") {
    return "renting_largo";
  }

  if (flexibility === "flexible") {
    if (lowKm && cityUse && !dailyCommute) {
      return "carsharing";
    }

    return "renting_corto";
  }

  if (lowKm && cityUse && !dailyCommute) {
    return "transporte_publico";
  }

  return answers.cuota_mensual === "menos_200" ? "compra_contado" : "compra_financiada";
}

function getCompaniesForType(type) {
  const companiesByType = {
    compra_contado: ["Coches.net", "Autohero", "Spoticar"],
    compra_financiada: ["Coches.net", "Flexicar", "Concesionario oficial"],
    renting_largo: ["Ayvens", "Arval", "Alphabet"],
    renting_corto: ["Northgate", "Free2move", "OK Mobility"],
    rent_a_car: ["Enterprise", "Sixt", "OK Mobility"],
    carsharing: ["Free2move", "Zity", "Wible"],
    carpooling: ["BlaBlaCar", "Hoop Carpool", "Amovens"],
    transporte_publico: ["Renfe Cercanias", "EMT", "TMB"],
    micromovilidad: ["Acciona", "Lime", "Bolt"],
  };

  return companiesByType[type] || ["Coches.net", "Autohero", "Ayvens"];
}

function getCostEstimate(type, answers) {
  const bands = {
    menos_10k: [120, 260],
    "10k_20k": [260, 430],
    mas_20k: [430, 700],
  };
  const [minBand, maxBand] = bands[answers.km_anuales] || [250, 420];

  const offsets = {
    compra_contado: [80, 120],
    compra_financiada: [220, 320],
    renting_largo: [200, 280],
    renting_corto: [260, 360],
    rent_a_car: [320, 420],
    carsharing: [-40, 30],
    carpooling: [-90, -20],
    transporte_publico: [-120, -40],
    micromovilidad: [-140, -60],
  };

  const [minOffset, maxOffset] = offsets[type] || [0, 0];
  const min = Math.max(40, minBand + minOffset);
  const max = Math.max(min + 40, maxBand + maxOffset);

  return `${min} - ${max} EUR/mes`;
}

function getDgtLabel(propulsions) {
  if (propulsions.includes("electrico") || propulsions.includes("PHEV")) {
    return "CERO";
  }

  if (propulsions.includes("hibrido")) {
    return "ECO";
  }

  return "C";
}

function getTensionPrincipal(answers, primaryType) {
  if (answers.propulsion_preferida === "electrico" && answers.garaje === "sin_garaje") {
    return "Quieres electrificacion total, pero sin punto de carga propio el uso diario depende demasiado de la infraestructura publica.";
  }

  if (answers.marca_preferencia === "premium" && (answers.cuota_mensual === "menos_200" || answers.capital_propio === "menos_5k")) {
    return "Hay una tension clara entre aspiracion de marca premium y margen financiero disponible para asumir compra, seguro y mantenimiento sin estrecharte.";
  }

  if (answers.zbe_impacto === "alta" && answers.propulsion_preferida === "gasolina") {
    return "Te afectan mucho las ZBE y, aun asi, priorizas gasolina; eso reduce margen de maniobra regulatoria a medio plazo.";
  }

  if (primaryType === "renting_corto" && answers.horizonte === "mas_7") {
    return "Buscas flexibilidad alta, pero a largo plazo suele salir mas caro que una compra bien elegida.";
  }

  return "Tu caso exige equilibrar coste mensual, uso real y riesgo futuro sin sobredimensionar coche ni motorizacion.";
}

function buildAlternatives(primaryType, answers) {
  const profile = getVehicleProfile(answers);
  const alternativesByType = {
    compra_contado: [
      { tipo: "compra_financiada", score: 76, titulo: `Compra financiada de ${profile}`, razon: "Tiene sentido si prefieres preservar liquidez y mantienes una cuota por debajo de tu limite comodo." },
      { tipo: "renting_largo", score: 68, titulo: "Renting con cuota cerrada", razon: "Buena opcion si priorizas previsibilidad de gasto y no quieres asumir depreciacion ni venta futura." },
    ],
    compra_financiada: [
      { tipo: "renting_largo", score: 79, titulo: "Renting a largo plazo", razon: "Reduce riesgo operativo y fija gasto si valoras tranquilidad mas que propiedad." },
      { tipo: "compra_contado", score: 66, titulo: `Compra al contado de ${profile}`, razon: "Interesa si puedes aumentar entrada y evitar coste financiero en una unidad fiable." },
    ],
    renting_largo: [
      { tipo: "compra_financiada", score: 74, titulo: `Compra financiada de ${profile}`, razon: "Puede ser mas rentable si vas a mantener el vehiculo varios anos y eliges una version liquida." },
      { tipo: "renting_corto", score: 64, titulo: "Renting flexible", razon: "Solo compensa si preves cambios de vida cercanos y quieres posponer la decision final." },
    ],
    renting_corto: [
      { tipo: "carsharing", score: 72, titulo: "Carsharing + transporte publico", razon: "Muy competitivo si haces pocos kilometros y la mayor parte del uso es urbano y puntual." },
      { tipo: "renting_largo", score: 67, titulo: "Renting a largo plazo", razon: "Mejora coste total si tu patron de uso ya esta bastante definido." },
    ],
    carsharing: [
      { tipo: "transporte_publico", score: 77, titulo: "Transporte publico como base", razon: "Reduce aun mas el coste fijo si puedes cubrir el dia a dia sin coche propio." },
      { tipo: "renting_corto", score: 63, titulo: `Renting corto de ${profile}`, razon: "Solo merece la pena si tu uso puntual empieza a crecer y necesitas mas disponibilidad." },
    ],
    transporte_publico: [
      { tipo: "carsharing", score: 73, titulo: "Carsharing para fines de semana", razon: "Complementa bien desplazamientos ocasionales sin asumir cuota mensual fija alta." },
      { tipo: "micromovilidad", score: 61, titulo: "Micromovilidad urbana", razon: "Encaja si la mayoria de trayectos son cortos y dentro de ciudad." },
    ],
  };

  return alternativesByType[primaryType] || [
    { tipo: "compra_financiada", score: 70, titulo: `Compra financiada de ${profile}`, razon: "Mantiene equilibrio entre control mensual, disponibilidad total y valor residual." },
    { tipo: "renting_largo", score: 65, titulo: "Renting con servicios incluidos", razon: "Interesa si priorizas simplificar gestion y fijar coste total." },
  ];
}

function buildFallbackAdvisorResult(answers = {}) {
  const primaryType = getPrimaryType(answers);
  const propulsions = getViablePropulsions(answers);
  const dgtLabel = getDgtLabel(propulsions);
  const vehicleProfile = getVehicleProfile(answers);
  const highRiskControl = answers.gestion_riesgo === "alto";
  const highZbe = answers.zbe_impacto === "alta";
  const scoreBase = 78
    + (highRiskControl ? 4 : 0)
    + (highZbe && dgtLabel !== "C" ? 4 : 0)
    - (answers.propulsion_preferida === "electrico" && answers.garaje === "sin_garaje" ? 8 : 0)
    - (answers.marca_preferencia === "premium" && answers.cuota_mensual === "menos_200" ? 5 : 0);
  const score = clamp(scoreBase, 68, 92);
  const companies = getCompaniesForType(primaryType);
  const cost = getCostEstimate(primaryType, answers);
  const tension = getTensionPrincipal(answers, primaryType);

  const titles = {
    compra_contado: `Compra al contado de ${vehicleProfile}`,
    compra_financiada: `Compra financiada de ${vehicleProfile}`,
    renting_largo: `Renting a largo plazo de ${vehicleProfile}`,
    renting_corto: `Solucion flexible a corto plazo para ${vehicleProfile}`,
    carsharing: "Carsharing combinado con transporte publico",
    transporte_publico: "Transporte publico como base de movilidad",
    micromovilidad: "Micromovilidad urbana con apoyo ocasional",
    rent_a_car: "Alquiler por uso para demanda puntual",
    carpooling: "Carpooling como solucion principal de ahorro",
  };

  const summary = `Por tu patron de uso ${answers.entorno_uso || "mixto"}, tu horizonte ${answers.horizonte || "medio"} y tu nivel de riesgo ${answers.gestion_riesgo || "medio"}, encaja mejor ${titles[primaryType] || "una solucion equilibrada"}. Esta opcion reduce friccion operativa, mantiene el coste en una zona razonable y evita sobredimensionar motorizacion o formato.`;

  return normalizeAdvisorResult({
    alineacion_pct: score,
    solucion_principal: {
      tipo: primaryType,
      score,
      titulo: titles[primaryType] || `Solucion prioritaria para ${vehicleProfile}`,
      resumen: summary,
      ventajas: [
        `Se adapta mejor a un uso ${answers.entorno_uso || "mixto"} con ${answers.km_anuales || "kilometraje medio"} sin disparar el coste total.`,
        `Encaja con tu horizonte ${answers.horizonte || "de uso"} y te deja una salida mas limpia si cambian tus necesidades.`,
        `Permite priorizar ${vehicleProfile} con etiqueta ${dgtLabel} y una oferta realista en el mercado espanol actual.`,
      ],
      inconvenientes: [
        "Requiere comparar varias ofertas y no aceptar la primera propuesta comercial sin revisar coste total.",
        highRiskControl
          ? "Conviene exigir trazabilidad, garantia o condiciones cerradas para no introducir riesgo evitable."
          : "Si cambian tus habitos de uso, puede hacer falta reajustar formato o modalidad antes de lo previsto.",
      ],
      coste_estimado: cost,
      empresas_recomendadas: companies,
      etiqueta_dgt: dgtLabel,
      tension_principal: tension,
    },
    alternativas: buildAlternatives(primaryType, answers),
    tco_aviso: `Tu coste real no deberia medirse solo por cuota o precio de compra: con tu perfil pesan tambien seguro, mantenimiento, combustible/energia y depreciacion, especialmente si eliges un coche mayor o mas premium de lo necesario.`,
    consejo_experto: highZbe
      ? "Si entras a ZBE con frecuencia, prioriza versiones con etiqueta ECO o CERO y confirma por VIN o ficha tecnica la etiqueta exacta antes de cerrar nada."
      : "Pide siempre oferta desglosada con precio final, comision, vinculaciones y coste total a 36-72 meses; ahi es donde suelen esconderse las peores decisiones.",
    siguiente_paso: `Esta semana compara 3 ofertas de ${companies.slice(0, 2).join(" y ")} para ${vehicleProfile} y descarta cualquier opcion cuyo coste total se aleje de ${cost} o no encaje con ${propulsions.join(", ")}.`,
    propulsiones_viables: propulsions,
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      code: "API_KEY_MISSING",
      error: "GEMINI_API_KEY is not configured",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const prompt = body?.prompt;
    const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Descubre modelos compatibles con generateContent para evitar fallos por nombres no disponibles.
    const modelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const modelsData = await modelsResponse.json();

    const availableModelNames = (modelsData?.models || [])
      .filter((model) => Array.isArray(model?.supportedGenerationMethods))
      .filter((model) => model.supportedGenerationMethods.includes("generateContent"))
      .map((model) => model.name)
      .filter(Boolean);

    const preferredModels = [
      "models/gemini-2.0-flash",
      "models/gemini-2.0-flash-lite",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro",
    ];

    const orderedModels = [
      ...preferredModels.filter((name) => availableModelNames.includes(name)),
      ...availableModelNames.filter((name) => !preferredModels.includes(name) && name.includes("gemini")),
      ...availableModelNames.filter((name) => !name.includes("gemini")),
    ];

    if (orderedModels.length === 0) {
      return res.status(400).json({
        code: "MODEL_NOT_AVAILABLE",
        error: "Tu API key no tiene modelos compatibles con generateContent en v1beta.",
      });
    }

    async function generateContent(promptText) {
      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          maxOutputTokens: 2200,
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      };

      let response;
      let data;
      let lastErrorStatus = 500;
      let lastErrorData = { error: "No se pudo completar la solicitud" };

      for (const modelName of orderedModels) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        data = await response.json();

        if (response.ok) {
          return { ok: true, data, modelName };
        }

        lastErrorStatus = response.status;
        lastErrorData = data;
      }

      return {
        ok: false,
        status: lastErrorStatus,
        data: lastErrorData,
      };
    }

    const generation = await generateContent(prompt);

    if (!generation.ok) {
      const lastErrorStatus = generation.status;
      const lastErrorData = generation.data;
      const errorMessage = lastErrorData?.error?.message || "";
      const isQuotaExceeded =
        lastErrorStatus === 429 ||
        /quota exceeded|rate limit|exceeded your current quota/i.test(errorMessage);

      if (isQuotaExceeded) {
        return res.status(429).json({
          code: "QUOTA_EXCEEDED",
          error:
            "Tu clave de Gemini no tiene cuota disponible ahora mismo. Crea otra API key en AI Studio o espera a que se reinicie la cuota.",
        });
      }

      return res.status(lastErrorStatus).json(lastErrorData);
    }

    // Normalizar respuesta al formato que espera App.js
    const text = generation.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = parseGeminiJson(text);

    if (parsed && isCompleteAdvisorResult(parsed)) {
      return res.status(200).json({ parsed: normalizeAdvisorResult(parsed) });
    }

    const repairPrompt = `${prompt}\n\nLa respuesta anterior ha llegado incompleta o con campos vacios. Repite el analisis y devuelve JSON VALIDO COMPLETO. Requisitos obligatorios:\n- No dejes ningun string vacio.\n- Incluye exactamente 3 ventajas.\n- Incluye exactamente 2 inconvenientes.\n- Incluye exactamente 2 alternativas con titulo, score y razon.\n- Incluye al menos 3 empresas_recomendadas reales en Espana.\n- Incluye consejo_experto, siguiente_paso y tco_aviso con contenido concreto.\n- Devuelve solo JSON.`;

    const repairedGeneration = await generateContent(repairPrompt);

    if (repairedGeneration.ok) {
      const repairedText = repairedGeneration.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const repairedParsed = parseGeminiJson(repairedText);

      if (repairedParsed && isCompleteAdvisorResult(repairedParsed)) {
        return res.status(200).json({ parsed: normalizeAdvisorResult(repairedParsed) });
      }
    }

    return res.status(200).json({
      parsed: buildFallbackAdvisorResult(answers),
      meta: {
        source: "fallback",
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
