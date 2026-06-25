import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { writeCachedGarageVehicleCount } from "../../utils/storage";
import {
  getGarageVehiclesJson,
  postGarageVehicleAddJson,
  postGarageVehicleRemoveJson,
  postMaintenanceAddJson,
  postInsuranceUpsertJson,
  postVehicleStateUpsertJson,
  getErpBrandsJson,
  getErpModelsJson,
  getErpVersionsJson,
  getErpVersionDetailJson,
} from "../../utils/apiClient";

const GARAGE_STORAGE_PREFIX = "movilidad-advisor.userGarage.v1";
const IDCAR_PENDING_ACTION_KEY = "movilidad-advisor.idcar.action";
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAttachmentItem(input = {}) {
  let safeInput = input;

  if (typeof safeInput === "string") {
    try {
      safeInput = JSON.parse(safeInput);
    } catch {
      safeInput = { name: safeInput };
    }
  }

  if (!safeInput || typeof safeInput !== "object" || Array.isArray(safeInput)) {
    return null;
  }

  const normalized = {
    name: normalizeText(safeInput?.name || safeInput?.fileName),
    size: Number(safeInput?.size || 0),
    mimeType: normalizeText(safeInput?.mimeType || safeInput?.fileMimeType),
    contentBase64: normalizeText(safeInput?.contentBase64 || safeInput?.storageKey),
    previewUrl: normalizeText(safeInput?.previewUrl),
    url: normalizeText(safeInput?.url),
    src: normalizeText(safeInput?.src),
    imageUrl: normalizeText(safeInput?.imageUrl),
    path: normalizeText(safeInput?.path),
  };

  return normalized.name ? normalized : null;
}

function normalizeAttachmentCollection(input) {
  let safeInput = input;

  if (typeof safeInput === "string") {
    try {
      safeInput = JSON.parse(safeInput);
    } catch {
      safeInput = [];
    }
  }

  if (!Array.isArray(safeInput)) {
    if (safeInput && typeof safeInput === "object") {
      safeInput = [safeInput];
    } else {
      safeInput = [];
    }
  }

  return safeInput.map((item) => normalizeAttachmentItem(item)).filter(Boolean).slice(0, 30);
}

function normalizeVehicleAttachmentCollections(vehicle = {}) {
  if (!vehicle || typeof vehicle !== "object") {
    return null;
  }

  const initialMaintenance = vehicle?.initialMaintenance && typeof vehicle.initialMaintenance === "object" ? vehicle.initialMaintenance : {};

  return {
    ...vehicle,
    photos: normalizeAttachmentCollection(vehicle?.photos),
    documents: normalizeAttachmentCollection(vehicle?.documents),
    technicalSheetDocuments: normalizeAttachmentCollection(vehicle?.technicalSheetDocuments),
    circulationPermitDocuments: normalizeAttachmentCollection(vehicle?.circulationPermitDocuments),
    itvDocuments: normalizeAttachmentCollection(vehicle?.itvDocuments),
    insuranceDocuments: normalizeAttachmentCollection(vehicle?.insuranceDocuments),
    maintenanceInvoices: normalizeAttachmentCollection(vehicle?.maintenanceInvoices),
    initialMaintenance: {
      ...initialMaintenance,
      invoices: normalizeAttachmentCollection(initialMaintenance?.invoices),
    },
  };
}

function getVehicleStoredDocumentsCount(vehicle = {}) {
  const legacyDocuments = Array.isArray(vehicle?.documents) ? vehicle.documents.length : 0;
  const technicalSheetDocuments = Array.isArray(vehicle?.technicalSheetDocuments) ? vehicle.technicalSheetDocuments.length : 0;
  const circulationPermitDocuments = Array.isArray(vehicle?.circulationPermitDocuments) ? vehicle.circulationPermitDocuments.length : 0;
  const itvDocuments = Array.isArray(vehicle?.itvDocuments) ? vehicle.itvDocuments.length : 0;
  const insuranceDocuments = Array.isArray(vehicle?.insuranceDocuments) ? vehicle.insuranceDocuments.length : 0;
  const maintenanceInvoices = Array.isArray(vehicle?.maintenanceInvoices)
    ? vehicle.maintenanceInvoices.length
    : Array.isArray(vehicle?.initialMaintenance?.invoices)
      ? vehicle.initialMaintenance.invoices.length
      : 0;

  return legacyDocuments + technicalSheetDocuments + circulationPermitDocuments + itvDocuments + insuranceDocuments + maintenanceInvoices;
}

function getGarageStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${GARAGE_STORAGE_PREFIX}.${normalizedEmail}` : GARAGE_STORAGE_PREFIX;
}

function readGarageVehicles(currentUserEmail = "") {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getGarageStorageKey(currentUserEmail));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeVehicleAttachmentCollections(item)).filter((item) => item && item.id)
      : [];
  } catch {
    return [];
  }
}

async function fetchGarageVehiclesFromApi(currentUserEmail = "") {
  const { response, data } = await getGarageVehiclesJson(normalizeText(currentUserEmail).toLowerCase());

  if (!response.ok) {
    throw new Error("No se pudo leer el garage desde la API");
  }

  return Array.isArray(data?.vehicles) ? data.vehicles.map((item) => normalizeVehicleAttachmentCollections(item)).filter(Boolean) : [];
}

async function addGarageVehicleFromApi(currentUserEmail = "", vehicle = {}) {
  const { response, data } = await postGarageVehicleAddJson(normalizeText(currentUserEmail).toLowerCase(), vehicle);

  if (!response.ok) {
    throw new Error("No se pudo guardar el vehículo en la API");
  }

  return Array.isArray(data?.vehicles) ? data.vehicles.map((item) => normalizeVehicleAttachmentCollections(item)).filter(Boolean) : [];
}

async function removeGarageVehicleFromApi(currentUserEmail = "", vehicleId = "") {
  const { response, data } = await postGarageVehicleRemoveJson(normalizeText(currentUserEmail).toLowerCase(), vehicleId);

  if (!response.ok) {
    throw new Error("No se pudo eliminar el vehículo en la API");
  }

  return Array.isArray(data?.vehicles) ? data.vehicles.map((item) => normalizeVehicleAttachmentCollections(item)).filter(Boolean) : [];
}

function isLikelyBase64Payload(value = "") {
  const normalized = normalizeText(value).replace(/\s/g, "");
  if (!normalized || normalized.length < 64) {
    return false;
  }

  return /^[A-Za-z0-9+/=]+$/.test(normalized);
}

function resolvePhotoPreviewSrc(photo = {}) {
  const rawContent = normalizeText(photo?.contentBase64);
  const mimeType = normalizeText(photo?.mimeType || photo?.fileMimeType).toLowerCase() || "image/jpeg";

  if (rawContent) {
    if (rawContent.startsWith("data:image/")) {
      const payload = rawContent.split(",")[1] || "";
      return isLikelyBase64Payload(payload) ? rawContent : "";
    }

    if (isLikelyBase64Payload(rawContent)) {
      return `data:${mimeType};base64,${rawContent}`;
    }
  }

  const externalSource = [photo?.previewUrl, photo?.url, photo?.src, photo?.imageUrl, photo?.path]
    .map((candidate) => normalizeText(candidate))
    .find((candidate) => candidate);

  if (!externalSource) {
    return "";
  }

  if (externalSource.startsWith("http://") || externalSource.startsWith("https://") || externalSource.startsWith("data:image/") || externalSource.startsWith("blob:")) {
    return externalSource;
  }

  if (externalSource.startsWith("/")) {
    return externalSource;
  }

  return externalSource;
}

function resolveAttachmentLink(file = {}) {
  const pathLink = normalizeText(file?.path);
  if (pathLink) return pathLink;
  const urlLink = normalizeText(file?.url);
  if (urlLink) return urlLink;
  return "";
}

function fileToBase64DataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("No se pudo leer el fichero."));
    reader.readAsDataURL(file);
  });
}

async function filesToAttachmentPayload(files = []) {
  const safeFiles = Array.isArray(files) ? files : [];
  const payload = [];

  for (const file of safeFiles) {
    const name = normalizeText(file?.name);
    if (!name) {
      continue;
    }

    const size = Number(file?.size || 0);
    const mimeType = normalizeText(file?.type);
    const contentBase64 = size > 0 && size <= MAX_ATTACHMENT_BYTES
      ? (await fileToBase64DataUrl(file)).split(",")[1] || ""
      : "";

    payload.push({
      name,
      fileName: name,
      size,
      mimeType,
      contentBase64,
    });
  }

  return payload;
}

function writeGarageVehicles(currentUserEmail = "", items = []) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeItems = Array.isArray(items) ? items.slice(0, 20) : [];
    window.localStorage.setItem(getGarageStorageKey(currentUserEmail), JSON.stringify(safeItems));
    writeCachedGarageVehicleCount(safeItems.length);
    window.dispatchEvent(new CustomEvent("garageVehicleCountChanged", { detail: { count: safeItems.length } }));
  } catch {}
}

function resolveMarketplacePricingMode(vehicle = {}) {
  return normalizeText(vehicle?.marketplacePricingMode).toLowerCase() === "valuation" ? "valuation" : "manual";
}

export default function UserDashboardVehicles({
  themeMode,
  isMobile = false,
  userVehicleSections,
  dashboardVehicleCount,
  panelStyle,
  getOfferBadgeStyle,
  onRequestAppointment = () => {},
  onRequestValuation = () => {},
  onNavigate = () => {},
  onBrowseMarketplace = () => {},
  currentUserEmail = "",
}) {
  const { t } = useTranslation();
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const panelBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(59,130,246,0.34)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.3)";
  const elevatedShadow = isDark ? "0 18px 30px rgba(2,6,23,0.4)" : "0 14px 28px rgba(15,23,42,0.08)";
  const subtleShadow = isDark ? "0 8px 16px rgba(2,6,23,0.28)" : "0 8px 18px rgba(15,23,42,0.06)";
  const inputBg = isDark ? "#0f1b2d" : "#ffffff";
  const sectionFrame = {
    background: isDark ? "rgba(2,6,23,0.34)" : "rgba(248,250,252,0.86)",
    border: isDark ? "1px solid rgba(148,163,184,0.22)" : "1px solid rgba(148,163,184,0.24)",
    borderRadius: 14,
    boxShadow: isDark
      ? "0 14px 26px rgba(2,6,23,0.28)"
      : "0 10px 20px rgba(15,23,42,0.06)",
  };

  function mapErpTransmission(rawTx = "") {
    const v = String(rawTx).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (v.includes("auto") || v.includes("dsg") || v.includes("cvt") || v.includes("tiptronic")) return "automatico";
    if (v.includes("manual")) return "manual";
    return "";
  }

  function mapErpBodyType(c = "") {
    const v = String(c).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (v.includes("todoterreno") || v.includes("4x4")) return "todoterreno";
    if (v.includes("suv")) return "suv";
    if (v.includes("berlina")) return "berlina";
    if (v.includes("compacto") || v.includes("compacta")) return "compacto";
    if (v.includes("familiar") || v.includes("break") || v.includes("estate")) return "familiar";
    if (v.includes("coupe") || v.includes("coup")) return "coupe";
    if (v.includes("cabrio") || v.includes("descapotable") || v.includes("roadster")) return "cabrio";
    if (v.includes("monovolumen") || v.includes("mpv") || v.includes("minivan")) return "monovolumen";
    if (v.includes("pickup") || v.includes("pick-up")) return "pickup";
    if (v.includes("furgon") || v.includes("van")) return "furgoneta";
    return "";
  }

  const [erpBrands, setErpBrands] = useState([]);
  const [erpModels, setErpModels] = useState([]);
  const [erpVersions, setErpVersions] = useState([]);
  const [erpBrandsLoading, setErpBrandsLoading] = useState(false);
  const [erpModelsLoading, setErpModelsLoading] = useState(false);
  const [erpVersionsLoading, setErpVersionsLoading] = useState(false);
  const [erpSelectedBrandId, setErpSelectedBrandId] = useState("");
  const [erpSelectedModelId, setErpSelectedModelId] = useState("");
  const [vehicleCatalogMode, setVehicleCatalogMode] = useState("erp");
  const [editingVehicleId, setEditingVehicleId] = useState("");

  const [activeVehicleTab, setActiveVehicleTab] = useState("my-garage");
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [vehicleWorkspaceMode, setVehicleWorkspaceMode] = useState("list");
  const [managementVehicleId, setManagementVehicleId] = useState("");
  const [overriddenMarketplaceStates, setOverriddenMarketplaceStates] = useState({});
  const [failedPhotoVehicleIds, setFailedPhotoVehicleIds] = useState({});
  const [myVehicles, setMyVehicles] = useState(() => readGarageVehicles(currentUserEmail));
  const [vehicleFeedback, setVehicleFeedback] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [pendingTechnicalSheetDocuments, setPendingTechnicalSheetDocuments] = useState([]);
  const [pendingCirculationPermitDocuments, setPendingCirculationPermitDocuments] = useState([]);
  const [pendingIvtDocuments, setPendingIvtDocuments] = useState([]);
  const [pendingInsuranceDocuments, setPendingInsuranceDocuments] = useState([]);
  const [pendingMaintenanceInvoices, setPendingMaintenanceInvoices] = useState([]);

  // File input helper: filters oversized files and shows feedback
  const pickFiles = (setFn, maxMB = 10) => (event) => {
    const files = Array.from(event.target.files || []);
    const limit = maxMB * 1024 * 1024;
    const oversized = files.filter((f) => f.size > limit);
    const valid = files.filter((f) => f.size <= limit);
    if (oversized.length > 0) {
      setVehicleFeedback(`⚠️ ${oversized.map((f) => f.name).join(", ")} supera el límite de ${maxMB} MB y no se adjuntará.`);
    }
    setFn(valid);
  };
  const [isSaving, setIsSaving] = useState(false);
  const [marketplacePublishDialog, setMarketplacePublishDialog] = useState({ open: false, vehicle: null });
  const [expandedVehicleSections, setExpandedVehicleSections] = useState({
    characteristics: true,
    marketplace: false,
    vehicleDocuments: false,
    insurance: false,
    maintenance: false,
    notes: false,
  });
  const [vehicleForm, setVehicleForm] = useState({
    nickname: "",
    brand: "",
    model: "",
    version: "",
    transmissionType: "",
    cv: "",
    color: "",
    horsepower: "",
    seats: "",
    doors: "",
    location: "",
    bodyType: "",
    environmentalLabel: "",
    lastIvt: "",
    nextIvt: "",
    co2: "",
    price: "",
    marketplacePricingMode: "manual",
    year: "",
    plate: "",
    mileage: "",
    fuel: "",
    policyCompany: "",
    policyNumber: "",
    coverageType: "",
    maintenanceType: "",
    maintenanceTitle: "",
    maintenanceNotes: "",
    notes: "",
  });
  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const technicalSheetInputRef = useRef(null);
  const circulationPermitInputRef = useRef(null);
  const ivtInputRef = useRef(null);
  const insuranceDocumentsInputRef = useRef(null);
  const maintenanceInvoicesInputRef = useRef(null);
  const marketplacePublishTriggerRef = useRef(null);
  const marketplacePublishPrimaryButtonRef = useRef(null);
  const marketplacePublishDialogRef = useRef(null);
  const dragPhotoIdxRef = useRef(null);

  function updateEditingVehiclePhotos(newPhotos) {
    setMyVehicles((prev) =>
      prev.map((v) =>
        normalizeText(v?.id) === normalizeText(editingVehicleId) ? { ...v, photos: newPhotos } : v
      )
    );
  }
  function reorderStoredPhotos(fromIdx, toIdx) {
    const photos = Array.isArray(editingVehicle?.photos) ? [...editingVehicle.photos] : [];
    const [moved] = photos.splice(fromIdx, 1);
    photos.splice(toIdx, 0, moved);
    updateEditingVehiclePhotos(photos);
  }
  function setStoredPhotoAsPrimary(idx) {
    if (idx === 0) return;
    const photos = Array.isArray(editingVehicle?.photos) ? [...editingVehicle.photos] : [];
    const [photo] = photos.splice(idx, 1);
    updateEditingVehiclePhotos([photo, ...photos]);
  }
  function deleteStoredPhoto(idx) {
    const photos = Array.isArray(editingVehicle?.photos) ? [...editingVehicle.photos] : [];
    photos.splice(idx, 1);
    updateEditingVehiclePhotos(photos);
  }

  const safeSections = useMemo(() => (Array.isArray(userVehicleSections) ? userVehicleSections : []), [userVehicleSections]);
  const totalVehiclesCount = dashboardVehicleCount + myVehicles.length;

  const displayedVehicles = useMemo(() => {
    if (activeVehicleTab === "my-garage") return myVehicles;
    const section = safeSections.find((s) => s.key === activeVehicleTab);
    if (!section) return myVehicles;
    const sectionIds = new Set((section.items || []).map((item) => normalizeText(item?.id)).filter(Boolean));
    return myVehicles.filter((v) => sectionIds.has(normalizeText(v?.id)));
  }, [activeVehicleTab, myVehicles, safeSections]);

  useEffect(() => {
    let disposed = false;
    setErpBrandsLoading(true);
    getErpBrandsJson()
      .then((r) => r.json())
      .then((data) => { if (!disposed && Array.isArray(data?.brands)) setErpBrands(data.brands); })
      .catch(() => {})
      .finally(() => { if (!disposed) setErpBrandsLoading(false); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let disposed = false;

    const hydrateVehicles = async () => {
      const localVehicles = readGarageVehicles(currentUserEmail);
      if (!disposed) {
        setMyVehicles(localVehicles);
      }

      try {
        const apiVehicles = await fetchGarageVehiclesFromApi(currentUserEmail);
        if (!disposed && Array.isArray(apiVehicles)) {
          setMyVehicles(apiVehicles);
        }
      } catch {
        // Keep local fallback when API is unavailable.
      }
    };

    void hydrateVehicles();
    return () => {
      disposed = true;
    };
  }, [currentUserEmail]);

  useEffect(() => {
    writeGarageVehicles(currentUserEmail, myVehicles);
  }, [currentUserEmail, myVehicles]);

  useEffect(() => {
    if (activeVehicleTab === "overview" || activeVehicleTab === "my-garage") {
      return;
    }

    const exists = safeSections.some((section) => section.key === activeVehicleTab);
    if (!exists) {
      setActiveVehicleTab("overview");
    }
  }, [activeVehicleTab, safeSections]);

  useEffect(() => {
    if (!marketplacePublishDialog.open) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMarketplacePublishDialog();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = marketplacePublishDialogRef.current;
      if (!dialog || typeof document === "undefined") {
        return;
      }

      const focusableSelector = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
      const focusableElements = Array.from(dialog.querySelectorAll(focusableSelector)).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true"
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const activeInsideDialog = activeElement && dialog.contains(activeElement);

      if (event.shiftKey) {
        if (!activeInsideDialog || activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (!activeInsideDialog || activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [marketplacePublishDialog.open]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!marketplacePublishDialog.open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [marketplacePublishDialog.open]);

  useEffect(() => {
    if (!marketplacePublishDialog.open) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      marketplacePublishPrimaryButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [marketplacePublishDialog.open]);

  const selectedSection = safeSections.find((section) => section.key === activeVehicleTab) || null;

  const vehSectionTitleMap = {
    "owned": t("dashboard.vehTabBought"),
    "sold": t("dashboard.vehTabSold"),
    "active-sale": t("dashboard.vehTabActiveSale"),
  };
  const vehicleTabs = [
    {
      key: "my-garage",
      title: t("dashboard.vehMyVehicles"),
      count: myVehicles.length,
    },
    ...safeSections.map((section) => ({
      key: section.key,
      title: vehSectionTitleMap[section.key] || section.title,
      count: Array.isArray(section.items) ? section.items.length : 0,
    })),
  ];

  const lifecycleTotals = safeSections.reduce(
    (acc, section) => {
      const size = Array.isArray(section.items) ? section.items.length : 0;

      if (section.key === "owned") {
        acc.owned += size;
      } else if (section.key === "active-sale") {
        acc.activeSale += size;
      } else if (section.key === "sold") {
        acc.sold += size;
      }

      return acc;
    },
    { owned: 0, activeSale: 0, sold: 0 }
  );

  const editingVehicle = editingVehicleId
    ? myVehicles.find((item) => normalizeText(item?.id) === normalizeText(editingVehicleId)) || null
    : null;

  const storedPhotosCount = Array.isArray(editingVehicle?.photos) ? editingVehicle.photos.length : 0;
  const storedLegacyDocumentsCount = Array.isArray(editingVehicle?.documents) ? editingVehicle.documents.length : 0;
  const storedTechnicalSheetDocumentsCount = Array.isArray(editingVehicle?.technicalSheetDocuments) ? editingVehicle.technicalSheetDocuments.length : 0;
  const storedCirculationPermitDocumentsCount = Array.isArray(editingVehicle?.circulationPermitDocuments) ? editingVehicle.circulationPermitDocuments.length : 0;
  const storedItvDocumentsCount = Array.isArray(editingVehicle?.itvDocuments) ? editingVehicle.itvDocuments.length : 0;
  const storedInsuranceDocumentsCount = Array.isArray(editingVehicle?.insuranceDocuments) ? editingVehicle.insuranceDocuments.length : 0;
  const storedMaintenanceInvoicesCount = Array.isArray(editingVehicle?.maintenanceInvoices)
    ? editingVehicle.maintenanceInvoices.length
    : Array.isArray(editingVehicle?.initialMaintenance?.invoices)
      ? editingVehicle.initialMaintenance.invoices.length
      : 0;

  const storedVehicleDocumentsEditorCount =
    storedPhotosCount +
    storedLegacyDocumentsCount +
    storedTechnicalSheetDocumentsCount +
    storedCirculationPermitDocumentsCount +
    storedItvDocumentsCount;

  const storedPhotos = Array.isArray(editingVehicle?.photos) ? editingVehicle.photos : [];
  const storedLegacyDocuments = Array.isArray(editingVehicle?.documents) ? editingVehicle.documents : [];
  const storedTechnicalSheetDocuments = Array.isArray(editingVehicle?.technicalSheetDocuments) ? editingVehicle.technicalSheetDocuments : [];
  const storedCirculationPermitDocuments = Array.isArray(editingVehicle?.circulationPermitDocuments) ? editingVehicle.circulationPermitDocuments : [];
  const storedItvDocuments = Array.isArray(editingVehicle?.itvDocuments) ? editingVehicle.itvDocuments : [];
  const storedInsuranceDocuments = Array.isArray(editingVehicle?.insuranceDocuments) ? editingVehicle.insuranceDocuments : [];
  const storedMaintenanceInvoices = Array.isArray(editingVehicle?.maintenanceInvoices)
    ? editingVehicle.maintenanceInvoices
    : Array.isArray(editingVehicle?.initialMaintenance?.invoices)
      ? editingVehicle.initialMaintenance.invoices
      : [];

  const renderStoredAttachmentPreview = (files = []) => {
    if (!Array.isArray(files) || files.length === 0) {
      return null;
    }

    return (
      <div style={{ border: cardBorder, borderRadius: 10, background: isDark ? "rgba(15,23,42,0.36)" : "#ffffff", padding: "8px 10px" }}>
        <div style={{ fontSize: 10.5, color: bodyColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          {t("dashboard.vehSavedInFile")}
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {files.slice(0, 3).map((file, index) => {
            const link = resolveAttachmentLink(file);
            const name = normalizeText(file?.name) || `Archivo ${index + 1}`;
            return (
              <div key={`${name}-${index}`} style={{ fontSize: 11.5, color: bodyColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                • {link
                  ? <a href={link} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>{name}</a>
                  : name}
              </div>
            );
          })}
          {files.length > 3 ? <div style={{ fontSize: 11, color: bodyColor }}>+{t("dashboard.vehMoreFiles", { count: files.length - 3 }).replace("+", "")}</div> : null}
        </div>
      </div>
    );
  };

  const updateVehicleForm = (field, value) => {
    setVehicleForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleVehicleSection = (sectionKey) => {
    setExpandedVehicleSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const renderVehicleSection = (sectionKey, title, children, meta = "") => {
    const isOpen = Boolean(expandedVehicleSections[sectionKey]);

    return (
      <div
        style={{
          display: "grid",
          gap: 10,
          border: cardBorder,
          borderRadius: 12,
          background: isDark ? "rgba(15,23,42,0.4)" : "rgba(255,255,255,0.7)",
          padding: 12,
          marginTop: 10,
        }}
      >
        <button
          type="button"
          onClick={() => toggleVehicleSection(sectionKey)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: titleColor }}>{title}</div>
            {meta ? <div style={{ fontSize: 11, color: bodyColor, marginTop: 3 }}>{meta}</div> : null}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", background: "rgba(37,99,235,0.1)", border: cardBorder, borderRadius: 999, padding: "4px 8px" }}>
            {isOpen ? t("dashboard.vehSectionHide") : t("dashboard.vehSectionOpen")}
          </span>
        </button>
        {isOpen ? children : null}
      </div>
    );
  };

  const addVehicleToGarage = async () => {
    if (isSaving) return;

    const brand = normalizeText(vehicleForm.brand);
    const model = normalizeText(vehicleForm.model);
    const version = normalizeText(vehicleForm.version);

    if (!brand || !model || !version) {
      setVehicleFeedback(t("dashboard.vehRequiredFields"));
      return;
    }

    setIsSaving(true);

    const nickname = normalizeText(vehicleForm.nickname);
    const title = nickname || `${brand} ${model} ${version}`.trim();

    const photosPayload = await filesToAttachmentPayload(pendingPhotos);
    const documentsPayload = await filesToAttachmentPayload(pendingDocuments);
    const technicalSheetDocumentsPayload = await filesToAttachmentPayload(pendingTechnicalSheetDocuments);
    const circulationPermitDocumentsPayload = await filesToAttachmentPayload(pendingCirculationPermitDocuments);
    const itvDocumentsPayload = await filesToAttachmentPayload(pendingIvtDocuments);
    const insuranceDocumentsPayload = await filesToAttachmentPayload(pendingInsuranceDocuments);
    const maintenanceInvoicesPayload = await filesToAttachmentPayload(pendingMaintenanceInvoices);

    const existingVehicle = editingVehicleId
      ? myVehicles.find((item) => normalizeText(item?.id) === normalizeText(editingVehicleId)) || null
      : null;

    const vehicle = {
      id: existingVehicle?.id || `garage-${Date.now()}`,
      title,
      brand,
      model,
      version,
      transmissionType: normalizeText(vehicleForm.transmissionType),
      cv: normalizeText(vehicleForm.cv),
      color: normalizeText(vehicleForm.color),
      horsepower: normalizeText(vehicleForm.horsepower),
      seats: normalizeText(vehicleForm.seats),
      doors: normalizeText(vehicleForm.doors),
      location: normalizeText(vehicleForm.location),
      bodyType: normalizeText(vehicleForm.bodyType),
      environmentalLabel: normalizeText(vehicleForm.environmentalLabel),
      lastIvt: normalizeText(vehicleForm.lastIvt),
      nextIvt: normalizeText(vehicleForm.nextIvt),
      co2: normalizeText(vehicleForm.co2),
      price: normalizeText(vehicleForm.price),
      marketplacePricingMode: normalizeText(vehicleForm.marketplacePricingMode || "manual").toLowerCase() === "valuation" ? "valuation" : "manual",
      year: normalizeText(vehicleForm.year),
      plate: normalizeText(vehicleForm.plate),
      mileage: normalizeText(vehicleForm.mileage),
      fuel: normalizeText(vehicleForm.fuel),
      policyCompany: normalizeText(vehicleForm.policyCompany),
      policyNumber: normalizeText(vehicleForm.policyNumber),
      coverageType: normalizeText(vehicleForm.coverageType),
      notes: normalizeText(vehicleForm.notes),
      photos: [...(Array.isArray(existingVehicle?.photos) ? existingVehicle.photos : []), ...photosPayload],
      documents: [...(Array.isArray(existingVehicle?.documents) ? existingVehicle.documents : []), ...documentsPayload],
      technicalSheetDocuments: [...(Array.isArray(existingVehicle?.technicalSheetDocuments) ? existingVehicle.technicalSheetDocuments : []), ...technicalSheetDocumentsPayload],
      circulationPermitDocuments: [...(Array.isArray(existingVehicle?.circulationPermitDocuments) ? existingVehicle.circulationPermitDocuments : []), ...circulationPermitDocumentsPayload],
      itvDocuments: [...(Array.isArray(existingVehicle?.itvDocuments) ? existingVehicle.itvDocuments : []), ...itvDocumentsPayload],
      insuranceDocuments: [...(Array.isArray(existingVehicle?.insuranceDocuments) ? existingVehicle.insuranceDocuments : []), ...insuranceDocumentsPayload],
      maintenanceInvoices: [...(Array.isArray(existingVehicle?.maintenanceInvoices) ? existingVehicle.maintenanceInvoices : []), ...maintenanceInvoicesPayload],
      initialMaintenance: {
        type: normalizeText(vehicleForm.maintenanceType || "maintenance"),
        title: normalizeText(vehicleForm.maintenanceTitle),
        notes: normalizeText(vehicleForm.maintenanceNotes),
        invoices: Array.isArray(existingVehicle?.initialMaintenance?.invoices) ? existingVehicle.initialMaintenance.invoices : [],
      },
      createdAt: existingVehicle?.createdAt || new Date().toISOString(),
    };

    let nextVehicles = existingVehicle
      ? myVehicles.map((item) => (normalizeText(item?.id) === vehicle.id ? vehicle : item))
      : [vehicle, ...myVehicles].slice(0, 20);
    let apiSaveOk = false;
    let sideCallWarning = "";

    try {
      nextVehicles = await addGarageVehicleFromApi(currentUserEmail, vehicle);
      apiSaveOk = true;
    } catch {
      // Fallback to local state/localStorage when API is unavailable.
    }

    if (currentUserEmail && apiSaveOk) {
      const maintenanceTitle = normalizeText(vehicle.initialMaintenance?.title);
      if (maintenanceTitle) {
        try {
          await postMaintenanceAddJson(currentUserEmail, {
            vehicleId: vehicle.id,
            type: normalizeText(vehicle.initialMaintenance?.type) || "maintenance",
            title: maintenanceTitle,
            notes: normalizeText(vehicle.initialMaintenance?.notes),
            status: "pendiente",
          });
        } catch {
          sideCallWarning = " (aviso: no se pudo guardar el mantenimiento)";
        }
      }

      const policyCompany = normalizeText(vehicle.policyCompany);
      const policyNumber = normalizeText(vehicle.policyNumber);
      if (policyCompany || policyNumber) {
        try {
          await postInsuranceUpsertJson(currentUserEmail, {
            vehicleId: vehicle.id,
            policyCompany,
            policyNumber,
            coverageType: normalizeText(vehicle.coverageType),
            status: "activo",
          });
        } catch {
          sideCallWarning = " (aviso: no se pudo guardar el seguro)";
        }
      }
    }

    setMyVehicles(Array.isArray(nextVehicles) ? nextVehicles : [vehicle, ...myVehicles].slice(0, 20));
    setIsSaving(false);
    setEditingVehicleId("");
    setShowNewVehicleForm(false);
    setVehicleWorkspaceMode("list");
    setManagementVehicleId("");
    setErpSelectedBrandId("");
    setErpSelectedModelId("");
    setErpModels([]);
    setErpVersions([]);
    setVehicleForm({
      nickname: "",
      brand: "",
      model: "",
      version: "",
      transmissionType: "",
      cv: "",
      color: "",
      horsepower: "",
      seats: "",
      doors: "",
      location: "",
      bodyType: "",
      environmentalLabel: "",
      lastIvt: "",
      nextIvt: "",
      co2: "",
      price: "",
      marketplacePricingMode: "manual",
      year: "",
      plate: "",
      mileage: "",
      fuel: "",
      policyCompany: "",
      policyNumber: "",
      coverageType: "",
      maintenanceType: "",
      maintenanceTitle: "",
      maintenanceNotes: "",
      notes: "",
    });
    setPendingPhotos([]);
    setPendingDocuments([]);
    setPendingTechnicalSheetDocuments([]);
    setPendingCirculationPermitDocuments([]);
    setPendingIvtDocuments([]);
    setPendingInsuranceDocuments([]);
    setPendingMaintenanceInvoices([]);
    const baseMsg = existingVehicle ? t("dashboard.vehSavedUpdated", { title }) : t("dashboard.vehSavedNew", { title });
    const localFallbackSuffix = !apiSaveOk ? " (guardado localmente, sin conexión con servidor)" : "";
    setVehicleFeedback(baseMsg + localFallbackSuffix + sideCallWarning);
  };

  const startEditingVehicle = (vehicle = {}) => {
    const vehicleId = normalizeText(vehicle?.id);
    if (!vehicleId) {
      return;
    }

    setEditingVehicleId(vehicleId);
    setShowNewVehicleForm(true);
    setVehicleWorkspaceMode("editor");
    setManagementVehicleId("");
    setVehicleCatalogMode("manual");
    setErpSelectedBrandId("");
    setErpSelectedModelId("");
    setErpModels([]);
    setErpVersions([]);
    setPendingPhotos([]);
    setPendingDocuments([]);
    setPendingTechnicalSheetDocuments([]);
    setPendingCirculationPermitDocuments([]);
    setPendingIvtDocuments([]);
    setPendingInsuranceDocuments([]);
    setPendingMaintenanceInvoices([]);
    setVehicleForm({
      nickname: normalizeText(vehicle?.title),
      brand: normalizeText(vehicle?.brand),
      model: normalizeText(vehicle?.model),
      version: normalizeText(vehicle?.version),
      transmissionType: normalizeText(vehicle?.transmissionType),
      cv: normalizeText(vehicle?.cv),
      color: normalizeText(vehicle?.color),
      horsepower: normalizeText(vehicle?.horsepower),
      seats: normalizeText(vehicle?.seats),
      doors: normalizeText(vehicle?.doors),
      location: normalizeText(vehicle?.location),
      bodyType: normalizeText(vehicle?.bodyType),
      environmentalLabel: normalizeText(vehicle?.environmentalLabel),
      lastIvt: normalizeText(vehicle?.lastIvt),
      nextIvt: normalizeText(vehicle?.nextIvt),
      co2: normalizeText(vehicle?.co2),
      price: normalizeText(vehicle?.price),
      marketplacePricingMode: normalizeText(vehicle?.marketplacePricingMode || "manual").toLowerCase() === "valuation" ? "valuation" : "manual",
      year: normalizeText(vehicle?.year),
      plate: normalizeText(vehicle?.plate),
      mileage: normalizeText(vehicle?.mileage),
      fuel: normalizeText(vehicle?.fuel),
      policyCompany: normalizeText(vehicle?.policyCompany),
      policyNumber: normalizeText(vehicle?.policyNumber),
      coverageType: normalizeText(vehicle?.coverageType),
      maintenanceType: "",
      maintenanceTitle: "",
      maintenanceNotes: "",
      notes: normalizeText(vehicle?.notes),
    });

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    setVehicleFeedback(`Editando ${normalizeText(vehicle?.title || `${vehicle?.brand || ""} ${vehicle?.model || ""}`) || "vehículo"}. Pulsa Guardar cambios para confirmar.`);
  };

  const cancelEditingVehicle = () => {
    setEditingVehicleId("");
    setShowNewVehicleForm(false);
    setVehicleWorkspaceMode("list");
    setVehicleCatalogMode("erp");
    setErpSelectedBrandId("");
    setErpSelectedModelId("");
    setErpModels([]);
    setErpVersions([]);
    setPendingPhotos([]);
    setPendingDocuments([]);
    setPendingTechnicalSheetDocuments([]);
    setPendingCirculationPermitDocuments([]);
    setPendingIvtDocuments([]);
    setPendingInsuranceDocuments([]);
    setPendingMaintenanceInvoices([]);
    setVehicleFeedback("Edición cancelada.");
  };

  const removeVehicleFromGarage = async (vehicleId) => {
    let nextVehicles = myVehicles.filter((vehicle) => vehicle.id !== vehicleId);

    try {
      nextVehicles = await removeGarageVehicleFromApi(currentUserEmail, vehicleId);
    } catch {
      // Fallback to local state/localStorage when API is unavailable.
    }

    setMyVehicles(Array.isArray(nextVehicles) ? nextVehicles : []);
    if (managementVehicleId === vehicleId) {
      setManagementVehicleId("");
    }
    setVehicleFeedback(t("dashboard.vehFeedbackDeleted"));
  };

  const startCreatingVehicle = useCallback(() => {
    setEditingVehicleId("");
    setShowNewVehicleForm(true);
    setVehicleWorkspaceMode("editor");
    setManagementVehicleId("");
    setVehicleCatalogMode("erp");
    setVehicleFeedback("Completa los apartados y guarda tu nuevo vehículo.");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pendingAction = normalizeText(window.sessionStorage.getItem(IDCAR_PENDING_ACTION_KEY)).toLowerCase();

    if (!pendingAction) {
      return;
    }

    window.sessionStorage.removeItem(IDCAR_PENDING_ACTION_KEY);
    setActiveVehicleTab("my-garage");

    if (pendingAction === "create") {
      startCreatingVehicle();
      return;
    }

    if (pendingAction === "manage") {
      setShowNewVehicleForm(false);
      setVehicleWorkspaceMode("list");
      setManagementVehicleId("");
      setVehicleFeedback("Gestiona tus IDCars desde tu garage.");
    }
  }, [startCreatingVehicle]);

  const requestValuationForVehicle = (vehicle = {}, feedbackPrefix = "Tasación iniciada para") => {
    const vehicleTitle = normalizeText(vehicle?.title || `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim());
    const vehiclePlate = normalizeText(vehicle?.plate);

    onRequestValuation({
      vehicleId: normalizeText(vehicle?.id),
      vehicleTitle,
      vehiclePlate,
      brand: normalizeText(vehicle?.brand),
      model: normalizeText(vehicle?.model),
      year: normalizeText(vehicle?.year),
      mileage: normalizeText(vehicle?.mileage),
      fuel: normalizeText(vehicle?.fuel),
    });

    const vehicleLabel = vehiclePlate ? `matrícula ${vehiclePlate}` : vehicleTitle || "tu vehículo";
    setVehicleFeedback(`${feedbackPrefix} ${vehicleLabel}.`);
  };

  const closeMarketplacePublishDialog = () => {
    setMarketplacePublishDialog({ open: false, vehicle: null });

    const trigger = marketplacePublishTriggerRef.current;
    if (trigger && typeof trigger.focus === "function" && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        trigger.focus();
      });
    }

    marketplacePublishTriggerRef.current = null;
  };

  const confirmMarketplacePublish = () => {
    const vehicle = marketplacePublishDialog.vehicle;
    if (!vehicle) {
      closeMarketplacePublishDialog();
      return;
    }

    const vehicleLabel = vehicle.title || `${vehicle.brand || "Vehículo"} ${vehicle.model || ""}`.trim();
    const pricingMode = resolveMarketplacePricingMode(vehicle);
    const marketplacePrice = normalizeText(vehicle.price);

    if (pricingMode === "valuation" && !marketplacePrice) {
      requestValuationForVehicle(vehicle, `Antes de publicar ${vehicleLabel}, hemos iniciado la tasación para`);
      closeMarketplacePublishDialog();
      return;
    }

    if (pricingMode === "manual" && !marketplacePrice) {
      setVehicleFeedback(`Para publicar ${vehicleLabel} debes indicar un precio o cambiar a modo tasación.`);
      closeMarketplacePublishDialog();
      return;
    }

    onBrowseMarketplace({
      brand: vehicle.brand,
      model: vehicle.model,
      fuel: vehicle.fuel,
    });

    if (currentUserEmail && normalizeText(vehicle.id)) {
      setOverriddenMarketplaceStates((s) => ({ ...s, [vehicle.id]: "active_sale" }));
      postVehicleStateUpsertJson(currentUserEmail, {
        vehicleId: vehicle.id,
        state: "active_sale",
        notes: `Precio publicado: ${marketplacePrice} EUR`,
      }).catch(() => {
        setOverriddenMarketplaceStates((s) => ({ ...s, [vehicle.id]: "owned" }));
        setVehicleFeedback("⚠️ El vehículo se buscó en el marketplace pero no se pudo guardar el estado de publicación. Recarga para verificar.");
      });
    }

    setVehicleFeedback(`Vehículo ${vehicleLabel} preparado para marketplace con precio ${marketplacePrice} EUR.`);
    closeMarketplacePublishDialog();
  };

  const handleVehicleAction = (action, vehicle, triggerElement = null) => {
    const vehicleLabel = vehicle?.title || `${vehicle?.brand || "Vehículo"} ${vehicle?.model || ""}`.trim();

    if (action === "appointment") {
      onRequestAppointment("workshop", {
        vehicleId: normalizeText(vehicle?.id),
        vehicleTitle: vehicleLabel,
      });
      setVehicleFeedback(`Cita solicitada para ${vehicleLabel}.`);
      return;
    }

    if (action === "valuation") {
      requestValuationForVehicle(vehicle);
      return;
    }

    if (action === "marketplace") {
      marketplacePublishTriggerRef.current = triggerElement && typeof triggerElement.focus === "function" ? triggerElement : null;

      setMarketplacePublishDialog({
        open: true,
        vehicle: {
          id: normalizeText(vehicle?.id),
          title: vehicleLabel,
          brand: normalizeText(vehicle?.brand),
          model: normalizeText(vehicle?.model),
          year: normalizeText(vehicle?.year),
          mileage: normalizeText(vehicle?.mileage),
          plate: normalizeText(vehicle?.plate),
          fuel: normalizeText(vehicle?.fuel),
          price: normalizeText(vehicle?.price),
          marketplacePricingMode: resolveMarketplacePricingMode(vehicle),
        },
      });
      return;
    }

    if (action === "insurance") {
      setVehicleFeedback(`Gestión de seguro iniciada para ${vehicleLabel}.`);
      startEditingVehicle(vehicle);
      // Expand the insurance section in the editor
      setExpandedVehicleSections((prev) => ({ ...prev, insurance: true }));
    }
  };

  return (
    <section id="user-dashboard-vehicles" style={{ ...panelStyle, ...sectionFrame, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#34d399", letterSpacing: "0.6px" }}>{t("dashboard.vehSectionLabel")}</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleColor }}>{t("dashboard.vehTitle")}</div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            {t("dashboard.vehDesc")}
          </div>
        </div>
        <span style={{ ...getOfferBadgeStyle("green"), fontSize: 11 }}>
          {t("dashboard.vehRegistros", { count: totalVehiclesCount })}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        {vehicleTabs.map((tab) => {
          const count = Number(tab.count || 0);
          const isActive = activeVehicleTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveVehicleTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: isActive
                  ? "linear-gradient(135deg,#10b981,#059669)"
                  : isDark
                  ? "rgba(15,23,42,0.88)"
                  : "rgba(255,255,255,0.95)",
                border: isActive ? "none" : cardBorder,
                color: isActive ? "#ecfdf5" : isDark ? "#e2e8f0" : "#334155",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>{tab.title}</span>
              <span style={{ background: isActive ? "rgba(255,255,255,0.16)" : "rgba(148,163,184,0.14)", borderRadius: 999, padding: "2px 7px", fontSize: 11 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {activeVehicleTab === "my-garage" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {[
              [t("dashboard.vehSectionLabel"), myVehicles.length, "#2563eb"],
              [t("dashboard.vehStatBought"), lifecycleTotals.owned, "#60a5fa"],
              [t("dashboard.vehStatActive"), lifecycleTotals.activeSale, "#f59e0b"],
              [t("dashboard.vehStatSold"), lifecycleTotals.sold, "#34d399"],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                style={{
                  background: isDark
                    ? "linear-gradient(155deg, rgba(15,23,42,0.94), rgba(30,41,59,0.9))"
                    : "linear-gradient(155deg, rgba(255,255,255,0.98), rgba(241,245,249,0.95))",
                  border: panelBorder,
                  boxShadow: subtleShadow,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: bodyColor, fontWeight: 700 }}>{label}</div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: `${String(color)}22`,
                      border: `1px solid ${String(color)}66`,
                    }}
                  />
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: String(color), lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {vehicleWorkspaceMode === "list" ? (
            <div
              style={{
                background: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.9)",
                border: panelBorder,
                borderRadius: 12,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehSelectVehicle")}
              </div>
              <button
                type="button"
                onClick={startCreatingVehicle}
                style={{
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 999,
                  boxShadow: "0 10px 18px rgba(37,99,235,0.24)",
                  padding: "8px 12px",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t("dashboard.vehAddNew")}
              </button>
            </div>
          ) : null}

          {vehicleWorkspaceMode === "editor" ? (
          <div
            style={{
              background: isDark
                ? "linear-gradient(150deg, rgba(15,23,42,0.96), rgba(13,27,49,0.9))"
                : "linear-gradient(150deg, rgba(255,255,255,0.98), rgba(239,246,255,0.88))",
              border: panelBorder,
              boxShadow: elevatedShadow,
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>{t("dashboard.vehAddOwn")}</div>
                <div style={{ fontSize: 11, color: bodyColor, marginTop: 3 }}>{t("dashboard.vehAddSubtitle")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleWorkspaceMode("list");
                    setShowNewVehicleForm(false);
                    setEditingVehicleId("");
                  }}
                  style={{
                    background: "rgba(37,99,235,0.12)",
                    color: "#1d4ed8",
                    border: cardBorder,
                    borderRadius: 999,
                    boxShadow: "none",
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("dashboard.vehBackToList")}
                </button>
                <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, background: "rgba(37,99,235,0.1)", border: cardBorder, borderRadius: 999, padding: "5px 9px" }}>
                  {t("dashboard.vehMaxVehicles")}
                </div>
              </div>
            </div>
            {showNewVehicleForm ? (
              <>
            {renderVehicleSection(
              "characteristics",
              t("dashboard.vehCharacteristics"),
              <div
                style={{
                  display: "grid",
                  rowGap: 10,
                  columnGap: 16,
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(210px,1fr))",
                }}
              >
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: bodyColor }}>{t("dashboard.vehFillLabel")}</span>
                <button
                  type="button"
                  onClick={() => setVehicleCatalogMode("erp")}
                  style={{
                    background: vehicleCatalogMode === "erp" ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "rgba(37,99,235,0.08)",
                    color: vehicleCatalogMode === "erp" ? "#fff" : "#1d4ed8",
                    border: vehicleCatalogMode === "erp" ? "none" : cardBorder,
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("dashboard.vehModeErp")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleCatalogMode("manual");
                    setErpSelectedBrandId("");
                    setErpSelectedModelId("");
                    setErpModels([]);
                    setErpVersions([]);
                  }}
                  style={{
                    background: vehicleCatalogMode === "manual" ? "linear-gradient(135deg,#0f766e,#0d9488)" : "rgba(13,148,136,0.08)",
                    color: vehicleCatalogMode === "manual" ? "#fff" : "#0f766e",
                    border: vehicleCatalogMode === "manual" ? "none" : cardBorder,
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Manual
                </button>
              </div>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehAliasLabel")}
                <input
                  value={vehicleForm.nickname}
                  onChange={(event) => updateVehicleForm("nickname", event.target.value)}
                  placeholder="Ejemplo: Coche familiar"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              {vehicleCatalogMode === "erp" ? (
                <>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehBrandLabel")}
                <select
                  value={erpSelectedBrandId}
                  disabled={erpBrandsLoading}
                  onChange={(event) => {
                    const brandId = event.target.value;
                    const brand = erpBrands.find((b) => String(b.id) === String(brandId));
                    setErpSelectedBrandId(brandId);
                    setErpSelectedModelId("");
                    setErpVersions([]);
                    updateVehicleForm("brand", brand ? brand.name : "");
                    updateVehicleForm("model", "");
                    updateVehicleForm("version", "");
                    if (brandId) {
                      setErpModelsLoading(true);
                      getErpModelsJson(brandId)
                        .then((r) => r.json())
                        .then((data) => { if (Array.isArray(data?.models)) setErpModels(data.models); })
                        .catch(() => {})
                        .finally(() => setErpModelsLoading(false));
                    } else {
                      setErpModels([]);
                    }
                  }}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: erpSelectedBrandId ? titleColor : bodyColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                >
                  <option value="">{erpBrandsLoading ? t("dashboard.vehBrandLoading") : t("dashboard.vehSelectBrand")}</option>
                  {erpBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehModelLabel")}
                <select
                  value={erpSelectedModelId}
                  disabled={!erpSelectedBrandId || erpModelsLoading}
                  onChange={(event) => {
                    const modelId = event.target.value;
                    const model = erpModels.find((m) => String(m.id) === String(modelId));
                    setErpSelectedModelId(modelId);
                    setErpVersions([]);
                    updateVehicleForm("model", model ? model.name : "");
                    updateVehicleForm("version", "");
                    if (modelId) {
                      setErpVersionsLoading(true);
                      getErpVersionsJson(modelId, erpSelectedBrandId)
                        .then((r) => r.json())
                        .then((data) => { if (Array.isArray(data?.versions)) setErpVersions(data.versions); else setErpVersions([]); })
                        .catch(() => { setErpVersions([]); })
                        .finally(() => setErpVersionsLoading(false));
                    } else {
                      setErpVersions([]);
                    }
                  }}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: erpSelectedModelId ? titleColor : bodyColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                >
                  <option value="">{erpModelsLoading ? t("dashboard.vehModelLoading") : !erpSelectedBrandId ? t("dashboard.vehSelectBrandFirst") : t("dashboard.vehSelectModel")}</option>
                  {erpModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehVersionLabel")}
                <select
                  value={vehicleForm.version}
                  disabled={!erpSelectedModelId || erpVersionsLoading || erpVersions.length === 0}
                  onChange={(event) => {
                    const codversion = event.target.value;
                    updateVehicleForm("version", codversion);
                    if (codversion) {
                      getErpVersionDetailJson(codversion)
                        .then((r) => r.json())
                        .then((data) => {
                          const d = data?.detail;
                          if (!d) return;
                          if (d.fuel) updateVehicleForm("fuel", d.fuel);
                          if (d.cv) updateVehicleForm("cv", String(d.cv));
                          if (d.doors) updateVehicleForm("doors", String(d.doors));
                          if (d.seats) updateVehicleForm("seats", String(d.seats));
                          if (d.co2) updateVehicleForm("co2", String(d.co2));
                          const transmision = mapErpTransmission(d.transmision || "");
                          if (transmision) updateVehicleForm("transmissionType", transmision);
                          const bodyType = mapErpBodyType(d.bodyType || "");
                          if (bodyType) updateVehicleForm("bodyType", bodyType);
                        })
                        .catch(() => {});
                    }
                  }}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: vehicleForm.version ? titleColor : bodyColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                >
                  <option value="">{erpVersionsLoading ? t("dashboard.vehVersionLoading") : !erpSelectedModelId ? t("dashboard.vehSelectModelFirst") : erpVersions.length === 0 ? t("dashboard.vehNoVersions") : t("dashboard.vehSelectVersion")}</option>
                  {erpVersions.map((v) => (
                    <option key={v.codversion} value={v.codversion}>{v.label}</option>
                  ))}
                </select>
              </label>
                </>
              ) : (
                <>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Marca
                <input
                  value={vehicleForm.brand}
                  onChange={(event) => updateVehicleForm("brand", event.target.value)}
                  placeholder={t("dashboard.vehPlaceholderBrand")}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Modelo
                <input
                  value={vehicleForm.model}
                  onChange={(event) => updateVehicleForm("model", event.target.value)}
                  placeholder={t("dashboard.vehPlaceholderModel")}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehVersionLabel")}
                <input
                  value={vehicleForm.version}
                  onChange={(event) => updateVehicleForm("version", event.target.value)}
                  placeholder={t("dashboard.vehVersionPlaceholder")}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                />
              </label>
                </>
              )}
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehTransmissionLabel")}
                <select
                  value={vehicleForm.transmissionType}
                  onChange={(event) => updateVehicleForm("transmissionType", event.target.value)}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                >
                  <option value="">Selecciona</option>
                  <option value="manual">{t("dashboard.vehTransmissionManual")}</option>
                  <option value="automatico">{t("dashboard.vehTransmissionAuto")}</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehTypeLabel")}
                <select
                  value={vehicleForm.bodyType}
                  onChange={(event) => updateVehicleForm("bodyType", event.target.value)}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                >
                  <option value="">Selecciona</option>
                  <option value="berlina">{t("dashboard.vehBodyBerlina")}</option>
                  <option value="compacto">{t("dashboard.vehBodyCompact")}</option>
                  <option value="cabrio">Cabrio</option>
                  <option value="suv">{t("dashboard.vehBodySuv")}</option>
                  <option value="familiar">{t("dashboard.vehBodyFamiliar")}</option>
                  <option value="coupe">Coupé</option>
                  <option value="monovolumen">{t("dashboard.vehBodyMonovolumen")}</option>
                  <option value="pickup">{t("dashboard.vehBodyPickup")}</option>
                  <option value="todoterreno">{t("dashboard.vehBodyTodoterreno")}</option>
                  <option value="furgoneta">{t("dashboard.vehBodyFurgoneta")}</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                CV
                <input
                  value={vehicleForm.cv}
                  onChange={(event) => updateVehicleForm("cv", event.target.value)}
                  placeholder="150"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Caballos
                <input
                  value={vehicleForm.horsepower}
                  onChange={(event) => updateVehicleForm("horsepower", event.target.value)}
                  placeholder="150"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehColor")}<input
                  value={vehicleForm.color}
                  onChange={(event) => updateVehicleForm("color", event.target.value)}
                  placeholder="Blanco, Negro, Gris..."
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehSeatsLabel")}
                <input
                  value={vehicleForm.seats}
                  onChange={(event) => updateVehicleForm("seats", event.target.value)}
                  placeholder="5"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehDoorsLabel")}
                <input
                  value={vehicleForm.doors}
                  onChange={(event) => updateVehicleForm("doors", event.target.value)}
                  placeholder="5"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehLocationLabel")}
                <input
                  value={vehicleForm.location}
                  onChange={(event) => updateVehicleForm("location", event.target.value)}
                  placeholder="Madrid"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehLabelTag")}
                <input
                  value={vehicleForm.environmentalLabel}
                  onChange={(event) => updateVehicleForm("environmentalLabel", event.target.value)}
                  placeholder="CERO, ECO, C, B"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehLastItv")}
                <input
                  value={vehicleForm.lastIvt}
                  onChange={(event) => updateVehicleForm("lastIvt", event.target.value)}
                  placeholder="2026-03-20"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehNextItv")}
                <input
                  value={vehicleForm.nextIvt}
                  onChange={(event) => updateVehicleForm("nextIvt", event.target.value)}
                  placeholder="2027-03-20"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehCo2Label")}
                <input
                  value={vehicleForm.co2}
                  onChange={(event) => updateVehicleForm("co2", event.target.value)}
                  placeholder="120"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehYearLabel")}
                <input
                  value={vehicleForm.year}
                  onChange={(event) => updateVehicleForm("year", event.target.value)}
                  placeholder="2021"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehPlateLabel")}
                <input
                  value={vehicleForm.plate}
                  onChange={(event) => updateVehicleForm("plate", event.target.value)}
                  placeholder="1234 ABC"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehMileage")}<input
                  value={vehicleForm.mileage}
                  onChange={(event) => updateVehicleForm("mileage", event.target.value)}
                  placeholder="85000"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehFuel")}<input
                  value={vehicleForm.fuel}
                  onChange={(event) => updateVehicleForm("fuel", event.target.value)}
                  placeholder="Gasolina, Diésel, Híbrido..."
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              </div>,
              t("dashboard.vehCharacteristicsDesc")
            )}

            {renderVehicleSection(
              "marketplace",
              t("dashboard.vehMarketValue"),
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                  <span>{t("dashboard.vehPricingStrategy")}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => updateVehicleForm("marketplacePricingMode", "manual")}
                      style={{
                        background: vehicleForm.marketplacePricingMode === "manual" ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "rgba(37,99,235,0.08)",
                        color: vehicleForm.marketplacePricingMode === "manual" ? "#ffffff" : "#1d4ed8",
                        border: vehicleForm.marketplacePricingMode === "manual" ? "none" : cardBorder,
                        borderRadius: 999,
                        padding: "7px 11px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {t("dashboard.vehPriceFixed")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateVehicleForm("marketplacePricingMode", "valuation");
                        if (normalizeText(vehicleForm.brand) || normalizeText(vehicleForm.model)) {
                          requestValuationForVehicle({
                            title: normalizeText(vehicleForm.nickname),
                            brand: normalizeText(vehicleForm.brand),
                            model: normalizeText(vehicleForm.model),
                            year: normalizeText(vehicleForm.year),
                            mileage: normalizeText(vehicleForm.mileage),
                            fuel: normalizeText(vehicleForm.fuel),
                            plate: normalizeText(vehicleForm.plate),
                          });
                        } else {
                          setVehicleFeedback("Para iniciar la tasación, añade al menos marca y modelo del vehículo.");
                        }
                      }}
                      style={{
                        background: vehicleForm.marketplacePricingMode === "valuation" ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : "rgba(14,165,233,0.08)",
                        color: vehicleForm.marketplacePricingMode === "valuation" ? "#ffffff" : "#0c4a6e",
                        border: vehicleForm.marketplacePricingMode === "valuation" ? "none" : cardBorder,
                        borderRadius: 999,
                        padding: "7px 11px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {t("dashboard.vehPriceValuate")}
                    </button>
                  </div>
                </div>

                {vehicleForm.marketplacePricingMode === "manual" ? (
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                    <input
                      value={vehicleForm.price}
                      onChange={(event) => updateVehicleForm("price", event.target.value)}
                      placeholder="18500"
                      style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                    />
                  </label>
                ) : (
                  <div style={{ fontSize: 11, color: bodyColor, background: isDark ? "rgba(15,23,42,0.3)" : "rgba(239,246,255,0.9)", border: cardBorder, borderRadius: 10, padding: "9px 10px" }}>
                    Al publicar en marketplace te pediremos tasación antes de fijar el precio final.
                  </div>
                )}
              </div>,
              vehicleForm.marketplacePricingMode === "manual" ? t("dashboard.vehManualValue") : t("dashboard.vehValuationValue")
            )}

            {renderVehicleSection(
              "vehicleDocuments",
              t("dashboard.vehDocsSection"),
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(220px,1fr))" }}>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>{t("dashboard.vehPhotos")}</div>
                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={pickFiles(setPendingPhotos, 10)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    width: "100%",
                    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "9px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 10px 16px rgba(37,99,235,0.22)",
                  }}
                >
                  <span>{t("dashboard.vehUploadPhotos")}</span>
                  <span style={{ fontSize: 11, opacity: 0.95 }}>{t("dashboard.vehPhotosSelected", { count: pendingPhotos.length })}</span>
                </button>
                <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>{t("dashboard.vehPhotosHint")}</span>
                {storedPhotos.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: bodyColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Guardadas · arrastra para reordenar
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px,1fr))", gap: 6 }}>
                      {storedPhotos.map((photo, idx) => {
                        const src = resolvePhotoPreviewSrc(photo);
                        if (!src) return null;
                        return (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => { dragPhotoIdxRef.current = idx; }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragPhotoIdxRef.current !== null && dragPhotoIdxRef.current !== idx) {
                                reorderStoredPhotos(dragPhotoIdxRef.current, idx);
                              }
                              dragPhotoIdxRef.current = null;
                            }}
                            onDragEnd={() => { dragPhotoIdxRef.current = null; }}
                            style={{ position: "relative", cursor: "grab", borderRadius: 8, overflow: "hidden", border: idx === 0 ? "2px solid #f59e0b" : "1px solid rgba(0,0,0,0.1)" }}
                          >
                            <img src={src} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                            {/* Order badge */}
                            <div style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 999, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {idx + 1}
                            </div>
                            {idx === 0 && (
                              <div style={{ position: "absolute", top: 3, left: 3, background: "#f59e0b", color: "#fff", fontSize: 7, fontWeight: 800, borderRadius: 999, padding: "2px 4px" }}>
                                ⭐
                              </div>
                            )}
                            {/* Action bar */}
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.62)", display: "flex", gap: 3, padding: "3px 4px", justifyContent: "center" }}>
                              {idx !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => setStoredPhotoAsPrimary(idx)}
                                  title="Marcar como principal"
                                  style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, padding: "2px 5px", fontSize: 8, fontWeight: 700, cursor: "pointer" }}
                                >★</button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteStoredPhoto(idx)}
                                title="Eliminar"
                                style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, padding: "2px 5px", fontSize: 8, fontWeight: 700, cursor: "pointer" }}
                              >✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Documentación (PDF/imagen)</div>
                <input
                  ref={documentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={pickFiles(setPendingDocuments, 2)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    width: "100%",
                    background: "linear-gradient(135deg,#0f766e,#0e7490)",
                    color: "#ecfeff",
                    border: "none",
                    borderRadius: 10,
                    padding: "9px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 10px 16px rgba(14,116,144,0.2)",
                  }}
                >
                  <span>{t("dashboard.vehUploadDocs")}</span>
                  <span style={{ fontSize: 11, opacity: 0.95 }}>{pendingDocuments.length} seleccionados</span>
                </button>
                <span style={{ fontSize: 11, color: "#0f766e", fontWeight: 700 }}>{t("dashboard.vehDocsHint")}</span>
                {renderStoredAttachmentPreview(storedLegacyDocuments)}
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Ficha técnica</div>
                <input
                  ref={technicalSheetInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={pickFiles(setPendingTechnicalSheetDocuments, 2)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => technicalSheetInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(15,118,110,0.14)", color: "#0f766e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>{t("dashboard.vehAttachSheet")}</span>
                  <span style={{ fontSize: 11 }}>{pendingTechnicalSheetDocuments.length}</span>
                </button>
                {renderStoredAttachmentPreview(storedTechnicalSheetDocuments)}
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Permiso de circulación</div>
                <input
                  ref={circulationPermitInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={pickFiles(setPendingCirculationPermitDocuments, 2)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => circulationPermitInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(15,118,110,0.14)", color: "#0f766e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>{t("dashboard.vehAttachPermit")}</span>
                  <span style={{ fontSize: 11 }}>{pendingCirculationPermitDocuments.length}</span>
                </button>
                {renderStoredAttachmentPreview(storedCirculationPermitDocuments)}
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Documentación ITV</div>
                <input
                  ref={ivtInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={pickFiles(setPendingIvtDocuments, 2)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => ivtInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(15,118,110,0.14)", color: "#0f766e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>{t("dashboard.vehAttachItv")}</span>
                  <span style={{ fontSize: 11 }}>{pendingIvtDocuments.length}</span>
                </button>
                {renderStoredAttachmentPreview(storedItvDocuments)}
              </div>
              </div>,
              t("dashboard.vehDocsSummary", { saved: storedVehicleDocumentsEditorCount, pending: pendingPhotos.length + pendingDocuments.length + pendingTechnicalSheetDocuments.length + pendingCirculationPermitDocuments.length + pendingIvtDocuments.length })
            )}

            {renderVehicleSection(
              "insurance",
              t("dashboard.vehInsurance"),
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(220px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehInsurer")}
                <input
                  value={vehicleForm.policyCompany}
                  onChange={(event) => updateVehicleForm("policyCompany", event.target.value)}
                  placeholder="Compañía de seguro"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehCoverage")}
                <input
                  value={vehicleForm.coverageType}
                  onChange={(event) => updateVehicleForm("coverageType", event.target.value)}
                  placeholder={t("dashboard.vehCoveragePlaceholder")}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehPolicy")}
                <input
                  value={vehicleForm.policyNumber}
                  onChange={(event) => updateVehicleForm("policyNumber", event.target.value)}
                  placeholder={t("dashboard.vehPolicyNumber")}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>{t("dashboard.vehInsuranceDocs")}</div>
                <input
                  ref={insuranceDocumentsInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={pickFiles(setPendingInsuranceDocuments, 2)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => insuranceDocumentsInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(37,99,235,0.12)", color: "#1d4ed8", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>{t("dashboard.vehAttachInsurance")}</span>
                  <span style={{ fontSize: 11 }}>{pendingInsuranceDocuments.length}</span>
                </button>
                {renderStoredAttachmentPreview(storedInsuranceDocuments)}
              </div>
              </div>,
              t("dashboard.vehInsuranceSummary", { saved: storedInsuranceDocumentsCount, pending: pendingInsuranceDocuments.length })
            )}

            {renderVehicleSection(
              "maintenance",
              t("dashboard.vehMaintenance"),
              <>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(180px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehMaintenanceType")}
                <input
                  value={vehicleForm.maintenanceType}
                  onChange={(event) => updateVehicleForm("maintenanceType", event.target.value)}
                  placeholder={t("dashboard.vehMaintenanceTypePlaceholder")}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                {t("dashboard.vehMaintenanceDesc")}
                <input
                  value={vehicleForm.maintenanceTitle}
                  onChange={(event) => updateVehicleForm("maintenanceTitle", event.target.value)}
                  placeholder={t("dashboard.vehMaintenanceDescPlaceholder")}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor, marginTop: 8 }}>
              {t("dashboard.vehMaintenanceNotes")}
              <textarea
                value={vehicleForm.maintenanceNotes}
                onChange={(event) => updateVehicleForm("maintenanceNotes", event.target.value)}
                placeholder={t("dashboard.vehMaintenanceNotesPlaceholder")}
                rows={2}
                style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, resize: "vertical" }}
              />
            </label>
            <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
              <div>{t("dashboard.vehMaintenanceInvoices")}</div>
              <input
                ref={maintenanceInvoicesInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={pickFiles(setPendingMaintenanceInvoices, 2)}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => maintenanceInvoicesInputRef.current?.click()}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(245,158,11,0.12)", color: "#92400e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <span>{t("dashboard.vehAttachInvoices")}</span>
                <span style={{ fontSize: 11 }}>{pendingMaintenanceInvoices.length}</span>
              </button>
              {renderStoredAttachmentPreview(storedMaintenanceInvoices)}
            </div>
              </>,
              t("dashboard.vehMaintenanceSummary", { saved: storedMaintenanceInvoicesCount, pending: pendingMaintenanceInvoices.length })
            )}

            {renderVehicleSection(
              "notes",
              t("dashboard.vehNotes"),
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehNotes")}<textarea
                value={vehicleForm.notes}
                onChange={(event) => updateVehicleForm("notes", event.target.value)}
                placeholder="Añade observaciones relevantes del vehículo"
                rows={3}
                style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, resize: "vertical" }}
              />
            </label>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button
                type="button"
                onClick={addVehicleToGarage}
                disabled={isSaving}
                style={{
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  boxShadow: "0 10px 18px rgba(37,99,235,0.24)",
                  padding: "10px 13px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.75 : 1,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {isSaving ? "Guardando..." : editingVehicleId ? t("dashboard.vehSaveChanges") : t("dashboard.vehSaveNew")}
              </button>
              {editingVehicleId ? (
                <button
                  type="button"
                  onClick={cancelEditingVehicle}
                  style={{
                    background: "rgba(148,163,184,0.16)",
                    color: bodyColor,
                    border: cardBorder,
                    borderRadius: 10,
                    boxShadow: subtleShadow,
                    padding: "10px 13px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  {t("dashboard.vehCancelEdit")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setActiveVehicleTab("owned")}
                style={{
                  background: "rgba(37,99,235,0.1)",
                  color: "#1d4ed8",
                  border: cardBorder,
                  borderRadius: 10,
                  boxShadow: subtleShadow,
                  padding: "10px 13px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                Ver estado en pipeline
              </button>
            </div>
              </>
            ) : null}

            {vehicleFeedback && (
              vehicleFeedback.startsWith("⚠️") ? (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#b91c1c",
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <span style={{ flexShrink: 0, fontSize: 16 }}>⚠️</span>
                  <span>{vehicleFeedback.replace(/^⚠️\s*/, "")}</span>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{vehicleFeedback}</div>
              )
            )}
          </div>
          ) : null}

          {vehicleWorkspaceMode === "list" ? (
            displayedVehicles.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {displayedVehicles.map((vehicle) => {
                const vehicleId = normalizeText(vehicle?.id);
                const firstPhotoWithContent = (Array.isArray(vehicle?.photos) ? vehicle.photos : []).find((photo) => Boolean(resolvePhotoPreviewSrc(photo)));
                const firstPhotoPreviewSrc = resolvePhotoPreviewSrc(firstPhotoWithContent);
                const identityLabel = [normalizeText(vehicle?.brand), normalizeText(vehicle?.model), normalizeText(vehicle?.version)].filter(Boolean).join(" ");
                const vehicleStoredDocumentsCount = getVehicleStoredDocumentsCount(vehicle);
                const isManagementOpen = managementVehicleId === vehicleId;
                const isPreviewBlocked = Boolean(failedPhotoVehicleIds[vehicleId]);

                return <div
                  key={vehicle.id}
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.92) 100%)"
                      : "linear-gradient(135deg, #ffffff 0%, #f0f6ff 100%)",
                    border: isDark ? "1px solid rgba(99,102,241,0.18)" : "1px solid rgba(99,102,241,0.14)",
                    boxShadow: isDark
                      ? "0 2px 16px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)"
                      : "0 2px 12px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.05)",
                    borderRadius: 16,
                    padding: "12px 14px",
                    transition: "box-shadow 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "96px minmax(0,1fr) 200px",
                      gap: 14,
                      alignItems: "start",
                    }}
                  >
                    {/* Foto cuadrada */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {firstPhotoPreviewSrc && !isPreviewBlocked ? (
                        <img
                          src={firstPhotoPreviewSrc}
                          alt={normalizeText(firstPhotoWithContent?.name) || `Foto ${vehicle.title || vehicle.id}`}
                          onError={() => {
                            if (!vehicleId) return;
                            setFailedPhotoVehicleIds((prev) => ({ ...prev, [vehicleId]: true }));
                          }}
                          style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(99,102,241,0.15)", display: "block", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                        />
                      ) : (
                        <div style={{ width: 96, height: 96, borderRadius: 12, border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(99,102,241,0.12)", background: isDark ? "rgba(30,41,59,0.6)" : "rgba(241,245,249,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 22, opacity: 0.3 }}>🚗</span>
                          <span style={{ fontSize: 9, color: bodyColor, textAlign: "center" }}>{t("dashboard.vehNoPhoto")}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <span style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.18)", borderRadius: 999, padding: "2px 7px", fontSize: 9, fontWeight: 600, color: "#3b82f6", letterSpacing: 0.2 }}>
                          📷 {Array.isArray(vehicle.photos) ? vehicle.photos.length : 0}
                        </span>
                        <span style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 999, padding: "2px 7px", fontSize: 9, fontWeight: 600, color: "#10b981", letterSpacing: 0.2 }}>
                          📄 {vehicleStoredDocumentsCount}
                        </span>
                      </div>
                    </div>

                    {/* Resumen de características */}
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: titleColor, letterSpacing: -0.2, lineHeight: 1.3 }}>
                          {normalizeText(vehicle?.plate) ? (
                            <><span style={{ background: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.22)", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 800, color: isDark ? "#a5b4fc" : "#4f46e5", marginRight: 6, letterSpacing: 1 }}>{normalizeText(vehicle.plate)}</span></>
                          ) : null}
                          {identityLabel || normalizeText(vehicle?.title) || "Vehículo"}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "4px 8px" }}>
                        {[
                          ["📅", t("dashboard.vehCardYear"), vehicle.year],
                          ["⛽", t("dashboard.vehCardFuel"), vehicle.fuel],
                          ["🛣️", t("dashboard.vehCardKm"), vehicle.mileage ? Number(vehicle.mileage).toLocaleString("es-ES") + " km" : null],
                          ["⚙️", t("dashboard.vehCardTransmission"), vehicle.transmissionType],
                          ["🎨", t("dashboard.vehCardColor"), vehicle.color],
                          ["🚪", t("dashboard.vehCardDoors"), vehicle.doors],
                          ["💪", t("dashboard.vehCardCv"), vehicle.cv],
                          ["🚗", t("dashboard.vehCardBody"), vehicle.bodyType],
                          ["🏷️", t("dashboard.vehCardLabel"), vehicle.environmentalLabel],
                          ["💺", t("dashboard.vehCardSeats"), vehicle.seats],
                        ]
                          .filter(([, , val]) => val)
                          .map(([icon, label, val]) => (
                            <div key={label} style={{ fontSize: 11, color: bodyColor, lineHeight: 1.5, display: "flex", gap: 4, alignItems: "baseline" }}>
                              <span style={{ fontSize: 10, opacity: 0.7 }}>{icon}</span>
                              <span style={{ fontWeight: 600, color: isDark ? "rgba(226,232,240,0.65)" : "rgba(51,65,85,0.6)", fontSize: 10 }}>{label}</span>
                              <span style={{ fontWeight: 700, color: titleColor }}>{val}</span>
                            </div>
                          ))}
                      </div>
                      {vehicle.notes ? (
                        <div style={{ fontSize: 10, color: bodyColor, fontStyle: "italic", borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(99,102,241,0.1)", paddingTop: 5, marginTop: 2 }}>{vehicle.notes}</div>
                      ) : null}
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => removeVehicleFromGarage(vehicle.id)}
                        style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%", letterSpacing: 0.2, transition: "background 0.15s" }}
                      >
                        {t("dashboard.vehDeleteBtn")}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingVehicle(vehicle)}
                        style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: isDark ? "#a5b4fc" : "#4f46e5", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%", letterSpacing: 0.2 }}
                      >
                        {t("dashboard.vehEditBtn")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setManagementVehicleId((prev) => (prev === vehicleId ? "" : vehicleId))}
                        style={{ background: "rgba(14,116,144,0.1)", border: "1px solid rgba(14,116,144,0.22)", color: isDark ? "#67e8f9" : "#0e7490", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%", letterSpacing: 0.2 }}
                      >
                        {isManagementOpen ? t("dashboard.vehHideManage") : t("dashboard.vehManageBtn")}
                      </button>

                      {isManagementOpen ? (
                        <div style={{ display: "grid", gap: 6, border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(99,102,241,0.1)", borderRadius: 10, background: isDark ? "rgba(15,23,42,0.5)" : "rgba(248,250,252,0.85)", padding: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleVehicleAction("appointment", vehicle)}
                            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)", color: "#b45309", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%" }}
                          >
                            {t("dashboard.vehRequestAppointment")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVehicleAction("valuation", vehicle)}
                            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.22)", color: isDark ? "#93c5fd" : "#1d4ed8", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%" }}
                          >
                            {t("dashboard.vehRequestValuation")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVehicleAction("insurance", vehicle)}
                            style={{ background: "rgba(14,116,144,0.1)", border: "1px solid rgba(14,116,144,0.22)", color: isDark ? "#67e8f9" : "#0e7490", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%" }}
                          >
                            {t("dashboard.vehManageInsurance")}
                          </button>
                          {(overriddenMarketplaceStates[vehicle.id] ?? vehicle.marketplaceState) === "active_sale" ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (currentUserEmail && vehicle.id) {
                                  setOverriddenMarketplaceStates((s) => ({ ...s, [vehicle.id]: "owned" }));
                                  postVehicleStateUpsertJson(currentUserEmail, { vehicleId: vehicle.id, state: "owned", notes: "" })
                                    .catch(() => {});
                                  setVehicleFeedback(`Vehículo ${vehicle.title || vehicle.brand} retirado del marketplace.`);
                                }
                              }}
                              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#dc2626", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%" }}
                            >
                              {t("dashboard.vehUnpublish")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => handleVehicleAction("marketplace", vehicle, event.currentTarget)}
                              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.22)", color: isDark ? "#6ee7b7" : "#047857", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%" }}
                            >
                              {t("dashboard.vehPublish")}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>;
              })}

              {marketplacePublishDialog.open && marketplacePublishDialog.vehicle ? (
                <div
                  onClick={closeMarketplacePublishDialog}
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 1200,
                    background: isDark ? "rgba(2,6,23,0.7)" : "rgba(15,23,42,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                >
                  <div
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Confirmar publicación en marketplace"
                    ref={marketplacePublishDialogRef}
                    tabIndex={-1}
                    style={{
                      width: "min(520px, 100%)",
                      border: panelBorder,
                      borderRadius: 14,
                      background: isDark
                        ? "linear-gradient(160deg, rgba(15,23,42,0.99), rgba(30,41,59,0.96))"
                        : "linear-gradient(160deg, rgba(255,255,255,1), rgba(239,246,255,0.98))",
                      boxShadow: elevatedShadow,
                      padding: 14,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: titleColor }}>
                      Confirmar publicación en marketplace
                    </div>
                    <div style={{ fontSize: 11, color: bodyColor, display: "grid", gap: 4 }}>
                      <div>Vehículo: {marketplacePublishDialog.vehicle.title}</div>
                      <div>
                        Estrategia: {marketplacePublishDialog.vehicle.marketplacePricingMode === "valuation" ? "Tasación previa" : "Precio manual"}
                      </div>
                      <div>
                        {t("dashboard.vehPublishPrice", { price: marketplacePublishDialog.vehicle.price ? `${marketplacePublishDialog.vehicle.price} EUR` : t("dashboard.vehPublishNoPrice") })}
                      </div>
                      {marketplacePublishDialog.vehicle.marketplacePricingMode === "valuation" && !marketplacePublishDialog.vehicle.price ? (
                        <div style={{ color: "#0c4a6e", fontWeight: 700 }}>
                          {t("dashboard.vehPublishOpenValuation")}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        ref={marketplacePublishPrimaryButtonRef}
                        type="button"
                        onClick={confirmMarketplacePublish}
                        style={{
                          background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {marketplacePublishDialog.vehicle.marketplacePricingMode === "valuation" && !marketplacePublishDialog.vehicle.price
                          ? t("dashboard.vehGoValuation")
                          : t("dashboard.vehPublishConfirm")}
                      </button>
                      <button
                        type="button"
                        onClick={closeMarketplacePublishDialog}
                        style={{
                          background: "rgba(148,163,184,0.14)",
                          color: titleColor,
                          border: cardBorder,
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            ) : (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {t("dashboard.vehEmpty")}
            </div>
            )
          ) : null}
        </div>
      )}

      {activeVehicleTab !== "overview" && selectedSection && displayedVehicles.length === 0 && (
        <div
          style={{
            background: cardBg,
            border: panelBorder,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: titleColor }}>{selectedSection.title}</div>
            <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>
              {Array.isArray(selectedSection.items) ? selectedSection.items.length : 0} elementos
            </span>
          </div>

          {Array.isArray(selectedSection.items) && selectedSection.items.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {selectedSection.items.map((vehicle, index) => (
                <div
                  key={`${selectedSection.key}-${index}`}
                  style={{
                    background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.92)",
                    border: cardBorder,
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: titleColor }}>{vehicle.title}</div>
                  <div style={{ fontSize: 12, color: bodyColor, marginTop: 3 }}>{vehicle.meta}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: selectedSection.key === "active-sale" ? "#b45309" : "#047857", fontWeight: 700 }}>
                    {vehicle.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{selectedSection.empty}</div>
          )}
        </div>
      )}
    </section>
  );
}
