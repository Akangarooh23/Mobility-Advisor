import { useEffect } from "react";
import { getAuthSessionJson } from "../utils/apiClient";
import {
  clearAuthUser,
  readAuthUser,
  readCookieConsent,
  readMarketAlerts,
  readMarketAlertStatus,
  readQuestionnaireDraft,
  readSavedComparisons,
  readUserAppointments,
  writeAuthUser,
} from "../utils/storage";

export function useAppBootstrap({
  themeStorageKey,
  setThemeMode,
  setSavedComparisons,
  setUserAppointments,
  setMarketAlerts,
  setMarketAlertStatus,
  setQuestionnaireDraft,
  setCurrentUser,
  setIsUserLoggedIn,
  setCookiePreferences,
  setShowCookieGate,
}) {
  useEffect(() => {
    const savedAuthUser = readAuthUser();
    const persistedTheme = typeof window !== "undefined" ? window.localStorage.getItem(themeStorageKey) : "";

    if (persistedTheme === "dark" || persistedTheme === "light") {
      setThemeMode(persistedTheme);
    }

    setSavedComparisons(readSavedComparisons());
    setUserAppointments(readUserAppointments());
    setMarketAlerts(readMarketAlerts());
    setMarketAlertStatus(readMarketAlertStatus());
    setQuestionnaireDraft(readQuestionnaireDraft());

    const storedConsent = readCookieConsent();
    setCurrentUser(savedAuthUser);
    setIsUserLoggedIn(Boolean(savedAuthUser?.email));

    if (storedConsent?.preferences) {
      setCookiePreferences((prev) => ({
        ...prev,
        ...storedConsent.preferences,
        necessary: true,
      }));
    }

    setShowCookieGate(!storedConsent?.status);

    void (async () => {
      try {
        const { data } = await getAuthSessionJson();
        const sessionUser = data?.authenticated ? data?.user : null;

        if (sessionUser?.email) {
          writeAuthUser(sessionUser);
          setCurrentUser(sessionUser);
          setIsUserLoggedIn(true);
          return;
        }

        clearAuthUser();
        setCurrentUser(null);
        setIsUserLoggedIn(false);
      } catch {
        // If backend session check fails, keep local state as fallback.
      }
    })();
  }, [
    setCookiePreferences,
    setCurrentUser,
    setIsUserLoggedIn,
    setMarketAlertStatus,
    setMarketAlerts,
    setQuestionnaireDraft,
    setSavedComparisons,
    setShowCookieGate,
    setThemeMode,
    setUserAppointments,
    themeStorageKey,
  ]);
}
