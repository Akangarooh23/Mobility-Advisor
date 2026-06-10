const UTM_SESSION_KEY = "cw_utm";
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const REFERRER_MAP = [
  { pattern: /google\./i,     source: "google",    medium: "organic" },
  { pattern: /bing\./i,       source: "bing",      medium: "organic" },
  { pattern: /yahoo\./i,      source: "yahoo",     medium: "organic" },
  { pattern: /duckduckgo\./i, source: "duckduckgo",medium: "organic" },
  { pattern: /facebook\./i,   source: "facebook",  medium: "social"  },
  { pattern: /instagram\./i,  source: "instagram", medium: "social"  },
  { pattern: /t\.co\b/i,      source: "twitter",   medium: "social"  },
  { pattern: /twitter\./i,    source: "twitter",   medium: "social"  },
  { pattern: /linkedin\./i,   source: "linkedin",  medium: "social"  },
  { pattern: /tiktok\./i,     source: "tiktok",    medium: "social"  },
  { pattern: /youtube\./i,    source: "youtube",   medium: "social"  },
  { pattern: /whatsapp\./i,   source: "whatsapp",  medium: "social"  },
];

function inferFromReferrer() {
  try {
    const ref = document.referrer;
    if (!ref) return { utm_source: "direct", utm_medium: "none" };
    for (const { pattern, source, medium } of REFERRER_MAP) {
      if (pattern.test(ref)) return { utm_source: source, utm_medium: medium };
    }
    const hostname = new URL(ref).hostname.replace(/^www\./, "");
    return { utm_source: hostname, utm_medium: "referral" };
  } catch {
    return { utm_source: "direct", utm_medium: "none" };
  }
}

export function captureUtmFromUrl() {
  if (typeof window === "undefined") return null;

  try {
    // If we already have a UTM captured this session, don't overwrite it
    const existing = sessionStorage.getItem(UTM_SESSION_KEY);
    if (existing) return JSON.parse(existing);

    const params = new URLSearchParams(window.location.search);
    const utm = {};
    for (const key of UTM_PARAMS) {
      const val = params.get(key);
      if (val) utm[key] = val;
    }

    // No UTM params in URL — infer source from referrer
    if (Object.keys(utm).length === 0) {
      Object.assign(utm, inferFromReferrer());
    }

    utm._captured_at = new Date().toISOString();
    utm._landing_url = window.location.href;
    sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(utm));
    return utm;
  } catch {
    return null;
  }
}

/**
 * Devuelve los UTM guardados en sessionStorage, o null si no hay ninguno.
 * @returns {object|null}
 */
export function getStoredUtm() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Devuelve un objeto plano con sólo los campos utm_* (sin _captured_at ni _landing_url).
 * Útil para adjuntar a eventos de conversión o payloads de API.
 * @returns {object} Puede estar vacío si no hay UTM guardados.
 */
export function getUtmPayload() {
  const utm = getStoredUtm();
  if (!utm) return {};
  return UTM_PARAMS.reduce((acc, key) => {
    if (utm[key]) acc[key] = utm[key];
    return acc;
  }, {});
}
