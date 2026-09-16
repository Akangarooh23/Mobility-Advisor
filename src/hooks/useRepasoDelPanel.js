import { useEffect } from "react";

/**
 * Cada cuánto se repasan los datos del panel con la pestaña delante.
 *
 * Un minuto. Es una consulta sola y solo corre con el panel abierto y visible,
 * así que el coste es el de mirar el reloj; y una tasación tarda minutos en
 * hacerse, así que menos no serviría de nada y más dejaría al usuario mirando
 * un cero que ya no es verdad.
 */
export const CADA_CUANTO_SE_REPASA_EL_PANEL = 60000;

/**
 * Mientras el panel está abierto, los datos se vuelven a pedir solos.
 *
 * Los contadores del lateral —tasaciones, solicitudes, revisiones— salen de una
 * única llamada, y esa llamada se hacía al entrar en el panel y nunca más. El de
 * coches no: ese lo refresca la propia pestaña de vehículos con su evento. De
 * ahí lo que se veía —«ya pone 1 coche pero sigue poniendo 0 tasaciones»— y de
 * ahí que hubiera que recargar la página entera para verlo cuadrado.
 *
 * Son cuatro momentos, y ninguno sobra:
 *
 * - al entrar en el panel;
 * - al cambiar de apartado dentro del panel, que es donde pasa casi todo —pedir
 *   la tasación, encargar la venta, meter un coche— sin que se salga del panel
 *   ni una sola vez;
 * - al volver a la pestaña, que es lo que hace quien se va al correo a ver el
 *   informe y vuelve;
 * - y cada minuto con la pestaña delante, porque una tasación tarda minutos en
 *   estar y termina sin que el navegador se entere de nada.
 *
 * Con la pestaña detrás no se pide nada: ni el reloj ni el aviso de visibilidad
 * llaman con la página escondida.
 */
export function useRepasoDelPanel({
  activo,
  /** El apartado del panel. Cambiarlo es señal de que algo puede haber cambiado. */
  apartado,
  recarga,
  cadaCuanto = CADA_CUANTO_SE_REPASA_EL_PANEL,
}) {
  useEffect(() => {
    if (!activo) return undefined;

    recarga();

    if (typeof document === "undefined" || typeof window === "undefined") return undefined;

    const siEstaDelante = () => {
      if (document.visibilityState === "visible") recarga();
    };

    document.addEventListener("visibilitychange", siEstaDelante);
    window.addEventListener("focus", siEstaDelante);
    const reloj = window.setInterval(siEstaDelante, cadaCuanto);

    return () => {
      document.removeEventListener("visibilitychange", siEstaDelante);
      window.removeEventListener("focus", siEstaDelante);
      window.clearInterval(reloj);
    };
  }, [activo, apartado, recarga, cadaCuanto]);
}
