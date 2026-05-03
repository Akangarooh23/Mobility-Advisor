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

function enforceUserFuelInPropulsions(propulsions, answers) {
  const priority = Number((answers?.ponderacion_score_personalizada || {}).propulsion_preferida) || 0;
  if (priority < 3) return propulsions;
  const preferred = Array.isArray(answers?.propulsion_preferida)
    ? answers.propulsion_preferida
    : answers?.propulsion_preferida ? [answers.propulsion_preferida] : [];
  const result = [...propulsions];
  for (const fuel of preferred) {
    const f = fuel.toLowerCase();
    if (!result.some((p) => p.toLowerCase().includes(f))) {
      result.unshift(fuel);
    }
  }
  return result;
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

function removeAccents(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniq(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeAlternative(item) {
  return {
    tipo: normalizeText(item?.tipo),
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
    titulo: normalizeText(item?.titulo),
    razon: normalizeText(item?.razon),
  };
}

function normalizeVehicleRecommendation(item) {
  const rank = Number(item?.rank || item?.posicion || item?.orden || 0);
  const marca = normalizeText(item?.marca);
  const modelo = normalizeText(item?.modelo);
  const titulo = normalizeText(item?.titulo || `${marca} ${modelo}`.trim());

  return {
    rank: Number.isFinite(rank) && rank > 0 ? rank : 0,
    marca,
    modelo,
    titulo,
    razon: normalizeText(item?.razon),
  };
}

function normalizeVehicleRecommendations(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeVehicleRecommendation)
    .filter((item) => item.marca && item.modelo)
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      rank: item.rank || index + 1,
      titulo: item.titulo || `${item.marca} ${item.modelo}`,
    }));
}

function getPreferredFuelTokens(answers = {}, propulsions = []) {
  const fromAnswers = Array.isArray(answers?.propulsion_preferida)
    ? answers.propulsion_preferida
    : answers?.propulsion_preferida
      ? [answers.propulsion_preferida]
      : [];
  const normalizedAnswers = fromAnswers
    .map((item) => removeAccents(normalizeText(item)).toLowerCase())
    .join(" ");

  // If user explicitly selected a propulsion in the questionnaire, keep it as the strict target
  // instead of broadening with viable alternatives.
  if (normalizedAnswers) {
    if (/electrico_puro|electrico|ev|bev/.test(normalizedAnswers)) return ["electrico"];
    if (/hibrido_no_enchufable/.test(normalizedAnswers)) return ["hibrido"];
    if (/hibrido_enchufable|phev/.test(normalizedAnswers)) return ["phev"];
    if (/hibrido_no_enchufable|hibrido|hybrid|hev|mhev|microhibrid/.test(normalizedAnswers)) return ["hibrido"];
    if (/diesel|di[eé]sel/.test(normalizedAnswers)) return ["diesel"];
    if (/gasolina|gasoline/.test(normalizedAnswers)) return ["gasolina"];
  }

  const merged = (Array.isArray(propulsions) ? propulsions : [])
    .map((item) => removeAccents(normalizeText(item)).toLowerCase())
    .join(" ");

  const tokens = new Set();
  if (/(electrico|ev|bev)/.test(merged)) tokens.add("electrico");
  if (/(hibrido|hybrid|mhev|microhibrid|suave)/.test(merged)) tokens.add("hibrido");
  if (/(phev|enchufable)/.test(merged)) tokens.add("phev");
  if (/(diesel|di[eé]sel)/.test(merged)) tokens.add("diesel");
  if (/(gasolina|gasoline)/.test(merged)) tokens.add("gasolina");

  return Array.from(tokens);
}

function isVehicleFuelCompatible(vehicle = {}, preferredFuelTokens = []) {
  if (!Array.isArray(preferredFuelTokens) || preferredFuelTokens.length === 0) {
    return true;
  }

  const haystack = removeAccents(`${vehicle?.marca || ""} ${vehicle?.modelo || ""} ${vehicle?.titulo || ""}`)
    .toLowerCase();

  if (preferredFuelTokens.includes("electrico")) {
    return /(electric|electrico|ev\b|bev|e-tron|eq[absce]\b|ioniq 5|ioniq 6|mg4|dolphin|leaf|kona electric)/.test(haystack);
  }

  if (preferredFuelTokens.includes("phev")) {
    return /(phev|enchufable|plug-in|plug in|e-hybrid|hybrid\s+plugin)/.test(haystack);
  }

  if (preferredFuelTokens.includes("hibrido")) {
    return /(hybrid|hibrid|hev|full hybrid|mhev|microhibrid|e-power|hybrid\+)/.test(haystack);
  }

  if (preferredFuelTokens.includes("diesel")) {
    return /(diesel|di[eé]sel|tdi|dci|hdi|multijet|bluehdi)/.test(haystack);
  }

  if (preferredFuelTokens.includes("gasolina")) {
    return /(gasolina|tsi|tce|ecoboost|puretech|firefly|mpi|tgdi)/.test(haystack);
  }

  return true;
}

function alignVehicleRecommendationsWithFuel(recommendations = [], answers = {}, propulsions = []) {
  const preferredFuelTokens = getPreferredFuelTokens(answers, propulsions);
  if (preferredFuelTokens.length === 0) {
    const normalized = normalizeVehicleRecommendations(recommendations);
    if (normalized.length >= 5) {
      return normalized.slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));
    }

    const fallback = normalizeVehicleRecommendations(buildRecommendedVehiclesFallback(answers, propulsions));
    const byKey = new Map();
    [...normalized, ...fallback].forEach((item) => {
      const key = removeAccents(`${item?.marca || ""}|${item?.modelo || ""}`).toLowerCase();
      if (!key || byKey.has(key)) {
        return;
      }
      byKey.set(key, item);
    });

    return Array.from(byKey.values())
      .slice(0, 5)
      .map((item, index) => ({ ...item, rank: index + 1, titulo: normalizeText(item?.titulo || `${item?.marca || ""} ${item?.modelo || ""}`) }));
  }

  const compatible = recommendations.filter((item) => isVehicleFuelCompatible(item, preferredFuelTokens));
  if (compatible.length >= 5) {
    return compatible.slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));
  }

  const fallback = buildRecommendedVehiclesFallback(answers, propulsions)
    .filter((item) => isVehicleFuelCompatible(item, preferredFuelTokens));
  const byKey = new Map();

  [...compatible, ...fallback].forEach((item) => {
    const key = removeAccents(`${item?.marca || ""}|${item?.modelo || ""}`).toLowerCase();
    if (!key || byKey.has(key)) {
      return;
    }

    byKey.set(key, item);
  });

  if (byKey.size < 5) {
    const unfilteredFallback = normalizeVehicleRecommendations(buildRecommendedVehiclesFallback(answers, propulsions));
    unfilteredFallback.forEach((item) => {
      if (byKey.size >= 5) {
        return;
      }

      const key = removeAccents(`${item?.marca || ""}|${item?.modelo || ""}`).toLowerCase();
      if (!key || byKey.has(key)) {
        return;
      }

      byKey.set(key, item);
    });
  }

  if (byKey.size < 5) {
    const originalNormalized = normalizeVehicleRecommendations(recommendations);
    originalNormalized.forEach((item) => {
      if (byKey.size >= 5) {
        return;
      }

      const key = removeAccents(`${item?.marca || ""}|${item?.modelo || ""}`).toLowerCase();
      if (!key || byKey.has(key)) {
        return;
      }

      byKey.set(key, item);
    });
  }

  return Array.from(byKey.values())
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      titulo: normalizeText(item?.titulo || `${item?.marca || ""} ${item?.modelo || ""}`),
    }));
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
      toNumber(
        raw.base_mensual ?? raw.cuota_base ?? raw.amortizacion ?? raw.coste_base ?? seed.base_mensual,
        0
      )
    ),
    0,
    5000
  );
  const seguro = clamp(Math.round(toNumber(raw.seguro ?? seed.seguro, 0)), 0, 1500);
  const energia = clamp(
    Math.round(toNumber(raw.energia ?? raw.combustible ?? seed.energia, 0)),
    0,
    1500
  );
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
    Math.round(
      toNumber(raw.total_mensual ?? raw.tco_mensual ?? raw.coste_total_mensual ?? seed.total_mensual, computedTotal)
    ),
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

function buildScoreBreakdown(answers = {}, primaryType = "", propulsions = []) {
  const shortHorizon = ["por_dias", "menos_2_meses", "menos_1_ano"].includes(answers.horizonte);
  const lowKm = answers.km_anuales === "menos_10k";
  const highKm = answers.km_anuales === "mas_20k";
  const cityUse = answers.entorno_uso === "ciudad";
  const ownCharger = answers.garaje === "garaje_cargador";
  const noGarage = answers.garaje === "sin_garaje";
  const dailyCommute = includesAnswer(answers.uso_principal, "trabajo_diario");
  const familyUse = includesAnswer(answers.uso_principal, "familia");
  const highZbe = answers.zbe_impacto === "alta";
  const prefersOwnership = ["propiedad_contado", "propiedad_financiada"].includes(answers.flexibilidad);
  const lowerPropulsions = removeAccents((propulsions || []).join(" ")).toLowerCase();

  let encajeUso = 13;
  if (cityUse && ["carsharing", "transporte_publico", "micromovilidad", "rent_a_car"].includes(primaryType)) encajeUso += 7;
  if (dailyCommute && ["compra_contado", "compra_financiada", "renting_largo", "renting_corto"].includes(primaryType)) encajeUso += 5;
  if (lowKm && ["carsharing", "transporte_publico", "rent_a_car"].includes(primaryType)) encajeUso += 4;
  if (highKm && ["compra_financiada", "renting_largo"].includes(primaryType)) encajeUso += 4;
  if (familyUse && ["compra_contado", "compra_financiada", "renting_largo", "renting_corto"].includes(primaryType)) encajeUso += 2;

  let costeTotal = 11;
  if (shortHorizon && ["carsharing", "rent_a_car", "renting_corto"].includes(primaryType)) costeTotal += 5;
  if (answers.cuota_mensual === "menos_200" && ["transporte_publico", "carsharing", "compra_contado"].includes(primaryType)) costeTotal += 4;
  if (["200_350", "200_400"].includes(answers.cuota_mensual) && ["compra_financiada", "renting_largo", "renting_corto"].includes(primaryType)) costeTotal += 3;
  if (answers.marca_preferencia === "premium" && answers.cuota_mensual === "menos_200") costeTotal -= 3;
  if (!shortHorizon && primaryType === "rent_a_car") costeTotal -= 3;

  let flexibilidad = 9;
  if (shortHorizon && ["carsharing", "rent_a_car", "renting_corto"].includes(primaryType)) flexibilidad += 8;
  if (["renting", "flexible"].includes(answers.flexibilidad) && ["renting_largo", "renting_corto", "carsharing", "rent_a_car"].includes(primaryType)) flexibilidad += 4;
  if (prefersOwnership && ["compra_contado", "compra_financiada"].includes(primaryType)) flexibilidad += 4;
  if (shortHorizon && ["compra_contado", "compra_financiada"].includes(primaryType)) flexibilidad -= 5;

  let viabilidadReal = 10;
  if (lowerPropulsions.includes("electrico") && ownCharger) viabilidadReal += 5;
  if (lowerPropulsions.includes("electrico") && noGarage) viabilidadReal -= 5;
  if (highZbe && !lowerPropulsions.includes("gasolina eficiente")) viabilidadReal += 4;
  if (cityUse && ["carsharing", "transporte_publico"].includes(primaryType)) viabilidadReal += 3;

  let ajustePreferencias = 8;
  if (answers.propulsion_preferida === "gasolina" && lowerPropulsions.includes("gasolina")) ajustePreferencias += 4;
  if (answers.propulsion_preferida === "electrico" && lowerPropulsions.includes("electrico")) ajustePreferencias += 4;
  if ((answers.propulsion_preferida || "").includes("hibrido") && lowerPropulsions.includes("hibrid")) ajustePreferencias += 4;
  if (answers.marca_preferencia && answers.marca_preferencia !== "sin_preferencia") ajustePreferencias += 2;

  return normalizeScoreBreakdown({
    encaje_uso: clamp(encajeUso, 8, 25),
    coste_total: clamp(costeTotal, 6, 20),
    flexibilidad: clamp(flexibilidad, 6, 20),
    viabilidad_real: clamp(viabilidadReal, 5, 20),
    ajuste_preferencias: clamp(ajustePreferencias, 5, 15),
  });
}

function buildWhyWins(answers = {}, primaryType = "", propulsions = [], dgtLabel = "") {
  const reasons = [];

  if (["por_dias", "menos_2_meses", "menos_1_ano"].includes(answers.horizonte)) {
    reasons.push("Tu horizonte temporal corto hace que la flexibilidad pese más que la propiedad o una permanencia larga.");
  }

  if (answers.entorno_uso === "ciudad" && ["carsharing", "transporte_publico", "micromovilidad", "rent_a_car"].includes(primaryType)) {
    reasons.push("Para un uso principalmente urbano, esta vía reduce costes fijos y evita sobredimensionar coche o contrato.");
  }

  if (answers.km_anuales === "menos_10k") {
    reasons.push("Con un kilometraje contenido, pagar por uso o por una solución ajustada suele salir mejor que asumir estructura fija alta.");
  }

  if (["compra_contado", "compra_financiada", "renting_largo", "renting_corto"].includes(primaryType)) {
    reasons.push("Te da una cobertura más estable para el día a día y mantiene una disponibilidad alta cuando el coche sí forma parte de tu rutina.");
  }

  if (answers.propulsion_preferida === "gasolina" && !removeAccents((propulsions || []).join(" ")).toLowerCase().includes("electrico")) {
    reasons.push("Respeta tu preferencia de no forzar electrificación total cuando no aporta una ventaja clara para tu caso.");
  }

  if (dgtLabel === "ECO" || dgtLabel === "CERO") {
    reasons.push(`Además, te deja mejor posicionado frente a ZBE y restricciones futuras con etiqueta ${dgtLabel}.`);
  }

  reasons.push("Es la opción con mejor equilibrio actual entre encaje, coste realista y margen de maniobra si tus necesidades cambian.");

  return uniq(reasons).slice(0, 4);
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

function normalizeTransparency(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const seed = fallback && typeof fallback === "object" ? fallback : {};

  return {
    confianza_nivel: normalizeText(raw.confianza_nivel || seed.confianza_nivel || "media"),
    confianza_motivo: normalizeText(raw.confianza_motivo || raw.resumen || seed.confianza_motivo),
    supuestos_clave: normalizeStringArray(raw.supuestos_clave || seed.supuestos_clave).slice(0, 4),
    validaciones_pendientes: normalizeStringArray(raw.validaciones_pendientes || seed.validaciones_pendientes).slice(0, 4),
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

function getTypeTradeoffText(type = "") {
  const descriptions = {
    compra_contado: "menos flexibilidad, pero más control patrimonial y sin cuota financiera fuerte",
    compra_financiada: "disponibilidad total, pero con compromiso mensual y coste financiero",
    renting_largo: "cuota previsible y menos sorpresas, aunque con permanencia y kilometraje pactado",
    renting_corto: "más margen para cambiar pronto, aunque suele costar más al alargarlo",
    rent_a_car: "máxima flexibilidad puntual, pero solo compensa si el uso es esporádico",
    carsharing: "pagas por uso real y evitas estructura fija, aunque dependes de cobertura y disponibilidad",
    transporte_publico: "muy bajo coste fijo, pero con menos autonomía puerta a puerta",
    micromovilidad: "muy barata en trayectos cortos, aunque necesita complemento en usos más completos",
    carpooling: "ahorro alto, pero dependes más de horarios y coordinación",
  };

  return descriptions[type] || "equilibrio correcto, aunque menos prioritaria para tu caso";
}

function buildComparatorRows(primaryType = "", answers = {}, scoreBreakdown = {}, tcoDetail = {}, alternatives = []) {
  const alt1 = alternatives[0] || {};
  const alt2 = alternatives[1] || {};
  const primaryCost = tcoDetail?.total_mensual
    ? `~${tcoDetail.total_mensual} EUR/mes reales con mejor control del coste invisible`
    : getCostEstimate(primaryType, answers);
  const alt1Cost = alt1?.tipo ? getCostEstimate(alt1.tipo, answers) : "coste menos definido";
  const alt2Cost = alt2?.tipo ? getCostEstimate(alt2.tipo, answers) : "coste menos definido";
  const flexibilityWinner = ["rent_a_car", "carsharing", "renting_corto", "transporte_publico", "micromovilidad"].includes(primaryType)
    ? "principal"
    : alt1?.tipo && ["rent_a_car", "carsharing", "renting_corto", "transporte_publico", "micromovilidad"].includes(alt1.tipo)
      ? "alternativa_1"
      : "principal";

  return [
    {
      criterio: "Coste total real",
      opcion_principal: `${primaryCost}. Mejor equilibrio entre cuota visible y costes ocultos.`,
      alternativa_1: alt1?.titulo ? `${alt1.titulo}: ${alt1Cost}.` : "Sin una alternativa clara más barata sin sacrificios.",
      alternativa_2: alt2?.titulo ? `${alt2.titulo}: ${alt2Cost}.` : "Segunda alternativa menos prioritaria en coste.",
      ganador: scoreBreakdown?.coste_total >= 12 ? "principal" : alt1?.titulo ? "alternativa_1" : "principal",
    },
    {
      criterio: "Flexibilidad",
      opcion_principal: getTypeTradeoffText(primaryType),
      alternativa_1: alt1?.titulo ? `${alt1.titulo}: ${getTypeTradeoffText(alt1.tipo)}.` : "Menos clara en flexibilidad.",
      alternativa_2: alt2?.titulo ? `${alt2.titulo}: ${getTypeTradeoffText(alt2.tipo)}.` : "Pierde peso en este criterio.",
      ganador: flexibilityWinner,
    },
    {
      criterio: "Encaje con tu uso",
      opcion_principal: "Es la que mejor se adapta a tu horizonte, kilometraje y contexto de uso actual.",
      alternativa_1: alt1?.titulo ? `${alt1.titulo}: tiene sentido, pero exige más renuncias o más contexto favorable.` : "Peor ajuste de uso.",
      alternativa_2: alt2?.titulo ? `${alt2.titulo}: solución válida, aunque con un encaje algo más débil.` : "Menos ajustada al patrón real.",
      ganador: "principal",
    },
    {
      criterio: "Viabilidad / riesgo",
      opcion_principal: scoreBreakdown?.viabilidad_real >= 12 ? "Más fácil de ejecutar con tu contexto actual y menos puntos ciegos." : "Viable, pero necesita validar algún supuesto clave.",
      alternativa_1: alt1?.titulo ? `${alt1.titulo}: puede ser válida, pero con más incertidumbre operativa o económica.` : "Más incertidumbre.",
      alternativa_2: alt2?.titulo ? `${alt2.titulo}: encaja peor si cambia el uso o si el precio real no acompaña.` : "Más frágil si cambian tus necesidades.",
      ganador: scoreBreakdown?.viabilidad_real >= 12 ? "principal" : alt1?.titulo ? "alternativa_1" : "principal",
    },
  ].map(normalizeComparatorRow);
}

function buildTransparencyReport(answers = {}, primaryType = "", propulsions = [], tcoDetail = {}, scoreBreakdown = {}, score = 0) {
  const advancedSignals = ["garaje", "zbe_impacto", "capital_propio", "gestion_riesgo", "provincia_zona", "cuota_mensual"]
    .reduce((acc, key) => acc + (answers?.[key] ? 1 : 0), 0);
  const lowerPropulsions = removeAccents((propulsions || []).join(" ")).toLowerCase();
  const confidenceLevel = score >= 84 || (advancedSignals >= 3 && score >= 78)
    ? "alta"
    : score >= 72
      ? "media"
      : "ajustada";

  return normalizeTransparency({
    confianza_nivel: confidenceLevel,
    confianza_motivo:
      confidenceLevel === "alta"
        ? "Hay señales bastante consistentes entre uso, presupuesto, horizonte y restricciones, así que la recomendación sale bastante amarrada."
        : confidenceLevel === "media"
          ? "La dirección es buena, pero todavía depende de validar precio final, stock real y alguna condición operativa."
          : "La solución propuesta es razonable, aunque necesita validar más supuestos antes de darla por cerrada.",
    supuestos_clave: [
      `Que mantengas un uso ${answers.entorno_uso || "mixto"} con ${answers.km_anuales || "kilometraje medio"}.`,
      tcoDetail?.total_mensual ? `Que el coste real final se mueva cerca de ${tcoDetail.total_mensual} EUR/mes.` : "Que el coste final no se desvíe mucho frente al estimado.",
      lowerPropulsions.includes("electrico")
        ? answers.garaje === "garaje_cargador"
          ? "Que puedas cargar con regularidad para capturar el ahorro real del eléctrico."
          : "Que la rutina de carga pública sea realmente viable en tu día a día."
        : `Que ${primaryType.includes("compra") ? "mantengas el vehículo suficientes años para amortizarlo" : "las condiciones de cuota y permanencia se mantengan razonables"}.`,
    ],
    validaciones_pendientes: [
      primaryType.includes("renting") ? "Confirmar kilómetros incluidos, permanencia y penalizaciones por salida o exceso." : "Revisar precio final, TIN/TAE, seguro y coste de cierre antes de firmar.",
      answers.zbe_impacto === "alta" ? "Verificar etiqueta DGT exacta de la unidad final y acceso real a ZBE." : "Comparar al menos 2 o 3 ofertas reales antes de decidir.",
      "Asegurarse de que la oferta final tenga stock, plazo y condiciones cerradas de verdad.",
    ],
  });
}

function buildActionPlan(answers = {}, primaryType = "", transparency = {}, tcoDetail = {}, companies = []) {
  const confidenceLevel = normalizeText(transparency?.confianza_nivel || "").toLowerCase();
  const semaforo = confidenceLevel === "alta" ? "verde" : confidenceLevel === "ajustada" ? "rojo" : "ambar";
  const topCompanies = normalizeStringArray(companies).slice(0, 2);
  const companyText = topCompanies.length > 0 ? topCompanies.join(" y ") : "plataformas especializadas";
  const costLimit = tcoDetail?.total_mensual ? `${tcoDetail.total_mensual} EUR/mes reales` : "tu limite real mensual";
  const isRenting = primaryType.includes("renting");
  const isPurchase = primaryType.includes("compra");
  const noGarage = answers.garaje === "sin_garaje";
  const prefersElectric = /electri|enchuf/i.test(String(answers.propulsion_preferida || ""));
  const highZbe = answers.zbe_impacto === "alta";

  const statusByLight = {
    verde: "Puedes avanzar a shortlist y cierre",
    ambar: "Buena dirección: compara antes de firmar",
    rojo: "Pausa y revalida antes de comprometerte",
  };

  const summaryByLight = {
    verde: "La recomendación está bastante amarrada; ahora toca ejecutar bien la comparación final y evitar sorpresas en la letra pequeña.",
    ambar: "La línea general es buena, pero todavía hay que validar precio final, condiciones y viabilidad real de la operación.",
    rojo: "Todavía hay demasiadas variables abiertas; conviene afinar el caso antes de cerrar modalidad o motorización.",
  };

  const redFlags = [
    isRenting
      ? "Permanencia larga o exceso de kilómetros mal dimensionado."
      : isPurchase
        ? "Cuota atractiva con TIN/TAE alto, entrada fuerte o coste total poco claro."
        : "Pagar estructura fija alta para un uso que sigue siendo puntual o irregular.",
    highZbe ? "Etiqueta DGT dudosa o acceso real a ZBE sin confirmar." : "Oferta sin stock real o con condiciones no cerradas por escrito.",
    noGarage && prefersElectric
      ? "Electrificación forzada sin una rutina de carga realmente viable."
      : "Firmar sin comparar al menos 2 o 3 alternativas equivalentes.",
  ];

  return normalizeActionPlan({
    semaforo,
    estado: statusByLight[semaforo],
    resumen: summaryByLight[semaforo],
    acciones: [
      `Pide 3 ofertas cerradas a ${companyText} y compáralas con el mismo formato de precio, plazo y servicios.`,
      isRenting
        ? "Descarta cualquier renting con kilómetros, permanencia o penalizaciones que no encajen con tu uso real."
        : isPurchase
          ? "Revisa TIN/TAE, seguro, entrada y coste total final; la cuota sola no basta para decidir bien."
          : "Elige la opción que realmente encaje con tu frecuencia de uso y no te meta coste fijo innecesario.",
      `Marca como techo ${costLimit} y elimina cualquier opción que lo supere de forma consistente.`,
    ],
    alertas_rojas: uniq(redFlags),
  });
}

function normalizeAdvisorResult(value, answers = {}) {
  const main = value?.solucion_principal || {};
  const score = Number.isFinite(Number(main.score)) ? Number(main.score) : Number(value?.alineacion_pct) || 0;
  const mainType = normalizeText(main.tipo);
  const propulsionesViables = enforceUserFuelInPropulsions(normalizeStringArray(value?.propulsiones_viables), answers);
  const providedBreakdown = normalizeScoreBreakdown(value?.score_desglose);
  const providedBreakdownTotal = Object.values(providedBreakdown).reduce((acc, item) => acc + Number(item || 0), 0);
  const score_desglose = providedBreakdownTotal > 0
    ? providedBreakdown
    : Object.keys(answers || {}).length > 0
      ? buildScoreBreakdown(answers, mainType, propulsionesViables)
      : deriveScoreBreakdown(score);
  const por_que_gana = normalizeStringArray(value?.por_que_gana).length > 0
    ? normalizeStringArray(value?.por_que_gana).slice(0, 4)
    : Object.keys(answers || {}).length > 0
      ? buildWhyWins(answers, mainType, propulsionesViables, normalizeText(main.etiqueta_dgt))
      : normalizeStringArray(main.ventajas).slice(0, 3);
  const normalizedAlternatives = Array.isArray(value?.alternativas)
    ? value.alternativas.map(normalizeAlternative).filter((item) => item.titulo || item.razon)
    : [];
  const fallbackTco = Object.keys(answers || {}).length > 0
    ? buildTcoEstimate(answers, mainType, propulsionesViables)
    : {
        concepto_base: "Coste mensual estimado",
        base_mensual: clamp(Math.round(toNumber(main.coste_estimado, 0)), 0, 5000),
        seguro: 0,
        energia: 0,
        mantenimiento: 0,
        extras: 0,
        entrada_inicial: 0,
        total_mensual: clamp(Math.round(toNumber(main.coste_estimado, 0)), 0, 5000),
        total_anual: clamp(Math.round(toNumber(main.coste_estimado, 0) * 12), 0, 120000),
        nota: normalizeText(value?.tco_aviso),
      };
  const tco_detalle = normalizeTcoDetail(value?.tco_detalle, fallbackTco);
  const comparador_final = Array.isArray(value?.comparador_final) && value.comparador_final.length > 0
    ? value.comparador_final.map(normalizeComparatorRow).filter((item) => item.criterio)
    : buildComparatorRows(mainType, answers, score_desglose, tco_detalle, normalizedAlternatives);
  const transparencia = normalizeTransparency(
    value?.transparencia,
    buildTransparencyReport(answers, mainType, propulsionesViables, tco_detalle, score_desglose, score)
  );
  const plan_accion = normalizeActionPlan(
    value?.plan_accion,
    buildActionPlan(answers, mainType, transparencia, tco_detalle, main.empresas_recomendadas || [])
  );
  const vehiculos_recomendados = alignVehicleRecommendationsWithFuel(
    normalizeVehicleRecommendations(value?.vehiculos_recomendados),
    answers,
    propulsionesViables
  );

  return {
    alineacion_pct: Number.isFinite(Number(value?.alineacion_pct)) ? Number(value.alineacion_pct) : 0,
    solucion_principal: {
      tipo: mainType,
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
    score_desglose,
    por_que_gana,
    alternativas: normalizedAlternatives,
    comparador_final,
    transparencia,
    plan_accion,
    tco_aviso: normalizeText(value?.tco_aviso),
    tco_detalle,
    consejo_experto: normalizeText(value?.consejo_experto),
    siguiente_paso: normalizeText(value?.siguiente_paso),
    propulsiones_viables: propulsionesViables,
    vehiculos_recomendados,
  };
}

function isCompleteAdvisorResult(value) {
  const normalized = normalizeAdvisorResult(value);
  const main = normalized.solucion_principal;
  const scoreBreakdownTotal = Object.values(normalized.score_desglose || {}).reduce(
    (acc, item) => acc + Number(item || 0),
    0
  );

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
      normalized.propulsiones_viables.length >= 1 &&
      normalized.por_que_gana.length >= 2 &&
      scoreBreakdownTotal > 0 &&
      normalized.vehiculos_recomendados.length >= 5
  );
}

function buildRecommendedVehiclesFallback(answers = {}, propulsions = []) {
  const marcaPreferencia = normalizeText(answers?.marca_preferencia).toLowerCase();
  const preferredFuel = getPreferredFuelTokens(answers, propulsions);
  const fuel = preferredFuel.join(" ");

  let shortlist = [
    { marca: "Toyota", modelo: "Corolla Hybrid", razon: "Fiabilidad, consumo contenido y alta liquidez en el mercado español." },
    { marca: "Kia", modelo: "Niro", razon: "Buen equilibrio entre espacio, eficiencia y coste total de uso." },
    { marca: "Hyundai", modelo: "Tucson", razon: "SUV familiar con oferta amplia y mantenimiento razonable." },
    { marca: "Skoda", modelo: "Octavia", razon: "Gran relación espacio/precio y buen comportamiento en uso mixto." },
    { marca: "Renault", modelo: "Captur", razon: "Opción urbana-polivalente con costes de entrada competitivos." },
  ];

  if (marcaPreferencia === "nueva_china" || preferredFuel.includes("electrico")) {
    shortlist = [
      { marca: "BYD", modelo: "Dolphin", razon: "Eléctrico equilibrado para ciudad y periurbano con buen equipamiento." },
      { marca: "MG", modelo: "MG4 Electric", razon: "Muy competitivo en coste total para electrificación realista." },
      { marca: "BYD", modelo: "Seal U DM-i", razon: "Alternativa híbrida enchufable con enfoque familiar." },
      { marca: "Omoda", modelo: "5", razon: "Relación precio/equipamiento alta en SUV compacto." },
      { marca: "Jaecoo", modelo: "7", razon: "SUV de enfoque práctico con buen valor percibido." },
    ];
  } else if (preferredFuel.includes("hibrido")) {
    shortlist = [
      { marca: "Toyota", modelo: "Corolla Hybrid", razon: "Referente en híbrido no enchufable por eficiencia y fiabilidad." },
      { marca: "Toyota", modelo: "C-HR Hybrid", razon: "SUV compacto HEV muy coherente para uso mixto y ZBE." },
      { marca: "Kia", modelo: "Niro Hybrid", razon: "Buen equilibrio de coste total y eficiencia urbana/interurbana." },
      { marca: "Hyundai", modelo: "Kona Hybrid", razon: "Formato compacto con etiqueta ECO y consumo contenido." },
      { marca: "Nissan", modelo: "Qashqai e-POWER", razon: "Conducción tipo eléctrica sin necesidad de enchufe." },
    ];
  } else if (preferredFuel.includes("phev")) {
    shortlist = [
      { marca: "Kia", modelo: "Niro PHEV", razon: "PHEV eficiente para trayectos diarios con etiqueta CERO." },
      { marca: "Hyundai", modelo: "Tucson PHEV", razon: "SUV familiar enchufable con buena disponibilidad." },
      { marca: "Peugeot", modelo: "3008 Hybrid", razon: "Oferta PHEV equilibrada en coste-prestaciones." },
      { marca: "Ford", modelo: "Kuga Plug-in Hybrid", razon: "Muy buena relación autonomía eléctrica/precio." },
      { marca: "Mitsubishi", modelo: "Eclipse Cross PHEV", razon: "PHEV conocido y robusto para uso mixto." },
    ];
  }

  return shortlist.map((item, index) => ({
    rank: index + 1,
    ...item,
    titulo: `${item.marca} ${item.modelo}`,
  }));
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

function getAllowedTypesForAdvisorContext(advisorContext = null) {
  if (advisorContext === "renting") {
    return ["renting_largo", "renting_corto", "rent_a_car", "carsharing"];
  }

  if (advisorContext === "buy") {
    return ["compra_contado", "compra_financiada"];
  }

  return [];
}

function isAdvisorResultCompatibleWithContext(resultData, advisorContext = null) {
  if (!advisorContext) {
    return true;
  }

  const allowedTypes = getAllowedTypesForAdvisorContext(advisorContext);
  const topType = normalizeText(resultData?.solucion_principal?.tipo);
  const alternativeTypes = Array.isArray(resultData?.alternativas)
    ? resultData.alternativas.map((item) => normalizeText(item?.tipo)).filter(Boolean)
    : [];
  const allTypes = [topType, ...alternativeTypes].filter(Boolean);

  return allTypes.every((type) => allowedTypes.includes(type));
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

  const prefArr = Array.isArray(answers.propulsion_preferida)
    ? answers.propulsion_preferida
    : answers.propulsion_preferida ? [answers.propulsion_preferida] : [];

  if (prefArr.includes("electrico") && ownCharger && !propulsions.includes("electrico")) {
    propulsions.unshift("electrico");
  }

  if (prefArr.includes("gasolina") && !propulsions.includes("gasolina eficiente")) {
    propulsions.push("gasolina eficiente");
  }

  if (prefArr.includes("diesel") && !propulsions.some((p) => p.toLowerCase().includes("diesel"))) {
    propulsions.push("diesel");
  }

  return [...new Set(propulsions)].slice(0, 4);
}

function getPrimaryType(answers, advisorContext = null) {
  if (advisorContext === "renting") {
    const veryShortHorizon = answers.horizonte;

    if (veryShortHorizon === "por_dias") {
      return "rent_a_car";
    }

    if (veryShortHorizon === "menos_2_meses") {
      return "carsharing";
    }

    if (veryShortHorizon === "menos_1_ano") {
      return "renting_corto";
    }

    return "renting_largo";
  }

  if (advisorContext === "buy") {
    return answers.flexibilidad === "propiedad_contado" ? "compra_contado" : "compra_financiada";
  }

  const flexibility = answers.flexibilidad;
  const lowKm = answers.km_anuales === "menos_10k";
  const cityUse = answers.entorno_uso === "ciudad";
  const dailyCommute = includesAnswer(answers.uso_principal, "trabajo_diario");
  const veryShortHorizon = answers.horizonte;

  if (veryShortHorizon === "por_dias") {
    return "rent_a_car";
  }

  if (veryShortHorizon === "menos_2_meses") {
    return lowKm || cityUse ? "carsharing" : "rent_a_car";
  }

  if (veryShortHorizon === "menos_1_ano") {
    return "renting_corto";
  }

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

function buildTcoEstimate(answers = {}, primaryType = "", propulsions = []) {
  const kmMultiplier = {
    menos_10k: 0.8,
    "10k_20k": 1,
    mas_20k: 1.28,
  }[answers.km_anuales] || 1;
  const budgetAdjust = {
    menos_200: -60,
    "200_350": -10,
    "200_400": -5,
    "350_500": 45,
    "400_700": 70,
    mas_500: 110,
    mas_700: 140,
  }[answers.cuota_mensual] || 0;
  const entryMap = {
    menos_5k: 3000,
    "5k_10k": 7000,
    "10k_20k": 14000,
    mas_20k: 22000,
    no_aplica: 0,
  };
  const lowerPropulsions = removeAccents((propulsions || []).join(" ")).toLowerCase();
  const ownCharger = answers.garaje === "garaje_cargador";
  const noGarage = answers.garaje === "sin_garaje";
  const cityUse = answers.entorno_uso === "ciudad";
  const highwayUse = answers.entorno_uso === "autopista";
  const highRisk = answers.gestion_riesgo === "alto";

  const config = {
    compra_contado: {
      concepto_base: "Amortizacion y perdida de valor",
      base: 240,
      seguro: 62,
      mantenimiento: 48,
      extras: 22,
      entry: entryMap[answers.capital_propio] || 12000,
      note: "En compra pesan de verdad la perdida de valor, el seguro y el mantenimiento aunque la cuota aparente sea baja o inexistente.",
    },
    compra_financiada: {
      concepto_base: "Cuota real de compra / financiacion",
      base: 310,
      seguro: 65,
      mantenimiento: 50,
      extras: 24,
      entry: Math.min(entryMap[answers.capital_propio] || 6000, 12000),
      note: "En compra financiada no basta con mirar la letra: hay que sumar seguro, uso y margen para imprevistos.",
    },
    renting_largo: {
      concepto_base: "Cuota de renting",
      base: 360,
      seguro: 14,
      mantenimiento: 12,
      extras: 18,
      entry: 0,
      note: "En renting parte de seguro y mantenimiento ya suele ir dentro de la cuota, pero la energia y los extras siguen contando.",
    },
    renting_corto: {
      concepto_base: "Cuota flexible",
      base: 430,
      seguro: 16,
      mantenimiento: 14,
      extras: 20,
      entry: 0,
      note: "La flexibilidad acorta permanencias, pero suele encarecer la base mensual frente a una solucion estable.",
    },
    rent_a_car: {
      concepto_base: "Alquiler estimado por uso",
      base: 290,
      seguro: 0,
      mantenimiento: 0,
      extras: 18,
      entry: 0,
      note: "Aqui casi todo el coste va en el uso directo; por eso compensa solo si la necesidad es puntual.",
    },
    carsharing: {
      concepto_base: "Uso estimado por trayecto",
      base: 125,
      seguro: 0,
      mantenimiento: 0,
      extras: 8,
      entry: 0,
      note: "El carsharing gana cuando pagas por uso real y evitas estructura fija de coche propio.",
    },
    carpooling: {
      concepto_base: "Aportacion por viajes",
      base: 60,
      seguro: 0,
      mantenimiento: 0,
      extras: 6,
      entry: 0,
      note: "El ahorro viene de compartir coste, pero dependes mas de horarios y coordinacion.",
    },
    transporte_publico: {
      concepto_base: "Abono y desplazamientos puntuales",
      base: 55,
      seguro: 0,
      mantenimiento: 0,
      extras: 8,
      entry: 0,
      note: "Es la estructura mas ligera si el dia a dia puede resolverse sin coche permanente.",
    },
    micromovilidad: {
      concepto_base: "Suscripcion / viajes urbanos",
      base: 35,
      seguro: 0,
      mantenimiento: 0,
      extras: 10,
      entry: 0,
      note: "Muy barata para trayectos cortos, aunque exige complementar con otras soluciones en cuanto crece la necesidad.",
    },
  }[primaryType] || {
    concepto_base: "Base de movilidad",
    base: 220,
    seguro: 30,
    mantenimiento: 20,
    extras: 15,
    entry: 0,
    note: "El coste real siempre va mas alla del precio visible inicial.",
  };

  let energiaBase = 92;
  if (lowerPropulsions.includes("electrico")) {
    energiaBase = ownCharger ? 32 : 48;
  } else if (lowerPropulsions.includes("phev")) {
    energiaBase = ownCharger ? 44 : 58;
  } else if (lowerPropulsions.includes("hibrid")) {
    energiaBase = 68;
  } else if (lowerPropulsions.includes("diesel")) {
    energiaBase = 82;
  }

  const energyIncludedTypes = ["rent_a_car", "carsharing", "carpooling", "transporte_publico", "micromovilidad"];
  const energia = energyIncludedTypes.includes(primaryType)
    ? 0
    : clamp(
        Math.round(energiaBase * kmMultiplier + (highwayUse ? 12 : 0) + (cityUse ? -4 : 0) + (noGarage && lowerPropulsions.includes("electrico") ? 10 : 0)),
        0,
        220
      );

  const base_mensual = clamp(
    Math.round(
      config.base +
        budgetAdjust +
        (cityUse && ["carsharing", "transporte_publico", "micromovilidad"].includes(primaryType) ? -5 : 0) +
        (highwayUse && ["rent_a_car", "compra_financiada", "compra_contado", "renting_largo"].includes(primaryType) ? 20 : 0) +
        (["compra_contado", "compra_financiada"].includes(primaryType) && answers.capital_propio === "mas_20k" ? -35 : 0)
    ),
    25,
    2500
  );
  const seguro = clamp(
    Math.round(config.seguro + (highRisk && ["compra_contado", "compra_financiada"].includes(primaryType) ? 8 : 0)),
    0,
    250
  );
  const mantenimiento = clamp(
    Math.round(config.mantenimiento + (answers.km_anuales === "mas_20k" ? 12 : 0)),
    0,
    250
  );
  const extras = clamp(
    Math.round(
      config.extras +
        (cityUse && noGarage ? 18 : cityUse ? 8 : 4) +
        (highRisk ? 12 : answers.gestion_riesgo === "medio" ? 6 : 0)
    ),
    0,
    250
  );
  const entrada_inicial = clamp(Math.round(config.entry || 0), 0, 120000);
  const total_mensual = clamp(base_mensual + seguro + energia + mantenimiento + extras, 25, 4000);
  const total_anual = clamp(total_mensual * 12, 300, 120000);

  return normalizeTcoDetail({
    concepto_base: config.concepto_base,
    entrada_inicial,
    base_mensual,
    seguro,
    energia,
    mantenimiento,
    extras,
    total_mensual,
    total_anual,
    nota: config.note,
  });
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
  if (["por_dias", "menos_2_meses", "menos_1_ano"].includes(answers.horizonte) && (answers.flexibilidad === "propiedad_contado" || answers.flexibilidad === "propiedad_financiada")) {
    return "Tu horizonte es muy corto para amortizar una compra; en este caso suele pesar más la flexibilidad que la propiedad.";
  }

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

function buildAlternatives(primaryType, answers, advisorContext = null) {
  const profile = getVehicleProfile(answers);
  const alternativesByType = {
    compra_contado: [
      { tipo: "compra_financiada", score: 76, titulo: `Compra financiada de ${profile}`, razon: "Tiene sentido si prefieres preservar liquidez y mantienes una cuota por debajo de tu limite comodo." },
      { tipo: "compra_financiada", score: 68, titulo: `Compra financiada de ${profile}`, razon: "Buena alternativa si quieres preservar liquidez inicial y repartir esfuerzo mensual." },
    ],
    compra_financiada: [
      { tipo: "compra_contado", score: 79, titulo: `Compra al contado de ${profile}`, razon: "Reduce coste financiero si puedes aumentar entrada y priorizas coste total final." },
      { tipo: "compra_contado", score: 66, titulo: `Compra al contado de ${profile}`, razon: "Interesa si puedes aumentar entrada y evitar coste financiero en una unidad fiable." },
    ],
    renting_largo: [
      { tipo: "renting_corto", score: 74, titulo: "Renting flexible", razon: "Puede encajar mejor si prevés cambios cercanos y no quieres permanencia larga." },
      { tipo: "renting_corto", score: 64, titulo: "Renting flexible", razon: "Solo compensa si preves cambios de vida cercanos y quieres posponer la decision final." },
    ],
    renting_corto: [
      { tipo: "carsharing", score: 72, titulo: "Carsharing + transporte publico", razon: "Muy competitivo si haces pocos kilometros y la mayor parte del uso es urbano y puntual." },
      { tipo: "rent_a_car", score: 68, titulo: "Alquiler por dias o semanas", razon: "Puede ser mejor que un renting corto si realmente solo necesitas cobertura temporal y uso esporadico." },
    ],
    carsharing: [
      { tipo: "transporte_publico", score: 77, titulo: "Transporte publico como base", razon: "Reduce aun mas el coste fijo si puedes cubrir el dia a dia sin coche propio." },
      { tipo: "rent_a_car", score: 69, titulo: "Alquiler por dias o semanas", razon: "Conviene cuando el uso es puntual pero necesitas coche completo en momentos concretos." },
    ],
    rent_a_car: [
      { tipo: "carsharing", score: 78, titulo: "Carsharing para trayectos urbanos", razon: "Suele ser mas eficiente si el uso es esporadico, urbano y no necesitas reservar coche varios dias seguidos." },
      { tipo: "renting_corto", score: 66, titulo: `Renting corto de ${profile}`, razon: "Solo compensa si ya sabes que necesitaras coche de forma continua durante varios meses." },
    ],
    transporte_publico: [
      { tipo: "carsharing", score: 73, titulo: "Carsharing para fines de semana", razon: "Complementa bien desplazamientos ocasionales sin asumir cuota mensual fija alta." },
      { tipo: "micromovilidad", score: 61, titulo: "Micromovilidad urbana", razon: "Encaja si la mayoria de trayectos son cortos y dentro de ciudad." },
    ],
  };

  const alternatives = alternativesByType[primaryType] || [
    { tipo: "compra_financiada", score: 70, titulo: `Compra financiada de ${profile}`, razon: "Mantiene equilibrio entre control mensual, disponibilidad total y valor residual." },
    { tipo: "renting_largo", score: 65, titulo: "Renting con servicios incluidos", razon: "Interesa si priorizas simplificar gestion y fijar coste total." },
  ];

  if (!advisorContext) {
    return alternatives;
  }

  const allowedTypes = getAllowedTypesForAdvisorContext(advisorContext);
  return alternatives.filter((item) => allowedTypes.includes(item.tipo)).slice(0, 2);
}

function buildFallbackAdvisorResult(answers = {}, advisorContext = null) {
  const primaryType = getPrimaryType(answers, advisorContext);
  const propulsions = getViablePropulsions(answers);
  const dgtLabel = getDgtLabel(propulsions);
  const vehicleProfile = getVehicleProfile(answers);
  const highRiskControl = answers.gestion_riesgo === "alto";
  const highZbe = answers.zbe_impacto === "alta";
  const scoreBreakdown = buildScoreBreakdown(answers, primaryType, propulsions);
  const score = clamp(
    Object.values(scoreBreakdown).reduce((acc, item) => acc + Number(item || 0), 0),
    68,
    92
  );
  const companies = getCompaniesForType(primaryType);
  const cost = getCostEstimate(primaryType, answers);
  const tension = getTensionPrincipal(answers, primaryType);
  const whyWins = buildWhyWins(answers, primaryType, propulsions, dgtLabel);
  const tcoDetail = buildTcoEstimate(answers, primaryType, propulsions);
  const alternatives = buildAlternatives(primaryType, answers, advisorContext);
  const comparadorFinal = buildComparatorRows(primaryType, answers, scoreBreakdown, tcoDetail, alternatives);
  const transparencia = buildTransparencyReport(answers, primaryType, propulsions, tcoDetail, scoreBreakdown, score);
  const planAccion = buildActionPlan(answers, primaryType, transparencia, tcoDetail, companies);
  const vehiculosRecomendados = buildRecommendedVehiclesFallback(answers, propulsions);

  const titles = {
    compra_contado: `Compra al contado de ${vehicleProfile}`,
    compra_financiada: `Compra financiada de ${vehicleProfile}`,
    renting_largo: `Renting a largo plazo de ${vehicleProfile}`,
    renting_corto: `Renting a corto plazo para ${vehicleProfile}`,
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
    score_desglose: scoreBreakdown,
    por_que_gana: whyWins,
    alternativas: alternatives,
    comparador_final: comparadorFinal,
    transparencia,
    plan_accion: planAccion,
    tco_aviso: `Para este perfil, el coste total real ronda ${tcoDetail.total_mensual} EUR/mes (${tcoDetail.total_anual} EUR al ano). Aqui pesan sobre todo ${tcoDetail.concepto_base.toLowerCase()}, la energia y el colchon de extras para no tensionarte.`,
    tco_detalle: tcoDetail,
    consejo_experto: highZbe
      ? "Si entras a ZBE con frecuencia, prioriza versiones con etiqueta ECO o CERO y confirma por VIN o ficha tecnica la etiqueta exacta antes de cerrar nada."
      : "Pide siempre oferta desglosada con precio final, comision, vinculaciones y coste total a 36-72 meses; ahi es donde suelen esconderse las peores decisiones.",
    siguiente_paso: `Esta semana compara 3 ofertas de ${companies.slice(0, 2).join(" y ")} para ${vehicleProfile} y descarta cualquier opcion cuyo TCO real supere ${tcoDetail.total_mensual} EUR/mes o no encaje con ${propulsions.join(", ")}.`,
    propulsiones_viables: propulsions,
    vehiculos_recomendados: vehiculosRecomendados,
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
    const advisorContext = normalizeText(body?.advisorContext || null) || null;

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

    if (parsed && isCompleteAdvisorResult(parsed) && isAdvisorResultCompatibleWithContext(parsed, advisorContext)) {
      return res.status(200).json({ parsed: normalizeAdvisorResult(parsed, answers) });
    }

    const repairPrompt = `${prompt}\n\nLa respuesta anterior ha llegado incompleta o con campos vacios. Repite el analisis y devuelve JSON VALIDO COMPLETO. Requisitos obligatorios:\n- No dejes ningun string vacio.\n- Incluye exactamente 3 ventajas.\n- Incluye exactamente 2 inconvenientes.\n- Incluye exactamente 2 alternativas con titulo, score y razon.\n- Incluye score_desglose con encaje_uso, coste_total, flexibilidad, viabilidad_real y ajuste_preferencias.\n- Incluye 4 bullets en por_que_gana.\n- Incluye comparador_final con 3-4 filas comparando criterio, opcion_principal, alternativa_1, alternativa_2 y ganador.\n- Incluye transparencia con confianza_nivel, confianza_motivo, supuestos_clave y validaciones_pendientes.\n- Incluye plan_accion con semaforo, estado, resumen, acciones y alertas_rojas.\n- Incluye tco_detalle con concepto_base, entrada_inicial, base_mensual, seguro, energia, mantenimiento, extras, total_mensual, total_anual y nota.\n- Incluye al menos 3 empresas_recomendadas reales en Espana.\n- Incluye consejo_experto, siguiente_paso y tco_aviso con contenido concreto.\n- Incluye vehiculos_recomendados con exactamente 5 entradas (marca, modelo, rank, titulo, razon), sin repetir modelo.\n- Devuelve solo JSON.`;

    const repairedGeneration = await generateContent(repairPrompt);

    if (repairedGeneration.ok) {
      const repairedText = repairedGeneration.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const repairedParsed = parseGeminiJson(repairedText);

      if (repairedParsed && isCompleteAdvisorResult(repairedParsed) && isAdvisorResultCompatibleWithContext(repairedParsed, advisorContext)) {
        return res.status(200).json({ parsed: normalizeAdvisorResult(repairedParsed, answers) });
      }
    }

    return res.status(200).json({
      parsed: buildFallbackAdvisorResult(answers, advisorContext),
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
