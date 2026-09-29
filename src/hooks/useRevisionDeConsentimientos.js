import { useCallback, useState } from "react";
import { postAuthJson } from "../utils/apiClient";

/**
 * La revisión de consentimientos: el aviso que sale al entrar si nunca se
 * aceptaron las condiciones.
 *
 * ## Qué había
 *
 * Siete `useState` en `App` y, en los dos botones del aviso, **el mismo bloque
 * de veinte líneas duplicado**: montar el paquete con la procedencia guardada
 * -idioma, UTMs, referente, datos de afiliado- y mandarlo a `save_consents`.
 * Lo único que cambiaba eran los cinco valores y una línea del final.
 *
 * Veinte líneas repetidas para dos botones que hacen lo mismo con distinto
 * contenido es el sitio donde se arregla uno y no el otro. Y aquí eso no es
 * cosmético: lo que se manda es el consentimiento de una persona, que es
 * justo lo que hay que poder demostrar que se guardó bien.
 *
 * ## La diferencia entre los dos botones, que SÍ es a propósito
 *
 *   · **«Guardar selección»** manda lo que haya marcado y se queda con el
 *     usuario que devuelve el servidor. Con las condiciones aceptadas, ese
 *     usuario ya trae `consentLegalAt`, y en el siguiente acceso el aviso no
 *     vuelve a salir;
 *   · **«Continuar sin aceptar»** manda cinco noes y **no** toca al usuario.
 *     Así `consentLegalAt` sigue vacío y el aviso vuelve a salir la próxima
 *     vez, que es lo que tiene que pasar con quien no ha aceptado las
 *     condiciones.
 *
 * Parecía un olvido —uno lee la respuesta y el otro no— y no lo es. Queda
 * escrito para que nadie lo «arregle».
 */

/** Lo que se le pregunta, con el nombre que entiende el servidor. */
const LAS_CINCO = {
  legal: "consentLegal",
  marketingEmail: "consentMarketingEmail",
  marketingSms: "consentMarketingSms",
  thirdPartyEmail: "consentThirdPartyEmail",
  thirdPartySms: "consentThirdPartySms",
};

const NINGUNO = {
  legal: false,
  marketingEmail: false,
  marketingSms: false,
  thirdPartyEmail: false,
  thirdPartySms: false,
};

/**
 * De dónde vino esta persona, que se guarda junto al consentimiento.
 *
 * Va en un try/catch y devuelve `{}` si falla: un `localStorage` ilegible no
 * puede impedir que se guarde un consentimiento.
 */
function laProcedencia() {
  let landing = {};
  try {
    landing = JSON.parse(window.localStorage.getItem("ma.landing") || "{}");
  } catch {
    landing = {};
  }

  return {
    language: landing.language || (typeof navigator !== "undefined" ? navigator.language : "") || "",
    utmSource: landing.utms?.utm_source || "",
    utmMedium: landing.utms?.utm_medium || "",
    utmCampaign: landing.utms?.utm_campaign || "",
    utmContent: landing.utms?.utm_content || "",
    referer: landing.referer || "",
    landingUrl: landing.landingUrl || "",
    affiliateData: landing.affiliateData || null,
  };
}

export function useRevisionDeConsentimientos({ alRecibirUsuario } = {}) {
  const [abierta, setAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [elegido, setElegido] = useState(NINGUNO);

  const abre = useCallback(() => {
    setElegido(NINGUNO);
    setAbierta(true);
  }, []);

  const alterna = useCallback((clave) => {
    setElegido((prev) => ({ ...prev, [clave]: !prev[clave] }));
  }, []);

  /** El envío, que era lo que estaba escrito dos veces. */
  const manda = useCallback(async (valores, { recogeElUsuario }) => {
    setGuardando(true);
    try {
      const { data } = await postAuthJson({
        action: "save_consents",
        ...Object.fromEntries(
          Object.entries(LAS_CINCO).map(([nuestro, suyo]) => [suyo, Boolean(valores[nuestro])])
        ),
        ...laProcedencia(),
      });

      if (recogeElUsuario && data?.user && alRecibirUsuario) {
        alRecibirUsuario(data.user);
      }
    } catch {
      /*
       * Se sigue igual: el aviso se cierra y la persona entra.
       *
       * Dejarla encerrada delante de un aviso que no se puede guardar sería
       * peor, y el servidor volverá a pedirlo en el siguiente acceso porque
       * `consentLegalAt` habrá seguido vacío.
       */
    }
    setAbierta(false);
    setGuardando(false);
  }, [alRecibirUsuario]);

  const guardaLoElegido = useCallback(
    () => manda(elegido, { recogeElUsuario: true }),
    [manda, elegido]
  );

  const continuarSinAceptar = useCallback(
    () => manda(NINGUNO, { recogeElUsuario: false }),
    [manda]
  );

  return { abierta, abre, guardando, elegido, alterna, guardaLoElegido, continuarSinAceptar };
}
