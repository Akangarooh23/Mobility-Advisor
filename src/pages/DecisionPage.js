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

  return (
    <div style={{...styles.center, maxWidth: 1600, padding: "20px"}}>
      <style>
        {`
          .decision-sidebar-filter {
            display: flex;
            flexWrap: wrap;
            gap: 6px;
            marginTop: 8px;
          }
          
          .filter-chip {
            padding: 6px 12px;
            borderRadius: 20px;
            border: 1px solid rgba(148,163,184,0.3);
            background: transparent;
            cursor: pointer;
            fontSize: 12px;
            fontWeight: 500;
            transition: all 150ms ease;
            whiteSpace: nowrap;
          }
          
          .filter-chip:hover {
            borderColor: rgba(37,99,235,0.5);
            background: rgba(37,99,235,0.08);
          }
          
          .filter-chip.active {
            background: rgba(37,99,235,0.85);
            color: white;
            borderColor: rgba(37,99,235,0.85);
          }
          
          .decision-layout-sidebar {
            display: grid;
            gridTemplateColumns: 220px 1fr;
            gap: 24px;
            alignItems: start;
          }
          
          @media (max-width: 900px) {
            .decision-layout-sidebar {
              gridTemplateColumns: 1fr;
              gap: 20px;
            }
          }
          
          .sidebar {
            position: sticky;
            top: 20px;
            maxHeight: calc(100vh - 40px);
            overflowY: auto;
            paddingRight: 12px;
          }
          
          .sidebar::-webkit-scrollbar {
            width: 6px;
          }
          
          .sidebar::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .sidebar::-webkit-scrollbar-thumb {
            background: rgba(148,163,184,0.3);
            borderRadius: 3px;
          }
          
          .results-grid {
            display: grid;
            gridTemplateColumns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 14px;
          }
          
          .offer-card {
            borderRadius: 12px;
            padding: 14px;
            border: 1px solid rgba(148,163,184,0.2);
            background: ${isDark ? "rgba(15,23,42,0.5)" : "rgba(255,255,255,0.98)"};
            display: flex;
            flexDirection: column;
            gap: 8px;
            cursor: pointer;
            transition: all 150ms ease;
          }
          
          .offer-card:hover {
            borderColor: rgba(37,99,235,0.3);
            boxShadow: 0 8px 16px rgba(37,99,235,0.12);
            transform: translateY(-1px);
          }
        `}
      </style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>{text.marketOffers}</div>
        <h2
          style={{
            fontSize: "clamp(24px,5vw,32px)",
            fontWeight: 800,
            letterSpacing: "-1px",
            margin: "0 0 8px",
            color: titleColor,
          }}
        >
          {text.title}
        </h2>
        <p style={{ color: mutedColor, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {text.subtitle}
        </p>
      </div>

      {/* Two-column sidebar layout */}
      <div className="decision-layout-sidebar">
        {/* LEFT SIDEBAR: Filters */}
        <div className="sidebar">
          {/* Operation */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {text.operationType}
            </div>
            <div className="decision-sidebar-filter">
              {operationChoices.map(([value, label]) => (
                <button
                  key={value}
                  className={`filter-chip ${effectiveOperation === value ? "active" : ""}`}
                  onClick={() => {
                    if (lockedOperation) return;
                    updateDecisionAnswer("operation", value);
                    updateDecisionAnswer("acquisition", value === "renting" ? "particular" : "contado");
                  }}
                  disabled={lockedOperation !== null}
                  style={{ opacity: lockedOperation && lockedOperation !== value ? 0.5 : 1 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Brand */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {text.brand}
            </div>
            <select
              value={decisionAnswers.brand}
              onChange={(event) => {
                updateDecisionAnswer("hasBrand", "si");
                updateDecisionAnswer("brand", event.target.value);
              }}
              style={{...styles.select, width: "100%", fontSize: 12}}
            >
              <option value="">{text.selectBrand}</option>
              {visibleBrands.slice(0, 15).map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
              {visibleBrands.length > 15 && <option value="__MORE__">+ Más marcas</option>}
            </select>
          </div>

          {/* Model */}
          {decisionAnswers.brand && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
                {text.model}
              </div>
              <select
                value={decisionAnswers.model}
                onChange={(event) => updateDecisionAnswer("model", event.target.value)}
                style={{...styles.select, width: "100%", fontSize: 12}}
              >
                <option value="">{text.selectModel}</option>
                {decisionModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Price */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {text.priceRange}
            </div>
            <div className="decision-sidebar-filter">
              {PRICE_MARKS.slice(0, -1).map((mark, idx) => {
                const nextMark = PRICE_MARKS[idx + 1];
                const label = idx === 0 ? `${mark/1000|0}k` : `${mark/1000|0}k-${nextMark/1000|0}k`;
                const isInRange = mark >= PRICE_MARKS[priceFromIndex] && mark <= PRICE_MARKS[priceToIndex];
                return (
                  <button
                    key={mark}
                    className={`filter-chip ${isInRange ? "active" : ""}`}
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

          {/* Fuel */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {text.fuel}
            </div>
            <div className="decision-sidebar-filter">
              {FUEL_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`filter-chip ${decisionAnswers.fuelFilter === opt.value ? "active" : ""}`}
                  onClick={() => updateDecisionAnswer("fuelFilter", opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {text.ageRange}
            </div>
            <div className="decision-sidebar-filter">
              {AGE_MARKS.slice(0, -1).map((mark, idx) => {
                const nextMark = AGE_MARKS[idx + 1];
                const isInRange = mark >= AGE_MARKS[ageFromIndex] && mark <= AGE_MARKS[ageToIndex];
                return (
                  <button
                    key={mark}
                    className={`filter-chip ${isInRange ? "active" : ""}`}
                    onClick={() => {
                      setAgeFromIndex(idx);
                      setAgeToIndex(Math.min(idx + 2, AGE_MARKS.length - 1));
                      updateDecisionAnswer("ageMin", AGE_MARKS[idx]);
                      updateDecisionAnswer("ageMax", AGE_MARKS[Math.min(idx + 2, AGE_MARKS.length - 1)]);
                    }}
                  >
                    {mark}-{nextMark}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mileage */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {text.mileageRange}
            </div>
            <div className="decision-sidebar-filter">
              {MILEAGE_MARKS.slice(0, -1).map((mark, idx) => {
                const nextMark = MILEAGE_MARKS[idx + 1];
                const label = `${mark/1000|0}-${nextMark/1000|0}k`;
                const isInRange = mark >= MILEAGE_MARKS[mileageFromIndex] && mark <= MILEAGE_MARKS[mileageToIndex];
                return (
                  <button
                    key={mark}
                    className={`filter-chip ${isInRange ? "active" : ""}`}
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

          {/* Location */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: "0.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {text.location}
            </div>
            <select
              value={decisionAnswers.location || "toda_espana"}
              onChange={(event) => updateDecisionAnswer("location", event.target.value)}
              style={{...styles.select, width: "100%", fontSize: 12}}
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: `1px solid ${isDark ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.15)"}` }}>
            <button onClick={onSwitchToAdvice} style={{...styles.btn, width: "100%", fontSize: 11, padding: "8px 12px"}}>
              {text.switchFlow}
            </button>
            <button
              onClick={onRestart}
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(15,23,42,0.12)",
                color: isDark ? "#94a3b8" : "#334155",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 11,
                cursor: "pointer",
                width: "100%",
              }}
            >
              {text.backHome}
            </button>
          </div>
        </div>

        {/* RIGHT: Results */}
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 12, color: mutedColor }}>
              {decisionMarketListings.length} {text.realOffers}
            </div>
            {decisionFlowReady && (
              <button
                type="button"
                onClick={onRecalculateDecisionMarketOffers}
                disabled={decisionMarketLoading}
                style={{
                  background: "transparent",
                  border: `1px solid ${isDark ? "rgba(148,163,184,0.4)" : "rgba(37,99,235,0.32)"}`,
                  color: accentColor,
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: decisionMarketLoading ? "default" : "pointer",
                  opacity: decisionMarketLoading ? 0.7 : 1,
                }}
              >
                {decisionMarketLoading ? text.recalculating : "Recalcular"}
              </button>
            )}
          </div>

          {decisionMarketError && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: 10,
                padding: 12,
                color: "#b91c1c",
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {decisionMarketError}
            </div>
          )}

          {!decisionFlowReady && (
            <div style={{ ...styles.panel, fontSize: 12, color: panelBodyColor }}>
              {text.completeFilters}
            </div>
          )}

          {decisionFlowReady && decisionMarketLoading && (
            <div style={{ ...styles.panel, fontSize: 12, color: panelBodyColor }}>
              {text.loadingOffers}
            </div>
          )}

          {decisionFlowReady && !decisionMarketLoading && decisionMarketListings.length === 0 && (
            <div style={{ ...styles.panel, fontSize: 12, color: panelBodyColor }}>
              {text.noOffers}
            </div>
          )}

          {decisionFlowReady && decisionMarketListings.length > 0 && (
            <div className="results-grid">
              {decisionMarketListings.map((offer, index) => (
                <a
                  key={`${offer.url || index}`}
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <div className="offer-card">
                    <div>
                      <div style={{ fontSize: 10, color: accentColor, fontWeight: 700, marginBottom: 4 }}>
                        {offer.listingType === "renting" ? "Renting" : text.directBuy}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: panelTitleColor, marginBottom: 4 }}>
                        {offer.title}
                      </div>
                      <div style={{ fontSize: 11, color: panelBodyColor, lineHeight: 1.4 }}>
                        {offer.description?.substring(0, 60)}...
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 8, borderTop: `1px solid ${isDark ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.1)"}` }}>
                      <div style={{ fontSize: 10, color: "#64748b" }}>
                        {offer.source || text.provider}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: panelTitleColor }}>
                        {offer.price}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
