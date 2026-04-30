import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getGarageVehiclesJson, postGarageVehicleAddJson, postGarageVehicleRemoveJson } from "../utils/apiClient";

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

function readGarageVehicles(currentUserEmail = "") {
  if (typeof window === "undefined") return [];
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

function SectionBlock({ title, subtitle, open, onToggle, children }) {
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
          {open ? "Ocultar" : "Abrir"}
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
  selectedVehicleId = "",
  startEditing = false,
  viewMode = "list",
}) {
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

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [pendingTechnicalSheetDocuments, setPendingTechnicalSheetDocuments] = useState([]);
  const [pendingCirculationPermitDocuments, setPendingCirculationPermitDocuments] = useState([]);
  const [pendingItvDocuments, setPendingItvDocuments] = useState([]);
  const [pendingInsuranceDocuments, setPendingInsuranceDocuments] = useState([]);
  const [pendingMaintenanceInvoices, setPendingMaintenanceInvoices] = useState([]);

  const photoInputRef = useRef(null);
  const technicalSheetInputRef = useRef(null);
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
    if (!isCreateView) return;
    setIsCreating(true);
    setEditingVehicleId("");
    setForm(createEmptyForm());
    showFeedback("Completa la ficha y guarda tu nuevo IDCar.", "info");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateView]);

  useEffect(() => {
    if (typeof window === "undefined" || isDetailView || isCreateView) return;
    const action = normalizeText(window.sessionStorage.getItem(IDCAR_PENDING_ACTION_KEY)).toLowerCase();
    if (!action) return;
    window.sessionStorage.removeItem(IDCAR_PENDING_ACTION_KEY);
    if (action === "create") {
      setIsCreating(true);
      setEditingVehicleId("");
      setForm(createEmptyForm());
      showFeedback("Completa la ficha y guarda tu nuevo IDCar.", "info");
    }
  }, [isDetailView, isCreateView]);

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

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const showFeedback = (message, tone = "info") => {
    setFeedback(message);
    setFeedbackTone(tone);
  };
  const feedbackColor = feedbackTone === "error" ? "#b91c1c" : feedbackTone === "success" ? "#047857" : "#1d4ed8";

  const resetFileUploads = () => {
    setPendingPhotos([]); setPendingTechnicalSheetDocuments([]); setPendingCirculationPermitDocuments([]); setPendingItvDocuments([]);
    setPendingInsuranceDocuments([]); setPendingMaintenanceInvoices([]);
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
    showFeedback("Completa la ficha y guarda tu nuevo IDCar.", "info");
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
    showFeedback(`Editando ${buildVehicleTitle(vehicle)}. Pulsa Guardar cambios para confirmar.`, "info");
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
    showFeedback("Edición cancelada.", "info");
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
      showFeedback("IDCar eliminado.", "success");
      onGoBack?.();
      return;
    }
    if (editingVehicleId === vehicleId) cancelEdit();
    showFeedback("IDCar eliminado.", "success");
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    showFeedback("Guardando cambios...", "info");

    try {
      const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Tu sesión no está activa. Inicia sesión de nuevo antes de guardar el IDCar.");
      }

      const baseVehicle = editingVehicleId ? vehicles.find((v) => v.id === editingVehicleId) || {} : {};
      const vehicleId = editingVehicleId || `veh-${Date.now()}`;

      const photosPayload = await filesToAttachmentPayload(pendingPhotos, "La foto del vehículo");
      const technicalSheetDocumentsPayload = await filesToAttachmentPayload(pendingTechnicalSheetDocuments, "La ficha técnica");
      const circulationPermitDocumentsPayload = await filesToAttachmentPayload(pendingCirculationPermitDocuments, "El permiso de circulación");
      const itvDocumentsPayload = await filesToAttachmentPayload(pendingItvDocuments, "La documentación ITV");
      const insuranceDocumentsPayload = await filesToAttachmentPayload(pendingInsuranceDocuments, "El documento del seguro");
      const maintenanceInvoicesPayload = await filesToAttachmentPayload(pendingMaintenanceInvoices, "La factura de mantenimiento");

      const titleVal = normalizeText(form.nickname) || [normalizeText(form.brand), normalizeText(form.model)].filter(Boolean).join(" ") || "Vehículo";

      const legacySplit = splitLegacyDocumentsByType(baseVehicle.documents);

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
        photos: [...(Array.isArray(baseVehicle.photos) ? baseVehicle.photos : []), ...photosPayload],
        documents: [],
        technicalSheetDocuments: [
          ...(Array.isArray(baseVehicle.technicalSheetDocuments) ? baseVehicle.technicalSheetDocuments : []),
          ...legacySplit.technicalSheetDocuments,
          ...legacySplit.unknownDocuments,
          ...technicalSheetDocumentsPayload,
        ],
        circulationPermitDocuments: [
          ...(Array.isArray(baseVehicle.circulationPermitDocuments) ? baseVehicle.circulationPermitDocuments : []),
          ...legacySplit.circulationPermitDocuments,
          ...circulationPermitDocumentsPayload,
        ],
        itvDocuments: [
          ...(Array.isArray(baseVehicle.itvDocuments) ? baseVehicle.itvDocuments : []),
          ...legacySplit.itvDocuments,
          ...itvDocumentsPayload,
        ],
        insuranceDocuments: [...(Array.isArray(baseVehicle.insuranceDocuments) ? baseVehicle.insuranceDocuments : []), ...insuranceDocumentsPayload],
        maintenanceInvoices: [...(Array.isArray(baseVehicle.maintenanceInvoices) ? baseVehicle.maintenanceInvoices : []), ...maintenanceInvoicesPayload],
        initialMaintenance: {
          type: normalizeText(form.maintenanceType) || "maintenance",
          title: normalizeText(form.maintenanceTitle),
          notes: normalizeText(form.maintenanceNotes),
          invoices: [...(Array.isArray(baseVehicle.initialMaintenance?.invoices) ? baseVehicle.initialMaintenance.invoices : []), ...maintenanceInvoicesPayload],
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
          throw new Error(normalizeText(data?.error) || "No se pudo guardar el IDCar en servidor.");
        }

        const persistedSummary = data?.persistedDocumentSummary;
        if (technicalSheetDocumentsPayload.length > 0 && Number(persistedSummary?.technicalSheetDocuments || 0) === 0) {
          throw new Error("El servidor no confirmó la persistencia de la ficha técnica.");
        }
        if (circulationPermitDocumentsPayload.length > 0 && Number(persistedSummary?.circulationPermitDocuments || 0) === 0) {
          throw new Error("El servidor no confirmó la persistencia del permiso de circulación.");
        }
        if (itvDocumentsPayload.length > 0 && Number(persistedSummary?.itvDocuments || 0) === 0) {
          throw new Error("El servidor no confirmó la persistencia de la documentación ITV.");
        }

        if (!Array.isArray(data?.vehicles)) {
          throw new Error("La API devolvio una respuesta incompleta al guardar el IDCar.");
        }
        nextVehicles = data.vehicles.filter((item) => item && item.id);
      }

      const persistedVehicle = nextVehicles.find((item) => normalizeText(item?.id) === normalizeText(vehicleId)) || nextVehicle;

      setVehicles(nextVehicles);
      setEditingVehicleId(persistedVehicle.id);
      setIsCreating(false);
      setForm(vehicleToForm(persistedVehicle));
      resetFileUploads();
      const uploadedFiles =
        photosPayload.length +
        technicalSheetDocumentsPayload.length +
        circulationPermitDocumentsPayload.length +
        itvDocumentsPayload.length +
        insuranceDocumentsPayload.length +
        maintenanceInvoicesPayload.length;

      showFeedback(
        `${editingVehicleId ? `IDCar "${titleVal}" actualizado` : `IDCar "${titleVal}" creado y sincronizado`} correctamente.${uploadedFiles > 0 ? ` ${uploadedFiles} archivo(s) procesado(s).` : ""}`,
        "success"
      );
      if (isCreateView && typeof onCreated === "function") {
        onCreated(persistedVehicle);
      }
    } catch (error) {
      const message = normalizeText(error?.message) || "No se pudo guardar el IDCar. Revisa tu sesion e intentalo de nuevo.";
      showFeedback(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── render helpers ─────────────────────────────────────────────────
  const renderField = (label, key, opts = {}) => (
    <label key={key} style={LABEL_STYLE}>
      {label}
      {opts.type === "select" ? (
        <select value={form[key]} onChange={(e) => updateForm(key, e.target.value)} style={INPUT_STYLE}>
          <option value="">Selecciona</option>
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
    return "";
  };

  const renderFileUpload = (label, pendingFiles, setPending, inputRef, accept, colorHex, storedFiles = []) => (
    <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#6b7280" }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
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
        <span>Adjuntar archivo</span>
        <span style={{ fontSize: 11 }}>{storedFiles.length} guardados · {pendingFiles.length} seleccionados</span>
      </button>
      {pendingFiles.some((file) => Number(file?.size || 0) > MAX_ATTACHMENT_BYTES) ? (
        <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
          Hay archivos seleccionados que superan el máximo de {formatBytes(MAX_ATTACHMENT_BYTES)}.
        </div>
      ) : null}
      {storedFiles.length ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: "8px 10px" }}>
          <div style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Guardados en ficha
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {storedFiles.slice(0, 4).map((file, index) => (
              <div key={`${normalizeText(file?.name)}-${index}`} style={{ fontSize: 11.5, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                • {getAttachmentLink(file)
                  ? <a href={getAttachmentLink(file)} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>{normalizeText(file?.name) || `Archivo ${index + 1}`}</a>
                  : (normalizeText(file?.name) || `Archivo ${index + 1}`)}
              </div>
            ))}
            {storedFiles.length > 4 ? (
              <div style={{ fontSize: 11, color: "#9ca3af" }}>+{storedFiles.length - 4} archivo(s) más</div>
            ) : null}
          </div>
        </div>
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

  const renderVehicleEditor = () => {
    const activeVehicle = (editingVehicleId
      ? vehicles.find((vehicle) => normalizeText(vehicle?.id) === normalizeText(editingVehicleId))
      : null) || (isDetailView ? selectedVehicle : null) || {};

    const storedPhotos = Array.isArray(activeVehicle?.photos) ? activeVehicle.photos : [];
    const storedTechnicalSheetDocuments = [
      ...(Array.isArray(activeVehicle?.technicalSheetDocuments) ? activeVehicle.technicalSheetDocuments : []),
      ...(Array.isArray(activeVehicle?.documents) ? activeVehicle.documents : []),
    ];
    const storedCirculationPermitDocuments = Array.isArray(activeVehicle?.circulationPermitDocuments) ? activeVehicle.circulationPermitDocuments : [];
    const storedItvDocuments = Array.isArray(activeVehicle?.itvDocuments) ? activeVehicle.itvDocuments : [];
    const storedInsuranceDocuments = Array.isArray(activeVehicle?.insuranceDocuments) ? activeVehicle.insuranceDocuments : [];
    const storedMaintenanceInvoices = Array.isArray(activeVehicle?.maintenanceInvoices) ? activeVehicle.maintenanceInvoices : [];

    const preparedVehicleDocuments = pendingPhotos.length + pendingTechnicalSheetDocuments.length + pendingCirculationPermitDocuments.length + pendingItvDocuments.length;
    const storedVehicleDocuments = storedPhotos.length + storedTechnicalSheetDocuments.length + storedCirculationPermitDocuments.length + storedItvDocuments.length;

    return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#1f2937", marginBottom: 4, padding: "0 2px" }}>
        {isCreating ? "Añadir vehículo propio" : "Editar vehículo"}
      </div>
      <p style={{ fontSize: 12.5, color: "#9ca3af", marginBottom: 12, padding: "0 2px", fontWeight: 300 }}>
        Crea tu garage personal con fotos, documentación y acciones rápidas.
      </p>

      <SectionBlock title="Características del vehículo" subtitle="Datos base, ficha técnica y atributos comerciales"
        open={openSections.characteristics} onToggle={() => toggleSection("characteristics")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {renderField("Alias / nombre", "nickname", { placeholder: "Coche familiar" })}
          {renderField("Marca", "brand", { placeholder: "Opel" })}
          {renderField("Modelo", "model", { placeholder: "Corsa" })}
          {renderField("Versión", "version", { placeholder: "1.4 Color Edition 90 CV" })}
          {renderField("Tipo de cambio", "transmissionType", { type: "select", options: [["manual","Manual"],["automatico","Automático"]] })}
          {renderField("Tipo de coche", "bodyType", { type: "select", options: [["berlina","Berlina"],["suv","SUV"],["familiar","Familiar"],["coupe","Coupé"],["cabrio","Cabrio"],["monovolumen","Monovolumen"],["pickup","Pickup"],["todoterreno","Todoterreno"],["furgoneta","Furgoneta"]] })}
          {renderField("CV", "cv", { placeholder: "90" })}
          {renderField("Caballos (cc)", "horsepower", { placeholder: "1398" })}
          {renderField("Color", "color", { placeholder: "Gris" })}
          {renderField("Plazas", "seats", { placeholder: "5" })}
          {renderField("Puertas", "doors", { placeholder: "5" })}
          {renderField("Ubicación", "location", { placeholder: "Madrid" })}
          {renderField("Etiqueta ambiental", "environmentalLabel", { type: "select", options: [["0","0 emisiones"],["eco","ECO"],["c","C"],["b","B"]] })}
          {renderField("Última ITV", "lastIvt", { placeholder: "2026-01-20" })}
          {renderField("Próxima ITV", "nextIvt", { placeholder: "2028-01-20" })}
          {renderField("CO₂ (g/km)", "co2", { placeholder: "120" })}
          {renderField("Año", "year", { placeholder: "2016" })}
          {renderField("Matrícula", "plate", { placeholder: "9052JMM" })}
          {renderField("Kilometraje", "mileage", { placeholder: "130000" })}
          {renderField("Combustible", "fuel", { type: "select", options: [["gasolina","Gasolina"],["diesel","Diésel"],["hibrido","Híbrido"],["electrico","Eléctrico"],["gas","Gas"]] })}
        </div>
      </SectionBlock>

      <SectionBlock title="Valor del Vehículo en el mercado" subtitle="Valor manual definido"
        open={openSections.marketplace} onToggle={() => toggleSection("marketplace")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {renderField("Precio (€)", "price", { placeholder: "8500" })}
        </div>
      </SectionBlock>

      <SectionBlock title="Documentos del vehículo"
        subtitle={`${storedVehicleDocuments} guardados · ${preparedVehicleDocuments} adjuntos preparados`}
        open={openSections.vehicleDocuments} onToggle={() => toggleSection("vehicleDocuments")}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {renderFileUpload("Fotos del vehículo", pendingPhotos, setPendingPhotos, photoInputRef, "image/*", "#2563eb", storedPhotos)}
          {renderFileUpload("Ficha técnica", pendingTechnicalSheetDocuments, setPendingTechnicalSheetDocuments, technicalSheetInputRef, ".pdf,image/*", "#0f766e", storedTechnicalSheetDocuments)}
          {renderFileUpload("Permiso de circulación", pendingCirculationPermitDocuments, setPendingCirculationPermitDocuments, circulationPermitInputRef, ".pdf,image/*", "#0f766e", storedCirculationPermitDocuments)}
          {renderFileUpload("Documentación ITV", pendingItvDocuments, setPendingItvDocuments, itvInputRef, ".pdf,image/*", "#0f766e", storedItvDocuments)}
        </div>
      </SectionBlock>

      <SectionBlock title="Seguros" subtitle={`${storedInsuranceDocuments.length} guardados · ${pendingInsuranceDocuments.length} documentos de seguro preparados`}
        open={openSections.insurance} onToggle={() => toggleSection("insurance")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {renderField("Aseguradora", "policyCompany", { placeholder: "Compañía de seguro" })}
          {renderField("Póliza", "policyNumber", { placeholder: "Número de póliza" })}
          {renderField("Cobertura", "coverageType", { placeholder: "Todo riesgo, terceros..." })}
        </div>
        <div style={{ marginTop: 12 }}>
          {renderFileUpload("Documentos del seguro", pendingInsuranceDocuments, setPendingInsuranceDocuments, insuranceDocInputRef, ".pdf,image/*", "#0f766e", storedInsuranceDocuments)}
        </div>
      </SectionBlock>

      <SectionBlock title="Mantenimientos" subtitle={`${storedMaintenanceInvoices.length} guardadas · ${pendingMaintenanceInvoices.length} facturas de mantenimiento preparadas`}
        open={openSections.maintenance} onToggle={() => toggleSection("maintenance")}>
        <div style={{ display: "grid", rowGap: 10, columnGap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          {renderField("Tipo mantenimiento", "maintenanceType", { placeholder: "Revisión, aceite, frenos..." })}
          {renderField("Descripción", "maintenanceTitle", { placeholder: "Qué se le ha hecho al coche" })}
        </div>
        <label style={{ ...LABEL_STYLE, marginTop: 10 }}>
          Notas mantenimiento
          <textarea value={form.maintenanceNotes} onChange={(e) => updateForm("maintenanceNotes", e.target.value)}
            placeholder="Detalle del mantenimiento" rows={2} style={{ ...INPUT_STYLE, resize: "vertical" }} />
        </label>
        <div style={{ marginTop: 12 }}>
          {renderFileUpload("Facturas de mantenimiento", pendingMaintenanceInvoices, setPendingMaintenanceInvoices, maintenanceInputRef, ".pdf,image/*", "#0f766e", storedMaintenanceInvoices)}
        </div>
      </SectionBlock>

      <SectionBlock title="Notas internas" subtitle={normalizeText(form.notes) ? "Con contenido" : "Sin notas"}
        open={openSections.notes} onToggle={() => toggleSection("notes")}>
        <label style={LABEL_STYLE}>
          Notas
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)}
            rows={3} placeholder="Notas privadas sobre este vehículo..." style={{ ...INPUT_STYLE, resize: "vertical" }} />
        </label>
      </SectionBlock>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4, padding: "10px 0" }}>
        <button type="button" onClick={handleSave} disabled={isSaving}
          style={{ border: "none", borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "11px 18px", fontSize: 13.5, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.78 : 1 }}>
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button type="button" onClick={cancelEdit}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#6b7280", padding: "11px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {isDetailView ? "Volver al listado" : "Cancelar edición"}
        </button>
      </div>
    </div>
    );
  };

  // ─── render ──────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto", color: "#1a1a1a", padding: "0 8px 18px" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button type="button" onClick={isCreateView ? onGoBack : onGoBack}
          style={{ border: "1px solid #ece8df", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#888", cursor: "pointer", fontWeight: 600 }}>
          ← Volver
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          Servicios › <span style={{ color: "#2563eb", fontWeight: 700 }}>
            {isCreateView ? "Crear IDCar" : isDetailView ? buildVehicleTitle(selectedVehicle || {}) : "Mis IDCars"}
          </span>
        </div>
      </div>

      {/* ── CREATE VIEW ── */}
      {isCreateView ? (
        <>
          <section style={{ ...SECTION_CARD_STYLE, padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2563eb", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 20, padding: "4px 12px", marginBottom: 10 }}>
              🚗 Nuevo IDCar
            </div>
            <h2 style={{ margin: "0 0 5px", fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>Crear mi IDCar</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: "#888", lineHeight: 1.6, fontWeight: 300, maxWidth: 520 }}>
              Añade tu vehículo con ficha técnica, documentación, seguro y mantenimiento. Todo en un mismo lugar.
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
        <h2 style={{ margin: "0 0 5px", fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>Gestionar mis IDCars</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#888", lineHeight: 1.6, fontWeight: 300 }}>
          Tus vehículos se sincronizan con el Panel de usuario. Puedes editarlos o quitarlos desde aquí.
        </p>
        {!isDetailView && !editingVehicleId && !isCreating ? (
          <button type="button" onClick={startCreate}
            style={{ border: "none", borderRadius: 12, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Crear nuevo IDCar
          </button>
        ) : null}
      </section>

      {feedback ? <div style={{ marginBottom: 10, fontSize: 13, color: feedbackColor, fontWeight: 600 }}>{feedback}</div> : null}

      {isDetailView && !selectedVehicle ? (
        <section style={{ ...SECTION_CARD_STYLE, padding: "18px 20px", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 6 }}>No se ha encontrado este IDCar</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Vuelve al listado y selecciona un vehículo válido.</div>
          <button type="button" onClick={onGoBack}
            style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#6b7280", padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Volver al listado
          </button>
        </section>
      ) : null}

      {!isDetailView && visibleVehicles.map((vehicle) => {
        const firstPhoto = getFirstPhotoSrc(vehicle);
        const docsCount = (vehicle.documents?.length || 0) + (vehicle.itvDocuments?.length || 0);
        const insuranceDocs = vehicle.insuranceDocuments?.length || 0;
        const maintenanceDocs = vehicle.maintenanceInvoices?.length || 0;
        const specGrid = [
          { label: "Marca", value: normalizeText(vehicle.brand) },
          { label: "Modelo", value: normalizeText(vehicle.model) },
          { label: "Año", value: normalizeText(vehicle.year) },
          { label: "Km", value: normalizeText(vehicle.mileage) ? `${normalizeText(vehicle.mileage)} km` : "" },
          { label: "Combustible", value: normalizeText(vehicle.fuel) },
          { label: "Cambio", value: normalizeText(vehicle.transmissionType) },
          { label: "CV", value: normalizeText(vehicle.cv) },
          { label: "Matrícula", value: normalizeText(vehicle.plate) },
          { label: "Color", value: normalizeText(vehicle.color) },
          { label: "Seguro", value: normalizeText(vehicle.policyCompany) },
          { label: "ITV", value: normalizeText(vehicle.nextIvt) ? `Próx. ${normalizeText(vehicle.nextIvt)}` : "" },
          { label: "Carrocería", value: normalizeText(vehicle.bodyType) },
        ].filter((s) => s.value);
        const envLabel = normalizeText(vehicle.environmentalLabel);
        const envColor = envLabel === "0" ? "#22c55e" : envLabel === "eco" ? "#0ea5e9" : envLabel === "c" ? "#f59e0b" : envLabel === "b" ? "#ef4444" : "";

        return (
          <section key={vehicle.id} className="idcar-card-animated" style={{ ...SECTION_CARD_STYLE, marginBottom: 8, padding: 0, overflow: "hidden" }}>
            {/* Main row: image left + specs right */}
            <div style={{ display: "flex", height: 148 }}>
              {/* QR column — full square */}
              <div style={{ flex: "0 0 120px", width: 120, background: "#ffffff", borderRight: "1px solid #f1ede6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QRCodeSVG
                  value={`https://movilidad-advisor.vercel.app/idcar/${vehicle.id}`}
                  size={104}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Photo column — wider */}
              <div style={{ position: "relative", flex: "0 0 220px", width: 220, background: "#f1ede6", overflow: "hidden", borderRight: "1px solid #f1ede6" }}>
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
              <div style={{ flex: "1 1 0%", background: "#fff", padding: "9px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "6px 10px" }}>
                  {specGrid.slice(0, 9).map(({ label, value }) => (
                    <div key={label} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", color: "#b8b1aa", fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: "#374151", fontWeight: 700, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {/* Doc badges + actions row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                    {docsCount > 0 && <span style={{ background: "rgba(37,99,235,0.07)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.18)", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>📄 {docsCount}</span>}
                    {insuranceDocs > 0 && <span style={{ background: "rgba(16,185,129,0.07)", color: "#047857", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>🛡️ {insuranceDocs}</span>}
                    {maintenanceDocs > 0 && <span style={{ background: "rgba(251,146,60,0.08)", color: "#c2410c", border: "1px solid rgba(251,146,60,0.22)", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>🔧 {maintenanceDocs}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button type="button" onClick={() => handleRemove(vehicle.id)}
                      style={{ border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.07)", color: "#dc2626", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                      Quitar
                    </button>
                    <button type="button" onClick={() => openVehicleDetail(vehicle, false)}
                      style={{ border: "1px solid rgba(15,118,110,0.3)", background: "rgba(15,118,110,0.07)", color: "#0f766e", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                      Ver ficha
                    </button>
                    <button type="button" onClick={() => openVehicleDetail(vehicle, true)}
                      style={{ border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", color: "#2563eb", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
                      ✏️ Editar ficha
                    </button>
                  ) : (
                    <button type="button" onClick={() => setIsEditMode(false)}
                      style={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 10, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", color: "#fff", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      👁 Ver ficha
                    </button>
                  )}
                  <button type="button" onClick={() => handleRemove(selectedVehicle.id)}
                    style={{ border: "1px solid rgba(239,68,68,0.5)", borderRadius: 10, background: "rgba(239,68,68,0.15)", backdropFilter: "blur(6px)", color: "#fca5a5", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Quitar
                  </button>
                </div>
              </div>
            </div>
            {/* Spec grid below image */}
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {[
                ["Marca", selectedVehicle.brand],
                ["Modelo", selectedVehicle.model],
                ["Versión", selectedVehicle.version],
                ["Año", selectedVehicle.year],
                ["Color", selectedVehicle.color],
                ["Cambio", selectedVehicle.transmissionType],
                ["Carrocería", selectedVehicle.bodyType],
                ["CV", selectedVehicle.cv],
                ["CO₂", selectedVehicle.co2 ? `${selectedVehicle.co2} g/km` : ""],
                ["ITV", selectedVehicle.nextIvt ? `Próxima: ${selectedVehicle.nextIvt}` : ""],
                ["Seguro", selectedVehicle.policyCompany],
                ["Cobertura", selectedVehicle.coverageType],
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
                  {photoCount > 0 && <span style={{ background: "rgba(37,99,235,0.08)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>📷 {photoCount} foto{photoCount !== 1 ? "s" : ""}</span>}
                  {docCount > 0 && <span style={{ background: "rgba(37,99,235,0.08)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>📄 {docCount} doc{docCount !== 1 ? "s" : ""}</span>}
                  {insCount > 0 && <span style={{ background: "rgba(16,185,129,0.08)", color: "#047857", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>🛡️ {insCount} seguro{insCount !== 1 ? "s" : ""}</span>}
                  {mntCount > 0 && <span style={{ background: "rgba(251,146,60,0.1)", color: "#c2410c", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>🔧 {mntCount} mant.</span>}
                  {normalizeText(selectedVehicle.notes) ? <span style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280", border: "1px solid rgba(107,114,128,0.18)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>📝 Notas</span> : null}
                </div>
              );
            })()}

            {(() => {
              const sections = [
                { key: "photos", title: "Fotos del vehículo", items: Array.isArray(selectedVehicle.photos) ? selectedVehicle.photos : [], color: "#1d4ed8" },
                {
                  key: "technical-sheet",
                  title: "Ficha técnica",
                  items: [
                    ...(Array.isArray(selectedVehicle.technicalSheetDocuments) ? selectedVehicle.technicalSheetDocuments : []),
                    ...(Array.isArray(selectedVehicle.documents) ? selectedVehicle.documents : []),
                  ],
                  color: "#0f766e",
                },
                { key: "circulation-permit", title: "Permiso de circulación", items: Array.isArray(selectedVehicle.circulationPermitDocuments) ? selectedVehicle.circulationPermitDocuments : [], color: "#0f766e" },
                { key: "itv", title: "Documentación ITV", items: Array.isArray(selectedVehicle.itvDocuments) ? selectedVehicle.itvDocuments : [], color: "#0f766e" },
                { key: "insurance", title: "Documentos de seguro", items: Array.isArray(selectedVehicle.insuranceDocuments) ? selectedVehicle.insuranceDocuments : [], color: "#047857" },
                { key: "maintenance", title: "Facturas de mantenimiento", items: Array.isArray(selectedVehicle.maintenanceInvoices) ? selectedVehicle.maintenanceInvoices : [], color: "#c2410c" },
              ];

              return (
                <div style={{ padding: "0 20px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                  {sections.map((section) => (
                    <div key={section.key} style={{ border: "1px solid #ece8df", borderRadius: 10, background: "#fff", padding: "10px 11px" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{section.title}</div>
                      {section.items.length ? (
                        <div style={{ display: "grid", gap: 4 }}>
                          {section.items.slice(0, 5).map((file, index) => (
                            <div key={`${section.key}-${normalizeText(file?.name)}-${index}`} style={{ fontSize: 11.5, color: section.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              • {getAttachmentLink(file)
                                ? <a href={getAttachmentLink(file)} target="_blank" rel="noreferrer" style={{ color: section.color, textDecoration: "none", fontWeight: 700 }}>{normalizeText(file?.name) || `Archivo ${index + 1}`}</a>
                                : (normalizeText(file?.name) || `Archivo ${index + 1}`)}
                            </div>
                          ))}
                          {section.items.length > 5 ? <div style={{ fontSize: 11, color: "#9ca3af" }}>+{section.items.length - 5} archivo(s) más</div> : null}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11.5, color: "#9ca3af" }}>Sin adjuntos</div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          {isEditMode ? renderVehicleEditor() : null}
        </>
      ) : null}

      {!isDetailView && (isCreating || editingVehicleId) ? renderVehicleEditor() : null}

      {!visibleVehicles.length && !isCreating && !isDetailView ? (
        <section style={{ ...SECTION_CARD_STYLE, padding: "20px 16px" }}>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 10 }}>Aún no tienes IDCars creados.</div>
          <button type="button" onClick={startCreate}
            style={{ border: "none", borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Crear mi primer IDCar
          </button>
        </section>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <button type="button" onClick={onGoHome}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#6b7280", padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Ir al inicio
        </button>
      </div>
        </>
      ) : null}

    </div>
  );
}
