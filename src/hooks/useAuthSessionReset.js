import { useCallback } from "react";
import { postAuthJson } from "../utils/apiClient";
import { clearAuthUser } from "../utils/storage";

export function useAuthSessionReset({
  setCurrentUser,
  vuelveAlAcceso,
  olvidaElDialogoDeAcceso,
  setPendingPlanCheckoutId,
  olvidaElCambioDeContrasena,
}) {
  const resetLoggedUser = useCallback(() => {
    void postAuthJson({ action: "logout" }).catch(() => {});
    clearAuthUser();
    setCurrentUser(null);
    vuelveAlAcceso();
    /* Y el dialogo con su formulario. Aqui se vaciaba con TRES claves de las
       seis, asi que apellidos, telefono y razon social quedaban en
       `undefined` despues de cada salida. */
    olvidaElDialogoDeAcceso();
    setPendingPlanCheckoutId("");
    olvidaElCambioDeContrasena();
  }, [
    olvidaElDialogoDeAcceso,
    vuelveAlAcceso,
    olvidaElCambioDeContrasena,
    setCurrentUser,
    setPendingPlanCheckoutId,
  ]);

  return {
    resetLoggedUser,
  };
}
