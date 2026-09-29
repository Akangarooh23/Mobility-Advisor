import { useCallback } from "react";
import { postAuthJson } from "../utils/apiClient";
import { clearAuthUser } from "../utils/storage";

export function useAuthSessionReset({
  setCurrentUser,
  setAuthDialogMode,
  setAuthRecoveryMode,
  setAuthRecoveryCode,
  setAuthRecoveryFeedback,
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
    setAuthRecoveryMode("none");
    setAuthRecoveryCode("");
    setAuthRecoveryFeedback("");
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
    setAuthRecoveryCode,
    setAuthRecoveryFeedback,
    setAuthRecoveryMode,
    olvidaElCambioDeContrasena,
    setCurrentUser,
    setPendingPlanCheckoutId,
  ]);

  return {
    resetLoggedUser,
  };
}
