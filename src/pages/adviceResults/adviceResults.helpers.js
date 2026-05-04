export function getOfferActionMeta(offer, uiLanguage = "es") {
  const isEn = uiLanguage === "en";
  if (!offer) return null;
  if (offer.url) {
    return { href: offer.url, label: isEn ? "Open exact listing ↗" : "Abrir oferta exacta ↗", exact: true };
  }
  if (offer.searchUrl) {
    return { href: offer.searchUrl, label: isEn ? "Go to portal ↗" : "Ir al portal ↗", exact: false };
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
  uiLanguage = "es",
}) {
  const isEn = uiLanguage === "en";
  const txt = (es, en) => (isEn ? en : es);
  const generalMarketLabel = txt("Mercado general", "General market");
  const displayResult = sanitizeResultForDisplay(result);
  const mt =
    MOBILITY_TYPES[result.solucion_principal?.tipo] || {
      label: txt("Movilidad", "Mobility"),
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
    ? txt("renting", "leasing")
    : isFlexibleMobilityOutcome
      ? txt("movilidad flexible", "flexible mobility")
      : txt("compra", "purchase");
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
  const confidenceLabel = confidenceLevel ? ` · ${txt("CONFIANZA", "CONFIDENCE")} ${confidenceLevel.toUpperCase()}` : "";
  const actionPlan = displayResult.plan_accion || {};
  const actionSteps = Array.isArray(actionPlan.acciones) ? actionPlan.acciones.slice(0, 4) : [];
  const actionAlerts = Array.isArray(actionPlan.alertas_rojas) ? actionPlan.alertas_rojas.slice(0, 3) : [];
  const trafficLight = normalizeText(actionPlan.semaforo || "").toLowerCase();
  const trafficTone =
    trafficLight === "verde"
      ? { bg: "rgba(16,185,129,0.07)", border: "rgba(52,211,153,0.18)", text: "#047857", chip: "rgba(16,185,129,0.14)" }
      : trafficLight === "rojo"
        ? { bg: "rgba(239,68,68,0.07)", border: "rgba(248,113,113,0.18)", text: "#b91c1c", chip: "rgba(239,68,68,0.14)" }
        : { bg: "rgba(245,158,11,0.07)", border: "rgba(251,191,36,0.18)", text: "#b45309", chip: "rgba(245,158,11,0.14)" };
  const trafficLabel =
    trafficLight === "verde"
      ? txt("VERDE · PUEDES AVANZAR", "GREEN · YOU CAN PROCEED")
      : trafficLight === "rojo"
        ? txt("ROJO · PAUSA Y REVALIDA", "RED · PAUSE AND REVALIDATE")
        : txt("ÁMBAR · COMPARA ANTES DE FIRMAR", "AMBER · COMPARE BEFORE SIGNING");
  const marketRadar = buildMarketRadarSnapshot(displayResult, listingResult, listingFilters);
  const savedComparisonItems = Array.isArray(savedComparisons) ? savedComparisons.slice(0, 3) : [];
  const realOfferCardsRaw = (
    Array.isArray(listingOptions) && listingOptions.length > 0
      ? listingOptions
      : listingResult
        ? [listingResult]
        : []
  ).filter((offer) => !offer?.synthetic && !offer?.isGuaranteedFallback);
  const realOfferCards = realOfferCardsRaw.map((offer) => {
    const directUrl = getOfferNavigationUrl(offer, displayResult);
    const fallbackUrl = !directUrl
      ? normalizeText(offer?.searchUrl || offer?.url || "")
      : "";

    return {
      ...offer,
      image: normalizeOfferAssetUrl(offer?.image) || "",
      hasRealImage: hasOfferRealImage(offer),
      url: directUrl,
      searchUrl: fallbackUrl,
    };
  });
  const offerModelSuggestions = buildOfferModelSuggestions(answers, displayResult);
  const providerSpecificSeeds = normalizeStringArray(displayResult.solucion_principal?.empresas_recomendadas).map((company, index) => {
    const model = offerModelSuggestions[index % Math.max(offerModelSuggestions.length, 1)] || displayResult.solucion_principal?.titulo || `${txt("Opción", "Option")} ${index + 1}`;
    const providerName = resolveOfferProviderName(company);
    return {
      key: `company-${providerName}-${index}`,
      title: `${model} · ${isRentingOutcome || isFlexibleMobilityOutcome ? txt("referencia a validar en", "reference to validate in") : txt("unidad orientativa en", "reference unit in")} ${providerName}`,
      source: providerName,
      description: `${displayResult.solucion_principal?.resumen || txt("Proveedor priorizado por la recomendación del test.", "Provider prioritized by the test recommendation.")} ${txt("Modelo concreto priorizado", "Prioritized specific model")}: ${model}.`,
      rankingScore: Math.max(58, Number(displayResult.solucion_principal?.score || 70) - (index + 1) * 4),
      url: getOfferFallbackSearchUrl({ title: model, source: providerName, listingType: displayResult.solucion_principal?.tipo }, displayResult),
      reason:
        index === 0
            ? txt(`Queda arriba porque ${model} encaja especialmente bien con tu perfil y es una vía prioritaria en ${company}.`, `${model} is ranked first because it fits your profile especially well and is a priority path in ${company}.`)
            : txt(`Se mantiene como alternativa concreta con ${model} para comparar condiciones reales.`, `It remains as a concrete alternative with ${model} to compare real conditions.`),
          signals: [`${txt("Modelo sugerido", "Suggested model")}: ${model}`, txt("Proveedor priorizado por tu solución", "Provider prioritized by your solution")],
    };
  });

  const syntheticOfferSeeds = [
    ...providerSpecificSeeds,
    ...(Array.isArray(displayResult.alternativas)
      ? displayResult.alternativas.map((alternative, index) => {
          const model = offerModelSuggestions[(index + providerSpecificSeeds.length) % Math.max(offerModelSuggestions.length, 1)] || displayResult.solucion_principal?.titulo || `${txt("Alternativa", "Alternative")} ${index + 1}`;
          const alternativeSource = alternative?.tipo
            ? MOBILITY_TYPES[alternative.tipo]?.label || alternative.tipo
            : generalMarketLabel;
          return {
            key: `alternative-${normalizeText(alternative?.titulo || alternative?.tipo || index)}-${index}`,
            title: `${model} · ${alternative?.titulo || `${txt("Alternativa", "Alternative")} ${index + 1}`}`,
            source: alternativeSource,
            description:
              alternative?.razon ||
              txt(`Ruta secundaria útil para comparar usando un modelo concreto como ${model}.`, `Secondary route useful to compare with a specific model like ${model}.`),
            rankingScore: Math.max(54, 68 - index * 4),
            url: getOfferFallbackSearchUrl({ title: model, source: alternativeSource, listingType: displayResult.solucion_principal?.tipo }, displayResult),
            reason: txt(`Se mantiene como vía complementaria #${index + 1} con el modelo ${model} para no depender de una sola opción.`, `It remains as complementary route #${index + 1} with ${model} to avoid relying on a single option.`),
            signals: [`${txt("Modelo sugerido", "Suggested model")}: ${model}`, `${txt("Alternativa", "Alternative")} ${index + 1}`],
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
        title: `${primaryModel} · ${txt(`${listingModeLabel} sugerido`, `${listingModeLabel} suggested`)}`,
        source:
          MOBILITY_TYPES[displayResult.solucion_principal?.tipo]?.label ||
          displayResult.solucion_principal?.tipo ||
          txt("movilidad", "mobility"),
        description:
          txt(`Referencia base para empezar a comparar ya mismo con un modelo concreto: ${primaryModel}.`, `Base reference to start comparing immediately with a specific model: ${primaryModel}.`),
        rankingScore: 72,
        reason: txt(`Se muestra primero para que siempre tengas una oferta base visible con el modelo ${primaryModel}.`, `Shown first so you always have a visible base option with ${primaryModel}.`),
        signals: [`${txt("Modelo sugerido", "Suggested model")}: ${primaryModel}`, txt("Base del asesor", "Advisor baseline")],
        url: getOfferFallbackSearchUrl({ title: primaryModel, source: generalMarketLabel, listingType: displayResult.solucion_principal?.tipo }, displayResult),
      },
      {
        key: "generic-backup",
        title: `${backupModel} · ${txt("alternativa flexible comparable", "comparable flexible alternative")}`,
        source: generalMarketLabel,
        description: txt(`Opción de respaldo útil para comparar cuota, permanencia y coste total con ${backupModel}.`, `Backup option useful to compare monthly fee, term, and total cost with ${backupModel}.`),
        rankingScore: 64,
        reason: txt(`Se conserva como respaldo para que nunca te quedes sin opciones visibles usando ${backupModel}.`, `Kept as backup so you never run out of visible options using ${backupModel}.`),
        signals: [`${txt("Modelo sugerido", "Suggested model")}: ${backupModel}`, txt("Comparativa rápida", "Quick comparison")],
        url: getOfferFallbackSearchUrl({ title: backupModel, source: generalMarketLabel, listingType: displayResult.solucion_principal?.tipo }, displayResult),
      }
    );
  }

  const offerCards = realOfferCards.slice(0, 4);
  const featuredOffer = offerCards[0] || null;
  const otherOffers = offerCards.slice(1, 4);
  const featuredOfferAction = featuredOffer ? getOfferActionMeta(featuredOffer, uiLanguage) : null;
  const featuredOfferSaved = featuredOffer ? isRecommendationSaved(featuredOffer) : false;
  const listingCoverageSummary = buildSearchCoverageSummary(listingSearchCoverage);
  const isOffersResultView = resultView === "offers";
  const winnerLabels = {
    principal: txt("Gana la recomendada", "Recommended option wins"),
    alternativa_1: txt("Gana la alternativa 1", "Alternative 1 wins"),
    alternativa_2: txt("Gana la alternativa 2", "Alternative 2 wins"),
  };
  const tcoBreakdownItems = [
    { key: "base_mensual", label: tcoDetail.concepto_base || txt("Base mensual", "Monthly base"), color: "#fbbf24" },
    { key: "seguro", label: txt("Seguro", "Insurance"), color: "#60a5fa" },
    { key: "energia", label: txt("Energía / combustible", "Energy / fuel"), color: "#34d399" },
    { key: "mantenimiento", label: txt("Mantenimiento", "Maintenance"), color: "#c084fc" },
    { key: "extras", label: txt("Extras / colchón", "Extras / cushion"), color: "#f472b6" },
  ].filter((item) => Number(tcoDetail[item.key] || 0) > 0);
  const shouldOfferValuationPrompt = ["si_entrego", "si_vendo"].includes(normalizeText(answers?.vehiculo_actual));
  const valuationPromptTitle = normalizeText(answers?.vehiculo_actual) === "si_entrego"
    ? txt("Tasación para entregar tu coche", "Valuation to trade in your car")
    : txt("Tasación para vender tu coche aparte", "Valuation to sell your car separately");
  const valuationPromptText = normalizeText(answers?.vehiculo_actual) === "si_entrego"
    ? txt("Antes de cerrar una compra o financiación, conviene estimar cuánto te puede aportar tu coche actual como entrega.", "Before closing a purchase or financing, it is worth estimating how much your current car can contribute as trade-in.")
    : txt("Si vas a vender tu coche por separado, te conviene revisar su tasación para compararla con estas ofertas con el coste real completo.", "If you plan to sell your car separately, review its valuation to compare it against these offers with full real cost.");
  const scoreBreakdownEntries = [
    { key: "encaje_uso", label: txt("Encaje con tu uso", "Fit with your usage"), max: 25, color: "#38bdf8" },
    { key: "coste_total", label: txt("Coste total", "Total cost"), max: 20, color: "#34d399" },
    { key: "flexibilidad", label: txt("Flexibilidad", "Flexibility"), max: 20, color: "#a78bfa" },
    { key: "viabilidad_real", label: txt("Viabilidad real", "Real-world viability"), max: 20, color: "#f59e0b" },
    { key: "ajuste_preferencias", label: txt("Ajuste contigo", "Preference fit"), max: 15, color: "#f472b6" },
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
