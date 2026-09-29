import { useEffect, useState } from "react";
import { createInitialSellAnswers } from "./useAdvisorController";

/**
 * El flujo de vender: sus respuestas y los tres resultados que cuelgan de ellas.
 *
 * ## Qué guarda
 *
 *   · `sellFlowType`: si el usuario viene a por el **informe de mercado** o a
 *     por el **certificado**. Son dos productos distintos y la misma pantalla;
 *   · `sellAnswers`: lo que ha contestado;
 *   · y tres pares resultado/fallo con su «cargando», que salen de esas
 *     respuestas: el análisis, el anuncio y la foto del mercado.
 *
 * ## La regla que los une, y por qué vive aquí
 *
 * **Si cambian las respuestas, los tres resultados dejan de valer.** Eso ya
 * estaba escrito —`useSellResetState`— pero el estado vivía en `App` y el hook
 * recibía nueve `set…` para poder borrarlos. Once `useState` en un sitio y la
 * regla que los gobierna en otro.
 *
 * Importa porque el fallo que evita no se ve: con las respuestas cambiadas y
 * los resultados viejos en pantalla, alguien decide el precio de su coche
 * mirando el análisis de las respuestas de antes. No hay error, no hay aviso;
 * solo un número que ya no corresponde.
 *
 * ## Lo que NO hace
 *
 * Pedir nada. Los tres resultados los trae `App`, que es quien sabe cuándo y
 * con qué. Esto guarda lo que llega y lo tira cuando deja de valer.
 */
export function useElFlujoDeVenta() {
  // "certificate" | "report" | ""
  const [sellFlowType, setSellFlowType] = useState("");
  const [sellAnswers, setSellAnswers] = useState(createInitialSellAnswers);

  const [sellAiResult, setSellAiResult] = useState(null);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState(null);

  const [sellListingResult, setSellListingResult] = useState(null);
  const [sellListingLoading, setSellListingLoading] = useState(false);
  const [sellListingError, setSellListingError] = useState(null);

  const [sellMarketSnapshot, setSellMarketSnapshot] = useState(null);
  const [sellMarketSnapshotLoading, setSellMarketSnapshotLoading] = useState(false);
  const [sellMarketSnapshotError, setSellMarketSnapshotError] = useState("");

  /*
   * Cambian las respuestas: lo calculado con las anteriores se tira.
   *
   * Cada `set…` compara antes de escribir. No es maña: este efecto corre en
   * cada cambio de `sellAnswers`, y escribir el mismo valor otra vez dispara
   * un renderizado por cada uno de los ocho.
   */
  useEffect(() => {
    setSellAiResult((prev) => (prev === null ? prev : null));
    setSellError((prev) => (prev === null ? prev : null));
    setSellListingResult((prev) => (prev === null ? prev : null));
    setSellListingError((prev) => (prev === null ? prev : null));
    setSellListingLoading((prev) => (prev === false ? prev : false));
    setSellMarketSnapshot((prev) => (prev === null ? prev : null));
    setSellMarketSnapshotError((prev) => (prev === "" ? prev : ""));
    setSellMarketSnapshotLoading((prev) => (prev === false ? prev : false));
  }, [sellAnswers]);

  return {
    sellFlowType, setSellFlowType,
    sellAnswers, setSellAnswers,
    sellAiResult, setSellAiResult,
    sellLoading, setSellLoading,
    sellError, setSellError,
    sellListingResult, setSellListingResult,
    sellListingLoading, setSellListingLoading,
    sellListingError, setSellListingError,
    sellMarketSnapshot, setSellMarketSnapshot,
    sellMarketSnapshotLoading, setSellMarketSnapshotLoading,
    sellMarketSnapshotError, setSellMarketSnapshotError,
  };
}
