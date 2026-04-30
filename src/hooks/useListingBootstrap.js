import { useEffect } from "react";

export function useListingBootstrap({
  quickValidationRef,
  quickValidationAnswers,
  result,
  answers,
  inferListingBudget,
  setListingFilters,
  setListingResult,
  setListingOptions,
  setListingError,
  setListingLoading,
  setQuickValidationAnswers,
  searchRealListing,
}) {
  useEffect(() => {
    quickValidationRef.current = quickValidationAnswers;
  }, [quickValidationAnswers, quickValidationRef]);

  useEffect(() => {
    if (!result) {
      return undefined;
    }

    const initialFilters = {
      company: "",
      budget: inferListingBudget(answers),
      income: "",
    };

    setListingFilters(initialFilters);
    setListingResult((prev) => (prev === null ? prev : null));
    setListingOptions((prev) => (Array.isArray(prev) && prev.length === 0 ? prev : []));
    setListingError((prev) => (prev === null ? prev : null));
    setListingLoading((prev) => (prev === false ? prev : false));
    setQuickValidationAnswers((prev) => {
      if (!prev || Object.keys(prev).length === 0) {
        return prev;
      }
      return {};
    });

    const timeoutId = window.setTimeout(() => {
      void searchRealListing(initialFilters);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [
    answers,
    inferListingBudget,
    result,
    searchRealListing,
    setListingError,
    setListingFilters,
    setListingLoading,
    setListingOptions,
    setListingResult,
    setQuickValidationAnswers,
  ]);
}
