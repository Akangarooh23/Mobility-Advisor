import { useCallback } from "react";
import { postSavedOfferAddJson, postSavedOfferRemoveJson } from "../utils/apiClient";
import { buildComparisonSnapshot, buildSavedComparisonKey } from "../utils/businessHelpers";
import { writeSavedComparisons } from "../utils/storage";

export function useSavedRecommendations({
  result,
  answers,
  listingResult,
  listingFilters,
  savedComparisons,
  currentUserEmail,
  setSavedComparisons,
  setSaveFeedback,
}) {
  const saveCurrentComparison = useCallback((selectedOffer = null) => {
    if (!result) {
      return;
    }

    const snapshot = buildComparisonSnapshot({
      result,
      answers,
      listingResult: selectedOffer || listingResult,
      listingFilters,
    });
    const next = [snapshot, ...savedComparisons.filter((item) => item.id !== snapshot.id)].slice(0, 6);
    writeSavedComparisons(next);
    setSavedComparisons(next);

    if (currentUserEmail) {
      void postSavedOfferAddJson(currentUserEmail, snapshot).catch(() => {});
    }

    setSaveFeedback(
      selectedOffer
        ? "Recomendación guardada en Recomendaciones guardadas."
        : "Comparativa guardada en este navegador."
    );
    window.setTimeout(() => setSaveFeedback(""), 2200);
  }, [
    answers,
    currentUserEmail,
    listingFilters,
    listingResult,
    result,
    savedComparisons,
    setSaveFeedback,
    setSavedComparisons,
  ]);

  const isRecommendationSaved = useCallback((selectedOffer = null) => {
    if (!result) {
      return false;
    }

    const targetId = buildSavedComparisonKey({
      result,
      listingResult: selectedOffer || listingResult,
    });

    return savedComparisons.some((item) => item.id === targetId);
  }, [listingResult, result, savedComparisons]);

  const toggleSavedRecommendation = useCallback((selectedOffer = null) => {
    if (!result) {
      return;
    }

    const snapshot = buildComparisonSnapshot({
      result,
      answers,
      listingResult: selectedOffer || listingResult,
      listingFilters,
    });
    const alreadySaved = savedComparisons.some((item) => item.id === snapshot.id);

    if (alreadySaved) {
      const next = savedComparisons.filter((item) => item.id !== snapshot.id);
      writeSavedComparisons(next);
      setSavedComparisons(next);

      if (currentUserEmail) {
        void postSavedOfferRemoveJson(currentUserEmail, snapshot.id).catch(() => {});
      }

      setSaveFeedback("Recomendación quitada de guardadas.");
      window.setTimeout(() => setSaveFeedback(""), 2200);
      return;
    }

    saveCurrentComparison(selectedOffer);
  }, [
    answers,
    currentUserEmail,
    listingFilters,
    listingResult,
    result,
    saveCurrentComparison,
    savedComparisons,
    setSaveFeedback,
    setSavedComparisons,
  ]);

  const removeSavedComparison = useCallback((id) => {
    const next = savedComparisons.filter((item) => item.id !== id);
    writeSavedComparisons(next);
    setSavedComparisons(next);

    if (currentUserEmail) {
      void postSavedOfferRemoveJson(currentUserEmail, id).catch(() => {});
    }
  }, [currentUserEmail, savedComparisons, setSavedComparisons]);

  return {
    saveCurrentComparison,
    isRecommendationSaved,
    toggleSavedRecommendation,
    removeSavedComparison,
  };
}
