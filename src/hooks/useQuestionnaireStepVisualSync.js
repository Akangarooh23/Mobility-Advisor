import { useEffect } from "react";

export function useQuestionnaireStepVisualSync({
  entryMode,
  step,
  totalSteps,
  activeSteps,
  answers,
  normalizeRangeValue,
  setMultiSelected,
  setDualTimelineSelection,
  setScoreWeightsSelection,
}) {
  useEffect(() => {
    if (entryMode !== "consejo" || step < 0 || step >= totalSteps) {
      setMultiSelected([]);
      setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
      setScoreWeightsSelection({});
      return;
    }

    const stepConfig = activeSteps[step];

    if (stepConfig.type === "multi") {
      const saved = answers[stepConfig.id];
      setMultiSelected(Array.isArray(saved) ? saved : []);
      setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
      setScoreWeightsSelection({});
      return;
    }

    if (stepConfig.type === "dual_timeline") {
      setDualTimelineSelection({
        horizonte_tenencia: normalizeRangeValue(answers?.horizonte_tenencia),
        antiguedad_vehiculo_buscada: normalizeRangeValue(answers?.antiguedad_vehiculo_buscada),
      });
      setMultiSelected([]);
      setScoreWeightsSelection({});
      return;
    }

    if (stepConfig.type === "score_weights") {
      const saved = answers?.[stepConfig.id];
      setScoreWeightsSelection(saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {});
      setMultiSelected([]);
      setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
      return;
    }

    setMultiSelected([]);
    setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
    setScoreWeightsSelection({});
  }, [
    activeSteps,
    answers,
    entryMode,
    normalizeRangeValue,
    setDualTimelineSelection,
    setMultiSelected,
    setScoreWeightsSelection,
    step,
    totalSteps,
  ]);
}
