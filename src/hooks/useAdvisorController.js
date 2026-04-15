import { useCallback } from "react";
import { getUserDashboardPageFromPath } from "../utils/offerHelpers";
import { INITIAL_PORTAL_VO_FILTERS } from "../utils/portalVoHelpers";

export function createInitialDecisionAnswers() {
  return {
    operation: "",
    acquisition: "",
    hasBrand: "",
    brand: "",
    model: "",
    condition: "",
    monthlyBudget: "",
    cashBudget: "",
    financeAmount: "",
    entryAmount: "",
    ageFilter: "all",
    mileageFilter: "all",
  };
}

export function createInitialSellAnswers() {
  return {
    brand: "",
    model: "",
    year: "",
    mileage: "",
    fuel: "Gasolina",
    sellerType: "particular",
  };
}

function buildNextDecisionAnswers(prev, key, value) {
  const next = { ...prev, [key]: value };

  if (key === "brand") {
    next.model = "";
  }

  if (key === "operation" || key === "acquisition") {
    next.acquisition = key === "operation" ? "" : next.acquisition;
    next.monthlyBudget = "";
    next.cashBudget = "";
    next.financeAmount = "";
    next.entryAmount = "";
    next.ageFilter = "all";
    next.mileageFilter = "all";
  }

  if (key === "hasBrand" && value === "no") {
    next.brand = "";
    next.model = "";
  }

  return next;
}

export function useAdvisorController({
  clearQuestionnaireDraftFn,
  entryMode,
  isUserLoggedIn,
  listingFilters,
  quickValidationAnswers,
  resetListingDiscovery,
  searchRealListing,
  setAdvancedMode,
  setAnswers,
  setApiKeyMissing,
  setDecisionAiResult,
  setDecisionAnswers,
  setDecisionError,
  setDecisionListingError,
  setDecisionListingLoading,
  setDecisionListingResult,
  setDecisionLoading,
  setEntryMode,
  setError,
  setIsUserLoggedIn,
  setListingError,
  setListingFilters,
  setLoading,
  setMultiSelected,
  setPortalVoFilters,
  setQuickValidationAnswers,
  setResult,
  setResultView,
  setSaveFeedback,
  setSelectedPortalVoOfferId,
  setSellAiResult,
  setSellAnswers,
  setSellError,
  setSellListingError,
  setSellListingLoading,
  setSellListingResult,
  setSellLoading,
  setShowAuthMenu,
  setShowUserPanel,
  setStep,
  setUserDashboardPage,
  syncBrowserPath,
  onAuthRequest,
  onLogoutUser,
}) {
  const restartQuestionnaire = useCallback(() => {
    clearQuestionnaireDraftFn?.();
    setStep(0);
    setAnswers({});
    setMultiSelected([]);
    setResult(null);
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    resetListingDiscovery();
  }, [clearQuestionnaireDraftFn, resetListingDiscovery, setAnswers, setApiKeyMissing, setError, setLoading, setMultiSelected, setResult, setStep]);

  const handleAuthAction = useCallback((mode) => {
    const routePage = typeof window !== "undefined"
      ? getUserDashboardPageFromPath(window.location.pathname)
      : null;

    setShowAuthMenu(false);
    setShowUserPanel(false);

    if (typeof onAuthRequest === "function") {
      onAuthRequest(mode, { routePage });
      return;
    }

    setIsUserLoggedIn(true);
    setShowUserPanel(!routePage);
    setUserDashboardPage(routePage || "home");

    if (routePage) {
      setEntryMode("userDashboard");
      setStep(-1);
    }

    setSaveFeedback(
      mode === "login"
        ? "Sesión iniciada. Ya tienes disponible tu panel personal."
        : "Cuenta creada. Ya tienes disponible tu panel personal."
    );

    if (typeof window !== "undefined") {
      window.setTimeout(() => setSaveFeedback(""), 2200);
    }
  }, [onAuthRequest, setEntryMode, setIsUserLoggedIn, setSaveFeedback, setShowAuthMenu, setShowUserPanel, setStep, setUserDashboardPage]);

  const handleUserAccessClick = useCallback(() => {
    if (isUserLoggedIn) {
      setShowUserPanel((prev) => !prev);
      setShowAuthMenu(false);
      return;
    }

    setShowAuthMenu((prev) => !prev);
    setShowUserPanel(false);
  }, [isUserLoggedIn, setShowAuthMenu, setShowUserPanel]);

  const handleLogout = useCallback(() => {
    onLogoutUser?.();
    setIsUserLoggedIn(false);
    setShowAuthMenu(false);
    setShowUserPanel(false);
    setUserDashboardPage("home");
    syncBrowserPath("/", "replace");

    if (entryMode === "userDashboard") {
      setEntryMode(null);
      setStep(-1);

      if (typeof window !== "undefined") {
        window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
      }
    }
  }, [entryMode, onLogoutUser, setEntryMode, setIsUserLoggedIn, setShowAuthMenu, setShowUserPanel, setStep, setUserDashboardPage, syncBrowserPath]);

  const updateListingFilter = useCallback((key, value) => {
    const nextFilters = {
      ...listingFilters,
      [key]: value,
    };

    setListingFilters(nextFilters);
    setListingError(null);
    void searchRealListing(nextFilters, quickValidationAnswers);
  }, [listingFilters, quickValidationAnswers, searchRealListing, setListingError, setListingFilters]);

  const updateQuickValidationAnswer = useCallback((key, value) => {
    setQuickValidationAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, [setQuickValidationAnswers]);

  const openPortalVoOfferDetail = useCallback((offer) => {
    if (!offer?.id) {
      return;
    }

    setSelectedPortalVoOfferId(offer.id);
    syncBrowserPath("/", "replace");
    setEntryMode("portalVoDetail");

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, [setEntryMode, setSelectedPortalVoOfferId, syncBrowserPath]);

  const restart = useCallback(() => {
    clearQuestionnaireDraftFn?.();
    setEntryMode(null);
    setStep(-1);
    setUserDashboardPage("home");
    syncBrowserPath("/", "replace");
    setAnswers({});
    setMultiSelected([]);
    setResult(null);
    setResultView("analysis");
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    setAdvancedMode(false);
    resetListingDiscovery();
    setDecisionAnswers(createInitialDecisionAnswers());
    setSellAnswers(createInitialSellAnswers());
    setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
    setSelectedPortalVoOfferId(null);
    setDecisionAiResult(null);
    setDecisionError(null);
    setDecisionLoading(false);
    setDecisionListingResult(null);
    setDecisionListingError(null);
    setDecisionListingLoading(false);
    setSellAiResult(null);
    setSellError(null);
    setSellLoading(false);
    setSellListingResult(null);
    setSellListingError(null);
    setSellListingLoading(false);
  }, [
    clearQuestionnaireDraftFn,
    resetListingDiscovery,
    setAdvancedMode,
    setAnswers,
    setApiKeyMissing,
    setDecisionAiResult,
    setDecisionAnswers,
    setDecisionError,
    setDecisionListingError,
    setDecisionListingLoading,
    setDecisionListingResult,
    setDecisionLoading,
    setEntryMode,
    setError,
    setLoading,
    setMultiSelected,
    setPortalVoFilters,
    setResult,
    setResultView,
    setSelectedPortalVoOfferId,
    setSellAiResult,
    setSellAnswers,
    setSellError,
    setSellListingError,
    setSellListingLoading,
    setSellListingResult,
    setSellLoading,
    setStep,
    setUserDashboardPage,
    syncBrowserPath,
  ]);

  const updateDecisionAnswer = useCallback((key, value) => {
    setDecisionAnswers((prev) => buildNextDecisionAnswers(prev, key, value));
  }, [setDecisionAnswers]);

  const updatePortalVoFilter = useCallback((key, value) => {
    setPortalVoFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, [setPortalVoFilters]);

  return {
    handleAuthAction,
    handleLogout,
    handleUserAccessClick,
    openPortalVoOfferDetail,
    restart,
    restartQuestionnaire,
    updateDecisionAnswer,
    updateListingFilter,
    updatePortalVoFilter,
    updateQuickValidationAnswer,
  };
}
