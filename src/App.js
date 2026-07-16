import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import "./App.css";
import AdviceIntroPage from "./pages/AdviceIntroPage";
import AdviceResultsPage from "./pages/AdviceResultsPage";
import DecisionPage from "./pages/DecisionPage";
import LandingPage from "./pages/LandingPage";
import PortalVoDetailPage from "./pages/PortalVoDetailPage";
import PortalVoMarketplacePage from "./pages/PortalVoMarketplacePage";
import PortalVoAuthGatePage from "./pages/PortalVoAuthGatePage";

import SellPage from "./pages/SellPage";
import ApiKeyMissingPage from "./pages/ApiKeyMissingPage";
import ErrorStatePage from "./pages/ErrorStatePage";
import LoadingAnalysisPage from "./pages/LoadingAnalysisPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import UserDashboardPage from "./pages/userDashboard/UserDashboardPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import VehicleOptionsPage from "./pages/VehicleOptionsPage";
import BuyOptionsPage from "./pages/BuyOptionsPage";
import RentingOptionsPage from "./pages/RentingOptionsPage";
import SellOptionsPage from "./pages/SellOptionsPage";
import ServiceOptionsPage from "./pages/ServiceOptionsPage";
import ServiceInsurancePage from "./pages/ServiceInsurancePage";
import ServiceMaintenancePage from "./pages/ServiceMaintenancePage";
import ServiceAutogestorPage from "./pages/ServiceAutogestorPage";
import ServiceAppointmentPage from "./pages/ServiceAppointmentPage";
import ServiceAppointmentCalendarPage from "./pages/ServiceAppointmentCalendarPage";
import ServiceMonthlyPlanPage from "./pages/ServiceMonthlyPlanPage";
import ServiceIdCarsManagePage from "./pages/ServiceIdCarsManagePage";
import ViewingProposePage from "./pages/ViewingProposePage";
import ViewingConfirmPage from "./pages/ViewingConfirmPage";
import LegalPolicyPage from "./pages/LegalPolicyPage";
import MiCitaPage from "./pages/MiCitaPage";
import SeoStaticPage from "./pages/SeoStaticPage";
import AboutCarswisePage from "./pages/AboutCarswisePage";
import ContactCarswisePage from "./pages/ContactCarswisePage";
import BlogIndexPage from "./pages/BlogIndexPage";
import BlogArticlePage from "./pages/BlogArticlePage";
import PricingPlansPage from "./pages/PricingPlansPage";
import ResolvedOfferImage from "./components/offers/ResolvedOfferImage";
import {
  createInitialDecisionAnswers,
  createInitialSellAnswers,
  useAdvisorController,
} from "./hooks/useAdvisorController";
import { useAppBootstrap } from "./hooks/useAppBootstrap";
import { useDashboardNavigation } from "./hooks/useDashboardNavigation";
import { useDecisionResetState, useSellResetState } from "./hooks/useDecisionSellResets";
import { useListingBootstrap } from "./hooks/useListingBootstrap";
import { useListingDiscoveryMemory } from "./hooks/useListingDiscoveryMemory";
import { useListingQuickValidationRefresh } from "./hooks/useListingQuickValidationRefresh";
import { useQuestionnaireDraftPersistence } from "./hooks/useQuestionnaireDraftPersistence";
import { useQuestionnaireStepVisualSync } from "./hooks/useQuestionnaireStepVisualSync";
import { useResumeQuestionnaireDraft } from "./hooks/useResumeQuestionnaireDraft";
import { useSavedRecommendations } from "./hooks/useSavedRecommendations";
import { useAuthDialogControls } from "./hooks/useAuthDialogControls";
import { useAuthSessionReset } from "./hooks/useAuthSessionReset";
import { usePlanCheckout } from "./hooks/usePlanCheckout";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useMarketAlertInsights } from "./hooks/useMarketAlertInsights";
import { useMarketCatalog } from "./hooks/useMarketCatalog";
import { useUserMobilitySync } from "./hooks/useUserMobilitySync";
import {
  buildOfferModelSuggestions,
  buildSearchCoverageSummary,
  getOfferBadgeStyle,
  getOfferFallbackSearchUrl,
  getOfferNavigationUrl,
  getOfferTrustBadges,
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
  deleteUserAlertJson,
  getMarketplaceVoJson,
  getSellMarketSnapshotJson,
  postAlertEmailDigestJson,
  postAppointmentAddJson,
  postDeleteAppointmentJson,
  postErpAppointmentJson,
  postAuthJson,
  postListingJson,
  postUserAlertJson,
  postUserAlertStatusJson,
  postValuationAddJson,
} from "./utils/apiClient";
import {
  buildAdviceAnalysisPrompt,
  buildAnswersSummary,
  buildDecisionAnalysisPrompt,
  buildSellAnalysisPrompt,
  fetchDecisionListing,
  fetchSellComparableListing,
  requestAiJson,
} from "./utils/analysisFlows";
import {
  buildPortalVoEquipment,
  buildPortalVoHighlights,
  buildPortalVoMarketplaceModel,
  getPortalVoEcoLabel,
  getPortalVoTransmission,
  INITIAL_PORTAL_VO_FILTERS,
} from "./utils/portalVoHelpers";
import {
  buildMarketRadarSnapshot,
  buildOfferRanking,
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
  clearQuestionnaireDraft,
  writeAuthUser,
  writeMarketAlerts,
  writeMarketAlertStatus,
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
import { captureUtmFromUrl } from "./utils/utmTracker";
import { trackFunnelEvent } from "./utils/funnelTracker";
import { BLOG_POSTS, getBlogPostBySlug } from "./data/blogPosts";
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
      "Información general de titularidad, condiciones de acceso, propiedad intelectual y responsabilidades del uso de la plataforma carswiseai.com.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "1. Datos identificativos del titular",
        paragraphs: [
          "En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSICE), se facilitan los datos del titular del sitio web:",
          "Denominación social: Carswiseai [PENDIENTE: forma jurídica, S.L. / S.A. / autónomo]",
          "NIF/CIF: [PENDIENTE]",
          "Domicilio social: [PENDIENTE: dirección completa, código postal, ciudad, provincia]",
          "Correo electrónico de contacto: soporte@carswiseai.com",
          "Sitio web: https://www.carswiseai.com",
        ],
      },
      {
        heading: "2. Objeto y ámbito del sitio web",
        paragraphs: [
          "Carswiseai opera una plataforma digital de intermediación y marketplace de vehículos de ocasión, renting y servicios de movilidad en España, accesible a través del dominio carswiseai.com.",
          "La plataforma permite a los usuarios explorar ofertas de vehículos, solicitar información, agendar visitas y gestionar solicitudes de renting, conectándoles con los proveedores correspondientes.",
          "La información y los contenidos publicados tienen carácter informativo y de apoyo a la decisión del usuario. Carswiseai actúa como intermediario y no es parte contratante en las operaciones de compraventa o renting que se formalicen entre el usuario y el proveedor del vehículo.",
        ],
      },
      {
        heading: "3. Condiciones de acceso y uso",
        paragraphs: [
          "El acceso y la navegación por este sitio web implican la aceptación expresa de las condiciones recogidas en el presente Aviso Legal, así como en la Política de Privacidad y en los Términos y Condiciones.",
          "El usuario se compromete a hacer un uso diligente, lícito y correcto del sitio, de conformidad con la legislación vigente, la buena fe y el orden público.",
        ],
        bullets: [
          "Queda prohibida la reproducción, distribución o comunicación pública de los contenidos del sitio sin autorización previa y por escrito de Carswiseai.",
          "Queda prohibido el uso de técnicas de scraping, crawling u otras formas de extracción automatizada de datos sin consentimiento expreso.",
          "Queda prohibido introducir, almacenar o difundir mediante el sitio contenidos que sean ilícitos, dañinos, difamatorios o que vulneren derechos de terceros.",
          "Carswiseai se reserva el derecho a denegar, restringir o cancelar el acceso a usuarios que incumplan estas condiciones.",
        ],
      },
      {
        heading: "4. Propiedad intelectual e industrial",
        paragraphs: [
          "La marca, logotipos, denominación comercial Carswiseai, así como el diseño, estructura, código fuente, textos, imágenes, gráficos y demás elementos de la plataforma son titularidad de Carswiseai o de sus licenciantes, y están protegidos por la normativa española e internacional en materia de propiedad intelectual e industrial.",
          "El usuario únicamente está autorizado a visualizar y hacer uso privado de los contenidos. Cualquier otro uso requiere autorización expresa y por escrito del titular.",
        ],
      },
      {
        heading: "5. Exclusión de responsabilidad",
        paragraphs: [
          "Carswiseai no garantiza la disponibilidad permanente e ininterrumpida del sitio, aunque aplica medidas razonables para asegurar su continuidad. Se excluye la responsabilidad por daños derivados de interrupciones, errores técnicos o causas de fuerza mayor.",
          "Los precios, disponibilidad y características de los vehículos publicados en el marketplace son proporcionados por los proveedores. Carswiseai no se responsabiliza de inexactitudes en dicha información.",
          "Las decisiones de compra, contratación de renting o cualquier operación comercial son responsabilidad exclusiva del usuario y del proveedor con quien suscriba el acuerdo.",
          "Carswiseai no asume responsabilidad por los contenidos de sitios web de terceros enlazados desde esta plataforma.",
        ],
      },
      {
        heading: "6. Legislación aplicable y jurisdicción",
        paragraphs: [
          "El presente Aviso Legal se rige por la legislación española. Para la resolución de cualquier controversia derivada del acceso o uso de este sitio web, las partes se someten a la jurisdicción de los Juzgados y Tribunales del domicilio del usuario, salvo que la ley disponga otro fuero imperativo.",
          "En caso de conflicto entre versiones lingüísticas del presente Aviso, prevalecerá la versión en español.",
        ],
      },
    ],
  },
  privacyPolicy: {
    title: "Política de privacidad",
    summary:
      "Información sobre el tratamiento de sus datos personales por parte de Carswiseai, conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        paragraphs: [
          "Denominación: Carswiseai [PENDIENTE: forma jurídica, p. ej. S.L.]",
          "NIF/CIF: [PENDIENTE]",
          "Domicilio social: [PENDIENTE: dirección completa, código postal, ciudad]",
          "Correo electrónico de privacidad: soporte@carswiseai.com",
          "Delegado de Protección de Datos (DPO): [PENDIENTE: nombre y contacto, o indicar 'no preceptivo conforme al art. 37 RGPD']",
        ],
      },
      {
        heading: "2. Datos personales que tratamos",
        bullets: [
          "Datos de registro y cuenta: nombre, apellidos, teléfono y correo electrónico facilitados al crear la cuenta.",
          "Datos de solicitudes: información aportada en formularios de solicitud de información, visita, renting o consulta (nombre, email, teléfono, mensaje, fecha y hora de cita preferida).",
          "Datos de navegación y uso: eventos de sesión, páginas y ofertas consultadas, fuente de la visita (UTM), identificador anónimo de sesión (cw_anon_id) y dirección IP.",
          "Datos de preferencias: alertas guardadas, filtros de búsqueda y configuración de la cuenta.",
          "Datos de facturación: en caso de contratación de planes de servicio, los datos necesarios para el procesamiento del pago a través de Stripe. Carswiseai no almacena datos de tarjetas.",
          "Datos de solvencia: cuando el usuario consiente expresamente, Carswiseai puede solicitar a Experian Bureau de Crédito S.A. la consulta de información de solvencia patrimonial ante organismos públicos, con la única finalidad de valorar la viabilidad de una operación de renting o financiación.",
        ],
      },
      {
        heading: "3. Finalidades y bases jurídicas",
        bullets: [
          "Gestión de cuenta (alta, autenticación, mantenimiento y baja) — base: ejecución del contrato (art. 6.1.b RGPD).",
          "Tramitación de solicitudes de información, visita o renting — base: medidas precontractuales (art. 6.1.b RGPD).",
          "Comunicaciones operativas sobre el estado de solicitudes (confirmaciones, recordatorios, actualizaciones de estado) — base: ejecución del contrato (art. 6.1.b RGPD).",
          "Análisis de uso de la plataforma para mejora del servicio — base: interés legítimo (art. 6.1.f RGPD).",
          "Envío de comunicaciones comerciales propias de Carswiseai (novedades, ofertas, campañas de marketing) — base: consentimiento expreso (art. 6.1.a RGPD), revocable en cualquier momento sin coste.",
          "Cesión de datos a terceros colaboradores (empresas del sector de movilidad, renting, financiación o seguros) para que realicen campañas de marketing propias dirigidas al usuario — base: consentimiento expreso (art. 6.1.a RGPD), revocable en cualquier momento. El usuario consiente expresamente que Carswiseai transmita su nombre, correo electrónico y perfil de interés a dichos terceros, quienes pasarán a ser responsables independientes del tratamiento para sus propias finalidades comerciales.",
          "Consulta de solvencia ante organismos públicos a través de Experian, para operaciones de renting o financiación — base: consentimiento expreso (art. 6.1.a RGPD). Este consentimiento es voluntario; su denegación no impide el uso general de la plataforma.",
          "Cumplimiento de obligaciones legales (fiscales, contables, de seguridad informática) — base: obligación legal (art. 6.1.c RGPD).",
        ],
      },
      {
        heading: "4. Comunicaciones comerciales y marketing",
        paragraphs: [
          "Si el usuario presta consentimiento expreso, Carswiseai podrá enviarle comunicaciones comerciales por correo electrónico u otros canales digitales sobre nuevas ofertas de vehículos, campañas de renting, servicios de movilidad y contenidos de interés relacionados con el sector del automóvil.",
          "Con consentimiento expreso, sus datos (nombre, correo electrónico y perfil de interés en vehículos) podrán cederse a terceros colaboradores del sector de la movilidad, financiación o seguros para que realicen campañas de marketing propias. En ese caso, dichos terceros actúan como responsables independientes del tratamiento y se rigen por sus propias políticas de privacidad. Carswiseai facilitará al usuario la identidad de dichos terceros cuando los datos vayan a ser cedidos.",
          "El usuario puede revocar este consentimiento en cualquier momento haciendo clic en el enlace de baja incluido en cualquier comunicación, o escribiendo a soporte@carswiseai.com. La revocación no afecta a la licitud del tratamiento previo.",
          "Actualmente los envíos de campañas se realizan mediante el servicio Resend. [PENDIENTE: actualizar si se integra una plataforma de email marketing específica como Mailchimp, Brevo, etc.]",
        ],
      },
      {
        heading: "5. Experian y consulta de solvencia",
        paragraphs: [
          "Para determinadas operaciones de renting o financiación, y siempre con consentimiento previo y expreso del usuario, Carswiseai puede transmitir sus datos a Experian Bureau de Crédito S.A. (NIF [PENDIENTE], domiciliada en [PENDIENTE]) para consultar información de solvencia patrimonial en ficheros de información crediticia y ante organismos públicos.",
          "La finalidad exclusiva de esta consulta es valorar la viabilidad económica de la operación solicitada. El usuario tiene derecho a conocer el resultado de la consulta y a ejercer sus derechos de acceso, rectificación y cancelación directamente ante Experian (www.experian.es).",
          "Este consentimiento es independiente y revocable en cualquier momento. Su denegación únicamente puede afectar a la tramitación de la operación de renting o financiación concreta.",
        ],
      },
      {
        heading: "6. Destinatarios y encargados del tratamiento",
        paragraphs: [
          "Sus datos podrán comunicarse a los proveedores de vehículos (concesionarios, empresas de renting como Leasys o Astara) con los que el usuario haya iniciado una solicitud, exclusivamente para su gestión.",
          "Carswiseai cuenta con los siguientes encargados del tratamiento que actúan bajo contrato de encargo conforme al art. 28 RGPD: Vercel Inc. (alojamiento web y serverless), Supabase Inc. (almacenamiento de archivos), Neon Inc. (base de datos PostgreSQL), Resend Inc. (envío de correo electrónico transaccional y comercial), Stripe Inc. (procesamiento de pagos).",
          "Algunos de estos proveedores están establecidos fuera del Espacio Económico Europeo (EE. UU.). Las transferencias se amparan en las Cláusulas Contractuales Tipo aprobadas por la Comisión Europea o en decisiones de adecuación vigentes.",
          "No se ceden datos a terceros con fines publicitarios propios salvo consentimiento expreso.",
        ],
      },
      {
        heading: "7. Plazos de conservación",
        bullets: [
          "Datos de cuenta activa: durante toda la relación contractual.",
          "Datos de cuenta tras baja: 5 años para atender posibles responsabilidades y reclamaciones.",
          "Datos de solicitudes y leads: 3 años desde el cierre de la solicitud o el último contacto.",
          "Datos de facturación y contratos: 6 años (art. 30 Código de Comercio y normativa fiscal).",
          "Datos de navegación y analítica: máximo 25 meses desde su captación.",
          "Comunicaciones comerciales y marketing: hasta que el usuario revoque el consentimiento.",
          "Datos de consulta Experian: el mínimo imprescindible para la operación, con el límite legal aplicable.",
        ],
      },
      {
        heading: "8. Derechos de los interesados",
        paragraphs: [
          "Puede ejercer en cualquier momento los siguientes derechos: acceso (conocer qué datos tratamos), rectificación (corregir datos inexactos), supresión (solicitar el borrado cuando proceda), oposición, limitación del tratamiento, portabilidad (recibir sus datos en formato estructurado) y derecho a no ser objeto de decisiones automatizadas con efectos significativos.",
          "Para ejercer cualquiera de estos derechos, envíe un escrito a soporte@carswiseai.com indicando nombre, apellidos y copia de su DNI o documento equivalente. Responderemos en el plazo máximo de un mes, prorrogable a tres en casos complejos.",
          "Si considera que sus derechos no han sido atendidos o que el tratamiento vulnera la normativa, puede presentar reclamación ante la Agencia Española de Protección de Datos (AEPD), www.aepd.es, C/ Jorge Juan 6, 28001 Madrid.",
        ],
      },
      {
        heading: "9. Seguridad",
        paragraphs: [
          "Carswiseai aplica medidas técnicas y organizativas adecuadas al riesgo: cifrado de comunicaciones (TLS/HTTPS), control de accesos por roles, autenticación segura, copias de seguridad periódicas y procedimientos documentados de gestión de incidencias.",
          "En caso de brecha de seguridad que pueda suponer un riesgo para los derechos y libertades de los interesados, Carswiseai notificará a la AEPD en un plazo máximo de 72 horas y, cuando el riesgo sea alto, comunicará el incidente a los afectados sin dilación indebida.",
        ],
      },
      {
        heading: "10. Menores de edad",
        paragraphs: [
          "Los servicios de Carswiseai están dirigidos exclusivamente a mayores de 18 años. No recabamos conscientemente datos de menores. Si detectáramos que hemos recibido datos de un menor sin consentimiento verificable de sus tutores legales, procederemos a su supresión inmediata.",
        ],
      },
      {
        heading: "11. Actualizaciones de esta política",
        paragraphs: [
          "Esta Política de Privacidad puede actualizarse para adaptarse a cambios normativos, jurisprudenciales o del propio servicio. La versión vigente, con su fecha de actualización, estará siempre disponible en carswiseai.com/politica-privacidad. Para cambios sustanciales, notificaremos a los usuarios registrados por correo electrónico.",
        ],
      },
    ],
  },
  cookiePolicy: {
    title: "Política de cookies",
    summary:
      "Información sobre las cookies y tecnologías similares utilizadas en carswiseai.com, su finalidad y cómo puede gestionar o revocar su consentimiento.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "1. ¿Qué son las cookies?",
        paragraphs: [
          "Las cookies son pequeños archivos de texto que los sitios web almacenan en el navegador o dispositivo del usuario durante la visita. Permiten al sitio recordar información sobre la visita, como el idioma preferido y otras opciones, facilitando la navegación y la experiencia de uso.",
          "De forma análoga, se utilizan otras tecnologías de almacenamiento local (localStorage, sessionStorage) con fines similares.",
        ],
      },
      {
        heading: "2. Cookies utilizadas en carswiseai.com",
        bullets: [
          "Cookies técnicas / necesarias: imprescindibles para el funcionamiento del sitio. Incluyen la gestión de sesión de usuario autenticado, el almacenamiento del consentimiento de cookies y las preferencias de idioma o tema. No requieren consentimiento previo.",
          "Cookies de personalización: almacenan preferencias del usuario (filtros guardados, alertas, configuración de la cuenta) para personalizar la experiencia en sucesivas visitas. Se activan con el consentimiento del usuario.",
          "Cookies analíticas (propias): registran datos sobre el comportamiento de navegación (páginas vistas, tiempo de sesión, origen de la visita) de forma agregada para mejorar el servicio. Se activan con el consentimiento del usuario.",
          "Cookies de marketing / terceros: permiten mostrar publicidad o comunicaciones relevantes en función del comportamiento de navegación, así como compartir información con plataformas de terceros para fines de retargeting. Se activan únicamente con consentimiento expreso.",
        ],
      },
      {
        heading: "3. Identificadores de sesión propios",
        paragraphs: [
          "Carswiseai utiliza un identificador anónimo de sesión (cw_anon_id) almacenado en localStorage para reconocer una misma sesión de navegación y mejorar la coherencia del servicio. Este identificador no contiene datos personales identificables por sí mismo y se asocia a un correo electrónico únicamente cuando el usuario se registra o inicia sesión.",
          "Los parámetros de campaña (UTM) se almacenan en sessionStorage (cw_utm) durante la sesión activa para medir la eficacia de las acciones de marketing.",
        ],
      },
      {
        heading: "4. Base legal y gestión del consentimiento",
        paragraphs: [
          "Las cookies técnicas se instalan sin necesidad de consentimiento previo al amparo del interés legítimo y la necesidad para la prestación del servicio. El resto de cookies requieren consentimiento previo, libre, específico, informado e inequívoco del usuario.",
          "Al acceder por primera vez a carswiseai.com, se solicita el consentimiento mediante el panel de preferencias integrado en el formulario de acceso. El usuario puede aceptar todas las cookies, solo las necesarias, o configurar sus preferencias de forma granular.",
          "El consentimiento otorgado queda registrado con fecha y versión de política. Puede revocarlo o modificarlo en cualquier momento desde el pie de página de la web.",
        ],
      },
      {
        heading: "5. Cookies de terceros",
        paragraphs: [
          "Carswiseai puede integrar servicios de terceros que instalan sus propias cookies. Estos terceros disponen de sus propias políticas de cookies a las que el usuario puede acceder en sus respectivos sitios web.",
          "Los principales terceros cuyas tecnologías pueden estar presentes son: Stripe (procesamiento de pagos), Resend (envío de emails), Vercel (hosting y analítica de rendimiento). [PENDIENTE: revisar y completar la lista según integraciones activas].",
        ],
      },
      {
        heading: "6. Cómo configurar o eliminar las cookies",
        paragraphs: [
          "Puede configurar su navegador para bloquear o eliminar cookies. A continuación, los enlaces a las instrucciones de los principales navegadores: Chrome (Configuración › Privacidad › Cookies), Firefox (Preferencias › Privacidad), Safari (Preferencias › Privacidad), Edge (Configuración › Cookies).",
          "Tenga en cuenta que la desactivación de cookies técnicas puede impedir el correcto funcionamiento de la plataforma, incluido el inicio de sesión.",
        ],
      },
      {
        heading: "7. Actualizaciones de esta política",
        paragraphs: [
          "Esta Política de Cookies puede actualizarse cuando se incorporen nuevas tecnologías o cambie la normativa aplicable. La fecha de última actualización figura al inicio del documento. Le recomendamos revisarla periódicamente.",
        ],
      },
    ],
  },
  termsConditions: {
    title: "Condiciones generales de uso",
    summary:
      "Condiciones que regulan el acceso, registro y uso de los servicios del marketplace y plataforma de movilidad de Carswiseai.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "1. Objeto y aceptación",
        paragraphs: [
          "Las presentes Condiciones Generales de Uso regulan el acceso y uso de la plataforma Carswiseai (carswiseai.com), incluyendo el marketplace de vehículos de ocasión, el servicio de renting, las herramientas de asesoramiento y todas las funcionalidades disponibles para usuarios registrados.",
          "El acceso, registro o uso de cualquier servicio de Carswiseai implica la aceptación expresa e íntegra de estas Condiciones, así como de la Política de Privacidad y la Política de Cookies. Si no está de acuerdo, debe abstenerse de usar la plataforma.",
          "Carswiseai se reserva el derecho a modificar estas Condiciones. Los cambios se publicarán con indicación de la fecha de actualización. El uso continuado de la plataforma tras la publicación de cambios implicará su aceptación.",
        ],
      },
      {
        heading: "2. Registro y cuenta de usuario",
        bullets: [
          "El acceso a las funcionalidades del marketplace requiere registro previo. El usuario debe ser mayor de 18 años y proporcionar información veraz, completa y actualizada.",
          "El usuario es el único responsable de mantener la confidencialidad de sus credenciales de acceso y de toda la actividad realizada desde su cuenta.",
          "Ante cualquier uso no autorizado de la cuenta o incidencia de seguridad, el usuario debe notificarlo inmediatamente a soporte@carswiseai.com.",
          "Carswiseai puede suspender o cancelar cuentas que incumplan estas Condiciones o que realicen un uso fraudulento o abusivo del servicio.",
        ],
      },
      {
        heading: "3. Naturaleza del servicio de marketplace",
        paragraphs: [
          "Carswiseai actúa como plataforma de intermediación que conecta a usuarios interesados en vehículos con proveedores (concesionarios, empresas de renting u otros). Carswiseai no es parte en los contratos de compraventa o arrendamiento que se formalicen entre el usuario y el proveedor.",
          "La información sobre vehículos (precio, características, disponibilidad, fotografías) es proporcionada por los proveedores. Carswiseai no garantiza la exactitud, completitud o vigencia de dicha información y no asume responsabilidad por errores u omisiones en los listados.",
          "El envío de una solicitud de información, visita o renting a través de la plataforma no genera ningún compromiso contractual entre el usuario y Carswiseai ni entre el usuario y el proveedor hasta que ambas partes formalicen el contrato correspondiente.",
        ],
      },
      {
        heading: "4. Solicitudes de renting",
        paragraphs: [
          "Las solicitudes de renting tramitadas a través de Carswiseai son gestionadas por las empresas proveedoras de renting (Leasys, Astara u otras). La aprobación, condiciones y contrato definitivo dependen exclusivamente del proveedor y de los requisitos de solvencia del solicitante.",
          "Carswiseai facilita el proceso de solicitud pero no garantiza la concesión del renting ni las condiciones ofertadas, que pueden variar según la política comercial y de riesgo del proveedor.",
        ],
      },
      {
        heading: "5. Planes de servicio, pagos y cancelación",
        paragraphs: [
          "Carswiseai puede ofrecer planes de suscripción o servicios de valor añadido con coste. Los precios, condiciones y períodos de facturación se indicarán claramente antes de la contratación.",
          "El procesamiento de pagos se realiza a través de Stripe Inc. Carswiseai no almacena datos de tarjetas de crédito o débito en sus sistemas.",
          "Cancelación de suscripción: el usuario puede cancelar su plan en cualquier momento desde su área de cuenta. La cancelación tendrá efecto al finalizar el período de facturación en curso, sin derecho a reembolso proporcional del período restante, salvo que la ley de consumidores aplicable establezca lo contrario.",
          "Derecho de desistimiento: los consumidores que contraten un plan de forma online disponen de un plazo de 14 días naturales desde la contratación para ejercer el derecho de desistimiento sin necesidad de justificación, conforme al art. 102 del Real Decreto Legislativo 1/2007 (TRLGDCU), salvo que el servicio haya comenzado a ejecutarse con consentimiento expreso del usuario antes de que expire dicho plazo.",
          "Para ejercer el derecho de desistimiento o solicitar un reembolso, envíe un escrito a soporte@carswiseai.com indicando su nombre, número de cuenta/pedido y el motivo.",
          "[PENDIENTE: especificar precios y planes concretos cuando estén definidos]",
        ],
      },
      {
        heading: "6. Intermediación en renting y financiación",
        paragraphs: [
          "Carswiseai actúa como plataforma de intermediación que facilita el contacto entre el usuario y empresas proveedoras de renting (entre otras, Leasys Mobility S.L. y Astara). Carswiseai no es entidad financiera ni prestamista, y no concede financiación propia.",
          "Las operaciones de renting se formalizan directamente entre el usuario y el proveedor de renting, que es quien evalúa la solvencia, establece las condiciones del contrato y asume los derechos y obligaciones derivados del mismo.",
          "En caso de que la tramitación de una solicitud requiera la consulta de información de solvencia del usuario (con su consentimiento expreso), dicha consulta se realizará a través de Experian Bureau de Crédito S.A. conforme a lo establecido en la Política de Privacidad.",
          "[PENDIENTE: indicar si Carswiseai está registrada como intermediario de crédito inmobiliario o de crédito al consumo ante el Banco de España, o si opera exclusivamente como generador de leads para las empresas de renting]",
        ],
      },
      {
        heading: "7. Obligaciones del usuario",
        bullets: [
          "Usar la plataforma de forma lícita, diligente y conforme a las presentes Condiciones y a la legislación vigente.",
          "Proporcionar información veraz en el registro y en los formularios de solicitud.",
          "No suplantar la identidad de otras personas ni facilitar datos personales de terceros sin su consentimiento.",
          "No realizar acciones que sobrecarguen, interfieran o dañen la infraestructura técnica de la plataforma.",
          "No utilizar la plataforma con fines ilícitos, fraudulentos o contrarios a derechos de terceros.",
          "No publicar, transmitir ni compartir contenidos ilícitos, difamatorios, obscenos o que vulneren derechos de propiedad intelectual.",
        ],
      },
      {
        heading: "8. Limitación de responsabilidad",
        paragraphs: [
          "Carswiseai no garantiza la disponibilidad ininterrumpida del servicio. En la medida en que lo permita la ley, Carswiseai queda exonerada de responsabilidad por daños derivados de interrupciones técnicas, errores en la plataforma o ataques informáticos.",
          "Carswiseai no asume responsabilidad por el incumplimiento de las obligaciones contraídas entre el usuario y el proveedor del vehículo o servicio de renting.",
          "La responsabilidad máxima de Carswiseai frente al usuario, en cualquier caso, no podrá superar el importe abonado por este en los 12 meses anteriores al hecho causante del daño.",
        ],
      },
      {
        heading: "9. Propiedad intelectual",
        paragraphs: [
          "Todos los derechos de propiedad intelectual e industrial sobre la plataforma, su código, diseño, contenidos y marca pertenecen a Carswiseai o a sus licenciantes. El usuario no adquiere ningún derecho sobre ellos por el mero uso del servicio.",
          "Queda prohibida la reproducción, copia, distribución, transformación o comunicación pública de los contenidos de la plataforma sin autorización expresa y por escrito de Carswiseai.",
        ],
      },
      {
        heading: "10. Protección de datos",
        paragraphs: [
          "El tratamiento de los datos personales del usuario se rige por la Política de Privacidad de Carswiseai, disponible en carswiseai.com/politica-privacidad, que forma parte integrante de estas Condiciones.",
        ],
      },
      {
        heading: "11. Legislación aplicable y resolución de disputas",
        paragraphs: [
          "Las presentes Condiciones se rigen por la legislación española. Para la resolución de conflictos, las partes se someten a la jurisdicción de los Juzgados y Tribunales del domicilio del usuario, salvo que la normativa de consumo establezca un fuero imperativo distinto.",
          "La Comisión Europea facilita una plataforma de resolución de litigios en línea (ODR) accesible en https://ec.europa.eu/consumers/odr para consumidores de la UE.",
          "[PENDIENTE: indicar si la empresa está adherida a algún sistema de arbitraje de consumo]",
        ],
      },
    ],
  },
  marketingPolicy: {
    title: "Política de Comunicaciones Comerciales",
    summary:
      "Información sobre cómo utilizamos sus datos para enviarle comunicaciones comerciales de Carswiseai y socios seleccionados, y cómo puede cancelarlas en cualquier momento.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "1. ¿Qué son las comunicaciones comerciales?",
        paragraphs: [
          "Las comunicaciones comerciales son mensajes enviados por correo electrónico, SMS u otros canales digitales con el fin de informarle sobre novedades de Carswiseai, ofertas de vehículos, promociones de renting y servicios de socios comerciales relevantes para su experiencia de movilidad.",
        ],
      },
      {
        heading: "2. Base jurídica del tratamiento",
        paragraphs: [
          "El envío de comunicaciones comerciales propias de Carswiseai a usuarios registrados se basa en el interés legítimo de mantener informados a sus clientes sobre servicios similares a los contratados (art. 21.2 LSSI-CE).",
          "El envío de comunicaciones de terceros socios requiere su consentimiento expreso, que puede otorgar a través del checkbox de comunicaciones en el formulario de registro.",
        ],
      },
      {
        heading: "3. Qué datos utilizamos",
        bullets: [
          "Nombre y dirección de correo electrónico.",
          "Preferencias de búsqueda y tipo de vehículo declaradas durante el uso de la plataforma.",
          "Historial de solicitudes e interacciones con el marketplace (solo para personalización).",
          "Nunca compartimos su número de teléfono con socios comerciales sin consentimiento adicional.",
        ],
      },
      {
        heading: "4. Destinatarios de sus datos",
        paragraphs: [
          "Sus datos pueden ser compartidos con las siguientes categorías de socios para el envío de comunicaciones, únicamente si ha prestado su consentimiento:",
        ],
        bullets: [
          "Empresas de renting (Leasys Mobility, Astara u otras) para el envío de ofertas de renting.",
          "Concesionarios oficiales colaboradores de la plataforma.",
          "Proveedores de servicios de email marketing (actualmente Resend Inc.) que actúan como encargados del tratamiento.",
        ],
      },
      {
        heading: "5. Cómo cancelar las comunicaciones",
        paragraphs: [
          "Puede retirar su consentimiento en cualquier momento, sin que ello afecte a la validez de los tratamientos previos:",
        ],
        bullets: [
          "Haciendo clic en el enlace 'Darme de baja' incluido en cualquier comunicación comercial.",
          "Desde el área de cuenta de Carswiseai, sección 'Notificaciones y privacidad'.",
          "Enviando un correo a privacidad@carswiseai.com indicando su nombre y dirección de email.",
        ],
      },
      {
        heading: "6. Conservación de los datos",
        paragraphs: [
          "Sus datos se utilizarán con esta finalidad mientras mantenga una cuenta activa en Carswiseai o hasta que revoque su consentimiento. En todo caso, se suprimirán cuando cese la finalidad para la que fueron recabados.",
        ],
      },
      {
        heading: "7. Sus derechos",
        paragraphs: [
          "Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad de sus datos enviando un escrito a privacidad@carswiseai.com con copia de su documento identificativo. Tiene derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).",
        ],
      },
    ],
  },
  experianPolicy: {
    title: "Política de Consulta de Solvencia — Experian",
    summary:
      "Información sobre la consulta de datos de solvencia ante Experian Bureau de Crédito S.A. en el contexto de solicitudes de renting, y sus derechos como interesado.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "1. ¿Qué es Experian y para qué se usa?",
        paragraphs: [
          "Experian Bureau de Crédito S.A. es una entidad de información crediticia registrada en España. Carswiseai puede consultar datos de solvencia del solicitante ante Experian cuando lo requiera la empresa de renting o financiación, y siempre con el consentimiento expreso del interesado.",
          "Esta consulta permite a las empresas de renting (Leasys Mobility, Astara u otras) evaluar la viabilidad de la solicitud antes de emitir una oferta vinculante.",
        ],
      },
      {
        heading: "2. Datos que se consultan",
        bullets: [
          "Datos identificativos: nombre completo, DNI/NIF, fecha de nacimiento.",
          "Situación crediticia: historial de pagos, incidencias de impago registradas, nivel de endeudamiento.",
          "Información de organismos públicos: CIRBE (Banco de España), Registro de Aceptaciones Impagadas (RAI), ASNEF u otros ficheros equivalentes.",
        ],
      },
      {
        heading: "3. Base jurídica",
        paragraphs: [
          "La consulta se basa en el consentimiento expreso del interesado (art. 6.1.a RGPD), otorgado de forma específica y separada a través del checkbox habilitado en el formulario de solicitud.",
          "Sin dicho consentimiento, Carswiseai no realizará la consulta, lo que puede afectar a la aprobación por parte del proveedor de renting.",
        ],
      },
      {
        heading: "4. Responsabilidad de Experian",
        paragraphs: [
          "Experian Bureau de Crédito S.A. actúa como responsable independiente del tratamiento de los datos contenidos en sus ficheros. Para más información sobre cómo Experian trata sus datos, consulte la Política de Privacidad de Experian en www.experian.es.",
          "Carswiseai actúa como remitente de la consulta, sin almacenar el contenido del informe de solvencia salvo en los términos acordados con el proveedor de renting.",
        ],
      },
      {
        heading: "5. Cómo revocar el consentimiento",
        paragraphs: [
          "Puede revocar su consentimiento antes de que la consulta se realice contactando con nosotros en privacidad@carswiseai.com. La revocación no afectará a consultas ya realizadas. Si revoca el consentimiento después de iniciada la tramitación, es posible que el proveedor no pueda continuar con la evaluación.",
        ],
      },
      {
        heading: "6. Sus derechos ante Experian",
        paragraphs: [
          "Puede ejercer sus derechos de acceso, rectificación y cancelación de los datos incluidos en los ficheros de Experian directamente ante Experian Bureau de Crédito S.A. en www.experian.es/derechos-arco.",
          "Ante Carswiseai, puede ejercer sus derechos enviando un escrito a privacidad@carswiseai.com con copia de su documento identificativo.",
        ],
      },
      {
        heading: "7. Conservación",
        paragraphs: [
          "Los datos de la consulta quedarán registrados conforme a la normativa española y comunitaria de protección de datos, y podrán conservarse durante el tiempo necesario para la prestación del servicio o el cumplimiento de obligaciones legales.",
        ],
      },
    ],
  },
  experianTerms: {
    title: "Condiciones del Servicio de Consulta de Solvencia",
    summary:
      "Condiciones que regulan el uso del servicio de consulta de solvencia ante Experian Bureau de Crédito S.A. tramitado a través de la plataforma Carswiseai en el contexto de solicitudes de renting.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "1. Objeto del servicio",
        paragraphs: [
          "El presente servicio consiste en la tramitación, por parte de Carswiseai, de una consulta de solvencia del usuario ante Experian Bureau de Crédito S.A., a solicitud del proveedor de renting o financiación elegido por el usuario y con el consentimiento expreso de este.",
          "La consulta tiene como única finalidad facilitar al proveedor de renting la evaluación de la viabilidad financiera de la solicitud. Carswiseai actúa exclusivamente como intermediario en la tramitación, sin tomar decisiones sobre la concesión ni las condiciones del renting.",
        ],
      },
      {
        heading: "2. Activación del servicio",
        paragraphs: [
          "El servicio se activa única y exclusivamente cuando el usuario otorga su consentimiento expreso a través del checkbox habilitado a tal efecto en el formulario de solicitud. Sin dicho consentimiento, Carswiseai no tramitará ninguna consulta ante Experian.",
          "El usuario puede optar por no activar este servicio. En ese caso, el proveedor de renting podrá requerir que el usuario aporte directamente la documentación de solvencia que considere necesaria para evaluar la solicitud.",
        ],
      },
      {
        heading: "3. Obligaciones de Carswiseai",
        bullets: [
          "Tramitar la consulta únicamente con el consentimiento previo y expreso del usuario.",
          "No utilizar el resultado de la consulta para ninguna finalidad distinta de la evaluación de la solicitud de renting concreta.",
          "No compartir el resultado de la consulta con terceros ajenos al proceso de tramitación de la solicitud.",
          "Informar al usuario de su derecho a revocar el consentimiento antes de que la consulta se ejecute.",
        ],
      },
      {
        heading: "4. Obligaciones del usuario",
        bullets: [
          "Proporcionar datos identificativos veraces y actualizados (nombre, DNI/NIF, fecha de nacimiento) para la correcta realización de la consulta.",
          "No facilitar datos de terceros sin su consentimiento.",
          "Aceptar que el resultado de la consulta puede condicionar la aprobación o las condiciones ofertadas por el proveedor de renting.",
        ],
      },
      {
        heading: "5. Resultado de la consulta",
        paragraphs: [
          "El resultado de la consulta de solvencia es gestionado directamente por el proveedor de renting para la evaluación interna de la solicitud. Carswiseai no tiene acceso al detalle del informe ni toma decisiones basadas en su contenido.",
          "Una consulta con resultado negativo no implica necesariamente la denegación de la solicitud; el proveedor de renting puede solicitar documentación adicional o proponer condiciones alternativas.",
        ],
      },
      {
        heading: "6. Duración y revocación",
        paragraphs: [
          "El consentimiento para la consulta es válido exclusivamente para la solicitud de renting concreta en la que se otorga. No implica consentimiento para consultas futuras, que requerirán una nueva aceptación expresa.",
          "El usuario puede revocar su consentimiento antes de que la consulta se realice efectivamente, contactando con Carswiseai en privacidad@carswiseai.com. Una vez ejecutada la consulta, la revocación no podrá retrotraer sus efectos.",
        ],
      },
      {
        heading: "7. Limitación de responsabilidad",
        paragraphs: [
          "Carswiseai no garantiza un resultado favorable de la consulta de solvencia ni la aprobación de la solicitud de renting por parte del proveedor.",
          "Carswiseai no será responsable de los daños o perjuicios que pudieran derivarse de una resolución negativa del proveedor de renting basada en el resultado de la consulta.",
        ],
      },
      {
        heading: "8. Normativa aplicable",
        paragraphs: [
          "El presente servicio se rige por la legislación española, incluyendo el Reglamento (UE) 2016/679 (RGPD), la Ley Orgánica 3/2018 (LOPDGDD), y la normativa de ordenación del crédito al consumo y del crédito inmobiliario aplicable.",
        ],
      },
    ],
  },
};

const LEGAL_DOCUMENTS_EN = {
  legalNotice: {
    title: "Legal Notice",
    summary:
      "General information on ownership, scope of service, intellectual property and responsibilities for use of the platform.",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "Identifying information",
        paragraphs: [
          "CarsWise is a digital platform focused on mobility advisory and operations in Spain.",
          "For general contact, support and incident management you can reach us at soporte@carswise.es.",
        ],
      },
      {
        heading: "Purpose of the website",
        paragraphs: [
          "This site provides recommendation, comparison and mobility service management tools, as well as support features for registered users.",
          "The information displayed is informational and decision-support in nature and does not constitute binding financial, legal or tax advice.",
        ],
      },
      {
        heading: "Permitted use and prohibitions",
        bullets: [
          "The user agrees to use the platform in accordance with the law, good faith and public order.",
          "Fraudulent use, unauthorised automated data extraction and any attempt to alter the functioning of the service are prohibited.",
          "CarsWise may update, improve or withdraw features to maintain security, performance and quality of service.",
        ],
      },
      {
        heading: "Intellectual property",
        paragraphs: [
          "The CarsWise brand, the platform design, its functional architecture, content, code and graphic elements are owned by their owners or licensors.",
          "Their reproduction, distribution or transformation without express authorisation is not permitted except where legally allowed.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "CarsWise does not guarantee permanent and uninterrupted availability of the service, although it applies reasonable measures to maintain continuity.",
          "Final contracting or buying/selling decisions rest with the user and, where applicable, the third-party provider with whom they formalise the transaction.",
        ],
      },
    ],
  },
  privacyPolicy: {
    title: "Privacy Policy",
    summary:
      "Information on personal data processing in accordance with the GDPR (EU 2016/679) and applicable data protection legislation.",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "Categories of data processed",
        bullets: [
          "Identification and account data: name, email address, user and session identifiers.",
          "Usage and browsing data: interactions with the advisor, preferences, filters, activity and functional events.",
          "Operational data provided voluntarily: service requests, alerts, contact details and data associated with transactions within the platform.",
        ],
      },
      {
        heading: "Purposes of processing",
        bullets: [
          "Manage registration, authentication and maintenance of user accounts.",
          "Provide recommendation, comparison and mobility management features.",
          "Maintain security, prevent abuse and optimise service performance.",
          "Send operational communications essential for service delivery.",
        ],
      },
      {
        heading: "Legal bases",
        bullets: [
          "Performance of the contractual or pre-contractual relationship when the user requests platform features.",
          "Compliance with applicable legal obligations.",
          "Legitimate interest in security, service continuity and platform improvement.",
          "Consent where required for certain purposes (e.g., certain cookies or communications).",
        ],
      },
      {
        heading: "Data retention",
        paragraphs: [
          "Data is retained for as long as necessary to fulfil the purpose for which it was collected and, subsequently, for the legally required periods.",
          "Where applicable, data will be blocked and processed exclusively to address potential legal liabilities.",
        ],
      },
      {
        heading: "Recipients and transfers",
        paragraphs: [
          "Data is generally not shared with third parties unless required by law or necessary for the provision of technology services linked to the platform.",
          "Where providers are located outside the European Economic Area, appropriate safeguards in accordance with the GDPR will be applied.",
        ],
      },
      {
        heading: "User rights",
        paragraphs: [
          "You can exercise your rights of access, rectification, erasure, objection, restriction of processing and portability by writing to soporte@carswise.es.",
          "If you consider that your rights have not been properly addressed, you can lodge a complaint with the Spanish Data Protection Agency (AEPD).",
        ],
      },
    ],
  },
  cookiePolicy: {
    title: "Cookie Policy",
    summary:
      "Information on the use of cookies and similar technologies, their purpose and how to manage consent.",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "What are cookies",
        paragraphs: [
          "Cookies are files stored on the user's device that allow browsing to be recognised, preferences to be remembered and the experience to be improved.",
        ],
      },
      {
        heading: "Types of cookies used",
        bullets: [
          "Technical or necessary cookies: essential for access, authentication and basic service operation.",
          "Preference cookies: preserve the user's settings and choices to personalise the experience.",
          "Analytical cookies: allow the use of the service to be evaluated and features to be improved.",
        ],
      },
      {
        heading: "Legal basis and consent",
        paragraphs: [
          "Necessary cookies are used to ensure the functioning of the platform. Others are managed in accordance with user consent where required.",
          "On first access, acceptance is requested to enable the full experience and record the consent preference.",
        ],
      },
      {
        heading: "How to withdraw or modify consent",
        paragraphs: [
          "You can modify cookie settings from your browser settings and, where applicable, from mechanisms enabled by the platform.",
          "Disabling certain cookies may affect the availability of some features.",
        ],
      },
    ],
  },
  termsConditions: {
    title: "Terms and Conditions",
    summary:
      "General conditions of use of the service, obligations of the parties and limits of liability.",
    updatedAt: "13/04/2026",
    sections: [
      {
        heading: "Acceptance of terms",
        paragraphs: [
          "Access to and use of CarsWise implies acceptance of these terms and conditions.",
          "If you do not agree with the terms, you must refrain from using the platform.",
        ],
      },
      {
        heading: "Scope and nature of the service",
        paragraphs: [
          "CarsWise provides recommendations and support tools for mobility, buying, selling and associated service decisions.",
          "The platform does not replace the contractual or technical review that the user must carry out before closing transactions with third parties.",
        ],
      },
      {
        heading: "User account and security",
        bullets: [
          "The user is responsible for keeping their credentials safe and for all activity carried out on their account.",
          "Any unauthorised use or security incident must be reported as soon as it is detected.",
        ],
      },
      {
        heading: "Usage obligations",
        bullets: [
          "Use the service in a lawful, diligent manner and in accordance with these terms.",
          "Do not manipulate, interfere with or take actions that compromise the security, stability or integrity of the system.",
          "Do not use the service for unlawful purposes or purposes contrary to the rights of third parties.",
        ],
      },
      {
        heading: "Limitation of liability",
        paragraphs: [
          "CarsWise does not guarantee specific financial results and accepts no liability for final decisions made by the user.",
          "Contractual relationships with third-party providers are the direct responsibility of the parties involved.",
        ],
      },
      {
        heading: "Amendments and validity",
        paragraphs: [
          "CarsWise may update these terms to adapt them to regulatory, technical or service changes.",
          "The current version will always be available in the legal section of the platform.",
        ],
      },
    ],
  },
  marketingPolicy: {
    title: "Commercial Communications Policy",
    summary: "Information on how we use your data to send you commercial communications from Carswiseai and selected partners, and how you can opt out at any time.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "What are commercial communications?",
        paragraphs: [
          "Commercial communications are messages sent by email, SMS or other digital channels to inform you about Carswiseai news, vehicle offers, renting promotions and services of commercial partners relevant to your mobility experience.",
        ],
      },
      {
        heading: "Legal basis",
        paragraphs: [
          "Sending of Carswiseai's own commercial communications to registered users is based on legitimate interest in keeping clients informed about similar contracted services (art. 21.2 LSSI-CE). Sending communications from third-party partners requires your express consent.",
        ],
      },
      {
        heading: "How to unsubscribe",
        bullets: [
          "Click the 'Unsubscribe' link in any commercial communication.",
          "From your Carswiseai account area, under 'Notifications and privacy'.",
          "Send an email to privacidad@carswiseai.com with your name and email address.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You may exercise rights of access, rectification, erasure, objection, restriction and portability by writing to privacidad@carswiseai.com with a copy of your identity document. You have the right to lodge a complaint with the Spanish Data Protection Agency (www.aepd.es).",
        ],
      },
    ],
  },
  experianPolicy: {
    title: "Creditworthiness Check Policy — Experian",
    summary: "Information on the creditworthiness data check with Experian Bureau de Crédito S.A. in the context of renting applications, and your rights as a data subject.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "What is Experian and why is it used?",
        paragraphs: [
          "Experian Bureau de Crédito S.A. is a credit information entity registered in Spain. Carswiseai may check the applicant's creditworthiness with Experian when required by the renting or financing company, and always with the data subject's express consent.",
        ],
      },
      {
        heading: "Data checked",
        bullets: [
          "Identifying data: full name, DNI/NIF, date of birth.",
          "Credit situation: payment history, registered defaults, level of indebtedness.",
          "Public registry information: CIRBE (Banco de España), RAI, ASNEF or equivalent files.",
        ],
      },
      {
        heading: "Legal basis",
        paragraphs: [
          "The check is based on the data subject's express consent (art. 6.1.a GDPR), given specifically and separately through the checkbox in the application form. Without this consent, Carswiseai will not carry out the check.",
        ],
      },
      {
        heading: "How to revoke consent",
        paragraphs: [
          "You may revoke your consent before the check is carried out by contacting us at privacidad@carswiseai.com. You may exercise your rights directly with Experian at www.experian.es/derechos-arco, and with Carswiseai at privacidad@carswiseai.com.",
        ],
      },
    ],
  },
  experianTerms: {
    title: "Creditworthiness Check Service Terms",
    summary: "Terms governing the use of the creditworthiness check service with Experian Bureau de Crédito S.A. processed through the Carswiseai platform in the context of renting applications.",
    updatedAt: "17/06/2026",
    sections: [
      {
        heading: "Purpose of the service",
        paragraphs: [
          "This service consists of Carswiseai processing a creditworthiness check on behalf of the user with Experian Bureau de Crédito S.A., at the request of the chosen renting or financing provider and with the user's express consent. Carswiseai acts solely as an intermediary and does not make decisions on the granting or terms of the renting.",
        ],
      },
      {
        heading: "Service activation",
        paragraphs: [
          "The service is activated only when the user gives express consent via the dedicated checkbox in the application form. Without this consent, no check will be processed. The user may opt out, in which case the renting provider may request solvency documentation directly.",
        ],
      },
      {
        heading: "Carswiseai obligations",
        bullets: [
          "Process the check only with prior express consent from the user.",
          "Not use the result for any purpose other than evaluation of the specific renting application.",
          "Not share the result with third parties outside the application process.",
          "Inform the user of their right to revoke consent before the check is executed.",
        ],
      },
      {
        heading: "User obligations",
        bullets: [
          "Provide accurate and up-to-date identifying data (name, DNI/NIF, date of birth).",
          "Not submit data belonging to third parties without their consent.",
          "Accept that the check result may affect the approval or terms offered by the renting provider.",
        ],
      },
      {
        heading: "Check result",
        paragraphs: [
          "The creditworthiness check result is managed directly by the renting provider for internal evaluation. Carswiseai does not have access to the detail of the report and makes no decisions based on its content. A negative result does not necessarily mean the application is refused.",
        ],
      },
      {
        heading: "Duration and revocation",
        paragraphs: [
          "Consent is valid solely for the specific renting application in which it is given. Future applications require a new express acceptance. Consent may be revoked before the check is executed by contacting privacidad@carswiseai.com. Once the check has been carried out, revocation cannot be retroactive.",
        ],
      },
      {
        heading: "Limitation of liability",
        paragraphs: [
          "Carswiseai does not guarantee a favourable check result or approval of the renting application. Carswiseai is not liable for any negative decision made by the renting provider based on the check result.",
        ],
      },
    ],
  },
};

const SEO_STATIC_PAGES = {
  aboutCarswise: {
    badge: "Sobre CarsWise",
    title: "Quienes somos en CarsWise",
    description:
      "CarsWise nace para que cualquier persona compre, gestione y venda su coche con informacion neutral y criterio financiero real.",
    sections: [
      {
        heading: "Mision",
        paragraphs: [
          "Queremos profesionalizar la movilidad del particular con la misma disciplina de analisis y operacion que hoy solo tienen grandes flotas y operadores.",
        ],
      },
      {
        heading: "Que construimos",
        bullets: [
          "Compra: recomendacion de modelo y ranking de oportunidades con foco en coste total.",
          "Gestion: seguimiento del vehiculo, servicios preventivos y trazabilidad completa.",
          "Venta: precio objetivo, certificacion y ejecucion comercial para vender mejor.",
        ],
      },
      {
        heading: "Quienes somos",
        cards: [
          {
            title: "Juan Hernandez",
            subtitle: "Cofundador · Negocio y Operaciones",
            lines: [
              "Trayectoria ejecutiva en renting, seguros y banca.",
              "Responsable de crecimiento comercial, alianzas y ejecucion operativa.",
            ],
          },
          {
            title: "Javier Linares",
            subtitle: "Cofundador · Operaciones y Finanzas",
            lines: [
              "Experiencia en VO, gestion de flotas y operaciones estructuradas.",
              "Lidera pricing, unit economics y control financiero de la plataforma.",
            ],
          },
          {
            title: "Ana Picazo",
            subtitle: "Cofundadora · Tecnologia y Producto",
            lines: [
              "Especialista en software, datos y arquitectura de producto digital.",
              "Dirige la hoja de ruta tecnica y la calidad de la experiencia CarsWise.",
            ],
          },
        ],
      },
      {
        heading: "Nuestros valores",
        bullets: [
          "Transparencia: decisiones basadas en datos y criterio objetivo para el cliente.",
          "Rigor: cada recomendacion combina analisis financiero, contexto de uso y riesgo real.",
          "Ejecucion: convertimos el diagnostico en accion, desde la compra hasta la venta.",
        ],
      },
    ],
  },
  servicesSeo: {
    badge: "Servicios",
    title: "Servicios de movilidad para reducir coste y friccion operativa",
    description:
      "Centraliza seguro, mantenimiento, certificaciones y soporte de gestion para tu vehiculo en un solo flujo.",
    sections: [
      {
        heading: "Seguros con criterio de coste total",
        paragraphs: [
          "Comparamos cobertura, franquicia y precio para reducir gasto sin perder proteccion relevante.",
        ],
      },
      {
        heading: "Mantenimiento preventivo",
        paragraphs: [
          "Planificamos revisiones por uso real para evitar averias inesperadas y mejorar la vida util del coche.",
        ],
      },
      {
        heading: "Soporte de gestion",
        bullets: [
          "Recordatorios de renovaciones y tramites.",
          "Seguimiento de incidencias de servicio.",
          "Visibilidad centralizada desde tu panel.",
        ],
      },
    ],
  },
  contact: {
    badge: "Contacto",
    title: "Contacto CarsWise",
    description:
      "Si necesitas ayuda para compra, renting, venta o servicios de movilidad, te atendemos por email y telefono.",
    sections: [
      {
        heading: "Canales de atencion",
        bullets: [
          "Email: soporte@carswise.es",
          "Telefono: +34 910 000 000",
          "Horario: L-V de 09:00 a 18:00 (Espana)",
        ],
      },
      {
        heading: "Que incluir en tu consulta",
        bullets: [
          "Tipo de operacion: compra, renting, venta o servicio.",
          "Presupuesto aproximado y horizonte de uso.",
          "Contexto del vehiculo actual, si aplica.",
        ],
      },
    ],
  },
};

const PUBLIC_ROUTE_BY_ENTRY_MODE = {
  aboutCarswise: "/sobre-carswise",
  plans: "/planes",
  portalVo: "/marketplace-vo",
  vehicleDetail: "/ficha-vehiculo",
  vehicleOptions: "/asesor-vehiculo",
  servicesSeo: "/servicios",
  blog: "/blog",
  blogCompraUsado: "/blog/guia-compra-coche-segunda-mano-espana",
  blogRentingCompra: "/blog/renting-vs-compra-2026-que-conviene-segun-tu-uso",
  viewingPropose: "/cita/proponer",
  viewingConfirm: "/cita/confirmar",
  contact: "/contacto",
  legalNotice: "/aviso-legal",
  privacyPolicy: "/politica-privacidad",
  cookiePolicy: "/politica-cookies",
  termsConditions: "/terminos-condiciones",
  marketingPolicy: "/politica-comunicaciones",
  experianPolicy: "/politica-experian",
  experianTerms: "/condiciones-experian",
};

const ENTRY_MODE_BY_PUBLIC_ROUTE = Object.entries(PUBLIC_ROUTE_BY_ENTRY_MODE).reduce((acc, [entryMode, path]) => {
  acc[path] = entryMode;
  return acc;
}, {});

const SEO_META_BY_ENTRY_MODE = {
  home: {
    title: "CarsWise AI | Asesor de movilidad para comprar, renting y vender mejor",
    description:
      "CarsWise te ayuda a decidir mejor en compra, renting, venta y servicios del coche con analisis de coste total.",
  },
  aboutCarswise: {
    title: "Sobre CarsWise | Quienes somos y que construimos",
    description:
      "Conoce al equipo fundador de CarsWise y nuestra vision para comprar, gestionar y vender coche con mejor informacion.",
  },
  plans: {
    title: "Planes y precios | CarsWise",
    description:
      "Consulta planes de suscripcion y servicios premium bajo demanda para gestionar mejor tu coche.",
  },
  portalVo: {
    title: "Marketplace VO | Coches de ocasion con enfoque de coste total | CarsWise",
    description:
      "Explora ofertas de vehiculo de ocasion y compara opciones con enfoque de coste total y decision informada.",
  },
  vehicleDetail: {
    title: "Ficha de vehiculo | CarsWise",
    description:
      "Consulta la ficha de una oferta concreta con sus datos clave, analisis y contexto de mercado.",
  },
  vehicleOptions: {
    title: "Asesor de vehiculo | Descubre la mejor operacion para tu caso | CarsWise",
    description:
      "Compara escenarios de compra y renting segun presupuesto, kilometros, uso y objetivos de movilidad.",
  },
  servicesSeo: {
    title: "Servicios de movilidad | Seguro, mantenimiento y gestion | CarsWise",
    description:
      "Centraliza servicios de movilidad para reducir imprevistos y optimizar el coste total de tu vehiculo.",
  },
  blog: {
    title: "Blog de movilidad | Guias utiles de compra, renting y ahorro | CarsWise",
    description:
      "Consejos practicos y comparativas para tomar mejores decisiones de movilidad en Espana.",
  },
  blogCompraUsado: {
    title: "Guia 2026: comprar coche usado en Espana | CarsWise",
    description:
      "Checklist practico para comprar coche de segunda mano con menos riesgo tecnico, legal y financiero.",
  },
  blogRentingCompra: {
    title: "Renting vs compra 2026: que conviene segun tu uso | CarsWise",
    description:
      "Analisis claro para elegir entre renting y compra segun kilometraje, liquidez y horizonte de uso.",
  },
  contact: {
    title: "Contacto | CarsWise",
    description:
      "Contacta con CarsWise para ayuda en compra, renting, venta y servicios de movilidad.",
  },
  legalNotice: {
    title: "Aviso legal | CarsWise",
    description: "Informacion legal sobre titularidad, uso del servicio y responsabilidades.",
  },
  privacyPolicy: {
    title: "Politica de privacidad | CarsWise",
    description: "Como tratamos y protegemos tus datos personales en CarsWise.",
  },
  cookiePolicy: {
    title: "Politica de cookies | CarsWise",
    description: "Informacion sobre cookies, consentimiento y configuracion de preferencias.",
  },
  termsConditions: {
    title: "Terminos y condiciones | CarsWise",
    description: "Condiciones generales de uso de la plataforma CarsWise.",
  },
};

const SITE_URL = "https://www.carswiseai.com";
const SITE_NAME = "CarsWise AI";
const SITE_LOGO_URL = `${SITE_URL}/carswise-logo.png`;
const SITE_IMAGE_URL = `${SITE_URL}/CarWise_app.jpg?v=20260418b`;

function buildBreadcrumbSchema(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildBlogPostingSchema(post = {}) {
  const postUrl = `${SITE_URL}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    mainEntityOfPage: postUrl,
    image: [SITE_IMAGE_URL],
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: SITE_LOGO_URL,
      },
    },
  };
}

function normalizePublicPath(pathname = "") {
  const normalized = String(pathname || "").replace(/\/+$/, "").toLowerCase();
  return normalized || "/";
}

function resolveEntryModeFromPublicPath(pathname = "") {
  const normalizedPath = normalizePublicPath(pathname);
  if (normalizedPath.startsWith("/panel")) {
    return null;
  }

  const vehicleDetailBasePath = normalizePublicPath(getPublicPathForEntryMode("vehicleDetail"));
  if (vehicleDetailBasePath !== "/" && normalizedPath.startsWith(`${vehicleDetailBasePath}/`)) {
    return "vehicleDetail";
  }

  const marketplaceVoBasePath = normalizePublicPath("/marketplace-vo");
  if (normalizedPath.startsWith(`${marketplaceVoBasePath}/`)) {
    return "portalVoDetail";
  }

  return ENTRY_MODE_BY_PUBLIC_ROUTE[normalizedPath] || null;
}

function readMarketplaceVoIdFromPath(pathname = "") {
  const base = "/marketplace-vo";
  const raw = String(pathname || "").replace(/\/+$/, "");
  if (!raw.toLowerCase().startsWith(`${base}/`)) return "";
  const segment = raw.slice(base.length + 1).split("?")[0];
  if (!segment) return "";
  try { return decodeURIComponent(segment); } catch { return segment; }
}

function getPublicPathForEntryMode(entryMode = "") {
  return PUBLIC_ROUTE_BY_ENTRY_MODE[entryMode] || "/";
}

function buildVehicleDetailSharePayload(offer = {}) {
  if (!offer || typeof offer !== "object") {
    return null;
  }

  const allowedKeys = [
    "id",
    "title",
    "description",
    "brand",
    "model",
    "version",
    "price",
    "priceText",
    "monthlyPrice",
    "financePrice",
    "year",
    "mileage",
    "power",
    "powerCv",
    "powerKw",
    "fuel",
    "transmission",
    "bodyType",
    "body",
    "environmentalLabel",
    "label",
    "displacement",
    "co2",
    "traction",
    "doors",
    "seats",
    "color",
    "consumption",
    "nextITV",
    "warrantyMonths",
    "sellerType",
    "dealerName",
    "city",
    "province",
    "portal",
    "url",
    "searchUrl",
    "image",
  ];

  const payload = {};
  allowedKeys.forEach((key) => {
    const value = offer[key];
    if (value !== undefined && value !== null && value !== "") {
      payload[key] = value;
    }
  });

  return Object.keys(payload).length > 0 ? payload : null;
}

function toBase64Url(value = "") {
  try {
    const input = String(value || "");
    if (!input) {
      return "";
    }

    const bytes = new TextEncoder().encode(input);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch (_error) {
    return "";
  }
}

function fromBase64Url(value = "") {
  try {
    const input = String(value || "");
    if (!input) {
      return "";
    }

    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = padded + "=".repeat((4 - (padded.length % 4)) % 4);
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch (_error) {
    return "";
  }
}

function buildVehicleDetailSharePath(offer = {}) {
  const route = getPublicPathForEntryMode("vehicleDetail");
  const offerId = normalizeText(String(offer?.id || ""));
  if (offerId) {
    return `${route}/${encodeURIComponent(offerId)}`;
  }

  const payload = buildVehicleDetailSharePayload(offer);

  if (!payload) {
    return route;
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  if (!encodedPayload) {
    return route;
  }

  return `${route}?vd=${encodedPayload}`;
}

function readVehicleDetailIdFromPath(pathname = "") {
  const basePath = getPublicPathForEntryMode("vehicleDetail");
  const rawPath = String(pathname || "").replace(/\/+$/, "") || "/";

  if (!rawPath.startsWith(`${basePath}/`)) {
    return "";
  }

  const encodedId = rawPath.slice(basePath.length + 1);
  if (!encodedId) {
    return "";
  }

  try {
    return decodeURIComponent(encodedId);
  } catch (_error) {
    return encodedId;
  }
}

function readVehicleDetailOfferFromSearch(search = "") {
  try {
    const params = new URLSearchParams(String(search || ""));
    const encodedPayload = params.get("vd") || "";
    if (!encodedPayload) {
      return null;
    }

    const json = fromBase64Url(encodedPayload);
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

// ------------------------------------------------------------
// APP
// ------------------------------------------------------------

const THEME_STORAGE_KEY = "movilidad-advisor.themeMode.v1";
const LANGUAGE_STORAGE_KEY = "movilidad-advisor.uiLanguage.v1";

function normalizeUiLanguage(lang) {
  if (!lang) {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      // Only use stored value if it's a valid language code
      lang = (stored === "en" || stored === "es") ? stored : "es";
    } else {
      lang = "es";
    }
  }
  return ["en", "es"].includes(lang) ? lang : "es";
}

function clearLegacyTranslateCookies() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = "googtrans=; path=/; max-age=0";
  document.cookie = "googtrans=; domain=.localhost; path=/; max-age=0";
  document.cookie = "googtrans=; domain=localhost; path=/; max-age=0";
}

export default function App() {
  const { t } = useTranslation();
  const [entryMode, setEntryMode] = useState(null);
  const [selectedIdCarVehicleId, setSelectedIdCarVehicleId] = useState("");
  const [selectedIdCarOpenEditor, setSelectedIdCarOpenEditor] = useState(false);
  const [serviceAppointmentVehicleId, setServiceAppointmentVehicleId] = useState("");
  const [serviceAppointmentTypeTitle, setServiceAppointmentTypeTitle] = useState("");
  const [serviceAppointmentBackMode, setServiceAppointmentBackMode] = useState("serviceOptions");
  const [serviceAppointmentDraft, setServiceAppointmentDraft] = useState(null);
  const [advisorContext, setAdvisorContext] = useState(null); // null | "buy" | "renting"
  const [sellFlowType, setSellFlowType] = useState(""); // "certificate" | "report" | ""
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState({ perfil: "particular" });
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
  const [selectedValuationVehicleSummary, setSelectedValuationVehicleSummary] = useState(null);
  const [portalVoFilters, setPortalVoFilters] = useState({ ...INITIAL_PORTAL_VO_FILTERS });
  const [selectedPortalVoOfferId, setSelectedPortalVoOfferId] = useState(null);
  const [reservedVoUrls, setReservedVoUrls] = useState(new Set());
  const [reservedMarketplaceIds, setReservedMarketplaceIds] = useState(new Set());
  const [vehicleDetailOffer, setVehicleDetailOffer] = useState(null);
  const [vehicleDetailBackTarget, setVehicleDetailBackTarget] = useState("decision");
  const [listingFilters, setListingFilters] = useState({
    company: "",
    budget: "",
    income: "",
    location: "",
    priceRange: "",
    minPrice: null,
    maxPrice: null,
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
  const [sellMarketSnapshot, setSellMarketSnapshot] = useState(null);
  const [sellMarketSnapshotLoading, setSellMarketSnapshotLoading] = useState(false);
  const [sellMarketSnapshotError, setSellMarketSnapshotError] = useState("");
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [userAppointments, setUserAppointments] = useState([]);
  const [userMaintenances, setUserMaintenances] = useState([]);
  const [userInsurances, setUserInsurances] = useState([]);
  const [userValuations, setUserValuations] = useState([]);
  const [userVehicleStates, setUserVehicleStates] = useState([]);
  const [userSolicitudes, setUserSolicitudes] = useState([]);
  const [marketAlerts, setMarketAlerts] = useState([]);
  const [marketAlertStatus, setMarketAlertStatus] = useState({});
  // Infinite scroll state for marketplace offers
  const [portalVoOffersLive, setPortalVoOffersLive] = useState([]);
  const [marketplaceVoPage, setMarketplaceVoPage] = useState(0);
  const [marketplaceVoTotal, setMarketplaceVoTotal] = useState(0);
  const [marketplaceVoLoading, setMarketplaceVoLoading] = useState(false);
  const [portalVoModalityMode, setPortalVoModalityMode] = useState("compra");
  const { marketBrandsCatalog, matchedModelsByBrand, marketCatalogSource } = useMarketCatalog(portalVoOffersLive);
  const [questionnaireDraft, setQuestionnaireDraft] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [emailDigestFeedback, setEmailDigestFeedback] = useState("");
  const [emailDigestLoading, setEmailDigestLoading] = useState(false);
  const [planCheckoutLoadingId, setPlanCheckoutLoadingId] = useState("");
  const [planCheckoutFeedback, setPlanCheckoutFeedback] = useState("");
  const [pendingPlanCheckoutId, setPendingPlanCheckoutId] = useState("");
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showHeaderPlansNav, setShowHeaderPlansNav] = useState(false);
  const [showHeaderMoreNav, setShowHeaderMoreNav] = useState(false);
  const [showHeaderMobileNav, setShowHeaderMobileNav] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authDialogMode, setAuthDialogMode] = useState("");
  const [authRecoveryMode, setAuthRecoveryMode] = useState("none");
  const [authRecoveryCode, setAuthRecoveryCode] = useState("");
  const [authRecoveryFeedback, setAuthRecoveryFeedback] = useState("");
  const [authTargetPage, setAuthTargetPage] = useState("home");
  const [authTargetEntryMode, setAuthTargetEntryMode] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", apellidos: "", phone: "", email: "", password: "", company_name: "" });
  const [clientType, setClientType] = useState("individual");
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
  const [consentLegal, setConsentLegal] = useState(false);
  const [consentMarketingEmail, setConsentMarketingEmail] = useState(false);
  const [consentMarketingSms, setConsentMarketingSms] = useState(false);
  const [consentThirdPartyEmail, setConsentThirdPartyEmail] = useState(false);
  const [consentThirdPartySms, setConsentThirdPartySms] = useState(false);
  const [showConsentReview, setShowConsentReview] = useState(false);
  const [consentReviewLegal, setConsentReviewLegal] = useState(false);
  const [consentReviewMarketingEmail, setConsentReviewMarketingEmail] = useState(false);
  const [consentReviewMarketingSms, setConsentReviewMarketingSms] = useState(false);
  const [consentReviewThirdPartyEmail, setConsentReviewThirdPartyEmail] = useState(false);
  const [consentReviewThirdPartySms, setConsentReviewThirdPartySms] = useState(false);
  const [consentReviewLoading, setConsentReviewLoading] = useState(false);
  const [themeMode, setThemeMode] = useState("light");
  const [uiLanguage, setUiLanguage] = useState(() => {
    return normalizeUiLanguage();
  });
  const activeLegalDocs = uiLanguage === "en" ? LEGAL_DOCUMENTS_EN : LEGAL_DOCUMENTS;
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true,
    analytics: true,
    personalization: true,
    marketing: false,
  });
  const quickValidationRef = useRef({});
  const resultRef = useRef(null);

  const applyUiLanguage = useCallback((nextLanguage) => {
    const targetLanguage = normalizeUiLanguage(nextLanguage);

    i18next.changeLanguage(targetLanguage);

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", targetLanguage === "en" ? "en" : "es");
    }

    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, targetLanguage);
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    clearLegacyTranslateCookies();
  }, []);

  useEffect(() => {
    captureUtmFromUrl();
    trackFunnelEvent({ event_type: "landing" });
  }, []);

  // When auth resolves, enrich anonymous events from this session with the user email
  useEffect(() => {
    if (currentUser?.email) {
      trackFunnelEvent({ event_type: "identify", user_id: currentUser.id || null, user_email: currentUser.email });
    }
  }, [currentUser?.email, currentUser?.id]);

  // Track page-level navigation across all sections (not only marketplace)
  useEffect(() => {
    if (!entryMode) return;
    trackFunnelEvent({ event_type: "page_view", section: entryMode });
  }, [entryMode]);

  useEffect(() => {
    applyUiLanguage(uiLanguage);
  }, [applyUiLanguage, uiLanguage]);

  const {
    listingOptionsRef,
    listingSeenRef,
    resetListingDiscoveryMemory,
  } = useListingDiscoveryMemory(listingOptions);

  const {
    syncBrowserPath,
    navigateToUserDashboardPage,
    openUserDashboard,
  } = useDashboardNavigation({
    isUserLoggedIn,
    setShowAuthMenu,
    setShowUserPanel,
    setUserDashboardPage,
    setEntryMode,
    setStep,
  });

  const showOffersPage = useCallback(() => {
    setResultView("offers");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const showAnalysisPage = useCallback(() => {
    setResultView("analysis");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const openPublicPage = useCallback((nextEntryMode = null, historyMode = "push") => {
    setShowHeaderPlansNav(false);
    setShowHeaderMoreNav(false);
    setShowHeaderMobileNav(false);
    setEntryMode(nextEntryMode);
    setStep(-1);
    syncBrowserPath(nextEntryMode ? getPublicPathForEntryMode(nextEntryMode) : "/", historyMode);

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, [syncBrowserPath]);

  const openInternalLandingFlow = useCallback((nextEntryMode) => {
    setShowHeaderMobileNav(false);
    setShowHeaderPlansNav(false);
    setShowHeaderMoreNav(false);
    setShowAuthMenu(false);
    setShowUserPanel(false);
    setEntryMode(nextEntryMode);
    setStep(-1);
    syncBrowserPath("/", "push");

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, [syncBrowserPath]);

  const goToPublicHeaderPage = useCallback((nextEntryMode) => {
    setShowHeaderMobileNav(false);
    setShowHeaderPlansNav(false);
    setShowHeaderMoreNav(false);
    openPublicPage(nextEntryMode);
  }, [openPublicPage]);

  const goToHomeHeaderPage = useCallback(() => {
    setShowHeaderMobileNav(false);
    setShowHeaderPlansNav(false);
    setShowHeaderMoreNav(false);
    openPublicPage(null);
  }, [openPublicPage]);

  const goToAboutHeaderPage = useCallback(() => {
    setShowHeaderMobileNav(false);
    setShowHeaderPlansNav(false);
    setShowHeaderMoreNav(false);
    openPublicPage("aboutCarswise");
  }, [openPublicPage]);

  const openPlansSection = useCallback((sectionId = "planes") => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("movilidad-advisor.plans.scroll-target", sectionId);
    }

    setShowHeaderMobileNav(false);
    setShowHeaderPlansNav(false);
    setShowHeaderMoreNav(false);
    openPublicPage("plans");
  }, [openPublicPage]);

  const currentHeaderNavKey = useMemo(() => {
    if (
      entryMode === "serviceOptions" ||
      entryMode === "serviceInsurance" ||
      entryMode === "serviceMaintenance" ||
      entryMode === "serviceAutogestor" ||
      entryMode === "idCarsManage" ||
      entryMode === "idCarDetail" ||
      entryMode === "idCarCreate" ||
      entryMode === "serviceAppointment" ||
      entryMode === "serviceAppointmentCalendar" ||
      entryMode === "serviceMonthlyPlan" ||
      entryMode === "servicesSeo"
    ) {
      return "services";
    }

    if (entryMode === "sellOptions" || entryMode === "sell") {
      return "sell";
    }

    if (entryMode === "portalVo") {
      return "marketplaceVo";
    }

    if (entryMode === "plans") {
      return "plans";
    }

    if (entryMode === "contact" || entryMode === "aboutCarswise") {
      return "more";
    }

    if (
      entryMode === "vehicleOptions" ||
      entryMode === "buyOptions" ||
      entryMode === "rentingOptions" ||
      entryMode === "consejo" ||
      entryMode === "decision"
    ) {
      return "buy";
    }

    return "home";
  }, [entryMode]);

  const headerNavItems = useMemo(() => [
    {
      key: "home",
      label: uiLanguage === "en" ? "Home" : "Inicio",
      onClick: goToHomeHeaderPage,
    },
    {
      key: "buy",
      label: uiLanguage === "en" ? "Buy a Car" : "Quiero Comprar",
      onClick: () => openInternalLandingFlow("buyOptions"),
    },
    {
      key: "services",
      label: uiLanguage === "en" ? "Hire a Service" : "Contratar un Servicio",
      onClick: () => openInternalLandingFlow("serviceOptions"),
    },
    {
      key: "sell",
      label: uiLanguage === "en" ? "Sell my Car" : "Vender mi Coche",
      onClick: () => openInternalLandingFlow("sellOptions"),
    },
    {
      key: "marketplaceVo",
      label: uiLanguage === "en" ? "VO Marketplace" : "Marketplace de VO",
      onClick: () => goToPublicHeaderPage("portalVo"),
    },
    {
      key: "plans",
      label: uiLanguage === "en" ? "Plans ▾" : "Planes ▾",
      onClick: () => {
        setShowHeaderMobileNav(false);
        setShowHeaderMoreNav(false);
        setShowHeaderPlansNav((prev) => !prev);
      },
    },
    {
      key: "more",
      label: uiLanguage === "en" ? "More ▾" : "Más ▾",
      onClick: () => {
        setShowHeaderMobileNav(false);
        setShowHeaderPlansNav(false);
        setShowHeaderMoreNav((prev) => !prev);
      },
    },
  ], [goToHomeHeaderPage, goToPublicHeaderPage, openInternalLandingFlow, uiLanguage]);

  const headerPlansNavItems = useMemo(() => [
    {
      key: "plans-overview",
      label: uiLanguage === "en" ? "Plans overview" : "Resumen de planes",
      onClick: () => openPlansSection("planes"),
    },
    {
      key: "plans-services",
      label: uiLanguage === "en" ? "Services" : "Servicios",
      onClick: () => openPlansSection("premium"),
    },
    {
      key: "plans-compare",
      label: uiLanguage === "en" ? "Compare" : "Comparar",
      onClick: () => openPlansSection("comparar"),
    },
    {
      key: "plans-faq",
      label: "FAQ",
      onClick: () => openPlansSection("faq"),
    },
  ], [openPlansSection, uiLanguage]);

  const headerMoreNavItems = useMemo(() => [
    {
      key: "about",
      label: uiLanguage === "en" ? "About Us" : "Sobre Nosotros",
      onClick: goToAboutHeaderPage,
    },
    {
      key: "contact",
      label: uiLanguage === "en" ? "Contact" : "Contacto",
      onClick: () => goToPublicHeaderPage("contact"),
    },
  ], [goToAboutHeaderPage, goToPublicHeaderPage, uiLanguage]);

  const mobileHeaderNavItems = useMemo(() => [
    ...headerNavItems.filter((item) => item.key !== "more" && item.key !== "plans"),
    {
      key: "plans",
      label: uiLanguage === "en" ? "Plans" : "Planes",
      onClick: () => openPlansSection("planes"),
    },
    ...headerMoreNavItems,
  ], [headerMoreNavItems, headerNavItems, openPlansSection, uiLanguage]);

  const centerHeaderNavItems = headerNavItems;

  const openLegalDocument = useCallback((docKey = "legalNotice") => {
    if (!LEGAL_DOCUMENTS[docKey]) {
      return;
    }

    openPublicPage(docKey);
  }, [openPublicPage]);

  const openBlogPost = useCallback((slug = "") => {
    const post = getBlogPostBySlug(slug, uiLanguage);
    if (!post) {
      return;
    }

    const nextEntryMode = post.slug === "guia-compra-coche-segunda-mano-espana"
      ? "blogCompraUsado"
      : "blogRentingCompra";
    openPublicPage(nextEntryMode);
  }, [openPublicPage, uiLanguage]);

  const { saveCookieConsent } = useAppPreferences({
    themeStorageKey: THEME_STORAGE_KEY,
    themeMode,
    cookiePreferences,
    setShowCookieGate,
    setShowCookieSettings,
  });

  const activeSteps = useMemo(() => {
    const steps = getQuestionnaireSteps(advancedMode).filter((s) => s.id !== "perfil");
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

  useAppBootstrap({
    themeStorageKey: THEME_STORAGE_KEY,
    setThemeMode,
    setSavedComparisons,
    setUserAppointments,
    setUserMaintenances,
    setUserInsurances,
    setUserValuations,
    setUserVehicleStates,
    setUserSolicitudes,
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
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const applyRouteFromPath = () => {
      const pathEntryMode = resolveEntryModeFromPublicPath(window.location.pathname);

      if (pathEntryMode === "portalVoDetail") {
        const offerId = readMarketplaceVoIdFromPath(window.location.pathname);
        if (!offerId) {
          setEntryMode("portalVo");
          setStep(-1);
          return;
        }
        // Check if offer is already in the live cache
        const cached = portalVoOffersLive.find(
          (o) => normalizeText(String(o?.id || "")) === normalizeText(offerId)
        );
        if (cached) {
          setSelectedPortalVoOfferId(cached.id);
          setEntryMode("portalVoDetail");
          setStep(-1);
          return;
        }
        // Fetch offer by ID — do NOT set entryMode("portalVo") before fetching
        // because that triggers fetchMarketplaceVoPage which replaces portalVoOffersLive
        // and causes the route effect to loop indefinitely.
        import("./utils/apiClient").then(({ getMarketplaceVoOfferByIdJson }) =>
          getMarketplaceVoOfferByIdJson(offerId)
        ).then(({ response, data }) => {
          const offer = data?.offer;
          if (response.ok && offer?.id) {
            setPortalVoOffersLive((prev) => {
              const exists = prev.some((o) => o.id === offer.id);
              return exists ? prev : [offer, ...prev];
            });
            setSelectedPortalVoOfferId(offer.id);
            setEntryMode("portalVoDetail");
            setStep(-1);
          } else {
            // No está en VO: puede ser una oferta de importación (otra tabla)
            fetch(`/api/import-offers?id=${encodeURIComponent(offerId)}`)
              .then((r) => r.json())
              .then((d) => {
                const imp = d?.offer;
                if (d?.ok && imp?.id) {
                  setPortalVoOffersLive((prev) => prev.some((o) => o.id === imp.id) ? prev : [imp, ...prev]);
                  setSelectedPortalVoOfferId(imp.id);
                  setEntryMode("portalVoDetail");
                  setStep(-1);
                } else {
                  setEntryMode("portalVo");
                  setStep(-1);
                }
              })
              .catch(() => { setEntryMode("portalVo"); setStep(-1); });
          }
        }).catch(() => {
          setEntryMode("portalVo");
          setStep(-1);
        });
        return;
      }

      if (pathEntryMode === "vehicleDetail") {
        const deepLinkedOfferId = normalizeText(readVehicleDetailIdFromPath(window.location.pathname));
        let deepLinkedOffer = null;

        if (deepLinkedOfferId) {
          const knownOffers = [...portalVoOffersLive, ...PORTAL_VO_OFFERS];
          deepLinkedOffer = knownOffers.find(
            (candidate) => normalizeText(String(candidate?.id || "")) === deepLinkedOfferId
          ) || null;
        }

        if (!deepLinkedOffer) {
          deepLinkedOffer = readVehicleDetailOfferFromSearch(window.location.search);
        }

        if (!deepLinkedOfferId && deepLinkedOffer?.id) {
          syncBrowserPath(buildVehicleDetailSharePath(deepLinkedOffer), "replace");
        }

        if (!deepLinkedOffer) {
          setEntryMode("portalVo");
          setStep(-1);
          return;
        }

        setVehicleDetailOffer(deepLinkedOffer);
        setVehicleDetailBackTarget("advice");
        setEntryMode("vehicleDetail");
        setStep(-1);
        return;
      }

      if (!pathEntryMode) {
        if (normalizePublicPath(window.location.pathname) === "/") {
          setEntryMode(null);
          setStep(-1);
        }
        return;
      }

      setEntryMode(pathEntryMode);
      setStep(-1);
    };

    applyRouteFromPath();
    window.addEventListener("popstate", applyRouteFromPath);
    return () => window.removeEventListener("popstate", applyRouteFromPath);
  }, [portalVoOffersLive, syncBrowserPath]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const effectiveEntryMode = entryMode || "home";
    const meta = SEO_META_BY_ENTRY_MODE[effectiveEntryMode] || SEO_META_BY_ENTRY_MODE.home;
    const canonicalPath = effectiveEntryMode === "home" ? "/" : getPublicPathForEntryMode(effectiveEntryMode);
    const canonicalUrl = `https://www.carswiseai.com${canonicalPath}`;

    document.title = meta.title;

    const setMetaContent = (selector, content) => {
      const node = document.querySelector(selector);
      if (node) {
        node.setAttribute("content", content);
      }
    };

    setMetaContent('meta[name="description"]', meta.description);
    setMetaContent('meta[property="og:title"]', meta.title);
    setMetaContent('meta[property="og:description"]', meta.description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[name="twitter:title"]', meta.title);
    setMetaContent('meta[name="twitter:description"]', meta.description);

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute("href", canonicalUrl);
    }
  }, [entryMode]);

  const currentStep = activeSteps[step];
  const totalSteps = activeSteps.length;
  const currentUserEmail = normalizeText(currentUser?.email).toLowerCase();

  // Infinite scroll: fetch offers page by page
  const MARKETPLACE_PAGE_SIZE = 15;
  const fetchMarketplaceVoPage = useCallback(async (page = 0, filters = portalVoFilters, modality = portalVoModalityMode) => {
    setMarketplaceVoLoading(true);
    try {
      const offset = page * MARKETPLACE_PAGE_SIZE;
      // model and transmission are applied client-side so dropdowns always show all options for the brand
      const { model: _model, transmission: _transmission, ...serverFilters } = filters;
      const params = { offset, limit: MARKETPLACE_PAGE_SIZE, ...serverFilters, modalityMode: modality, exclude_seller_type: 'concesionario,importador' };
      const { data } = await getMarketplaceVoJson(params);
      const apiOffers = Array.isArray(data?.offers) ? data.offers : [];
      const source = String(data?.source || "").toLowerCase();
      const isDedicatedSource = source === "postgres-marketplace-table";
      if (isDedicatedSource) {
        setPortalVoOffersLive(apiOffers);
        setMarketplaceVoTotal(Number(data?.totalUniverse || apiOffers.length));
      } else if (page === 0) {
        setPortalVoOffersLive([]);
        setMarketplaceVoTotal(0);
      }
    } catch {
      if (page === 0) {
        setPortalVoOffersLive([]);
        setMarketplaceVoTotal(0);
      }
    } finally {
      setMarketplaceVoLoading(false);
    }
  }, [portalVoFilters, portalVoModalityMode]);

  // Reset to page 0 and fetch on filter change or entry
  useEffect(() => {
    if (entryMode === "portalVo") {
      setMarketplaceVoPage(0);
      fetchMarketplaceVoPage(0, portalVoFilters);
      trackFunnelEvent({
        event_type: "marketplace_view",
        user_id:    currentUser?.id    || null,
        user_email: currentUser?.email || null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryMode, portalVoFilters]);

  // Fetch reserved marketplace VO URLs when entering the marketplace or a detail page
  useEffect(() => {
    if (entryMode !== "portalVo" && entryMode !== "portalVoDetail") return;
    fetch("/api/leads?reserved=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          if (Array.isArray(d.reservedUrls)) setReservedVoUrls(new Set(d.reservedUrls));
          if (Array.isArray(d.reservedMarketplaceIds)) setReservedMarketplaceIds(new Set(d.reservedMarketplaceIds));
        }
      })
      .catch(() => {});
  }, [entryMode]);

  // Refetch when the user returns to the marketplace tab (e.g. after editing in ERP)
  useEffect(() => {
    if (entryMode !== "portalVo") return;
    const onFocus = () => fetchMarketplaceVoPage(marketplaceVoPage, portalVoFilters);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [entryMode, marketplaceVoPage, portalVoFilters, fetchMarketplaceVoPage]);

  const goToMarketplacePage = useCallback((page) => {
    if (marketplaceVoLoading) return;
    setMarketplaceVoPage(page);
    fetchMarketplaceVoPage(page, portalVoFilters, portalVoModalityMode);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [marketplaceVoLoading, fetchMarketplaceVoPage, portalVoFilters, portalVoModalityMode]);

  const handleMarketplaceModalityChange = useCallback((newModality) => {
    setPortalVoModalityMode(newModality);
    setMarketplaceVoPage(0);
    fetchMarketplaceVoPage(0, portalVoFilters, newModality);
  }, [fetchMarketplaceVoPage, portalVoFilters]);

  const { marketAlertMatches, newAlertMatchesCount, pendingAlertNotifications } = useMarketAlertInsights({
    marketAlerts,
    marketAlertStatus,
    offers: portalVoOffersLive,
    currentUserEmail,
    resolveAlertRecipientEmail,
  });

  useUserMobilitySync({
    currentUserEmail,
    setSavedComparisons,
    setUserAppointments,
    setUserMaintenances,
    setUserInsurances,
    setUserValuations,
    setUserVehicleStates,
    setUserSolicitudes,
  });

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

  useQuestionnaireStepVisualSync({
    entryMode,
    step,
    totalSteps,
    activeSteps,
    answers,
    normalizeRangeValue,
    setMultiSelected,
    setDualTimelineSelection,
    setScoreWeightsSelection,
  });

  useQuestionnaireDraftPersistence({
    entryMode,
    step,
    result,
    apiKeyMissing,
    currentStep,
    answers,
    multiSelected,
    scoreWeightsSelection,
    dualTimelineSelection,
    activeSteps,
    advancedMode,
    buildActiveAnswers,
    countAnsweredSteps,
    setQuestionnaireDraft,
  });

  useDecisionResetState({
    decisionAnswers,
    setDecisionAiResult,
    setDecisionError,
    setDecisionListingResult,
    setDecisionListingError,
    setDecisionListingLoading,
  });

  useSellResetState({
    sellAnswers,
    setSellAiResult,
    setSellError,
    setSellListingResult,
    setSellListingError,
    setSellListingLoading,
    setSellMarketSnapshot,
    setSellMarketSnapshotError,
    setSellMarketSnapshotLoading,
  });

  const resetListingDiscovery = useCallback(() => {
    setListingFilters({ company: "", budget: "", income: "", location: "", priceRange: "", minPrice: null, maxPrice: null });
    setListingResult(null);
    setListingOptions([]);
    resetListingDiscoveryMemory();
    setListingSearchCoverage(null);
    setListingError(null);
    setListingLoading(false);
  }, [resetListingDiscoveryMemory]);

  const resumeQuestionnaireDraft = useResumeQuestionnaireDraft({
    countAnsweredSteps,
    resetListingDiscovery,
    setQuestionnaireDraft,
    setEntryMode,
    setStep,
    setAdvancedMode,
    setAnswers,
    setMultiSelected,
    setResult,
    setError,
    setApiKeyMissing,
    setLoading,
  });

  const {
    saveCurrentComparison,
    isRecommendationSaved,
    toggleSavedRecommendation,
    removeSavedComparison,
  } = useSavedRecommendations({
    result,
    answers,
    listingResult,
    listingFilters,
    savedComparisons,
    currentUserEmail,
    setSavedComparisons,
    setSaveFeedback,
  });

  const { openAuthDialog, closeAuthDialog } = useAuthDialogControls({
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
  });

  const { startSubscriptionCheckout } = usePlanCheckout({
    currentUserEmail,
    isUserLoggedIn,
    openAuthDialog,
    setPendingPlanCheckoutId,
    setPlanCheckoutLoadingId,
    setPlanCheckoutFeedback,
  });

  const { resetLoggedUser } = useAuthSessionReset({
    setCurrentUser,
    setAuthDialogMode,
    setAuthRecoveryMode,
    setAuthRecoveryCode,
    setAuthRecoveryFeedback,
    setAuthError,
    setAuthLoading,
    setPendingPlanCheckoutId,
    setShowChangePasswordForm,
    setChangePasswordForm,
    setChangePasswordError,
    setChangePasswordSuccess,
    setChangePasswordLoading,
    setAuthForm,
  });

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

        const recoveryMessage = data?.message || "Revisa tu correo y escribe el código de recuperación.";
        const debugResetCode = normalizeText(data?.debugResetCode || "").toUpperCase();

        setAuthRecoveryMode("confirm");
        setAuthRecoveryFeedback(
          debugResetCode
            ? `${recoveryMessage} Código (modo local): ${debugResetCode}`
            : recoveryMessage
        );
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
          syncBrowserPath(getPublicPathForEntryMode(nextTargetEntryMode), "replace");
        } else if (authTargetPage && authTargetPage !== "home") {
          setEntryMode("userDashboard");
          setUserDashboardPage(authTargetPage);
          syncBrowserPath(getUserDashboardPath(authTargetPage), "replace");
        }
        // else: stay on home page
        setShowAuthMenu(false);
        setShowUserPanel(false);
        setSaveFeedback(data?.message || "Contraseña actualizada y sesión iniciada.");
        setAuthDialogMode("");
        setAuthRequired(false);
        setAuthRecoveryMode("none");
        setAuthRecoveryCode("");
        setAuthTargetEntryMode("");
        setAuthForm({ name: "", apellidos: "", phone: "", email: nextUser.email, password: "" });

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

    if (showCookieGate && mode === "register" && !consentLegal) {
      setAuthError("Debes aceptar las Condiciones Generales y la Política de Privacidad para continuar.");
      return;
    }

    const payload = {
      action: mode,
      name: normalizeText(clientType === "business" ? authForm.company_name : authForm.name),
      apellidos: clientType === "business" ? "" : normalizeText(authForm.apellidos),
      phone: normalizeText(authForm.phone),
      email: normalizeText(authForm.email).toLowerCase(),
      password: String(authForm.password || ""),
      clientType,
      company_name: clientType === "business" ? normalizeText(authForm.company_name) : "",
    };

    if (mode === "register") {
      const now = new Date().toISOString();
      if (consentLegal)            payload.consentLegalAt            = now;
      if (consentMarketingEmail)   payload.consentMarketingEmailAt   = now;
      if (consentMarketingSms)     payload.consentMarketingSmsAt     = now;
      if (consentThirdPartyEmail)  payload.consentThirdPartyEmailAt  = now;
      if (consentThirdPartySms)    payload.consentThirdPartySmsAt    = now;
      if (consentMarketingEmail || consentMarketingSms) payload.consentMarketingAt = now;
      if (consentThirdPartyEmail || consentThirdPartySms) payload.consentExperianAt = now;
      try {
        const stored = window.localStorage.getItem("ma.landing");
        if (stored) {
          const landing = JSON.parse(stored);
          payload.utmSource     = landing.utms?.utm_source   || "";
          payload.utmMedium     = landing.utms?.utm_medium   || "";
          payload.utmCampaign   = landing.utms?.utm_campaign || "";
          payload.utmContent    = landing.utms?.utm_content  || "";
          payload.affiliateData = landing.affiliateData || null;
          payload.referer       = landing.referer    || "";
          payload.landingUrl    = landing.landingUrl || "";
          payload.language      = landing.language   || "";
        }
      } catch {}
    }

    if (mode === "register" && clientType === "business" && !authForm.company_name) {
      setAuthError("Indica la razón social de tu empresa.");
      return;
    }

    if (mode === "register" && clientType === "individual" && !payload.name) {
      setAuthError("Indica tu nombre para crear la cuenta.");
      return;
    }

    if (mode === "register" && clientType === "individual" && !payload.apellidos) {
      setAuthError("Indica tus apellidos para crear la cuenta.");
      return;
    }

    if (mode === "register" && !payload.phone) {
      setAuthError("Indica tu número de teléfono para crear la cuenta.");
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
        // Use the canonical public path for this mode (e.g. /marketplace-vo for portalVo)
        // so applyRouteFromPath doesn't misread "/" and reset entryMode to null.
        syncBrowserPath(getPublicPathForEntryMode(nextTargetEntryMode), "replace");
      } else if (entryMode && entryMode !== "userDashboard") {
        // User was on a public page (offer detail, marketplace…) when auth was
        // required by bootstrap — entryMode and URL are already correct, stay there.
      } else if (authTargetPage && authTargetPage !== "home") {
        // Explicit non-home dashboard target from a specific flow (plans, etc.)
        setEntryMode("userDashboard");
        setUserDashboardPage(authTargetPage);
        syncBrowserPath(getUserDashboardPath(authTargetPage), "replace");
      }
      // else: user logged in from home page — stay on home, no redirect
      setShowAuthMenu(false);
      setShowUserPanel(false);
      trackFunnelEvent({
        event_type: mode === "register" ? "register" : "login",
        user_id:    nextUser.id    || null,
        user_email: nextUser.email || null,
      });
      setSaveFeedback(
        data?.message ||
          (mode === "register"
            ? `Cuenta creada para ${nextUser.email}.`
            : `Sesión iniciada para ${nextUser.email}.`)
      );
      setAuthDialogMode("");
      setAuthRequired(false);
      setAuthTargetEntryMode("");
      setAuthForm({ name: "", email: nextUser.email, password: "" });
      if (showCookieGate && mode === "register") {
        saveCookieConsent((consentMarketingEmail || consentMarketingSms) ? "all" : "necessary");
        setConsentLegal(false);
        setConsentMarketingEmail(false);
        setConsentMarketingSms(false);
        setConsentThirdPartyEmail(false);
        setConsentThirdPartySms(false);
      }
      // Show consent review modal for users who haven't accepted T&C (never reviewed or previously rejected)
      if (mode === "login" && !nextUser.consentLegalAt) {
        setShowConsentReview(true);
      }

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
    consentLegal,
    clientType,
    consentMarketingEmail,
    consentMarketingSms,
    consentThirdPartyEmail,
    consentThirdPartySms,
    entryMode,
    pendingPlanCheckoutId,
    saveCookieConsent,
    showCookieGate,
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
    void postUserAlertJson(alert).catch(() => {});
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
    void deleteUserAlertJson(id).catch(() => {});
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
      void postUserAlertStatusJson(id, Number(count || 0)).catch(() => {});
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
            ? "CarsWise · Tu resumen de alertas"
            : `CarsWise · ${emailTargets.length} resúmenes de alertas`,
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
          source: item?.sourceLabel || (uiLanguage === "en" ? "General market" : "Mercado general"),
          listingType: item?.typeKey || "movilidad",
        },
        { solucion_principal: { tipo: item?.typeKey || "movilidad", titulo: item?.title || "" } }
      ),
    [uiLanguage]
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

    const vehicleMeta =
      context?.vehicleTitle || context?.vehiclePlate
        ? `Vehículo: ${context.vehicleTitle || "Vehiculo"}${context.vehiclePlate ? ` (${context.vehiclePlate})` : ""}`
        : "";

    const extraMetaParts = [
      normalizeText(context?.appointmentType) ? `Servicio: ${normalizeText(context.appointmentType)}` : "",
      normalizeText(context?.provider) ? `Proveedor: ${normalizeText(context.provider)}` : "",
      normalizeText(context?.workshopName) ? `Taller: ${normalizeText(context.workshopName)}` : "",
      normalizeText(context?.workshopAddress) ? `Direccion: ${normalizeText(context.workshopAddress)}` : "",
      Number.isFinite(Number(context?.workshopDistanceKm)) ? `Distancia: ${Number(context.workshopDistanceKm).toFixed(1)} km` : "",
      normalizeText(context?.province) || normalizeText(context?.postalCode)
        ? `Zona: ${normalizeText(context.province)} ${normalizeText(context.postalCode)}`.trim()
        : "",
      context?.quotedPrice !== undefined && context?.quotedPrice !== null && context?.quotedPrice !== ""
        ? `Precio CarsWise: ${typeof context.quotedPrice === "number" ? `${context.quotedPrice}€` : String(context.quotedPrice)}`
        : "",
      vehicleMeta,
    ].filter(Boolean);

    const appointment = {
      id: `${type}-${Date.now()}`,
      ...template,
      meta: [template.meta, ...extraMetaParts].join(" · "),
      requestedAt:
        normalizeText(context?.requestedAt) ||
        new Date().toLocaleString("es-ES", {
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
          appointmentType: normalizeText(context?.appointmentType),
          provider: normalizeText(context?.provider),
          workshopId: normalizeText(context?.workshopId),
          workshopName: normalizeText(context?.workshopName),
          workshopAddress: normalizeText(context?.workshopAddress),
          workshopDistanceKm: Number.isFinite(Number(context?.workshopDistanceKm)) ? Number(context.workshopDistanceKm) : null,
          province: normalizeText(context?.province),
          postalCode: normalizeText(context?.postalCode),
          quotedPrice: context?.quotedPrice ?? null,
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

    // Crear cita en ERP CarsWise (Citas Mantenimiento) si es de tipo maintenance
    if (type === "maintenance" && !context?.skipErpSave && currentUserEmail && normalizeText(context?.selectedDateKey) && normalizeText(context?.selectedTime)) {
      const dateKey  = normalizeText(context.selectedDateKey);  // YYYY-MM-DD
      const timeStr  = normalizeText(context.selectedTime);     // HH:MM
      const isoDate  = `${dateKey}T${timeStr}:00+01:00`;
      const notesParts = [
        normalizeText(context?.vehicleTitle) ? `Vehículo: ${normalizeText(context.vehicleTitle)}` : "",
        normalizeText(context?.vehiclePlate) ? `Matrícula: ${normalizeText(context.vehiclePlate)}` : "",
        normalizeText(context?.workshopAddress) ? `Dirección taller: ${normalizeText(context.workshopAddress)}` : "",
        context?.quotedPrice != null ? `Precio CarsWise: ${context.quotedPrice}€` : "",
      ].filter(Boolean).join(" · ");
      postErpAppointmentJson({
        userId:          currentUserEmail,
        scheduledAt:     isoDate,
        appointmentType: normalizeText(context?.appointmentType),
        workshopName:    normalizeText(context?.workshopName) || normalizeText(context?.provider),
        notes:           notesParts || undefined,
      }).catch(() => { /* silencioso — no bloquear el flujo */ });
    }

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

  function mapMileageToSellOption(rawMileage = "") {
    const numericMileage = Number(String(rawMileage || "").replace(/[^\d]/g, ""));

    if (!Number.isFinite(numericMileage) || numericMileage <= 0) {
      return "";
    }

    if (numericMileage <= 20000) {
      return "20000";
    }

    if (numericMileage <= 50000) {
      return "50000";
    }

    if (numericMileage <= 80000) {
      return "80000";
    }

    if (numericMileage <= 120000) {
      return "120000";
    }

    return "160000";
  }

  function normalizeFuelForSellFlow(rawFuel = "") {
    const text = normalizeText(rawFuel).toLowerCase();

    if (!text) {
      return "";
    }

    if (text.includes("dies") || text.includes("diés")) {
      return "Diésel";
    }

    if (text.includes("elect")) {
      return "Eléctrico";
    }

    if (text.includes("hibr") && text.includes("ench")) {
      return "Híbrido enchufable";
    }

    if (text.includes("hibr") || text.includes("hev") || text.includes("mhev")) {
      return "Híbrido";
    }

    if (text.includes("glp") || text.includes("gpl")) {
      return "GLP";
    }

    return "Gasolina";
  }

  const openSellValuationFromOffers = (context = {}) => {
    const hasTradeInVehicle = normalizeText(answers?.vehiculo_actual);
    const prefillBrand = normalizeText(context?.brand);
    const prefillModel = normalizeText(context?.model);
    const prefillYear = normalizeText(context?.year);
    const prefillMileage = mapMileageToSellOption(normalizeText(context?.mileage));
    const prefillFuel = normalizeFuelForSellFlow(normalizeText(context?.fuel));
    const hasVehiclePrefill = Boolean(prefillBrand || prefillModel || prefillYear || prefillMileage || prefillFuel);

    setEntryMode("sell");
    setStep(-1);
    setSelectedValuationVehicleSummary(
      hasVehiclePrefill
        ? {
            plate: normalizeText(context?.vehiclePlate),
            title: normalizeText(context?.vehicleTitle),
            brand: prefillBrand,
            model: prefillModel,
            year: prefillYear,
          }
        : null
    );
    setSellAnswers((prev) => ({
      ...prev,
      sellerType: hasVehiclePrefill ? "particular" : hasTradeInVehicle === "si_entrego" ? "entrega" : "particular",
      brand: prefillBrand || prev?.brand || "",
      model: prefillModel || prev?.model || "",
      year: prefillYear || prev?.year || "",
      mileage: prefillMileage || prev?.mileage || "",
      fuel: prefillFuel || prev?.fuel || "Gasolina",
    }));

    if (typeof window !== "undefined") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
    }
  };

  const updateUserAppointmentStatus = async (appointmentId, nextValues = {}) => {
    const normalizedAppointmentId = normalizeText(appointmentId);
    const normalizedStatus = normalizeText(
      typeof nextValues === "string" ? nextValues : nextValues?.status
    );

    if (!normalizedAppointmentId || !normalizedStatus) {
      return;
    }

    const currentAppointment = (Array.isArray(userAppointments) ? userAppointments : []).find(
      (item) => normalizeText(item?.id) === normalizedAppointmentId
    );

    if (!currentAppointment) {
      return;
    }

    const normalizedRequestedAt = normalizeText(
      typeof nextValues === "object" ? nextValues?.requestedAt : currentAppointment?.requestedAt
    ) || normalizeText(currentAppointment?.requestedAt);
    const normalizedMeta = normalizeText(
      typeof nextValues === "object" ? nextValues?.meta : currentAppointment?.meta
    ) || normalizeText(currentAppointment?.meta);

    let nextAppointments = (Array.isArray(userAppointments) ? userAppointments : []).map((item) =>
      normalizeText(item?.id) === normalizedAppointmentId
        ? {
            ...item,
            status: normalizedStatus,
            requestedAt: normalizedRequestedAt,
            meta: normalizedMeta,
          }
        : item
    );

    if (currentUserEmail && normalizeText(currentAppointment?.vehicleId)) {
      try {
        const { data } = await postAppointmentAddJson(currentUserEmail, {
          ...currentAppointment,
          status: normalizedStatus,
          requestedAt: normalizedRequestedAt,
          meta: normalizedMeta,
          vehicleId: normalizeText(currentAppointment?.vehicleId),
          vehicleTitle: normalizeText(currentAppointment?.vehicleTitle),
          vehiclePlate: normalizeText(currentAppointment?.vehiclePlate),
        });

        if (Array.isArray(data?.appointments)) {
          nextAppointments = data.appointments.slice(0, 8);
        }
      } catch {
        // Keep local fallback when API is unavailable.
      }
    }

    writeUserAppointments(nextAppointments);
    setUserAppointments(nextAppointments);
  };

  const handleTellMeNow = () => {
    if (answeredSteps === 0) {
      return;
    }

    if (answeredSteps < totalSteps) {
      const proceed = window.confirm(
        i18next.t("questionnaire.quickEstimateConfirm")
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
      fuel: "",
      bodyType: "",
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
          inventoryOnly: true,
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
  }, [answers, listingOptionsRef, listingSeenRef, result]);

  useListingQuickValidationRefresh({
    result,
    quickValidationAnswers,
    listingFilters,
    searchRealListing,
  });

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
    const isDecisionMarketReady =
      !!decisionAnswers.brand;

    if (!isDecisionMarketReady || decisionAiResult) {
      setDecisionMarketListings((prev) => (prev.length ? [] : prev));
      setDecisionMarketError((prev) => (prev ? null : prev));
      setDecisionMarketInsight((prev) => (prev ? null : prev));
      setDecisionMarketLoading((prev) => (prev ? false : prev));
      setDecisionMarketRefreshNonce((prev) => (prev ? 0 : prev));
      setDecisionMarketExcludeUrls((prev) => (prev.length ? [] : prev));
      setDecisionMarketExcludeTitles((prev) => (prev.length ? [] : prev));
      return;
    }

    let isMounted = true;
    const timeoutId = window.setTimeout(async () => {
      setDecisionMarketLoading(true);
      setDecisionMarketError(null);
      setDecisionMarketInsight(null);

      try {
        const payload = await fetchDecisionListing({
          decisionFlowReady: isDecisionMarketReady,
          decisionAnswers,
          refreshNonce: decisionMarketRefreshNonce,
          excludeUrls: decisionMarketExcludeUrls,
          excludeTitles: decisionMarketExcludeTitles,
        });

        if (isMounted) {
          const listings = Array.isArray(payload?.listings) ? payload.listings : [];
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
          powerRange: `${decisionAnswers.powerMin || 70} - ${decisionAnswers.powerMax || 320} CV`,
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
      setSellError(
        uiLanguage === "en"
          ? "Complete brand, model, year and mileage before analyzing."
          : "Completa marca, modelo, año y kilometraje antes de analizar."
      );
      return;
    }

    setSellLoading(true);
    setSellError(null);
    setApiKeyMissing(false);
    setSellMarketSnapshot(null);
    setSellMarketSnapshotError("");
    setSellMarketSnapshotLoading(true);

    try {
      const { response, data } = await getSellMarketSnapshotJson({
        brand: sellAnswers.brand,
        model: sellAnswers.model,
        version: sellAnswers.version,
        fuel: sellAnswers.fuel,
        year: sellAnswers.year,
        mileage: sellAnswers.mileage,
      }, {
        headers: {
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      });

      if (response.ok && data?.ok) {
        setSellMarketSnapshot(data);
      } else {
        throw new Error(data?.error || "No se pudo obtener referencia de mercado.");
      }
    } catch (snapshotError) {
      setSellMarketSnapshot(null);
      setSellMarketSnapshotError(snapshotError?.message || "No se pudo cargar el mercado real.");
    } finally {
      setSellMarketSnapshotLoading(false);
    }

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
      if (currentUserEmail) {
        try {
          const rawPrice = normalizeText(normalized.precio_objetivo)
            .replace(/[^\d.,]/g, "")
            .replace(",", ".");
          const estimateValue = parseFloat(rawPrice) || 0;
          const vehicleLabel =
            normalizeText(selectedValuationVehicleSummary?.title) ||
            `${normalizeText(sellAnswers.brand)} ${normalizeText(sellAnswers.model)} ${normalizeText(sellAnswers.year)}`.trim();
          await postValuationAddJson(currentUserEmail, {
            title: vehicleLabel || "Tasacion vehiculo",
            meta: [
              normalizeText(sellAnswers.mileage) ? `${normalizeText(sellAnswers.mileage)} km` : "",
              normalizeText(sellAnswers.fuel),
            ]
              .filter(Boolean)
              .join(" · "),
            status: "Tasacion IA completada",
            report: normalizeText(normalized.resumen),
            estimateValue,
          });
        } catch {
          // non-blocking — valuation display is not gated on persistence
        }
      }
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
      phaseIndex = (phaseIndex + 1) % 6;
      setLoadingPhase(phaseIndex);
    }, 1800);

    try {
      const answersSummary = buildAnswersSummary(finalAnswers, activeSteps);
      const systemInstructionLabel = uiLanguage === "en"
        ? "Additional system instruction"
        : "Instruccion adicional del sistema";
      const retryConstraintMessage = uiLanguage === "en"
        ? "The previous response violated the category restriction. Repeat the analysis strictly respecting the user's entry path."
        : "La respuesta anterior incumplio la restriccion de categoria. Repite el analisis respetando estrictamente la via de entrada del usuario.";
      const buildPrompt = (extraInstruction = "") => buildAdviceAnalysisPrompt({
        answersSummary: extraInstruction ? `${answersSummary}\n- ${systemInstructionLabel}: ${extraInstruction}` : answersSummary,
        advisorContext,
        outputLanguage: uiLanguage,
      });

      let raw = await requestAiJson(
        buildPrompt(),
        { answers: finalAnswers, advisorContext, uiLanguage },
        { onApiKeyMissing: () => setApiKeyMissing(true) }
      );
      let normalizedResult = normalizeAdvisorResult(raw);

      if (!isAdvisorResultCompatibleWithContext(normalizedResult, advisorContext)) {
        raw = await requestAiJson(
          buildPrompt(retryConstraintMessage),
          { answers: finalAnswers, advisorContext, uiLanguage },
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
    currentUser,
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
    setPortalVoOffersLive,
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

  useListingBootstrap({
    quickValidationRef,
    quickValidationAnswers,
    result,
    answers,
    inferListingBudget: inferListingBudgetFromAnswers,
    setListingFilters,
    setListingResult,
    setListingOptions,
    setListingError,
    setListingLoading,
    setQuickValidationAnswers,
    searchRealListing,
  });

  const restart = useCallback(() => {
    setAdvisorContext(null);
    setSellFlowType("");
    setSelectedValuationVehicleSummary(null);
    setSelectedIdCarVehicleId("");
    setSelectedIdCarOpenEditor(false);
    restartBase();
  }, [restartBase]);

  const resolveCatalogModelsByBrand = useCallback(
    (rawBrand) => {
      const normalizedBrand = normalizeText(rawBrand);

      if (!normalizedBrand) {
        return [];
      }

      const exactModels = marketBrandsCatalog[normalizedBrand];

      if (Array.isArray(exactModels)) {
        return exactModels;
      }

      const normalizedSearchKey = normalizedBrand.toLowerCase();
      const fallbackBrandKey = Object.keys(marketBrandsCatalog).find(
        (brandName) => normalizeText(brandName).toLowerCase() === normalizedSearchKey
      );

      return fallbackBrandKey ? marketBrandsCatalog[fallbackBrandKey] || [] : [];
    },
    [marketBrandsCatalog]
  );

  const resolveMatchedModelsByBrand = useCallback(
    (rawBrand) => {
      const normalizedBrand = normalizeText(rawBrand);

      if (!normalizedBrand) {
        return [];
      }

      const exactModels = matchedModelsByBrand[normalizedBrand];

      if (Array.isArray(exactModels)) {
        return exactModels;
      }

      const normalizedSearchKey = normalizedBrand.toLowerCase();
      const fallbackBrandKey = Object.keys(matchedModelsByBrand || {}).find(
        (brandName) => normalizeText(brandName).toLowerCase() === normalizedSearchKey
      );

      return fallbackBrandKey ? matchedModelsByBrand[fallbackBrandKey] || [] : [];
    },
    [matchedModelsByBrand]
  );

  const decisionModels = resolveCatalogModelsByBrand(decisionAnswers.brand);
  const decisionMatchedSource = resolveMatchedModelsByBrand(decisionAnswers.brand);
  const normalizeModelKey = (value) => normalizeText(value).toLowerCase();
  const decisionMatchedModels = Array.from(
    new Set(decisionMatchedSource.map((modelName) => normalizeText(modelName)).filter(Boolean))
  );
  const matchedModelKeys = new Set(decisionMatchedModels.map((modelName) => normalizeModelKey(modelName)));
  const decisionOtherModels = decisionModels.filter((modelName) => !matchedModelKeys.has(normalizeModelKey(modelName)));
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
  const decisionMarketReady =
    !!decisionAnswers.brand;
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
  const sellModels = resolveCatalogModelsByBrand(sellAnswers.brand);
  const sellEstimate =
    sellAnswers.brand && sellAnswers.model && sellAnswers.year && sellAnswers.mileage
      ? buildSellEstimate(sellAnswers)
      : null;
  const {
    portalVoLocations,
    portalVoColors,
    portalVoFuels,
    portalVoTransmissions,
    portalVoBrands,
    portalVoModels,
    filteredPortalVoOffers,
    featuredPortalVoOffers,
    selectedPortalVoOffer,
    relatedPortalVoOffers,
  } = useMemo(
    () =>
      buildPortalVoMarketplaceModel({
        offers: portalVoOffersLive,
        filters: portalVoFilters,
        selectedOfferId: selectedPortalVoOfferId,
      }),
    [portalVoFilters, selectedPortalVoOfferId, portalVoOffersLive]
  );

  const progress =
    step >= 0 && step < totalSteps
      ? ((step + 1) / totalSteps) * 100
      : step === 99 || result || apiKeyMissing
      ? 100
      : 0;

  const loadingTexts = [
    i18next.t("loading.phase1"),
    i18next.t("loading.phase2"),
    i18next.t("loading.phase3"),
    i18next.t("loading.phase4"),
    i18next.t("loading.phase5"),
    i18next.t("loading.phase6"),
  ];

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
  const selectedBlogArticle = useMemo(() => {
    if (entryMode === "blogCompraUsado") {
      return getBlogPostBySlug("guia-compra-coche-segunda-mano-espana", uiLanguage);
    }

    if (entryMode === "blogRentingCompra") {
      return getBlogPostBySlug("renting-vs-compra-2026-que-conviene-segun-tu-uso", uiLanguage);
    }

    return null;
  }, [entryMode, uiLanguage]);
  const structuredDataSchemas = useMemo(() => {
    if (!entryMode) {
      return [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
          logo: SITE_LOGO_URL,
          image: SITE_IMAGE_URL,
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "soporte@carswise.es",
              telephone: "+34910000000",
              availableLanguage: ["es"],
            },
          ],
          sameAs: [
            "https://www.linkedin.com",
            "https://x.com",
            "https://www.instagram.com",
            "https://www.youtube.com",
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          inLanguage: "es-ES",
        },
      ];
    }

    if (entryMode === "blog") {
      return [
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Blog CarsWise",
          url: `${SITE_URL}/blog`,
          inLanguage: "es-ES",
          publisher: {
            "@type": "Organization",
            name: SITE_NAME,
            logo: {
              "@type": "ImageObject",
              url: SITE_LOGO_URL,
            },
          },
          blogPost: BLOG_POSTS.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            url: `${SITE_URL}/blog/${post.slug}`,
            datePublished: post.publishedAt,
            dateModified: post.publishedAt,
          })),
        },
        buildBreadcrumbSchema([
          { name: "Inicio", url: `${SITE_URL}/` },
          { name: "Blog", url: `${SITE_URL}/blog` },
        ]),
      ];
    }

    if ((entryMode === "blogCompraUsado" || entryMode === "blogRentingCompra") && selectedBlogArticle) {
      return [
        buildBlogPostingSchema(selectedBlogArticle),
        buildBreadcrumbSchema([
          { name: "Inicio", url: `${SITE_URL}/` },
          { name: "Blog", url: `${SITE_URL}/blog` },
          { name: selectedBlogArticle.title, url: `${SITE_URL}/blog/${selectedBlogArticle.slug}` },
        ]),
      ];
    }

    return [];
  }, [entryMode, selectedBlogArticle]);
  const isAdviceFlowLightBackground =
    themeMode === "light" &&
    entryMode === "consejo" &&
    (
      (step >= 0 && step < totalSteps) ||
      (step === 99 && loading) ||
      Boolean(result && !activeLegalDocs[entryMode])
    );

  // -------------------- STYLES --------------------
  const s = useMemo(() => createAppStyles(progress, themeMode), [progress, themeMode]);

  // -------------------- MI CITA STANDALONE PAGE --------------------
  if (typeof window !== "undefined" && window.location.pathname === "/mi-cita") {
    return <MiCitaPage />;
  }

  // -------------------- LEGAL STANDALONE PAGE --------------------
  const LEGAL_ENTRY_MODES = ["legalNotice", "privacyPolicy", "cookiePolicy", "termsConditions", "marketingPolicy", "experianPolicy", "experianTerms"];
  if (LEGAL_ENTRY_MODES.includes(entryMode) && activeLegalDocs[entryMode]) {
    const doc = activeLegalDocs[entryMode];
    const isDark = themeMode === "dark";
    const legalBg = isDark ? "#0f172a" : "#f8fafc";
    const legalText = isDark ? "#e2e8f0" : "#0f172a";
    const legalBorder = isDark ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.22)";
    return (
      <div style={{ minHeight: "100vh", background: legalBg, color: legalText, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          background: isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.96)",
          borderBottom: `1px solid ${legalBorder}`,
          backdropFilter: "blur(10px)",
          padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", height: 56,
        }}>
          <img src="/carswise-logo.png" alt="CarsWise AI" style={{ height: 34, width: "auto", objectFit: "contain" }} />
          <button
            type="button"
            onClick={() => { if (window.history.length > 1) { window.history.back(); } else { window.close(); } }}
            style={{
              background: "transparent",
              border: `1px solid ${legalBorder}`,
              color: isDark ? "#94a3b8" : "#64748b",
              borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            ← Cerrar
          </button>
        </div>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 80px" }}>
          <LegalPolicyPage
            title={doc.title}
            summary={doc.summary}
            updatedAt={doc.updatedAt}
            sections={doc.sections}
            themeMode={themeMode}
          />
        </div>
      </div>
    );
  }

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
      <header
        style={{
          ...s.header,
          minHeight: 104,
          paddingTop: 8,
          paddingBottom: 8,
          justifyContent: "flex-start",
          gap: 0,
        }}
      >
      {structuredDataSchemas.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

        <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%" }}>
          <button
            type="button"
            onClick={restart}
            style={{
              height: 84,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
            title="Ir al home"
            aria-label="Ir al home"
          >
            <img
              src="/carswise-logo.png"
              alt="CarsWise"
              style={{
                height: 84,
                width: "auto",
                objectFit: "contain",
                objectPosition: "left center",
                display: "block",
              }}
            />
          </button>
          <nav
            className="cw-header-nav"
            aria-label="Navegacion principal CarsWise"
            style={{
              "--cw-nav-color": themeMode === "dark" ? "#cbd5e1" : "#5b6b82",
              "--cw-nav-hover-color": themeMode === "dark" ? "#dbeafe" : "#334155",
              "--cw-nav-active-color": themeMode === "dark" ? "#7dd3fc" : "#3b82f6",
              "--cw-nav-active-bg": themeMode === "dark" ? "rgba(125,211,252,0.18)" : "rgba(59,130,246,0.12)",
                justifyContent: "center",
                marginLeft: 18,
                marginRight: 18,
            }}
          >
            {centerHeaderNavItems.map((item) => {
              const isActive = item.key === currentHeaderNavKey;

              if (item.key === "plans") {
                return (
                  <div key={item.key} style={{ position: "relative" }}>
                    <button
                      type="button"
                      className={`cw-header-nav-link${isActive || showHeaderPlansNav ? " is-active" : ""}`}
                      onClick={item.onClick}
                      aria-haspopup="menu"
                      aria-expanded={showHeaderPlansNav}
                    >
                      {item.label}
                    </button>

                    {showHeaderPlansNav && (
                      <div
                        role="menu"
                        aria-label="Secciones de planes"
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          right: 0,
                          minWidth: 210,
                          background: "rgba(255,255,255,0.98)",
                          border: "1px solid rgba(148,163,184,0.34)",
                          borderRadius: 12,
                          boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
                          padding: 8,
                          zIndex: 140,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        {headerPlansNavItems.map((plansItem) => (
                          <button
                            key={plansItem.key}
                            type="button"
                            role="menuitem"
                            onClick={plansItem.onClick}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: "1px solid rgba(148,163,184,0.28)",
                              borderRadius: 10,
                              background: "#ffffff",
                              color: "#0f172a",
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "8px 10px",
                              cursor: "pointer",
                            }}
                          >
                            {plansItem.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (item.key === "more") {
                return (
                  <div key={item.key} style={{ position: "relative" }}>
                    <button
                      type="button"
                      className={`cw-header-nav-link${isActive || showHeaderMoreNav ? " is-active" : ""}`}
                      onClick={item.onClick}
                      aria-haspopup="menu"
                      aria-expanded={showHeaderMoreNav}
                    >
                      {item.label}
                    </button>

                    {showHeaderMoreNav && (
                      <div
                        role="menu"
                        aria-label="Mas opciones"
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          right: 0,
                          minWidth: 190,
                          background: "rgba(255,255,255,0.98)",
                          border: "1px solid rgba(148,163,184,0.34)",
                          borderRadius: 12,
                          boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
                          padding: 8,
                          zIndex: 140,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        {headerMoreNavItems.map((moreItem) => (
                          <button
                            key={moreItem.key}
                            type="button"
                            role="menuitem"
                            onClick={moreItem.onClick}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: "1px solid rgba(148,163,184,0.28)",
                              borderRadius: 10,
                              background: "#ffffff",
                              color: "#0f172a",
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "8px 10px",
                              cursor: "pointer",
                            }}
                          >
                            {moreItem.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`cw-header-nav-link${isActive ? " is-active" : ""}`}
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
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
            onClick={() => setUiLanguage((prev) => (prev === "es" ? "en" : "es"))}
            title={uiLanguage === "es" ? "Cambiar a inglés" : "Cambiar a español"}
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
            <span>🌐</span>
            <span>{uiLanguage === "es" ? "ES" : "EN"}</span>
          </button>

          <button
            type="button"
            onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
            title={themeMode === "dark" ? (uiLanguage === "en" ? "Switch to light mode" : "Cambiar a modo claro") : (uiLanguage === "en" ? "Switch to dark mode" : "Cambiar a modo oscuro")}
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
            <span className="cw-theme-label">{themeMode === "dark" ? (uiLanguage === "en" ? "Light mode" : "Modo claro") : (uiLanguage === "en" ? "Dark mode" : "Modo oscuro")}</span>
          </button>

          <button
            type="button"
            onClick={handleUserAccessClick}
            title={isUserLoggedIn ? (uiLanguage === "en" ? "Open my panel" : "Abrir mi panel") : (uiLanguage === "en" ? "Sign in or register" : "Acceder o registrarse")}
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
            <span className="cw-theme-label">{isUserLoggedIn ? (uiLanguage === "en" ? "My panel" : "Mi panel") : (uiLanguage === "en" ? "Sign in" : "Acceder")}</span>
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
                    Mi espacio CarsWise
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
                    dashboardAppointments.map((item) => {
                      const metaParts = String(item?.meta || "").split(" · ").map((part) => part.trim()).filter(Boolean);
                      const addressPart = metaParts.find((part) => part.startsWith("Direccion:")) || "";
                      const detailParts = metaParts.filter((part) =>
                        part.startsWith("Taller:") ||
                        part.startsWith("Distancia:") ||
                        part.startsWith("Proveedor:")
                      );
                      const detailLine = detailParts
                        .map((part) => part.replace(/^Taller:\s*/, "").replace(/^Distancia:\s*/, "").replace(/^Proveedor:\s*/, ""))
                        .join(" · ");
                      const summaryLine = metaParts.filter((part) => !detailParts.includes(part)).join(" · ");

                      return (
                        <div key={item.id} style={{ paddingTop: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{summaryLine}</div>
                          {detailLine ? (
                            <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 2, fontWeight: 700 }}>
                              Taller {"\u00B7"} {detailLine}
                            </div>
                          ) : null}
                          {addressPart ? (
                            <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>
                              Dirección {"\u00B7"} {addressPart.replace(/^Direccion:\s*/, "")}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 2 }}>
                            {item.status}
                            {item.requestedAt ? ` ${"\u00B7"} ${item.requestedAt}` : ""}
                          </div>
                        </div>
                      );
                    })
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
        </div>
        <button
          type="button"
          className="cw-header-mobile-toggle"
          onClick={() => {
            setShowHeaderMoreNav(false);
            setShowHeaderMobileNav((prev) => !prev);
          }}
          aria-expanded={showHeaderMobileNav}
          aria-controls="cw-header-mobile-nav"
          aria-label="Abrir menu de navegacion"
        >
          ☰
        </button>
        {showHeaderMobileNav && (
          <div id="cw-header-mobile-nav" className="cw-header-mobile-nav" role="menu" aria-label="Navegacion movil principal">
            {mobileHeaderNavItems.map((item) => {
              const isActive = item.key === currentHeaderNavKey;
              return (
                <button
                  key={`mobile-${item.key}`}
                  type="button"
                  role="menuitem"
                  className={`cw-header-mobile-nav-link${isActive ? " is-active" : ""}`}
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
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
                {authRequired && authRecoveryMode === "none" && (
                  <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600, marginTop: 6, padding: "6px 10px", background: "rgba(251,191,36,0.08)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.2)" }}>
                    Necesitas iniciar sesión para acceder al marketplace.
                  </div>
                )}
              </div>
              {!authRequired && (
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
              )}
            </div>

            <form onSubmit={submitAuthForm} style={{ display: "grid", gap: 12 }}>
              {authDialogMode === "register" && authRecoveryMode === "none" && (
                <>
                  {/* Tipo de cliente */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { setClientType("individual"); setAuthForm((p) => ({ ...p, company_name: "" })); }}
                      style={{
                        padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: clientType === "individual" ? "1.5px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
                        background: clientType === "individual" ? "rgba(59,130,246,0.12)" : "#0f1b2d",
                        color: clientType === "individual" ? "#93c5fd" : "#64748b",
                      }}
                    >
                      👤 Particular
                    </button>
                    <button
                      type="button"
                      onClick={() => { setClientType("business"); setAuthForm((p) => ({ ...p, name: "", apellidos: "" })); }}
                      style={{
                        padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: clientType === "business" ? "1.5px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
                        background: clientType === "business" ? "rgba(245,158,11,0.10)" : "#0f1b2d",
                        color: clientType === "business" ? "#fbbf24" : "#64748b",
                      }}
                    >
                      🏢 Empresa
                    </button>
                  </div>

                  {/* Campos según tipo */}
                  {clientType === "individual" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                        Nombre
                        <input
                          type="text"
                          autoComplete="given-name"
                          value={authForm.name}
                          onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="Tu nombre"
                          style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                        Apellidos
                        <input
                          type="text"
                          autoComplete="family-name"
                          value={authForm.apellidos}
                          onChange={(event) => setAuthForm((prev) => ({ ...prev, apellidos: event.target.value }))}
                          placeholder="Tus apellidos"
                          style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px" }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#fde68a" }}>
                      Razón social
                      <input
                        type="text"
                        autoComplete="organization"
                        value={authForm.company_name}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, company_name: event.target.value }))}
                        placeholder="Nombre de tu empresa"
                        style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "11px 12px" }}
                      />
                    </label>
                  )}

                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                    Teléfono
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={authForm.phone}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, phone: event.target.value }))}
                      placeholder="Ej: 612 345 678"
                      style={{ background: "#0f1b2d", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px" }}
                    />
                  </label>
                </>
              )}

              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#dbeafe" }}>
                Correo electrónico
                <input
                  type="email"
                  autoComplete="email"
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
                  autoComplete={authDialogMode === "register" ? "new-password" : "current-password"}
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

              {showCookieGate && authDialogMode === "register" && authRecoveryMode === "none" && (
                <div style={{ borderTop: "1px solid rgba(148,163,184,0.15)", paddingTop: 14, display: "grid", gap: 10 }}>

                  {/* Master toggle */}
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <div
                      onClick={() => {
                        const allOn = consentLegal && consentMarketingEmail && consentMarketingSms && consentThirdPartyEmail && consentThirdPartySms;
                        setConsentLegal(!allOn);
                        setConsentMarketingEmail(!allOn);
                        setConsentMarketingSms(!allOn);
                        setConsentThirdPartyEmail(!allOn);
                        setConsentThirdPartySms(!allOn);
                      }}
                      style={{
                        width: 36, height: 20, borderRadius: 999, flexShrink: 0, cursor: "pointer",
                        background: consentLegal && consentMarketingEmail && consentMarketingSms && consentThirdPartyEmail && consentThirdPartySms ? "#2563eb" : "rgba(148,163,184,0.3)",
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        position: "absolute", top: 3,
                        left: consentLegal && consentMarketingEmail && consentMarketingSms && consentThirdPartyEmail && consentThirdPartySms ? 19 : 3,
                        transition: "left 0.2s",
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                      Acepto todos los consentimientos siguientes:
                    </span>
                  </label>

                  {/* 1. Legal + privacidad — obligatorio */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                    <input
                      type="checkbox"
                      checked={consentLegal}
                      onChange={(e) => {
                        setConsentLegal(e.target.checked);
                        if (!e.target.checked) {
                          setConsentMarketingEmail(false); setConsentMarketingSms(false);
                          setConsentThirdPartyEmail(false); setConsentThirdPartySms(false);
                        }
                      }}
                      style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                      He leído y acepto{" "}
                      <a href="/terminos-condiciones" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#93c5fd", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Condiciones Generales
                      </a>
                      {" "}y la{" "}
                      <a href="/politica-privacidad" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#93c5fd", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Política de Privacidad
                      </a>
                      .{" "}
                      <span style={{ color: "#f87171", fontSize: 11 }}>(obligatorio)</span>
                    </span>
                  </label>

                  {/* 2a. Marketing email — opcional */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                    <input
                      type="checkbox"
                      checked={consentMarketingEmail}
                      onChange={(e) => setConsentMarketingEmail(e.target.checked)}
                      style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      Acepto recibir comunicaciones comerciales por <strong style={{ color: "#cbd5e1" }}>email</strong> de Carswiseai y socios conforme a la{" "}
                      <a href="/politica-comunicaciones" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#7dd3fc", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Política de Comunicaciones
                      </a>
                      .
                    </span>
                  </label>

                  {/* 2b. Marketing SMS — opcional */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                    <input
                      type="checkbox"
                      checked={consentMarketingSms}
                      onChange={(e) => setConsentMarketingSms(e.target.checked)}
                      style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      Acepto recibir comunicaciones comerciales por <strong style={{ color: "#cbd5e1" }}>SMS</strong> de Carswiseai y socios conforme a la{" "}
                      <a href="/politica-comunicaciones" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#7dd3fc", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Política de Comunicaciones
                      </a>
                      .
                    </span>
                  </label>

                  {/* 3a. Experian email — opcional */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                    <input
                      type="checkbox"
                      checked={consentThirdPartyEmail}
                      onChange={(e) => setConsentThirdPartyEmail(e.target.checked)}
                      style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      Acepto comunicaciones por <strong style={{ color: "#cbd5e1" }}>email</strong> de terceros conforme a las{" "}
                      <a href="/condiciones-experian" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#7dd3fc", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Condiciones Experian
                      </a>
                      {" "}y la{" "}
                      <a href="/politica-experian" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#7dd3fc", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Política de Solvencia
                      </a>
                      .
                    </span>
                  </label>

                  {/* 3b. Experian SMS — opcional */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                    <input
                      type="checkbox"
                      checked={consentThirdPartySms}
                      onChange={(e) => setConsentThirdPartySms(e.target.checked)}
                      style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      Acepto comunicaciones por <strong style={{ color: "#cbd5e1" }}>SMS</strong> de terceros conforme a las{" "}
                      <a href="/condiciones-experian" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#7dd3fc", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Condiciones Experian
                      </a>
                      {" "}y la{" "}
                      <a href="/politica-experian" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#7dd3fc", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                        Política de Solvencia
                      </a>
                      .
                    </span>
                  </label>
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

      {/* ── Consent review modal for existing users ── */}
      {showConsentReview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#0f172a", borderRadius: 20, padding: "32px 28px", maxWidth: 480, width: "100%", border: "1px solid rgba(148,163,184,0.15)" }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 10 }}>Actualización de políticas</p>
            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#f8fafc", lineHeight: 1.2 }}>Revisa y acepta nuestras políticas</h3>
            <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>Hemos actualizado nuestras condiciones. Puedes aceptar o continuar sin aceptar — tu decisión quedará guardada.</p>

            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              {/* Checkbox 1 — T&C obligatorio */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                <input type="checkbox" checked={consentReviewLegal} onChange={(e) => setConsentReviewLegal(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  He leído y acepto{" "}
                  <a href="/terminos-condiciones" target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd", textDecoration: "underline" }}>Condiciones Generales</a>
                  {" "}y la{" "}
                  <a href="/politica-privacidad" target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd", textDecoration: "underline" }}>Política de Privacidad</a>.{" "}
                  <span style={{ color: "#f87171", fontSize: 11 }}>(obligatorio)</span>
                </span>
              </label>

              {/* Checkbox 2a — marketing email */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                <input type="checkbox" checked={consentReviewMarketingEmail} onChange={(e) => setConsentReviewMarketingEmail(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  Acepto comunicaciones comerciales por <strong style={{ color: "#cbd5e1" }}>email</strong> conforme a la{" "}
                  <a href="/politica-comunicaciones" target="_blank" rel="noopener noreferrer" style={{ color: "#7dd3fc", textDecoration: "underline" }}>Política de Comunicaciones</a>.
                </span>
              </label>

              {/* Checkbox 2b — marketing SMS */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                <input type="checkbox" checked={consentReviewMarketingSms} onChange={(e) => setConsentReviewMarketingSms(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  Acepto comunicaciones comerciales por <strong style={{ color: "#cbd5e1" }}>SMS</strong> conforme a la{" "}
                  <a href="/politica-comunicaciones" target="_blank" rel="noopener noreferrer" style={{ color: "#7dd3fc", textDecoration: "underline" }}>Política de Comunicaciones</a>.
                </span>
              </label>

              {/* Checkbox 3a — Experian email */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                <input type="checkbox" checked={consentReviewThirdPartyEmail} onChange={(e) => setConsentReviewThirdPartyEmail(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  Acepto comunicaciones por <strong style={{ color: "#cbd5e1" }}>email</strong> de terceros conforme a las{" "}
                  <a href="/condiciones-experian" target="_blank" rel="noopener noreferrer" style={{ color: "#7dd3fc", textDecoration: "underline" }}>Condiciones Experian</a>
                  {" "}y la{" "}
                  <a href="/politica-experian" target="_blank" rel="noopener noreferrer" style={{ color: "#7dd3fc", textDecoration: "underline" }}>Política de Solvencia</a>.
                </span>
              </label>

              {/* Checkbox 3b — Experian SMS */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingLeft: 4 }}>
                <input type="checkbox" checked={consentReviewThirdPartySms} onChange={(e) => setConsentReviewThirdPartySms(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  Acepto comunicaciones por <strong style={{ color: "#cbd5e1" }}>SMS</strong> de terceros conforme a las{" "}
                  <a href="/condiciones-experian" target="_blank" rel="noopener noreferrer" style={{ color: "#7dd3fc", textDecoration: "underline" }}>Condiciones Experian</a>
                  {" "}y la{" "}
                  <a href="/politica-experian" target="_blank" rel="noopener noreferrer" style={{ color: "#7dd3fc", textDecoration: "underline" }}>Política de Solvencia</a>.
                </span>
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                disabled={consentReviewLoading}
                onClick={async () => {
                  setConsentReviewLoading(true);
                  try {
                    let landing = {};
                    try { landing = JSON.parse(window.localStorage.getItem("ma.landing") || "{}"); } catch {}
                    const { data } = await postAuthJson({
                      action: "save_consents",
                      consentLegal: consentReviewLegal,
                      consentMarketingEmail: consentReviewMarketingEmail,
                      consentMarketingSms: consentReviewMarketingSms,
                      consentThirdPartyEmail: consentReviewThirdPartyEmail,
                      consentThirdPartySms: consentReviewThirdPartySms,
                      language: landing.language || navigator.language || "",
                      utmSource: landing.utms?.utm_source || "",
                      utmMedium: landing.utms?.utm_medium || "",
                      utmCampaign: landing.utms?.utm_campaign || "",
                      utmContent: landing.utms?.utm_content || "",
                      referer: landing.referer || "",
                      landingUrl: landing.landingUrl || "",
                      affiliateData: landing.affiliateData || null,
                    });
                    if (data?.user) { writeAuthUser(data.user); setCurrentUser(data.user); }
                  } catch {}
                  setShowConsentReview(false);
                  setConsentReviewLoading(false);
                }}
                style={{ width: "100%", padding: "12px", borderRadius: 10, background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: consentReviewLoading ? 0.6 : 1 }}
              >
                {consentReviewLoading ? "Guardando…" : "Guardar selección y continuar"}
              </button>
              <button
                disabled={consentReviewLoading}
                onClick={async () => {
                  setConsentReviewLoading(true);
                  try {
                    let landing = {};
                    try { landing = JSON.parse(window.localStorage.getItem("ma.landing") || "{}"); } catch {}
                    await postAuthJson({
                      action: "save_consents",
                      consentLegal: false,
                      consentMarketingEmail: false,
                      consentMarketingSms: false,
                      consentThirdPartyEmail: false,
                      consentThirdPartySms: false,
                      language: landing.language || navigator.language || "",
                      utmSource: landing.utms?.utm_source || "",
                      utmMedium: landing.utms?.utm_medium || "",
                      utmCampaign: landing.utms?.utm_campaign || "",
                      utmContent: landing.utms?.utm_content || "",
                      referer: landing.referer || "",
                      landingUrl: landing.landingUrl || "",
                      affiliateData: landing.affiliateData || null,
                    });
                  } catch {}
                  setShowConsentReview(false);
                  setConsentReviewLoading(false);
                }}
                style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", color: "#64748b", fontWeight: 500, fontSize: 13, border: "1px solid rgba(148,163,184,0.2)", cursor: "pointer" }}
              >
                Continuar sin aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCookieGate && !isUserLoggedIn && !authRequired && !showConsentReview && !["legalNotice", "privacyPolicy", "cookiePolicy", "termsConditions", "marketingPolicy", "experianPolicy", "experianTerms"].includes(entryMode) && (
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
              {t("cookies.badge")}
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "clamp(22px,4vw,28px)", color: "#f8fafc" }}>
              {t("cookies.title")}
            </h3>
            <p style={{ margin: "0 0 8px", color: "#cbd5e1", fontSize: 13, lineHeight: 1.65 }}>
              {t("cookies.description")}
            </p>
            <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
              {t("cookies.note")}
            </p>

            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {[
                {
                  key: "necessary",
                  title: t("cookies.necessary.title"),
                  description: t("cookies.necessary.description"),
                  locked: true,
                },
                {
                  key: "analytics",
                  title: t("cookies.analytics.title"),
                  description: t("cookies.analytics.description"),
                },
                {
                  key: "personalization",
                  title: t("cookies.personalization.title"),
                  description: t("cookies.personalization.description"),
                },
                {
                  key: "marketing",
                  title: t("cookies.marketing.title"),
                  description: t("cookies.marketing.description"),
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
                        {t("cookies.alwaysActive")}
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
                        {enabled ? t("cookies.enabled") : t("cookies.disabled")}
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
                {t("cookies.advancedMessage")}
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
                {t("cookies.acceptAll")}
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
                {t("cookies.necessaryOnly")}
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
                {t("cookies.saveSelection")}
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
                {showCookieSettings ? t("cookies.hideSettings") : t("cookies.showSettings")}
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

          .ma-header-progress {
            background: linear-gradient(90deg, #2563eb 0%, #22c55e 100%);
            background-size: 180% 100%;
            animation: maHeaderLineShift 4.8s linear infinite;
            box-shadow: 0 1px 8px rgba(37, 99, 235, 0.2);
          }

          .ma-header-progress-fill {
            backdrop-filter: saturate(1.08);
            animation: maHeaderFillGlow 2.6s ease-in-out infinite alternate;
          }

          @keyframes maCardIn {
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes maHeaderLineShift {
            from {
              background-position: 0% 50%;
            }

            to {
              background-position: 220% 50%;
            }
          }

          @keyframes maHeaderFillGlow {
            from {
              opacity: 0.58;
            }

            to {
              opacity: 0.92;
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
            .ma-fade-stagger,
            .ma-header-progress,
            .ma-header-progress-fill {
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
      <div className="ma-header-progress" style={s.progressBar}>
        <div className="ma-header-progress-fill" style={s.progressFill} />
      </div>

      {/* LANDING */}
      {step === -1 && !entryMode && (
        <LandingPage
          styles={s}
          totalSteps={totalSteps}
          blockColors={BLOCK_COLORS}
          questionnaireDraft={questionnaireDraft}
          isUserLoggedIn={isUserLoggedIn}
          uiLanguage={uiLanguage}
          onSelectVehicle={() => {
            setEntryMode("vehicleOptions");
            setStep(-1);
          }}
          onSelectAdvice={() => {
            setEntryMode("consejo");
            setStep(-1);
          }}
          onSelectBuyStart={() => {
            setAdvisorContext("buy");
            setEntryMode("buyOptions");
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
          onSelectSellInfo={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "sell", routePage: "home", sellFlowType: "report" });
              return;
            }
            setSellFlowType("report");
            setSelectedValuationVehicleSummary(null);
            setSellAnswers((prev) => ({ ...prev, sellerType: "particular" }));
            setEntryMode("sell");
            setStep(-1);
          }}
          onSelectSellManaged={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "sell", routePage: "home", sellFlowType: "certificate" });
              return;
            }
            setSellFlowType("certificate");
            setSelectedValuationVehicleSummary(null);
            setSellAnswers((prev) => ({ ...prev, sellerType: "profesional" }));
            setEntryMode("sell");
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
          onSelectServiceAutogestor={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "serviceAutogestor", routePage: "home" });
              return;
            }
            setEntryMode("serviceAutogestor");
            setStep(-1);
          }}
          onSelectServiceMaintenance={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "serviceMaintenance", routePage: "home" });
              return;
            }
            setEntryMode("serviceMaintenance");
            setStep(-1);
          }}
          onSelectServiceAppointment={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "serviceAppointment", routePage: "home" });
              return;
            }
            setServiceAppointmentVehicleId("");
            setServiceAppointmentTypeTitle("");
            setServiceAppointmentBackMode("serviceOptions");
            setServiceAppointmentDraft(null);
            setEntryMode("serviceAppointment");
            setStep(-1);
          }}
          onSelectServiceMonthlyPlan={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "serviceMonthlyPlan", routePage: "home" });
              return;
            }
            setEntryMode("serviceMonthlyPlan");
            setStep(-1);
          }}
          onSelectServiceInsurance={() => {
            if (!isUserLoggedIn) {
              setPlanCheckoutFeedback("Inicia sesión o regístrate para sincronizar este flujo con tu portal.");
              openAuthDialog("login", { entryMode: "serviceInsurance", routePage: "home" });
              return;
            }
            setEntryMode("serviceInsurance");
            setStep(-1);
          }}
          onSelectPortalVo={() => {
            if (!isUserLoggedIn) {
              openAuthDialog("register", { entryMode: "portalVo" });
              return;
            }
            setEntryMode("portalVo");
            setStep(-1);
            setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
          }}
          onOpenPlans={() => {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem("movilidad-advisor.plans.scroll-target", "planes");
            }
            setEntryMode("plans");
            setStep(-1);
          }}
          onOpenPlansSection={openPlansSection}
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
            setAnswers({ perfil: "particular" });
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
            setAnswers({ perfil: "particular", flexibilidad: "renting" });
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
            setEntryMode(null);
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "buyOptions" && (
        <BuyOptionsPage
          styles={s}
          onSelectAdvisor={() => {
            setAdvisorContext("buy");
            setAnswers({ perfil: "particular" });
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
              cashBudget: "mas_150000",
              ageFilter: "all",
              mileageFilter: "all",
            });
            setEntryMode("decision");
            setStep(-1);
          }}
          onOpenMarketplace={() => {
            setAdvisorContext("buy");
            setSelectedPortalVoOfferId(null);
            setEntryMode("portalVo");
            setStep(-1);
          }}
          onGoBack={() => {
            setAdvisorContext(null);
            setEntryMode(null);
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "sellOptions" && (
        <SellOptionsPage
          styles={s}
          onSelectCertificate={() => {
            setSellFlowType("certificate");
            setSelectedValuationVehicleSummary(null);
            setSellAnswers((prev) => ({ ...prev, sellerType: "profesional" }));
            setEntryMode("sell");
            setStep(-1);
          }}
          onSelectReport={() => {
            setSellFlowType("report");
            setSelectedValuationVehicleSummary(null);
            setSellAnswers((prev) => ({ ...prev, sellerType: "particular" }));
            setEntryMode("sell");
            setStep(-1);
          }}
          onSelectIDCar={() => {
            setEntryMode("serviceAutogestor");
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
          onSelectAppointment={() => {
            setServiceAppointmentVehicleId("");
            setServiceAppointmentTypeTitle("");
            setServiceAppointmentBackMode("serviceOptions");
            setServiceAppointmentDraft(null);
            setEntryMode("serviceAppointment");
            setStep(-1);
          }}
          onSelectMonthlyPlan={() => {
            setEntryMode("serviceMonthlyPlan");
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
          currentUserEmail={currentUser?.email || ""}
          userAppointments={userAppointments}
          userMaintenances={userMaintenances}
          onUpdateAppointmentStatus={updateUserAppointmentStatus}
          onScheduleAppointment={(context = {}) => {
            setServiceAppointmentVehicleId(normalizeText(context?.vehicleId));
            setServiceAppointmentTypeTitle(normalizeText(context?.appointmentType));
            setServiceAppointmentBackMode("serviceMaintenance");
            setServiceAppointmentDraft(null);
            setEntryMode("serviceAppointment");
            setStep(-1);
          }}
          onManageIdCars={() => {
            if (!isUserLoggedIn || !currentUser?.email) {
              openAuthDialog("login", { entryMode: "idCarsManage", routePage: "home" });
              return;
            }
            setSelectedIdCarVehicleId("");
            setSelectedIdCarOpenEditor(false);
            setEntryMode("idCarsManage");
            setStep(-1);
          }}
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
          onCreateIdCar={() => {
            if (!isUserLoggedIn || !currentUser?.email) {
              openAuthDialog("login", { entryMode: "idCarCreate", routePage: "home" });
              return;
            }

            setSelectedIdCarVehicleId("");
            setSelectedIdCarOpenEditor(false);
            setEntryMode("idCarCreate");
            setStep(-1);
          }}
          onManageIdCars={() => {
            if (!isUserLoggedIn || !currentUser?.email) {
              openAuthDialog("login", { entryMode: "idCarsManage", routePage: "home" });
              return;
            }

            if (typeof window !== "undefined") {
              window.sessionStorage.setItem("movilidad-advisor.idcar.action", "manage");
            }
            setSelectedIdCarVehicleId("");
            setEntryMode("idCarsManage");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "idCarsManage" && (
        <ServiceIdCarsManagePage
          currentUserEmail={currentUser?.email || ""}
          viewMode="list"
          onRequestAppointment={() => { setEntryMode("serviceAppointment"); setStep(-1); }}
          onRequestValuation={() => { navigateToUserDashboardPage("valuations"); }}
          onOpenVehicle={(vehicle, startEditing) => {
            setSelectedIdCarVehicleId(vehicle?.id || "");
            setSelectedIdCarOpenEditor(!!startEditing);
            setEntryMode("idCarDetail");
            setStep(-1);
          }}
          onCreateNew={() => {
            setSelectedIdCarVehicleId("");
            setSelectedIdCarOpenEditor(false);
            setEntryMode("idCarCreate");
            setStep(-1);
          }}
          onGoBack={() => {
            setSelectedIdCarVehicleId("");
            setEntryMode("serviceAutogestor");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "idCarDetail" && (
        <ServiceIdCarsManagePage
          currentUserEmail={currentUser?.email || ""}
          viewMode="detail"
          selectedVehicleId={selectedIdCarVehicleId}
          startEditing={selectedIdCarOpenEditor}
          onRequestAppointment={() => { setEntryMode("serviceAppointment"); setStep(-1); }}
          onRequestValuation={() => { navigateToUserDashboardPage("valuations"); }}
          onGoBack={() => {
            setEntryMode("idCarsManage");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "idCarCreate" && (
        <ServiceIdCarsManagePage
          currentUserEmail={currentUser?.email || ""}
          viewMode="create"
          onRequestAppointment={() => { setEntryMode("serviceAppointment"); setStep(-1); }}
          onRequestValuation={() => { navigateToUserDashboardPage("valuations"); }}
          onCreated={(vehicle) => {
            setSelectedIdCarVehicleId(vehicle?.id || "");
            setSelectedIdCarOpenEditor(false);
            setEntryMode("idCarDetail");
            setStep(-1);
          }}
          onGoBack={() => {
            setEntryMode("idCarsManage");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "serviceAppointment" && (
        <ServiceAppointmentPage
          themeMode={themeMode}
          styles={s}
          currentUserEmail={currentUser?.email || ""}
          selectedVehicleId={serviceAppointmentVehicleId}
          selectedRevisionTitle={serviceAppointmentTypeTitle}
          onSelectVehicleId={(vehicleId) => {
            setServiceAppointmentVehicleId(normalizeText(vehicleId));
          }}
          onConfirmAppointment={async (context = {}) => {
            setServiceAppointmentDraft({
              vehicleId: normalizeText(context?.vehicleId),
              vehicleTitle: normalizeText(context?.vehicleTitle),
              vehiclePlate: normalizeText(context?.vehiclePlate),
              appointmentType: normalizeText(context?.appointmentType),
              provider: normalizeText(context?.provider),
              workshopId: normalizeText(context?.workshopId),
              workshopName: normalizeText(context?.workshopName),
              workshopAddress: normalizeText(context?.workshopAddress),
              workshopDistanceKm: context?.workshopDistanceKm,
              province: normalizeText(context?.province),
              postalCode: normalizeText(context?.postalCode),
              quotedPrice: context?.quotedPrice,
            });
            setEntryMode("serviceAppointmentCalendar");
            setStep(-1);
          }}
          onManageIdCars={() => {
            if (!isUserLoggedIn || !currentUser?.email) {
              openAuthDialog("login", { entryMode: "idCarsManage", routePage: "home" });
              return;
            }
            setSelectedIdCarVehicleId("");
            setSelectedIdCarOpenEditor(false);
            setEntryMode("idCarsManage");
            setStep(-1);
          }}
          onGoBack={() => {
            setEntryMode(serviceAppointmentBackMode || "serviceOptions");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "serviceAppointmentCalendar" && (
        <ServiceAppointmentCalendarPage
          bookingDraft={serviceAppointmentDraft}
          onBack={() => {
            setEntryMode("serviceAppointment");
            setStep(-1);
          }}
          onConfirmBooking={async (booking = {}) => {
            const draft = serviceAppointmentDraft || {};
            const dateKey = normalizeText(booking?.selectedDateKey);
            const timeStr = normalizeText(booking?.selectedTime);

            // Save to billing DB + local state (skip internal ERP save — we do it explicitly below)
            await requestUserAppointment("maintenance", {
              ...draft,
              requestedAt: normalizeText(booking?.requestedAt),
              selectedDateKey: dateKey,
              selectedTime: timeStr,
              skipErpSave: true,
            });

            // Fire-and-forget ERP save (non-blocking — billing save above is authoritative)
            const isoDate = dateKey && timeStr ? `${dateKey}T${timeStr}:00+01:00` : null;
            if (isoDate && currentUserEmail) {
              const notesParts = [
                normalizeText(draft?.vehicleTitle) ? `Vehículo: ${normalizeText(draft.vehicleTitle)}` : "",
                normalizeText(draft?.vehiclePlate) ? `Matrícula: ${normalizeText(draft.vehiclePlate)}` : "",
              ].filter(Boolean).join(" · ");
              postErpAppointmentJson({
                userId:          currentUserEmail,
                scheduledAt:     isoDate,
                appointmentType: normalizeText(draft?.appointmentType),
                workshopName:    normalizeText(draft?.workshopName) || normalizeText(draft?.provider),
                notes:           notesParts || undefined,
              }).catch(() => { /* silencioso — ERP sync best-effort */ });
            }

            setServiceAppointmentDraft(null);
          }}
          onGoHome={() => navigateToUserDashboardPage("appointments")}
        />
      )}

      {step === -1 && entryMode === "serviceMonthlyPlan" && (
        <ServiceMonthlyPlanPage
          themeMode={themeMode}
          styles={s}
          onGoBack={() => {
            setEntryMode("serviceOptions");
            setStep(-1);
          }}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "servicesSeo" && (
        <SeoStaticPage
          styles={s}
          badge={SEO_STATIC_PAGES.servicesSeo.badge}
          title={SEO_STATIC_PAGES.servicesSeo.title}
          description={SEO_STATIC_PAGES.servicesSeo.description}
          sections={SEO_STATIC_PAGES.servicesSeo.sections}
          onGoHome={restart}
        />
      )}

      {step === -1 && entryMode === "aboutCarswise" && (
        <AboutCarswisePage />
      )}

      {entryMode === "viewingPropose" && <ViewingProposePage />}
      {entryMode === "viewingConfirm" && <ViewingConfirmPage />}

      {step === -1 && entryMode === "plans" && (
        <PricingPlansPage
          uiLanguage={uiLanguage}
          onStartFree={() => handleAuthAction("register")}
          onStartPlus={(billingMode) => void startSubscriptionCheckout("plus", { billingMode })}
          plusCheckoutLoading={planCheckoutLoadingId === "plus"}
          plusCheckoutFeedback={planCheckoutFeedback}
          onOpenServices={() => {
            if (typeof window === "undefined") {
              return;
            }

            const premiumSection = document.getElementById("premium");
            premiumSection?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onOpenSellManagement={() => {
            setSellFlowType("certificate");
            setEntryMode("sell");
            setStep(-1);
          }}
          onOpenMarketReport={() => {
            setSellFlowType("report");
            setEntryMode("sell");
            setStep(-1);
          }}
          onOpenInsuranceReview={() => {
            setEntryMode("serviceInsurance");
            setStep(-1);
          }}
          onOpenBoostListing={() => {
            setEntryMode("portalVo");
            setStep(-1);
          }}
          onOpenGuaranteeSeal={() => {
            setSellFlowType("certificate");
            setEntryMode("sell");
            setStep(-1);
          }}
          onOpenPremiumPublish={() => {
            setEntryMode("portalVo");
            setStep(-1);
          }}
          onTalkToTeam={() => {
            setEntryMode("contact");
            setStep(-1);
          }}
        />
      )}

      {step === -1 && entryMode === "contact" && (
        <ContactCarswisePage onGoHome={restart} />
      )}

      {step === -1 && entryMode === "blog" && (
        <BlogIndexPage
          styles={s}
          posts={BLOG_POSTS}
          onOpenPost={openBlogPost}
          onGoHome={restart}
        />
      )}

      {step === -1 && (entryMode === "blogCompraUsado" || entryMode === "blogRentingCompra") && (
        <BlogArticlePage
          styles={s}
          article={selectedBlogArticle}
          onGoBlog={() => openPublicPage("blog")}
          onGoHome={restart}
        />
      )}

      {step === -1 && activeLegalDocs[entryMode] && (
        <LegalPolicyPage
          styles={s}
          title={activeLegalDocs[entryMode].title}
          summary={activeLegalDocs[entryMode].summary}
          updatedAt={activeLegalDocs[entryMode].updatedAt}
          sections={activeLegalDocs[entryMode].sections}
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
          userSolicitudes={userSolicitudes}
          onOpenVehicleDetail={async (sparseOffer) => {
            const targetUrl = sparseOffer.url || sparseOffer.searchUrl || "";
            let fullOffer = targetUrl
              ? ([...decisionMarketListings, ...portalVoOffersLive].find(
                  (o) => (o.url || o.searchUrl) === targetUrl
                ) || null)
              : null;
            if (!fullOffer && targetUrl) {
              try {
                const resp = await fetch(
                  `/api/market?route=vo&url=${encodeURIComponent(targetUrl)}`
                );
                const data = resp.ok ? await resp.json() : null;
                fullOffer = data?.offer || null;
              } catch {}
            }
            fullOffer = fullOffer || sparseOffer;
            setVehicleDetailOffer(fullOffer);
            setVehicleDetailBackTarget("advice");
            setEntryMode("vehicleDetail");
            syncBrowserPath(buildVehicleDetailSharePath(fullOffer), "push");
            setStep(-1);
            if (typeof window !== "undefined") {
              window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
          onNavigate={navigateToUserDashboardPage}
          onRestart={() => {
            restart();
            if (typeof window !== "undefined") {
              setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
          onLogout={handleLogout}
          onRequestAppointment={requestUserAppointment}
          onGoToServiceAppointment={() => { setEntryMode("serviceAppointment"); setStep(-1); }}
          onDeleteAppointment={(id) => {
            const next = userAppointments.filter((a) => a.id !== id);
            writeUserAppointments(next);
            setUserAppointments(next);
            if (currentUserEmail) {
              postDeleteAppointmentJson(currentUserEmail, id).catch(() => {});
            }
          }}
          onUpdateAppointmentStatus={updateUserAppointmentStatus}
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
          onVehicleStatesUpdated={setUserVehicleStates}
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
          marketCatalogSource={marketCatalogSource}
          decisionTopModels={decisionMatchedModels}
          decisionOtherModels={decisionOtherModels}
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
          decisionFlowReady={decisionMarketReady}
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
            setEntryMode("portalVo");
            setStep(-1);
            setSelectedPortalVoOfferId(null);
          }}
          onOpenVehicleDetail={(offer) => {
            setVehicleDetailOffer(offer);
            setVehicleDetailBackTarget("decision");
            setEntryMode("vehicleDetail");
            syncBrowserPath(buildVehicleDetailSharePath(offer), "push");
            if (typeof window !== "undefined") {
              window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
          onRestart={restart}
        />
      )}

      {step === -1 && entryMode === "vehicleDetail" && vehicleDetailOffer && (
        <VehicleDetailPage
          offer={vehicleDetailOffer}
          onBack={() => {
            setEntryMode(vehicleDetailBackTarget === "advice" ? null : "decision");
            syncBrowserPath("/", "replace");
            if (typeof window !== "undefined") {
              window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
        />
      )}

      {step === -1 && (entryMode === "portalVo" || entryMode === "portalVoDetail") && !isUserLoggedIn && (
        <PortalVoAuthGatePage
          themeMode={themeMode}
          styles={s}
          onRegister={() => openAuthDialog("register", { entryMode: "portalVo" })}
          onLogin={() => openAuthDialog("login", { entryMode: "portalVo" })}
          onGoHome={() => { setEntryMode(null); syncBrowserPath("/", "replace"); }}
        />
      )}

      {step === -1 && entryMode === "portalVoDetail" && selectedPortalVoOffer && isUserLoggedIn && (
        <PortalVoDetailPage
          themeMode={themeMode}
          styles={s}
          currentUser={currentUser}
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
            syncBrowserPath("/marketplace-vo", "push");
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
          isReserved={
            (selectedPortalVoOffer?.url && reservedVoUrls.has(selectedPortalVoOffer.url)) ||
            (selectedPortalVoOffer?.id && reservedMarketplaceIds.has(selectedPortalVoOffer.id))
          }
          onLeadCreated={async () => {
            if (!currentUserEmail) return;
            try {
              const { response, data } = await (await import("./utils/apiClient")).getUserMobilityDataJson(currentUserEmail);
              if (response.ok && Array.isArray(data?.solicitudes)) {
                setUserSolicitudes(data.solicitudes);
              }
            } catch {}
          }}
        />
      )}

      {step === -1 && entryMode === "portalVo" && isUserLoggedIn && (
        <PortalVoMarketplacePage
          themeMode={themeMode}
          styles={s}
          portalVoFilters={portalVoFilters}
          updatePortalVoFilter={updatePortalVoFilter}
          portalVoLocations={portalVoLocations}
          portalVoColors={portalVoColors}
          portalVoFuels={portalVoFuels}
          portalVoTransmissions={portalVoTransmissions}
          portalVoBrands={portalVoBrands}
          portalVoModels={portalVoModels}
          onUpdateBrandFilter={(brand) => setPortalVoFilters((prev) => ({ ...prev, brand, model: "" }))}
          onResetFilters={() => setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS })}
          featuredPortalVoOffers={featuredPortalVoOffers}
          filteredPortalVoOffers={filteredPortalVoOffers}
          ResolvedOfferImage={ResolvedOfferImage}
          getOfferBadgeStyle={getOfferBadgeStyle}
          formatCurrency={formatCurrency}
          onOpenOffer={openPortalVoOfferDetail}
          onGoHome={restart}
          loadingOffers={marketplaceVoLoading}
          totalUniverse={marketplaceVoTotal}
          currentPage={marketplaceVoPage}
          totalPages={Math.ceil(marketplaceVoTotal / MARKETPLACE_PAGE_SIZE) || 1}
          onGoToPage={goToMarketplacePage}
          reservedVoUrls={reservedVoUrls}
          reservedMarketplaceIds={reservedMarketplaceIds}
          modalityMode={portalVoModalityMode}
          onModalityChange={handleMarketplaceModalityChange}
        />
      )}

      {step === -1 && entryMode === "sell" && (
        <SellPage
          styles={s}
          sellFlowType={sellFlowType}
          selectedValuationVehicleSummary={selectedValuationVehicleSummary}
          currentUserEmail={currentUserEmail}
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
          sellMarketSnapshot={sellMarketSnapshot}
          sellMarketSnapshotLoading={sellMarketSnapshotLoading}
          sellMarketSnapshotError={sellMarketSnapshotError}
          formatCurrency={formatCurrency}
          onRestart={restart}
          onOpenContact={() => {
            setEntryMode("contact");
            setStep(-1);
          }}
          onGoBack={() => {
            setEntryMode("sellOptions");
            setStep(-1);
          }}
          onSwitchToCertificate={() => {
            setSellFlowType("certificate");
            setSellAnswers((prev) => ({ ...prev, sellerType: "profesional" }));
            setEntryMode("sell");
            setStep(-1);
          }}
          onGoToBuyKnownModel={() => {
            setAdvisorContext("buy");
            setDecisionAnswers({
              ...createInitialDecisionAnswers(),
              operation: "comprar",
              acquisition: "contado",
              hasBrand: "si",
              cashBudget: "mas_150000",
              ageFilter: "all",
              mileageFilter: "all",
            });
            setEntryMode("decision");
            setStep(-1);
          }}
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
          onSetScoreWeights={setScoreWeightsSelection}
          onHandleSingle={handleSingle}
          onHandleMultiNext={handleMultiNext}
          onHandleDualTimelineNext={handleDualTimelineNext}
          onHandleScoreWeightsNext={handleScoreWeightsNext}
          onGoPrevious={goToPreviousStep}
          onRestartQuestionnaire={restartQuestionnaire}
          onTellMeNow={handleTellMeNow}
          answeredSteps={answeredSteps}
          uiLanguage={uiLanguage}
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
      {result && !activeLegalDocs[entryMode] && !(step === -1 && entryMode === "vehicleDetail" && vehicleDetailOffer) && (
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
          openOfferInProductSheet={(offer) => {
            setVehicleDetailOffer(offer);
            setVehicleDetailBackTarget("advice");
            setEntryMode("vehicleDetail");
            syncBrowserPath(buildVehicleDetailSharePath(offer), "push");
            setStep(-1);
            if (typeof window !== "undefined") {
              window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
            }
          }}
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
                    width: 98,
                    height: 40,
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/carswise-logo.png"
                    alt="CarsWise"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      objectPosition: "center center",
                      display: "block",
                    }}
                  />
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#f8fafc" }}>CarsWise</div>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                {uiLanguage === "en" ? "Mobility platform to buy better, sell better and reduce your vehicle's total cost." : "Plataforma de movilidad para comprar mejor, vender mejor y reducir el coste total de tu vehículo."}
              </div>
            </div>

            <div className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>{uiLanguage === "en" ? "CONTACT" : "CONTACTO"}</div>
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                <a href="mailto:soporte@carswise.es" style={{ color: "#e2e8f0", textDecoration: "none" }}>soporte@carswise.es</a>
                <a href="tel:+34910000000" style={{ color: "#e2e8f0", textDecoration: "none" }}>+34 910 000 000</a>
                <div style={{ color: "#94a3b8" }}>{uiLanguage === "en" ? "M-F 09:00 to 18:00 (Spain)" : "L-V 09:00 a 18:00 (España)"}</div>
              </div>
            </div>

            <div className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>{uiLanguage === "en" ? "USEFUL LINKS" : "ENLACES UTILES"}</div>
              <div style={{ display: "grid", gap: 7, fontSize: 12 }}>
                <button type="button" onClick={restart} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>{uiLanguage === "en" ? "Home" : "Inicio"}</button>
                <button type="button" onClick={() => { if (!isUserLoggedIn) { openAuthDialog("register", { entryMode: "portalVo" }); return; } openPublicPage("portalVo"); }} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>Marketplace VO</button>
                <button type="button" onClick={() => openPublicPage("vehicleOptions")} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>{uiLanguage === "en" ? "Vehicle Advisor" : "Asesor de vehículo"}</button>
                <button type="button" onClick={() => openPublicPage("blog")} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>Blog</button>
                <button type="button" onClick={() => openPublicPage("contact")} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>{uiLanguage === "en" ? "Contact" : "Contacto"}</button>
                <button
                  type="button"
                  onClick={() => {
                    openPublicPage("servicesSeo");
                  }}
                  style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}
                >
                  {uiLanguage === "en" ? "Services" : "Servicios"}
                </button>
              </div>
            </div>

            <div className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>{uiLanguage === "en" ? "SOCIAL MEDIA" : "REDES SOCIALES"}</div>
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
            <div>© {new Date().getFullYear()} CarsWise. {uiLanguage === "en" ? "All rights reserved." : "Todos los derechos reservados."}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                [uiLanguage === "en" ? "Legal Notice" : "Aviso legal", "legalNotice"],
                [uiLanguage === "en" ? "Privacy" : "Privacidad", "privacyPolicy"],
                ["Cookies", "cookiePolicy"],
                [uiLanguage === "en" ? "Terms" : "Términos", "termsConditions"],
                [uiLanguage === "en" ? "Marketing Policy" : "Comunicaciones", "marketingPolicy"],
                [uiLanguage === "en" ? "Experian Policy" : "Política Experian", "experianPolicy"],
                [uiLanguage === "en" ? "Experian Terms" : "Condiciones Experian", "experianTerms"],
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


