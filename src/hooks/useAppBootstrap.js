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
  setAuthRequired,
  setAuthDialogMode,
  setShowConsentReview,
}) {
  useEffect(() => {
    const savedAuthUser = readAuthUser();
    const persistedTheme = typeof window !== "undefined" ? window.localStorage.getItem(themeStorageKey) : "";
    const PUBLIC_PATHS = ["/aviso-legal", "/politica-privacidad", "/politica-cookies", "/terminos-condiciones", "/politica-comunicaciones", "/politica-experian", "/condiciones-experian"];

    // Capture landing data from URL on first visit and persist for registration
    try {
      const existing = window.localStorage.getItem("ma.landing");
      if (!existing) {
        const urlParams = new URLSearchParams(window.location.search);
        const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
        const utms = {};
        utmKeys.forEach((k) => { const v = urlParams.get(k); if (v) utms[k] = v; });

        // Collect all non-UTM params as affiliate data
        const affiliateData = {};
        urlParams.forEach((v, k) => {
          if (!utmKeys.includes(k)) affiliateData[k] = v;
        });

        const landing = {
          utms,
          affiliateData: Object.keys(affiliateData).length > 0 ? affiliateData : null,
          referer: document.referrer || "",
          landingUrl: window.location.href,
          language: navigator.language || "",
        };
        window.localStorage.setItem("ma.landing", JSON.stringify(landing));
      }
    } catch {}
    const isPublicRoute = typeof window !== "undefined" && PUBLIC_PATHS.some((p) => window.location.pathname === p || window.location.pathname.startsWith(p + "/"));

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

    // No cached user → require login immediately (sync, no flash)
    if (!savedAuthUser?.email && !isPublicRoute) {
      setAuthRequired(true);
      setAuthDialogMode("login");
    }

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
          if (!sessionUser.consentLegalAt && !sessionUser.consentsReviewedAt) {
            setShowConsentReview(true);
          }

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
        // Session expired → require login again (skip on public/legal pages)
        if (!isPublicRoute) {
          setAuthRequired(true);
          setAuthDialogMode("login");
        }
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
    setAuthRequired,
    setAuthDialogMode,
    setShowConsentReview,
  ]);
}
