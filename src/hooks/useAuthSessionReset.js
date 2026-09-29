import { useCallback } from "react";
import { postAuthJson } from "../utils/apiClient";
import { clearAuthUser } from "../utils/storage";

export function useAuthSessionReset({
  setCurrentUser,
  setAuthDialogMode,
  vuelveAlAcceso,
  setAuthError,
  setAuthLoading,
  setPendingPlanCheckoutId,
  olvidaElCambioDeContrasena,
  setAuthForm,
}) {
  const resetLoggedUser = useCallback(() => {
    void postAuthJson({ action: "logout" }).catch(() => {});
    clearAuthUser();
    setCurrentUser(null);
    setAuthDialogMode("");
    vuelveAlAcceso();
    setAuthError("");
    setAuthLoading(false);
    setPendingPlanCheckoutId("");
    olvidaElCambioDeContrasena();
    setAuthForm({ name: "", email: "", password: "" });
  }, [
    setAuthDialogMode,
    setAuthError,
    setAuthForm,
    setAuthLoading,
    vuelveAlAcceso,
    olvidaElCambioDeContrasena,
    setCurrentUser,
    setPendingPlanCheckoutId,
  ]);

  return {
    resetLoggedUser,
  };
}
