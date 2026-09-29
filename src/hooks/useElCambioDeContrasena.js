import { useCallback, useState } from "react";
import { postAuthJson } from "../utils/apiClient";

/**
 * Cambiar la contraseña desde el panel.
 *
 * ## Qué había
 *
 * Cinco `useState` en `App`, los cinco `set...` pasados a `useAuthSessionReset`
 * para poder limpiarlos al salir, y las **cuatro comprobaciones** metidas dentro
 * del `useCallback` que manda el formulario, sin una sola prueba.
 *
 * Esas cuatro comprobaciones son las que deciden si se llega a llamar al
 * servidor, y tres de ellas el servidor **no** las repite: solo comprueba que la
 * nueva tenga seis caracteres y que no sea igual a la anterior
 * (`api/auth.js:1352-1360`). Que los tres campos estén rellenos y que la
 * confirmación coincida se comprueban **solo aquí**. Si se caen, se manda al
 * servidor una contraseña que nadie ha confirmado.
 *
 * Por eso la validación sale del hook como función suelta: se puede probar sin
 * montar nada, y se prueba.
 */

const VACIO = { currentPassword: "", newPassword: "", confirmPassword: "" };

/** Lo mínimo que pide el servidor, para no decir aquí otra cosa. */
export const MINIMO_DE_CARACTERES = 6;

/**
 * Qué falta para poder cambiarla. Devuelve el aviso, o `null` si no falta nada.
 *
 * El orden importa: se avisa de lo primero que falta, no de todo a la vez, que
 * es lo que estaba y lo que la gente espera de un formulario.
 */
export function queFaltaEnElCambio({ currentPassword, newPassword, confirmPassword } = {}) {
  const actual = String(currentPassword || "");
  const nueva = String(newPassword || "");
  const confirmacion = String(confirmPassword || "");

  if (!actual || !nueva || !confirmacion) {
    return "Completa los tres campos de contraseña.";
  }
  if (nueva.length < MINIMO_DE_CARACTERES) {
    return `La nueva contraseña debe tener al menos ${MINIMO_DE_CARACTERES} caracteres.`;
  }
  /* Esto NO lo repite el servidor: sin esta línea se cambiaría la contraseña por
     una que la persona escribió mal en el segundo campo. */
  if (nueva !== confirmacion) {
    return "La confirmación no coincide con la nueva contraseña.";
  }
  if (nueva === actual) {
    return "La nueva contraseña no puede ser igual a la actual.";
  }

  return null;
}

export function useElCambioDeContrasena({ alRecibirUsuario } = {}) {
  const [abierto, setAbierto] = useState(false);
  const [formulario, setFormulario] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState("");
  const [hecho, setHecho] = useState("");

  /** Se abre o se cierra, y en los dos casos se quitan los avisos de antes. */
  const alterna = useCallback(() => {
    setAbierto((prev) => !prev);
    setFallo("");
    setHecho("");
  }, []);

  const escribe = useCallback((campo, valor) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  /** Al salir de la cuenta: no queda nada escrito ni ningún aviso. */
  const olvidaTodo = useCallback(() => {
    setAbierto(false);
    setFormulario(VACIO);
    setFallo("");
    setHecho("");
    setGuardando(false);
  }, []);

  const manda = useCallback(async (event) => {
    event?.preventDefault?.();

    const falta = queFaltaEnElCambio(formulario);
    if (falta) {
      setFallo(falta);
      return;
    }

    setGuardando(true);
    setFallo("");
    setHecho("");

    try {
      const { data } = await postAuthJson({
        action: "change_password",
        currentPassword: formulario.currentPassword,
        newPassword: formulario.newPassword,
      });

      if (data?.user?.email && alRecibirUsuario) alRecibirUsuario(data.user);

      /* Se vacía y se cierra: dejar la contraseña nueva escrita en pantalla
         después de guardarla no le sirve a nadie. */
      setFormulario(VACIO);
      setAbierto(false);
      setHecho(data?.message || "Contraseña actualizada correctamente.");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setHecho(""), 2600);
      }
    } catch (error) {
      setFallo(error?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }, [formulario, alRecibirUsuario]);

  return { abierto, formulario, guardando, fallo, hecho, alterna, escribe, manda, olvidaTodo };
}
