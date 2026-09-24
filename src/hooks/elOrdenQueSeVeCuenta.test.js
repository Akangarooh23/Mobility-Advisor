/**
 * Si te parece bien el orden que ves, «Continuar» tiene que funcionar.
 *
 * ## Lo que pasaba
 *
 * La última pregunta del test —«¿Qué criterios son más importantes para ti?»—
 * pinta cinco tarjetas numeradas del 1 al 5 y te pide que las arrastres. Pero
 * ese 1-2-3-4-5 era **solo el dibujo**: el estado estaba vacío hasta que
 * arrastrabas una tarjeta.
 *
 * Y «Continuar» exige un orden completo, así que quien estaba de acuerdo con el
 * orden que veía pulsaba el botón y **no pasaba nada**. Sin aviso, sin error y
 * sin ninguna manera de adivinar que había que mover algo para que contara. El
 * test se quedaba clavado en la pregunta 13 de 13, con el 100 % completado.
 *
 * ## Lo que se fija
 *
 * Que lo que se ve sea lo que hay. Si no ha tocado nada, el orden en que se le
 * enseñan las tarjetas es su respuesta.
 */
import { renderHook } from "@testing-library/react";
import { useQuestionnaireStepVisualSync } from "./useQuestionnaireStepVisualSync";

const PASO = {
  id: "ponderacion_score_personalizada",
  type: "score_weights",
  metrics: [
    { key: "marca_preferencia" },
    { key: "propulsion_preferida" },
    { key: "flexibilidad" },
    { key: "antiguedad_vehiculo_buscada" },
    { key: "ocupantes" },
  ],
};

/** El mismo criterio que usa el botón de «Continuar». */
function estaCompleto(value, metrics) {
  if (!value || typeof value !== "object") return false;
  const rangos = metrics
    .map((m) => Number(value[m.key]))
    .filter((r) => Number.isInteger(r) && r >= 1 && r <= metrics.length);
  return rangos.length === metrics.length && new Set(rangos).size === metrics.length;
}

function sincroniza(answers = {}) {
  let pesos = null;
  renderHook(() =>
    useQuestionnaireStepVisualSync({
      activeSteps: [PASO],
      answers,
      entryMode: "consejo",
      step: 0,
      totalSteps: 1,
      normalizeRangeValue: (v) => v,
      setMultiSelected: () => {},
      setDualTimelineSelection: () => {},
      setScoreWeightsSelection: (next) => {
        pesos = typeof next === "function" ? next(pesos || {}) : next;
      },
    })
  );
  return pesos;
}

describe("el orden que se ve cuenta", () => {
  test("sin tocar nada, ya hay un orden completo", () => {
    const pesos = sincroniza({});

    expect(estaCompleto(pesos, PASO.metrics)).toBe(true);
  });

  test("y es el mismo en que se pintan las tarjetas", () => {
    /*
     * Si el orden sembrado no fuera el que se ve, el cliente pulsaria Continuar
     * creyendo que manda una cosa y mandaria otra, que es peor que el fallo
     * original.
     */
    const pesos = sincroniza({});

    expect(pesos).toEqual({
      marca_preferencia: 1,
      propulsion_preferida: 2,
      flexibilidad: 3,
      antiguedad_vehiculo_buscada: 4,
      ocupantes: 5,
    });
  });

  test("lo que ya habia contestado manda sobre el orden por defecto", () => {
    const suyo = {
      ocupantes: 1,
      marca_preferencia: 2,
      propulsion_preferida: 3,
      flexibilidad: 4,
      antiguedad_vehiculo_buscada: 5,
    };

    expect(sincroniza({ ponderacion_score_personalizada: suyo })).toEqual(suyo);
  });
});
