import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  SiAudi,
  SiBmw,
  SiHyundai,
  SiKia,
  SiMg,
  SiNissan,
  SiRenault,
  SiSeat,
  SiSkoda,
  SiToyota,
  SiVolkswagen,
  SiVolvo,
} from "react-icons/si";

const ANALYZE_API_ENDPOINT = "/api/analyze";
const LISTING_API_ENDPOINT = "/api/find-listing";
const OFFER_IMAGE_PROXY_ENDPOINT = "/api/offer-image";
const SAVED_COMPARISONS_KEY = "movilidad-advisor.savedComparisons.v1";
const USER_APPOINTMENTS_KEY = "movilidad-advisor.userAppointments.v1";
const OFFER_PROVIDER_ALIASES = {
  LeasePlan: "Ayvens",
  "LeasePlan by Ayvens": "Ayvens",
  ALD: "Ayvens",
  "ALD Automotive": "Ayvens",
  "ALD LeasePlan": "Ayvens",
};
const OFFER_MODEL_HINTS = {
  electrico_puro: ["BYD Dolphin", "MG4 Electric", "Hyundai Kona Electric", "Kia EV3"],
  hibrido_no_enchufable: ["Toyota Corolla Hybrid", "Kia Niro Hybrid", "Hyundai Kona Hybrid"],
  hibrido_enchufable: ["Kia Niro PHEV", "Hyundai Tucson PHEV", "BYD Seal U DM-i"],
  microhibrido: ["Ford Puma MHEV", "Kia Sportage MHEV", "Hyundai Tucson MHEV"],
  gasolina: ["Toyota Corolla", "Seat Leon", "Renault Clio", "Kia Ceed"],
  diesel: ["Skoda Octavia", "Peugeot 3008", "Volkswagen Tiguan"],
};
const OFFER_BRAND_HINTS = {
  generalista_europea: ["Seat Leon", "Volkswagen Golf", "Renault Captur"],
  asiatica_fiable: ["Toyota Corolla", "Kia Niro", "Hyundai Kona"],
  premium_alemana: ["Audi A3", "BMW Serie 1", "Mercedes Clase A"],
  premium_escandinava: ["Volvo XC40", "Volvo V60"],
  nueva_china: ["BYD Dolphin", "BYD Seal U DM-i", "MG4 Electric", "MG ZS Hybrid+", "Omoda 5", "Jaecoo 7", "XPeng G6"],
};
const OFFER_FALLBACK_IMAGES = {
  electricBlue: "https://images.pexels.com/photos/1149831/pexels-photo-1149831.jpeg?auto=compress&cs=tinysrgb&w=1200",
  urbanRed: "https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=1200",
  compactGrey: "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=1200",
  suvWhite: "https://images.pexels.com/photos/1592384/pexels-photo-1592384.jpeg?auto=compress&cs=tinysrgb&w=1200",
  premiumBlack: "https://images.pexels.com/photos/244206/pexels-photo-244206.jpeg?auto=compress&cs=tinysrgb&w=1200",
  familySilver: "https://images.pexels.com/photos/1007410/pexels-photo-1007410.jpeg?auto=compress&cs=tinysrgb&w=1200",
};
const OFFER_KNOWN_BRANDS = [
  "audi", "bmw", "byd", "citroen", "cupra", "dacia", "fiat", "ford", "honda", "hyundai", "jeep",
  "kia", "lexus", "mazda", "mercedes", "mg", "mini", "nissan", "opel", "peugeot", "renault",
  "seat", "skoda", "tesla", "toyota", "volkswagen", "volvo", "xpeng",
];
const OFFER_MODEL_FALLBACK_IMAGES = {
  "toyota corolla": "https://commons.wikimedia.org/wiki/Special:FilePath/2023_Toyota_Corolla_Icon_Tech_VVT-i_HEV_CVT_1.8.jpg",
  "kia niro": "https://commons.wikimedia.org/wiki/Special:FilePath/2022_Kia_Niro_3_HEV_Automatic_1.6_Front.jpg",
  "hyundai kona": "https://commons.wikimedia.org/wiki/Special:FilePath/2024_Hyundai_Kona_Premium_T-GDi_MHEV_S-A_1.0_Front.jpg",
  "hyundai tucson": "https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_Tucson_PLATINUM_1.6_T-GDI_2WD_DCT_%28NX4%29_%E2%80%93_f_03012024.jpg",
  "renault captur": "https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Captur_Intens_TCe_130_EDC_%28II%29_%E2%80%93_f_03012021.jpg",
  "volkswagen golf": "https://commons.wikimedia.org/wiki/Special:FilePath/VW_Golf_8_Life_1.5_TSI_Style_%E2%80%93_f_01042021.jpg",
  "seat leon": "https://commons.wikimedia.org/wiki/Special:FilePath/SEAT_Leon_FR_1.5_eTSI_%28IV%29_%E2%80%93_f_29052021.jpg",
  "skoda octavia": "https://commons.wikimedia.org/wiki/Special:FilePath/2020_Skoda_Octavia_SE_L_TDi_S-A_2.0_Front.jpg",
  "audi a3": "https://commons.wikimedia.org/wiki/Special:FilePath/Audi_A3_Sportback_35_TFSI_S_line_%288Y%29_%E2%80%93_f_04052024.jpg",
  "bmw serie 1": "https://commons.wikimedia.org/wiki/Special:FilePath/BMW_118i_M_Sport_%28F40%29_IMG_3530.jpg",
  "bmw x1": "https://commons.wikimedia.org/wiki/Special:FilePath/BMW_X1_xDrive23i_M_Sport_%28U11%29_%E2%80%93_f_09042023.jpg",
  "mercedes clase a": "https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-Benz_A_200_Progressive_%28W_177%29_%E2%80%93_f_16042021.jpg",
  "volvo xc40": "https://commons.wikimedia.org/wiki/Special:FilePath/Volvo_XC40_B4_AWD_R-Design_%E2%80%93_f_19042021.jpg",
  "kia sportage": "https://commons.wikimedia.org/wiki/Special:FilePath/2022_Kia_Sportage_GT-Line_S_ISG_MHEV_1.6_Front.jpg",
  "nissan qashqai": "https://commons.wikimedia.org/wiki/Special:FilePath/2022_Nissan_Qashqai_N-Connecta_DiG-T_MHEV_CVT_1.3_Front.jpg",
  "mg4": "https://commons.wikimedia.org/wiki/Special:FilePath/MG4_Electric_Trophy_Long_Range_Automatic_2023.jpg",
  "mg4 electric": "https://commons.wikimedia.org/wiki/Special:FilePath/MG4_Electric_Trophy_Long_Range_Automatic_2023.jpg",
  "byd dolphin": "https://commons.wikimedia.org/wiki/Special:FilePath/BYD_Dolphin_Plus_2023_%281%29.jpg",
  "peugeot 3008": "https://commons.wikimedia.org/wiki/Special:FilePath/Peugeot_3008_GT_BlueHDi_180_EAT8_%28II%29_%E2%80%93_f_02042021.jpg",
  "dacia duster": "https://commons.wikimedia.org/wiki/Special:FilePath/2022_Dacia_Duster_Journey_TCe_130_4x4_1.3.jpg",
};
const OFFER_COLOR_FALLBACK_IMAGES = {
  blanco: OFFER_FALLBACK_IMAGES.suvWhite,
  white: OFFER_FALLBACK_IMAGES.suvWhite,
  negro: OFFER_FALLBACK_IMAGES.premiumBlack,
  black: OFFER_FALLBACK_IMAGES.premiumBlack,
  gris: OFFER_FALLBACK_IMAGES.compactGrey,
  grey: OFFER_FALLBACK_IMAGES.compactGrey,
  gray: OFFER_FALLBACK_IMAGES.compactGrey,
  rojo: OFFER_FALLBACK_IMAGES.urbanRed,
  red: OFFER_FALLBACK_IMAGES.urbanRed,
  azul: OFFER_FALLBACK_IMAGES.electricBlue,
  blue: OFFER_FALLBACK_IMAGES.electricBlue,
  plata: OFFER_FALLBACK_IMAGES.familySilver,
  silver: OFFER_FALLBACK_IMAGES.familySilver,
};

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

function sanitizeJsonStringContent(input) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && (ch === "\n" || ch === "\r")) {
      result += "\\n";
      continue;
    }

    result += ch;
  }

  return result;
}

function parseAdvisorJson(rawText) {
  const text = String(rawText || "").replace(/```json|```/gi, "").trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const jsonSlice =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? text.slice(firstBrace, lastBrace + 1)
      : text;

  const base = sanitizeJsonStringContent(
    jsonSlice
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  );

  // Intento 1: JSON estricto
  try {
    return JSON.parse(base);
  } catch {}

  // Intento 2: convertir claves con comillas simples a dobles
  const singleQuotedKeys = base.replace(/([{,]\s*)'([^'\\]+?)'\s*:/g, '$1"$2":');
  try {
    return JSON.parse(singleQuotedKeys);
  } catch {}

  // Intento 3: comillar claves sin comillas y normalizar strings con comillas simples
  const repaired = singleQuotedKeys
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  return JSON.parse(repaired);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function resolveOfferProviderName(source) {
  const normalized = normalizeText(source);
  return OFFER_PROVIDER_ALIASES[normalized] || normalized;
}

function normalizeOfferAssetUrl(value) {
  return normalizeText(value)
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\{size\}/g, "768x432-");
}

function buildOfferModelSuggestions(answers = {}, resultData = {}) {
  const viablePropulsions = Array.isArray(resultData?.propulsiones_viables)
    ? resultData.propulsiones_viables.map((item) => normalizeText(item).toLowerCase())
    : [];
  const chinaForward = answers?.marca_preferencia === "nueva_china"
    || /vehicul[oa] chino|marca[s]? china[s]?|tecnologia de vanguardia|byd|mg\b|xpeng|omoda|jaecoo/i.test(
      `${resultData?.solucion_principal?.titulo || ""} ${resultData?.solucion_principal?.resumen || ""}`
    );
  const dynamic = [
    normalizeText(answers?.modelo_objetivo),
    ...(OFFER_MODEL_HINTS[answers?.propulsion_preferida] || []),
    ...(OFFER_BRAND_HINTS[answers?.marca_preferencia] || []),
  ];

  if (chinaForward) {
    dynamic.unshift("BYD Seal U DM-i", "MG ZS Hybrid+", "Omoda 5", "Jaecoo 7", "BYD Dolphin", "MG4 Electric", "XPeng G6");
  }

  if (answers?.entorno_uso === "ciudad") {
    dynamic.push("Toyota Yaris", "MG4 Electric", "Renault Clio");
  } else if (answers?.entorno_uso === "mixto") {
    dynamic.push("Toyota Corolla", "Kia Niro", "Hyundai Tucson");
  } else if (answers?.entorno_uso === "autopista") {
    dynamic.push("Skoda Octavia", "Volkswagen Tiguan", "Hyundai Tucson");
  }

  if (viablePropulsions.some((item) => item.includes("electric"))) {
    dynamic.unshift("BYD Dolphin", "MG4 Electric", "Hyundai Kona Electric");
  } else if (chinaForward || viablePropulsions.some((item) => item.includes("hibr"))) {
    dynamic.unshift(
      ...(chinaForward
        ? ["BYD Seal U DM-i", "MG ZS Hybrid+", "Omoda 5", "Jaecoo 7"]
        : ["Toyota Corolla Hybrid", "Kia Niro Hybrid", "Hyundai Kona Hybrid"])
    );
  }

  const filtered = chinaForward
    ? dynamic.filter((model) => /^(BYD|MG|XPeng|Omoda|Jaecoo)\b/i.test(model) || /(Seal U|Dolphin|MG4|ZS Hybrid|Jaecoo 7)/i.test(model))
    : dynamic;

  return [...new Set(filtered.filter(Boolean))].slice(0, 5);
}

function isSpecificOfferUrl(url, listingType = "movilidad") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();

    if (!url || !["http:", "https:"].includes(parsed.protocol) || /duckduckgo\.com/i.test(host)) {
      return false;
    }

    if (["renting_largo", "renting_corto", "rent_a_car", "carsharing", "renting"].includes(listingType)) {
      return /\/ofertas\/[^/]+\/[^/]+|\/renting[^\s]*\/[^/]+\/[^/]+|\/vehiculos\/[^/]+|\/detalle\/|\/id\/[a-f0-9-]+/.test(path);
    }

    return /\/coches-ocasion\/[^/]+\/[^/]+|\/vehiculos-ocasion\/[^/]+\/[^/]+|\/detalle\/|\/ficha\/|\/id\/[a-f0-9-]+/.test(path);
  } catch {
    return false;
  }
}

function getOfferNavigationUrl(offer, resultData) {
  if (offer?.synthetic || offer?.isGuaranteedFallback) {
    return "";
  }

  const directUrl = normalizeText(offer?.url);
  const listingType = normalizeText(offer?.listingType || resultData?.solucion_principal?.tipo || "movilidad");

  if (!directUrl) {
    return "";
  }

  return isSpecificOfferUrl(directUrl, listingType) ? directUrl : "";
}

function getOfferFallbackSearchUrl(offer = {}, resultData = {}) {
  const source = resolveOfferProviderName(offer?.source || "").toLowerCase();
  const rawTitle = normalizeText(offer?.title || resultData?.solucion_principal?.titulo || "");
  const modelText = normalizeText(rawTitle.split("·")[0] || rawTitle || "coche ocasion");
  const query = encodeURIComponent(modelText);
  const listingType = normalizeText(offer?.listingType || resultData?.solucion_principal?.tipo || "movilidad");

  if (["renting_largo", "renting_corto", "rent_a_car", "carsharing", "renting"].includes(listingType)) {
    if (source.includes("arval")) return `https://www.arval.es/ofertas-renting`;
    if (source.includes("ayvens") || source.includes("leaseplan")) return `https://ofertas-renting.ayvens.es/ofertas/`;
    return `https://www.arval.es/ofertas-renting`;
  }

  if (source.includes("flexicar")) return `https://www.flexicar.es/coches-segunda-mano/?s=${query}`;
  if (source.includes("coches.net") || source.includes("ocasionplus")) return `https://www.coches.net/segunda-mano/?Key=${query}`;
  return `https://www.autohero.com/es/search/?q=${query}`;
}

// eslint-disable-next-line no-unused-vars
function getOfferFallbackInternetImage(offer = {}) {
  const searchQuery = extractOfferInternetSearchQuery(offer);
  const queryKeywords = normalizeText(searchQuery)
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/gi, ",")
    .replace(/^,+|,+$/g, "")
    .split(",")
    .filter((token) => token && token.length > 1)
    .slice(0, 8)
    .join(",");

  if (queryKeywords) {
    const queryUrl = `https://loremflickr.com/1200/700/${queryKeywords}?lock=${hashOfferQuery(searchQuery)}`;
    return buildImageProxyUrl(queryUrl) || queryUrl;
  }

  const haystack = normalizeText(
    `${offer?.title || ""} ${offer?.description || ""} ${offer?.source || ""} ${offer?.listingType || ""}`
  ).toLowerCase();

  if (!haystack) {
    return OFFER_FALLBACK_IMAGES.familySilver;
  }

  const exactModelMatch = Object.entries(OFFER_MODEL_FALLBACK_IMAGES).find(([model]) => haystack.includes(model));
  if (exactModelMatch) {
    return exactModelMatch[1];
  }

  const colorMatch = Object.entries(OFFER_COLOR_FALLBACK_IMAGES).find(([color]) => haystack.includes(color));
  const colorImage = colorMatch?.[1] || "";

  if (/(electric|electrico|ev\b|phev|dolphin|mg4|kona electric|ev3)/.test(haystack)) {
    return colorImage || OFFER_FALLBACK_IMAGES.electricBlue;
  }

  if (/(tucson|sportage|qashqai|captur|kona|niro|tiguan|xc40|x-trail|kodiaq|sorento|suv|crossover)/.test(haystack)) {
    return colorImage || OFFER_FALLBACK_IMAGES.suvWhite;
  }

  if (/(audi|bmw|mercedes|volvo|premium)/.test(haystack)) {
    return colorImage || OFFER_FALLBACK_IMAGES.premiumBlack;
  }

  if (/(yaris|clio|ibiza|i20|urban|utilitario)/.test(haystack)) {
    return colorImage || OFFER_FALLBACK_IMAGES.urbanRed;
  }

  if (/(corolla|golf|leon|octavia|compacto|berlina)/.test(haystack)) {
    return colorImage || OFFER_FALLBACK_IMAGES.compactGrey;
  }

  return colorImage || OFFER_FALLBACK_IMAGES.familySilver;
}

function buildOfferPlaceholderImage(offer = {}) {
  const title = normalizeText(offer?.title || "Imagen no disponible").slice(0, 30);
  const source = normalizeText(offer?.source || "Proveedor").slice(0, 22);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#0ea5e9"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="700" rx="28" fill="url(#bg)"/>
      <text x="80" y="160" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="28" font-weight="700">Imagen orientativa no disponible</text>
      <text x="80" y="300" fill="#ffffff" font-family="Arial, sans-serif" font-size="84">🚗</text>
      <text x="80" y="420" fill="#f8fafc" font-family="Arial, sans-serif" font-size="44" font-weight="700">${title || "Prueba otra oferta"}</text>
      <text x="80" y="480" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="28">${source || "Proveedor"}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const LOCAL_VO_IMAGE_FILE_NAMES = [
  "foto-principal.jpg",
  "foto-principal.jpeg",
  "foto-principal.png",
  "foto-principal.webp",
];

function slugifyOfferFolderName(offer = {}) {
  const base = normalizeText(offer?.imageFolder || offer?.title || `${offer?.brand || ""} ${offer?.model || ""}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "coche-sin-nombre";
}

function buildOfferLocalImageCandidates(offer = {}) {
  const folder = slugifyOfferFolderName(offer);
  return LOCAL_VO_IMAGE_FILE_NAMES.map((fileName) => `/vo-images/${folder}/${fileName}`);
}

function buildOfferImageSearchQuery(offer = {}) {
  const explicitQuery = normalizeText(offer?.imageSearchQuery || offer?.aiImageQuery);
  if (explicitQuery) {
    return explicitQuery;
  }

  const structuredQuery = [
    normalizeText(offer?.brand),
    normalizeText(offer?.model),
    Number.isFinite(Number(offer?.year)) ? String(offer.year) : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (structuredQuery) {
    return structuredQuery;
  }

  return extractOfferInternetSearchQuery(offer);
}

function hasOfferRealImage(offer = {}) {
  return Boolean(normalizeOfferAssetUrl(offer?.image) || buildOfferImageSearchQuery(offer)) && !Boolean(offer?.synthetic);
}

function buildImageSearchProxyUrl(query = "") {
  const normalizedQuery = normalizeText(query);
  return normalizedQuery ? `${OFFER_IMAGE_PROXY_ENDPOINT}?query=${encodeURIComponent(normalizedQuery)}` : "";
}

function shouldBypassImageProxy(url) {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const host = String(parsed.hostname || "").toLowerCase();

    return (
      host === "images.pexels.com"
      || host.endsWith(".pexels.com")
      || host === "commons.wikimedia.org"
      || host.endsWith(".wikimedia.org")
    );
  } catch {
    return false;
  }
}

function buildImageProxyUrl(value) {
  const directImage = normalizeOfferAssetUrl(value);

  if (!directImage || /^data:image\//i.test(directImage)) {
    return directImage;
  }

  try {
    const parsed = new URL(directImage, typeof window !== "undefined" ? window.location.origin : "http://localhost");

    if (!/^https?:$/i.test(parsed.protocol)) {
      return directImage;
    }

    if (
      (typeof window !== "undefined" && parsed.origin === window.location.origin)
      || shouldBypassImageProxy(parsed.toString())
    ) {
      return parsed.toString();
    }

    return `${OFFER_IMAGE_PROXY_ENDPOINT}?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return directImage;
  }
}

function hashOfferQuery(text = "") {
  return String(text || "").split("").reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function extractOfferInternetSearchQuery(offer = {}) {
  const combined = normalizeText(`${offer?.title || ""} ${offer?.description || ""}`)
    .replace(/window\.[^\s]+.*$/i, "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(?:ok mobility|autohero|flexicar|coches\.net|arval|ayvens|leaseplan)\b/gi, " ")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lowerCombined = combined.toLowerCase();
  const brandMatch = OFFER_KNOWN_BRANDS.find((brand) => lowerCombined.includes(brand));

  if (brandMatch) {
    const brandIndex = lowerCombined.indexOf(brandMatch);
    const tail = combined.slice(brandIndex);
    const firstChunk = tail.split(/[·|()]/)[0] || tail;
    const cleanedChunk = firstChunk
      .replace(/\b(?:renting|oferta|cuota|desde|mes)\b/gi, " ")
      .replace(/€/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanedChunk.split(/\s+/).length >= 2) {
      return cleanedChunk;
    }
  }

  return normalizeText(offer?.title || offer?.description || "Coche recomendado");
}

function OfferGuaranteeSeal({ months = 12, size = 54 }) {
  return (
    <div
      aria-label={`Vehículo con ${months} meses de garantía`}
      title={`Vehículo con ${months} meses de garantía`}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: size,
        height: size,
        zIndex: 2,
        pointerEvents: "none",
        filter: "drop-shadow(0 6px 10px rgba(15,23,42,0.22))",
      }}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          background: "linear-gradient(90deg,#c8aa4f 0%, #e9e2a6 48%, #b8923f 100%)",
          clipPath: "polygon(50% 0%, 61% 4%, 72% 1%, 80% 9%, 91% 9%, 96% 19%, 100% 30%, 96% 41%, 100% 52%, 94% 62%, 94% 74%, 84% 81%, 76% 91%, 64% 94%, 50% 100%, 36% 94%, 24% 91%, 16% 81%, 6% 74%, 6% 62%, 0% 52%, 4% 41%, 0% 30%, 4% 19%, 9% 9%, 20% 9%, 28% 1%, 39% 4%)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "20%",
            width: "60%",
            height: "60%",
            display: "block",
          }}
        >
          <path
            d="M20 6.5 9.5 17 4 11.5"
            fill="none"
            stroke="#050505"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function ResolvedOfferImage({ offer = {}, alt, loading = "lazy", style = {} }) {
  const fallbackSrc = buildOfferPlaceholderImage(offer);
  const searchQuery = buildOfferImageSearchQuery(offer);
  const directImage = normalizeOfferAssetUrl(offer?.image);
  const localFolder = slugifyOfferFolderName(offer);
  const localCandidates = useMemo(
    () => buildOfferLocalImageCandidates({ imageFolder: localFolder }),
    [localFolder]
  );
  const imageCandidates = useMemo(() => {
    const aiCandidate = buildImageSearchProxyUrl(searchQuery);
    const directCandidate = directImage
      ? `${OFFER_IMAGE_PROXY_ENDPOINT}?url=${encodeURIComponent(directImage)}`
      : "";

    return [
      ...localCandidates,
      ...(offer?.preferAiImage ? [aiCandidate, directCandidate] : [directCandidate, aiCandidate]),
      fallbackSrc,
    ].filter((candidate, index, array) => candidate && array.indexOf(candidate) === index);
  }, [searchQuery, directImage, offer?.preferAiImage, localCandidates, fallbackSrc]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageCandidates]);

  const currentSrc = imageCandidates[Math.min(candidateIndex, imageCandidates.length - 1)] || fallbackSrc;
  const numericHeight =
    typeof style?.height === "number"
      ? style.height
      : Number.parseInt(String(style?.height || ""), 10);
  const sealSize = Number.isFinite(numericHeight)
    ? Math.max(42, Math.min(58, Math.round(numericHeight * 0.28)))
    : 54;

  return (
    <div
      style={{
        position: "relative",
        width: style?.width || "100%",
        height: style?.height,
        minHeight: style?.minHeight,
        maxHeight: style?.maxHeight,
        borderRadius: style?.borderRadius,
        overflow: style?.overflow || (style?.borderRadius ? "hidden" : undefined),
        display: "block",
        lineHeight: 0,
      }}
    >
      <img
        src={currentSrc}
        alt={alt || offer?.title || "Oferta"}
        loading={loading}
        referrerPolicy="no-referrer"
        onError={() => {
          setCandidateIndex((current) => Math.min(current + 1, imageCandidates.length - 1));
        }}
        style={{
          ...style,
          width: "100%",
          height: style?.height || "auto",
          display: "block",
        }}
      />
      {offer?.hasGuaranteeSeal ? (
        <OfferGuaranteeSeal months={offer?.warrantyMonths || 12} size={sealSize} />
      ) : null}
    </div>
  );
}

function openOfferInNewTab(url) {
  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function buildSearchCoverageSummary(coverage = null) {
  if (!coverage) {
    return "";
  }

  const visitedPages = Number(coverage?.visitedProviderPages || 0);
  const visitedCompanies = Number(coverage?.visitedCompanyCount || 0);
  const configuredCompanies = Number(coverage?.configuredCompanyCount || 0);
  const externalQueries = Number(coverage?.duckduckgoQueriesAttempted || 0);
  const desiredType = normalizeText(coverage?.desiredType || "").includes("rent") ? "renting" : "compra";

  if (!visitedPages && !visitedCompanies) {
    return "";
  }

  const providerLabel = visitedCompanies === 1 ? "portal" : "portales";
  const pageLabel = visitedPages === 1 ? "página" : "páginas";
  const extraQueryText = externalQueries > 0 ? ` + ${externalQueries} búsquedas externas` : "";

  return `Se han revisado ${visitedPages} ${pageLabel} de ${visitedCompanies}/${configuredCompanies || visitedCompanies} ${providerLabel} para esta búsqueda de ${desiredType}${extraQueryText}.`;
}

function getOfferBadgeStyle(tone = "slate") {
  const toneMap = {
    green: {
      background: "rgba(16,185,129,0.12)",
      border: "1px solid rgba(52,211,153,0.24)",
      color: "#bbf7d0",
    },
    success: {
      background: "rgba(16,185,129,0.16)",
      border: "1px solid rgba(52,211,153,0.32)",
      color: "#d1fae5",
    },
    amber: {
      background: "rgba(245,158,11,0.12)",
      border: "1px solid rgba(251,191,36,0.24)",
      color: "#fde68a",
    },
    info: {
      background: "rgba(37,99,235,0.14)",
      border: "1px solid rgba(96,165,250,0.28)",
      color: "#dbeafe",
    },
    neutral: {
      background: "rgba(148,163,184,0.1)",
      border: "1px solid rgba(148,163,184,0.16)",
      color: "#cbd5e1",
    },
    slate: {
      background: "rgba(148,163,184,0.12)",
      border: "1px solid rgba(148,163,184,0.22)",
      color: "#e2e8f0",
    },
  };

  return {
    ...(toneMap[tone] || toneMap.slate),
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
  };
}

function getOfferTrustBadges(offer = {}) {
  const badges = [];

  if (offer?.url) {
    badges.push({ label: "Anuncio directo verificado", tone: "green" });
  } else if (offer?.searchUrl) {
    badges.push({ label: "Referencia orientativa", tone: "amber" });
  } else {
    badges.push({ label: "Sin enlace exacto", tone: "slate" });
  }

  badges.push(
    offer?.preferAiImage || normalizeText(offer?.imageSearchQuery || offer?.aiImageQuery)
      ? { label: "Foto buscada por IA", tone: "green" }
      : offer?.hasRealImage
      ? { label: "Foto real verificada", tone: "green" }
      : { label: "Imagen orientativa", tone: "slate" }
  );

  return badges;
}

function getOfferActionMeta(offer = {}) {
  const directUrl = normalizeText(offer?.url);
  if (directUrl) {
    return {
      href: directUrl,
      label: offer?.synthetic ? "Abrir referencia concreta ↗" : "Abrir anuncio real ↗",
      exact: true,
    };
  }

  const searchUrl = normalizeText(offer?.searchUrl);
  if (searchUrl) {
    return {
      href: searchUrl,
      label: "Ir al portal del proveedor ↗",
      exact: false,
    };
  }

  return null;
}

function toNumber(value, fallback = 0) {
  if (Number.isFinite(Number(value))) {
    return Number(value);
  }

  const text = normalizeText(value);
  if (!text) {
    return fallback;
  }

  const cleaned = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAlternative(item) {
  return {
    tipo: normalizeText(item?.tipo),
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
    titulo: normalizeText(item?.titulo),
    razon: normalizeText(item?.razon),
  };
}

function normalizeScoreBreakdown(value) {
  const raw = value && typeof value === "object" ? value : {};

  return {
    encaje_uso: clamp(Number(raw.encaje_uso || raw.encaje || 0), 0, 25),
    coste_total: clamp(Number(raw.coste_total || raw.coste_estimado || raw.coste || 0), 0, 20),
    flexibilidad: clamp(Number(raw.flexibilidad || 0), 0, 20),
    viabilidad_real: clamp(Number(raw.viabilidad_real || raw.viabilidad || 0), 0, 20),
    ajuste_preferencias: clamp(Number(raw.ajuste_preferencias || raw.preferencias || 0), 0, 15),
  };
}

function deriveScoreBreakdown(totalScore = 0) {
  const safeScore = clamp(Number(totalScore || 0), 0, 100);
  const encaje_uso = Math.round(safeScore * 0.3);
  const coste_total = Math.round(safeScore * 0.22);
  const flexibilidad = Math.round(safeScore * 0.18);
  const viabilidad_real = Math.round(safeScore * 0.17);
  const ajuste_preferencias = Math.max(
    0,
    safeScore - encaje_uso - coste_total - flexibilidad - viabilidad_real
  );

  return normalizeScoreBreakdown({
    encaje_uso,
    coste_total,
    flexibilidad,
    viabilidad_real,
    ajuste_preferencias,
  });
}

function normalizeTcoDetail(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const seed = fallback && typeof fallback === "object" ? fallback : {};

  const base_mensual = clamp(
    Math.round(
      toNumber(raw.base_mensual ?? raw.cuota_base ?? raw.amortizacion ?? raw.coste_base ?? seed.base_mensual, 0)
    ),
    0,
    5000
  );
  const seguro = clamp(Math.round(toNumber(raw.seguro ?? seed.seguro, 0)), 0, 1500);
  const energia = clamp(Math.round(toNumber(raw.energia ?? raw.combustible ?? seed.energia, 0)), 0, 1500);
  const mantenimiento = clamp(
    Math.round(toNumber(raw.mantenimiento ?? raw.servicio ?? seed.mantenimiento, 0)),
    0,
    1500
  );
  const extras = clamp(
    Math.round(toNumber(raw.extras ?? raw.impuestos_aparcamiento ?? raw.impuestos ?? seed.extras, 0)),
    0,
    1500
  );
  const entrada_inicial = clamp(
    Math.round(toNumber(raw.entrada_inicial ?? raw.entrada ?? raw.capital_inicial ?? seed.entrada_inicial, 0)),
    0,
    120000
  );
  const computedTotal = base_mensual + seguro + energia + mantenimiento + extras;
  const total_mensual = clamp(
    Math.round(toNumber(raw.total_mensual ?? raw.tco_mensual ?? raw.coste_total_mensual ?? seed.total_mensual, computedTotal)),
    0,
    10000
  );
  const total_anual = clamp(
    Math.round(toNumber(raw.total_anual ?? raw.tco_anual ?? seed.total_anual, total_mensual * 12)),
    0,
    120000
  );

  return {
    concepto_base: normalizeText(raw.concepto_base || raw.concepto_principal || seed.concepto_base || "Base de movilidad"),
    entrada_inicial,
    base_mensual,
    seguro,
    energia,
    mantenimiento,
    extras,
    total_mensual,
    total_anual,
    nota: normalizeText(raw.nota || raw.comentario || raw.aviso || seed.nota),
  };
}

function normalizeComparatorRow(item) {
  return {
    criterio: normalizeText(item?.criterio),
    opcion_principal: normalizeText(item?.opcion_principal || item?.principal),
    alternativa_1: normalizeText(item?.alternativa_1 || item?.alternativa1),
    alternativa_2: normalizeText(item?.alternativa_2 || item?.alternativa2),
    ganador: normalizeText(item?.ganador || "principal"),
  };
}

function buildComparatorFallback(value) {
  const alternatives = Array.isArray(value?.alternativas)
    ? value.alternativas.map(normalizeAlternative).filter((item) => item.titulo || item.razon)
    : [];
  const alt1 = alternatives[0] || {};
  const alt2 = alternatives[1] || {};
  const tco = normalizeTcoDetail(value?.tco_detalle, {});
  const scoreBreakdown = normalizeScoreBreakdown(value?.score_desglose);

  return [
    {
      criterio: "Coste total real",
      opcion_principal: tco.total_mensual
        ? `~${formatCurrency(tco.total_mensual)}/mes con mejor control del total real.`
        : "Coste equilibrado frente al resto.",
      alternativa_1: alt1.titulo ? `${alt1.titulo}: alternativa válida, pero con más variables abiertas.` : "Sin alternativa claramente superior en coste.",
      alternativa_2: alt2.titulo ? `${alt2.titulo}: opción secundaria para este criterio.` : "Menos prioritaria en este criterio.",
      ganador: scoreBreakdown.coste_total >= 12 ? "principal" : alt1.titulo ? "alternativa_1" : "principal",
    },
    {
      criterio: "Flexibilidad",
      opcion_principal: "Equilibrio más sano entre compromiso, uso y capacidad de cambio.",
      alternativa_1: alt1.titulo ? `${alt1.titulo}: puede ganar si valoras otra renuncia concreta.` : "Flexibilidad menos clara.",
      alternativa_2: alt2.titulo ? `${alt2.titulo}: encaja, pero con menos equilibrio general.` : "Menor prioridad.",
      ganador: "principal",
    },
    {
      criterio: "Viabilidad real",
      opcion_principal: "Es la que menos fricción introduce con tu contexto actual.",
      alternativa_1: alt1.titulo ? `${alt1.titulo}: útil, pero depende de más supuestos.` : "Más incertidumbre operativa.",
      alternativa_2: alt2.titulo ? `${alt2.titulo}: requiere más concesiones para funcionar bien.` : "Más débil en ejecución.",
      ganador: scoreBreakdown.viabilidad_real >= 12 ? "principal" : alt1.titulo ? "alternativa_1" : "principal",
    },
  ].map(normalizeComparatorRow);
}

function normalizeTransparencyBlock(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const seed = fallback && typeof fallback === "object" ? fallback : {};

  return {
    confianza_nivel: normalizeText(raw.confianza_nivel || seed.confianza_nivel || "media"),
    confianza_motivo: normalizeText(raw.confianza_motivo || raw.resumen || seed.confianza_motivo),
    supuestos_clave: normalizeStringArray(raw.supuestos_clave || seed.supuestos_clave).slice(0, 4),
    validaciones_pendientes: normalizeStringArray(raw.validaciones_pendientes || seed.validaciones_pendientes).slice(0, 4),
  };
}

function buildTransparencyFallback(value) {
  const tco = normalizeTcoDetail(value?.tco_detalle, {});
  const score = Number(value?.solucion_principal?.score || value?.alineacion_pct || 0);
  const level = score >= 82 ? "alta" : score >= 72 ? "media" : "ajustada";

  return {
    confianza_nivel: level,
    confianza_motivo:
      level === "alta"
        ? "La recomendación está bastante apoyada por tus respuestas y presenta pocas contradicciones fuertes."
        : level === "media"
          ? "La dirección parece buena, pero todavía conviene validar precio final y condiciones reales."
          : "La orientación es útil, aunque necesita confirmar varios supuestos antes de cerrar decisión.",
    supuestos_clave: [
      tco.total_mensual ? `Que el coste final se mantenga cerca de ${formatCurrency(tco.total_mensual)}/mes.` : "Que el coste final real no se dispare frente al estimado.",
      "Que tu patrón de uso y kilometraje se mantenga parecido en los próximos meses.",
    ],
    validaciones_pendientes: [
      "Comparar 2 o 3 ofertas reales antes de decidir.",
      "Confirmar stock, condiciones y letra pequeña de la operación final.",
    ],
  };
}

function normalizeActionPlan(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const seed = fallback && typeof fallback === "object" ? fallback : {};

  return {
    semaforo: normalizeText(raw.semaforo || raw.color || seed.semaforo || "ambar"),
    estado: normalizeText(raw.estado || raw.titulo || seed.estado || "Compara 2 o 3 ofertas antes de cerrar"),
    resumen: normalizeText(raw.resumen || seed.resumen),
    acciones: normalizeStringArray(raw.acciones || raw.pasos || seed.acciones).slice(0, 4),
    alertas_rojas: normalizeStringArray(raw.alertas_rojas || raw.riesgos || seed.alertas_rojas).slice(0, 3),
  };
}

function buildActionPlanFallback(value) {
  const transparency = normalizeTransparencyBlock(value?.transparencia, buildTransparencyFallback(value));
  const tco = normalizeTcoDetail(value?.tco_detalle, {});
  const companies = normalizeStringArray(value?.solucion_principal?.empresas_recomendadas).slice(0, 2);
  const companyText = companies.length > 0 ? companies.join(" y ") : "varias plataformas";
  const level = normalizeText(transparency.confianza_nivel || "").toLowerCase();
  const semaforo = level === "alta" ? "verde" : level === "ajustada" ? "rojo" : "ambar";

  return {
    semaforo,
    estado:
      semaforo === "verde"
        ? "Puedes avanzar a shortlist y cierre"
        : semaforo === "rojo"
          ? "Pausa y revalida antes de comprometerte"
          : "Buena dirección: compara antes de firmar",
    resumen:
      semaforo === "verde"
        ? "La recomendación está bien orientada; ahora toca comparar bien y evitar letra pequeña."
        : semaforo === "rojo"
          ? "Hay varias hipótesis abiertas; mejor validar antes de cerrar una operación."
          : "La recomendación apunta bien, pero aún necesita contraste con ofertas reales y condiciones finales.",
    acciones: [
      `Pide 3 ofertas cerradas a ${companyText} con el mismo formato de precio y servicios.`,
      tco.total_mensual
        ? `Usa ${formatCurrency(tco.total_mensual)}/mes como techo real para filtrar opciones.`
        : "Fija un techo de coste real mensual antes de comparar ofertas.",
      "No cierres nada sin revisar stock, permanencia o financiación y la letra pequeña final.",
    ],
    alertas_rojas: [
      "Firmar solo por la cuota visible sin mirar el coste total real.",
      "Aceptar una oferta sin comparar al menos 2 o 3 alternativas equivalentes.",
    ],
  };
}

function normalizeAdvisorResult(value) {
  const main = value?.solucion_principal || {};
  const score = Number.isFinite(Number(main.score)) ? Number(main.score) : Number(value?.alineacion_pct) || 0;
  const providedBreakdown = normalizeScoreBreakdown(value?.score_desglose);
  const providedBreakdownTotal = Object.values(providedBreakdown).reduce(
    (acc, item) => acc + Number(item || 0),
    0
  );
  const fallbackBaseCost = clamp(Math.round(toNumber(main.coste_estimado, 0)), 0, 5000);
  const tco_detalle = normalizeTcoDetail(value?.tco_detalle, {
    concepto_base: "Coste mensual estimado",
    base_mensual: fallbackBaseCost,
    seguro: 0,
    energia: 0,
    mantenimiento: 0,
    extras: 0,
    entrada_inicial: 0,
    total_mensual: fallbackBaseCost,
    total_anual: fallbackBaseCost * 12,
    nota: normalizeText(value?.tco_aviso),
  });
  const normalizedAlternatives = Array.isArray(value?.alternativas)
    ? value.alternativas.map(normalizeAlternative).filter((item) => item.titulo || item.razon)
    : [];
  const baseForDerived = {
    ...value,
    alternativas: normalizedAlternatives,
    score_desglose: providedBreakdownTotal > 0 ? providedBreakdown : deriveScoreBreakdown(score),
    tco_detalle,
    solucion_principal: {
      ...main,
      score,
    },
  };

  return {
    alineacion_pct: Number.isFinite(Number(value?.alineacion_pct)) ? Number(value.alineacion_pct) : 0,
    solucion_principal: {
      tipo: normalizeText(main.tipo),
      score,
      titulo: normalizeText(main.titulo),
      resumen: normalizeText(main.resumen),
      ventajas: normalizeStringArray(main.ventajas),
      inconvenientes: normalizeStringArray(main.inconvenientes),
      coste_estimado: normalizeText(main.coste_estimado),
      empresas_recomendadas: normalizeStringArray(main.empresas_recomendadas),
      etiqueta_dgt: normalizeText(main.etiqueta_dgt),
      tension_principal: normalizeText(main.tension_principal),
    },
    score_desglose: baseForDerived.score_desglose,
    por_que_gana:
      normalizeStringArray(value?.por_que_gana).length > 0
        ? normalizeStringArray(value?.por_que_gana).slice(0, 4)
        : normalizeStringArray(main.ventajas).slice(0, 3),
    alternativas: normalizedAlternatives,
    comparador_final: Array.isArray(value?.comparador_final) && value.comparador_final.length > 0
      ? value.comparador_final.map(normalizeComparatorRow).filter((item) => item.criterio)
      : buildComparatorFallback(baseForDerived),
    transparencia: normalizeTransparencyBlock(value?.transparencia, buildTransparencyFallback(baseForDerived)),
    plan_accion: normalizeActionPlan(value?.plan_accion, buildActionPlanFallback(baseForDerived)),
    tco_aviso: normalizeText(value?.tco_aviso),
    tco_detalle,
    consejo_experto: normalizeText(value?.consejo_experto),
    siguiente_paso: normalizeText(value?.siguiente_paso),
    propulsiones_viables: normalizeStringArray(value?.propulsiones_viables),
  };
}

function isCompleteAdvisorResult(value) {
  const normalized = normalizeAdvisorResult(value);
  const main = normalized.solucion_principal;

  return Boolean(
    normalized.alineacion_pct > 0 &&
      main.tipo &&
      main.score > 0 &&
      main.titulo &&
      main.resumen &&
      main.ventajas.length >= 2 &&
      main.inconvenientes.length >= 1 &&
      main.coste_estimado &&
      main.empresas_recomendadas.length >= 1 &&
      normalized.alternativas.length >= 1 &&
      normalized.tco_aviso &&
      normalized.tco_detalle?.total_mensual > 0 &&
      normalized.consejo_experto &&
      normalized.siguiente_paso &&
      normalized.propulsiones_viables.length >= 1
  );
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactCompanyMentions(value, companyNames = [], replacement = "plataformas especializadas") {
  const text = normalizeText(value);

  if (!text || !Array.isArray(companyNames) || companyNames.length === 0) {
    return text;
  }

  const escapedNames = companyNames.map((name) => escapeRegExp(name)).filter(Boolean);
  if (!escapedNames.length) {
    return text;
  }

  return text
    .replace(new RegExp(`\\b(?:${escapedNames.join("|")})\\b`, "gi"), "__PLATFORM__")
    .replace(/(?:__PLATFORM__(?:\s*(?:,|y|e)\s*)?)+/gi, replacement)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function sanitizeResultForDisplay(value) {
  const companyNames = Array.isArray(value?.solucion_principal?.empresas_recomendadas)
    ? value.solucion_principal.empresas_recomendadas
    : [];

  return {
    ...value,
    solucion_principal: {
      ...value?.solucion_principal,
      resumen: redactCompanyMentions(value?.solucion_principal?.resumen, companyNames),
      ventajas: (value?.solucion_principal?.ventajas || []).map((item) =>
        redactCompanyMentions(item, companyNames)
      ),
      inconvenientes: (value?.solucion_principal?.inconvenientes || []).map((item) =>
        redactCompanyMentions(item, companyNames)
      ),
      tension_principal: redactCompanyMentions(value?.solucion_principal?.tension_principal, companyNames),
      empresas_recomendadas: [],
    },
    por_que_gana: Array.isArray(value?.por_que_gana)
      ? value.por_que_gana.map((item) => redactCompanyMentions(item, companyNames))
      : [],
    alternativas: Array.isArray(value?.alternativas)
      ? value.alternativas.map((item) => ({
          ...item,
          titulo: redactCompanyMentions(item?.titulo, companyNames),
          razon: redactCompanyMentions(item?.razon, companyNames),
        }))
      : [],
    comparador_final: Array.isArray(value?.comparador_final)
      ? value.comparador_final.map((item) => ({
          ...item,
          criterio: redactCompanyMentions(item?.criterio, companyNames),
          opcion_principal: redactCompanyMentions(item?.opcion_principal, companyNames),
          alternativa_1: redactCompanyMentions(item?.alternativa_1, companyNames),
          alternativa_2: redactCompanyMentions(item?.alternativa_2, companyNames),
        }))
      : [],
    transparencia: {
      ...value?.transparencia,
      confianza_motivo: redactCompanyMentions(value?.transparencia?.confianza_motivo, companyNames),
      supuestos_clave: Array.isArray(value?.transparencia?.supuestos_clave)
        ? value.transparencia.supuestos_clave.map((item) => redactCompanyMentions(item, companyNames))
        : [],
      validaciones_pendientes: Array.isArray(value?.transparencia?.validaciones_pendientes)
        ? value.transparencia.validaciones_pendientes.map((item) => redactCompanyMentions(item, companyNames))
        : [],
    },
    tco_aviso: redactCompanyMentions(value?.tco_aviso, companyNames),
    tco_detalle: {
      ...value?.tco_detalle,
      concepto_base: redactCompanyMentions(value?.tco_detalle?.concepto_base, companyNames),
      nota: redactCompanyMentions(value?.tco_detalle?.nota, companyNames),
    },
    consejo_experto: redactCompanyMentions(value?.consejo_experto, companyNames),
    siguiente_paso: redactCompanyMentions(value?.siguiente_paso, companyNames, "plataformas de confianza"),
  };
}

function normalizeDecisionAiResult(value) {
  const top = value?.oferta_top || value?.recomendacion_principal || {};

  return {
    resumen: normalizeText(value?.resumen),
    criterio_principal: normalizeText(value?.criterio_principal || value?.criterio || value?.enfoque),
    oferta_top: {
      titulo: normalizeText(top?.titulo),
      precio_objetivo: normalizeText(top?.precio_objetivo || top?.precio || top?.rango_precio),
      cuota_estimada: normalizeText(top?.cuota_estimada || top?.cuota || top?.mensualidad),
      razon: normalizeText(top?.razon || top?.resumen),
      riesgo: normalizeText(top?.riesgo),
    },
    alternativas: Array.isArray(value?.alternativas)
      ? value.alternativas
          .map((item) => ({
            titulo: normalizeText(item?.titulo),
            precio: normalizeText(item?.precio || item?.precio_objetivo),
            razon: normalizeText(item?.razon),
          }))
          .filter((item) => item.titulo || item.razon)
      : [],
    alertas: normalizeStringArray(value?.alertas || value?.puntos_a_revisar),
    siguiente_paso: normalizeText(value?.siguiente_paso),
  };
}

function isCompleteDecisionAiResult(value) {
  const normalized = normalizeDecisionAiResult(value);

  return Boolean(
    normalized.resumen &&
      normalized.criterio_principal &&
      normalized.oferta_top?.titulo &&
      normalized.oferta_top?.razon &&
      normalized.siguiente_paso
  );
}

function normalizeSellAiResult(value) {
  const range = value?.rango_publicacion || {};

  return {
    precio_objetivo: normalizeText(value?.precio_objetivo || value?.targetPrice),
    rango_publicacion: {
      min: normalizeText(range?.min || value?.precio_min || value?.lowPrice),
      max: normalizeText(range?.max || value?.precio_max || value?.highPrice),
    },
    nivel_demanda: normalizeText(value?.nivel_demanda || value?.demanda),
    tiempo_estimado_venta: normalizeText(value?.tiempo_estimado_venta || value?.tiempo_venta),
    resumen: normalizeText(value?.resumen || value?.explicacion),
    argumentos_clave: normalizeStringArray(value?.argumentos_clave || value?.puntos_fuertes),
    alertas: normalizeStringArray(value?.alertas || value?.puntos_a_revisar),
    estrategia_publicacion: normalizeText(value?.estrategia_publicacion || value?.siguiente_paso),
  };
}

function isCompleteSellAiResult(value) {
  const normalized = normalizeSellAiResult(value);

  return Boolean(
    normalized.precio_objetivo &&
      normalized.rango_publicacion?.min &&
      normalized.rango_publicacion?.max &&
      normalized.resumen &&
      normalized.estrategia_publicacion
  );
}

async function readApiResponse(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html") || trimmed.startsWith("<")) {
    const error = new Error(
      typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? "El endpoint /api/analyze no estaba respondiendo como API en local. Reinicia npm start y vuelve a probar el test."
        : "El endpoint /api/analyze ha devuelto HTML en lugar de JSON. Revisa la configuración del hosting o de la API."
    );
    error.code = "NON_JSON_API_RESPONSE";
    throw error;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const error = new Error("La respuesta del analisis no tiene un JSON valido.");
    error.code = "INVALID_API_RESPONSE";
    throw error;
  }
}

function MercedesLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 5.2v6.8M12 12l-5.8 3.4M12 12l5.8 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BydLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 36 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="31" height="17" rx="8.5" stroke="currentColor" strokeWidth="2" />
      <text x="18" y="15.2" textAnchor="middle" fontSize="9.2" fontWeight="700" fontFamily="Segoe UI, Arial, sans-serif" fill="currentColor">
        BYD
      </text>
    </svg>
  );
}

function XPengLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M4.5 8.2 9.5 12l2.5-1.7L14.5 12l5-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 12v4.8M14.5 12v4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────────────────────────
// STEPS — todas las preguntas del marco
// ─────────────────────────────────────────
const STEPS = [
  // BLOQUE 1 — PERFIL BASE
  {
    id: "perfil",
    block: "Perfil",
    blockIcon: "👤",
    question: "¿Para quién es la movilidad?",
    subtitle: "Esto nos ayuda a personalizar el análisis completo",
    type: "cards",
    options: [
      { value: "particular", label: "Para mí / familia", icon: "👤", desc: "Uso personal o familiar" },
      { value: "empresa", label: "Para mi empresa", icon: "🏢", desc: "Flota o vehículo de empresa" },
      { value: "autonomo", label: "Soy autónomo", icon: "💼", desc: "Uso mixto profesional / personal" },
    ],
  },
  {
    id: "flexibilidad",
    block: "Vinculación",
    blockIcon: "🤝",
    question: "¿Qué relación prefieres con el vehículo?",
    subtitle: "Cada modelo tiene implicaciones financieras y de riesgo muy distintas",
    type: "cards",
    options: [
      { value: "propiedad_contado", label: "Comprar al contado", icon: "💶", desc: "Mayor poder negociador, capital inmovilizado" },
      { value: "propiedad_financiada", label: "Comprar financiado", icon: "📝", desc: "Pago a plazos, coche mío al final" },
      { value: "renting", label: "Renting (cuota fija)", icon: "📅", desc: "Todo incluido, sin propiedad" },
      { value: "flexible", label: "Lo más flexible posible", icon: "⚡", desc: "Pagar solo cuando uso o suscripción" },
    ],
  },
  // BLOQUE 0 — DIMENSIÓN ENERGÉTICA (muy determinante)
  {
    id: "propulsion_preferida",
    block: "Energía",
    blockIcon: "⚡",
    question: "¿Qué motorización prefieres?",
    subtitle: "Es una decisión clave porque condiciona coste total, etiqueta DGT, ZBE y uso real",
    type: "cards",
    options: [
      { value: "electrico_puro", label: "Eléctrico puro (BEV)", icon: "⚡", desc: "Etiqueta CERO — recarga 100% eléctrica" },
      { value: "hibrido_no_enchufable", label: "Híbrido no enchufable (HEV)", icon: "🔋", desc: "Etiqueta ECO — sin enchufe, muy eficiente en ciudad" },
      { value: "hibrido_enchufable", label: "Híbrido enchufable (PHEV)", icon: "🔌", desc: "Etiqueta CERO/ECO según autonomía — requiere hábito de carga" },
      { value: "microhibrido", label: "Microhíbrido (MHEV)", icon: "⚙️", desc: "Etiqueta ECO — apoyo eléctrico ligero al motor térmico" },
      { value: "gasolina", label: "Gasolina", icon: "⛽", desc: "Suele encajar en kilometrajes medios o bajos" },
      { value: "diesel", label: "Diésel", icon: "🛢️", desc: "Más interesante con kilometrajes altos y trayectos largos" },
      { value: "glp_gnc", label: "GLP / GNC", icon: "🟢", desc: "Alternativa de menor coste por km donde hay infraestructura" },
      { value: "indiferente_motor", label: "Sin preferencia", icon: "🤷", desc: "Priorizo que el análisis elija lo óptimo" },
    ],
  },
  {
    id: "horizonte",
    block: "Capacidad",
    blockIcon: "📅",
    question: "¿Cuánto tiempo piensas quedarte con el vehículo?",
    subtitle: "Condiciona qué riesgos son más relevantes para ti",
    type: "cards",
    options: [
      { value: "por_dias", label: "Por días", icon: "🗓️", desc: "Para momentos puntuales, normalmente encaja mejor alquiler por días" },
      { value: "menos_2_meses", label: "Menos de 2 meses", icon: "⏳", desc: "Suele tener más sentido carsharing o alquiler temporal que un renting clásico" },
      { value: "menos_1_ano", label: "Menos de 1 año", icon: "⚡", desc: "Encaja mejor con renting a corto plazo o suscripción flexible" },
      { value: "menos_2", label: "1 - 2 años", icon: "🚗", desc: "Horizonte breve con foco en depreciación y valor de salida" },
      { value: "2_3", label: "2 - 3 años", icon: "📊", desc: "Plazo corto con foco en valor de reventa" },
      { value: "3_5", label: "3 - 5 años", icon: "📈", desc: "Equilibrio entre cuota, uso y riesgo" },
      { value: "5_7", label: "5 - 7 años", icon: "🛠️", desc: "Empieza a pesar más el mantenimiento" },
      { value: "mas_7", label: "Mas de 7 años", icon: "🏠", desc: "Propiedad larga: fiabilidad y costes futuros clave" },
      { value: "no_claro", label: "Aun no lo tengo claro", icon: "🤔", desc: "Necesito una opcion flexible mientras decido" },
    ],
  },

  // BLOQUE 2 — USO Y NECESIDADES
  {
    id: "km_anuales",
    block: "Uso real",
    blockIcon: "🛣️",
    question: "¿Cuántos kilómetros haces al año aproximadamente?",
    subtitle: "Condiciona la amortización de cada tipo de motor",
    type: "cards",
    options: [
      { value: "menos_10k", label: "Menos de 10.000 km", icon: "🐢", desc: "Uso muy puntual" },
      { value: "10k_20k", label: "10.000 – 20.000 km", icon: "🚶", desc: "Uso moderado" },
      { value: "mas_20k", label: "Más de 20.000 km", icon: "🚀", desc: "Uso intensivo" },
    ],
  },
  {
    id: "entorno_uso",
    block: "Uso real",
    blockIcon: "🗺️",
    question: "¿Cuál es tu entorno de conducción dominante?",
    subtitle: "Incluye tu contexto de ciudad/zona (ZBE), consumo real y tipo de uso",
    type: "cards",
    options: [
      { value: "ciudad", label: "Ciudad principalmente", icon: "🏙️", desc: "Tráfico, atascos, aparcamiento" },
      { value: "interurbano", label: "Carretera interurbana", icon: "🛤️", desc: "Tramos mixtos, pueblos" },
      { value: "autopista", label: "Autopista / largo radio", icon: "🛣️", desc: "Viajes frecuentes >100 km" },
      { value: "mixto", label: "Todo por igual", icon: "🔄", desc: "Sin un entorno claro" },
    ],
  },
  {
    id: "uso_principal",
    block: "Uso real",
    blockIcon: "🎯",
    question: "¿Para qué lo usas principalmente?",
    subtitle: "Selecciona todas las que apliquen",
    type: "multi",
    options: [
      { value: "trabajo_diario", label: "Ir al trabajo cada día", icon: "🏃" },
      { value: "viajes_ocio", label: "Viajes de ocio o vacaciones", icon: "✈️" },
      { value: "visitas_clientes", label: "Visitar clientes / reuniones", icon: "🤝" },
      { value: "compras_recados", label: "Compras y recados puntuales", icon: "🛒" },
      { value: "familia", label: "Llevar familia / niños", icon: "👨‍👩‍👧" },
      { value: "remolque", label: "Remolcar (caravana, tráiler)", icon: "🚚" },
    ],
  },

  // BLOQUE 3 — CAPACIDAD REQUERIDA
  {
    id: "ocupantes",
    block: "Capacidad",
    blockIcon: "💺",
    question: "¿Qué combinación de plazas y maletero necesitas habitualmente?",
    subtitle: "Así recogemos en una sola respuesta el espacio para personas y carga diaria",
    type: "cards",
    options: [
      { value: "2_plazas_maletero_pequeno", label: "1-2 plazas + maletero pequeño", icon: "👤", desc: "Uso individual o pareja" },
      { value: "5_plazas_maletero_medio", label: "3-5 plazas + maletero medio", icon: "👨‍👩‍👧", desc: "Uso familiar equilibrado" },
      { value: "7_plazas_maletero_grande", label: "6-7 plazas + maletero grande", icon: "🚐", desc: "Familia numerosa o mucho equipaje" },
    ],
  },
  // BLOQUE 4 — PREFERENCIAS DE PRODUCTO
  {
    id: "marca_preferencia",
    block: "Preferencias",
    blockIcon: "🏷️",
    question: "¿Tienes preferencia de marca?",
    subtitle: "Las gamas de entrada premium suelen ofrecer peor relación valor/precio",
    type: "cards",
    options: [
      {
        value: "generalista_europea",
        label: "Generalista europea",
        icon: "🔧",
        desc: "Precio equilibrado y red de talleres amplia",
        brandChips: [
          { short: "VW", tone: "#1d4ed8", label: "Volkswagen" },
          { short: "SE", tone: "#0f172a", label: "Seat" },
          { short: "RE", tone: "#f59e0b", label: "Renault" },
          { short: "SK", tone: "#16a34a", label: "Skoda" },
        ],
      },
      {
        value: "asiatica_fiable",
        label: "Asiática enfocada en fiabilidad",
        icon: "🛡️",
        desc: "Muy buena reputación en consumo y durabilidad",
        brandChips: [
          { short: "TY", tone: "#ef4444", label: "Toyota" },
          { short: "HY", tone: "#0ea5e9", label: "Hyundai" },
          { short: "KI", tone: "#dc2626", label: "Kia" },
          { short: "NS", tone: "#64748b", label: "Nissan" },
        ],
      },
      {
        value: "premium_alemana",
        label: "Premium alemana",
        icon: "⭐",
        desc: "Imagen, tecnología y coste superior de mantenimiento",
        brandChips: [
          { short: "BM", tone: "#2563eb", label: "BMW" },
          { short: "MB", tone: "#111827", label: "Mercedes" },
          { short: "AU", tone: "#6b7280", label: "Audi" },
        ],
      },
      {
        value: "premium_escandinava",
        label: "Premium escandinava",
        icon: "❄️",
        desc: "Seguridad y confort como prioridad",
        brandChips: [{ short: "VO", tone: "#0284c7", label: "Volvo" }],
      },
      {
        value: "nueva_china",
        label: "Marca emergente (china)",
        icon: "🆕",
        desc: "Equipamiento alto por precio y fuerte enfoque electrificado",
        brandChips: [
          { short: "BY", tone: "#dc2626", label: "BYD" },
          { short: "MG", tone: "#ef4444", label: "MG" },
          { short: "XP", tone: "#111827", label: "XPeng" },
        ],
      },
      {
        value: "sin_preferencia",
        label: "Sin preferencia de marca",
        icon: "🤷",
        desc: "Priorizo coste total, fiabilidad y uso real",
      },
    ],
  },
  {
    id: "vehiculo_actual",
    block: "Restricciones",
    blockIcon: "🔁",
    question: "¿Tienes vehículo actual para entregar o vender?",
    subtitle: "La tasación real puede ser muy distinta al precio emocional",
    type: "cards",
    options: [
      { value: "si_entrego", label: "Sí, lo entrego al comprar", icon: "🔄", desc: "Reduce el diferencial a financiar" },
      { value: "si_vendo", label: "Sí, lo vendo aparte", icon: "💶", desc: "Más control sobre el precio" },
      { value: "no", label: "No tengo vehículo actual", icon: "0️⃣", desc: "Primera compra o ya vendido" },
    ],
  },
];

const ADVANCED_STEPS = [
  {
    id: "provincia_zona",
    block: "Avanzado",
    blockIcon: "📍",
    question: "¿En qué tipo de zona te mueves normalmente?",
    subtitle: "La cobertura real y el peso de la movilidad cambian mucho según ciudad, ZBE o zona rural",
    type: "cards",
    options: [
      { value: "madrid_barcelona", label: "Madrid / Barcelona", icon: "🌆", desc: "Máxima oferta de carsharing, transporte y stock" },
      { value: "capital_zbe", label: "Capital con ZBE", icon: "🚦", desc: "La etiqueta y el acceso pesan bastante" },
      { value: "ciudad_media", label: "Ciudad media / área metropolitana", icon: "🧭", desc: "Uso mixto con oferta intermedia" },
      { value: "zona_rural", label: "Pueblo / zona dispersa", icon: "🌄", desc: "Importa más la autonomía y disponibilidad total" },
      { value: "islas", label: "Islas", icon: "🏝️", desc: "Mercado algo más limitado y más dependiente de stock local" },
    ],
  },
  {
    id: "garaje",
    block: "Avanzado",
    blockIcon: "🔌",
    question: "¿Qué situación real tienes para aparcar y cargar?",
    subtitle: "Clave para saber si un eléctrico o PHEV encaja de verdad en tu vida",
    type: "cards",
    options: [
      { value: "garaje_cargador", label: "Tengo plaza y puedo cargar", icon: "⚡", desc: "La electrificación gana muchos puntos" },
      { value: "garaje_sin_cargador", label: "Tengo plaza pero sin cargador", icon: "🅿️", desc: "Podría instalarlo o depender parcialmente de carga externa" },
      { value: "sin_garaje", label: "No tengo plaza fija / aparco en calle", icon: "🚧", desc: "Mucho más difícil amortizar un eléctrico puro" },
    ],
  },
  {
    id: "zbe_impacto",
    block: "Avanzado",
    blockIcon: "🏙️",
    question: "¿Cuánto te afectan las ZBE y restricciones urbanas?",
    subtitle: "Esto puede cambiar totalmente qué motor y qué solución son más inteligentes",
    type: "cards",
    options: [
      { value: "alta", label: "Mucho", icon: "🚫", desc: "Entro con frecuencia a zonas restringidas" },
      { value: "media", label: "Algo", icon: "⚠️", desc: "Me afecta en momentos concretos" },
      { value: "baja", label: "Poco o nada", icon: "✅", desc: "Mi uso diario no depende apenas de ZBE" },
    ],
  },
  {
    id: "cuota_mensual",
    block: "Avanzado",
    blockIcon: "💳",
    question: "¿Qué cuota mensual te parece cómoda de verdad?",
    subtitle: "No la máxima teórica, sino la que no te aprieta mes a mes",
    type: "cards",
    options: [
      { value: "menos_200", label: "Menos de 200 €/mes", icon: "🌱", desc: "Busco máxima eficiencia de coste" },
      { value: "200_350", label: "200 - 350 €/mes", icon: "⚖️", desc: "Zona equilibrada para uso racional" },
      { value: "350_500", label: "350 - 500 €/mes", icon: "🚗", desc: "Puedo asumir algo más a cambio de comodidad o formato" },
      { value: "mas_500", label: "Más de 500 €/mes", icon: "⭐", desc: "Tengo más margen para priorizar producto o flexibilidad" },
    ],
  },
  {
    id: "capital_propio",
    block: "Avanzado",
    blockIcon: "🏦",
    question: "Si compraras, ¿qué capital inicial podrías poner sin tensionarte?",
    subtitle: "Esto ayuda a separar lo que parece atractivo de lo que realmente es sano financieramente",
    type: "cards",
    options: [
      { value: "menos_5k", label: "Menos de 5.000 €", icon: "💸", desc: "Muy poca entrada disponible" },
      { value: "5k_10k", label: "5.000 - 10.000 €", icon: "💶", desc: "Entrada ajustada pero útil" },
      { value: "10k_20k", label: "10.000 - 20.000 €", icon: "🏁", desc: "Ya da bastante margen de negociación" },
      { value: "mas_20k", label: "Más de 20.000 €", icon: "💼", desc: "Mucha capacidad para reducir financiación" },
      { value: "no_aplica", label: "No quiero comprar / no aplica", icon: "🚫", desc: "Prefiero cuota, renting o pago por uso" },
    ],
  },
  {
    id: "gestion_riesgo",
    block: "Avanzado",
    blockIcon: "🛡️",
    question: "¿Cuánto control quieres sobre sorpresas de coste y riesgo?",
    subtitle: "Define si priorizamos previsibilidad absoluta o más margen para ahorrar asumiendo algo de riesgo",
    type: "cards",
    options: [
      { value: "alto", label: "Quiero máximo control", icon: "🔒", desc: "Prefiero evitar sustos aunque pague algo más" },
      { value: "medio", label: "Equilibrio razonable", icon: "⚖️", desc: "Quiero buena relación entre coste y tranquilidad" },
      { value: "bajo", label: "Puedo asumir algo de riesgo", icon: "🎯", desc: "Priorizo ahorro aunque haya más variables" },
    ],
  },
];

const getQuestionnaireSteps = (advancedMode = false) =>
  advancedMode ? [...STEPS, ...ADVANCED_STEPS] : STEPS;

// ─────────────────────────────────────────
// MOBILITY TYPES
// ─────────────────────────────────────────
const MOBILITY_TYPES = {
  compra_contado: { label: "Compra al Contado", icon: "🔑", color: "#2563EB" },
  compra_financiada: { label: "Compra Financiada", icon: "📝", color: "#7C3AED" },
  renting_largo: { label: "Renting a Largo Plazo", icon: "📅", color: "#059669" },
  renting_corto: { label: "Renting a Corto Plazo", icon: "🗓️", color: "#D97706" },
  rent_a_car: { label: "Rent a Car", icon: "🏢", color: "#DC2626" },
  carsharing: { label: "Carsharing", icon: "🔄", color: "#0891B2" },
  carpooling: { label: "Carpooling", icon: "🤝", color: "#65A30D" },
  transporte_publico: { label: "Transporte Público", icon: "🚇", color: "#9333EA" },
  micromovilidad: { label: "Micromovilidad", icon: "🛴", color: "#E11D48" },
};

// ─────────────────────────────────────────
// BLOCK COLORS
// ─────────────────────────────────────────
const BLOCK_COLORS = {
  "Perfil": "#2563EB",
  "Uso real": "#059669",
  "Capacidad": "#D97706",
  "Preferencias": "#7C3AED",
  "Energía": "#0891B2",
  "Financiero": "#DC2626",
  "Restricciones": "#9333EA",
  "Vinculación": "#E11D48",
  "Riesgo": "#65A30D",
  "Avanzado": "#14B8A6",
};

const BRAND_LOGOS = {
  Volkswagen: { icon: SiVolkswagen, color: "#0a58ca" },
  Seat: { icon: SiSeat, color: "#6b7280" },
  Renault: { icon: SiRenault, color: "#f59e0b" },
  Skoda: { icon: SiSkoda, color: "#16a34a" },
  Toyota: { icon: SiToyota, color: "#ef4444" },
  Hyundai: { icon: SiHyundai, color: "#0ea5e9" },
  Kia: { icon: SiKia, color: "#dc2626" },
  Nissan: { icon: SiNissan, color: "#64748b" },
  BMW: { icon: SiBmw, color: "#2563eb" },
  Mercedes: { icon: MercedesLogo, color: "#111827" },
  Audi: { icon: SiAudi, color: "#6b7280" },
  Volvo: { icon: SiVolvo, color: "#0284c7" },
  BYD: { icon: BydLogo, color: "#dc2626" },
  MG: { icon: SiMg, color: "#ef4444" },
  XPeng: { icon: XPengLogo, color: "#111827" },
};

const MARKET_BRANDS = {
  Toyota: ["Corolla", "C-HR", "Yaris", "RAV4"],
  Renault: ["Clio", "Captur", "Megane", "Austral"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca"],
  Volkswagen: ["Polo", "Golf", "T-Roc", "Tiguan"],
  Peugeot: ["208", "2008", "308", "3008"],
  BMW: ["Serie 1", "Serie 3", "X1", "X3"],
  Audi: ["A1", "A3", "Q2", "Q3"],
  Mercedes: ["Clase A", "Clase C", "GLA", "GLC"],
  Volvo: ["XC40", "XC60", "S60", "V60"],
  Kia: ["Ceed", "Niro", "Sportage", "EV6"],
  Hyundai: ["i20", "i30", "Tucson", "Kona"],
  Nissan: ["Micra", "Qashqai", "X-Trail", "Juke"],
  Skoda: ["Fabia", "Octavia", "Kamiq", "Kodiaq"],
  Citroen: ["C3", "C4", "C5 Aircross", "Berlingo"],
  Dacia: ["Sandero", "Duster", "Jogger", "Spring"],
  MG: ["ZS", "HS", "MG4", "Marvel R"],
};

const TOTAL_PURCHASE_OPTIONS = [
  { value: "hasta_10000", label: "Hasta 10.000 €", amount: 10000 },
  { value: "10000_20000", label: "10.000 - 20.000 €", amount: 20000 },
  { value: "20000_30000", label: "20.000 - 30.000 €", amount: 30000 },
  { value: "30000_45000", label: "30.000 - 45.000 €", amount: 45000 },
  { value: "mas_45000", label: "Más de 45.000 €", amount: 55000 },
];

const MONTHLY_BUDGET_OPTIONS = [
  { value: "hasta_200", label: "Hasta 200 €/mes" },
  { value: "200_400", label: "200 - 400 €/mes" },
  { value: "400_700", label: "400 - 700 €/mes" },
  { value: "mas_700", label: "Más de 700 €/mes" },
];

const ANSWER_BUDGET_TO_FILTER = {
  menos_200: "hasta_200",
  hasta_200: "hasta_200",
  "200_350": "200_400",
  "200_400": "200_400",
  "350_500": "400_700",
  "400_700": "400_700",
  mas_500: "400_700",
  mas_700: "mas_700",
};

const INCOME_STABILITY_OPTIONS = [
  { value: "fijos_estables", label: "Fijos y estables" },
  { value: "fijos_variable", label: "Fijos + variable" },
  { value: "variables_autonomo", label: "Variables / autónomo" },
];

const FINANCE_AMOUNT_OPTIONS = [
  { value: "hasta_10000", label: "Hasta 10.000 €", amount: 10000 },
  { value: "10000_15000", label: "10.000 - 15.000 €", amount: 15000 },
  { value: "15000_25000", label: "15.000 - 25.000 €", amount: 25000 },
  { value: "25000_40000", label: "25.000 - 40.000 €", amount: 40000 },
  { value: "mas_40000", label: "Más de 40.000 €", amount: 50000 },
];

const ENTRY_AMOUNT_OPTIONS = [
  { value: "sin_entrada", label: "Sin entrada", amount: 0 },
  { value: "hasta_5000", label: "Hasta 5.000 €", amount: 5000 },
  { value: "5000_10000", label: "5.000 - 10.000 €", amount: 10000 },
  { value: "10000_15000", label: "10.000 - 15.000 €", amount: 15000 },
  { value: "mas_15000", label: "Más de 15.000 €", amount: 20000 },
];

const AGE_FILTER_OPTIONS = [
  { value: "all", label: "Sin límite de antigüedad" },
  { value: "2", label: "Hasta 2 años" },
  { value: "4", label: "Hasta 4 años" },
  { value: "6", label: "Hasta 6 años" },
  { value: "8", label: "Hasta 8 años" },
];

const MILEAGE_FILTER_OPTIONS = [
  { value: "all", label: "Sin límite de kilometraje" },
  { value: "20000", label: "Hasta 20.000 km" },
  { value: "50000", label: "Hasta 50.000 km" },
  { value: "80000", label: "Hasta 80.000 km" },
  { value: "120000", label: "Hasta 120.000 km" },
];

const SELL_FUEL_OPTIONS = ["Gasolina", "Diésel", "Híbrido", "PHEV", "Eléctrico"];

const INITIAL_PORTAL_VO_FILTERS = {
  query: "",
  maxPrice: "",
  minYear: "",
  maxMileage: "",
  location: "",
  color: "",
  displacement: "",
  onlyGuaranteed: false,
};

const PORTAL_VO_OFFERS = [
  {
    id: "vo-001",
    title: "Toyota Corolla 120H Active Tech",
    brand: "Toyota",
    model: "Corolla",
    price: 21990,
    year: 2022,
    mileage: 34800,
    location: "Madrid",
    color: "Blanco perlado",
    displacement: 1798,
    fuel: "Híbrido",
    power: "122 CV",
    seller: "Laura M.",
    hasGuaranteeSeal: true,
    portalScore: 97,
    warrantyMonths: 24,
    description: "Un solo dueño, historial completo y consumo muy contenido para uso diario.",
    image: OFFER_MODEL_FALLBACK_IMAGES["toyota corolla"],
  },
  {
    id: "vo-002",
    title: "Kia Niro HEV Drive",
    brand: "Kia",
    model: "Niro",
    price: 24950,
    year: 2023,
    mileage: 28900,
    location: "Valencia",
    color: "Gris lunar",
    displacement: 1580,
    fuel: "Híbrido",
    power: "141 CV",
    seller: "Carlos V.",
    hasGuaranteeSeal: false,
    portalScore: 95,
    warrantyMonths: 18,
    description: "Muy buen equilibrio entre espacio, eficiencia y etiqueta ECO para ciudad y viajes.",
    image: OFFER_MODEL_FALLBACK_IMAGES["kia niro"],
  },
  {
    id: "vo-003",
    title: "Volkswagen Golf Life 1.5 eTSI",
    brand: "Volkswagen",
    model: "Golf",
    price: 23450,
    year: 2023,
    mileage: 22100,
    location: "Barcelona",
    color: "Negro",
    displacement: 1498,
    fuel: "Gasolina MHEV",
    power: "130 CV",
    seller: "Sergio A.",
    hasGuaranteeSeal: false,
    portalScore: 94,
    warrantyMonths: 12,
    description: "Compacto premium-generalista con buen equipamiento y mantenimiento sellado.",
    image: OFFER_MODEL_FALLBACK_IMAGES["volkswagen golf"],
  },
  {
    id: "vo-004",
    title: "BYD Dolphin Comfort",
    brand: "BYD",
    model: "Dolphin",
    price: 26400,
    year: 2024,
    mileage: 11200,
    location: "Málaga",
    color: "Blanco",
    displacement: 0,
    fuel: "Eléctrico",
    power: "204 CV",
    seller: "Nuria P.",
    hasGuaranteeSeal: true,
    portalScore: 93,
    warrantyMonths: 24,
    description: "Eléctrico reciente, muy equipado y con batería en excelente estado certificado.",
    image: OFFER_MODEL_FALLBACK_IMAGES["byd dolphin"],
  },
  {
    id: "vo-005",
    title: "Seat León 1.5 eTSI FR",
    brand: "Seat",
    model: "León",
    price: 20100,
    year: 2022,
    mileage: 39800,
    location: "Sevilla",
    color: "Rojo deseo",
    displacement: 1498,
    fuel: "Gasolina MHEV",
    power: "150 CV",
    seller: "Miguel T.",
    hasGuaranteeSeal: false,
    portalScore: 89,
    warrantyMonths: 0,
    description: "Unidad muy cuidada con buen punto deportivo y coste razonable de uso.",
    image: OFFER_MODEL_FALLBACK_IMAGES["seat leon"],
  },
  {
    id: "vo-006",
    title: "BMW X1 sDrive18d",
    brand: "BMW",
    model: "X1",
    price: 29500,
    year: 2021,
    mileage: 58300,
    location: "Bilbao",
    color: "Blanco",
    displacement: 1995,
    fuel: "Diésel",
    power: "150 CV",
    seller: "Autoselect Norte",
    hasGuaranteeSeal: false,
    portalScore: 91,
    warrantyMonths: 12,
    description: "SUV premium con historial revisado y buena presentación para uso familiar o mixto.",
    image: OFFER_MODEL_FALLBACK_IMAGES["bmw x1"],
  },
  {
    id: "vo-007",
    title: "Renault Captur TCe Intens",
    brand: "Renault",
    model: "Captur",
    price: 17850,
    year: 2021,
    mileage: 41500,
    location: "Zaragoza",
    color: "Naranja atakama",
    displacement: 1333,
    fuel: "Gasolina",
    power: "130 CV",
    seller: "Paula G.",
    hasGuaranteeSeal: false,
    portalScore: 86,
    warrantyMonths: 0,
    description: "Crossover urbano bien mantenido, ideal para ciudad y uso versátil.",
    image: OFFER_MODEL_FALLBACK_IMAGES["renault captur"],
  },
  {
    id: "vo-008",
    title: "Skoda Octavia 2.0 TDI DSG",
    brand: "Skoda",
    model: "Octavia",
    price: 21900,
    year: 2020,
    mileage: 67200,
    location: "Valladolid",
    color: "Plata metalizada",
    displacement: 1968,
    fuel: "Diésel",
    power: "150 CV",
    seller: "Daniel R.",
    hasGuaranteeSeal: false,
    portalScore: 90,
    warrantyMonths: 12,
    description: "Muy buen maletero, consumo bajo y enfoque racional para carretera y familia.",
    image: OFFER_MODEL_FALLBACK_IMAGES["skoda octavia"],
  },
  {
    id: "vo-009",
    title: "Hyundai Kona Electric Maxx",
    brand: "Hyundai",
    model: "Kona",
    price: 25500,
    year: 2023,
    mileage: 18700,
    location: "Alicante",
    color: "Gris cyber",
    displacement: 0,
    fuel: "Eléctrico",
    power: "204 CV",
    seller: "Marina S.",
    hasGuaranteeSeal: false,
    portalScore: 92,
    warrantyMonths: 24,
    description: "Muy equilibrado para ciudad y periferia, con batería revisada y carga rápida.",
    image: OFFER_MODEL_FALLBACK_IMAGES["hyundai kona"],
  },
  {
    id: "vo-010",
    title: "Audi A3 Sportback S line",
    brand: "Audi",
    model: "A3",
    price: 28900,
    year: 2022,
    mileage: 26500,
    location: "Pamplona",
    color: "Negro brillante",
    displacement: 1498,
    fuel: "Gasolina",
    power: "150 CV",
    seller: "Premium Selection",
    hasGuaranteeSeal: true,
    portalScore: 92,
    warrantyMonths: 12,
    description: "Compacto premium muy bien presentado, ideal si buscas imagen y uso diario fino.",
    image: OFFER_MODEL_FALLBACK_IMAGES["audi a3"],
  },
  {
    id: "vo-011",
    title: "MG4 Luxury Extended Range",
    brand: "MG",
    model: "MG4",
    price: 23900,
    year: 2024,
    mileage: 9800,
    location: "Murcia",
    color: "Naranja",
    displacement: 0,
    fuel: "Eléctrico",
    power: "204 CV",
    seller: "Álvaro C.",
    hasGuaranteeSeal: true,
    portalScore: 94,
    warrantyMonths: 24,
    description: "Muy buen precio para el equipamiento que ofrece y con etiqueta CERO para ZBE.",
    image: OFFER_MODEL_FALLBACK_IMAGES["mg4"],
  },
  {
    id: "vo-012",
    title: "Peugeot 3008 BlueHDi Allure",
    brand: "Peugeot",
    model: "3008",
    price: 22800,
    year: 2021,
    mileage: 54400,
    location: "Granada",
    color: "Blanco nacarado",
    displacement: 1499,
    fuel: "Diésel",
    power: "130 CV",
    seller: "Irene F.",
    hasGuaranteeSeal: false,
    portalScore: 88,
    warrantyMonths: 0,
    description: "SUV cómodo y amplio para familia, con consumo contenido y buen maletero.",
    image: OFFER_MODEL_FALLBACK_IMAGES["peugeot 3008"],
  },
  {
    id: "vo-013",
    title: "Volvo XC40 B3 Core",
    brand: "Volvo",
    model: "XC40",
    price: 31200,
    year: 2023,
    mileage: 20800,
    location: "A Coruña",
    color: "Azul fjord",
    displacement: 1969,
    fuel: "Gasolina MHEV",
    power: "163 CV",
    seller: "Nordic Cars",
    hasGuaranteeSeal: false,
    portalScore: 93,
    warrantyMonths: 18,
    description: "SUV premium centrado en seguridad y confort, con muy buen estado interior.",
    image: OFFER_MODEL_FALLBACK_IMAGES["volvo xc40"],
  },
  {
    id: "vo-014",
    title: "Nissan Qashqai DIG-T N-Connecta",
    brand: "Nissan",
    model: "Qashqai",
    price: 21450,
    year: 2022,
    mileage: 37100,
    location: "Santander",
    color: "Gris grafito",
    displacement: 1332,
    fuel: "Gasolina MHEV",
    power: "140 CV",
    seller: "Rubén H.",
    hasGuaranteeSeal: false,
    portalScore: 87,
    warrantyMonths: 0,
    description: "Muy equilibrado para familia y carretera, con buena altura y confort de marcha.",
    image: OFFER_MODEL_FALLBACK_IMAGES["nissan qashqai"],
  },
  {
    id: "vo-015",
    title: "Mercedes Clase A 200 Progressive",
    brand: "Mercedes",
    model: "Clase A",
    price: 29990,
    year: 2022,
    mileage: 24900,
    location: "Palma",
    color: "Plata iridio",
    displacement: 1332,
    fuel: "Gasolina",
    power: "163 CV",
    seller: "Isabel R.",
    hasGuaranteeSeal: false,
    portalScore: 91,
    warrantyMonths: 12,
    description: "Premium compacto muy bien equipado, con presentación cuidada y mantenimiento reciente.",
    image: OFFER_MODEL_FALLBACK_IMAGES["mercedes clase a"],
  },
  {
    id: "vo-016",
    title: "Dacia Duster ECO-G Journey",
    brand: "Dacia",
    model: "Duster",
    price: 18950,
    year: 2023,
    mileage: 19400,
    location: "Toledo",
    color: "Verde cedro",
    displacement: 999,
    fuel: "GLP",
    power: "100 CV",
    seller: "Javier L.",
    hasGuaranteeSeal: false,
    portalScore: 88,
    warrantyMonths: 12,
    description: "Opción muy racional en coste de uso, altura libre y mantenimiento sencillo.",
    image: OFFER_MODEL_FALLBACK_IMAGES["dacia duster"],
  },
];

const ADVISOR_PILLARS = [
  {
    title: "Financiación",
    text: "Analizamos ahorro disponible, cuota razonable, scoring previo y si tiene más sentido préstamo al consumo, financiera de punto de venta o renting.",
  },
  {
    title: "TCO real",
    text: "Proyectamos mantenimiento preventivo, averías probables, seguros, IVTM, combustible, parking y otros costes mensuales más allá del precio de compra.",
  },
  {
    title: "Garantías",
    text: "Valoramos la cobertura de marca y vendedor, el riesgo jurídico y la opción de defensa o extensión de garantía para proteger la operación.",
  },
  {
    title: "Pricing",
    text: "Usamos inteligencia de mercado para leer rango de precios, rotación, días anunciados y calidad de oferta en compra y renting.",
  },
  {
    title: "Mercado y sesgos",
    text: "Aplicamos señales de mercado y fiabilidad para penalizar motorizaciones o versiones con incidencias recurrentes y premiar las más sólidas.",
  },
  {
    title: "Valor futuro",
    text: "Estimamos depreciación y valor de salida probable según canal, demanda, volumen en renting y comportamiento del VO.",
  },
];

function getOptionAmount(options, value) {
  return options.find((option) => option.value === value)?.amount || 0;
}

function getOptionLabel(options, value, fallback = "No indicado") {
  return options.find((option) => option.value === value)?.label || normalizeText(value) || fallback;
}

function estimateMonthlyPayment(amount, months = 72, annualRate = 0.0899) {
  if (!amount) {
    return 0;
  }

  const monthlyRate = annualRate / 12;
  const factor = Math.pow(1 + monthlyRate, months);
  return Math.round((amount * monthlyRate * factor) / (factor - 1));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getPortalVoEcoLabel(offer = {}) {
  const fuel = normalizeText(offer?.fuel).toLowerCase();

  if (fuel.includes("elé") || fuel.includes("electric")) {
    return "Etiqueta CERO";
  }
  if (fuel.includes("híbr") || fuel.includes("hibri") || fuel.includes("glp") || fuel.includes("phev")) {
    return "Etiqueta ECO";
  }

  return "Etiqueta C";
}

function getPortalVoTransmission(offer = {}) {
  const fuel = normalizeText(offer?.fuel).toLowerCase();

  if (fuel.includes("elé") || fuel.includes("hibri") || fuel.includes("mhev") || fuel.includes("phev")) {
    return "Automático";
  }

  return Number(offer?.displacement || 0) >= 1800 ? "Automático" : "Manual / automático";
}

function buildPortalVoHighlights(offer = {}) {
  const items = [];

  if (offer?.hasGuaranteeSeal) {
    items.push(`Sello MoveAdvisor con ${offer.warrantyMonths || 12} meses de garantía.`);
  }

  if (Number(offer?.mileage || 0) <= 20000) {
    items.push("Kilometraje muy contenido para su antigüedad.");
  } else if (Number(offer?.mileage || 0) <= 45000) {
    items.push("Uso moderado y equilibrado para una compra con buen encaje diario.");
  }

  items.push(`${getPortalVoEcoLabel(offer)} para un uso más cómodo en ciudad y ZBE.`);

  if (offer?.power) {
    items.push(`Motorización de ${offer.power} pensada para combinar solvencia y coste razonable.`);
  }

  if (offer?.description) {
    items.push(offer.description);
  }

  return items.filter(Boolean).slice(0, 4);
}

function buildPortalVoEquipment(offer = {}) {
  const items = ["Pantalla multimedia", "Conectividad móvil", "Sensores de aparcamiento"];
  const fuel = normalizeText(offer?.fuel).toLowerCase();
  const brand = normalizeText(offer?.brand).toLowerCase();

  if (offer?.hasGuaranteeSeal) items.push("Garantía certificada");
  if (fuel.includes("elé")) items.push("Carga rápida");
  if (fuel.includes("híbr") || fuel.includes("glp") || fuel.includes("mhev")) items.push("Etiqueta ECO");
  if (["audi", "bmw", "mercedes", "volvo"].includes(brand)) items.push("Acabado premium");
  if (Number(offer?.displacement || 0) >= 1600) items.push("Buen aplomo en carretera");

  return [...new Set(items)].slice(0, 6);
}

function inferListingBudgetFromAnswers(answers = {}) {
  return ANSWER_BUDGET_TO_FILTER[answers?.cuota_mensual] || "";
}

function getQuickValidationQuestions({ shouldShowChargingChecklist, isBuyOrFinanceOutcome, isRentingOutcome }) {
  if (shouldShowChargingChecklist) {
    return [
      { id: "carga_casa", label: "¿Puedes cargar en casa o en tu plaza al menos 2-3 veces por semana?" },
      { id: "carga_publica", label: "¿Tienes un punto público fiable cerca de casa o trabajo?" },
      { id: "viajes_largos", label: "¿Tus viajes largos encajan con paradas de recarga cada 2-3 horas?" },
    ];
  }

  if (isBuyOrFinanceOutcome) {
    return [
      { id: "cuota_comoda", label: "¿La cuota o el desembolso final te queda realmente cómodo cada mes?" },
      { id: "entrada_lista", label: "¿Tienes clara la entrada / capital inicial que quieres usar?" },
      { id: "riesgo_controlado", label: "¿Te sientes cómodo asumiendo propiedad, seguro y mantenimiento?" },
    ];
  }

  if (isRentingOutcome) {
    return [
      { id: "km_estables", label: "¿Tu kilometraje anual es bastante estable y previsible?" },
      { id: "permanencia_ok", label: "¿Aceptarías una permanencia de 24-48 meses si la cuota compensa?" },
      { id: "servicios_ok", label: "¿Prefieres cuota cerrada aunque no te quedes el coche en propiedad?" },
    ];
  }

  return [
    { id: "uso_puntual", label: "¿El coche lo necesitas solo en momentos concretos y no todos los días?" },
    { id: "cobertura_zona", label: "¿Tienes cobertura real de movilidad flexible cerca de casa o trabajo?" },
    { id: "sin_permanencia", label: "¿Prefieres evitar permanencias o costes fijos altos ahora mismo?" },
  ];
}

function buildOfferRanking({ brand, model, acquisition, condition, ageFilter, mileageFilter }) {
  const basePriceByBrand = {
    Toyota: 23900,
    Renault: 21400,
    Seat: 20600,
    Volkswagen: 25400,
    Peugeot: 22600,
    BMW: 36800,
    Audi: 38200,
    Mercedes: 39900,
    Volvo: 36400,
    Kia: 24800,
    Hyundai: 24100,
    Nissan: 23200,
    Skoda: 22900,
    Citroen: 21500,
    Dacia: 18900,
    MG: 22100,
  };

  const basePrice = basePriceByBrand[brand] || 24500;
  const ageLimit = ageFilter === "all" ? 6 : Number(ageFilter);
  const mileageLimit = mileageFilter === "all" ? 90000 : Number(mileageFilter);
  const acquisitionDelta = acquisition === "contado" ? -600 : acquisition === "financiado" ? 400 : acquisition === "mixto" ? 150 : 0;
  const conditionDelta = condition === "nuevo" ? 0 : condition === "seminuevo" ? -3200 : -6200;

  return [0, 1, 2].map((index) => {
    const age = Math.max(0, ageLimit - index);
    const mileage = Math.max(10000, mileageLimit - index * 14000);
    const price = Math.max(8900, basePrice + acquisitionDelta + conditionDelta - index * 1800);
    const score = Math.max(74, 93 - index * 6);

    return {
      id: `${brand}-${model}-${index}`,
      title: `${brand} ${model} ${condition === "nuevo" ? "nuevo" : condition === "seminuevo" ? "seminuevo" : "VO certificado"}`,
      price,
      monthly: acquisition === "contado" ? null : estimateMonthlyPayment(Math.max(4000, price * 0.75 - index * 600)),
      age,
      mileage,
      score,
      seller: index === 0 ? "Concesionario oficial" : index === 1 ? "Broker especializado" : "Multimarca certificado",
      insight:
        index === 0
          ? "Mejor equilibrio entre precio, equipamiento y rotación de mercado."
          : index === 1
          ? "Oferta competitiva, pero conviene revisar comisiones y coste financiero asociado."
          : "Alternativa de ahorro con más kilometraje, útil si prima presupuesto sobre valor futuro.",
    };
  });
}

function buildSellEstimate({ brand, model, year, mileage, fuel, sellerType }) {
  const currentYear = 2026;
  const age = Math.max(0, currentYear - Number(year || currentYear));
  const km = Number(mileage || 0);
  const base = 28000 - age * 1700 - km * 0.045;
  const fuelAdjust = fuel === "Híbrido" || fuel === "PHEV" ? 1200 : fuel === "Eléctrico" ? 1800 : fuel === "Diésel" ? -900 : 0;
  const channelAdjust = sellerType === "particular" ? 900 : sellerType === "profesional" ? 0 : -600;
  const center = Math.max(3500, Math.round(base + fuelAdjust + channelAdjust));

  return {
    targetPrice: center,
    lowPrice: Math.max(2900, center - 1200),
    highPrice: center + 1300,
    similarUnits: Math.max(14, 86 - age * 7),
    trend: age <= 3 ? "Mercado estable con demanda activa" : "Mayor sensibilidad a kilometraje y mantenimiento",
    report:
      `${brand} ${model}: recomendamos salir a mercado cerca de ${formatCurrency(center)} y argumentar mantenimiento, equipamiento y trazabilidad para sostener precio.`,
  };
}

function readSavedComparisons() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_COMPARISONS_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id) : [];
  } catch {
    return [];
  }
}

function writeSavedComparisons(items = []) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeItems = Array.isArray(items) ? items.slice(0, 6) : [];
    window.localStorage.setItem(SAVED_COMPARISONS_KEY, JSON.stringify(safeItems));
  } catch {}
}

function readUserAppointments() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(USER_APPOINTMENTS_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id) : [];
  } catch {
    return [];
  }
}

function writeUserAppointments(items = []) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeItems = Array.isArray(items) ? items.slice(0, 8) : [];
    window.localStorage.setItem(USER_APPOINTMENTS_KEY, JSON.stringify(safeItems));
  } catch {}
}

function buildMarketRadarSnapshot(result, listingResult, listingFilters = {}) {
  const solutionType = normalizeText(result?.solucion_principal?.tipo);
  const confidence = normalizeText(result?.transparencia?.confianza_nivel || "").toLowerCase();
  const tcoTotal = Number(result?.tco_detalle?.total_mensual || 0);
  const ranking = Number(listingResult?.rankingScore ?? listingResult?.profileScore ?? 0);
  const budgetLabel = getOptionLabel(MONTHLY_BUDGET_OPTIONS, listingFilters?.budget, "tu rango de cuota");
  const targetText = tcoTotal > 0 ? formatCurrency(tcoTotal) : budgetLabel;
  const rankingTarget = ranking > 0 ? Math.max(70, Math.min(85, ranking - 2)) : 75;

  const signals = [
    `Prioriza ofertas que se muevan en torno a ${targetText}${ranking > 0 ? ` y mantengan un encaje de al menos ${rankingTarget}/100.` : "."}`,
    listingResult?.source
      ? `Si reaparece una oferta parecida en ${listingResult.source}, compárala contra tu shortlist guardado.`
      : "Repite la búsqueda cuando cambies cuota, entrada o estabilidad de ingresos para ver si mejora el mercado.",
    ["renting_largo", "renting_corto"].includes(solutionType)
      ? "En renting, vigila kilómetros incluidos, permanencia y penalizaciones antes de dar una cuota por buena."
      : "En compra o financiación, manda el coste total final; no te quedes solo con la cuota o el precio gancho.",
  ];

  const alerts = [
    confidence === "ajustada"
      ? "Si cambian uso, kilometraje o garaje, repite el test antes de comprometerte."
      : "Descarta cualquier oferta con letra pequeña o condiciones que no vengan cerradas por escrito.",
    result?.solucion_principal?.etiqueta_dgt === "CERO" || result?.solucion_principal?.etiqueta_dgt === "ECO"
      ? "Confirma siempre la etiqueta DGT exacta de la unidad real anunciada."
      : "Vigila restricciones futuras si la unidad final no mejora tu etiqueta ambiental.",
  ];

  return {
    objetivo: `Radar activo: busca una opción que respete ${targetText} y no empeore el encaje real de tu solución.`,
    senales_verdes: [...new Set(signals.filter(Boolean))].slice(0, 3),
    alertas: [...new Set(alerts.filter(Boolean))].slice(0, 3),
  };
}

function buildSavedComparisonKey({ result, listingResult }) {
  const offerSeed = normalizeText(
    listingResult?.url || listingResult?.searchUrl || listingResult?.title
  ).toLowerCase();
  const solutionType = normalizeText(result?.solucion_principal?.tipo || "movilidad").toLowerCase();
  const solutionTitle = normalizeText(result?.solucion_principal?.titulo || "recomendacion").toLowerCase();

  return offerSeed
    ? `saved-offer:${offerSeed}`
    : `saved-solution:${solutionType}:${solutionTitle}`;
}

function buildComparisonSnapshot({ result, answers, listingResult, listingFilters }) {
  const type = normalizeText(result?.solucion_principal?.tipo);
  const typeMeta = MOBILITY_TYPES[type] || { label: "Movilidad" };
  const radar = buildMarketRadarSnapshot(result, listingResult, listingFilters);

  return {
    id: buildSavedComparisonKey({ result, listingResult }),
    savedAt: new Date().toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    title:
      normalizeText(listingResult?.title || result?.solucion_principal?.titulo) ||
      "Comparativa guardada",
    typeKey: type,
    typeLabel: typeMeta.label,
    score: Number(result?.solucion_principal?.score || result?.alineacion_pct || 0),
    confidence: normalizeText(result?.transparencia?.confianza_nivel || "media"),
    monthlyTotal: Number(result?.tco_detalle?.total_mensual || 0),
    budgetLabel: getOptionLabel(MONTHLY_BUDGET_OPTIONS, listingFilters?.budget, "Sin cuota fijada"),
    usageLabel: normalizeText(answers?.entorno_uso || "mixto"),
    sourceLabel: normalizeText(listingResult?.source),
    listingTitle: normalizeText(listingResult?.title),
    listingPrice: normalizeText(listingResult?.price),
    targetUrl: normalizeText(listingResult?.url || listingResult?.searchUrl),
    targetExact: Boolean(normalizeText(listingResult?.url)),
    radar,
  };
}

function inferBrandPreferenceFromBrand(brand) {
  const normalized = normalizeText(brand).toLowerCase();

  if (["volkswagen", "seat", "renault", "skoda", "peugeot", "citroen", "dacia"].includes(normalized)) {
    return "generalista_europea";
  }

  if (["toyota", "hyundai", "kia", "nissan", "mazda", "honda"].includes(normalized)) {
    return "asiatica_fiable";
  }

  if (["bmw", "audi", "mercedes"].includes(normalized)) {
    return "premium_alemana";
  }

  if (["volvo"].includes(normalized)) {
    return "premium_escandinava";
  }

  if (["byd", "mg", "xpeng"].includes(normalized)) {
    return "nueva_china";
  }

  return "sin_preferencia";
}

function mapFuelToPreference(fuel) {
  const normalized = normalizeText(fuel).toLowerCase();

  if (normalized.includes("eléctr") || normalized.includes("electric")) {
    return "electrico_puro";
  }
  if (normalized.includes("phev")) {
    return "hibrido_enchufable";
  }
  if (normalized.includes("híbr") || normalized.includes("hibri")) {
    return "hibrido_no_enchufable";
  }
  if (normalized.includes("diés") || normalized.includes("dies")) {
    return "diesel";
  }

  return "gasolina";
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
  const [decisionAnswers, setDecisionAnswers] = useState({
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
  });
  const [sellAnswers, setSellAnswers] = useState({
    brand: "",
    model: "",
    year: "",
    mileage: "",
    fuel: "Gasolina",
    sellerType: "particular",
  });
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
  const [saveFeedback, setSaveFeedback] = useState("");
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const quickValidationRef = useRef({});
  const listingOptionsRef = useRef([]);
  const listingSeenRef = useRef({ urls: [], titles: [] });
  const resultRef = useRef(null);

  const showOffersPage = useCallback(() => {
    setResultView("offers");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const showAnalysisPage = useCallback(() => {
    setResultView("analysis");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const openUserDashboard = useCallback(() => {
    setShowAuthMenu(false);
    setShowUserPanel(false);
    setEntryMode("userDashboard");
    setStep(-1);

    if (typeof window !== "undefined") {
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, []);

  const activeSteps = useMemo(() => getQuestionnaireSteps(advancedMode), [advancedMode]);
  const currentStep = activeSteps[step];
  const totalSteps = activeSteps.length;
  const dashboardSavedComparisons = Array.isArray(savedComparisons)
    ? savedComparisons.slice(0, 3)
    : [];
  const advisorAppointments = result
    ? [
        {
          id: "advisor-follow-up",
          title: "Revisión personalizada MoveAdvisor",
          meta: `${normalizeText(result?.solucion_principal?.titulo) || "Tu plan de movilidad"} · pendiente de reservar`,
          status: "Pendiente",
        },
      ]
    : [];
  const dashboardAppointments = [...userAppointments, ...advisorAppointments].slice(0, 6);
  const dashboardValuations = sellAiResult
    ? [
        {
          id: "sell-valuation",
          title:
            sellAnswers?.brand && sellAnswers?.model
              ? `${sellAnswers.brand} ${sellAnswers.model}`
              : "Vehículo en valoración",
          meta:
            normalizeText(sellAiResult?.report) ||
            "Tasación generada a partir del estado, kilometraje y demanda estimada.",
          status: sellListingResult ? "Tasación vinculada a venta activa" : "Última tasación disponible",
        },
      ]
    : [];
  const userVehicleSections = [
    {
      key: "owned",
      title: "Comprados",
      items: [],
      empty: "Todavía no has marcado vehículos como comprados.",
    },
    {
      key: "sold",
      title: "Vendidos",
      items: [],
      empty: "Aún no tienes operaciones de venta cerradas.",
    },
    {
      key: "active-sale",
      title: "Activos en venta",
      items:
        sellAnswers?.brand && sellAnswers?.model
          ? [
              {
                title: `${sellAnswers.brand} ${sellAnswers.model}`,
                meta: `${sellAnswers.year || "Año pendiente"} · ${sellAnswers.sellerType === "profesional" ? "Venta profesional" : "Venta particular"}`,
                status: sellListingResult ? "Publicado en seguimiento" : "Borrador listo para publicar",
              },
            ]
          : [],
      empty: "No hay anuncios activos en venta ahora mismo.",
    },
  ];

  useEffect(() => {
    setSavedComparisons(readSavedComparisons());
    setUserAppointments(readUserAppointments());
  }, []);

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

  const resetListingDiscovery = () => {
    setListingFilters({ company: "", budget: "", income: "" });
    setListingResult(null);
    setListingOptions([]);
    listingSeenRef.current = { urls: [], titles: [] };
    setListingSearchCoverage(null);
    setListingError(null);
    setListingLoading(false);
  };

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

  const restartQuestionnaire = () => {
    setStep(0);
    setAnswers({});
    setMultiSelected([]);
    setResult(null);
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    resetListingDiscovery();
  };

  const handleAuthAction = (mode) => {
    setShowAuthMenu(false);
    setIsUserLoggedIn(true);
    setShowUserPanel(true);
    setSaveFeedback(
      mode === "login"
        ? "Sesión iniciada. Ya tienes disponible tu panel personal."
        : "Cuenta creada. Ya tienes disponible tu panel personal."
    );
    window.setTimeout(() => setSaveFeedback(""), 2200);
  };

  const handleUserAccessClick = () => {
    if (isUserLoggedIn) {
      setShowUserPanel((prev) => !prev);
      setShowAuthMenu(false);
      return;
    }

    setShowAuthMenu((prev) => !prev);
    setShowUserPanel(false);
  };

  const handleLogout = () => {
    setIsUserLoggedIn(false);
    setShowAuthMenu(false);
    setShowUserPanel(false);

    if (entryMode === "userDashboard") {
      setEntryMode(null);
      setStep(-1);

      if (typeof window !== "undefined") {
        setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
      }
    }
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
      const response = await fetch(LISTING_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify({
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
        }),
        signal: controller.signal,
      });

      const data = await readApiResponse(response);

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

  const updateListingFilter = (key, value) => {
    const nextFilters = {
      ...listingFilters,
      [key]: value,
    };

    setListingFilters(nextFilters);
    setListingError(null);
    void searchRealListing(nextFilters, quickValidationAnswers);
  };

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

  const updateQuickValidationAnswer = (key, value) => {
    setQuickValidationAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const requestAiJson = async (prompt, extraPayload = {}) => {
    const response = await fetch(ANALYZE_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        ...extraPayload,
      }),
    });

    const data = await readApiResponse(response);

    if (!response.ok) {
      if (data.code === "API_KEY_MISSING") {
        setApiKeyMissing(true);
      }

      throw new Error(data.error?.message || data.error || "Error desconocido");
    }

    if (data.parsed && typeof data.parsed === "object") {
      return data.parsed;
    }

    const text = data.content?.map((item) => item.text || "").join("") || "";
    return parseAdvisorJson(text);
  };

  const searchDecisionListing = async (aiResult = decisionAiResult) => {
    if (!decisionFlowReady || !aiResult?.oferta_top?.titulo) {
      return;
    }

    setDecisionListingLoading(true);
    setDecisionListingError(null);
    setDecisionListingResult(null);

    try {
      const mappedAnswers = {
        perfil: "particular",
        flexibilidad: decisionAnswers.operation === "renting"
          ? "renting"
          : decisionAnswers.acquisition === "contado"
          ? "propiedad_contado"
          : "propiedad_financiada",
        propulsion_preferida: "indiferente_motor",
        marca_preferencia: inferBrandPreferenceFromBrand(decisionAnswers.brand),
        ocupantes: "5_plazas_maletero_medio",
        entorno_uso: "mixto",
        km_anuales: "10k_20k",
        uso_principal: ["trabajo_diario"],
        marca_objetivo: decisionAnswers.brand || "",
        modelo_objetivo: [decisionAnswers.brand, decisionAnswers.model].filter(Boolean).join(" "),
      };

      const response = await fetch(LISTING_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          result: {
            solucion_principal: {
              titulo: aiResult.oferta_top.titulo,
              tipo:
                decisionAnswers.operation === "renting"
                  ? "renting_largo"
                  : decisionAnswers.acquisition === "contado"
                  ? "compra_contado"
                  : "compra_financiada",
              empresas_recomendadas: [],
            },
            propulsiones_viables: [],
          },
          answers: mappedAnswers,
          filters: {
            budget: decisionAnswers.monthlyBudget || "",
            income: "fijos_estables",
          },
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo localizar un anuncio real para esta operación.");
      }

      setDecisionListingResult(data.listing || null);
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
      const response = await fetch(LISTING_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          result: {
            solucion_principal: {
              titulo: `${sellAnswers.brand} ${sellAnswers.model} en venta en el mercado`,
              tipo: "compra_contado",
              empresas_recomendadas: [],
            },
            propulsiones_viables: [sellAnswers.fuel],
          },
          answers: {
            perfil: "particular",
            flexibilidad: "propiedad_contado",
            propulsion_preferida: mapFuelToPreference(sellAnswers.fuel),
            marca_preferencia: inferBrandPreferenceFromBrand(sellAnswers.brand),
            ocupantes: "5_plazas_maletero_medio",
            entorno_uso: "mixto",
            km_anuales: Number(sellAnswers.mileage || 0) > 80000 ? "mas_20k" : "10k_20k",
            uso_principal: ["trabajo_diario"],
            marca_objetivo: sellAnswers.brand,
            modelo_objetivo: `${sellAnswers.brand} ${sellAnswers.model}`,
          },
          filters: {
            income: "fijos_estables",
          },
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo localizar un anuncio comparable ahora mismo.");
      }

      setSellListingResult(data.listing || null);
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
      const prompt = `Eres un asesor experto en compra y renting de coches en Espana. Analiza este caso y responde SOLO con JSON valido, sin markdown.

Devuelve exactamente esta estructura:
{
  "resumen": "2-3 frases con la lectura global del caso",
  "criterio_principal": "el criterio clave que manda la decision",
  "oferta_top": {
    "titulo": "nombre de la opcion mas sensata",
    "precio_objetivo": "precio objetivo o rango total en EUR",
    "cuota_estimada": "cuota estimada si aplica; si no aplica indica no aplica",
    "razon": "explicacion concreta y accionable",
    "riesgo": "bajo|medio|alto"
  },
  "alternativas": [
    { "titulo": "alternativa 1", "precio": "precio o cuota", "razon": "por que puede tener sentido" },
    { "titulo": "alternativa 2", "precio": "precio o cuota", "razon": "por que puede tener sentido" }
  ],
  "alertas": ["alerta 1", "alerta 2"],
  "siguiente_paso": "que deberia hacer ahora"
}

Criterios:
- Prioriza valor real en el mercado espanol, coste total, riesgo y facilidad de cierre.
- Si es renting, habla en terminos de cuota realista y condiciones.
- Si es compra, habla en terminos de precio objetivo, financiacion y riesgo de depreciacion.
- No inventes enlaces ni empresas concretas.

Perfil:
- Operacion: ${decisionAnswers.operation === "renting" ? "Renting" : "Compra"}
- Modalidad: ${normalizeText(decisionAnswers.acquisition) || "No indicada"}
- Marca/modelo definidos: ${decisionAnswers.hasBrand === "si" ? `${decisionAnswers.brand} ${decisionAnswers.model}` : "No"}
- Estado deseado: ${normalizeText(decisionAnswers.condition) || "No indicado"}
- Cuota objetivo: ${getOptionLabel(MONTHLY_BUDGET_OPTIONS, decisionAnswers.monthlyBudget)}
- Presupuesto total: ${getOptionLabel(TOTAL_PURCHASE_OPTIONS, decisionAnswers.cashBudget)}
- Importe a financiar: ${getOptionLabel(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount)}
- Entrada: ${getOptionLabel(ENTRY_AMOUNT_OPTIONS, decisionAnswers.entryAmount)}
- Antiguedad maxima: ${getOptionLabel(AGE_FILTER_OPTIONS, decisionAnswers.ageFilter)}
- Kilometraje maximo: ${getOptionLabel(MILEAGE_FILTER_OPTIONS, decisionAnswers.mileageFilter)}`;

      const raw = await requestAiJson(prompt, { decisionAnswers });
      const normalized = normalizeDecisionAiResult(raw);

      if (!isCompleteDecisionAiResult(normalized)) {
        throw new Error("La IA no ha devuelto un analisis suficiente para esta operacion.");
      }

      setDecisionAiResult(normalized);
      await searchDecisionListing(normalized);
    } catch (err) {
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
      const prompt = `Eres un experto en mercado VO en Espana. Valora este coche y responde SOLO con JSON valido, sin markdown.

Devuelve exactamente esta estructura:
{
  "precio_objetivo": "precio recomendado de salida en EUR",
  "rango_publicacion": { "min": "min EUR", "max": "max EUR" },
  "nivel_demanda": "alta|media|baja",
  "tiempo_estimado_venta": "estimacion razonable",
  "resumen": "2-3 frases justificando la valoracion",
  "argumentos_clave": ["argumento 1", "argumento 2", "argumento 3"],
  "alertas": ["alerta 1", "alerta 2"],
  "estrategia_publicacion": "como deberia publicar y defender el precio"
}

Criterios:
- Ajusta la valoracion al mercado espanol.
- Ten en cuenta edad, kilometraje, combustible y canal de venta.
- No inventes anuncios concretos; da una recomendacion profesional y monetizable.

Vehiculo:
- Marca: ${sellAnswers.brand}
- Modelo: ${sellAnswers.model}
- Ano: ${sellAnswers.year}
- Kilometraje: ${Number(sellAnswers.mileage || 0).toLocaleString("es-ES")} km
- Combustible: ${sellAnswers.fuel}
- Canal de venta: ${sellAnswers.sellerType}`;

      const raw = await requestAiJson(prompt, { sellAnswers });
      const normalized = normalizeSellAiResult(raw);

      if (!isCompleteSellAiResult(normalized)) {
        throw new Error("La IA no ha devuelto una valoracion suficiente para este coche.");
      }

      setSellAiResult(normalized);
      await searchSellComparableListing();
    } catch (err) {
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

    // Simulate thinking phases for UX
    const phases = [
      "Evaluando patrón de uso real...",
      "Calculando TCO estimado...",
      "Analizando etiqueta DGT y ZBE...",
      "Detectando tensiones activas...",
      "Calculando zona de intersección...",
      "Generando recomendación personalizada...",
    ];

    let phaseIndex = 0;
    setLoadingPhase(0);
    const phaseInterval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length;
      setLoadingPhase(phaseIndex);
    }, 1800);

    try {
      const answersSummary = activeSteps.map((stepConfig) => {
        const value = finalAnswers[stepConfig.id];
        const normalizedValue = Array.isArray(value) ? value.join(", ") : value || "No indicado";
        return `- ${stepConfig.question}: ${normalizedValue}`;
      }).join("\n");

      const prompt = `Eres un asesor experto en movilidad en Espana. Analiza este perfil y responde SOLO con JSON valido, sin markdown ni texto adicional.

Debes devolver exactamente esta estructura:
{
  "alineacion_pct": 78,
  "solucion_principal": {
    "tipo": "compra_contado|compra_financiada|renting_largo|renting_corto|rent_a_car|carsharing|carpooling|transporte_publico|micromovilidad",
    "score": 85,
    "titulo": "titulo atractivo y especifico",
    "resumen": "2-3 frases explicando por que es la mejor opcion para este perfil concreto",
    "ventajas": ["ventaja 1 especifica", "ventaja 2", "ventaja 3"],
    "inconvenientes": ["inconveniente 1 real", "inconveniente 2"],
    "coste_estimado": "rango realista en EUR/mes incluyendo todos los costes",
    "empresas_recomendadas": ["empresa real en Espana 1", "empresa 2", "empresa 3"],
    "etiqueta_dgt": "CERO|ECO|C|B|No aplica",
    "tension_principal": "descripcion de la tension mas relevante detectada entre deseos y realidad"
  },
  "score_desglose": {
    "encaje_uso": 24,
    "coste_total": 17,
    "flexibilidad": 18,
    "viabilidad_real": 15,
    "ajuste_preferencias": 11
  },
  "por_que_gana": ["motivo 1", "motivo 2", "motivo 3", "motivo 4"],
  "alternativas": [
    { "tipo": "...", "score": 70, "titulo": "...", "razon": "1-2 frases con argumento concreto" },
    { "tipo": "...", "score": 60, "titulo": "...", "razon": "1-2 frases con argumento concreto" }
  ],
  "comparador_final": [
    { "criterio": "coste total real", "opcion_principal": "...", "alternativa_1": "...", "alternativa_2": "...", "ganador": "principal|alternativa_1|alternativa_2" },
    { "criterio": "flexibilidad", "opcion_principal": "...", "alternativa_1": "...", "alternativa_2": "...", "ganador": "principal|alternativa_1|alternativa_2" }
  ],
  "transparencia": {
    "confianza_nivel": "alta|media|ajustada",
    "confianza_motivo": "por que esta recomendacion es mas o menos robusta",
    "supuestos_clave": ["supuesto 1", "supuesto 2", "supuesto 3"],
    "validaciones_pendientes": ["validacion 1", "validacion 2"]
  },
  "plan_accion": {
    "semaforo": "verde|ambar|rojo",
    "estado": "mensaje corto de decision",
    "resumen": "como deberia actuar el usuario ahora mismo",
    "acciones": ["accion 1", "accion 2", "accion 3"],
    "alertas_rojas": ["riesgo 1", "riesgo 2"]
  },
  "tco_aviso": "aviso concreto sobre el TCO real estimado para este perfil en Espana",
  "tco_detalle": {
    "concepto_base": "cuota / base que mas pesa en esta solucion",
    "entrada_inicial": 4000,
    "base_mensual": 320,
    "seguro": 55,
    "energia": 60,
    "mantenimiento": 35,
    "extras": 25,
    "total_mensual": 495,
    "total_anual": 5940,
    "nota": "lectura corta y util de que incluye este TCO"
  },
  "consejo_experto": "consejo practico muy especifico para Espana que normalmente no se conoce",
  "siguiente_paso": "accion concreta que deberia hacer esta semana",
  "propulsiones_viables": ["hibrido suave", "PHEV", "electrico"]
}

Criterios de analisis:
- Considera financiacion, TCO, restricciones ZBE, viabilidad de electrificacion, depreciacion y riesgo.
- No dejes el TCO en abstracto: cuantifica un desglose mensual razonable con base, seguro, energia, mantenimiento, extras, total mensual y total anual.
- Añade transparencia real: incluye comparador_final y transparencia para explicar por que gana esta opcion y que validaciones quedan pendientes.
- Añade un plan_accion claro con semaforo (verde, ambar o rojo), acciones concretas y alertas rojas para la decision final.
- Si el test avanzado aporta datos de garaje, ZBE, capital inicial, control de riesgo o tipo de zona, usalos para afinar de verdad la recomendacion.
- Explica el score con logica de encaje de uso, coste total, flexibilidad, viabilidad real y ajuste con preferencias.
- Prioriza opciones realistas en Espana para el perfil dado.
- Si el horizonte es "Por días", prioriza rent_a_car o alquiler por días frente a compra o renting largo.
- Si el horizonte es "Menos de 2 meses", prioriza carsharing o alquiler temporal; solo sugiere renting si está muy justificado.
- Si el horizonte es "Menos de 1 año", prioriza renting_corto o suscripción flexible antes que compra o renting largo.
- Si recomiendas electrico puro, explicita claramente los requisitos de carga y validalos en el siguiente paso.
- Si recomiendas compra financiada, indica que la validacion de capacidad financiera y scoring se hara en el siguiente paso sobre el shortlist de coches.
- Si recomiendas renting, indica que la validacion de cuota mensual objetivo y estabilidad de ingresos se hara al final como siguiente paso.
- Valora flexibilidad vs propiedad y horizonte temporal.

Perfil del usuario:
${answersSummary}`;

      const response = await fetch(ANALYZE_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          answers: finalAnswers,
        }),
      });

      const data = await readApiResponse(response);
      clearInterval(phaseInterval);

      if (!response.ok) {
        if (data.code === "API_KEY_MISSING") {
          setApiKeyMissing(true);
          setLoading(false);
          return;
        }

        throw new Error(data.error?.message || data.error || "Error desconocido");
      }

      if (data.parsed && typeof data.parsed === "object") {
        const normalizedResult = normalizeAdvisorResult(data.parsed);

        if (!isCompleteAdvisorResult(normalizedResult)) {
          throw new Error("La IA ha devuelto un analisis incompleto. Intentalo de nuevo.");
        }

        setResultView("analysis");
        setResult(normalizedResult);
        setLoading(false);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        return;
      }

      const text = data.content?.map((i) => i.text || "").join("") || "";
      const parsed = normalizeAdvisorResult(parseAdvisorJson(text));

      if (!isCompleteAdvisorResult(parsed)) {
        throw new Error("La IA ha devuelto un analisis incompleto. Intentalo de nuevo.");
      }

      setResultView("analysis");
      setResult(parsed);
      setLoading(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      clearInterval(phaseInterval);
      setError(`Error: ${err.message}`);
      setLoading(false);
      setStep(totalSteps - 1);
    }
  };

  const openPortalVoOfferDetail = useCallback((offer) => {
    if (!offer?.id) {
      return;
    }

    setSelectedPortalVoOfferId(offer.id);
    setEntryMode("portalVoDetail");

    if (typeof window !== "undefined") {
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  }, []);

  const restart = () => {
    setEntryMode(null);
    setStep(-1);
    setAnswers({});
    setMultiSelected([]);
    setResult(null);
    setResultView("analysis");
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    setAdvancedMode(false);
    resetListingDiscovery();
    setDecisionAnswers({
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
    });
    setSellAnswers({
      brand: "",
      model: "",
      year: "",
      mileage: "",
      fuel: "Gasolina",
      sellerType: "particular",
    });
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
  };

  const updateDecisionAnswer = (key, value) => {
    setDecisionAnswers((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "brand") {
        next.model = "";
      }

      if (key === "operation") {
        next.acquisition = "";
        next.monthlyBudget = "";
        next.cashBudget = "";
        next.financeAmount = "";
        next.entryAmount = "";
        next.ageFilter = "all";
        next.mileageFilter = "all";
      }

      if (key === "acquisition") {
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
    });
  };

  const updatePortalVoFilter = (key, value) => {
    setPortalVoFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const decisionModels = decisionAnswers.brand ? MARKET_BRANDS[decisionAnswers.brand] || [] : [];
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
  const sellModels = sellAnswers.brand ? MARKET_BRANDS[sellAnswers.brand] || [] : [];
  const sellEstimate =
    sellAnswers.brand && sellAnswers.model && sellAnswers.year && sellAnswers.mileage
      ? buildSellEstimate(sellAnswers)
      : null;
  const portalVoLocations = useMemo(
    () => [...new Set(PORTAL_VO_OFFERS.map((offer) => offer.location))],
    []
  );
  const portalVoColors = useMemo(
    () => [...new Set(PORTAL_VO_OFFERS.map((offer) => offer.color))],
    []
  );
  const filteredPortalVoOffers = useMemo(() => {
    const query = normalizeText(portalVoFilters.query).toLowerCase();

    return PORTAL_VO_OFFERS.filter((offer) => {
      const searchText = normalizeText(
        `${offer.title} ${offer.brand} ${offer.model} ${offer.location} ${offer.color} ${offer.fuel}`
      ).toLowerCase();
      const matchesQuery = !query || searchText.includes(query);
      const matchesPrice = !portalVoFilters.maxPrice || Number(offer.price || 0) <= Number(portalVoFilters.maxPrice);
      const matchesYear = !portalVoFilters.minYear || Number(offer.year || 0) >= Number(portalVoFilters.minYear);
      const matchesMileage = !portalVoFilters.maxMileage || Number(offer.mileage || 0) <= Number(portalVoFilters.maxMileage);
      const matchesLocation = !portalVoFilters.location || normalizeText(offer.location) === normalizeText(portalVoFilters.location);
      const matchesColor = !portalVoFilters.color || normalizeText(offer.color) === normalizeText(portalVoFilters.color);
      const displacement = Number(offer.displacement || 0);
      const matchesDisplacement =
        !portalVoFilters.displacement ||
        (portalVoFilters.displacement === "electric" && displacement === 0) ||
        (portalVoFilters.displacement === "0_1200" && displacement > 0 && displacement <= 1200) ||
        (portalVoFilters.displacement === "1200_1600" && displacement > 1200 && displacement <= 1600) ||
        (portalVoFilters.displacement === "1600_2000" && displacement > 1600 && displacement <= 2000) ||
        (portalVoFilters.displacement === "2000_plus" && displacement > 2000);
      const matchesGuarantee = !portalVoFilters.onlyGuaranteed || offer.hasGuaranteeSeal;

      return (
        matchesQuery &&
        matchesPrice &&
        matchesYear &&
        matchesMileage &&
        matchesLocation &&
        matchesColor &&
        matchesDisplacement &&
        matchesGuarantee
      );
    }).map((offer) => ({
      ...offer,
      preferAiImage: true,
      hasRealImage: true,
      imageSearchQuery: normalizeText(`${offer.brand} ${offer.model} ${offer.year}`),
    })).sort((a, b) => b.portalScore - a.portalScore || a.price - b.price);
  }, [portalVoFilters]);
  const featuredPortalVoOffers = filteredPortalVoOffers
    .filter((offer) => offer.hasGuaranteeSeal)
    .slice(0, 3);
  const selectedPortalVoOffer = useMemo(() => {
    const found = PORTAL_VO_OFFERS.find((offer) => offer.id === selectedPortalVoOfferId);

    return found
      ? {
          ...found,
          preferAiImage: true,
          hasRealImage: true,
          imageSearchQuery: normalizeText(`${found.brand} ${found.model} ${found.year}`),
        }
      : null;
  }, [selectedPortalVoOfferId]);
  const relatedPortalVoOffers = useMemo(() => {
    if (!selectedPortalVoOffer) {
      return [];
    }

    return filteredPortalVoOffers
      .filter((offer) => offer.id !== selectedPortalVoOffer.id)
      .slice(0, 3);
  }, [filteredPortalVoOffers, selectedPortalVoOffer]);

  const progress =
    step >= 0 && step < totalSteps
      ? ((step + 1) / totalSteps) * 100
      : step === 99 || result || apiKeyMissing
      ? 100
      : 0;

  const loadingTexts = [
    "Evaluando patrón de uso real...",
    "Calculando TCO estimado...",
    "Analizando etiqueta DGT y ZBE...",
    "Detectando tensiones activas...",
    "Calculando zona de intersección...",
    "Generando recomendación personalizada...",
  ];

  const draftAnswers =
    entryMode === "consejo" && currentStep?.type === "multi"
      ? { ...answers, [currentStep.id]: multiSelected }
      : answers;
  const visibleDraftAnswers = buildActiveAnswers(draftAnswers, activeSteps);
  const answeredSteps = countAnsweredSteps(visibleDraftAnswers, activeSteps);
  const remainingQuestions = Math.max(totalSteps - answeredSteps, 0);
  const completionPct = Math.min(100, Math.round((answeredSteps / totalSteps) * 100));

  // ─── STYLES ───────────────────────────────
  const s = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(160deg,#060d1a 0%,#0a1628 50%,#050e1c 100%)",
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      color: "#e2e8f0",
    },
    header: {
      padding: "18px 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      position: "sticky",
      top: 0,
      background: "rgba(6,13,26,0.92)",
      backdropFilter: "blur(12px)",
      zIndex: 100,
    },
    progressBar: { height: 3, background: "rgba(255,255,255,0.06)" },
    progressFill: {
      height: "100%",
      width: `${progress}%`,
      background: "linear-gradient(90deg,#2563EB,#059669,#0891B2)",
      transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
      borderRadius: "0 2px 2px 0",
    },
    center: {
      width: "min(1380px, calc(100vw - 32px))",
      maxWidth: 1380,
      margin: "0 auto",
      padding: "40px 16px 72px",
    },
    btn: {
      background: "linear-gradient(135deg,#2563EB,#1d4ed8)",
      border: "none",
      color: "white",
      padding: "14px 36px",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s, transform 0.15s",
    },
    card: (selected) => ({
      background: selected ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.025)",
      border: selected ? "1px solid rgba(37,99,235,0.45)" : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 13,
      padding: "14px 18px",
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      gap: 14,
      width: "100%",
      color: "inherit",
      marginBottom: 9,
      transition: "all 0.18s ease",
    }),
    blockBadge: (block) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: `${BLOCK_COLORS[block] || "#2563EB"}18`,
      border: `1px solid ${BLOCK_COLORS[block] || "#2563EB"}30`,
      color: BLOCK_COLORS[block] || "#2563EB",
      padding: "4px 12px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.6px",
      marginBottom: 16,
    }),
    select: {
      width: "100%",
      background: "#0f1b2d",
      color: "#f8fafc",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "12px 14px",
      outline: "none",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    },
    input: {
      width: "100%",
      background: "#0f1b2d",
      color: "#f8fafc",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "12px 14px",
      outline: "none",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    },
    panel: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 18,
    },
  };

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

      {/* PROGRESS */}
      <div style={s.progressBar}>
        <div style={s.progressFill} />
      </div>

      {/* ── LANDING ── */}
      {step === -1 && !entryMode && (
        <div style={{ ...s.center, maxWidth: 1120, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(37,99,235,0.1)",
              border: "1px solid rgba(37,99,235,0.22)",
              padding: "5px 14px",
              borderRadius: 100,
              fontSize: 11,
              color: "#60a5fa",
              marginBottom: 28,
              letterSpacing: "0.6px",
            }}
          >
            ✨ ASESOR INTELIGENTE DE MOVILIDAD · ESPAÑA
          </div>
          <h1
            style={{
              fontSize: "clamp(30px,6vw,52px)",
              fontWeight: 800,
              letterSpacing: "-2px",
              margin: "0 0 18px",
              background: "linear-gradient(135deg,#f1f5f9 30%,#64748b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.1,
            }}
          >
            ¿Cuál es tu mejor<br />opción de movilidad?
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "#64748b",
              lineHeight: 1.7,
              maxWidth: 440,
              margin: "0 auto 36px",
            }}
          >
            Elige primero si ya sabes lo que quieres o si necesitas que te guiemos. A partir de ahí,
            activamos el flujo adecuado para comparar ofertas o recomendarte la mejor solución.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 16,
              marginTop: 28,
              textAlign: "left",
            }}
          >
            <button
              onClick={() => {
                setEntryMode("consejo");
                setStep(-1);
              }}
              style={{
                ...s.card(false),
                padding: 22,
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(37,99,235,0.22)",
              }}
            >
              <span style={{ fontSize: 28, minWidth: 40 }}>🎯</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
                  Quiero que me ayudes a encontrar el coche con mejor relación calidad-precio
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Te hacemos las preguntas del marco completo y te devolvemos una recomendación
                  personalizada con análisis de uso real, coste total, riesgo y siguiente paso.
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setEntryMode("decision");
                setStep(-1);
              }}
              style={{
                ...s.card(false),
                padding: 22,
                background: "rgba(5,150,105,0.08)",
                border: "1px solid rgba(5,150,105,0.22)",
              }}
            >
              <span style={{ fontSize: 28, minWidth: 40 }}>🧭</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
                  Tengo claro qué marca y modelo quiero, ayúdame a encontrar la mejor oferta
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Filtra por marca, modelo, antigüedad y kilometraje para que la IA ordene las ofertas del mercado
                  actual según valor, riesgo y coste final.
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setEntryMode("sell");
                setStep(-1);
              }}
              style={{
                ...s.card(false),
                padding: 22,
                background: "rgba(217,119,6,0.08)",
                border: "1px solid rgba(217,119,6,0.22)",
              }}
            >
              <span style={{ fontSize: 28, minWidth: 40 }}>💶</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
                  Quiero vender mi coche, ayúdame a saber el precio al que debo ofertarlo
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  La IA estima rango de precio, tendencia histórica, volumen de unidades similares y un informe
                  entregable que luego se puede monetizar como servicio premium.
                </div>
              </div>
            </button>

          </div>

          <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => {
                setEntryMode("portalVo");
                setStep(-1);
                setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
              }}
              style={{
                background: "linear-gradient(135deg,#f59e0b,#d97706)",
                border: "none",
                color: "white",
                padding: "13px 18px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 14px 34px rgba(217,119,6,0.18)",
              }}
            >
              🏪 Ofertas VO únicas de nuestro portal
            </button>
          </div>

          <p style={{ marginTop: 18, fontSize: 12, color: "#334155" }}>
            Sin registro · Sin tarjeta · ~5 minutos
          </p>

          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
              marginTop: 52,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: 36,
            }}
          >
            {[
              [String(totalSteps), "Preguntas del marco"],
              ["9+", "Opciones de movilidad"],
              ["IA", "Análisis personalizado"],
            ].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#2563EB" }}>{n}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Blocks preview */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginTop: 36,
            }}
          >
            {Object.entries(BLOCK_COLORS).map(([name, color]) => (
              <span
                key={name}
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}28`,
                  color,
                  padding: "4px 12px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {step === -1 && entryMode === "userDashboard" && isUserLoggedIn && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Vinculación"), marginBottom: 10 }}>👤 ÁREA PRIVADA DE USUARIO</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <h2
                style={{
                  fontSize: "clamp(22px,4vw,30px)",
                  fontWeight: 800,
                  letterSpacing: "-1px",
                  margin: "0 0 10px",
                  color: "#f1f5f9",
                }}
              >
                Mi espacio MoveAdvisor
              </h2>
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0, maxWidth: 760 }}>
                Esta es tu página privada, con cada apartado organizado por secciones: recomendaciones guardadas,
                citas, tasaciones y el seguimiento de tus vehículos.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setEntryMode(null);
                  setStep(-1);
                  if (typeof window !== "undefined") {
                    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
                  }
                }}
                style={{
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  border: "none",
                  color: "#ffffff",
                  padding: "11px 16px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                ⌂ Volver al inicio
              </button>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#cbd5e1",
                  padding: "11px 16px",
                  borderRadius: 10,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
            {[
              { label: "Guardadas", value: savedComparisons.length, color: "#60a5fa" },
              { label: "Citas", value: dashboardAppointments.length, color: "#fbbf24" },
              { label: "Tasaciones", value: dashboardValuations.length, color: "#c084fc" },
              { label: "Vehículos", value: userVehicleSections.reduce((acc, section) => acc + section.items.length, 0), color: "#34d399" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(15,23,42,0.45)",
                  border: "1px solid rgba(148,163,184,0.14)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {[
              { id: "user-dashboard-saved", label: "Guardadas", count: savedComparisons.length },
              { id: "user-dashboard-appointments", label: "Citas", count: dashboardAppointments.length },
              { id: "user-dashboard-valuations", label: "Tasaciones", count: dashboardValuations.length },
              { id: "user-dashboard-vehicles", label: "Vehículos", count: userVehicleSections.reduce((acc, section) => acc + section.items.length, 0) },
            ].map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  if (typeof document !== "undefined") {
                    document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                style={{
                  background: "rgba(37,99,235,0.1)",
                  border: "1px solid rgba(96,165,250,0.18)",
                  color: "#dbeafe",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {section.label} · {section.count}
              </button>
            ))}
          </div>

          <section id="user-dashboard-saved" style={{ ...s.panel, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px" }}>RECOMENDACIONES GUARDADAS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Tus comparativas y ofertas favoritas</div>
              </div>
              <span style={{ ...getOfferBadgeStyle("info"), fontSize: 11 }}>{savedComparisons.length} guardadas</span>
            </div>

            {savedComparisons.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {savedComparisons.map((item) => {
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
                      style={{
                        background: "rgba(15,23,42,0.34)",
                        border: "1px solid rgba(148,163,184,0.14)",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                            {item.typeLabel} · {item.savedAt}
                          </div>
                          <div style={{ fontSize: 11, color: "#bfdbfe", marginTop: 3 }}>
                            {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/mes` : item.budgetLabel || "Sin cuota definida"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {savedOfferHref && (
                            <button
                              type="button"
                              onClick={() => openOfferInNewTab(savedOfferHref)}
                              style={{
                                background: "rgba(37,99,235,0.12)",
                                border: "1px solid rgba(96,165,250,0.2)",
                                color: "#dbeafe",
                                padding: "8px 10px",
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Abrir oferta ↗
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeSavedComparison(item.id)}
                            style={{
                              background: "rgba(239,68,68,0.12)",
                              border: "1px solid rgba(248,113,113,0.18)",
                              color: "#fecaca",
                              padding: "8px 10px",
                              borderRadius: 10,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Todavía no tienes recomendaciones guardadas. Cuando guardes una comparativa, aparecerá aquí.
              </div>
            )}
          </section>

          <section id="user-dashboard-appointments" style={{ ...s.panel, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#fbbf24", letterSpacing: "0.6px" }}>CITAS Y GESTIONES</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Tu agenda de taller y mantenimiento</div>
              </div>
              <span style={{ ...getOfferBadgeStyle("amber"), fontSize: 11 }}>{dashboardAppointments.length} activas</span>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
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
                    padding: "7px 10px",
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
              <div style={{ display: "grid", gap: 10 }}>
                {dashboardAppointments.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "rgba(15,23,42,0.34)",
                      border: "1px solid rgba(148,163,184,0.14)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{item.meta}</div>
                    <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 3 }}>
                      {item.status}
                      {item.requestedAt ? ` · ${item.requestedAt}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Aún no tienes citas programadas. Cuando reserves una, se verá aquí.
              </div>
            )}
          </section>

          <section id="user-dashboard-valuations" style={{ ...s.panel, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#c084fc", letterSpacing: "0.6px" }}>MIS TASACIONES</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Valoraciones e informes guardados</div>
              </div>
              <span style={{ ...getOfferBadgeStyle("slate"), fontSize: 11 }}>{dashboardValuations.length} informes</span>
            </div>

            {dashboardValuations.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {dashboardValuations.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "rgba(15,23,42,0.34)",
                      border: "1px solid rgba(148,163,184,0.14)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{item.meta}</div>
                    <div style={{ fontSize: 11, color: "#c084fc", marginTop: 3 }}>{item.status}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Cuando hagas una tasación de tu coche, la verás aquí guardada.
              </div>
            )}
          </section>

          <section id="user-dashboard-vehicles" style={s.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#34d399", letterSpacing: "0.6px" }}>MIS VEHÍCULOS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Seguimiento de tu actividad</div>
              </div>
              <span style={{ ...getOfferBadgeStyle("green"), fontSize: 11 }}>
                {userVehicleSections.reduce((acc, section) => acc + section.items.length, 0)} registros
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              {userVehicleSections.map((section) => (
                <div
                  key={section.key}
                  style={{
                    background: "rgba(15,23,42,0.34)",
                    border: "1px solid rgba(148,163,184,0.14)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{section.title}</div>
                    <span style={{ fontSize: 11, color: "#93c5fd" }}>{section.items.length}</span>
                  </div>
                  {section.items.length > 0 ? (
                    section.items.map((vehicle, index) => (
                      <div key={`${section.key}-${index}`} style={{ fontSize: 12, color: "#cbd5e1", marginTop: 8 }}>
                        <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{vehicle.title}</div>
                        <div style={{ marginTop: 2 }}>{vehicle.meta}</div>
                        <div style={{ marginTop: 2, color: "#6ee7b7" }}>{vehicle.status}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{section.empty}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {step === -1 && entryMode === "consejo" && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Vinculación"), marginBottom: 10 }}>🎯 DECISIÓN CLARA</div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Encontrar el coche con mejor relación calidad-precio
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
            Este flujo arranca el test de decisión y añade una capa de valor con financiación, TCO,
            garantías, pricing, señales de mercado y valor futuro antes de recomendar una compra o renting.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              gap: 12,
              marginBottom: 28,
            }}
          >
            {ADVISOR_PILLARS.map((pillar) => (
              <div key={pillar.title} style={s.panel}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                  {pillar.title}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  {pillar.text}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => setStep(0)}
              style={s.btn}
            >
              Empezar flujo de decisión →
            </button>
            <button
              onClick={restart}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {step === -1 && entryMode === "decision" && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Vinculación"), marginBottom: 10 }}>🧭 OFERTAS DE MERCADO</div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Afina marca, modelo y condiciones para ordenar las ofertas
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
            Aquí priorizamos el mercado actual para una necesidad ya concreta. Puedes filtrar por modalidad,
            estado, antigüedad y kilometraje antes de ver un ranking de oportunidades.
          </p>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
              1. TIPO DE OPERACIÓN
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              {[
                ["comprar", "Compra", "🔑"],
                ["renting", "Renting", "📅"],
              ].map(([value, label, icon]) => (
                <button
                  key={value}
                  style={s.card(decisionAnswers.operation === value)}
                  onClick={() => updateDecisionAnswer("operation", value)}
                >
                  <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
              2. MODALIDAD
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              {(decisionAnswers.operation === "renting"
                ? [
                    ["particular", "Renting particular", "👤"],
                    ["empresa", "Renting empresa", "🏢"],
                    ["flexible", "Renting flexible", "⚡"],
                  ]
                : [
                    ["contado", "Compra al contado", "💶"],
                    ["financiado", "Compra financiada", "📝"],
                    ["mixto", "Entrada + financiación", "📊"],
                  ]).map(([value, label, icon]) => (
                <button
                  key={value}
                  style={s.card(decisionAnswers.acquisition === value)}
                  onClick={() => updateDecisionAnswer("acquisition", value)}
                >
                  <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
              3. MARCA Y MODELO
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 10 }}>
              {[
                ["si", "Sí, ya sé marca y modelo", "🏷️"],
                ["no", "No, solo sé el tipo de operación", "🧭"],
              ].map(([value, label, icon]) => (
                <button
                  key={value}
                  style={s.card(decisionAnswers.hasBrand === value)}
                  onClick={() => updateDecisionAnswer("hasBrand", value)}
                >
                  <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                </button>
              ))}
            </div>

            {decisionAnswers.hasBrand === "si" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Marca</div>
                  <select
                    value={decisionAnswers.brand}
                    onChange={(event) => updateDecisionAnswer("brand", event.target.value)}
                    style={s.select}
                  >
                    <option value="">Selecciona marca</option>
                    {Object.keys(MARKET_BRANDS).map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Modelo</div>
                  <select
                    value={decisionAnswers.model}
                    onChange={(event) => updateDecisionAnswer("model", event.target.value)}
                    disabled={!decisionAnswers.brand}
                    style={{
                      ...s.select,
                      opacity: decisionAnswers.brand ? 1 : 0.55,
                    }}
                  >
                    <option value="">Selecciona modelo</option>
                    {decisionModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Vehículo</div>
              <select
                value={decisionAnswers.condition}
                onChange={(event) => updateDecisionAnswer("condition", event.target.value)}
                style={s.select}
              >
                <option value="">Nuevo u ocasión</option>
                <option value="nuevo">Nuevo</option>
                <option value="seminuevo">Seminuevo</option>
                <option value="ocasion">Ocasión</option>
              </select>
            </div>
            {needsMonthlyBudget && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Cuota objetivo</div>
                <select
                  value={decisionAnswers.monthlyBudget}
                  onChange={(event) => updateDecisionAnswer("monthlyBudget", event.target.value)}
                  style={s.select}
                >
                  <option value="">Presupuesto mensual</option>
                  {MONTHLY_BUDGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsCashBudget && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Presupuesto total</div>
                <select
                  value={decisionAnswers.cashBudget}
                  onChange={(event) => updateDecisionAnswer("cashBudget", event.target.value)}
                  style={s.select}
                >
                  <option value="">Importe total de compra</option>
                  {TOTAL_PURCHASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsFinanceAmount && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                  {decisionAnswers.acquisition === "mixto" ? "Importe a financiar" : "Cuánto necesitas financiar"}
                </div>
                <select
                  value={decisionAnswers.financeAmount}
                  onChange={(event) => updateDecisionAnswer("financeAmount", event.target.value)}
                  style={s.select}
                >
                  <option value="">Selecciona importe a financiar</option>
                  {FINANCE_AMOUNT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsEntryAmount && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Entrada disponible</div>
                <select
                  value={decisionAnswers.entryAmount}
                  onChange={(event) => updateDecisionAnswer("entryAmount", event.target.value)}
                  style={s.select}
                >
                  <option value="">Selecciona la entrada</option>
                  {ENTRY_AMOUNT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {decisionAnswers.hasBrand === "si" && (
              <>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Antigüedad máxima</div>
                  <select
                    value={decisionAnswers.ageFilter}
                    onChange={(event) => updateDecisionAnswer("ageFilter", event.target.value)}
                    style={s.select}
                  >
                    {AGE_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Kilometraje máximo</div>
                  <select
                    value={decisionAnswers.mileageFilter}
                    onChange={(event) => updateDecisionAnswer("mileageFilter", event.target.value)}
                    style={s.select}
                  >
                    {MILEAGE_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "financiado" && decisionAnswers.financeAmount && (
            <div
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.18)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, color: "#c4b5fd", letterSpacing: "0.6px", marginBottom: 6 }}>
                ESTIMACIÓN DE CUOTA
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f3ff", marginBottom: 6 }}>
                ~{estimatedFinanceMonthly} €/mes
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                Estimación orientativa para una financiación a 72 meses con un coste financiero aproximado del 8,99% TIN.
              </p>
            </div>
          )}

          {decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "mixto" && decisionAnswers.entryAmount && decisionAnswers.financeAmount && (
            <div
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.18)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, color: "#c4b5fd", letterSpacing: "0.6px", marginBottom: 6 }}>
                ESTIMACIÓN DE CUOTA CON ENTRADA
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f3ff", marginBottom: 6 }}>
                ~{estimatedMixedMonthly} €/mes
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                Con una entrada de {ENTRY_AMOUNT_OPTIONS.find((option) => option.value === decisionAnswers.entryAmount)?.label || "0 €"} y el importe a financiar seleccionado.
              </p>
            </div>
          )}

          {decisionFlowReady ? (
            <div
              style={{
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(37,99,235,0.18)",
                borderRadius: 14,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 8 }}>
                SIGUIENTE PASO DEL FLUJO
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                {decisionAnswers.hasBrand === "si"
                  ? `Buscar la mejor oferta para ${decisionAnswers.brand} ${decisionAnswers.model}`
                  : "Comparar las mejores opciones del mercado para tu operación"}
              </div>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                Con esto ya podemos pedir a la IA que priorice las opciones con mejor relación valor/precio,
                riesgo y encaje con tu modalidad de compra o renting.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button
                  onClick={analyzeDecisionWithAI}
                  disabled={decisionLoading}
                  style={{
                    ...s.btn,
                    padding: "10px 16px",
                    fontSize: 13,
                    opacity: decisionLoading ? 0.7 : 1,
                  }}
                >
                  {decisionLoading ? "Analizando con IA..." : "🤖 Analizar operación con IA"}
                </button>
                <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
                  La IA te devolverá una recomendación principal y un único anuncio real para abrir.
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 18 }}>
              Completa al menos la operación, la modalidad y si ya tienes clara la marca/modelo.
            </p>
          )}

          {decisionError && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
                color: "#fecaca",
                fontSize: 12,
              }}
            >
              {decisionError}
            </div>
          )}

          {decisionLoading && (
            <div style={{ ...s.panel, marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                IA ANALIZANDO LA OPERACIÓN
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                Cruzando modalidad, presupuesto, estado, financiación y riesgo para devolverte la mejor recomendación.
              </div>
            </div>
          )}

          {decisionAiResult && (
            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              <div style={s.panel}>
                <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                  RECOMENDACIÓN IA PARA ESTA OPERACIÓN
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
                  {decisionAiResult.oferta_top.titulo}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  {decisionAiResult.resumen}
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  {decisionAiResult.oferta_top.precio_objetivo && (
                    <span style={{ background: "rgba(37,99,235,0.14)", border: "1px solid rgba(96,165,250,0.22)", color: "#dbeafe", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      Precio objetivo: {decisionAiResult.oferta_top.precio_objetivo}
                    </span>
                  )}
                  {decisionAiResult.oferta_top.cuota_estimada && (
                    <span style={{ background: "rgba(5,150,105,0.14)", border: "1px solid rgba(52,211,153,0.22)", color: "#d1fae5", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      Cuota estimada: {decisionAiResult.oferta_top.cuota_estimada}
                    </span>
                  )}
                  {decisionAiResult.oferta_top.riesgo && (
                    <span style={{ background: "rgba(245,158,11,0.14)", border: "1px solid rgba(251,191,36,0.22)", color: "#fde68a", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      Riesgo: {decisionAiResult.oferta_top.riesgo}
                    </span>
                  )}
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  <strong>Criterio principal:</strong> {decisionAiResult.criterio_principal}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  {decisionAiResult.oferta_top.razon}
                </p>
              </div>

              <div style={s.panel}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => searchDecisionListing(decisionAiResult)}
                    disabled={decisionListingLoading}
                    style={{
                      ...s.btn,
                      padding: "10px 16px",
                      fontSize: 13,
                      opacity: decisionListingLoading ? 0.7 : 1,
                    }}
                  >
                    {decisionListingLoading ? "Buscando anuncio real..." : "🔎 Ver anuncio real recomendado"}
                  </button>
                  <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
                    Te mostramos una única opción real para entrar directamente en el anuncio.
                  </span>
                </div>

                {decisionListingError && (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.18)",
                      borderRadius: 12,
                      padding: 12,
                      color: "#fecaca",
                      fontSize: 12,
                    }}
                  >
                    {decisionListingError}
                  </div>
                )}

                {decisionListingResult && (
                  <div
                    style={{
                      background: "rgba(2,6,23,0.42)",
                      border: "1px solid rgba(96,165,250,0.22)",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
                      {decisionListingResult.listingType === "renting" ? "📅 OFERTA REAL RECOMENDADA" : "🚗 ANUNCIO REAL RECOMENDADO"}
                      {Number.isFinite(Number(decisionListingResult.rankingScore ?? decisionListingResult.profileScore)) ? ` · ENCAJE ${Number(decisionListingResult.rankingScore ?? decisionListingResult.profileScore)}/100` : ""}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                          {decisionListingResult.title}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                          {decisionListingResult.description || "Opción real localizada para esta operación."}
                        </p>
                      </div>
                      {decisionListingResult.price && (
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>
                          {decisionListingResult.price}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={decisionListingResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "linear-gradient(135deg,#10b981,#059669)",
                          color: "white",
                          textDecoration: "none",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Abrir anuncio ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {(decisionAiResult.alertas.length > 0 || decisionAiResult.siguiente_paso) && (
                <div style={s.panel}>
                  {decisionAiResult.alertas.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 6, letterSpacing: "0.6px" }}>
                        ALERTAS A REVISAR
                      </div>
                      <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
                        {decisionAiResult.alertas.map((alerta) => (
                          <div key={alerta} style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.5 }}>• {alerta}</div>
                        ))}
                      </div>
                    </>
                  )}
                  {decisionAiResult.siguiente_paso && (
                    <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                      <strong>Siguiente paso:</strong> {decisionAiResult.siguiente_paso}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!decisionAiResult && rankedOffers.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 10 }}>
                VISTA RÁPIDA DE MERCADO
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {rankedOffers.slice(0, 1).map((offer, index) => (
                  <div key={offer.id} style={s.panel}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 4 }}>
                          #{index + 1} EN EL MERCADO ACTUAL · SCORE {offer.score}/100
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
                          {offer.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                          {offer.seller} · {offer.age} años · {offer.mileage.toLocaleString("es-ES")} km
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 21, fontWeight: 800, color: "#f1f5f9" }}>
                          {formatCurrency(offer.price)}
                        </div>
                        {offer.monthly ? (
                          <div style={{ fontSize: 12, color: "#60a5fa", marginTop: 4 }}>
                            ~{offer.monthly} €/mes
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#60a5fa", marginTop: 4 }}>
                            Compra directa
                          </div>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      {offer.insight}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setEntryMode("consejo");
                setStep(0);
              }}
              style={s.btn}
            >
              Cambiar al flujo de decisión →
            </button>
            <button
              onClick={restart}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {step === -1 && entryMode === "portalVoDetail" && selectedPortalVoOffer && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Vinculación"), marginBottom: 10 }}>🚗 FICHA DEL VEHÍCULO</div>
          <div style={{ ...s.panel, marginBottom: 18, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: "#67e8f9", fontWeight: 800, letterSpacing: "0.6px", marginBottom: 4 }}>
                  DETALLE DEL VEHÍCULO VO
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>{selectedPortalVoOffer.title}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("portalVo");
                    if (typeof window !== "undefined") {
                      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
                    }
                  }}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#cbd5e1",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ← Volver al marketplace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("");
                    setSelectedPortalVoOfferId(null);
                    setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
                    setStep(-1);
                    if (typeof window !== "undefined") {
                      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
                    }
                  }}
                  style={{
                    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                    border: "none",
                    color: "#ffffff",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  ⌂ Volver al inicio
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.16)", background: "rgba(2,6,23,0.45)" }}>
                <ResolvedOfferImage
                  offer={selectedPortalVoOffer}
                  alt={selectedPortalVoOffer.title}
                  style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={getOfferBadgeStyle(selectedPortalVoOffer.hasGuaranteeSeal ? "green" : "slate")}>
                    {selectedPortalVoOffer.hasGuaranteeSeal ? `Garantía ${selectedPortalVoOffer.warrantyMonths} meses` : "Publicado por usuario"}
                  </span>
                  <span style={getOfferBadgeStyle("slate")}>{getPortalVoEcoLabel(selectedPortalVoOffer)}</span>
                  <span style={getOfferBadgeStyle("slate")}>{selectedPortalVoOffer.color}</span>
                </div>

                <div style={{ fontSize: 28, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                  {formatCurrency(selectedPortalVoOffer.price)}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#dbeafe", lineHeight: 1.7 }}>
                  {selectedPortalVoOffer.description} Unidad ubicada en {selectedPortalVoOffer.location}, con
                  {` ${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`} y motorización
                  {` ${selectedPortalVoOffer.fuel.toLowerCase()}${selectedPortalVoOffer.power ? ` de ${selectedPortalVoOffer.power}` : ""}` }.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                  {[
                    ["Año", selectedPortalVoOffer.year],
                    ["Kilómetros", `${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`],
                    ["Combustible", selectedPortalVoOffer.fuel],
                    ["Potencia", selectedPortalVoOffer.power],
                    ["Cambio", getPortalVoTransmission(selectedPortalVoOffer)],
                    ["Cilindrada", selectedPortalVoOffer.displacement > 0 ? `${selectedPortalVoOffer.displacement.toLocaleString("es-ES")} cc` : "EV"],
                    ["Ubicación", selectedPortalVoOffer.location],
                    ["Vendedor", selectedPortalVoOffer.seller],
                  ].map(([label, value]) => (
                    <div
                      key={`${selectedPortalVoOffer.id}-${label}`}
                      style={{
                        background: "rgba(15,23,42,0.34)",
                        border: "1px solid rgba(148,163,184,0.14)",
                        borderRadius: 12,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#93c5fd", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 16 }}>
              <div style={{ background: "rgba(15,23,42,0.3)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, marginBottom: 8 }}>PUNTOS CLAVE</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#dbeafe", fontSize: 12, lineHeight: 1.7 }}>
                  {buildPortalVoHighlights(selectedPortalVoOffer).map((item) => (
                    <li key={`${selectedPortalVoOffer.id}-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div style={{ background: "rgba(15,23,42,0.3)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, marginBottom: 8 }}>CARACTERÍSTICAS / EQUIPAMIENTO</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {buildPortalVoEquipment(selectedPortalVoOffer).map((item) => (
                    <span key={`${selectedPortalVoOffer.id}-feature-${item}`} style={getOfferBadgeStyle("slate")}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {relatedPortalVoOffers.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 700, marginBottom: 8 }}>OTRAS UNIDADES RELACIONADAS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                  {relatedPortalVoOffers.map((offer) => (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => openPortalVoOfferDetail(offer)}
                      style={{
                        textAlign: "left",
                        background: "rgba(15,23,42,0.28)",
                        border: "1px solid rgba(148,163,184,0.14)",
                        borderRadius: 12,
                        padding: 12,
                        cursor: "pointer",
                        color: "inherit",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{offer.title}</div>
                      <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>{offer.year} · {offer.location}</div>
                      <div style={{ fontSize: 13, color: "#34d399", fontWeight: 800 }}>{formatCurrency(offer.price)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === -1 && entryMode === "portalVo" && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Vinculación"), marginBottom: 10 }}>🏪 MARKETPLACE VO DEL PORTAL</div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Ofertas VO únicas de nuestro portal
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>
            Aquí ves un escaparate con vehículos publicados por usuarios del portal. Arriba priorizamos
            las unidades con mejor puntuación y <strong>sello de garantía MoveAdvisor</strong>.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 20px" }}>
            <button
              type="button"
              onClick={() => {
                setEntryMode("");
                setSelectedPortalVoOfferId(null);
                setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
                setStep(-1);
                if (typeof window !== "undefined") {
                  setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
                }
              }}
              style={{
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                border: "none",
                color: "#ffffff",
                padding: "11px 16px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(37,99,235,0.18)",
              }}
            >
              ⌂ Volver al home
            </button>
          </div>

          {selectedPortalVoOffer && entryMode === "portalVoDetail" && (
            <div style={{ ...s.panel, marginBottom: 18, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#67e8f9", fontWeight: 800, letterSpacing: "0.6px", marginBottom: 4 }}>
                    FICHA DEL VEHÍCULO
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>{selectedPortalVoOffer.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPortalVoOfferId(null)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#cbd5e1",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ← Volver al marketplace
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
                <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.16)", background: "rgba(2,6,23,0.45)" }}>
                  <ResolvedOfferImage
                    offer={selectedPortalVoOffer}
                    alt={selectedPortalVoOffer.title}
                    style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={getOfferBadgeStyle(selectedPortalVoOffer.hasGuaranteeSeal ? "green" : "slate")}>
                      {selectedPortalVoOffer.hasGuaranteeSeal ? `Garantía ${selectedPortalVoOffer.warrantyMonths} meses` : "Publicado por usuario"}
                    </span>
                    <span style={getOfferBadgeStyle("slate")}>{getPortalVoEcoLabel(selectedPortalVoOffer)}</span>
                    <span style={getOfferBadgeStyle("slate")}>{selectedPortalVoOffer.color}</span>
                  </div>

                  <div style={{ fontSize: 28, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                    {formatCurrency(selectedPortalVoOffer.price)}
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#dbeafe", lineHeight: 1.7 }}>
                    {selectedPortalVoOffer.description} Unidad ubicada en {selectedPortalVoOffer.location}, con
                    {` ${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`} y motorización
                    {` ${selectedPortalVoOffer.fuel.toLowerCase()} ${selectedPortalVoOffer.power ? `de ${selectedPortalVoOffer.power}` : ""}` }.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                    {[
                      ["Año", selectedPortalVoOffer.year],
                      ["Kilómetros", `${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`],
                      ["Combustible", selectedPortalVoOffer.fuel],
                      ["Potencia", selectedPortalVoOffer.power],
                      ["Cambio", getPortalVoTransmission(selectedPortalVoOffer)],
                      ["Cilindrada", selectedPortalVoOffer.displacement > 0 ? `${selectedPortalVoOffer.displacement.toLocaleString("es-ES")} cc` : "EV"],
                      ["Ubicación", selectedPortalVoOffer.location],
                      ["Vendedor", selectedPortalVoOffer.seller],
                    ].map(([label, value]) => (
                      <div
                        key={`${selectedPortalVoOffer.id}-${label}`}
                        style={{
                          background: "rgba(15,23,42,0.34)",
                          border: "1px solid rgba(148,163,184,0.14)",
                          borderRadius: 12,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ fontSize: 10, color: "#93c5fd", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 16 }}>
                <div style={{ background: "rgba(15,23,42,0.3)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, marginBottom: 8 }}>PUNTOS CLAVE</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#dbeafe", fontSize: 12, lineHeight: 1.7 }}>
                    {buildPortalVoHighlights(selectedPortalVoOffer).map((item) => (
                      <li key={`${selectedPortalVoOffer.id}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ background: "rgba(15,23,42,0.3)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, marginBottom: 8 }}>CARACTERÍSTICAS / EQUIPAMIENTO</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {buildPortalVoEquipment(selectedPortalVoOffer).map((item) => (
                      <span key={`${selectedPortalVoOffer.id}-feature-${item}`} style={getOfferBadgeStyle("slate")}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {relatedPortalVoOffers.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 700, marginBottom: 8 }}>OTRAS UNIDADES RELACIONADAS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                    {relatedPortalVoOffers.map((offer) => (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => openPortalVoOfferDetail(offer)}
                        style={{
                          textAlign: "left",
                          background: "rgba(15,23,42,0.28)",
                          border: "1px solid rgba(148,163,184,0.14)",
                          borderRadius: 12,
                          padding: 12,
                          cursor: "pointer",
                          color: "inherit",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{offer.title}</div>
                        <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>{offer.year} · {offer.location}</div>
                        <div style={{ fontSize: 13, color: "#34d399", fontWeight: 800 }}>{formatCurrency(offer.price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ ...s.panel, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 10, letterSpacing: "0.6px" }}>
              FILTROS DEL MARKETPLACE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
              <input
                value={portalVoFilters.query}
                onChange={(event) => updatePortalVoFilter("query", event.target.value)}
                placeholder="Marca, modelo o versión"
                style={s.input}
              />
              <select
                value={portalVoFilters.maxPrice}
                onChange={(event) => updatePortalVoFilter("maxPrice", event.target.value)}
                style={s.select}
              >
                <option value="">Precio máximo</option>
                <option value="15000">Hasta 15.000 €</option>
                <option value="20000">Hasta 20.000 €</option>
                <option value="25000">Hasta 25.000 €</option>
                <option value="30000">Hasta 30.000 €</option>
                <option value="40000">Hasta 40.000 €</option>
              </select>
              <select
                value={portalVoFilters.minYear}
                onChange={(event) => updatePortalVoFilter("minYear", event.target.value)}
                style={s.select}
              >
                <option value="">Año mínimo</option>
                {[2024, 2023, 2022, 2021, 2020, 2019].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={portalVoFilters.maxMileage}
                onChange={(event) => updatePortalVoFilter("maxMileage", event.target.value)}
                style={s.select}
              >
                <option value="">Kilometraje máximo</option>
                <option value="20000">Hasta 20.000 km</option>
                <option value="40000">Hasta 40.000 km</option>
                <option value="60000">Hasta 60.000 km</option>
                <option value="80000">Hasta 80.000 km</option>
                <option value="120000">Hasta 120.000 km</option>
              </select>
              <select
                value={portalVoFilters.location}
                onChange={(event) => updatePortalVoFilter("location", event.target.value)}
                style={s.select}
              >
                <option value="">Ubicación</option>
                {portalVoLocations.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
              <select
                value={portalVoFilters.color}
                onChange={(event) => updatePortalVoFilter("color", event.target.value)}
                style={s.select}
              >
                <option value="">Color</option>
                {portalVoColors.map((color) => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
              <select
                value={portalVoFilters.displacement}
                onChange={(event) => updatePortalVoFilter("displacement", event.target.value)}
                style={s.select}
              >
                <option value="">Cilindrada</option>
                <option value="electric">Eléctrico / sin cilindrada</option>
                <option value="0_1200">Hasta 1.200 cc</option>
                <option value="1200_1600">1.200 - 1.600 cc</option>
                <option value="1600_2000">1.600 - 2.000 cc</option>
                <option value="2000_plus">Más de 2.000 cc</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, color: "#dbeafe", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={portalVoFilters.onlyGuaranteed}
                  onChange={(event) => updatePortalVoFilter("onlyGuaranteed", event.target.checked)}
                />
                Solo con sello de garantía
              </label>
              <button
                type="button"
                onClick={() => setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#cbd5e1",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 8, fontWeight: 800, letterSpacing: "0.6px" }}>
              ⭐ MEJOR PUNTUADOS CON SELLO MOVEADVISOR
            </div>
            {featuredPortalVoOffers.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
                {featuredPortalVoOffers.map((offer) => (
                  <div
                    key={offer.id}
                    onClick={() => openPortalVoOfferDetail(offer)}
                    title="Ver ficha completa"
                    style={{
                      position: "relative",
                      background: "linear-gradient(135deg,rgba(22,163,74,0.16),rgba(16,185,129,0.08) 45%,rgba(5,150,105,0.16))",
                      border: "1px solid rgba(74,222,128,0.55)",
                      boxShadow: "0 10px 28px rgba(22,163,74,0.14)",
                      borderRadius: 14,
                      overflow: "hidden",
                      cursor: "pointer",
                      animation: "portalGlowGreen 2.6s ease-in-out infinite",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(120deg,transparent 0%,rgba(187,247,208,0.04) 35%,rgba(74,222,128,0.18) 50%,transparent 65%)",
                        transform: "translateX(-120%)",
                        animation: "portalShine 3.4s linear infinite",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <ResolvedOfferImage
                        offer={offer}
                        alt={offer.title}
                        style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
                      />
                    </div>
                    <div style={{ padding: 12, position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{offer.title}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#6ee7b7" }}>{offer.portalScore}/100</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={getOfferBadgeStyle("success")}>Sello de garantía</span>
                        <span style={getOfferBadgeStyle("info")}>{offer.warrantyMonths} meses</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                        {formatCurrency(offer.price)}
                      </div>
                      <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6 }}>
                        {offer.year} · {Number(offer.mileage).toLocaleString("es-ES")} km · {offer.location}
                      </div>
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#dbeafe", lineHeight: 1.6 }}>
                        {offer.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={s.panel}>No hay vehículos con sello para esos filtros ahora mismo.</div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 800, letterSpacing: "0.6px" }}>
                🚗 TODAS LAS OFERTAS DEL PORTAL
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>{filteredPortalVoOffers.length} resultados</div>
            </div>

            {filteredPortalVoOffers.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 }}>
                {filteredPortalVoOffers.map((offer) => (
                  <div
                    key={offer.id}
                    onClick={() => openPortalVoOfferDetail(offer)}
                    title="Ver ficha completa"
                    style={{
                      background: "rgba(15,23,42,0.34)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      borderRadius: 14,
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    <ResolvedOfferImage
                      offer={offer}
                      alt={offer.title}
                      style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
                    />
                    <div style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{offer.title}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#34d399" }}>{formatCurrency(offer.price)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={getOfferBadgeStyle(offer.hasGuaranteeSeal ? "success" : "neutral")}>
                          {offer.hasGuaranteeSeal ? "Garantía portal" : "Publicado por usuario"}
                        </span>
                        <span style={getOfferBadgeStyle("info")}>{offer.color}</span>
                        <span style={getOfferBadgeStyle("info")}>{offer.displacement > 0 ? `${offer.displacement.toLocaleString("es-ES")} cc` : "EV"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6 }}>
                        {offer.year} · {Number(offer.mileage).toLocaleString("es-ES")} km · {offer.location}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, marginTop: 4 }}>
                        {offer.fuel} · {offer.power} · vendedor: {offer.seller}
                      </div>
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>
                        {offer.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={s.panel}>
                No hemos encontrado resultados con esos filtros. Prueba a ampliar precio, kilometraje o ubicación.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={restart}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {step === -1 && entryMode === "sell" && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Pricing"), marginBottom: 10 }}>💶 VALORACIÓN DE VEHÍCULO</div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Calcula el precio de salida de tu coche
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
            La propuesta se alinea con un informe tipo Motoreto: precio medio, tendencia histórica,
            stock de coches similares y una horquilla de salida para publicar con criterio.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Marca</div>
              <select
                value={sellAnswers.brand}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, brand: event.target.value, model: "" }))}
                style={s.select}
              >
                <option value="">Selecciona marca</option>
                {Object.keys(MARKET_BRANDS).map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Modelo</div>
              <select
                value={sellAnswers.model}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, model: event.target.value }))}
                disabled={!sellAnswers.brand}
                style={{ ...s.select, opacity: sellAnswers.brand ? 1 : 0.55 }}
              >
                <option value="">Selecciona modelo</option>
                {sellModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Año</div>
              <select
                value={sellAnswers.year}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, year: event.target.value }))}
                style={s.select}
              >
                <option value="">Selecciona año</option>
                {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Kilometraje</div>
              <select
                value={sellAnswers.mileage}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, mileage: event.target.value }))}
                style={s.select}
              >
                <option value="">Selecciona kilometraje</option>
                <option value="20000">Hasta 20.000 km</option>
                <option value="50000">20.000 - 50.000 km</option>
                <option value="80000">50.000 - 80.000 km</option>
                <option value="120000">80.000 - 120.000 km</option>
                <option value="160000">Más de 120.000 km</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Combustible</div>
              <select
                value={sellAnswers.fuel}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, fuel: event.target.value }))}
                style={s.select}
              >
                {SELL_FUEL_OPTIONS.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {fuel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Canal de venta</div>
              <select
                value={sellAnswers.sellerType}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, sellerType: event.target.value }))}
                style={s.select}
              >
                <option value="particular">Particular</option>
                <option value="profesional">Profesional</option>
                <option value="entrega">Entrega en concesionario</option>
              </select>
            </div>
          </div>

          {sellAnswers.brand && sellAnswers.model && sellAnswers.year && sellAnswers.mileage && (
            <div
              style={{
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(37,99,235,0.18)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 8 }}>
                VALORACIÓN CON IA
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={analyzeSellWithAI}
                  disabled={sellLoading}
                  style={{
                    ...s.btn,
                    padding: "10px 16px",
                    fontSize: 13,
                    opacity: sellLoading ? 0.7 : 1,
                  }}
                >
                  {sellLoading ? "Valorando con IA..." : "🤖 Valorar coche con IA"}
                </button>
                <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
                  La IA te devolverá la valoración y un anuncio comparable real para revisar.
                </span>
              </div>
            </div>
          )}

          {sellError && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
                color: "#fecaca",
                fontSize: 12,
              }}
            >
              {sellError}
            </div>
          )}

          {sellAiResult && (
            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              <div style={s.panel}>
                <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6, letterSpacing: "0.6px" }}>
                  PRECIO OBJETIVO IA
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
                  {sellAiResult.precio_objetivo}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Rango razonable entre {sellAiResult.rango_publicacion.min} y {sellAiResult.rango_publicacion.max}.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                <div style={s.panel}>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                    DEMANDA ESTIMADA
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{sellAiResult.nivel_demanda || "Media"}</div>
                </div>
                <div style={s.panel}>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                    TIEMPO ESTIMADO DE VENTA
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{sellAiResult.tiempo_estimado_venta || "Depende del precio y la demanda"}</div>
                </div>
              </div>

              <div style={s.panel}>
                <div style={{ fontSize: 11, color: "#34d399", marginBottom: 6, letterSpacing: "0.6px" }}>
                  RESUMEN DEL INFORME IA
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                  {sellAiResult.resumen}
                </p>
                {sellAiResult.argumentos_clave.length > 0 && (
                  <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
                    {sellAiResult.argumentos_clave.map((item) => (
                      <div key={item} style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>• {item}</div>
                    ))}
                  </div>
                )}
                {sellAiResult.alertas.length > 0 && (
                  <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
                    {sellAiResult.alertas.map((item) => (
                      <div key={item} style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.5 }}>• {item}</div>
                    ))}
                  </div>
                )}
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  <strong>Estrategia:</strong> {sellAiResult.estrategia_publicacion}
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={searchSellComparableListing}
                    disabled={sellListingLoading}
                    style={{
                      ...s.btn,
                      padding: "10px 16px",
                      fontSize: 13,
                      opacity: sellListingLoading ? 0.7 : 1,
                    }}
                  >
                    {sellListingLoading ? "Buscando comparable..." : "🔎 Ver anuncio comparable real"}
                  </button>
                  <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
                    Te mostramos un único anuncio comparable del mercado para contrastar el precio.
                  </span>
                </div>

                {sellListingError && (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.18)",
                      borderRadius: 12,
                      padding: 12,
                      color: "#fecaca",
                      fontSize: 12,
                      marginBottom: 10,
                    }}
                  >
                    {sellListingError}
                  </div>
                )}

                {sellListingResult && (
                  <div
                    style={{
                      background: "rgba(2,6,23,0.42)",
                      border: "1px solid rgba(96,165,250,0.22)",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
                      🚗 ANUNCIO COMPARABLE DE MERCADO
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                          {sellListingResult.title}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                          {sellListingResult.description || "Comparable real localizado para ayudarte a defender el precio de salida."}
                        </p>
                      </div>
                      {sellListingResult.price && (
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>
                          {sellListingResult.price}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={sellListingResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "linear-gradient(135deg,#10b981,#059669)",
                          color: "white",
                          textDecoration: "none",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Abrir anuncio ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!sellAiResult && sellEstimate && (
            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              <div style={s.panel}>
                <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6, letterSpacing: "0.6px" }}>
                  PREVIEW LOCAL DE PRECIO
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
                  {formatCurrency(sellEstimate.targetPrice)}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Rango orientativo entre {formatCurrency(sellEstimate.lowPrice)} y {formatCurrency(sellEstimate.highPrice)} mientras lanzas la valoración con IA.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={restart} style={s.btn}>
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {/* ── QUESTIONS ── */}
      {entryMode === "consejo" && step >= 0 && step < totalSteps && currentStep && (
        <div style={s.center}>
          <div style={s.blockBadge(currentStep.block)}>
            {currentStep.blockIcon} {currentStep.block.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: "#334155", letterSpacing: "1px", marginBottom: 6 }}>
            PREGUNTA {step + 1} DE {totalSteps}
          </div>
          <h2
            style={{
              fontSize: "clamp(18px,4vw,26px)",
              fontWeight: 700,
              letterSpacing: "-0.6px",
              margin: "0 0 8px",
              color: "#f1f5f9",
              lineHeight: 1.3,
            }}
          >
            {currentStep.question}
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
            {currentStep.subtitle}
          </p>

          <div
            style={{
              background: "rgba(20,184,166,0.08)",
              border: "1px solid rgba(20,184,166,0.22)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#99f6e4", fontWeight: 700, marginBottom: 4 }}>
                  🧪 Test avanzado opcional
                </div>
                <div style={{ fontSize: 12, color: "#ccfbf1", lineHeight: 1.5 }}>
                  {advancedMode
                    ? "Activado: añadimos preguntas de zona, ZBE, garaje, presupuesto cómodo, capital y riesgo para afinar la recomendación."
                    : "Puedes activar 6 preguntas extra para llevar el análisis a un nivel mucho más preciso sin tocar el flujo base."}
                </div>
              </div>
              <button
                type="button"
                onClick={toggleAdvancedMode}
                style={{
                  background: advancedMode ? "rgba(20,184,166,0.22)" : "rgba(37,99,235,0.18)",
                  border: `1px solid ${advancedMode ? "rgba(153,246,228,0.4)" : "rgba(147,197,253,0.35)"}`,
                  color: advancedMode ? "#ccfbf1" : "#dbeafe",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {advancedMode ? "✓ Modo avanzado activado" : "+ Activar test avanzado"}
              </button>
            </div>
          </div>

          <div
            style={{
              background: "rgba(14,165,233,0.08)",
              border: "1px solid rgba(14,165,233,0.2)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: "#bae6fd", fontWeight: 600 }}>
                ✅ Te quedan {remainingQuestions} pregunta{remainingQuestions === 1 ? "" : "s"}
              </div>
              <div style={{ fontSize: 12, color: "#7dd3fc" }}>
                {completionPct}% completado
              </div>
            </div>
            <div
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 4,
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${completionPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#22d3ee,#2563eb)",
                  transition: "width 0.35s ease",
                }}
              />
            </div>
          </div>

          {currentStep.options.map((opt) => {
            const selected =
              currentStep.type === "multi"
                ? multiSelected.includes(opt.value)
                : answers[currentStep.id] === opt.value;
            return (
              <button
                key={opt.value}
                style={s.card(selected)}
                onClick={() =>
                  currentStep.type === "multi"
                    ? handleMultiToggle(opt.value)
                    : handleSingle(opt.value)
                }
              >
                <span style={{ fontSize: 22, minWidth: 30 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: selected ? "#93c5fd" : "#e2e8f0",
                    }}
                  >
                    {opt.label}
                  </div>
                  {opt.desc && (
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{opt.desc}</div>
                  )}
                  {Array.isArray(opt.brandChips) && opt.brandChips.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {opt.brandChips.map((chip) => {
                        const logo = BRAND_LOGOS[chip.label];
                        const LogoIcon = logo?.icon;

                        return (
                          <span
                            key={`${opt.value}-${chip.short}`}
                            title={chip.label || chip.short}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.2px",
                              color: "#f8fafc",
                              background: logo?.color || chip.tone || "#334155",
                              border: "1px solid rgba(255,255,255,0.18)",
                            }}
                          >
                            {LogoIcon ? <LogoIcon size={14} /> : chip.short}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selected && (
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      background: "#2563EB",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}

          {currentStep.type === "multi" && (
            <button
              onClick={handleMultiNext}
              disabled={multiSelected.length === 0}
              style={{
                ...s.btn,
                width: "100%",
                marginTop: 14,
                opacity: multiSelected.length === 0 ? 0.35 : 1,
              }}
            >
              {multiSelected.length === 0
                ? "Selecciona al menos una opción"
                : `Continuar (${multiSelected.length} seleccionada${multiSelected.length > 1 ? "s" : ""}) →`}
            </button>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={goToPreviousStep}
              disabled={step === 0}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#cbd5e1",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12,
                cursor: step === 0 ? "not-allowed" : "pointer",
                opacity: step === 0 ? 0.45 : 1,
              }}
            >
              ← Volver a la pregunta anterior
            </button>

            <button
              onClick={restartQuestionnaire}
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#fecaca",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ↺ Reiniciar preguntas
            </button>

            <button
              onClick={handleTellMeNow}
              disabled={answeredSteps === 0}
              style={{
                background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
                border: "none",
                color: "white",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: answeredSteps === 0 ? "not-allowed" : "pointer",
                opacity: answeredSteps === 0 ? 0.45 : 1,
              }}
            >
              ⚡ ¡Dímelo ya!
            </button>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {step === 99 && loading && (
        <div style={{ ...s.center, textAlign: "center" }}>
          {/* Animated brain */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              background: "linear-gradient(135deg,#2563EB,#059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              margin: "0 auto 28px",
              boxShadow: "0 0 40px rgba(37,99,235,0.3)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            🧠
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.5px" }}>
            Analizando tu perfil de movilidad
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>
            Aplicando el marco de decisión estructurado a tus respuestas
          </p>

          {/* Phase indicator */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "14px 20px",
              marginBottom: 28,
              minHeight: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 16 }}>⚙️</span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>{loadingTexts[loadingPhase]}</span>
          </div>

          {/* Steps checklist */}
          <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto 32px" }}>
            {[
              "Mundo del deseo analizado",
              "Mundo de la realidad analizado",
              "Tensiones activas detectadas",
              "Zona de intersección calculada",
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                  opacity: loadingPhase > i ? 1 : 0.3,
                  transition: "opacity 0.5s",
                }}
              >
                <span style={{ color: loadingPhase > i ? "#34d399" : "#475569", fontSize: 14 }}>
                  {loadingPhase > i ? "✓" : "○"}
                </span>
                <span style={{ fontSize: 13, color: loadingPhase > i ? "#94a3b8" : "#334155" }}>
                  {item}
                </span>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#2563EB",
                  animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── API KEY MISSING ── */}
      {apiKeyMissing && (
        <div style={{ ...s.center, textAlign: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              margin: "0 auto 24px",
            }}
          >
            🔑
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.5px" }}>
            Falta la API Key de Gemini
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 28px" }}>
            El análisis de IA está listo pero necesita tu clave de API para funcionar. Hemos procesado
            correctamente tus {totalSteps} respuestas — solo falta conectar el motor de inteligencia artificial.
          </p>

          {/* Instruction box */}
          <div
            style={{
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 14,
              padding: 24,
              textAlign: "left",
              marginBottom: 24,
              maxWidth: 480,
              margin: "0 auto 24px",
            }}
          >
            <div
              style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600, marginBottom: 12, letterSpacing: "0.6px" }}
            >
              📋 CÓMO CONFIGURARLO
            </div>
            {[
              { step: "1", text: "Ve a aistudio.google.com/apikey y crea una API Key" },
              { step: "2", text: "En local, crea un archivo .env.local en la raíz del proyecto" },
              { step: "3", text: 'Escribe GEMINI_API_KEY="AIza..." dentro del archivo' },
              { step: "4", text: "Reinicia npm start y vuelve a intentarlo" },
            ].map(({ step: n, text }) => (
              <div
                key={n}
                style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(245,158,11,0.2)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fbbf24",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {n}
                </div>
                <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Code snippet */}
          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "12px 18px",
              fontFamily: "monospace",
              fontSize: 12,
              color: "#7dd3fc",
              textAlign: "left",
              marginBottom: 28,
              maxWidth: 480,
              margin: "0 auto 28px",
              overflowX: "auto",
            }}
          >
            <span style={{ color: "#475569" }}>{"Variable local (.env.local)"}</span>
            <br />
            <span style={{ color: "#e2e8f0" }}>GEMINI_API_KEY</span>{" "}
            <span style={{ color: "#60a5fa" }}>= </span>
            <span style={{ color: "#34d399" }}>"AIza..."</span>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={restart}
              style={{
                ...s.btn,
              }}
            >
              🔄 Repetir el análisis
            </button>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "12px 22px",
                borderRadius: 10,
                fontSize: 14,
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🔑 Obtener API Key de Gemini
            </a>
          </div>

          {/* Summary of answers */}
          <div
            style={{
              marginTop: 40,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: 20,
              textAlign: "left",
              maxWidth: 480,
              margin: "40px auto 0",
            }}
          >
            <div
              style={{ fontSize: 11, color: "#475569", fontWeight: 600, marginBottom: 12, letterSpacing: "0.6px" }}
            >
              ✅ TUS {totalSteps} RESPUESTAS ESTÁN GUARDADAS
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px 16px",
              }}
            >
              {STEPS.slice(0, 8).map((s) => {
                const val = answers[s.id];
                if (!val) return null;
                const display = Array.isArray(val) ? val.join(", ") : val;
                return (
                  <div key={s.id} style={{ fontSize: 11 }}>
                    <span style={{ color: "#334155" }}>{s.blockIcon} </span>
                    <span style={{ color: "#60a5fa" }}>{display}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {result &&
        (() => {
          const displayResult = sanitizeResultForDisplay(result);
          const mt =
            MOBILITY_TYPES[result.solucion_principal?.tipo] || {
              label: "Movilidad",
              icon: "🚗",
              color: "#2563EB",
            };
          const solutionType = result.solucion_principal?.tipo;
          const isBuyOrFinanceOutcome = ["compra_contado", "compra_financiada"].includes(
            solutionType
          );
          const isRentingOutcome = ["renting_largo", "renting_corto"].includes(solutionType);
          const isFlexibleMobilityOutcome = ["rent_a_car", "carsharing"].includes(solutionType);
          const shouldShowChargingChecklist =
            (isBuyOrFinanceOutcome || isRentingOutcome) &&
            ((result.solucion_principal?.etiqueta_dgt === "CERO") ||
              (result.propulsiones_viables || []).some((p) => /(electric|electri|phev|enchuf)/i.test(String(p))));
          const listingModeLabel = isRentingOutcome
            ? "renting"
            : isFlexibleMobilityOutcome
              ? "movilidad flexible"
              : "compra";
          const canSearchListing = Boolean(result);
          const quickValidationQuestions = getQuickValidationQuestions({
            shouldShowChargingChecklist,
            isBuyOrFinanceOutcome,
            isRentingOutcome,
          });
          const scoreBreakdown = displayResult.score_desglose || {};
          const whyThisWins = Array.isArray(displayResult.por_que_gana)
            ? displayResult.por_que_gana.slice(0, 4)
            : [];
          const tcoDetail = displayResult.tco_detalle || {};
          const comparatorRows = Array.isArray(displayResult.comparador_final)
            ? displayResult.comparador_final.slice(0, 4)
            : [];
          const transparency = displayResult.transparencia || {};
          const transparencyAssumptions = Array.isArray(transparency.supuestos_clave)
            ? transparency.supuestos_clave.slice(0, 4)
            : [];
          const transparencyChecks = Array.isArray(transparency.validaciones_pendientes)
            ? transparency.validaciones_pendientes.slice(0, 4)
            : [];
          const confidenceLevel = normalizeText(transparency.confianza_nivel || "").toLowerCase();
          const confidenceLabel = confidenceLevel
            ? ` · CONFIANZA ${confidenceLevel.toUpperCase()}`
            : "";
          const actionPlan = displayResult.plan_accion || {};
          const actionSteps = Array.isArray(actionPlan.acciones)
            ? actionPlan.acciones.slice(0, 4)
            : [];
          const actionAlerts = Array.isArray(actionPlan.alertas_rojas)
            ? actionPlan.alertas_rojas.slice(0, 3)
            : [];
          const trafficLight = normalizeText(actionPlan.semaforo || "").toLowerCase();
          const trafficTone = trafficLight === "verde"
            ? { bg: "rgba(16,185,129,0.07)", border: "rgba(52,211,153,0.18)", text: "#6ee7b7", chip: "rgba(16,185,129,0.14)" }
            : trafficLight === "rojo"
              ? { bg: "rgba(239,68,68,0.07)", border: "rgba(248,113,113,0.18)", text: "#fca5a5", chip: "rgba(239,68,68,0.14)" }
              : { bg: "rgba(245,158,11,0.07)", border: "rgba(251,191,36,0.18)", text: "#fbbf24", chip: "rgba(245,158,11,0.14)" };
          const trafficLabel = trafficLight === "verde"
            ? "VERDE · PUEDES AVANZAR"
            : trafficLight === "rojo"
              ? "ROJO · PAUSA Y REVALIDA"
              : "ÁMBAR · COMPARA ANTES DE FIRMAR";
          const marketRadar = buildMarketRadarSnapshot(displayResult, listingResult, listingFilters);
          const savedComparisonItems = Array.isArray(savedComparisons)
            ? savedComparisons.slice(0, 3)
            : [];
          const realOfferCardsRaw = Array.isArray(listingOptions) && listingOptions.length > 0
            ? listingOptions.slice(0, 4)
            : listingResult
              ? [listingResult]
              : [];
          const realOfferCards = realOfferCardsRaw.map((offer) => {
            const directUrl = getOfferNavigationUrl(offer, displayResult);

            return {
              ...offer,
              image: normalizeOfferAssetUrl(offer?.image) || "",
              hasRealImage: hasOfferRealImage(offer),
              url: directUrl,
              searchUrl: !directUrl ? normalizeText(offer?.searchUrl || "") : "",
            };
          });
          const offerModelSuggestions = buildOfferModelSuggestions(answers, displayResult);
          const providerSpecificSeeds = normalizeStringArray(displayResult.solucion_principal?.empresas_recomendadas).map((company, index) => {
            const model = offerModelSuggestions[index % Math.max(offerModelSuggestions.length, 1)] || displayResult.solucion_principal?.titulo || `Opción ${index + 1}`;
            const providerName = resolveOfferProviderName(company);
            return {
              key: `company-${providerName}-${index}`,
              title: `${model} · ${isRentingOutcome || isFlexibleMobilityOutcome ? "referencia a validar en" : "unidad orientativa en"} ${providerName}`,
              source: providerName,
              description: `${displayResult.solucion_principal?.resumen || "Proveedor priorizado por la recomendación del test."} Modelo concreto priorizado: ${model}.`,
              rankingScore: Math.max(58, Number(displayResult.solucion_principal?.score || 70) - (index + 1) * 4),
              url: getOfferFallbackSearchUrl({ title: model, source: providerName, listingType: displayResult.solucion_principal?.tipo }, displayResult),
              reason:
                index === 0
                  ? `Queda arriba porque ${model} encaja especialmente bien con tu perfil y es una vía prioritaria en ${company}.`
                  : `Se mantiene como alternativa concreta con ${model} para comparar condiciones reales.`,
              signals: [`Modelo sugerido: ${model}`, "Proveedor priorizado por tu solución"],
            };
          });
          const syntheticOfferSeeds = [
            ...providerSpecificSeeds,
            ...(Array.isArray(displayResult.alternativas)
              ? displayResult.alternativas.map((alternative, index) => {
                  const model = offerModelSuggestions[(index + providerSpecificSeeds.length) % Math.max(offerModelSuggestions.length, 1)] || displayResult.solucion_principal?.titulo || `Alternativa ${index + 1}`;
                  const alternativeSource = alternative?.tipo
                    ? MOBILITY_TYPES[alternative.tipo]?.label || alternative.tipo
                    : "Mercado general";
                  return {
                    key: `alternative-${normalizeText(alternative?.titulo || alternative?.tipo || index)}-${index}`,
                    title: `${model} · ${alternative?.titulo || `Alternativa ${index + 1}`}`,
                    source: alternativeSource,
                    description:
                      alternative?.razon ||
                      `Ruta secundaria útil para comparar usando un modelo concreto como ${model}.`,
                    rankingScore: Math.max(54, 68 - index * 4),
                    url: getOfferFallbackSearchUrl({ title: model, source: alternativeSource, listingType: displayResult.solucion_principal?.tipo }, displayResult),
                    reason: `Se mantiene como vía complementaria #${index + 1} con el modelo ${model} para no depender de una sola opción.`,
                    signals: [`Modelo sugerido: ${model}`, `Alternativa ${index + 1}`],
                  };
                })
              : []),
          ];

          if (!syntheticOfferSeeds.length) {
            const primaryModel = offerModelSuggestions[0] || displayResult.solucion_principal?.titulo || "Toyota Corolla";
            const backupModel = offerModelSuggestions[1] || offerModelSuggestions[0] || "Kia Niro";
            syntheticOfferSeeds.push(
              {
                key: "generic-primary",
                title: `${primaryModel} · ${listingModeLabel} sugerido`,
                source:
                  MOBILITY_TYPES[displayResult.solucion_principal?.tipo]?.label ||
                  displayResult.solucion_principal?.tipo ||
                  "movilidad",
                description:
                  `Referencia base para empezar a comparar ya mismo con un modelo concreto: ${primaryModel}.`,
                rankingScore: 72,
                reason: `Se muestra primero para que siempre tengas una oferta base visible con el modelo ${primaryModel}.`,
                signals: [`Modelo sugerido: ${primaryModel}`, "Base del asesor"],
                url: getOfferFallbackSearchUrl({ title: primaryModel, source: "Mercado general", listingType: displayResult.solucion_principal?.tipo }, displayResult),
              },
              {
                key: "generic-backup",
                title: `${backupModel} · alternativa flexible comparable`,
                source: "Mercado general",
                description: `Opción de respaldo útil para comparar cuota, permanencia y coste total con ${backupModel}.`,
                rankingScore: 64,
                reason: `Se conserva como respaldo para que nunca te quedes sin opciones visibles usando ${backupModel}.`,
                signals: [`Modelo sugerido: ${backupModel}`, "Comparativa rápida"],
                url: getOfferFallbackSearchUrl({ title: backupModel, source: "Mercado general", listingType: displayResult.solucion_principal?.tipo }, displayResult),
              }
            );
          }

          const syntheticOfferCards = syntheticOfferSeeds
            .filter(
              (seed) =>
                !realOfferCards.some(
                  (item) =>
                    normalizeText(item?.source || item?.title).toLowerCase().includes(normalizeText(seed.source).toLowerCase()) ||
                    normalizeText(item?.title).toLowerCase() === normalizeText(seed.title).toLowerCase()
                )
            )
            .map((seed, index) => ({
              title: seed.title,
              source: seed.source,
              price: "",
              description: seed.description,
              rankingScore: seed.rankingScore,
              rankPosition: realOfferCards.length + index + 1,
              positionReason: seed.reason,
              rankingSignals: seed.signals,
              image: "",
              hasRealImage: false,
              url: "",
              searchUrl: seed.url || getOfferFallbackSearchUrl(seed, displayResult),
              synthetic: true,
            }));
          const offerCards = [...realOfferCards, ...syntheticOfferCards].slice(0, 4);
          const featuredOffer = offerCards[0] || null;
          const otherOffers = offerCards.slice(1, 4);
          const featuredOfferAction = getOfferActionMeta(featuredOffer);
          const featuredOfferSaved = featuredOffer ? isRecommendationSaved(featuredOffer) : false;
          const listingCoverageSummary = buildSearchCoverageSummary(listingSearchCoverage);
          const isOffersResultView = resultView === "offers";
          const winnerLabels = {
            principal: "Gana la recomendada",
            alternativa_1: "Gana la alternativa 1",
            alternativa_2: "Gana la alternativa 2",
          };
          const tcoBreakdownItems = [
            { key: "base_mensual", label: tcoDetail.concepto_base || "Base mensual", color: "#fbbf24" },
            { key: "seguro", label: "Seguro", color: "#60a5fa" },
            { key: "energia", label: "Energía / combustible", color: "#34d399" },
            { key: "mantenimiento", label: "Mantenimiento", color: "#c084fc" },
            { key: "extras", label: "Extras / colchón", color: "#f472b6" },
          ].filter((item) => Number(tcoDetail[item.key] || 0) > 0);
          const shouldOfferValuationPrompt = ["si_entrego", "si_vendo"].includes(
            normalizeText(answers?.vehiculo_actual)
          );
          const valuationPromptTitle = normalizeText(answers?.vehiculo_actual) === "si_entrego"
            ? "Tasación para entregar tu coche"
            : "Tasación para vender tu coche aparte";
          const valuationPromptText = normalizeText(answers?.vehiculo_actual) === "si_entrego"
            ? "Antes de cerrar una compra o financiación, conviene estimar cuánto te puede aportar tu coche actual como entrega."
            : "Si vas a vender tu coche por separado, te conviene revisar su tasación para compararla con estas ofertas con el coste real completo.";
          const scoreBreakdownEntries = [
            { key: "encaje_uso", label: "Encaje con tu uso", max: 25, color: "#38bdf8" },
            { key: "coste_total", label: "Coste total", max: 20, color: "#34d399" },
            { key: "flexibilidad", label: "Flexibilidad", max: 20, color: "#a78bfa" },
            { key: "viabilidad_real", label: "Viabilidad real", max: 20, color: "#f59e0b" },
            { key: "ajuste_preferencias", label: "Ajuste contigo", max: 15, color: "#f472b6" },
          ];
          return (
            <div ref={resultRef} style={s.center}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(5,150,105,0.1)",
                    border: "1px solid rgba(5,150,105,0.22)",
                    padding: "5px 14px",
                    borderRadius: 100,
                    fontSize: 11,
                    color: "#34d399",
                    marginBottom: 14,
                    letterSpacing: "0.6px",
                  }}
                >
                  ✅ ANÁLISIS COMPLETADO · {result.alineacion_pct || result.solucion_principal?.score}% ALINEACIÓN{confidenceLabel}
                </div>
                <h2
                  style={{
                    fontSize: "clamp(20px,4vw,30px)",
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    margin: 0,
                    color: "#f1f5f9",
                  }}
                >
                  {isOffersResultView ? "Tus ofertas recomendadas" : "Tu solución de movilidad óptima"}
                </h2>
              </div>

              {!isOffersResultView ? (
                <div
                  style={{
                    background: "linear-gradient(135deg,rgba(37,99,235,0.14),rgba(14,165,233,0.08))",
                    border: "1px solid rgba(96,165,250,0.24)",
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 18,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#dbeafe", marginBottom: 10, lineHeight: 1.6 }}>
                    Ya tienes el análisis completo. Cuando quieras, entra en una vista separada con solo tus ofertas ordenadas por encaje real.
                  </div>
                  <button
                    type="button"
                    onClick={showOffersPage}
                    style={{
                      background: "linear-gradient(135deg,#10b981,#059669)",
                      border: "none",
                      color: "white",
                      padding: "12px 20px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 12px 30px rgba(16,185,129,0.18)",
                    }}
                  >
                    🚗 Ver tus ofertas
                  </button>
                </div>
              ) : (
                <>
                <div
                  style={{
                    background: "rgba(14,165,233,0.08)",
                    border: "1px solid rgba(125,211,252,0.22)",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 18,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.6, textAlign: "left", flex: 1, minWidth: 240 }}>
                    Aquí ves solo las ofertas del test: la destacada y las alternativas, con el motivo de selección y su ajuste con tus respuestas.
                  </div>
                  <button
                    type="button"
                    onClick={showAnalysisPage}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#e2e8f0",
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ← Volver al análisis
                  </button>
                </div>

                {shouldOfferValuationPrompt && (
                  <div
                    style={{
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(251,191,36,0.24)",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 18,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 10, color: "#fbbf24", marginBottom: 6, fontWeight: 800, letterSpacing: "0.6px" }}>
                        💶 TASACIÓN RECOMENDADA
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
                        {valuationPromptTitle}
                      </div>
                      <div style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.6 }}>
                        {valuationPromptText}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openSellValuationFromOffers}
                      style={{
                        background: "linear-gradient(135deg,#f59e0b,#d97706)",
                        border: "none",
                        color: "white",
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 12px 30px rgba(217,119,6,0.16)",
                      }}
                    >
                      Ir a la tasación →
                    </button>
                  </div>
                )}
                </>
              )}

              {!isOffersResultView && (
              <>
              {/* Main card */}
              <div
                style={{
                  background: `${mt.color}14`,
                  border: `1px solid ${mt.color}30`,
                  borderRadius: 18,
                  padding: 24,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 13,
                      background: `${mt.color}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    {mt.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: mt.color,
                        letterSpacing: "0.8px",
                        marginBottom: 4,
                        fontWeight: 600,
                      }}
                    >
                      RECOMENDACIÓN PRINCIPAL · {result.solucion_principal?.score}% COINCIDENCIA
                    </div>
                    <h3
                      style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}
                    >
                      {displayResult.solucion_principal?.titulo}
                    </h3>
                    <p
                      style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}
                    >
                      {displayResult.solucion_principal?.resumen}
                    </p>
                  </div>
                </div>

                {/* Score bar */}
                <div
                  style={{
                    height: 5,
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${result.solucion_principal?.score}%`,
                      background: mt.color,
                      borderRadius: 3,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(15,23,42,0.28)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#7dd3fc", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                      🔍 DESGLOSE DEL SCORE
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {scoreBreakdownEntries.map((item) => {
                        const value = Number(scoreBreakdown[item.key] || 0);
                        return (
                          <div key={item.key}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#cbd5e1", marginBottom: 4 }}>
                              <span>{item.label}</span>
                              <span style={{ color: item.color, fontWeight: 700 }}>{value}/{item.max}</span>
                            </div>
                            <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${Math.min(100, (value / item.max) * 100)}%`,
                                  background: item.color,
                                  borderRadius: 999,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(15,23,42,0.28)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                      🧠 POR QUÉ GANA ESTA OPCIÓN
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {whyThisWins.map((reason, index) => (
                        <div key={`why-win-${index}`} style={{ fontSize: 12, color: "#d1fae5", lineHeight: 1.5 }}>
                          • {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pros/Cons */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#475569",
                        marginBottom: 8,
                        fontWeight: 600,
                        letterSpacing: "0.6px",
                      }}
                    >
                      ✅ VENTAJAS
                    </div>
                    {(displayResult.solucion_principal?.ventajas || []).map((v, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5, lineHeight: 1.4 }}
                      >
                        → {v}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#475569",
                        marginBottom: 8,
                        fontWeight: 600,
                        letterSpacing: "0.6px",
                      }}
                    >
                      ⚠️ A TENER EN CUENTA
                    </div>
                    {(displayResult.solucion_principal?.inconvenientes || []).map((v, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5, lineHeight: 1.4 }}
                      >
                        → {v}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div
                  style={{
                    padding: 14,
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>
                        COSTE ESTIMADO
                      </div>
                      <div style={{ fontWeight: 700, color: mt.color, fontSize: 14 }}>
                        {result.solucion_principal?.coste_estimado}
                      </div>
                    </div>
                    {result.solucion_principal?.etiqueta_dgt &&
                      result.solucion_principal.etiqueta_dgt !== "No aplica" && (
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>
                            ETIQUETA DGT
                          </div>
                          <div style={{ fontWeight: 700, color: "#34d399", fontSize: 14 }}>
                            {result.solucion_principal.etiqueta_dgt}
                          </div>
                        </div>
                      )}
                  </div>
                  {result.propulsiones_viables && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#475569",
                          marginBottom: 6,
                          letterSpacing: "0.6px",
                        }}
                      >
                        PROPULSIONES VIABLES
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {result.propulsiones_viables.map((p) => (
                          <span
                            key={p}
                            style={{
                              background: "rgba(5,150,105,0.15)",
                              border: "1px solid rgba(5,150,105,0.25)",
                              padding: "2px 9px",
                              borderRadius: 100,
                              fontSize: 11,
                              color: "#34d399",
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      marginBottom: 6,
                      letterSpacing: "0.6px",
                    }}
                  >
                    BÚSQUEDA DE MERCADO
                  </div>
                  <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6 }}>
                    Contrastamos stock público y solo mostramos la mejor opción final encontrada por la IA.
                  </div>
                </div>
              </div>
              </>
              )}

              {isOffersResultView && (quickValidationQuestions.length > 0 || displayResult.siguiente_paso) && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(14,165,233,0.08)",
                      border: "1px solid rgba(125,211,252,0.2)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                      ✅ VALIDACIÓN RÁPIDA
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {quickValidationQuestions.map((item) => {
                        const selected = quickValidationAnswers[item.id] || "";

                        return (
                          <div
                            key={item.id}
                            style={{
                              background: "rgba(15,23,42,0.28)",
                              border: "1px solid rgba(148,163,184,0.16)",
                              borderRadius: 10,
                              padding: 10,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.5, marginBottom: 8 }}>
                              {item.label}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {["si", "no"].map((choice) => {
                                const active = selected === choice;
                                const isYes = choice === "si";

                                return (
                                  <button
                                    key={`${item.id}-${choice}`}
                                    type="button"
                                    onClick={() => updateQuickValidationAnswer(item.id, choice)}
                                    style={{
                                      background: active
                                        ? isYes
                                          ? "rgba(16,185,129,0.24)"
                                          : "rgba(239,68,68,0.2)"
                                        : "rgba(15,23,42,0.2)",
                                      border: active
                                        ? isYes
                                          ? "1px solid rgba(52,211,153,0.45)"
                                          : "1px solid rgba(248,113,113,0.42)"
                                        : "1px solid rgba(148,163,184,0.18)",
                                      color: active ? (isYes ? "#d1fae5" : "#fecaca") : "#cbd5e1",
                                      padding: "5px 10px",
                                      borderRadius: 8,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {isYes ? "Sí" : "No"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(16,185,129,0.08)",
                      border: "1px solid rgba(110,231,183,0.2)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                      🎯 SIGUIENTE PASO
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                      {displayResult.siguiente_paso}
                    </div>
                    <p style={{ margin: "0 0 10px", fontSize: 12, color: "#d1fae5", lineHeight: 1.6 }}>
                      Ajusta esta parte rápida y el bloque de ofertas se reordena para enseñarte primero la mejor coincidencia real.
                    </p>

                    {isRentingOutcome ? (
                      <>
                        <div style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 6 }}>Cuota objetivo mensual</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {MONTHLY_BUDGET_OPTIONS.map((option) => {
                            const selected = listingFilters.budget === option.value;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => updateListingFilter("budget", option.value)}
                                style={{
                                  background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                                  border: selected
                                    ? "1px solid rgba(110,231,183,0.55)"
                                    : "1px solid rgba(5,150,105,0.28)",
                                  padding: "4px 10px",
                                  borderRadius: 100,
                                  fontSize: 11,
                                  color: "#d1fae5",
                                  cursor: "pointer",
                                  fontWeight: selected ? 700 : 500,
                                }}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>

                        <div style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 6 }}>Estabilidad de ingresos</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {INCOME_STABILITY_OPTIONS.map((option) => {
                            const selected = listingFilters.income === option.value;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => updateListingFilter("income", option.value)}
                                style={{
                                  background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                                  border: selected
                                    ? "1px solid rgba(110,231,183,0.55)"
                                    : "1px solid rgba(5,150,105,0.28)",
                                  padding: "4px 10px",
                                  borderRadius: 100,
                                  fontSize: 11,
                                  color: "#d1fae5",
                                  cursor: "pointer",
                                  fontWeight: selected ? 700 : 500,
                                }}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : isBuyOrFinanceOutcome ? (
                      <div style={{ display: "grid", gap: 5 }}>
                        {[
                          "Define tu cuota máxima cómoda y el capital inicial real.",
                          "Pide oferta desglosada con TIN/TAE, seguro y coste total.",
                          "Descarta cualquier opción que no cuadre con el TCO objetivo.",
                        ].map((item) => (
                          <div key={item} style={{ fontSize: 11, color: "#dcfce7", lineHeight: 1.5 }}>• {item}</div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 5 }}>
                        {[
                          "Comprueba cobertura real en tu zona y disponibilidad diaria.",
                          "Compara el coste puntual frente al coste fijo de otra modalidad.",
                          "Quédate con la opción que menos fricción te meta hoy.",
                        ].map((item) => (
                          <div key={item} style={{ fontSize: 11, color: "#dcfce7", lineHeight: 1.5 }}>• {item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 16,
                  alignItems: "start",
                  marginBottom: 16,
                }}
              >
                {isOffersResultView && (
                <div>
                  <div
                    style={{
                      background: "linear-gradient(135deg,rgba(14,165,233,0.16),rgba(37,99,235,0.08))",
                      border: "1px solid rgba(96,165,250,0.32)",
                      borderRadius: 16,
                      padding: 18,
                      boxShadow: "0 18px 45px rgba(37,99,235,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 700, letterSpacing: "0.7px" }}>
                        🏆 OFERTAS QUE MEJOR ENCAJAN
                      </div>
                      <button
                        type="button"
                        onClick={() => searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true })}
                        disabled={!canSearchListing || listingLoading}
                        style={{
                          background: canSearchListing && !listingLoading
                            ? "linear-gradient(135deg,#0ea5e9,#2563eb)"
                            : "rgba(148,163,184,0.2)",
                          border: "none",
                          color: "white",
                          padding: "8px 12px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: canSearchListing && !listingLoading ? "pointer" : "not-allowed",
                          opacity: canSearchListing && !listingLoading ? 1 : 0.6,
                        }}
                      >
                        {listingLoading ? "Recalculando..." : "Recalcular ofertas"}
                      </button>
                    </div>

                    <p style={{ margin: "0 0 12px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                      La oferta destacada es la que mejor funciona para tu caso; debajo verás otras 3 que también podrían encajar con sus motivos de posición.
                    </p>

                    {listingCoverageSummary && (
                      <div
                        style={{
                          background: "rgba(15,23,42,0.38)",
                          border: "1px solid rgba(125,211,252,0.22)",
                          borderRadius: 12,
                          padding: 10,
                          marginBottom: 10,
                          fontSize: 11,
                          color: "#dbeafe",
                          lineHeight: 1.6,
                        }}
                      >
                        🔎 {listingCoverageSummary}
                      </div>
                    )}

                    {listingError && (
                      <div
                        style={{
                          background: featuredOffer ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
                          border: featuredOffer ? "1px solid rgba(251,191,36,0.24)" : "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 10,
                          fontSize: 12,
                          color: featuredOffer ? "#fde68a" : "#fecaca",
                        }}
                      >
                        {featuredOffer
                          ? `⚠️ ${listingError} Ya puedes abrir las opciones visibles mientras afinamos una coincidencia todavía mejor.`
                          : listingError}
                      </div>
                    )}

                    {!featuredOffer && !listingLoading && !listingError && (
                      <div
                        style={{
                          background: "rgba(15,23,42,0.28)",
                          border: "1px dashed rgba(148,163,184,0.24)",
                          borderRadius: 12,
                          padding: 14,
                          fontSize: 12,
                          color: "#cbd5e1",
                          lineHeight: 1.6,
                        }}
                      >
                        {listingLoading
                          ? "Estamos recalculando las ofertas para tu perfil en tiempo real."
                          : "Las ofertas salen ya de primeras; si tocas validación rápida o cuota, se reordenan automáticamente."}
                      </div>
                    )}

                    {featuredOffer && (
                      <div
                        onClick={() => featuredOffer?.url && openOfferInNewTab(featuredOffer.url)}
                        title={featuredOffer?.url ? "Abrir oferta en una pestaña nueva" : undefined}
                        style={{
                          background: "rgba(2,6,23,0.42)",
                          border: "1px solid rgba(96,165,250,0.24)",
                          borderRadius: 14,
                          padding: 14,
                          marginBottom: 12,
                          cursor: featuredOffer?.url ? "pointer" : "default",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(220px,260px) 1fr",
                            gap: 14,
                            alignItems: "start",
                          }}
                        >
                          <div
                            style={{
                              borderRadius: 12,
                              overflow: "hidden",
                              minHeight: 170,
                              background: "rgba(15,23,42,0.72)",
                              border: "1px solid rgba(148,163,184,0.14)",
                            }}
                          >
                            <ResolvedOfferImage
                              offer={featuredOffer}
                              alt={featuredOffer.title || "Oferta destacada"}
                              loading="lazy"
                              style={{
                                width: "100%",
                                height: "100%",
                                minHeight: 170,
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
                              ⭐ OFERTA DESTACADA · PUESTO #{featuredOffer.rankPosition || 1}
                              {Number.isFinite(Number(featuredOffer.rankingScore ?? featuredOffer.profileScore))
                                ? ` · ENCAJE ${Number(featuredOffer.rankingScore ?? featuredOffer.profileScore)}/100`
                                : ""}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                              {featuredOffer.title}
                            </div>
                            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                              {featuredOffer.description || "Es la coincidencia real mejor posicionada para tu test y tu contexto actual."}
                            </p>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                              <div style={{ fontSize: 12, color: "#93c5fd" }}>
                                {featuredOffer.source || "Web externa"}
                              </div>
                              {featuredOffer.price && (
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#34d399" }}>
                                  {featuredOffer.price}
                                </div>
                              )}
                            </div>
                            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#dbeafe", lineHeight: 1.6 }}>
                              <strong>Por qué va la 1ª:</strong> {featuredOffer.positionReason || featuredOffer.matchReason}
                            </p>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                              {getOfferTrustBadges(featuredOffer).map((badge) => (
                                <span
                                  key={`${featuredOffer.title || "featured"}-badge-${badge.label}`}
                                  style={getOfferBadgeStyle(badge.tone)}
                                >
                                  {badge.label}
                                </span>
                              ))}
                              {Array.isArray(featuredOffer.rankingSignals) && featuredOffer.rankingSignals.slice(0, 3).map((signal) => (
                                <span
                                  key={`${featuredOffer.url || featuredOffer.title || "featured"}-signal-${signal}`}
                                  style={{
                                    background: "rgba(37,99,235,0.1)",
                                    border: "1px solid rgba(96,165,250,0.22)",
                                    color: "#dbeafe",
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  {signal}
                                </span>
                              ))}
                            </div>

                            {!featuredOffer.url && featuredOffer.searchUrl && (
                              <p style={{ margin: "0 0 10px", fontSize: 11, color: "#fde68a", lineHeight: 1.6 }}>
                                Esta tarjeta es una <strong>referencia orientativa</strong>: te lleva al portal del proveedor, no a una ficha exacta ya verificada.
                              </p>
                            )}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {featuredOfferAction ? (
                                <a
                                  href={featuredOfferAction.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  style={{
                                    background: featuredOfferAction.exact
                                      ? "linear-gradient(135deg,#10b981,#059669)"
                                      : "rgba(245,158,11,0.14)",
                                    border: featuredOfferAction.exact
                                      ? "none"
                                      : "1px solid rgba(251,191,36,0.28)",
                                    color: "white",
                                    textDecoration: "none",
                                    padding: "9px 13px",
                                    borderRadius: 10,
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {featuredOfferAction.label}
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true });
                                  }}
                                  style={{
                                    background: "rgba(16,185,129,0.12)",
                                    border: "1px solid rgba(52,211,153,0.22)",
                                    color: "#bbf7d0",
                                    padding: "9px 13px",
                                    borderRadius: 10,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Buscar oferta real ahora ↗
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleSavedRecommendation(featuredOffer);
                                }}
                                style={{
                                  background: featuredOfferSaved ? "rgba(236,72,153,0.16)" : "rgba(255,255,255,0.06)",
                                  border: featuredOfferSaved
                                    ? "1px solid rgba(244,114,182,0.28)"
                                    : "1px solid rgba(255,255,255,0.12)",
                                  color: featuredOfferSaved ? "#fbcfe8" : "#e2e8f0",
                                  padding: "9px 13px",
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {featuredOfferSaved ? "💖 Guardada" : "🤍 Guardar favorita"}
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true });
                                }}
                                style={{
                                  background: "rgba(255,255,255,0.06)",
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  color: "#cbd5e1",
                                  padding: "9px 13px",
                                  borderRadius: 10,
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                Buscar otra tanda
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {otherOffers.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: "#bfdbfe", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                          OTRAS OFERTAS QUE TAMBIÉN ENCAJAN
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {otherOffers.map((offer, index) => {
                            const offerAction = getOfferActionMeta(offer);

                            return (
                              <div
                                key={offer.url || offer.searchUrl || `${offer.title}-${index}`}
                                onClick={() => offer?.url && openOfferInNewTab(offer.url)}
                                title={offer?.url ? "Abrir oferta en una pestaña nueva" : undefined}
                                style={{
                                  background: "rgba(15,23,42,0.28)",
                                  border: "1px solid rgba(148,163,184,0.16)",
                                  borderRadius: 12,
                                  padding: 12,
                                  cursor: offer?.url ? "pointer" : "default",
                                }}
                              >
                                <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, alignItems: "start" }}>
                                  <div
                                    style={{
                                      borderRadius: 10,
                                      overflow: "hidden",
                                      background: "rgba(15,23,42,0.72)",
                                      border: "1px solid rgba(148,163,184,0.14)",
                                      minHeight: 78,
                                    }}
                                  >
                                    <ResolvedOfferImage
                                      offer={offer}
                                      alt={offer.title || "Oferta"}
                                      loading="lazy"
                                      style={{ width: "100%", height: 78, objectFit: "cover", display: "block" }}
                                    />
                                  </div>

                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>
                                        #{offer.rankPosition || index + 2} · {offer.title}
                                      </div>
                                      {offer.price && (
                                        <div style={{ fontSize: 13, fontWeight: 800, color: "#6ee7b7" }}>{offer.price}</div>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 6 }}>
                                      {offer.source || "Web externa"}
                                      {Number.isFinite(Number(offer.rankingScore ?? offer.profileScore))
                                        ? ` · ${Number(offer.rankingScore ?? offer.profileScore)}/100`
                                        : ""}
                                    </div>
                                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
                                      {offer.positionReason || offer.matchReason}
                                    </p>

                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                      {getOfferTrustBadges(offer).map((badge) => (
                                        <span
                                          key={`${offer.url || offer.searchUrl || offer.title}-badge-${badge.label}`}
                                          style={getOfferBadgeStyle(badge.tone)}
                                        >
                                          {badge.label}
                                        </span>
                                      ))}
                                      {Array.isArray(offer.rankingSignals) && offer.rankingSignals.slice(0, 1).map((signal) => (
                                        <span
                                          key={`${offer.url || offer.searchUrl || offer.title}-signal-${signal}`}
                                          style={{
                                            background: "rgba(37,99,235,0.1)",
                                            border: "1px solid rgba(96,165,250,0.22)",
                                            color: "#dbeafe",
                                            padding: "3px 7px",
                                            borderRadius: 999,
                                            fontSize: 10,
                                          }}
                                        >
                                          {signal}
                                        </span>
                                      ))}
                                    </div>

                                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                      {offerAction ? (
                                        <a
                                          href={offerAction.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(event) => event.stopPropagation()}
                                          style={{
                                            color: offerAction.exact ? "#7dd3fc" : "#fcd34d",
                                            textDecoration: "none",
                                            fontSize: 11,
                                            fontWeight: 700,
                                          }}
                                        >
                                          {offerAction.label}
                                        </a>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true });
                                          }}
                                          style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "#7dd3fc",
                                            textDecoration: "none",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            padding: 0,
                                          }}
                                        >
                                          Buscar oferta real ↗
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleSavedRecommendation(offer);
                                        }}
                                        style={{
                                          background: isRecommendationSaved(offer)
                                            ? "rgba(236,72,153,0.14)"
                                            : "transparent",
                                          border: "none",
                                          color: isRecommendationSaved(offer) ? "#f9a8d4" : "#cbd5e1",
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          padding: 0,
                                        }}
                                      >
                                        {isRecommendationSaved(offer) ? "💖 En guardadas" : "🤍 Guardar"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {!isOffersResultView && (
                <div style={{ display: "grid", gap: 12 }}>

              {/* Tension */}
              {result.solucion_principal?.tension_principal && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#f87171",
                      marginBottom: 6,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    ⚡ TENSIÓN DETECTADA EN TU PERFIL
                  </div>
                  <p
                    style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}
                  >
                    {displayResult.solucion_principal.tension_principal}
                  </p>
                </div>
              )}

              {/* TCO */}
              {(result.tco_aviso || Number(tcoDetail.total_mensual || 0) > 0) && (
                <div
                  style={{
                    background: "rgba(245,158,11,0.07)",
                    border: "1px solid rgba(245,158,11,0.18)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#fbbf24",
                      marginBottom: 8,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    📊 TCO REAL — COSTE TOTAL DE PROPIEDAD / USO
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(15,23,42,0.28)",
                        border: "1px solid rgba(251,191,36,0.16)",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#fcd34d", marginBottom: 6, letterSpacing: "0.5px" }}>
                        TOTAL ORIENTATIVO
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#f8fafc", marginBottom: 2 }}>
                        {formatCurrency(Number(tcoDetail.total_mensual || 0))} / mes
                      </div>
                      <div style={{ fontSize: 12, color: "#fde68a", marginBottom: 6 }}>
                        ≈ {formatCurrency(Number(tcoDetail.total_anual || 0))} / año
                      </div>
                      {Number(tcoDetail.entrada_inicial || 0) > 0 && (
                        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                          Entrada / capital inicial orientativo: <strong>{formatCurrency(Number(tcoDetail.entrada_inicial || 0))}</strong>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        background: "rgba(15,23,42,0.28)",
                        border: "1px solid rgba(251,191,36,0.16)",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#fde68a", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                        DESGLOSE MENSUAL
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {tcoBreakdownItems.map((item) => {
                          const value = Number(tcoDetail[item.key] || 0);
                          const total = Math.max(1, Number(tcoDetail.total_mensual || 0));
                          return (
                            <div key={item.key}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#e2e8f0", marginBottom: 4 }}>
                                <span>{item.label}</span>
                                <span style={{ color: item.color, fontWeight: 700 }}>{formatCurrency(value)}</span>
                              </div>
                              <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${Math.min(100, (value / total) * 100)}%`,
                                    background: item.color,
                                    borderRadius: 999,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {displayResult.tco_aviso && (
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      {displayResult.tco_aviso}
                    </p>
                  )}
                  {displayResult.tco_detalle?.nota && (
                    <p style={{ margin: 0, fontSize: 12, color: "#fde68a", lineHeight: 1.6 }}>
                      <strong>Lectura:</strong> {displayResult.tco_detalle.nota}
                    </p>
                  )}
                </div>
              )}

              {false && shouldShowChargingChecklist && (
                <div
                  style={{
                    background: "rgba(14,165,233,0.08)",
                    border: "1px solid rgba(14,165,233,0.22)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#67e8f9",
                      marginBottom: 8,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    🔌 VALIDACION RAPIDA DE CARGA (SI LA IA VE VIABLE UN ELECTRICO / PHEV)
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {[
                      "¿Puedes cargar en casa o en tu plaza al menos 2-3 veces por semana?",
                      "¿Tienes un punto publico fiable cerca de casa o trabajo?",
                      "¿Tus viajes largos encajan con paradas de recarga cada 2-3 horas?",
                    ].map((item) => (
                      <label
                        key={item}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          fontSize: 12,
                          color: "#bae6fd",
                          lineHeight: 1.5,
                          cursor: "pointer",
                        }}
                      >
                        <input type="checkbox" style={{ marginTop: 2 }} />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "#7dd3fc", lineHeight: 1.5 }}>
                    Este bloque solo aparece si la IA estima que un electrico o PHEV podria encajarte. Si marcas menos de 2 puntos, suele convenir priorizar HEV/PHEV antes que electrico puro.
                  </p>
                </div>
              )}

              {false && isBuyOrFinanceOutcome && (
                <div
                  style={{
                    background: "rgba(37,99,235,0.08)",
                    border: "1px solid rgba(37,99,235,0.22)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#93c5fd",
                      marginBottom: 8,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    🧾 SIGUIENTE PASO: VALIDACION FINANCIERA (SOLO SI COMPRAS / FINANCIAS)
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {[
                      "Capital inicial disponible para entrada (si aplica)",
                      "Cuota maxima comoda segun ingresos netos reales",
                      "Estabilidad de ingresos y endeudamiento mensual actual",
                      "Pre-scoring financiero antes de cerrar modelo/version",
                    ].map((item) => (
                      <div key={item} style={{ fontSize: 12, color: "#bfdbfe", lineHeight: 1.5 }}>
                        □ {item}
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "#93c5fd", lineHeight: 1.5 }}>
                    Este bloque se hace despues de tener shortlist de coches, para evitar pedir datos financieros
                    demasiado pronto si finalmente la mejor via no es compra/financiacion.
                  </p>
                </div>
              )}

              {false && isRentingOutcome && (
                <div
                  style={{
                    background: "rgba(5,150,105,0.08)",
                    border: "1px solid rgba(5,150,105,0.22)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#6ee7b7",
                      marginBottom: 8,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    📅 SIGUIENTE PASO: VALIDACION DE CUOTA (SOLO SI RENTING)
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#a7f3d0", lineHeight: 1.5 }}>
                    ¿Cuanto puedes destinar al vehiculo al mes?
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {MONTHLY_BUDGET_OPTIONS.map((option) => {
                      const selected = listingFilters.budget === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateListingFilter("budget", option.value)}
                          style={{
                            background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                            border: selected
                              ? "1px solid rgba(110,231,183,0.55)"
                              : "1px solid rgba(5,150,105,0.28)",
                            padding: "4px 10px",
                            borderRadius: 100,
                            fontSize: 11,
                            color: "#d1fae5",
                            cursor: "pointer",
                            fontWeight: selected ? 700 : 500,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: "10px 0 6px", fontSize: 12, color: "#a7f3d0", lineHeight: 1.5 }}>
                    ¿Como es la estabilidad de tus ingresos?
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {INCOME_STABILITY_OPTIONS.map((option) => {
                      const selected = listingFilters.income === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateListingFilter("income", option.value)}
                          style={{
                            background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                            border: selected
                              ? "1px solid rgba(110,231,183,0.55)"
                              : "1px solid rgba(5,150,105,0.28)",
                            padding: "4px 10px",
                            borderRadius: 100,
                            fontSize: 11,
                            color: "#d1fae5",
                            cursor: "pointer",
                            fontWeight: selected ? 700 : 500,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6ee7b7", lineHeight: 1.5 }}>
                    Al pinchar en las opciones lanzamos una busqueda para localizar una oferta real alineada con tu resultado.
                  </p>
                </div>
              )}

              {false && (
              <div
                style={{
                  background: "linear-gradient(135deg,rgba(14,165,233,0.16),rgba(37,99,235,0.08))",
                  border: "1px solid rgba(96,165,250,0.32)",
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 14,
                  boxShadow: "0 18px 45px rgba(37,99,235,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#7dd3fc",
                    marginBottom: 8,
                    fontWeight: 700,
                    letterSpacing: "0.7px",
                  }}
                >
                  🚀 SIGUIENTE PASO ACCIONABLE · CLICA Y TE TRAIGO UN ANUNCIO REAL
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
                  {displayResult.siguiente_paso}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  Ya no hace falta que el cliente elija la plataforma. La IA rastrea automaticamente varias webs de
                  {` ${listingModeLabel}`} y devuelve la mejor coincidencia real publicada teniendo en cuenta tu test y las coincidencias mostradas.
                </p>

                <div
                  style={{
                    marginBottom: 12,
                    background: "rgba(15,23,42,0.24)",
                    border: "1px solid rgba(148,163,184,0.16)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#bfdbfe", marginBottom: 6, letterSpacing: "0.5px" }}>
                    BÚSQUEDA AUTOMÁTICA
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                    No mostramos empresas intermedias: la IA revisa varios portales y solo enseña la mejor opción final localizada.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true })}
                    disabled={!canSearchListing || listingLoading}
                    style={{
                      background: canSearchListing && !listingLoading
                        ? "linear-gradient(135deg,#0ea5e9,#2563eb)"
                        : "rgba(148,163,184,0.2)",
                      border: "none",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: canSearchListing && !listingLoading ? "pointer" : "not-allowed",
                      opacity: canSearchListing && !listingLoading ? 1 : 0.6,
                    }}
                  >
                    {listingLoading ? "Buscando anuncio real..." : "🔎 Buscar anuncio real ahora"}
                  </button>
                  {!canSearchListing && (
                    <span style={{ fontSize: 11, color: "#bfdbfe", alignSelf: "center" }}>
                      {isRentingOutcome
                        ? "Elige tu franja de cuota para activar la búsqueda automática."
                        : "Pulsa el botón y la IA revisará automáticamente varios portales."}
                    </span>
                  )}
                </div>

                {listingError && (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      fontSize: 12,
                      color: "#fecaca",
                    }}
                  >
                    {listingError}
                  </div>
                )}

                {listingResult && (
                  <div
                    style={{
                      background: "rgba(2,6,23,0.42)",
                      border: "1px solid rgba(96,165,250,0.22)",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#67e8f9",
                        marginBottom: 6,
                        fontWeight: 700,
                        letterSpacing: "0.6px",
                      }}
                    >
                      {isFlexibleMobilityOutcome
                        ? "🧩 OFERTA REAL DE MOVILIDAD FLEXIBLE"
                        : listingResult.listingType === "renting"
                          ? "📅 OFERTA REAL DE RENTING"
                          : "🚗 ANUNCIO REAL DE COMPRA"} · {listingResult.source || "Web externa"}
                      {Number.isFinite(Number(listingResult.rankingScore ?? listingResult.profileScore))
                        ? ` · ENCAJE ${Number(listingResult.rankingScore ?? listingResult.profileScore)}/100`
                        : ""}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                          {listingResult.title}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                          {listingResult.description || "Hemos seleccionado esta opcion por encaje con tu resultado y disponibilidad actual en la web."}
                        </p>
                      </div>
                      {listingResult.price && (
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>
                          {listingResult.price}
                        </div>
                      )}
                    </div>
                    {Array.isArray(listingResult.rankingSignals) && listingResult.rankingSignals.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        {listingResult.rankingSignals.map((signal) => (
                          <span
                            key={`${listingResult.url || "listing"}-signal-${signal}`}
                            style={{
                              background: "rgba(16,185,129,0.12)",
                              border: "1px solid rgba(52,211,153,0.24)",
                              color: "#bbf7d0",
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    )}
                    {listingResult.matchReason && (
                      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#93c5fd", lineHeight: 1.5 }}>
                        Encaje detectado: {listingResult.matchReason}
                      </p>
                    )}
                    {Array.isArray(listingResult.whyMatches) && listingResult.whyMatches.length > 0 && (
                      <div
                        style={{
                          background: "rgba(37,99,235,0.1)",
                          border: "1px solid rgba(147,197,253,0.25)",
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "#bfdbfe",
                            marginBottom: 7,
                            fontWeight: 700,
                            letterSpacing: "0.6px",
                          }}
                        >
                          🧠 POR QUE SE HA ELEGIDO ESTE COCHE
                        </div>
                        <div style={{ display: "grid", gap: 5 }}>
                          {listingResult.whyMatches.map((reason, index) => (
                            <div
                              key={`${listingResult.url || "listing"}-why-${index}`}
                              style={{ fontSize: 11, color: "#dbeafe", lineHeight: 1.5 }}
                            >
                              • {reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={listingResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "linear-gradient(135deg,#10b981,#059669)",
                          color: "white",
                          textDecoration: "none",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Abrir anuncio ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true })}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#cbd5e1",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Buscar otra opcion
                      </button>
                    </div>
                  </div>
                )}
              </div>

              )}

              {/* Alternatives */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {(displayResult.alternativas || []).map((alt, i) => {
                  const mt2 = MOBILITY_TYPES[alt.tipo] || {
                    label: alt.tipo,
                    icon: "🚗",
                    color: "#64748b",
                  };
                  return (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}
                      >
                        <span style={{ fontSize: 18 }}>{mt2.icon}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>
                            {alt.titulo}
                          </div>
                          <div style={{ fontSize: 11, color: mt2.color }}>
                            {alt.score}% coincidencia
                          </div>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        {alt.razon}
                      </p>
                    </div>
                  );
                })}
              </div>

              {(comparatorRows.length > 0 || transparency.confianza_motivo || transparencyAssumptions.length > 0 || transparencyChecks.length > 0) && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  {comparatorRows.length > 0 && (
                    <div
                      style={{
                        background: "rgba(37,99,235,0.07)",
                        border: "1px solid rgba(96,165,250,0.18)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#93c5fd", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                        🆚 COMPARADOR FINAL
                      </div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {comparatorRows.map((row, index) => (
                          <div
                            key={`compare-${row.criterio || index}`}
                            style={{
                              background: "rgba(15,23,42,0.26)",
                              border: "1px solid rgba(148,163,184,0.12)",
                              borderRadius: 10,
                              padding: 10,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{row.criterio}</div>
                              <span
                                style={{
                                  background: "rgba(16,185,129,0.14)",
                                  border: "1px solid rgba(52,211,153,0.24)",
                                  color: "#bbf7d0",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                {winnerLabels[row.ganador] || "Gana la recomendada"}
                              </span>
                            </div>
                            <div style={{ display: "grid", gap: 5 }}>
                              <div style={{ fontSize: 11, color: "#dbeafe", lineHeight: 1.5 }}><strong>Opción elegida:</strong> {row.opcion_principal}</div>
                              {row.alternativa_1 && (
                                <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}><strong>Alternativa 1:</strong> {row.alternativa_1}</div>
                              )}
                              {row.alternativa_2 && (
                                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}><strong>Alternativa 2:</strong> {row.alternativa_2}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(transparency.confianza_motivo || transparencyAssumptions.length > 0 || transparencyChecks.length > 0) && (
                    <div
                      style={{
                        background: "rgba(16,185,129,0.07)",
                        border: "1px solid rgba(52,211,153,0.18)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                        🔎 TRANSPARENCIA DEL VEREDICTO
                      </div>
                      {transparency.confianza_motivo && (
                        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#d1fae5", lineHeight: 1.6 }}>
                          <strong>{confidenceLevel ? `Confianza ${confidenceLevel}` : "Lectura"}:</strong> {transparency.confianza_motivo}
                        </p>
                      )}
                      {transparencyAssumptions.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, color: "#bbf7d0", marginBottom: 6, letterSpacing: "0.5px" }}>SUPUESTOS CLAVE</div>
                          <div style={{ display: "grid", gap: 5 }}>
                            {transparencyAssumptions.map((item, index) => (
                              <div key={`assumption-${index}`} style={{ fontSize: 11, color: "#dcfce7", lineHeight: 1.5 }}>• {item}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {transparencyChecks.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "#bbf7d0", marginBottom: 6, letterSpacing: "0.5px" }}>VALIDACIONES PENDIENTES</div>
                          <div style={{ display: "grid", gap: 5 }}>
                            {transparencyChecks.map((item, index) => (
                              <div key={`check-${index}`} style={{ fontSize: 11, color: "#d1fae5", lineHeight: 1.5 }}>• {item}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(actionPlan.estado || actionPlan.resumen || actionSteps.length > 0 || actionAlerts.length > 0) && (
                <div
                  style={{
                    background: trafficTone.bg,
                    border: `1px solid ${trafficTone.border}`,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: trafficTone.text, fontWeight: 700, letterSpacing: "0.6px" }}>
                      🚦 SEMÁFORO DE DECISIÓN FINAL
                    </div>
                    <span
                      style={{
                        background: trafficTone.chip,
                        border: `1px solid ${trafficTone.border}`,
                        color: trafficTone.text,
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {trafficLabel}
                    </span>
                  </div>
                  {actionPlan.estado && (
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                      {actionPlan.estado}
                    </div>
                  )}
                  {actionPlan.resumen && (
                    <p style={{ margin: "0 0 10px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>
                      {actionPlan.resumen}
                    </p>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                      gap: 12,
                    }}
                  >
                    {actionSteps.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: trafficTone.text, marginBottom: 6, letterSpacing: "0.5px" }}>
                          QUÉ HACER AHORA
                        </div>
                        <div style={{ display: "grid", gap: 5 }}>
                          {actionSteps.map((item, index) => (
                            <div key={`action-step-${index}`} style={{ fontSize: 11, color: "#f8fafc", lineHeight: 1.5 }}>
                              {index + 1}. {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {actionAlerts.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: "#fda4af", marginBottom: 6, letterSpacing: "0.5px" }}>
                          ALERTAS ROJAS
                        </div>
                        <div style={{ display: "grid", gap: 5 }}>
                          {actionAlerts.map((item, index) => (
                            <div key={`action-alert-${index}`} style={{ fontSize: 11, color: "#fecdd3", lineHeight: 1.5 }}>
                              • {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div
                style={{
                  background: "rgba(14,165,233,0.07)",
                  border: "1px solid rgba(125,211,252,0.18)",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 700, letterSpacing: "0.6px" }}>
                    📌 RADAR DE MERCADO Y COMPARATIVAS GUARDADAS
                  </div>
                  <button
                    type="button"
                    onClick={saveCurrentComparison}
                    style={{
                      background: "rgba(14,165,233,0.18)",
                      border: "1px solid rgba(125,211,252,0.28)",
                      color: "#e0f2fe",
                      padding: "6px 10px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    📌 Guardar comparativa
                  </button>
                </div>

                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#dbeafe", lineHeight: 1.6 }}>
                  {marketRadar.objetivo}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: "#bae6fd", marginBottom: 6, letterSpacing: "0.5px" }}>
                      SEÑALES PARA ENTRAR
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      {marketRadar.senales_verdes.map((item, index) => (
                        <div key={`radar-green-${index}`} style={{ fontSize: 11, color: "#e0f2fe", lineHeight: 1.5 }}>
                          • {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#fda4af", marginBottom: 6, letterSpacing: "0.5px" }}>
                      CUÁNDO ESPERAR O DESCARTAR
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      {marketRadar.alertas.map((item, index) => (
                        <div key={`radar-alert-${index}`} style={{ fontSize: 11, color: "#fecdd3", lineHeight: 1.5 }}>
                          • {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {saveFeedback && (
                  <div style={{ fontSize: 11, color: "#67e8f9", marginBottom: 10 }}>
                    {saveFeedback}
                  </div>
                )}

                {savedComparisonItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#bae6fd", marginBottom: 8, letterSpacing: "0.5px" }}>
                      ÚLTIMAS COMPARATIVAS
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {savedComparisonItems.map((item) => {
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
                            background: "rgba(15,23,42,0.28)",
                            border: "1px solid rgba(148,163,184,0.14)",
                            borderRadius: 10,
                            padding: 10,
                            cursor: savedOfferHref ? "pointer" : "default",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>
                              {item.title}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSavedComparison(item.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#fda4af",
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Quitar
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>
                            {item.typeLabel} · {item.score}% · confianza {String(item.confidence || "media").toUpperCase()} · {item.savedAt}
                          </div>
                          <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
                            {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/mes` : item.budgetLabel}
                            {item.listingTitle ? ` · referencia: ${item.listingTitle}` : ""}
                            {item.listingPrice ? ` · ${item.listingPrice}` : ""}
                          </div>
                          {savedOfferHref && (
                            <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 5, fontWeight: 700 }}>
                              Abrir oferta ↗
                            </div>
                          )}
                        </div>
                      );})}
                    </div>
                  </div>
                )}
              </div>

              {/* Expert + listing follow-up */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    background: "rgba(234,179,8,0.07)",
                    border: "1px solid rgba(234,179,8,0.18)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#eab308",
                      marginBottom: 7,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    💡 CONSEJO DE EXPERTO
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    {displayResult.consejo_experto}
                  </p>
                </div>
                <div
                  style={{
                    background: "rgba(16,185,129,0.07)",
                    border: "1px solid rgba(16,185,129,0.18)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#34d399",
                      marginBottom: 7,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    {listingResult ? "✅ OFERTA REAL PRESELECCIONADA" : "🧭 BÚSQUEDA DE OFERTA REAL"}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    {listingResult
                      ? `${listingResult.title}${listingResult.price ? ` · ${listingResult.price}` : ""}`
                      : "Indica tu cuota objetivo y lanza la búsqueda para que la IA revise automáticamente varios portales y te traiga una única opción real."}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={showOffersPage}
                  style={{
                    background: "linear-gradient(135deg,#10b981,#059669)",
                    border: "none",
                    color: "white",
                    padding: "12px 20px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 12px 30px rgba(16,185,129,0.18)",
                  }}
                >
                  🚗 Ver tus ofertas
                </button>
              </div>
                </div>
                )}
            </div>
          </div>
          );
        })()}

      {/* ── ERROR ── */}
      {error && (
        <div
          style={{
            maxWidth: 500,
            margin: "60px auto",
            padding: "0 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.22)",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <p style={{ color: "#fca5a5", marginBottom: 16, fontSize: 13 }}>{error}</p>
            <button
              onClick={() => analyzeWithAI(answers)}
              style={{
                background: "#dc2626",
                border: "none",
                color: "white",
                padding: "10px 20px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}

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