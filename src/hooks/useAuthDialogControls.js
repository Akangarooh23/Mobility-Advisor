import { useCallback } from "react";

export function useAuthDialogControls({
  currentUserEmail,
  setAuthDialogMode,
  vuelveAlAcceso,
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
    vuelveAlAcceso();
    setAuthTargetPage(options?.routePage || "home");
    setAuthTargetEntryMode(options?.entryMode || "");
    setAuthError("");
    setShowAuthMenu(false);
    setShowUserPanel(false);
    setAuthForm((prev) => ({
      name: mode === "register" ? prev.name : "",
      apellidos: mode === "register" ? prev.apellidos : "",
      phone: mode === "register" ? prev.phone : "",
      email: currentUserEmail || prev.email || "",
      password: "",
    }));
  }, [
    currentUserEmail,
    setAuthDialogMode,
    setAuthError,
    setAuthForm,
    vuelveAlAcceso,
    setAuthTargetEntryMode,
    setAuthTargetPage,
    setShowAuthMenu,
    setShowUserPanel,
  ]);

  const closeAuthDialog = useCallback(() => {
    setAuthDialogMode("");
    vuelveAlAcceso();
    setAuthTargetEntryMode("");
    setPendingPlanCheckoutId("");
    setAuthError("");
    setAuthLoading(false);
    setAuthForm((prev) => ({
      name: "",
      apellidos: "",
      phone: "",
      email: currentUserEmail || prev.email || "",
      password: "",
    }));
  }, [
    currentUserEmail,
    setAuthDialogMode,
    setAuthError,
    setAuthForm,
    setAuthLoading,
    vuelveAlAcceso,
    setAuthTargetEntryMode,
    setPendingPlanCheckoutId,
  ]);

  return {
    openAuthDialog,
    closeAuthDialog,
  };
}
