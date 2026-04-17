import { useEffect } from "react";

export function useDecisionResetState({
  decisionAnswers,
  setDecisionAiResult,
  setDecisionError,
  setDecisionListingResult,
  setDecisionListingError,
  setDecisionListingLoading,
}) {
  useEffect(() => {
    setDecisionAiResult(null);
    setDecisionError(null);
    setDecisionListingResult(null);
    setDecisionListingError(null);
    setDecisionListingLoading(false);
  }, [
    decisionAnswers,
    setDecisionAiResult,
    setDecisionError,
    setDecisionListingResult,
    setDecisionListingError,
    setDecisionListingLoading,
  ]);
}

export function useSellResetState({
  sellAnswers,
  setSellAiResult,
  setSellError,
  setSellListingResult,
  setSellListingError,
  setSellListingLoading,
}) {
  useEffect(() => {
    setSellAiResult(null);
    setSellError(null);
    setSellListingResult(null);
    setSellListingError(null);
    setSellListingLoading(false);
  }, [
    sellAnswers,
    setSellAiResult,
    setSellError,
    setSellListingResult,
    setSellListingError,
    setSellListingLoading,
  ]);
}
