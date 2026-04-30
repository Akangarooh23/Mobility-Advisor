import { useEffect } from "react";

function isSameArray(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

function isSameTimelineSelection(current = {}, next = {}) {
  return (
    isSameArray(current?.horizonte_tenencia || [], next?.horizonte_tenencia || []) &&
    isSameArray(current?.antiguedad_vehiculo_buscada || [], next?.antiguedad_vehiculo_buscada || [])
  );
}

function isSameScoreWeights(current = {}, next = {}) {
  const currentKeys = Object.keys(current || {});
  const nextKeys = Object.keys(next || {});
  if (currentKeys.length !== nextKeys.length) return false;
  for (const key of currentKeys) {
    if (current[key] !== next[key]) return false;
  }
  return true;
}

const EMPTY_TIMELINE_SELECTION = { horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] };

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
    const setMultiSelectedSafe = (nextValues) => {
      setMultiSelected((prev) => (isSameArray(prev || [], nextValues || []) ? prev : (nextValues || [])));
    };

    const setDualTimelineSelectionSafe = (nextSelection) => {
      setDualTimelineSelection((prev) => (isSameTimelineSelection(prev || {}, nextSelection || {}) ? prev : nextSelection));
    };

    const setScoreWeightsSelectionSafe = (nextWeights) => {
      setScoreWeightsSelection((prev) => (isSameScoreWeights(prev || {}, nextWeights || {}) ? prev : (nextWeights || {})));
    };

    if (entryMode !== "consejo" || step < 0 || step >= totalSteps) {
      setMultiSelectedSafe([]);
      setDualTimelineSelectionSafe(EMPTY_TIMELINE_SELECTION);
      setScoreWeightsSelectionSafe({});
      return;
    }

    const stepConfig = activeSteps[step];

    if (stepConfig.type === "multi") {
      const saved = answers[stepConfig.id];
      setMultiSelectedSafe(Array.isArray(saved) ? saved : []);
      setDualTimelineSelectionSafe(EMPTY_TIMELINE_SELECTION);
      setScoreWeightsSelectionSafe({});
      return;
    }

    if (stepConfig.type === "dual_timeline") {
      setDualTimelineSelectionSafe({
        horizonte_tenencia: normalizeRangeValue(answers?.horizonte_tenencia),
        antiguedad_vehiculo_buscada: normalizeRangeValue(answers?.antiguedad_vehiculo_buscada),
      });
      setMultiSelectedSafe([]);
      setScoreWeightsSelectionSafe({});
      return;
    }

    if (stepConfig.type === "score_weights") {
      const saved = answers?.[stepConfig.id];
      setScoreWeightsSelectionSafe(saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {});
      setMultiSelectedSafe([]);
      setDualTimelineSelectionSafe(EMPTY_TIMELINE_SELECTION);
      return;
    }

    setMultiSelectedSafe([]);
    setDualTimelineSelectionSafe(EMPTY_TIMELINE_SELECTION);
    setScoreWeightsSelectionSafe({});
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
