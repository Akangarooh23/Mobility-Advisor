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
        const horizonValue = finalAnswers?.horizonte || "";
        const kmValue = finalAnswers?.km_anuales || "";
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

        const horizonLabel = resolveRangeLabel(horizonValue, stepConfig.fields?.horizonte?.options || []);
        const kmLabel = resolveRangeLabel(kmValue, stepConfig.fields?.km_anuales?.options || []);

        return `- ${stepConfig.fields?.horizonte?.title || "Horizonte"}: ${horizonLabel}\n- ${stepConfig.fields?.km_anuales?.title || "Kilometraje anual"}: ${kmLabel}`;
      }

      const value = finalAnswers?.[stepConfig.id];
      const normalizedValue = Array.isArray(value) ? value.join(", ") : value || "No indicado";
      return `- ${stepConfig.question}: ${normalizedValue}`;
    })
    .join("\n");
}

export function buildAdviceAnalysisPrompt({ answersSummary }) {
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
- Considera financiacion, TCO, restricciones ZBE, viabilidad de electrificacion, depreciacion y riesgo.
- No dejes el TCO en abstracto: cuantifica un desglose mensual razonable con base, seguro, energia, mantenimiento, extras, total mensual y total anual.
- Añade transparencia real: incluye comparador_final y transparencia para explicar por que gana esta opcion y que validaciones quedan pendientes.
- Añade un plan_accion claro con semaforo (verde, ambar o rojo), acciones concretas y alertas rojas para la decision final.
- Si el test avanzado aporta datos de garaje, ZBE, capital inicial, control de riesgo o tipo de zona, usalos para afinar de verdad la recomendacion.
- Explica el score con logica de encaje de uso, coste total, flexibilidad, viabilidad real y ajuste con preferencias.
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
- Kilometraje maximo: ${labels.mileageFilter}`;
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

export async function fetchDecisionListing({ aiResult, decisionFlowReady, decisionAnswers }) {
  if (!decisionFlowReady || !aiResult?.oferta_top?.titulo) {
    return null;
  }

  const mappedAnswers = {
    perfil: "particular",
    flexibilidad:
      decisionAnswers.operation === "renting"
        ? "renting"
        : decisionAnswers.acquisition === "contado"
          ? "propiedad_contado"
          : "propiedad_financiada",
    propulsion_preferida: "indiferente_motor",
    marca_preferencia: inferBrandPreferenceFromBrand(decisionAnswers.brand),
    ocupantes: "5_plazas_maletero_medio",
    entorno_uso: "mixto",
    km_anuales: "10k_20k",
    uso_principal: ["trabajo_diario"],
    marca_objetivo: decisionAnswers.brand || "",
    modelo_objetivo: [decisionAnswers.brand, decisionAnswers.model].filter(Boolean).join(" "),
  };

  const { response, data } = await postListingJson({
    result: {
      solucion_principal: {
        titulo: aiResult.oferta_top.titulo,
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
    },
  });

  if (!response.ok) {
    throw new Error(data?.error || "No se pudo localizar un anuncio real para esta operación.");
  }

  return data.listing || null;
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
      km_anuales: Number(sellAnswers.mileage || 0) > 80000 ? "mas_20k" : "10k_20k",
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
