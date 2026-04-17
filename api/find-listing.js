const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const COMPANY_SITE_HINTS = {
  "Ayvens": "ayvens.com",
  "LeasePlan": "ayvens.com",
  "LeasePlan by Ayvens": "ayvens.com",
  "ALD": "ayvens.com",
  "ALD Automotive": "ayvens.com",
  "Arval": "arval.es",
  "Alphabet": "alphabet.es",
  "Bipi": "bipicar.com",
  "Kinto": "kinto-mobility.es",
  "LeaseCom": "leasecom.es",
  "Athlon": "athlon.com",
  "Idoneo": "idoneo.es",
  "Coches.net": "coches.net",
  "Autohero": "autohero.com",
  "Spoticar": "spoticar.es",
  "Flexicar": "flexicar.es",
  "OcasionPlus": "ocasionplus.com",
  "Clicars": "clicars.com",
  "AutoScout24": "autoscout24.es",
  "Das WeltAuto": "dasweltauto.es",
  "Autoocasion": "autoocasion.com",
  "Milanuncios": "milanuncios.com",
  "Cars&Cars": "carsandcars.es",
  "Coches.com": "coches.com",
  "Concesionario oficial": "coches.net",
  "Northgate": "northgate.es",
  "Free2move": "free2move.com",
  "OK Mobility": "okmobility.com",
  "Enterprise": "enterprise.es",
  "Sixt": "sixt.es",
  "Zity": "zity.es",
  "Wible": "wible.es",
  "Swipcar": "swipcar.com",
  "Vamos": "vamos.es",
  "Yoyomove": "yoyomove.com",
};

const COMPANY_DIRECT_URLS = {
  "Ayvens": {
    renting: ["https://www.ayvens.com/es-es/", "https://ofertas-renting.ayvens.es/ofertas/"],
    compra: ["https://www.ayvens.com/es-es/nuestros-vehiculos/vehiculos-usados/"],
  },
  "LeasePlan": {
    renting: ["https://www.ayvens.com/es-es/", "https://ofertas-renting.ayvens.es/ofertas/"],
    compra: ["https://www.ayvens.com/es-es/nuestros-vehiculos/vehiculos-usados/"],
  },
  "LeasePlan by Ayvens": {
    renting: ["https://www.ayvens.com/es-es/", "https://ofertas-renting.ayvens.es/ofertas/"],
    compra: ["https://www.ayvens.com/es-es/nuestros-vehiculos/vehiculos-usados/"],
  },
  "ALD": {
    renting: ["https://www.ayvens.com/es-es/", "https://ofertas-renting.ayvens.es/ofertas/"],
    compra: ["https://www.ayvens.com/es-es/nuestros-vehiculos/vehiculos-usados/"],
  },
  "ALD Automotive": {
    renting: ["https://www.ayvens.com/es-es/", "https://ofertas-renting.ayvens.es/ofertas/"],
    compra: ["https://www.ayvens.com/es-es/nuestros-vehiculos/vehiculos-usados/"],
  },
  "Arval": {
    renting: ["https://www.arval.es/", "https://www.arval.es/ofertas-renting"],
    compra: ["https://www.arval.es/vehiculos-ocasion"],
  },
  "Northgate": {
    renting: ["https://www.northgate.es/", "https://www.northgate.es/renting/particulares"],
    compra: ["https://www.northgate.es/vehiculos-ocasion/catalogo"],
  },
  "OK Mobility": {
    renting: ["https://okmobility.com/es/renting", "https://okmobility.com/es/alquiler-coches"],
    compra: [],
  },
  "Free2move": {
    renting: ["https://www.free2move.com/es-ES/car-on-demand"],
    compra: [],
  },
  "Enterprise": {
    renting: ["https://www.enterprise.es/es/alquiler-de-coches.html"],
    compra: [],
  },
  "Sixt": {
    renting: ["https://www.sixt.es/alquiler-coches/espana/"],
    compra: [],
  },
  "Zity": {
    renting: ["https://zity.es/"],
    compra: [],
  },
  "Wible": {
    renting: ["https://www.wible.es/"],
    compra: [],
  },
  "Alphabet": {
    renting: ["https://www.alphabet.es/"],
    compra: [],
  },
  "Bipi": {
    renting: ["https://bipicar.com/es/", "https://bipicar.com/es/renting"],
    compra: [],
  },
  "Kinto": {
    renting: ["https://kinto-mobility.es/", "https://kinto-mobility.es/renting"],
    compra: [],
  },
  "LeaseCom": {
    renting: ["https://leasecom.es/", "https://leasecom.es/renting-coches/"],
    compra: [],
  },
  "Athlon": {
    renting: ["https://www.athlon.com/es/", "https://www.athlon.com/es/soluciones/renting/"],
    compra: [],
  },
  "Idoneo": {
    renting: ["https://idoneo.es/renting"],
    compra: [],
  },
  "Swipcar": {
    renting: ["https://swipcar.com/es/es/renting"],
    compra: [],
  },
  "Vamos": {
    renting: ["https://vamos.es/renting"],
    compra: [],
  },
  "Yoyomove": {
    renting: ["https://www.yoyomove.com/"],
    compra: [],
  },
  "Flexicar": {
    renting: [],
    compra: ["https://www.flexicar.es/coches-segunda-mano/"],
  },
  "Autohero": {
    renting: [],
    compra: ["https://www.autohero.com/es/search/"],
  },
  "Spoticar": {
    renting: [],
    compra: ["https://www.spoticar.es/coches-ocasion"],
  },
  "Coches.net": {
    renting: [],
    compra: ["https://www.coches.net/segunda-mano/"],
  },
  "OcasionPlus": {
    renting: [],
    compra: ["https://www.ocasionplus.com/coches-ocasion"],
  },
  "Clicars": {
    renting: [],
    compra: ["https://www.clicars.com/coches-segunda-mano"],
  },
  "AutoScout24": {
    renting: [],
    compra: ["https://www.autoscout24.es/lst"],
  },
  "Das WeltAuto": {
    renting: [],
    compra: ["https://www.dasweltauto.es/"],
  },
  "Autoocasion": {
    renting: [],
    compra: ["https://www.autoocasion.com/coches-segunda-mano"],
  },
  "Milanuncios": {
    renting: [],
    compra: ["https://www.milanuncios.com/coches-de-segunda-mano/"],
  },
  "Cars&Cars": {
    renting: [],
    compra: ["https://www.carsandcars.es/coches-segunda-mano/"],
  },
  "Coches.com": {
    renting: [],
    compra: ["https://www.coches.com/coches-segunda-mano/"],
  },
};

const DEFAULT_PLATFORM_GROUPS = {
  renting: ["Ayvens", "Arval", "Northgate", "OK Mobility", "Free2move", "Alphabet", "Bipi", "Kinto", "LeaseCom", "Athlon", "Swipcar", "Vamos", "Yoyomove", "Idoneo"],
  compra: [
    "Flexicar",
    "Autohero",
    "Spoticar",
    "Coches.net",
    "OcasionPlus",
    "Clicars",
    "AutoScout24",
    "Das WeltAuto",
    "Autoocasion",
    "Milanuncios",
    "Cars&Cars",
    "Coches.com",
  ],
};

const PRIORITY_PLATFORM_GROUPS = {
  renting_corto: ["OK Mobility", "Free2move", "Northgate", "Enterprise", "Sixt", "Bipi"],
  rent_a_car: ["Enterprise", "Sixt", "OK Mobility", "Free2move", "Bipi"],
  carsharing: ["Free2move", "Zity", "Wible", "OK Mobility"],
};

const SEARCH_COVERAGE_LIMITS = {
  renting: { companies: 10, pagesPerCompany: 3, detailLinksPerPage: 4, queryLimit: 8, timeBudgetMs: 15000, modelSearches: 5 },
  compra: { companies: 10, pagesPerCompany: 3, detailLinksPerPage: 4, queryLimit: 10, timeBudgetMs: 15000, modelSearches: 6 },
};

const AGGRESSIVE_SEARCH_COVERAGE_LIMITS = {
  renting: { companies: 18, pagesPerCompany: 5, detailLinksPerPage: 7, queryLimit: 16, timeBudgetMs: 32000, modelSearches: 9 },
  compra: { companies: 20, pagesPerCompany: 6, detailLinksPerPage: 8, queryLimit: 18, timeBudgetMs: 32000, modelSearches: 10 },
};

const AGGRESSIVE_SCRAPING_ENABLED = String(process.env.FIND_LISTING_AGGRESSIVE_SCRAPING || "true").toLowerCase() !== "false";

const BRAND_MODEL_MAP = {
  generalista_europea: ["Volkswagen Golf", "Seat Leon", "Renault Captur", "Skoda Octavia"],
  asiatica_fiable: ["Toyota Corolla", "Kia Niro", "Hyundai Kona", "Nissan Qashqai"],
  premium_alemana: ["BMW Serie 1", "Audi A3", "Mercedes Clase A"],
  premium_escandinava: ["Volvo XC40", "Volvo V60"],
  nueva_china: ["BYD Dolphin", "BYD Atto 3", "BYD Seal U DM-i", "MG4 Electric", "MG ZS Hybrid+", "Omoda 5", "Jaecoo 7", "XPeng G6"],
};

const ANSWER_MODEL_MAPS = {
  propulsion_preferida: {
    electrico_puro: ["MG4 Electric", "BYD Dolphin", "Hyundai Kona Electric", "Kia EV3"],
    hibrido_no_enchufable: ["Toyota Corolla Hybrid", "Toyota C-HR Hybrid", "Kia Niro Hybrid", "Hyundai Kona Hybrid"],
    hibrido_enchufable: ["Hyundai Tucson PHEV", "Kia Niro PHEV", "BYD Seal U DM-i", "Mercedes GLA PHEV"],
    microhibrido: ["Kia Sportage MHEV", "Hyundai Tucson MHEV", "Ford Puma MHEV"],
    gasolina: ["Seat Ibiza", "Renault Clio", "Volkswagen T-Roc", "Peugeot 2008"],
    diesel: ["Skoda Octavia", "Volkswagen Tiguan", "Peugeot 3008", "Audi A3"],
    glp_gnc: ["Dacia Sandero", "Dacia Duster", "Seat Leon TGI"],
    indiferente_motor: [],
  },
  entorno_uso: {
    ciudad: ["Toyota Yaris", "Renault Clio", "Seat Ibiza", "MG4 Electric"],
    interurbano: ["Renault Captur", "Seat Leon", "Toyota Corolla", "Skoda Kamiq"],
    autopista: ["Skoda Octavia", "Volkswagen Tiguan", "Hyundai Tucson", "Audi A3"],
    mixto: ["Toyota Corolla", "Kia Niro", "Hyundai Tucson", "Nissan Qashqai"],
  },
  km_anuales: {
    menos_10k: ["Toyota Yaris", "Seat Ibiza", "Renault Clio"],
    "10k_20k": ["Toyota Corolla", "Seat Leon", "Renault Captur"],
    mas_20k: ["Skoda Octavia", "Toyota Corolla Hybrid", "Nissan Qashqai", "Hyundai Tucson"],
  },
  ocupantes: {
    "2_plazas_maletero_pequeno": ["Toyota Yaris", "Seat Ibiza", "Renault Clio"],
    "5_plazas_maletero_medio": ["Toyota Corolla", "Seat Leon", "Renault Captur", "Hyundai Tucson"],
    "7_plazas_maletero_grande": ["Skoda Kodiaq", "Kia Sorento", "Hyundai Santa Fe", "Nissan X-Trail"],
  },
  uso_principal: {
    trabajo_diario: ["Toyota Corolla", "Seat Leon", "Kia Niro"],
    viajes_ocio: ["Hyundai Tucson", "Kia Sportage", "Volkswagen Tiguan"],
    visitas_clientes: ["Audi A3", "BMW Serie 3", "Volvo XC40", "Volkswagen Golf"],
    compras_recados: ["Toyota Yaris", "Renault Clio", "Seat Ibiza"],
    familia: ["Hyundai Tucson", "Kia Sportage", "Toyota Corolla", "Skoda Kodiaq"],
    remolque: ["Kia Sorento", "Hyundai Santa Fe", "Skoda Kodiaq", "Nissan X-Trail"],
  },
};

const BUDGET_HINTS = {
  hasta_200: "hasta 200 euros mes",
  "200_400": "200 400 euros mes",
  "400_700": "400 700 euros mes",
  mas_700: "mas de 700 euros mes",
};

const BUDGET_RANGES = {
  hasta_200: { min: 0, max: 200 },
  "200_400": { min: 200, max: 400 },
  "400_700": { min: 400, max: 700 },
  mas_700: { min: 700, max: Number.POSITIVE_INFINITY },
};

const ANSWER_BUDGET_TO_FILTER = {
  menos_200: "hasta_200",
  "200_350": "200_400",
  "200_400": "200_400",
  "350_500": "400_700",
  "400_700": "400_700",
  mas_500: "400_700",
  mas_700: "mas_700",
};

const CAPITAL_LEVELS = {
  menos_5k: 4000,
  "5k_10k": 7500,
  "10k_20k": 14000,
  mas_20k: 22000,
};

const PROVIDER_TRUST_SCORES = {
  "ayvens.com": 12,
  "ofertas-renting.ayvens.es": 12,
  "arval.es": 12,
  "alphabet.es": 11,
  "northgate.es": 11,
  "okmobility.com": 10,
  "free2move.com": 10,
  "enterprise.es": 10,
  "sixt.es": 10,
  "zity.es": 9,
  "wible.es": 9,
  "swipcar.com": 8,
  "vamos.es": 8,
  "yoyomove.com": 8,
  "bipicar.com": 8,
  "kinto-mobility.es": 9,
  "leasecom.es": 8,
  "athlon.com": 8,
  "idoneo.es": 7,
  "flexicar.es": 11,
  "autohero.com": 10,
  "spoticar.es": 10,
  "coches.net": 9,
  "ocasionplus.com": 10,
  "clicars.com": 10,
  "autoscout24.es": 9,
  "dasweltauto.es": 9,
  "autoocasion.com": 8,
  "milanuncios.com": 7,
  "carsandcars.es": 8,
  "coches.com": 8,
};

const INCOME_HINTS = {
  fijos_estables: "ingresos fijos y estables",
  fijos_variable: "ingresos fijos con variable",
  variables_autonomo: "ingresos variables autonomo",
};

const RENTING_DOMAINS = ["ayvens.com", "arval.es", "alphabet.es", "northgate.es", "free2move.com", "okmobility.com", "enterprise.es", "sixt.es", "zity.es", "wible.es", "swipcar.com", "vamos.es", "yoyomove.com", "bipicar.com", "kinto-mobility.es", "leasecom.es", "athlon.com", "idoneo.es"];
const PURCHASE_DOMAINS = [
  "coches.net",
  "flexicar.es",
  "autohero.com",
  "spoticar.es",
  "ocasionplus.com",
  "clicars.com",
  "autoscout24.es",
  "dasweltauto.es",
  "autoocasion.com",
  "milanuncios.com",
  "carsandcars.es",
  "coches.com",
];
const READABLE_PROXY_DOMAINS = ["coches.net", "ocasionplus.com", "flexicar.es", "autoocasion.com", "coches.com", "milanuncios.com"];
const BRAND_PREFERENCE_KEYWORDS = {
  generalista_europea: ["volkswagen", "seat", "renault", "skoda", "peugeot", "citroen", "dacia"],
  asiatica_fiable: ["toyota", "kia", "hyundai", "nissan", "lexus", "mazda", "honda", "byd", "mg", "xpeng"],
  premium_alemana: ["bmw", "audi", "mercedes"],
  premium_escandinava: ["volvo"],
  nueva_china: ["byd", "mg", "xpeng", "omoda", "jaecoo"],
};

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function safeJsonParse(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(text) {
  const withoutScripts = String(text || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");

  return normalizeText(decodeHtmlEntities(withoutScripts.replace(/<[^>]*>/g, " ")));
}

function cleanListingText(text) {
  return normalizeText(
    decodeHtmlEntities(String(text || ""))
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\{[^}]*\}/g, " ")
      .replace(/url\([^)]*\)/gi, " ")
      .replace(/imgi?\s*[:=][^\s]+/gi, " ")
      .replace(/window\.[\s\S]*$/i, " ")
      .replace(/document\.[\s\S]*$/i, " ")
      .replace(/\b(?:var|let|const)\s+[\w$]+\s*=\s*[\s\S]*$/i, " ")
      .replace(/\s{2,}/g, " ")
  );
}

function removeAccents(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function looksLikeSpecificModelName(text) {
  const normalized = removeAccents(String(text || "")).toLowerCase();

  if (!normalized) {
    return false;
  }

  if (/(renting|compra|vehicul|coche|movilidad|solucion|suscrip|alquiler|carsharing|km0|km 0|ocasion|ocasión|flexible|urbano electrico|urbano eléctrico|ok mobility|ayvens|arval|bipi|kinto|idoneo|yoyomove|swipcar|northgate|free2move|enterprise|sixt|alphabet)/.test(normalized)) {
    return false;
  }

  const tokens = normalized.split(/\s+/).filter((token) => token.length > 1);
  return tokens.length >= 2;
}

function normalizeCompanyAlias(company) {
  const normalized = normalizeText(company);
  if (["LeasePlan", "LeasePlan by Ayvens", "ALD", "ALD Automotive", "ALD LeasePlan"].includes(normalized)) {
    return "Ayvens";
  }
  return normalized;
}

function getCompanyDirectUrl(company, desiredType = "compra") {
  const normalizedCompany = normalizeCompanyAlias(company);
  const direct = COMPANY_DIRECT_URLS[normalizedCompany] || COMPANY_DIRECT_URLS[company];
  if (!direct) {
    return "";
  }

  const key = desiredType === "renting" ? "renting" : "compra";
  return Array.isArray(direct[key]) && direct[key].length > 0 ? direct[key][0] : "";
}

function buildSearchLandingUrl(query) {
  const lowerQuery = removeAccents(String(query || "")).toLowerCase();
  if (/(renting|suscrip|alquiler|carsharing)/.test(lowerQuery)) {
    return "https://ofertas-renting.ayvens.es/ofertas/";
  }
  return "https://www.coches.net/segunda-mano/";
}

function unwrapDuckDuckGoUrl(href) {
  try {
    const resolved = href.startsWith("//")
      ? `https:${href}`
      : href.startsWith("/")
      ? `https://html.duckduckgo.com${href}`
      : href;

    const parsed = new URL(resolved);
    const redirected = parsed.searchParams.get("uddg");
    const finalUrl = redirected ? decodeURIComponent(redirected) : resolved;
    const url = new URL(finalUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function extractSearchResults(html) {
  const results = [];
  const regex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = regex.exec(html))) {
    const url = unwrapDuckDuckGoUrl(decodeHtmlEntities(match[1]));
    const title = stripHtml(match[2]);

    if (!url || !title) {
      continue;
    }

    const host = getDomain(url);
    if (!host || host.includes("duckduckgo.com")) {
      continue;
    }

    results.push({ title, url, source: host });
  }

  return results;
}

function shouldUseReadableMirror(url = "") {
  const domain = getDomain(url);
  return READABLE_PROXY_DOMAINS.some((item) => domain.includes(item));
}

function buildReadableMirrorUrl(url = "") {
  const normalized = String(url || "").trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return "";
  }

  return `https://r.jina.ai/http://${normalized}`;
}

async function fetchReadableMirrorText(url, context, timeoutMs = 4500) {
  const mirrorUrl = buildReadableMirrorUrl(url);
  if (!mirrorUrl) {
    return "";
  }

  try {
    const response = await fetchWithTimeout(mirrorUrl, {
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    }, context ? getRemainingTimeMs(context, timeoutMs) : timeoutMs);
    return await response.text();
  } catch {
    return "";
  }
}

function extractReadableMirrorTitle(text = "") {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const preferred = lines.find((line) => /^#{1,6}\s+/.test(line) || /^#{5}\s*/.test(line));
  if (preferred) {
    return normalizeText(preferred.replace(/^#{1,6}\s*/, ""));
  }

  return "";
}

function extractReadableMirrorImage(text = "", baseUrl = "") {
  const match = String(text || "").match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
  return match ? normalizeProviderAssetUrl(match[1], baseUrl) : "";
}

function extractReadableMirrorLinks(text = "", baseUrl = "") {
  const links = [];
  const source = String(text || "");
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let match;

  while ((match = regex.exec(source))) {
    if ((match.index || 0) > 0 && source[(match.index || 0) - 1] === "!") {
      continue;
    }

    const title = normalizeText(match[1] || "");
    const url = absolutizeUrl(baseUrl, decodeHtmlEntities(match[2] || ""));
    if (!title || !url) {
      continue;
    }

    links.push({ title, url, source: getDomain(url) || getDomain(baseUrl) });
  }

  return dedupeListings(links);
}

function extractReadableMirrorOfferCards(text = "", pageUrl = "", company = "") {
  const cards = [];
  const source = String(text || "");
  const blocks = source.match(/##\s+\[[^\]]+\]\(https?:\/\/[^)]+\)[\s\S]{0,1200}(?=\n##\s+\[|$)/g) || [];

  for (const block of blocks) {
    const titleMatch = block.match(/##\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/i);
    if (!titleMatch) {
      continue;
    }

    const title = normalizeText(titleMatch[1] || "");
    const url = absolutizeUrl(pageUrl, titleMatch[2] || "");
    const price = parsePrice(block);
    const image = extractReadableMirrorImage(block, pageUrl);
    const description = cleanListingText(block)
      .replace(title, "")
      .slice(0, 260);

    if (!title || !url) {
      continue;
    }

    cards.push({
      title,
      url,
      price,
      image,
      source: normalizeCompanyAlias(company) || getDomain(url) || getDomain(pageUrl),
      description: description || `${title} localizado en la oferta real de ${normalizeCompanyAlias(company) || getDomain(pageUrl) || "mercado"}.`,
    });
  }

  const seenUrls = new Set();
  return cards.filter((card) => {
    const key = normalizeText(card?.url || "").toLowerCase();
    if (!key || seenUrls.has(key)) {
      return false;
    }

    seenUrls.add(key);
    return true;
  });
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getMetaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return stripHtml(match[1]);
    }
  }

  return "";
}

function normalizeProviderAssetUrl(url, baseUrl = "") {
  const normalized = decodeHtmlEntities(String(url || ""))
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\{size\}/g, "640x480/")
    .trim();

  return absolutizeUrl(baseUrl, normalized) || normalized;
}

function isUsefulImageUrl(url) {
  const lowered = String(url || "").toLowerCase();

  if (!lowered || !/^https?:\/\//i.test(lowered)) {
    return false;
  }

  if (/(logo|icon|sprite|avatar|placeholder|banner-logo|favicon)/i.test(lowered)) {
    return false;
  }

  if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(lowered)) {
    return true;
  }

  return /\/images?\/|\/media\/|\/uploads?\/|cdn\.|cloudinary|imgix|res\.cloudinary\.com/i.test(lowered);
}

function getBestSrcsetImage(srcset = "", baseUrl = "") {
  const entries = String(srcset || "")
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);

  return normalizeProviderAssetUrl(entries[entries.length - 1] || "", baseUrl);
}

function collectJsonImageCandidates(node, baseUrl = "", bucket = []) {
  if (!node) {
    return bucket;
  }

  if (typeof node === "string") {
    const image = normalizeProviderAssetUrl(node, baseUrl);
    if (isUsefulImageUrl(image)) {
      bucket.push(image);
    }
    return bucket;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectJsonImageCandidates(item, baseUrl, bucket));
    return bucket;
  }

  if (typeof node === "object") {
    if (node.image) {
      collectJsonImageCandidates(node.image, baseUrl, bucket);
    }

    if (node.url && /imageobject/i.test(String(node["@type"] || ""))) {
      collectJsonImageCandidates(node.url, baseUrl, bucket);
    }
  }

  return bucket;
}

function extractPrimaryImage(html, baseUrl = "") {
  const metaCandidates = [
    getMetaContent(html, "og:image"),
    getMetaContent(html, "og:image:url"),
    getMetaContent(html, "twitter:image"),
    getMetaContent(html, "twitter:image:src"),
  ]
    .map((candidate) => normalizeProviderAssetUrl(candidate, baseUrl))
    .filter(isUsefulImageUrl);

  if (metaCandidates.length > 0) {
    return metaCandidates[0];
  }

  const jsonLdCandidates = [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => collectJsonImageCandidates(safeJsonParse(match[1] || ""), baseUrl, []))
    .filter(isUsefulImageUrl);

  if (jsonLdCandidates.length > 0) {
    return jsonLdCandidates[0];
  }

  const srcsetMatches = [...String(html || "").matchAll(/<img[^>]+(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => getBestSrcsetImage(match[1] || "", baseUrl))
    .filter(isUsefulImageUrl);

  if (srcsetMatches.length > 0) {
    return srcsetMatches[0];
  }

  const imageMatches = [...String(html || "").matchAll(/<img[^>]+(?:src|data-src|data-original|data-lazy|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => normalizeProviderAssetUrl(match[1] || "", baseUrl))
    .filter(isUsefulImageUrl);

  return imageMatches[0] || "";
}

function formatVehicleTitle(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deriveVehicleTitleFromUrl(url = "") {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const ignored = new Set(["es", "es-es", "renting", "coches", "coches-ocasion", "vehiculos-ocasion", "ofertas", "search", "detalle", "ficha", "id"]);
    const relevant = segments
      .filter((segment) => {
        const normalized = String(segment || "").toLowerCase();
        return normalized && !ignored.has(normalized) && !/^\d+$/.test(normalized);
      })
      .slice(-4)
      .flatMap((segment) => String(segment || "").split(/[-_]+/))
      .filter((part) => part && !/^\d+$/.test(part));

    return formatVehicleTitle(relevant.join(" "));
  } catch {
    return "";
  }
}

function formatMinorUnitPrice(amountMinorUnits) {
  const amount = Number(amountMinorUnits);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return `${Math.round(amount / 100).toLocaleString("es-ES")} €`;
}

function extractAutoheroSearchListings(html, pageUrl, company = "") {
  const cards = [];
  const content = String(html || "")
    .replace(/\\"/g, '"')
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/");
  const idMatches = [...content.matchAll(/"retailAdId":"([a-f0-9-]+)"/gi)];

  for (const match of idMatches.slice(0, 20)) {
    const start = Math.max(0, Number(match.index || 0) - 1800);
    const end = Math.min(content.length, Number(match.index || 0) + 3200);
    const segment = content.slice(start, end);
    const retailAdId = match[1] || "";
    const manufacturer = formatVehicleTitle(segment.match(/"manufacturer":"([^"]+)"/i)?.[1] || "");
    const model = formatVehicleTitle(segment.match(/"model":"([^"]+)"/i)?.[1] || "");
    const subType = cleanListingText(segment.match(/"subType":"([^"]*)"/i)?.[1] || "");
    const subTypeExtra = cleanListingText(segment.match(/"subTypeExtra":"([^"]*)"/i)?.[1] || "");
    const builtYear = segment.match(/"firstRegistrationYear":(\d{4})/i)?.[1] || segment.match(/"builtYear":(\d{4})/i)?.[1] || "";
    const mileage = segment.match(/"mileage":\{"distance":(\d+)/i)?.[1] || "";
    const priceMinor = segment.match(/"offerPrice":\{"amountMinorUnits":(\d+)/i)?.[1] || segment.match(/"financedPrice":\{"amountMinorUnits":(\d+)/i)?.[1] || "";
    const carUrlTitle = cleanListingText(segment.match(/"carUrlTitle":"([^"]+)"/i)?.[1] || "");
    const imageRaw = segment.match(/"ahMainImageUrl":"([^"]+)"/i)?.[1] || segment.match(/"mainImageUrl":"([^"]+)"/i)?.[1] || "";
    const title = formatVehicleTitle([manufacturer, model, subType, subTypeExtra].filter(Boolean).join(" "));
    const url = retailAdId && carUrlTitle ? `https://www.autohero.com/es/${carUrlTitle}/id/${retailAdId}/` : "";
    const image = normalizeProviderAssetUrl(imageRaw, pageUrl);
    const detailBits = [
      builtYear,
      mileage ? `${Number(mileage).toLocaleString("es-ES")} km` : "",
      formatMinorUnitPrice(priceMinor),
    ].filter(Boolean);

    if (!title || !url) {
      continue;
    }

    cards.push({
      title,
      source: normalizeCompanyAlias(company) || "Autohero",
      url,
      price: formatMinorUnitPrice(priceMinor),
      image: isUsefulImageUrl(image) ? image : "",
      description: detailBits.length
        ? `${title}. ${detailBits.join(" · ")}. Oferta real localizada en ${normalizeCompanyAlias(company) || "Autohero"}.`
        : `${title} localizado en la oferta real de ${normalizeCompanyAlias(company) || "Autohero"}.`,
    });
  }

  return dedupeListings(cards).slice(0, 12);
}

function flattenJsonLdNodes(node, bucket = []) {
  if (!node) {
    return bucket;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => flattenJsonLdNodes(item, bucket));
    return bucket;
  }

  if (typeof node === "object") {
    bucket.push(node);
    if (node["@graph"]) {
      flattenJsonLdNodes(node["@graph"], bucket);
    }
    if (node.itemListElement) {
      flattenJsonLdNodes(node.itemListElement, bucket);
    }
    if (node.mainEntity) {
      flattenJsonLdNodes(node.mainEntity, bucket);
    }
    if (node.item) {
      flattenJsonLdNodes(node.item, bucket);
    }
  }

  return bucket;
}

function extractJsonLdVehicleCards(html, pageUrl, company = "") {
  const cards = [];
  const scripts = [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const script of scripts) {
    const root = safeJsonParse(script[1] || "");
    const nodes = flattenJsonLdNodes(root, []);

    for (const node of nodes) {
      const typeLabel = String(node?.["@type"] || "").toLowerCase();
      const isVehicleLike = /(car|vehicle|product|offer|listing)/.test(typeLabel);
      const name = formatVehicleTitle(node?.name || node?.headline || "");
      const url = absolutizeUrl(pageUrl, node?.url || node?.mainEntityOfPage || "");
      const image = normalizeProviderAssetUrl(node?.image?.url || node?.image || "", pageUrl);
      const offer = node?.offers || node?.priceSpecification || {};
      const priceRaw = offer?.price || offer?.priceSpecification?.price || "";
      const price = Number.isFinite(Number(priceRaw)) ? `${Math.round(Number(priceRaw)).toLocaleString("es-ES")} €` : parsePrice(String(priceRaw || ""));
      const description = cleanListingText(node?.description || "").slice(0, 240);

      if (!isVehicleLike || !name || !url || !isUsefulProviderLink(url) || !isLikelyListing(url, "compra")) {
        continue;
      }

      cards.push({
        title: name,
        source: normalizeCompanyAlias(company) || getDomain(url) || getDomain(pageUrl),
        url,
        price,
        image: isUsefulImageUrl(image) ? image : "",
        description: description || `${name} localizado en la oferta real de ${normalizeCompanyAlias(company) || getDomain(pageUrl) || "mercado"}.`,
      });
    }
  }

  return dedupeListings(cards).slice(0, 18);
}

function extractMarketplaceAnchorCards(html, pageUrl, company = "") {
  const cards = [];
  const domain = getDomain(pageUrl);
  const source = String(html || "");
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const listingPathPattern = /(coches?-de-segunda-mano|coches?-segunda-mano|coches-ocasion|vehiculos-ocasion|\/coche\/?|\-iid\-|\/anuncio\/?|\/ocasion\/?)/i;

  let match;
  while ((match = anchorPattern.exec(source))) {
    const url = absolutizeUrl(pageUrl, decodeHtmlEntities(match[1] || ""));
    if (!url || !isUsefulProviderLink(url) || !isLikelyListing(url, "compra") || !listingPathPattern.test(url)) {
      continue;
    }

    const titleFromAnchor = formatVehicleTitle(stripHtml(match[2] || ""));
    const title = titleFromAnchor || deriveVehicleTitleFromUrl(url);
    if (!title || !looksLikeSpecificModelName(title)) {
      continue;
    }

    const start = Math.max(0, Number(match.index || 0) - 700);
    const end = Math.min(source.length, Number(match.index || 0) + 1200);
    const segment = source.slice(start, end);
    const price = parsePrice(segment);
    const imageRaw = segment.match(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1] || "";
    const image = normalizeProviderAssetUrl(imageRaw, pageUrl);
    const description = cleanListingText(stripHtml(segment)).slice(0, 220);

    cards.push({
      title,
      source: normalizeCompanyAlias(company) || domain || getDomain(url),
      url,
      price,
      image: isUsefulImageUrl(image) ? image : "",
      description: description || `${title} localizado en la oferta real de ${normalizeCompanyAlias(company) || domain || "mercado"}.`,
    });
  }

  return dedupeListings(cards).slice(0, 16);
}

function extractProviderOfferCards(html, pageUrl, company = "") {
  const cards = [];
  const content = String(html || "");

  if (/autohero\.com/i.test(pageUrl) || /autohero/i.test(company)) {
    cards.push(...extractAutoheroSearchListings(content, pageUrl, company));
  }

  cards.push(...extractJsonLdVehicleCards(content, pageUrl, company));

  if (/autoocasion\.com|milanuncios\.com|carsandcars\.es|coches\.com/i.test(pageUrl) || /Autoocasion|Milanuncios|Cars&Cars|Coches\.com/i.test(company)) {
    cards.push(...extractMarketplaceAnchorCards(content, pageUrl, company));
  }

  const cardPattern = /<img[^>]+class="[^"]*offer-card__image[^"]*"[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>[\s\S]*?<h4[^>]*>([^<]+)<\/h4>[\s\S]*?(?:<p[^>]*class="[^"]*text-text-xs[^"]*"[^>]*>([^<]+)<\/p>)?[\s\S]*?<div class="offer-card__new-price">([^<]+)<\/div>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = cardPattern.exec(content))) {
    const image = normalizeProviderAssetUrl(match[1] || "", pageUrl);
    const altTitle = formatVehicleTitle(stripHtml(match[2] || ""));
    const heading = formatVehicleTitle(stripHtml(match[3] || ""));
    const subtitle = cleanListingText(stripHtml(match[4] || ""));
    const price = normalizeText(stripHtml(match[5] || ""));
    const url = absolutizeUrl(pageUrl, decodeHtmlEntities(match[6] || ""));
    const title = heading || altTitle;

    if (!title || !url) {
      continue;
    }

    cards.push({
      title,
      source: normalizeCompanyAlias(company) || getDomain(url) || getDomain(pageUrl),
      url,
      price,
      image: isUsefulImageUrl(image) ? image : "",
      description: subtitle
        ? `${title}. ${subtitle}`
        : `${title} localizado en la oferta real de ${normalizeCompanyAlias(company) || getDomain(pageUrl) || "mercado"}.`,
    });
  }

  return dedupeListings(cards).slice(0, 18);
}

function parseEuroAmount(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,(?=\d{2}$)/, ".");

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function parsePrice(text) {
  const source = cleanListingText(stripHtml(text));
  const matches = [
    ...source.matchAll(/(?:desde\s+)?(\d{2,4}(?:[.\s]\d{3})*(?:,\d{2})?)\s*(?:€|eur)(?:\s*\/?\s*mes|\s*mes)?/gi),
  ];

  if (!matches.length) {
    return "";
  }

  const bestMatch = matches
    .map((match) => ({
      raw: match[1],
      amount: parseEuroAmount(match[1]),
    }))
    .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
    .sort((a, b) => a.amount - b.amount)[0];

  return bestMatch ? `${Math.round(bestMatch.amount)} €` : "";
}

function isPriceWithinBudget(priceText, budgetKey) {
  const range = BUDGET_RANGES[budgetKey];

  if (!range) {
    return true;
  }

  const amount = parseEuroAmount(priceText);
  if (!Number.isFinite(amount)) {
    return false;
  }

  return amount >= range.min && amount <= range.max;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function hasTimeRemaining(context, bufferMs = 0) {
  const deadline = Number(context?.deadline || 0);
  return !deadline || Date.now() + bufferMs < deadline;
}

function getRemainingTimeMs(context, fallbackMs = 8000) {
  const deadline = Number(context?.deadline || 0);

  if (!deadline) {
    return fallbackMs;
  }

  return Math.max(1200, Math.min(fallbackMs, deadline - Date.now()));
}

async function searchDuckDuckGo(query, context) {
  const response = await fetchWithTimeout(SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": USER_AGENT,
      "accept-language": "es-ES,es;q=0.9,en;q=0.8",
    },
    body: `q=${encodeURIComponent(query)}&kl=es-es`,
  }, getRemainingTimeMs(context, 3500));

  if (!response.ok) {
    throw new Error("No se ha podido consultar el buscador externo.");
  }

  return extractSearchResults(await response.text());
}

function buildWhyMatches({ result, answers, filters, company, listing, desiredType }) {
  const reasons = [];
  const viablePropulsions = Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [];
  const usage = Array.isArray(answers?.uso_principal) ? answers.uso_principal : [];
  const solutionType = result?.solucion_principal?.tipo;

  reasons.push(
    solutionType === "rent_a_car"
      ? "He limitado la busqueda a opciones reales de alquiler por días o semanas, no a compra o renting largo."
      : solutionType === "carsharing"
      ? "He limitado la busqueda a opciones reales de carsharing o movilidad flexible de muy corto plazo."
      : desiredType === "renting"
      ? "He limitado la busqueda a ofertas reales de renting, no a anuncios de compra."
      : "He limitado la busqueda a anuncios reales de compra, no a ofertas de renting."
  );

  if (listing?.title) {
    reasons.push(`De las opciones reales accesibles, "${listing.title}" es la que mejor encaja con tu perfil.`);
  }

  if (result?.solucion_principal?.titulo) {
    reasons.push(`Parte de tu recomendacion principal: ${result.solucion_principal.titulo}.`);
  }

  if (answers?.perfil === "empresa" || answers?.perfil === "autonomo") {
    reasons.push("He tenido en cuenta tu uso profesional y la necesidad de una opcion facil de cerrar con stock real.");
  }

  if (answers?.flexibilidad === "renting" || ["renting_largo", "renting_corto"].includes(result?.solucion_principal?.tipo)) {
    reasons.push("Como priorizas cuota fija o flexibilidad, doy mas peso a opciones con disponibilidad inmediata y coste mensual razonable.");
  }

  if (["por_dias", "menos_2_meses", "menos_1_ano", "menos_2", "2_3"].includes(answers?.horizonte)) {
    reasons.push("Tu horizonte es corto, asi que priorizo coches con buena salida y riesgo contenido.");
  } else if (answers?.horizonte === "5_7" || answers?.horizonte === "mas_7") {
    reasons.push("Como piensas mantenerlo varios años, doy mas peso a fiabilidad, TCO y motorizaciones solidas.");
  }

  if (answers?.ocupantes === "7_plazas_maletero_grande") {
    reasons.push("Has marcado 6-7 plazas y maletero grande, por eso priorizo SUVs familiares o modelos de mayor capacidad.");
  } else if (answers?.ocupantes === "5_plazas_maletero_medio") {
    reasons.push("Necesitas 3-5 plazas y maletero medio, asi que priorizo compactos y SUVs familiares equilibrados.");
  } else if (answers?.ocupantes === "2_plazas_maletero_pequeno") {
    reasons.push("Tu necesidad de espacio es contenida, asi que favorezco coches urbanos y eficientes.");
  }

  if (answers?.entorno_uso === "ciudad") {
    reasons.push("Tu entorno dominante es urbano, por eso pesa mas la eficiencia y la comodidad en ciudad.");
  } else if (answers?.entorno_uso === "autopista") {
    reasons.push("Como haces mucha autopista, priorizo modelos mas estables y comodos en trayectos largos.");
  }

  if (answers?.km_anuales === "mas_20k") {
    reasons.push("Haces muchos kilometros al año, asi que busco opciones con mejor TCO para uso intensivo.");
  }

  if (usage.includes("familia")) {
    reasons.push("El uso familiar hace que priorice modelos polivalentes y comodos en el dia a dia.");
  }

  if (usage.includes("remolque")) {
    reasons.push("Tambien he tenido en cuenta la necesidad de remolque, reforzando modelos mas capaces.");
  }

  if (answers?.marca_preferencia && BRAND_MODEL_MAP[answers.marca_preferencia]?.length) {
    reasons.push("He respetado tu preferencia de marca o posicionamiento para acercar la oferta a lo que realmente encaja contigo.");
  }

  if (answers?.vehiculo_actual === "si_entrego") {
    reasons.push("Como entregarias un vehiculo actual, doy valor a operaciones mas faciles de cerrar con stock disponible.");
  }

  if (viablePropulsions.length) {
    reasons.push(`He cruzado las propulsiones viables detectadas: ${viablePropulsions.slice(0, 2).join(", ")}.`);
  }

  if (company || (Array.isArray(filters?.companies) && filters.companies.length > 1)) {
    reasons.push("He rastreado varias plataformas y solo te muestro la coincidencia real que mejor encaja con tu perfil.");
  }

  if (filters?.budget && BUDGET_HINTS[filters.budget]) {
    reasons.push(`Tambien se ha tenido en cuenta tu franja economica: ${BUDGET_HINTS[filters.budget]}.`);
  }

  if (filters?.income && INCOME_HINTS[filters.income]) {
    reasons.push(`Y tu contexto financiero: ${INCOME_HINTS[filters.income]}.`);
  }

  return uniq(reasons).slice(0, 6);
}

function getProfileBrandKeywords(answers, models = []) {
  const fromPreference = BRAND_PREFERENCE_KEYWORDS[answers?.marca_preferencia] || [];
  const knownBrands = [
    "volkswagen", "seat", "renault", "skoda", "toyota", "kia", "hyundai", "nissan",
    "bmw", "audi", "mercedes", "volvo", "byd", "mg", "xpeng", "omoda", "jaecoo", "peugeot", "citroen", "dacia",
  ];
  const explicitBrand = removeAccents(normalizeText(answers?.marca_objetivo)).toLowerCase();
  const fromExplicitBrand = knownBrands.includes(explicitBrand) ? [explicitBrand] : [];
  const fromModels = models
    .map((model) => {
      const normalized = removeAccents(model).toLowerCase();
      return knownBrands.find((brand) => normalized.startsWith(brand)) || "";
    })
    .filter(Boolean);

  return uniq([...fromExplicitBrand, ...fromPreference, ...fromModels]);
}

function getOfferPriorityMap(answers = {}) {
  const raw = answers?.ponderacion_score_personalizada;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function getOfferPriorityRank(answers, key) {
  const numeric = Number(getOfferPriorityMap(answers)?.[key]);
  return Number.isInteger(numeric) ? numeric : 3;
}

function getPriorityMultiplier(rank, low = 0.45, high = 1.9) {
  const clamped = Math.max(1, Math.min(5, Number(rank) || 3));
  const ratio = (clamped - 1) / 4;
  return low + (high - low) * ratio;
}

function getAllowedAgeBuckets(answers = {}) {
  const selected = answers?.antiguedad_vehiculo_buscada;
  if (!Array.isArray(selected) || selected.length === 0 || selected.includes("indiferente")) {
    return [];
  }

  return selected.filter(Boolean);
}

function inferListingYear(listing, rawText = "") {
  const explicitYear = Number(listing?.builtYear || listing?.year || 0);
  if (Number.isInteger(explicitYear) && explicitYear >= 2000 && explicitYear <= new Date().getFullYear() + 1) {
    return explicitYear;
  }

  const match = String(rawText || "").match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function resolveAgeBucketFromYear(year) {
  if (!Number.isInteger(year)) {
    return "";
  }

  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - year);

  if (age === 0) return "cero_anos";
  if (age <= 2) return "0_2_anos";
  if (age <= 4) return "2_4_anos";
  if (age <= 7) return "4_7_anos";
  return "mas_7_anos";
}

function scoreAgePreference(listing, rawText, answers) {
  const agePriority = getOfferPriorityRank(answers, "antiguedad_vehiculo_buscada");
  const allowedBuckets = getAllowedAgeBuckets(answers);
  if (allowedBuckets.length === 0) {
    return 0;
  }

  const year = inferListingYear(listing, rawText);
  const bucket = resolveAgeBucketFromYear(year);
  if (!bucket) {
    return agePriority >= 5 ? -6 : agePriority >= 4 ? -3 : 0;
  }

  const matched = allowedBuckets.includes(bucket);
  if (matched) {
    return Math.round(8 * getPriorityMultiplier(agePriority, 0.6, 2));
  }

  return -Math.round(8 * getPriorityMultiplier(agePriority, 0.6, 2.5));
}

function isChinaForwardPreference(result, answers) {
  const combined = removeAccents(
    `${result?.solucion_principal?.titulo || ""} ${result?.solucion_principal?.resumen || ""} ${answers?.marca_preferencia || ""} ${answers?.marca_objetivo || ""} ${answers?.modelo_objetivo || ""}`
  ).toLowerCase();

  return answers?.marca_preferencia === "nueva_china"
    || /(vehicul[oa] chino|marca[s]? china[s]?|tecnologia de vanguardia|byd|mg\b|xpeng|omoda|jaecoo|seal u|atto 3|dolphin|mg4)/.test(combined);
}

function countTokenHits(haystack, tokens) {
  return uniq(tokens).reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
}

function hasConcreteModelSignal(listing, models = []) {
  const haystack = removeAccents(`${listing?.title || ""} ${listing?.url || ""}`).toLowerCase();

  if (/\/coches-ocasion\/|\/detalle\/|\/ficha\/|\/id\/[a-f0-9-]+|-[0-9]+-covo\.aspx(?:\?|$)/.test(String(listing?.url || "").toLowerCase())) {
    return true;
  }

  return models.filter(looksLikeSpecificModelName).some((model) => {
    const tokens = removeAccents(model)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);

    if (!tokens.length) {
      return false;
    }

    const hits = tokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
    return hits >= Math.min(2, tokens.length);
  });
}

function getObjectiveModelTokens(answers = {}) {
  return removeAccents(normalizeText(answers?.modelo_objetivo))
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 1 || /\d/.test(token));
}

function hasExplicitObjectiveMatch(listing, answers = {}) {
  const objectiveTokens = getObjectiveModelTokens(answers);
  if (!objectiveTokens.length) {
    return true;
  }

  const haystack = removeAccents(`${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""}`).toLowerCase();
  return objectiveTokens.every((token) => haystack.includes(token));
}

function looksLikeGenericNonVehiclePage(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(punto de recarga|recarga electrica|wallbox|cargador|grandes empresas|gestion de flotas|movilidad empresarial|consultoria|telemetria|sobre nosotros|blog|noticias|actualidad|contacto|preguntas frecuentes|faq|guia para conductores|guia de compra|consejos|ventajas fiscales|ventajas del renting|soluciones de movilidad|movilidad para empresas|algo en tu navegador nos hizo pensar que eres un bot|ups! parece que algo no va bien|ups parece que algo no va bien|eres un bot)/.test(haystack);
}

function hasMonthlyPriceSignal(text) {
  return /(?:\b\d{2,4}\s*(?:€|eur)\s*(?:\/?\s*mes|mes)|desde\s+\d{2,4}\s*(?:€|eur))/i.test(String(text || ""));
}

function looksLikeVehicleOffer(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(coche|vehiculo|turismo|compacto|suv|berlina|utilitario|todoterreno|furgoneta|electrico|hibrid|gasolina|diesel|km\/ano|km ano)/.test(haystack);
}

function scorePreferredFuel(haystack, preferredFuel, viableFuel) {
  let score = 0;

  if ((preferredFuel.includes("electrico") || viableFuel.includes("electrico")) && /(electric|electrico|bev|ev |cero emisiones)/.test(haystack)) {
    score += preferredFuel.includes("electrico") ? 18 : 10;
  } else if (preferredFuel.includes("electrico")) {
    score -= 6;
  }

  if ((preferredFuel.includes("hibrido") || preferredFuel.includes("phev") || viableFuel.includes("hibrid") || viableFuel.includes("phev")) && /(hybrid|hibrid|phev)/.test(haystack)) {
    score += preferredFuel.includes("hibrido") || preferredFuel.includes("phev") ? 14 : 8;
  }

  if (preferredFuel.includes("microhibrido") && /(mhev|microhibrid)/.test(haystack)) {
    score += 10;
  }

  if (preferredFuel.includes("diesel") && /diesel/.test(haystack)) {
    score += 12;
  }

  if (preferredFuel.includes("gasolina") && /gasolina/.test(haystack)) {
    score += 10;
  }

  return score;
}

function getPreferredFuelString(answers = {}) {
  const value = answers?.propulsion_preferida;
  if (Array.isArray(value)) {
    return value.join(" ");
  }
  return String(value || "");
}

function getEffectiveBudgetKey(filters = {}, answers = {}, desiredType = "compra") {
  if (filters?.budget && BUDGET_RANGES[filters.budget]) {
    return filters.budget;
  }

  if (desiredType === "renting" || ["propiedad_contado", "propiedad_financiada", "renting", "flexible"].includes(answers?.flexibilidad)) {
    return ANSWER_BUDGET_TO_FILTER[answers?.cuota_mensual] || "";
  }

  return "";
}

function getBudgetFitInfo(priceText, budgetKey, desiredType) {
  const amount = parseEuroAmount(priceText);

  if (!Number.isFinite(amount)) {
    return {
      score: desiredType === "renting" ? -8 : -2,
      within: false,
      amount: null,
      label: desiredType === "renting" ? "Sin precio mensual visible" : "Sin precio visible",
    };
  }

  if (budgetKey && BUDGET_RANGES[budgetKey]) {
    const range = BUDGET_RANGES[budgetKey];

    if (amount >= range.min && amount <= range.max) {
      return {
        score: 20,
        within: true,
        amount,
        label: `Dentro de tu presupuesto objetivo (${Math.round(amount)} €)`,
      };
    }

    const distance = amount < range.min ? range.min - amount : amount - range.max;
    const penalty = Math.round(distance / (desiredType === "renting" ? 18 : 500));
    return {
      score: Math.max(-18, 10 - penalty),
      within: false,
      amount,
      label:
        amount < range.min
          ? `Por debajo de la franja prevista (${Math.round(amount)} €)`
          : `Se sale del presupuesto marcado (${Math.round(amount)} €)`,
    };
  }

  return {
    score: desiredType === "renting" ? Math.max(4, 18 - amount / 30) : Math.max(3, 14 - amount / 3000),
    within: null,
    amount,
    label: `Precio detectado: ${Math.round(amount)} €`,
  };
}

function getBudgetPriorityScore(priceText, budgetKey, desiredType, answers = {}) {
  const effectiveBudgetKey = budgetKey || getEffectiveBudgetKey({}, answers, desiredType);
  return getBudgetFitInfo(priceText, effectiveBudgetKey, desiredType).score;
}

function getProviderTrustScore(listing, context) {
  const source = getDomain(listing?.url || listing?.source || "");
  const normalizedSource = String(source || "").replace(/^www\./, "");
  const preferredCompany = normalizeText(context?.company);
  const preferredDomain = String(COMPANY_SITE_HINTS[preferredCompany] || "").replace(/^www\./, "");
  const companies = Array.isArray(context?.companies) ? context.companies : [];

  let score = PROVIDER_TRUST_SCORES[normalizedSource] || 0;

  if (preferredDomain && normalizedSource.includes(preferredDomain)) {
    score += 6;
  }

  if (
    companies.some((item) => {
      const domainHint = String(COMPANY_SITE_HINTS[item] || "").replace(/^www\./, "");
      return (domainHint && normalizedSource.includes(domainHint)) || normalizedSource.includes(removeAccents(String(item || "")).toLowerCase());
    })
  ) {
    score += 4;
  }

  return score;
}

function getPracticalFitScore(rawText, listing, context) {
  const haystack = removeAccents(String(rawText || "")).toLowerCase();
  const amount = parseEuroAmount(listing?.price);
  const quickValidation = context.answers?.validacion_rapida || {};
  let score = 0;

  if (context.answers?.gestion_riesgo === "alto") {
    score += Number.isFinite(amount) || hasMonthlyPriceSignal(rawText) ? 6 : -6;
  }

  if (context.answers?.zbe_impacto === "alta" && /(hybrid|hibrid|phev|electric|electrico|eco|cero)/.test(haystack)) {
    score += 6;
  }

  if (context.answers?.garaje === "sin_garaje" && /(electric|electrico)\b/.test(haystack) && !/(phev|hybrid|hibrid)/.test(haystack)) {
    score -= 8;
  }

  if (context.answers?.garaje === "garaje_cargador" && /(electric|electrico|phev)/.test(haystack)) {
    score += 4;
  }

  if (quickValidation.carga_casa === "no" && /(electric|electrico)\b/.test(haystack)) {
    score -= 10;
  }

  if (quickValidation.carga_publica === "no" && /(electric|electrico|phev)/.test(haystack)) {
    score -= 6;
  }

  if (quickValidation.viajes_largos === "si" && /(electric|electrico|phev|hybrid|hibrid)/.test(haystack)) {
    score += 3;
  }

  if (quickValidation.permanencia_ok === "si" && context.desiredType === "renting") {
    score += 4;
  }

  if (quickValidation.permanencia_ok === "no" && context.desiredType === "renting") {
    score -= 6;
  }

  if (quickValidation.km_estables === "si" && context.desiredType === "renting") {
    score += 3;
  }

  if (quickValidation.cuota_comoda === "no" && Number.isFinite(amount)) {
    score -= 5;
  }

  if (quickValidation.riesgo_controlado === "no" && context.desiredType === "compra") {
    score -= 6;
  }

  if (context.desiredType === "compra" && context.answers?.capital_propio === "menos_5k" && Number.isFinite(amount) && amount > 30000) {
    score -= 8;
  }

  if (context.desiredType === "compra" && context.answers?.capital_propio && CAPITAL_LEVELS[context.answers.capital_propio] >= 10000 && Number.isFinite(amount) && amount <= 28000) {
    score += 4;
  }

  return score;
}

function buildRankingSignals(listing, context, { budgetFit, providerTrustScore, practicalFitScore }) {
  const rawText = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.price || ""}`;
  const haystack = removeAccents(rawText).toLowerCase();

  // Profile-match signals: shown as tags and used as positionReason text
  const profileSignals = [];
  const preferredBrands = getProfileBrandKeywords(context.answers, context.models || []);
  const preferredFuel = removeAccents(getPreferredFuelString(context.answers)).toLowerCase();
  const brandPriority = getOfferPriorityRank(context.answers, "marca_preferencia");
  const fuelPriority = getOfferPriorityRank(context.answers, "propulsion_preferida");

  if (
    preferredBrands.length > 0 &&
    context.answers?.marca_preferencia !== "sin_preferencia" &&
    preferredBrands.some((b) => haystack.includes(b))
  ) {
    const brandLabel = {
      premium_alemana: "Marca premium alemana",
      premium_escandinava: "Marca premium escandinava",
      asiatica_fiable: "Marca asiática de confianza",
      generalista_europea: "Marca generalista europea",
      nueva_china: "Marca china de nueva generación",
    }[context.answers.marca_preferencia] || "Marca preferida detectada";
    profileSignals.push(brandLabel);
  }

  if (preferredFuel && scorePreferredFuel(haystack, preferredFuel, preferredFuel) > 0) {
    const fuelNames = {
      diesel: "Motorización diésel",
      gasolina: "Motorización gasolina",
      hibrido: "Híbrido detectado",
      electrico: "Eléctrico puro",
      phev: "Híbrido enchufable",
    };
    const fuelKey = Object.keys(fuelNames).find((k) => preferredFuel.includes(k));
    if (fuelKey) profileSignals.push(fuelNames[fuelKey]);
  }

  if (context.answers?.entorno_uso === "ciudad" && /(yaris|clio|ibiza|polo|208|i20|hybrid|electrico|bmw.*1|serie 1|a1|golf|leon)/.test(haystack)) {
    profileSignals.push("Buen encaje para uso urbano");
  } else if (context.answers?.entorno_uso === "autopista" && /(tdi|diesel|diésel|hybrid|xc|a4|a6|serie 3|octavia|touareg|qashqai)/.test(haystack)) {
    profileSignals.push("Buen encaje para autopista");
  }

  if (context.answers?.zbe_impacto === "alta" && /(hybrid|hibrid|phev|electric|electrico|eco|cero)/.test(haystack)) {
    profileSignals.push("Encaja con ZBE y uso urbano");
  }

  if (context.answers?.km_anuales === "mas_20k" && /(diesel|di.sel|hybrid|octavia|corolla|qashqai|tucson)/.test(haystack)) {
    profileSignals.push("Eficiente para muchos km");
  }

  // Quality/trust signals: shown as tags but NOT used as positionReason
  const qualitySignals = [];
  if (listing?.hasRealImage || isUsefulImageUrl(listing?.image)) {
    qualitySignals.push("Foto real del anuncio");
  }
  if (budgetFit?.label) {
    qualitySignals.push(budgetFit.label);
  }
  if (providerTrustScore >= 10) {
    qualitySignals.push(`Fuente priorizada: ${listing?.source || "portal fiable"}`);
  }
  if (matchesDesiredListingType(listing, context.desiredType)) {
    qualitySignals.push(context.desiredType === "renting" ? "Tipo correcto: renting / suscripción" : "Tipo correcto: compra / ocasión");
  }
  if (context.answers?.gestion_riesgo === "alto" && practicalFitScore >= 4) {
    qualitySignals.push("Precio visible: menos riesgo");
  }

  // Profile signals first so positionReason picks them; quality signals trail
  return uniq([...profileSignals, ...qualitySignals]).slice(0, 5);
}

function scoreListingForProfile(listing, { result, answers, filters, company, models = [], desiredType }) {
  const rawText = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.price || ""}`;
  const haystack = removeAccents(rawText).toLowerCase();
  const preferredBrands = getProfileBrandKeywords(answers, models);
  const preferredFuel = removeAccents(getPreferredFuelString(answers)).toLowerCase();
  const viableFuel = removeAccents(
    Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables.join(" ") : ""
  ).toLowerCase();
  const brandPriority = getOfferPriorityRank(answers, "marca_preferencia");
  const fuelPriority = getOfferPriorityRank(answers, "propulsion_preferida");
  const seatsPriority = getOfferPriorityRank(answers, "ocupantes");
  const monthlyPriceSignal = hasMonthlyPriceSignal(rawText);
  const vehicleOfferSignal = looksLikeVehicleOffer(rawText);
  const genericNonVehicle = looksLikeGenericNonVehiclePage(rawText);
  const brandHits = countTokenHits(haystack, preferredBrands);
  const chinaForward = isChinaForwardPreference(result, answers);
  const chineseBrandSignal = /(byd|mg\b|xpeng|omoda|jaecoo|seal u|atto 3|dolphin|mg4|zs hybrid|hs phev)/.test(haystack);
  const solutionType = result?.solucion_principal?.tipo;
  const rentACarSignal = hasRentACarSignals(rawText);
  const carsharingSignal = hasCarsharingSignals(rawText);
  const effectiveBudgetKey = getEffectiveBudgetKey(filters, answers, desiredType);
  const budgetFit = getBudgetFitInfo(listing?.price, effectiveBudgetKey, desiredType);
  const matchesBudget = desiredType !== "renting" || !effectiveBudgetKey || budgetFit.within !== false;

  let score = 0;
  let exactModelMatches = 0;

  if (company && haystack.includes(removeAccents(company).toLowerCase())) {
    score += 6;
  }

  for (const model of models) {
    const tokens = removeAccents(model)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);
    const hits = tokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);

    if (hits === tokens.length && hits > 0) {
      exactModelMatches += 1;
      score += 12;
      continue;
    }

    score += hits * 2;
  }

  // Brand score: priority multiplier + a guaranteed floor so that a brand-matched listing
  // always beats a non-matching one even when the user rated brand importance at 1.
  const brandScoreRaw = Math.round(brandHits * 4 * getPriorityMultiplier(brandPriority, 0.35, 2.3));
  const brandFloor = (brandHits > 0 && preferredBrands.length > 0 && answers?.marca_preferencia !== "sin_preferencia") ? 5 : 0;
  score += Math.max(brandScoreRaw, brandFloor);
  score += Math.round(scorePreferredFuel(haystack, preferredFuel, viableFuel) * getPriorityMultiplier(fuelPriority, 0.45, 2.1));

  if (answers?.marca_preferencia && answers.marca_preferencia !== "sin_preferencia" && brandHits === 0) {
    score -= Math.round((chinaForward ? 14 : 5) * getPriorityMultiplier(brandPriority, 0.2, 2.8));
  }

  if (chinaForward) {
    score += chineseBrandSignal ? 14 : -18;
  }

  if (answers?.ocupantes === "7_plazas_maletero_grande" && /(kodiaq|sorento|santa fe|x-trail|5008|tourneo)/.test(haystack)) {
    score += Math.round(4 * getPriorityMultiplier(seatsPriority, 0.5, 2));
  }
  if (answers?.ocupantes === "5_plazas_maletero_medio" && /(corolla|leon|captur|qashqai|tucson|sportage|octavia|kona|niro|dolphin|mg4|ev3)/.test(haystack)) {
    score += Math.round(4 * getPriorityMultiplier(seatsPriority, 0.5, 2));
  }
  if (answers?.ocupantes === "2_plazas_maletero_pequeno" && /(yaris|clio|ibiza|polo|208|i20|micra)/.test(haystack)) {
    score += Math.round(4 * getPriorityMultiplier(seatsPriority, 0.5, 2));
  }

  score += scoreAgePreference(listing, rawText, answers);

  if (answers?.entorno_uso === "ciudad" && /(yaris|clio|ibiza|polo|208|i20|mg4|dolphin|kona|niro|ev3)/.test(haystack)) {
    score += 3;
  }
  if (answers?.entorno_uso === "autopista" && /(octavia|tucson|tiguan|qashqai|a3|serie 3|xc60)/.test(haystack)) {
    score += 3;
  }
  if (answers?.km_anuales === "mas_20k" && /(hybrid|diesel|octavia|corolla|qashqai|tucson)/.test(haystack)) {
    score += 3;
  }

  const usage = Array.isArray(answers?.uso_principal) ? answers.uso_principal : [];
  if (usage.includes("familia") && /(corolla|captur|sportage|tucson|qashqai|kodiaq|sorento|kona|niro)/.test(haystack)) {
    score += 3;
  }
  if (usage.includes("visitas_clientes") && /(a3|serie 3|xc40|golf|leon)/.test(haystack)) {
    score += 2;
  }
  if (usage.includes("remolque") && /(sorento|santa fe|kodiaq|x-trail|tiguan)/.test(haystack)) {
    score += 3;
  }

  if (desiredType === "renting" && monthlyPriceSignal) {
    score += 5;
  }

  if (solutionType === "rent_a_car") {
    score += rentACarSignal ? 16 : -8;
    if (carsharingSignal) {
      score += 2;
    }
  }

  if (solutionType === "carsharing") {
    score += carsharingSignal ? 16 : 0;
    if (rentACarSignal) {
      score += 6;
    }
  }

  if (solutionType === "renting_corto" && (rentACarSignal || carsharingSignal)) {
    score += 8;
  }

  if (desiredType === "renting" && effectiveBudgetKey) {
    score += matchesBudget ? 10 : -18;
  }

  if (vehicleOfferSignal) {
    score += 2;
  }

  if (genericNonVehicle) {
    score -= 14;
  }

  if (desiredType === "renting" && exactModelMatches === 0 && brandHits === 0) {
    score -= 4;
  }

  if (effectiveBudgetKey) {
    score += Math.max(0, Math.round(budgetFit.score / 8));
  }

  return Math.max(-30, Math.min(100, Math.round(score)));
}

function scoreFallbackListing(listing, context) {
  const rawText = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.price || ""}`;
  const haystack = removeAccents(rawText).toLowerCase();
  const preferredBrands = getProfileBrandKeywords(context.answers, context.models || []);
  const preferredFuel = removeAccents(getPreferredFuelString(context.answers)).toLowerCase();
  const viableFuel = removeAccents(
    Array.isArray(context.result?.propulsiones_viables) ? context.result.propulsiones_viables.join(" ") : ""
  ).toLowerCase();
  const usage = Array.isArray(context.answers?.uso_principal) ? context.answers.uso_principal : [];
  const brandHits = countTokenHits(haystack, preferredBrands);
  const brandPriority = getOfferPriorityRank(context.answers, "marca_preferencia");
  const fuelPriority = getOfferPriorityRank(context.answers, "propulsion_preferida");
  const effectiveBudgetKey = getEffectiveBudgetKey(context.filters, context.answers, context.desiredType);
  const budgetFit = getBudgetFitInfo(listing?.price, effectiveBudgetKey, context.desiredType);
  const modelHits = (context.models || []).reduce((acc, model) => {
    const tokens = removeAccents(model)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);

    return acc + tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
  }, 0);

  let score = 0;
  const solutionType = context.result?.solucion_principal?.tipo;
  const rentACarSignal = hasRentACarSignals(rawText);
  const carsharingSignal = hasCarsharingSignals(rawText);

  score += getBudgetPriorityScore(listing?.price, effectiveBudgetKey, context.desiredType, context.answers);
  score += Math.round(scorePreferredFuel(haystack, preferredFuel, viableFuel) * getPriorityMultiplier(fuelPriority, 0.45, 2.1));
  score += Math.round(brandHits * 4 * getPriorityMultiplier(brandPriority, 0.35, 2.3));
  score += Math.min(modelHits, 4) * 2;
  score += Math.max(0, Number(listing?.profileScore || 0)) * 1.2;
  score += scoreAgePreference(listing, rawText, context.answers);

  if (matchesDesiredListingType(listing, context.desiredType)) {
    score += 8;
  }

  if (solutionType === "rent_a_car") {
    score += rentACarSignal ? 18 : -8;
  }

  if (solutionType === "carsharing") {
    score += carsharingSignal ? 18 : 0;
    if (rentACarSignal) {
      score += 6;
    }
  }

  if (looksLikeVehicleOffer(rawText)) {
    score += 6;
  }

  if (hasMonthlyPriceSignal(rawText) || Number.isFinite(parseEuroAmount(listing?.price))) {
    score += 6;
  }

  if (/(furgoneta|industrial|cargo|comercial|van\b)/.test(haystack) && !usage.includes("remolque") && context.answers?.ocupantes !== "7_plazas_maletero_grande") {
    score -= 18;
  }

  if (looksLikeGenericNonVehiclePage(rawText)) {
    score -= 30;
  }

  if (context.desiredType === "renting" && effectiveBudgetKey) {
    score += budgetFit.within ? 8 : -10;
  }

  return Math.max(-40, Math.min(100, Math.round(score)));
}

function isRelevantListingForProfile(listing, context) {
  const rawText = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.price || ""}`;
  const haystack = removeAccents(rawText).toLowerCase();
  const score = Number(listing?.profileScore || 0);
  const preferredBrands = getProfileBrandKeywords(context.answers, context.models || []);
  const brandHits = countTokenHits(haystack, preferredBrands);
  const brandPriority = getOfferPriorityRank(context.answers, "marca_preferencia");
  const chinaForward = isChinaForwardPreference(context.result, context.answers);
  const chineseBrandSignal = /(byd|mg\b|xpeng|omoda|jaecoo|seal u|atto 3|dolphin|mg4|zs hybrid|hs phev)/.test(haystack);
  const specificOfferSignal = hasSpecificVehicleIdentity(listing);
  const genericLanding = isGenericOfferLandingUrl(listing?.url || "", context.desiredType);
  const modelHits = (context.models || []).reduce((acc, model) => {
    const tokens = removeAccents(model)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);

    return acc + (tokens.some((token) => haystack.includes(token)) ? 1 : 0);
  }, 0);
  const matchesBudget = context.desiredType !== "renting" || !context.filters?.budget || isPriceWithinBudget(listing?.price, context.filters?.budget);
  const solutionType = context.result?.solucion_principal?.tipo;
  const shortTermSignal = hasRentACarSignals(rawText) || hasCarsharingSignals(rawText);
  const stockSignal = /\/coches-ocasion\/|\/vehiculos-ocasion\/|\/detalle\/|\/ofertas\/|\/id\/[a-f0-9-]+/.test(String(listing?.url || "").toLowerCase());
  const explicitObjectiveActive = getObjectiveModelTokens(context.answers).length > 0;
  const explicitObjectiveMatch = hasExplicitObjectiveMatch(listing, context.answers);

  if (looksLikeGenericNonVehiclePage(rawText) || genericLanding || !specificOfferSignal) {
    return false;
  }

  if (context.desiredType === "compra" && explicitObjectiveActive && !explicitObjectiveMatch) {
    return false;
  }

  if (chinaForward && brandHits === 0 && modelHits === 0 && !chineseBrandSignal) {
    return false;
  }

  if (brandPriority >= 5 && preferredBrands.length > 0 && brandHits === 0 && modelHits === 0) {
    return false;
  }

  if (context.desiredType === "renting") {
    if (["rent_a_car", "carsharing", "renting_corto"].includes(solutionType)) {
      return (
        score >= 8 &&
        (looksLikeVehicleOffer(rawText) || shortTermSignal) &&
        (shortTermSignal || brandHits > 0 || modelHits > 0)
      );
    }

    return (
      matchesBudget &&
      score >= 12 &&
      looksLikeVehicleOffer(rawText) &&
      (brandHits > 0 || modelHits > 0 || stockSignal) &&
      (hasMonthlyPriceSignal(rawText) || modelHits > 0 || stockSignal)
    );
  }

  return score >= 8 && looksLikeVehicleOffer(rawText) && (brandHits > 0 || modelHits > 0 || stockSignal);
}

function isFallbackListingCandidate(listing, context) {
  const rawText = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.price || ""}`;
  const haystack = removeAccents(rawText).toLowerCase();
  const preferredBrands = getProfileBrandKeywords(context.answers, context.models || []);
  const brandHits = countTokenHits(haystack, preferredBrands);
  const chinaForward = isChinaForwardPreference(context.result, context.answers);
  const chineseBrandSignal = /(byd|mg\b|xpeng|omoda|jaecoo|seal u|atto 3|dolphin|mg4|zs hybrid|hs phev)/.test(haystack);
  const specificOfferSignal = hasSpecificVehicleIdentity(listing);
  const genericLanding = isGenericOfferLandingUrl(listing?.url || "", context.desiredType);
  const modelHits = (context.models || []).reduce((acc, model) => {
    const tokens = removeAccents(model)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);

    return acc + (tokens.some((token) => haystack.includes(token)) ? 1 : 0);
  }, 0);
  const stockSignal = /\/detalle\/|\/ofertas\/|\/coches-ocasion\/|\/vehiculos\/|\/id\/[a-f0-9-]+/.test(String(listing?.url || "").toLowerCase());
  const explicitObjectiveActive = getObjectiveModelTokens(context.answers).length > 0;
  const explicitObjectiveMatch = hasExplicitObjectiveMatch(listing, context.answers);

  if (!matchesDesiredListingType(listing, context.desiredType)) {
    return false;
  }

  if (looksLikeGenericNonVehiclePage(rawText) || !looksLikeVehicleOffer(rawText) || genericLanding || !specificOfferSignal) {
    return false;
  }

  if (context.desiredType === "compra" && explicitObjectiveActive && !explicitObjectiveMatch) {
    return false;
  }

  if (chinaForward && brandHits === 0 && modelHits === 0 && !chineseBrandSignal) {
    return false;
  }

  if (
    context.desiredType === "renting" &&
    !["rent_a_car", "carsharing", "renting_corto"].includes(context.result?.solucion_principal?.tipo) &&
    (!hasMonthlyPriceSignal(rawText) && !Number.isFinite(parseEuroAmount(listing?.price)))
  ) {
    return false;
  }

  if (
    context.desiredType === "renting" &&
    !["rent_a_car", "carsharing", "renting_corto"].includes(context.result?.solucion_principal?.tipo) &&
    brandHits === 0 &&
    modelHits === 0 &&
    !stockSignal
  ) {
    return false;
  }

  return scoreFallbackListing(listing, context) >= 18;
}

function sortListingsByPriority(a, b) {
  const syntheticDiff = Number(Boolean(a?.synthetic || a?.isGuaranteedFallback)) - Number(Boolean(b?.synthetic || b?.isGuaranteedFallback));
  if (syntheticDiff) {
    return syntheticDiff;
  }

  const imageDiff = Number(Boolean(b?.hasRealImage || isUsefulImageUrl(b?.image))) - Number(Boolean(a?.hasRealImage || isUsefulImageUrl(a?.image)));
  if (imageDiff) {
    return imageDiff;
  }

  const relevantDiff = Number(Boolean(b?.isRelevantMatch)) - Number(Boolean(a?.isRelevantMatch));
  if (relevantDiff) {
    return relevantDiff;
  }

  const rankingDiff = Number(b?.rankingScore || 0) - Number(a?.rankingScore || 0);
  if (rankingDiff) {
    return rankingDiff;
  }

  if (a?.isRelevantMatch || b?.isRelevantMatch) {
    return Number(b?.profileScore || 0) - Number(a?.profileScore || 0);
  }

  const fallbackDiff = Number(b?.fallbackScore || 0) - Number(a?.fallbackScore || 0);
  if (fallbackDiff) {
    return fallbackDiff;
  }

  const priceA = parseEuroAmount(a?.price);
  const priceB = parseEuroAmount(b?.price);
  if (Number.isFinite(priceA) || Number.isFinite(priceB)) {
    return (Number.isFinite(priceA) ? priceA : Number.POSITIVE_INFINITY) - (Number.isFinite(priceB) ? priceB : Number.POSITIVE_INFINITY);
  }

  return Number(b?.profileScore || 0) - Number(a?.profileScore || 0);
}

function buildVehicleIdentityKey(listing = {}) {
  const rawText = removeAccents(`${listing?.title || ""} ${listing?.description || ""}`)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");
  const stopwords = new Set([
    "de", "del", "con", "para", "por", "the", "and", "edition", "line", "style", "tech", "techno", "premium",
    "business", "urban", "active", "advance", "comfort", "plus", "hybrid", "phev", "mhev", "electric", "ev",
    "gasolina", "diesel", "manual", "automatico", "automat", "cv", "kw", "km", "kms", "nuevo", "seminuevo",
  ]);
  const tokens = rawText
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 1 && !/^\d+$/.test(token) && !stopwords.has(token));

  if (tokens.length === 0) {
    return normalizeText(listing?.title || "").toLowerCase();
  }

  if (["serie", "series", "clase", "class", "model", "cx"].includes(tokens[1]) && tokens[2]) {
    return tokens.slice(0, 3).join(" ");
  }

  return tokens.slice(0, 2).join(" ");
}

function dedupeListings(listings = []) {
  const bestByKey = new Map();
  const orderedListings = Array.isArray(listings) ? [...listings].sort(sortListingsByPriority) : [];

  for (const listing of orderedListings) {
    const sourceKey = normalizeText(listing?.source || getDomain(listing?.url || "") || "mercado").toLowerCase();
    const urlKey = normalizeText(listing?.url || "").toLowerCase();
    const titleKey = normalizeText(listing?.title || "").toLowerCase();
    const vehicleKey = buildVehicleIdentityKey(listing);
    const keys = uniq([
      urlKey ? `url|${urlKey}` : "",
      sourceKey && titleKey ? `source-title|${sourceKey}|${titleKey}` : "",
      vehicleKey ? `vehicle|${vehicleKey}` : "",
    ]).filter(Boolean);

    if (!keys.length) {
      continue;
    }

    const alreadyTaken = keys.some((key) => bestByKey.has(key));
    if (alreadyTaken) {
      continue;
    }

    keys.forEach((key) => bestByKey.set(key, listing));
  }

  return Array.from(new Set(bestByKey.values())).sort(sortListingsByPriority);
}

function createNormalizedLookup(values = []) {
  const list = Array.isArray(values) ? values : [values];
  return new Set(list.map((value) => normalizeText(value).toLowerCase()).filter(Boolean));
}

function isPreviouslySeenListing(listing, excludedUrls = new Set(), excludedTitles = new Set()) {
  const urlKey = normalizeText(listing?.url).toLowerCase();
  const titleKey = normalizeText(listing?.title).toLowerCase();

  return (urlKey && excludedUrls.has(urlKey)) || (titleKey && excludedTitles.has(titleKey));
}

function buildPositionReason(listing, index) {
  const rankingSignals = Array.isArray(listing?.rankingSignals) ? listing.rankingSignals : [];
  // Profile signals come first in rankingSignals; exclude quality metadata from the reason text
  const metadataRe = /^(Sin|Se sale|Por debajo|Foto real|Precio\s+(detectado|visible)|Fuente priorizada|Tipo correcto)/i;
  const profileSignals = rankingSignals.filter((signal) => !metadataRe.test(String(signal || "")));
  const topSignal = profileSignals[0] || listing?.matchReason || "buen equilibrio general para tu perfil";
  const secondSignal = profileSignals.find((signal) => signal && signal !== topSignal) || "";

  if (index === 0) {
    return `Sube al puesto #1 porque ${topSignal.toLowerCase()}${secondSignal ? ` y además ${secondSignal.toLowerCase()}` : ""}.`;
  }

  return `Queda en la posición #${index + 1} porque ${topSignal.toLowerCase()}${secondSignal ? `, aunque ${secondSignal.toLowerCase()}` : ""}.`;
}

function pickProviderDiverseListings(listings = [], limit = 4) {
  const pool = Array.isArray(listings) ? listings : [];
  const picks = [];
  const usedProviders = new Set();
  const usedVehicles = new Set();

  const tryPick = (listing, { allowProviderRepeat = false, allowVehicleRepeat = false } = {}) => {
    if (picks.includes(listing)) {
      return false;
    }

    const providerKey = normalizeText(listing?.source || getDomain(listing?.url || "") || "mercado").toLowerCase();
    const vehicleKey = buildVehicleIdentityKey(listing);

    if (!allowProviderRepeat && providerKey && usedProviders.has(providerKey)) {
      return false;
    }

    if (!allowVehicleRepeat && vehicleKey && usedVehicles.has(vehicleKey)) {
      return false;
    }

    picks.push(listing);
    if (providerKey) {
      usedProviders.add(providerKey);
    }
    if (vehicleKey) {
      usedVehicles.add(vehicleKey);
    }

    return picks.length >= limit;
  };

  for (const listing of pool) {
    if (tryPick(listing, { allowProviderRepeat: false, allowVehicleRepeat: false })) {
      return picks;
    }
  }

  for (const listing of pool) {
    if (tryPick(listing, { allowProviderRepeat: true, allowVehicleRepeat: false })) {
      return picks;
    }
  }

  for (const listing of pool) {
    if (tryPick(listing, { allowProviderRepeat: true, allowVehicleRepeat: true })) {
      break;
    }
  }

  return picks;
}

function buildRankedListingResponse(listings = [], options = {}) {
  const dedupedListings = dedupeListings(listings);
  const answers = options.answers && typeof options.answers === "object" ? options.answers : {};
  const models = Array.isArray(options.models) ? options.models : [];
  const brandPriority = getOfferPriorityRank(answers, "marca_preferencia");
  const modelObjective = normalizeText(answers?.modelo_objetivo);
  const preferredBrands = getProfileBrandKeywords(answers, models);
  const modelTokens = removeAccents(modelObjective)
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const hasModelMatch = (listing) => {
    if (!modelTokens.length) {
      return false;
    }

    const haystack = removeAccents(`${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""}`).toLowerCase();
    return modelTokens.every((token) => haystack.includes(token));
  };

  const hasBrandMatch = (listing) => {
    if (!preferredBrands.length) {
      return false;
    }

    const haystack = removeAccents(`${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""}`).toLowerCase();
    return preferredBrands.some((brand) => haystack.includes(brand));
  };

  let constrainedListings = [...dedupedListings];
  if (modelTokens.length > 0) {
    const modelMatched = constrainedListings.filter(hasModelMatch);
    if (modelMatched.length > 0) {
      constrainedListings = modelMatched;
    }
  }

  if (brandPriority >= 5) {
    const brandMatched = constrainedListings.filter(hasBrandMatch);
    if (brandMatched.length > 0) {
      constrainedListings = brandMatched;
    }
  }

  const excludedUrls = options.excludedUrls instanceof Set
    ? options.excludedUrls
    : createNormalizedLookup(options.excludedUrls || []);
  const excludedTitles = options.excludedTitles instanceof Set
    ? options.excludedTitles
    : createNormalizedLookup(options.excludedTitles || []);
  const orderedListings = [...constrainedListings].sort(sortListingsByPriority);
  const imagePreferredListings = options.preferRealImage === false
    ? orderedListings
    : [
        ...orderedListings.filter((listing) => Boolean(listing?.hasRealImage || isUsefulImageUrl(listing?.image))),
        ...orderedListings.filter((listing) => !Boolean(listing?.hasRealImage || isUsefulImageUrl(listing?.image))),
      ];
  const unseenListings = options.preferUnseen
    ? imagePreferredListings.filter((listing) => !isPreviouslySeenListing(listing, excludedUrls, excludedTitles))
    : imagePreferredListings;
  const candidatePool = unseenListings.length > 0 ? unseenListings : imagePreferredListings;
  const ranked = pickProviderDiverseListings(candidatePool, 4)
    .map((listing, index) => ({
      ...listing,
      rankPosition: index + 1,
      positionReason: buildPositionReason(listing, index),
    }));

  if (!ranked.length) {
    return null;
  }

  // Promote a real listing over a synthetic one when model objective has a concrete real match
  let finalRanked = ranked;
  if (modelTokens.length > 0 && ranked.length > 1 && ranked[0]?.synthetic) {
    const realMatchIdx = ranked.findIndex((l, i) => i > 0 && !l.synthetic && hasModelMatch(l));
    if (realMatchIdx > 0) {
      finalRanked = [
        ranked[realMatchIdx],
        ...ranked.slice(0, realMatchIdx),
        ...ranked.slice(realMatchIdx + 1),
      ];
    }
  }

  const [first, ...rest] = finalRanked;
  const isSyntheticModelFallback = options.fallbackMode && first?.synthetic && modelTokens.length > 0;
  const topListing = options.fallbackMode
    ? {
        ...first,
        whyMatches: uniq([
          isSyntheticModelFallback
            ? `No encontré stock real de ${modelObjective} en este momento; te muestro la referencia orientativa más cercana para que busques directamente en el proveedor.`
            : "No había una coincidencia exacta con todos tus filtros; esta es la alternativa real con mejor equilibrio entre encaje, precio visible y confianza de fuente.",
          ...(first.whyMatches || []),
        ]).slice(0, 6),
        matchReason: isSyntheticModelFallback
          ? `No encontré anuncios reales de ${modelObjective} ahora mismo; esta referencia orientativa te lleva directamente a buscarlo en el proveedor.`
          : "No había una coincidencia exacta; esta opción sube al primer puesto por equilibrio real entre encaje, presupuesto y confianza.",
      }
    : first;
  const listingsWithTop = [topListing, ...rest.map((item) => ({ ...item }))];

  return {
    listing: topListing,
    listings: listingsWithTop,
    alternatives: listingsWithTop.slice(1),
    searchCoverage: options.searchCoverage || null,
  };
}

function buildGuaranteedFallbackListings({ result, answers, filters, desiredType, companies = [], models = [] }) {
  const recommendedCompanies = Array.isArray(result?.solucion_principal?.empresas_recomendadas)
    ? result.solucion_principal.empresas_recomendadas
    : [];
  const providerPool = uniq(
    desiredType === "compra"
      ? [
          ...(DEFAULT_PLATFORM_GROUPS[desiredType] || []),
          ...recommendedCompanies,
          ...companies,
        ]
      : [
          ...recommendedCompanies,
          ...companies,
          ...(DEFAULT_PLATFORM_GROUPS[desiredType] || []),
        ]
  ).slice(0, 4);
  const alternativePool = Array.isArray(result?.alternativas) ? result.alternativas.slice(0, 2) : [];
  const modelPool = uniq([
    normalizeText(answers?.modelo_objetivo),
    ...models,
    ...buildVehicleCandidates({ result, answers }),
  ]).filter(Boolean);
  const basePrice = normalizeText(result?.solucion_principal?.coste_estimado) || "A validar";
  const summary =
    normalizeText(result?.solucion_principal?.resumen) ||
    `Referencia priorizada para ${result?.solucion_principal?.titulo || "tu perfil"}.`;
  const defaultModel = modelPool[0] || (desiredType === "renting" ? "Toyota Corolla Hybrid" : "Toyota Corolla");

  const companyListings = providerPool.map((company, index) => {
    const model = modelPool[index % Math.max(modelPool.length, 1)] || defaultModel;
    const source = normalizeCompanyAlias(company || "Mercado general");
    const searchQuery = `${source} ${model} ${desiredType === "renting" ? "renting cuota mensual" : "coche ocasion stock"} España`;
    const searchUrl = getCompanySearchUrls(source, desiredType, [model])[0] || getCompanyDirectUrl(source, desiredType) || buildSearchLandingUrl(searchQuery);

    return {
      title:
        index === 0
          ? `${model} · ${desiredType === "renting" ? "renting sugerido en" : "unidad sugerida en"} ${source}`
          : `${model} · alternativa concreta en ${source}`,
      source,
      url: searchUrl,
      price: "",
      estimatedPrice: basePrice,
      description: `${summary} Modelo concreto priorizado para tu perfil: ${model}. Referencia orientativa pendiente de validación real en proveedor.`,
      listingType: desiredType,
      profileScore: Math.max(58 - index * 4, 46),
      rankingScore: Math.max(66 - index * 5, 48),
      fallbackScore: Math.max(72 - index * 4, 54),
      isFallbackMatch: true,
      isRelevantMatch: false,
      synthetic: true,
      isGuaranteedFallback: true,
      hasRealImage: false,
      rankingSignals: [
        `Modelo sugerido: ${model}`,
        index === 0 ? "Base recomendada por el asesor" : "Alternativa prioritaria",
      ],
      whyMatches: [
        `Parte de la recomendación principal: ${result?.solucion_principal?.titulo || "movilidad recomendada"}.`,
        `Modelo concreto priorizado para tu perfil: ${model}.`,
      ],
      matchReason:
        index === 0
          ? `No había una coincidencia real inmediata; te propongo empezar por ${model} en ${source}, que es la vía más probable para cerrar una oferta concreta.`
          : `Se mantiene como alternativa concreta con el modelo ${model} para comparar antes de decidir.`,
    };
  });

  const alternativeListings = alternativePool.map((alternative, index) => {
    const model = modelPool[(index + companyListings.length) % Math.max(modelPool.length, 1)] || defaultModel;
    const source = normalizeCompanyAlias(alternative?.tipo || "Mercado general");
    const searchUrl = getCompanySearchUrls(source, desiredType, [model])[0] || getCompanyDirectUrl(source, desiredType) || buildSearchLandingUrl(`${source} ${model}`);
    return {
      title: `${model} · ${alternative?.titulo || `alternativa ${index + 1}`}`,
      source,
      url: searchUrl,
      price: "",
      estimatedPrice: basePrice,
      description:
        normalizeText(alternative?.razon) ||
        `Ruta secundaria útil para comparar con la opción principal usando el modelo ${model}.`,
      listingType: desiredType,
      profileScore: Math.max(52 - index * 3, 40),
      rankingScore: Math.max(58 - index * 4, 42),
      fallbackScore: Math.max(60 - index * 3, 46),
      isFallbackMatch: true,
      synthetic: true,
      isGuaranteedFallback: true,
      hasRealImage: false,
      rankingSignals: [`Modelo sugerido: ${model}`, `Alternativa ${index + 1}`],
      whyMatches: [`Se conserva para no depender de una sola vía de mercado usando ${model}.`],
      matchReason: `Se mantiene como apoyo comparativo mientras se valida una oferta concreta para ${model}.`,
    };
  });

  return [...companyListings, ...alternativeListings].slice(0, 4);
}

function getDesiredListingType(result) {
  const solutionType = normalizeText(result?.solucion_principal?.tipo || "").toLowerCase();

  return solutionType.includes("rent") || ["carsharing", "suscripcion", "subscription"].includes(solutionType)
    ? "renting"
    : "compra";
}

function getSearchCoverageConfig(result, desiredType = "compra") {
  const baseConfig = AGGRESSIVE_SCRAPING_ENABLED
    ? AGGRESSIVE_SEARCH_COVERAGE_LIMITS
    : SEARCH_COVERAGE_LIMITS;
  const base = { ...(baseConfig[desiredType] || baseConfig.compra || SEARCH_COVERAGE_LIMITS.compra) };
  const solutionType = result?.solucion_principal?.tipo;

  if (["rent_a_car", "carsharing", "renting_corto"].includes(solutionType)) {
    base.queryLimit = Math.max(5, base.queryLimit - 1);
    base.pagesPerCompany = Math.max(3, base.pagesPerCompany - 1);
  }

  return base;
}

function hasRentingSignals(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(renting|suscrip|subscription|cuota|cuota mensual|todo incluido|sin entrada|mes iva|arrendamiento|alquiler|rent a car|por dias|por dia|carsharing)/.test(haystack);
}

function hasPurchaseSignals(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(coches-ocasion|ocasion|segunda mano|seminuevo|km 0|km0|vo certificado|precio contado|precio final|venta|usado|stock)/.test(haystack);
}

function hasRentACarSignals(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(alquiler|rent a car|por dias|por dia|por semanas|recogida|devolucion|oficina aeropuerto|reserva inmediata)/.test(haystack);
}

function hasCarsharingSignals(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(carsharing|por minuto|por horas|vehiculo compartido|free2move|zity|wible)/.test(haystack);
}

function matchesDesiredListingType(listing, desiredType) {
  const haystack = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.source || ""}`;
  const source = getDomain(listing?.url || listing?.source || "");
  const rentingDomain = RENTING_DOMAINS.some((domain) => source.includes(domain));
  const purchaseDomain = PURCHASE_DOMAINS.some((domain) => source.includes(domain));
  const rentingSignals = rentingDomain || hasRentingSignals(haystack);
  const purchaseSignals = purchaseDomain || hasPurchaseSignals(haystack);

  if (desiredType === "renting") {
    if (purchaseSignals && !rentingSignals) {
      return false;
    }

    return rentingSignals;
  }

  if (purchaseSignals) {
    return true;
  }

  return !rentingSignals;
}

function decorateListing(listing, context) {
  const normalizedImage = normalizeProviderAssetUrl(listing?.image || "", listing?.url || "");
  const hasRealImage = isUsefulImageUrl(normalizedImage);
  const normalizedListing = {
    ...listing,
    image: hasRealImage ? normalizedImage : "",
    hasRealImage,
  };
  const whyMatches = buildWhyMatches({ ...context, listing: normalizedListing });
  const profileScore = scoreListingForProfile(normalizedListing, context);
  const fallbackScore = scoreFallbackListing(normalizedListing, context);
  const rawText = `${normalizedListing?.title || ""} ${normalizedListing?.description || ""} ${normalizedListing?.url || ""} ${normalizedListing?.price || ""}`;
  const budgetKey = getEffectiveBudgetKey(context.filters, context.answers, context.desiredType);
  const budgetFit = getBudgetFitInfo(normalizedListing?.price, budgetKey, context.desiredType);
  const providerTrustScore = getProviderTrustScore(normalizedListing, context);
  const practicalFitScore = getPracticalFitScore(rawText, normalizedListing, context);
  const rankingScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(profileScore * 0.58 + fallbackScore * 0.24 + budgetFit.score + providerTrustScore + practicalFitScore + (hasRealImage ? 6 : 0))
    )
  );
  const rankingSignals = buildRankingSignals(normalizedListing, context, {
    budgetFit,
    providerTrustScore,
    practicalFitScore,
  });
  // Keep match reason user-meaningful: avoid metadata and generic price/provider labels.
  const positiveMatchSignal = rankingSignals.find(
    (signal) => !/^(Sin|Se sale|Por debajo|Foto real|Precio\s+(detectado|visible)|Fuente priorizada|Tipo correcto)/i.test(String(signal || ""))
  );
  const preferredWhyMatch = whyMatches.find(
    (reason) => /encaja con tu perfil|priorizo|he tenido en cuenta|propulsiones viables|franja economica|contexto financiero/i.test(String(reason || ""))
  );
  const baseListing = {
    ...normalizedListing,
    listingType: context.desiredType,
    profileScore,
    fallbackScore,
    rankingScore,
    rankingSignals,
    budgetFitLabel: budgetFit.label,
  };
  const isRelevantMatch = isRelevantListingForProfile(baseListing, context);
  const isFallbackMatch = isFallbackListingCandidate(baseListing, context);

  return {
    ...baseListing,
    isRelevantMatch,
    isFallbackMatch,
    whyMatches,
    matchReason:
      preferredWhyMatch ||
      whyMatches[1] ||
      positiveMatchSignal ||
      whyMatches[0] ||
      context.matchReason ||
      "Opcion real localizada en la web externa para tu perfil.",
  };


}

async function fetchListingDetails(candidate, context) {
  try {
    const response = await fetchWithTimeout(candidate.url, {
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    }, getRemainingTimeMs(context, 4000));

    const html = await response.text();
    const strippedHtml = stripHtml(html);
    const mirrorText = shouldUseReadableMirror(response.url || candidate.url)
      ? await fetchReadableMirrorText(response.url || candidate.url, context, 4000)
      : "";
    const rawTitle =
      extractReadableMirrorTitle(mirrorText) ||
      getMetaContent(html, "og:title") ||
      getMetaContent(html, "twitter:title") ||
      stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ||
      candidate.title;
    const fallbackUrlTitle = deriveVehicleTitleFromUrl(response.url || candidate.url);
    const sourceName = normalizeText(normalizeCompanyAlias(getDomain(response.url || candidate.url))).toLowerCase();
    const cleanedRawTitle = normalizeText(rawTitle);
    const title = (!looksLikeSpecificModelName(cleanedRawTitle) || cleanedRawTitle.toLowerCase() === sourceName)
      ? (fallbackUrlTitle || cleanedRawTitle || candidate.title)
      : cleanedRawTitle;
    const bodyPreview = (mirrorText || strippedHtml).slice(0, 320);
    const description =
      cleanListingText(mirrorText).slice(0, 260) ||
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "description") ||
      bodyPreview ||
      candidate.title;
    const price = parsePrice(`${mirrorText.slice(0, 60000)} ${html.slice(0, 60000)} ${title} ${description}`);
    const image = extractReadableMirrorImage(mirrorText, response.url || candidate.url) || extractPrimaryImage(html, response.url || candidate.url);
    const cleanedDescription = cleanListingText(description || bodyPreview || candidate.title).slice(0, 220);

    const listing = decorateListing(
      {
        title: normalizeText(title),
        url: response.url || candidate.url,
        source: getDomain(response.url || candidate.url),
        description: cleanedDescription,
        price,
        image,
      },
      context
    );

    return listing.isRelevantMatch || listing.isFallbackMatch ? listing : null;
  } catch {
    const listing = decorateListing(
      {
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        description: "Opcion real localizada en la web externa para tu perfil.",
        price: "",
        image: candidate.image || "",
      },
      context
    );

    return listing.isRelevantMatch || listing.isFallbackMatch ? listing : null;
  }
}

function buildVehicleCandidates({ result, answers }) {
  const explicitBrand = normalizeText(answers?.marca_objetivo);
  const explicitModelObjective = normalizeText(answers?.modelo_objetivo);
  const normalizedExplicitModelObjective = (() => {
    const brandLower = removeAccents(explicitBrand).toLowerCase();
    const modelLower = removeAccents(explicitModelObjective).toLowerCase();

    if (brandLower && modelLower.startsWith(`${brandLower} `)) {
      return explicitModelObjective;
    }

    return [explicitBrand, explicitModelObjective].filter(Boolean).join(" ").trim();
  })();

  if (looksLikeSpecificModelName(normalizedExplicitModelObjective)) {
    return [normalizedExplicitModelObjective];
  }

  const chinaForward = isChinaForwardPreference(result, answers);
  const chinesePriorityModels = (() => {
    const propulsions = (Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [])
      .map((item) => removeAccents(item).toLowerCase())
      .join(" ");

    if (/(electric|electrico|ev)/.test(propulsions)) {
      return ["BYD Dolphin", "MG4 Electric", "BYD Atto 3", "XPeng G6"];
    }

    if (/(hibrid|phev|gasolina|suave)/.test(propulsions)) {
      return ["BYD Seal U DM-i", "MG ZS Hybrid+", "Omoda 5", "Jaecoo 7", "MG HS PHEV"];
    }

    return ["BYD Dolphin", "BYD Seal U DM-i", "MG4 Electric", "MG ZS Hybrid+", "Omoda 5", "Jaecoo 7", "XPeng G6"];
  })();
  const preferred = chinaForward
    ? uniq([...(BRAND_MODEL_MAP.nueva_china || []), ...chinesePriorityModels, ...(BRAND_MODEL_MAP[answers?.marca_preferencia] || [])])
    : (BRAND_MODEL_MAP[answers?.marca_preferencia] || []);
  const explicitCandidates = [
    normalizedExplicitModelObjective,
    explicitModelObjective,
    normalizeText(result?.solucion_principal?.titulo),
  ].filter(Boolean);
  const propulsions = (Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [])
    .map((item) => removeAccents(item).toLowerCase());
  const usage = Array.isArray(answers?.uso_principal) ? answers.uso_principal : [];
  const dynamic = [
    ...explicitCandidates,
    ...(ANSWER_MODEL_MAPS.propulsion_preferida[answers?.propulsion_preferida] || []),
    ...(ANSWER_MODEL_MAPS.entorno_uso[answers?.entorno_uso] || []),
    ...(ANSWER_MODEL_MAPS.km_anuales[answers?.km_anuales] || []),
    ...(ANSWER_MODEL_MAPS.ocupantes[answers?.ocupantes] || []),
    ...usage.flatMap((key) => ANSWER_MODEL_MAPS.uso_principal[key] || []),
  ];

  if (answers?.perfil === "empresa" || answers?.perfil === "autonomo") {
    dynamic.push("Volkswagen Golf", "Toyota Corolla", "Volvo XC40");
  }

  if (answers?.vehiculo_actual === "si_entrego") {
    dynamic.push("Toyota Corolla", "Hyundai Tucson", "Seat Leon");
  }

  if (["por_dias", "menos_2_meses", "menos_1_ano", "menos_2", "2_3"].includes(answers?.horizonte)) {
    dynamic.unshift("Toyota Corolla", "Seat Leon", "Renault Captur");
  } else if (answers?.horizonte === "5_7" || answers?.horizonte === "mas_7") {
    dynamic.unshift("Toyota Corolla", "Kia Niro", "Hyundai Tucson");
  }

  if (propulsions.some((item) => item.includes("electric") || item.includes("electrico"))) {
    dynamic.unshift("MG4 Electric", "BYD Dolphin", "Hyundai Kona Electric");
  } else if (propulsions.some((item) => item.includes("phev") || item.includes("hibrid"))) {
    dynamic.unshift("Toyota Corolla Hybrid", "Kia Niro", "Hyundai Kona Hybrid");
  }

  const combined = chinaForward
    ? [...preferred, ...dynamic.filter((model) => /^(BYD|MG|XPeng|Omoda|Jaecoo)\b/i.test(model) || /(Seal U|Atto 3|Dolphin|MG4|ZS Hybrid|HS PHEV)/i.test(model))]
    : [...preferred, ...dynamic];

  const brandPriority = getOfferPriorityRank(answers, "marca_preferencia");
  if (brandPriority >= 5 && preferred.length > 0) {
    const preferredBrands = getProfileBrandKeywords(answers, preferred);
    const constrained = combined.filter((model) => {
      const normalized = removeAccents(model).toLowerCase();
      return preferredBrands.some((brand) => normalized.startsWith(brand));
    });

    if (constrained.length > 0) {
      return uniq(constrained.filter(looksLikeSpecificModelName)).slice(0, chinaForward ? 10 : 8);
    }
  }

  return uniq(combined.filter(looksLikeSpecificModelName)).slice(0, chinaForward ? 10 : 8);
}

function getSearchCompanies({ result, filters, desiredType }) {
  const selected = normalizeText(filters?.company);
  const hasExplicitLocation = Boolean(normalizeText(filters?.location)) && normalizeText(filters?.location) !== "toda_espana";
  const explicitObjective = normalizeText(result?.solucion_principal?.titulo || "");
  const recommended = Array.isArray(result?.solucion_principal?.empresas_recomendadas)
    ? result.solucion_principal.empresas_recomendadas.map((company) => normalizeText(company))
    : [];
  const solutionType = result?.solucion_principal?.tipo;
  const alternativeTypes = Array.isArray(result?.alternativas)
    ? result.alternativas.map((item) => normalizeText(item?.tipo)).filter(Boolean)
    : [];
  const priorityFromAlternatives = alternativeTypes.flatMap((type) => PRIORITY_PLATFORM_GROUPS[type] || []);
  const defaults = PRIORITY_PLATFORM_GROUPS[solutionType] || DEFAULT_PLATFORM_GROUPS[desiredType] || [];
  const explicitPurchasePriority = desiredType === "compra" && (hasExplicitLocation || explicitObjective)
    ? [
        "Coches.net",
        "OcasionPlus",
        "Flexicar",
        "AutoScout24",
        "Clicars",
        "Spoticar",
        "Autohero",
        "Das WeltAuto",
        "Autoocasion",
        "Milanuncios",
        "Cars&Cars",
        "Coches.com",
      ]
    : [];
  const supportedRecommended = recommended.filter((company) => {
    const normalized = normalizeCompanyAlias(company);
    return Boolean(COMPANY_DIRECT_URLS[normalized] || COMPANY_SITE_HINTS[normalized]);
  });
  const nonMarketplaceRecommended = recommended.filter((company) => !supportedRecommended.includes(company));

  return uniq(
    desiredType === "compra"
      ? [selected, ...explicitPurchasePriority, ...defaults, ...supportedRecommended, ...priorityFromAlternatives, ...nonMarketplaceRecommended]
      : [selected, ...supportedRecommended, ...recommended, ...defaults, ...priorityFromAlternatives]
  );
}

function buildQueries({ result, answers, filters, companies = [], desiredType = getDesiredListingType(result) }) {
  const models = buildVehicleCandidates({ result, answers });
  const explicitObjective = looksLikeSpecificModelName(normalizeText(answers?.modelo_objetivo));
  const chinaForward = isChinaForwardPreference(result, answers);
  const agePriority = getOfferPriorityRank(answers, "antiguedad_vehiculo_buscada");
  const ageBuckets = getAllowedAgeBuckets(answers);
  const ageHint = agePriority >= 4
    ? ageBuckets.map((bucket) => {
        if (bucket === "cero_anos") return "km 0 nuevo";
        if (bucket === "0_2_anos") return "seminuevo 2024 2025";
        if (bucket === "2_4_anos") return "ocasion 2022 2023 2024";
        if (bucket === "4_7_anos") return "ocasion 2019 2020 2021 2022";
        if (bucket === "mas_7_anos") return "ocasion usado";
        return "";
      }).filter(Boolean).join(" ")
    : "";
  const budgetHint = BUDGET_HINTS[filters?.budget] || "";
  const incomeHint = INCOME_HINTS[filters?.income] || "";
  const locationHint = normalizeText(String(filters?.location || "").replace(/_/g, " "));
  const fuelHintFromFilters = normalizeText(filters?.fuel);
  const platformList = companies.length ? companies : getSearchCompanies({ result, filters, desiredType });
  const operationHint = ["rent_a_car", "carsharing"].includes(result?.solucion_principal?.tipo)
    ? "alquiler coche por dias carsharing suscripcion coche"
    : desiredType === "renting"
    ? "renting coche oferta cuota mensual particulares"
    : "coche ocasion compra anuncio stock";
  const alternativeHints = Array.isArray(result?.alternativas)
    ? result.alternativas
        .slice(0, 3)
        .flatMap((item) => [normalizeText(item?.titulo), normalizeText(item?.tipo)])
        .filter(Boolean)
    : [];
  const fuelHint = (Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [])
    .slice(0, 2)
    .join(" ");

  const queries = [];
  const modelLimit = explicitObjective ? 1 : chinaForward ? 7 : 5;
  const companyLimit = explicitObjective ? platformList.length : chinaForward ? 8 : 6;

  for (const model of models.slice(0, modelLimit)) {
    if (desiredType === "compra") {
      queries.push(
        [model, locationHint, fuelHintFromFilters, "site:coches.net", "coche ocasion"].filter(Boolean).join(" ").trim()
      );
      queries.push(
        [model, locationHint, fuelHintFromFilters, "site:ocasionplus.com", "coche ocasion"].filter(Boolean).join(" ").trim()
      );
      queries.push(
        [model, locationHint, fuelHintFromFilters, "site:flexicar.es", "segunda mano"].filter(Boolean).join(" ").trim()
      );
      queries.push(
        [model, locationHint, fuelHintFromFilters, "España", "coche ocasion anuncio"].filter(Boolean).join(" ").trim()
      );
    }

    queries.push(`${model} ${operationHint} España ${fuelHint} ${ageHint} ${budgetHint}`.trim());

    for (const company of platformList.slice(0, companyLimit)) {
      const companySite = COMPANY_SITE_HINTS[company] || "";
      queries.push(`${company} ${model} ${operationHint} España ${ageHint} ${budgetHint}`.trim());

      if (companySite) {
        queries.push(`site:${companySite} ${model} ${operationHint} ${ageHint} ${budgetHint}`.trim());
        if (desiredType === "compra") {
          queries.push(`site:${companySite} ${model} ${locationHint} ${fuelHintFromFilters} coche ocasion`.trim());
        }
      }
    }
  }

  for (const hint of alternativeHints) {
    queries.push(`${hint} ${operationHint} España ${ageHint} ${budgetHint}`.trim());
  }

  if (chinaForward) {
    ["BYD Dolphin renting España", "BYD Seal U DM-i renting España", "MG4 Electric renting España", "MG ZS Hybrid+ renting España", "Omoda 5 renting España", "Jaecoo 7 renting España"].forEach((query) => {
      queries.push(`${query} ${budgetHint}`.trim());
    });
  }

  queries.push(`${operationHint} España ${fuelHint} ${ageHint} ${budgetHint} ${incomeHint}`.trim());

  return uniq(queries).slice(0, explicitObjective ? 40 : 22);
}

function isGenericOfferLandingUrl(url, desiredType = "compra") {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    const segments = path.split("/").filter(Boolean);

    if (segments.length === 0) {
      return true;
    }

    if (desiredType === "renting") {
      if (segments.length <= 2 && /^(es-es|ofertas|renting|particulares|alquiler-coches|car-on-demand)$/i.test(segments[segments.length - 1] || "")) {
        return true;
      }

      return /^\/(es-es|ofertas|renting|alquiler-coches|car-on-demand)$/.test(path);
    }

    if (segments.length <= 2 && /(segunda-mano|coches-ocasion|search|vehiculos-ocasion|catalogo)/.test(path)) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function hasSpecificVehicleIdentity(listing) {
  const url = String(listing?.url || "").toLowerCase();
  const haystack = removeAccents(`${listing?.title || ""} ${listing?.description || ""} ${url}`).toLowerCase();
  const knownBrands = [
    "audi", "bmw", "byd", "citroen", "cupra", "dacia", "fiat", "ford", "honda", "hyundai", "jaguar",
    "jeep", "kia", "lexus", "mazda", "mercedes", "mg", "mini", "nissan", "opel", "peugeot", "renault",
    "seat", "skoda", "tesla", "toyota", "volkswagen", "volvo", "xpeng",
  ];
  const brandHits = knownBrands.filter((brand) => haystack.includes(brand)).length;

  if (/\/ofertas\/[^/]+\/[^/]+|\/coches-ocasion\/[^/]+\/[^/]+|\/vehiculos-ocasion\/[^/]+\/[^/]+|\/detalle\/[^/]+|\/ficha\/[^/]+|\/id\/[a-f0-9-]+|-[0-9]+-covo\.aspx(?:\?|$)/i.test(url)) {
    return true;
  }

  if (brandHits === 0) {
    return false;
  }

  return looksLikeSpecificModelName(listing?.title || listing?.description || "");
}

function isLikelyListing(url, desiredType = "compra") {
  const lowered = String(url || "").toLowerCase();
  const source = getDomain(url);

  if (isGenericOfferLandingUrl(url, desiredType)) {
    return false;
  }

  if (desiredType === "renting") {
    if (RENTING_DOMAINS.some((domain) => source.includes(domain))) {
      return /\/ofertas\/[^/]+\/[^/]+|\/renting[^\s]*\/[^/]+\/[^/]+|\/vehiculos\/[^/]+|\/detalle\//.test(lowered);
    }

    return ["renting", "cuota", "suscripcion", "subscription", "stock", "oferta", "vehiculos"]
      .some((token) => lowered.includes(token));
  }

  if (PURCHASE_DOMAINS.some((domain) => source.includes(domain))) {
    return /\/coches-ocasion\/[^/]+\/[^/]+|\/vehiculos-ocasion\/[^/]+\/[^/]+|\/detalle\/|\/ficha\/|\/id\/[a-f0-9-]+|-[0-9]+-covo\.aspx(?:\?|$)/.test(lowered);
  }

  return ["coche", "car", "vehiculo", "vehicle", "ocasion", "segunda-mano", "stock", "usado"]
    .some((token) => lowered.includes(token));
}

function absolutizeUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function getDirectSourceUrls(company, desiredType) {
  const directUrls = COMPANY_DIRECT_URLS[company]?.[desiredType] || [];
  const domain = COMPANY_SITE_HINTS[company];
  const genericUrls = domain
    ? [`https://${domain}`, `https://www.${domain}`].filter((url, index, values) => values.indexOf(url) === index)
    : [];

  return uniq([...directUrls, ...genericUrls]);
}

function slugifyVehicleSegment(value) {
  return removeAccents(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitBrandAndModel(model = "") {
  const normalized = String(model || "").trim();
  if (!normalized) {
    return { brand: "", modelName: "" };
  }

  const knownMultiWordBrands = ["land rover", "alfa romeo", "aston martin", "mercedes benz"];
  const lower = normalized.toLowerCase();
  const multiWordBrand = knownMultiWordBrands.find((brand) => lower.startsWith(`${brand} `));

  if (multiWordBrand) {
    return {
      brand: normalized.slice(0, multiWordBrand.length),
      modelName: normalized.slice(multiWordBrand.length).trim(),
    };
  }

  const parts = normalized.split(/\s+/);
  if (parts.length === 1) {
    return { brand: normalized, modelName: "" };
  }

  return {
    brand: parts[0],
    modelName: parts.slice(1).join(" "),
  };
}

function getCompanySearchUrls(company, desiredType, models = [], filters = {}) {
  const normalizedCompany = normalizeCompanyAlias(company);
  const topModels = uniq(models.filter(Boolean)).slice(0, 3);
  const locationSlug = slugifyVehicleSegment(String(filters?.location || "")).replace(/-/g, "_");

  if (!topModels.length) {
    return [];
  }

  if (desiredType === "compra") {
    if (normalizedCompany === "Autohero") {
      return topModels.map((model) => `https://www.autohero.com/es/search/?q=${encodeURIComponent(model)}`);
    }

    if (normalizedCompany === "Flexicar") {
      return topModels.flatMap((model) => {
        const { brand, modelName } = splitBrandAndModel(model);
        const brandSlug = slugifyVehicleSegment(brand);
        const modelSlug = slugifyVehicleSegment(modelName);

        return uniq([
          brandSlug && modelSlug ? `https://www.flexicar.es/${brandSlug}/${modelSlug}/segunda-mano/` : "",
          `https://www.flexicar.es/coches-segunda-mano/?s=${encodeURIComponent(model)}`,
        ]).filter(Boolean);
      });
    }

    if (normalizedCompany === "Coches.net") {
      return topModels.flatMap((model) => {
        const { brand, modelName } = splitBrandAndModel(model);
        const brandSlug = slugifyVehicleSegment(brand).replace(/-/g, "_");
        const modelSlug = slugifyVehicleSegment(modelName).replace(/-/g, "_");

        return uniq([
          brandSlug && modelSlug && locationSlug && locationSlug !== "toda_espana"
            ? `https://www.coches.net/${brandSlug}/${modelSlug}/segunda-mano/${locationSlug}/`
            : "",
          brandSlug && modelSlug ? `https://www.coches.net/${brandSlug}/${modelSlug}/segunda-mano/` : "",
          `https://www.coches.net/segunda-mano/?Key=${encodeURIComponent(model)}`,
        ]).filter(Boolean);
      });
    }

    if (normalizedCompany === "OcasionPlus") {
      return topModels.flatMap((model) => [
        (() => {
          const { brand, modelName } = splitBrandAndModel(model);
          const brandSlug = slugifyVehicleSegment(brand);
          const modelSlug = slugifyVehicleSegment(modelName);
          return brandSlug && modelSlug
            ? `https://www.ocasionplus.com/coches-segunda-mano/${brandSlug}/${modelSlug}`
            : "";
        })(),
        `https://www.ocasionplus.com/coches-ocasion?search=${encodeURIComponent(model)}`,
        buildSearchLandingUrl(`site:ocasionplus.com ${model} coche ocasion`),
      ].filter(Boolean));
    }

    if (normalizedCompany === "Clicars") {
      return topModels.flatMap((model) => [
        `https://www.clicars.com/coches-segunda-mano?search=${encodeURIComponent(model)}`,
        buildSearchLandingUrl(`site:clicars.com ${model} coche segunda mano`),
      ]);
    }

    if (normalizedCompany === "AutoScout24") {
      return topModels.flatMap((model) => [
        `https://www.autoscout24.es/lst?sort=standard&desc=0&q=${encodeURIComponent(model)}`,
        buildSearchLandingUrl(`site:autoscout24.es ${model} coche ocasion`),
      ]);
    }

    if (normalizedCompany === "Autoocasion") {
      return topModels.flatMap((model) => [
        `https://www.autoocasion.com/coches-segunda-mano?f%5Bq%5D=${encodeURIComponent(model)}`,
        buildSearchLandingUrl(`site:autoocasion.com ${model} coche segunda mano`),
      ]);
    }

    if (normalizedCompany === "Milanuncios") {
      return topModels.flatMap((model) => [
        `https://www.milanuncios.com/coches-de-segunda-mano/?fromSearch=1&text=${encodeURIComponent(model)}`,
        buildSearchLandingUrl(`site:milanuncios.com ${model} coche segunda mano`),
      ]);
    }

    if (normalizedCompany === "Cars&Cars") {
      return topModels.flatMap((model) => [
        `https://www.carsandcars.es/coches-segunda-mano/?s=${encodeURIComponent(model)}`,
        buildSearchLandingUrl(`site:carsandcars.es ${model} coche segunda mano`),
      ]);
    }

    if (normalizedCompany === "Coches.com") {
      return topModels.flatMap((model) => [
        `https://www.coches.com/coches-segunda-mano/?q=${encodeURIComponent(model)}`,
        buildSearchLandingUrl(`site:coches.com ${model} coche segunda mano`),
      ]);
    }

    return topModels.flatMap((model) => [
      buildSearchLandingUrl(`${normalizedCompany} ${model} coche ocasion stock`),
      `https://www.autohero.com/es/search/?q=${encodeURIComponent(model)}`,
    ]);
  }

  const domainHint = COMPANY_SITE_HINTS[normalizedCompany] || "";
  return topModels.flatMap((model) => [
    buildSearchLandingUrl(`${normalizedCompany} ${model} renting cuota mensual`),
    domainHint ? buildSearchLandingUrl(`site:${domainHint} ${model} renting oferta`) : "",
  ]).filter(Boolean);
}

function isUsefulProviderLink(link) {
  const lowered = String(link || "").toLowerCase();

  if (!link || /^(mailto:|tel:|javascript:|#)/i.test(lowered)) {
    return false;
  }

  if (/\.(jpg|jpeg|png|svg|gif|webp|pdf|zip)(\?|$)/i.test(lowered)) {
    return false;
  }

  return !/(cookies|privacy|privacidad|politica|aviso-legal|faq|blog|linkedin|instagram|facebook|youtube|twitter|tiktok|newsletter|contacto|whatsapp)/i.test(lowered);
}

async function searchCompanySiteListings(models, context) {
  const companies = Array.isArray(context.companies) && context.companies.length
    ? context.companies
    : [context.company].filter(Boolean);
  const matches = [];
  const coverage = context.coverage || getSearchCoverageConfig(context.result, context.desiredType);

  for (const company of companies.slice(0, coverage.companies)) {
    if (!hasTimeRemaining(context, 1200)) {
      break;
    }

    const directUrls = uniq([
      ...getCompanySearchUrls(company, context.desiredType, models, context.filters),
      ...getDirectSourceUrls(company, context.desiredType),
    ]);
    if (!directUrls.length) {
      continue;
    }

    const providerContext = { ...context, company };

    for (const pageUrl of directUrls.slice(0, coverage.pagesPerCompany)) {
      if (!hasTimeRemaining(context, 1200)) {
        break;
      }

      try {
        if (context?.searchedProviderPages instanceof Set) {
          context.searchedProviderPages.add(pageUrl);
        }
        if (context?.searchedCompanies instanceof Set) {
          context.searchedCompanies.add(company);
        }

        const response = await fetchWithTimeout(pageUrl, {
          headers: {
            "user-agent": USER_AGENT,
            "accept-language": "es-ES,es;q=0.9,en;q=0.8",
          },
          redirect: "follow",
        }, getRemainingTimeMs(context, 4500));
        const html = await response.text();
        const providerCards = extractProviderOfferCards(html, response.url || pageUrl, company)
          .map((card) => decorateListing(card, providerContext))
          .filter((listing) => listing?.isRelevantMatch || listing?.isFallbackMatch);

        if (providerCards.length > 0) {
          matches.push(...providerCards);
        }

        const rawLinks = uniq(
          [...html.matchAll(/href=["']([^"'#]+)["']/gi)]
            .map((match) => absolutizeUrl(response.url || pageUrl, decodeHtmlEntities(match[1])))
            .filter(Boolean)
        );
        const mirrorText = shouldUseReadableMirror(response.url || pageUrl)
          ? await fetchReadableMirrorText(response.url || pageUrl, providerContext, 4500)
          : "";
        const mirrorCards = extractReadableMirrorOfferCards(mirrorText, response.url || pageUrl, company)
          .map((card) => {
            const decorated = decorateListing(card, providerContext);
            if (decorated?.isRelevantMatch || decorated?.isFallbackMatch) {
              return decorated;
            }

            if (!hasConcreteModelSignal(card, models)) {
              return null;
            }

            return {
              ...decorated,
              synthetic: false,
              isGuaranteedFallback: false,
              isRelevantMatch: false,
              isFallbackMatch: true,
              fallbackScore: Math.max(32, Number(decorated?.fallbackScore || 0)),
              rankingScore: Math.max(38, Number(decorated?.rankingScore || 0)),
              rankingSignals: uniq([...(Array.isArray(decorated?.rankingSignals) ? decorated.rankingSignals : []), "Oferta real del portal"]),
              matchReason: decorated?.matchReason || `Oferta real localizada en ${normalizeCompanyAlias(company) || getDomain(response.url || pageUrl) || "el portal"}.`,
            };
          })
          .filter(Boolean);
        if (mirrorCards.length > 0) {
          matches.push(...mirrorCards);
        }
        const mirrorLinks = extractReadableMirrorLinks(mirrorText, response.url || pageUrl)
          .map((item) => item.url)
          .filter(Boolean);

        const preferredBrands = getProfileBrandKeywords(providerContext.answers, models);
        const rankedLinks = uniq([...rawLinks, ...mirrorLinks])
          .filter((link) => isUsefulProviderLink(link) && isLikelyListing(link, providerContext.desiredType))
          .map((link) => {
            const haystack = removeAccents(link).toLowerCase();
            const modelScore = models.reduce((acc, model) => {
              const tokens = removeAccents(model)
                .toLowerCase()
                .split(/\s+/)
                .filter((token) => token.length > 2);

              return acc + tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
            }, 0);
            const brandScore = countTokenHits(haystack, preferredBrands) * 4;
            const typeScore = providerContext.desiredType === "renting"
              ? ["renting", "ofertas", "detalle", "particulares", "vehiculos", "electrico", "hibrido"].reduce(
                  (acc, token) => acc + (haystack.includes(token) ? 1 : 0),
                  0
                )
              : ["ocasion", "segunda-mano", "stock", "catalogo", "usados"].reduce(
                  (acc, token) => acc + (haystack.includes(token) ? 1 : 0),
                  0
                );
            const detailBonus = /\/detalle\/|\/ofertas\/|\/coches-ocasion\/|\/id\/[a-f0-9-]+/.test(haystack) ? 5 : 0;
            const genericPenalty = looksLikeGenericNonVehiclePage(haystack) ? 10 : 0;

            return { link, score: modelScore * 3 + brandScore + typeScore + detailBonus - genericPenalty };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score);

        for (const item of rankedLinks.slice(0, coverage.detailLinksPerPage)) {
          if (!hasTimeRemaining(providerContext, 900)) {
            break;
          }

          const listing = await fetchListingDetails(
            {
              title: `${company || "Proveedor"} · ${providerContext.desiredType}`,
              url: item.link,
              source: getDomain(item.link),
            },
            providerContext
          );

          if (listing?.url && listing?.title) {
            matches.push(listing);
          }
        }

      } catch {
        // Continue with the next provider page or search fallback.
      }
    }
  }

  return matches.sort(sortListingsByPriority);
}

async function searchFlexicarListings(models, context) {
  if (context.desiredType !== "compra") {
    return [];
  }

  const matches = [];
  const coverage = context.coverage || getSearchCoverageConfig(context.result, context.desiredType);

  for (const model of models.slice(0, coverage.modelSearches || 4)) {
    if (!hasTimeRemaining(context, 1200)) {
      break;
    }

    try {
      const { brand, modelName } = splitBrandAndModel(model);
      const brandSlug = slugifyVehicleSegment(brand);
      const modelSlug = slugifyVehicleSegment(modelName);
      const searchUrl = brandSlug && modelSlug
        ? `https://www.flexicar.es/${brandSlug}/${modelSlug}/segunda-mano/`
        : `https://www.flexicar.es/coches-segunda-mano/?s=${encodeURIComponent(model)}`;
      if (context?.searchedProviderPages instanceof Set) {
        context.searchedProviderPages.add(searchUrl);
      }
      if (context?.searchedCompanies instanceof Set) {
        context.searchedCompanies.add("Flexicar");
      }
      const response = await fetchWithTimeout(searchUrl, {
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        },
      }, getRemainingTimeMs(context, 4500));
      const html = await response.text();
      const links = uniq(
        [...html.matchAll(/href=["']([^"']*\/coches-ocasion\/[^"']+)["']/gi)]
          .map((match) => absolutizeUrl(searchUrl, decodeHtmlEntities(match[1])))
          .filter(Boolean)
      );
      const modelTokens = removeAccents(model)
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length > 2);
      const rankedLinks = links
        .map((link) => ({
          link,
          score: modelTokens.reduce(
            (acc, token) => acc + (removeAccents(link).toLowerCase().includes(token) ? 1 : 0),
            0
          ),
        }))
        .sort((a, b) => b.score - a.score);
      const preferredLinks = rankedLinks.filter((item) => item.score > 0).map((item) => item.link);

      for (const link of preferredLinks.slice(0, coverage.detailLinksPerPage)) {
        const listing = await fetchListingDetails(
          {
            title: `${model} · Flexicar`,
            url: link,
            source: "flexicar.es",
          },
          context
        );

        if (listing?.url && listing?.title) {
          matches.push(listing);
        }
      }
    } catch {
      // Continue with the next direct source or search fallback.
    }
  }

  return matches.sort(sortListingsByPriority);
}

async function searchExactObjectiveMarketplaceListings(context) {
  if (context.desiredType !== "compra") {
    return [];
  }

  const modelObjective = normalizeText(context?.answers?.modelo_objetivo);
  const location = normalizeText(context?.filters?.location || "");
  if (!modelObjective || !location || location === "toda_espana") {
    return [];
  }

  const { brand, modelName } = splitBrandAndModel(modelObjective);
  const brandSlug = slugifyVehicleSegment(brand).replace(/-/g, "_");
  const modelSlug = slugifyVehicleSegment(modelName).replace(/-/g, "_");
  const locationSlug = slugifyVehicleSegment(location).replace(/-/g, "_");
  if (!(brandSlug && modelSlug && locationSlug)) {
    return [];
  }

  const pageUrl = `https://www.coches.net/${brandSlug}/${modelSlug}/segunda-mano/${locationSlug}/`;
  if (context?.searchedProviderPages instanceof Set) {
    context.searchedProviderPages.add(pageUrl);
  }
  if (context?.searchedCompanies instanceof Set) {
    context.searchedCompanies.add("Coches.net");
  }

  const mirrorText = await fetchReadableMirrorText(pageUrl, context, 4500);
  if (!mirrorText) {
    return [];
  }
  const fuelToken = removeAccents(normalizeText(context?.filters?.fuel || "")).toLowerCase();
  const extractedCards = extractReadableMirrorOfferCards(mirrorText, pageUrl, "Coches.net");
  const fuelMatchedCards = (!fuelToken || fuelToken === "cualquiera")
    ? extractedCards
    : extractedCards.filter((card) => {
        const haystack = removeAccents(`${card?.title || ""} ${card?.description || ""} ${card?.url || ""}`).toLowerCase();
        return haystack.includes(fuelToken);
      });

  return (fuelMatchedCards.length > 0 ? fuelMatchedCards : extractedCards)
    .sort((left, right) => {
      if (!fuelToken || fuelToken === "cualquiera") {
        return 0;
      }

      const leftHaystack = removeAccents(`${left?.title || ""} ${left?.description || ""} ${left?.url || ""}`).toLowerCase();
      const rightHaystack = removeAccents(`${right?.title || ""} ${right?.description || ""} ${right?.url || ""}`).toLowerCase();
      return Number(rightHaystack.includes(fuelToken)) - Number(leftHaystack.includes(fuelToken));
    })
    .slice(0, 6)
    .map((card) => ({
      ...card,
      synthetic: false,
      isGuaranteedFallback: false,
      listingType: context.desiredType,
      hasRealImage: Boolean(card?.image && isUsefulImageUrl(card.image)),
      profileScore: 62,
      fallbackScore: 68,
      rankingScore: 78,
      rankingSignals: ["Modelo exacto localizado", "Oferta real del portal", "Provincia coincidente"],
      whyMatches: [
        `He localizado una oferta real de ${modelObjective} en Coches.net.`,
        `La provincia coincide con ${location}.`,
      ],
      matchReason: `He localizado una oferta real de ${modelObjective} en Coches.net para la provincia ${location}.`,
      isRelevantMatch: true,
      isFallbackMatch: true,
    }));
}

async function findListing({ result, answers, filters }) {
  const models = buildVehicleCandidates({ result, answers });
  const modelObjective = normalizeText(answers?.modelo_objetivo);
  const modelObjectiveTokens = removeAccents(modelObjective)
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2 || /\d/.test(token));
  const listingMatchesModelObjective = (listing) => {
    if (!modelObjectiveTokens.length) {
      return false;
    }

    const haystack = removeAccents(`${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""}`).toLowerCase();
    return modelObjectiveTokens.every((token) => haystack.includes(token));
  };
  const desiredType = getDesiredListingType(result);
  const companies = getSearchCompanies({ result, filters, desiredType });
  const queries = buildQueries({ result, answers, filters, companies, desiredType });
  const coverage = getSearchCoverageConfig(result, desiredType);
  const strictObjectiveMode = desiredType === "compra" && modelObjectiveTokens.length > 0;

  if (strictObjectiveMode) {
    coverage.companies = Math.max(coverage.companies, companies.length);
    coverage.pagesPerCompany = Math.max(coverage.pagesPerCompany, 20);
    coverage.detailLinksPerPage = Math.max(coverage.detailLinksPerPage, 20);
    coverage.queryLimit = Math.max(coverage.queryLimit, 40);
    coverage.modelSearches = Math.max(coverage.modelSearches || 0, 1);
    coverage.timeBudgetMs = Math.max(coverage.timeBudgetMs, 120000);
  }

  const company = normalizeText(filters?.company) || companies[0] || "";
  const matchReason = `Encaja con ${result?.solucion_principal?.titulo || "tu recomendacion"}; he rastreado varias plataformas de ${desiredType} para devolverte la mejor coincidencia real.`;
  const context = {
    result,
    answers,
    filters: { ...filters, companies },
    company,
    companies,
    models,
    matchReason,
    desiredType,
    coverage,
    searchedProviderPages: new Set(),
    searchedCompanies: new Set(),
    searchedQueries: [],
    excludedUrls: createNormalizedLookup(filters?.excludeUrls || []),
    excludedTitles: createNormalizedLookup(filters?.excludeTitles || []),
    preferUnseen: Boolean(filters?.refreshNonce) || Boolean((filters?.excludeUrls || []).length) || Boolean((filters?.excludeTitles || []).length),
    deadline: Date.now() + coverage.timeBudgetMs,
  };

  const getSearchCoverage = () => ({
    desiredType,
    configuredCompanies: companies,
    configuredCompanyCount: companies.length,
    visitedCompanies: Array.from(context.searchedCompanies || []),
    visitedCompanyCount: context.searchedCompanies instanceof Set ? context.searchedCompanies.size : 0,
    visitedProviderPages: context.searchedProviderPages instanceof Set ? context.searchedProviderPages.size : 0,
    duckduckgoQueriesAttempted: Array.isArray(context.searchedQueries) ? context.searchedQueries.length : 0,
    queryLimit: coverage.queryLimit,
    pagesPerCompany: coverage.pagesPerCompany,
    detailLinksPerPage: coverage.detailLinksPerPage,
    timeBudgetMs: coverage.timeBudgetMs,
  });

  const matches = [
    ...(await searchExactObjectiveMarketplaceListings(context)),
  ];

  if (matches.some((listing) => listing?.isRelevantMatch && hasConcreteModelSignal(listing, models))) {
    return buildRankedListingResponse(matches, {
      fallbackMode: false,
      excludedUrls: context.excludedUrls,
      excludedTitles: context.excludedTitles,
      preferUnseen: context.preferUnseen,
      answers,
      models,
      searchCoverage: getSearchCoverage(),
    });
  }

  if (strictObjectiveMode) {
    matches.push(
      ...(await searchCompanySiteListings(models, context)),
      ...(await searchFlexicarListings(models, context))
    );

    const strictRelevantMatches = matches.filter((listing) => listing?.isRelevantMatch);
    const strictConcreteMatches = strictRelevantMatches.filter((listing) => hasConcreteModelSignal(listing, models));
    const strictObjectiveMatches = strictConcreteMatches.filter((listing) => listingMatchesModelObjective(listing));

    if (strictObjectiveMatches.length > 0) {
      return buildRankedListingResponse([...strictObjectiveMatches, ...matches], {
        fallbackMode: false,
        excludedUrls: context.excludedUrls,
        excludedTitles: context.excludedTitles,
        preferUnseen: context.preferUnseen,
        answers,
        models,
        searchCoverage: getSearchCoverage(),
      });
    }
  }

  const queryLimit = coverage.queryLimit;

  for (const query of queries.slice(0, Math.min(6, queryLimit))) {
    if (!hasTimeRemaining(context, 1400)) {
      break;
    }

    try {
      if (Array.isArray(context.searchedQueries)) {
        context.searchedQueries.push(query);
      }
      const candidates = await searchDuckDuckGo(query, context);
      const usefulCandidates = candidates
        .filter((candidate) => isLikelyListing(candidate.url, desiredType))
        .slice(0, 4);

      for (const candidate of usefulCandidates) {
        if (!hasTimeRemaining(context, 1000)) {
          break;
        }

        const listing = await fetchListingDetails(candidate, context);
        if (listing?.url && listing?.title) {
          matches.push(listing);
        }
      }
    } catch {
      // Continue with provider crawling.
    }
  }

  if (!strictObjectiveMode) {
    matches.push(
      ...(await searchCompanySiteListings(models, context)),
      ...(await searchFlexicarListings(models, context))
    );
  }

  const initialRelevantMatches = matches.filter((listing) => listing?.isRelevantMatch);
  const initialRelevantProviders = new Set(
    initialRelevantMatches
      .map((listing) => normalizeText(listing?.source || getDomain(listing?.url || "")).toLowerCase())
      .filter(Boolean)
  );
  if (initialRelevantMatches.length >= 4 && initialRelevantProviders.size >= Math.min(2, companies.length)) {
    return buildRankedListingResponse(matches, {
      fallbackMode: false,
      excludedUrls: context.excludedUrls,
      excludedTitles: context.excludedTitles,
      preferUnseen: context.preferUnseen,
      answers,
      models,
      searchCoverage: getSearchCoverage(),
    });
  }

  for (const query of queries.slice(Math.min(6, queryLimit), queryLimit)) {
    if (!hasTimeRemaining(context, 1200)) {
      break;
    }

    try {
      if (Array.isArray(context.searchedQueries)) {
        context.searchedQueries.push(query);
      }
      const candidates = await searchDuckDuckGo(query, context);
      const usefulCandidates = candidates
        .filter((candidate) => isLikelyListing(candidate.url, desiredType))
        .slice(0, 4);

      for (const candidate of usefulCandidates) {
        if (!hasTimeRemaining(context, 800)) {
          break;
        }

        const listing = await fetchListingDetails(candidate, context);
        if (listing?.url && listing?.title) {
          matches.push(listing);
        }
      }

      const relevantMatches = matches.filter((listing) => listing?.isRelevantMatch);
      if (relevantMatches.length >= 6) {
        break;
      }
    } catch {
      // If the external search engine blocks the request, keep the provider-only results and show a friendly final message.
    }
  }

  const bestExactMatches = matches.filter((listing) => listing?.isRelevantMatch);
  const concreteExactMatches = bestExactMatches.filter((listing) => hasConcreteModelSignal(listing, models));
  const concreteObjectiveMatches = modelObjectiveTokens.length
    ? concreteExactMatches.filter((listing) => listingMatchesModelObjective(listing))
    : concreteExactMatches;

  if (concreteExactMatches.length > 0 && (!modelObjectiveTokens.length || concreteObjectiveMatches.length > 0)) {
    return buildRankedListingResponse([...concreteExactMatches, ...matches], {
      fallbackMode: false,
      excludedUrls: context.excludedUrls,
      excludedTitles: context.excludedTitles,
      preferUnseen: context.preferUnseen,
      answers,
      models,
      searchCoverage: getSearchCoverage(),
    });
  }

  if (bestExactMatches.length > 0) {
    return buildRankedListingResponse(
      [...bestExactMatches, ...buildGuaranteedFallbackListings({ result, answers, filters, desiredType, companies, models })],
      {
        fallbackMode: true,
        excludedUrls: context.excludedUrls,
        excludedTitles: context.excludedTitles,
        preferUnseen: context.preferUnseen,
        answers,
        models,
        searchCoverage: getSearchCoverage(),
      }
    );
  }

  const bestFallbackMatches = matches.filter((listing) => listing?.isFallbackMatch);
  const concreteFallbackMatches = bestFallbackMatches.filter((listing) => hasConcreteModelSignal(listing, models));
  const concreteFallbackObjectiveMatches = modelObjectiveTokens.length
    ? concreteFallbackMatches.filter((listing) => listingMatchesModelObjective(listing))
    : concreteFallbackMatches;

  if (concreteFallbackMatches.length > 0 && (!modelObjectiveTokens.length || concreteFallbackObjectiveMatches.length > 0)) {
    return buildRankedListingResponse([...concreteFallbackMatches, ...bestFallbackMatches], {
      fallbackMode: true,
      excludedUrls: context.excludedUrls,
      excludedTitles: context.excludedTitles,
      preferUnseen: context.preferUnseen,
      answers,
      models,
      searchCoverage: getSearchCoverage(),
    });
  }

  if (bestFallbackMatches.length > 0) {
    return buildRankedListingResponse(
      [...bestFallbackMatches, ...buildGuaranteedFallbackListings({ result, answers, filters, desiredType, companies, models })],
      {
        fallbackMode: true,
        excludedUrls: context.excludedUrls,
        excludedTitles: context.excludedTitles,
        preferUnseen: context.preferUnseen,
        answers,
        models,
        searchCoverage: getSearchCoverage(),
      }
    );
  }

  return buildRankedListingResponse(
    buildGuaranteedFallbackListings({ result, answers, filters, desiredType, companies, models }),
    {
      fallbackMode: true,
      excludedUrls: context.excludedUrls,
      excludedTitles: context.excludedTitles,
      preferUnseen: context.preferUnseen,
      answers,
      models,
      searchCoverage: getSearchCoverage(),
    }
  );
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = safeJsonParse(req.body);
    const result = body?.result || {};
    const answers = body?.answers || {};
    const filters = body?.filters || {};

    if (!result?.solucion_principal?.titulo) {
      res.status(400).json({ error: "Falta el resultado del test para buscar un anuncio real." });
      return;
    }

    const rankedResult = await findListing({ result, answers, filters });
    res.status(200).json(rankedResult);
  } catch (error) {
    res.status(500).json({ error: error?.message || "No se pudo buscar un anuncio real." });
  }
};

module.exports.buildRankedListingResponse = buildRankedListingResponse;
