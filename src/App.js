import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import AdviceIntroPage from "./pages/AdviceIntroPage";
import AdviceResultsPage from "./pages/AdviceResultsPage";
import DecisionPage from "./pages/DecisionPage";
import LandingPage from "./pages/LandingPage";
import PortalVoDetailPage from "./pages/PortalVoDetailPage";
import PortalVoMarketplacePage from "./pages/PortalVoMarketplacePage";
import SellPage from "./pages/SellPage";
import ApiKeyMissingPage from "./pages/ApiKeyMissingPage";
import ErrorStatePage from "./pages/ErrorStatePage";
import LoadingAnalysisPage from "./pages/LoadingAnalysisPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import UserDashboardPage from "./pages/userDashboard/UserDashboardPage";
import ResolvedOfferImage from "./components/offers/ResolvedOfferImage";
import {
  createInitialDecisionAnswers,
  createInitialSellAnswers,
  useAdvisorController,
} from "./hooks/useAdvisorController";
import {
  USER_DASHBOARD_ROUTE_MAP,
  buildOfferModelSuggestions,
  buildSearchCoverageSummary,
  getOfferBadgeStyle,
  getOfferFallbackSearchUrl,
  getOfferNavigationUrl,
  getOfferTrustBadges,
  getUserDashboardPageFromPath,
  getUserDashboardPath,
  hasOfferRealImage,
  normalizeOfferAssetUrl,
  normalizeStringArray,
  normalizeText,
  openOfferInNewTab,
  resolveOfferProviderName,
} from "./utils/offerHelpers";
import {
  isCompleteAdvisorResult,
  isCompleteDecisionAiResult,
  isCompleteSellAiResult,
  normalizeAdvisorResult,
  normalizeDecisionAiResult,
  normalizeSellAiResult,
  sanitizeResultForDisplay,
} from "./utils/advisorResults";
import { getAuthSessionJson, getVehicleCatalogJson, postAlertEmailDigestJson, postAuthJson, postListingJson } from "./utils/apiClient";
import {
  ANALYSIS_LOADING_PHASES,
  buildAdviceAnalysisPrompt,
  buildAnswersSummary,
  buildDecisionAnalysisPrompt,
  buildSellAnalysisPrompt,
  fetchDecisionListing,
  fetchSellComparableListing,
  requestAiJson,
} from "./utils/analysisFlows";
import {
  buildMarketAlertMatches,
  buildPortalVoEquipment,
  buildPortalVoHighlights,
  buildPortalVoMarketplaceModel,
  getPortalVoEcoLabel,
  getPortalVoTransmission,
  INITIAL_PORTAL_VO_FILTERS,
} from "./utils/portalVoHelpers";
import {
  buildComparisonSnapshot,
  buildMarketRadarSnapshot,
  buildOfferRanking,
  buildSavedComparisonKey,
  buildSellEstimate,
  estimateMonthlyPayment,
  formatCurrency,
  getOptionAmount,
  getOptionLabel,
  getQuickValidationQuestions,
  inferListingBudgetFromAnswers,
} from "./utils/businessHelpers";
import { buildUserDashboardModel } from "./utils/userDashboardHelpers";
import {
  clearAuthUser,
  clearQuestionnaireDraft,
  readAuthUser,
  readMarketAlerts,
  readMarketAlertStatus,
  readQuestionnaireDraft,
  readSavedComparisons,
  readUserAppointments,
  writeAuthUser,
  writeMarketAlerts,
  writeMarketAlertStatus,
  writeQuestionnaireDraft,
  writeSavedComparisons,
  writeUserAppointments,
} from "./utils/storage";
import {
  ADVISOR_PILLARS,
  AGE_FILTER_OPTIONS,
  ENTRY_AMOUNT_OPTIONS,
  FINANCE_AMOUNT_OPTIONS,
  INCOME_STABILITY_OPTIONS,
  MARKET_BRANDS,
  MILEAGE_FILTER_OPTIONS,
  MOBILITY_TYPES,
  MONTHLY_BUDGET_OPTIONS,
  SELL_FUEL_OPTIONS,
  TOTAL_PURCHASE_OPTIONS,
} from "./data/marketData";
import { PORTAL_VO_OFFERS } from "./data/portalVoOffers";
import { STEPS, getQuestionnaireSteps } from "./data/questionnaireSteps";
import { BLOCK_COLORS, BRAND_LOGOS } from "./ui/branding";
import { createAppStyles } from "./ui/appStyles";

function countAnsweredSteps(answers, steps = STEPS) {
  return steps.reduce((acc, stepConfig) => {
    const value = answers?.[stepConfig.id];

    if (Array.isArray(value)) {
      return acc + (value.length > 0 ? 1 : 0);
    }

    return acc + (value ? 1 : 0);
  }, 0);
}

function buildActiveAnswers(allAnswers, steps = STEPS) {
  return steps.reduce((acc, stepConfig) => {
    const value = allAnswers?.[stepConfig.id];

    if (Array.isArray(value)) {
      if (value.length > 0) {
        acc[stepConfig.id] = value;
      }
      return acc;
    }

    if (value) {
      acc[stepConfig.id] = value;
    }

    return acc;
  }, {});
}

function resolveAlertRecipientEmail(alert = {}, fallbackEmail = "") {
  const directEmail = normalizeText(alert?.email).toLowerCase();
  const fallback = normalizeText(fallbackEmail).toLowerCase();

  if (!alert?.notifyByEmail) {
    return "";
  }

  return directEmail || fallback;
}

// ─────────────────────────────────────────
// APP
// ─────────────────────────────────────────
export default function App() {
  const [entryMode, setEntryMode] = useState(null);
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState({});
  const [multiSelected, setMultiSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [resultView, setResultView] = useState("analysis");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [decisionAnswers, setDecisionAnswers] = useState(createInitialDecisionAnswers);
  const [sellAnswers, setSellAnswers] = useState(createInitialSellAnswers);
  const [portalVoFilters, setPortalVoFilters] = useState({ ...INITIAL_PORTAL_VO_FILTERS });
  const [selectedPortalVoOfferId, setSelectedPortalVoOfferId] = useState(null);
  const [listingFilters, setListingFilters] = useState({
    company: "",
    budget: "",
    income: "",
  });
  const [advancedMode, setAdvancedMode] = useState(false);
  const [listingResult, setListingResult] = useState(null);
  const [listingOptions, setListingOptions] = useState([]);
  const [listingSearchCoverage, setListingSearchCoverage] = useState(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState(null);
  const [quickValidationAnswers, setQuickValidationAnswers] = useState({});
  const [decisionAiResult, setDecisionAiResult] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState(null);
  const [decisionListingResult, setDecisionListingResult] = useState(null);
  const [decisionListingLoading, setDecisionListingLoading] = useState(false);
  const [decisionListingError, setDecisionListingError] = useState(null);
  const [sellAiResult, setSellAiResult] = useState(null);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState(null);
  const [sellListingResult, setSellListingResult] = useState(null);
  const [sellListingLoading, setSellListingLoading] = useState(false);
  const [sellListingError, setSellListingError] = useState(null);
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [userAppointments, setUserAppointments] = useState([]);
  const [marketAlerts, setMarketAlerts] = useState([]);
  const [marketAlertStatus, setMarketAlertStatus] = useState({});
  const [marketBrandsCatalog, setMarketBrandsCatalog] = useState(MARKET_BRANDS);
  const [questionnaireDraft, setQuestionnaireDraft] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [emailDigestFeedback, setEmailDigestFeedback] = useState("");
  const [emailDigestLoading, setEmailDigestLoading] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authDialogMode, setAuthDialogMode] = useState("");
  const [authRecoveryMode, setAuthRecoveryMode] = useState("none");
  const [authRecoveryCode, setAuthRecoveryCode] = useState("");
  const [authRecoveryFeedback, setAuthRecoveryFeedback] = useState("");
  const [authTargetPage, setAuthTargetPage] = useState("home");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [userDashboardPage, setUserDashboardPage] = useState("home");
  const quickValidationRef = useRef({});
  const listingOptionsRef = useRef([]);
  const listingSeenRef = useRef({ urls: [], titles: [] });
  const resultRef = useRef(null);

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
  }, [syncBrowserPath]);

  const showOffersPage = useCallback(() => {
    setResultView("offers");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const showAnalysisPage = useCallback(() => {
    setResultView("analysis");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const openUserDashboard = useCallback(() => {
    const routePage = typeof window !== "undefined"
      ? getUserDashboardPageFromPath(window.location.pathname)
      : null;

    navigateToUserDashboardPage(routePage || "home");
  }, [navigateToUserDashboardPage]);

  const activeSteps = useMemo(() => getQuestionnaireSteps(advancedMode), [advancedMode]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data } = await getVehicleCatalogJson();
        const nextCatalog = (Array.isArray(data?.brands) ? data.brands : []).reduce((acc, brandEntry) => {
          const brandName = normalizeText(brandEntry?.name);

          if (!brandName) {
            return acc;
          }

          const models = Array.isArray(brandEntry?.models)
            ? brandEntry.models.map((modelName) => normalizeText(modelName)).filter(Boolean)
            : [];

          acc[brandName] = models;
          return acc;
        }, {});

        if (isMounted && Object.keys(nextCatalog).length > 0) {
          setMarketBrandsCatalog(nextCatalog);
        }
      } catch {
        // Keep static in-app catalog if API catalog is unavailable.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentStep = activeSteps[step];
  const totalSteps = activeSteps.length;
  const currentUserEmail = normalizeText(currentUser?.email).toLowerCase();
  const marketAlertMatches = useMemo(
    () => buildMarketAlertMatches({ alerts: marketAlerts, offers: PORTAL_VO_OFFERS }),
    [marketAlerts]
  );
  const newAlertMatchesCount = useMemo(
    () =>
      marketAlerts.reduce((acc, alert) => {
        const matchCount = Number(marketAlertMatches?.[alert.id]?.count || 0);
        const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
        return acc + Math.max(matchCount - seenCount, 0);
      }, 0),
    [marketAlertMatches, marketAlertStatus, marketAlerts]
  );
  const pendingAlertNotifications = useMemo(
    () =>
      marketAlerts
        .map((alert) => {
          const matchInfo = marketAlertMatches?.[alert.id] || { count: 0, matches: [] };
          const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
          const newMatchesCount = Math.max(Number(matchInfo.count || 0) - seenCount, 0);

          if (newMatchesCount <= 0) {
            return null;
          }

          const alertEmail = resolveAlertRecipientEmail(alert, currentUserEmail);

          return {
            id: alert.id,
            title: alert.title,
            newMatchesCount,
            summary: `${newMatchesCount} ${newMatchesCount === 1 ? "coincidencia nueva detectada" : "coincidencias nuevas detectadas"} en el marketplace`,
            matches: Array.isArray(matchInfo.matches) ? matchInfo.matches.slice(0, 2) : [],
            notifyByEmail: Boolean(alert.notifyByEmail && alertEmail),
            email: alertEmail,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.newMatchesCount - a.newMatchesCount || a.title.localeCompare(b.title, "es")),
    [currentUserEmail, marketAlertMatches, marketAlertStatus, marketAlerts]
  );

  const {
    dashboardSavedComparisons,
    dashboardAppointments,
    dashboardValuations,
    userVehicleSections,
  } = useMemo(
    () =>
      buildUserDashboardModel({
        savedComparisons,
        userAppointments,
        result,
        sellAiResult,
        sellAnswers,
        sellListingResult,
      }),
    [savedComparisons, userAppointments, result, sellAiResult, sellAnswers, sellListingResult]
  );

  useEffect(() => {
    const savedAuthUser = readAuthUser();

    setSavedComparisons(readSavedComparisons());
    setUserAppointments(readUserAppointments());
    setMarketAlerts(readMarketAlerts());
    setMarketAlertStatus(readMarketAlertStatus());
    setQuestionnaireDraft(readQuestionnaireDraft());
    setCurrentUser(savedAuthUser);
    setIsUserLoggedIn(Boolean(savedAuthUser?.email));

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
  }, []);

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

      if (entryMode === "userDashboard") {
        setEntryMode(null);
        setStep(-1);
      }
    };

    handleBrowserNavigation();
    window.addEventListener("popstate", handleBrowserNavigation);
    return () => window.removeEventListener("popstate", handleBrowserNavigation);
  }, [entryMode, isUserLoggedIn]);

  useEffect(() => {
    quickValidationRef.current = quickValidationAnswers;
  }, [quickValidationAnswers]);

  useEffect(() => {
    listingOptionsRef.current = listingOptions;

    if (!Array.isArray(listingOptions) || listingOptions.length === 0) {
      return;
    }

    const previousUrls = Array.isArray(listingSeenRef.current?.urls) ? listingSeenRef.current.urls : [];
    const previousTitles = Array.isArray(listingSeenRef.current?.titles) ? listingSeenRef.current.titles : [];
    const nextUrls = Array.from(
      new Set([
        ...previousUrls,
        ...listingOptions.map((item) => normalizeText(item?.url)).filter(Boolean),
      ])
    ).slice(-30);
    const nextTitles = Array.from(
      new Set([
        ...previousTitles,
        ...listingOptions.map((item) => normalizeText(item?.title)).filter(Boolean),
      ])
    ).slice(-40);

    listingSeenRef.current = { urls: nextUrls, titles: nextTitles };
  }, [listingOptions]);

  useEffect(() => {
    if (entryMode !== "consejo" || step < 0 || step >= totalSteps) {
      setMultiSelected([]);
      return;
    }

    const stepConfig = activeSteps[step];
    if (stepConfig.type === "multi") {
      const saved = answers[stepConfig.id];
      setMultiSelected(Array.isArray(saved) ? saved : []);
      return;
    }

    setMultiSelected([]);
  }, [entryMode, step, totalSteps, answers, activeSteps]);

  useEffect(() => {
    if (entryMode !== "consejo" || step < 0 || result || apiKeyMissing) {
      return;
    }

    const answersForDraft =
      currentStep?.type === "multi"
        ? { ...answers, [currentStep.id]: multiSelected }
        : { ...answers };
    const activeAnswers = buildActiveAnswers(answersForDraft, activeSteps);
    const answeredSteps = countAnsweredSteps(activeAnswers, activeSteps);

    if (answeredSteps === 0) {
      return;
    }

    const draft = {
      step,
      advancedMode,
      answers: activeAnswers,
      answeredSteps,
      totalSteps: activeSteps.length,
      updatedAt: new Date().toISOString(),
    };

    writeQuestionnaireDraft(draft);
    setQuestionnaireDraft(draft);
  }, [activeSteps, advancedMode, answers, apiKeyMissing, currentStep, entryMode, multiSelected, result, step]);

  useEffect(() => {
    setDecisionAiResult(null);
    setDecisionError(null);
    setDecisionListingResult(null);
    setDecisionListingError(null);
    setDecisionListingLoading(false);
  }, [decisionAnswers]);

  useEffect(() => {
    setSellAiResult(null);
    setSellError(null);
    setSellListingResult(null);
    setSellListingError(null);
    setSellListingLoading(false);
  }, [sellAnswers]);

  const resetListingDiscovery = useCallback(() => {
    setListingFilters({ company: "", budget: "", income: "" });
    setListingResult(null);
    setListingOptions([]);
    listingSeenRef.current = { urls: [], titles: [] };
    setListingSearchCoverage(null);
    setListingError(null);
    setListingLoading(false);
  }, []);

  const resumeQuestionnaireDraft = useCallback(() => {
    const savedDraft = readQuestionnaireDraft();

    if (!savedDraft?.answers) {
      setEntryMode("consejo");
      setStep(-1);
      return;
    }

    const restoredAdvancedMode = Boolean(savedDraft.advancedMode);
    const restoredSteps = getQuestionnaireSteps(restoredAdvancedMode);
    const restoredAnswers = savedDraft.answers && typeof savedDraft.answers === "object"
      ? savedDraft.answers
      : {};
    const numericStep = Number(savedDraft.step);
    const fallbackStep = Math.max(0, Math.min(countAnsweredSteps(restoredAnswers, restoredSteps), restoredSteps.length - 1));
    const nextStep = Number.isFinite(numericStep)
      ? Math.max(0, Math.min(numericStep, restoredSteps.length - 1))
      : fallbackStep;

    setQuestionnaireDraft(savedDraft);
    setEntryMode("consejo");
    setAdvancedMode(restoredAdvancedMode);
    setAnswers(restoredAnswers);
    setMultiSelected([]);
    setResult(null);
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    resetListingDiscovery();
    setStep(nextStep);

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, [resetListingDiscovery]);

  const saveCurrentComparison = (selectedOffer = null) => {
    if (!result) {
      return;
    }

    const snapshot = buildComparisonSnapshot({
      result,
      answers,
      listingResult: selectedOffer || listingResult,
      listingFilters,
    });
    const next = [snapshot, ...savedComparisons.filter((item) => item.id !== snapshot.id)].slice(0, 6);
    writeSavedComparisons(next);
    setSavedComparisons(next);
    setSaveFeedback(
      selectedOffer
        ? "Recomendación guardada en Recomendaciones guardadas."
        : "Comparativa guardada en este navegador."
    );
    window.setTimeout(() => setSaveFeedback(""), 2200);
  };

  const isRecommendationSaved = (selectedOffer = null) => {
    if (!result) {
      return false;
    }

    const targetId = buildSavedComparisonKey({
      result,
      listingResult: selectedOffer || listingResult,
    });

    return savedComparisons.some((item) => item.id === targetId);
  };

  const toggleSavedRecommendation = (selectedOffer = null) => {
    if (!result) {
      return;
    }

    const snapshot = buildComparisonSnapshot({
      result,
      answers,
      listingResult: selectedOffer || listingResult,
      listingFilters,
    });
    const alreadySaved = savedComparisons.some((item) => item.id === snapshot.id);

    if (alreadySaved) {
      const next = savedComparisons.filter((item) => item.id !== snapshot.id);
      writeSavedComparisons(next);
      setSavedComparisons(next);
      setSaveFeedback("Recomendación quitada de guardadas.");
      window.setTimeout(() => setSaveFeedback(""), 2200);
      return;
    }

    saveCurrentComparison(selectedOffer);
  };

  const removeSavedComparison = (id) => {
    const next = savedComparisons.filter((item) => item.id !== id);
    writeSavedComparisons(next);
    setSavedComparisons(next);
  };

  const openAuthDialog = useCallback((mode = "login", options = {}) => {
    setAuthDialogMode(mode === "register" ? "register" : "login");
    setAuthRecoveryMode("none");
    setAuthRecoveryCode("");
    setAuthRecoveryFeedback("");
    setAuthTargetPage(options?.routePage || "home");
    setAuthError("");
    setShowAuthMenu(false);
    setShowUserPanel(false);
    setAuthForm((prev) => ({
      name: mode === "register" ? prev.name : "",
      email: currentUserEmail || prev.email || "",
      password: "",
    }));
  }, [currentUserEmail]);

  const closeAuthDialog = useCallback(() => {
    setAuthDialogMode("");
    setAuthRecoveryMode("none");
    setAuthRecoveryCode("");
    setAuthRecoveryFeedback("");
    setAuthError("");
    setAuthLoading(false);
    setAuthForm((prev) => ({
      name: "",
      email: currentUserEmail || prev.email || "",
      password: "",
    }));
  }, [currentUserEmail]);

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
    setShowChangePasswordForm(false);
    setChangePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setChangePasswordError("");
    setChangePasswordSuccess("");
    setChangePasswordLoading(false);
    setAuthForm({ name: "", email: "", password: "" });
  }, []);

  const submitChangePassword = useCallback(async (event) => {
    event?.preventDefault?.();

    const currentPassword = String(changePasswordForm.currentPassword || "");
    const newPassword = String(changePasswordForm.newPassword || "");
    const confirmPassword = String(changePasswordForm.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordError("Completa los tres campos de contraseña.");
      return;
    }

    if (newPassword.length < 6) {
      setChangePasswordError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    if (newPassword === currentPassword) {
      setChangePasswordError("La nueva contraseña no puede ser igual a la actual.");
      return;
    }

    setChangePasswordLoading(true);
    setChangePasswordError("");
    setChangePasswordSuccess("");

    try {
      const { data } = await postAuthJson({
        action: "change_password",
        currentPassword,
        newPassword,
      });

      if (data?.user?.email) {
        writeAuthUser(data.user);
        setCurrentUser(data.user);
      }

      setChangePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowChangePasswordForm(false);
      setChangePasswordSuccess(data?.message || "Contraseña actualizada correctamente.");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setChangePasswordSuccess(""), 2600);
      }
    } catch (error) {
      setChangePasswordError(error?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setChangePasswordLoading(false);
    }
  }, [changePasswordForm]);

  const submitAuthForm = useCallback(async (event) => {
    event?.preventDefault?.();

    if (authRecoveryMode === "request") {
      const recoveryEmail = normalizeText(authForm.email).toLowerCase();

      if (!recoveryEmail) {
        setAuthError("Indica el correo de tu cuenta para recuperar contraseña.");
        return;
      }

      setAuthLoading(true);
      setAuthError("");
      setAuthRecoveryFeedback("");

      try {
        const { data } = await postAuthJson({
          action: "request_password_reset",
          email: recoveryEmail,
        });

        setAuthRecoveryMode("confirm");
        setAuthRecoveryFeedback(data?.message || "Revisa tu correo y escribe el código de recuperación.");
      } catch (error) {
        setAuthError(error?.message || "No se pudo solicitar la recuperación de contraseña.");
      } finally {
        setAuthLoading(false);
      }

      return;
    }

    if (authRecoveryMode === "confirm") {
      const recoveryEmail = normalizeText(authForm.email).toLowerCase();
      const recoveryCode = normalizeText(authRecoveryCode).toUpperCase();
      const newPassword = String(authForm.password || "");

      if (!recoveryEmail || !recoveryCode || !newPassword) {
        setAuthError("Completa correo, código y nueva contraseña.");
        return;
      }

      setAuthLoading(true);
      setAuthError("");
      setAuthRecoveryFeedback("");

      try {
        const { data } = await postAuthJson({
          action: "reset_password",
          email: recoveryEmail,
          resetCode: recoveryCode,
          newPassword,
        });
        const nextUser = data?.user;

        if (!nextUser?.email) {
          throw new Error("No se pudo completar el cambio de contraseña.");
        }

        writeAuthUser(nextUser);
        setCurrentUser(nextUser);
        setIsUserLoggedIn(true);
        setEntryMode("userDashboard");
        setStep(-1);
        setUserDashboardPage(authTargetPage || "home");
        setShowAuthMenu(false);
        setShowUserPanel(false);
        setSaveFeedback(data?.message || "Contraseña actualizada y sesión iniciada.");
        syncBrowserPath(getUserDashboardPath(authTargetPage || "home"), "replace");
        setAuthDialogMode("");
        setAuthRecoveryMode("none");
        setAuthRecoveryCode("");
        setAuthForm({ name: "", email: nextUser.email, password: "" });

        if (typeof window !== "undefined") {
          window.setTimeout(() => setSaveFeedback(""), 2200);
          window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
        }
      } catch (error) {
        setAuthError(error?.message || "No se pudo restablecer la contraseña.");
      } finally {
        setAuthLoading(false);
      }

      return;
    }

    const mode = authDialogMode === "register" ? "register" : "login";
    const payload = {
      action: mode,
      name: normalizeText(authForm.name),
      email: normalizeText(authForm.email).toLowerCase(),
      password: String(authForm.password || ""),
    };

    if (mode === "register" && !payload.name) {
      setAuthError("Indica tu nombre para crear la cuenta.");
      return;
    }

    if (!payload.email) {
      setAuthError("Indica tu correo electrónico.");
      return;
    }

    if (!payload.password) {
      setAuthError("Indica tu contraseña.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const { response, data } = await postAuthJson(payload);

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.details || data?.error || "No se pudo completar el acceso.");
      }

      const nextUser = data?.user;

      if (!nextUser?.email) {
        throw new Error(data?.details || data?.error || "No se pudo recuperar el usuario autenticado.");
      }

      writeAuthUser(nextUser);
      setCurrentUser(nextUser);
      setIsUserLoggedIn(true);
      setEntryMode("userDashboard");
      setStep(-1);
      setUserDashboardPage(authTargetPage || "home");
      setShowAuthMenu(false);
      setShowUserPanel(false);
      setSaveFeedback(
        data?.message ||
          (mode === "register"
            ? `Cuenta creada para ${nextUser.email}.`
            : `Sesión iniciada para ${nextUser.email}.`)
      );
      syncBrowserPath(getUserDashboardPath(authTargetPage || "home"), "replace");
      setAuthDialogMode("");
      setAuthForm({ name: "", email: nextUser.email, password: "" });

      if (typeof window !== "undefined") {
        window.setTimeout(() => setSaveFeedback(""), 2200);
        window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
      }
    } catch (error) {
      setAuthError(error?.message || "No se pudo completar el acceso.");
    } finally {
      setAuthLoading(false);
    }
  }, [authDialogMode, authForm, authRecoveryCode, authRecoveryMode, authTargetPage, syncBrowserPath]);

  const createMarketAlert = (filters = {}) => {
    const notifyByEmail = Boolean(filters?.notifyByEmail);
    const resolvedAlertEmail = resolveAlertRecipientEmail(
      {
        notifyByEmail,
        email: filters?.email,
      },
      currentUserEmail
    );
    const normalizedAlert = {
      mode: normalizeText(filters?.mode) || "ambos",
      brand: normalizeText(filters?.brand),
      model: normalizeText(filters?.model),
      maxPrice: Number(filters?.maxPrice || 0) || null,
      maxMileage: Number(filters?.maxMileage || 0) || null,
      fuel: normalizeText(filters?.fuel),
      location: normalizeText(filters?.location),
      color: normalizeText(filters?.color),
      notifyByEmail,
      email: resolvedAlertEmail,
      ownerEmail: currentUserEmail,
    };

    if (normalizedAlert.notifyByEmail && !normalizedAlert.email) {
      return null;
    }

    const modeLabel =
      normalizedAlert.mode === "compra"
        ? "Compra"
        : normalizedAlert.mode === "renting"
        ? "Renting"
        : "Compra o renting";
    const titleParts = [modeLabel, normalizedAlert.brand, normalizedAlert.model].filter(Boolean);
    const alertId = [
      normalizedAlert.mode,
      normalizedAlert.brand,
      normalizedAlert.model,
      normalizedAlert.maxPrice,
      normalizedAlert.maxMileage,
      normalizedAlert.fuel,
      normalizedAlert.location,
      normalizedAlert.color,
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase();

    const alert = {
      id: alertId ? `alert:${alertId}` : `alert:${Date.now()}`,
      ...normalizedAlert,
      modeLabel,
      title: titleParts.length > 0 ? `Alerta ${titleParts.join(" · ")}` : "Alerta general de mercado",
      status: "Vigilando mercado",
      createdAt: new Date().toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const next = [alert, ...marketAlerts.filter((item) => item.id !== alert.id)].slice(0, 20);
    writeMarketAlerts(next);
    setMarketAlerts(next);
    return alert;
  };

  const removeMarketAlert = (id) => {
    const next = marketAlerts.filter((item) => item.id !== id);
    const nextStatus = { ...marketAlertStatus };
    delete nextStatus[id];
    writeMarketAlerts(next);
    writeMarketAlertStatus(nextStatus);
    setMarketAlerts(next);
    setMarketAlertStatus(nextStatus);
  };

  const markMarketAlertSeen = useCallback((id, count = 0) => {
    if (!id) {
      return;
    }

    setMarketAlertStatus((prev) => {
      const nextStatus = {
        ...prev,
        [id]: {
          seenCount: Number(count || 0),
          updatedAt: new Date().toISOString(),
        },
      };

      writeMarketAlertStatus(nextStatus);
      return nextStatus;
    });
  }, []);

  const markAllMarketAlertsSeen = useCallback(() => {
    setMarketAlertStatus((prev) => {
      const nextStatus = { ...prev };

      marketAlerts.forEach((alert) => {
        const matchCount = Number(marketAlertMatches?.[alert.id]?.count || 0);

        if (matchCount > 0) {
          nextStatus[alert.id] = {
            ...nextStatus[alert.id],
            seenCount: matchCount,
            updatedAt: new Date().toISOString(),
          };
        }
      });

      writeMarketAlertStatus(nextStatus);
      return nextStatus;
    });
  }, [marketAlertMatches, marketAlerts]);

  const sendAlertEmailDigest = useCallback(async () => {
    const configuredEmailTargets = Array.from(
      new Set(
        marketAlerts
          .map((alert) => resolveAlertRecipientEmail(alert, currentUserEmail))
          .filter(Boolean)
      )
    );
    const digestNotifications = pendingAlertNotifications.filter(
      (notice) => notice.notifyByEmail && notice.email
    );
    const fallbackNotifications = marketAlerts
      .map((alert) => {
        const alertEmail = resolveAlertRecipientEmail(alert, currentUserEmail);
        const matchInfo = marketAlertMatches?.[alert.id] || { count: 0, matches: [] };

        if (!alert.notifyByEmail || !alertEmail || Number(matchInfo.count || 0) <= 0) {
          return null;
        }

        return {
          id: alert.id,
          title: alert.title,
          newMatchesCount: Number(matchInfo.count || 0),
          summary: `${matchInfo.count} ${matchInfo.count === 1 ? "coincidencia actual" : "coincidencias actuales"} en el marketplace`,
          matches: Array.isArray(matchInfo.matches) ? matchInfo.matches.slice(0, 2) : [],
          notifyByEmail: true,
          email: alertEmail,
        };
      })
      .filter(Boolean);
    const notificationsToSend = digestNotifications.length > 0 ? digestNotifications : fallbackNotifications;
    const emailTargets = Array.from(
      new Set(
        notificationsToSend.map((notice) => notice.email)
      )
    );

    if (configuredEmailTargets.length === 0) {
      setEmailDigestFeedback("No hay un correo configurado todavía para estas alertas.");
      window.setTimeout(() => setEmailDigestFeedback(""), 2200);
      return;
    }

    if (emailTargets.length === 0) {
      setEmailDigestFeedback("No hay coincidencias para enviar por email en este momento.");
      window.setTimeout(() => setEmailDigestFeedback(""), 2200);
      return;
    }

    setEmailDigestLoading(true);

    try {
      const { data } = await postAlertEmailDigestJson({
        to: emailTargets,
        subject:
          emailTargets.length === 1
            ? "MoveAdvisor · Tu resumen de alertas"
            : `MoveAdvisor · ${emailTargets.length} resúmenes de alertas`,
        notifications: notificationsToSend,
      });

      setMarketAlertStatus((prev) => {
        const now = new Date().toISOString();
        const nextStatus = { ...prev };

        notificationsToSend.forEach((notice) => {
          if (!notice.notifyByEmail || !notice.email) {
            return;
          }

          const matchCount = Number(marketAlertMatches?.[notice.id]?.count || 0);
          nextStatus[notice.id] = {
            ...nextStatus[notice.id],
            seenCount: matchCount,
            updatedAt: now,
            lastEmailSentAt: now,
            lastEmail: notice.email,
            lastEmailProvider: data?.provider || "console",
          };
        });

        writeMarketAlertStatus(nextStatus);
        return nextStatus;
      });

      setEmailDigestFeedback(
        data?.message ||
          (emailTargets.length === 1
            ? `Resumen enviado a ${emailTargets[0]}.`
            : `Resumen enviado a ${emailTargets.length} destinatarios.`)
      );
    } catch (error) {
      setEmailDigestFeedback(error?.message || "No se pudo enviar el resumen por email.");
    } finally {
      setEmailDigestLoading(false);
      window.setTimeout(() => setEmailDigestFeedback(""), 2600);
    }
  }, [currentUserEmail, marketAlertMatches, marketAlerts, pendingAlertNotifications]);

  const browseMarketplaceForAlert = useCallback((alert = {}) => {
    const queryParts = [alert?.brand, alert?.model, alert?.fuel].filter(Boolean);

    setPortalVoFilters({
      ...INITIAL_PORTAL_VO_FILTERS,
      query: normalizeText(queryParts.join(" ")),
      maxPrice: alert?.maxPrice ? String(alert.maxPrice) : "",
      maxMileage: alert?.maxMileage ? String(alert.maxMileage) : "",
      location: normalizeText(alert?.location),
      color: normalizeText(alert?.color),
    });
    setSelectedPortalVoOfferId(null);
    setShowAuthMenu(false);
    setShowUserPanel(false);
    setEntryMode("portalVo");
    setStep(-1);

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, []);

  const getSavedComparisonHref = useCallback(
    (item) =>
      normalizeText(item?.targetUrl) ||
      getOfferFallbackSearchUrl(
        {
          title: item?.listingTitle || item?.title,
          source: item?.sourceLabel || "Mercado general",
          listingType: item?.typeKey || "movilidad",
        },
        { solucion_principal: { tipo: item?.typeKey || "movilidad", titulo: item?.title || "" } }
      ),
    []
  );

  const handleSingle = (value) => {
    const newAnswers = { ...answers, [currentStep.id]: value };
    setAnswers(newAnswers);
    setTimeout(() => {
      if (step < totalSteps - 1) setStep(step + 1);
      else analyzeWithAI(buildActiveAnswers(newAnswers, activeSteps));
    }, 280);
  };

  const handleMultiToggle = (value) => {
    setMultiSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleMultiNext = () => {
    const newAnswers = { ...answers, [currentStep.id]: multiSelected };
    setAnswers(newAnswers);
    setMultiSelected([]);
    if (step < totalSteps - 1) setStep(step + 1);
    else analyzeWithAI(buildActiveAnswers(newAnswers, activeSteps));
  };

  const goToPreviousStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const toggleAdvancedMode = () => {
    setAdvancedMode((prev) => {
      const next = !prev;

      if (!next && step >= STEPS.length) {
        setStep(STEPS.length - 1);
      }

      return next;
    });
  };

  const requestUserAppointment = (type) => {
    const appointmentCatalog = {
      workshop: {
        title: "Cita de taller",
        meta: "Diagnóstico, revisión o reparación del vehículo",
        status: "Solicitud enviada",
      },
      maintenance: {
        title: "Cita de mantenimiento",
        meta: "Mantenimiento preventivo y revisión de servicio",
        status: "Pendiente de confirmación",
      },
      certification: {
        title: "Garantía / certificación de calidad",
        meta: "Revisión para garantía extendida o certificación de calidad",
        status: "En validación",
      },
    };

    const template = appointmentCatalog[type];
    if (!template) {
      return;
    }

    const appointment = {
      id: `${type}-${Date.now()}`,
      ...template,
      requestedAt: new Date().toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const next = [appointment, ...userAppointments].slice(0, 8);
    writeUserAppointments(next);
    setUserAppointments(next);
    setSaveFeedback(`${template.title} solicitada correctamente.`);
    window.setTimeout(() => setSaveFeedback(""), 2200);
  };

  const openSellValuationFromOffers = () => {
    const hasTradeInVehicle = normalizeText(answers?.vehiculo_actual);

    setEntryMode("sell");
    setStep(-1);
    setSellAnswers((prev) => ({
      ...prev,
      sellerType: hasTradeInVehicle === "si_entrego" ? "entrega" : "particular",
    }));

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
    }
  };

  const handleTellMeNow = () => {
    if (answeredSteps === 0) {
      return;
    }

    if (answeredSteps < totalSteps) {
      const proceed = window.confirm(
        "Todavia no has completado todo el formulario. Podemos darte una recomendacion util ahora, pero sera una estimacion menos precisa que si respondes todas las preguntas. ¿Quieres continuar de todos modos?"
      );

      if (!proceed) {
        return;
      }
    }

    const draftAnswers =
      currentStep?.type === "multi"
        ? { ...answers, [currentStep.id]: multiSelected }
        : { ...answers };

    analyzeWithAI(buildActiveAnswers(draftAnswers, activeSteps));
  };

  const searchRealListing = useCallback(async (nextFilters = null, nextQuickValidation = null, options = {}) => {
    if (!result) {
      return;
    }

    const { forceRefresh = false } = options || {};
    const filtersToUse = nextFilters || {
      company: "",
      budget: inferListingBudgetFromAnswers(answers),
      income: "",
    };
    const validationToUse = nextQuickValidation || quickValidationRef.current || {};
    const currentListings = Array.isArray(listingOptionsRef.current) ? listingOptionsRef.current : [];
    const seenUrls = Array.isArray(listingSeenRef.current?.urls) ? listingSeenRef.current.urls : [];
    const seenTitles = Array.isArray(listingSeenRef.current?.titles) ? listingSeenRef.current.titles : [];
    const currentUrls = currentListings.map((item) => normalizeText(item?.url)).filter(Boolean);
    const currentTitles = currentListings.map((item) => normalizeText(item?.title)).filter(Boolean);
    const excludedUrls = Array.from(new Set([
      ...(forceRefresh ? seenUrls : seenUrls.slice(-12)),
      ...currentUrls,
    ])).slice(-24);
    const excludedTitles = Array.from(new Set([
      ...(forceRefresh ? seenTitles : seenTitles.slice(-16)),
      ...currentTitles,
    ])).slice(-32);
    const previousTopUrl = normalizeText(currentListings[0]?.url);

    setListingLoading(true);
    setListingError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);

    try {
      const { response, data } = await postListingJson({
        result,
        answers: {
          ...answers,
          validacion_rapida: validationToUse,
        },
        filters: {
          ...filtersToUse,
          excludeUrls: excludedUrls,
          excludeTitles: excludedTitles,
          refreshNonce: forceRefresh ? Date.now() : 0,
        },
      }, {
        headers: {
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo encontrar un anuncio real ahora mismo.");
      }

      const rankedListings = Array.isArray(data.listings)
        ? data.listings
        : [data.listing, ...(Array.isArray(data.alternatives) ? data.alternatives : [])].filter(Boolean);
      const previousTopIndex = forceRefresh && previousTopUrl
        ? rankedListings.findIndex((item) => normalizeText(item?.url) === previousTopUrl)
        : -1;
      const visibleListings = forceRefresh && previousTopIndex !== -1 && rankedListings.length > 1
        ? [
            ...rankedListings.slice(previousTopIndex + 1),
            ...rankedListings.slice(0, previousTopIndex + 1),
          ]
        : rankedListings;

      setListingResult(visibleListings[0] || data.listing || null);
      setListingOptions(visibleListings);
      setListingSearchCoverage(data?.searchCoverage || null);
    } catch (err) {
      if (err?.name === "AbortError") {
        setListingError(null);
      } else {
        setListingError(err.message || "No se pudo encontrar un anuncio real ahora mismo.");
      }
    } finally {
      clearTimeout(timeoutId);
      setListingLoading(false);
    }
  }, [answers, result]);

  useEffect(() => {
    if (!result) {
      return;
    }

    const initialFilters = {
      company: "",
      budget: inferListingBudgetFromAnswers(answers),
      income: "",
    };

    setListingFilters(initialFilters);
    setListingResult(null);
    setListingOptions([]);
    setListingError(null);
    setListingLoading(false);
    setQuickValidationAnswers({});

    window.setTimeout(() => {
      void searchRealListing(initialFilters);
    }, 120);
  }, [result, answers, searchRealListing]);

  useEffect(() => {
    if (!result || Object.keys(quickValidationAnswers).length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchRealListing(listingFilters, quickValidationAnswers);
    }, 160);

    return () => window.clearTimeout(timeoutId);
  }, [quickValidationAnswers, result, listingFilters, searchRealListing]);

  const searchDecisionListing = async (aiResult = decisionAiResult) => {
    if (!decisionFlowReady || !aiResult?.oferta_top?.titulo) {
      return;
    }

    setDecisionListingLoading(true);
    setDecisionListingError(null);
    setDecisionListingResult(null);

    try {
      const listing = await fetchDecisionListing({
        aiResult,
        decisionFlowReady,
        decisionAnswers,
      });

      setDecisionListingResult(listing);
    } catch (err) {
      setDecisionListingError(err.message || "No se pudo localizar un anuncio real para esta operación.");
    } finally {
      setDecisionListingLoading(false);
    }
  };

  const searchSellComparableListing = async () => {
    if (!(sellAnswers.brand && sellAnswers.model)) {
      return;
    }

    setSellListingLoading(true);
    setSellListingError(null);
    setSellListingResult(null);

    try {
      const listing = await fetchSellComparableListing({ sellAnswers });
      setSellListingResult(listing);
    } catch (err) {
      setSellListingError(err.message || "No se pudo localizar un anuncio comparable ahora mismo.");
    } finally {
      setSellListingLoading(false);
    }
  };

  const analyzeDecisionWithAI = async () => {
    if (!decisionFlowReady) {
      return;
    }

    setDecisionLoading(true);
    setDecisionError(null);
    setApiKeyMissing(false);

    try {
      const prompt = buildDecisionAnalysisPrompt({
        decisionAnswers,
        labels: {
          monthlyBudget: getOptionLabel(MONTHLY_BUDGET_OPTIONS, decisionAnswers.monthlyBudget),
          cashBudget: getOptionLabel(TOTAL_PURCHASE_OPTIONS, decisionAnswers.cashBudget),
          financeAmount: getOptionLabel(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount),
          entryAmount: getOptionLabel(ENTRY_AMOUNT_OPTIONS, decisionAnswers.entryAmount),
          ageFilter: getOptionLabel(AGE_FILTER_OPTIONS, decisionAnswers.ageFilter),
          mileageFilter: getOptionLabel(MILEAGE_FILTER_OPTIONS, decisionAnswers.mileageFilter),
        },
      });

      const raw = await requestAiJson(
        prompt,
        { decisionAnswers },
        { onApiKeyMissing: () => setApiKeyMissing(true) }
      );
      const normalized = normalizeDecisionAiResult(raw);

      if (!isCompleteDecisionAiResult(normalized)) {
        throw new Error("La IA no ha devuelto un analisis suficiente para esta operacion.");
      }

      setDecisionAiResult(normalized);
      await searchDecisionListing(normalized);
    } catch (err) {
      if (err?.code === "API_KEY_MISSING") {
        return;
      }

      setDecisionError(err.message || "No se pudo analizar esta operacion con IA.");
    } finally {
      setDecisionLoading(false);
    }
  };

  const analyzeSellWithAI = async () => {
    if (!(sellAnswers.brand && sellAnswers.model && sellAnswers.year && sellAnswers.mileage)) {
      return;
    }

    setSellLoading(true);
    setSellError(null);
    setApiKeyMissing(false);

    try {
      const prompt = buildSellAnalysisPrompt({ sellAnswers });

      const raw = await requestAiJson(
        prompt,
        { sellAnswers },
        { onApiKeyMissing: () => setApiKeyMissing(true) }
      );
      const normalized = normalizeSellAiResult(raw);

      if (!isCompleteSellAiResult(normalized)) {
        throw new Error("La IA no ha devuelto una valoracion suficiente para este coche.");
      }

      setSellAiResult(normalized);
      await searchSellComparableListing();
    } catch (err) {
      if (err?.code === "API_KEY_MISSING") {
        return;
      }

      setSellError(err.message || "No se pudo valorar este coche con IA.");
    } finally {
      setSellLoading(false);
    }
  };

  const analyzeWithAI = async (finalAnswers) => {
    setStep(99);
    setLoading(true);
    setError(null);
    setApiKeyMissing(false);
    resetListingDiscovery();

    let phaseIndex = 0;
    setLoadingPhase(0);
    const phaseInterval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % ANALYSIS_LOADING_PHASES.length;
      setLoadingPhase(phaseIndex);
    }, 1800);

    try {
      const answersSummary = buildAnswersSummary(finalAnswers, activeSteps);
      const prompt = buildAdviceAnalysisPrompt({ answersSummary });

      const raw = await requestAiJson(
        prompt,
        { answers: finalAnswers },
        { onApiKeyMissing: () => setApiKeyMissing(true) }
      );
      clearInterval(phaseInterval);

      const normalizedResult = normalizeAdvisorResult(raw);

      if (!isCompleteAdvisorResult(normalizedResult)) {
        throw new Error("La IA ha devuelto un analisis incompleto. Intentalo de nuevo.");
      }

      clearQuestionnaireDraft();
      setQuestionnaireDraft(null);
      setResultView("analysis");
      setResult(normalizedResult);
      setLoading(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      clearInterval(phaseInterval);

      if (err?.code === "API_KEY_MISSING") {
        setLoading(false);
        return;
      }

      setError(`Error: ${err.message}`);
      setLoading(false);
      setStep(totalSteps - 1);
    }
  };

  const {
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
  } = useAdvisorController({
    clearQuestionnaireDraftFn: () => {
      clearQuestionnaireDraft();
      setQuestionnaireDraft(null);
    },
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
    onAuthRequest: openAuthDialog,
    onLogoutUser: resetLoggedUser,
  });

  const decisionModels = decisionAnswers.brand ? marketBrandsCatalog[decisionAnswers.brand] || [] : [];
  const estimatedFinanceMonthly = estimateMonthlyPayment(
    getOptionAmount(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount)
  );
  const estimatedMixedMonthly = estimateMonthlyPayment(
    getOptionAmount(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount)
  );
  const needsMonthlyBudget = decisionAnswers.operation === "renting";
  const needsCashBudget = decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "contado";
  const needsFinanceAmount =
    decisionAnswers.operation === "comprar" &&
    (decisionAnswers.acquisition === "financiado" || decisionAnswers.acquisition === "mixto");
  const needsEntryAmount = decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "mixto";
  const decisionFlowReady =
    decisionAnswers.operation &&
    decisionAnswers.acquisition &&
    decisionAnswers.hasBrand &&
    (!needsMonthlyBudget || decisionAnswers.monthlyBudget) &&
    (!needsCashBudget || decisionAnswers.cashBudget) &&
    (!needsFinanceAmount || decisionAnswers.financeAmount) &&
    (!needsEntryAmount || decisionAnswers.entryAmount) &&
    (decisionAnswers.hasBrand === "no" || (decisionAnswers.brand && decisionAnswers.model));
  const rankedOffers =
    decisionFlowReady && decisionAnswers.hasBrand === "si"
      ? buildOfferRanking({
          brand: decisionAnswers.brand,
          model: decisionAnswers.model,
          acquisition: decisionAnswers.acquisition,
          condition: decisionAnswers.condition || "seminuevo",
          ageFilter: decisionAnswers.ageFilter,
          mileageFilter: decisionAnswers.mileageFilter,
        })
      : [];
  const sellModels = sellAnswers.brand ? marketBrandsCatalog[sellAnswers.brand] || [] : [];
  const sellEstimate =
    sellAnswers.brand && sellAnswers.model && sellAnswers.year && sellAnswers.mileage
      ? buildSellEstimate(sellAnswers)
      : null;
  const {
    portalVoLocations,
    portalVoColors,
    filteredPortalVoOffers,
    featuredPortalVoOffers,
    selectedPortalVoOffer,
    relatedPortalVoOffers,
  } = useMemo(
    () =>
      buildPortalVoMarketplaceModel({
        offers: PORTAL_VO_OFFERS,
        filters: portalVoFilters,
        selectedOfferId: selectedPortalVoOfferId,
      }),
    [portalVoFilters, selectedPortalVoOfferId]
  );

  const progress =
    step >= 0 && step < totalSteps
      ? ((step + 1) / totalSteps) * 100
      : step === 99 || result || apiKeyMissing
      ? 100
      : 0;

  const loadingTexts = ANALYSIS_LOADING_PHASES;

  const draftAnswers =
    entryMode === "consejo" && currentStep?.type === "multi"
      ? { ...answers, [currentStep.id]: multiSelected }
      : answers;
  const visibleDraftAnswers = buildActiveAnswers(draftAnswers, activeSteps);
  const answeredSteps = countAnsweredSteps(visibleDraftAnswers, activeSteps);
  const remainingQuestions = Math.max(totalSteps - answeredSteps, 0);
  const completionPct = Math.min(100, Math.round((answeredSteps / totalSteps) * 100));

  // ─── STYLES ───────────────────────────────
  const s = useMemo(() => createAppStyles(progress), [progress]);

  // ─── RENDER ───────────────────────────────
  return (
    <div style={s.page}>
      {/* HEADER */}
      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "linear-gradient(135deg,#2563EB,#059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            🚗
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>MoveAdvisor</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.8px" }}>
              SPAIN MOBILITY PLATFORM
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          {step >= 0 && step < totalSteps && (
            <div style={{ fontSize: 12, color: "#475569" }}>
              {step + 1} / {totalSteps}
            </div>
          )}
          {step >= 0 && (
            <button
              onClick={restart}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#94a3b8",
                padding: "5px 13px",
                borderRadius: 7,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ← Volver al home
            </button>
          )}

          <button
            type="button"
            onClick={handleUserAccessClick}
            title={isUserLoggedIn ? "Abrir mi panel" : "Acceder o registrarse"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: isUserLoggedIn ? "rgba(16,185,129,0.12)" : "rgba(14,165,233,0.08)",
              border: isUserLoggedIn
                ? "1px solid rgba(110,231,183,0.26)"
                : "1px solid rgba(125,211,252,0.24)",
              color: "#e0f2fe",
              padding: "7px 12px",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: isUserLoggedIn ? "rgba(16,185,129,0.2)" : "rgba(37,99,235,0.22)",
                fontSize: 13,
              }}
            >
              👤
            </span>
            <span>{isUserLoggedIn ? "Mi panel" : "Acceder"}</span>
          </button>

          {showAuthMenu && !isUserLoggedIn && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                minWidth: 220,
                background: "rgba(8,15,30,0.96)",
                border: "1px solid rgba(125,211,252,0.18)",
                borderRadius: 14,
                boxShadow: "0 18px 40px rgba(2,6,23,0.42)",
                padding: 12,
                zIndex: 120,
              }}
            >
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                Área de usuario
              </div>
              <button
                type="button"
                onClick={() => handleAuthAction("login")}
                style={{
                  width: "100%",
                  background: "rgba(37,99,235,0.14)",
                  border: "1px solid rgba(96,165,250,0.24)",
                  color: "#dbeafe",
                  padding: "9px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => handleAuthAction("register")}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  border: "none",
                  color: "white",
                  padding: "9px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Registrarse
              </button>
            </div>
          )}

          {showUserPanel && isUserLoggedIn && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: "min(380px, calc(100vw - 36px))",
                background: "rgba(8,15,30,0.98)",
                border: "1px solid rgba(110,231,183,0.18)",
                borderRadius: 16,
                boxShadow: "0 18px 40px rgba(2,6,23,0.42)",
                padding: 14,
                zIndex: 120,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6ee7b7", letterSpacing: "0.4px" }}>
                    PANEL DE USUARIO
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>
                    Mi espacio MoveAdvisor
                  </div>
                  {currentUser?.email && (
                    <div style={{ fontSize: 11, color: "#bfdbfe", marginTop: 4 }}>
                      {currentUser.name || "Usuario"} · {currentUser.email}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={openUserDashboard}
                    style={{
                      background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: 9,
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Ver detalle →
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#cbd5e1",
                      borderRadius: 9,
                      padding: "6px 9px",
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Seguridad de cuenta</div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangePasswordForm((prev) => !prev);
                        setChangePasswordError("");
                        setChangePasswordSuccess("");
                      }}
                      style={{
                        background: "rgba(14,165,233,0.1)",
                        border: "1px solid rgba(125,211,252,0.18)",
                        color: "#bae6fd",
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {showChangePasswordForm ? "Cancelar" : "Cambiar contraseña"}
                    </button>
                  </div>

                  {changePasswordSuccess && (
                    <div style={{ fontSize: 11, color: "#86efac", fontWeight: 700, marginBottom: 8 }}>
                      {changePasswordSuccess}
                    </div>
                  )}

                  {showChangePasswordForm ? (
                    <form onSubmit={submitChangePassword} style={{ display: "grid", gap: 8 }}>
                      <input
                        type="password"
                        value={changePasswordForm.currentPassword}
                        onChange={(event) => setChangePasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                        placeholder="Contraseña actual"
                        style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 11px", fontSize: 12 }}
                      />
                      <input
                        type="password"
                        value={changePasswordForm.newPassword}
                        onChange={(event) => setChangePasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                        placeholder="Nueva contraseña (mínimo 6 caracteres)"
                        style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 11px", fontSize: 12 }}
                      />
                      <input
                        type="password"
                        value={changePasswordForm.confirmPassword}
                        onChange={(event) => setChangePasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                        placeholder="Confirmar nueva contraseña"
                        style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 11px", fontSize: 12 }}
                      />

                      {changePasswordError && (
                        <div style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700 }}>
                          {changePasswordError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={changePasswordLoading}
                        style={{
                          justifySelf: "start",
                          background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
                          border: "none",
                          color: "#ffffff",
                          borderRadius: 9,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: changePasswordLoading ? "progress" : "pointer",
                          opacity: changePasswordLoading ? 0.78 : 1,
                        }}
                      >
                        {changePasswordLoading ? "Guardando..." : "Guardar contraseña"}
                      </button>
                    </form>
                  ) : (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Puedes actualizar tu contraseña sin cerrar sesión.
                    </div>
                  )}
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Mis recomendaciones guardadas</div>
                    <span style={{ fontSize: 11, color: "#93c5fd" }}>{dashboardSavedComparisons.length}</span>
                  </div>
                  {dashboardSavedComparisons.length > 0 ? (
                    dashboardSavedComparisons.map((item) => {
                      const savedOfferHref =
                        normalizeText(item?.targetUrl) ||
                        getOfferFallbackSearchUrl(
                          {
                            title: item?.listingTitle || item?.title,
                            source: item?.sourceLabel || "Mercado general",
                            listingType: item?.typeKey || "movilidad",
                          },
                          { solucion_principal: { tipo: item?.typeKey || "movilidad", titulo: item?.title || "" } }
                        );

                      return (
                      <div
                        key={item.id}
                        onClick={() => savedOfferHref && openOfferInNewTab(savedOfferHref)}
                        title={savedOfferHref ? "Abrir oferta guardada" : undefined}
                        style={{
                          padding: "8px 0",
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          cursor: savedOfferHref ? "pointer" : "default",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{item.title}</div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeSavedComparison(item.id);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#fda4af",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                          {item.typeLabel} · {item.savedAt}
                        </div>
                        <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>
                          {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/mes` : item.budgetLabel || "Sin cuota definida"}
                        </div>
                        {(item.sourceLabel || item.listingPrice) && (
                          <div style={{ fontSize: 11, color: "#bfdbfe", marginTop: 2 }}>
                            {item.sourceLabel || "Oferta guardada"}
                            {item.listingPrice ? ` · ${item.listingPrice}` : ""}
                          </div>
                        )}
                        {savedOfferHref && (
                          <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 4, fontWeight: 700 }}>
                            Abrir oferta ↗
                          </div>
                        )}
                      </div>
                    );})
                  ) : (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Cuando guardes una comparativa aparecerá aquí automáticamente.
                    </div>
                  )}
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Citas</div>
                    <span style={{ fontSize: 11, color: "#fbbf24" }}>{dashboardAppointments.length}</span>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {[
                      { key: "workshop", label: "🛠️ Taller" },
                      { key: "maintenance", label: "🔧 Mantenimiento" },
                      { key: "certification", label: "✅ Garantía / calidad" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => requestUserAppointment(option.key)}
                        style={{
                          background: "rgba(245,158,11,0.12)",
                          border: "1px solid rgba(251,191,36,0.22)",
                          color: "#fde68a",
                          padding: "6px 9px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {dashboardAppointments.length > 0 ? (
                    dashboardAppointments.map((item) => (
                      <div key={item.id} style={{ paddingTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{item.meta}</div>
                        <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 2 }}>
                          {item.status}
                          {item.requestedAt ? ` · ${item.requestedAt}` : ""}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Aún no tienes citas programadas. Cuando reserves una, se verá aquí.
                    </div>
                  )}
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Mis tasaciones</div>
                    <span style={{ fontSize: 11, color: "#c084fc" }}>{dashboardValuations.length}</span>
                  </div>
                  {dashboardValuations.length > 0 ? (
                    dashboardValuations.map((item) => (
                      <div key={item.id} style={{ paddingTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{item.meta}</div>
                        <div style={{ fontSize: 11, color: "#c084fc", marginTop: 2 }}>{item.status}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Cuando hagas una tasación de tu coche, la verás aquí guardada.
                    </div>
                  )}
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 8 }}>
                    Mis vehículos
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {userVehicleSections.map((section) => (
                      <div
                        key={section.key}
                        style={{
                          background: "rgba(15,23,42,0.7)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: 10,
                          padding: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#dbeafe" }}>{section.title}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{section.items.length}</span>
                        </div>
                        {section.items.length > 0 ? (
                          section.items.map((vehicle, index) => (
                            <div key={`${section.key}-${index}`} style={{ fontSize: 11, color: "#cbd5e1", marginTop: 6 }}>
                              <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{vehicle.title}</div>
                              <div style={{ marginTop: 2 }}>{vehicle.meta}</div>
                              <div style={{ marginTop: 2, color: "#6ee7b7" }}>{vehicle.status}</div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{section.empty}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {authDialogMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={authDialogMode === "register" ? "Crear tu cuenta" : "Iniciar sesión"}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 160,
          }}
        >
          <div
            style={{
              width: "min(460px, 100%)",
              background: "rgba(8,15,30,0.98)",
              border: "1px solid rgba(96,165,250,0.18)",
              borderRadius: 18,
              boxShadow: "0 24px 60px rgba(2,6,23,0.42)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: authDialogMode === "register" ? "#6ee7b7" : "#93c5fd", letterSpacing: "0.6px" }}>
                  {authRecoveryMode === "request"
                    ? "RECUPERACIÓN"
                    : authRecoveryMode === "confirm"
                    ? "RESETEO"
                    : authDialogMode === "register"
                    ? "REGISTRO"
                    : "ACCESO"}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>
                  {authRecoveryMode === "request"
                    ? "Recuperar contraseña"
                    : authRecoveryMode === "confirm"
                    ? "Introduce tu código"
                    : authDialogMode === "register"
                    ? "Crear tu cuenta"
                    : "Iniciar sesión"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  {authRecoveryMode === "none"
                    ? "Tu email de acceso será el destinatario por defecto de los avisos y resúmenes."
                    : "Te enviaremos un código temporal para actualizar la contraseña de forma segura."}
                </div>
              </div>
              <button
                type="button"
                onClick={closeAuthDialog}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={submitAuthForm} style={{ display: "grid", gap: 12 }}>
              {authDialogMode === "register" && authRecoveryMode === "none" && (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                  Nombre
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Tu nombre"
                    style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px" }}
                  />
                </label>
              )}

              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                Correo electrónico
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="nombre@correo.com"
                  style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                {authRecoveryMode === "confirm" ? "Nueva contraseña" : "Contraseña"}
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder={authRecoveryMode === "confirm" ? "Nueva contraseña (mínimo 6 caracteres)" : "Mínimo 6 caracteres"}
                  style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px" }}
                />
              </label>

              {authRecoveryMode === "confirm" && (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                  Código de recuperación
                  <input
                    type="text"
                    value={authRecoveryCode}
                    onChange={(event) => setAuthRecoveryCode(event.target.value)}
                    placeholder="Ejemplo: A1B2C3D4"
                    style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px" }}
                  />
                </label>
              )}

              {authRecoveryFeedback && (
                <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>
                  {authRecoveryFeedback}
                </div>
              )}

              {authError && (
                <div style={{ fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>
                  {authError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (authRecoveryMode !== "none") {
                      setAuthRecoveryMode("none");
                      setAuthRecoveryCode("");
                      setAuthRecoveryFeedback("");
                      setAuthError("");
                      return;
                    }

                    setAuthDialogMode((prev) => (prev === "register" ? "login" : "register"));
                  }}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#cbd5e1",
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {authRecoveryMode !== "none"
                    ? "Volver al acceso"
                    : authDialogMode === "register"
                    ? "Ya tengo cuenta"
                    : "Crear cuenta nueva"}
                </button>
                {authDialogMode === "login" && authRecoveryMode === "none" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthRecoveryMode("request");
                      setAuthRecoveryCode("");
                      setAuthRecoveryFeedback("");
                      setAuthError("");
                    }}
                    style={{
                      background: "rgba(14,165,233,0.08)",
                      border: "1px solid rgba(125,211,252,0.18)",
                      color: "#bae6fd",
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    He olvidado mi contraseña
                  </button>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    background:
                      authRecoveryMode !== "none"
                        ? "linear-gradient(135deg,#0ea5e9,#0284c7)"
                        : authDialogMode === "register"
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : "linear-gradient(135deg,#2563eb,#1d4ed8)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor: authLoading ? "progress" : "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                    opacity: authLoading ? 0.78 : 1,
                  }}
                >
                  {authLoading
                    ? "Procesando…"
                    : authRecoveryMode === "request"
                    ? "Enviar código"
                    : authRecoveryMode === "confirm"
                    ? "Actualizar contraseña"
                    : authDialogMode === "register"
                    ? "Crear cuenta"
                    : "Entrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROGRESS */}
      <div style={s.progressBar}>
        <div style={s.progressFill} />
      </div>

      {/* ── LANDING ── */}
      {step === -1 && !entryMode && (
        <LandingPage
          styles={s}
          totalSteps={totalSteps}
          blockColors={BLOCK_COLORS}
          questionnaireDraft={questionnaireDraft}
          onSelectAdvice={() => {
            setEntryMode("consejo");
            setStep(-1);
          }}
          onResumeAdvice={resumeQuestionnaireDraft}
          onSelectDecision={() => {
            setEntryMode("decision");
            setStep(-1);
          }}
          onSelectSell={() => {
            setEntryMode("sell");
            setStep(-1);
          }}
          onSelectPortalVo={() => {
            setEntryMode("portalVo");
            setStep(-1);
            setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
          }}
        />
      )}

      {step === -1 && entryMode === "userDashboard" && isUserLoggedIn && (
        <UserDashboardPage
          centerStyle={s.center}
          blockBadgeStyle={s.blockBadge("Vinculación")}
          panelStyle={s.panel}
          userDashboardPage={userDashboardPage}
          savedComparisons={savedComparisons}
          marketAlerts={marketAlerts}
          marketAlertStatus={marketAlertStatus}
          marketAlertMatches={marketAlertMatches}
          currentUser={currentUser}
          newAlertMatchesCount={newAlertMatchesCount}
          pendingAlertNotifications={pendingAlertNotifications}
          emailDigestFeedback={emailDigestFeedback}
          emailDigestLoading={emailDigestLoading}
          dashboardAppointments={dashboardAppointments}
          dashboardValuations={dashboardValuations}
          userVehicleSections={userVehicleSections}
          onNavigate={navigateToUserDashboardPage}
          onRestart={() => {
            restart();
            if (typeof window !== "undefined") {
              setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
          onLogout={handleLogout}
          onRequestAppointment={requestUserAppointment}
          onOpenOffer={openOfferInNewTab}
          onRemoveSavedComparison={removeSavedComparison}
          onCreateMarketAlert={createMarketAlert}
          onRemoveMarketAlert={removeMarketAlert}
          onMarkAlertSeen={markMarketAlertSeen}
          onMarkAllAlertsSeen={markAllMarketAlertsSeen}
          onSendAlertEmailDigest={sendAlertEmailDigest}
          onBrowseMarketplace={browseMarketplaceForAlert}
          getOfferBadgeStyle={getOfferBadgeStyle}
          formatCurrency={formatCurrency}
          getSavedComparisonHref={getSavedComparisonHref}
        />
      )}

      {step === -1 && entryMode === "consejo" && (
        <AdviceIntroPage
          styles={s}
          pillars={ADVISOR_PILLARS}
          onStart={() => setStep(0)}
          onRestart={restart}
        />
      )}

      {step === -1 && entryMode === "decision" && (
        <DecisionPage
          styles={s}
          decisionAnswers={decisionAnswers}
          updateDecisionAnswer={updateDecisionAnswer}
          MARKET_BRANDS={marketBrandsCatalog}
          decisionModels={decisionModels}
          needsMonthlyBudget={needsMonthlyBudget}
          needsCashBudget={needsCashBudget}
          needsFinanceAmount={needsFinanceAmount}
          needsEntryAmount={needsEntryAmount}
          MONTHLY_BUDGET_OPTIONS={MONTHLY_BUDGET_OPTIONS}
          TOTAL_PURCHASE_OPTIONS={TOTAL_PURCHASE_OPTIONS}
          FINANCE_AMOUNT_OPTIONS={FINANCE_AMOUNT_OPTIONS}
          ENTRY_AMOUNT_OPTIONS={ENTRY_AMOUNT_OPTIONS}
          AGE_FILTER_OPTIONS={AGE_FILTER_OPTIONS}
          MILEAGE_FILTER_OPTIONS={MILEAGE_FILTER_OPTIONS}
          estimatedFinanceMonthly={estimatedFinanceMonthly}
          estimatedMixedMonthly={estimatedMixedMonthly}
          decisionFlowReady={decisionFlowReady}
          analyzeDecisionWithAI={analyzeDecisionWithAI}
          decisionLoading={decisionLoading}
          decisionError={decisionError}
          decisionAiResult={decisionAiResult}
          searchDecisionListing={searchDecisionListing}
          decisionListingLoading={decisionListingLoading}
          decisionListingError={decisionListingError}
          decisionListingResult={decisionListingResult}
          rankedOffers={rankedOffers}
          formatCurrency={formatCurrency}
          onSwitchToAdvice={() => {
            setEntryMode("consejo");
            setStep(0);
          }}
          onRestart={restart}
        />
      )}

      {step === -1 && entryMode === "portalVoDetail" && selectedPortalVoOffer && (
        <PortalVoDetailPage
          styles={s}
          selectedPortalVoOffer={selectedPortalVoOffer}
          relatedPortalVoOffers={relatedPortalVoOffers}
          ResolvedOfferImage={ResolvedOfferImage}
          getOfferBadgeStyle={getOfferBadgeStyle}
          getPortalVoEcoLabel={getPortalVoEcoLabel}
          getPortalVoTransmission={getPortalVoTransmission}
          buildPortalVoHighlights={buildPortalVoHighlights}
          buildPortalVoEquipment={buildPortalVoEquipment}
          formatCurrency={formatCurrency}
          onBackToMarketplace={() => {
            setEntryMode("portalVo");
            if (typeof window !== "undefined") {
              setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
          onGoHome={() => {
            restart();
            if (typeof window !== "undefined") {
              setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
          onOpenRelatedOffer={openPortalVoOfferDetail}
        />
      )}

      {step === -1 && entryMode === "portalVo" && (
        <PortalVoMarketplacePage
          styles={s}
          portalVoFilters={portalVoFilters}
          updatePortalVoFilter={updatePortalVoFilter}
          portalVoLocations={portalVoLocations}
          portalVoColors={portalVoColors}
          onResetFilters={() => setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS })}
          featuredPortalVoOffers={featuredPortalVoOffers}
          filteredPortalVoOffers={filteredPortalVoOffers}
          ResolvedOfferImage={ResolvedOfferImage}
          getOfferBadgeStyle={getOfferBadgeStyle}
          formatCurrency={formatCurrency}
          onOpenOffer={openPortalVoOfferDetail}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "sell" && (
        <SellPage
          styles={s}
          sellAnswers={sellAnswers}
          setSellAnswers={setSellAnswers}
          MARKET_BRANDS={marketBrandsCatalog}
          sellModels={sellModels}
          SELL_FUEL_OPTIONS={SELL_FUEL_OPTIONS}
          analyzeSellWithAI={analyzeSellWithAI}
          sellLoading={sellLoading}
          sellError={sellError}
          sellAiResult={sellAiResult}
          sellEstimate={sellEstimate}
          searchSellComparableListing={searchSellComparableListing}
          sellListingLoading={sellListingLoading}
          sellListingError={sellListingError}
          sellListingResult={sellListingResult}
          formatCurrency={formatCurrency}
          onRestart={restart}
        />
      )}

      {/* ── QUESTIONS ── */}
      {entryMode === "consejo" && step >= 0 && step < totalSteps && currentStep && (
        <QuestionnairePage
          styles={s}
          currentStep={currentStep}
          step={step}
          totalSteps={totalSteps}
          advancedMode={advancedMode}
          toggleAdvancedMode={toggleAdvancedMode}
          remainingQuestions={remainingQuestions}
          completionPct={completionPct}
          multiSelected={multiSelected}
          answers={answers}
          BRAND_LOGOS={BRAND_LOGOS}
          onHandleMultiToggle={handleMultiToggle}
          onHandleSingle={handleSingle}
          onHandleMultiNext={handleMultiNext}
          onGoPrevious={goToPreviousStep}
          onRestartQuestionnaire={restartQuestionnaire}
          onTellMeNow={handleTellMeNow}
          answeredSteps={answeredSteps}
        />
      )}

      {/* ── LOADING ── */}
      {step === 99 && loading && (
        <LoadingAnalysisPage
          styles={s}
          loadingTexts={loadingTexts}
          loadingPhase={loadingPhase}
        />
      )}

      {/* ── API KEY MISSING ── */}
      {apiKeyMissing && (
        <ApiKeyMissingPage
          styles={s}
          totalSteps={totalSteps}
          answers={answers}
          steps={STEPS}
          onRestart={restart}
        />
      )}

      {/* -- RESULT -- */}
      {result && (
        <AdviceResultsPage
          result={result}
          resultRef={resultRef}
          styles={s}
          resultView={resultView}
          answers={answers}
          listingResult={listingResult}
          listingFilters={listingFilters}
          listingOptions={listingOptions}
          listingSearchCoverage={listingSearchCoverage}
          listingLoading={listingLoading}
          listingError={listingError}
          quickValidationAnswers={quickValidationAnswers}
          savedComparisons={savedComparisons}
          saveFeedback={saveFeedback}
          MOBILITY_TYPES={MOBILITY_TYPES}
          MONTHLY_BUDGET_OPTIONS={MONTHLY_BUDGET_OPTIONS}
          INCOME_STABILITY_OPTIONS={INCOME_STABILITY_OPTIONS}
          sanitizeResultForDisplay={sanitizeResultForDisplay}
          getQuickValidationQuestions={getQuickValidationQuestions}
          normalizeText={normalizeText}
          buildMarketRadarSnapshot={buildMarketRadarSnapshot}
          buildOfferModelSuggestions={buildOfferModelSuggestions}
          normalizeStringArray={normalizeStringArray}
          resolveOfferProviderName={resolveOfferProviderName}
          getOfferFallbackSearchUrl={getOfferFallbackSearchUrl}
          getOfferNavigationUrl={getOfferNavigationUrl}
          normalizeOfferAssetUrl={normalizeOfferAssetUrl}
          hasOfferRealImage={hasOfferRealImage}
          isRecommendationSaved={isRecommendationSaved}
          buildSearchCoverageSummary={buildSearchCoverageSummary}
          formatCurrency={formatCurrency}
          showOffersPage={showOffersPage}
          showAnalysisPage={showAnalysisPage}
          openSellValuationFromOffers={openSellValuationFromOffers}
          updateQuickValidationAnswer={updateQuickValidationAnswer}
          updateListingFilter={updateListingFilter}
          searchRealListing={searchRealListing}
          getOfferTrustBadges={getOfferTrustBadges}
          getOfferBadgeStyle={getOfferBadgeStyle}
          ResolvedOfferImage={ResolvedOfferImage}
          toggleSavedRecommendation={toggleSavedRecommendation}
          openOfferInNewTab={openOfferInNewTab}
          saveCurrentComparison={saveCurrentComparison}
          removeSavedComparison={removeSavedComparison}
        />
      )}

      {/* ── ERROR ── */}
      {error && <ErrorStatePage error={error} onRetry={() => analyzeWithAI(answers)} />}

      {/* GLOBAL STYLES */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(37,99,235,0.3); }
          50% { box-shadow: 0 0 60px rgba(37,99,235,0.55); }
        }
        @keyframes portalGlowGreen {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(34,197,94,0.12), 0 10px 28px rgba(22,163,74,0.14);
            border-color: rgba(74,222,128,0.5);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(74,222,128,0.28), 0 0 22px rgba(74,222,128,0.24), 0 12px 34px rgba(22,163,74,0.2);
            border-color: rgba(134,239,172,0.95);
          }
        }
        @keyframes portalShine {
          0% { transform: translateX(-130%); opacity: 0; }
          15% { opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translateX(130%); opacity: 0; }
        }
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        select {
          font-family: inherit;
          color-scheme: dark;
        }
        select option {
          background: #0f1b2d;
          color: #f8fafc;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
