import { useEffect } from "react";
import {
  getAuthSessionJson,
  getUserAlertsJson,
  getUserPreferencesJson,
  getUserSavedComparisonsJson,
} from "../utils/apiClient";
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
  writeMarketAlerts,
  writeMarketAlertStatus,
  writeSavedComparisons,
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

          // Sync backend data into state; localStorage becomes fallback cache.
          void (async () => {
            try {
              const [savedRes, alertsRes, prefsRes] = await Promise.allSettled([
                getUserSavedComparisonsJson(),
                getUserAlertsJson(),
                getUserPreferencesJson(),
              ]);

              if (savedRes.status === "fulfilled" && savedRes.value?.data?.ok) {
                const comparisons = Array.isArray(savedRes.value.data.comparisons)
                  ? savedRes.value.data.comparisons
                  : [];
                writeSavedComparisons(comparisons);
                setSavedComparisons(comparisons);
              }

              if (alertsRes.status === "fulfilled" && alertsRes.value?.data?.ok) {
                const alerts = Array.isArray(alertsRes.value.data.alerts)
                  ? alertsRes.value.data.alerts
                  : [];
                const alertStatus = alertsRes.value.data.alertStatus || {};
                writeMarketAlerts(alerts);
                writeMarketAlertStatus(alertStatus);
                setMarketAlerts(alerts);
                setMarketAlertStatus(alertStatus);
              }

              if (prefsRes.status === "fulfilled" && prefsRes.value?.data?.ok && prefsRes.value.data.preferences) {
                try {
                  window.localStorage.setItem(
                    "movilidad-advisor.userDashboard.preferences.v1",
                    JSON.stringify(prefsRes.value.data.preferences)
                  );
                } catch {}
              }
            } catch {
              // Backend sync failed; keep localStorage state as fallback.
            }
          })();

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
