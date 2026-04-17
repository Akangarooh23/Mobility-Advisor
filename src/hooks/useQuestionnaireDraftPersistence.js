import { useEffect } from "react";
import { writeQuestionnaireDraft } from "../utils/storage";

export function useQuestionnaireDraftPersistence({
  entryMode,
  step,
  result,
  apiKeyMissing,
  currentStep,
  answers,
  multiSelected,
  scoreWeightsSelection,
  dualTimelineSelection,
  activeSteps,
  advancedMode,
  buildActiveAnswers,
  countAnsweredSteps,
  setQuestionnaireDraft,
}) {
  useEffect(() => {
    if (entryMode !== "consejo" || step < 0 || result || apiKeyMissing) {
      return;
    }

    const answersForDraft =
      currentStep?.type === "multi"
        ? { ...answers, [currentStep.id]: multiSelected }
        : currentStep?.type === "score_weights"
        ? { ...answers, [currentStep.id]: scoreWeightsSelection }
        : currentStep?.type === "dual_timeline"
        ? {
            ...answers,
            horizonte_tenencia: dualTimelineSelection.horizonte_tenencia,
            antiguedad_vehiculo_buscada: dualTimelineSelection.antiguedad_vehiculo_buscada,
          }
        : { ...answers };

    const activeAnswers = buildActiveAnswers(answersForDraft, activeSteps);
    const answeredSteps = countAnsweredSteps(activeAnswers, activeSteps);

    if (answeredSteps === 0) {
      return;
    }

    const draft = {
      step,
      advancedMode,
      answers: activeAnswers,
      answeredSteps,
      totalSteps: activeSteps.length,
      updatedAt: new Date().toISOString(),
    };

    writeQuestionnaireDraft(draft);
    setQuestionnaireDraft(draft);
  }, [
    activeSteps,
    advancedMode,
    answers,
    apiKeyMissing,
    buildActiveAnswers,
    countAnsweredSteps,
    currentStep,
    dualTimelineSelection,
    entryMode,
    multiSelected,
    result,
    scoreWeightsSelection,
    setQuestionnaireDraft,
    step,
  ]);
}
