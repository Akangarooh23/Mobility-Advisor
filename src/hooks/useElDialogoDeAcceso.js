import { useCallback, useState } from "react";

/**
 * El diálogo de acceso: entrar, registrarse, y a dónde se va después.
 *
 * ## Qué había
 *
 * Siete `useState` en `App`, más `useAuthDialogControls` -que recibía nueve
 * `set...` para poder abrirlo y cerrarlo-, más seis `onChange` idénticos en el
 * JSX, más seis comprobaciones en fila dentro de la función que lo envía. Nada
 * probado.
 *
 * ## `authForm` se vaciaba de cuatro formas distintas
 *
 * El estado tiene **seis** claves. Y se escribía:
 *
 *   · con seis al arrancar;
 *   · con **cinco** al abrir el diálogo y con cinco al cerrarlo -en las dos
 *     faltaba `company_name`;
 *   · con **tres** al salir de la cuenta -faltaban `apellidos`, `phone` y
 *     `company_name`.
 *
 * Las que faltan quedan en `undefined`, y `value={undefined}` convierte un campo
 * controlado en no controlado a mitad de vida.
 *
 * Pero lo que se veía era otra cosa. Al abrir el diálogo en modo registro se
 * **conservan** a propósito el nombre, los apellidos y el teléfono ya escritos
 * -para no hacer teclearlos otra vez- y `company_name` no estaba en la lista:
 * era **el único campo que se perdía al reabrir**. Alguien rellenando el
 * registro de una empresa perdía la razón social y conservaba el teléfono, sin
 * motivo. Ahora hay una sola forma vacía y la conservación es explícita.
 *
 * ## Lo que NO comprueba, y el servidor sí
 *
 * Que la contraseña tenga seis caracteres. El servidor lo exige
 * (`api/auth.js:1670`) y el marcador del campo lo dice -«Mínimo 6 caracteres»-
 * pero aquí no se mira: se manda, el servidor la rechaza y se enseña su mensaje.
 * Funciona, cuesta un viaje de ida y vuelta. Se deja como estaba y queda escrito.
 */

/**
 * El formulario de acceso vacío, con SUS SEIS CLAVES.
 *
 * Es la única forma vacía que hay. Escribir menos deja las que falten en
 * `undefined`.
 */
export const FORMULARIO_DE_ACCESO_VACIO = {
  name: "",
  apellidos: "",
  phone: "",
  email: "",
  password: "",
  company_name: "",
};

/** Los dos tipos de cuenta. */
export const PARTICULAR = "individual";
export const EMPRESA = "business";

/**
 * Qué falta para poder entrar o registrarse. Devuelve el aviso, o `null`.
 *
 * Eran seis `if` en fila dentro del envío. El orden es el que estaba, y el orden
 * importa: se avisa de lo primero que falta.
 *
 * Los valores llegan ya normalizados por quien monta el paquete, para que esto
 * no tenga que saber cómo se normaliza.
 */
export function queFaltaParaEntrar({ modo, tipoDeCliente, name, apellidos, phone, email, password, companyName } = {}) {
  const registrandose = modo === "register";

  if (registrandose && tipoDeCliente === EMPRESA && !companyName) {
    return "Indica la razón social de tu empresa.";
  }
  if (registrandose && tipoDeCliente === PARTICULAR && !name) {
    return "Indica tu nombre para crear la cuenta.";
  }
  if (registrandose && tipoDeCliente === PARTICULAR && !apellidos) {
    return "Indica tus apellidos para crear la cuenta.";
  }
  if (registrandose && !phone) {
    return "Indica tu número de teléfono para crear la cuenta.";
  }
  /* Estas dos valen para los dos modos: sin correo y contraseña no hay nada. */
  if (!email) {
    return "Indica tu correo electrónico.";
  }
  if (!password) {
    return "Indica tu contraseña.";
  }

  return null;
}

/**
 * @param currentUserEmail      el correo de quien ya entró, que se propone
 * @param cierraLosMenus        el menú de cuenta y el panel, que no son de aquí
 * @param olvidaElPlanPendiente el plan que se dejó a medias, que no es de aquí
 * @param vuelveAlAcceso        cierra la recuperación, que tampoco es de aquí
 */
export function useElDialogoDeAcceso({
  currentUserEmail,
  cierraLosMenus,
  olvidaElPlanPendiente,
  vuelveAlAcceso,
} = {}) {
  /** "" cerrado, "login" o "register". */
  const [authDialogMode, setAuthDialogMode] = useState("");
  const [authForm, setAuthForm] = useState(FORMULARIO_DE_ACCESO_VACIO);
  const [clientType, setClientType] = useState(PARTICULAR);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  /* A dónde se va cuando termine. Dos porque son dos cosas: una página del panel
     y un modo de entrada público. */
  const [authTargetPage, setAuthTargetPage] = useState("home");
  const [authTargetEntryMode, setAuthTargetEntryMode] = useState("");

  /** Un campo. Eran seis `onChange` idénticos en el JSX. */
  const escribe = useCallback((campo, valor) => {
    setAuthForm((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  /**
   * Particular o empresa, y se borra lo que ya no aplica.
   *
   * Si no se borrara, quien empieza como empresa y cambia a particular mandaría
   * la razón social de todas formas: el paquete la lee del formulario.
   */
  const eligeTipoDeCliente = useCallback((tipo) => {
    setClientType(tipo === EMPRESA ? EMPRESA : PARTICULAR);
    setAuthForm((prev) => (tipo === EMPRESA
      ? { ...prev, name: "", apellidos: "" }
      : { ...prev, company_name: "" }));
  }, []);

  const openAuthDialog = useCallback((mode = "login", options = {}) => {
    const registrandose = mode === "register";

    setAuthDialogMode(registrandose ? "register" : "login");
    setAuthTargetPage(options?.routePage || "home");
    setAuthTargetEntryMode(options?.entryMode || "");
    setAuthError("");
    if (vuelveAlAcceso) vuelveAlAcceso();
    if (cierraLosMenus) cierraLosMenus();

    /*
     * Registrándose se conserva lo ya escrito -nombre, apellidos, teléfono y la
     * razón social- para no hacerlo teclear otra vez. `company_name` faltaba en
     * esta lista y era el único campo que se perdía al reabrir.
     *
     * La contraseña nunca se conserva.
     */
    setAuthForm((prev) => ({
      ...FORMULARIO_DE_ACCESO_VACIO,
      name: registrandose ? prev.name : "",
      apellidos: registrandose ? prev.apellidos : "",
      phone: registrandose ? prev.phone : "",
      company_name: registrandose ? prev.company_name : "",
      email: currentUserEmail || prev.email || "",
      password: "",
    }));
  }, [currentUserEmail, vuelveAlAcceso, cierraLosMenus]);

  const closeAuthDialog = useCallback(() => {
    setAuthDialogMode("");
    setAuthTargetEntryMode("");
    setAuthError("");
    setAuthLoading(false);
    if (vuelveAlAcceso) vuelveAlAcceso();
    if (olvidaElPlanPendiente) olvidaElPlanPendiente();

    /* Al cerrar sí se tira todo, menos el correo: es lo que se propone la
       próxima vez. */
    setAuthForm((prev) => ({
      ...FORMULARIO_DE_ACCESO_VACIO,
      email: currentUserEmail || prev.email || "",
    }));
  }, [currentUserEmail, vuelveAlAcceso, olvidaElPlanPendiente]);

  /** El enlace de «¿no tienes cuenta?» y su vuelta. */
  const alternaEntreEntrarYRegistrarse = useCallback(() => {
    setAuthError("");
    setAuthDialogMode((prev) => (prev === "register" ? "login" : "register"));
  }, []);

  /** Al salir de la cuenta: el diálogo cerrado y el formulario vacío de verdad. */
  const olvidaTodo = useCallback(() => {
    setAuthDialogMode("");
    setAuthError("");
    setAuthLoading(false);
    setAuthForm(FORMULARIO_DE_ACCESO_VACIO);
  }, []);

  return {
    authDialogMode, setAuthDialogMode,
    authForm, setAuthForm,
    clientType,
    authError, setAuthError,
    authLoading, setAuthLoading,
    authTargetPage, setAuthTargetPage,
    authTargetEntryMode, setAuthTargetEntryMode,

    escribe,
    eligeTipoDeCliente,
    openAuthDialog,
    closeAuthDialog,
    alternaEntreEntrarYRegistrarse,
    olvidaTodo,
  };
}
