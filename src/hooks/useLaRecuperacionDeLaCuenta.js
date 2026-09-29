import { useCallback, useState } from "react";

/**
 * Recuperar la cuenta: los dos pasos de «he perdido la contraseña».
 *
 * ## Qué había
 *
 * Tres `useState` en `App` y **el mismo trío de tres líneas escrito cinco veces
 * en tres ficheros** para volver al acceso normal:
 *
 *     setAuthRecoveryMode("none");
 *     setAuthRecoveryCode("");
 *     setAuthRecoveryFeedback("");
 *
 * Dos veces en `useAuthDialogControls` -al abrir y al cerrar el diálogo-, una en
 * `useAuthSessionReset` -al salir de la cuenta- y dos en el JSX, una de ellas
 * para ir al paso del código en vez de volver.
 *
 * Cinco copias de un reinicio de tres estados es exactamente donde alguien
 * añade un cuarto estado y lo pone en cuatro sitios.
 *
 * ## Los tres sitios donde se puede estar
 *
 *   · `none` -el acceso normal, entrar o registrarse;
 *   · `request` -se pide el correo para mandar el código;
 *   · `confirm` -se escriben el código y la contraseña nueva.
 *
 * Eran una cadena suelta comparada con `===` en veintitantos sitios del JSX. Se
 * deja la cadena, que es lo que lee el JSX, pero los tres valores tienen nombre
 * y el paso se mueve con funciones que dicen a dónde van.
 *
 * ## Lo que NO hace
 *
 * Llamar al servidor. Lo hace `submitAuthForm`, que es quien tiene el correo y
 * la contraseña del formulario de acceso. Esto guarda en qué paso se está, el
 * código que se ha teclado y lo que se le está diciendo a la persona.
 */

/** Los tres sitios donde se puede estar. */
export const EL_ACCESO_NORMAL = "none";
export const PEDIR_EL_CODIGO = "request";
export const ESCRIBIR_EL_CODIGO = "confirm";

export function useLaRecuperacionDeLaCuenta() {
  const [paso, setPaso] = useState(EL_ACCESO_NORMAL);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState("");

  /**
   * Vuelve al acceso normal, sin rastro del intento anterior.
   *
   * Esto es lo que estaba escrito cinco veces. Se llama al abrir el diálogo, al
   * cerrarlo, al salir de la cuenta y desde el botón de volver.
   */
  const vuelveAlAcceso = useCallback(() => {
    setPaso(EL_ACCESO_NORMAL);
    setCodigo("");
    setAviso("");
  }, []);

  /** "¿Has olvidado tu contraseña?": se empieza pidiendo el correo. */
  const empiezaARecuperar = useCallback(() => {
    setPaso(PEDIR_EL_CODIGO);
    setCodigo("");
    setAviso("");
  }, []);

  /**
   * El servidor dice que ha mandado el código: se pasa a escribirlo.
   *
   * El código **no** se rellena aquí aunque el servidor lo mande en local: se
   * enseña en el aviso y se teclea. Rellenarlo haría que en local el paso se
   * saltara solo y nadie probaría nunca lo que hace todo el mundo.
   */
  const pideQueEscribaElCodigo = useCallback((loQueSeLeDice) => {
    setPaso(ESCRIBIR_EL_CODIGO);
    setAviso(loQueSeLeDice || "");
  }, []);

  /** Antes de cada intento, lo que se le dijo en el anterior deja de valer. */
  const olvidaElAviso = useCallback(() => setAviso(""), []);

  return {
    paso,
    codigo,
    aviso,
    escribeElCodigo: setCodigo,
    vuelveAlAcceso,
    empiezaARecuperar,
    pideQueEscribaElCodigo,
    olvidaElAviso,
    /** Para no comparar cadenas a mano en el JSX. */
    enElAccesoNormal: paso === EL_ACCESO_NORMAL,
    pidiendoElCorreo: paso === PEDIR_EL_CODIGO,
    escribiendoElCodigo: paso === ESCRIBIR_EL_CODIGO,
  };
}
