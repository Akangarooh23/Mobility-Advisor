import { postAnalyzeJson, postListingJson } from "./apiClient";
import { parseAdvisorJson } from "./advisorResults";
import { inferBrandPreferenceFromBrand, mapFuelToPreference } from "./businessHelpers";
import { normalizeText } from "./offerHelpers";

export const ANALYSIS_LOADING_PHASES = [
  "Evaluando patrón de uso real...",
  "Calculando TCO estimado...",
  "Analizando etiqueta DGT y ZBE...",
  "Detectando tensiones activas...",
  "Calculando zona de intersección...",
  "Generando recomendación personalizada...",
];

export async function requestAiJson(prompt, extraPayload = {}, options = {}) {
  const { onApiKeyMissing } = options;
  const { response, data } = await postAnalyzeJson({
    prompt,
    ...extraPayload,
  });

  if (!response.ok) {
    const error = new Error(data.error?.message || data.error || "Error desconocido");

    if (data.code === "API_KEY_MISSING") {
      onApiKeyMissing?.();
      error.code = "API_KEY_MISSING";
    }

    throw error;
  }

  if (data.parsed && typeof data.parsed === "object") {
    return data.parsed;
  }

  const text = data.content?.map((item) => item.text || "").join("") || "";
  return parseAdvisorJson(text);
}

export function buildAnswersSummary(finalAnswers, activeSteps = []) {
  return activeSteps
    .map((stepConfig) => {
      if (Array.isArray(stepConfig?.compositeKeys) && stepConfig.compositeKeys.length > 0) {
        const horizonTenenciaValue = finalAnswers?.horizonte_tenencia || "";
        const antiguedadVehiculoValue = finalAnswers?.antiguedad_vehiculo_buscada || "";
        const antiguedadMode = stepConfig.fields?.antiguedad_vehiculo_buscada?.selectionMode;
        const resolveRangeLabel = (value, options = []) => {
          const resolveSingle = (singleValue) =>
            options.find((opt) => opt.value === singleValue)?.label || "No indicado";

          if (Array.isArray(value) && value.length > 0) {
            const startLabel = resolveSingle(value[0]);
            const endLabel = resolveSingle(value[value.length - 1]);
            return startLabel === endLabel ? startLabel : `${startLabel} → ${endLabel}`;
          }

          return resolveSingle(value);
        };

        const resolveMultiLabel = (value, options = []) => {
          if (!Array.isArray(value) || value.length === 0) {
            return "No indicado";
          }

          return value
            .filter(Boolean)
            .map((singleValue) => options.find((opt) => opt.value === singleValue)?.label || singleValue)
            .join(", ");
        };

        const horizonLabel = resolveRangeLabel(horizonTenenciaValue, stepConfig.fields?.horizonte_tenencia?.options || []);
        const antiguedadLabel = antiguedadMode === "multi"
          ? resolveMultiLabel(antiguedadVehiculoValue, stepConfig.fields?.antiguedad_vehiculo_buscada?.options || [])
          : resolveRangeLabel(antiguedadVehiculoValue, stepConfig.fields?.antiguedad_vehiculo_buscada?.options || []);

        return `- ${stepConfig.fields?.horizonte_tenencia?.title || "Horizonte de tenencia"}: ${horizonLabel}\n- ${stepConfig.fields?.antiguedad_vehiculo_buscada?.title || "Antigüedad del vehículo"}: ${antiguedadLabel}`;
      }

      if (stepConfig?.type === "score_weights") {
        const value = finalAnswers?.[stepConfig.id];
        const metrics = Array.isArray(stepConfig?.metrics) ? stepConfig.metrics : [];
        const findAnswerStep = (answerKey) =>
          activeSteps.find((item) => item?.id === answerKey)
          || activeSteps.find((item) => Array.isArray(item?.compositeKeys) && item.compositeKeys.includes(answerKey));
        const resolveSelectedAnswer = (answerKey) => {
          const answerValue = finalAnswers?.[answerKey];
          const answerStep = findAnswerStep(answerKey);

          if (Array.isArray(answerStep?.compositeKeys)) {
            const options = answerStep?.fields?.[answerKey]?.options || [];
            if (Array.isArray(answerValue)) {
              return answerValue
                .filter(Boolean)
                .map((item) => options.find((opt) => opt.value === item)?.label || item)
                .join(", ");
            }
            return options.find((opt) => opt.value === answerValue)?.label || "No indicado";
          }

          if (Array.isArray(answerValue)) {
            const options = answerStep?.options || [];
            return answerValue
              .filter(Boolean)
              .map((item) => options.find((opt) => opt.value === item)?.label || item)
              .join(", ");
          }

          const options = answerStep?.options || [];
          return options.find((opt) => opt.value === answerValue)?.label || answerValue || "No indicado";
        };
        const ranking = metrics
          .map((metric) => {
            const rank = Number(value?.[metric.key]);
            return Number.isFinite(rank)
              ? `${metric.label} (${resolveSelectedAnswer(metric.key)}): ${rank}`
              : `${metric.label}: No indicado`;
          })
          .join(" | ");

        return `- ${stepConfig.question}: ${ranking}`;
      }

      const value = finalAnswers?.[stepConfig.id];
      const normalizedValue = Array.isArray(value) ? value.join(", ") : value || "No indicado";
      return `- ${stepConfig.question}: ${normalizedValue}`;
    })
    .join("\n");
}

export function buildAdviceAnalysisPrompt({ answersSummary, advisorContext = null }) {
  const forcedTypeInstruction = advisorContext === "renting"
    ? `Restriccion obligatoria de contexto: el usuario ha entrado por la via de renting. La solucion_principal.tipo y las alternativas SOLO pueden ser renting_largo, renting_corto, rent_a_car o carsharing. No puedes devolver compra_contado ni compra_financiada.`
    : advisorContext === "buy"
    ? `Restriccion obligatoria de contexto: el usuario ha entrado por la via de compra. La solucion_principal.tipo y las alternativas SOLO pueden ser compra_contado o compra_financiada. No puedes devolver renting_largo, renting_corto, rent_a_car ni carsharing.`
    : "";

  return `Eres un asesor experto en movilidad en Espana. Analiza este perfil y responde SOLO con JSON valido, sin markdown ni texto adicional.

Debes devolver exactamente esta estructura:
{
  "alineacion_pct": 78,
  "solucion_principal": {
    "tipo": "compra_contado|compra_financiada|renting_largo|renting_corto|rent_a_car|carsharing|carpooling|transporte_publico|micromovilidad",
    "score": 85,
    "titulo": "titulo atractivo y especifico",
    "resumen": "2-3 frases explicando por que es la mejor opcion para este perfil concreto",
    "ventajas": ["ventaja 1 especifica", "ventaja 2", "ventaja 3"],
    "inconvenientes": ["inconveniente 1 real", "inconveniente 2"],
    "coste_estimado": "rango realista en EUR/mes incluyendo todos los costes",
    "empresas_recomendadas": ["empresa real en Espana 1", "empresa 2", "empresa 3"],
    "etiqueta_dgt": "CERO|ECO|C|B|No aplica",
    "tension_principal": "descripcion de la tension mas relevante detectada entre deseos y realidad"
  },
  "score_desglose": {
    "encaje_uso": 24,
    "coste_total": 17,
    "flexibilidad": 18,
    "viabilidad_real": 15,
    "ajuste_preferencias": 11
  },
  "por_que_gana": ["motivo 1", "motivo 2", "motivo 3", "motivo 4"],
  "alternativas": [
    { "tipo": "...", "score": 70, "titulo": "...", "razon": "1-2 frases con argumento concreto" },
    { "tipo": "...", "score": 60, "titulo": "...", "razon": "1-2 frases con argumento concreto" }
  ],
  "comparador_final": [
    { "criterio": "coste total real", "opcion_principal": "...", "alternativa_1": "...", "alternativa_2": "...", "ganador": "principal|alternativa_1|alternativa_2" },
    { "criterio": "flexibilidad", "opcion_principal": "...", "alternativa_1": "...", "alternativa_2": "...", "ganador": "principal|alternativa_1|alternativa_2" }
  ],
  "transparencia": {
    "confianza_nivel": "alta|media|ajustada",
    "confianza_motivo": "por que esta recomendacion es mas o menos robusta",
    "supuestos_clave": ["supuesto 1", "supuesto 2", "supuesto 3"],
    "validaciones_pendientes": ["validacion 1", "validacion 2"]
  },
  "plan_accion": {
    "semaforo": "verde|ambar|rojo",
    "estado": "mensaje corto de decision",
    "resumen": "como deberia actuar el usuario ahora mismo",
    "acciones": ["accion 1", "accion 2", "accion 3"],
    "alertas_rojas": ["riesgo 1", "riesgo 2"]
  },
  "tco_aviso": "aviso concreto sobre el TCO real estimado para este perfil en Espana",
  "tco_detalle": {
    "concepto_base": "cuota / base que mas pesa en esta solucion",
    "entrada_inicial": 4000,
    "base_mensual": 320,
    "seguro": 55,
    "energia": 60,
    "mantenimiento": 35,
    "extras": 25,
    "total_mensual": 495,
    "total_anual": 5940,
    "nota": "lectura corta y util de que incluye este TCO"
  },
  "consejo_experto": "consejo practico muy especifico para Espana que normalmente no se conoce",
  "siguiente_paso": "accion concreta que deberia hacer esta semana",
  "propulsiones_viables": ["hibrido suave", "PHEV", "electrico"]
}

Criterios de analisis:
- ${forcedTypeInstruction || "Respeta el contexto declarado por el usuario y evita recomendar categorias incompatibles con su via de entrada si esa intencion ya es clara."}
- Considera financiacion, TCO, restricciones ZBE, viabilidad de electrificacion, depreciacion y riesgo.
- No dejes el TCO en abstracto: cuantifica un desglose mensual razonable con base, seguro, energia, mantenimiento, extras, total mensual y total anual.
- Añade transparencia real: incluye comparador_final y transparencia para explicar por que gana esta opcion y que validaciones quedan pendientes.
- Añade un plan_accion claro con semaforo (verde, ambar o rojo), acciones concretas y alertas rojas para la decision final.
- Si el test avanzado aporta datos de garaje, ZBE, capital inicial, control de riesgo o tipo de zona, usalos para afinar de verdad la recomendacion.
- Explica el score con logica de encaje de uso, coste total, flexibilidad, viabilidad real y ajuste con preferencias.
- Si existe una respuesta de prioridades finales, trata los criterios con prioridad 5 como restricciones casi obligatorias, los de 4 como preferencias fuertes, los de 3 como preferencias normales y los de 1-2 como criterios relajables.
- Si marca, motorizacion, tipo de compra, antiguedad o plazas tienen prioridad alta, las ofertas y propulsiones viables deben respetar eso de forma clara salvo imposibilidad real del mercado.
- Prioriza opciones realistas en Espana para el perfil dado.
- Si el horizonte es "Menos de 1 año", prioriza renting_corto o suscripción flexible antes que compra o renting largo.
- Si recomiendas electrico puro, explicita claramente los requisitos de carga y validalos en el siguiente paso.
- Si recomiendas compra financiada, indica que la validacion de capacidad financiera y scoring se hara en el siguiente paso sobre el shortlist de coches.
- Si recomiendas renting, indica que la validacion de cuota mensual objetivo y estabilidad de ingresos se hara al final como siguiente paso.
- Valora flexibilidad vs propiedad y horizonte temporal.

Perfil del usuario:
${answersSummary}`;
}

export function buildDecisionAnalysisPrompt({
  decisionAnswers,
  labels,
}) {
  return `Eres un asesor experto en compra y renting de coches en Espana. Analiza este caso y responde SOLO con JSON valido, sin markdown.

Devuelve exactamente esta estructura:
{
  "resumen": "2-3 frases con la lectura global del caso",
  "criterio_principal": "el criterio clave que manda la decision",
  "oferta_top": {
    "titulo": "nombre de la opcion mas sensata",
    "precio_objetivo": "precio objetivo o rango total en EUR",
    "cuota_estimada": "cuota estimada si aplica; si no aplica indica no aplica",
    "razon": "explicacion concreta y accionable",
    "riesgo": "bajo|medio|alto"
  },
  "alternativas": [
    { "titulo": "alternativa 1", "precio": "precio o cuota", "razon": "por que puede tener sentido" },
    { "titulo": "alternativa 2", "precio": "precio o cuota", "razon": "por que puede tener sentido" }
  ],
  "alertas": ["alerta 1", "alerta 2"],
  "siguiente_paso": "que deberia hacer ahora"
}

Criterios:
- Prioriza valor real en el mercado espanol, coste total, riesgo y facilidad de cierre.
- Si es renting, habla en terminos de cuota realista y condiciones.
- Si es compra, habla en terminos de precio objetivo, financiacion y riesgo de depreciacion.
- No inventes enlaces ni empresas concretas.

Perfil:
- Operacion: ${decisionAnswers.operation === "renting" ? "Renting" : "Compra"}
- Modalidad: ${normalizeText(decisionAnswers.acquisition) || "No indicada"}
- Marca/modelo definidos: ${decisionAnswers.hasBrand === "si" ? `${decisionAnswers.brand} ${decisionAnswers.model}` : "No"}
- Estado deseado: ${normalizeText(decisionAnswers.condition) || "No indicado"}
- Cuota objetivo: ${labels.monthlyBudget}
- Presupuesto total: ${labels.cashBudget}
- Importe a financiar: ${labels.financeAmount}
- Entrada: ${labels.entryAmount}
- Antiguedad maxima: ${labels.ageFilter}
- Kilometraje maximo: ${labels.mileageFilter}
- Potencia objetivo: ${labels.powerRange}
- Ubicacion objetivo: ${labels.location}
- Combustible preferido: ${labels.fuelFilter}`;
}

export function buildSellAnalysisPrompt({ sellAnswers }) {
  return `Eres un experto en mercado VO en Espana. Valora este coche y responde SOLO con JSON valido, sin markdown.

Devuelve exactamente esta estructura:
{
  "precio_objetivo": "precio recomendado de salida en EUR",
  "rango_publicacion": { "min": "min EUR", "max": "max EUR" },
  "nivel_demanda": "alta|media|baja",
  "tiempo_estimado_venta": "estimacion razonable",
  "resumen": "2-3 frases justificando la valoracion",
  "argumentos_clave": ["argumento 1", "argumento 2", "argumento 3"],
  "alertas": ["alerta 1", "alerta 2"],
  "estrategia_publicacion": "como deberia publicar y defender el precio"
}

Criterios:
- Ajusta la valoracion al mercado espanol.
- Ten en cuenta edad, kilometraje, combustible y canal de venta.
- No inventes anuncios concretos; da una recomendacion profesional y monetizable.

Vehiculo:
- Marca: ${sellAnswers.brand}
- Modelo: ${sellAnswers.model}
- Ano: ${sellAnswers.year}
- Kilometraje: ${Number(sellAnswers.mileage || 0).toLocaleString("es-ES")} km
- Combustible: ${sellAnswers.fuel}
- Canal de venta: ${sellAnswers.sellerType}`;
}

export async function fetchDecisionListing({
  aiResult,
  decisionFlowReady,
  decisionAnswers,
  refreshNonce = 0,
  excludeUrls = [],
  excludeTitles = [],
}) {
  if (!decisionFlowReady) {
    return null;
  }

  const fuelPreferenceMap = {
    cualquiera: "indiferente_motor",
    gasolina: "gasolina",
    diesel: "diesel",
    hibrido: "hibrido_no_enchufable",
    phev: "hibrido_enchufable",
    electrico: "electrico_puro",
  };

  const fallbackTitle = [decisionAnswers.brand, decisionAnswers.model, decisionAnswers.operation === "renting" ? "renting" : "compra"]
    .filter(Boolean)
    .join(" ")
    .trim();
  const listingTitle = aiResult?.oferta_top?.titulo || fallbackTitle || "oferta recomendada";

  const mappedAnswers = {
    perfil: "particular",
    flexibilidad:
      decisionAnswers.operation === "renting"
        ? "renting"
        : decisionAnswers.acquisition === "contado"
          ? "propiedad_contado"
          : "propiedad_financiada",
    propulsion_preferida: fuelPreferenceMap[decisionAnswers.fuelFilter] || "indiferente_motor",
    marca_preferencia: inferBrandPreferenceFromBrand(decisionAnswers.brand),
    ocupantes: "5_plazas_maletero_medio",
    entorno_uso: "mixto",
    uso_km_anuales: "10k_20k",
    uso_principal: ["trabajo_diario"],
    marca_objetivo: decisionAnswers.brand || "",
    modelo_objetivo: [decisionAnswers.brand, decisionAnswers.model].filter(Boolean).join(" "),
  };

  const { response, data } = await postListingJson({
    result: {
      solucion_principal: {
        titulo: listingTitle,
        tipo:
          decisionAnswers.operation === "renting"
            ? "renting_largo"
            : decisionAnswers.acquisition === "contado"
              ? "compra_contado"
              : "compra_financiada",
        empresas_recomendadas: [],
      },
      propulsiones_viables: [],
    },
    answers: mappedAnswers,
    filters: {
      budget: decisionAnswers.monthlyBudget || "",
      income: "fijos_estables",
      location: decisionAnswers.location || "",
      fuel: decisionAnswers.fuelFilter || "",
      refreshNonce,
      excludeUrls,
      excludeTitles,
    },
  });

  if (!response.ok) {
    throw new Error(data?.error || "No se pudo localizar un anuncio real para esta operación.");
  }

  const listings = Array.isArray(data?.listings)
    ? data.listings
    : [data?.listing, ...(Array.isArray(data?.alternatives) ? data.alternatives : [])].filter(Boolean);

  const vehicleTarget = `${decisionAnswers.brand || ""} ${decisionAnswers.model || ""}`.toLowerCase();
  const vehicleTokens = vehicleTarget
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  function isGenericLandingUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      const path = (parsed.pathname || "/").toLowerCase();
      const hasSearchQuery = ["q", "search", "query", "filter", "marca", "modelo"].some((key) => parsed.searchParams.has(key));
      if (path === "/") {
        return true;
      }
      if (hasSearchQuery) {
        return true;
      }
      return /\/(coches-segunda-mano|coches-ocasion|vehiculos-ocasion|stock|search|buscar)\/?$/.test(path);
    } catch {
      return true;
    }
  }

  function hasStrongVehicleMatch(listing) {
    if (vehicleTokens.length === 0) {
      return true;
    }

    const haystack = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""}`.toLowerCase();
    return vehicleTokens.every((token) => haystack.includes(token));
  }

  function parseListingYear(haystack) {
    const match = haystack.match(/\b(20\d{2}|19\d{2})\b/);
    return match ? Number(match[1]) : null;
  }

  function parseListingKm(haystack) {
    const match = haystack.match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*km\b/i);
    if (!match) {
      return null;
    }

    const numeric = Number(String(match[1]).replace(/[.,]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  function parseListingCv(haystack) {
    const match = haystack.match(/(\d{2,3})\s*cv\b/i);
    return match ? Number(match[1]) : null;
  }

  function parseListingPrice(listing, haystack) {
    const sources = [listing?.price, haystack];
    for (const source of sources) {
      const match = String(source || "").match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*€/i);
      if (!match) {
        continue;
      }

      const numeric = Number(String(match[1]).replace(/[.,]/g, ""));
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    return null;
  }

  function formatAmount(value) {
    return `${Number(value || 0).toLocaleString("es-ES")} €`;
  }

  function formatKm(value) {
    return `${Number(value || 0).toLocaleString("es-ES")} km`;
  }

  function formatYears(value) {
    return `${Number(value || 0)} años`;
  }

  function getFuelLabel() {
    const labels = {
      gasolina: "Gasolina",
      diesel: "Diésel",
      hibrido: "Híbrido",
      phev: "PHEV",
      electrico: "Eléctrico",
      cualquiera: "Cualquiera",
    };
    const fuel = String(decisionAnswers.fuelFilter || "cualquiera").toLowerCase();
    return labels[fuel] || "el combustible seleccionado";
  }

  function getLocationLabel() {
    const location = String(decisionAnswers.location || "toda_espana").toLowerCase();
    if (!location || location === "toda_espana") {
      return "Toda España";
    }

    return location
      .split("_")
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function getDecisionRanges() {
    const explicitPriceMax = Number(decisionAnswers.priceMax);
    const hasExplicitAgeMax = decisionAnswers.ageMax !== null && decisionAnswers.ageMax !== undefined && decisionAnswers.ageMax !== "";
    const hasExplicitMileageMax = decisionAnswers.mileageMax !== null && decisionAnswers.mileageMax !== undefined && decisionAnswers.mileageMax !== "";
    const explicitAgeMax = hasExplicitAgeMax ? Number(decisionAnswers.ageMax) : Number.NaN;
    const explicitMileageMax = hasExplicitMileageMax ? Number(decisionAnswers.mileageMax) : Number.NaN;

    return {
      priceMin: Number(decisionAnswers.priceMin || 0),
      priceMax: Number.isFinite(explicitPriceMax) ? explicitPriceMax : Number.POSITIVE_INFINITY,
      ageMin: Number(decisionAnswers.ageMin || 0),
      ageMax:
        Number.isFinite(explicitAgeMax)
          ? explicitAgeMax
          : decisionAnswers.ageFilter === "all"
            ? Number.POSITIVE_INFINITY
            : Number(decisionAnswers.ageFilter || Number.POSITIVE_INFINITY),
      mileageMin: Number(decisionAnswers.mileageMin || 0),
      mileageMax:
        Number.isFinite(explicitMileageMax)
          ? explicitMileageMax
          : decisionAnswers.mileageFilter === "all"
            ? Number.POSITIVE_INFINITY
            : Number(decisionAnswers.mileageFilter || Number.POSITIVE_INFINITY),
      powerMin: Number(decisionAnswers.powerMin || 0),
      powerMax: Number(decisionAnswers.powerMax || Number.POSITIVE_INFINITY),
    };
  }

  const decisionRanges = getDecisionRanges();

  function matchesFuelFilter(haystack) {
    const fuel = String(decisionAnswers.fuelFilter || "cualquiera").toLowerCase();
    if (!fuel || fuel === "cualquiera") {
      return true;
    }

    const fuelPatterns = {
      gasolina: /gasolina/,
      diesel: /diesel|di[eé]sel/,
      hibrido: /hybrid|hibrid|h[ií]brido/,
      phev: /phev|enchufable/,
      electrico: /electric|electrico|el[eé]ctrico|bev|ev\b/,
    };

    return fuelPatterns[fuel] ? fuelPatterns[fuel].test(haystack) : true;
  }

  function matchesLocationFilter(haystack) {
    const location = String(decisionAnswers.location || "toda_espana").toLowerCase();
    if (!location || location === "toda_espana") {
      return true;
    }

    const normalizedLocation = location.replace(/_/g, " ");
    return haystack.includes(normalizedLocation);
  }

  function matchesPowerFilter(haystack) {
    const parsedCv = parseListingCv(haystack);
    if (!Number.isFinite(parsedCv)) {
      return true;
    }

    return parsedCv >= decisionRanges.powerMin && parsedCv <= decisionRanges.powerMax;
  }

  function matchesAgeFilter(haystack) {
    const parsedYear = parseListingYear(haystack);
    if (!Number.isFinite(parsedYear)) {
      return true;
    }

    const currentYear = new Date().getFullYear();
    const age = currentYear - parsedYear;
    return age >= decisionRanges.ageMin && age <= decisionRanges.ageMax;
  }

  function matchesMileageFilter(haystack) {
    const parsedKm = parseListingKm(haystack);
    if (!Number.isFinite(parsedKm)) {
      return true;
    }

    return parsedKm >= decisionRanges.mileageMin && parsedKm <= decisionRanges.mileageMax;
  }

  function matchesPriceFilter(listing, haystack) {
    const parsedPrice = parseListingPrice(listing, haystack);
    if (!Number.isFinite(parsedPrice)) {
      return true;
    }

    return parsedPrice >= decisionRanges.priceMin && parsedPrice <= decisionRanges.priceMax;
  }

  function getListingFilterFailures(listing) {
    const haystack = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""}`.toLowerCase();
    const failures = [];

    if (!matchesPriceFilter(listing, haystack)) {
      failures.push({
        key: "price",
        label: `el rango de precio ${formatAmount(decisionRanges.priceMin)} - ${formatAmount(decisionRanges.priceMax)}`,
      });
    }
    if (!matchesFuelFilter(haystack)) {
      failures.push({
        key: "fuel",
        label: `el combustible ${getFuelLabel()}`,
      });
    }
    if (!matchesLocationFilter(haystack)) {
      failures.push({
        key: "location",
        label: `la ubicación ${getLocationLabel()}`,
      });
    }
    if (!matchesPowerFilter(haystack)) {
      failures.push({
        key: "power",
        label: `la potencia ${decisionRanges.powerMin} - ${decisionRanges.powerMax} CV`,
      });
    }
    if (!matchesAgeFilter(haystack)) {
      const ageMaxLabel = Number.isFinite(decisionRanges.ageMax) ? formatYears(decisionRanges.ageMax) : "sin límite";
      failures.push({
        key: "age",
        label: `la antigüedad ${formatYears(decisionRanges.ageMin)} - ${ageMaxLabel}`,
      });
    }
    if (!matchesMileageFilter(haystack)) {
      const mileageMaxLabel = Number.isFinite(decisionRanges.mileageMax) ? formatKm(decisionRanges.mileageMax) : "sin límite";
      failures.push({
        key: "mileage",
        label: `el kilometraje ${formatKm(decisionRanges.mileageMin)} - ${mileageMaxLabel}`,
      });
    }

    return failures;
  }

  function buildFilterInsight(candidates, rejectedReasons) {
    if (candidates.length === 0) {
      return `No he localizado anuncios concretos de ${fallbackTitle || "ese modelo"} en los resultados que devolvieron los portales.`;
    }

    if (rejectedReasons.length === 0) {
      return null;
    }

    const reasonCounts = rejectedReasons.reduce((acc, reason) => {
      const current = acc.get(reason.key) || { count: 0, label: reason.label };
      current.count += 1;
      acc.set(reason.key, current);
      return acc;
    }, new Map());

    const topReasons = Array.from(reasonCounts.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 2)
      .map((item) => item.label);

    if (topReasons.length === 0) {
      return null;
    }

    return `He encontrado ${candidates.length} anuncio${candidates.length === 1 ? "" : "s"} concretos de ${fallbackTitle || "ese modelo"}, pero los descartan sobre todo ${topReasons.join(" y ")}.`;
  }

  const candidateListings = listings.filter((listing) => {
    if (!listing || listing.synthetic || listing.isGuaranteedFallback) {
      return false;
    }

    const hasUrl = Boolean(String(listing.url || "").trim());
    if (!hasUrl || isGenericLandingUrl(listing.url)) {
      return false;
    }

    return hasStrongVehicleMatch(listing);
  });

  const rejectedReasons = [];
  const concreteListings = candidateListings.filter((listing) => {
    const failures = getListingFilterFailures(listing);
    if (failures.length > 0) {
      rejectedReasons.push(...failures);
      return false;
    }

    return true;
  });

  const finalListings = concreteListings;

  return {
    listing: finalListings[0] || null,
    listings: finalListings,
    filterInsight: finalListings.length === 0 ? buildFilterInsight(candidateListings, rejectedReasons) : null,
  };
}

export async function fetchSellComparableListing({ sellAnswers }) {
  if (!(sellAnswers.brand && sellAnswers.model)) {
    return null;
  }

  const { response, data } = await postListingJson({
    result: {
      solucion_principal: {
        titulo: `${sellAnswers.brand} ${sellAnswers.model} en venta en el mercado`,
        tipo: "compra_contado",
        empresas_recomendadas: [],
      },
      propulsiones_viables: [sellAnswers.fuel],
    },
    answers: {
      perfil: "particular",
      flexibilidad: "propiedad_contado",
      propulsion_preferida: mapFuelToPreference(sellAnswers.fuel),
      marca_preferencia: inferBrandPreferenceFromBrand(sellAnswers.brand),
      ocupantes: "5_plazas_maletero_medio",
      entorno_uso: "mixto",
      uso_km_anuales: Number(sellAnswers.mileage || 0) > 80000 ? "mas_35k" : "10k_20k",
      uso_principal: ["trabajo_diario"],
      marca_objetivo: sellAnswers.brand,
      modelo_objetivo: `${sellAnswers.brand} ${sellAnswers.model}`,
    },
    filters: {
      income: "fijos_estables",
    },
  });

  if (!response.ok) {
    throw new Error(data?.error || "No se pudo localizar un anuncio comparable ahora mismo.");
  }

  return data.listing || null;
}
