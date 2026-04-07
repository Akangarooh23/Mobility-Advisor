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

const BRAND_MODEL_MAP = {
  generalista_europea: ["Volkswagen Golf", "Seat Leon", "Renault Captur", "Skoda Octavia"],
  asiatica_fiable: ["Toyota Corolla", "Kia Niro", "Hyundai Kona", "Nissan Qashqai"],
  premium_alemana: ["BMW Serie 1", "Audi A3", "Mercedes Clase A"],
  premium_escandinava: ["Volvo XC40", "Volvo V60"],
  nueva_china: ["BYD Dolphin", "MG4 Electric", "XPeng G6"],
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

async function fetchListingDetails(candidate, matchReason) {
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
    const description =
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "description") ||
      candidate.title;
    const price = parsePrice(`${html.slice(0, 60000)} ${title} ${description}`);

    return {
      title: normalizeText(title),
      url: response.url || candidate.url,
      source: getDomain(response.url || candidate.url),
      description: normalizeText(description).slice(0, 220),
      price,
      matchReason,
    };
  } catch {
    return {
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      description: "Opcion real localizada en la web externa para tu perfil.",
      price: "",
      matchReason,
    };
  }
}

function buildVehicleCandidates({ result, answers }) {
  const preferred = BRAND_MODEL_MAP[answers?.marca_preferencia] || [];
  const propulsions = (Array.isArray(result?.propulsiones_viables) ? result.propulsiones_viables : [])
    .map((item) => removeAccents(item).toLowerCase());
  const dynamic = [];

  if (answers?.ocupantes === "7_plazas_maletero_grande") {
    dynamic.push("Skoda Kodiaq", "Kia Sorento", "Hyundai Santa Fe");
  } else if (answers?.ocupantes === "2_plazas_maletero_pequeno") {
    dynamic.push("Toyota Yaris", "Renault Clio", "Seat Ibiza");
  } else {
    dynamic.push("Toyota Corolla", "Seat Leon", "Renault Captur");
  }

  if (propulsions.some((item) => item.includes("electric") || item.includes("electrico"))) {
    dynamic.unshift("MG4 Electric", "BYD Dolphin", "Hyundai Kona Electric");
  } else if (propulsions.some((item) => item.includes("phev") || item.includes("hibrid"))) {
    dynamic.unshift("Toyota Corolla Hybrid", "Kia Niro", "Hyundai Kona Hybrid");
  }

  return uniq([...preferred, ...dynamic]).slice(0, 5);
}

function buildQueries({ result, answers, filters }) {
  const company = normalizeText(filters?.company) || result?.solucion_principal?.empresas_recomendadas?.[0] || "";
  const companySite = COMPANY_SITE_HINTS[company] || "";
  const models = buildVehicleCandidates({ result, answers });
  const budgetHint = BUDGET_HINTS[filters?.budget] || "";
  const incomeHint = INCOME_HINTS[filters?.income] || "";
  const operationHint = ["renting_largo", "renting_corto"].includes(result?.solucion_principal?.tipo)
    ? "renting coche"
    : "coche ocasion anuncio";
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

function isLikelyListing(url) {
  const lowered = String(url || "").toLowerCase();
  return ["coche", "car", "vehiculo", "vehicle", "renting", "ocasion", "segunda-mano", "stock"]
    .some((token) => lowered.includes(token));
}

function absolutizeUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

async function searchFlexicarListings(models, matchReason) {
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
          matchReason
        );

        if (listing?.url && listing?.title) {
          return listing;
        }
      }
    } catch {
      // Continue with the next direct source or search fallback.
    }
  }

  return null;
}

async function findListing({ result, answers, filters }) {
  const queries = buildQueries({ result, answers, filters });
  const models = buildVehicleCandidates({ result, answers });
  const company = normalizeText(filters?.company) || result?.solucion_principal?.empresas_recomendadas?.[0] || "";
  const matchReason = `Encaja con ${result?.solucion_principal?.titulo || "tu recomendacion"}${company ? `; he priorizado ${company} y, si su stock publico no era accesible, te muestro una alternativa real equivalente.` : "."}`;

  const directListing = await searchFlexicarListings(models, matchReason);
  if (directListing) {
    return directListing;
  }

  for (const query of queries) {
    const candidates = await searchDuckDuckGo(query);
    const usefulCandidates = candidates.filter((candidate) => isLikelyListing(candidate.url));

    for (const candidate of usefulCandidates.slice(0, 3)) {
      const listing = await fetchListingDetails(candidate, matchReason);
      if (listing?.url && listing?.title) {
        return listing;
      }
    }
  }

  throw new Error("No he podido localizar un anuncio real util con esas opciones. Prueba otra plataforma o franja de cuota.");
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
