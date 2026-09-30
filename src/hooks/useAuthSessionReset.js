import { useCallback } from "react";
import { postAuthJson } from "../utils/apiClient";

export function useAuthSessionReset({
  saleDeLaCuenta,
  vuelveAlAcceso,
  olvidaElDialogoDeAcceso,
  setPendingPlanCheckoutId,
  olvidaElCambioDeContrasena,
}) {
  const resetLoggedUser = useCallback(() => {
    void postAuthJson({ action: "logout" }).catch(() => {});
    /* Los dos estados de «no hay nadie» se mueven juntos: estaba aqui solo
       `currentUser`, e `isUserLoggedIn` lo apagaba `handleLogout` despues. */
    saleDeLaCuenta();
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
    saleDeLaCuenta,
    setPendingPlanCheckoutId,
  ]);

  return {
    resetLoggedUser,
  };
}
