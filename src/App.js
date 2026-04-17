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
import VehicleOptionsPage from "./pages/VehicleOptionsPage";
import BuyOptionsPage from "./pages/BuyOptionsPage";
import RentingOptionsPage from "./pages/RentingOptionsPage";
import SellOptionsPage from "./pages/SellOptionsPage";
import ServiceOptionsPage from "./pages/ServiceOptionsPage";
import ServiceInsurancePage from "./pages/ServiceInsurancePage";
import ServiceMaintenancePage from "./pages/ServiceMaintenancePage";
import ServiceAutogestorPage from "./pages/ServiceAutogestorPage";
import LegalPolicyPage from "./pages/LegalPolicyPage";
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
import {
  getAuthSessionJson,
  getUserMobilityDataJson,
  getVehicleCatalogJson,
  postAlertEmailDigestJson,
  postAppointmentAddJson,
  postAuthJson,
  postBillingCheckoutJson,
  postListingJson,
  postSavedOfferAddJson,
  postSavedOfferRemoveJson,
} from "./utils/apiClient";
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
  readCookieConsent,
  readMarketAlerts,
  readMarketAlertStatus,
  readQuestionnaireDraft,
  readSavedComparisons,
  readUserAppointments,
  writeAuthUser,
  writeCookieConsent,
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

function hasAnsweredValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(Boolean);
  }

  return Boolean(value);
}

function normalizeRangeValue(value) {
  if (Array.isArray(value)) {
    const cleaned = value.filter(Boolean);
    return cleaned;
  }

  return value ? [value] : [];
}

function hasCompleteScoreWeights(value, metrics = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) || metrics.length === 0) {
    return false;
  }

  const ranks = metrics
    .map((metric) => Number(value?.[metric?.key]))
    .filter((rank) => Number.isInteger(rank) && rank >= 1 && rank <= metrics.length);

  return ranks.length === metrics.length && new Set(ranks).size === metrics.length;
}

function countAnsweredSteps(answers, steps = STEPS) {
  return steps.reduce((acc, stepConfig) => {
    if (stepConfig?.type === "score_weights") {
      return acc + (hasCompleteScoreWeights(answers?.[stepConfig.id], stepConfig.metrics || []) ? 1 : 0);
    }

    if (Array.isArray(stepConfig?.compositeKeys) && stepConfig.compositeKeys.length > 0) {
      const allAnswered = stepConfig.compositeKeys.every((key) => hasAnsweredValue(answers?.[key]));
      return acc + (allAnswered ? 1 : 0);
    }

    const value = answers?.[stepConfig.id];

    return acc + (hasAnsweredValue(value) ? 1 : 0);
  }, 0);
}

function buildActiveAnswers(allAnswers, steps = STEPS) {
  return steps.reduce((acc, stepConfig) => {
    if (Array.isArray(stepConfig?.compositeKeys) && stepConfig.compositeKeys.length > 0) {
      stepConfig.compositeKeys.forEach((key) => {
        const compositeValue = allAnswers?.[key];
        if (Array.isArray(compositeValue)) {
          if (compositeValue.length > 0) {
            acc[key] = compositeValue;
          }
          return;
        }
        if (compositeValue) {
          acc[key] = compositeValue;
        }
      });
      return acc;
    }

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

function isAdvisorResultCompatibleWithContext(resultData, advisorContext) {
  const topType = normalizeText(resultData?.solucion_principal?.tipo);

  if (advisorContext === "renting") {
    return ["renting_largo", "renting_corto", "rent_a_car", "carsharing"].includes(topType);
  }

  if (advisorContext === "buy") {
    return ["compra_contado", "compra_financiada"].includes(topType);
  }

  return true;
}

function resolveAlertRecipientEmail(alert = {}, fallbackEmail = "") {
  const directEmail = normalizeText(alert?.email).toLowerCase();
  const fallback = normalizeText(fallbackEmail).toLowerCase();

  if (!alert?.notifyByEmail) {
    return "";
  }

  return directEmail || fallback;
}

const LEGAL_DOCUMENTS = {
  legalNotice: {
    title: "Aviso legal",
    summary:
      "Información general de titularidad, alcance del servicio, propiedad intelectual y responsabilidades del uso de la plataforma.",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "Datos identificativos",
        paragraphs: [
          "CarAdvisor es una plataforma digital orientada al asesoramiento y operativa de movilidad en España.",
          "A efectos de contacto general, soporte y gestión de incidencias puedes dirigirte a soporte@caradvisor.es.",
        ],
      },
      {
        heading: "Objeto del sitio web",
        paragraphs: [
          "El presente sitio facilita herramientas de recomendación, comparación y gestión de servicios de movilidad, así como funcionalidades de apoyo para usuarios registrados.",
          "La información mostrada tiene carácter informativo y de apoyo a la decisión, sin constituir asesoramiento financiero, jurídico o fiscal vinculante.",
        ],
      },
      {
        heading: "Uso permitido y prohibiciones",
        bullets: [
          "El usuario se compromete a utilizar la plataforma conforme a la ley, la buena fe y el orden público.",
          "Queda prohibido el uso fraudulento, la extracción automatizada no autorizada de datos y cualquier intento de alterar el funcionamiento del servicio.",
          "CarAdvisor puede actualizar, mejorar o retirar funcionalidades para mantener seguridad, rendimiento y calidad de servicio.",
        ],
      },
      {
        heading: "Propiedad intelectual",
        paragraphs: [
          "La marca CarAdvisor, el diseño de la plataforma, su arquitectura funcional, contenidos, código y elementos gráficos son titularidad de sus propietarios o licenciantes.",
          "No se autoriza su reproducción, distribución o transformación sin autorización expresa salvo en los casos legalmente permitidos.",
        ],
      },
      {
        heading: "Responsabilidad",
        paragraphs: [
          "CarAdvisor no garantiza la disponibilidad permanente e ininterrumpida del servicio, aunque aplica medidas razonables para mantener su continuidad.",
          "Las decisiones finales de contratación o compra/venta corresponden al usuario y, en su caso, al tercero proveedor con quien formalice la operación.",
        ],
      },
    ],
  },
  privacyPolicy: {
    title: "Política de privacidad",
    summary:
      "Información sobre tratamiento de datos personales conforme al RGPD (UE 2016/679) y la LOPDGDD (Ley Orgánica 3/2018).",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "Categorías de datos tratados",
        bullets: [
          "Datos identificativos y de cuenta: nombre, correo electrónico, identificadores de usuario y sesión.",
          "Datos de uso y navegación: interacciones con el asesor, preferencias, filtros, actividad y eventos funcionales.",
          "Datos operativos aportados voluntariamente: solicitudes de servicio, alertas, datos de contacto y datos asociados a trámites dentro de la plataforma.",
        ],
      },
      {
        heading: "Finalidades del tratamiento",
        bullets: [
          "Gestionar el alta, autenticación y mantenimiento de cuentas de usuario.",
          "Prestar funcionalidades de recomendación, comparación y gestión de movilidad.",
          "Mantener la seguridad, prevenir abusos y optimizar el rendimiento del servicio.",
          "Enviar comunicaciones operativas imprescindibles para la prestación del servicio.",
        ],
      },
      {
        heading: "Bases jurídicas",
        bullets: [
          "Ejecución de la relación contractual o precontractual cuando el usuario solicita funcionalidades del servicio.",
          "Cumplimiento de obligaciones legales aplicables.",
          "Interés legítimo en seguridad, continuidad del servicio y mejora de la plataforma.",
          "Consentimiento cuando resulte exigible para determinadas finalidades (por ejemplo, determinadas cookies o comunicaciones).",
        ],
      },
      {
        heading: "Conservación de datos",
        paragraphs: [
          "Los datos se conservan durante el tiempo necesario para cumplir la finalidad para la que fueron recabados y, posteriormente, durante los plazos legalmente exigibles.",
          "Cuando proceda, los datos serán bloqueados y tratados exclusivamente para atender posibles responsabilidades legales.",
        ],
      },
      {
        heading: "Destinatarios y transferencias",
        paragraphs: [
          "Con carácter general no se ceden datos a terceros salvo obligación legal o cuando sea necesario para la prestación de servicios tecnológicos vinculados a la plataforma.",
          "En caso de proveedores fuera del Espacio Económico Europeo, se aplicarán garantías adecuadas conforme al RGPD.",
        ],
      },
      {
        heading: "Derechos de las personas usuarias",
        paragraphs: [
          "Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad escribiendo a soporte@caradvisor.es.",
          "Si consideras que tus derechos no han sido atendidos correctamente, puedes presentar reclamación ante la Agencia Española de Protección de Datos (AEPD).",
        ],
      },
    ],
  },
  cookiePolicy: {
    title: "Política de cookies",
    summary:
      "Información sobre el uso de cookies y tecnologías similares, su finalidad y cómo gestionar el consentimiento.",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "Qué son las cookies",
        paragraphs: [
          "Las cookies son ficheros que se almacenan en el dispositivo del usuario y permiten reconocer su navegación, recordar preferencias y mejorar la experiencia.",
        ],
      },
      {
        heading: "Tipos de cookies utilizadas",
        bullets: [
          "Cookies técnicas o necesarias: esenciales para el acceso, autenticación y funcionamiento base del servicio.",
          "Cookies de preferencias: conservan configuraciones y elecciones del usuario para personalizar la experiencia.",
          "Cookies analíticas: permiten evaluar el uso del servicio y mejorar funcionalidades.",
        ],
      },
      {
        heading: "Base legal y consentimiento",
        paragraphs: [
          "Las cookies necesarias se utilizan para asegurar el funcionamiento de la plataforma. El resto se gestionan conforme al consentimiento del usuario cuando sea exigible.",
          "Al primer acceso se solicita aceptación para habilitar la experiencia completa y registrar la preferencia de consentimiento.",
        ],
      },
      {
        heading: "Cómo revocar o modificar el consentimiento",
        paragraphs: [
          "Puedes modificar la configuración de cookies desde los ajustes del navegador y, en su caso, desde los mecanismos que habilite la plataforma.",
          "La desactivación de determinadas cookies puede afectar a la disponibilidad de algunas funcionalidades.",
        ],
      },
    ],
  },
  termsConditions: {
    title: "Términos y condiciones",
    summary:
      "Condiciones generales de uso del servicio, obligaciones de las partes y límites de responsabilidad.",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "Aceptación de términos",
        paragraphs: [
          "El acceso y uso de CarAdvisor implica la aceptación de estos términos y condiciones.",
          "Si no estás de acuerdo con los términos, debes abstenerte de utilizar la plataforma.",
        ],
      },
      {
        heading: "Alcance y naturaleza del servicio",
        paragraphs: [
          "CarAdvisor proporciona recomendaciones y herramientas de apoyo para decisiones de movilidad, compra, venta y servicios asociados.",
          "La plataforma no sustituye la revisión contractual o técnica que el usuario deba realizar antes de cerrar operaciones con terceros.",
        ],
      },
      {
        heading: "Cuenta de usuario y seguridad",
        bullets: [
          "El usuario es responsable de custodiar sus credenciales y de la actividad realizada en su cuenta.",
          "Debe notificarse cualquier uso no autorizado o incidencia de seguridad en cuanto se detecte.",
        ],
      },
      {
        heading: "Obligaciones de uso",
        bullets: [
          "Utilizar el servicio de forma lícita, diligente y conforme a los presentes términos.",
          "No manipular, interferir ni realizar acciones que comprometan seguridad, estabilidad o integridad del sistema.",
          "No emplear el servicio para fines ilícitos o contrarios a derechos de terceros.",
        ],
      },
      {
        heading: "Limitación de responsabilidad",
        paragraphs: [
          "CarAdvisor no garantiza resultados económicos concretos ni asume responsabilidad por decisiones finales adoptadas por el usuario.",
          "Las relaciones contractuales con terceros proveedores son responsabilidad directa de las partes intervinientes.",
        ],
      },
      {
        heading: "Modificaciones y vigencia",
        paragraphs: [
          "CarAdvisor puede actualizar estos términos para adaptarlos a cambios normativos, técnicos o de servicio.",
          "La versión vigente estará siempre disponible en el apartado legal de la plataforma.",
        ],
      },
    ],
  },
};

// ------------------------------------------------------------
// APP
// ------------------------------------------------------------

const THEME_STORAGE_KEY = "movilidad-advisor.themeMode.v1";

export default function App() {
  const [entryMode, setEntryMode] = useState(null);
  const [advisorContext, setAdvisorContext] = useState(null); // null | "buy" | "renting"
  const [sellFlowType, setSellFlowType] = useState(""); // "certificate" | "report" | ""
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState({});
  const [multiSelected, setMultiSelected] = useState([]);
  const [dualTimelineSelection, setDualTimelineSelection] = useState({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
  const [scoreWeightsSelection, setScoreWeightsSelection] = useState({});
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
  const [decisionMarketListings, setDecisionMarketListings] = useState([]);
  const [decisionMarketLoading, setDecisionMarketLoading] = useState(false);
  const [decisionMarketError, setDecisionMarketError] = useState(null);
  const [decisionMarketInsight, setDecisionMarketInsight] = useState(null);
  const [decisionMarketRefreshNonce, setDecisionMarketRefreshNonce] = useState(0);
  const [decisionMarketExcludeUrls, setDecisionMarketExcludeUrls] = useState([]);
  const [decisionMarketExcludeTitles, setDecisionMarketExcludeTitles] = useState([]);
  const [sellAiResult, setSellAiResult] = useState(null);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState(null);
  const [sellListingResult, setSellListingResult] = useState(null);
  const [sellListingLoading, setSellListingLoading] = useState(false);
  const [sellListingError, setSellListingError] = useState(null);
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [userAppointments, setUserAppointments] = useState([]);
  const [userMaintenances, setUserMaintenances] = useState([]);
  const [userInsurances, setUserInsurances] = useState([]);
  const [userValuations, setUserValuations] = useState([]);
  const [userVehicleStates, setUserVehicleStates] = useState([]);
  const [marketAlerts, setMarketAlerts] = useState([]);
  const [marketAlertStatus, setMarketAlertStatus] = useState({});
  const [marketBrandsCatalog, setMarketBrandsCatalog] = useState({});
  const [questionnaireDraft, setQuestionnaireDraft] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [emailDigestFeedback, setEmailDigestFeedback] = useState("");
  const [emailDigestLoading, setEmailDigestLoading] = useState(false);
  const [planCheckoutLoadingId, setPlanCheckoutLoadingId] = useState("");
  const [planCheckoutFeedback, setPlanCheckoutFeedback] = useState("");
  const [pendingPlanCheckoutId, setPendingPlanCheckoutId] = useState("");
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authDialogMode, setAuthDialogMode] = useState("");
  const [authRecoveryMode, setAuthRecoveryMode] = useState("none");
  const [authRecoveryCode, setAuthRecoveryCode] = useState("");
  const [authRecoveryFeedback, setAuthRecoveryFeedback] = useState("");
  const [authTargetPage, setAuthTargetPage] = useState("home");
  const [authTargetEntryMode, setAuthTargetEntryMode] = useState("");
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
  const [showCookieGate, setShowCookieGate] = useState(false);
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [themeMode, setThemeMode] = useState("light");
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true,
    analytics: true,
    personalization: true,
    marketing: false,
  });
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

  const openLegalDocument = useCallback((docKey = "legalNotice") => {
    if (!LEGAL_DOCUMENTS[docKey]) {
      return;
    }

    setEntryMode(docKey);
    setStep(-1);

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, []);

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
  }, [cookiePreferences]);

  const activeSteps = useMemo(() => {
    const steps = getQuestionnaireSteps(advancedMode);
    if (advisorContext === "renting") {
      // Skip the flexibilidad question: renting is already pre-selected
      return steps.filter((s) => s.id !== "flexibilidad");
    }
    if (advisorContext === "buy") {
      // Show only comprar options in the flexibilidad question
      return steps.map((s) =>
        s.id === "flexibilidad"
          ? {
              ...s,
              options: s.options.filter(
                (o) => o.value === "propiedad_contado" || o.value === "propiedad_financiada" || o.value === "propiedad_entrada_inicial"
              ),
            }
          : s
      );
    }
    return steps;
  }, [advancedMode, advisorContext]);

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
        // Catalog remains empty if endpoint is unavailable.
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
        userMaintenances,
        userInsurances,
        userValuations,
        userVehicleStates,
        result,
        sellAiResult,
        sellAnswers,
        sellListingResult,
      }),
      [
        savedComparisons,
        userAppointments,
        userMaintenances,
        userInsurances,
        userValuations,
        userVehicleStates,
        result,
        sellAiResult,
        sellAnswers,
        sellListingResult,
      ]
  );

  useEffect(() => {
    const savedAuthUser = readAuthUser();
    const persistedTheme = typeof window !== "undefined" ? window.localStorage.getItem(THEME_STORAGE_KEY) : "";
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
  }, []);

  useEffect(() => {
    let disposed = false;

    if (!currentUserEmail) {
      setUserValuations([]);
      setUserVehicleStates([]);
      setUserMaintenances([]);
      setUserInsurances([]);
      return () => {
        disposed = true;
      };
    }

    void (async () => {
      try {
        const { response, data } = await getUserMobilityDataJson(currentUserEmail);

        if (!response.ok || disposed) {
          return;
        }

        const nextSaved = Array.isArray(data?.savedOffers) ? data.savedOffers.slice(0, 6) : [];
        const nextAppointments = Array.isArray(data?.appointments) ? data.appointments.slice(0, 8) : [];
        const nextMaintenances = Array.isArray(data?.maintenances) ? data.maintenances.slice(0, 12) : [];
        const nextInsurances = Array.isArray(data?.insurances) ? data.insurances.slice(0, 8) : [];
        const nextValuations = Array.isArray(data?.valuations) ? data.valuations.slice(0, 12) : [];
        const nextVehicleStates = Array.isArray(data?.vehicleStates) ? data.vehicleStates.slice(0, 30) : [];

        setSavedComparisons(nextSaved);
        setUserAppointments(nextAppointments);
        setUserMaintenances(nextMaintenances);
        setUserInsurances(nextInsurances);
        setUserValuations(nextValuations);
        setUserVehicleStates(nextVehicleStates);

        writeSavedComparisons(nextSaved);
        writeUserAppointments(nextAppointments);
      } catch {
        // Keep local fallback if mobility API is unavailable.
      }
    })();

    return () => {
      disposed = true;
    };
  }, [currentUserEmail]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode === "dark" ? "dark" : "light");
  }, [themeMode]);

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
  }, [isUserLoggedIn]);

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
      setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
      setScoreWeightsSelection({});
      return;
    }

    const stepConfig = activeSteps[step];
    if (stepConfig.type === "multi") {
      const saved = answers[stepConfig.id];
      setMultiSelected(Array.isArray(saved) ? saved : []);
      setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
      setScoreWeightsSelection({});
      return;
    }

    if (stepConfig.type === "dual_timeline") {
      setDualTimelineSelection({
        horizonte_tenencia: normalizeRangeValue(answers?.horizonte_tenencia),
        antiguedad_vehiculo_buscada: normalizeRangeValue(answers?.antiguedad_vehiculo_buscada),
      });
      setMultiSelected([]);
      setScoreWeightsSelection({});
      return;
    }

    if (stepConfig.type === "score_weights") {
      const saved = answers?.[stepConfig.id];
      setScoreWeightsSelection(saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {});
      setMultiSelected([]);
      setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
      return;
    }

    setMultiSelected([]);
    setDualTimelineSelection({ horizonte_tenencia: [], antiguedad_vehiculo_buscada: [] });
    setScoreWeightsSelection({});
  }, [entryMode, step, totalSteps, answers, activeSteps]);

  useEffect(() => {
    if (entryMode !== "consejo" || step < 0 || result || apiKeyMissing) {
      return;
    }

    const answersForDraft =
      currentStep?.type === "multi"
        ? { ...answers, [currentStep.id]: multiSelected }
        : currentStep?.type === "score_weights"
        ? { ...answers, [currentStep.id]: scoreWeightsSelection }
        : currentStep?.type === "dual_timeline"
        ? {
            ...answers,
            horizonte_tenencia: dualTimelineSelection.horizonte_tenencia,
            antiguedad_vehiculo_buscada: dualTimelineSelection.antiguedad_vehiculo_buscada,
          }
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
  }, [activeSteps, advancedMode, answers, apiKeyMissing, currentStep, dualTimelineSelection, entryMode, multiSelected, result, scoreWeightsSelection, step]);

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

    if (currentUserEmail) {
      void postSavedOfferAddJson(currentUserEmail, snapshot).catch(() => {});
    }

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

      if (currentUserEmail) {
        void postSavedOfferRemoveJson(currentUserEmail, snapshot.id).catch(() => {});
      }

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

    if (currentUserEmail) {
      void postSavedOfferRemoveJson(currentUserEmail, id).catch(() => {});
    }
  };

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
  }, [currentUserEmail]);

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
  }, [currentUserEmail]);

  const startSubscriptionCheckout = useCallback(async (planId, options = {}) => {
    const normalizedPlanId = normalizeText(planId).toLowerCase();
    const shouldSkipAuthGate = Boolean(options?.skipAuth);

    if (!normalizedPlanId) {
      return;
    }

    if (!shouldSkipAuthGate && !isUserLoggedIn) {
      setPendingPlanCheckoutId(normalizedPlanId);
      setPlanCheckoutFeedback("Inicia sesión para continuar con la suscripción.");
      openAuthDialog("login", { routePage: "home" });
      return;
    }

    setPlanCheckoutLoadingId(normalizedPlanId);
    setPlanCheckoutFeedback("");

    try {
      const { data } = await postBillingCheckoutJson({
        planId: normalizedPlanId,
        origin: typeof window !== "undefined" ? window.location.origin : "",
        customerEmail: normalizeText(options?.customerEmail || currentUserEmail).toLowerCase(),
      });

      if (normalizeText(data?.url)) {
        if (typeof window !== "undefined") {
          window.location.assign(data.url);
          return;
        }
      }

      setPlanCheckoutFeedback(
        normalizeText(data?.message) ||
          (data?.simulated
            ? "Checkout en modo simulado: falta configurar Stripe (claves/precios)."
            : "No se pudo abrir la pasarela de pago para este plan.")
      );

      setPendingPlanCheckoutId("");
    } catch (error) {
      setPlanCheckoutFeedback(error?.message || "No se pudo iniciar el checkout del plan seleccionado.");
    } finally {
      setPlanCheckoutLoadingId("");
    }
  }, [currentUserEmail, isUserLoggedIn, openAuthDialog]);

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
        const nextTargetEntryMode = normalizeText(authTargetEntryMode);

        if (!nextUser?.email) {
          throw new Error("No se pudo completar el cambio de contraseña.");
        }

        writeAuthUser(nextUser);
        setCurrentUser(nextUser);
        setIsUserLoggedIn(true);
        setStep(-1);
        if (nextTargetEntryMode) {
          setEntryMode(nextTargetEntryMode);
          syncBrowserPath("/", "replace");
        } else {
          setEntryMode("userDashboard");
          setUserDashboardPage(authTargetPage || "home");
          syncBrowserPath(getUserDashboardPath(authTargetPage || "home"), "replace");
        }
        setShowAuthMenu(false);
        setShowUserPanel(false);
        setSaveFeedback(data?.message || "Contraseña actualizada y sesión iniciada.");
        setAuthDialogMode("");
        setAuthRecoveryMode("none");
        setAuthRecoveryCode("");
        setAuthTargetEntryMode("");
        setAuthForm({ name: "", email: nextUser.email, password: "" });

        const nextPendingPlanId = normalizeText(pendingPlanCheckoutId).toLowerCase();

        if (nextPendingPlanId) {
          if (typeof window !== "undefined") {
            window.setTimeout(() => {
              void startSubscriptionCheckout(nextPendingPlanId, {
                skipAuth: true,
                customerEmail: nextUser.email,
              });
            }, 120);
          } else {
            void startSubscriptionCheckout(nextPendingPlanId, {
              skipAuth: true,
              customerEmail: nextUser.email,
            });
          }
        }

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
      const nextTargetEntryMode = normalizeText(authTargetEntryMode);

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
      setStep(-1);
      if (nextTargetEntryMode) {
        setEntryMode(nextTargetEntryMode);
        syncBrowserPath("/", "replace");
      } else {
        setEntryMode("userDashboard");
        setUserDashboardPage(authTargetPage || "home");
        syncBrowserPath(getUserDashboardPath(authTargetPage || "home"), "replace");
      }
      setShowAuthMenu(false);
      setShowUserPanel(false);
      setSaveFeedback(
        data?.message ||
          (mode === "register"
            ? `Cuenta creada para ${nextUser.email}.`
            : `Sesión iniciada para ${nextUser.email}.`)
      );
      setAuthDialogMode("");
          setAuthTargetEntryMode("");
      setAuthForm({ name: "", email: nextUser.email, password: "" });

      const nextPendingPlanId = normalizeText(pendingPlanCheckoutId).toLowerCase();

      if (nextPendingPlanId) {
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            void startSubscriptionCheckout(nextPendingPlanId, {
              skipAuth: true,
              customerEmail: nextUser.email,
            });
          }, 120);
        } else {
          void startSubscriptionCheckout(nextPendingPlanId, {
            skipAuth: true,
            customerEmail: nextUser.email,
          });
        }
      }

      if (typeof window !== "undefined") {
        window.setTimeout(() => setSaveFeedback(""), 2200);
        window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
      }
    } catch (error) {
      setAuthError(error?.message || "No se pudo completar el acceso.");
    } finally {
      setAuthLoading(false);
    }
  }, [
    authDialogMode,
    authForm,
    authRecoveryCode,
    authRecoveryMode,
    authTargetEntryMode,
    authTargetPage,
    pendingPlanCheckoutId,
    startSubscriptionCheckout,
    syncBrowserPath,
  ]);

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
            ? "CarAdvisor · Tu resumen de alertas"
            : `CarAdvisor · ${emailTargets.length} resúmenes de alertas`,
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
    syncBrowserPath("/", "replace");
    setEntryMode("portalVo");
    setStep(-1);

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, [syncBrowserPath]);

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

  const handleDualTimelineSelect = (field, value) => {
    setDualTimelineSelection((prev) => ({ ...prev, [field]: value }));
  };

  const handleScoreWeightSelect = (metricKey, rank, metrics = []) => {
    setScoreWeightsSelection((prev) => {
      const next = { ...prev };
      const numericRank = Number(rank);

      if (next?.[metricKey] === numericRank) {
        delete next[metricKey];
        return next;
      }

      metrics.forEach((metric) => {
        if (metric?.key !== metricKey && Number(next?.[metric?.key]) === numericRank) {
          delete next[metric.key];
        }
      });

      next[metricKey] = numericRank;
      return next;
    });
  };

  const handleScoreWeightsNext = () => {
    const metrics = currentStep?.metrics || [];
    if (!hasCompleteScoreWeights(scoreWeightsSelection, metrics)) {
      return;
    }

    const newAnswers = {
      ...answers,
      [currentStep.id]: scoreWeightsSelection,
    };

    setAnswers(newAnswers);
    if (step < totalSteps - 1) setStep(step + 1);
    else analyzeWithAI(buildActiveAnswers(newAnswers, activeSteps));
  };

  const handleDualTimelineNext = () => {
    if (!hasAnsweredValue(dualTimelineSelection.horizonte_tenencia) || !hasAnsweredValue(dualTimelineSelection.antiguedad_vehiculo_buscada)) {
      return;
    }

    const newAnswers = {
      ...answers,
      horizonte_tenencia: dualTimelineSelection.horizonte_tenencia,
      antiguedad_vehiculo_buscada: dualTimelineSelection.antiguedad_vehiculo_buscada,
    };

    setAnswers(newAnswers);
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

  const requestUserAppointment = async (type, context = {}) => {
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
      insurance: {
        title: "Gestión de seguro",
        meta: "Revisión de póliza, prima y vencimiento del seguro",
        status: "En gestión",
      },
    };

    const template = appointmentCatalog[type];
    if (!template) {
      return;
    }

    const appointment = {
      id: `${type}-${Date.now()}`,
      ...template,
      meta:
        context?.vehicleTitle || context?.vehiclePlate
          ? `${template.meta} · Vehículo: ${context.vehicleTitle || "Vehículo"}${context.vehiclePlate ? ` (${context.vehiclePlate})` : ""}`
          : template.meta,
      requestedAt: new Date().toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    let next = [appointment, ...userAppointments].slice(0, 8);

    if (currentUserEmail && normalizeText(context?.vehicleId)) {
      try {
        const { data } = await postAppointmentAddJson(currentUserEmail, {
          ...appointment,
          vehicleId: normalizeText(context?.vehicleId),
          vehicleTitle: normalizeText(context?.vehicleTitle),
          vehiclePlate: normalizeText(context?.vehiclePlate),
        });

        if (Array.isArray(data?.appointments)) {
          next = data.appointments.slice(0, 8);
        }
      } catch {
        // Fallback to local storage when API is unavailable.
      }
    }

    writeUserAppointments(next);
    setUserAppointments(next);

    if (type === "maintenance" && normalizeText(context?.vehicleId)) {
      setUserMaintenances((prev) => {
        const nextMaintenance = {
          id: `mnt-${appointment.id}`,
          vehicleId: normalizeText(context?.vehicleId),
          vehicleTitle: normalizeText(context?.vehicleTitle),
          vehiclePlate: normalizeText(context?.vehiclePlate),
          type: "maintenance",
          title: appointment.title,
          status: appointment.status,
          scheduledAt: appointment.requestedAt,
          notes: appointment.meta,
        };

        const deduped = (Array.isArray(prev) ? prev : []).filter((item) => normalizeText(item?.id) !== nextMaintenance.id);
        return [nextMaintenance, ...deduped].slice(0, 12);
      });
    }

    if (type === "insurance" && normalizeText(context?.vehicleId)) {
      setUserInsurances((prev) => {
        const nextInsurance = {
          id: `ins-${normalizeText(context?.vehicleId)}`,
          vehicleId: normalizeText(context?.vehicleId),
          vehicleTitle: normalizeText(context?.vehicleTitle),
          vehiclePlate: normalizeText(context?.vehiclePlate),
          status: "active",
          renewalAt: appointment.requestedAt,
          notes: appointment.meta,
        };

        const deduped = (Array.isArray(prev) ? prev : []).filter((item) => normalizeText(item?.vehicleId) !== nextInsurance.vehicleId);
        return [nextInsurance, ...deduped].slice(0, 8);
      });
    }

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
        : currentStep?.type === "score_weights"
        ? { ...answers, [currentStep.id]: scoreWeightsSelection }
        : currentStep?.type === "dual_timeline"
        ? {
            ...answers,
            horizonte_tenencia: dualTimelineSelection.horizonte_tenencia,
            antiguedad_vehiculo_buscada: dualTimelineSelection.antiguedad_vehiculo_buscada,
          }
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
      const payload = await fetchDecisionListing({
        aiResult,
        decisionFlowReady,
        decisionAnswers,
      });

      setDecisionListingResult(payload?.listing || null);
    } catch (err) {
      setDecisionListingError(err.message || "No se pudo localizar un anuncio real para esta operación.");
    } finally {
      setDecisionListingLoading(false);
    }
  };

  useEffect(() => {
    const isDecisionFlowReady =
      decisionAnswers.operation &&
      decisionAnswers.brand &&
      decisionAnswers.model &&
      decisionAnswers.cashBudget &&
      decisionAnswers.ageFilter &&
      decisionAnswers.mileageFilter;

    if (!isDecisionFlowReady || decisionAiResult) {
      setDecisionMarketListings([]);
      setDecisionMarketError(null);
      setDecisionMarketInsight(null);
      setDecisionMarketLoading(false);
      setDecisionMarketRefreshNonce(0);
      setDecisionMarketExcludeUrls([]);
      setDecisionMarketExcludeTitles([]);
      return;
    }

    let isMounted = true;
    const timeoutId = window.setTimeout(async () => {
      setDecisionMarketLoading(true);
      setDecisionMarketError(null);
      setDecisionMarketInsight(null);

      try {
        const payload = await fetchDecisionListing({
          decisionFlowReady: isDecisionFlowReady,
          decisionAnswers,
          refreshNonce: decisionMarketRefreshNonce,
          excludeUrls: decisionMarketExcludeUrls,
          excludeTitles: decisionMarketExcludeTitles,
        });

        if (isMounted) {
          const listings = Array.isArray(payload?.listings) ? payload.listings.slice(0, 3) : [];
          setDecisionMarketListings(listings);
          setDecisionMarketInsight(payload?.filterInsight || null);
        }
      } catch (err) {
        if (isMounted) {
          setDecisionMarketError(err.message || "No se pudieron cargar ofertas reales ahora mismo.");
          setDecisionMarketInsight(null);
          setDecisionMarketListings([]);
        }
      } finally {
        if (isMounted) {
          setDecisionMarketLoading(false);
        }
      }
    }, 220);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [decisionAiResult, decisionAnswers, decisionMarketRefreshNonce, decisionMarketExcludeUrls, decisionMarketExcludeTitles]);

  const recalculateDecisionMarketOffers = useCallback(() => {
    setDecisionMarketExcludeUrls([]);
    setDecisionMarketExcludeTitles([]);
    setDecisionMarketRefreshNonce(Date.now());
  }, []);

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
          powerRange: `${decisionAnswers.powerMin || 70} - ${decisionAnswers.powerMax || 250} CV`,
          location: decisionAnswers.location || "toda_espana",
          fuelFilter: decisionAnswers.fuelFilter || "cualquiera",
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
      const buildPrompt = (extraInstruction = "") => buildAdviceAnalysisPrompt({
        answersSummary: extraInstruction ? `${answersSummary}\n- Instruccion adicional del sistema: ${extraInstruction}` : answersSummary,
        advisorContext,
      });

      let raw = await requestAiJson(
        buildPrompt(),
        { answers: finalAnswers, advisorContext },
        { onApiKeyMissing: () => setApiKeyMissing(true) }
      );
      let normalizedResult = normalizeAdvisorResult(raw);

      if (!isAdvisorResultCompatibleWithContext(normalizedResult, advisorContext)) {
        raw = await requestAiJson(
          buildPrompt("La respuesta anterior incumplio la restriccion de categoria. Repite el analisis respetando estrictamente la via de entrada del usuario."),
          { answers: finalAnswers, advisorContext },
          { onApiKeyMissing: () => setApiKeyMissing(true) }
        );
        normalizedResult = normalizeAdvisorResult(raw);
      }

      clearInterval(phaseInterval);

      if (!isCompleteAdvisorResult(normalizedResult)) {
        throw new Error("La IA ha devuelto un analisis incompleto. Intentalo de nuevo.");
      }

      if (!isAdvisorResultCompatibleWithContext(normalizedResult, advisorContext)) {
        throw new Error("La IA ha devuelto una categoria incompatible con la via elegida. Vuelve a intentarlo.");
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
      setStep(99);
    }
  };

  const {
    handleAuthAction,
    handleLogout,
    handleUserAccessClick,
    openPortalVoOfferDetail,
    restart: restartBase,
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

  const restart = useCallback(() => {
    setAdvisorContext(null);
    setSellFlowType("");
    restartBase();
  }, [restartBase]);

  const decisionModels = decisionAnswers.brand ? marketBrandsCatalog[decisionAnswers.brand] || [] : [];
  const estimatedFinanceMonthly = estimateMonthlyPayment(
    getOptionAmount(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount)
  );
  const estimatedMixedMonthly = estimateMonthlyPayment(
    getOptionAmount(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount)
  );
  const resolvedAcquisition =
    decisionAnswers.acquisition || (decisionAnswers.operation === "renting" ? "particular" : "contado");
  const needsMonthlyBudget = false;
  const needsCashBudget = false;
  const needsFinanceAmount = false;
  const needsEntryAmount = false;
  const decisionFlowReady =
    decisionAnswers.operation &&
    decisionAnswers.brand &&
    decisionAnswers.model &&
    decisionAnswers.cashBudget &&
    decisionAnswers.ageFilter &&
    decisionAnswers.mileageFilter;
  const rankedOffers =
    decisionFlowReady
      ? buildOfferRanking({
          brand: decisionAnswers.brand,
          model: decisionAnswers.model,
          acquisition: resolvedAcquisition,
          condition: decisionAnswers.condition || "seminuevo",
          priceRange: getOptionAmount(TOTAL_PURCHASE_OPTIONS, decisionAnswers.cashBudget),
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
      : entryMode === "consejo" && currentStep?.type === "score_weights"
      ? { ...answers, [currentStep.id]: scoreWeightsSelection }
      : entryMode === "consejo" && currentStep?.type === "dual_timeline"
      ? {
          ...answers,
          horizonte_tenencia: dualTimelineSelection.horizonte_tenencia,
          antiguedad_vehiculo_buscada: dualTimelineSelection.antiguedad_vehiculo_buscada,
        }
      : answers;
  const visibleDraftAnswers = buildActiveAnswers(draftAnswers, activeSteps);
  const answeredSteps = countAnsweredSteps(visibleDraftAnswers, activeSteps);
  const remainingQuestions = Math.max(totalSteps - answeredSteps, 0);
  const completionPct = Math.min(100, Math.round((answeredSteps / totalSteps) * 100));
  const isAdviceFlowLightBackground =
    themeMode === "light" &&
    entryMode === "consejo" &&
    (
      (step >= 0 && step < totalSteps) ||
      (step === 99 && loading) ||
      Boolean(result && !LEGAL_DOCUMENTS[entryMode])
    );

  // -------------------- STYLES --------------------
  const s = useMemo(() => createAppStyles(progress, themeMode), [progress, themeMode]);

  // -------------------- RENDER --------------------
  return (
    <div
      style={{
        ...s.page,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        ...((themeMode === "light" && step === -1) || isAdviceFlowLightBackground
          ? {
              background: "#ffffff",
              color: "#0f172a",
            }
          : null),
      }}
    >
      {/* HEADER */}
      <header style={s.header}>
        <button
          type="button"
          onClick={restart}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
          }}
          title="Ir al home"
          aria-label="Ir al home"
        >
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
            {"\uD83D\uDE97"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: themeMode === "dark" ? "#f1f5f9" : "#0f172a" }}>CarAdvisor</div>
            <div style={{ fontSize: 10, color: themeMode === "dark" ? "#94a3b8" : "#64748b", letterSpacing: "0.8px" }}>
              SPAIN MOBILITY PLATFORM
            </div>
          </div>
        </button>
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
                background: themeMode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(241,245,249,0.92)",
                border: themeMode === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(148,163,184,0.32)",
                color: themeMode === "dark" ? "#94a3b8" : "#334155",
                padding: "5px 13px",
                borderRadius: 7,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {"\u2190"} Volver al home
            </button>
          )}

          <button
            type="button"
            onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
            title={themeMode === "dark" ? "Cambiar a white mode" : "Cambiar a dark mode"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: themeMode === "dark" ? "rgba(15,23,42,0.7)" : "rgba(241,245,249,0.95)",
              border: themeMode === "dark" ? "1px solid rgba(148,163,184,0.28)" : "1px solid rgba(148,163,184,0.34)",
              color: themeMode === "dark" ? "#e2e8f0" : "#334155",
              padding: "7px 11px",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <span>{themeMode === "dark" ? "☀️" : "🌙"}</span>
            <span>{themeMode === "dark" ? "White mode" : "Dark mode"}</span>
          </button>

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
              color: themeMode === "dark" ? "#e0f2fe" : "#0c4a6e",
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
                color: themeMode === "dark" ? "#e2e8f0" : "#0f172a",
              }}
            >
              {"\uD83D\uDC64"}
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
                    Mi espacio CarAdvisor
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
                    Ver detalle {"\u2192"}
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
                          {item.typeLabel} {"\u00B7"} {item.savedAt}
                        </div>
                        <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>
                          {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/mes` : item.budgetLabel || "Sin cuota definida"}
                        </div>
                        {(item.sourceLabel || item.listingPrice) && (
                          <div style={{ fontSize: 11, color: "#bfdbfe", marginTop: 2 }}>
                            {item.sourceLabel || "Oferta guardada"}
                            {item.listingPrice ? ` ${"\u00B7"} ${item.listingPrice}` : ""}
                          </div>
                        )}
                        {savedOfferHref && (
                          <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 4, fontWeight: 700 }}>
                            Abrir oferta {"\u2197"}
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
                      { key: "workshop", label: "\uD83D\uDEE0\uFE0F Taller" },
                      { key: "maintenance", label: "\uD83D\uDD27 Mantenimiento" },
                      { key: "insurance", label: "\uD83D\uDEE1\uFE0F Seguro" },
                      { key: "certification", label: "\u2705 Garantia / calidad" },
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
                          {item.requestedAt ? ` ${"\u00B7"} ${item.requestedAt}` : ""}
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
              maxHeight: "92vh",
              overflowY: "auto",
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
                    ? "RECUPERACION"
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
                x
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
                    ? "Procesando⬦"
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

      {showCookieGate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Consentimiento de cookies"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 170,
          }}
        >
          <div
            style={{
              width: "min(680px, 100%)",
              maxHeight: "min(92vh, 820px)",
              background: "rgba(8,15,30,0.98)",
              border: "1px solid rgba(103,232,249,0.28)",
              borderRadius: 18,
              boxShadow: "0 24px 60px rgba(2,6,23,0.45)",
              padding: 18,
              textAlign: "left",
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 11, color: "#67e8f9", fontWeight: 800, letterSpacing: "0.6px", marginBottom: 8 }}>
              CONFIGURACION INICIAL
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "clamp(22px,4vw,28px)", color: "#f8fafc" }}>
              Antes de entrar, acepta nuestra política de cookies
            </h3>
            <p style={{ margin: "0 0 8px", color: "#cbd5e1", fontSize: 13, lineHeight: 1.65 }}>
              Utilizamos cookies necesarias para el funcionamiento y, si tú quieres, cookies analíticas,
              de personalización y marketing para mejorar tu experiencia.
            </p>
            <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
              Puedes aceptar todas, rechazar las opcionales o configurar tus preferencias por categoría.
            </p>

            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {[
                {
                  key: "necessary",
                  title: "Cookies necesarias",
                  description: "Imprescindibles para acceder, mantener sesión y navegar correctamente.",
                  locked: true,
                },
                {
                  key: "analytics",
                  title: "Cookies analíticas",
                  description: "Nos ayudan a medir uso y rendimiento para mejorar la plataforma.",
                },
                {
                  key: "personalization",
                  title: "Cookies de personalización",
                  description: "Guardan preferencias para adaptar contenido y experiencia.",
                },
                {
                  key: "marketing",
                  title: "Cookies de marketing",
                  description: "Permiten comunicaciones y campañas más relevantes.",
                },
              ].map((item) => {
                const enabled = cookiePreferences[item.key];
                return (
                  <div
                    key={item.key}
                    style={{
                      border: "1px solid rgba(148,163,184,0.24)",
                      borderRadius: 12,
                      background: "rgba(15,23,42,0.5)",
                      padding: "10px 12px",
                      display: "flex",
                      gap: 10,
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 700 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, lineHeight: 1.5 }}>
                        {item.description}
                      </div>
                    </div>

                    {item.locked ? (
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "5px 9px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#86efac",
                          border: "1px solid rgba(110,231,183,0.35)",
                          background: "rgba(16,185,129,0.14)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Siempre activas
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={Boolean(enabled)}
                        onClick={() =>
                          setCookiePreferences((prev) => ({
                            ...prev,
                            [item.key]: !prev[item.key],
                          }))
                        }
                        style={{
                          borderRadius: 999,
                          border: enabled
                            ? "1px solid rgba(110,231,183,0.35)"
                            : "1px solid rgba(148,163,184,0.3)",
                          background: enabled
                            ? "rgba(16,185,129,0.14)"
                            : "rgba(15,23,42,0.7)",
                          color: enabled ? "#86efac" : "#cbd5e1",
                          padding: "6px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {enabled ? "Activadas" : "Desactivadas"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {showCookieSettings && (
              <div
                style={{
                  marginBottom: 12,
                  border: "1px solid rgba(125,211,252,0.24)",
                  background: "rgba(2,132,199,0.1)",
                  borderRadius: 10,
                  padding: "9px 11px",
                  fontSize: 12,
                  color: "#bae6fd",
                }}
              >
                Configuración avanzada activa. Cuando termines, pulsa Guardar selección.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => saveCookieConsent("all")}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Aceptar todas
              </button>

              <button
                type="button"
                onClick={() => saveCookieConsent("necessary")}
                style={{
                  border: "1px solid rgba(148,163,184,0.34)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "rgba(15,23,42,0.72)",
                  color: "#e2e8f0",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Solo necesarias
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCookieSettings(true);
                  saveCookieConsent("custom");
                }}
                style={{
                  border: "1px solid rgba(110,231,183,0.34)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "rgba(16,185,129,0.12)",
                  color: "#bbf7d0",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Guardar selección
              </button>

              <button
                type="button"
                onClick={() => setShowCookieSettings((prev) => !prev)}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "transparent",
                  color: "#93c5fd",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {showCookieSettings ? "Ocultar configuración" : "Configurar cookies"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
              Puedes revisar los detalles en la política de cookies desde el footer.
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          .ma-card-interactive {
            position: relative;
            overflow: hidden;
            isolation: isolate;
            box-shadow: 0 14px 30px rgba(2,6,23,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
            transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease, border-color 240ms ease, background 240ms ease, filter 240ms ease;
            will-change: transform;
          }

          .ma-card-interactive > * {
            position: relative;
            z-index: 2;
          }

          .ma-card-interactive::before {
            content: "";
            position: absolute;
            inset: -1px;
            background: radial-gradient(120% 90% at 8% 10%, rgba(59,130,246,0.26), rgba(59,130,246,0) 55%),
              radial-gradient(90% 75% at 92% 12%, rgba(16,185,129,0.2), rgba(16,185,129,0) 55%);
            opacity: 0;
            transition: opacity 220ms ease;
            pointer-events: none;
            z-index: 1;
          }

          .ma-card-interactive::after {
            content: "";
            position: absolute;
            width: 46%;
            height: 160%;
            top: -30%;
            left: -60%;
            transform: rotate(18deg);
            background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.2), rgba(255,255,255,0));
            transition: left 520ms ease;
            pointer-events: none;
            z-index: 1;
          }

          .ma-card-interactive:focus-visible {
            outline: 2px solid rgba(125,211,252,0.7);
            outline-offset: 2px;
          }

          .ma-card-interactive:hover,
          .ma-card-interactive:focus-visible {
            transform: translateY(-6px) scale(1.01);
            box-shadow: 0 24px 46px rgba(2,6,23,0.34), 0 0 0 1px rgba(125,211,252,0.18), 0 0 24px rgba(56,189,248,0.14);
            border-color: rgba(125,211,252,0.64) !important;
            filter: saturate(1.08) brightness(1.03);
          }

          .ma-card-interactive:hover::before,
          .ma-card-interactive:focus-visible::before {
            opacity: 1;
          }

          .ma-card-interactive:hover::after,
          .ma-card-interactive:focus-visible::after {
            left: 120%;
          }

          .ma-card-interactive:active {
            transform: translateY(-1px) scale(0.995);
          }

          .ma-card-soft {
            transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease, filter 200ms ease;
          }

          .ma-card-soft:hover,
          .ma-card-soft:focus-visible {
            transform: translateY(-3px);
            box-shadow: 0 16px 34px rgba(2,6,23,0.26), 0 0 18px rgba(56,189,248,0.1);
            border-color: rgba(125,211,252,0.5);
            filter: saturate(1.04);
          }

          .ma-card-soft:focus-visible {
            outline: 2px solid rgba(125,211,252,0.65);
            outline-offset: 2px;
          }

          .ma-fade-stagger {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
            animation: maCardIn 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }

          @keyframes maCardIn {
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @media (max-width: 768px) {
            .ma-card-interactive:hover,
            .ma-card-interactive:focus-visible {
              transform: translateY(-3px) scale(1.005);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .ma-card-interactive,
            .ma-card-soft,
            .ma-fade-stagger {
              animation: none !important;
              transition: none !important;
            }

            .ma-card-interactive::after,
            .ma-card-interactive::before {
              transition: none !important;
            }
          }
        `}
      </style>

      {/* PROGRESS */}
      <div style={s.progressBar}>
        <div style={s.progressFill} />
      </div>

      {/* LANDING */}
      {step === -1 && !entryMode && (
        <LandingPage
          styles={s}
          totalSteps={totalSteps}
          blockColors={BLOCK_COLORS}
          questionnaireDraft={questionnaireDraft}
          isUserLoggedIn={isUserLoggedIn}
          planCheckoutLoadingId={planCheckoutLoadingId}
          planCheckoutFeedback={planCheckoutFeedback}
          onSelectVehicle={() => {
            setEntryMode("vehicleOptions");
            setStep(-1);
          }}
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
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "sellOptions", routePage: "home" });
              return;
            }
            setSellFlowType("");
            setEntryMode("sellOptions");
            setStep(-1);
          }}
          onSelectService={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "serviceOptions", routePage: "home" });
              return;
            }
            setEntryMode("serviceOptions");
            setStep(-1);
          }}
          onSelectPortalVo={() => {
            setEntryMode("portalVo");
            setStep(-1);
            setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
          }}
          onSelectSubscriptionPlan={(plan) => {
            void startSubscriptionCheckout(plan?.id || "");
          }}
        />
      )}

      {step === -1 && entryMode === "vehicleOptions" && (
        <VehicleOptionsPage
          styles={s}
          onSelectBuy={() => {
            setEntryMode("buyOptions");
            setStep(-1);
          }}
          onSelectRenting={() => {
            setAdvisorContext(null);
            setEntryMode("rentingOptions");
            setStep(-1);
          }}
          onSelectGuide={() => {
            setAdvisorContext(null);
            setAnswers({});
            setEntryMode("consejo");
            setStep(-1);
          }}
          onGoHome={() => {
            setAdvisorContext(null);
            setEntryMode(null);
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "rentingOptions" && (
        <RentingOptionsPage
          styles={s}
          onSelectAdvisor={() => {
            setAdvisorContext("renting");
            setAnswers({ flexibilidad: "renting" });
            setEntryMode("consejo");
            setStep(-1);
          }}
          onSelectKnownModel={() => {
            setAdvisorContext("renting");
            setDecisionAnswers({
              ...createInitialDecisionAnswers(),
              operation: "renting",
              acquisition: "particular",
              hasBrand: "si",
            });
            setEntryMode("decision");
            setStep(-1);
          }}
          onGoBack={() => {
            setAdvisorContext(null);
            setEntryMode("vehicleOptions");
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "buyOptions" && (
        <BuyOptionsPage
          styles={s}
          onSelectAdvisor={() => {
            setAdvisorContext("buy");
            setAnswers({});
            setEntryMode("consejo");
            setStep(-1);
          }}
          onSelectKnownModel={() => {
            setAdvisorContext("buy");
            setDecisionAnswers({
              ...createInitialDecisionAnswers(),
              operation: "comprar",
              acquisition: "contado",
              hasBrand: "si",
            });
            setEntryMode("decision");
            setStep(-1);
          }}
          onGoBack={() => {
            setAdvisorContext(null);
            setEntryMode("vehicleOptions");
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "sellOptions" && (
        <SellOptionsPage
          styles={s}
          onSelectCertificate={() => {
            setSellFlowType("certificate");
            setSellAnswers((prev) => ({ ...prev, sellerType: "profesional" }));
            setEntryMode("sell");
            setStep(-1);
          }}
          onSelectReport={() => {
            setSellFlowType("report");
            setSellAnswers((prev) => ({ ...prev, sellerType: "particular" }));
            setEntryMode("sell");
            setStep(-1);
          }}
          onGoBack={() => {
            setSellFlowType("");
            setEntryMode(null);
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "serviceOptions" && (
        <ServiceOptionsPage
          styles={s}
          onSelectInsurance={() => {
            setEntryMode("serviceInsurance");
            setStep(-1);
          }}
          onSelectMaintenance={() => {
            setEntryMode("serviceMaintenance");
            setStep(-1);
          }}
          onSelectAutogestor={() => {
            setEntryMode("serviceAutogestor");
            setStep(-1);
          }}
          onGoBack={() => {
            setEntryMode(null);
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "serviceInsurance" && (
        <ServiceInsurancePage
          themeMode={themeMode}
          styles={s}
          onGoBack={() => {
            setEntryMode("serviceOptions");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "serviceMaintenance" && (
        <ServiceMaintenancePage
          themeMode={themeMode}
          styles={s}
          onGoBack={() => {
            setEntryMode("serviceOptions");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "serviceAutogestor" && (
        <ServiceAutogestorPage
          themeMode={themeMode}
          styles={s}
          onGoBack={() => {
            setEntryMode("serviceOptions");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && LEGAL_DOCUMENTS[entryMode] && (
        <LegalPolicyPage
          styles={s}
          title={LEGAL_DOCUMENTS[entryMode].title}
          summary={LEGAL_DOCUMENTS[entryMode].summary}
          updatedAt={LEGAL_DOCUMENTS[entryMode].updatedAt}
          sections={LEGAL_DOCUMENTS[entryMode].sections}
          onGoBack={restart}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "userDashboard" && isUserLoggedIn && (
        <UserDashboardPage
          themeMode={themeMode}
          centerStyle={s.center}
          blockBadgeStyle={s.blockBadge("Vinculación")}
          panelStyle={{
            ...s.panel,
            background: themeMode === "dark"
              ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
              : "linear-gradient(160deg, rgba(255,255,255,0.97), rgba(241,245,249,0.94))",
            border: themeMode === "dark"
              ? "1px solid rgba(148,163,184,0.34)"
              : "1px solid rgba(148,163,184,0.24)",
            boxShadow: themeMode === "dark"
              ? "0 10px 28px rgba(2,6,23,0.34)"
              : "0 10px 28px rgba(15,23,42,0.08)",
          }}
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
          onRequestValuation={openSellValuationFromOffers}
          onOpenOffer={openOfferInNewTab}
          onOpenMarketplaceOffer={openPortalVoOfferDetail}
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
          lockedOperation={advisorContext === "renting" ? "renting" : advisorContext === "buy" ? "comprar" : null}
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
          decisionMarketListings={decisionMarketListings}
          decisionMarketLoading={decisionMarketLoading}
          decisionMarketError={decisionMarketError}
          decisionMarketInsight={decisionMarketInsight}
          onRecalculateDecisionMarketOffers={recalculateDecisionMarketOffers}
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
          themeMode={themeMode}
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
          themeMode={themeMode}
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
          sellFlowType={sellFlowType}
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

      {/* QUESTIONS */}
      {entryMode === "consejo" && step >= 0 && step < totalSteps && currentStep && (
        <QuestionnairePage
          styles={s}
          themeMode={themeMode}
          currentStep={currentStep}
          step={step}
          totalSteps={totalSteps}
          advancedMode={advancedMode}
          toggleAdvancedMode={toggleAdvancedMode}
          remainingQuestions={remainingQuestions}
          completionPct={completionPct}
          multiSelected={multiSelected}
          dualTimelineSelection={dualTimelineSelection}
          scoreWeightsSelection={scoreWeightsSelection}
          answers={answers}
          BRAND_LOGOS={BRAND_LOGOS}
          onHandleMultiToggle={handleMultiToggle}
          onHandleDualTimelineSelect={handleDualTimelineSelect}
          onHandleScoreWeightSelect={handleScoreWeightSelect}
          onHandleSingle={handleSingle}
          onHandleMultiNext={handleMultiNext}
          onHandleDualTimelineNext={handleDualTimelineNext}
          onHandleScoreWeightsNext={handleScoreWeightsNext}
          onGoPrevious={goToPreviousStep}
          onRestartQuestionnaire={restartQuestionnaire}
          onTellMeNow={handleTellMeNow}
          answeredSteps={answeredSteps}
        />
      )}

      {/* LOADING */}
      {step === 99 && loading && (
        <LoadingAnalysisPage
          styles={s}
          themeMode={themeMode}
          loadingTexts={loadingTexts}
          loadingPhase={loadingPhase}
        />
      )}

      {/* API KEY MISSING */}
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
      {result && !LEGAL_DOCUMENTS[entryMode] && (
        <AdviceResultsPage
          result={result}
          resultRef={resultRef}
          styles={s}
          themeMode={themeMode}
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

      {/* ERROR */}
      {error && <ErrorStatePage error={error} onRetry={() => analyzeWithAI(answers)} />}

      <footer
        style={{
          marginTop: "auto",
          position: "relative",
          zIndex: 5,
          borderTop: "1px solid rgba(148,163,184,0.22)",
          background:
            "radial-gradient(120% 100% at 8% 0%, rgba(56,189,248,0.1), rgba(56,189,248,0) 45%), linear-gradient(180deg, rgba(2,6,23,0.9), rgba(2,6,23,0.98))",
        }}
      >
        <div
          style={{
            ...s.center,
            paddingTop: 30,
            paddingBottom: 30,
            display: "grid",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
              gap: 14,
              textAlign: "left",
            }}
          >
            <div className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "linear-gradient(135deg,#2563EB,#10b981)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  {"\uD83D\uDE97"}
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#f8fafc" }}>CarAdvisor</div>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                Plataforma de movilidad para comprar mejor, vender mejor y reducir el coste total de tu vehículo.
              </div>
            </div>

            <div className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>CONTACTO</div>
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                <a href="mailto:soporte@caradvisor.es" style={{ color: "#e2e8f0", textDecoration: "none" }}>soporte@caradvisor.es</a>
                <a href="tel:+34910000000" style={{ color: "#e2e8f0", textDecoration: "none" }}>+34 910 000 000</a>
                <div style={{ color: "#94a3b8" }}>L-V 09:00 a 18:00 (España)</div>
              </div>
            </div>

            <div className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>ENLACES UTILES</div>
              <div style={{ display: "grid", gap: 7, fontSize: 12 }}>
                <button type="button" onClick={restart} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>Inicio</button>
                <button type="button" onClick={() => { setEntryMode("portalVo"); setStep(-1); setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS }); }} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>Marketplace VO</button>
                <button type="button" onClick={() => { setEntryMode("vehicleOptions"); setStep(-1); }} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>Asesor de vehículo</button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isUserLoggedIn) {
                      setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
                      openAuthDialog("login", { entryMode: "serviceOptions", routePage: "home" });
                      return;
                    }
                    setEntryMode("serviceOptions");
                    setStep(-1);
                  }}
                  style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}
                >
                  Servicios
                </button>
              </div>
            </div>

            <div className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>REDES SOCIALES</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["LinkedIn", "https://www.linkedin.com"],
                  ["Instagram", "https://www.instagram.com"],
                  ["X", "https://x.com"],
                  ["YouTube", "https://www.youtube.com"],
                ].map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="ma-card-soft"
                    style={{
                      border: "1px solid rgba(148,163,184,0.24)",
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#e2e8f0",
                      textDecoration: "none",
                      background: "rgba(15,23,42,0.55)",
                    }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 10,
              borderTop: "1px solid rgba(148,163,184,0.2)",
              paddingTop: 12,
              fontSize: 11,
              color: "#94a3b8",
              textAlign: "left",
            }}
          >
            <div>© {new Date().getFullYear()} CarAdvisor. Todos los derechos reservados.</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                ["Aviso legal", "legalNotice"],
                ["Privacidad", "privacyPolicy"],
                ["Cookies", "cookiePolicy"],
                ["Términos", "termsConditions"],
              ].map(([label, key]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openLegalDocument(key)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#cbd5e1",
                    textDecoration: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

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
          color-scheme: ${themeMode === "dark" ? "dark" : "light"};
        }
        select option {
          background: ${themeMode === "dark" ? "#0f1b2d" : "#ffffff"};
          color: ${themeMode === "dark" ? "#f8fafc" : "#0f172a"};
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}


