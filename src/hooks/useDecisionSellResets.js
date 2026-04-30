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
    setDecisionAiResult((prev) => (prev === null ? prev : null));
    setDecisionError((prev) => (prev === null ? prev : null));
    setDecisionListingResult((prev) => (prev === null ? prev : null));
    setDecisionListingError((prev) => (prev === null ? prev : null));
    setDecisionListingLoading((prev) => (prev === false ? prev : false));
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
    setSellAiResult((prev) => (prev === null ? prev : null));
    setSellError((prev) => (prev === null ? prev : null));
    setSellListingResult((prev) => (prev === null ? prev : null));
    setSellListingError((prev) => (prev === null ? prev : null));
    setSellListingLoading((prev) => (prev === false ? prev : false));
  }, [
    sellAnswers,
    setSellAiResult,
    setSellError,
    setSellListingResult,
    setSellListingError,
    setSellListingLoading,
  ]);
}
