import { useState } from "react";
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

export default function DecisionPage({
  styles,
  lockedOperation,
  decisionAnswers,
  updateDecisionAnswer,
  MARKET_BRANDS,
  marketCatalogSource = "fallback",
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

  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#000000";
  const mutedColor = isDark ? "#cbd5e1" : "#94a3b8";
  const accentColor = isDark ? "#60a5fa" : "#2563eb";
  const panelTitleColor = isDark ? "#f1f5f9" : "#0f172a";
  const panelBodyColor = isDark ? "#94a3b8" : "#475569";
  const [showAllBrands, setShowAllBrands] = useState(true);
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
  const [powerFromIndex, setPowerFromIndex] = useState(0);
  const [powerToIndex, setPowerToIndex] = useState(POWER_MARKS.length - 2);

  const effectiveOperation = lockedOperation || decisionAnswers.operation;
  const isApiCatalogActive = marketCatalogSource === "api+fallback";
  const { knownBrands, otherBrands, knownBrandSet } = getBrandOptionSegments(MARKET_BRANDS);
  const hasUnknownSelectedBrand = Boolean(decisionAnswers.brand && !knownBrandSet.has(decisionAnswers.brand));
  const shouldShowAllBrands = showAllBrands || hasUnknownSelectedBrand;
  const visibleBrands = shouldShowAllBrands ? [...knownBrands, ...otherBrands] : knownBrands;
  const operationChoices =
    lockedOperation === "comprar"
      ? [["comprar", text.buy, "🔑"]]
      : lockedOperation === "renting"
        ? [["renting", "Renting", "📅"]]
        : [
            ["comprar", text.buy, "🔑"],
            ["renting", "Renting", "📅"],
          ];

  const [modelInput, setModelInput] = useState("");
  const [modelTags, setModelTags] = useState([]);

  const handleAddModel = (e) => {
    if (e.key !== "Enter") return;
    const v = e.target.value.trim();
    if (!v) return;
    setModelTags([...modelTags, v]);
    setModelInput("");
  };

  const handleRemoveModel = (idx) => {
    setModelTags(modelTags.filter((_, i) => i !== idx));
  };

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
    updateDecisionAnswer("location", "toda_espana");
    setModelTags([]);
    setPriceFromIndex(0);
    setPriceToIndex(PRICE_MARKS.length - 1);
    setAgeFromIndex(0);
    setAgeToIndex(AGE_MARKS.length - 1);
    setMileageFromIndex(0);
    setMileageToIndex(MILEAGE_MARKS.length - 1);
  };

  const getActiveFilters = () => {
    const active = [];
    if (decisionAnswers.brand) active.push(decisionAnswers.brand);
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
    active.push(...modelTags);
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
          .cw-model-wrap { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; background: #fafaf9; border: 1px solid #eee; border-radius: 12px; padding: 0.55rem 0.9rem; min-height: 42px; }
          .cw-model-wrap:focus-within { border-color: rgba(59,130,246,0.4); background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.07); }
          .cw-model-input { border: none; background: none; outline: none; font-size: 13px; color: #444; font-family: Inter, sans-serif; flex: 1; min-width: 140px; }
          .cw-model-input::placeholder { color: #ccc; }
          .cw-m-tag { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #1e40af; font-size: 11px; font-weight: 500; padding: 0.2rem 0.6rem; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.3rem; }
          .cw-m-tag button { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
          .cw-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
          @media (max-width: 640px) { .cw-two-col { grid-template-columns: 1fr; } }
          .cw-f-sep { height: 1px; background: linear-gradient(90deg, transparent, #f0ece4, transparent); }
          .cw-sel-wrap { position: relative; }
          .cw-sel-wrap select { appearance: none; width: 100%; background: #fafaf9; border: 1px solid #eee; border-radius: 12px; padding: 0.62rem 2.2rem 0.62rem 1rem; font-size: 13px; color: #666; font-family: Inter, sans-serif; cursor: pointer; outline: none; }
          .cw-sel-wrap select:focus { border-color: rgba(59,130,246,0.4); background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.07); }
          .cw-sel-arrow { position: absolute; right: 0.8rem; top: 50%; transform: translateY(-50%); pointer-events: none; font-size: 10px; color: #bbb; }
          .cw-loc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
          .cw-cta-card { background: #fff; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.04); padding: 1.25rem 1.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
          .cw-cta-left { display: flex; flex-direction: column; gap: 0.2rem; }
          .cw-count-row { display: flex; align-items: baseline; gap: 0.45rem; }
          .cw-count-n { font-size: 28px; font-weight: 600; color: #3b82f6; letter-spacing: -0.03em; line-height: 1; }
          .cw-count-lbl { font-size: 13px; color: #999; font-weight: 300; }
          .cw-cta-hint { font-size: 11.5px; color: #ccc; font-weight: 300; }
          .cw-cta-right { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
          .cw-btn-back { background: none; border: none; font-size: 12.5px; color: #bbb; cursor: pointer; font-family: Inter, sans-serif; display: flex; align-items: center; gap: 0.35rem; padding: 0.6rem 0; white-space: nowrap; }
          .cw-btn-back:hover { color: #888; }
          .cw-btn-main { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none; border-radius: 12px; padding: 0.7rem 1.6rem; font-size: 13.5px; font-weight: 600; color: #fff; cursor: pointer; font-family: Inter, sans-serif; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 16px rgba(59,130,246,0.4); transition: all 0.2s; white-space: nowrap; }
          .cw-btn-main:hover { box-shadow: 0 6px 24px rgba(59,130,246,0.55); transform: translateY(-2px); }
          .cw-btn-main:active { transform: translateY(0); }
          .cw-results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
          .cw-offer-card { background: #fff; border: 1px solid #f0ece4; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; transition: all 0.15s; text-decoration: none; color: inherit; }
          .cw-offer-card:hover { border-color: rgba(186,117,23,0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
          .cw-offer-type { font-size: 10px; color: #3b82f6; font-weight: 700; margin-bottom: 0.2rem; }
          .cw-offer-title { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 0.3rem; }
          .cw-offer-desc { font-size: 11px; color: #666; line-height: 1.4; }
          .cw-offer-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 0.8rem; border-top: 1px solid #f0ece4; }
          .cw-offer-source { font-size: 10px; color: #999; }
          .cw-offer-price { font-size: 16px; font-weight: 800; color: #111; }
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
            {/* 1. OPERATION */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">1</span>{text.operationType}</div>
              <div className="cw-chips">
                {operationChoices.map(([value, label]) => (
                  <button
                    key={value}
                    className={`cw-chip ${effectiveOperation === value ? "sel" : ""}`}
                    onClick={() => {
                      if (lockedOperation) return;
                      updateDecisionAnswer("operation", value);
                      updateDecisionAnswer("acquisition", value === "renting" ? "particular" : "contado");
                    }}
                    disabled={lockedOperation !== null}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. BRAND */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">2</span>{text.brand}</div>
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
                <span style={{fontSize:"10px",fontWeight:400,textTransform:"none",letterSpacing:0,color:"#ccc",marginLeft:"0.25rem"}}>— opcional</span>
              </div>
              <div className="cw-model-wrap">
                <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap"}}>
                  {modelTags.map((m, i) => (
                    <div key={i} className="cw-m-tag">
                      {m}
                      <button onClick={() => handleRemoveModel(i)}>×</button>
                    </div>
                  ))}
                </div>
                <input
                  className="cw-model-input"
                  type="text"
                  placeholder="Ej: Golf, Ibiza, Clase A…"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onKeyDown={handleAddModel}
                />
              </div>
            </div>

            <div className="cw-f-sep"></div>

            {/* 4. PRESUPUESTO */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">4</span>{text.priceRange}</div>
              <div className="cw-chips">
                {PRICE_MARKS.slice(0, -1).map((mark, idx) => {
                  const nextMark = PRICE_MARKS[idx + 1];
                  const label = `${mark/1000|0}k – ${nextMark/1000|0}k`;
                  const isActive = priceFromIndex === idx && priceToIndex === idx + 2;
                  return (
                    <button
                      key={mark}
                      className={`cw-chip ${isActive ? "sel" : ""}`}
                      onClick={() => {
                        setPriceFromIndex(idx);
                        setPriceToIndex(Math.min(idx + 2, PRICE_MARKS.length - 1));
                        updateDecisionAnswer("priceMin", PRICE_MARKS[idx]);
                        updateDecisionAnswer("priceMax", PRICE_MARKS[Math.min(idx + 2, PRICE_MARKS.length - 1)]);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. COMBUSTIBLE */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">5</span>{text.fuel}</div>
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

            {/* 6+7. ANTIGÜEDAD + KM */}
            <div className="cw-two-col">
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">6</span>{text.ageRange}</div>
                <div className="cw-chips">
                  {AGE_MARKS.slice(0, -1).map((mark, idx) => {
                    const nextMark = AGE_MARKS[idx + 1];
                    const isActive = ageFromIndex === idx && ageToIndex === idx + 2;
                    return (
                      <button
                        key={mark}
                        className={`cw-chip ${isActive ? "sel" : ""}`}
                        onClick={() => {
                          setAgeFromIndex(idx);
                          setAgeToIndex(Math.min(idx + 2, AGE_MARKS.length - 1));
                          updateDecisionAnswer("ageMin", AGE_MARKS[idx]);
                          updateDecisionAnswer("ageMax", AGE_MARKS[Math.min(idx + 2, AGE_MARKS.length - 1)]);
                        }}
                      >
                        {mark}–{nextMark}a
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="cw-f-block">
                <div className="cw-f-lbl"><span className="cw-f-lbl-n">7</span>{text.mileageRange}</div>
                <div className="cw-chips">
                  {MILEAGE_MARKS.slice(0, -1).map((mark, idx) => {
                    const nextMark = MILEAGE_MARKS[idx + 1];
                    const label = `${mark/1000|0}–${nextMark/1000|0}k`;
                    const isActive = mileageFromIndex === idx && mileageToIndex === idx + 2;
                    return (
                      <button
                        key={mark}
                        className={`cw-chip ${isActive ? "sel" : ""}`}
                        onClick={() => {
                          setMileageFromIndex(idx);
                          setMileageToIndex(Math.min(idx + 2, MILEAGE_MARKS.length - 1));
                          updateDecisionAnswer("mileageMin", MILEAGE_MARKS[idx]);
                          updateDecisionAnswer("mileageMax", MILEAGE_MARKS[Math.min(idx + 2, MILEAGE_MARKS.length - 1)]);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 8. UBICACIÓN */}
            <div className="cw-f-block">
              <div className="cw-f-lbl"><span className="cw-f-lbl-n">8</span>{text.location}</div>
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
                    <div className="cw-offer-type">{offer.listingType === "renting" ? "Renting" : "Compra"}</div>
                    <div className="cw-offer-title">{offer.title}</div>
                    <div className="cw-offer-desc">{offer.description?.substring(0, 80)}</div>
                    <div className="cw-offer-footer">
                      <div className="cw-offer-source">{offer.source}</div>
                      <div className="cw-offer-price">{offer.price}</div>
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
              {text.switchFlow} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
