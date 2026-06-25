import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { getGarageVehiclesJson, postGarageVehicleAddJson, postGarageVehicleRemoveJson, postVehicleStateUpsertJson, getErpBrandsJson, getErpModelsJson, getErpVersionsJson, getErpVersionDetailJson } from "../utils/apiClient";

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
    contentBase64: normalizeText(safeInput?.contentBase64),
    storageKey: normalizeText(safeInput?.storageKey),
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

function classifyDocumentTypeByName(fileName = "") {
  const name = normalizeText(fileName).toLowerCase();
  if (!name) return "unknown";

  if (/\bitv\b|inspeccion|inspección/.test(name)) return "itv";
  if (/ficha|tecnic|t[eé]cnica|technical|spec/.test(name)) return "technical";
  if (/permiso|circulaci[oó]n|circulation/.test(name)) return "circulation";
  return "unknown";
}

function splitLegacyDocumentsByType(input = []) {
  const technicalSheetDocuments = [];
  const circulationPermitDocuments = [];
  const itvDocuments = [];
  const unknownDocuments = [];

  for (const item of normalizeAttachmentCollection(input)) {
    const type = classifyDocumentTypeByName(item?.name);
    if (type === "technical") {
      technicalSheetDocuments.push(item);
    } else if (type === "circulation") {
      circulationPermitDocuments.push(item);
    } else if (type === "itv") {
      itvDocuments.push(item);
    } else {
      unknownDocuments.push(item);
    }
  }

  return {
    technicalSheetDocuments,
    circulationPermitDocuments,
    itvDocuments,
    unknownDocuments,
  };
}

function normalizeVehicleAttachmentCollections(vehicle = {}) {
  if (!vehicle || typeof vehicle !== "object") {
    return null;
  }

  return {
    ...vehicle,
    photos: normalizeAttachmentCollection(vehicle?.photos),
    documents: normalizeAttachmentCollection(vehicle?.documents),
    technicalSheetDocuments: normalizeAttachmentCollection(vehicle?.technicalSheetDocuments),
    circulationPermitDocuments: normalizeAttachmentCollection(vehicle?.circulationPermitDocuments),
    itvDocuments: normalizeAttachmentCollection(vehicle?.itvDocuments),
    insuranceDocuments: normalizeAttachmentCollection(vehicle?.insuranceDocuments),
    maintenanceInvoices: normalizeAttachmentCollection(vehicle?.maintenanceInvoices),
  };
}

function isLikelyBase64Payload(value = "") {
  const normalized = normalizeText(value).replace(/\s/g, "");
  if (!normalized || normalized.length < 64) {
    return false;
  }

  return /^[A-Za-z0-9+/=]+$/.test(normalized);
}

function getGarageStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${GARAGE_STORAGE_PREFIX}.${normalizedEmail}` : GARAGE_STORAGE_PREFIX;
}

function parseGarageStorageRaw(raw = "") {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeVehicleAttachmentCollections(item)).filter((item) => item && item.id)
      : [];
  } catch {
    return [];
  }
}

function readGarageVehicles(currentUserEmail = "") {
  if (typeof window === "undefined") return [];

  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();

  try {
    const scopedRaw = window.localStorage.getItem(getGarageStorageKey(normalizedEmail));
    const scopedItems = parseGarageStorageRaw(scopedRaw || "");
    if (scopedItems.length > 0) {
      return scopedItems;
    }

    if (normalizedEmail) {
      const genericRaw = window.localStorage.getItem(GARAGE_STORAGE_PREFIX);
      const genericItems = parseGarageStorageRaw(genericRaw || "");
      if (genericItems.length > 0) {
        return genericItems;
      }
    }

    return [];
  } catch {
    return [];
  }
}

function writeGarageVehicles(currentUserEmail = "", items = []) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getGarageStorageKey(currentUserEmail), JSON.stringify(Array.isArray(items) ? items.slice(0, 20) : []));
  } catch {}
}

function buildVehicleTitle(vehicle = {}) {
  const customTitle = normalizeText(vehicle?.title);
  if (customTitle) return customTitle;
  const composed = [normalizeText(vehicle?.brand), normalizeText(vehicle?.model), normalizeText(vehicle?.year)].filter(Boolean).join(" ");
  return composed || "Vehículo";
}

function resolvePhotoPreviewSrc(photo = {}) {
  const rawContent = normalizeText(photo?.contentBase64);
  const mimeType = normalizeText(photo?.mimeType || photo?.fileMimeType).toLowerCase() || "image/jpeg";
  const storageKey = normalizeText(photo?.storageKey);
  const pointerPath = storageKey.startsWith("fs:")
    ? `/api/attachment-file?key=${encodeURIComponent(storageKey.slice(3))}&mimeType=${encodeURIComponent(mimeType)}&name=${encodeURIComponent(normalizeText(photo?.name || photo?.fileName) || "image")}`
    : "";

  if (rawContent) {
    if (rawContent.startsWith("data:image/")) {
      const payload = rawContent.split(",")[1] || "";
      return isLikelyBase64Payload(payload) ? rawContent : "";
    }

    if (isLikelyBase64Payload(rawContent)) {
      return `data:${mimeType};base64,${rawContent}`;
    }
  }

  const externalSource = [photo?.previewUrl, photo?.url, photo?.src, photo?.imageUrl, photo?.path, pointerPath]
    .map((candidate) => normalizeText(candidate))
    .find((candidate) => candidate);

  if (!externalSource) {
    return "";
  }

  if (
    externalSource.startsWith("http://") ||
    externalSource.startsWith("https://") ||
    externalSource.startsWith("data:image/") ||
    externalSource.startsWith("blob:") ||
    externalSource.startsWith("/")
  ) {
    return externalSource;
  }

  return externalSource;
}

function fileToBase64DataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentDataUrl(file = {}) {
  const rawContent = normalizeText(file?.contentBase64);
  if (!rawContent) {
    return "";
  }

  if (rawContent.startsWith("data:")) {
    return rawContent;
  }

  if (!isLikelyBase64Payload(rawContent)) {
    return "";
  }

  const mimeType = normalizeText(file?.mimeType || file?.fileMimeType) || "application/octet-stream";
  return `data:${mimeType};base64,${rawContent}`;
}

async function filesToAttachmentPayload(files = [], label = "archivo") {
  const result = [];
  for (const file of files) {
    if (Number(file?.size || 0) > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${label}: "${file?.name || "archivo"}" supera el máximo permitido de ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
    }

    try {
      const dataUrl = await fileToBase64DataUrl(file);
      const base64 = dataUrl.split(",")[1] || "";
      result.push({
        name: file.name,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        contentBase64: base64,
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error(`No se pudo leer el ${label}.`);
    }
  }
  return result;
}

function createEmptyForm() {
  return {
    nickname: "", brand: "", model: "", version: "",
    transmissionType: "", bodyType: "", cv: "", horsepower: "",
    color: "", seats: "", doors: "", location: "",
    environmentalLabel: "", lastIvt: "", nextIvt: "", co2: "",
    year: "", plate: "", mileage: "", fuel: "", price: "",
    policyCompany: "", policyNumber: "", coverageType: "",
    maintenanceType: "", maintenanceTitle: "", maintenanceNotes: "", notes: "",
  };
}

function vehicleToForm(vehicle = {}) {
  return {
    nickname: normalizeText(vehicle.title),
    brand: normalizeText(vehicle.brand),
    model: normalizeText(vehicle.model),
    version: normalizeText(vehicle.version),
    transmissionType: normalizeText(vehicle.transmissionType),
    bodyType: normalizeText(vehicle.bodyType),
    cv: normalizeText(vehicle.cv),
    horsepower: normalizeText(vehicle.horsepower),
    color: normalizeText(vehicle.color),
    seats: normalizeText(vehicle.seats),
    doors: normalizeText(vehicle.doors),
    location: normalizeText(vehicle.location),
    environmentalLabel: normalizeText(vehicle.environmentalLabel),
    lastIvt: normalizeText(vehicle.lastIvt),
    nextIvt: normalizeText(vehicle.nextIvt),
    co2: normalizeText(vehicle.co2),
    year: normalizeText(vehicle.year),
    plate: normalizeText(vehicle.plate),
    mileage: normalizeText(vehicle.mileage),
    fuel: normalizeText(vehicle.fuel),
    price: normalizeText(vehicle.price),
    policyCompany: normalizeText(vehicle.policyCompany),
    policyNumber: normalizeText(vehicle.policyNumber),
    coverageType: normalizeText(vehicle.coverageType),
    maintenanceType: normalizeText(vehicle.maintenanceType) || normalizeText(vehicle.initialMaintenance?.type),
    maintenanceTitle: normalizeText(vehicle.maintenanceTitle) || normalizeText(vehicle.initialMaintenance?.title),
    maintenanceNotes: normalizeText(vehicle.maintenanceNotes) || normalizeText(vehicle.initialMaintenance?.notes),
    notes: normalizeText(vehicle.notes),
  };
}

function mapErpTransmission(rawTx = "") {
  const v = String(rawTx).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (v.includes("auto") || v.includes("dsg") || v.includes("cvt") || v.includes("tiptronic")) return "automatico";
  if (v.includes("manual")) return "manual";
  return "";
}

function mapErpBodyType(c = "") {
  const v = String(c).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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

const SECTION_CARD_STYLE = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #ece8df",
  marginBottom: 10,
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 2px 10px rgba(0,0,0,0.03)",
};

const INPUT_STYLE = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 13,
  color: "#374151",
  background: "#fff",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const LABEL_STYLE = { display: "grid", gap: 5, fontSize: 12, color: "#6b7280" };

function SectionBlock({ title, subtitle, open, onToggle, children, openLabel = "Open", closeLabel = "Hide" }) {
  return (
    <div style={SECTION_CARD_STYLE}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", border: "none", background: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", cursor: "pointer", textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2, fontWeight: 400 }}>{subtitle}</div> : null}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#2563eb",
          background: "rgba(37,99,235,0.07)", borderRadius: 8, padding: "4px 10px",
          border: "1px solid rgba(37,99,235,0.14)", whiteSpace: "nowrap",
        }}>
          {open ? closeLabel : openLabel}
        </span>
      </button>
      {open ? <div style={{ borderTop: "1px solid #f1ede6", padding: "14px 16px" }}>{children}</div> : null}
    </div>
  );
}

export default function ServiceIdCarsManagePage({
  currentUserEmail = "",
  onGoBack,
  onGoHome,
  onOpenVehicle,
  onCreated,
  onCreateNew,
  onRequestAppointment,
  onRequestValuation,
  selectedVehicleId = "",
  startEditing = false,
  viewMode = "list",
}) {
  const { i18n } = useTranslation();
  const isEn = i18n.resolvedLanguage === "en";
  const txt = useCallback((es, en) => (isEn ? en : es), [isEn]);

  const isDetailView = viewMode === "detail";
  const isCreateView = viewMode === "create";
  const [isEditMode, setIsEditMode] = useState(startEditing);
  const [vehicles, setVehicles] = useState(() => readGarageVehicles(currentUserEmail));
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(createEmptyForm());
  const [openSections, setOpenSections] = useState({
    characteristics: true, marketplace: false,
    vehicleDocuments: false, insurance: false, maintenance: false, notes: false,
  });
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("info");
  const [isSaving, setIsSaving] = useState(false);
  const [publishStates, setPublishStates] = useState({});
  const [openManagePanelId, setOpenManagePanelId] = useState("");
  const [marketplaceOverrides, setMarketplaceOverrides] = useState({});
  const [marketplacePublishDialog, setMarketplacePublishDialog] = useState({ open: false, vehicle: null });

  // ERP catalog
  const [vehicleCatalogMode, setVehicleCatalogMode] = useState("erp");
  const [erpBrands, setErpBrands] = useState([]);
  const [erpModels, setErpModels] = useState([]);
  const [erpVersions, setErpVersions] = useState([]);
  const [erpBrandsLoading, setErpBrandsLoading] = useState(false);
  const [erpModelsLoading, setErpModelsLoading] = useState(false);
  const [erpVersionsLoading, setErpVersionsLoading] = useState(false);
  const [erpSelectedBrandId, setErpSelectedBrandId] = useState("");
  const [erpSelectedModelId, setErpSelectedModelId] = useState("");
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [pendingTechnicalSheetDocuments, setPendingTechnicalSheetDocuments] = useState([]);
  const [pendingOtherDocuments, setPendingOtherDocuments] = useState([]);
  const [pendingCirculationPermitDocuments, setPendingCirculationPermitDocuments] = useState([]);
  const [pendingItvDocuments, setPendingItvDocuments] = useState([]);
  const [pendingInsuranceDocuments, setPendingInsuranceDocuments] = useState([]);
  const [pendingMaintenanceInvoices, setPendingMaintenanceInvoices] = useState([]);
  const [removedStoredAttachmentKeys, setRemovedStoredAttachmentKeys] = useState({
    photos: [],
    technicalSheetDocuments: [],
    documents: [],
    circulationPermitDocuments: [],
    itvDocuments: [],
    insuranceDocuments: [],
    maintenanceInvoices: [],
  });

  const dragPhotoIdxRef = useRef(null);
  const marketplacePublishDialogRef = useRef(null);
  const marketplacePublishPrimaryBtnRef = useRef(null);
  const marketplacePublishTriggerRef = useRef(null);

  const photoInputRef = useRef(null);
  const technicalSheetInputRef = useRef(null);
  const otherDocInputRef = useRef(null);
  const circulationPermitInputRef = useRef(null);
  const itvInputRef = useRef(null);
  const insuranceDocInputRef = useRef(null);
  const maintenanceInputRef = useRef(null);

  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      const dateA = normalizeText(a?.updatedAt || a?.createdAt);
      const dateB = normalizeText(b?.updatedAt || b?.createdAt);
      return dateA < dateB ? 1 : -1;
    });
  }, [vehicles]);

  const selectedVehicle = useMemo(() => {
    if (!isDetailView) {
      return null;
    }
    return sortedVehicles.find((vehicle) => normalizeText(vehicle?.id) === normalizeText(selectedVehicleId)) || null;
  }, [isDetailView, selectedVehicleId, sortedVehicles]);

  const visibleVehicles = useMemo(() => {
    if (isDetailView) {
      return selectedVehicle ? [selectedVehicle] : [];
    }
    return sortedVehicles;
  }, [isDetailView, selectedVehicle, sortedVehicles]);

  const loadVehicles = useCallback(async () => {
    const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
    setVehicles(readGarageVehicles(normalizedEmail));
    if (!normalizedEmail) return;
    try {
      const { response, data } = await getGarageVehiclesJson(normalizedEmail);
      if (response.ok && Array.isArray(data?.vehicles)) {
        setVehicles(data.vehicles.map((item) => normalizeVehicleAttachmentCollections(item)).filter((item) => item && item.id));
      }
    } catch {}
  }, [currentUserEmail]);

  useEffect(() => { void loadVehicles(); }, [loadVehicles]);
  useEffect(() => { writeGarageVehicles(currentUserEmail, vehicles); }, [currentUserEmail, vehicles]);
  useEffect(() => { setIsEditMode(startEditing); }, [startEditing]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isCreateView) return;
    setIsCreating(true);
    setEditingVehicleId("");
    setForm(createEmptyForm());
    showFeedback(txt("Completa la ficha y guarda tu nuevo IDCar.", "Complete the form and save your new IDCar."), "info");
  }, [isCreateView, txt]);

  useEffect(() => {
    if (typeof window === "undefined" || isDetailView || isCreateView) return;
    const action = normalizeText(window.sessionStorage.getItem(IDCAR_PENDING_ACTION_KEY)).toLowerCase();
    if (!action) return;
    window.sessionStorage.removeItem(IDCAR_PENDING_ACTION_KEY);
    if (action === "create") {
      setIsCreating(true);
      setEditingVehicleId("");
      setForm(createEmptyForm());
      showFeedback(txt("Completa la ficha y guarda tu nuevo IDCar.", "Complete the form and save your new IDCar."), "info");
    }
  }, [isDetailView, isCreateView, isEn, txt]);

  useEffect(() => {
    if (!isDetailView) {
      return;
    }
    if (!selectedVehicle) {
      setEditingVehicleId("");
      setForm(createEmptyForm());
      return;
    }
    setEditingVehicleId(selectedVehicle.id);
    setIsCreating(false);
    setForm(vehicleToForm(selectedVehicle));
  }, [isDetailView, selectedVehicle]);

  // Load ERP brands once
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

  // Marketplace publish modal — keyboard trap & focus
  useEffect(() => {
    if (!marketplacePublishDialog.open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") { closeMarketplacePublishDialog(); return; }
      if (e.key !== "Tab") return;
      const dialog = marketplacePublishDialogRef.current;
      if (!dialog) return;
      const els = Array.from(dialog.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")).filter((el) => !el.disabled);
      if (!els.length) { e.preventDefault(); dialog.focus(); return; }
      const first = els[0]; const last = els[els.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey) { if (!inside || document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (!inside || document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [marketplacePublishDialog.open]);

  useEffect(() => {
    if (!marketplacePublishDialog.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [marketplacePublishDialog.open]);

  useEffect(() => {
    if (!marketplacePublishDialog.open) return;
    const id = window.requestAnimationFrame(() => marketplacePublishPrimaryBtnRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [marketplacePublishDialog.open]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const showFeedback = (message, tone = "info") => {
    setFeedback(message);
    setFeedbackTone(tone);
  };
  const feedbackColor = feedbackTone === "error" ? "#b91c1c" : feedbackTone === "success" ? "#047857" : "#1d4ed8";

  // Photo reorder helpers
  const updateActiveVehiclePhotos = (newPhotos) => {
    setVehicles((prev) =>
      prev.map((v) => normalizeText(v?.id) === normalizeText(editingVehicleId) ? { ...v, photos: newPhotos } : v)
    );
  };
  const reorderStoredPhotos = (fromIdx, toIdx) => {
    const activeVehicle = vehicles.find((v) => normalizeText(v?.id) === normalizeText(editingVehicleId));
    const photos = Array.isArray(activeVehicle?.photos) ? [...activeVehicle.photos] : [];
    const [moved] = photos.splice(fromIdx, 1);
    photos.splice(toIdx, 0, moved);
    updateActiveVehiclePhotos(photos);
  };
  const setStoredPhotoAsPrimary = (idx) => {
    if (idx === 0) return;
    const activeVehicle = vehicles.find((v) => normalizeText(v?.id) === normalizeText(editingVehicleId));
    const photos = Array.isArray(activeVehicle?.photos) ? [...activeVehicle.photos] : [];
    const [photo] = photos.splice(idx, 1);
    updateActiveVehiclePhotos([photo, ...photos]);
  };
  const deleteStoredPhoto = (idx) => {
    const activeVehicle = vehicles.find((v) => normalizeText(v?.id) === normalizeText(editingVehicleId));
    const photos = Array.isArray(activeVehicle?.photos) ? [...activeVehicle.photos] : [];
    photos.splice(idx, 1);
    updateActiveVehiclePhotos(photos);
  };

  // Publish modal handlers
  const closeMarketplacePublishDialog = () => {
    setMarketplacePublishDialog({ open: false, vehicle: null });
    const trigger = marketplacePublishTriggerRef.current;
    if (trigger && typeof trigger.focus === "function") window.requestAnimationFrame(() => trigger.focus());
    marketplacePublishTriggerRef.current = null;
  };
  const confirmMarketplacePublish = () => {
    const vehicle = marketplacePublishDialog.vehicle;
    if (!vehicle) { closeMarketplacePublishDialog(); return; }
    const vid = normalizeText(vehicle.id);
    const effectivePrice = normalizeText(marketplacePublishDialog.modalPrice) || normalizeText(vehicle.price);
    if (!effectivePrice) {
      showFeedback(txt("Introduce un precio antes de publicar.", "Enter a price before publishing."), "error");
      return;
    }
    // If price was entered in modal, persist it to the vehicle
    if (normalizeText(marketplacePublishDialog.modalPrice)) {
      const fullVehicle = vehicles.find((v) => normalizeText(v?.id) === vid);
      if (fullVehicle) {
        const updatedVehicle = { ...fullVehicle, price: effectivePrice };
        setVehicles((prev) => prev.map((v) => normalizeText(v?.id) === vid ? updatedVehicle : v));
        updateForm("price", effectivePrice);
        // Save price to backend in background
        void postGarageVehicleAddJson(normalizeText(currentUserEmail).toLowerCase(), updatedVehicle);
      }
    }
    setMarketplaceOverrides((s) => ({ ...s, [vid]: "active_sale" }));
    postVehicleStateUpsertJson(normalizeText(currentUserEmail).toLowerCase(), {
      vehicleId: vid, state: "active_sale", notes: `Precio publicado: ${effectivePrice} EUR`,
    }).catch(() => {
      setMarketplaceOverrides((s) => ({ ...s, [vid]: "owned" }));
      showFeedback(txt("No se pudo guardar el estado en el Marketplace.", "Could not save Marketplace status."), "error");
    });
    showFeedback(txt("¡Vehículo publicado en el Marketplace!", "Vehicle published in the Marketplace!"), "success");
    closeMarketplacePublishDialog();
  };

  const resetFileUploads = () => {
    setPendingPhotos([]); setPendingTechnicalSheetDocuments([]); setPendingOtherDocuments([]); setPendingCirculationPermitDocuments([]); setPendingItvDocuments([]);
    setPendingInsuranceDocuments([]); setPendingMaintenanceInvoices([]);
    setRemovedStoredAttachmentKeys({
      photos: [],
      technicalSheetDocuments: [],
      documents: [],
      circulationPermitDocuments: [],
      itvDocuments: [],
      insuranceDocuments: [],
      maintenanceInvoices: [],
    });
  };

  const defaultSections = { characteristics: true, marketplace: false, vehicleDocuments: false, insurance: false, maintenance: false, notes: false };

  const startCreate = () => {
    if (typeof onCreateNew === "function") {
      onCreateNew();
      return;
    }
    setEditingVehicleId("");
    setIsCreating(true);
    setForm(createEmptyForm());
    setOpenSections(defaultSections);
    resetFileUploads();
    showFeedback(txt("Completa la ficha y guarda tu nuevo IDCar.", "Complete the form and save your new IDCar."), "info");
  };

  const openVehicleDetail = (vehicle, wantEdit = false) => {
    if (typeof onOpenVehicle === "function") {
      onOpenVehicle(vehicle, wantEdit);
      return;
    }
    setEditingVehicleId(vehicle.id);
    setIsCreating(false);
    setForm(vehicleToForm(vehicle));
    setOpenSections(defaultSections);
    resetFileUploads();
    showFeedback(
      txt(
        `Editando ${buildVehicleTitle(vehicle)}. Pulsa Guardar cambios para confirmar.`,
        `Editing ${buildVehicleTitle(vehicle)}. Press Save changes to confirm.`
      ),
      "info"
    );
  };

  const cancelEdit = () => {
    if (isDetailView || isCreateView) {
      resetFileUploads();
      showFeedback("", "info");
      onGoBack?.();
      return;
    }
    setEditingVehicleId("");
    setIsCreating(false);
    setForm(createEmptyForm());
    resetFileUploads();
    showFeedback(txt("Edición cancelada.", "Edit canceled."), "info");
  };

  const handleRemove = async (vehicleId) => {
    const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
    let nextVehicles = vehicles.filter((item) => item.id !== vehicleId);
    if (normalizedEmail) {
      try {
        const { response, data } = await postGarageVehicleRemoveJson(normalizedEmail, vehicleId);
        if (response.ok && Array.isArray(data?.vehicles)) nextVehicles = data.vehicles.filter((item) => item && item.id);
      } catch {}
    }
    setVehicles(nextVehicles);
    if (isDetailView) {
      showFeedback(txt("IDCar eliminado.", "IDCar removed."), "success");
      onGoBack?.();
      return;
    }
    if (editingVehicleId === vehicleId) cancelEdit();
    showFeedback(txt("IDCar eliminado.", "IDCar removed."), "success");
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    showFeedback(txt("Guardando cambios...", "Saving changes..."), "info");

    try {
      const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
      if (!normalizedEmail) {
        throw new Error(txt("Tu sesión no está activa. Inicia sesión de nuevo antes de guardar el IDCar.", "Your session is not active. Sign in again before saving the IDCar."));
      }

      if (!normalizeText(form.brand) || !normalizeText(form.model)) {
        throw new Error(txt("Debes introducir al menos la marca y el modelo del vehículo.", "You must enter at least the vehicle brand and model."));
      }

      const baseVehicle = editingVehicleId ? vehicles.find((v) => v.id === editingVehicleId) || {} : {};
      const vehicleId = editingVehicleId || `veh-${Date.now()}`;

      const photosPayload = await filesToAttachmentPayload(pendingPhotos, "La foto del vehículo");
      const technicalSheetDocumentsPayload = await filesToAttachmentPayload(pendingTechnicalSheetDocuments, "La ficha técnica");
      const otherDocumentsPayload = await filesToAttachmentPayload(pendingOtherDocuments, "Otros documentos");
      const circulationPermitDocumentsPayload = await filesToAttachmentPayload(pendingCirculationPermitDocuments, "El permiso de circulación");
      const itvDocumentsPayload = await filesToAttachmentPayload(pendingItvDocuments, "La documentación ITV");
      const insuranceDocumentsPayload = await filesToAttachmentPayload(pendingInsuranceDocuments, "El documento del seguro");
      const maintenanceInvoicesPayload = await filesToAttachmentPayload(pendingMaintenanceInvoices, "La factura de mantenimiento");

      const titleVal = normalizeText(form.nickname) || [normalizeText(form.brand), normalizeText(form.model)].filter(Boolean).join(" ") || txt("Vehículo", "Vehicle");

      const filterPersisted = (groupKey, source) => {
        const items = Array.isArray(source) ? source : [];
        return items.filter((item) => !isStoredAttachmentRemoved(groupKey, item));
      };

      const persistedPhotos = filterPersisted("photos", baseVehicle.photos);
      const persistedDocuments = filterPersisted("documents", baseVehicle.documents);
      const persistedTechnicalSheetDocuments = filterPersisted("technicalSheetDocuments", baseVehicle.technicalSheetDocuments);
      const persistedCirculationPermitDocuments = filterPersisted("circulationPermitDocuments", baseVehicle.circulationPermitDocuments);
      const persistedItvDocuments = filterPersisted("itvDocuments", baseVehicle.itvDocuments);
      const persistedInsuranceDocuments = filterPersisted("insuranceDocuments", baseVehicle.insuranceDocuments);
      const persistedMaintenanceInvoices = filterPersisted("maintenanceInvoices", baseVehicle.maintenanceInvoices);

      const legacySplit = splitLegacyDocumentsByType(
        persistedDocuments.filter(
          (item) =>
            !isStoredAttachmentRemoved("technicalSheetDocuments", item) &&
            !isStoredAttachmentRemoved("circulationPermitDocuments", item) &&
            !isStoredAttachmentRemoved("itvDocuments", item)
        )
      );

      const nextVehicle = {
        ...baseVehicle, id: vehicleId, title: titleVal,
        brand: normalizeText(form.brand), model: normalizeText(form.model), version: normalizeText(form.version),
        transmissionType: normalizeText(form.transmissionType), bodyType: normalizeText(form.bodyType),
        cv: normalizeText(form.cv), horsepower: normalizeText(form.horsepower), color: normalizeText(form.color),
        seats: normalizeText(form.seats), doors: normalizeText(form.doors), location: normalizeText(form.location),
        environmentalLabel: normalizeText(form.environmentalLabel), lastIvt: normalizeText(form.lastIvt),
        nextIvt: normalizeText(form.nextIvt), co2: normalizeText(form.co2), year: normalizeText(form.year),
        plate: normalizeText(form.plate).toUpperCase(), mileage: normalizeText(form.mileage),
        fuel: normalizeText(form.fuel), price: normalizeText(form.price),
        policyCompany: normalizeText(form.policyCompany), policyNumber: normalizeText(form.policyNumber),
        coverageType: normalizeText(form.coverageType), maintenanceType: normalizeText(form.maintenanceType),
        maintenanceTitle: normalizeText(form.maintenanceTitle), maintenanceNotes: normalizeText(form.maintenanceNotes),
        notes: normalizeText(form.notes),
        photos: [...persistedPhotos, ...photosPayload],
        documents: [
          ...legacySplit.unknownDocuments,
          ...persistedDocuments.filter((d) => !legacySplit.unknownDocuments.some((u) => u.name === d.name)),
          ...otherDocumentsPayload,
        ],
        technicalSheetDocuments: [
          ...persistedTechnicalSheetDocuments,
          ...legacySplit.technicalSheetDocuments,
          ...technicalSheetDocumentsPayload,
        ],
        circulationPermitDocuments: [
          ...persistedCirculationPermitDocuments,
          ...legacySplit.circulationPermitDocuments,
          ...circulationPermitDocumentsPayload,
        ],
        itvDocuments: [
          ...persistedItvDocuments,
          ...legacySplit.itvDocuments,
          ...itvDocumentsPayload,
        ],
        insuranceDocuments: [...persistedInsuranceDocuments, ...insuranceDocumentsPayload],
        maintenanceInvoices: [...persistedMaintenanceInvoices, ...maintenanceInvoicesPayload],
        initialMaintenance: {
          type: normalizeText(form.maintenanceType) || "maintenance",
          title: normalizeText(form.maintenanceTitle),
          notes: normalizeText(form.maintenanceNotes),
          invoices: [...persistedMaintenanceInvoices, ...maintenanceInvoicesPayload],
        },
        updatedAt: new Date().toISOString(),
        createdAt: normalizeText(baseVehicle?.createdAt) || new Date().toISOString(),
      };

      let nextVehicles = editingVehicleId
        ? vehicles.map((item) => (item.id === editingVehicleId ? nextVehicle : item))
        : [nextVehicle, ...vehicles].slice(0, 20);

      if (normalizedEmail) {
        const { response, data } = await postGarageVehicleAddJson(normalizedEmail, nextVehicle);
        if (!response.ok) {
          throw new Error(normalizeText(data?.error) || txt("No se pudo guardar el IDCar en servidor.", "Could not save the IDCar on server."));
        }

        const persistedSummary = data?.persistedDocumentSummary;
        if (technicalSheetDocumentsPayload.length > 0 && Number(persistedSummary?.technicalSheetDocuments || 0) === 0) {
          throw new Error(txt("El servidor no confirmó la persistencia de la ficha técnica.", "The server did not confirm technical sheet persistence."));
        }
        if (otherDocumentsPayload.length > 0 && Number(persistedSummary?.documents || 0) === 0) {
          throw new Error(txt("El servidor no confirmó la persistencia de otros documentos.", "The server did not confirm other document persistence."));
        }
        if (circulationPermitDocumentsPayload.length > 0 && Number(persistedSummary?.circulationPermitDocuments || 0) === 0) {
          throw new Error(txt("El servidor no confirmó la persistencia del permiso de circulación.", "The server did not confirm circulation permit persistence."));
        }
        if (itvDocumentsPayload.length > 0 && Number(persistedSummary?.itvDocuments || 0) === 0) {
          throw new Error(txt("El servidor no confirmó la persistencia de la documentación ITV.", "The server did not confirm MOT documentation persistence."));
        }
        if (insuranceDocumentsPayload.length > 0 && Number(persistedSummary?.insuranceDocuments || 0) === 0) {
          throw new Error(txt("El servidor no confirmó la persistencia de los documentos del seguro.", "The server did not confirm insurance document persistence."));
        }
        if (maintenanceInvoicesPayload.length > 0 && Number(persistedSummary?.maintenanceInvoices || 0) === 0) {
          throw new Error(txt("El servidor no confirmó la persistencia de las facturas de mantenimiento.", "The server did not confirm maintenance invoice persistence."));
        }

        if (!Array.isArray(data?.vehicles)) {
          throw new Error(txt("La API devolvio una respuesta incompleta al guardar el IDCar.", "The API returned an incomplete response while saving the IDCar."));
        }

        nextVehicles = data.vehicles.filter((item) => item && item.id);
        const persistedByServer = nextVehicles.find((item) => normalizeText(item?.id) === normalizeText(vehicleId));
        if (!persistedByServer) {
          throw new Error(txt("El servidor no devolvió el IDCar recién guardado. Revisa la persistencia en producción.", "The server did not return the saved IDCar. Check production persistence."));
        }

        if (normalizeText(form.policyNumber) && !normalizeText(persistedByServer?.policyNumber)) {
          throw new Error(txt("El servidor no confirmó los datos de seguro (número de póliza).", "The server did not confirm insurance data (policy number)."));
        }

        if (normalizeText(form.maintenanceTitle) && !normalizeText(persistedByServer?.maintenanceTitle)) {
          throw new Error(txt("El servidor no confirmó los datos de mantenimiento (título).", "The server did not confirm maintenance data (title)."));
        }
      }

      const persistedVehicle = nextVehicles.find((item) => normalizeText(item?.id) === normalizeText(vehicleId)) || nextVehicle;

      setVehicles(nextVehicles);
      setEditingVehicleId(persistedVehicle.id);
      setIsCreating(false);
      setForm(vehicleToForm(persistedVehicle));
      resetFileUploads();
      // Re-fetch from server so photos/docs show Supabase URLs instead of base64
      void loadVehicles();
      const uploadedFiles =
        photosPayload.length +
        technicalSheetDocumentsPayload.length +
        otherDocumentsPayload.length +
        circulationPermitDocumentsPayload.length +
        itvDocumentsPayload.length +
        insuranceDocumentsPayload.length +
        maintenanceInvoicesPayload.length;

      showFeedback(
        `${editingVehicleId
          ? txt(`IDCar "${titleVal}" actualizado`, `IDCar "${titleVal}" updated`)
          : txt(`IDCar "${titleVal}" creado y sincronizado`, `IDCar "${titleVal}" created and synced`)} ${txt("correctamente.", "successfully.")}${uploadedFiles > 0 ? ` ${uploadedFiles} ${txt("archivo(s) procesado(s).", "file(s) processed.")}` : ""}`,
        "success"
      );
      if (isCreateView && typeof onCreated === "function") {
        onCreated(persistedVehicle);
      }
    } catch (error) {
      const message = normalizeText(error?.message) || txt("No se pudo guardar el IDCar. Revisa tu sesion e intentalo de nuevo.", "Could not save IDCar. Check your session and try again.");
      showFeedback(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (vehicleId, price, action = "publish") => {
    if (!vehicleId) return;
    setPublishStates((prev) => ({ ...prev, [vehicleId]: { status: "loading" } }));
    try {
      const res = await fetch("/api/vehicle-publish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, price, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setPublishStates((prev) => ({ ...prev, [vehicleId]: { status: "error", message: data.error || "Error al publicar" } }));
      } else {
        setPublishStates((prev) => ({ ...prev, [vehicleId]: { status: action === "unpublish" ? "unpublished" : "published" } }));
        if (action === "publish") {
          showFeedback(txt("¡Vehículo publicado en el Marketplace!", "Vehicle published in the Marketplace!"), "success");
        } else {
          showFeedback(txt("Oferta retirada del Marketplace.", "Offer removed from Marketplace."), "info");
        }
      }
    } catch (err) {
      setPublishStates((prev) => ({ ...prev, [vehicleId]: { status: "error", message: err.message } }));
    }
  };

  // ─── render helpers ─────────────────────────────────────────────────
  const renderField = (label, key, opts = {}) => (
    <label key={key} style={LABEL_STYLE}>
      {label}
      {opts.type === "select" ? (
        <select value={form[key]} onChange={(e) => updateForm(key, e.target.value)} style={INPUT_STYLE}>
          <option value="">{txt("Selecciona", "Select")}</option>
          {(opts.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input value={form[key]} onChange={(e) => updateForm(key, e.target.value)} placeholder={opts.placeholder || ""} style={INPUT_STYLE} />
      )}
    </label>
  );

  const getAttachmentLink = (file = {}) => {
    const pathLink = normalizeText(file?.path);
    if (pathLink) return pathLink;
    const urlLink = normalizeText(file?.url);
    if (urlLink) return urlLink;
    const storageKey = normalizeText(file?.storageKey);
    if (storageKey.startsWith("fs:")) {
      const mimeType = normalizeText(file?.mimeType || file?.fileMimeType) || "application/octet-stream";
      const fileName = normalizeText(file?.name || file?.fileName) || "archivo";
      return `/api/attachment-file?key=${encodeURIComponent(storageKey.slice(3))}&mimeType=${encodeURIComponent(mimeType)}&name=${encodeURIComponent(fileName)}`;
    }
    return "";
  };

  const triggerAttachmentDownload = (file = {}) => {
    if (typeof window === "undefined") {
      return;
    }

    const externalLink = getAttachmentLink(file);
    const dataUrl = getAttachmentDataUrl(file);
    const href = externalLink || dataUrl;
    if (!href) {
      return;
    }

    const fileName = normalizeText(file?.name) || txt("archivo", "file");
    const anchor = window.document.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    window.document.body.appendChild(anchor);
    anchor.click();
    window.document.body.removeChild(anchor);
  };

  const openAttachmentPreview = (file = {}) => {
    if (typeof window === "undefined") {
      return;
    }

    const href = getAttachmentLink(file) || getAttachmentDataUrl(file);
    if (!href) {
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
  };

  const getAttachmentIdentityKey = (file = {}) => {
    return [
      normalizeText(file?.path),
      normalizeText(file?.url),
      normalizeText(file?.name),
      String(Number(file?.size || 0)),
      normalizeText(file?.mimeType || file?.fileMimeType),
    ].join("|");
  };

  const isStoredAttachmentRemoved = (groupKey = "", file = {}) => {
    const fileKey = getAttachmentIdentityKey(file);
    if (!groupKey || !fileKey) {
      return false;
    }

    const groupKeys = Array.isArray(removedStoredAttachmentKeys[groupKey]) ? removedStoredAttachmentKeys[groupKey] : [];
    return groupKeys.includes(fileKey);
  };

  const markStoredAttachmentForRemoval = (groupKey = "", file = {}) => {
    const fileKey = getAttachmentIdentityKey(file);
    if (!groupKey || !fileKey) {
      return;
    }

    setRemovedStoredAttachmentKeys((prev) => {
      const currentKeys = Array.isArray(prev[groupKey]) ? prev[groupKey] : [];
      if (currentKeys.includes(fileKey)) {
        return prev;
      }

      return {
        ...prev,
        [groupKey]: [...currentKeys, fileKey],
      };
    });
  };

  const renderFileUpload = (label, pendingFiles, setPending, inputRef, accept, colorHex, storedFiles = [], storedGroupKey = "") => (
    <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#6b7280" }}>
      <div style={{ fontWeight: 700, color: "#374151" }}>{label}</div>
      <input ref={inputRef} type="file" multiple accept={accept} onChange={(e) => setPending(Array.from(e.target.files || []))} style={{ display: "none" }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, width: "100%", background: `${colorHex}1a`, color: colorHex,
          border: `1px solid ${colorHex}30`, borderRadius: 10, padding: "9px 12px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        <span>{txt("Adjuntar archivo", "Attach file")}</span>
        <span style={{ fontSize: 11 }}>{storedFiles.length} {txt("guardados", "saved")} · {pendingFiles.length} {txt("seleccionados", "selected")}</span>
      </button>
      {pendingFiles.some((file) => Number(file?.size || 0) > MAX_ATTACHMENT_BYTES) ? (
        <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
          {txt("Hay archivos seleccionados que superan el máximo de", "Some selected files exceed the maximum of")} {formatBytes(MAX_ATTACHMENT_BYTES)}.
        </div>
      ) : null}
      {storedFiles.filter((file) => !isStoredAttachmentRemoved(storedGroupKey, file)).length ? (
        storedGroupKey === "photos" ? (
          /* Photo grid with drag-reorder and primary star */
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fcfcfc", padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {txt("Guardadas · arrastra para reordenar", "Saved · drag to reorder")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(72px,1fr))", gap: 6 }}>
              {storedFiles
                .filter((file) => !isStoredAttachmentRemoved(storedGroupKey, file))
                .map((photo, idx) => {
                  const src = resolvePhotoPreviewSrc(photo);
                  if (!src) return null;
                  return (
                    <div key={`${getAttachmentIdentityKey(photo)}-${idx}`}
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
                      style={{ position: "relative", cursor: "grab", borderRadius: 8, overflow: "hidden", border: idx === 0 ? "2px solid #f59e0b" : "1px solid rgba(0,0,0,0.1)" }}>
                      <img src={src} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 999, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {idx + 1}
                      </div>
                      {idx === 0 && (
                        <div style={{ position: "absolute", top: 3, left: 3, background: "#f59e0b", color: "#fff", fontSize: 7, fontWeight: 800, borderRadius: 999, padding: "2px 4px" }}>⭐</div>
                      )}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.62)", display: "flex", gap: 3, padding: "3px 4px", justifyContent: "center" }}>
                        {idx !== 0 && (
                          <button type="button" onClick={() => setStoredPhotoAsPrimary(idx)} title={txt("Marcar como principal", "Set as primary")}
                            style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, padding: "2px 5px", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>★</button>
                        )}
                        <button type="button" onClick={() => deleteStoredPhoto(idx)} title={txt("Eliminar", "Delete")}
                          style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, padding: "2px 5px", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fcfcfc", padding: "8px 10px" }}>
          <div style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {txt("Guardados en ficha", "Saved in profile")}
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>
            {storedFiles
              .filter((file) => !isStoredAttachmentRemoved(storedGroupKey, file))
              .map((file, index) => {
                const hasExternalLink = Boolean(getAttachmentLink(file));
                const hasDataLink = Boolean(getAttachmentDataUrl(file));
                const fileName = normalizeText(file?.name) || `${txt("Archivo", "File")} ${index + 1}`;
                return (
                  <div key={`${getAttachmentIdentityKey(file)}-${index}`} style={{ border: "1px solid #eef2f7", borderRadius: 8, padding: "6px 8px", background: "#fff" }}>
                    <div style={{ fontSize: 11.5, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600, marginBottom: 5 }}>
                      {fileName}
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {(hasExternalLink || hasDataLink) ? (
                      <button type="button" onClick={() => openAttachmentPreview(file)} title={txt("Abrir", "Open")}
                        style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#3730a3", borderRadius: 6, fontSize: 13, lineHeight: 1, padding: "3px 7px", cursor: "pointer" }}>↗</button>
                    ) : null}
                    {(hasExternalLink || hasDataLink) ? (
                      <button type="button" onClick={() => triggerAttachmentDownload(file)} title={txt("Descargar", "Download")}
                        style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, fontSize: 13, lineHeight: 1, padding: "3px 7px", cursor: "pointer" }}>↓</button>
                    ) : null}
                    <button type="button" onClick={() => markStoredAttachmentForRemoval(storedGroupKey, file)} title={txt("Eliminar", "Delete")}
                      style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, lineHeight: 1, padding: "3px 7px", cursor: "pointer", marginLeft: "auto" }}>✕</button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        )
      ) : null}
    </div>
  );

  const getFirstPhotoSrc = (vehicle) => {
    for (const photo of (Array.isArray(vehicle.photos) ? vehicle.photos : [])) {
      const src = resolvePhotoPreviewSrc(photo);
      if (src) return src;
    }
    return "";
  };

  const getIsPublished = (vehicle) => {
    const vid = normalizeText(vehicle?.id);
    if (vid in marketplaceOverrides) return marketplaceOverrides[vid] === "active_sale";
    return normalizeText(vehicle?.marketplaceState) === "active_sale";
  };

  const handleMarketplaceToggle = (vehicle, targetState, triggerElement) => {
    if (targetState === "active_sale") {
      // Show confirmation modal before publishing
      marketplacePublishTriggerRef.current = triggerElement || null;
      setMarketplacePublishDialog({
        open: true,
        vehicle: {
          id: normalizeText(vehicle?.id),
          title: [normalizeText(vehicle?.brand), normalizeText(vehicle?.model)].filter(Boolean).join(" ") || txt("Vehículo", "Vehicle"),
          price: normalizeText(vehicle?.price),
        },
      });
      return;
    }
    // Unpublish directly — no confirmation needed
    const vid = normalizeText(vehicle?.id);
    setMarketplaceOverrides((s) => ({ ...s, [vid]: "owned" }));
    postVehicleStateUpsertJson(normalizeText(currentUserEmail).toLowerCase(), { vehicleId: vid, state: "owned", notes: "" })
      .then(() => showFeedback(txt("Oferta retirada del Marketplace.", "Offer removed from Marketplace."), "info"))
      .catch(() => {
        setMarketplaceOverrides((s) => ({ ...s, [vid]: "active_sale" }));
        showFeedback(txt("No se pudo actualizar el estado en el Marketplace.", "Could not update Marketplace status."), "error");
      });
  };

  const renderManagePanel = (vehicle) => {
    const isPublished = getIsPublished(vehicle);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 7 }}>
        <button type="button"
          onClick={() => typeof onRequestAppointment === "function" && onRequestAppointment(vehicle)}
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#b45309", borderRadius: 8, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {txt("Pedir cita", "Request appointment")}
        </button>
        <button type="button"
          onClick={() => typeof onRequestValuation === "function" && onRequestValuation(vehicle)}
          style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.22)", color: "#1d4ed8", borderRadius: 8, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {txt("Solicitar tasación", "Request valuation")}
        </button>
        <button type="button"
          onClick={() => {
            if (!isDetailView) {
              openVehicleDetail(vehicle, true);
            } else {
              setIsEditMode(true);
            }
            setOpenSections((prev) => ({ ...prev, insurance: true }));
          }}
          style={{ background: "rgba(14,116,144,0.08)", border: "1px solid rgba(14,116,144,0.22)", color: "#0e7490", borderRadius: 8, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {txt("Gestionar seguro", "Manage insurance")}
        </button>
        {isPublished ? (
          <button type="button"
            onClick={() => handleMarketplaceToggle(vehicle, "owned")}
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#dc2626", borderRadius: 8, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {txt("Despublicar del Marketplace", "Remove from Marketplace")}
          </button>
        ) : (
          <button type="button"
            onClick={(e) => handleMarketplaceToggle(vehicle, "active_sale", e.currentTarget)}
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", color: "#047857", borderRadius: 8, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {txt("Publicar Marketplace VO", "Publish to Marketplace")}
          </button>
        )}
      </div>
    );
  };

  const renderVehicleEditor = () => {
    const activeVehicle = (editingVehicleId
      ? vehicles.find((vehicle) => normalizeText(vehicle?.id) === normalizeText(editingVehicleId))
      : null) || (isDetailView ? selectedVehicle : null) || {};

    const storedPhotos = Array.isArray(activeVehicle?.photos) ? activeVehicle.photos : [];
    const storedTechnicalSheetDocuments = Array.isArray(activeVehicle?.technicalSheetDocuments) ? activeVehicle.technicalSheetDocuments : [];
    const storedOtherDocuments = Array.isArray(activeVehicle?.documents) ? activeVehicle.documents : [];
    const storedCirculationPermitDocuments = Array.isArray(activeVehicle?.circulationPermitDocuments) ? activeVehicle.circulationPermitDocuments : [];
    const storedItvDocuments = Array.isArray(activeVehicle?.itvDocuments) ? activeVehicle.itvDocuments : [];
    const storedInsuranceDocuments = Array.isArray(activeVehicle?.insuranceDocuments) ? activeVehicle.insuranceDocuments : [];
    const storedMaintenanceInvoices = Array.isArray(activeVehicle?.maintenanceInvoices) ? activeVehicle.maintenanceInvoices : [];

    const preparedVehicleDocuments = pendingPhotos.length + pendingTechnicalSheetDocuments.length + pendingOtherDocuments.length + pendingCirculationPermitDocuments.length + pendingItvDocuments.length;
    const storedVehicleDocuments = storedPhotos.length + storedTechnicalSheetDocuments.length + storedOtherDocuments.length + storedCirculationPermitDocuments.length + storedItvDocuments.length;

    return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#1f2937", marginBottom: 4, padding: "0 2px" }}>
        {isCreating ? txt("Añadir vehículo propio", "Add your own vehicle") : txt("Editar vehículo", "Edit vehicle")}
      </div>
      <p style={{ fontSize: 12.5, color: "#9ca3af", marginBottom: 12, padding: "0 2px", fontWeight: 300 }}>
        {txt("Crea tu garage personal con fotos, documentación y acciones rápidas.", "Create your personal garage with photos, documents, and quick actions.")}
      </p>

      <SectionBlock title={txt("Características del vehículo", "Vehicle characteristics")} subtitle={txt("Datos base, ficha técnica y atributos comerciales", "Base data, technical sheet and commercial attributes")}
        open={openSections.characteristics} onToggle={() => toggleSection("characteristics")}
        openLabel={txt("Abrir", "Open")} closeLabel={txt("Ocultar", "Hide")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {renderField(txt("Alias / nombre", "Alias / name"), "nickname", { placeholder: txt("Coche familiar", "Family car") })}
        </div>

        {/* ERP catalog mode toggle */}
        <div style={{ margin: "10px 0 6px", display: "flex", gap: 6, alignItems: "center" }}>
          <button type="button"
            onClick={() => setVehicleCatalogMode("erp")}
            style={{ fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "5px 12px", border: "1px solid", cursor: "pointer",
              background: vehicleCatalogMode === "erp" ? "#2563eb" : "transparent",
              color: vehicleCatalogMode === "erp" ? "#fff" : "#6b7280",
              borderColor: vehicleCatalogMode === "erp" ? "#2563eb" : "#d1d5db" }}>
            {txt("Catálogo", "Catalog")}
          </button>
          <button type="button"
            onClick={() => setVehicleCatalogMode("manual")}
            style={{ fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "5px 12px", border: "1px solid", cursor: "pointer",
              background: vehicleCatalogMode === "manual" ? "#2563eb" : "transparent",
              color: vehicleCatalogMode === "manual" ? "#fff" : "#6b7280",
              borderColor: vehicleCatalogMode === "manual" ? "#2563eb" : "#d1d5db" }}>
            {txt("Manual", "Manual")}
          </button>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {vehicleCatalogMode === "erp"
              ? txt("Selecciona desde catálogo para autocompletar datos", "Select from catalog to auto-fill data")
              : txt("Introduce los datos manualmente", "Enter data manually")}
          </span>
        </div>

        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {vehicleCatalogMode === "erp" ? (
            <>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#6b7280" }}>
                {txt("Marca", "Brand")}
                <select value={erpSelectedBrandId} disabled={erpBrandsLoading}
                  onChange={(e) => {
                    const brandId = e.target.value;
                    const brand = erpBrands.find((b) => String(b.id) === String(brandId));
                    setErpSelectedBrandId(brandId);
                    setErpSelectedModelId("");
                    setErpVersions([]);
                    updateForm("brand", brand ? brand.name : "");
                    updateForm("model", "");
                    updateForm("version", "");
                    if (brandId) {
                      setErpModelsLoading(true);
                      getErpModelsJson(brandId)
                        .then((r) => r.json())
                        .then((data) => { if (Array.isArray(data?.models)) setErpModels(data.models); })
                        .catch(() => {})
                        .finally(() => setErpModelsLoading(false));
                    } else { setErpModels([]); }
                  }}
                  style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 10, padding: "9px 10px", color: erpSelectedBrandId ? "#111827" : "#9ca3af", width: "100%", boxSizing: "border-box" }}>
                  <option value="">{erpBrandsLoading ? txt("Cargando…", "Loading…") : txt("Selecciona marca", "Select brand")}</option>
                  {erpBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#6b7280" }}>
                {txt("Modelo", "Model")}
                <select value={erpSelectedModelId} disabled={!erpSelectedBrandId || erpModelsLoading}
                  onChange={(e) => {
                    const modelId = e.target.value;
                    const model = erpModels.find((m) => String(m.id) === String(modelId));
                    setErpSelectedModelId(modelId);
                    setErpVersions([]);
                    updateForm("model", model ? model.name : "");
                    updateForm("version", "");
                    if (modelId) {
                      setErpVersionsLoading(true);
                      getErpVersionsJson(modelId, erpSelectedBrandId)
                        .then((r) => r.json())
                        .then((data) => { if (Array.isArray(data?.versions)) setErpVersions(data.versions); else setErpVersions([]); })
                        .catch(() => { setErpVersions([]); })
                        .finally(() => setErpVersionsLoading(false));
                    } else { setErpVersions([]); }
                  }}
                  style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 10, padding: "9px 10px", color: erpSelectedModelId ? "#111827" : "#9ca3af", width: "100%", boxSizing: "border-box" }}>
                  <option value="">{erpModelsLoading ? txt("Cargando…", "Loading…") : !erpSelectedBrandId ? txt("Selecciona la marca antes", "Select brand first") : txt("Selecciona modelo", "Select model")}</option>
                  {erpModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#6b7280" }}>
                {txt("Versión", "Version")}
                <select value={form.version} disabled={!erpSelectedModelId || erpVersionsLoading || erpVersions.length === 0}
                  onChange={(e) => {
                    const codversion = e.target.value;
                    updateForm("version", codversion);
                    if (codversion) {
                      getErpVersionDetailJson(codversion)
                        .then((r) => r.json())
                        .then((data) => {
                          const d = data?.detail;
                          if (!d) return;
                          if (d.fuel) updateForm("fuel", d.fuel);
                          if (d.cv) updateForm("cv", String(d.cv));
                          if (d.doors) updateForm("doors", String(d.doors));
                          if (d.seats) updateForm("seats", String(d.seats));
                          if (d.co2) updateForm("co2", String(d.co2));
                          const tx = mapErpTransmission(d.transmision || "");
                          if (tx) updateForm("transmissionType", tx);
                          const bt = mapErpBodyType(d.bodyType || "");
                          if (bt) updateForm("bodyType", bt);
                        })
                        .catch(() => {});
                    }
                  }}
                  style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 10, padding: "9px 10px", color: form.version ? "#111827" : "#9ca3af", width: "100%", boxSizing: "border-box" }}>
                  <option value="">{erpVersionsLoading ? txt("Cargando…", "Loading…") : !erpSelectedModelId ? txt("Selecciona el modelo antes", "Select model first") : erpVersions.length === 0 ? txt("Sin versiones en catálogo", "No versions in catalog") : txt("Selecciona versión", "Select version")}</option>
                  {erpVersions.map((v) => <option key={v.codversion} value={v.codversion}>{v.label}</option>)}
                </select>
              </label>
            </>
          ) : (
            <>
              {renderField(txt("Marca", "Brand"), "brand", { placeholder: "Opel" })}
              {renderField(txt("Modelo", "Model"), "model", { placeholder: "Corsa" })}
              {renderField(txt("Versión", "Version"), "version", { placeholder: "1.4 Color Edition 90 CV" })}
            </>
          )}
          {renderField(txt("Tipo de cambio", "Transmission"), "transmissionType", { type: "select", options: [["manual", txt("Manual", "Manual")],["automatico", txt("Automático", "Automatic")]] })}
          {renderField(txt("Tipo de coche", "Body type"), "bodyType", { type: "select", options: [["berlina", txt("Berlina", "Sedan")],["suv", "SUV"],["familiar", txt("Familiar", "Estate")],["coupe", txt("Coupé", "Coupe")],["cabrio", txt("Cabrio", "Convertible")],["monovolumen", txt("Monovolumen", "Minivan")],["pickup", "Pickup"],["todoterreno", txt("Todoterreno", "Off-road")],["furgoneta", txt("Furgoneta", "Van")]] })}
          {renderField("CV", "cv", { placeholder: "90" })}
          {renderField(txt("Caballos (cc)", "Horsepower (cc)"), "horsepower", { placeholder: "1398" })}
          {renderField(txt("Color", "Color"), "color", { placeholder: txt("Gris", "Grey") })}
          {renderField(txt("Plazas", "Seats"), "seats", { placeholder: "5" })}
          {renderField(txt("Puertas", "Doors"), "doors", { placeholder: "5" })}
          {renderField(txt("Ubicación", "Location"), "location", { placeholder: txt("Madrid", "Madrid") })}
          {renderField(txt("Etiqueta ambiental", "Environmental label"), "environmentalLabel", { type: "select", options: [["0", txt("0 emisiones", "0 emissions")],["eco", "ECO"],["c", "C"],["b", "B"]] })}
          {renderField(txt("Última ITV", "Last MOT"), "lastIvt", { placeholder: "2026-01-20" })}
          {renderField(txt("Próxima ITV", "Next MOT"), "nextIvt", { placeholder: "2028-01-20" })}
          {renderField(txt("CO₂ (g/km)", "CO₂ (g/km)"), "co2", { placeholder: "120" })}
          {renderField(txt("Año", "Year"), "year", { placeholder: "2016" })}
          {renderField(txt("Matrícula", "Plate"), "plate", { placeholder: "9052JMM" })}
          {renderField(txt("Kilometraje", "Mileage"), "mileage", { placeholder: "130000" })}
          {renderField(txt("Combustible", "Fuel"), "fuel", { type: "select", options: [["gasolina", txt("Gasolina", "Gasoline")],["diesel", txt("Diésel", "Diesel")],["hibrido", txt("Híbrido", "Hybrid")],["electrico", txt("Eléctrico", "Electric")],["gas", txt("Gas", "Gas")]] })}
        </div>
      </SectionBlock>

      <SectionBlock title={txt("Valor del Vehículo en el mercado", "Vehicle market value")} subtitle={txt("Valor manual definido", "Manual value")}
        open={openSections.marketplace} onToggle={() => toggleSection("marketplace")}
        openLabel={txt("Abrir", "Open")} closeLabel={txt("Ocultar", "Hide")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {renderField(txt("Precio (€)", "Price (€)"), "price", { placeholder: "8500" })}
        </div>
        {(() => {
          const vid = editingVehicleId;
          const ps = publishStates[vid] || {};
          const isPublishing = ps.status === "loading";
          const isPublished = ps.status === "published";
          const isUnpublished = ps.status === "unpublished";
          const hasError = ps.status === "error";
          return (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                {txt("Publica tu vehículo en el Marketplace de CarsWise para que otros usuarios puedan comprarlo.", "Publish your vehicle in the CarsWise Marketplace so other users can buy it.")}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {!isPublished && !isUnpublished && (
                  <button type="button"
                    disabled={isPublishing || !normalizeText(form.price)}
                    onClick={() => handlePublish(vid, form.price, "publish")}
                    style={{ border: "none", borderRadius: 9, background: isPublishing ? "#93c5fd" : "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: isPublishing || !normalizeText(form.price) ? "not-allowed" : "pointer", opacity: !normalizeText(form.price) ? 0.5 : 1 }}>
                    {isPublishing ? txt("Publicando…", "Publishing…") : txt("🚀 Publicar en Marketplace", "🚀 Publish to Marketplace")}
                  </button>
                )}
                {isPublished && (
                  <>
                    <span style={{ background: "rgba(16,185,129,0.1)", color: "#047857", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700 }}>
                      ✅ {txt("Publicado en Marketplace", "Published in Marketplace")}
                    </span>
                    <button type="button"
                      onClick={() => handlePublish(vid, form.price, "unpublish")}
                      style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#dc2626", borderRadius: 9, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {txt("Retirar oferta", "Remove listing")}
                    </button>
                  </>
                )}
                {isUnpublished && (
                  <button type="button"
                    onClick={() => handlePublish(vid, form.price, "publish")}
                    style={{ border: "none", borderRadius: 9, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {txt("🚀 Volver a publicar", "🚀 Republish")}
                  </button>
                )}
                {!normalizeText(form.price) && !isPublished && (
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{txt("Introduce un precio para poder publicar", "Enter a price to publish")}</span>
                )}
              </div>
              {hasError && (
                <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>⚠️ {ps.message}</p>
              )}
            </div>
          );
        })()}
      </SectionBlock>

      <SectionBlock title={txt("Documentos del vehículo", "Vehicle documents")}
        subtitle={`${storedVehicleDocuments} ${txt("guardados", "saved")} · ${preparedVehicleDocuments} ${txt("adjuntos preparados", "attachments prepared")}`}
        open={openSections.vehicleDocuments} onToggle={() => toggleSection("vehicleDocuments")}
        openLabel={txt("Abrir", "Open")} closeLabel={txt("Ocultar", "Hide")}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {renderFileUpload(txt("Fotos del vehículo", "Vehicle photos"), pendingPhotos, setPendingPhotos, photoInputRef, "image/*", "#2563eb", storedPhotos, "photos")}
          {renderFileUpload(txt("Ficha técnica", "Technical sheet"), pendingTechnicalSheetDocuments, setPendingTechnicalSheetDocuments, technicalSheetInputRef, ".pdf,image/*", "#0f766e", storedTechnicalSheetDocuments, "technicalSheetDocuments")}
          {renderFileUpload(txt("Permiso de circulación", "Circulation permit"), pendingCirculationPermitDocuments, setPendingCirculationPermitDocuments, circulationPermitInputRef, ".pdf,image/*", "#0f766e", storedCirculationPermitDocuments, "circulationPermitDocuments")}
          {renderFileUpload(txt("Otros documentos", "Other documents"), pendingOtherDocuments, setPendingOtherDocuments, otherDocInputRef, ".pdf,image/*,.doc,.docx", "#7c3aed", storedOtherDocuments, "documents")}
          {renderFileUpload(txt("Documentación ITV", "MOT documentation"), pendingItvDocuments, setPendingItvDocuments, itvInputRef, ".pdf,image/*", "#0f766e", storedItvDocuments, "itvDocuments")}
        </div>
      </SectionBlock>

      <SectionBlock title={txt("Seguros", "Insurance")} subtitle={`${storedInsuranceDocuments.length} ${txt("guardados", "saved")} · ${pendingInsuranceDocuments.length} ${txt("documentos de seguro preparados", "insurance docs prepared")}`}
        open={openSections.insurance} onToggle={() => toggleSection("insurance")}
        openLabel={txt("Abrir", "Open")} closeLabel={txt("Ocultar", "Hide")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {renderField(txt("Aseguradora", "Insurer"), "policyCompany", { placeholder: txt("Compañía de seguro", "Insurance company") })}
          {renderField(txt("Póliza", "Policy"), "policyNumber", { placeholder: txt("Número de póliza", "Policy number") })}
          {renderField(txt("Cobertura", "Coverage"), "coverageType", { placeholder: txt("Todo riesgo, terceros...", "Full coverage, third-party...") })}
        </div>
        <div style={{ marginTop: 12 }}>
          {renderFileUpload(txt("Documentos del seguro", "Insurance documents"), pendingInsuranceDocuments, setPendingInsuranceDocuments, insuranceDocInputRef, ".pdf,image/*", "#0f766e", storedInsuranceDocuments, "insuranceDocuments")}
        </div>
      </SectionBlock>

      <SectionBlock title={txt("Mantenimientos", "Maintenance")} subtitle={`${storedMaintenanceInvoices.length} ${txt("guardadas", "saved")} · ${pendingMaintenanceInvoices.length} ${txt("facturas de mantenimiento preparadas", "maintenance invoices prepared")}`}
        open={openSections.maintenance} onToggle={() => toggleSection("maintenance")}
        openLabel={txt("Abrir", "Open")} closeLabel={txt("Ocultar", "Hide")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          {renderField(txt("Tipo mantenimiento", "Maintenance type"), "maintenanceType", { placeholder: txt("Revisión, aceite, frenos...", "Service, oil, brakes...") })}
          {renderField(txt("Descripción", "Description"), "maintenanceTitle", { placeholder: txt("Qué se le ha hecho al coche", "What has been done to the car") })}
        </div>
        <label style={{ ...LABEL_STYLE, marginTop: 10 }}>
          {txt("Notas mantenimiento", "Maintenance notes")}
          <textarea value={form.maintenanceNotes} onChange={(e) => updateForm("maintenanceNotes", e.target.value)}
            placeholder={txt("Detalle del mantenimiento", "Maintenance details")} rows={2} style={{ ...INPUT_STYLE, resize: "vertical" }} />
        </label>
        <div style={{ marginTop: 12 }}>
          {renderFileUpload(txt("Facturas de mantenimiento", "Maintenance invoices"), pendingMaintenanceInvoices, setPendingMaintenanceInvoices, maintenanceInputRef, ".pdf,image/*", "#0f766e", storedMaintenanceInvoices, "maintenanceInvoices")}
        </div>
      </SectionBlock>

      <SectionBlock title={txt("Notas internas", "Internal notes")} subtitle={normalizeText(form.notes) ? txt("Con contenido", "With content") : txt("Sin notas", "No notes")}
        open={openSections.notes} onToggle={() => toggleSection("notes")}
        openLabel={txt("Abrir", "Open")} closeLabel={txt("Ocultar", "Hide")}>
        <label style={LABEL_STYLE}>
          {txt("Notas", "Notes")}
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)}
            rows={3} placeholder={txt("Notas privadas sobre este vehículo...", "Private notes about this vehicle...")} style={{ ...INPUT_STYLE, resize: "vertical" }} />
        </label>
      </SectionBlock>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4, padding: "10px 0" }}>
        <button type="button" onClick={handleSave} disabled={isSaving}
          style={{ border: "none", borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "11px 18px", fontSize: 13.5, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.78 : 1 }}>
          {isSaving ? txt("Guardando...", "Saving...") : txt("Guardar cambios", "Save changes")}
        </button>
        <button type="button" onClick={cancelEdit}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#6b7280", padding: "11px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {isDetailView ? txt("Volver al listado", "Back to list") : txt("Cancelar edición", "Cancel edit")}
        </button>
      </div>
    </div>
    );
  };

  // ─── render ──────────────────────────────────────────────────────────
  return (
    <>
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto", color: "#1a1a1a", padding: "0 8px 18px" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button type="button" onClick={isCreateView ? onGoBack : onGoBack}
          style={{ border: "1px solid #ece8df", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#888", cursor: "pointer", fontWeight: 600 }}>
          {txt("← Volver", "← Back")}
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          {txt("Servicios", "Services")} › <span style={{ color: "#2563eb", fontWeight: 700 }}>
            {isCreateView ? txt("Crear IDCar", "Create IDCar") : isDetailView ? buildVehicleTitle(selectedVehicle || {}) : txt("Mis IDCars", "My IDCars")}
          </span>
        </div>
      </div>

      {/* ── CREATE VIEW ── */}
      {isCreateView ? (
        <>
          <section style={{ ...SECTION_CARD_STYLE, padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2563eb", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 20, padding: "4px 12px", marginBottom: 10 }}>
              {txt("🚗 Nuevo IDCar", "🚗 New IDCar")}
            </div>
            <h2 style={{ margin: "0 0 5px", fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>{txt("Crear mi IDCar", "Create my IDCar")}</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: "#888", lineHeight: 1.6, fontWeight: 300, maxWidth: 520 }}>
              {txt("Añade tu vehículo con ficha técnica, documentación, seguro y mantenimiento. Todo en un mismo lugar.", "Add your vehicle with technical sheet, documents, insurance and maintenance. All in one place.")}
            </p>
          </section>
          {feedback ? <div style={{ marginBottom: 10, fontSize: 13, color: feedbackColor, fontWeight: 600 }}>{feedback}</div> : null}
          {renderVehicleEditor()}
        </>
      ) : null}

      {/* ── LIST & DETAIL VIEWS ── */}
      {!isCreateView ? (
        <>
      <section style={{ ...SECTION_CARD_STYLE, padding: "18px 20px", marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 5px", fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>{txt("Gestionar mis IDCars", "Manage my IDCars")}</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#888", lineHeight: 1.6, fontWeight: 300 }}>
          {txt("Tus vehículos se sincronizan con el Panel de usuario. Puedes editarlos o quitarlos desde aquí.", "Your vehicles sync with the user panel. You can edit or remove them from here.")}
        </p>
        {!isDetailView && !editingVehicleId && !isCreating ? (
          <button type="button" onClick={startCreate}
            style={{ border: "none", borderRadius: 12, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {txt("Crear nuevo IDCar", "Create new IDCar")}
          </button>
        ) : null}
      </section>

      {feedback ? <div style={{ marginBottom: 10, fontSize: 13, color: feedbackColor, fontWeight: 600 }}>{feedback}</div> : null}

      {isDetailView && !selectedVehicle ? (
        <section style={{ ...SECTION_CARD_STYLE, padding: "18px 20px", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 6 }}>{txt("No se ha encontrado este IDCar", "This IDCar was not found")}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{txt("Vuelve al listado y selecciona un vehículo válido.", "Go back to the list and select a valid vehicle.")}</div>
          <button type="button" onClick={onGoBack}
            style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#6b7280", padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {txt("Volver al listado", "Back to list")}
          </button>
        </section>
      ) : null}

      {!isDetailView && visibleVehicles.map((vehicle) => {
        const firstPhoto = getFirstPhotoSrc(vehicle);
        const docsCount = (vehicle.documents?.length || 0) + (vehicle.itvDocuments?.length || 0);
        const insuranceDocs = vehicle.insuranceDocuments?.length || 0;
        const maintenanceDocs = vehicle.maintenanceInvoices?.length || 0;
        const isCompactCard = viewportWidth <= 880;
        const specGrid = [
          { label: txt("Marca", "Brand"), value: normalizeText(vehicle.brand) },
          { label: txt("Modelo", "Model"), value: normalizeText(vehicle.model) },
          { label: txt("Año", "Year"), value: normalizeText(vehicle.year) },
          { label: "Km", value: normalizeText(vehicle.mileage) ? `${normalizeText(vehicle.mileage)} km` : "" },
          { label: txt("Combustible", "Fuel"), value: normalizeText(vehicle.fuel) },
          { label: txt("Cambio", "Transmission"), value: normalizeText(vehicle.transmissionType) },
          { label: "CV", value: normalizeText(vehicle.cv) },
          { label: txt("Matrícula", "Plate"), value: normalizeText(vehicle.plate) },
          { label: txt("Color", "Color"), value: normalizeText(vehicle.color) },
          { label: txt("Seguro", "Insurance"), value: normalizeText(vehicle.policyCompany) },
          { label: "ITV", value: normalizeText(vehicle.nextIvt) ? `${txt("Próx.", "Next:")} ${normalizeText(vehicle.nextIvt)}` : "" },
          { label: txt("Carrocería", "Body type"), value: normalizeText(vehicle.bodyType) },
        ].filter((s) => s.value);
        const envLabel = normalizeText(vehicle.environmentalLabel);
        const envColor = envLabel === "0" ? "#22c55e" : envLabel === "eco" ? "#0ea5e9" : envLabel === "c" ? "#f59e0b" : envLabel === "b" ? "#ef4444" : "";

        return (
          <section key={vehicle.id} className="idcar-card-animated" style={{ ...SECTION_CARD_STYLE, marginBottom: 8, padding: 0, overflow: "hidden" }}>
            {/* Main row: image left + specs right */}
            <div style={{ display: "flex", flexWrap: isCompactCard ? "wrap" : "nowrap", minHeight: isCompactCard ? 0 : 148 }}>
              {/* QR column — full square */}
              {!isCompactCard ? (
                <div style={{ flex: "0 0 120px", width: 120, height: 148, background: "#ffffff", borderRight: "1px solid #f1ede6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QRCodeSVG
                    value={`https://movilidad-advisor.vercel.app/idcar/${vehicle.id}`}
                    size={104}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              ) : null}

              {/* Photo column — wider */}
              <div style={{ position: "relative", flex: isCompactCard ? "1 1 0%" : "0 0 220px", width: isCompactCard ? "auto" : 220, minWidth: 0, height: isCompactCard ? 124 : 148, background: "#f1ede6", overflow: "hidden", borderRight: isCompactCard ? "none" : "1px solid #f1ede6" }}>
                {firstPhoto ? (
                  <img src={firstPhoto} alt={buildVehicleTitle(vehicle)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#d0cbc5" }}>🚗</div>
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.52) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 6px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: 1.2, textShadow: "0 1px 4px rgba(0,0,0,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {buildVehicleTitle(vehicle)}
                  </div>
                </div>
                {envLabel && envColor ? (
                  <div style={{ position: "absolute", top: 5, left: 5, background: envColor, color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 5, padding: "2px 5px", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                    {envLabel === "0" ? "0 em." : envLabel.toUpperCase()}
                  </div>
                ) : null}
              </div>

              {/* Specs column — rectangular */}
              <div style={{ flex: isCompactCard ? "1 1 100%" : "1 1 0%", background: "#fff", padding: isCompactCard ? "10px 10px 11px" : "9px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", borderTop: isCompactCard ? "1px solid #f1ede6" : "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: isCompactCard ? "repeat(2,minmax(0,1fr))" : "repeat(3,minmax(0,1fr))", gap: isCompactCard ? "7px 9px" : "6px 10px" }}>
                  {specGrid.slice(0, 9).map(({ label, value }) => (
                    <div key={label} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", color: "#b8b1aa", fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: "#374151", fontWeight: 700, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {/* Doc badges + actions row */}
                <div style={{ display: "flex", flexDirection: isCompactCard ? "column" : "row", alignItems: isCompactCard ? "stretch" : "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {docsCount > 0 && <span style={{ background: "rgba(37,99,235,0.07)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.18)", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>📄 {docsCount}</span>}
                    {insuranceDocs > 0 && <span style={{ background: "rgba(16,185,129,0.07)", color: "#047857", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>🛡️ {insuranceDocs}</span>}
                    {maintenanceDocs > 0 && <span style={{ background: "rgba(251,146,60,0.08)", color: "#c2410c", border: "1px solid rgba(251,146,60,0.22)", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>🔧 {maintenanceDocs}</span>}
                    {getIsPublished(vehicle) && <span style={{ background: "rgba(16,185,129,0.1)", color: "#047857", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>🟢 Marketplace</span>}
                  </div>
                  <div style={{ display: isCompactCard ? "grid" : "flex", gridTemplateColumns: isCompactCard ? "40px repeat(3,minmax(0,1fr))" : "none", gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => handleRemove(vehicle.id)}
                      title={txt("Quitar", "Remove")}
                      aria-label={txt("Quitar", "Remove")}
                      style={{ border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.07)", color: "#dc2626", borderRadius: 7, padding: isCompactCard ? "8px 8px" : "4px 9px", fontSize: isCompactCard ? 15 : 11.5, fontWeight: 700, cursor: "pointer", minHeight: isCompactCard ? 36 : "auto", minWidth: isCompactCard ? 38 : "auto" }}>
                      {isCompactCard ? "🗑" : txt("Quitar", "Remove")}
                    </button>
                    <button type="button" onClick={() => openVehicleDetail(vehicle, false)}
                      style={{ border: "1px solid rgba(15,118,110,0.3)", background: "rgba(15,118,110,0.07)", color: "#0f766e", borderRadius: 7, padding: isCompactCard ? "8px 8px" : "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", minHeight: isCompactCard ? 36 : "auto" }}>
                      {txt("Ver ficha", "View profile")}
                    </button>
                    <button type="button" onClick={() => openVehicleDetail(vehicle, true)}
                      style={{ border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", color: "#2563eb", borderRadius: 7, padding: isCompactCard ? "8px 8px" : "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", minHeight: isCompactCard ? 36 : "auto" }}>
                      {txt("Editar", "Edit")}
                    </button>
                    <button type="button"
                      onClick={() => setOpenManagePanelId((prev) => (prev === vehicle.id ? "" : vehicle.id))}
                      style={{ border: "1px solid rgba(14,116,144,0.3)", background: openManagePanelId === vehicle.id ? "rgba(14,116,144,0.15)" : "rgba(14,116,144,0.07)", color: "#0e7490", borderRadius: 7, padding: isCompactCard ? "8px 8px" : "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", minHeight: isCompactCard ? 36 : "auto" }}>
                      {openManagePanelId === vehicle.id ? txt("✕ Cerrar", "✕ Close") : txt("Gestionar", "Manage")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {openManagePanelId === vehicle.id && (
              <div style={{ borderTop: "1px solid #f1ede6", padding: "12px 16px", background: "#fafaf9" }}>
                {renderManagePanel(vehicle)}
              </div>
            )}
          </section>
        );
      })}

      {isDetailView && selectedVehicle ? (
        <>
          {/* Portal-style hero */}
          <section style={{ ...SECTION_CARD_STYLE, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ position: "relative", height: 320, background: "#f1ede6", overflow: "hidden" }}>
              {getFirstPhotoSrc(selectedVehicle) ? (
                <img src={getFirstPhotoSrc(selectedVehicle)} alt={buildVehicleTitle(selectedVehicle)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, color: "#d0cbc5" }}>🚗</div>
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(0,0,0,0.85) 100%)" }} />
              {normalizeText(selectedVehicle.environmentalLabel) ? (() => {
                const envLabel = normalizeText(selectedVehicle.environmentalLabel);
                const envColor = envLabel === "0" ? "#22c55e" : envLabel === "eco" ? "#0ea5e9" : envLabel === "c" ? "#f59e0b" : "#ef4444";
                return (
                  <div style={{ position: "absolute", top: 14, right: 14, background: envColor, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "4px 12px", letterSpacing: "0.07em", textTransform: "uppercase", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                    {envLabel === "0" ? "0 emisiones" : envLabel.toUpperCase()}
                  </div>
                );
              })() : null}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 22px" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6, textShadow: "0 2px 8px rgba(0,0,0,0.45)", lineHeight: 1.15 }}>
                  {buildVehicleTitle(selectedVehicle)}
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
                  {[
                    normalizeText(selectedVehicle.year),
                    normalizeText(selectedVehicle.mileage) ? `${normalizeText(selectedVehicle.mileage)} km` : "",
                    normalizeText(selectedVehicle.fuel),
                    normalizeText(selectedVehicle.plate),
                    normalizeText(selectedVehicle.color),
                    normalizeText(selectedVehicle.transmissionType),
                  ].filter(Boolean).map((chip) => (
                    <span key={chip} style={{ fontSize: 12, color: "rgba(255,255,255,0.92)", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "4px 12px", fontWeight: 500 }}>
                      {chip}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!isEditMode ? (
                    <button type="button" onClick={() => setIsEditMode(true)}
                      style={{ border: "none", borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(37,99,235,0.4)" }}>
                      {txt("✏️ Editar ficha", "✏️ Edit profile")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => setIsEditMode(false)}
                      style={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 10, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", color: "#fff", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {txt("👁 Ver ficha", "👁 View profile")}
                    </button>
                  )}
                  <button type="button" onClick={() => handleRemove(selectedVehicle.id)}
                    style={{ border: "1px solid rgba(239,68,68,0.5)", borderRadius: 10, background: "rgba(239,68,68,0.15)", backdropFilter: "blur(6px)", color: "#fca5a5", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {txt("Quitar", "Remove")}
                  </button>
                </div>
              </div>
            </div>
            {/* Spec grid below image */}
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {[
                [txt("Marca", "Brand"), selectedVehicle.brand],
                [txt("Modelo", "Model"), selectedVehicle.model],
                [txt("Versión", "Version"), selectedVehicle.version],
                [txt("Año", "Year"), selectedVehicle.year],
                [txt("Color", "Color"), selectedVehicle.color],
                [txt("Cambio", "Transmission"), selectedVehicle.transmissionType],
                [txt("Carrocería", "Body type"), selectedVehicle.bodyType],
                ["CV", selectedVehicle.cv],
                ["CO₂", selectedVehicle.co2 ? `${selectedVehicle.co2} g/km` : ""],
                ["ITV", selectedVehicle.nextIvt ? `${txt("Próxima:", "Next:")} ${selectedVehicle.nextIvt}` : ""],
                [txt("Seguro", "Insurance"), selectedVehicle.policyCompany],
                [txt("Cobertura", "Coverage"), selectedVehicle.coverageType],
              ].filter(([, value]) => normalizeText(value)).map(([label, value]) => (
                <div key={label} style={{ border: "1px solid #ece8df", borderRadius: 10, background: "#fafaf9", padding: "8px 10px" }}>
                  <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.09em", color: "#b3b3b3", fontWeight: 700, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: "#374151", fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            {(() => {
              const docCount =
                (selectedVehicle.technicalSheetDocuments?.length || 0) +
                (selectedVehicle.circulationPermitDocuments?.length || 0) +
                (selectedVehicle.itvDocuments?.length || 0) +
                (selectedVehicle.documents?.length || 0);
              const insCount = selectedVehicle.insuranceDocuments?.length || 0;
              const mntCount = selectedVehicle.maintenanceInvoices?.length || 0;
              const photoCount = selectedVehicle.photos?.length || 0;
              if (!docCount && !insCount && !mntCount && !photoCount) return null;
              return (
                <div style={{ padding: "0 20px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {photoCount > 0 && <span style={{ background: "rgba(37,99,235,0.08)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>📷 {photoCount} {txt(`foto${photoCount !== 1 ? "s" : ""}`, `photo${photoCount !== 1 ? "s" : ""}`)}</span>}
                  {docCount > 0 && <span style={{ background: "rgba(37,99,235,0.08)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>📄 {docCount} {txt(`doc${docCount !== 1 ? "s" : ""}`, `doc${docCount !== 1 ? "s" : ""}`)}</span>}
                  {insCount > 0 && <span style={{ background: "rgba(16,185,129,0.08)", color: "#047857", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>🛡️ {insCount} {txt(`seguro${insCount !== 1 ? "s" : ""}`, `insurance${insCount !== 1 ? "s" : ""}`)}</span>}
                  {mntCount > 0 && <span style={{ background: "rgba(251,146,60,0.1)", color: "#c2410c", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>🔧 {mntCount} mant.</span>}
                  {normalizeText(selectedVehicle.notes) ? <span style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280", border: "1px solid rgba(107,114,128,0.18)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>📝 {txt("Notas", "Notes")}</span> : null}
                </div>
              );
            })()}

            {(() => {
              const sections = [
                { key: "photos", title: txt("Fotos del vehículo", "Vehicle photos"), items: Array.isArray(selectedVehicle.photos) ? selectedVehicle.photos : [], color: "#1d4ed8" },
                {
                  key: "technical-sheet",
                  title: txt("Ficha técnica", "Technical sheet"),
                  items: Array.isArray(selectedVehicle.technicalSheetDocuments) ? selectedVehicle.technicalSheetDocuments : [],
                  color: "#0f766e",
                },
                { key: "circulation-permit", title: txt("Permiso de circulación", "Circulation permit"), items: Array.isArray(selectedVehicle.circulationPermitDocuments) ? selectedVehicle.circulationPermitDocuments : [], color: "#0f766e" },
                { key: "itv", title: txt("Documentación ITV", "MOT documentation"), items: Array.isArray(selectedVehicle.itvDocuments) ? selectedVehicle.itvDocuments : [], color: "#0f766e" },
                { key: "other-documents", title: txt("Otros documentos", "Other documents"), items: Array.isArray(selectedVehicle.documents) ? selectedVehicle.documents : [], color: "#7c3aed" },
                { key: "insurance", title: txt("Documentos de seguro", "Insurance documents"), items: Array.isArray(selectedVehicle.insuranceDocuments) ? selectedVehicle.insuranceDocuments : [], color: "#047857" },
                { key: "maintenance", title: txt("Facturas de mantenimiento", "Maintenance invoices"), items: Array.isArray(selectedVehicle.maintenanceInvoices) ? selectedVehicle.maintenanceInvoices : [], color: "#c2410c" },
              ];

              return (
                <div style={{ padding: "0 20px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                  {sections.map((section) => (
                    <div key={section.key} style={{ border: "1px solid #ece8df", borderRadius: 10, background: "#fff", padding: "10px 11px" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{section.title}</div>
                      {section.items.length ? (
                        <div style={{ display: "grid", gap: 4 }}>
                          {section.items.slice(0, 5).map((file, index) => (
                            <div key={`${section.key}-${normalizeText(file?.name)}-${index}`} style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, color: section.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, fontWeight: 700 }}>
                                {normalizeText(file?.name) || `${txt("Archivo", "File")} ${index + 1}`}
                              </div>
                              {(getAttachmentLink(file) || getAttachmentDataUrl(file)) ? (
                                <button
                                  type="button"
                                  onClick={() => openAttachmentPreview(file)}
                                  title={txt("Abrir", "Open")}
                                  style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151", borderRadius: 6, padding: "2px 6px", fontSize: 13, lineHeight: 1, cursor: "pointer", flexShrink: 0 }}
                                >
                                  ↗
                                </button>
                              ) : null}
                              {(getAttachmentLink(file) || getAttachmentDataUrl(file)) ? (
                                <button
                                  type="button"
                                  onClick={() => triggerAttachmentDownload(file)}
                                  title={txt("Descargar", "Download")}
                                  style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "2px 6px", fontSize: 13, lineHeight: 1, cursor: "pointer", flexShrink: 0 }}
                                >
                                  ↓
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {section.items.length > 5 ? <div style={{ fontSize: 11, color: "#9ca3af" }}>+{section.items.length - 5} {txt("archivo(s) más", "more file(s)")}</div> : null}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{txt("Sin adjuntos", "No attachments")}</div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          <section style={{ ...SECTION_CARD_STYLE, padding: "14px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
              {txt("Acciones rápidas", "Quick actions")}
            </div>
            {renderManagePanel(selectedVehicle)}
          </section>

          {isEditMode ? renderVehicleEditor() : null}
        </>
      ) : null}

      {!isDetailView && (isCreating || editingVehicleId) ? renderVehicleEditor() : null}

      {!visibleVehicles.length && !isCreating && !isDetailView ? (
        <section style={{ ...SECTION_CARD_STYLE, padding: "20px 16px" }}>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 10 }}>{txt("Aún no tienes IDCars creados.", "You do not have any IDCars yet.")}</div>
          <button type="button" onClick={startCreate}
            style={{ border: "none", borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {txt("Crear mi primer IDCar", "Create my first IDCar")}
          </button>
        </section>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <button type="button" onClick={onGoHome}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#6b7280", padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {txt("Ir al inicio", "Go to home")}
        </button>
      </div>
        </>
      ) : null}

    </div>

    {/* Publish confirmation modal */}
    {marketplacePublishDialog.open && marketplacePublishDialog.vehicle ? (
      <div onClick={closeMarketplacePublishDialog}
        style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,23,42,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div onClick={(e) => e.stopPropagation()}
          role="dialog" aria-modal="true" aria-label={txt("Confirmar publicación en marketplace", "Confirm marketplace listing")}
          ref={marketplacePublishDialogRef} tabIndex={-1}
          style={{ width: "min(480px,100%)", border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.18)", padding: 20, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
            {txt("Confirmar publicación en Marketplace", "Confirm Marketplace listing")}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", display: "grid", gap: 8 }}>
            <div><strong style={{ color: "#374151" }}>{txt("Vehículo:", "Vehicle:")} </strong>{marketplacePublishDialog.vehicle.title}</div>
            {marketplacePublishDialog.vehicle.price ? (
              <div><strong style={{ color: "#374151" }}>{txt("Precio:", "Price:")} </strong>{marketplacePublishDialog.vehicle.price} EUR</div>
            ) : (
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontWeight: 700, color: "#374151" }}>{txt("Precio de venta (€)", "Sale price (€)")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="p.ej. 12500"
                    value={marketplacePublishDialog.modalPrice || ""}
                    onChange={(e) => setMarketplacePublishDialog((prev) => ({ ...prev, modalPrice: e.target.value }))}
                    style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#111827", outline: "none" }}
                    autoFocus
                  />
                  <span style={{ color: "#6b7280", fontSize: 12 }}>EUR</span>
                </div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  {txt("Se guardará en la ficha del vehículo.", "Will be saved to the vehicle profile.")}
                </span>
              </label>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button ref={marketplacePublishPrimaryBtnRef} type="button"
              onClick={confirmMarketplacePublish}
              disabled={!marketplacePublishDialog.vehicle.price && !marketplacePublishDialog.modalPrice}
              style={{ background: (marketplacePublishDialog.vehicle.price || marketplacePublishDialog.modalPrice) ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: (marketplacePublishDialog.vehicle.price || marketplacePublishDialog.modalPrice) ? "pointer" : "not-allowed" }}>
              {txt("🚀 Publicar", "🚀 Publish")}
            </button>
            <button type="button" onClick={closeMarketplacePublishDialog}
              style={{ background: "rgba(148,163,184,0.14)", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {txt("Cancelar", "Cancel")}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
