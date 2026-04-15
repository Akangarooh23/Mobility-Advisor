import { useCallback, useState } from "react";
import ResultsAnalysisView from "./adviceResults/ResultsAnalysisView";
import ResultsHeader from "./adviceResults/ResultsHeader";
import ResultsOffersView from "./adviceResults/ResultsOffersView";
import { buildAdviceResultsViewModel, getOfferActionMeta } from "./adviceResults/adviceResults.helpers";
import { exportAdviceLogicDoc } from "../utils/exportLogicDoc";

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
  openOfferInNewTab,
  saveCurrentComparison,
  removeSavedComparison,
}) {
  const [logicExportLoading, setLogicExportLoading] = useState(false);
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
    isOffersResultView,
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
    hasOfferRealImage,
    isRecommendationSaved,
    buildSearchCoverageSummary,
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

      setLogicExportFeedback(`Documento exportado: ${fileName}`);
    } catch (error) {
      setLogicExportFeedback(error?.message || "No se pudo exportar la lógica del resultado.");
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
        isOffersResultView={isOffersResultView}
        result={result}
        confidenceLabel={confidenceLabel}
        showOffersPage={showOffersPage}
        showAnalysisPage={showAnalysisPage}
        shouldOfferValuationPrompt={shouldOfferValuationPrompt}
        valuationPromptTitle={valuationPromptTitle}
        valuationPromptText={valuationPromptText}
        openSellValuationFromOffers={openSellValuationFromOffers}
      />

      {isOffersResultView ? (
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
          openOfferInNewTab={openOfferInNewTab}
          getOfferTrustBadges={getOfferTrustBadges}
          getOfferBadgeStyle={getOfferBadgeStyle}
          toggleSavedRecommendation={toggleSavedRecommendation}
          isRecommendationSaved={isRecommendationSaved}
          getOfferActionMeta={getOfferActionMeta}
        />
      ) : (
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
      )}
    </div>
  );
}

