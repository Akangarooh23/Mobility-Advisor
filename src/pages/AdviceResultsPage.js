import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ResultsAnalysisView from "./adviceResults/ResultsAnalysisView";
import ResultsHeader from "./adviceResults/ResultsHeader";
import ResultsOffersView from "./adviceResults/ResultsOffersView";
import { buildAdviceResultsViewModel, getOfferActionMeta } from "./adviceResults/adviceResults.helpers";
import { exportAdviceLogicDoc } from "../utils/exportLogicDoc";

function AnalysisAccordion({ themeMode, children }) {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const isDark = themeMode === "dark";
  return (
    <div style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.95)",
          border: isDark ? "1px solid rgba(96,165,250,0.26)" : "1px solid rgba(37,99,235,0.2)",
          borderRadius: open ? "16px 16px 0 0" : 16,
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          color: isDark ? "#e2e8f0" : "#0f172a",
          fontSize: 14,
          fontWeight: 700,
          boxShadow: isDark ? "0 12px 26px rgba(2,6,23,0.3)" : "0 12px 26px rgba(37,99,235,0.08)",
        }}
      >
        <span>{isEn ? "📊 View full analysis" : "📊 Ver el análisis completo"}</span>
        <span style={{ fontSize: 18, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▾
        </span>
      </button>
      {open && (
        <div
          style={{
            background: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.9)",
            border: isDark ? "1px solid rgba(96,165,250,0.26)" : "1px solid rgba(37,99,235,0.2)",
            borderTop: "none",
            borderRadius: "0 0 16px 16px",
            padding: "8px 0 8px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function AdviceResultsPage({
  result,
  resultRef,
  styles: s,
  themeMode,
  resultView,
  answers,
  listingResult,
  listingFilters,
  listingOptions,
  listingSearchCoverage,
  listingLoading,
  listingError,
  quickValidationAnswers,
  savedComparisons,
  saveFeedback,
  MOBILITY_TYPES,
  MONTHLY_BUDGET_OPTIONS,
  INCOME_STABILITY_OPTIONS,
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
  formatCurrency,
  showOffersPage,
  showAnalysisPage,
  openSellValuationFromOffers,
  updateQuickValidationAnswer,
  updateListingFilter,
  searchRealListing,
  getOfferTrustBadges,
  getOfferBadgeStyle,
  ResolvedOfferImage,
  toggleSavedRecommendation,
  openOfferInProductSheet,
  openOfferInNewTab,
  saveCurrentComparison,
  removeSavedComparison,
}) {
  const [logicExportLoading, setLogicExportLoading] = useState(false);
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const [logicExportFeedback, setLogicExportFeedback] = useState("");

  const {
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
    winnerLabels,
    tcoBreakdownItems,
    shouldOfferValuationPrompt,
    valuationPromptTitle,
    valuationPromptText,
    scoreBreakdownEntries,
  } = buildAdviceResultsViewModel({
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
    isRecommendationSaved,
    hasOfferRealImage,
    buildSearchCoverageSummary,
    uiLanguage: isEn ? "en" : "es",
  });

  const handleExportLogicDocument = useCallback(async () => {
    if (!result || logicExportLoading) {
      return;
    }

    setLogicExportLoading(true);
    setLogicExportFeedback("");

    try {
      const fileName = await exportAdviceLogicDoc({
        answers,
        result,
        displayResult,
        scoreBreakdownEntries,
        scoreBreakdown,
        whyThisWins,
        tcoDetail,
        comparatorRows,
        transparency,
        transparencyAssumptions,
        transparencyChecks,
        actionPlan,
        actionSteps,
        actionAlerts,
        marketRadar,
        formatCurrency,
      });

      setLogicExportFeedback(isEn ? `Document exported: ${fileName}` : `Documento exportado: ${fileName}`);
    } catch (error) {
      setLogicExportFeedback(error?.message || (isEn ? "Could not export result logic." : "No se pudo exportar la lógica del resultado."));
    } finally {
      setLogicExportLoading(false);
      window.setTimeout(() => setLogicExportFeedback(""), 3200);
    }
  }, [
    actionAlerts,
    actionPlan,
    actionSteps,
    answers,
    comparatorRows,
    displayResult,
    formatCurrency,
    isEn,
    logicExportLoading,
    marketRadar,
    result,
    scoreBreakdown,
    scoreBreakdownEntries,
    tcoDetail,
    transparency,
    transparencyAssumptions,
    transparencyChecks,
    whyThisWins,
  ]);

  return (
    <div ref={resultRef} style={s.center}>
      <ResultsHeader
        themeMode={themeMode}
        result={result}
        confidenceLabel={confidenceLabel}
        shouldOfferValuationPrompt={shouldOfferValuationPrompt}
        valuationPromptTitle={valuationPromptTitle}
        valuationPromptText={valuationPromptText}
        openSellValuationFromOffers={openSellValuationFromOffers}
      />

      <ResultsOffersView
          themeMode={themeMode}
          quickValidationQuestions={quickValidationQuestions}
          displayResult={displayResult}
          quickValidationAnswers={quickValidationAnswers}
          updateQuickValidationAnswer={updateQuickValidationAnswer}
          isRentingOutcome={isRentingOutcome}
          isBuyOrFinanceOutcome={isBuyOrFinanceOutcome}
          MONTHLY_BUDGET_OPTIONS={MONTHLY_BUDGET_OPTIONS}
          INCOME_STABILITY_OPTIONS={INCOME_STABILITY_OPTIONS}
          listingFilters={listingFilters}
          updateListingFilter={updateListingFilter}
          canSearchListing={canSearchListing}
          listingLoading={listingLoading}
          searchRealListing={searchRealListing}
          listingCoverageSummary={listingCoverageSummary}
          listingError={listingError}
          featuredOffer={featuredOffer}
          featuredOfferAction={featuredOfferAction}
          featuredOfferSaved={featuredOfferSaved}
          otherOffers={otherOffers}
          ResolvedOfferImage={ResolvedOfferImage}
          openOfferInProductSheet={openOfferInProductSheet}
          openOfferInNewTab={openOfferInNewTab}
          getOfferTrustBadges={getOfferTrustBadges}
          getOfferBadgeStyle={getOfferBadgeStyle}
          toggleSavedRecommendation={toggleSavedRecommendation}
          isRecommendationSaved={isRecommendationSaved}
          getOfferActionMeta={getOfferActionMeta}
        />

      <AnalysisAccordion themeMode={themeMode}>
        <ResultsAnalysisView
          themeMode={themeMode}
          mt={mt}
          result={result}
          displayResult={displayResult}
          scoreBreakdownEntries={scoreBreakdownEntries}
          scoreBreakdown={scoreBreakdown}
          whyThisWins={whyThisWins}
          tcoDetail={tcoDetail}
          tcoBreakdownItems={tcoBreakdownItems}
          formatCurrency={formatCurrency}
          MOBILITY_TYPES={MOBILITY_TYPES}
          comparatorRows={comparatorRows}
          transparency={transparency}
          transparencyAssumptions={transparencyAssumptions}
          transparencyChecks={transparencyChecks}
          confidenceLevel={confidenceLevel}
          winnerLabels={winnerLabels}
          actionPlan={actionPlan}
          actionSteps={actionSteps}
          actionAlerts={actionAlerts}
          trafficTone={trafficTone}
          trafficLabel={trafficLabel}
          marketRadar={marketRadar}
          saveCurrentComparison={saveCurrentComparison}
          saveFeedback={saveFeedback}
          savedComparisonItems={savedComparisonItems}
          normalizeText={normalizeText}
          getOfferFallbackSearchUrl={getOfferFallbackSearchUrl}
          openOfferInNewTab={openOfferInNewTab}
          removeSavedComparison={removeSavedComparison}
          listingResult={listingResult}
          showOffersPage={showOffersPage}
          onExportLogicDocument={handleExportLogicDocument}
          logicExportLoading={logicExportLoading}
          logicExportFeedback={logicExportFeedback}
        />
      </AnalysisAccordion>
    </div>
  );
}

