import { useEffect, useMemo, useRef, useState } from "react";
import {
  getGarageVehiclesJson,
  postGarageVehicleAddJson,
  postGarageVehicleRemoveJson,
  getErpBrandsJson,
  getErpModelsJson,
  getErpVersionsJson,
  getErpVersionDetailJson,
} from "../../utils/apiClient";

const GARAGE_STORAGE_PREFIX = "movilidad-advisor.userGarage.v1";
const APPOINTMENT_HISTORY_STORAGE_PREFIX = "movilidad-advisor.userAppointmentHistory.v1";
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

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
    name: normalizeText(safeInput?.name),
    size: Number(safeInput?.size || 0),
    mimeType: normalizeText(safeInput?.mimeType),
    contentBase64: normalizeText(safeInput?.contentBase64),
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
    initialMaintenance: {
      ...initialMaintenance,
      invoices: normalizeAttachmentCollection(initialMaintenance?.invoices),
    },
  };
}

function getGarageStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${GARAGE_STORAGE_PREFIX}.${normalizedEmail}` : GARAGE_STORAGE_PREFIX;
}

function getAppointmentHistoryStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${APPOINTMENT_HISTORY_STORAGE_PREFIX}.${normalizedEmail}` : APPOINTMENT_HISTORY_STORAGE_PREFIX;
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

function readAppointmentHistory(currentUserEmail = "") {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(getAppointmentHistoryStorageKey(currentUserEmail));
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
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

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size) {
    return "0 KB";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
    const contentBase64 = size > 0 && size <= MAX_ATTACHMENT_BYTES ? await fileToBase64DataUrl(file) : "";

    payload.push({
      name,
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
  } catch {}
}

function writeAppointmentHistory(currentUserEmail = "", historyByAppointmentId = {}) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeHistory = historyByAppointmentId && typeof historyByAppointmentId === "object" ? historyByAppointmentId : {};
    window.localStorage.setItem(getAppointmentHistoryStorageKey(currentUserEmail), JSON.stringify(safeHistory));
  } catch {}
}

function inferAppointmentStage(item = {}) {
  const text = `${item?.status || ""} ${item?.meta || ""}`.toLowerCase();

  if (text.includes("cerrad") || text.includes("finaliz") || text.includes("complet") || text.includes("pasad")) {
    return "closed";
  }

  if (text.includes("en curso") || text.includes("proceso") || text.includes("confirm") || text.includes("hoy")) {
    return "active";
  }

  return "pending";
}

const APPOINTMENT_STATUS_OPTIONS = ["Solicitud enviada", "Pendiente", "Pendiente de confirmación", "Confirmada", "En validación", "En curso", "Completada", "Cerrada"];
const APPOINTMENT_TYPE_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "workshop", label: "Taller" },
  { key: "maintenance", label: "Mantenimiento" },
  { key: "certification", label: "Garantía" },
  { key: "insurance", label: "Seguro" },
];

function inferAppointmentType(item = {}) {
  const rawType = normalizeText(item?.type).toLowerCase();
  if (rawType) {
    return rawType;
  }

  const text = `${item?.title || ""} ${item?.meta || ""}`.toLowerCase();

  if (text.includes("mantenimiento")) {
    return "maintenance";
  }

  if (text.includes("garant") || text.includes("certific")) {
    return "certification";
  }

  if (text.includes("seguro") || text.includes("póliza") || text.includes("poliza")) {
    return "insurance";
  }

  return "workshop";
}

function getAppointmentTypeLabel(type = "") {
  const normalizedType = normalizeText(type).toLowerCase();
  return APPOINTMENT_TYPE_FILTERS.find((item) => item.key === normalizedType)?.label || "Taller";
}

function inferAppointmentPriority(item = {}) {
  const stage = inferAppointmentStage(item);
  const text = `${item?.status || ""} ${item?.meta || ""}`.toLowerCase();

  if (stage === "closed") {
    return { key: "low", label: "Baja", color: "#065f46", bg: "rgba(16,185,129,0.14)", border: "1px solid rgba(110,231,183,0.3)" };
  }

  if (text.includes("urgente") || text.includes("hoy") || stage === "active") {
    return { key: "high", label: "Alta", color: "#b91c1c", bg: "rgba(239,68,68,0.14)", border: "1px solid rgba(248,113,113,0.28)" };
  }

  return { key: "medium", label: "Media", color: "#92400e", bg: "rgba(245,158,11,0.14)", border: "1px solid rgba(251,191,36,0.28)" };
}

function resolveMarketplacePricingMode(vehicle = {}) {
  return normalizeText(vehicle?.marketplacePricingMode).toLowerCase() === "valuation" ? "valuation" : "manual";
}

export default function UserDashboardVehicles({
  themeMode,
  isMobile = false,
  dashboardAppointments = [],
  userVehicleSections,
  dashboardVehicleCount,
  panelStyle,
  getOfferBadgeStyle,
  onRequestAppointment = () => {},
  onRequestValuation = () => {},
  onUpdateAppointmentStatus = () => {},
  onNavigate = () => {},
  onBrowseMarketplace = () => {},
  currentUserEmail = "",
}) {
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

  function mapErpTransmission(t = "") {
    const v = String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  const [myVehicles, setMyVehicles] = useState(() => readGarageVehicles(currentUserEmail));
  const [vehicleFeedback, setVehicleFeedback] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [pendingTechnicalSheetDocuments, setPendingTechnicalSheetDocuments] = useState([]);
  const [pendingCirculationPermitDocuments, setPendingCirculationPermitDocuments] = useState([]);
  const [pendingIvtDocuments, setPendingIvtDocuments] = useState([]);
  const [pendingInsuranceDocuments, setPendingInsuranceDocuments] = useState([]);
  const [pendingMaintenanceInvoices, setPendingMaintenanceInvoices] = useState([]);
  const [appointmentDrafts, setAppointmentDrafts] = useState({});
  const [appointmentFilters, setAppointmentFilters] = useState({});
  const [appointmentHistory, setAppointmentHistory] = useState(() => readAppointmentHistory(currentUserEmail));
  const [newAppointmentDraftByVehicle, setNewAppointmentDraftByVehicle] = useState({});
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState("");
  const [marketplacePublishDialog, setMarketplacePublishDialog] = useState({ open: false, vehicle: null });
  const [expandedVehicleSections, setExpandedVehicleSections] = useState({
    characteristics: true,
    marketplace: false,
    vehicleDocuments: false,
    insurance: false,
    maintenance: false,
    notes: false,
  });
  const [expandedStoredVehicleSections, setExpandedStoredVehicleSections] = useState({});
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

  const safeSections = useMemo(() => (Array.isArray(userVehicleSections) ? userVehicleSections : []), [userVehicleSections]);
  const safeDashboardAppointments = useMemo(() => (Array.isArray(dashboardAppointments) ? dashboardAppointments : []), [dashboardAppointments]);
  const appointmentsByVehicleId = useMemo(
    () =>
      safeDashboardAppointments.reduce((acc, item) => {
        const vehicleId = normalizeText(item?.vehicleId);

        if (!vehicleId) {
          return acc;
        }

        if (!acc[vehicleId]) {
          acc[vehicleId] = [];
        }

        acc[vehicleId].push(item);
        return acc;
      }, {}),
    [safeDashboardAppointments]
  );

  const totalVehiclesCount = dashboardVehicleCount + myVehicles.length;

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
    writeAppointmentHistory(currentUserEmail, appointmentHistory);
  }, [currentUserEmail, appointmentHistory]);

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

  const vehicleTabs = [
    {
      key: "my-garage",
      title: "Mis vehículos",
      count: myVehicles.length,
    },
    ...safeSections.map((section) => ({
      key: section.key,
      title: section.title,
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
            {isOpen ? "Ocultar" : "Abrir"}
          </span>
        </button>
        {isOpen ? children : null}
      </div>
    );
  };

  const toggleStoredVehicleSection = (vehicleId, sectionKey) => {
    const stateKey = `${vehicleId}:${sectionKey}`;
    setExpandedStoredVehicleSections((prev) => ({
      ...prev,
      [stateKey]: !prev[stateKey],
    }));
  };

  const renderStoredVehicleSection = (vehicleId, sectionKey, title, children, meta = "") => {
    const stateKey = `${vehicleId}:${sectionKey}`;
    const isOpen = Boolean(expandedStoredVehicleSections[stateKey]);

    return (
      <div
        style={{
          display: "grid",
          gap: 8,
          border: cardBorder,
          borderRadius: 10,
          background: isDark ? "rgba(15,23,42,0.36)" : "rgba(255,255,255,0.72)",
          padding: 10,
          marginTop: 10,
        }}
      >
        <button
          type="button"
          onClick={() => toggleStoredVehicleSection(vehicleId, sectionKey)}
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
            {meta ? <div style={{ fontSize: 11, color: bodyColor, marginTop: 2 }}>{meta}</div> : null}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", background: "rgba(37,99,235,0.1)", border: cardBorder, borderRadius: 999, padding: "4px 8px" }}>
            {isOpen ? "Ocultar" : "Abrir"}
          </span>
        </button>
        {isOpen ? children : null}
      </div>
    );
  };

  const resolveAttachmentDownloadHref = (item = {}) => {
    const rawContent = normalizeText(item?.contentBase64);
    if (!rawContent) {
      return "";
    }

    if (rawContent.startsWith("data:")) {
      return rawContent;
    }

    const mimeType = normalizeText(item?.mimeType || item?.fileMimeType).toLowerCase() || "application/octet-stream";
    return `data:${mimeType};base64,${rawContent}`;
  };

  const renderStoredAttachmentList = (items, emptyLabel) => {
    if (!Array.isArray(items) || items.length === 0) {
      return <div style={{ fontSize: 11, color: bodyColor }}>{emptyLabel}</div>;
    }

    return (
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((item, index) => (
          <div
            key={`${item?.name || "attachment"}-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              border: cardBorder,
              borderRadius: 8,
              padding: "7px 9px",
              background: isDark ? "rgba(15,23,42,0.3)" : "rgba(248,250,252,0.9)",
            }}
          >
            <span style={{ fontSize: 11, color: titleColor, overflowWrap: "anywhere", flex: 1 }}>{item?.name || `Adjunto ${index + 1}`}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: bodyColor, whiteSpace: "nowrap" }}>{formatBytes(Number(item?.size || 0))}</span>
              {(() => {
                const downloadHref = resolveAttachmentDownloadHref(item);
                const canDownload = Boolean(downloadHref);

                return (
                  <a
                    href={canDownload ? downloadHref : undefined}
                    download={normalizeText(item?.name) || `adjunto-${index + 1}`}
                    onClick={(event) => {
                      if (!canDownload) {
                        event.preventDefault();
                      }
                    }}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "4px 8px",
                      border: canDownload ? "1px solid rgba(37,99,235,0.28)" : "1px solid rgba(148,163,184,0.2)",
                      background: canDownload ? "rgba(37,99,235,0.1)" : "rgba(148,163,184,0.12)",
                      color: canDownload ? "#1d4ed8" : bodyColor,
                      textDecoration: "none",
                      cursor: canDownload ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                      pointerEvents: canDownload ? "auto" : "none",
                    }}
                    aria-disabled={!canDownload}
                    title={canDownload ? "Descargar adjunto" : "Este adjunto no tiene contenido descargable"}
                  >
                    Descargar
                  </a>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const updateAppointmentDraft = (appointmentId, field, value) => {
    const normalizedAppointmentId = normalizeText(appointmentId);

    if (!normalizedAppointmentId) {
      return;
    }

    setAppointmentDrafts((prev) => ({
      ...prev,
      [normalizedAppointmentId]: {
        ...(prev[normalizedAppointmentId] || {}),
        [field]: value,
      },
    }));
  };

  const getAppointmentDraftValue = (appointment = {}, field) => {
    const appointmentId = normalizeText(appointment?.id);
    const draft = appointmentDrafts[appointmentId] || {};

    if (field === "status") {
      return draft.status || normalizeText(appointment?.status) || "Pendiente";
    }

    if (field === "requestedAt") {
      return draft.requestedAt || normalizeText(appointment?.requestedAt) || "";
    }

    if (field === "meta") {
      return Object.prototype.hasOwnProperty.call(draft, "meta") ? draft.meta : normalizeText(appointment?.meta);
    }

    return draft[field] || "";
  };

  const getVehicleAppointmentFilter = (vehicleId = "") => appointmentFilters[normalizeText(vehicleId)] || "all";

  const updateVehicleAppointmentFilter = (vehicleId = "", filterKey = "all") => {
    const normalizedVehicleId = normalizeText(vehicleId);
    if (!normalizedVehicleId) {
      return;
    }

    setAppointmentFilters((prev) => ({
      ...prev,
      [normalizedVehicleId]: filterKey,
    }));
  };

  const getVehicleNewAppointmentDraft = (vehicleId = "") => {
    const normalizedVehicleId = normalizeText(vehicleId);
    return newAppointmentDraftByVehicle[normalizedVehicleId] || { type: "workshop" };
  };

  const updateVehicleNewAppointmentDraft = (vehicleId = "", field, value) => {
    const normalizedVehicleId = normalizeText(vehicleId);
    if (!normalizedVehicleId) {
      return;
    }

    setNewAppointmentDraftByVehicle((prev) => ({
      ...prev,
      [normalizedVehicleId]: {
        ...getVehicleNewAppointmentDraft(normalizedVehicleId),
        [field]: value,
      },
    }));
  };

  const createAppointmentForVehicle = (vehicle = {}) => {
    const normalizedVehicleId = normalizeText(vehicle?.id);
    if (!normalizedVehicleId) {
      return;
    }

    const draft = getVehicleNewAppointmentDraft(normalizedVehicleId);
    const appointmentType = normalizeText(draft?.type || "workshop") || "workshop";

    onRequestAppointment(appointmentType, {
      vehicleId: normalizedVehicleId,
      vehicleTitle: normalizeText(vehicle?.title || `${vehicle?.brand || ""} ${vehicle?.model || ""}`),
      vehiclePlate: normalizeText(vehicle?.plate),
    });

    setVehicleFeedback(`Nueva cita (${getAppointmentTypeLabel(appointmentType)}) creada para ${vehicle?.title || vehicle?.brand || "tu vehículo"}.`);
  };

  const getAppointmentHistory = (appointment = {}) => {
    const appointmentId = normalizeText(appointment?.id);
    if (Array.isArray(appointment?.statusHistory) && appointment.statusHistory.length > 0) {
      return appointment.statusHistory;
    }
    const fromLocal = appointmentHistory[appointmentId];
    return Array.isArray(fromLocal) ? fromLocal : [];
  };

  const saveAppointmentChanges = async (appointment = {}, vehicle = {}) => {
    const appointmentId = normalizeText(appointment?.id);
    const nextStatus = getAppointmentDraftValue(appointment, "status");
    const nextRequestedAt = getAppointmentDraftValue(appointment, "requestedAt");
    const nextMeta = getAppointmentDraftValue(appointment, "meta");

    if (!appointmentId || !nextStatus || !nextRequestedAt) {
      return;
    }

    setUpdatingAppointmentId(appointmentId);

    try {
      const previousStatus = normalizeText(appointment?.status);
      await onUpdateAppointmentStatus(appointmentId, {
        status: nextStatus,
        requestedAt: nextRequestedAt,
        meta: nextMeta,
      });

      if (previousStatus && previousStatus !== nextStatus) {
        setAppointmentHistory((prev) => {
          const currentHistory = Array.isArray(prev[appointmentId]) ? prev[appointmentId] : [];
          const nextEntry = {
            changedAt: new Date().toISOString(),
            previousStatus,
            nextStatus,
          };

          return {
            ...prev,
            [appointmentId]: [nextEntry, ...currentHistory].slice(0, 20),
          };
        });
      }

      setVehicleFeedback(`Estado de cita actualizado para ${vehicle?.title || vehicle?.brand || "el vehículo"}.`);
    } catch {
      setVehicleFeedback("No se pudo actualizar el estado de la cita.");
    } finally {
      setUpdatingAppointmentId("");
    }
  };

  const addVehicleToGarage = async () => {
    const brand = normalizeText(vehicleForm.brand);
    const model = normalizeText(vehicleForm.model);
    const version = normalizeText(vehicleForm.version);

    if (!brand || !model || !version) {
      setVehicleFeedback("Añade marca, modelo y versión para guardar tu vehículo.");
      return;
    }

    const nickname = normalizeText(vehicleForm.nickname);
    const title = nickname || `${brand} ${model} ${version}`.trim();

    const photosPayload = await filesToAttachmentPayload(pendingPhotos);
    const documentsPayload = await filesToAttachmentPayload(pendingDocuments);
    const technicalSheetDocumentsPayload = await filesToAttachmentPayload(pendingTechnicalSheetDocuments);
    const circulationPermitDocumentsPayload = await filesToAttachmentPayload(pendingCirculationPermitDocuments);
    const itvDocumentsPayload = await filesToAttachmentPayload(pendingIvtDocuments);
    const insuranceDocumentsPayload = await filesToAttachmentPayload(pendingInsuranceDocuments);
    const maintenanceInvoicesPayload = await filesToAttachmentPayload(pendingMaintenanceInvoices);

    const skippedLargeFilesCount = [
      ...photosPayload,
      ...documentsPayload,
      ...technicalSheetDocumentsPayload,
      ...circulationPermitDocumentsPayload,
      ...itvDocumentsPayload,
      ...insuranceDocumentsPayload,
      ...maintenanceInvoicesPayload,
    ].filter((file) => Number(file?.size || 0) > MAX_ATTACHMENT_BYTES && !file?.contentBase64).length;

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
      initialMaintenance: {
        type: normalizeText(vehicleForm.maintenanceType || "maintenance"),
        title: normalizeText(vehicleForm.maintenanceTitle),
        notes: normalizeText(vehicleForm.maintenanceNotes),
        invoices: maintenanceInvoicesPayload,
      },
      createdAt: existingVehicle?.createdAt || new Date().toISOString(),
    };

    let nextVehicles = existingVehicle
      ? myVehicles.map((item) => (normalizeText(item?.id) === vehicle.id ? vehicle : item))
      : [vehicle, ...myVehicles].slice(0, 20);

    try {
      nextVehicles = await addGarageVehicleFromApi(currentUserEmail, vehicle);
    } catch {
      // Fallback to local state/localStorage when API is unavailable.
    }

    setMyVehicles(Array.isArray(nextVehicles) ? nextVehicles : [vehicle, ...myVehicles].slice(0, 20));
    setEditingVehicleId("");
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
    setVehicleFeedback(
      skippedLargeFilesCount > 0
        ? `Vehículo ${title} ${existingVehicle ? "actualizado" : "guardado"}. ${skippedLargeFilesCount} ficheros superaban 2 MB y se guardaron sin contenido.`
        : `Vehículo ${title} ${existingVehicle ? "actualizado" : "guardado en Mis vehículos"}.`
    );
  };

  const startEditingVehicle = (vehicle = {}) => {
    const vehicleId = normalizeText(vehicle?.id);
    if (!vehicleId) {
      return;
    }

    setEditingVehicleId(vehicleId);
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
    setVehicleCatalogMode("erp");
    setErpSelectedBrandId("");
    setErpSelectedModelId("");
    setErpModels([]);
    setErpVersions([]);
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
    setVehicleFeedback("Vehículo eliminado de Mis vehículos.");
  };

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
    }
  };

  return (
    <section id="user-dashboard-vehicles" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#34d399", letterSpacing: "0.6px" }}>MIS VEHÍCULOS</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleColor }}>Hub de ciclo de vida de vehículos</div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            Controla en una sola vista tus coches comprados, activos en venta y operaciones cerradas.
          </div>
        </div>
        <span style={{ ...getOfferBadgeStyle("green"), fontSize: 11 }}>
          {totalVehiclesCount} registros
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
              ["Mis vehículos", myVehicles.length, "#2563eb"],
              ["Comprados", lifecycleTotals.owned, "#60a5fa"],
              ["Activos en venta", lifecycleTotals.activeSale, "#f59e0b"],
              ["Vendidos", lifecycleTotals.sold, "#34d399"],
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
                <div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>Añadir vehículo propio</div>
                <div style={{ fontSize: 11, color: bodyColor, marginTop: 3 }}>Crea tu garage personal con fotos, documentación y acciones rápidas.</div>
              </div>
              <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, background: "rgba(37,99,235,0.1)", border: cardBorder, borderRadius: 999, padding: "5px 9px" }}>
                Máximo 20 vehículos
              </div>
            </div>
            {renderVehicleSection(
              "characteristics",
              "Características del vehículo",
              <div
                style={{
                  display: "grid",
                  rowGap: 10,
                  columnGap: 16,
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(210px,1fr))",
                }}
              >
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: bodyColor }}>Relleno:</span>
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
                  Catálogo ERP
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
                Alias / nombre
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
                Marca
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
                  <option value="">{erpBrandsLoading ? "Cargando marcas…" : "Selecciona marca"}</option>
                  {erpBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Modelo
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
                      getErpVersionsJson(modelId)
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
                  <option value="">{erpModelsLoading ? "Cargando modelos…" : !erpSelectedBrandId ? "Primero selecciona marca" : "Selecciona modelo"}</option>
                  {erpModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Versión
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
                  <option value="">{erpVersionsLoading ? "Cargando versiones…" : !erpSelectedModelId ? "Primero selecciona modelo" : erpVersions.length === 0 ? "Sin versiones en catálogo" : "Selecciona versión"}</option>
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
                  placeholder="Escribe la marca"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Modelo
                <input
                  value={vehicleForm.model}
                  onChange={(event) => updateVehicleForm("model", event.target.value)}
                  placeholder="Escribe el modelo"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Versión
                <input
                  value={vehicleForm.version}
                  onChange={(event) => updateVehicleForm("version", event.target.value)}
                  placeholder="Escribe la versión"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                />
              </label>
                </>
              )}
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Tipo de cambio
                <select
                  value={vehicleForm.transmissionType}
                  onChange={(event) => updateVehicleForm("transmissionType", event.target.value)}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, width: "100%", minWidth: 0, boxSizing: "border-box" }}
                >
                  <option value="">Selecciona</option>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Tipo de coche
                <select
                  value={vehicleForm.bodyType}
                  onChange={(event) => updateVehicleForm("bodyType", event.target.value)}
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                >
                  <option value="">Selecciona</option>
                  <option value="berlina">Berlina</option>
                  <option value="compacto">Compacto</option>
                  <option value="cabrio">Cabrio</option>
                  <option value="suv">SUV</option>
                  <option value="familiar">Familiar</option>
                  <option value="coupe">Coupé</option>
                  <option value="monovolumen">Monovolumen</option>
                  <option value="pickup">Pickup</option>
                  <option value="todoterreno">Todoterreno</option>
                  <option value="furgoneta">Furgoneta</option>
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
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Color
                <input
                  value={vehicleForm.color}
                  onChange={(event) => updateVehicleForm("color", event.target.value)}
                  placeholder="Blanco, Negro, Gris..."
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Plazas
                <input
                  value={vehicleForm.seats}
                  onChange={(event) => updateVehicleForm("seats", event.target.value)}
                  placeholder="5"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Puertas
                <input
                  value={vehicleForm.doors}
                  onChange={(event) => updateVehicleForm("doors", event.target.value)}
                  placeholder="5"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Ubicación
                <input
                  value={vehicleForm.location}
                  onChange={(event) => updateVehicleForm("location", event.target.value)}
                  placeholder="Madrid"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Etiqueta
                <input
                  value={vehicleForm.environmentalLabel}
                  onChange={(event) => updateVehicleForm("environmentalLabel", event.target.value)}
                  placeholder="CERO, ECO, C, B"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Última ITV
                <input
                  value={vehicleForm.lastIvt}
                  onChange={(event) => updateVehicleForm("lastIvt", event.target.value)}
                  placeholder="2026-03-20"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Próxima ITV
                <input
                  value={vehicleForm.nextIvt}
                  onChange={(event) => updateVehicleForm("nextIvt", event.target.value)}
                  placeholder="2027-03-20"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                CO2 (g/km)
                <input
                  value={vehicleForm.co2}
                  onChange={(event) => updateVehicleForm("co2", event.target.value)}
                  placeholder="120"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Año
                <input
                  value={vehicleForm.year}
                  onChange={(event) => updateVehicleForm("year", event.target.value)}
                  placeholder="2021"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Matrícula
                <input
                  value={vehicleForm.plate}
                  onChange={(event) => updateVehicleForm("plate", event.target.value)}
                  placeholder="1234 ABC"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Kilometraje
                <input
                  value={vehicleForm.mileage}
                  onChange={(event) => updateVehicleForm("mileage", event.target.value)}
                  placeholder="85000"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Combustible
                <input
                  value={vehicleForm.fuel}
                  onChange={(event) => updateVehicleForm("fuel", event.target.value)}
                  placeholder="Gasolina, Diésel, Híbrido..."
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              </div>,
              "Datos base, ficha técnica y atributos comerciales"
            )}

            {renderVehicleSection(
              "marketplace",
              "Valor del Vehículo en el mercado",
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                  <span>Estrategia de precio para publicar</span>
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
                      Fijar precio manual
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
                      Primero tasar el coche
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
              vehicleForm.marketplacePricingMode === "manual" ? "Valor manual definido" : "Publicación condicionada a tasación"
            )}

            {renderVehicleSection(
              "vehicleDocuments",
              "Documentos del vehículo",
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(220px,1fr))" }}>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Fotos del vehículo</div>
                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => setPendingPhotos(Array.from(event.target.files || []))}
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
                  <span>Subir fotos</span>
                  <span style={{ fontSize: 11, opacity: 0.95 }}>{pendingPhotos.length} seleccionadas</span>
                </button>
                <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>JPG, PNG, WEBP · selección múltiple</span>
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Documentación (PDF/imagen)</div>
                <input
                  ref={documentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(event) => setPendingDocuments(Array.from(event.target.files || []))}
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
                  <span>Subir documentos</span>
                  <span style={{ fontSize: 11, opacity: 0.95 }}>{pendingDocuments.length} seleccionados</span>
                </button>
                <span style={{ fontSize: 11, color: "#0f766e", fontWeight: 700 }}>PDF, JPG, PNG · selección múltiple</span>
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Ficha técnica</div>
                <input
                  ref={technicalSheetInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(event) => setPendingTechnicalSheetDocuments(Array.from(event.target.files || []))}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => technicalSheetInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(15,118,110,0.14)", color: "#0f766e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>Adjuntar ficha</span>
                  <span style={{ fontSize: 11 }}>{pendingTechnicalSheetDocuments.length}</span>
                </button>
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Permiso de circulación</div>
                <input
                  ref={circulationPermitInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(event) => setPendingCirculationPermitDocuments(Array.from(event.target.files || []))}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => circulationPermitInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(15,118,110,0.14)", color: "#0f766e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>Adjuntar permiso</span>
                  <span style={{ fontSize: 11 }}>{pendingCirculationPermitDocuments.length}</span>
                </button>
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Documentación ITV</div>
                <input
                  ref={ivtInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(event) => setPendingIvtDocuments(Array.from(event.target.files || []))}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => ivtInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(15,118,110,0.14)", color: "#0f766e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>Adjuntar ITV</span>
                  <span style={{ fontSize: 11 }}>{pendingIvtDocuments.length}</span>
                </button>
              </div>
              </div>,
              `${pendingPhotos.length + pendingDocuments.length + pendingTechnicalSheetDocuments.length + pendingCirculationPermitDocuments.length + pendingIvtDocuments.length} adjuntos preparados`
            )}

            {renderVehicleSection(
              "insurance",
              "Seguros",
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(220px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Aseguradora
                <input
                  value={vehicleForm.policyCompany}
                  onChange={(event) => updateVehicleForm("policyCompany", event.target.value)}
                  placeholder="Compañía de seguro"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Cobertura
                <input
                  value={vehicleForm.coverageType}
                  onChange={(event) => updateVehicleForm("coverageType", event.target.value)}
                  placeholder="Todo riesgo, terceros..."
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Póliza
                <input
                  value={vehicleForm.policyNumber}
                  onChange={(event) => updateVehicleForm("policyNumber", event.target.value)}
                  placeholder="Número de póliza"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Documentos del seguro</div>
                <input
                  ref={insuranceDocumentsInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(event) => setPendingInsuranceDocuments(Array.from(event.target.files || []))}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => insuranceDocumentsInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(37,99,235,0.12)", color: "#1d4ed8", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>Adjuntar seguro</span>
                  <span style={{ fontSize: 11 }}>{pendingInsuranceDocuments.length}</span>
                </button>
              </div>
              </div>,
              `${pendingInsuranceDocuments.length} documentos de seguro preparados`
            )}

            {renderVehicleSection(
              "maintenance",
              "Mantenimientos",
              <>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(180px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Tipo mantenimiento
                <input
                  value={vehicleForm.maintenanceType}
                  onChange={(event) => updateVehicleForm("maintenanceType", event.target.value)}
                  placeholder="Revisión, aceite, frenos..."
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Descripción mantenimiento
                <input
                  value={vehicleForm.maintenanceTitle}
                  onChange={(event) => updateVehicleForm("maintenanceTitle", event.target.value)}
                  placeholder="Qué se le ha hecho al coche"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor, marginTop: 8 }}>
              Notas mantenimiento
              <textarea
                value={vehicleForm.maintenanceNotes}
                onChange={(event) => updateVehicleForm("maintenanceNotes", event.target.value)}
                placeholder="Detalle del mantenimiento"
                rows={2}
                style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, resize: "vertical" }}
              />
            </label>
            <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
              <div>Facturas de mantenimiento</div>
              <input
                ref={maintenanceInvoicesInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={(event) => setPendingMaintenanceInvoices(Array.from(event.target.files || []))}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => maintenanceInvoicesInputRef.current?.click()}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "rgba(245,158,11,0.12)", color: "#92400e", border: cardBorder, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <span>Adjuntar facturas</span>
                <span style={{ fontSize: 11 }}>{pendingMaintenanceInvoices.length}</span>
              </button>
            </div>
              </>,
              `${pendingMaintenanceInvoices.length} facturas de mantenimiento preparadas`
            )}

            {renderVehicleSection(
              "notes",
              "Notas internas",
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
              Notas
              <textarea
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
                style={{
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  boxShadow: "0 10px 18px rgba(37,99,235,0.24)",
                  padding: "10px 13px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {editingVehicleId ? "Guardar cambios" : "Guardar en mis vehículos"}
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
                  Cancelar edición
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
            {vehicleFeedback && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{vehicleFeedback}</div>
            )}
          </div>

          {myVehicles.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {myVehicles.map((vehicle) => {
                const vehicleAppointments = appointmentsByVehicleId[normalizeText(vehicle.id)] || [];
                const currentAppointmentFilter = getVehicleAppointmentFilter(vehicle.id);
                const filteredVehicleAppointments = vehicleAppointments.filter(
                  (item) => currentAppointmentFilter === "all" || inferAppointmentType(item) === currentAppointmentFilter
                );
                const pendingAppointments = filteredVehicleAppointments.filter((item) => inferAppointmentStage(item) !== "closed");
                const closedAppointments = filteredVehicleAppointments.filter((item) => inferAppointmentStage(item) === "closed");
                const firstPhotoWithContent = (Array.isArray(vehicle?.photos) ? vehicle.photos : []).find((photo) => {
                  const raw = normalizeText(photo?.contentBase64);
                  if (!raw) {
                    return false;
                  }
                  if (raw.startsWith("data:image/")) {
                    return true;
                  }
                  const mimeType = normalizeText(photo?.mimeType || photo?.fileMimeType).toLowerCase();
                  return mimeType.startsWith("image/");
                });
                const firstPhotoPreviewSrc = (() => {
                  const raw = normalizeText(firstPhotoWithContent?.contentBase64);
                  if (!raw) {
                    return "";
                  }
                  if (raw.startsWith("data:image/")) {
                    return raw;
                  }
                  const mimeType = normalizeText(firstPhotoWithContent?.mimeType || firstPhotoWithContent?.fileMimeType).toLowerCase() || "image/jpeg";
                  return `data:${mimeType};base64,${raw}`;
                })();

                return <div
                  key={vehicle.id}
                  style={{
                    background: isDark
                      ? "linear-gradient(155deg, rgba(15,23,42,0.96), rgba(30,41,59,0.9))"
                      : "linear-gradient(155deg, rgba(255,255,255,0.99), rgba(239,246,255,0.86))",
                    border: panelBorder,
                    boxShadow: elevatedShadow,
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>{vehicle.title}</div>
                  {renderVehicleSection(
                    "marketplace",
                    "Valor del Vehículo en el mercado",
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                        <span>Estrategia de precio para publicar</span>
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
                            Fijar precio manual
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateVehicleForm("marketplacePricingMode", "valuation");
                              requestValuationForVehicle(vehicle);
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
                            Primero tasar el coche
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
                    vehicleForm.marketplacePricingMode === "manual" ? "Valor manual definido" : "Publicación condicionada a tasación"
                  )}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: "#1d4ed8",
                            background: "rgba(37,99,235,0.12)",
                            border: cardBorder,
                            borderRadius: 999,
                            padding: "3px 7px",
                            letterSpacing: "0.2px",
                          }}
                        >
                          GARAGE
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: resolveMarketplacePricingMode(vehicle) === "valuation" ? "#0c4a6e" : "#92400e",
                            background: resolveMarketplacePricingMode(vehicle) === "valuation" ? "rgba(14,165,233,0.14)" : "rgba(245,158,11,0.14)",
                            border: cardBorder,
                            borderRadius: 999,
                            padding: "3px 7px",
                            letterSpacing: "0.2px",
                          }}
                        >
                          {resolveMarketplacePricingMode(vehicle) === "valuation" ? "TASACION" : "PRECIO MANUAL"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: bodyColor, marginTop: 3 }}>
                        {vehicle.brand} {vehicle.model}
                        {vehicle.version ? ` · ${vehicle.version}` : ""}
                        {vehicle.bodyType ? ` · ${vehicle.bodyType}` : ""}
                        {vehicle.transmissionType ? ` · ${vehicle.transmissionType}` : ""}
                        {vehicle.year ? ` · ${vehicle.year}` : ""}
                        {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                        {vehicle.mileage ? ` · ${vehicle.mileage} km` : ""}
                        {vehicle.fuel ? ` · ${vehicle.fuel}` : ""}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span style={{ background: "rgba(37,99,235,0.12)", border: cardBorder, borderRadius: 999, padding: "4px 8px", fontSize: 11, color: "#1d4ed8" }}>
                          {Array.isArray(vehicle.photos) ? vehicle.photos.length : 0} fotos
                        </span>
                        <span style={{ background: "rgba(16,185,129,0.12)", border: cardBorder, borderRadius: 999, padding: "4px 8px", fontSize: 11, color: "#065f46" }}>
                          {Array.isArray(vehicle.documents) ? vehicle.documents.length : 0} documentos
                        </span>
                        <span style={{ background: "rgba(148,163,184,0.16)", border: cardBorder, borderRadius: 999, padding: "4px 8px", fontSize: 11, color: bodyColor }}>
                          Adjuntos: {formatBytes(
                            [...(Array.isArray(vehicle.photos) ? vehicle.photos : []), ...(Array.isArray(vehicle.documents) ? vehicle.documents : [])].reduce(
                              (acc, file) => acc + Number(file?.size || 0),
                              0
                            )
                          )}
                        </span>
                      </div>
                      {renderStoredVehicleSection(
                        vehicle.id,
                        "characteristics",
                        "Características",
                        <div style={{ display: "grid", gap: 6, fontSize: 11, color: bodyColor }}>
                          {vehicle.location ? <div>Ubicación: {vehicle.location}</div> : null}
                          {vehicle.environmentalLabel ? <div>Etiqueta: {vehicle.environmentalLabel}</div> : null}
                          {vehicle.co2 ? <div>CO2: {vehicle.co2} g/km</div> : null}
                          {vehicle.cv ? <div>CV: {vehicle.cv}</div> : null}
                          {vehicle.horsepower ? <div>Caballos: {vehicle.horsepower}</div> : null}
                          {vehicle.seats ? <div>Plazas: {vehicle.seats}</div> : null}
                          {vehicle.doors ? <div>Puertas: {vehicle.doors}</div> : null}
                          {vehicle.color ? <div>Color: {vehicle.color}</div> : null}
                          {vehicle.lastIvt ? <div>Última ITV: {vehicle.lastIvt}</div> : null}
                          {vehicle.nextIvt ? <div>Próxima ITV: {vehicle.nextIvt}</div> : null}
                          {!vehicle.location && !vehicle.environmentalLabel && !vehicle.co2 && !vehicle.cv && !vehicle.horsepower && !vehicle.seats && !vehicle.doors && !vehicle.color && !vehicle.lastIvt && !vehicle.nextIvt ? (
                            <div>No hay características ampliadas guardadas.</div>
                          ) : null}
                        </div>,
                        "Datos técnicos y comerciales"
                      )}
                      {renderStoredVehicleSection(
                        vehicle.id,
                        "marketplace",
                        "Marketplace",
                        <div style={{ display: "grid", gap: 6, fontSize: 11, color: bodyColor }}>
                          <div>
                            Estrategia de precio: {normalizeText(vehicle.marketplacePricingMode).toLowerCase() === "valuation" ? "Tasación previa" : "Precio manual"}
                          </div>
                          <div>
                            Precio publicación: {vehicle.price ? `${vehicle.price} EUR` : "Sin precio cargado"}
                          </div>
                        </div>,
                        normalizeText(vehicle.marketplacePricingMode).toLowerCase() === "valuation"
                          ? "Se pedirá tasación al publicar"
                          : vehicle.price
                          ? `Precio ${vehicle.price} EUR`
                          : "Completa precio antes de publicar"
                      )}
                      {renderStoredVehicleSection(
                        vehicle.id,
                        "documents",
                        "Documentos",
                        <div style={{ display: "grid", gap: 10, fontSize: 11, color: bodyColor }}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>Fotos</div>
                            {renderStoredAttachmentList(vehicle.photos, "Sin fotos adjuntas.")}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>Generales</div>
                            {renderStoredAttachmentList(vehicle.documents, "Sin documentos generales.")}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>Ficha técnica</div>
                            {renderStoredAttachmentList(vehicle.technicalSheetDocuments, "Sin ficha técnica adjunta.")}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>Permiso de circulación</div>
                            {renderStoredAttachmentList(vehicle.circulationPermitDocuments, "Sin permiso de circulación adjunto.")}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>ITV</div>
                            {renderStoredAttachmentList(vehicle.itvDocuments, "Sin documentos ITV adjuntos.")}
                          </div>
                        </div>,
                        `${(Array.isArray(vehicle.photos) ? vehicle.photos.length : 0) + (Array.isArray(vehicle.documents) ? vehicle.documents.length : 0) + (Array.isArray(vehicle.technicalSheetDocuments) ? vehicle.technicalSheetDocuments.length : 0) + (Array.isArray(vehicle.circulationPermitDocuments) ? vehicle.circulationPermitDocuments.length : 0) + (Array.isArray(vehicle.itvDocuments) ? vehicle.itvDocuments.length : 0)} adjuntos`
                      )}
                      {renderStoredVehicleSection(
                        vehicle.id,
                        "insurance",
                        "Seguro",
                        <div style={{ display: "grid", gap: 8, fontSize: 11, color: bodyColor }}>
                          <div>Aseguradora: {vehicle.policyCompany || "Sin dato"}</div>
                          <div>Cobertura: {vehicle.coverageType || "Sin dato"}</div>
                          <div>Póliza: {vehicle.policyNumber || "Sin dato"}</div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>Documentos</div>
                            {renderStoredAttachmentList(vehicle.insuranceDocuments, "Sin documentos de seguro adjuntos.")}
                          </div>
                        </div>,
                        vehicle.policyCompany || (Array.isArray(vehicle.insuranceDocuments) && vehicle.insuranceDocuments.length ? "Seguro documentado" : "Sin seguro cargado")
                      )}
                      {renderStoredVehicleSection(
                        vehicle.id,
                        "appointments",
                        "Citas",
                        <div style={{ display: "grid", gap: 10, fontSize: 11, color: bodyColor }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <select
                              value={getVehicleNewAppointmentDraft(vehicle.id).type || "workshop"}
                              onChange={(event) => updateVehicleNewAppointmentDraft(vehicle.id, "type", event.target.value)}
                              style={{ background: inputBg, border: cardBorder, borderRadius: 8, padding: "7px 9px", color: titleColor, minWidth: 170 }}
                            >
                              {APPOINTMENT_TYPE_FILTERS.filter((option) => option.key !== "all").map((option) => (
                                <option key={`${vehicle.id}-new-${option.key}`} value={option.key}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => createAppointmentForVehicle(vehicle)}
                              style={{
                                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: 8,
                                padding: "7px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Nueva cita
                            </button>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {APPOINTMENT_TYPE_FILTERS.map((filterOption) => {
                              const isActive = currentAppointmentFilter === filterOption.key;

                              return (
                                <button
                                  key={`${vehicle.id}-${filterOption.key}`}
                                  type="button"
                                  onClick={() => updateVehicleAppointmentFilter(vehicle.id, filterOption.key)}
                                  style={{
                                    background: isActive ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "rgba(37,99,235,0.08)",
                                    color: isActive ? "#ffffff" : "#1d4ed8",
                                    border: isActive ? "none" : cardBorder,
                                    borderRadius: 999,
                                    padding: "6px 10px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {filterOption.label}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>Pendientes o activas</div>
                            {pendingAppointments.length > 0 ? (
                              pendingAppointments.map((item, index) => (
                                (() => {
                                  const priority = inferAppointmentPriority(item);
                                  const historyEntries = getAppointmentHistory(item);

                                  return <div
                                  key={item.id || `${vehicle.id}-pending-${index}`}
                                  style={{
                                    display: "grid",
                                    gap: 8,
                                    border: cardBorder,
                                    borderRadius: 8,
                                    padding: "10px 12px 10px 16px",
                                    background: isDark ? "rgba(15,23,42,0.3)" : "rgba(248,250,252,0.9)",
                                    borderLeft: "3px solid rgba(245,158,11,0.65)",
                                    position: "relative",
                                  }}
                                >
                                  <span style={{ position: "absolute", left: -6, top: 16, width: 10, height: 10, borderRadius: 999, background: "#f59e0b", border: isDark ? "2px solid #0f172a" : "2px solid #ffffff" }} />
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <div style={{ display: "grid", gap: 3 }}>
                                      <span style={{ fontWeight: 800, color: titleColor }}>{item.title || "Cita"}</span>
                                      <span style={{ fontSize: 10, color: bodyColor }}>{getAppointmentTypeLabel(inferAppointmentType(item))}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                      {getAppointmentDraftValue(item, "requestedAt") ? <span style={{ fontSize: 10, color: bodyColor }}>{getAppointmentDraftValue(item, "requestedAt")}</span> : null}
                                      <span style={{ fontSize: 10, color: priority.color, background: priority.bg, border: priority.border, borderRadius: 999, padding: "3px 7px" }}>
                                        Prioridad {priority.label}
                                      </span>
                                      <span style={{ fontSize: 10, color: "#92400e", background: "rgba(245,158,11,0.14)", border: "1px solid rgba(251,191,36,0.28)", borderRadius: 999, padding: "3px 7px" }}>
                                        {item.status || "Pendiente"}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(150px,220px) 1fr" }}>
                                    <label style={{ display: "grid", gap: 5 }}>
                                      <span style={{ fontSize: 10, color: bodyColor }}>Fecha</span>
                                      <input
                                        value={getAppointmentDraftValue(item, "requestedAt")}
                                        onChange={(event) => updateAppointmentDraft(item.id, "requestedAt", event.target.value)}
                                        style={{ background: inputBg, border: cardBorder, borderRadius: 8, padding: "7px 9px", color: titleColor }}
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: 5 }}>
                                      <span style={{ fontSize: 10, color: bodyColor }}>Notas</span>
                                      <textarea
                                        value={getAppointmentDraftValue(item, "meta")}
                                        onChange={(event) => updateAppointmentDraft(item.id, "meta", event.target.value)}
                                        rows={2}
                                        style={{ background: inputBg, border: cardBorder, borderRadius: 8, padding: "7px 9px", color: titleColor, resize: "vertical" }}
                                      />
                                    </label>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                      <select
                                        value={getAppointmentDraftValue(item, "status")}
                                        onChange={(event) => updateAppointmentDraft(item.id, "status", event.target.value)}
                                        style={{ background: inputBg, border: cardBorder, borderRadius: 8, padding: "7px 9px", color: titleColor, minWidth: 170 }}
                                      >
                                        {APPOINTMENT_STATUS_OPTIONS.map((statusOption) => (
                                          <option key={statusOption} value={statusOption}>
                                            {statusOption}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => saveAppointmentChanges(item, vehicle)}
                                        disabled={updatingAppointmentId === item.id}
                                        style={{
                                          background: "rgba(37,99,235,0.12)",
                                          color: "#1d4ed8",
                                          border: cardBorder,
                                          borderRadius: 8,
                                          padding: "7px 10px",
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: updatingAppointmentId === item.id ? "progress" : "pointer",
                                          opacity: updatingAppointmentId === item.id ? 0.7 : 1,
                                        }}
                                      >
                                        {updatingAppointmentId === item.id ? "Guardando..." : "Actualizar estado"}
                                      </button>
                                  </div>
                                  {historyEntries.length > 0 ? (
                                    <div style={{ display: "grid", gap: 4, marginTop: 2 }}>
                                      <div style={{ fontSize: 10, color: bodyColor, fontWeight: 700 }}>Historial de estados</div>
                                      {historyEntries.slice(0, 3).map((entry, historyIndex) => (
                                        <div key={`${item.id}-history-${historyIndex}`} style={{ fontSize: 10, color: bodyColor }}>
                                          {new Date(entry.changedAt).toLocaleString("es-ES")} · {entry.previousStatus} → {entry.nextStatus}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>;
                                })()
                              ))
                            ) : (
                              <div>No hay citas pendientes para este vehículo con este filtro.</div>
                            )}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: titleColor }}>Ya realizadas</div>
                            {closedAppointments.length > 0 ? (
                              closedAppointments.map((item, index) => (
                                (() => {
                                  const priority = inferAppointmentPriority(item);
                                  const historyEntries = getAppointmentHistory(item);

                                  return <div
                                  key={item.id || `${vehicle.id}-closed-${index}`}
                                  style={{
                                    display: "grid",
                                    gap: 8,
                                    border: cardBorder,
                                    borderRadius: 8,
                                    padding: "10px 12px 10px 16px",
                                    background: isDark ? "rgba(15,23,42,0.3)" : "rgba(248,250,252,0.9)",
                                    borderLeft: "3px solid rgba(16,185,129,0.7)",
                                    position: "relative",
                                  }}
                                >
                                  <span style={{ position: "absolute", left: -6, top: 16, width: 10, height: 10, borderRadius: 999, background: "#10b981", border: isDark ? "2px solid #0f172a" : "2px solid #ffffff" }} />
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <div style={{ display: "grid", gap: 3 }}>
                                      <span style={{ fontWeight: 800, color: titleColor }}>{item.title || "Cita"}</span>
                                      <span style={{ fontSize: 10, color: bodyColor }}>{getAppointmentTypeLabel(inferAppointmentType(item))}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                      {getAppointmentDraftValue(item, "requestedAt") ? <span style={{ fontSize: 10, color: bodyColor }}>{getAppointmentDraftValue(item, "requestedAt")}</span> : null}
                                      <span style={{ fontSize: 10, color: priority.color, background: priority.bg, border: priority.border, borderRadius: 999, padding: "3px 7px" }}>
                                        Prioridad {priority.label}
                                      </span>
                                      <span style={{ fontSize: 10, color: "#065f46", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(110,231,183,0.28)", borderRadius: 999, padding: "3px 7px" }}>
                                        {item.status || "Cerrada"}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(150px,220px) 1fr" }}>
                                    <label style={{ display: "grid", gap: 5 }}>
                                      <span style={{ fontSize: 10, color: bodyColor }}>Fecha</span>
                                      <input
                                        value={getAppointmentDraftValue(item, "requestedAt")}
                                        onChange={(event) => updateAppointmentDraft(item.id, "requestedAt", event.target.value)}
                                        style={{ background: inputBg, border: cardBorder, borderRadius: 8, padding: "7px 9px", color: titleColor }}
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: 5 }}>
                                      <span style={{ fontSize: 10, color: bodyColor }}>Notas</span>
                                      <textarea
                                        value={getAppointmentDraftValue(item, "meta")}
                                        onChange={(event) => updateAppointmentDraft(item.id, "meta", event.target.value)}
                                        rows={2}
                                        style={{ background: inputBg, border: cardBorder, borderRadius: 8, padding: "7px 9px", color: titleColor, resize: "vertical" }}
                                      />
                                    </label>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                      <select
                                        value={getAppointmentDraftValue(item, "status")}
                                        onChange={(event) => updateAppointmentDraft(item.id, "status", event.target.value)}
                                        style={{ background: inputBg, border: cardBorder, borderRadius: 8, padding: "7px 9px", color: titleColor, minWidth: 170 }}
                                      >
                                        {APPOINTMENT_STATUS_OPTIONS.map((statusOption) => (
                                          <option key={statusOption} value={statusOption}>
                                            {statusOption}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => saveAppointmentChanges(item, vehicle)}
                                        disabled={updatingAppointmentId === item.id}
                                        style={{
                                          background: "rgba(37,99,235,0.12)",
                                          color: "#1d4ed8",
                                          border: cardBorder,
                                          borderRadius: 8,
                                          padding: "7px 10px",
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: updatingAppointmentId === item.id ? "progress" : "pointer",
                                          opacity: updatingAppointmentId === item.id ? 0.7 : 1,
                                        }}
                                      >
                                        {updatingAppointmentId === item.id ? "Guardando..." : "Actualizar estado"}
                                      </button>
                                  </div>
                                  {historyEntries.length > 0 ? (
                                    <div style={{ display: "grid", gap: 4, marginTop: 2 }}>
                                      <div style={{ fontSize: 10, color: bodyColor, fontWeight: 700 }}>Historial de estados</div>
                                      {historyEntries.slice(0, 3).map((entry, historyIndex) => (
                                        <div key={`${item.id}-history-${historyIndex}`} style={{ fontSize: 10, color: bodyColor }}>
                                          {new Date(entry.changedAt).toLocaleString("es-ES")} · {entry.previousStatus} → {entry.nextStatus}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>;
                                })()
                              ))
                            ) : (
                              <div>Todavía no hay citas cerradas para este vehículo con este filtro.</div>
                            )}
                          </div>
                        </div>,
                        vehicleAppointments.length > 0
                          ? `${filteredVehicleAppointments.length} visibles · ${pendingAppointments.length} pendientes · ${closedAppointments.length} realizadas`
                          : "Sin citas registradas"
                      )}
                      {renderStoredVehicleSection(
                        vehicle.id,
                        "notes",
                        "Notas",
                        <div style={{ fontSize: 11, color: bodyColor, maxWidth: 620 }}>
                          {vehicle.notes || "No hay notas internas para este vehículo."}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: isMobile ? "100%" : 280, flex: isMobile ? "1 1 100%" : "0 0 380px" }}>
                      <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(130px,1fr))" }}>
                      <button
                        type="button"
                        onClick={() => startEditingVehicle(vehicle)}
                        style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(129,140,248,0.28)", color: "#3730a3", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", width: "100%" }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVehicleAction("appointment", vehicle)}
                        style={{ background: "rgba(245,158,11,0.14)", border: "1px solid rgba(251,191,36,0.28)", color: "#92400e", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", width: "100%" }}
                      >
                        Solicitar cita
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVehicleAction("valuation", vehicle)}
                        style={{ background: "rgba(37,99,235,0.14)", border: "1px solid rgba(96,165,250,0.28)", color: "#1e3a8a", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", width: "100%" }}
                      >
                        Solicitar tasación
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleVehicleAction("marketplace", vehicle, event.currentTarget)}
                        style={{ background: "rgba(16,185,129,0.14)", border: "1px solid rgba(110,231,183,0.28)", color: "#065f46", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", width: "100%" }}
                      >
                        Publicar en marketplace
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVehicleAction("insurance", vehicle)}
                        style={{ background: "rgba(14,116,144,0.14)", border: "1px solid rgba(103,232,249,0.28)", color: "#155e75", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", width: "100%" }}
                      >
                        Gestionar seguro
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVehicleFromGarage(vehicle.id)}
                        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(248,113,113,0.24)", color: "#b91c1c", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", gridColumn: "1 / -1", width: "100%" }}
                      >
                        Quitar
                      </button>
                      </div>
                      <div
                        style={{
                          border: cardBorder,
                          borderRadius: 10,
                          padding: 8,
                          background: isDark ? "rgba(15,23,42,0.32)" : "rgba(248,250,252,0.9)",
                          minHeight: isMobile ? 150 : 280,
                          flex: 1,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 700, color: bodyColor }}>Primera foto</div>
                        {firstPhotoPreviewSrc ? (
                          <img
                            src={firstPhotoPreviewSrc}
                            alt={normalizeText(firstPhotoWithContent?.name) || `Foto ${vehicle.title || vehicle.id}`}
                            style={{ width: "100%", height: "100%", minHeight: isMobile ? 110 : 240, objectFit: "cover", borderRadius: 8, border: cardBorder }}
                          />
                        ) : (
                          <div style={{ fontSize: 11, color: bodyColor }}>Sin foto con vista previa</div>
                        )}
                      </div>
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
                        Precio: {marketplacePublishDialog.vehicle.price ? `${marketplacePublishDialog.vehicle.price} EUR` : "Sin precio definido"}
                      </div>
                      {marketplacePublishDialog.vehicle.marketplacePricingMode === "valuation" && !marketplacePublishDialog.vehicle.price ? (
                        <div style={{ color: "#0c4a6e", fontWeight: 700 }}>
                          Se abrirá Tasaciones para obtener el precio objetivo antes de publicar.
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
                          ? "Ir a tasación"
                          : "Publicar"}
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
              Todavía no tienes vehículos en tu área privada. Añade uno para empezar a gestionar citas, tasaciones, marketplace y seguro.
            </div>
          )}
        </div>
      )}

      {activeVehicleTab !== "overview" && selectedSection && (
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
