import { useEffect, useState } from "react";
import { createInitialDecisionAnswers } from "./useAdvisorController";

/**
 * El consejero: lo que ha contestado quien busca coche, y lo que sale de ello.
 *
 * ## Qué guarda
 *
 *   · `decisionAnswers`, las respuestas;
 *   · el análisis y el anuncio encontrado, cada uno con su «cargando» y su
 *     fallo;
 *   · y el bloque del mercado: las ofertas, su lectura, y **dos listas de lo
 *     que no hay que volver a enseñar** —por dirección y por título— más un
 *     contador para pedir otra tanda.
 *
 * ## La regla que los une
 *
 * Si cambian las respuestas, lo calculado con las anteriores deja de valer.
 * Ya estaba escrita —`useDecisionResetState`— pero los catorce `useState`
 * vivían en `App` y el hook recibía cinco `set…` para poder borrarlos.
 *
 * Aquí la diferencia con el flujo de vender es de fondo: **el reinicio no lo
 * borra todo**. Las dos listas de descartados y el contador sobreviven al
 * cambio de respuestas, y eso es deliberado: si alguien dijo «este no» a un
 * coche y luego afina el presupuesto, volver a ofrecérselo es peor que no
 * haberle hecho caso. Se conserva como estaba, y ahora está escrito.
 *
 * ## Lo que NO hace
 *
 * Buscar. Las llamadas las hace `App`, que es quien sabe cuándo. Esto guarda
 * lo que llega y lo tira cuando deja de corresponder.
 */
export function useElConsejero() {
  const [decisionAnswers, setDecisionAnswers] = useState(createInitialDecisionAnswers);

  const [decisionAiResult, setDecisionAiResult] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  const [decisionListingResult, setDecisionListingResult] = useState(null);
  const [decisionListingLoading, setDecisionListingLoading] = useState(false);
  const [decisionListingError, setDecisionListingError] = useState(null);

  const [decisionMarketListings, setDecisionMarketListings] = useState([]);
  const [decisionMarketLoading, setDecisionMarketLoading] = useState(false);
  const [decisionMarketError, setDecisionMarketError] = useState(null);
  const [decisionMarketInsight, setDecisionMarketInsight] = useState(null);
  const [decisionMarketRefreshNonce, setDecisionMarketRefreshNonce] = useState(0);
  const [decisionMarketExcludeUrls, setDecisionMarketExcludeUrls] = useState([]);
  const [decisionMarketExcludeTitles, setDecisionMarketExcludeTitles] = useState([]);

  /*
   * Cambian las respuestas: lo calculado con las anteriores se tira.
   *
   * Cinco, y solo cinco. Lo que se queda —las dos listas de descartados y el
   * contador— está explicado arriba y no es un olvido.
   *
   * Cada `set…` compara antes de escribir: este efecto corre en cada cambio de
   * las respuestas, y escribir el mismo valor otra vez dispara un renderizado
   * por cada uno.
   */
  useEffect(() => {
    setDecisionAiResult((prev) => (prev === null ? prev : null));
    setDecisionError((prev) => (prev === null ? prev : null));
    setDecisionListingResult((prev) => (prev === null ? prev : null));
    setDecisionListingError((prev) => (prev === null ? prev : null));
    setDecisionListingLoading((prev) => (prev === false ? prev : false));
  }, [decisionAnswers]);

  return {
    decisionAnswers, setDecisionAnswers,
    decisionAiResult, setDecisionAiResult,
    decisionLoading, setDecisionLoading,
    decisionError, setDecisionError,
    decisionListingResult, setDecisionListingResult,
    decisionListingLoading, setDecisionListingLoading,
    decisionListingError, setDecisionListingError,
    decisionMarketListings, setDecisionMarketListings,
    decisionMarketLoading, setDecisionMarketLoading,
    decisionMarketError, setDecisionMarketError,
    decisionMarketInsight, setDecisionMarketInsight,
    decisionMarketRefreshNonce, setDecisionMarketRefreshNonce,
    decisionMarketExcludeUrls, setDecisionMarketExcludeUrls,
    decisionMarketExcludeTitles, setDecisionMarketExcludeTitles,
  };
}
