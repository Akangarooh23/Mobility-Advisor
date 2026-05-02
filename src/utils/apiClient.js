export const ANALYZE_API_ENDPOINT = "/api/analyze";
export const LISTING_API_ENDPOINT = "/api/find-listing";
export const ALERT_EMAIL_API_ENDPOINT = "/api/send-alert-email";
export const AUTH_API_ENDPOINT = "/api/auth";
export const VEHICLE_CATALOG_API_ENDPOINT = "/api/vehicle-catalog";
export const VEHICLE_CATALOG_ADMIN_API_ENDPOINT = "/api/vehicle-catalog";
export const BILLING_CHECKOUT_API_ENDPOINT = "/api/billing-checkout";
export const BILLING_PORTAL_API_ENDPOINT = "/api/billing-portal";
export const BILLING_ACCOUNT_API_ENDPOINT = "/api/billing-account";
export const ERP_CATALOG_API_ENDPOINT = "/api/erp-catalog";
export const WORKSHOPS_NEARBY_API_ENDPOINT = "/api/workshops-nearby";
export const WORKSHOP_AVAILABILITY_API_ENDPOINT = "/api/workshop-availability";
export const MARKET_PRICE_API_ENDPOINT = "/api/market-price";

export function getErpBrandsJson(options = {}) {
  return fetch(`${ERP_CATALOG_API_ENDPOINT}?scope=brands`, { credentials: "include", ...options });
}

export function getErpModelsJson(brandId, options = {}) {
  return fetch(`${ERP_CATALOG_API_ENDPOINT}?scope=models&brandId=${encodeURIComponent(brandId)}`, { credentials: "include", ...options });
}

export function getErpVersionsJson(modelId, brandId = "", options = {}) {
  const brandQuery = brandId ? `&brandId=${encodeURIComponent(brandId)}` : "";
  return fetch(`${ERP_CATALOG_API_ENDPOINT}?scope=versions&modelId=${encodeURIComponent(modelId)}${brandQuery}`, { credentials: "include", ...options });
}

export function getErpVersionDetailJson(codversion, options = {}) {
  return fetch(`${ERP_CATALOG_API_ENDPOINT}?scope=version-detail&codversion=${encodeURIComponent(codversion)}`, { credentials: "include", ...options });
}

export function getNearbyWorkshopsJson({ postalCode = "", province = "" } = {}, options = {}) {
  const query = new URLSearchParams({
    postalCode: String(postalCode || ""),
    province: String(province || ""),
  });

  return getJson(`${WORKSHOPS_NEARBY_API_ENDPOINT}?${query.toString()}`, {
    endpointLabel: "workshops-nearby",
    ...options,
  });
}

export function getWorkshopAvailabilityJson({ workshopId = "", provider = "", monthKey = "" } = {}, options = {}) {
  const query = new URLSearchParams({
    workshopId: String(workshopId || ""),
    provider: String(provider || ""),
    monthKey: String(monthKey || ""),
  });

  return getJson(`${WORKSHOP_AVAILABILITY_API_ENDPOINT}?${query.toString()}`, {
    endpointLabel: "workshop-availability",
    ...options,
  });
}

export function postWorkshopReservationJson(payload, options = {}) {
  return postJson(WORKSHOP_AVAILABILITY_API_ENDPOINT, {
    action: "reserve",
    ...payload,
  }, {
    endpointLabel: "workshop-availability",
    ...options,
  });
}

export function postWorkshopAvailabilityAdminJson(payload, options = {}) {
  return postJson(WORKSHOP_AVAILABILITY_API_ENDPOINT, {
    ...payload,
  }, {
    endpointLabel: "workshop-availability",
    ...options,
  });
}

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

export function getSellMarketSnapshotJson(payload, options = {}) {
  return postJson(MARKET_PRICE_API_ENDPOINT, { payload }, {
    endpointLabel: "market-price",
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

export function getUserMobilityDataJson(email, options = {}) {
  const query = new URLSearchParams({
    email: String(email || ""),
    scope: "mobility",
  });

  return getJson(`${BILLING_ACCOUNT_API_ENDPOINT}?${query.toString()}`, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postAppointmentAddJson(email, appointment, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "appointment_add",
    email,
    appointment,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postValuationAddJson(email, valuation, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "valuation_add",
    email,
    valuation,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postMaintenanceAddJson(email, maintenance, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "maintenance_add",
    email,
    maintenance,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postInsuranceUpsertJson(email, insurance, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "insurance_upsert",
    email,
    insurance,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postVehicleStateUpsertJson(email, vehicleState, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "vehicle_state_upsert",
    email,
    vehicleState,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postSavedOfferAddJson(email, offer, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "saved_offer_add",
    email,
    offer,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

export function postSavedOfferRemoveJson(email, offerId, options = {}) {
  return postJson(BILLING_ACCOUNT_API_ENDPOINT, {
    action: "saved_offer_remove",
    email,
    offerId,
  }, {
    endpointLabel: "billing-account",
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// User saved comparisons  /api/user-saved
// ─────────────────────────────────────────────────────────────────────────────

export const USER_SAVED_API_ENDPOINT = "/api/user-saved";

export function getUserSavedComparisonsJson(options = {}) {
  return getJson(USER_SAVED_API_ENDPOINT, { endpointLabel: "user-saved", ...options });
}

export function postUserSavedComparisonJson(comparison, options = {}) {
  return postJson(USER_SAVED_API_ENDPOINT, { comparison }, { endpointLabel: "user-saved", ...options });
}

export function deleteUserSavedComparisonJson(id, options = {}) {
  const query = new URLSearchParams({ id: String(id || "") });
  return fetch(`${USER_SAVED_API_ENDPOINT}?${query.toString()}`, {
    method: "DELETE",
    credentials: "include",
    ...options,
  }).then(async (response) => {
    const data = await readApiResponse(response, { endpointLabel: "user-saved" });
    return { response, data };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Market alerts  /api/user-alerts
// ─────────────────────────────────────────────────────────────────────────────

export const USER_ALERTS_API_ENDPOINT = "/api/user-alerts";

export function getUserAlertsJson(options = {}) {
  return getJson(USER_ALERTS_API_ENDPOINT, { endpointLabel: "user-alerts", ...options });
}

export function postUserAlertJson(alert, options = {}) {
  return postJson(USER_ALERTS_API_ENDPOINT, { alert }, { endpointLabel: "user-alerts", ...options });
}

export function deleteUserAlertJson(id, options = {}) {
  const query = new URLSearchParams({ id: String(id || "") });
  return fetch(`${USER_ALERTS_API_ENDPOINT}?${query.toString()}`, {
    method: "DELETE",
    credentials: "include",
    ...options,
  }).then(async (response) => {
    const data = await readApiResponse(response, { endpointLabel: "user-alerts" });
    return { response, data };
  });
}

export function postUserAlertStatusJson(alertId, seenCount, options = {}) {
  const query = new URLSearchParams({ scope: "status" });
  return postJson(`${USER_ALERTS_API_ENDPOINT}?${query.toString()}`, { alertId, seenCount }, { endpointLabel: "user-alerts", ...options });
}

// ─────────────────────────────────────────────────────────────────────────────
// User preferences  /api/user-preferences
// ─────────────────────────────────────────────────────────────────────────────

export const USER_PREFERENCES_API_ENDPOINT = "/api/user-preferences";

export function getUserPreferencesJson(options = {}) {
  return getJson(USER_PREFERENCES_API_ENDPOINT, { endpointLabel: "user-preferences", ...options });
}

export function putUserPreferencesJson(preferences, options = {}) {
  return postJson(USER_PREFERENCES_API_ENDPOINT, { preferences }, { endpointLabel: "user-preferences", ...options });
}

