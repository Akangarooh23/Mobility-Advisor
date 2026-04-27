import { useState } from "react";
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
  uiLanguage = "es",
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
  const language = String(uiLanguage || "").toLowerCase() === "en" ? "en" : "es";
  const text = {
    marketOffers: language === "en" ? "🧭 MARKET OFFERS" : "🧭 OFERTAS DE MERCADO",
    title:
      language === "en"
        ? "Refine brand, model and conditions to rank offers"
        : "Afina marca, modelo y condiciones para ordenar las ofertas",
    subtitle:
      language === "en"
        ? "Here we prioritize the current market for a concrete need. You can filter by modality, age, price and mileage before seeing a ranked opportunity list."
        : "Aquí priorizamos el mercado actual para una necesidad ya concreta. Puedes filtrar por modalidad, antigüedad, precio y kilometraje antes de ver un ranking de oportunidades.",
    operationType: language === "en" ? "1. OPERATION TYPE" : "1. TIPO DE OPERACIÓN",
    buy: language === "en" ? "Buy" : "Compra",
    brandModel: language === "en" ? "2. BRAND AND MODEL" : "2. MARCA Y MODELO",
    apiCatalogTitle:
      language === "en"
        ? "Catalog loaded from API and enriched with local backup"
        : "Catálogo cargado desde API y enriquecido con respaldo local",
    fallbackCatalogTitle:
      language === "en"
        ? "Catalog loaded from local backup"
        : "Catálogo cargado desde respaldo local",
    apiCatalog: language === "en" ? "API catalog + backup" : "Catálogo API + respaldo",
    fallbackCatalog: language === "en" ? "Backup catalog" : "Catálogo de respaldo",
    brand: language === "en" ? "Brand" : "Marca",
    selectBrand: language === "en" ? "Select brand" : "Selecciona marca",
    moreBrands: language === "en" ? "+ more brands" : "+ más marcas",
    model: language === "en" ? "Model" : "Modelo",
    selectModel: language === "en" ? "Select model" : "Selecciona modelo",
    priceRange: language === "en" ? "Price range" : "Rango de precio",
    from: language === "en" ? "From" : "Desde",
    to: language === "en" ? "To" : "Hasta",
    ageRange: language === "en" ? "Age range" : "Rango de antigüedad",
    noLimit: language === "en" ? "No limit" : "Sin límite",
    mileageRange: language === "en" ? "Mileage range" : "Rango de kilometraje",
    powerRange: language === "en" ? "Power range" : "Rango de potencia",
    location: language === "en" ? "Location" : "Ubicación",
    fuel: language === "en" ? "Fuel" : "Combustible",
    directOffers:
      language === "en"
        ? "We show you real market offers directly according to your filters."
        : "Te mostramos directamente ofertas reales del mercado según tus filtros.",
    completeFilters:
      language === "en"
        ? "Complete operation, brand, model, price, age and mileage ranges."
        : "Completa operación, marca, modelo, rango de precio, antigüedad y kilometraje.",
    realOffers: language === "en" ? "REAL MARKET OFFERS" : "OFERTAS REALES DE MERCADO",
    recalculating: language === "en" ? "Recalculating..." : "Recalculando...",
    recalculateOffer: language === "en" ? "Recalculate offers" : "Recalcular oferta",
    loadingOffers: language === "en" ? "Loading real offers..." : "Cargando ofertas reales...",
    noOffers:
      language === "en"
        ? "There are no real offers yet for this filter."
        : "Todavía no hay ofertas reales disponibles para este filtro.",
    realOffer: language === "en" ? "REAL OFFER" : "OFERTA REAL",
    fit: language === "en" ? "FIT" : "ENCAJE",
    provider: language === "en" ? "Provider" : "Proveedor",
    priceNotVisible: language === "en" ? "Price not visible" : "Precio no visible",
    directBuy: language === "en" ? "Direct purchase" : "Compra directa",
    listingFallback:
      language === "en"
        ? "Real listing found for your current setup."
        : "Anuncio real localizado para tu configuración actual.",
    openListing: language === "en" ? "Open listing ↗" : "Abrir anuncio ↗",
    switchFlow: language === "en" ? "Switch to decision flow →" : "Cambiar al flujo de decisión →",
    backHome: language === "en" ? "Back to home" : "Volver al inicio",
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

  return (
    <div style={styles.center}>
      <style>
        {`
          .decision-choice {
            position: relative;
            overflow: hidden;
            border-radius: 13px;
            border: 1px solid rgba(37,99,235,0.2);
            box-shadow: 0 8px 18px rgba(15,23,42,0.08);
            transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease, filter 170ms ease;
          }

          .decision-choice::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 90% 8%, rgba(56,189,248,0.16), rgba(56,189,248,0) 45%);
            pointer-events: none;
            opacity: 0.85;
          }

          .decision-choice:hover,
          .decision-choice:focus-visible {
            transform: translateY(-2px);
            border-color: rgba(14,165,233,0.5);
            box-shadow: 0 14px 24px rgba(14,116,144,0.16), 0 0 18px rgba(14,165,233,0.14);
            filter: saturate(1.03);
          }

          .decision-choice.is-active {
            border-color: rgba(37,99,235,0.58);
            box-shadow: 0 0 0 1px rgba(37,99,235,0.2) inset, 0 12px 22px rgba(37,99,235,0.16);
          }
        `}
      </style>

      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>{text.marketOffers}</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: titleColor,
        }}
      >
        {text.title}
      </h2>
      <p style={{ color: mutedColor, fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
        {text.subtitle}
      </p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
          {text.operationType}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
          {operationChoices.map(([value, label, icon]) => (
            <button
              key={value}
              style={styles.card(effectiveOperation === value)}
              className={`decision-choice ${effectiveOperation === value ? "is-active" : ""}`}
              onClick={() => {
                if (lockedOperation) return;
                updateDecisionAnswer("operation", value);
                updateDecisionAnswer("acquisition", value === "renting" ? "particular" : "contado");
              }}
            >
              <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: titleColor }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.6px" }}>
            {text.brandModel}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 999,
              padding: "3px 8px",
              border: isApiCatalogActive ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(245,158,11,0.35)",
              background: isApiCatalogActive ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.14)",
              color: isApiCatalogActive ? "#065f46" : "#92400e",
            }}
            title={isApiCatalogActive ? text.apiCatalogTitle : text.fallbackCatalogTitle}
          >
            {isApiCatalogActive ? text.apiCatalog : text.fallbackCatalog}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.brand}</div>
            <select
              value={decisionAnswers.brand}
              onChange={(event) => {
                if (event.target.value === "__SHOW_MORE_BRANDS__") {
                  setShowAllBrands(true);
                  updateDecisionAnswer("hasBrand", "si");
                  updateDecisionAnswer("brand", "");
                  return;
                }

                updateDecisionAnswer("hasBrand", "si");
                updateDecisionAnswer("brand", event.target.value);
              }}
              style={styles.select}
            >
              <option value="">{text.selectBrand}</option>
              {visibleBrands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
              {!shouldShowAllBrands && otherBrands.length > 0 && (
                <option value="__SHOW_MORE_BRANDS__">{text.moreBrands} ({otherBrands.length})</option>
              )}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.model}</div>
            <select
              value={decisionAnswers.model}
              onChange={(event) => {
                updateDecisionAnswer("hasBrand", "si");
                updateDecisionAnswer("model", event.target.value);
              }}
              disabled={!decisionAnswers.brand}
              style={{
                ...styles.select,
                opacity: decisionAnswers.brand ? 1 : 0.55,
              }}
            >
              <option value="">{text.selectModel}</option>
              {decisionModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.priceRange}</div>
          <div style={{ ...styles.panel, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#334155", marginBottom: 6 }}>
              <span>{text.from}: {formatEuro(PRICE_MARKS[priceFromIndex])}</span>
              <span>{text.to}: {formatEuro(PRICE_MARKS[priceToIndex])}</span>
            </div>
            <input
              type="range"
              min={0}
              max={PRICE_MARKS.length - 2}
              step={1}
              value={priceFromIndex}
              onChange={(event) => {
                const nextFrom = Math.min(Number(event.target.value), priceToIndex - 1);
                setPriceFromIndex(nextFrom);
                updateDecisionAnswer("priceMin", PRICE_MARKS[nextFrom]);
              }}
              style={{ width: "100%" }}
            />
            <input
              type="range"
              min={1}
              max={PRICE_MARKS.length - 1}
              step={1}
              value={priceToIndex}
              onChange={(event) => {
                const nextTo = Math.max(Number(event.target.value), priceFromIndex + 1);
                setPriceToIndex(nextTo);
                updateDecisionAnswer("priceMax", PRICE_MARKS[nextTo]);
                updateDecisionAnswer("cashBudget", PRICE_FILTER_BY_TO_INDEX[nextTo] || "mas_150000");
              }}
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.ageRange}</div>
          <div style={{ ...styles.panel, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#334155", marginBottom: 6 }}>
              <span>{text.from}: {formatYears(AGE_MARKS[ageFromIndex])}</span>
              <span>{text.to}: {ageToIndex >= AGE_MARKS.length - 1 ? text.noLimit : formatYears(AGE_MARKS[ageToIndex])}</span>
            </div>
            <input
              type="range"
              min={0}
              max={AGE_MARKS.length - 2}
              step={1}
              value={ageFromIndex}
              onChange={(event) => {
                const nextFrom = Math.min(Number(event.target.value), ageToIndex - 1);
                setAgeFromIndex(nextFrom);
                updateDecisionAnswer("ageMin", AGE_MARKS[nextFrom]);
              }}
              style={{ width: "100%" }}
            />
            <input
              type="range"
              min={1}
              max={AGE_MARKS.length - 1}
              step={1}
              value={ageToIndex}
              onChange={(event) => {
                const nextTo = Math.max(Number(event.target.value), ageFromIndex + 1);
                setAgeToIndex(nextTo);
                updateDecisionAnswer("ageMax", nextTo >= AGE_MARKS.length - 1 ? null : AGE_MARKS[nextTo]);
                updateDecisionAnswer("ageFilter", AGE_FILTER_BY_TO_INDEX[nextTo] || "all");
              }}
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.mileageRange}</div>
          <div style={{ ...styles.panel, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#334155", marginBottom: 6 }}>
              <span>{text.from}: {formatKm(MILEAGE_MARKS[mileageFromIndex])}</span>
              <span>{text.to}: {mileageToIndex >= MILEAGE_MARKS.length - 1 ? text.noLimit : formatKm(MILEAGE_MARKS[mileageToIndex])}</span>
            </div>
            <input
              type="range"
              min={0}
              max={MILEAGE_MARKS.length - 2}
              step={1}
              value={mileageFromIndex}
              onChange={(event) => {
                const nextFrom = Math.min(Number(event.target.value), mileageToIndex - 1);
                setMileageFromIndex(nextFrom);
                updateDecisionAnswer("mileageMin", MILEAGE_MARKS[nextFrom]);
              }}
              style={{ width: "100%" }}
            />
            <input
              type="range"
              min={1}
              max={MILEAGE_MARKS.length - 1}
              step={1}
              value={mileageToIndex}
              onChange={(event) => {
                const nextTo = Math.max(Number(event.target.value), mileageFromIndex + 1);
                setMileageToIndex(nextTo);
                updateDecisionAnswer("mileageMax", nextTo >= MILEAGE_MARKS.length - 1 ? null : MILEAGE_MARKS[nextTo]);
                updateDecisionAnswer("mileageFilter", MILEAGE_FILTER_BY_TO_INDEX[nextTo] || "all");
              }}
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.powerRange}</div>
          <div style={{ ...styles.panel, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#334155", marginBottom: 6 }}>
              <span>{text.from}: {formatPower(POWER_MARKS[powerFromIndex])}</span>
              <span>{text.to}: {formatPower(POWER_MARKS[powerToIndex])}</span>
            </div>
            <input
              type="range"
              min={0}
              max={POWER_MARKS.length - 2}
              step={1}
              value={powerFromIndex}
              onChange={(event) => {
                const nextFrom = Math.min(Number(event.target.value), powerToIndex - 1);
                setPowerFromIndex(nextFrom);
                updateDecisionAnswer("powerMin", POWER_MARKS[nextFrom]);
              }}
              style={{ width: "100%" }}
            />
            <input
              type="range"
              min={1}
              max={POWER_MARKS.length - 1}
              step={1}
              value={powerToIndex}
              onChange={(event) => {
                const nextTo = Math.max(Number(event.target.value), powerFromIndex + 1);
                setPowerToIndex(nextTo);
                updateDecisionAnswer("powerMax", POWER_MARKS[nextTo]);
              }}
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.location}</div>
          <select
            value={decisionAnswers.location || "toda_espana"}
            onChange={(event) => updateDecisionAnswer("location", event.target.value)}
            style={styles.select}
          >
            {LOCATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.fuel}</div>
          <select
            value={decisionAnswers.fuelFilter || "cualquiera"}
            onChange={(event) => updateDecisionAnswer("fuelFilter", event.target.value)}
            style={styles.select}
          >
            {FUEL_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {decisionFlowReady ? (
        <div style={{ marginBottom: 18, fontSize: 13, color: panelBodyColor }}>
          {text.directOffers}
        </div>
      ) : (
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 18 }}>
          {text.completeFilters}
        </p>
      )}
      {decisionFlowReady && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: accentColor, letterSpacing: "0.6px" }}>
              {text.realOffers}
            </div>
            <button
              type="button"
              onClick={onRecalculateDecisionMarketOffers}
              disabled={decisionMarketLoading}
              style={{
                background: "transparent",
                border: `1px solid ${isDark ? "rgba(148,163,184,0.4)" : "rgba(37,99,235,0.32)"}`,
                color: accentColor,
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: decisionMarketLoading ? "default" : "pointer",
                opacity: decisionMarketLoading ? 0.7 : 1,
              }}
            >
              {decisionMarketLoading ? text.recalculating : text.recalculateOffer}
            </button>
          </div>
          {decisionMarketLoading && (
            <div style={{ ...styles.panel, fontSize: 12, color: panelBodyColor }}>
              {text.loadingOffers}
            </div>
          )}

          {decisionMarketError && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: 12,
                padding: 12,
                color: "#b91c1c",
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              {decisionMarketError}
            </div>
          )}

          {!decisionMarketLoading && !decisionMarketError && decisionMarketListings.length === 0 && decisionFlowReady && (
            <div style={{ ...styles.panel, fontSize: 12, color: panelBodyColor }}>
              <div>{text.noOffers}</div>
              {decisionMarketInsight && (
                <div style={{ marginTop: 8, color: panelTitleColor, lineHeight: 1.6 }}>
                  {decisionMarketInsight}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {decisionMarketListings.slice(0, 3).map((offer, index) => (
              <div key={`${offer.url || offer.title || "offer"}-${index}`} style={styles.panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: accentColor, marginBottom: 4 }}>
                      #{index + 1} {text.realOffer} · {text.fit} {Number(offer.rankingScore ?? offer.profileScore ?? 0)}/100
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: panelTitleColor, marginBottom: 6 }}>
                      {offer.title}
                    </div>
                    <div style={{ fontSize: 12, color: panelBodyColor, lineHeight: 1.6 }}>
                      {offer.source || text.provider}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 21, fontWeight: 800, color: panelTitleColor }}>
                      {offer.price || text.priceNotVisible}
                    </div>
                    {offer.listingType === "renting" ? (
                      <div style={{ fontSize: 12, color: accentColor, marginTop: 4 }}>
                        Renting
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: accentColor, marginTop: 4 }}>
                        {text.directBuy}
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: panelBodyColor, lineHeight: 1.6 }}>
                  {offer.description || text.listingFallback}
                </p>
                {offer.url && (
                  <div style={{ marginTop: 10 }}>
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: accentColor,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      {text.openListing}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onSwitchToAdvice} style={styles.btn}>
          {text.switchFlow}
        </button>
        <button
          onClick={onRestart}
          style={{
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(15,23,42,0.16)",
            color: isDark ? "#94a3b8" : "#334155",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {text.backHome}
        </button>
      </div>
    </div>
  );
}
