import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBrandOptionSegments } from "../utils/brandCatalog";

const PRICE_MARKS = [0, 10000, 20000, 30000, 45000, 70000, 100000, 150000, 220000];
const AGE_MARKS = [0, 2, 4, 6, 8, 12];
const MILEAGE_MARKS = [0, 20000, 50000, 80000, 120000, 180000];
const POWER_MARKS = [70, 90, 110, 130, 160, 200, 250, 320];

const LOCATION_OPTIONS = [
  { value: "toda_espana", label: "Toda España" },
  { value: "alava", label: "Álava" },
  { value: "albacete", label: "Albacete" },
  { value: "alicante", label: "Alicante" },
  { value: "almeria", label: "Almería" },
  { value: "asturias", label: "Asturias" },
  { value: "avila", label: "Ávila" },
  { value: "badajoz", label: "Badajoz" },
  { value: "baleares", label: "Baleares" },
  { value: "barcelona", label: "Barcelona" },
  { value: "burgos", label: "Burgos" },
  { value: "caceres", label: "Cáceres" },
  { value: "cadiz", label: "Cádiz" },
  { value: "cantabria", label: "Cantabria" },
  { value: "castellon", label: "Castellón" },
  { value: "ceuta", label: "Ceuta" },
  { value: "ciudad_real", label: "Ciudad Real" },
  { value: "cordoba", label: "Córdoba" },
  { value: "cuenca", label: "Cuenca" },
  { value: "girona", label: "Girona" },
  { value: "granada", label: "Granada" },
  { value: "guadalajara", label: "Guadalajara" },
  { value: "guipuzcoa", label: "Guipúzcoa" },
  { value: "huelva", label: "Huelva" },
  { value: "huesca", label: "Huesca" },
  { value: "jaen", label: "Jaén" },
  { value: "a_coruna", label: "A Coruña" },
  { value: "la_rioja", label: "La Rioja" },
  { value: "las_palmas", label: "Las Palmas" },
  { value: "leon", label: "León" },
  { value: "lleida", label: "Lleida" },
  { value: "lugo", label: "Lugo" },
  { value: "madrid", label: "Madrid" },
  { value: "malaga", label: "Málaga" },
  { value: "melilla", label: "Melilla" },
  { value: "murcia", label: "Murcia" },
  { value: "navarra", label: "Navarra" },
  { value: "ourense", label: "Ourense" },
  { value: "palencia", label: "Palencia" },
  { value: "pontevedra", label: "Pontevedra" },
  { value: "salamanca", label: "Salamanca" },
  { value: "santa_cruz_de_tenerife", label: "Santa Cruz de Tenerife" },
  { value: "segovia", label: "Segovia" },
  { value: "sevilla", label: "Sevilla" },
  { value: "soria", label: "Soria" },
  { value: "tarragona", label: "Tarragona" },
  { value: "teruel", label: "Teruel" },
  { value: "toledo", label: "Toledo" },
  { value: "valencia", label: "Valencia" },
  { value: "valladolid", label: "Valladolid" },
  { value: "vizcaya", label: "Vizcaya" },
  { value: "zamora", label: "Zamora" },
  { value: "zaragoza", label: "Zaragoza" },
];

const FUEL_FILTER_OPTIONS = [
  { value: "cualquiera", label: "Cualquiera" },
  { value: "gasolina", label: "Gasolina" },
  { value: "diesel", label: "Diésel" },
  { value: "hibrido", label: "Híbrido" },
  { value: "phev", label: "PHEV" },
  { value: "electrico", label: "Eléctrico" },
];

const BODY_TYPE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "berlina", label: "Berlina" },
  { value: "familiar", label: "Familiar" },
  { value: "coupe", label: "Coupe" },
  { value: "monovolumen", label: "Monovolumen" },
  { value: "suv", label: "SUV" },
  { value: "cabrio", label: "Cabrio" },
  { value: "pick_up", label: "Pick Up" },
];

const TRANSMISSION_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "automatico", label: "Automático" },
  { value: "manual", label: "Manual" },
];

const DGT_LABEL_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "cero", label: "Etiqueta CERO" },
  { value: "eco", label: "Etiqueta ECO" },
  { value: "c", label: "Etiqueta C" },
  { value: "b", label: "Etiqueta B" },
];

const COLOR_OPTIONS = [
  { value: "amarillo", label: "Amarillo", dot: "#facc15" },
  { value: "azul", label: "Azul", dot: "#3b82f6" },
  { value: "beige", label: "Beige", dot: "#d6c7b4" },
  { value: "blanco", label: "Blanco", dot: "#ffffff" },
  { value: "granate", label: "Granate", dot: "#991b1b" },
  { value: "gris", label: "Gris / Plata", dot: "#9ca3af" },
  { value: "marron", label: "Marrón", dot: "#92400e" },
  { value: "naranja", label: "Naranja", dot: "#f97316" },
  { value: "negro", label: "Negro", dot: "#111827" },
  { value: "rojo", label: "Rojo", dot: "#ef4444" },
  { value: "rosa", label: "Rosa", dot: "#f9a8d4" },
  { value: "verde", label: "Verde", dot: "#22c55e" },
  { value: "violeta", label: "Violeta / Lila", dot: "#a78bfa" },
];

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const DOOR_OPTIONS = [2, 3, 4, 5, 6, 7];

const PRICE_FILTER_BY_TO_INDEX = {
  1: "hasta_10000",
  2: "10000_20000",
  3: "20000_30000",
  4: "30000_45000",
  5: "45000_70000",
  6: "70000_100000",
  7: "100000_150000",
  8: "mas_150000",
};

const AGE_FILTER_BY_TO_INDEX = {
  1: "2",
  2: "4",
  3: "6",
  4: "8",
  5: "all",
};

const MILEAGE_FILTER_BY_TO_INDEX = {
  1: "20000",
  2: "50000",
  3: "80000",
  4: "120000",
  5: "all",
};

function formatEuro(amount) {
  return `${Number(amount || 0).toLocaleString("es-ES")} €`;
}

function formatYears(amount) {
  return `${Number(amount || 0)} años`;
}

function formatKm(amount) {
  return `${Number(amount || 0).toLocaleString("es-ES")} km`;
}

function formatPower(amount) {
  return `${Number(amount || 0)} CV`;
}

function getToIndexFromFilterValue(filterValue, mapByToIndex, fallback = 1) {
  const match = Object.entries(mapByToIndex).find(([, value]) => value === filterValue);
  return match ? Number(match[0]) : fallback;
}

function getIndexFromMarkValue(marks, value, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const exactIndex = marks.findIndex((mark) => Number(mark) === numericValue);
  return exactIndex >= 0 ? exactIndex : fallback;
}

function getFloorIndexFromValue(marks, value, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  let idx = fallback;
  for (let i = 0; i < marks.length; i += 1) {
    if (Number(marks[i]) <= numericValue) {
      idx = i;
    }
  }
  return idx;
}

function getCeilIndexFromValue(marks, value, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const idx = marks.findIndex((mark) => Number(mark) >= numericValue);
  return idx >= 0 ? idx : marks.length - 1;
}

function cleanOfferText(value) {
  return String(value || "")
    .replace(/\uFFFD/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function DecisionPage({
  styles,
  decisionAnswers,
  updateDecisionAnswer,
  MARKET_BRANDS,
  decisionModels,
  decisionFlowReady,
  decisionMarketListings,
  decisionMarketLoading,
  decisionMarketError,
  decisionMarketInsight,
  onRecalculateDecisionMarketOffers,
  onSwitchToAdvice,
  onRestart,
}) {
  const { t } = useTranslation();
  const text = {
    marketOffers: t("decision.marketOffers"),
    title: t("decision.title"),
    subtitle: t("decision.subtitle"),
    operationType: t("decision.operationType"),
    buy: t("decision.buy"),
    brandModel: t("decision.brandModel"),
    apiCatalogTitle: t("decision.apiCatalogTitle"),
    fallbackCatalogTitle: t("decision.fallbackCatalogTitle"),
    apiCatalog: t("decision.apiCatalog"),
    fallbackCatalog: t("decision.fallbackCatalog"),
    brand: t("decision.brand"),
    selectBrand: t("decision.selectBrand"),
    moreBrands: t("decision.moreBrands"),
    model: t("decision.model"),
    selectModel: t("decision.selectModel"),
    priceRange: t("decision.priceRange"),
    from: t("decision.from"),
    to: t("decision.to"),
    ageRange: t("decision.ageRange"),
    noLimit: t("decision.noLimit"),
    mileageRange: t("decision.mileageRange"),
    powerRange: t("decision.powerRange"),
    location: t("decision.location"),
    fuel: t("decision.fuel"),
    directOffers: t("decision.directOffers"),
    completeFilters: t("decision.completeFilters"),
    realOffers: t("decision.realOffers"),
    recalculating: t("decision.recalculating"),
    recalculateOffer: t("decision.recalculateOffer"),
    loadingOffers: t("decision.loadingOffers"),
    noOffers: t("decision.noOffers"),
    realOffer: t("decision.realOffer"),
    fit: t("decision.fit"),
    provider: t("decision.provider"),
    priceNotVisible: t("decision.priceNotVisible"),
    directBuy: t("decision.directBuy"),
    listingFallback: t("decision.listingFallback"),
    openListing: t("decision.openListing"),
    switchFlow: t("decision.switchFlow"),
    backHome: t("decision.backHome"),
  };

  const showAllBrands = true;
  const [priceFromIndex, setPriceFromIndex] = useState(() => getIndexFromMarkValue(PRICE_MARKS, decisionAnswers.priceMin, 0));
  const [priceToIndex, setPriceToIndex] = useState(() =>
    Number.isFinite(Number(decisionAnswers.priceMax))
      ? getIndexFromMarkValue(PRICE_MARKS, decisionAnswers.priceMax, PRICE_MARKS.length - 1)
      : getToIndexFromFilterValue(decisionAnswers.cashBudget, PRICE_FILTER_BY_TO_INDEX, PRICE_MARKS.length - 1)
  );
  const [ageFromIndex, setAgeFromIndex] = useState(() => getIndexFromMarkValue(AGE_MARKS, decisionAnswers.ageMin, 0));
  const [ageToIndex, setAgeToIndex] = useState(() =>
    decisionAnswers.ageMax == null
      ? getToIndexFromFilterValue(decisionAnswers.ageFilter, AGE_FILTER_BY_TO_INDEX, AGE_MARKS.length - 1)
      : Number.isFinite(Number(decisionAnswers.ageMax))
      ? getIndexFromMarkValue(AGE_MARKS, decisionAnswers.ageMax, AGE_MARKS.length - 1)
      : AGE_MARKS.length - 1
  );
  const [mileageFromIndex, setMileageFromIndex] = useState(() => getIndexFromMarkValue(MILEAGE_MARKS, decisionAnswers.mileageMin, 0));
  const [mileageToIndex, setMileageToIndex] = useState(() =>
    decisionAnswers.mileageMax == null
      ? getToIndexFromFilterValue(decisionAnswers.mileageFilter, MILEAGE_FILTER_BY_TO_INDEX, MILEAGE_MARKS.length - 1)
      : Number.isFinite(Number(decisionAnswers.mileageMax))
      ? getIndexFromMarkValue(MILEAGE_MARKS, decisionAnswers.mileageMax, MILEAGE_MARKS.length - 1)
      : MILEAGE_MARKS.length - 1
  );
  const [powerFromIndex, setPowerFromIndex] = useState(() => getIndexFromMarkValue(POWER_MARKS, decisionAnswers.powerMin, 0));
  const [powerToIndex, setPowerToIndex] = useState(() => getIndexFromMarkValue(POWER_MARKS, decisionAnswers.powerMax, POWER_MARKS.length - 1));
  const [priceFromDraft, setPriceFromDraft] = useState(() => String(PRICE_MARKS[priceFromIndex]));
  const [priceToDraft, setPriceToDraft] = useState(() => String(PRICE_MARKS[priceToIndex]));
  const [ageFromDraft, setAgeFromDraft] = useState(() => String(AGE_MARKS[ageFromIndex]));
  const [ageToDraft, setAgeToDraft] = useState(() => String(AGE_MARKS[ageToIndex]));
  const [mileageFromDraft, setMileageFromDraft] = useState(() => String(MILEAGE_MARKS[mileageFromIndex]));
  const [mileageToDraft, setMileageToDraft] = useState(() => String(MILEAGE_MARKS[mileageToIndex]));
  const [powerFromDraft, setPowerFromDraft] = useState(() => String(POWER_MARKS[powerFromIndex]));
  const [powerToDraft, setPowerToDraft] = useState(() => String(POWER_MARKS[powerToIndex]));

  const { knownBrands, otherBrands, knownBrandSet } = getBrandOptionSegments(MARKET_BRANDS);
  const hasUnknownSelectedBrand = Boolean(decisionAnswers.brand && !knownBrandSet.has(decisionAnswers.brand));
  const shouldShowAllBrands = showAllBrands || hasUnknownSelectedBrand;
  const visibleBrands = shouldShowAllBrands ? [...knownBrands, ...otherBrands] : knownBrands;

  useEffect(() => {
    if (decisionAnswers.operation !== "comprar") {
      updateDecisionAnswer("operation", "comprar");
    }
    if (decisionAnswers.acquisition !== "contado") {
      updateDecisionAnswer("acquisition", "contado");
    }
  }, [decisionAnswers.operation, decisionAnswers.acquisition, updateDecisionAnswer]);

  useEffect(() => {
    if (!decisionAnswers.cashBudget) {
      updateDecisionAnswer("cashBudget", PRICE_FILTER_BY_TO_INDEX[priceToIndex] || "mas_150000");
    }
  }, [decisionAnswers.cashBudget, priceToIndex, updateDecisionAnswer]);

  useEffect(() => {
    setPriceFromDraft(String(PRICE_MARKS[priceFromIndex]));
    setPriceToDraft(String(PRICE_MARKS[priceToIndex]));
  }, [priceFromIndex, priceToIndex]);

  useEffect(() => {
    setAgeFromDraft(String(AGE_MARKS[ageFromIndex]));
    setAgeToDraft(String(AGE_MARKS[ageToIndex]));
  }, [ageFromIndex, ageToIndex]);

  useEffect(() => {
    setMileageFromDraft(String(MILEAGE_MARKS[mileageFromIndex]));
    setMileageToDraft(String(MILEAGE_MARKS[mileageToIndex]));
  }, [mileageFromIndex, mileageToIndex]);

  useEffect(() => {
    setPowerFromDraft(String(POWER_MARKS[powerFromIndex]));
    setPowerToDraft(String(POWER_MARKS[powerToIndex]));
  }, [powerFromIndex, powerToIndex]);

  const handleClearAll = () => {
    updateDecisionAnswer("brand", "");
    updateDecisionAnswer("hasBrand", "");
    updateDecisionAnswer("operation", "comprar");
    updateDecisionAnswer("acquisition", "contado");
    updateDecisionAnswer("fuelFilter", "cualquiera");
    updateDecisionAnswer("priceMin", 0);
    updateDecisionAnswer("priceMax", PRICE_MARKS[PRICE_MARKS.length - 1]);
    updateDecisionAnswer("ageMin", 0);
    updateDecisionAnswer("ageMax", null);
    updateDecisionAnswer("mileageMin", 0);
    updateDecisionAnswer("mileageMax", null);
    updateDecisionAnswer("powerMin", POWER_MARKS[0]);
    updateDecisionAnswer("powerMax", POWER_MARKS[POWER_MARKS.length - 1]);
    updateDecisionAnswer("bodyType", "");
    updateDecisionAnswer("seatsFrom", "");
    updateDecisionAnswer("seatsTo", "");
    updateDecisionAnswer("doorsFrom", "");
    updateDecisionAnswer("doorsTo", "");
    updateDecisionAnswer("transmission", "");
    updateDecisionAnswer("dgtLabel", "");
    updateDecisionAnswer("color", "");
    updateDecisionAnswer("location", "toda_espana");
    setPriceFromIndex(0);
    setPriceToIndex(PRICE_MARKS.length - 1);
    setAgeFromIndex(0);
    setAgeToIndex(AGE_MARKS.length - 1);
    setMileageFromIndex(0);
    setMileageToIndex(MILEAGE_MARKS.length - 1);
    setPowerFromIndex(0);
    setPowerToIndex(POWER_MARKS.length - 1);
  };

  const syncPriceRange = (fromIdx, toIdx) => {
    updateDecisionAnswer("priceMin", PRICE_MARKS[fromIdx]);
    updateDecisionAnswer("priceMax", PRICE_MARKS[toIdx]);
    updateDecisionAnswer("cashBudget", PRICE_FILTER_BY_TO_INDEX[toIdx] || "mas_150000");
  };

  const syncAgeRange = (fromIdx, toIdx) => {
    updateDecisionAnswer("ageMin", AGE_MARKS[fromIdx]);
    updateDecisionAnswer("ageMax", toIdx >= AGE_MARKS.length - 1 ? null : AGE_MARKS[toIdx]);
    updateDecisionAnswer("ageFilter", AGE_FILTER_BY_TO_INDEX[toIdx] || "all");
  };

  const syncMileageRange = (fromIdx, toIdx) => {
    updateDecisionAnswer("mileageMin", MILEAGE_MARKS[fromIdx]);
    updateDecisionAnswer("mileageMax", toIdx >= MILEAGE_MARKS.length - 1 ? null : MILEAGE_MARKS[toIdx]);
    updateDecisionAnswer("mileageFilter", MILEAGE_FILTER_BY_TO_INDEX[toIdx] || "all");
  };

  const syncPowerRange = (fromIdx, toIdx) => {
    updateDecisionAnswer("powerMin", POWER_MARKS[fromIdx]);
    updateDecisionAnswer("powerMax", POWER_MARKS[toIdx]);
  };

  const submitPriceFromDraft = () => {
    if (!priceFromDraft.trim()) {
      setPriceFromDraft(String(PRICE_MARKS[priceFromIndex]));
      return;
    }
    const nextFrom = Math.min(getFloorIndexFromValue(PRICE_MARKS, priceFromDraft, 0), priceToIndex - 1);
    setPriceFromIndex(nextFrom);
    syncPriceRange(nextFrom, priceToIndex);
  };

  const submitPriceToDraft = () => {
    if (!priceToDraft.trim()) {
      setPriceToDraft(String(PRICE_MARKS[priceToIndex]));
      return;
    }
    const nextTo = Math.max(getCeilIndexFromValue(PRICE_MARKS, priceToDraft, PRICE_MARKS.length - 1), priceFromIndex + 1);
    setPriceToIndex(nextTo);
    syncPriceRange(priceFromIndex, nextTo);
  };

  const submitAgeFromDraft = () => {
    if (!ageFromDraft.trim()) {
      setAgeFromDraft(String(AGE_MARKS[ageFromIndex]));
      return;
    }
    const nextFrom = Math.min(getFloorIndexFromValue(AGE_MARKS, ageFromDraft, 0), ageToIndex - 1);
    setAgeFromIndex(nextFrom);
    syncAgeRange(nextFrom, ageToIndex);
  };

  const submitAgeToDraft = () => {
    if (!ageToDraft.trim()) {
      setAgeToDraft(String(AGE_MARKS[ageToIndex]));
      return;
    }
    const nextTo = Math.max(getCeilIndexFromValue(AGE_MARKS, ageToDraft, AGE_MARKS.length - 1), ageFromIndex + 1);
    setAgeToIndex(nextTo);
    syncAgeRange(ageFromIndex, nextTo);
  };

  const submitMileageFromDraft = () => {
    if (!mileageFromDraft.trim()) {
      setMileageFromDraft(String(MILEAGE_MARKS[mileageFromIndex]));
      return;
    }
    const nextFrom = Math.min(getFloorIndexFromValue(MILEAGE_MARKS, mileageFromDraft, 0), mileageToIndex - 1);
    setMileageFromIndex(nextFrom);
    syncMileageRange(nextFrom, mileageToIndex);
  };

  const submitMileageToDraft = () => {
    if (!mileageToDraft.trim()) {
      setMileageToDraft(String(MILEAGE_MARKS[mileageToIndex]));
      return;
    }
    const nextTo = Math.max(getCeilIndexFromValue(MILEAGE_MARKS, mileageToDraft, MILEAGE_MARKS.length - 1), mileageFromIndex + 1);
    setMileageToIndex(nextTo);
    syncMileageRange(mileageFromIndex, nextTo);
  };

  const submitPowerFromDraft = () => {
    if (!powerFromDraft.trim()) {
      setPowerFromDraft(String(POWER_MARKS[powerFromIndex]));
      return;
    }
    const nextFrom = Math.min(getFloorIndexFromValue(POWER_MARKS, powerFromDraft, 0), powerToIndex - 1);
    setPowerFromIndex(nextFrom);
    syncPowerRange(nextFrom, powerToIndex);
  };

  const submitPowerToDraft = () => {
    if (!powerToDraft.trim()) {
      setPowerToDraft(String(POWER_MARKS[powerToIndex]));
      return;
    }
    const nextTo = Math.max(getCeilIndexFromValue(POWER_MARKS, powerToDraft, POWER_MARKS.length - 1), powerFromIndex + 1);
    setPowerToIndex(nextTo);
    syncPowerRange(powerFromIndex, nextTo);
  };

  const handleSeatsFromChange = (value) => {
    updateDecisionAnswer("seatsFrom", value);
    if (value && decisionAnswers.seatsTo && Number(value) > Number(decisionAnswers.seatsTo)) {
      updateDecisionAnswer("seatsTo", value);
    }
  };

  const handleSeatsToChange = (value) => {
    updateDecisionAnswer("seatsTo", value);
    if (value && decisionAnswers.seatsFrom && Number(value) < Number(decisionAnswers.seatsFrom)) {
      updateDecisionAnswer("seatsFrom", value);
    }
  };

  const handleDoorsFromChange = (value) => {
    updateDecisionAnswer("doorsFrom", value);
    if (value && decisionAnswers.doorsTo && Number(value) > Number(decisionAnswers.doorsTo)) {
      updateDecisionAnswer("doorsTo", value);
    }
  };

  const handleDoorsToChange = (value) => {
    updateDecisionAnswer("doorsTo", value);
    if (value && decisionAnswers.doorsFrom && Number(value) < Number(decisionAnswers.doorsFrom)) {
      updateDecisionAnswer("doorsFrom", value);
    }
  };

  const getActiveFilters = () => {
    const active = [];
    if (decisionAnswers.brand) active.push(decisionAnswers.brand);
    if (decisionAnswers.model) active.push(decisionAnswers.model);
    if (decisionAnswers.operation && decisionAnswers.operation !== "comprar") active.push(decisionAnswers.operation === "renting" ? "Renting" : "Comprar");
    if (decisionAnswers.fuelFilter && decisionAnswers.fuelFilter !== "cualquiera") {
      const fuel = FUEL_FILTER_OPTIONS.find(f => f.value === decisionAnswers.fuelFilter);
      if (fuel) active.push(fuel.label);
    }
    if (PRICE_MARKS[priceFromIndex] > 0 || PRICE_MARKS[priceToIndex] < PRICE_MARKS[PRICE_MARKS.length - 1]) {
      const label = `${PRICE_MARKS[priceFromIndex]/1000|0}k-${PRICE_MARKS[priceToIndex]/1000|0}k`;
      active.push(label);
    }
    if (AGE_MARKS[ageFromIndex] > 0 || AGE_MARKS[ageToIndex] < AGE_MARKS[AGE_MARKS.length - 1]) {
      const label = `${AGE_MARKS[ageFromIndex]}-${AGE_MARKS[ageToIndex]}a`;
      active.push(label);
    }
    if (MILEAGE_MARKS[mileageFromIndex] > 0 || MILEAGE_MARKS[mileageToIndex] < MILEAGE_MARKS[MILEAGE_MARKS.length - 1]) {
      const label = `${MILEAGE_MARKS[mileageFromIndex]/1000|0}-${MILEAGE_MARKS[mileageToIndex]/1000|0}k`;
      active.push(label);
    }
    if (POWER_MARKS[powerFromIndex] > POWER_MARKS[0] || POWER_MARKS[powerToIndex] < POWER_MARKS[POWER_MARKS.length - 1]) {
      const label = `${POWER_MARKS[powerFromIndex]}-${POWER_MARKS[powerToIndex]} CV`;
      active.push(label);
    }
    if (decisionAnswers.bodyType) {
      const bodyLabel = BODY_TYPE_OPTIONS.find((opt) => opt.value === decisionAnswers.bodyType)?.label;
      if (bodyLabel) active.push(bodyLabel);
    }
    if (decisionAnswers.seatsFrom || decisionAnswers.seatsTo) {
      active.push(`Plazas ${decisionAnswers.seatsFrom || "?"}-${decisionAnswers.seatsTo || "?"}`);
    }
    if (decisionAnswers.doorsFrom || decisionAnswers.doorsTo) {
      active.push(`Puertas ${decisionAnswers.doorsFrom || "?"}-${decisionAnswers.doorsTo || "?"}`);
    }
    if (decisionAnswers.transmission) {
      const transmissionLabel = TRANSMISSION_OPTIONS.find((opt) => opt.value === decisionAnswers.transmission)?.label;
      if (transmissionLabel) active.push(transmissionLabel);
    }
    if (decisionAnswers.dgtLabel) {
      const dgtLabel = DGT_LABEL_OPTIONS.find((opt) => opt.value === decisionAnswers.dgtLabel)?.label;
      if (dgtLabel) active.push(dgtLabel);
    }
    if (decisionAnswers.color) {
      const colorLabel = COLOR_OPTIONS.find((opt) => opt.value === decisionAnswers.color)?.label;
      if (colorLabel) active.push(colorLabel);
    }
    return active;
  };

  const activeFilters = getActiveFilters();
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div style={{...styles.center, maxWidth: 900, padding: "2rem"}}>
      <style>
        {`
          .cw-wrap { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
          .cw-main-card { background: #fff; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.04); overflow: hidden; }
          .cw-card-head { padding: 1.75rem 2rem 1.5rem; border-bottom: 1px solid #f0ece4; }
          .cw-eyebrow { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #3b82f6; background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.06)); border: 1px solid rgba(59,130,246,0.18); padding: 0.3rem 0.85rem; border-radius: 30px; margin-bottom: 1rem; }
          .cw-eyebrow::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.25); }
          .cw-page-title { font-size: 21px; font-weight: 600; color: #111; letter-spacing: -0.025em; margin-bottom: 0.35rem; }
          .cw-page-sub { font-size: 13px; color: #999; line-height: 1.65; font-weight: 300; }
          .cw-active-bar { padding: 0.65rem 2rem; background: linear-gradient(90deg, rgba(59,130,246,0.05), rgba(59,130,246,0.02)); border-bottom: 1px solid rgba(59,130,246,0.1); display: none; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
          .cw-active-bar.show { display: flex; }
          .cw-ab-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #3b82f6; margin-right: 0.25rem; white-space: nowrap; }
          .cw-a-chip { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #1e40af; font-size: 11px; font-weight: 500; padding: 0.2rem 0.65rem; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.3rem; }
          .cw-ab-clear { margin-left: auto; font-size: 11px; color: #aaa; background: none; border: none; cursor: pointer; font-family: Inter, sans-serif; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
          .cw-ab-clear:hover { color: #666; }
          .cw-filters { padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
          .cw-f-block { }
          .cw-f-lbl { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #ccc; margin-bottom: 0.7rem; display: flex; align-items: center; gap: 0.5rem; }
          .cw-f-lbl-n { width: 17px; height: 17px; border-radius: 50%; background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.08)); color: #3b82f6; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .cw-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
          .cw-chip { font-size: 12px; font-weight: 400; padding: 0.4rem 0.9rem; border-radius: 30px; border: 1px solid #ebebeb; background: #fafaf9; color: #999; cursor: pointer; font-family: Inter, sans-serif; transition: all 0.15s; white-space: nowrap; }
          .cw-chip:hover { border-color: #ddd; color: #555; background: #fff; }
          .cw-chip.sel { background: linear-gradient(135deg, #3b82f6, #2563eb); border-color: transparent; color: #fff; font-weight: 500; box-shadow: 0 2px 10px rgba(59,130,246,0.35); }
          .cw-range-box { background: #fafaf9; border: 1px solid #eee; border-radius: 12px; padding: 0.8rem 0.9rem; }
          .cw-range-values { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; margin-bottom: 0.45rem; }
          .cw-range-values strong { color: #0f172a; font-weight: 600; }
          .cw-range-box input[type="range"] { width: 100%; accent-color: #3b82f6; }
          .cw-range-manual { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; margin-top: 0.5rem; }
          .cw-range-manual label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
          .cw-range-manual input { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.38rem 0.45rem; font-size: 12px; color: #0f172a; outline: none; }
          .cw-range-manual input:focus { border-color: rgba(59,130,246,0.6); box-shadow: 0 0 0 2px rgba(59,130,246,0.12); }
          .cw-plain-manual { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; }
          .cw-plain-manual label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
          .cw-plain-manual input { background: #fafaf9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 0.55rem; font-size: 12px; color: #0f172a; outline: none; }
          .cw-plain-manual input:focus { border-color: rgba(59,130,246,0.6); box-shadow: 0 0 0 2px rgba(59,130,246,0.12); }
          .cw-plain-manual .cw-sel-wrap select { background: #fafaf9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 1.8rem 0.5rem 0.55rem; font-size: 12px; color: #0f172a; }
          .cw-plain-manual .cw-sel-wrap .cw-sel-arrow { right: 0.55rem; }
          .cw-color-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
          .cw-color-chip { display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid #dbe3ef; background: #fafaf9; border-radius: 999px; padding: 0.35rem 0.6rem; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.15s ease; }
          .cw-color-chip:hover { border-color: #93c5fd; background: #fff; }
          .cw-color-chip.sel { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.16); color: #0f172a; }
          .cw-color-dot { width: 12px; height: 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,0.18); }
          .cw-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
          @media (max-width: 640px) { .cw-two-col { grid-template-columns: 1fr; } }
          .cw-f-sep { height: 1px; background: linear-gradient(90deg, transparent, #f0ece4, transparent); }
          .cw-sel-wrap { position: relative; }
          .cw-sel-wrap select { appearance: none; width: 100%; background: #fafaf9; border: 1px solid #eee; border-radius: 12px; padding: 0.62rem 2.2rem 0.62rem 1rem; font-size: 13px; color: #666; font-family: Inter, sans-serif; cursor: pointer; outline: none; }
          .cw-sel-wrap select:focus { border-color: rgba(59,130,246,0.4); background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.07); }
          .cw-sel-arrow { position: absolute; right: 0.8rem; top: 50%; transform: translateY(-50%); pointer-events: none; font-size: 10px; color: #bbb; }
          .cw-loc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
          .cw-cta-card { background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%); border: 1px solid #e5eefb; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 6px 24px rgba(31,77,165,0.08); padding: 1.25rem 1.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
          .cw-cta-left { display: flex; flex-direction: column; gap: 0.2rem; }
          .cw-count-row { display: flex; align-items: baseline; gap: 0.45rem; }
          .cw-count-n { font-size: 28px; font-weight: 600; color: #3b82f6; letter-spacing: -0.03em; line-height: 1; }
          .cw-count-lbl { font-size: 13px; color: #64748b; font-weight: 500; }
          .cw-cta-hint { font-size: 11.5px; color: #7a8aa3; font-weight: 500; }
          .cw-cta-right { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
          .cw-btn-back { background: none; border: none; font-size: 12.5px; color: #6b7a90; cursor: pointer; font-family: Inter, sans-serif; display: flex; align-items: center; gap: 0.35rem; padding: 0.6rem 0; white-space: nowrap; }
          .cw-btn-back:hover { color: #334155; }
          .cw-btn-main { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: none; border-radius: 12px; padding: 0.7rem 1.6rem; font-size: 13.5px; font-weight: 700; color: #fff; cursor: pointer; font-family: Inter, sans-serif; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 16px rgba(37,99,235,0.35); transition: all 0.2s; white-space: nowrap; }
          .cw-btn-main:hover { box-shadow: 0 6px 24px rgba(59,130,246,0.55); transform: translateY(-2px); }
          .cw-btn-main:active { transform: translateY(0); }
          @media (max-width: 700px) {
            .cw-cta-card { flex-direction: column; align-items: stretch; }
            .cw-cta-right { width: 100%; justify-content: flex-end; }
            .cw-btn-main { flex: 1; justify-content: center; min-width: 0; font-size: 12px; padding: 0.65rem 1rem; }
            .cw-btn-back { font-size: 12px; }
          }
          .cw-results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
          .cw-offer-card { background: linear-gradient(160deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #d9e4f5; border-radius: 16px; padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem; transition: all 0.2s ease; text-decoration: none; color: inherit; position: relative; overflow: hidden; }
          .cw-offer-card::after { content: ''; position: absolute; inset: auto -10% -35% -10%; height: 70px; background: radial-gradient(circle at top, rgba(37,99,235,0.14), transparent 70%); opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
          .cw-offer-card:hover { border-color: #9fbaf0; box-shadow: 0 10px 28px rgba(30,64,175,0.14); transform: translateY(-2px); }
          .cw-offer-card:hover::after { opacity: 1; }
          .cw-offer-top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
          .cw-offer-type { font-size: 10px; color: #1d4ed8; background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.25); font-weight: 700; padding: 0.22rem 0.52rem; border-radius: 999px; letter-spacing: 0.04em; text-transform: uppercase; }
          .cw-offer-source { font-size: 10px; color: #35507a; background: rgba(148,163,184,0.16); border: 1px solid rgba(148,163,184,0.35); padding: 0.2rem 0.5rem; border-radius: 999px; font-weight: 600; text-transform: lowercase; }
          .cw-offer-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 0.1rem; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .cw-offer-desc { font-size: 11.5px; color: #5c6c82; line-height: 1.5; min-height: 34px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .cw-offer-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 0.65rem; border-top: 1px solid #e6edf8; }
          .cw-offer-price { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1; }
          .cw-offer-open { font-size: 11px; font-weight: 700; color: #1d4ed8; }
          .cw-no-results { background: #fff; border: 1px solid #f0ece4; border-radius: 12px; padding: 2rem; text-align: center; color: #999; font-size: 13px; }
        `}
      </style>

      <div className="cw-wrap">
        {/* MAIN CARD */}
        <div className="cw-main-card">
          {/* HEAD */}
          <div className="cw-card-head">
            <div className="cw-eyebrow">Búsqueda de compra</div>
            <div className="cw-page-title">{text.title}</div>
            <div className="cw-page-sub">{text.subtitle}</div>
          </div>

          {/* ACTIVE FILTERS */}
          <div className={`cw-active-bar ${hasActiveFilters ? "show" : ""}`}>
            <span className="cw-ab-label">Filtros activos</span>
            <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap"}}>
              {activeFilters.map((f, i) => (
                <span key={i} className="cw-a-chip">{f}</span>
              ))}
            </div>
            {hasActiveFilters && (
              <button className="cw-ab-clear" onClick={handleClearAll}>Limpiar todo</button>
            )}
          </div>

          {/* FILTERS */}
          <div className="cw-filters">
            {/* 2. BRAND */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">1</span>{text.brand}</div>
              <div className="cw-sel-wrap">
                <select
                  value={decisionAnswers.brand || ""}
                  onChange={(e) => {
                    updateDecisionAnswer("hasBrand", e.target.value ? "si" : "");
                    updateDecisionAnswer("brand", e.target.value);
                  }}
                >
                  <option value="">{text.selectBrand}</option>
                  {visibleBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
                <div className="cw-sel-arrow">▾</div>
              </div>
            </div>

            {/* 3. MODEL */}
            <div className="cw-f-block">
              <div className="cw-f-lbl">
                <span className="cw-f-lbl-n">3</span>{text.model}
                <span style={{fontSize:"10px",fontWeight:400,textTransform:"none",letterSpacing:0,color:"#ccc",marginLeft:"0.25rem"}}>— según marca</span>
              </div>
              <div className="cw-sel-wrap">
                <select
                  value={decisionAnswers.model || ""}
                  onChange={(e) => updateDecisionAnswer("model", e.target.value)}
                  disabled={!decisionAnswers.brand || decisionModels.length === 0}
                  style={{
                    opacity: !decisionAnswers.brand || decisionModels.length === 0 ? 0.6 : 1,
                    cursor: !decisionAnswers.brand || decisionModels.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  <option value="">
                    {!decisionAnswers.brand
                      ? "Selecciona marca primero"
                      : decisionModels.length
                        ? text.selectModel
                        : "No hay modelos en catálogo"}
                  </option>
                  {decisionModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <div className="cw-sel-arrow">▾</div>
              </div>
            </div>

            <div className="cw-f-sep"></div>

            <div className="cw-two-col">
              {/* 4. PRESUPUESTO */}
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">4</span>{text.priceRange}</div>
                <div className="cw-range-box">
                  <div className="cw-range-values">
                    <span>{text.from}: <strong>{formatEuro(PRICE_MARKS[priceFromIndex])}</strong></span>
                    <span>{text.to}: <strong>{formatEuro(PRICE_MARKS[priceToIndex])}</strong></span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={PRICE_MARKS.length - 2}
                    step={1}
                    value={priceFromIndex}
                    onChange={(e) => {
                      const nextFrom = Math.min(Number(e.target.value), priceToIndex - 1);
                      setPriceFromIndex(nextFrom);
                      syncPriceRange(nextFrom, priceToIndex);
                    }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={PRICE_MARKS.length - 1}
                    step={1}
                    value={priceToIndex}
                    onChange={(e) => {
                      const nextTo = Math.max(Number(e.target.value), priceFromIndex + 1);
                      setPriceToIndex(nextTo);
                      syncPriceRange(priceFromIndex, nextTo);
                    }}
                  />
                  <div className="cw-range-manual">
                    <label>
                      {text.from}
                      <input
                        type="number"
                        min={PRICE_MARKS[0]}
                        max={PRICE_MARKS[PRICE_MARKS.length - 1]}
                        value={priceFromDraft}
                        onChange={(e) => setPriceFromDraft(e.target.value)}
                        onBlur={submitPriceFromDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                    <label>
                      {text.to}
                      <input
                        type="number"
                        min={PRICE_MARKS[0]}
                        max={PRICE_MARKS[PRICE_MARKS.length - 1]}
                        value={priceToDraft}
                        onChange={(e) => setPriceToDraft(e.target.value)}
                        onBlur={submitPriceToDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* 5. POTENCIA */}
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">5</span>{text.powerRange || "Rango de CV / Potencia"}</div>
                <div className="cw-range-box">
                  <div className="cw-range-values">
                    <span>{text.from}: <strong>{formatPower(POWER_MARKS[powerFromIndex])}</strong></span>
                    <span>{text.to}: <strong>{formatPower(POWER_MARKS[powerToIndex])}</strong></span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={POWER_MARKS.length - 2}
                    step={1}
                    value={powerFromIndex}
                    onChange={(e) => {
                      const nextFrom = Math.min(Number(e.target.value), powerToIndex - 1);
                      setPowerFromIndex(nextFrom);
                      syncPowerRange(nextFrom, powerToIndex);
                    }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={POWER_MARKS.length - 1}
                    step={1}
                    value={powerToIndex}
                    onChange={(e) => {
                      const nextTo = Math.max(Number(e.target.value), powerFromIndex + 1);
                      setPowerToIndex(nextTo);
                      syncPowerRange(powerFromIndex, nextTo);
                    }}
                  />
                  <div className="cw-range-manual">
                    <label>
                      {text.from}
                      <input
                        type="number"
                        min={POWER_MARKS[0]}
                        max={POWER_MARKS[POWER_MARKS.length - 1]}
                        value={powerFromDraft}
                        onChange={(e) => setPowerFromDraft(e.target.value)}
                        onBlur={submitPowerFromDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                    <label>
                      {text.to}
                      <input
                        type="number"
                        min={POWER_MARKS[0]}
                        max={POWER_MARKS[POWER_MARKS.length - 1]}
                        value={powerToDraft}
                        onChange={(e) => setPowerToDraft(e.target.value)}
                        onBlur={submitPowerToDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. COMBUSTIBLE */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">6</span>{text.fuel}</div>
              <div className="cw-chips">
                {FUEL_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`cw-chip ${decisionAnswers.fuelFilter === opt.value ? "sel" : ""}`}
                    onClick={() => updateDecisionAnswer("fuelFilter", opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 7+8. ANTIGÜEDAD + KM */}
            <div className="cw-two-col">
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">7</span>{text.ageRange}</div>
                <div className="cw-range-box">
                  <div className="cw-range-values">
                    <span>{text.from}: <strong>{formatYears(AGE_MARKS[ageFromIndex])}</strong></span>
                    <span>{text.to}: <strong>{ageToIndex >= AGE_MARKS.length - 1 ? text.noLimit : formatYears(AGE_MARKS[ageToIndex])}</strong></span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={AGE_MARKS.length - 2}
                    step={1}
                    value={ageFromIndex}
                    onChange={(e) => {
                      const nextFrom = Math.min(Number(e.target.value), ageToIndex - 1);
                      setAgeFromIndex(nextFrom);
                      syncAgeRange(nextFrom, ageToIndex);
                    }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={AGE_MARKS.length - 1}
                    step={1}
                    value={ageToIndex}
                    onChange={(e) => {
                      const nextTo = Math.max(Number(e.target.value), ageFromIndex + 1);
                      setAgeToIndex(nextTo);
                      syncAgeRange(ageFromIndex, nextTo);
                    }}
                  />
                  <div className="cw-range-manual">
                    <label>
                      {text.from}
                      <input
                        type="number"
                        min={AGE_MARKS[0]}
                        max={AGE_MARKS[AGE_MARKS.length - 1]}
                        value={ageFromDraft}
                        onChange={(e) => setAgeFromDraft(e.target.value)}
                        onBlur={submitAgeFromDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                    <label>
                      {text.to}
                      <input
                        type="number"
                        min={AGE_MARKS[0]}
                        max={AGE_MARKS[AGE_MARKS.length - 1]}
                        value={ageToDraft}
                        onChange={(e) => setAgeToDraft(e.target.value)}
                        onBlur={submitAgeToDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">8</span>{text.mileageRange}</div>
                <div className="cw-range-box">
                  <div className="cw-range-values">
                    <span>{text.from}: <strong>{formatKm(MILEAGE_MARKS[mileageFromIndex])}</strong></span>
                    <span>{text.to}: <strong>{mileageToIndex >= MILEAGE_MARKS.length - 1 ? text.noLimit : formatKm(MILEAGE_MARKS[mileageToIndex])}</strong></span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={MILEAGE_MARKS.length - 2}
                    step={1}
                    value={mileageFromIndex}
                    onChange={(e) => {
                      const nextFrom = Math.min(Number(e.target.value), mileageToIndex - 1);
                      setMileageFromIndex(nextFrom);
                      syncMileageRange(nextFrom, mileageToIndex);
                    }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={MILEAGE_MARKS.length - 1}
                    step={1}
                    value={mileageToIndex}
                    onChange={(e) => {
                      const nextTo = Math.max(Number(e.target.value), mileageFromIndex + 1);
                      setMileageToIndex(nextTo);
                      syncMileageRange(mileageFromIndex, nextTo);
                    }}
                  />
                  <div className="cw-range-manual">
                    <label>
                      {text.from}
                      <input
                        type="number"
                        min={MILEAGE_MARKS[0]}
                        max={MILEAGE_MARKS[MILEAGE_MARKS.length - 1]}
                        value={mileageFromDraft}
                        onChange={(e) => setMileageFromDraft(e.target.value)}
                        onBlur={submitMileageFromDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                    <label>
                      {text.to}
                      <input
                        type="number"
                        min={MILEAGE_MARKS[0]}
                        max={MILEAGE_MARKS[MILEAGE_MARKS.length - 1]}
                        value={mileageToDraft}
                        onChange={(e) => setMileageToDraft(e.target.value)}
                        onBlur={submitMileageToDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 9. UBICACIÓN */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">9</span>{text.location}</div>
              <div className="cw-loc-grid">
                <div className="cw-sel-wrap">
                  <select
                    value={decisionAnswers.location || "toda_espana"}
                    onChange={(e) => updateDecisionAnswer("location", e.target.value)}
                  >
                    {LOCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="cw-sel-arrow">▾</div>
                </div>
              </div>
            </div>

            {/* 10. CARROCERÍA */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">10</span>Carrocería</div>
              <div className="cw-sel-wrap">
                <select
                  value={decisionAnswers.bodyType || ""}
                  onChange={(e) => updateDecisionAnswer("bodyType", e.target.value)}
                >
                  {BODY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="cw-sel-arrow">▾</div>
              </div>
            </div>

            {/* 11+12. PLAZAS + PUERTAS */}
            <div className="cw-two-col">
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">11</span>Plazas</div>
                <div className="cw-plain-manual">
                  <label>
                    {text.from}
                    <div className="cw-sel-wrap">
                      <select
                        value={decisionAnswers.seatsFrom || ""}
                        onChange={(e) => handleSeatsFromChange(e.target.value)}
                      >
                        <option value="">Desde</option>
                        {SEAT_OPTIONS.map((seat) => (
                          <option key={`seat-from-${seat}`} value={seat}>
                            {seat} plazas
                          </option>
                        ))}
                      </select>
                      <div className="cw-sel-arrow">▾</div>
                    </div>
                  </label>
                  <label>
                    {text.to}
                    <div className="cw-sel-wrap">
                      <select
                        value={decisionAnswers.seatsTo || ""}
                        onChange={(e) => handleSeatsToChange(e.target.value)}
                      >
                        <option value="">Hasta</option>
                        {SEAT_OPTIONS.map((seat) => (
                          <option key={`seat-to-${seat}`} value={seat}>
                            {seat} plazas
                          </option>
                        ))}
                      </select>
                      <div className="cw-sel-arrow">▾</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">12</span>Puertas</div>
                <div className="cw-plain-manual">
                  <label>
                    {text.from}
                    <div className="cw-sel-wrap">
                      <select
                        value={decisionAnswers.doorsFrom || ""}
                        onChange={(e) => handleDoorsFromChange(e.target.value)}
                      >
                        <option value="">Desde</option>
                        {DOOR_OPTIONS.map((door) => (
                          <option key={`door-from-${door}`} value={door}>
                            {door} puertas
                          </option>
                        ))}
                      </select>
                      <div className="cw-sel-arrow">▾</div>
                    </div>
                  </label>
                  <label>
                    {text.to}
                    <div className="cw-sel-wrap">
                      <select
                        value={decisionAnswers.doorsTo || ""}
                        onChange={(e) => handleDoorsToChange(e.target.value)}
                      >
                        <option value="">Hasta</option>
                        {DOOR_OPTIONS.map((door) => (
                          <option key={`door-to-${door}`} value={door}>
                            {door} puertas
                          </option>
                        ))}
                      </select>
                      <div className="cw-sel-arrow">▾</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* 13+14. MOTOR + ETIQUETA */}
            <div className="cw-two-col">
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">13</span>Motor</div>
                <div className="cw-sel-wrap">
                  <select
                    value={decisionAnswers.transmission || ""}
                    onChange={(e) => updateDecisionAnswer("transmission", e.target.value)}
                  >
                    {TRANSMISSION_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="cw-sel-arrow">▾</div>
                </div>
              </div>

              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">14</span>Etiqueta DGT</div>
                <div className="cw-sel-wrap">
                  <select
                    value={decisionAnswers.dgtLabel || ""}
                    onChange={(e) => updateDecisionAnswer("dgtLabel", e.target.value)}
                  >
                    {DGT_LABEL_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="cw-sel-arrow">▾</div>
                </div>
              </div>
            </div>

            {/* 15. COLOR */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">15</span>Color</div>
              <div className="cw-color-grid">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`cw-color-chip ${decisionAnswers.color === color.value ? "sel" : ""}`}
                    onClick={() =>
                      updateDecisionAnswer("color", decisionAnswers.color === color.value ? "" : color.value)
                    }
                  >
                    <span className="cw-color-dot" style={{ background: color.dot }} />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RESULTS */}
        {decisionFlowReady && (
          <>
            {decisionMarketLoading && (
              <div className="cw-no-results">{text.loadingOffers}</div>
            )}
            {decisionMarketError && (
              <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:12,padding:12,color:"#b91c1c",fontSize:12}}>
                {decisionMarketError}
              </div>
            )}
            {!decisionMarketError && decisionMarketInsight && (
              <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:12,color:"#1e3a8a",fontSize:12}}>
                {decisionMarketInsight}
              </div>
            )}
            {!decisionMarketLoading && decisionMarketListings.length === 0 && (
              <div className="cw-no-results">{text.noOffers}</div>
            )}
            {!decisionMarketLoading && decisionMarketListings.length > 0 && (
              <div className="cw-results-grid">
                {decisionMarketListings.map((offer, i) => (
                  <a
                    key={i}
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cw-offer-card"
                  >
                    <div className="cw-offer-top">
                      <div className="cw-offer-type">{offer.listingType === "renting" ? "Renting" : "Compra"}</div>
                      <div className="cw-offer-source">{cleanOfferText(offer.source) || "market"}</div>
                    </div>
                    <div className="cw-offer-title">{cleanOfferText(offer.title)}</div>
                    <div className="cw-offer-desc">{cleanOfferText(offer.description)?.substring(0, 96)}</div>
                    <div className="cw-offer-footer">
                      <div className="cw-offer-open">Ver ficha ↗</div>
                      <div className="cw-offer-price">{cleanOfferText(offer.price)}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}

        {!decisionFlowReady && (
          <div className="cw-no-results">{text.completeFilters}</div>
        )}

        {/* CTA */}
        <div className="cw-cta-card">
          <div className="cw-cta-left">
            <div className="cw-count-row">
              <div className="cw-count-n" id="countN">{decisionFlowReady && !decisionMarketLoading ? decisionMarketListings.length : "—"}</div>
              <div className="cw-count-lbl">ofertas disponibles</div>
            </div>
            <div className="cw-cta-hint">{decisionFlowReady ? "Resultados listos para analizar" : "Aplica filtros para ver resultados"}</div>
          </div>
          <div className="cw-cta-right">
            <button className="cw-btn-back" onClick={onRestart}>
              ← {text.backHome}
            </button>
            <button className="cw-btn-main" onClick={onSwitchToAdvice}>
              Ver Marketplace VO de Carswise →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
