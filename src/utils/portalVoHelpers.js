import { normalizeText } from "./offerHelpers";

export const INITIAL_PORTAL_VO_FILTERS = {
  query: "",
  brand: "",
  model: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  minMileage: "",
  maxMileage: "",
  location: "",
  color: "",
  fuel: "",
  transmission: "",
  displacement: "",
  sort: "",
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
  const explicit = normalizeText(offer?.transmission);
  if (explicit) return explicit;

  const fuel = normalizeText(offer?.fuel).toLowerCase();

  if (fuel.includes("elé") || fuel.includes("hibri") || fuel.includes("mhev") || fuel.includes("phev")) {
    return "Automático";
  }

  return Number(offer?.displacement || 0) >= 1800 ? "Automático" : "—";
}

export function buildPortalVoHighlights(offer = {}) {
  const items = [];

  if (offer?.hasGuaranteeSeal) {
    items.push(`Sello CarsWise con ${offer.warrantyMonths || 12} meses de garantía.`);
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

export const PORTAL_VO_PROVINCES = [
  "A Coruña",
  "Álava",
  "Albacete",
  "Alicante",
  "Almería",
  "Asturias",
  "Ávila",
  "Badajoz",
  "Barcelona",
  "Burgos",
  "Cáceres",
  "Cádiz",
  "Cantabria",
  "Castellón",
  "Ceuta",
  "Ciudad Real",
  "Córdoba",
  "Cuenca",
  "Girona",
  "Granada",
  "Guadalajara",
  "Guipúzcoa",
  "Huelva",
  "Huesca",
  "Illes Balears",
  "Jaén",
  "La Rioja",
  "Las Palmas",
  "León",
  "Lleida",
  "Lugo",
  "Madrid",
  "Málaga",
  "Melilla",
  "Murcia",
  "Navarra",
  "Ourense",
  "Palencia",
  "Pontevedra",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Vizcaya",
  "Zamora",
  "Zaragoza",
];

// Búsqueda "Híbrido" incluye "Híbrido enchufable"; gas/gnc/glp son intercambiables.
const FUEL_COMPAT_BROWSE = {
  'híbrido':  ['híbrido', 'híbrido enchufable'],
  'gas':      ['gas', 'gnc', 'glp'],
  'gnc':      ['gas', 'gnc', 'glp'],
  'glp':      ['gas', 'gnc', 'glp'],
};

function fuelMatchesFilter(offerFuel, filterFuel) {
  if (!filterFuel) return true;
  const fl = filterFuel.toLowerCase();
  const ol = (offerFuel || '').toLowerCase();
  const compat = FUEL_COMPAT_BROWSE[fl];
  return compat ? compat.includes(ol) : ol === fl;
}

export const PORTAL_VO_TRANSMISSIONS = [
  "Automático",
  "Manual",
  "Secuencial",
];

export const PORTAL_VO_FUELS = [
  "Gasolina",
  "Diésel",
  "Eléctrico",
  "Híbrido",
  "Híbrido enchufable",
  "GLP",
  "GNC",
  "Hidrógeno",
];

export const PORTAL_VO_COLORS = [
  "Amarillo",
  "Azul",
  "Beige",
  "Blanco",
  "Bronce",
  "Burdeos",
  "Dorado",
  "Gris",
  "Marrón",
  "Naranja",
  "Negro",
  "Plata",
  "Rojo",
  "Rosa",
  "Verde",
  "Violeta",
];

export function buildPortalVoMarketplaceModel({ offers = [], filters = {}, selectedOfferId = null }) {
  const safeOffers = Array.isArray(offers) ? offers : [];
  const query = normalizeText(filters.query).toLowerCase();

  const portalVoLocations = PORTAL_VO_PROVINCES;
  const portalVoColors    = PORTAL_VO_COLORS;
  const portalVoFuels         = PORTAL_VO_FUELS;
  const portalVoTransmissions = PORTAL_VO_TRANSMISSIONS;
  const portalVoBrands        = [...new Set(safeOffers.map((offer) => offer.brand).filter(Boolean))].sort();
  const portalVoModels    = [...new Set(
    safeOffers
      .filter((offer) => !filters.brand || normalizeText(offer.brand) === normalizeText(filters.brand))
      .map((offer) => offer.model)
      .filter(Boolean)
  )].sort();

  const filteredPortalVoOffers = safeOffers
    .filter((offer) => {
      const searchText = normalizeText(
        `${offer.title} ${offer.brand} ${offer.model} ${offer.location} ${offer.color} ${offer.fuel}`
      ).toLowerCase();
      const matchesQuery    = !query || searchText.includes(query);
      const matchesBrand    = !filters.brand || normalizeText(offer.brand) === normalizeText(filters.brand);
      const matchesModel    = !filters.model || normalizeText(offer.model) === normalizeText(filters.model);
      const offerPrice = Number(offer.salePrice ?? offer.price ?? 0);
      const matchesPrice    = (!filters.minPrice || offerPrice >= Number(filters.minPrice))
                           && (!filters.maxPrice || offerPrice <= Number(filters.maxPrice));
      const offerYear = Number(offer.year || 0);
      const matchesYear     = (!filters.minYear || offerYear >= Number(filters.minYear))
                           && (!filters.maxYear || offerYear <= Number(filters.maxYear));
      const offerMileage = Number(offer.mileage || 0);
      const matchesMileage  = (!filters.minMileage || offerMileage >= Number(filters.minMileage))
                           && (!filters.maxMileage || offerMileage <= Number(filters.maxMileage));
      const matchesLocation = !filters.location || normalizeText(offer.location).toLowerCase() === normalizeText(filters.location).toLowerCase();
      // "sin dato = pasa": las ofertas sin color no se excluyen al filtrar por color.
      const matchesColor    = !filters.color || !normalizeText(offer.color) || normalizeText(offer.color).toLowerCase() === normalizeText(filters.color).toLowerCase();
      const matchesFuel         = fuelMatchesFilter(offer.fuel, filters.fuel);
      const matchesTransmission = !filters.transmission || normalizeText(offer.transmission) === normalizeText(filters.transmission);
      const hasDisplacement = offer.displacement !== null && offer.displacement !== undefined && offer.displacement !== "";
      const displacement = Number(offer.displacement || 0);
      const matchesDisplacement =
        !filters.displacement ||
        !hasDisplacement ||
        (filters.displacement === "electric" && displacement === 0) ||
        (filters.displacement === "0_1200" && displacement > 0 && displacement <= 1200) ||
        (filters.displacement === "1200_1600" && displacement > 1200 && displacement <= 1600) ||
        (filters.displacement === "1600_2000" && displacement > 1600 && displacement <= 2000) ||
        (filters.displacement === "2000_plus" && displacement > 2000);
      const matchesGuarantee = !filters.onlyGuaranteed || offer.hasGuaranteeSeal;

      return (
        matchesQuery &&
        matchesBrand &&
        matchesModel &&
        matchesPrice &&
        matchesYear &&
        matchesMileage &&
        matchesLocation &&
        matchesColor &&
        matchesFuel &&
        matchesTransmission &&
        matchesDisplacement &&
        matchesGuarantee
      );
    })
    .map(decoratePortalVoOffer)
    .sort((a, b) => {
      if (filters.sort === "price_asc")  return (a.salePrice ?? a.price) - (b.salePrice ?? b.price);
      if (filters.sort === "price_desc") return (b.salePrice ?? b.price) - (a.salePrice ?? a.price);
      return b.portalScore - a.portalScore || a.price - b.price;
    });

  const featuredPortalVoOffers = filteredPortalVoOffers
    .filter((offer) => offer.hasGuaranteeSeal)
    .slice(0, 3);

  const found = safeOffers.find((offer) => offer.id === selectedOfferId);
  const selectedPortalVoOffer = found ? decoratePortalVoOffer(found) : null;

  const relatedPortalVoOffers = selectedPortalVoOffer
    ? filteredPortalVoOffers.filter((offer) => offer.id !== selectedPortalVoOffer.id).slice(0, 6)
    : [];

  return {
    portalVoLocations,
    portalVoColors,
    portalVoFuels,
    portalVoTransmissions,
    portalVoBrands,
    portalVoModels,
    filteredPortalVoOffers,
    featuredPortalVoOffers,
    selectedPortalVoOffer,
    relatedPortalVoOffers,
  };
}
