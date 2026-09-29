import { useCallback, useMemo, useState } from "react";

/**
 * Los cinco consentimientos del formulario de registro.
 *
 * Son los mismos cinco que pregunta el aviso de revisión
 * (`useRevisionDeConsentimientos`), pero no lo mismo: aquí se manda **una fecha
 * por cada sí** dentro del registro, y allí se mandan **cinco booleanos** a
 * `save_consents` sobre una cuenta que ya existe. Se parecen lo justo para que
 * arreglar uno no arregle el otro, así que los dos dicen en su cabecera que el
 * otro existe.
 *
 * ## Qué había
 *
 * Cinco `useState` en `App` y, dentro del JSX del formulario:
 *
 *   · la condición de «están los cinco» escrita **tres veces en diecisiete
 *     líneas** -una para decidir qué hace el interruptor, y dos más metidas
 *     dentro de sendos objetos de estilo, para el color y para la posición del
 *     círculo;
 *   · la regla de que **quitar el legal quita los otros cuatro**, dentro de un
 *     `onChange`, entre dos objetos de estilo. Es una regla de verdad -no se
 *     puede consentir publicidad sin aceptar las condiciones- y estaba escrita
 *     donde nadie la busca;
 *   · y los **siete** campos de fecha que salen de los cinco síes, porque dos
 *     son agregados: `consentMarketingAt` si cualquiera de los dos de
 *     publicidad, y `consentExperianAt` si cualquiera de los dos de terceros.
 *
 * ## Lo que hay que saber, y parece un fallo
 *
 * El bloque entero de consentimientos **solo se dibuja mientras se está
 * enseñando el aviso de cookies** (`showCookieGate && authDialogMode ===
 * "register"`), y `showCookieGate` es falso en cuanto alguien contestó al aviso
 * alguna vez. Así que quien vuelve a la web y se registra **ve un formulario
 * sin casillas de consentimiento**, y se registra sin `consentLegalAt`: el
 * servidor lo acepta a nulo (`api/auth.js:1193`).
 *
 * La red que los recoge es el aviso de revisión, que salta **al entrar**
 * (`mode === "login" && !nextUser.consentLegalAt`). Queda un hueco: entre
 * registrarse y el siguiente acceso, esa cuenta existe sin condiciones
 * aceptadas.
 *
 * No se cambia aquí -es una decisión de producto y de quien lleve lo legal, no
 * de un refactor-, pero queda escrito para que se pueda decidir.
 */

/** Los cinco, y el campo de fecha que le toca a cada uno en el registro. */
export const LOS_CINCO = {
  legal: "consentLegalAt",
  marketingEmail: "consentMarketingEmailAt",
  marketingSms: "consentMarketingSmsAt",
  thirdPartyEmail: "consentThirdPartyEmailAt",
  thirdPartySms: "consentThirdPartySmsAt",
};

const NINGUNO = {
  legal: false,
  marketingEmail: false,
  marketingSms: false,
  thirdPartyEmail: false,
  thirdPartySms: false,
};

/** Los cuatro que dependen de haber aceptado las condiciones. */
const LOS_OPCIONALES = ["marketingEmail", "marketingSms", "thirdPartyEmail", "thirdPartySms"];

/**
 * Las fechas que van en el registro: una por cada sí, más las dos agregadas.
 *
 * Se deja fuera del hook para poder probarla sin montar nada.
 */
export function sellosDelConsentimiento(elegido, ahora = new Date().toISOString()) {
  const sellos = {};

  for (const [clave, campo] of Object.entries(LOS_CINCO)) {
    if (elegido?.[clave]) sellos[campo] = ahora;
  }

  // Dos agregados, que es como los lee el ERP.
  if (elegido?.marketingEmail || elegido?.marketingSms) sellos.consentMarketingAt = ahora;
  if (elegido?.thirdPartyEmail || elegido?.thirdPartySms) sellos.consentExperianAt = ahora;

  return sellos;
}

export function useLosConsentimientosDelRegistro() {
  const [elegido, setElegido] = useState(NINGUNO);

  /* Estaba escrito tres veces en diecisiete líneas, dos de ellas dentro de un
     objeto de estilo. */
  const estanLosCinco = useMemo(
    () => Object.keys(LOS_CINCO).every((clave) => Boolean(elegido[clave])),
    [elegido]
  );

  /** El interruptor de arriba: o los cinco, o ninguno. */
  const alternaLosCinco = useCallback(() => {
    setElegido((prev) => {
      const todos = Object.keys(LOS_CINCO).every((clave) => Boolean(prev[clave]));
      return Object.fromEntries(Object.keys(LOS_CINCO).map((clave) => [clave, !todos]));
    });
  }, []);

  /**
   * Marca o desmarca uno.
   *
   * Y si el que se quita es el legal, se van los otros cuatro con él: no se
   * puede consentir publicidad sin haber aceptado las condiciones. Esa regla
   * estaba dentro de un `onChange` del JSX.
   */
  const alterna = useCallback((clave) => {
    setElegido((prev) => {
      const siguiente = { ...prev, [clave]: !prev[clave] };
      if (clave === "legal" && !siguiente.legal) {
        for (const opcional of LOS_OPCIONALES) siguiente[opcional] = false;
      }
      return siguiente;
    });
  }, []);

  /** Al cerrar el diálogo o cambiar de pestaña: nada queda marcado. */
  const empiezaSinNada = useCallback(() => setElegido(NINGUNO), []);

  return {
    elegido,
    estanLosCinco,
    alterna,
    alternaLosCinco,
    empiezaSinNada,
    /** Las fechas para el registro. Vacío si no se aceptó nada. */
    sellos: useCallback((ahora) => sellosDelConsentimiento(elegido, ahora), [elegido]),
    /** Si se aceptaron las condiciones, que es lo único obligatorio. */
    aceptaLasCondiciones: Boolean(elegido.legal),
    /** Si se aceptó algo de publicidad, que es lo que decide las cookies. */
    aceptaPublicidad: Boolean(elegido.marketingEmail || elegido.marketingSms),
  };
}
