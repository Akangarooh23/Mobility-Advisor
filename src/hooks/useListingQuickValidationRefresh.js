import { useEffect } from "react";

export function useListingQuickValidationRefresh({
  result,
  quickValidationAnswers,
  listingFilters,
  searchRealListing,
}) {
  useEffect(() => {
    if (!result || Object.keys(quickValidationAnswers).length === 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchRealListing(listingFilters, quickValidationAnswers);
    }, 160);

    return () => window.clearTimeout(timeoutId);
  }, [quickValidationAnswers, result, listingFilters, searchRealListing]);
}
