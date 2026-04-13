import { normalizeText } from "./offerHelpers";

export const INITIAL_PORTAL_VO_FILTERS = {
  query: "",
  maxPrice: "",
  minYear: "",
  maxMileage: "",
  location: "",
  color: "",
  displacement: "",
  onlyGuaranteed: false,
};

export function getPortalVoEcoLabel(offer = {}) {
  const fuel = normalizeText(offer?.fuel).toLowerCase();

  if (fuel.includes("elé") || fuel.includes("electric")) {
    return "Etiqueta CERO";
  }
  if (fuel.includes("híbr") || fuel.includes("hibri") || fuel.includes("glp") || fuel.includes("phev")) {
    return "Etiqueta ECO";
  }

  return "Etiqueta C";
}

export function getPortalVoTransmission(offer = {}) {
  const fuel = normalizeText(offer?.fuel).toLowerCase();

  if (fuel.includes("elé") || fuel.includes("hibri") || fuel.includes("mhev") || fuel.includes("phev")) {
    return "Automático";
  }

  return Number(offer?.displacement || 0) >= 1800 ? "Automático" : "Manual / automático";
}

export function buildPortalVoHighlights(offer = {}) {
  const items = [];

  if (offer?.hasGuaranteeSeal) {
    items.push(`Sello CarAdvisor con ${offer.warrantyMonths || 12} meses de garantía.`);
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

export function buildPortalVoEquipment(offer = {}) {
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

function decoratePortalVoOffer(offer = {}) {
  return {
    ...offer,
    preferAiImage: true,
    hasRealImage: true,
    imageSearchQuery: normalizeText(`${offer.brand} ${offer.model} ${offer.year}`),
  };
}

function includesNormalizedValue(sourceValue, targetValue) {
  const source = normalizeText(sourceValue)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const target = normalizeText(targetValue)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!target) {
    return true;
  }

  if (target === "cualquiera") {
    return true;
  }

  return source.includes(target) || target.includes(source);
}

function offerMatchesAlert(offer = {}, alert = {}) {
  const alertMode = normalizeText(alert?.mode).toLowerCase();
  const rentingMonthly = Number(offer?.rentingMonthly || offer?.renting?.monthly || 0);
  const supportsRenting = Boolean(offer?.rentingAvailable || offer?.renting?.available || rentingMonthly > 0);

  const searchText = normalizeText(
    `${offer.title} ${offer.brand} ${offer.model} ${offer.location} ${offer.color} ${offer.fuel}`
  ).toLowerCase();
  const brandQuery = normalizeText(alert?.brand).toLowerCase();
  const modelQuery = normalizeText(alert?.model).toLowerCase();
  const fuelQuery = normalizeText(alert?.fuel).toLowerCase();
  const locationQuery = normalizeText(alert?.location).toLowerCase();
  const colorQuery = normalizeText(alert?.color).toLowerCase();

  const matchesBrand = !brandQuery || includesNormalizedValue(searchText, brandQuery);
  const matchesModel = !modelQuery || includesNormalizedValue(searchText, modelQuery);
  const matchesFuel = !fuelQuery || includesNormalizedValue(offer.fuel, fuelQuery);
  const matchesLocation = !locationQuery || includesNormalizedValue(offer.location, locationQuery);
  const matchesColor = !colorQuery || includesNormalizedValue(offer.color, colorQuery);
  const maxBudget = Number(alert?.maxPrice || 0);
  const matchesPrice =
    !maxBudget ||
    (alertMode === "renting"
      ? rentingMonthly > 0 && rentingMonthly <= maxBudget
      : Number(offer.price || 0) <= maxBudget);
  const matchesMileage = !alert?.maxMileage || Number(offer.mileage || 0) <= Number(alert.maxMileage);

  if (alertMode === "renting" && !supportsRenting) {
    return false;
  }

  if (alertMode === "compra" && !Number(offer.price || 0)) {
    return false;
  }

  return matchesBrand && matchesModel && matchesFuel && matchesLocation && matchesColor && matchesPrice && matchesMileage;
}

export function buildMarketAlertMatches({ alerts = [], offers = [] }) {
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const safeOffers = (Array.isArray(offers) ? offers : []).map(decoratePortalVoOffer);

  return safeAlerts.reduce((acc, alert) => {
    const matches = safeOffers
      .filter((offer) => offerMatchesAlert(offer, alert))
      .sort((a, b) => b.portalScore - a.portalScore || a.price - b.price);

    acc[alert.id] = {
      count: matches.length,
      matches: matches.slice(0, 3),
    };

    return acc;
  }, {});
}

export function buildPortalVoMarketplaceModel({ offers = [], filters = {}, selectedOfferId = null }) {
  const safeOffers = Array.isArray(offers) ? offers : [];
  const query = normalizeText(filters.query).toLowerCase();

  const portalVoLocations = [...new Set(safeOffers.map((offer) => offer.location))];
  const portalVoColors = [...new Set(safeOffers.map((offer) => offer.color))];

  const filteredPortalVoOffers = safeOffers
    .filter((offer) => {
      const searchText = normalizeText(
        `${offer.title} ${offer.brand} ${offer.model} ${offer.location} ${offer.color} ${offer.fuel}`
      ).toLowerCase();
      const matchesQuery = !query || searchText.includes(query);
      const matchesPrice = !filters.maxPrice || Number(offer.price || 0) <= Number(filters.maxPrice);
      const matchesYear = !filters.minYear || Number(offer.year || 0) >= Number(filters.minYear);
      const matchesMileage = !filters.maxMileage || Number(offer.mileage || 0) <= Number(filters.maxMileage);
      const matchesLocation = !filters.location || normalizeText(offer.location) === normalizeText(filters.location);
      const matchesColor = !filters.color || normalizeText(offer.color) === normalizeText(filters.color);
      const displacement = Number(offer.displacement || 0);
      const matchesDisplacement =
        !filters.displacement ||
        (filters.displacement === "electric" && displacement === 0) ||
        (filters.displacement === "0_1200" && displacement > 0 && displacement <= 1200) ||
        (filters.displacement === "1200_1600" && displacement > 1200 && displacement <= 1600) ||
        (filters.displacement === "1600_2000" && displacement > 1600 && displacement <= 2000) ||
        (filters.displacement === "2000_plus" && displacement > 2000);
      const matchesGuarantee = !filters.onlyGuaranteed || offer.hasGuaranteeSeal;

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
    })
    .map(decoratePortalVoOffer)
    .sort((a, b) => b.portalScore - a.portalScore || a.price - b.price);

  const featuredPortalVoOffers = filteredPortalVoOffers
    .filter((offer) => offer.hasGuaranteeSeal)
    .slice(0, 3);

  const found = safeOffers.find((offer) => offer.id === selectedOfferId);
  const selectedPortalVoOffer = found ? decoratePortalVoOffer(found) : null;

  const relatedPortalVoOffers = selectedPortalVoOffer
    ? filteredPortalVoOffers.filter((offer) => offer.id !== selectedPortalVoOffer.id).slice(0, 3)
    : [];

  return {
    portalVoLocations,
    portalVoColors,
    filteredPortalVoOffers,
    featuredPortalVoOffers,
    selectedPortalVoOffer,
    relatedPortalVoOffers,
  };
}
