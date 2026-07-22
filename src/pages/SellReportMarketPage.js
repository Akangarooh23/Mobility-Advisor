import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getBillingAccountJson,
  getErpBrandsJson,
  getErpModelsJson,
  getErpVersionsJson,
  getGarageVehicleSummariesJson,
  postBillingCheckoutJson,
  postGarageVehicleAddJson,
} from "../utils/apiClient";
import "./SellReportMarketPage.css";

async function checkBillingProfile(currentUserEmail) {
  try {
    const { data } = await getBillingAccountJson(currentUserEmail);
    const p = data?.account?.profile || {};
    const missing = [];
    if (!normalizeText(p.taxId))         missing.push("NIF/CIF");
    if (!normalizeText(p.billingStreet)) missing.push("dirección de facturación");
    return missing;
  } catch {
    return []; // on infra error allow checkout
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMatchToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const GARAGE_STORAGE_PREFIX = "movilidadAdvisorGarage";
const DASHBOARD_GARAGE_STORAGE_PREFIX = "movilidad-advisor.userGarage.v1";

function getGarageStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${GARAGE_STORAGE_PREFIX}.${normalizedEmail}` : GARAGE_STORAGE_PREFIX;
}

function getDashboardGarageStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${DASHBOARD_GARAGE_STORAGE_PREFIX}.${normalizedEmail}` : DASHBOARD_GARAGE_STORAGE_PREFIX;
}

function readGarageVehiclesCache(currentUserEmail = "") {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const keys = [
      getGarageStorageKey(currentUserEmail),
      getDashboardGarageStorageKey(currentUserEmail),
    ];

    const byId = new Map();
    keys.forEach((key) => {
      const raw = window.localStorage.getItem(key);
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) {
        return;
      }

      parsed.forEach((item) => {
        const id = normalizeText(item?.id);
        if (id && !byId.has(id)) {
          byId.set(id, item);
        }
      });
    });

    return Array.from(byId.values());
  } catch {
    return [];
  }
}

function writeGarageVehiclesCache(currentUserEmail = "", vehicles = []) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeVehicles = Array.isArray(vehicles)
      ? vehicles.filter((item) => item && normalizeText(item?.id)).slice(0, 30)
      : [];
    window.localStorage.setItem(getGarageStorageKey(currentUserEmail), JSON.stringify(safeVehicles));
    window.localStorage.setItem(getDashboardGarageStorageKey(currentUserEmail), JSON.stringify(safeVehicles));
  } catch {
    // Ignore storage errors and continue with runtime state.
  }
}

function buildIdCarLabel(vehicle = {}, fallbackIndex = 0) {
  const title = normalizeText(vehicle?.title);
  const brand = normalizeText(vehicle?.brand);
  const model = normalizeText(vehicle?.model);
  const version = normalizeText(vehicle?.version);
  const plate = normalizeText(vehicle?.plate);
  const summary = [brand, model, version].filter(Boolean).join(" ");
  const resolvedTitle = title || summary || `IDCar ${fallbackIndex + 1}`;
  return plate ? `${resolvedTitle} · ${plate}` : resolvedTitle;
}

// eslint-disable-next-line no-unused-vars
function pickNumber(value, fallback) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return fallback;
  }

  const clean = text.replace(/[^\d.,-]/g, "");
  const hasCommaDecimal = /,\d{1,2}$/.test(clean);
  const hasDotDecimal = /\.\d{1,2}$/.test(clean);
  let normalized = clean;

  if (hasCommaDecimal) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (hasDotDecimal) {
    normalized = clean.replace(/,/g, "");
  } else {
    normalized = clean.replace(/[.,]/g, "");
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

// eslint-disable-next-line no-unused-vars
function parseEstimatedDays(value) {
  const text = String(value ?? "");
  if (!text.trim()) {
    return 0;
  }

  const matches = text.match(/\d+/g);
  if (!Array.isArray(matches) || matches.length === 0) {
    return 0;
  }

  const numbers = matches
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);

  if (numbers.length === 0) {
    return 0;
  }

  const average = numbers.reduce((acc, item) => acc + item, 0) / numbers.length;
  return Math.round(average);
}

// eslint-disable-next-line no-unused-vars
function currencyEUR(value, formatCurrency) {
  if (typeof formatCurrency === "function") {
    return formatCurrency(value);
  }
  return `${Math.round(value).toLocaleString("es-ES")}€`;
}

function findCatalogItemByToken(items = [], token = "", getLabel = (item) => item?.name) {
  if (!Array.isArray(items) || !token) {
    return null;
  }

  const normalizedToken = normalizeMatchToken(token);
  if (!normalizedToken) {
    return null;
  }

  const exact = items.find((item) => normalizeMatchToken(getLabel(item)) === normalizedToken);
  if (exact) {
    return exact;
  }

  return items.find((item) => {
    const label = normalizeMatchToken(getLabel(item));
    return label.includes(normalizedToken) || normalizedToken.includes(label);
  }) || null;
}

const DAMAGE_OPTIONS = [
  "sell.damageNone",
  "sell.damageMinor",
  "sell.damageModerate",
  "sell.damageMajor",
];

// ERP Catalog cache to avoid re-fetching the same data
const ERP_CATALOG_CACHE = {
  brands: null,
  models: new Map(), // brandId -> models
  versions: new Map(), // `${modelId}|${brandId}` -> versions
};

function getCachedBrands() {
  const cached = ERP_CATALOG_CACHE.brands;
  return cached ? cached.slice() : null;
}

function setCachedBrands(brands) {
  if (Array.isArray(brands)) {
    ERP_CATALOG_CACHE.brands = brands.slice();
  }
}

function getCachedModels(brandId) {
  const cached = ERP_CATALOG_CACHE.models.get(String(brandId));
  return cached ? cached.slice() : null;
}

function setCachedModels(brandId, models) {
  if (Array.isArray(models)) {
    ERP_CATALOG_CACHE.models.set(String(brandId), models.slice());
  }
}

function getCachedVersions(modelId, brandId) {
  const key = `${modelId}|${brandId}`;
  const cached = ERP_CATALOG_CACHE.versions.get(key);
  return cached ? cached.slice() : null;
}

function setCachedVersions(modelId, brandId, versions) {
  if (Array.isArray(versions)) {
    const key = `${modelId}|${brandId}`;
    ERP_CATALOG_CACHE.versions.set(key, versions.slice());
  }
}

export default function SellReportMarketPage({
  currentUserEmail,
  selectedValuationVehicleSummary,
  sellAnswers,
  setSellAnswers,
  fuelOptions,
  analyzeSellWithAI,
  sellLoading,
  sellEstimate,
  sellAiResult,
  sellMarketSnapshot,
  sellMarketSnapshotLoading,
  sellMarketSnapshotError,
  sellError,
  onGoBack,
  onGoToBuyKnownModel,
  formatCurrency,
}) {
  const [erpBrands, setErpBrands] = useState([]);
  const [erpModels, setErpModels] = useState([]);
  const [erpVersions, setErpVersions] = useState([]);
  const [erpBrandsLoading, setErpBrandsLoading] = useState(false);
  const [erpModelsLoading, setErpModelsLoading] = useState(false);
  const [erpVersionsLoading, setErpVersionsLoading] = useState(false);
  const [erpSelectedBrandId, setErpSelectedBrandId] = useState("");
  const [erpSelectedModelId, setErpSelectedModelId] = useState("");
  const [garageVehicles, setGarageVehicles] = useState([]);
  const { t } = useTranslation();
  const [garageVehiclesLoading, setGarageVehiclesLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const translateFuelOption = (fuel) => {
    const raw = normalizeText(fuel);
    const normalized = normalizeMatchToken(raw);
    const mapping = {
      gasolina: "sell.fuelGas",
      gasoline: "sell.fuelGas",
      "sell.fuelgas": "sell.fuelGas",
      "diésel": "sell.fuelDiesel",
      diesel: "sell.fuelDiesel",
      "sell.fueldiesel": "sell.fuelDiesel",
      híbrido: "sell.fuelHybrid",
      hybrid: "sell.fuelHybrid",
      "sell.fuelhybrid": "sell.fuelHybrid",
      phev: "sell.fuelPHEV",
      "sell.fuelphev": "sell.fuelPHEV",
      eléctrico: "sell.fuelElectric",
      electrico: "sell.fuelElectric",
      electric: "sell.fuelElectric",
      "sell.fuelelectric": "sell.fuelElectric",
    };

    const mappedKey = mapping[normalized] || raw;
    const translated = t(mappedKey);
    if (translated !== mappedKey) {
      return translated;
    }

    if (mappedKey.startsWith("sell.")) {
      const unprefixed = mappedKey.slice(5);
      const fallback = t(unprefixed);
      if (fallback !== unprefixed) {
        return fallback;
      }
    }

    return raw;
  };
  const [selectedIdCarId, setSelectedIdCarId] = useState("");
  const [idCarPromptVisible, setIdCarPromptVisible] = useState(false);
  const idCarSelectRef = useRef(null);
  const step2Ref = useRef(null);

  // Fleet state
  const [fleetOpen, setFleetOpen] = useState(false);
  const [fleetSelected, setFleetSelected] = useState({});
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState("");
  const [fleetMode, setFleetMode] = useState(false);
  const [fleetPage, setFleetPage] = useState(0);
  const [fleetDamages, setFleetDamages] = useState({});
  const [fleetEdits, setFleetEdits] = useState({});

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2013 }, (_, index) => currentYear - index);





  useEffect(() => {
    if (!normalizeText(currentUserEmail)) {
      setGarageVehicles([]);
      setGarageVehiclesLoading(false);
      return;
    }

    let cancelled = false;
    const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
    const cachedVehicles = readGarageVehiclesCache(normalizedEmail);
    if (cachedVehicles.length > 0) {
      setGarageVehicles(cachedVehicles.filter((item) => item && normalizeText(item?.id)));
    }

    setGarageVehiclesLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);
    getGarageVehicleSummariesJson(normalizedEmail, { signal: controller.signal })
      .then(({ response, data }) => {
        if (!cancelled && response?.ok) {
          const nextVehicles = Array.isArray(data?.vehicles)
            ? data.vehicles.filter((item) => item && normalizeText(item?.id))
            : [];
          setGarageVehicles(nextVehicles);
          writeGarageVehiclesCache(normalizedEmail, nextVehicles);
        }
      })
      .catch(() => {
        if (!cancelled && cachedVehicles.length === 0) {
          setGarageVehicles([]);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setGarageVehiclesLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentUserEmail]);

  useEffect(() => {
    let cancelled = false;

    // Check cache first
    const cachedBrands = getCachedBrands();
    if (cachedBrands) {
      setErpBrands(cachedBrands);
      return;
    }

    setErpBrandsLoading(true);
    getErpBrandsJson()
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          const brands = Array.isArray(data?.brands) ? data.brands : [];
          setCachedBrands(brands);
          setErpBrands(brands);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErpBrands([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setErpBrandsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedValuationVehicleSummary) {
      return;
    }

    setSellAnswers((prev) => ({
      ...prev,
      plate: normalizeText(selectedValuationVehicleSummary?.plate) || prev.plate || "",
      brand: normalizeText(selectedValuationVehicleSummary?.brand) || prev.brand || "",
      model: normalizeText(selectedValuationVehicleSummary?.model) || prev.model || "",
      year: normalizeText(selectedValuationVehicleSummary?.year) || prev.year || "",
    }));
  }, [selectedValuationVehicleSummary, setSellAnswers]);

  const syncVehicleToErpSelectors = useCallback(async (vehicle) => {
    const brandToken = normalizeMatchToken(vehicle?.brand);
    const modelToken = normalizeMatchToken(vehicle?.model);
    const versionToken = normalizeMatchToken(vehicle?.version);

    if (!brandToken) {
      setErpSelectedBrandId("");
      setErpSelectedModelId("");
      setErpModels([]);
      setErpVersions([]);
      return;
    }

    const brand = findCatalogItemByToken(erpBrands, brandToken, (item) => item?.name);
    if (!brand) {
      setErpSelectedBrandId("");
      setErpSelectedModelId("");
      setErpModels([]);
      setErpVersions([]);
      return;
    }

    setErpSelectedBrandId(String(brand.id));
    setErpModelsLoading(true);
    try {
      // Check cache first
      let nextModels = getCachedModels(brand.id);
      if (!nextModels) {
        const modelResponse = await getErpModelsJson(brand.id);
        const modelData = await modelResponse.json();
        nextModels = Array.isArray(modelData?.models) ? modelData.models : [];
        setCachedModels(brand.id, nextModels);
      }
      setErpModels(nextModels);
      const model = findCatalogItemByToken(nextModels, modelToken, (item) => item?.name);
      if (!model) {
        setErpSelectedModelId("");
        setErpVersions([]);
        return;
      }

      setErpSelectedModelId(String(model.id));
      setErpVersionsLoading(true);
      // Check cache first
      let fetchedVersions = getCachedVersions(model.id, brand.id);
      if (!fetchedVersions) {
        const versionResponse = await getErpVersionsJson(model.id, brand.id);
        const versionData = await versionResponse.json();
        fetchedVersions = Array.isArray(versionData?.versions) ? versionData.versions : [];
        setCachedVersions(model.id, brand.id, fetchedVersions);
      }
      const version = findCatalogItemByToken(
        fetchedVersions,
        versionToken,
        (item) => `${normalizeText(item?.label)} ${normalizeText(item?.codversion)}`
      );
      const fallbackVersionLabel = normalizeText(vehicle?.version);
      const fallbackVersion = !version && fallbackVersionLabel
        ? {
            codversion: fallbackVersionLabel,
            label: fallbackVersionLabel,
          }
        : null;
      const nextVersions = fallbackVersion ? [fallbackVersion, ...fetchedVersions] : fetchedVersions;
      setErpVersions(nextVersions);
      setSellAnswers((prev) => ({
        ...prev,
        version: version?.label || fallbackVersionLabel || prev.version || "",
        erpBrandId: String(brand.id),
        erpModelId: String(model.id),
        erpVersionCode: version?.codversion || fallbackVersion?.codversion || "",
      }));
    } catch {
      setErpModels([]);
      setErpVersions([]);
    } finally {
      setErpModelsLoading(false);
      setErpVersionsLoading(false);
    }
  }, [erpBrands, setSellAnswers]);

  useEffect(() => {
    if (!selectedIdCarId || erpBrands.length === 0 || garageVehicles.length === 0) {
      return;
    }

    const vehicle = garageVehicles.find((item) => normalizeText(item?.id) === normalizeText(selectedIdCarId));
    if (!vehicle) {
      return;
    }

    void syncVehicleToErpSelectors(vehicle);
  }, [selectedIdCarId, erpBrands, garageVehicles, syncVehicleToErpSelectors]);


  return (
    <div className="sell-market-root sell-market-wrap">
      <div className="back-row">
        <button className="back-btn" type="button" onClick={onGoBack}>
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          {t("sell.goBack")}
        </button>
        <span className="breadcrumb">{t("sell.breadcrumbReport")}</span>
      </div>

      <div className="hero-card">
        <div className="hero-band" />
        <div className="hero-inner">
          <div className="badge">{`${t("sell.optionABadge")} · ${t("sell.optionATitle")}`}</div>
          <h1 className="sell-market-title">{t("sell.optionATitle")}</h1>
          <p className="sell-market-desc">
            {t("sell.reportHeroDesc")}
          </p>
          <div className="sell-market-meta">
            <div className="mpill">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
              {t("sell.heroMetaImmediate")}
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
              {t("sell.heroMetaRealtime")}
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27z" /></svg>
              {t("sell.heroMetaNoCommitment")}
            </div>
          </div>
        </div>
      </div>

      <div className="flow-card">
        <div className="flow-band" />
        <div className="flow-inner">
          <div className="blabel"><div className="blabel-dot" />{t("sell.flowAHeader")}</div>
          <div className="steps-grid">
            <div className="step-block">
              <div className="step-left">
                <div className="step-circle">1</div>
                <div className="step-connector" />
              </div>
              <div className="step-right">
                <div className="step-label">{t("sell.step1Label")}</div>
                <div className="step-title">{t("sell.step1Title")}</div>
                <div className="step-desc">{t("sell.step1Desc")}</div>
                <div className="form-section">
                  {/* Mode toggle — only when 2+ garage vehicles */}
                  {garageVehicles.length >= 2 && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                      <button
                        type="button"
                        onClick={() => { setFleetMode(false); setFleetPage(0); }}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1.5px solid ${!fleetMode ? "#0d9488" : "#e5e7eb"}`, background: !fleetMode ? "#f0fafa" : "#fafafa", color: !fleetMode ? "#0d9488" : "#6B7780", fontWeight: !fleetMode ? 700 : 400, cursor: "pointer", fontSize: 13 }}
                      >
                        Un vehículo
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFleetMode(true); setFleetPage(0); }}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1.5px solid ${fleetMode ? "#0d9488" : "#e5e7eb"}`, background: fleetMode ? "#f0fafa" : "#fafafa", color: fleetMode ? "#0d9488" : "#6B7780", fontWeight: fleetMode ? 700 : 400, cursor: "pointer", fontSize: 13 }}
                      >
                        Varios vehículos 🚗
                      </button>
                    </div>
                  )}

                  {/* ── FLEET MODE ── */}
                  {fleetMode && garageVehicles.length >= 2 && (() => {
                    const TIERS = [
                      { max: 1,  price: 10 }, { max: 4,  price: 9 }, { max: 9,  price: 8 },
                      { max: 19, price: 7  }, { max: 49, price: 6 }, { max: 99, price: 5 },
                    ];
                    function unitPrice(n) { const t = TIERS.find((x) => n <= x.max); return t ? t.price : null; }
                    const selectedIds = Object.keys(fleetSelected).filter((id) => fleetSelected[id]);
                    const count = selectedIds.length;
                    const up = unitPrice(count);
                    const total = up != null ? count * up : null;
                    const safePage = Math.min(fleetPage, Math.max(0, count - 1));
                    const currentVehId = selectedIds[safePage];
                    const currentVeh = garageVehicles.find((v) => v.id === currentVehId);

                    return (
                      <div>
                        {/* Vehicle cards grid */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                          <div style={{ width: "100%", display: "flex", gap: 10, marginBottom: 4 }}>
                            <button type="button" onClick={() => { const all = {}; garageVehicles.forEach((v) => { all[v.id] = true; }); setFleetSelected(all); setFleetPage(0); }} style={{ fontSize: 12, color: "#0d9488", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>Seleccionar todos</button>
                            <span style={{ color: "#ddd" }}>·</span>
                            <button type="button" onClick={() => { setFleetSelected({}); setFleetPage(0); }} style={{ fontSize: 12, color: "#9AA3AB", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Limpiar</button>
                          </div>
                          {garageVehicles.map((v) => {
                            const checked = !!fleetSelected[v.id];
                            const lbl = [v.brand, v.model, v.year].filter(Boolean).join(" ");
                            return (
                              <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${checked ? "#0d9488" : "#e5e7eb"}`, background: checked ? "#f0fafa" : "#fafafa", cursor: "pointer", minWidth: 160, flex: "1 1 160px" }}>
                                <input type="checkbox" checked={checked} onChange={(e) => { setFleetSelected((prev) => ({ ...prev, [v.id]: e.target.checked })); if (e.target.checked) setFleetPage(Object.keys({ ...fleetSelected, [v.id]: true }).filter((id) => ({ ...fleetSelected, [v.id]: true })[id]).length - 1); }} style={{ accentColor: "#0d9488", width: 15, height: 15 }} />
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: checked ? 700 : 400, color: "#1C2B33" }}>{lbl || "Vehículo"}</div>
                                  {v.plate && <div style={{ fontSize: 11, color: "#9AA3AB" }}>{v.plate}</div>}
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        {/* Pageable detail view */}
                        {count > 0 && currentVeh && (
                          <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                            {/* Pager header */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#f8f9fa", borderBottom: "1px solid #e5e7eb" }}>
                              <button type="button" disabled={safePage === 0} onClick={() => setFleetPage((p) => Math.max(0, p - 1))} style={{ background: "none", border: "none", cursor: safePage === 0 ? "default" : "pointer", color: safePage === 0 ? "#ccc" : "#0d9488", fontSize: 18, fontWeight: 700, padding: "0 4px" }}>‹</button>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#1C2B33" }}>Vehículo {safePage + 1} de {count}</span>
                              <button type="button" disabled={safePage === count - 1} onClick={() => setFleetPage((p) => Math.min(count - 1, p + 1))} style={{ background: "none", border: "none", cursor: safePage === count - 1 ? "default" : "pointer", color: safePage === count - 1 ? "#ccc" : "#0d9488", fontSize: 18, fontWeight: 700, padding: "0 4px" }}>›</button>
                            </div>
                            {/* Vehicle details */}
                            <div style={{ padding: "16px 16px 12px" }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#1C2B33", marginBottom: 2 }}>{[currentVeh.brand, currentVeh.model].filter(Boolean).join(" ") || "Vehículo"}</div>
                              {currentVeh.plate && <div style={{ fontSize: 12, color: "#9AA3AB", marginBottom: 10 }}>{currentVeh.plate}</div>}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 16px", marginBottom: 14 }}>
                                {[
                                  ["Año", "year", currentVeh.year, "number"],
                                  ["Kilómetros", "mileage", currentVeh.mileage, "number"],
                                  ["Combustible", "fuel", currentVeh.fuel, "text"],
                                  ["Versión", "version", currentVeh.version, "text"],
                                  ["Provincia", "location", currentVeh.location, "text"],
                                ].map(([k, field, rawVal, inputType]) => {
                                  const editedVal = fleetEdits[currentVeh.id]?.[field];
                                  const displayVal = editedVal != null ? editedVal : rawVal;
                                  const isEmpty = !displayVal;
                                  return (
                                  <div key={k}>
                                    <div style={{ fontSize: 10, color: isEmpty ? "#BA7517" : "#9AA3AB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, fontWeight: isEmpty ? 700 : 400 }}>{k}{isEmpty ? " *" : ""}</div>
                                    {isEmpty ? (
                                      <input
                                        type={inputType}
                                        placeholder={`Añadir ${k.toLowerCase()}`}
                                        defaultValue=""
                                        style={{ width: "100%", border: "1.5px solid #BA7517", borderRadius: 6, padding: "4px 6px", fontSize: 12, color: "#1C2B33", background: "#FFFBF5", boxSizing: "border-box" }}
                                        onBlur={async (e) => {
                                          const val = e.target.value.trim();
                                          if (!val) return;
                                          const merged = { ...currentVeh, ...(fleetEdits[currentVeh.id] || {}), [field]: val };
                                          setFleetEdits((prev) => ({ ...prev, [currentVeh.id]: { ...(prev[currentVeh.id] || {}), [field]: val } }));
                                          setGarageVehicles((prev) => prev.map((v) => v.id === currentVeh.id ? { ...v, [field]: val } : v));
                                          try { await postGarageVehicleAddJson(currentUserEmail, merged); } catch { /* non-blocking */ }
                                        }}
                                      />
                                    ) : (
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1C2B33", display: "flex", alignItems: "center", gap: 4 }}>
                                        {field === "mileage" ? new Intl.NumberFormat("es-ES").format(Number(displayVal)) + " km" : displayVal}
                                        <button type="button" onClick={() => setFleetEdits((prev) => ({ ...prev, [currentVeh.id]: { ...(prev[currentVeh.id] || {}), [field]: "" } }))} style={{ fontSize: 10, color: "#9AA3AB", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }} title="Editar">✎</button>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                              {/* Damage selector per vehicle */}
                              <div>
                                <div style={{ fontSize: 11, color: "#9AA3AB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Estado del vehículo</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {["Sin daños", "Daños leves", "Daños moderados", "Daños graves"].map((lvl) => {
                                    const active = (fleetDamages[currentVeh.id] || "Sin daños") === lvl;
                                    return (
                                      <button key={lvl} type="button" onClick={() => setFleetDamages((prev) => ({ ...prev, [currentVeh.id]: lvl }))} style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${active ? "#0d9488" : "#e5e7eb"}`, background: active ? "#0d9488" : "#fafafa", color: active ? "#fff" : "#46535C", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
                                        {lvl}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Fleet price summary */}
                        {count > 0 && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fffe", border: "1.5px solid #0d9488", borderRadius: 10, gap: 8, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontSize: 12, color: "#46535C" }}>{count} vehículo{count !== 1 ? "s" : ""} seleccionado{count !== 1 ? "s" : ""} · {up} €/unidad</div>
                              {total != null && <div style={{ fontSize: 18, fontWeight: 800, color: "#1C2B33" }}>Total: {total} €</div>}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {TIERS.map((tier, i) => {
                                const label = i === 0 ? "1" : `${TIERS[i-1].max + 1}–${tier.max}`;
                                const active = up === tier.price;
                                return <span key={tier.price} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: active ? "#0d9488" : "#f0f0f0", color: active ? "#fff" : "#9AA3AB", fontWeight: active ? 700 : 400 }}>{label}: {tier.price}€</span>;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── SINGLE VEHICLE MODE ── */}
                  {!fleetMode && (<><div className="field-grid" style={{ marginBottom: "0.85rem" }}>
                    <div className="field field-full-row">
                      <label>{t("sell.useIdCar")}</label>
                      <div className="sel-wrap">
                        <select
                          ref={idCarSelectRef}
                          value={selectedIdCarId}
                          disabled={garageVehiclesLoading}
                          onChange={(event) => {
                            const vehicleId = event.target.value;
                            setSelectedIdCarId(vehicleId);
                            setIdCarPromptVisible(false);
                            const vehicle = garageVehicles.find((item) => normalizeText(item?.id) === normalizeText(vehicleId));
                            if (!vehicle) {
                              return;
                            }

                            setSellAnswers((prev) => ({
                              ...prev,
                              plate: normalizeText(vehicle?.plate),
                              brand: normalizeText(vehicle?.brand),
                              model: normalizeText(vehicle?.model),
                              version: normalizeText(vehicle?.version),
                              year: normalizeText(vehicle?.year),
                              mileage: normalizeText(vehicle?.mileage),
                              fuel: normalizeText(vehicle?.fuel) || prev.fuel || fuelOptions?.[0] || "",
                            }));

                            void syncVehicleToErpSelectors(vehicle);
                          }}
                        >
                          <option value="">
                            {garageVehiclesLoading
                              ? t("sell.loadingIdCars")
                              : garageVehicles.length > 0
                                ? t("sell.selectYourIdCar")
                                : t("sell.noIdCarsYet")}
                          </option>
                          {garageVehicles.map((vehicle, index) => (
                            <option key={vehicle.id} value={vehicle.id}>{buildIdCarLabel(vehicle, index)}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                      {idCarPromptVisible ? (
                        <div className="sell-market-idcar-hint">{t("sell.selectIdCarHint")}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="field-grid">
                    <div className="field">
                      <label>{t("sell.sellFlowAPlateLabel")}</label>
                      <input
                        type="text"
                        placeholder={t("sell.placeholderPlate")}
                        value={sellAnswers?.plate || ""}
                        onChange={(event) => setSellAnswers((prev) => ({ ...prev, plate: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{t("sell.sellFlowABrandLabel")}</label>
                      <div className="sel-wrap">
                        <select
                          value={erpSelectedBrandId}
                          disabled={erpBrandsLoading}
                          onChange={(event) => {
                            const brandId = event.target.value;
                            const brand = erpBrands.find((item) => String(item.id) === String(brandId));
                            setErpSelectedBrandId(brandId);
                            setErpSelectedModelId("");
                            setErpModels([]);
                            setErpVersions([]);
                            setSellAnswers((prev) => ({
                              ...prev,
                              brand: brand?.name || "",
                              model: "",
                              version: "",
                              erpBrandId: brandId,
                              erpModelId: "",
                              erpVersionCode: "",
                            }));

                            if (!brandId) {
                              return;
                            }

                            // Check cache first
                            const cachedModels = getCachedModels(brandId);
                            if (cachedModels) {
                              setErpModels(cachedModels);
                              return;
                            }

                            setErpModelsLoading(true);
                            getErpModelsJson(brandId)
                              .then((response) => response.json())
                              .then((data) => {
                                const models = Array.isArray(data?.models) ? data.models : [];
                                setCachedModels(brandId, models);
                                setErpModels(models);
                              })
                              .catch(() => {
                                setErpModels([]);
                              })
                              .finally(() => {
                                setErpModelsLoading(false);
                              });
                          }}
                        >
                          <option value="">{erpBrandsLoading ? t("sell.loadingBrands") : "Selecciona una marca"}</option>
                          {erpBrands.map((brand) => (
                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="field-grid">
                    <div className="field">
                      <label>{t("sell.sellFlowAModelLabel")}</label>
                      <div className="sel-wrap">
                        <select
                          value={erpSelectedModelId}
                          disabled={!erpSelectedBrandId || erpModelsLoading}
                          onChange={(event) => {
                            const modelId = event.target.value;
                            const model = erpModels.find((item) => String(item.id) === String(modelId));
                            setErpSelectedModelId(modelId);
                            setErpVersions([]);
                            setSellAnswers((prev) => ({
                              ...prev,
                              model: model?.name || "",
                              version: "",
                              erpModelId: modelId,
                              erpVersionCode: "",
                            }));

                            if (!modelId) {
                              return;
                            }

                            // Check cache first - but only if we have a valid brandId
                            if (erpSelectedBrandId) {
                              const cachedVersions = getCachedVersions(modelId, erpSelectedBrandId);
                              if (cachedVersions && Array.isArray(cachedVersions)) {
                                setErpVersions(cachedVersions);
                                return;
                              }
                            }

                            setErpVersionsLoading(true);
                            getErpVersionsJson(modelId, erpSelectedBrandId)
                              .then((response) => response.json())
                              .then((data) => {
                                const versions = Array.isArray(data?.versions) ? data.versions : [];
                                if (erpSelectedBrandId) {
                                  setCachedVersions(modelId, erpSelectedBrandId, versions);
                                }
                                setErpVersions(versions);
                              })
                              .catch(() => {
                                setErpVersions([]);
                              })
                              .finally(() => {
                                setErpVersionsLoading(false);
                              });
                          }}
                        >
                          <option value="">
                            {erpModelsLoading
                              ? t("sell.loadingModels")
                              : !erpSelectedBrandId
                                ? t("sell.firstSelectBrand")
                                : "Selecciona un modelo"}
                          </option>
                          {erpModels.map((model) => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                    <div className="field">
                      <label>
                        {t("sell.sellFlowAVersionLabel")} <span style={{ fontWeight: 300, textTransform: "none", letterSpacing: 0, color: "#ccc" }}>— {t("sell.optional")}</span>
                      </label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.erpVersionCode || ""}
                          disabled={!erpSelectedModelId || erpVersionsLoading || erpVersions.length === 0}
                          onChange={(event) => {
                            const versionCode = event.target.value;
                            const version = erpVersions.find((item) => String(item.codversion) === String(versionCode));
                            setSellAnswers((prev) => ({
                              ...prev,
                              version: version?.label || "",
                              erpVersionCode: versionCode,
                            }));
                          }}
                        >
                          <option value="">
                            {erpVersionsLoading
                              ? t("sell.loadingVersions")
                              : !erpSelectedModelId
                                ? t("sell.firstSelectModel")
                                : erpVersions.length === 0
                                  ? t("sell.noVersions")
                                  : "Selecciona una versión"}
                          </option>
                          {erpVersions.map((version) => (
                            <option key={version.codversion} value={version.codversion}>{version.label}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="field-grid-3">
                    <div className="field">
                      <label>{t("sell.sellFlowARegistrationLabel")}</label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.year || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, year: event.target.value }))}
                        >
                          <option value="">{t("sell.yearPlaceholder")}</option>
                          {yearOptions.map((year) => (
                            <option key={year} value={String(year)}>{year}</option>
                          ))}
                          <option value="anterior">{t("sell.yearOlder")}</option>
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                    <div className="field">
                      <label>{t("sell.sellFlowAMileageLabel")}</label>
                      <input
                        type="number"
                        placeholder={t("sell.placeholderMileage")}
                        value={sellAnswers?.mileage || ""}
                        onChange={(event) => setSellAnswers((prev) => ({ ...prev, mileage: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{t("sell.fuelLabel")}</label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.fuel || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, fuel: event.target.value }))}
                        >
                          <option value="">{t("sell.select")}</option>
                          {fuelOptions.map((fuel) => (
                            <option key={fuel} value={fuel}>{translateFuelOption(fuel)}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="field-grid-2" style={{ marginTop: "0.75rem" }}>
                    <div className="field">
                      <label>Propietarios anteriores <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.owners || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, owners: event.target.value }))}
                        >
                          <option value="">No indicar</option>
                          <option value="1">1 propietario</option>
                          <option value="2">2 propietarios</option>
                          <option value="3">3 o más</option>
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                    <div className="field">
                      <label>Historial de revisiones <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.serviceHistory || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, serviceHistory: event.target.value }))}
                        >
                          <option value="">No indicar</option>
                          <option value="oficial">Oficial completo</option>
                          <option value="parcial">Parcial o multimarca</option>
                          <option value="sin">Sin historial</option>
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="field-grid-2" style={{ marginTop: "0.75rem" }}>
                    <div className="field">
                      <label>Transmisión <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.transmission || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, transmission: event.target.value }))}
                        >
                          <option value="">Indiferente</option>
                          <option value="manual">Manual</option>
                          <option value="automatico">Automático</option>
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                    <div className="field">
                      <label>Color <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.color || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, color: event.target.value }))}
                        >
                          <option value="">No indicar</option>
                          <option value="blanco">Blanco</option>
                          <option value="negro">Negro</option>
                          <option value="plata">Plata / Gris claro</option>
                          <option value="gris">Gris oscuro</option>
                          <option value="azul">Azul</option>
                          <option value="rojo">Rojo</option>
                          <option value="verde">Verde</option>
                          <option value="marron">Marrón</option>
                          <option value="naranja">Naranja</option>
                          <option value="amarillo">Amarillo</option>
                          <option value="otro">Otro color</option>
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="field-grid-2" style={{ marginTop: "0.75rem" }}>
                    <div className="field">
                      <label>Potencia <span style={{ color: "#9ca3af", fontWeight: 400 }}>(CV, opcional)</span></label>
                      <input
                        type="number"
                        min="30"
                        max="2000"
                        placeholder="Ej: 120"
                        value={sellAnswers?.powerCv || ""}
                        onChange={(event) => setSellAnswers((prev) => ({ ...prev, powerCv: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Estado ITV <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.itvStatus || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, itvStatus: event.target.value }))}
                        >
                          <option value="">En regla / No sé</option>
                          <option value="pronto">Caduca en menos de 6 meses</option>
                          <option value="caducada">Ya ha caducado</option>
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="divider" />
                  <div className="field">
                    <label>{t("sell.sellFlowADamagesLabel")}</label>
                    <div className="damage-opts" style={{ marginTop: "0.2rem" }}>
                      {DAMAGE_OPTIONS.map((option) => {
                        const selected = (sellAnswers?.damageLevel || DAMAGE_OPTIONS[0]) === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`damage-opt${selected ? " sel" : ""}`}
                            onClick={() => setSellAnswers((prev) => ({ ...prev, damageLevel: option }))}
                          >
                            {t(option)}
                          </button>
                        );
                      })}
                    </div>
                    {(sellAnswers?.damageLevel && sellAnswers.damageLevel !== DAMAGE_OPTIONS[0]) && (
                      <div style={{ marginTop: "0.6rem" }}>
                        <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          Describe los daños con detalle <span style={{ color: "#9ca3af" }}>(opcional, mejora la tasación)</span>
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Ej: Arañazo en puerta trasera derecha, pequeño golpe en parachoques delantero..."
                          value={sellAnswers?.damageDescription || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, damageDescription: event.target.value }))}
                          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#374151", resize: "vertical", fontFamily: "inherit" }}
                        />
                      </div>
                    )}
                  </div>
                </>)}

                </div>
              </div>
            </div>

            <div className="step-block" ref={step2Ref}>
              <div className="step-left">
                <div className="step-circle">2</div>
              </div>
              <div className="step-right">
                <div className="step-label">PASO 2</div>
                <div className="step-title">Tu informe personalizado de tasación</div>
                <div className="step-desc">Recibes por email un informe completo con precio óptimo, histórico de mercado y recomendación de momento de venta — generado con los datos específicos de tu vehículo.</div>

                {/* What's included */}
                <div className="ref-box" style={{ marginTop: 14, marginBottom: 16 }}>
                  <div className="ref-title">Qué incluye el informe</div>
                  <div className="ref-feat">Precio medio actual del mercado para tu modelo exacto</div>
                  <div className="ref-feat">Comparativa por portales (Coches.net, AutoScout24, Milanuncios)</div>
                  <div className="ref-feat">Rango de precios mínimo y máximo</div>
                  <div className="ref-feat">Tiempo medio de venta en portales</div>
                  <div className="ref-feat">Recomendación de precio de salida para vender rápido</div>
                  <div className="ref-feat">Estrategia según el estado y daños declarados de tu coche</div>
                </div>

                {/* Blurred report preview */}
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Vista previa del informe</div>

                  {/* ── blurred content ── */}
                  <div style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#fff" }}>

                    {/* Veredicto de valor */}
                    <div style={{ background: "linear-gradient(180deg,#FFFDFA 0%,#FBF4E9 100%)", border: "1.5px solid #BA7517", borderRadius: "10px 10px 0 0", padding: "16px 18px 14px" }}>
                      <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#BA7517", fontWeight: 700, marginBottom: 6 }}>Precio óptimo de venta</div>
                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 38, fontWeight: 800, color: "#1C2B33", letterSpacing: "-0.02em", lineHeight: 1 }}>17.400 <span style={{ fontSize: 20 }}>€</span></div>
                          <div style={{ fontSize: 9, color: "#6B7780", marginTop: 4 }}>Basado en 248 comparables activos en portales</div>
                        </div>
                        <div style={{ textAlign: "center", borderLeft: "1px solid #EAD9BF", paddingLeft: 16 }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: "#137370", lineHeight: 1 }}>83%</div>
                          <div style={{ fontSize: 8, color: "#6B7780", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Confianza</div>
                        </div>
                      </div>
                      {/* Range bar */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ position: "relative", height: 10, borderRadius: 6, background: "linear-gradient(90deg,#E7EFEF 0%,#BBD9D6 40%,#BA7517 50%,#BBD9D6 60%,#E7EFEF 100%)" }}>
                          <div style={{ position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)", width: 3, height: 16, background: "#1C2B33", borderRadius: 2 }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#6B7780" }}>
                          <span>15.200 €</span>
                          <span style={{ color: "#BA7517", fontWeight: 700 }}>17.400 € óptimo</span>
                          <span>19.800 €</span>
                        </div>
                      </div>
                    </div>

                    {/* 3 KPIs */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 14px 0" }}>
                      {[
                        { n: "248", l: "Unidades en\nportales", color: "#137370" },
                        { n: "34 d.", l: "Tiempo medio\nde venta", color: "#137370" },
                        { n: "ALTO", l: "Nivel de\ndemanda", color: "#BA7517" },
                      ].map(({ n, l, color }) => (
                        <div key={l} style={{ border: "1px solid #ECEEF0", borderRadius: 10, padding: "10px 8px", textAlign: "center", background: "#fff" }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{n}</div>
                          <div style={{ fontSize: 8, color: "#6B7780", marginTop: 5, whiteSpace: "pre-line", lineHeight: 1.35 }}>{l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Portal table */}
                    <div style={{ margin: "12px 14px 0", borderRadius: 10, border: "1px solid #ECEEF0", overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", background: "#FAF7F2", borderBottom: "1px solid #ECE6DB", padding: "6px 12px" }}>
                        {["Portal", "Uds.", "Precio medio"].map((h) => (
                          <div key={h} style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA3AB", fontWeight: 700, textAlign: h === "Portal" ? "left" : "right" }}>{h}</div>
                        ))}
                      </div>
                      {[
                        { letter: "F", bg: "#16a34a", name: "Flexicar", units: 89, price: "17.200 €" },
                        { letter: "A", bg: "#2563eb", name: "Autohero", units: 74, price: "17.650 €" },
                        { letter: "C", bg: "#ea580c", name: "Coches.net", units: 51, price: "16.900 €" },
                        { letter: "W", bg: "#ca8a04", name: "Wallapop", units: 34, price: "15.800 €" },
                      ].map(({ letter, bg, name, units, price }, i, arr) => (
                        <div key={name} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", padding: "8px 12px", borderBottom: i < arr.length - 1 ? "1px solid #F0F0F0" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 10.5 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 4, background: bg, color: "#fff", fontWeight: 800, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{letter}</div>
                            {name}
                          </div>
                          <div style={{ fontSize: 9, color: "#9AA3AB", fontWeight: 600, textAlign: "right", paddingRight: 16 }}>{units} uds.</div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, textAlign: "right" }}>{price}</div>
                        </div>
                      ))}
                    </div>

                    {/* Histogram */}
                    <div style={{ margin: "12px 14px 0" }}>
                      <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9AA3AB", fontWeight: 700, marginBottom: 6 }}>Distribución de precios</div>
                      {[
                        { label: "14–15k", pct: 14, peak: false },
                        { label: "15–16k", pct: 38, peak: false },
                        { label: "16–17k", pct: 72, peak: false },
                        { label: "17–18k", pct: 100, peak: true },
                        { label: "18–19k", pct: 58, peak: false },
                        { label: "19–20k", pct: 22, peak: false },
                      ].map(({ label, pct, peak }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 44, fontSize: 8, color: "#46535C", fontWeight: 600, flexShrink: 0 }}>{label}</div>
                          <div style={{ flex: 1, height: 12, background: "#F4F4F5", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: peak ? "#BA7517" : "#137370", borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 3 strategy cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 14px 14px" }}>
                      {[
                        { tag: "Venta rápida", price: "15.200 €", days: "15–20 días", bg: "#F2F7F7", tc: "#137370", border: "#ECEEF0" },
                        { tag: "Equilibrado ★", price: "17.400 €", days: "30–40 días", bg: "#FBF4E9", tc: "#BA7517", border: "#BA7517" },
                        { tag: "Máximo valor", price: "19.800 €", days: "50–70 días", bg: "#F4F2F7", tc: "#5B4B8A", border: "#ECEEF0" },
                      ].map(({ tag, price, days, bg, tc, border }) => (
                        <div key={tag} style={{ border: `1.5px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ background: bg, padding: "8px 10px 6px" }}>
                            <div style={{ fontSize: 8, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, color: tc }}>{tag}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: tc, marginTop: 2, letterSpacing: "-0.01em" }}>{price}</div>
                          </div>
                          <div style={{ padding: "6px 10px 8px", borderTop: "1px solid #F0ECE3", fontSize: 8, color: "#46535C" }}>{days} estimados</div>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Overlay CTA */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 12, padding: "14px 20px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.13)", maxWidth: 240 }}>
                      <div style={{ fontSize: 20 }}>🔒</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1C2B33", marginTop: 4 }}>Datos reales de tu vehículo</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Solicita el informe para ver tu precio exacto, portales y estrategia personalizada</div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                  {fleetMode ? (() => {
                    const TIERS = [
                      { max: 1, price: 10 }, { max: 4, price: 9 }, { max: 9, price: 8 },
                      { max: 19, price: 7 }, { max: 49, price: 6 }, { max: 99, price: 5 },
                    ];
                    const selectedIds = Object.keys(fleetSelected).filter((id) => fleetSelected[id]);
                    const count = selectedIds.length;
                    const tier = TIERS.find((t) => count <= t.max);
                    const up = tier ? tier.price : null;
                    const total = up != null ? count * up : null;
                    if (!count) return <span style={{ fontSize: 13, color: "#9AA3AB" }}>Selecciona al menos un vehículo en el Paso 1 para continuar.</span>;
                    return (
                      <>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            disabled={fleetLoading}
                            onClick={async () => {
                              setFleetError("");
                              const missingFleet = await checkBillingProfile(currentUserEmail);
                              if (missingFleet.length) {
                                setFleetError("PROFILE_INCOMPLETE:" + missingFleet.join(","));
                                return;
                              }
                              setFleetLoading(true);
                              try {
                                const vehicles = selectedIds.map((id) => garageVehicles.find((v) => v.id === id)).filter(Boolean);
                                const { data } = await postBillingCheckoutJson({
                                  planId: "valuation_fleet",
                                  origin: window.location.origin,
                                  fleetVehicles: vehicles.map((v) => {
                                    const edits = fleetEdits[v.id] || {};
                                    return {
                                      brand:    edits.brand    || v.brand    || "",
                                      model:    edits.model    || v.model    || "",
                                      version:  edits.version  || v.version  || "",
                                      year:     edits.year     || v.year     || "",
                                      mileage:  edits.mileage  || v.mileage  || "",
                                      fuel:     edits.fuel     || v.fuel     || "",
                                      plate:    v.plate || "",
                                      location: edits.location || v.location || "",
                                      damageLevel: fleetDamages[v.id] || "Sin daños",
                                    };
                                  }),
                                });
                                if (data?.url) window.location.href = data.url;
                                else setFleetError(data?.error || "No se pudo iniciar el pago.");
                              } catch { setFleetError("Error al conectar con el sistema de pago."); }
                              finally { setFleetLoading(false); }
                            }}
                            style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: fleetLoading ? "not-allowed" : "pointer", opacity: fleetLoading ? 0.7 : 1 }}
                          >
                            {fleetLoading ? "Redirigiendo…" : `Tasar ${count} vehículo${count !== 1 ? "s" : ""} — ${total} €`}
                          </button>
                          <a href="/ejemplo-informe-tasacion.pdf" download="Ejemplo_Informe_Tasacion_CarsWise.pdf" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1.5px solid #0d9488", color: "#0d9488", background: "#fff", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>Ver ejemplo</a>
                        </div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{count} vehículo{count !== 1 ? "s" : ""} · {up} €/unidad · Entrega automática en menos de 5 minutos</span>
                        {fleetError && (
                          fleetError.startsWith("PROFILE_INCOMPLETE:") ? (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e", maxWidth: 460 }}>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                              <span>Para emitir la factura necesitas completar tu perfil ({fleetError.replace("PROFILE_INCOMPLETE:", "")}).{" "}<a href="/panel/cuenta" style={{ color: "#b45309", fontWeight: 700, textDecoration: "underline" }}>Ir a Mi cuenta →</a></span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: "#dc2626" }}>{fleetError}</span>
                        )}
                      </>
                    );
                  })() : (
                    <>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          disabled={checkoutLoading}
                          onClick={async () => {
                            setCheckoutError("");
                            const missingFields = await checkBillingProfile(currentUserEmail);
                            if (missingFields.length) {
                              setCheckoutError("PROFILE_INCOMPLETE:" + missingFields.join(","));
                              return;
                            }
                            setCheckoutLoading(true);
                            try {
                              const selectedVehicle = garageVehicles.find((v) => normalizeText(v?.id) === normalizeText(selectedIdCarId));
                              const { data } = await postBillingCheckoutJson({
                                planId: "valuation", origin: window.location.origin,
                                brand: sellAnswers?.brand || selectedVehicle?.brand || "",
                                model: sellAnswers?.model || selectedVehicle?.model || "",
                                version: sellAnswers?.version || selectedVehicle?.version || "",
                                year: sellAnswers?.year || selectedVehicle?.year || "",
                                mileage: sellAnswers?.mileage || selectedVehicle?.mileage || "",
                                fuel: sellAnswers?.fuel || selectedVehicle?.fuel || "",
                                transmission: sellAnswers?.transmission || "",
                                color: sellAnswers?.color || "",
                                owners: sellAnswers?.owners || "",
                                serviceHistory: sellAnswers?.serviceHistory || "",
                                powerCv: sellAnswers?.powerCv || "",
                                itvStatus: sellAnswers?.itvStatus || "",
                                plate: sellAnswers?.plate || selectedVehicle?.plate || "",
                                damageLevel: sellAnswers?.damageLevel || "",
                                damageDescription: sellAnswers?.damageDescription || "",
                                province: selectedVehicle?.province || selectedVehicle?.location || "",
                              });
                              if (data?.url) window.location.href = data.url;
                              else setCheckoutError(data?.error || "No se pudo iniciar el pago. Inténtalo de nuevo.");
                            } catch { setCheckoutError("Error al conectar con el sistema de pago."); }
                            finally { setCheckoutLoading(false); }
                          }}
                          style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: checkoutLoading ? "not-allowed" : "pointer", opacity: checkoutLoading ? 0.7 : 1 }}
                        >
                          {checkoutLoading ? "Redirigiendo…" : "Solicitar tasación — 10 €"}
                        </button>
                        <a href="/ejemplo-informe-tasacion.pdf" download="Ejemplo_Informe_Tasacion_CarsWise.pdf" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1.5px solid #0d9488", color: "#0d9488", background: "#fff", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>Ver ejemplo</a>
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Pago único · Entrega automática en menos de 5 minutos</span>
                      {checkoutError && (
                        checkoutError.startsWith("PROFILE_INCOMPLETE:") ? (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e", maxWidth: 460 }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                            <span>
                              Para emitir la factura necesitas completar tu perfil ({checkoutError.replace("PROFILE_INCOMPLETE:", "")}).{" "}
                              <a href="/panel/cuenta" style={{ color: "#b45309", fontWeight: 700, textDecoration: "underline" }}>Ir a Mi cuenta →</a>
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#dc2626" }}>{checkoutError}</span>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fleet section — removed, now integrated in Step 1 */}
      {false && (() => {
        const TIERS = [
          { max: 1,  price: 10 },
          { max: 4,  price: 9  },
          { max: 9,  price: 8  },
          { max: 19, price: 7  },
          { max: 49, price: 6  },
          { max: 99, price: 5  },
        ];
        function unitPrice(count) {
          const tier = TIERS.find((t) => count <= t.max);
          return tier ? tier.price : null;
        }
        const selectedIds = Object.keys(fleetSelected).filter((id) => fleetSelected[id]);
        const count = selectedIds.length;
        const up = unitPrice(count);
        const total = up != null ? count * up : null;

        return (
          <div style={{ margin: "16px 0", border: "1.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <button
              type="button"
              onClick={() => setFleetOpen((o) => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", gap: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🚗</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1C2B33" }}>Tasar toda tu flota</div>
                  <div style={{ fontSize: 12, color: "#6B7780" }}>Descuentos desde 2 vehículos · desde 9 €/unidad</div>
                </div>
              </div>
              <span style={{ fontSize: 18, color: "#6B7780", transform: fleetOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </button>

            {fleetOpen && (
              <div style={{ borderTop: "1px solid #f0f0f0", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Pricing table */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TIERS.map((t, i) => {
                    const label = i === 0 ? "1 veh." : i === TIERS.length - 1 ? `${TIERS[i-1].max + 1}–99` : `${TIERS[i-1].max + 1}–${t.max}`;
                    const active = count > 0 && unitPrice(count) === t.price;
                    return (
                      <div key={t.price} style={{ background: active ? "#0d9488" : "#f8f9fa", color: active ? "#fff" : "#46535C", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: active ? 700 : 400, border: `1px solid ${active ? "#0d9488" : "#e5e7eb"}` }}>
                        {label}: <strong>{t.price} €</strong>
                      </div>
                    );
                  })}
                  <div style={{ background: "#f8f9fa", color: "#46535C", borderRadius: 8, padding: "5px 10px", fontSize: 12, border: "1px solid #e5e7eb" }}>100+: <strong>comercial</strong></div>
                </div>

                {/* Vehicle list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                    <button type="button" onClick={() => {
                      const all = {};
                      garageVehicles.forEach((v) => { all[v.id] = true; });
                      setFleetSelected(all);
                    }} style={{ fontSize: 12, color: "#0d9488", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>Seleccionar todos</button>
                    <span style={{ color: "#e5e7eb" }}>·</span>
                    <button type="button" onClick={() => setFleetSelected({})} style={{ fontSize: 12, color: "#6B7780", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Limpiar</button>
                  </div>
                  {garageVehicles.map((v) => {
                    const checked = !!fleetSelected[v.id];
                    const label = [v.brand, v.model, v.year, v.plate ? `· ${v.plate}` : ""].filter(Boolean).join(" ");
                    return (
                      <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${checked ? "#0d9488" : "#e5e7eb"}`, background: checked ? "#f0fafa" : "#fafafa", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setFleetSelected((prev) => ({ ...prev, [v.id]: e.target.checked }))}
                          style={{ accentColor: "#0d9488", width: 16, height: 16 }}
                        />
                        <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: "#1C2B33", flex: 1 }}>{label || v.id}</span>
                        {v.mileage && <span style={{ fontSize: 11, color: "#9AA3AB" }}>{new Intl.NumberFormat("es-ES").format(v.mileage)} km</span>}
                      </label>
                    );
                  })}
                </div>

                {/* Summary + CTA */}
                {count > 0 && (
                  <div style={{ background: "#f8fffe", border: "1.5px solid #0d9488", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#46535C" }}>{count} vehículo{count !== 1 ? "s" : ""} · {up} €/unidad</div>
                      {total != null && <div style={{ fontSize: 22, fontWeight: 800, color: "#1C2B33" }}>{total} €</div>}
                    </div>
                    <button
                      type="button"
                      disabled={fleetLoading}
                      onClick={async () => {
                        setFleetError("");
                        const missingFleet2 = await checkBillingProfile(currentUserEmail);
                        if (missingFleet2.length) {
                          setFleetError("PROFILE_INCOMPLETE:" + missingFleet2.join(","));
                          return;
                        }
                        setFleetLoading(true);
                        try {
                          const vehicles = selectedIds.map((id) => garageVehicles.find((v) => v.id === id)).filter(Boolean);
                          const { data } = await postBillingCheckoutJson({
                            planId: "valuation_fleet",
                            origin: window.location.origin,
                            fleetVehicles: vehicles.map((v) => ({
                              id:      v.id,
                              brand:   v.brand   || "",
                              model:   v.model   || "",
                              version: v.version || "",
                              year:    v.year    || "",
                              mileage: v.mileage || "",
                              fuel:    v.fuel    || "",
                              plate:   v.plate   || "",
                              location: v.location || "",
                            })),
                          });
                          if (data?.url) {
                            window.location.href = data.url;
                          } else {
                            setFleetError(data?.error || "No se pudo iniciar el pago.");
                          }
                        } catch {
                          setFleetError("Error al conectar con el sistema de pago.");
                        } finally {
                          setFleetLoading(false);
                        }
                      }}
                      style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: fleetLoading ? "not-allowed" : "pointer", opacity: fleetLoading ? 0.7 : 1, whiteSpace: "nowrap" }}
                    >
                      {fleetLoading ? "Redirigiendo…" : `Tasar ${count} vehículo${count !== 1 ? "s" : ""} — ${total} €`}
                    </button>
                  </div>
                )}
                {fleetError && (
                  fleetError.startsWith("PROFILE_INCOMPLETE:") ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e", maxWidth: 460 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                      <span>Para emitir la factura necesitas completar tu perfil ({fleetError.replace("PROFILE_INCOMPLETE:", "")}).{" "}<a href="/panel/cuenta" style={{ color: "#b45309", fontWeight: 700, textDecoration: "underline" }}>Ir a Mi cuenta →</a></span>
                    </div>
                  ) : <span style={{ fontSize: 12, color: "#dc2626" }}>{fleetError}</span>
                )}
                <span style={{ fontSize: 11, color: "#9AA3AB" }}>Pago único · Recibirás un informe PDF por cada vehículo en menos de 5 minutos</span>
              </div>
            )}
          </div>
        );
      })()}

      {sellError ? <div className="sell-market-error">{sellError}</div> : null}

      {typeof onGoToBuyKnownModel === "function" ? (
        <div className="cta-card">
          <div className="cta-text">
            <strong>{t("sell.ctaTitle")}</strong>
            <span>{t("sell.ctaSubtitle")}</span>
          </div>
          <div className="cta-btns">
            <button className="btn-primary" type="button" onClick={onGoToBuyKnownModel}>
              {t("sell.ctaBtn")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
