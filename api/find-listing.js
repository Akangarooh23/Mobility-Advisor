const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const COMPANY_SITE_HINTS = {
  "Ayvens": "ayvens.com",
  "Arval": "arval.es",
  "Alphabet": "alphabet.es",
  "Coches.net": "coches.net",
  "Autohero": "autohero.com",
  "Spoticar": "spoticar.es",
  "Flexicar": "flexicar.es",
  "Concesionario oficial": "coches.net",
  "Northgate": "northgate.es",
  "Free2move": "free2move.com",
  "OK Mobility": "okmobility.com",
};

const COMPANY_DIRECT_URLS = {
  "Ayvens": {
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
    renting: ["https://okmobility.com/es/renting"],
    compra: [],
  },
  "Free2move": {
    renting: ["https://www.free2move.com/es-ES/car-on-demand"],
    compra: [],
  },
  "Alphabet": {
    renting: ["https://www.alphabet.es/"],
    compra: [],
  },
};

const BRAND_MODEL_MAP = {
  generalista_europea: ["Volkswagen Golf", "Seat Leon", "Renault Captur", "Skoda Octavia"],
  asiatica_fiable: ["Toyota Corolla", "Kia Niro", "Hyundai Kona", "Nissan Qashqai"],
  premium_alemana: ["BMW Serie 1", "Audi A3", "Mercedes Clase A"],
  premium_escandinava: ["Volvo XC40", "Volvo V60"],
  nueva_china: ["BYD Dolphin", "MG4 Electric", "XPeng G6"],
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

const INCOME_HINTS = {
  fijos_estables: "ingresos fijos y estables",
  fijos_variable: "ingresos fijos con variable",
  variables_autonomo: "ingresos variables autonomo",
};

const RENTING_DOMAINS = ["ayvens.com", "arval.es", "alphabet.es", "northgate.es", "free2move.com", "okmobility.com"];
const PURCHASE_DOMAINS = ["coches.net", "flexicar.es", "autohero.com", "spoticar.es"];
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
  return normalizeText(decodeHtmlEntities(String(text || "").replace(/<[^>]*>/g, " ")));
}

function removeAccents(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
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

function parsePrice(text) {
  const source = stripHtml(text);
  const match =
    source.match(/(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?)\s*€/i) ||
    source.match(/€\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?)/i);

  return match?.[1] ? `${match[1].replace(/\s+/g, "") } €` : "";
}

async function searchDuckDuckGo(query) {
  const response = await fetch(SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": USER_AGENT,
      "accept-language": "es-ES,es;q=0.9,en;q=0.8",
    },
    body: `q=${encodeURIComponent(query)}&kl=es-es`,
  });

  if (!response.ok) {
    throw new Error("No se ha podido consultar el buscador externo.");
  }

  return extractSearchResults(await response.text());
}

function buildWhyMatches({ result, answers, filters, company, listing, desiredType }) {
  const reasons = [];
  const viablePropulsions = Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [];
  const usage = Array.isArray(answers?.uso_principal) ? answers.uso_principal : [];

  reasons.push(
    desiredType === "renting"
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

  if (answers?.horizonte === "menos_2" || answers?.horizonte === "2_3") {
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

  if (company) {
    reasons.push(`He intentado priorizar stock real de ${company} y, si no era accesible, una alternativa equivalente.`);
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
    "bmw", "audi", "mercedes", "volvo", "byd", "mg", "xpeng", "peugeot", "citroen", "dacia",
  ];
  const fromModels = models
    .map((model) => {
      const normalized = removeAccents(model).toLowerCase();
      return knownBrands.find((brand) => normalized.startsWith(brand)) || "";
    })
    .filter(Boolean);

  return uniq([...fromPreference, ...fromModels]);
}

function countTokenHits(haystack, tokens) {
  return uniq(tokens).reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
}

function looksLikeGenericNonVehiclePage(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(punto de recarga|recarga electrica|wallbox|cargador|grandes empresas|gestion de flotas|movilidad empresarial|consultoria|telemetria|sobre nosotros|blog|noticias|actualidad|contacto|preguntas frecuentes|faq|ventajas fiscales|ventajas del renting|soluciones de movilidad|movilidad para empresas)/.test(haystack);
}

function hasMonthlyPriceSignal(text) {
  return /(?:\b\d{2,4}\s*(?:€|eur)\s*(?:\/?\s*mes|mes)|desde\s+\d{2,4}\s*(?:€|eur))/i.test(String(text || ""));
}

function looksLikeVehicleOffer(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(coche|vehiculo|turismo|compacto|suv|berlina|utilitario|todoterreno|furgoneta|electrico|hibrid|gasolina|diesel|km\/ano|km ano)/.test(haystack);
}

function scoreListingForProfile(listing, { result, answers, filters, company, models = [], desiredType }) {
  const rawText = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.price || ""}`;
  const haystack = removeAccents(rawText).toLowerCase();
  const preferredBrands = getProfileBrandKeywords(answers, models);
  const preferredFuel = removeAccents(answers?.propulsion_preferida || "").toLowerCase();
  const viableFuel = removeAccents(
    Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables.join(" ") : ""
  ).toLowerCase();
  const monthlyPriceSignal = hasMonthlyPriceSignal(rawText);
  const vehicleOfferSignal = looksLikeVehicleOffer(rawText);
  const genericNonVehicle = looksLikeGenericNonVehiclePage(rawText);
  const brandHits = countTokenHits(haystack, preferredBrands);

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

  score += brandHits * 4;

  if ((preferredFuel.includes("electrico") || viableFuel.includes("electrico")) && /(electric|electrico|bev|ev |cero emisiones)/.test(haystack)) {
    score += 6;
  } else if (preferredFuel.includes("electrico")) {
    score -= 6;
  }

  if ((preferredFuel.includes("hibrido") || viableFuel.includes("hibrid") || viableFuel.includes("phev")) && /(hybrid|hibrid|phev)/.test(haystack)) {
    score += 5;
  }
  if (preferredFuel.includes("diesel") && /diesel/.test(haystack)) {
    score += 4;
  }
  if (preferredFuel.includes("gasolina") && /gasolina/.test(haystack)) {
    score += 3;
  }

  if (answers?.marca_preferencia && answers.marca_preferencia !== "sin_preferencia" && brandHits === 0) {
    score -= 5;
  }

  if (answers?.ocupantes === "7_plazas_maletero_grande" && /(kodiaq|sorento|santa fe|x-trail|5008|tourneo)/.test(haystack)) {
    score += 4;
  }
  if (answers?.ocupantes === "5_plazas_maletero_medio" && /(corolla|leon|captur|qashqai|tucson|sportage|octavia|kona|niro|dolphin|mg4|ev3)/.test(haystack)) {
    score += 4;
  }
  if (answers?.ocupantes === "2_plazas_maletero_pequeno" && /(yaris|clio|ibiza|polo|208|i20|micra)/.test(haystack)) {
    score += 4;
  }

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

  if (vehicleOfferSignal) {
    score += 2;
  }

  if (genericNonVehicle) {
    score -= 14;
  }

  if (desiredType === "renting" && exactModelMatches === 0 && brandHits === 0) {
    score -= 4;
  }

  if (filters?.budget) {
    score += 1;
  }

  return score;
}

function isRelevantListingForProfile(listing, context) {
  const rawText = `${listing?.title || ""} ${listing?.description || ""} ${listing?.url || ""} ${listing?.price || ""}`;
  const haystack = removeAccents(rawText).toLowerCase();
  const score = Number(listing?.profileScore || 0);
  const preferredBrands = getProfileBrandKeywords(context.answers, context.models || []);
  const brandHits = countTokenHits(haystack, preferredBrands);
  const modelHits = (context.models || []).reduce((acc, model) => {
    const tokens = removeAccents(model)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);

    return acc + (tokens.some((token) => haystack.includes(token)) ? 1 : 0);
  }, 0);

  if (looksLikeGenericNonVehiclePage(rawText)) {
    return false;
  }

  if (context.desiredType === "renting") {
    return (
      score >= 12 &&
      looksLikeVehicleOffer(rawText) &&
      (hasMonthlyPriceSignal(rawText) || brandHits > 0 || modelHits > 0)
    );
  }

  return score >= 8;
}

function getDesiredListingType(result) {
  return ["renting_largo", "renting_corto"].includes(result?.solucion_principal?.tipo)
    ? "renting"
    : "compra";
}

function hasRentingSignals(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(renting|suscrip|subscription|cuota|cuota mensual|todo incluido|sin entrada|mes iva|arrendamiento)/.test(haystack);
}

function hasPurchaseSignals(text) {
  const haystack = removeAccents(String(text || "")).toLowerCase();
  return /(coches-ocasion|ocasion|segunda mano|seminuevo|km 0|km0|vo certificado|precio contado|precio final|venta|usado|stock)/.test(haystack);
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
  const whyMatches = buildWhyMatches({ ...context, listing });
  const profileScore = scoreListingForProfile(listing, context);

  return {
    ...listing,
    listingType: context.desiredType,
    profileScore,
    whyMatches,
    matchReason:
      whyMatches[1] ||
      whyMatches[0] ||
      context.matchReason ||
      "Opcion real localizada en la web externa para tu perfil.",
  };
}

async function fetchListingDetails(candidate, context) {
  try {
    const response = await fetch(candidate.url, {
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    const html = await response.text();
    const title =
      getMetaContent(html, "og:title") ||
      getMetaContent(html, "twitter:title") ||
      stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ||
      candidate.title;
    const bodyPreview = stripHtml(html).slice(0, 320);
    const description =
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "description") ||
      bodyPreview ||
      candidate.title;
    const price = parsePrice(`${html.slice(0, 60000)} ${title} ${description}`);

    const listing = decorateListing(
      {
        title: normalizeText(title),
        url: response.url || candidate.url,
        source: getDomain(response.url || candidate.url),
        description: normalizeText(description).slice(0, 220),
        price,
      },
      context
    );

    return matchesDesiredListingType(listing, context.desiredType) && isRelevantListingForProfile(listing, context)
      ? listing
      : null;
  } catch {
    const listing = decorateListing(
      {
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        description: "Opcion real localizada en la web externa para tu perfil.",
        price: "",
      },
      context
    );

    return matchesDesiredListingType(listing, context.desiredType) && isRelevantListingForProfile(listing, context)
      ? listing
      : null;
  }
}

function buildVehicleCandidates({ result, answers }) {
  const preferred = BRAND_MODEL_MAP[answers?.marca_preferencia] || [];
  const propulsions = (Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [])
    .map((item) => removeAccents(item).toLowerCase());
  const usage = Array.isArray(answers?.uso_principal) ? answers.uso_principal : [];
  const dynamic = [
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

  if (answers?.horizonte === "menos_2" || answers?.horizonte === "2_3") {
    dynamic.unshift("Toyota Corolla", "Seat Leon", "Renault Captur");
  } else if (answers?.horizonte === "5_7" || answers?.horizonte === "mas_7") {
    dynamic.unshift("Toyota Corolla", "Kia Niro", "Hyundai Tucson");
  }

  if (propulsions.some((item) => item.includes("electric") || item.includes("electrico"))) {
    dynamic.unshift("MG4 Electric", "BYD Dolphin", "Hyundai Kona Electric");
  } else if (propulsions.some((item) => item.includes("phev") || item.includes("hibrid"))) {
    dynamic.unshift("Toyota Corolla Hybrid", "Kia Niro", "Hyundai Kona Hybrid");
  }

  return uniq([...preferred, ...dynamic]).slice(0, 8);
}

function buildQueries({ result, answers, filters }) {
  const company = normalizeText(filters?.company) || result?.solucion_principal?.empresas_recomendadas?.[0] || "";
  const companySite = COMPANY_SITE_HINTS[company] || "";
  const models = buildVehicleCandidates({ result, answers });
  const budgetHint = BUDGET_HINTS[filters?.budget] || "";
  const incomeHint = INCOME_HINTS[filters?.income] || "";
  const desiredType = getDesiredListingType(result);
  const operationHint = desiredType === "renting"
    ? "renting coche cuota mensual oferta"
    : "coche ocasion compra anuncio";
  const fuelHint = (Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [])
    .slice(0, 2)
    .join(" ");

  const queries = [];

  for (const model of models) {
    queries.push(`${company} ${model} ${operationHint} España ${budgetHint}`.trim());
    if (companySite) {
      queries.push(`site:${companySite} ${model} ${operationHint} ${budgetHint}`.trim());
    }
    queries.push(`${model} ${operationHint} España ${fuelHint}`.trim());
  }

  if (!queries.length) {
    queries.push(`${company} ${operationHint} España ${budgetHint} ${incomeHint}`.trim());
  }

  return uniq(queries).slice(0, 10);
}

function isLikelyListing(url, desiredType = "compra") {
  const lowered = String(url || "").toLowerCase();
  const source = getDomain(url);

  if (desiredType === "renting") {
    if (RENTING_DOMAINS.some((domain) => source.includes(domain))) {
      return true;
    }

    return ["renting", "cuota", "suscripcion", "subscription", "stock", "oferta", "vehiculos"]
      .some((token) => lowered.includes(token));
  }

  if (PURCHASE_DOMAINS.some((domain) => source.includes(domain))) {
    return true;
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
  const directUrls = getDirectSourceUrls(context.company, context.desiredType);
  if (!directUrls.length) {
    return null;
  }

  const matches = [];

  for (const pageUrl of directUrls.slice(0, 3)) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });
      const html = await response.text();
      const rawLinks = uniq(
        [...html.matchAll(/href=["']([^"'#]+)["']/gi)]
          .map((match) => absolutizeUrl(response.url || pageUrl, decodeHtmlEntities(match[1])))
          .filter(Boolean)
      );

      const preferredBrands = getProfileBrandKeywords(context.answers, models);
      const rankedLinks = rawLinks
        .filter((link) => isUsefulProviderLink(link) && isLikelyListing(link, context.desiredType))
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
          const typeScore = context.desiredType === "renting"
            ? ["renting", "ofertas", "detalle", "particulares", "vehiculos", "electrico", "hibrido"].reduce(
                (acc, token) => acc + (haystack.includes(token) ? 1 : 0),
                0
              )
            : ["ocasion", "segunda-mano", "stock", "catalogo", "usados"].reduce(
                (acc, token) => acc + (haystack.includes(token) ? 1 : 0),
                0
              );
          const detailBonus = /\/detalle\/|\/ofertas\//.test(haystack) ? 5 : 0;
          const genericPenalty = looksLikeGenericNonVehiclePage(haystack) ? 10 : 0;

          return { link, score: modelScore * 3 + brandScore + typeScore + detailBonus - genericPenalty };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      for (const item of rankedLinks.slice(0, 8)) {
        const listing = await fetchListingDetails(
          {
            title: `${context.company || "Proveedor"} · ${context.desiredType}`,
            url: item.link,
            source: getDomain(item.link),
          },
          context
        );

        if (listing?.url && listing?.title) {
          matches.push(listing);
        }
      }
    } catch {
      // Continue with the next provider page or search fallback.
    }
  }

  return matches.sort((a, b) => (b.profileScore || 0) - (a.profileScore || 0))[0] || null;
}

async function searchFlexicarListings(models, context) {
  if (context.desiredType !== "compra") {
    return null;
  }

  const matches = [];

  for (const model of models) {
    try {
      const searchUrl = `https://www.flexicar.es/coches-segunda-mano/?s=${encodeURIComponent(model)}`;
      const response = await fetch(searchUrl, {
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        },
      });
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

      for (const link of preferredLinks.slice(0, 3)) {
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

  return matches.sort((a, b) => (b.profileScore || 0) - (a.profileScore || 0))[0] || null;
}

async function findListing({ result, answers, filters }) {
  const queries = buildQueries({ result, answers, filters });
  const models = buildVehicleCandidates({ result, answers });
  const company = normalizeText(filters?.company) || result?.solucion_principal?.empresas_recomendadas?.[0] || "";
  const desiredType = getDesiredListingType(result);
  const matchReason = `Encaja con ${result?.solucion_principal?.titulo || "tu recomendacion"}${company ? `; he priorizado ${company} y, si su stock publico no era accesible, te muestro una alternativa real equivalente.` : "."}`;
  const context = { result, answers, filters, company, models, matchReason, desiredType };

  if (desiredType === "renting") {
    const companyListing = await searchCompanySiteListings(models, context);
    if (companyListing) {
      return companyListing;
    }
  }

  const directListing = await searchFlexicarListings(models, context);
  if (directListing) {
    return directListing;
  }

  const matches = [];

  for (const query of queries) {
    try {
      const candidates = await searchDuckDuckGo(query);
      const usefulCandidates = candidates.filter((candidate) => isLikelyListing(candidate.url, desiredType));

      for (const candidate of usefulCandidates.slice(0, 3)) {
        const listing = await fetchListingDetails(candidate, context);
        if (listing?.url && listing?.title) {
          matches.push(listing);
        }
      }
    } catch {
      // If the external search engine blocks the request, keep the provider-only results and show a friendly final message.
    }
  }

  const bestMatch = matches.sort((a, b) => (b.profileScore || 0) - (a.profileScore || 0))[0];
  if (bestMatch) {
    return bestMatch;
  }

  throw new Error(
    desiredType === "renting"
      ? "No he encontrado una oferta real de renting que encaje bien con la marca y motorizacion que has marcado. Prueba otra plataforma o amplia la cuota objetivo."
      : "No he podido localizar un anuncio real de compra con esas opciones. Prueba otra plataforma o filtro."
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

    const listing = await findListing({ result, answers, filters });
    res.status(200).json({ listing });
  } catch (error) {
    res.status(500).json({ error: error?.message || "No se pudo buscar un anuncio real." });
  }
};
