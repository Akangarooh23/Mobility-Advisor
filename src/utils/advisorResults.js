import { normalizeStringArray, normalizeText } from "./offerHelpers";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

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

export function parseAdvisorJson(rawText) {
  const text = String(rawText || "").replace(/```json|```/gi, "").trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const jsonSlice =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? text.slice(firstBrace, lastBrace + 1)
      : text;

  const base = sanitizeJsonStringContent(
    jsonSlice
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  );

  try {
    return JSON.parse(base);
  } catch {}

  const singleQuotedKeys = base.replace(/([{,]\s*)'([^'\\]+?)'\s*:/g, '$1"$2":');
  try {
    return JSON.parse(singleQuotedKeys);
  } catch {}

  const repaired = singleQuotedKeys
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  return JSON.parse(repaired);
}

function toNumber(value, fallback = 0) {
  if (Number.isFinite(Number(value))) {
    return Number(value);
  }

  const text = normalizeText(value);
  if (!text) {
    return fallback;
  }

  const cleaned = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAlternative(item) {
  return {
    tipo: normalizeText(item?.tipo),
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
    titulo: normalizeText(item?.titulo),
    razon: normalizeText(item?.razon),
  };
}

function normalizeScoreBreakdown(value) {
  const raw = value && typeof value === "object" ? value : {};

  return {
    encaje_uso: clamp(Number(raw.encaje_uso || raw.encaje || 0), 0, 25),
    coste_total: clamp(Number(raw.coste_total || raw.coste_estimado || raw.coste || 0), 0, 20),
    flexibilidad: clamp(Number(raw.flexibilidad || 0), 0, 20),
    viabilidad_real: clamp(Number(raw.viabilidad_real || raw.viabilidad || 0), 0, 20),
    ajuste_preferencias: clamp(Number(raw.ajuste_preferencias || raw.preferencias || 0), 0, 15),
  };
}

function deriveScoreBreakdown(totalScore = 0) {
  const safeScore = clamp(Number(totalScore || 0), 0, 100);
  const encaje_uso = Math.round(safeScore * 0.3);
  const coste_total = Math.round(safeScore * 0.22);
  const flexibilidad = Math.round(safeScore * 0.18);
  const viabilidad_real = Math.round(safeScore * 0.17);
  const ajuste_preferencias = Math.max(
    0,
    safeScore - encaje_uso - coste_total - flexibilidad - viabilidad_real
  );

  return normalizeScoreBreakdown({
    encaje_uso,
    coste_total,
    flexibilidad,
    viabilidad_real,
    ajuste_preferencias,
  });
}

function normalizeTcoDetail(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const seed = fallback && typeof fallback === "object" ? fallback : {};

  const base_mensual = clamp(
    Math.round(
      toNumber(raw.base_mensual ?? raw.cuota_base ?? raw.amortizacion ?? raw.coste_base ?? seed.base_mensual, 0)
    ),
    0,
    5000
  );
  const seguro = clamp(Math.round(toNumber(raw.seguro ?? seed.seguro, 0)), 0, 1500);
  const energia = clamp(Math.round(toNumber(raw.energia ?? raw.combustible ?? seed.energia, 0)), 0, 1500);
  const mantenimiento = clamp(
    Math.round(toNumber(raw.mantenimiento ?? raw.servicio ?? seed.mantenimiento, 0)),
    0,
    1500
  );
  const extras = clamp(
    Math.round(toNumber(raw.extras ?? raw.impuestos_aparcamiento ?? raw.impuestos ?? seed.extras, 0)),
    0,
    1500
  );
  const entrada_inicial = clamp(
    Math.round(toNumber(raw.entrada_inicial ?? raw.entrada ?? raw.capital_inicial ?? seed.entrada_inicial, 0)),
    0,
    120000
  );
  const computedTotal = base_mensual + seguro + energia + mantenimiento + extras;
  const total_mensual = clamp(
    Math.round(toNumber(raw.total_mensual ?? raw.tco_mensual ?? raw.coste_total_mensual ?? seed.total_mensual, computedTotal)),
    0,
    10000
  );
  const total_anual = clamp(
    Math.round(toNumber(raw.total_anual ?? raw.tco_anual ?? seed.total_anual, total_mensual * 12)),
    0,
    120000
  );

  return {
    concepto_base: normalizeText(raw.concepto_base || raw.concepto_principal || seed.concepto_base || "Base de movilidad"),
    entrada_inicial,
    base_mensual,
    seguro,
    energia,
    mantenimiento,
    extras,
    total_mensual,
    total_anual,
    nota: normalizeText(raw.nota || raw.comentario || raw.aviso || seed.nota),
  };
}

function normalizeComparatorRow(item) {
  return {
    criterio: normalizeText(item?.criterio),
    opcion_principal: normalizeText(item?.opcion_principal || item?.principal),
    alternativa_1: normalizeText(item?.alternativa_1 || item?.alternativa1),
    alternativa_2: normalizeText(item?.alternativa_2 || item?.alternativa2),
    ganador: normalizeText(item?.ganador || "principal"),
  };
}

function buildComparatorFallback(value) {
  const alternatives = Array.isArray(value?.alternativas)
    ? value.alternativas.map(normalizeAlternative).filter((item) => item.titulo || item.razon)
    : [];
  const alt1 = alternatives[0] || {};
  const alt2 = alternatives[1] || {};
  const tco = normalizeTcoDetail(value?.tco_detalle, {});
  const scoreBreakdown = normalizeScoreBreakdown(value?.score_desglose);

  return [
    {
      criterio: "Coste total real",
      opcion_principal: tco.total_mensual
        ? `~${formatCurrency(tco.total_mensual)}/mes con mejor control del total real.`
        : "Coste equilibrado frente al resto.",
      alternativa_1: alt1.titulo ? `${alt1.titulo}: alternativa válida, pero con más variables abiertas.` : "Sin alternativa claramente superior en coste.",
      alternativa_2: alt2.titulo ? `${alt2.titulo}: opción secundaria para este criterio.` : "Menos prioritaria en este criterio.",
      ganador: scoreBreakdown.coste_total >= 12 ? "principal" : alt1.titulo ? "alternativa_1" : "principal",
    },
    {
      criterio: "Flexibilidad",
      opcion_principal: "Equilibrio más sano entre compromiso, uso y capacidad de cambio.",
      alternativa_1: alt1.titulo ? `${alt1.titulo}: puede ganar si valoras otra renuncia concreta.` : "Flexibilidad menos clara.",
      alternativa_2: alt2.titulo ? `${alt2.titulo}: encaja, pero con menos equilibrio general.` : "Menor prioridad.",
      ganador: "principal",
    },
    {
      criterio: "Viabilidad real",
      opcion_principal: "Es la que menos fricción introduce con tu contexto actual.",
      alternativa_1: alt1.titulo ? `${alt1.titulo}: útil, pero depende de más supuestos.` : "Más incertidumbre operativa.",
      alternativa_2: alt2.titulo ? `${alt2.titulo}: requiere más concesiones para funcionar bien.` : "Más débil en ejecución.",
      ganador: scoreBreakdown.viabilidad_real >= 12 ? "principal" : alt1.titulo ? "alternativa_1" : "principal",
    },
  ].map(normalizeComparatorRow);
}

function normalizeTransparencyBlock(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const seed = fallback && typeof fallback === "object" ? fallback : {};

  return {
    confianza_nivel: normalizeText(raw.confianza_nivel || seed.confianza_nivel || "media"),
    confianza_motivo: normalizeText(raw.confianza_motivo || raw.resumen || seed.confianza_motivo),
    supuestos_clave: normalizeStringArray(raw.supuestos_clave || seed.supuestos_clave).slice(0, 4),
    validaciones_pendientes: normalizeStringArray(raw.validaciones_pendientes || seed.validaciones_pendientes).slice(0, 4),
  };
}

function buildTransparencyFallback(value) {
  const tco = normalizeTcoDetail(value?.tco_detalle, {});
  const score = Number(value?.solucion_principal?.score || value?.alineacion_pct || 0);
  const level = score >= 82 ? "alta" : score >= 72 ? "media" : "ajustada";

  return {
    confianza_nivel: level,
    confianza_motivo:
      level === "alta"
        ? "La recomendación está bastante apoyada por tus respuestas y presenta pocas contradicciones fuertes."
        : level === "media"
          ? "La dirección parece buena, pero todavía conviene validar precio final y condiciones reales."
          : "La orientación es útil, aunque necesita confirmar varios supuestos antes de cerrar decisión.",
    supuestos_clave: [
      tco.total_mensual ? `Que el coste final se mantenga cerca de ${formatCurrency(tco.total_mensual)}/mes.` : "Que el coste final real no se dispare frente al estimado.",
      "Que tu patrón de uso y kilometraje se mantenga parecido en los próximos meses.",
    ],
    validaciones_pendientes: [
      "Comparar 2 o 3 ofertas reales antes de decidir.",
      "Confirmar stock, condiciones y letra pequeña de la operación final.",
    ],
  };
}

function normalizeActionPlan(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const seed = fallback && typeof fallback === "object" ? fallback : {};

  return {
    semaforo: normalizeText(raw.semaforo || raw.color || seed.semaforo || "ambar"),
    estado: normalizeText(raw.estado || raw.titulo || seed.estado || "Compara 2 o 3 ofertas antes de cerrar"),
    resumen: normalizeText(raw.resumen || seed.resumen),
    acciones: normalizeStringArray(raw.acciones || raw.pasos || seed.acciones).slice(0, 4),
    alertas_rojas: normalizeStringArray(raw.alertas_rojas || raw.riesgos || seed.alertas_rojas).slice(0, 3),
  };
}

function buildActionPlanFallback(value) {
  const transparency = normalizeTransparencyBlock(value?.transparencia, buildTransparencyFallback(value));
  const tco = normalizeTcoDetail(value?.tco_detalle, {});
  const companies = normalizeStringArray(value?.solucion_principal?.empresas_recomendadas).slice(0, 2);
  const companyText = companies.length > 0 ? companies.join(" y ") : "varias plataformas";
  const level = normalizeText(transparency.confianza_nivel || "").toLowerCase();
  const semaforo = level === "alta" ? "verde" : level === "ajustada" ? "rojo" : "ambar";

  return {
    semaforo,
    estado:
      semaforo === "verde"
        ? "Puedes avanzar a shortlist y cierre"
        : semaforo === "rojo"
          ? "Pausa y revalida antes de comprometerte"
          : "Buena dirección: compara antes de firmar",
    resumen:
      semaforo === "verde"
        ? "La recomendación está bien orientada; ahora toca comparar bien y evitar letra pequeña."
        : semaforo === "rojo"
          ? "Hay varias hipótesis abiertas; mejor validar antes de cerrar una operación."
          : "La recomendación apunta bien, pero aún necesita contraste con ofertas reales y condiciones finales.",
    acciones: [
      `Pide 3 ofertas cerradas a ${companyText} con el mismo formato de precio y servicios.`,
      tco.total_mensual
        ? `Usa ${formatCurrency(tco.total_mensual)}/mes como techo real para filtrar opciones.`
        : "Fija un techo de coste real mensual antes de comparar ofertas.",
      "No cierres nada sin revisar stock, permanencia o financiación y la letra pequeña final.",
    ],
    alertas_rojas: [
      "Firmar solo por la cuota visible sin mirar el coste total real.",
      "Aceptar una oferta sin comparar al menos 2 o 3 alternativas equivalentes.",
    ],
  };
}

export function normalizeAdvisorResult(value) {
  const main = value?.solucion_principal || {};
  const score = Number.isFinite(Number(main.score)) ? Number(main.score) : Number(value?.alineacion_pct) || 0;
  const providedBreakdown = normalizeScoreBreakdown(value?.score_desglose);
  const providedBreakdownTotal = Object.values(providedBreakdown).reduce(
    (acc, item) => acc + Number(item || 0),
    0
  );
  const fallbackBaseCost = clamp(Math.round(toNumber(main.coste_estimado, 0)), 0, 5000);
  const tco_detalle = normalizeTcoDetail(value?.tco_detalle, {
    concepto_base: "Coste mensual estimado",
    base_mensual: fallbackBaseCost,
    seguro: 0,
    energia: 0,
    mantenimiento: 0,
    extras: 0,
    entrada_inicial: 0,
    total_mensual: fallbackBaseCost,
    total_anual: fallbackBaseCost * 12,
    nota: normalizeText(value?.tco_aviso),
  });
  const normalizedAlternatives = Array.isArray(value?.alternativas)
    ? value.alternativas.map(normalizeAlternative).filter((item) => item.titulo || item.razon)
    : [];
  const baseForDerived = {
    ...value,
    alternativas: normalizedAlternatives,
    score_desglose: providedBreakdownTotal > 0 ? providedBreakdown : deriveScoreBreakdown(score),
    tco_detalle,
    solucion_principal: {
      ...main,
      score,
    },
  };

  return {
    alineacion_pct: Number.isFinite(Number(value?.alineacion_pct)) ? Number(value.alineacion_pct) : 0,
    solucion_principal: {
      tipo: normalizeText(main.tipo),
      score,
      titulo: normalizeText(main.titulo),
      resumen: normalizeText(main.resumen),
      ventajas: normalizeStringArray(main.ventajas),
      inconvenientes: normalizeStringArray(main.inconvenientes),
      coste_estimado: normalizeText(main.coste_estimado),
      empresas_recomendadas: normalizeStringArray(main.empresas_recomendadas),
      etiqueta_dgt: normalizeText(main.etiqueta_dgt),
      tension_principal: normalizeText(main.tension_principal),
    },
    score_desglose: baseForDerived.score_desglose,
    por_que_gana:
      normalizeStringArray(value?.por_que_gana).length > 0
        ? normalizeStringArray(value?.por_que_gana).slice(0, 4)
        : normalizeStringArray(main.ventajas).slice(0, 3),
    alternativas: normalizedAlternatives,
    comparador_final: Array.isArray(value?.comparador_final) && value.comparador_final.length > 0
      ? value.comparador_final.map(normalizeComparatorRow).filter((item) => item.criterio)
      : buildComparatorFallback(baseForDerived),
    transparencia: normalizeTransparencyBlock(value?.transparencia, buildTransparencyFallback(baseForDerived)),
    plan_accion: normalizeActionPlan(value?.plan_accion, buildActionPlanFallback(baseForDerived)),
    tco_aviso: normalizeText(value?.tco_aviso),
    tco_detalle,
    consejo_experto: normalizeText(value?.consejo_experto),
    siguiente_paso: normalizeText(value?.siguiente_paso),
    propulsiones_viables: normalizeStringArray(value?.propulsiones_viables),
  };
}

export function isCompleteAdvisorResult(value) {
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
      normalized.tco_detalle?.total_mensual > 0 &&
      normalized.consejo_experto &&
      normalized.siguiente_paso &&
      normalized.propulsiones_viables.length >= 1
  );
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactCompanyMentions(value, companyNames = [], replacement = "plataformas especializadas") {
  const text = normalizeText(value);

  if (!text || !Array.isArray(companyNames) || companyNames.length === 0) {
    return text;
  }

  const escapedNames = companyNames.map((name) => escapeRegExp(name)).filter(Boolean);
  if (!escapedNames.length) {
    return text;
  }

  return text
    .replace(new RegExp(`\\b(?:${escapedNames.join("|")})\\b`, "gi"), "__PLATFORM__")
    .replace(/(?:__PLATFORM__(?:\s*(?:,|y|e)\s*)?)+/gi, replacement)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

export function sanitizeResultForDisplay(value) {
  const companyNames = Array.isArray(value?.solucion_principal?.empresas_recomendadas)
    ? value.solucion_principal.empresas_recomendadas
    : [];

  return {
    ...value,
    solucion_principal: {
      ...value?.solucion_principal,
      resumen: redactCompanyMentions(value?.solucion_principal?.resumen, companyNames),
      ventajas: (value?.solucion_principal?.ventajas || []).map((item) =>
        redactCompanyMentions(item, companyNames)
      ),
      inconvenientes: (value?.solucion_principal?.inconvenientes || []).map((item) =>
        redactCompanyMentions(item, companyNames)
      ),
      tension_principal: redactCompanyMentions(value?.solucion_principal?.tension_principal, companyNames),
      empresas_recomendadas: [],
    },
    por_que_gana: Array.isArray(value?.por_que_gana)
      ? value.por_que_gana.map((item) => redactCompanyMentions(item, companyNames))
      : [],
    alternativas: Array.isArray(value?.alternativas)
      ? value.alternativas.map((item) => ({
          ...item,
          titulo: redactCompanyMentions(item?.titulo, companyNames),
          razon: redactCompanyMentions(item?.razon, companyNames),
        }))
      : [],
    comparador_final: Array.isArray(value?.comparador_final)
      ? value.comparador_final.map((item) => ({
          ...item,
          criterio: redactCompanyMentions(item?.criterio, companyNames),
          opcion_principal: redactCompanyMentions(item?.opcion_principal, companyNames),
          alternativa_1: redactCompanyMentions(item?.alternativa_1, companyNames),
          alternativa_2: redactCompanyMentions(item?.alternativa_2, companyNames),
        }))
      : [],
    transparencia: {
      ...value?.transparencia,
      confianza_motivo: redactCompanyMentions(value?.transparencia?.confianza_motivo, companyNames),
      supuestos_clave: Array.isArray(value?.transparencia?.supuestos_clave)
        ? value.transparencia.supuestos_clave.map((item) => redactCompanyMentions(item, companyNames))
        : [],
      validaciones_pendientes: Array.isArray(value?.transparencia?.validaciones_pendientes)
        ? value.transparencia.validaciones_pendientes.map((item) => redactCompanyMentions(item, companyNames))
        : [],
    },
    tco_aviso: redactCompanyMentions(value?.tco_aviso, companyNames),
    tco_detalle: {
      ...value?.tco_detalle,
      concepto_base: redactCompanyMentions(value?.tco_detalle?.concepto_base, companyNames),
      nota: redactCompanyMentions(value?.tco_detalle?.nota, companyNames),
    },
    consejo_experto: redactCompanyMentions(value?.consejo_experto, companyNames),
    siguiente_paso: redactCompanyMentions(value?.siguiente_paso, companyNames, "plataformas de confianza"),
  };
}

export function normalizeDecisionAiResult(value) {
  const top = value?.oferta_top || value?.recomendacion_principal || {};

  return {
    resumen: normalizeText(value?.resumen),
    criterio_principal: normalizeText(value?.criterio_principal || value?.criterio || value?.enfoque),
    oferta_top: {
      titulo: normalizeText(top?.titulo),
      precio_objetivo: normalizeText(top?.precio_objetivo || top?.precio || top?.rango_precio),
      cuota_estimada: normalizeText(top?.cuota_estimada || top?.cuota || top?.mensualidad),
      razon: normalizeText(top?.razon || top?.resumen),
      riesgo: normalizeText(top?.riesgo),
    },
    alternativas: Array.isArray(value?.alternativas)
      ? value.alternativas
          .map((item) => ({
            titulo: normalizeText(item?.titulo),
            precio: normalizeText(item?.precio || item?.precio_objetivo),
            razon: normalizeText(item?.razon),
          }))
          .filter((item) => item.titulo || item.razon)
      : [],
    alertas: normalizeStringArray(value?.alertas || value?.puntos_a_revisar),
    siguiente_paso: normalizeText(value?.siguiente_paso),
  };
}

export function isCompleteDecisionAiResult(value) {
  const normalized = normalizeDecisionAiResult(value);

  return Boolean(
    normalized.resumen &&
      normalized.criterio_principal &&
      normalized.oferta_top?.titulo &&
      normalized.oferta_top?.razon &&
      normalized.siguiente_paso
  );
}

export function normalizeSellAiResult(value) {
  const range = value?.rango_publicacion || {};

  return {
    precio_objetivo: normalizeText(value?.precio_objetivo || value?.targetPrice),
    rango_publicacion: {
      min: normalizeText(range?.min || value?.precio_min || value?.lowPrice),
      max: normalizeText(range?.max || value?.precio_max || value?.highPrice),
    },
    nivel_demanda: normalizeText(value?.nivel_demanda || value?.demanda),
    tiempo_estimado_venta: normalizeText(value?.tiempo_estimado_venta || value?.tiempo_venta),
    resumen: normalizeText(value?.resumen || value?.explicacion),
    argumentos_clave: normalizeStringArray(value?.argumentos_clave || value?.puntos_fuertes),
    alertas: normalizeStringArray(value?.alertas || value?.puntos_a_revisar),
    estrategia_publicacion: normalizeText(value?.estrategia_publicacion || value?.siguiente_paso),
  };
}

export function isCompleteSellAiResult(value) {
  const normalized = normalizeSellAiResult(value);

  return Boolean(
    normalized.precio_objetivo &&
      normalized.rango_publicacion?.min &&
      normalized.rango_publicacion?.max &&
      normalized.resumen &&
      normalized.estrategia_publicacion
  );
}
