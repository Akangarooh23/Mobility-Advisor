import { useCallback, useEffect, useState } from "react";
import { readCookieConsent, writeCookieConsent } from "../utils/storage";

/**
 * El aviso de cookies y lo que el usuario eligió en él.
 *
 * ## Por qué el estado vive aquí y no en `App`
 *
 * Antes vivía en `App` —tres `useState` entre los 127 que tiene— y este hook
 * recibía los `set…` para poder apagarlos. `useAppBootstrap` recibía otros dos
 * para encenderlos al arrancar. Así que el aviso de cookies se leía en tres
 * ficheros: el estado en uno, el encendido en otro y el apagado en el tercero.
 *
 * Eso no es un detalle de estilo. Para responder «¿cuándo sale la barra de
 * cookies?» había que abrir los tres y cruzarlos, y cualquiera de ellos podía
 * cambiar sin que los otros dos se enteraran.
 *
 * Ahora las tres cosas están donde están los datos. `App` pide lo que pinta y
 * `useAppBootstrap` se olvida de las cookies, que nunca fueron asunto suyo.
 *
 * ## Lo que NO cambia
 *
 * El momento en que aparece. El aviso sigue saliendo desde un efecto y no en
 * la primera pintada, exactamente como antes: `showCookieGate` arranca en
 * `false` y se decide cuando el efecto lee lo guardado.
 *
 * Leerlo en el valor inicial quitaría un parpadeo —`localStorage` es síncrono y
 * se podría— pero eso es cambiar cuándo se ve algo, y no es lo que toca en una
 * mudanza de sitio. Queda apuntado para cuando se quiera tocar a propósito.
 */

/** Las cuatro categorías, tal y como salen de fábrica. */
const POR_OMISION = {
  necessary: true,
  analytics: true,
  personalization: true,
  marketing: true,
};

export function useAppPreferences({ themeStorageKey, themeMode }) {
  /*
   * Las cuatro salen marcadas de entrada, marketing incluida: es decisión de
   * producto, y estaba escrita en `App` junto al `useState`. Se muda con él.
   *
   * Conste que la guía de cookies de la AEPD —y la sentencia Planet49— piden
   * que las opcionales vengan sin marcar y que rechazar cueste lo mismo que
   * aceptar; dejarlo así es asumir ese riesgo, y volver a `marketing: false`
   * es cambiar `POR_OMISION`.
   */
  const [cookiePreferences, setCookiePreferences] = useState(POR_OMISION);
  const [showCookieGate, setShowCookieGate] = useState(false);
  const [showCookieSettings, setShowCookieSettings] = useState(false);

  /*
   * Lo que se eligió la última vez.
   *
   * Esto lo hacía `useAppBootstrap` dentro del efecto que monta media
   * aplicación. No tenía nada que ver con arrancar la sesión ni con el
   * catálogo: estaba ahí porque era donde ya se leía `localStorage`.
   */
  useEffect(() => {
    const guardado = readCookieConsent();

    if (guardado?.preferences) {
      setCookiePreferences((prev) => ({
        ...prev,
        ...guardado.preferences,
        necessary: true,
      }));
    }

    // Sin respuesta guardada, se pregunta. Con respuesta, no se vuelve a
    // preguntar aunque fuera «solo las necesarias».
    setShowCookieGate(!guardado?.status);
  }, []);

  const saveCookieConsent = useCallback((mode = "all") => {
    const normalizedMode = ["all", "necessary", "custom"].includes(mode)
      ? mode
      : "all";
    const preferences =
      normalizedMode === "all"
        ? { necessary: true, analytics: true, personalization: true, marketing: true }
        : normalizedMode === "necessary"
        ? { necessary: true, analytics: false, personalization: false, marketing: false }
        : { ...cookiePreferences, necessary: true };

    writeCookieConsent(normalizedMode, {
      version: "2026-04",
      preferences,
    });

    setShowCookieGate(false);
    setShowCookieSettings(false);
  }, [cookiePreferences]);

  /** Marcar o desmarcar una categoría en el detalle del aviso. */
  const alternarPreferencia = useCallback((clave) => {
    setCookiePreferences((prev) => ({ ...prev, [clave]: !prev[clave] }));
  }, []);

  /** Abrir o cerrar el detalle del aviso. */
  const alternarAjustes = useCallback(() => {
    setShowCookieSettings((prev) => !prev);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(themeStorageKey, themeMode === "dark" ? "dark" : "light");
  }, [themeMode, themeStorageKey]);

  return {
    showCookieGate,
    showCookieSettings,
    cookiePreferences,
    alternarPreferencia,
    alternarAjustes,
    saveCookieConsent,
  };
}
