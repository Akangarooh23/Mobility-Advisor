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
    setListingResult(null);
    setListingOptions([]);
    setListingError(null);
    setListingLoading(false);
    setQuickValidationAnswers({});

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
