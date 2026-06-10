const UTM_SESSION_KEY = "cw_utm";
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/**
 * Lee los UTM de la URL actual y los persiste en sessionStorage.
 * Sólo sobreescribe si la URL tiene al menos un parámetro UTM.
 * @returns {object|null} Los UTM capturados, o null si la URL no tenía ninguno.
 */
export function captureUtmFromUrl() {
  if (typeof window === "undefined") return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    for (const key of UTM_PARAMS) {
      const val = params.get(key);
      if (val) utm[key] = val;
    }

    if (Object.keys(utm).length === 0) return null;

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
