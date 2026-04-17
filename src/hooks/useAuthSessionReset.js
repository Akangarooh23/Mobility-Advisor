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
  setShowChangePasswordForm,
  setChangePasswordForm,
  setChangePasswordError,
  setChangePasswordSuccess,
  setChangePasswordLoading,
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
    setShowChangePasswordForm(false);
    setChangePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setChangePasswordError("");
    setChangePasswordSuccess("");
    setChangePasswordLoading(false);
    setAuthForm({ name: "", email: "", password: "" });
  }, [
    setAuthDialogMode,
    setAuthError,
    setAuthForm,
    setAuthLoading,
    setAuthRecoveryCode,
    setAuthRecoveryFeedback,
    setAuthRecoveryMode,
    setChangePasswordError,
    setChangePasswordForm,
    setChangePasswordLoading,
    setChangePasswordSuccess,
    setCurrentUser,
    setPendingPlanCheckoutId,
    setShowChangePasswordForm,
  ]);

  return {
    resetLoggedUser,
  };
}
