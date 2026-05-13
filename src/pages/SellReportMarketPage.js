import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getErpBrandsJson,
  getErpModelsJson,
  getErpVersionsJson,
  getGarageVehicleSummariesJson,
} from "../utils/apiClient";
import "./SellReportMarketPage.css";

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
  const { t, i18n } = useTranslation();
  const [garageVehiclesLoading, setGarageVehiclesLoading] = useState(false);

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

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2013 }, (_, index) => currentYear - index);

  const normalizedYear = normalizeText(sellAnswers?.year).toLowerCase();
  const normalizedFuel = normalizeMatchToken(sellAnswers?.fuel);
  const normalizedDamageLevel = normalizeMatchToken(sellAnswers?.damageLevel);
  const vehicleYear = normalizedYear === "anterior"
    ? 2013
    : pickNumber(sellAnswers?.year, currentYear);
  const vehicleAge = Math.max(0, currentYear - vehicleYear);
  const vehicleMileage = pickNumber(sellAnswers?.mileage, 0);

  const fuelUnitsAdjust = normalizedFuel.includes("electric") || normalizedFuel.includes("electrico")
    ? -16
    : normalizedFuel.includes("phev")
      ? -8
      : normalizedFuel.includes("hybrid") || normalizedFuel.includes("hibrido")
        ? -4
        : normalizedFuel.includes("diesel")
          ? 8
          : 0;

  const fuelDaysAdjust = normalizedFuel.includes("electric") || normalizedFuel.includes("electrico")
    ? 10
    : normalizedFuel.includes("phev")
      ? 6
      : normalizedFuel.includes("hybrid") || normalizedFuel.includes("hibrido")
        ? -2
        : normalizedFuel.includes("diesel")
          ? 2
          : 0;

  const damageUnitsAdjust = normalizedDamageLevel.includes("major") || normalizedDamageLevel.includes("graves")
    ? -16
    : normalizedDamageLevel.includes("moderate") || normalizedDamageLevel.includes("moderados")
      ? -10
      : normalizedDamageLevel.includes("minor") || normalizedDamageLevel.includes("leves")
        ? -5
        : 0;

  const damageDaysAdjust = normalizedDamageLevel.includes("major") || normalizedDamageLevel.includes("graves")
    ? 18
    : normalizedDamageLevel.includes("moderate") || normalizedDamageLevel.includes("moderados")
      ? 11
      : normalizedDamageLevel.includes("minor") || normalizedDamageLevel.includes("leves")
        ? 5
        : 0;

  const derivedUnitsFromInputs = Math.max(
    10,
    Math.min(240, Math.round(170 - vehicleAge * 8 - vehicleMileage / 14000 + fuelUnitsAdjust + damageUnitsAdjust))
  );
  const derivedDaysFromInputs = Math.max(
    10,
    Math.min(140, Math.round(16 + vehicleAge * 2 + vehicleMileage / 18000 + fuelDaysAdjust + damageDaysAdjust))
  );

  const marketMean = pickNumber(sellEstimate?.targetPrice, 14850);
  const marketLow = pickNumber(sellEstimate?.lowPrice, 12200);
  const marketHigh = pickNumber(sellEstimate?.highPrice, 17500);
  const estimateUnits = pickNumber(sellEstimate?.similarUnits, derivedUnitsFromInputs);
  const aiUnits = pickNumber(
    sellAiResult?.argumentos_clave?.length ? 140 + sellAiResult.argumentos_clave.length * 12 : 0,
    0
  );
  const marketUnits = Math.max(
    10,
    Math.min(240, Math.round(estimateUnits * 0.45 + (aiUnits || derivedUnitsFromInputs) * 0.25 + derivedUnitsFromInputs * 0.3))
  );
  const marketDays = pickNumber(parseEstimatedDays(sellAiResult?.tiempo_estimado_venta), derivedDaysFromInputs);

  const damagePriceFactor = normalizedDamageLevel.includes("major") || normalizedDamageLevel.includes("graves")
    ? 0.84
    : normalizedDamageLevel.includes("moderate") || normalizedDamageLevel.includes("moderados")
      ? 0.91
      : normalizedDamageLevel.includes("minor") || normalizedDamageLevel.includes("leves")
        ? 0.97
        : 1;
  const damageUnitsFactor = normalizedDamageLevel.includes("major") || normalizedDamageLevel.includes("graves")
    ? 0.72
    : normalizedDamageLevel.includes("moderate") || normalizedDamageLevel.includes("moderados")
      ? 0.84
      : normalizedDamageLevel.includes("minor") || normalizedDamageLevel.includes("leves")
        ? 0.93
        : 1;
  const damageDaysFactor = normalizedDamageLevel.includes("major") || normalizedDamageLevel.includes("graves")
    ? 1.52
    : normalizedDamageLevel.includes("moderate") || normalizedDamageLevel.includes("moderados")
      ? 1.3
      : normalizedDamageLevel.includes("minor") || normalizedDamageLevel.includes("leves")
        ? 1.12
        : 1;

  const rawSnapshotMean = pickNumber(sellMarketSnapshot?.market?.mean, marketMean);
  const rawSnapshotLow = pickNumber(sellMarketSnapshot?.market?.p25, marketLow);
  const rawSnapshotHigh = pickNumber(sellMarketSnapshot?.market?.p75, marketHigh);
  const rawSnapshotUnits = pickNumber(sellMarketSnapshot?.comparables, marketUnits);
  const rawSnapshotDays = pickNumber(sellMarketSnapshot?.market?.daysOnMarketMedian, marketDays);

  const snapshotMean = Math.max(2500, Math.round(rawSnapshotMean * damagePriceFactor));
  const snapshotLowBase = Math.max(2200, Math.round(rawSnapshotLow * damagePriceFactor));
  const snapshotHighBase = Math.max(snapshotLowBase + 400, Math.round(rawSnapshotHigh * damagePriceFactor));
  const snapshotLow = Math.min(snapshotLowBase, snapshotHighBase - 200);
  const snapshotHigh = Math.max(snapshotLow + 200, snapshotHighBase);
  const snapshotUnits = Math.max(8, Math.round(rawSnapshotUnits * damageUnitsFactor));
  const snapshotDays = Math.max(8, Math.round(rawSnapshotDays * damageDaysFactor));
  const marketUpdatedAt = normalizeText(sellMarketSnapshot?.market?.updatedAt);
  const marketSource = normalizeText(sellMarketSnapshot?.source);
  const hasSnapshotPortals = Array.isArray(sellMarketSnapshot?.byPortal) && sellMarketSnapshot.byPortal.length > 0;
  const hasSnapshotMean = pickNumber(sellMarketSnapshot?.market?.mean, 0) > 0;
  const hasSnapshotUnits = pickNumber(sellMarketSnapshot?.comparables, 0) > 0;
  const hasRealMarketSnapshot = Boolean(sellMarketSnapshot?.ok) && (hasSnapshotPortals || hasSnapshotMean || hasSnapshotUnits);
  const updatedAtDate = marketUpdatedAt ? new Date(marketUpdatedAt) : null;
  const hasValidUpdatedAt = updatedAtDate instanceof Date && !Number.isNaN(updatedAtDate.getTime());
  const isEnglish = (i18n.resolvedLanguage || "").toLowerCase().startsWith("en");
  const estimatedReferenceText = isEnglish
    ? "Estimated reference (no live portal sample yet)."
    : "Referencia estimada (sin muestra real de portales todavía).";
  const realReferenceText = isEnglish
    ? "Live market reference from comparables."
    : "Referencia real obtenida de comparables de mercado.";
  const daySuffix = isEnglish ? "d" : "d.";

  const defaultPortalRows = [
    {
      key: "coches",
      icon: "C",
      iconColor: "#003087",
      name: "Coches.net",
      price: currencyEUR(Math.round(snapshotMean * 0.985), formatCurrency),
      units: Math.max(30, Math.round(snapshotUnits * 0.45)),
      toneClass: "blue",
    },
    {
      key: "autoscout",
      icon: "A",
      iconColor: "#ff6600",
      name: "AutoScout24",
      price: currencyEUR(Math.round(snapshotMean * 1.02), formatCurrency),
      units: Math.max(25, Math.round(snapshotUnits * 0.34)),
      toneClass: "",
    },
    {
      key: "milanuncios",
      icon: "M",
      iconColor: "#00a651",
      name: "Milanuncios",
      price: currencyEUR(Math.round(snapshotMean * 0.94), formatCurrency),
      units: Math.max(15, Math.round(snapshotUnits * 0.21)),
      toneClass: "green",
    },
  ];

  const snapshotPortalRows = Array.isArray(sellMarketSnapshot?.byPortal)
    ? sellMarketSnapshot.byPortal.slice(0, 3).map((item, index) => {
        const portalName = normalizeText(item?.portal) || `Portal ${index + 1}`;
        const initials = portalName.slice(0, 1).toUpperCase() || "P";
        const avgPrice = pickNumber(item?.avgPrice, 0);
        const units = pickNumber(item?.units, 0);
        const toneClass = index === 0 ? "blue" : index === 2 ? "green" : "";

        return {
          key: `${portalName}-${index}`,
          icon: initials,
          iconColor: index === 0 ? "#003087" : index === 1 ? "#ff6600" : "#00a651",
          name: portalName,
          price: avgPrice > 0 ? currencyEUR(avgPrice, formatCurrency) : t("sell.noPrice"),
          units,
          toneClass,
        };
      })
    : [];

  const portalRows = hasRealMarketSnapshot
    ? snapshotPortalRows
    : defaultPortalRows;

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

  const handleAnalyzeClick = () => {
    if (garageVehicles.length > 0 && !selectedIdCarId) {
      setIdCarPromptVisible(true);
      if (typeof idCarSelectRef.current?.focus === "function") {
        idCarSelectRef.current.focus();
      }
      if (typeof idCarSelectRef.current?.scrollIntoView === "function") {
        idCarSelectRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    setIdCarPromptVisible(false);
    analyzeSellWithAI();
  };

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
                  <div className="field-grid" style={{ marginBottom: "0.85rem" }}>
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
                  </div>

                  <div className="sell-market-inline-actions">
                    <button className="btn-secondary" type="button" onClick={handleAnalyzeClick} disabled={sellLoading}>
                      {sellLoading ? t("sell.loadingAnalyze") : t("sell.analyzeButton")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left">
                <div className="step-circle">2</div>
                <div className="step-connector" />
              </div>
              <div className="step-right">
                <div className="step-label">{t("sell.step2Label")}</div>
                <div className="step-title">{t("sell.step2Title")}</div>
                <div className="step-desc">{t("sell.step2Desc")}</div>
                <div className="sell-market-idcar-hint" style={{ marginTop: "0.35rem", marginBottom: "0.5rem" }}>
                  {hasRealMarketSnapshot ? realReferenceText : estimatedReferenceText}
                </div>
                <div className="result-section">
                  <div className="result-grid">
                    <div className="rstat">
                      <div className="rstat-num blue">{currencyEUR(snapshotMean, formatCurrency)}</div>
                      <div className="rstat-lbl">{t("sell.priceAverageLine1")}<br />{t("sell.priceAverageLine2")}</div>
                    </div>
                    <div className="rstat">
                      <div className="rstat-num grad-text">{snapshotUnits}</div>
                      <div className="rstat-lbl">{t("sell.unitsNowLine1")}<br />{t("sell.unitsNowLine2")}</div>
                    </div>
                    <div className="rstat">
                      <div className="rstat-num green">{snapshotDays} {daySuffix}</div>
                      <div className="rstat-lbl">{t("sell.timeOnMarketLine1")}<br />{t("sell.timeOnMarketLine2")}</div>
                    </div>
                  </div>

                  {portalRows.length > 0 ? (
                    <div className="portal-list">
                      {portalRows.map((portal) => (
                        <div key={portal.key} className="portal-row">
                          <div className="portal-name">
                            <div className="portal-ico" style={{ background: portal.iconColor }}>{portal.icon}</div>
                            {portal.name}
                          </div>
                          <div className="portal-right">
                            <span className={`portal-price ${portal.toneClass}`.trim()}>
                              {portal.price}
                            </span>
                            <span className="portal-units">· {portal.units} {t("sell.unitsAbbreviation")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="price-range">
                    <div className="pr-label">{t("sell.priceRangeLabel")}</div>
                    <div className="pr-range">
                      <span className="pr-val blue">{currencyEUR(snapshotLow, formatCurrency)}</span>
                      <span className="pr-sep">—</span>
                      <span className="pr-val green">{currencyEUR(snapshotHigh, formatCurrency)}</span>
                    </div>
                  </div>
                  <div className="sell-market-idcar-hint" style={{ marginTop: "0.75rem" }}>
                    {sellMarketSnapshotLoading
                      ? t("sell.loadingMarketComparables")
                      : sellMarketSnapshotError
                        ? `${t("sell.marketUnavailable")} ${sellMarketSnapshotError}`
                        : marketSource
                          ? `${t("sell.marketSource")} ${marketSource}${hasValidUpdatedAt ? ` · ${t("sell.marketUpdatedAt")} ${updatedAtDate.toLocaleString(i18n.resolvedLanguage || "es-ES")}` : ""}`
                          : t("sell.currentReference")}
                  </div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left">
                <div className="step-circle">3</div>
              </div>
              <div className="step-right">
                <div className="step-label">{t("sell.step3Label")}</div>
                <div className="step-title">{t("sell.step3Title")}</div>
                <div className="step-desc">{t("sell.step3Desc")}</div>
                <div className="ref-box">
                  <div className="ref-title">{t("sell.refTitle")}</div>
                  <div className="ref-feat">{t("sell.refFeat1")}</div>
                  <div className="ref-feat">{t("sell.refFeat2")}</div>
                  <div className="ref-feat">{t("sell.refFeat3")}</div>
                  <div className="ref-feat">{t("sell.refFeat4")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
