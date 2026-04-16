export const USER_DASHBOARD_ROUTE_MAP = {
  home: "/panel",
  saved: "/panel/guardadas",
  appointments: "/panel/citas",
  valuations: "/panel/tasaciones",
  billing: "/panel/cuenta",
  vehicles: "/panel/vehiculos",
};

const OFFER_PROVIDER_ALIASES = {
  LeasePlan: "Ayvens",
  "LeasePlan by Ayvens": "Ayvens",
  ALD: "Ayvens",
  "ALD Automotive": "Ayvens",
  "ALD LeasePlan": "Ayvens",
};

const OFFER_MODEL_HINTS = {
  electrico_puro: ["BYD Dolphin", "MG4 Electric", "Hyundai Kona Electric", "Kia EV3"],
  hibrido_no_enchufable: ["Toyota Corolla Hybrid", "Kia Niro Hybrid", "Hyundai Kona Hybrid", "Ford Puma MHEV", "Kia Sportage MHEV", "Hyundai Tucson MHEV"],
  hibrido_enchufable: ["Kia Niro PHEV", "Hyundai Tucson PHEV", "BYD Seal U DM-i"],
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

const OFFER_IMAGE_PROXY_ENDPOINT = "/api/offer-image";

const OFFER_KNOWN_BRANDS = [
  "alfa romeo", "audi", "bmw", "byd", "citroen", "cupra", "dacia", "ds", "fiat", "ford", "honda", "hyundai", "jaecoo", "jaguar", "jeep",
  "kia", "land rover", "lexus", "lynkco", "mazda", "mercedes", "mg", "mini", "mitsubishi", "nissan", "omoda", "opel", "peugeot", "polestar", "porsche", "renault",
  "seat", "skoda", "smart", "subaru", "suzuki", "tesla", "toyota", "volkswagen", "volvo", "xpeng",
];

export const OFFER_MODEL_FALLBACK_IMAGES = {
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

const LOCAL_VO_IMAGE_FILE_NAMES = [
  "foto-principal.jpg",
  "foto-principal.jpeg",
  "foto-principal.png",
  "foto-principal.webp",
];

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

export function resolveOfferProviderName(source) {
  const normalized = normalizeText(source);
  return OFFER_PROVIDER_ALIASES[normalized] || normalized;
}

export function normalizeOfferAssetUrl(value) {
  return normalizeText(value)
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\{size\}/g, "768x432-");
}

export function buildOfferModelSuggestions(answers = {}, resultData = {}) {
  const priorityMap = answers?.ponderacion_score_personalizada && typeof answers.ponderacion_score_personalizada === "object"
    ? answers.ponderacion_score_personalizada
    : {};
  const getPriority = (key) => {
    const numeric = Number(priorityMap?.[key]);
    return Number.isInteger(numeric) ? numeric : 3;
  };
  const brandPriority = getPriority("marca_preferencia");
  const viablePropulsions = Array.isArray(resultData?.propulsiones_viables)
    ? resultData.propulsiones_viables.map((item) => normalizeText(item).toLowerCase())
    : [];
  const chinaForward = answers?.marca_preferencia === "nueva_china"
    || /vehicul[oa] chino|marca[s]? china[s]?|tecnologia de vanguardia|byd|mg\b|xpeng|omoda|jaecoo/i.test(
      `${resultData?.solucion_principal?.titulo || ""} ${resultData?.solucion_principal?.resumen || ""}`
    );
   // Handle propulsion_preferida as either single value or array
   const propulsionHints = Array.isArray(answers?.propulsion_preferida)
     ? answers.propulsion_preferida.flatMap((p) => OFFER_MODEL_HINTS[p] || [])
     : (OFFER_MODEL_HINTS[answers?.propulsion_preferida] || []);
   const dynamic = [
     normalizeText(answers?.modelo_objetivo),
     ...propulsionHints,
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

  const preferredBrandModels = OFFER_BRAND_HINTS[answers?.marca_preferencia] || [];
  const preferredBrandTokens = preferredBrandModels
    .map((model) => normalizeText(model).split(/\s+/)[0]?.toLowerCase())
    .filter(Boolean);
  const brandFocused = brandPriority >= 5 && preferredBrandTokens.length > 0
    ? filtered.filter((model) => preferredBrandTokens.some((token) => normalizeText(model).toLowerCase().startsWith(token)))
    : filtered;

  const source = brandFocused.length > 0 ? brandFocused : filtered;

  return [...new Set(source.filter(Boolean))].slice(0, 5);
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

    // Coches.net and OcasionPlus individual listings
    if (/\/coches-ocasion\/[^/]+\/[^/]+|\/vehiculos-ocasion\/[^/]+\/[^/]+|\/detalle\/|\/ficha\//.test(path)) {
      return true;
    }

    // Autohero: /es/cars/12345 or /es/used-cars/...
    if (/autohero\.com/.test(host) && /\/(?:es\/)?cars?\/\w+/.test(path)) {
      return true;
    }

    // Flexicar: /coches-segunda-mano/brand/model/...
    if (/flexicar\.es/.test(host) && /\/coches-segunda-mano\/[^/]+\/[^/]+/.test(path)) {
      return true;
    }

    // Spoticar: /es/vehiculos/...
    if (/spoticar\.es/.test(host) && /\/vehiculos\/[^/]+/.test(path)) {
      return true;
    }

    // AutoScout24: /es/annonce/... or /lst/
    if (/autoscout24\.es/.test(host) && /\/annonce\/|\/anuncio\//.test(path)) {
      return true;
    }

    // Das WeltAuto: /es/coches/...
    if (/dasweltauto\.es/.test(host) && /\/coches\/[^/]+\/[^/]+/.test(path)) {
      return true;
    }

    // Clicars: /es/vehiculos/... or /ficha/
    if (/clicars\.com/.test(host) && /\/vehiculos\/[^/]+|\/ficha\//.test(path)) {
      return true;
    }

    // Generic: URL with numeric or UUID-style ID anywhere in path
    return /\/id\/[a-f0-9-]+|\/\d{5,}(?:[^/]|$)/.test(path);
  } catch {
    return false;
  }
}

export function getOfferNavigationUrl(offer, resultData) {
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

export function getOfferFallbackSearchUrl(offer = {}, resultData = {}) {
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

export function getUserDashboardPageFromPath(pathname = "") {
  const normalizedPath = String(pathname || "")
    .replace(/\/+$/, "")
    .toLowerCase() || "/";

  const aliasRouteMap = {
    "/panel/inicio": "home",
    "/panel/oportunidades": "saved",
    "/panel/operaciones": "appointments",
    "/panel/operaciones/citas": "appointments",
    "/panel/operaciones/tasaciones": "valuations",
    "/panel/vehiculos/mis-vehiculos": "vehicles",
    "/panel/perfil": "billing",
    "/panel/facturacion": "billing",
  };

  if (normalizedPath === "/panel" || normalizedPath === "/panel/resumen" || normalizedPath === "/panel/home") {
    return "home";
  }

  if (aliasRouteMap[normalizedPath]) {
    return aliasRouteMap[normalizedPath];
  }

  const matchedSection = Object.entries(USER_DASHBOARD_ROUTE_MAP).find(([, path]) => path === normalizedPath);
  return matchedSection?.[0] || null;
}

export function getUserDashboardPath(page = "home") {
  return USER_DASHBOARD_ROUTE_MAP[page] || USER_DASHBOARD_ROUTE_MAP.home;
}

export function slugifyOfferFolderName(offer = {}) {
  const base = normalizeText(offer?.imageFolder || offer?.title || `${offer?.brand || ""} ${offer?.model || ""}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "coche-sin-nombre";
}

export function buildOfferLocalImageCandidates(offer = {}) {
  const folder = slugifyOfferFolderName(offer);
  return LOCAL_VO_IMAGE_FILE_NAMES.map((fileName) => `/vo-images/${folder}/${fileName}`);
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

export function buildOfferImageSearchQuery(offer = {}) {
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

export function hasOfferRealImage(offer = {}) {
  return Boolean(normalizeOfferAssetUrl(offer?.image) || buildOfferImageSearchQuery(offer)) && !Boolean(offer?.synthetic);
}

export function buildImageSearchProxyUrl(query = "") {
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

export function buildImageProxyUrl(value) {
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

export function buildOfferPlaceholderImage(offer = {}) {
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

export function openOfferInNewTab(url) {
  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function buildSearchCoverageSummary(coverage = null) {
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

export function getOfferBadgeStyle(tone = "slate") {
  const toneMap = {
    green: {
      background: "rgba(16,185,129,0.14)",
      border: "1px solid rgba(16,185,129,0.26)",
      color: "#065f46",
    },
    success: {
      background: "rgba(16,185,129,0.17)",
      border: "1px solid rgba(16,185,129,0.34)",
      color: "#065f46",
    },
    amber: {
      background: "rgba(245,158,11,0.14)",
      border: "1px solid rgba(245,158,11,0.3)",
      color: "#92400e",
    },
    info: {
      background: "rgba(37,99,235,0.14)",
      border: "1px solid rgba(96,165,250,0.28)",
      color: "#1e3a8a",
    },
    neutral: {
      background: "rgba(148,163,184,0.1)",
      border: "1px solid rgba(148,163,184,0.16)",
      color: "#334155",
    },
    slate: {
      background: "rgba(148,163,184,0.12)",
      border: "1px solid rgba(148,163,184,0.22)",
      color: "#334155",
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

export function getOfferTrustBadges(offer = {}) {
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
