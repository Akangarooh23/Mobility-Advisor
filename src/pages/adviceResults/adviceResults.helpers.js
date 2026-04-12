export function getOfferActionMeta(offer) {
  if (!offer) return null;
  if (offer.url) {
    return { href: offer.url, label: "Abrir oferta exacta ↗", exact: true };
  }
  if (offer.searchUrl) {
    return { href: offer.searchUrl, label: "Ir al portal ↗", exact: false };
  }
  return null;
}

export function buildAdviceResultsViewModel({
  result,
  resultView,
  answers,
  listingResult,
  listingFilters,
  listingOptions,
  listingSearchCoverage,
  savedComparisons,
  MOBILITY_TYPES,
  sanitizeResultForDisplay,
  getQuickValidationQuestions,
  normalizeText,
  buildMarketRadarSnapshot,
  buildOfferModelSuggestions,
  normalizeStringArray,
  resolveOfferProviderName,
  getOfferFallbackSearchUrl,
  getOfferNavigationUrl,
  normalizeOfferAssetUrl,
  hasOfferRealImage,
  isRecommendationSaved,
  buildSearchCoverageSummary,
}) {
  const displayResult = sanitizeResultForDisplay(result);
  const mt =
    MOBILITY_TYPES[result.solucion_principal?.tipo] || {
      label: "Movilidad",
      icon: "🚗",
      color: "#2563EB",
    };
  const solutionType = result.solucion_principal?.tipo;
  const isBuyOrFinanceOutcome = ["compra_contado", "compra_financiada"].includes(solutionType);
  const isRentingOutcome = ["renting_largo", "renting_corto"].includes(solutionType);
  const isFlexibleMobilityOutcome = ["rent_a_car", "carsharing"].includes(solutionType);
  const shouldShowChargingChecklist =
    (isBuyOrFinanceOutcome || isRentingOutcome) &&
    ((result.solucion_principal?.etiqueta_dgt === "CERO") ||
      (result.propulsiones_viables || []).some((p) => /(electric|electri|phev|enchuf)/i.test(String(p))));
  const listingModeLabel = isRentingOutcome
    ? "renting"
    : isFlexibleMobilityOutcome
      ? "movilidad flexible"
      : "compra";
  const canSearchListing = Boolean(result);
  const quickValidationQuestions = getQuickValidationQuestions({
    shouldShowChargingChecklist,
    isBuyOrFinanceOutcome,
    isRentingOutcome,
  });
  const scoreBreakdown = displayResult.score_desglose || {};
  const whyThisWins = Array.isArray(displayResult.por_que_gana)
    ? displayResult.por_que_gana.slice(0, 4)
    : [];
  const tcoDetail = displayResult.tco_detalle || {};
  const comparatorRows = Array.isArray(displayResult.comparador_final)
    ? displayResult.comparador_final.slice(0, 4)
    : [];
  const transparency = displayResult.transparencia || {};
  const transparencyAssumptions = Array.isArray(transparency.supuestos_clave)
    ? transparency.supuestos_clave.slice(0, 4)
    : [];
  const transparencyChecks = Array.isArray(transparency.validaciones_pendientes)
    ? transparency.validaciones_pendientes.slice(0, 4)
    : [];
  const confidenceLevel = normalizeText(transparency.confianza_nivel || "").toLowerCase();
  const confidenceLabel = confidenceLevel ? ` · CONFIANZA ${confidenceLevel.toUpperCase()}` : "";
  const actionPlan = displayResult.plan_accion || {};
  const actionSteps = Array.isArray(actionPlan.acciones) ? actionPlan.acciones.slice(0, 4) : [];
  const actionAlerts = Array.isArray(actionPlan.alertas_rojas) ? actionPlan.alertas_rojas.slice(0, 3) : [];
  const trafficLight = normalizeText(actionPlan.semaforo || "").toLowerCase();
  const trafficTone =
    trafficLight === "verde"
      ? { bg: "rgba(16,185,129,0.07)", border: "rgba(52,211,153,0.18)", text: "#6ee7b7", chip: "rgba(16,185,129,0.14)" }
      : trafficLight === "rojo"
        ? { bg: "rgba(239,68,68,0.07)", border: "rgba(248,113,113,0.18)", text: "#fca5a5", chip: "rgba(239,68,68,0.14)" }
        : { bg: "rgba(245,158,11,0.07)", border: "rgba(251,191,36,0.18)", text: "#fbbf24", chip: "rgba(245,158,11,0.14)" };
  const trafficLabel =
    trafficLight === "verde"
      ? "VERDE · PUEDES AVANZAR"
      : trafficLight === "rojo"
        ? "ROJO · PAUSA Y REVALIDA"
        : "ÁMBAR · COMPARA ANTES DE FIRMAR";
  const marketRadar = buildMarketRadarSnapshot(displayResult, listingResult, listingFilters);
  const savedComparisonItems = Array.isArray(savedComparisons) ? savedComparisons.slice(0, 3) : [];
  const realOfferCardsRaw = Array.isArray(listingOptions) && listingOptions.length > 0
    ? listingOptions.slice(0, 4)
    : listingResult
      ? [listingResult]
      : [];
  const realOfferCards = realOfferCardsRaw.map((offer) => {
    const directUrl = getOfferNavigationUrl(offer, displayResult);

    return {
      ...offer,
      image: normalizeOfferAssetUrl(offer?.image) || "",
      hasRealImage: hasOfferRealImage(offer),
      url: directUrl,
      searchUrl: !directUrl ? normalizeText(offer?.searchUrl || "") : "",
    };
  });
  const offerModelSuggestions = buildOfferModelSuggestions(answers, displayResult);
  const providerSpecificSeeds = normalizeStringArray(displayResult.solucion_principal?.empresas_recomendadas).map((company, index) => {
    const model = offerModelSuggestions[index % Math.max(offerModelSuggestions.length, 1)] || displayResult.solucion_principal?.titulo || `Opción ${index + 1}`;
    const providerName = resolveOfferProviderName(company);
    return {
      key: `company-${providerName}-${index}`,
      title: `${model} · ${isRentingOutcome || isFlexibleMobilityOutcome ? "referencia a validar en" : "unidad orientativa en"} ${providerName}`,
      source: providerName,
      description: `${displayResult.solucion_principal?.resumen || "Proveedor priorizado por la recomendación del test."} Modelo concreto priorizado: ${model}.`,
      rankingScore: Math.max(58, Number(displayResult.solucion_principal?.score || 70) - (index + 1) * 4),
      url: getOfferFallbackSearchUrl({ title: model, source: providerName, listingType: displayResult.solucion_principal?.tipo }, displayResult),
      reason:
        index === 0
          ? `Queda arriba porque ${model} encaja especialmente bien con tu perfil y es una vía prioritaria en ${company}.`
          : `Se mantiene como alternativa concreta con ${model} para comparar condiciones reales.`,
      signals: [`Modelo sugerido: ${model}`, "Proveedor priorizado por tu solución"],
    };
  });

  const syntheticOfferSeeds = [
    ...providerSpecificSeeds,
    ...(Array.isArray(displayResult.alternativas)
      ? displayResult.alternativas.map((alternative, index) => {
          const model = offerModelSuggestions[(index + providerSpecificSeeds.length) % Math.max(offerModelSuggestions.length, 1)] || displayResult.solucion_principal?.titulo || `Alternativa ${index + 1}`;
          const alternativeSource = alternative?.tipo
            ? MOBILITY_TYPES[alternative.tipo]?.label || alternative.tipo
            : "Mercado general";
          return {
            key: `alternative-${normalizeText(alternative?.titulo || alternative?.tipo || index)}-${index}`,
            title: `${model} · ${alternative?.titulo || `Alternativa ${index + 1}`}`,
            source: alternativeSource,
            description:
              alternative?.razon ||
              `Ruta secundaria útil para comparar usando un modelo concreto como ${model}.`,
            rankingScore: Math.max(54, 68 - index * 4),
            url: getOfferFallbackSearchUrl({ title: model, source: alternativeSource, listingType: displayResult.solucion_principal?.tipo }, displayResult),
            reason: `Se mantiene como vía complementaria #${index + 1} con el modelo ${model} para no depender de una sola opción.`,
            signals: [`Modelo sugerido: ${model}`, `Alternativa ${index + 1}`],
          };
        })
      : []),
  ];

  if (!syntheticOfferSeeds.length) {
    const primaryModel = offerModelSuggestions[0] || displayResult.solucion_principal?.titulo || "Toyota Corolla";
    const backupModel = offerModelSuggestions[1] || offerModelSuggestions[0] || "Kia Niro";
    syntheticOfferSeeds.push(
      {
        key: "generic-primary",
        title: `${primaryModel} · ${listingModeLabel} sugerido`,
        source:
          MOBILITY_TYPES[displayResult.solucion_principal?.tipo]?.label ||
          displayResult.solucion_principal?.tipo ||
          "movilidad",
        description:
          `Referencia base para empezar a comparar ya mismo con un modelo concreto: ${primaryModel}.`,
        rankingScore: 72,
        reason: `Se muestra primero para que siempre tengas una oferta base visible con el modelo ${primaryModel}.`,
        signals: [`Modelo sugerido: ${primaryModel}`, "Base del asesor"],
        url: getOfferFallbackSearchUrl({ title: primaryModel, source: "Mercado general", listingType: displayResult.solucion_principal?.tipo }, displayResult),
      },
      {
        key: "generic-backup",
        title: `${backupModel} · alternativa flexible comparable`,
        source: "Mercado general",
        description: `Opción de respaldo útil para comparar cuota, permanencia y coste total con ${backupModel}.`,
        rankingScore: 64,
        reason: `Se conserva como respaldo para que nunca te quedes sin opciones visibles usando ${backupModel}.`,
        signals: [`Modelo sugerido: ${backupModel}`, "Comparativa rápida"],
        url: getOfferFallbackSearchUrl({ title: backupModel, source: "Mercado general", listingType: displayResult.solucion_principal?.tipo }, displayResult),
      }
    );
  }

  const syntheticOfferCards = syntheticOfferSeeds
    .filter(
      (seed) =>
        !realOfferCards.some(
          (item) =>
            normalizeText(item?.source || item?.title).toLowerCase().includes(normalizeText(seed.source).toLowerCase()) ||
            normalizeText(item?.title).toLowerCase() === normalizeText(seed.title).toLowerCase()
        )
    )
    .map((seed, index) => ({
      title: seed.title,
      source: seed.source,
      price: "",
      description: seed.description,
      rankingScore: seed.rankingScore,
      rankPosition: realOfferCards.length + index + 1,
      positionReason: seed.reason,
      rankingSignals: seed.signals,
      image: "",
      hasRealImage: false,
      url: "",
      searchUrl: seed.url || getOfferFallbackSearchUrl(seed, displayResult),
      synthetic: true,
    }));

  const offerCards = [...realOfferCards, ...syntheticOfferCards].slice(0, 4);
  const featuredOffer = offerCards[0] || null;
  const otherOffers = offerCards.slice(1, 4);
  const featuredOfferAction = featuredOffer ? getOfferActionMeta(featuredOffer) : null;
  const featuredOfferSaved = featuredOffer ? isRecommendationSaved(featuredOffer) : false;
  const listingCoverageSummary = buildSearchCoverageSummary(listingSearchCoverage);
  const isOffersResultView = resultView === "offers";
  const winnerLabels = {
    principal: "Gana la recomendada",
    alternativa_1: "Gana la alternativa 1",
    alternativa_2: "Gana la alternativa 2",
  };
  const tcoBreakdownItems = [
    { key: "base_mensual", label: tcoDetail.concepto_base || "Base mensual", color: "#fbbf24" },
    { key: "seguro", label: "Seguro", color: "#60a5fa" },
    { key: "energia", label: "Energía / combustible", color: "#34d399" },
    { key: "mantenimiento", label: "Mantenimiento", color: "#c084fc" },
    { key: "extras", label: "Extras / colchón", color: "#f472b6" },
  ].filter((item) => Number(tcoDetail[item.key] || 0) > 0);
  const shouldOfferValuationPrompt = ["si_entrego", "si_vendo"].includes(normalizeText(answers?.vehiculo_actual));
  const valuationPromptTitle = normalizeText(answers?.vehiculo_actual) === "si_entrego"
    ? "Tasación para entregar tu coche"
    : "Tasación para vender tu coche aparte";
  const valuationPromptText = normalizeText(answers?.vehiculo_actual) === "si_entrego"
    ? "Antes de cerrar una compra o financiación, conviene estimar cuánto te puede aportar tu coche actual como entrega."
    : "Si vas a vender tu coche por separado, te conviene revisar su tasación para compararla con estas ofertas con el coste real completo.";
  const scoreBreakdownEntries = [
    { key: "encaje_uso", label: "Encaje con tu uso", max: 25, color: "#38bdf8" },
    { key: "coste_total", label: "Coste total", max: 20, color: "#34d399" },
    { key: "flexibilidad", label: "Flexibilidad", max: 20, color: "#a78bfa" },
    { key: "viabilidad_real", label: "Viabilidad real", max: 20, color: "#f59e0b" },
    { key: "ajuste_preferencias", label: "Ajuste contigo", max: 15, color: "#f472b6" },
  ];

  return {
    displayResult,
    mt,
    isBuyOrFinanceOutcome,
    isRentingOutcome,
    canSearchListing,
    quickValidationQuestions,
    scoreBreakdown,
    whyThisWins,
    tcoDetail,
    comparatorRows,
    transparency,
    transparencyAssumptions,
    transparencyChecks,
    confidenceLevel,
    confidenceLabel,
    actionPlan,
    actionSteps,
    actionAlerts,
    trafficTone,
    trafficLabel,
    marketRadar,
    savedComparisonItems,
    featuredOffer,
    otherOffers,
    featuredOfferAction,
    featuredOfferSaved,
    listingCoverageSummary,
    isOffersResultView,
    winnerLabels,
    tcoBreakdownItems,
    shouldOfferValuationPrompt,
    valuationPromptTitle,
    valuationPromptText,
    scoreBreakdownEntries,
  };
}
