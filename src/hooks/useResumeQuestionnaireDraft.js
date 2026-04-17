import { useCallback } from "react";
import { getQuestionnaireSteps } from "../data/questionnaireSteps";
import { readQuestionnaireDraft } from "../utils/storage";

export function useResumeQuestionnaireDraft({
  countAnsweredSteps,
  resetListingDiscovery,
  setQuestionnaireDraft,
  setEntryMode,
  setStep,
  setAdvancedMode,
  setAnswers,
  setMultiSelected,
  setResult,
  setError,
  setApiKeyMissing,
  setLoading,
}) {
  return useCallback(() => {
    const savedDraft = readQuestionnaireDraft();

    if (!savedDraft?.answers) {
      setEntryMode("consejo");
      setStep(-1);
      return;
    }

    const restoredAdvancedMode = Boolean(savedDraft.advancedMode);
    const restoredSteps = getQuestionnaireSteps(restoredAdvancedMode);
    const restoredAnswers = savedDraft.answers && typeof savedDraft.answers === "object"
      ? savedDraft.answers
      : {};
    const numericStep = Number(savedDraft.step);
    const fallbackStep = Math.max(0, Math.min(countAnsweredSteps(restoredAnswers, restoredSteps), restoredSteps.length - 1));
    const nextStep = Number.isFinite(numericStep)
      ? Math.max(0, Math.min(numericStep, restoredSteps.length - 1))
      : fallbackStep;

    setQuestionnaireDraft(savedDraft);
    setEntryMode("consejo");
    setAdvancedMode(restoredAdvancedMode);
    setAnswers(restoredAnswers);
    setMultiSelected([]);
    setResult(null);
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    resetListingDiscovery();
    setStep(nextStep);

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, [
    countAnsweredSteps,
    resetListingDiscovery,
    setAdvancedMode,
    setAnswers,
    setApiKeyMissing,
    setEntryMode,
    setError,
    setLoading,
    setMultiSelected,
    setQuestionnaireDraft,
    setResult,
    setStep,
  ]);
}
