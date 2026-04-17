import { useCallback, useEffect } from "react";
import {
  USER_DASHBOARD_ROUTE_MAP,
  getUserDashboardPageFromPath,
  getUserDashboardPath,
  normalizeText,
} from "../utils/offerHelpers";

export function useDashboardNavigation({
  isUserLoggedIn,
  setShowAuthMenu,
  setShowUserPanel,
  setUserDashboardPage,
  setEntryMode,
  setStep,
}) {
  const syncBrowserPath = useCallback((nextPath, historyMode = "push") => {
    if (typeof window === "undefined") {
      return;
    }

    const targetPath = normalizeText(nextPath) || "/";

    if (window.location.pathname === targetPath) {
      return;
    }

    const historyMethod = historyMode === "replace" ? "replaceState" : "pushState";
    window.history[historyMethod]({}, "", targetPath);
  }, []);

  const navigateToUserDashboardPage = useCallback((page = "home", historyMode = "push") => {
    const targetPage = USER_DASHBOARD_ROUTE_MAP[page] ? page : "home";

    setShowAuthMenu(false);
    setShowUserPanel(false);
    setUserDashboardPage(targetPage);
    setEntryMode("userDashboard");
    setStep(-1);
    syncBrowserPath(getUserDashboardPath(targetPage), historyMode);

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, [setEntryMode, setShowAuthMenu, setShowUserPanel, setStep, setUserDashboardPage, syncBrowserPath]);

  const openUserDashboard = useCallback(() => {
    const routePage = typeof window !== "undefined"
      ? getUserDashboardPageFromPath(window.location.pathname)
      : null;

    navigateToUserDashboardPage(routePage || "home");
  }, [navigateToUserDashboardPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleBrowserNavigation = () => {
      const routePage = getUserDashboardPageFromPath(window.location.pathname);

      if (routePage) {
        setUserDashboardPage(routePage);

        if (isUserLoggedIn) {
          setShowAuthMenu(false);
          setShowUserPanel(false);
          setEntryMode("userDashboard");
          setStep(-1);
        }
        return;
      }

      setEntryMode((prev) => (prev === "userDashboard" ? null : prev));
    };

    handleBrowserNavigation();
    window.addEventListener("popstate", handleBrowserNavigation);
    return () => window.removeEventListener("popstate", handleBrowserNavigation);
  }, [isUserLoggedIn, setEntryMode, setShowAuthMenu, setShowUserPanel, setStep, setUserDashboardPage]);

  return {
    syncBrowserPath,
    navigateToUserDashboardPage,
    openUserDashboard,
  };
}
