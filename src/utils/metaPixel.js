function fbq(...args) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq(...args);
  }
}

/**
 * Dispara un evento Lead cuando el usuario envía el formulario de contacto.
 * @param {object} params
 * @param {string} params.vehicleTitle  - Título del vehículo
 * @param {string} params.vehicleId     - ID de la oferta
 * @param {string} [params.leadType]    - "info" | "visit" | "question"
 * @param {object} [params.utm]         - Payload UTM para enriquecer el evento
 */
export function trackLead({ vehicleTitle, vehicleId, leadType = "info", utm = {} }) {
  fbq("track", "Lead", {
    content_name: vehicleTitle || "",
    content_ids: vehicleId ? [String(vehicleId)] : [],
    content_type: "vehicle",
    lead_type: leadType,
    ...utm,
  });
}

/**
 * Dispara un evento ViewContent cuando el usuario abre el detalle de una oferta.
 * @param {object} params
 * @param {string} params.vehicleTitle  - Título del vehículo
 * @param {string} params.vehicleId     - ID de la oferta
 * @param {number} [params.price]       - Precio de venta
 * @param {string} [params.currency]    - Moneda (default "EUR")
 */
export function trackViewContent({ vehicleTitle, vehicleId, price, currency = "EUR" }) {
  fbq("track", "ViewContent", {
    content_name: vehicleTitle || "",
    content_ids: vehicleId ? [String(vehicleId)] : [],
    content_type: "vehicle",
    ...(price > 0 ? { value: price, currency } : {}),
  });
}
