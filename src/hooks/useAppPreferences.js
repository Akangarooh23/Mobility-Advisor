import { useCallback, useEffect } from "react";
import { writeCookieConsent } from "../utils/storage";

export function useAppPreferences({
  themeStorageKey,
  themeMode,
  cookiePreferences,
  setShowCookieGate,
  setShowCookieSettings,
}) {
  const saveCookieConsent = useCallback((mode = "all") => {
    const normalizedMode = ["all", "necessary", "custom"].includes(mode)
      ? mode
      : "all";
    const preferences =
      normalizedMode === "all"
        ? { necessary: true, analytics: true, personalization: true, marketing: true }
        : normalizedMode === "necessary"
        ? { necessary: true, analytics: false, personalization: false, marketing: false }
        : { ...cookiePreferences, necessary: true };

    writeCookieConsent(normalizedMode, {
      version: "2026-04",
      preferences,
    });

    setShowCookieGate(false);
    setShowCookieSettings(false);
  }, [cookiePreferences, setShowCookieGate, setShowCookieSettings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(themeStorageKey, themeMode === "dark" ? "dark" : "light");
  }, [themeMode, themeStorageKey]);

  return {
    saveCookieConsent,
  };
}
