import {
  ANSWER_BUDGET_TO_FILTER,
  MONTHLY_BUDGET_OPTIONS,
  MOBILITY_TYPES,
} from "../data/marketData";
import { normalizeText } from "./offerHelpers";

export function getOptionAmount(options, value) {
  return options.find((option) => option.value === value)?.amount || 0;
}

export function getOptionLabel(options, value, fallback = "No indicado") {
  return options.find((option) => option.value === value)?.label || normalizeText(value) || fallback;
}

export function estimateMonthlyPayment(amount, months = 72, annualRate = 0.0899) {
  if (!amount) {
    return 0;
  }

  const monthlyRate = annualRate / 12;
  const factor = Math.pow(1 + monthlyRate, months);
  return Math.round((amount * monthlyRate * factor) / (factor - 1));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function inferListingBudgetFromAnswers(answers = {}) {
  return ANSWER_BUDGET_TO_FILTER[answers?.cuota_mensual] || "";
}

export function getQuickValidationQuestions({ shouldShowChargingChecklist, isBuyOrFinanceOutcome, isRentingOutcome }) {
  if (shouldShowChargingChecklist) {
    return [
      { id: "carga_casa", label: "¿Puedes cargar en casa o en tu plaza al menos 2-3 veces por semana?" },
      { id: "carga_publica", label: "¿Tienes un punto público fiable cerca de casa o trabajo?" },
      { id: "viajes_largos", label: "¿Tus viajes largos encajan con paradas de recarga cada 2-3 horas?" },
    ];
  }

  if (isBuyOrFinanceOutcome) {
    return [
      { id: "cuota_comoda", label: "¿La cuota o el desembolso final te queda realmente cómodo cada mes?" },
      { id: "entrada_lista", label: "¿Tienes clara la entrada / capital inicial que quieres usar?" },
      { id: "riesgo_controlado", label: "¿Te sientes cómodo asumiendo propiedad, seguro y mantenimiento?" },
    ];
  }

  if (isRentingOutcome) {
    return [
      { id: "km_estables", label: "¿Tu kilometraje anual es bastante estable y previsible?" },
      { id: "permanencia_ok", label: "¿Aceptarías una permanencia de 24-48 meses si la cuota compensa?" },
      { id: "servicios_ok", label: "¿Prefieres cuota cerrada aunque no te quedes el coche en propiedad?" },
    ];
  }

  return [
    { id: "uso_puntual", label: "¿El coche lo necesitas solo en momentos concretos y no todos los días?" },
    { id: "cobertura_zona", label: "¿Tienes cobertura real de movilidad flexible cerca de casa o trabajo?" },
    { id: "sin_permanencia", label: "¿Prefieres evitar permanencias o costes fijos altos ahora mismo?" },
  ];
}

export function buildOfferRanking({ brand, model, acquisition, condition, priceRange = 0, ageFilter, mileageFilter }) {
  const basePriceByBrand = {
    Toyota: 23900,
    Renault: 21400,
    Seat: 20600,
    Volkswagen: 25400,
    Peugeot: 22600,
    BMW: 36800,
    Audi: 38200,
    Mercedes: 39900,
    Volvo: 36400,
    Kia: 24800,
    Hyundai: 24100,
    Nissan: 23200,
    Skoda: 22900,
    Citroen: 21500,
    Dacia: 18900,
    MG: 22100,
  };

  const basePrice = basePriceByBrand[brand] || 24500;
  const ageLimit = ageFilter === "all" ? 6 : Number(ageFilter);
  const mileageLimit = mileageFilter === "all" ? 90000 : Number(mileageFilter);
  const acquisitionDelta = acquisition === "contado" ? -600 : acquisition === "financiado" ? 400 : acquisition === "mixto" ? 150 : 0;
  const conditionDelta = condition === "nuevo" ? 0 : condition === "seminuevo" ? -3200 : -6200;
  const targetPriceCap = Number(priceRange || 0);

  return [0, 1, 2].map((index) => {
    const age = Math.max(0, ageLimit - index);
    const mileage = Math.max(10000, mileageLimit - index * 14000);
    const rawPrice = basePrice + acquisitionDelta + conditionDelta - index * 1800;
    const price = targetPriceCap > 0
      ? Math.max(8900, Math.min(rawPrice, targetPriceCap - index * 600))
      : Math.max(8900, rawPrice);
    const score = Math.max(74, 93 - index * 6);

    return {
      id: `${brand}-${model}-${index}`,
      title: `${brand} ${model} ${condition === "nuevo" ? "nuevo" : condition === "seminuevo" ? "seminuevo" : "VO certificado"}`,
      price,
      monthly: acquisition === "contado" ? null : estimateMonthlyPayment(Math.max(4000, price * 0.75 - index * 600)),
      age,
      mileage,
      score,
      seller: index === 0 ? "Concesionario oficial" : index === 1 ? "Broker especializado" : "Multimarca certificado",
      insight:
        index === 0
          ? "Mejor equilibrio entre precio, equipamiento y rotación de mercado."
          : index === 1
          ? "Oferta competitiva, pero conviene revisar comisiones y coste financiero asociado."
          : "Alternativa de ahorro con más kilometraje, útil si prima presupuesto sobre valor futuro.",
    };
  });
}

export function buildSellEstimate({ brand, model, year, mileage, fuel, sellerType }) {
  const currentYear = 2026;
  const age = Math.max(0, currentYear - Number(year || currentYear));
  const km = Number(mileage || 0);
  const base = 28000 - age * 1700 - km * 0.045;
  const fuelAdjust = fuel === "Híbrido" || fuel === "PHEV" ? 1200 : fuel === "Eléctrico" ? 1800 : fuel === "Diésel" ? -900 : 0;
  const channelAdjust = sellerType === "particular" ? 900 : sellerType === "profesional" ? 0 : -600;
  const center = Math.max(3500, Math.round(base + fuelAdjust + channelAdjust));

  return {
    targetPrice: center,
    lowPrice: Math.max(2900, center - 1200),
    highPrice: center + 1300,
    similarUnits: Math.max(14, 86 - age * 7),
    trend: age <= 3 ? "Mercado estable con demanda activa" : "Mayor sensibilidad a kilometraje y mantenimiento",
    report:
      `${brand} ${model}: recomendamos salir a mercado cerca de ${formatCurrency(center)} y argumentar mantenimiento, equipamiento y trazabilidad para sostener precio.`,
  };
}

export function buildMarketRadarSnapshot(result, listingResult, listingFilters = {}) {
  const solutionType = normalizeText(result?.solucion_principal?.tipo);
  const confidence = normalizeText(result?.transparencia?.confianza_nivel || "").toLowerCase();
  const tcoTotal = Number(result?.tco_detalle?.total_mensual || 0);
  const ranking = Number(listingResult?.rankingScore ?? listingResult?.profileScore ?? 0);
  const budgetLabel = getOptionLabel(MONTHLY_BUDGET_OPTIONS, listingFilters?.budget, "tu rango de cuota");
  const targetText = tcoTotal > 0 ? formatCurrency(tcoTotal) : budgetLabel;
  const rankingTarget = ranking > 0 ? Math.max(70, Math.min(85, ranking - 2)) : 75;

  const signals = [
    `Prioriza ofertas que se muevan en torno a ${targetText}${ranking > 0 ? ` y mantengan un encaje de al menos ${rankingTarget}/100.` : "."}`,
    listingResult?.source
      ? `Si reaparece una oferta parecida en ${listingResult.source}, compárala contra tu shortlist guardado.`
      : "Repite la búsqueda cuando cambies cuota, entrada o estabilidad de ingresos para ver si mejora el mercado.",
    ["renting_largo", "renting_corto"].includes(solutionType)
      ? "En renting, vigila kilómetros incluidos, permanencia y penalizaciones antes de dar una cuota por buena."
      : "En compra o financiación, manda el coste total final; no te quedes solo con la cuota o el precio gancho.",
  ];

  const alerts = [
    confidence === "ajustada"
      ? "Si cambian uso, kilometraje o garaje, repite el test antes de comprometerte."
      : "Descarta cualquier oferta con letra pequeña o condiciones que no vengan cerradas por escrito.",
    result?.solucion_principal?.etiqueta_dgt === "CERO" || result?.solucion_principal?.etiqueta_dgt === "ECO"
      ? "Confirma siempre la etiqueta DGT exacta de la unidad real anunciada."
      : "Vigila restricciones futuras si la unidad final no mejora tu etiqueta ambiental.",
  ];

  return {
    objetivo: `Radar activo: busca una opción que respete ${targetText} y no empeore el encaje real de tu solución.`,
    senales_verdes: [...new Set(signals.filter(Boolean))].slice(0, 3),
    alertas: [...new Set(alerts.filter(Boolean))].slice(0, 3),
  };
}

export function buildSavedComparisonKey({ result, listingResult }) {
  const offerSeed = normalizeText(
    listingResult?.url || listingResult?.searchUrl || listingResult?.title
  ).toLowerCase();
  const solutionType = normalizeText(result?.solucion_principal?.tipo || "movilidad").toLowerCase();
  const solutionTitle = normalizeText(result?.solucion_principal?.titulo || "recomendacion").toLowerCase();

  return offerSeed
    ? `saved-offer:${offerSeed}`
    : `saved-solution:${solutionType}:${solutionTitle}`;
}

export function buildComparisonSnapshot({ result, answers, listingResult, listingFilters }) {
  const type = normalizeText(result?.solucion_principal?.tipo);
  const typeMeta = MOBILITY_TYPES[type] || { label: "Movilidad" };
  const radar = buildMarketRadarSnapshot(result, listingResult, listingFilters);

  return {
    id: buildSavedComparisonKey({ result, listingResult }),
    savedAt: new Date().toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    title:
      normalizeText(listingResult?.title || result?.solucion_principal?.titulo) ||
      "Comparativa guardada",
    typeKey: type,
    typeLabel: typeMeta.label,
    score: Number(result?.solucion_principal?.score || result?.alineacion_pct || 0),
    confidence: normalizeText(result?.transparencia?.confianza_nivel || "media"),
    monthlyTotal: Number(result?.tco_detalle?.total_mensual || 0),
    budgetLabel: getOptionLabel(MONTHLY_BUDGET_OPTIONS, listingFilters?.budget, "Sin cuota fijada"),
    usageLabel: normalizeText(answers?.entorno_uso || "mixto"),
    sourceLabel: normalizeText(listingResult?.source),
    listingTitle: normalizeText(listingResult?.title),
    listingPrice: normalizeText(listingResult?.price),
    targetUrl: normalizeText(listingResult?.url || listingResult?.searchUrl),
    targetExact: Boolean(normalizeText(listingResult?.url)),
    radar,
  };
}

export function inferBrandPreferenceFromBrand(brand) {
  const normalized = normalizeText(brand).toLowerCase();

  if (["volkswagen", "seat", "renault", "skoda", "peugeot", "citroen", "dacia"].includes(normalized)) {
    return "generalista_europea";
  }

  if (["toyota", "hyundai", "kia", "nissan", "mazda", "honda"].includes(normalized)) {
    return "asiatica_fiable";
  }

  if (["bmw", "audi", "mercedes"].includes(normalized)) {
    return "premium_alemana";
  }

  if (["volvo"].includes(normalized)) {
    return "premium_escandinava";
  }

  if (["byd", "mg", "xpeng"].includes(normalized)) {
    return "nueva_china";
  }

  return "sin_preferencia";
}

export function mapFuelToPreference(fuel) {
  const normalized = normalizeText(fuel).toLowerCase();

  if (normalized.includes("eléctr") || normalized.includes("electric")) {
    return "electrico_puro";
  }
  if (normalized.includes("phev")) {
    return "hibrido_enchufable";
  }
  if (normalized.includes("híbr") || normalized.includes("hibri")) {
    return "hibrido_no_enchufable";
  }
  if (normalized.includes("diés") || normalized.includes("dies")) {
    return "diesel";
  }

  return "gasolina";
}
