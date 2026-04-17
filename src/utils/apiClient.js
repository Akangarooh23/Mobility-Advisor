export const ANALYZE_API_ENDPOINT = "/api/analyze";
export const LISTING_API_ENDPOINT = "/api/find-listing";
export const ALERT_EMAIL_API_ENDPOINT = "/api/send-alert-email";
export const AUTH_API_ENDPOINT = "/api/auth";
export const VEHICLE_CATALOG_API_ENDPOINT = "/api/vehicle-catalog";
export const VEHICLE_CATALOG_ADMIN_API_ENDPOINT = "/api/vehicle-catalog-admin";
export const BILLING_CHECKOUT_API_ENDPOINT = "/api/billing-checkout";
export const BILLING_PORTAL_API_ENDPOINT = "/api/billing-portal";
export const BILLING_ACCOUNT_API_ENDPOINT = "/api/billing-account";

export async function readApiResponse(response, { endpointLabel = "analyze" } = {}) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html") || trimmed.startsWith("<")) {
    const error = new Error(
      typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? `El endpoint /api/${endpointLabel} no estaba respondiendo como API en local. Reinicia npm start y vuelve a probar.`
        : `El endpoint /api/${endpointLabel} ha devuelto HTML en lugar de JSON. Revisa la configuración del hosting o de la API.`
    );
    error.code = "NON_JSON_API_RESPONSE";
    throw error;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const error = new Error("La respuesta de la API no tiene un JSON válido.");
    error.code = "INVALID_API_RESPONSE";
    throw error;
  }
}

async function postJson(endpoint, payload, { endpointLabel, headers = {}, ...options } = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
    ...options,
  });

  const data = await readApiResponse(response, { endpointLabel });
  return { response, data };
}

async function getJson(endpoint, { endpointLabel, headers = {}, ...options } = {}) {
  const response = await fetch(endpoint, {
    method: "GET",
    credentials: "include",
    headers,
    ...options,
  });

  const data = await readApiResponse(response, { endpointLabel });
  return { response, data };
}

export function postAnalyzeJson(payload, options = {}) {
  return postJson(ANALYZE_API_ENDPOINT, payload, {
    endpointLabel: "analyze",
    ...options,
  });
}

export function postListingJson(payload, options = {}) {
  return postJson(LISTING_API_ENDPOINT, payload, {
    endpointLabel: "find-listing",
    ...options,
  });
}

export function postAlertEmailDigestJson(payload, options = {}) {
  return postJson(ALERT_EMAIL_API_ENDPOINT, payload, {
    endpointLabel: "send-alert-email",
    ...options,
  });
}

export function postAuthJson(payload, options = {}) {
  return postJson(AUTH_API_ENDPOINT, payload, {
    endpointLabel: "auth",
    ...options,
  });
}

export function getAuthSessionJson(options = {}) {
  return getJson(AUTH_API_ENDPOINT, {
    endpointLabel: "auth",
    ...options,
  });
}

export function getVehicleCatalogJson(options = {}) {
  return getJson(VEHICLE_CATALOG_API_ENDPOINT, {
    endpointLabel: "vehicle-catalog",
    ...options,
  });
}

export function postVehicleCatalogAdminJson(payload, options = {}) {
  return postJson(VEHICLE_CATALOG_ADMIN_API_ENDPOINT, payload, {
    endpointLabel: "vehicle-catalog-admin",
    ...options,
  });
}

export function postBillingCheckoutJson(payload, options = {}) {
  return postJson(BILLING_CHECKOUT_API_ENDPOINT, payload, {
    endpointLabel: "billing-checkout",
    ...options,
  });
}

export function postBillingPortalJson(payload, options = {}) {
  return postJson(BILLING_PORTAL_API_ENDPOINT, payload, {
    endpointLabel: "billing-portal",
    ...options,
  });
}

export function getBillingAccountJson(email, options = {}) {
  const query = new URLSearchParams({ email: String(email || "") });

  return getJson(`${BILLING_ACCOUNT_API_ENDPOINT}?${query.toString()}`, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postBillingAccountJson(payload, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, payload, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function getGarageVehiclesJson(email, options = {}) {
  const query = new URLSearchParams({
    email: String(email || ""),
    scope: "garage",
  });

  return getJson(`${BILLING_ACCOUNT_API_ENDPOINT}?${query.toString()}`, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postGarageVehicleAddJson(email, vehicle, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "garage_add",
    email,
    vehicle,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postGarageVehicleRemoveJson(email, vehicleId, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "garage_remove",
    email,
    vehicleId,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}
