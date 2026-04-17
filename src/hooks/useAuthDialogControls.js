import { useCallback } from "react";

export function useAuthDialogControls({
  currentUserEmail,
  setAuthDialogMode,
  setAuthRecoveryMode,
  setAuthRecoveryCode,
  setAuthRecoveryFeedback,
  setAuthTargetPage,
  setAuthTargetEntryMode,
  setAuthError,
  setShowAuthMenu,
  setShowUserPanel,
  setAuthForm,
  setPendingPlanCheckoutId,
  setAuthLoading,
}) {
  const openAuthDialog = useCallback((mode = "login", options = {}) => {
    setAuthDialogMode(mode === "register" ? "register" : "login");
    setAuthRecoveryMode("none");
    setAuthRecoveryCode("");
    setAuthRecoveryFeedback("");
    setAuthTargetPage(options?.routePage || "home");
    setAuthTargetEntryMode(options?.entryMode || "");
    setAuthError("");
    setShowAuthMenu(false);
    setShowUserPanel(false);
    setAuthForm((prev) => ({
      name: mode === "register" ? prev.name : "",
      email: currentUserEmail || prev.email || "",
      password: "",
    }));
  }, [
    currentUserEmail,
    setAuthDialogMode,
    setAuthError,
    setAuthForm,
    setAuthRecoveryCode,
    setAuthRecoveryFeedback,
    setAuthRecoveryMode,
    setAuthTargetEntryMode,
    setAuthTargetPage,
    setShowAuthMenu,
    setShowUserPanel,
  ]);

  const closeAuthDialog = useCallback(() => {
    setAuthDialogMode("");
    setAuthRecoveryMode("none");
    setAuthRecoveryCode("");
    setAuthRecoveryFeedback("");
    setAuthTargetEntryMode("");
    setPendingPlanCheckoutId("");
    setAuthError("");
    setAuthLoading(false);
    setAuthForm((prev) => ({
      name: "",
      email: currentUserEmail || prev.email || "",
      password: "",
    }));
  }, [
    currentUserEmail,
    setAuthDialogMode,
    setAuthError,
    setAuthForm,
    setAuthLoading,
    setAuthRecoveryCode,
    setAuthRecoveryFeedback,
    setAuthRecoveryMode,
    setAuthTargetEntryMode,
    setPendingPlanCheckoutId,
  ]);

  return {
    openAuthDialog,
    closeAuthDialog,
  };
}
