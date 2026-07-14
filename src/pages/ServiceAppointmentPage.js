import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getGarageVehiclesJson, getNearbyWorkshopsJson } from "../utils/apiClient";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

function readGarageVehicles(currentUserEmail = "") {
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
    // Ignore localStorage errors and keep runtime data.
  }
}

function normalizeToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveRevisionIndex(revisionTypes = [], revisionTitle = "") {
  const target = normalizeToken(revisionTitle);
  if (!target) {
    return -1;
  }

  const exactIndex = revisionTypes.findIndex((item) => normalizeToken(item?.id) === target);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const partialIndex = revisionTypes.findIndex((item) => {
    const label = normalizeToken(item?.id);
    return label && (target.includes(label) || label.includes(target));
  });

  if (partialIndex >= 0) {
    return partialIndex;
  }

  if (target.includes("itv") || target.includes("inspeccion")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.id).includes("itv"));
  }

  if (target.includes("fren")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.id).includes("freno"));
  }

  if (target.includes("neumatic") || target.includes("rueda") || target.includes("llanta")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.id).includes("neumatic"));
  }

  if (target.includes("mayor") || target.includes("completa")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.id).includes("mayor"));
  }

  if (target.includes("aceite") || target.includes("filtro") || target.includes("menor")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.id).includes("menor"));
  }

  return -1;
}

function resolveSpecificTypePrefill(sections = [], revisionTitle = "") {
  const target = normalizeToken(revisionTitle);
  if (!target) {
    return { sectionTitle: "", itemLabel: "" };
  }

  for (const section of sections) {
    const sectionItems = Array.isArray(section?.items) ? section.items : [];
    for (const item of sectionItems) {
      const itemToken = normalizeToken(item?.id ?? item);
      if (itemToken && (target.includes(itemToken) || itemToken.includes(target))) {
        return {
          sectionTitle: normalizeText(section?.title),
          itemLabel: item?.id ?? item,
        };
      }
    }
  }

  return { sectionTitle: "", itemLabel: "" };
}

const SERVICE_PRICE_CATALOG = {
  "Cambio de neumaticos (x4 montaje)": { norauto: { min: 60, mid: 80, max: 120 }, midas: { min: 55, mid: 75, max: 110 } },
  Equilibrado: { norauto: { min: 15, mid: 25, max: 40 }, midas: { min: 15, mid: 25, max: 40 } },
  Alineacion: { norauto: { min: 50, mid: 65, max: 90 }, midas: { min: 50, mid: 70, max: 95 } },
  "Reparacion de pinchazos": { norauto: { min: 15, mid: 20, max: 30 }, midas: { min: 15, mid: 25, max: 35 } },
  "Permutacion de ruedas": { norauto: { min: 20, mid: 30, max: 45 }, midas: { min: 25, mid: 35, max: 50 } },
  "Diagnostico de neumaticos": { norauto: { min: 0, mid: 10, max: 20 }, midas: { min: 0, mid: 0, max: 15 } },
  "Pastillas de freno (eje)": { norauto: { min: 80, mid: 110, max: 150 }, midas: { min: 90, mid: 120, max: 160 } },
  "Discos + pastillas": { norauto: { min: 180, mid: 250, max: 350 }, midas: { min: 200, mid: 270, max: 400 } },
  "Amortiguadores (2 uds)": { norauto: { min: 180, mid: 260, max: 400 }, midas: { min: 200, mid: 280, max: 420 } },
  "Direccion (rotulas, etc.)": { norauto: { min: 80, mid: 150, max: 250 }, midas: { min: 100, mid: 170, max: 280 } },
  Embrague: { norauto: { min: 400, mid: 650, max: 1000 }, midas: { min: 500, mid: 700, max: 1200 } },
  Transmision: { norauto: { min: 150, mid: 400, max: 900 }, midas: { min: 180, mid: 450, max: 1000 } },
  Escape: { norauto: { min: 120, mid: 250, max: 600 }, midas: { min: 150, mid: 300, max: 650 } },
  "Correa distribucion": { norauto: { min: 300, mid: 500, max: 800 }, midas: { min: 350, mid: 550, max: 900 } },
  "Reparaciones generales": { norauto: { min: 50, mid: 150, max: "500+" }, midas: { min: 60, mid: 180, max: "600+" } },
  "Revision oficial": { norauto: { min: 90, mid: 150, max: 250 }, midas: { min: 110, mid: 170, max: 280 } },
  "Cambio aceite + filtro": { norauto: { min: 60, mid: 75, max: 110 }, midas: { min: 70, mid: 90, max: 130 } },
  "Cambio de filtros": { norauto: { min: 20, mid: 40, max: 80 }, midas: { min: 25, mid: 50, max: 90 } },
  "Revision niveles": { norauto: { min: 10, mid: 20, max: 30 }, midas: { min: 0, mid: 10, max: 25 } },
  AdBlue: { norauto: { min: 10, mid: 25, max: 40 }, midas: { min: 15, mid: 30, max: 45 } },
  "Bateria (con montaje)": { norauto: { min: 90, mid: 130, max: 220 }, midas: { min: 110, mid: 150, max: 250 } },
  "Recarga aire acondicionado": { norauto: { min: 70, mid: 90, max: 130 }, midas: { min: 60, mid: 85, max: 120 } },
  "Deteccion averias": { norauto: { min: 40, mid: 70, max: 120 }, midas: { min: 0, mid: 50, max: 100 } },
  "Eliminacion olores": { norauto: { min: 20, mid: 40, max: 70 }, midas: { min: 30, mid: 50, max: 80 } },
  "Diagnostico electronico": { norauto: { min: 50, mid: 70, max: 100 }, midas: { min: 0, mid: 50, max: 90 } },
  "Diagnostico bateria": { norauto: { min: 0, mid: 15, max: 30 }, midas: { min: 0, mid: 0, max: 20 } },
  "Diagnostico frenos": { norauto: { min: 20, mid: 40, max: 70 }, midas: { min: 0, mid: 30, max: 60 } },
  "Diagnostico amortiguadores": { norauto: { min: 20, mid: 40, max: 70 }, midas: { min: 0, mid: 30, max: 60 } },
  "Diagnostico general": { norauto: { min: 50, mid: 80, max: 120 }, midas: { min: 0, mid: 60, max: 120 } },
  "Pre-ITV": { norauto: { min: 40, mid: 55, max: 80 }, midas: { min: 45, mid: 60, max: 85 } },
  "ITV por ti": { norauto: { min: 80, mid: 120, max: 180 }, midas: { min: 90, mid: 130, max: 190 } },
  "Cambio bombillas": { norauto: { min: 10, mid: 20, max: 40 }, midas: { min: 15, mid: 25, max: 45 } },
  "Reglaje faros": { norauto: { min: 15, mid: 25, max: 40 }, midas: { min: 20, mid: 30, max: 45 } },
  "Pulido faros": { norauto: { min: 40, mid: 70, max: 120 }, midas: { min: 50, mid: 80, max: 130 } },
  Escobillas: { norauto: { min: 15, mid: 30, max: 50 }, midas: { min: 20, mid: 35, max: 55 } },
  Descarbonizacion: { norauto: { min: 60, mid: 90, max: 150 }, midas: { min: 80, mid: 120, max: 180 } },
  "Desinfeccion habitaculo": { norauto: { min: 20, mid: 40, max: 70 }, midas: { min: 30, mid: 50, max: 80 } },
  Matriculas: { norauto: { min: 10, mid: 20, max: 40 }, midas: { min: 15, mid: 25, max: 45 } },
  Accesorios: { norauto: { min: 20, mid: 60, max: 150 }, midas: { min: 30, mid: 70, max: 180 } },
  "Radio / multimedia": { norauto: { min: 40, mid: 80, max: 150 }, midas: { min: 50, mid: 100, max: 180 } },
  "Enganche remolque": { norauto: { min: 300, mid: 500, max: 900 }, midas: { min: 350, mid: 550, max: 950 } },
  "Mantenimiento moto": { norauto: null, midas: { min: 70, mid: 120, max: 250 } },
  "Neumaticos moto": { norauto: null, midas: { min: 60, mid: 100, max: 180 } },
  "Frenos moto": { norauto: null, midas: { min: 80, mid: 120, max: 200 } },
  "Bateria moto": { norauto: null, midas: { min: 50, mid: 90, max: 150 } },
  "Suspension/transmision moto": { norauto: null, midas: { min: 100, mid: 200, max: 400 } },
  "Recogida y entrega": { norauto: { min: 0, mid: 15, max: 30 }, midas: { min: 0, mid: 20, max: 40 } },
  "Servicio a domicilio": { norauto: { min: 20, mid: 40, max: 80 }, midas: { min: 30, mid: 50, max: 90 } },
  "Flotas/empresas": { norauto: { min: "Personalizado", mid: "Personalizado", max: "Personalizado" }, midas: { min: "Personalizado", mid: "Personalizado", max: "Personalizado" } },
};

const SERVICE_ALIAS_TO_CATALOG = {
  "revision menor": "Cambio aceite + filtro",
  "revision mayor": "Revision oficial",
  "revision de frenos": "Pastillas de freno (eje)",
  neumaticos: "Cambio de neumaticos (x4 montaje)",
  "revision itv": "Pre-ITV",
  "cambio de neumaticos": "Cambio de neumaticos (x4 montaje)",
  equilibrado: "Equilibrado",
  alineacion: "Alineacion",
  "reparacion de pinchazos": "Reparacion de pinchazos",
  "permutacion de ruedas": "Permutacion de ruedas",
  "diagnostico de neumaticos": "Diagnostico de neumaticos",
  "frenos (pastillas, discos)": "Discos + pastillas",
  "suspension (amortiguadores, rotulas)": "Amortiguadores (2 uds)",
  direccion: "Direccion (rotulas, etc.)",
  embrague: "Embrague",
  transmision: "Transmision",
  escapes: "Escape",
  "correa de distribucion": "Correa distribucion",
  "reparaciones generales": "Reparaciones generales",
  "revision oficial (tipo fabricante)": "Revision oficial",
  "cambio de aceite": "Cambio aceite + filtro",
  "cambio de filtros": "Cambio de filtros",
  "revision de niveles": "Revision niveles",
  adblue: "AdBlue",
  bateria: "Bateria (con montaje)",
  "recarga de aire acondicionado": "Recarga aire acondicionado",
  "deteccion de averias": "Deteccion averias",
  "eliminacion de olores (tipo aircare)": "Eliminacion olores",
  "diagnostico electronico": "Diagnostico electronico",
  "diagnostico de bateria": "Diagnostico bateria",
  "diagnostico de frenos": "Diagnostico frenos",
  "diagnostico de amortiguadores": "Diagnostico amortiguadores",
  "diagnostico general del vehiculo": "Diagnostico general",
  "revision pre-itv": "Pre-ITV",
  "servicio de pasar itv por ti": "ITV por ti",
  "cambio de bombillas": "Cambio bombillas",
  "reglaje de faros": "Reglaje faros",
  "pulido de faros": "Pulido faros",
  "escobillas limpiaparabrisas": "Escobillas",
  "descarbonizacion / limpieza de motor (motorcare en midas)": "Descarbonizacion",
  "desinfeccion del habitaculo": "Desinfeccion habitaculo",
  "eliminacion de olores": "Eliminacion olores",
  matriculas: "Matriculas",
  "accesorios y equipamiento": "Accesorios",
  "multimedia / radio": "Radio / multimedia",
  enganches: "Enganche remolque",
  "mantenimiento de moto": "Mantenimiento moto",
  "neumaticos moto": "Neumaticos moto",
  "frenos moto": "Frenos moto",
  "bateria moto": "Bateria moto",
  "suspension y transmision moto": "Suspension/transmision moto",
  "recogida y entrega del vehiculo": "Recogida y entrega",
  "servicio a domicilio (algunas operaciones)": "Servicio a domicilio",
  "servicios para flotas/empresas": "Flotas/empresas",
};

function resolveCatalogServiceName(appointmentTypeName = "") {
  const normalized = normalizeToken(appointmentTypeName);
  if (!normalized) {
    return "";
  }

  return SERVICE_ALIAS_TO_CATALOG[normalized] || "";
}

function chooseParticularPrice(range) {
  if (!range) {
    return null;
  }
  return range.max ?? range.mid ?? range.min ?? null;
}

function chooseCarsWisePrice(range) {
  if (!range) {
    return null;
  }
  return range.mid ?? range.min ?? range.max ?? null;
}

function formatPriceTag(value, options = {}) {
  const notAvailable = options.notAvailable ?? "N/A";
  const free = options.free ?? "Free";
  if (value === null || value === undefined) {
    return notAvailable;
  }

  if (typeof value === "number") {
    return value <= 0 ? free : `${value}€`;
  }

  return String(value);
}

const REVISION_TYPES = [
  { id: "Revision menor", nameKey: "service.revisionMinorName", subtitleKey: "service.revisionMinorSubtitle" },
  { id: "Revision mayor", nameKey: "service.revisionMajorName", subtitleKey: "service.revisionMajorSubtitle" },
  { id: "Revision de frenos", nameKey: "service.revisionBrakesName", subtitleKey: "service.revisionBrakesSubtitle" },
  { id: "Neumaticos", nameKey: "service.revisionTiresName", subtitleKey: "service.revisionTiresSubtitle" },
  { id: "Revision ITV", nameKey: "service.revisionITVName", subtitleKey: "service.revisionITVSubtitle" },
];

const SPECIFIC_APPOINTMENT_SECTIONS = [
  {
    title: "🔧 1. Neumaticos",
    titleKey: "service.specificSec1Title",
    items: [
      { id: "Cambio de neumaticos", labelKey: "service.specificSec1Item1" },
      { id: "Equilibrado", labelKey: "service.specificSec1Item2" },
      { id: "Alineacion", labelKey: "service.specificSec1Item3" },
      { id: "Reparacion de pinchazos", labelKey: "service.specificSec1Item4" },
      { id: "Permutacion de ruedas", labelKey: "service.specificSec1Item5" },
      { id: "Diagnostico de neumaticos", labelKey: "service.specificSec1Item6" },
    ],
  },
  {
    title: "🛠️ 2. Mecanica general y reparaciones",
    titleKey: "service.specificSec2Title",
    items: [
      { id: "Frenos (pastillas, discos)", labelKey: "service.specificSec2Item1" },
      { id: "Suspension (amortiguadores, rotulas)", labelKey: "service.specificSec2Item2" },
      { id: "Direccion", labelKey: "service.specificSec2Item3" },
      { id: "Embrague", labelKey: "service.specificSec2Item4" },
      { id: "Transmision", labelKey: "service.specificSec2Item5" },
      { id: "Escapes", labelKey: "service.specificSec2Item6" },
      { id: "Correa de distribucion", labelKey: "service.specificSec2Item7" },
      { id: "Reparaciones generales", labelKey: "service.specificSec2Item8" },
    ],
    note: "En Midas entra dentro de mantenimiento y mecanica.",
    noteKey: "service.specificSec2Note",
  },
  {
    title: "🛢️ 3. Mantenimiento y revisiones",
    titleKey: "service.specificSec3Title",
    items: [
      { id: "Revision oficial (tipo fabricante)", labelKey: "service.specificSec3Item1" },
      { id: "Cambio de aceite", labelKey: "service.specificSec3Item2" },
      { id: "Cambio de filtros", labelKey: "service.specificSec3Item3" },
      { id: "Revision de niveles", labelKey: "service.specificSec3Item4" },
      { id: "AdBlue", labelKey: "service.specificSec3Item5" },
      { id: "Bateria", labelKey: "service.specificSec3Item6" },
    ],
    note: "Midas lo agrupa como Revision y mantenimiento.",
    noteKey: "service.specificSec3Note",
  },
  {
    title: "❄️ 4. Climatizacion / Aire acondicionado",
    titleKey: "service.specificSec4Title",
    items: [
      { id: "Recarga de aire acondicionado", labelKey: "service.specificSec4Item1" },
      { id: "Deteccion de averias", labelKey: "service.specificSec4Item2" },
      { id: "Eliminacion de olores (tipo AirCare)", labelKey: "service.specificSec4Item3" },
    ],
  },
  {
    title: "🔍 5. Diagnostico",
    titleKey: "service.specificSec5Title",
    items: [
      { id: "Diagnostico electronico", labelKey: "service.specificSec5Item1" },
      { id: "Diagnostico de bateria", labelKey: "service.specificSec5Item2" },
      { id: "Diagnostico de frenos", labelKey: "service.specificSec5Item3" },
      { id: "Diagnostico de amortiguadores", labelKey: "service.specificSec5Item4" },
      { id: "Diagnostico general del vehiculo", labelKey: "service.specificSec5Item5" },
    ],
    note: "En Midas muchos son gratuitos con cita previa.",
    noteKey: "service.specificSec5Note",
  },
  {
    title: "🚗 6. Pre-ITV e ITV",
    titleKey: "service.specificSec6Title",
    items: [
      { id: "Revision Pre-ITV", labelKey: "service.specificSec6Item1" },
      { id: "Servicio de pasar ITV por ti", labelKey: "service.specificSec6Item2" },
    ],
    note: "Lo ofrecen ambos.",
    noteKey: "service.specificSec6Note",
  },
  {
    title: "💡 7. Iluminacion y visibilidad",
    titleKey: "service.specificSec7Title",
    items: [
      { id: "Cambio de bombillas", labelKey: "service.specificSec7Item1" },
      { id: "Reglaje de faros", labelKey: "service.specificSec7Item2" },
      { id: "Pulido de faros", labelKey: "service.specificSec7Item3" },
      { id: "Escobillas limpiaparabrisas", labelKey: "service.specificSec7Item4" },
    ],
  },
  {
    title: "🧼 8. Servicios especificos / especiales",
    titleKey: "service.specificSec8Title",
    items: [
      { id: "Descarbonizacion / limpieza de motor (MotorCare en Midas)", labelKey: "service.specificSec8Item1" },
      { id: "Desinfeccion del habitaculo", labelKey: "service.specificSec8Item2" },
      { id: "Eliminacion de olores", labelKey: "service.specificSec8Item3" },
    ],
  },
  {
    title: "🔩 9. Instalacion de accesorios",
    titleKey: "service.specificSec9Title",
    items: [
      { id: "Matriculas", labelKey: "service.specificSec9Item1" },
      { id: "Accesorios y equipamiento", labelKey: "service.specificSec9Item2" },
      { id: "Multimedia / radio", labelKey: "service.specificSec9Item3" },
      { id: "Enganches", labelKey: "service.specificSec9Item4" },
    ],
  },
  {
    title: "🏍️ 10. Moto",
    titleKey: "service.specificSec10Title",
    items: [
      { id: "Mantenimiento de moto", labelKey: "service.specificSec10Item1" },
      { id: "Neumaticos moto", labelKey: "service.specificSec10Item2" },
      { id: "Frenos moto", labelKey: "service.specificSec10Item3" },
      { id: "Bateria moto", labelKey: "service.specificSec10Item4" },
      { id: "Suspension y transmision moto", labelKey: "service.specificSec10Item5" },
    ],
    note: "Extra que destaca en Midas.",
    noteKey: "service.specificSec10Note",
  },
  {
    title: "🚚 11. Servicios adicionales",
    titleKey: "service.specificSec11Title",
    items: [
      { id: "Recogida y entrega del vehiculo", labelKey: "service.specificSec11Item1" },
      { id: "Servicio a domicilio (algunas operaciones)", labelKey: "service.specificSec11Item2" },
      { id: "Servicios para flotas/empresas", labelKey: "service.specificSec11Item3" },
    ],
  },
];

function buildVehicleDisplayName(vehicle = {}, fallbackIndex = 0) {
  const title = normalizeText(vehicle?.title);
  const brand = normalizeText(vehicle?.brand);
  const model = normalizeText(vehicle?.model);
  const plate = normalizeText(vehicle?.plate).toUpperCase();

  const base = title || [brand, model].filter(Boolean).join(" ") || `IDCar ${fallbackIndex + 1}`;
  return plate ? `${base} (${plate})` : base;
}

export default function ServiceAppointmentPage({
  currentUserEmail = "",
  selectedVehicleId = "",
  selectedRevisionTitle = "",
  onSelectVehicleId = () => {},
  onConfirmAppointment = async () => {},
  onManageIdCars = () => {},
  onGoBack,
  onGoHome,
}) {
  const { t } = useTranslation();
  const pricingNotice = t("service.appointmentPricingNotice");
  const priceOptions = {
    notAvailable: t("service.appointmentPriceNotAvailable"),
    free: t("service.appointmentPriceFree"),
  };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const [selectedRevision, setSelectedRevision] = useState(-1);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [garageVehicles, setGarageVehicles] = useState(() => readGarageVehicles(currentUserEmail));
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [isSearchingWorkshops, setIsSearchingWorkshops] = useState(false);
  const [workshopSearchError, setWorkshopSearchError] = useState("");
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [isSpecificOpen, setIsSpecificOpen] = useState(false);
  const [selectedSpecificSection, setSelectedSpecificSection] = useState("");
  const [selectedSpecificType, setSelectedSpecificType] = useState("");

  useEffect(() => {
    let disposed = false;

    const loadGarage = async () => {
      const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
      if (!normalizedEmail) {
        if (!disposed) {
          setGarageVehicles([]);
          setVehicleId("");
        }
        return;
      }

      if (!disposed) {
        setGarageVehicles(readGarageVehicles(normalizedEmail));
      }

      setIsLoadingVehicles(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);
      try {
        const { response, data } = await getGarageVehiclesJson(normalizedEmail, { signal: controller.signal });
        if (!disposed && response.ok && Array.isArray(data?.vehicles)) {
          const nextVehicles = data.vehicles.filter((item) => item && normalizeText(item?.id));
          setGarageVehicles(nextVehicles);
          writeGarageVehiclesCache(normalizedEmail, nextVehicles);
        }
      } catch {
      } finally {
        clearTimeout(timeoutId);
        if (!disposed) {
          setIsLoadingVehicles(false);
        }
      }
    };

    void loadGarage();
    return () => {
      disposed = true;
    };
  }, [currentUserEmail]);

  const vehicleOptions = useMemo(() => {
    return garageVehicles.map((vehicle, index) => ({
      id: normalizeText(vehicle?.id),
      label: buildVehicleDisplayName(vehicle, index),
    }));
  }, [garageVehicles]);

  useEffect(() => {
    const normalizedSelected = normalizeText(selectedVehicleId);
    if (!vehicleOptions.length) {
      setVehicleId("");
      return;
    }

    const hasSelectedFromContext = normalizedSelected && vehicleOptions.some((option) => option.id === normalizedSelected);
    if (hasSelectedFromContext) {
      setVehicleId(normalizedSelected);
      return;
    }

    if (vehicleId && !vehicleOptions.some((option) => option.id === vehicleId)) {
      setVehicleId("");
    }
  }, [selectedVehicleId, vehicleOptions, vehicleId]);

  useEffect(() => {
    const nextIndex = resolveRevisionIndex(REVISION_TYPES, selectedRevisionTitle);
    if (nextIndex >= 0) {
      setSelectedRevision(nextIndex);
      setSelectedSpecificSection("");
      setSelectedSpecificType("");
      return;
    }

    const specificPrefill = resolveSpecificTypePrefill(SPECIFIC_APPOINTMENT_SECTIONS, selectedRevisionTitle);
    if (specificPrefill.sectionTitle && specificPrefill.itemLabel) {
      setSelectedRevision(-1);
      setSelectedSpecificSection(specificPrefill.sectionTitle);
      setSelectedSpecificType(specificPrefill.itemLabel);
      setIsSpecificOpen(true);
      return;
    }

    setSelectedRevision(-1);
  }, [selectedRevisionTitle]);

  useEffect(() => {
    if (!vehicleId) {
      return;
    }

    const normalizedSelected = normalizeText(selectedVehicleId);
    if (normalizedSelected === vehicleId) {
      return;
    }

    onSelectVehicleId(vehicleId);
  }, [vehicleId, onSelectVehicleId, selectedVehicleId]);

  const selectedSpecificSectionModel = SPECIFIC_APPOINTMENT_SECTIONS.find(
    (section) => normalizeText(section?.title) === selectedSpecificSection
  ) || null;
  const specificTypeOptions = selectedSpecificSectionModel?.items || [];

  const hasAnyVehicles = vehicleOptions.length > 0;
  const hasValidPostalCode = /^\d{5}$/.test(normalizeText(postalCode));
  const hasLocationContext = Boolean(normalizeText(province)) && hasValidPostalCode;

  useEffect(() => {
    let disposed = false;

    const searchNearbyWorkshops = async () => {
      if (!hasLocationContext) {
        if (!disposed) {
          setNearbyProviders([]);
          setWorkshopSearchError("");
          setIsSearchingWorkshops(false);
        }
        return;
      }

      setIsSearchingWorkshops(true);
      setWorkshopSearchError("");

      try {
        const { response, data } = await getNearbyWorkshopsJson({
          postalCode,
          province,
        });

        if (!disposed) {
          if (response.ok && Array.isArray(data?.providers)) {
            setNearbyProviders(data.providers);
          } else {
            setNearbyProviders([]);
            setWorkshopSearchError(normalizeText(data?.error) || t("service.appointmentWorkshopsError"));
          }
        }
      } catch {
        if (!disposed) {
          setNearbyProviders([]);
          setWorkshopSearchError(t("service.appointmentWorkshopsError"));
        }
      } finally {
        if (!disposed) {
          setIsSearchingWorkshops(false);
        }
      }
    };

    void searchNearbyWorkshops();
    return () => {
      disposed = true;
    };
  }, [hasLocationContext, postalCode, province, t]);

  const canChooseRevision = hasAnyVehicles && Boolean(vehicleId) && hasLocationContext;
  const selectedPopularRevisionName = selectedRevision >= 0 ? REVISION_TYPES[selectedRevision].id : "";
  const selectedAppointmentTypeName = selectedSpecificType || selectedPopularRevisionName;
  const hasSelectedProvider = Boolean(normalizeText(selectedProvider));
  const canContinueBooking = canChooseRevision && Boolean(selectedAppointmentTypeName) && hasSelectedProvider;
  const selectedVehicle = garageVehicles.find((item) => normalizeText(item?.id) === vehicleId) || null;
  const selectedVehicleLabel = vehicleOptions.find((item) => item.id === vehicleId)?.label || "";

  const selectedRevisionName = selectedAppointmentTypeName || t("service.appointmentRevisionFallback");
  const selectedCatalogServiceName = resolveCatalogServiceName(selectedAppointmentTypeName);
  const selectedServicePricing = SERVICE_PRICE_CATALOG[selectedCatalogServiceName] || null;

  // Build provider cards dynamically from API results — supports Norauto/MIDAS (with pricing)
  // and independent talleres from the real workshop DB (price "a consultar")
  const providerOffers = nearbyProviders
    .filter((p) => p?.available)
    .map((p) => {
      const knownRange = selectedServicePricing?.[p.providerKey] || null;
      const particular = chooseParticularPrice(knownRange);
      const withCarsWise = chooseCarsWisePrice(knownRange);
      const savings =
        typeof particular === "number" && typeof withCarsWise === "number"
          ? Math.max(0, particular - withCarsWise)
          : null;
      return {
        key: p.providerKey,
        name: p.providerName,
        range: knownRange,
        particular,
        withCarsWise,
        savings,
        nearby: p,
        isIndependent: p.isIndependent || false,
      };
    });

  const selectedProviderOffer = providerOffers.find((item) => item.key === selectedProvider) || null;
  const selectedProviderLabel =
    selectedProviderOffer?.name ||
    nearbyProviders.find((p) => p.providerKey === selectedProvider)?.providerName ||
    t("service.appointmentProviderFallback");

  const handleConfirmAppointment = async () => {
    if (!canContinueBooking || isSubmittingAppointment) {
      return;
    }

    setIsSubmittingAppointment(true);
    try {
      await onConfirmAppointment({
        vehicleId,
        vehicleTitle: normalizeText(selectedVehicle?.title) || selectedVehicleLabel,
        vehiclePlate: normalizeText(selectedVehicle?.plate),
        appointmentType: selectedAppointmentTypeName,
        provider: selectedProviderOffer?.name || selectedProviderLabel,
        workshopId: normalizeText(selectedProviderOffer?.nearby?.workshop?.id),
        workshopName: normalizeText(selectedProviderOffer?.nearby?.workshop?.name),
        workshopAddress: normalizeText(selectedProviderOffer?.nearby?.workshop?.address),
        workshopDistanceKm: selectedProviderOffer?.nearby?.workshop?.distanceKm,
        province: normalizeText(province),
        postalCode: normalizeText(postalCode),
        quotedPrice: selectedProviderOffer?.withCarsWise,
      });
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto", color: "#1a1a1a", padding: "0 8px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button
          type="button"
          onClick={onGoBack}
          style={{
            border: "1px solid #ece8df",
            background: "#ffffff",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            color: "#888",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {t("common.backArrow")}
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          {t("common.breadcrumbServices")} › <span style={{ color: "#8b5cf6", fontWeight: 700 }}>{t("service.appointmentBreadcrumb")}</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#8b5cf6" }} />
        <div style={{ padding: "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#7c3aed",
              background: "rgba(139,92,246,0.08)",
              borderRadius: 20,
              padding: "4px 11px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {t("service.appointmentPageBadge")}
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            {t("service.appointmentPageTitle")}
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            {t("service.appointmentPageDescription")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {[
              t("service.appointmentPillNegotiatedPrices"),
              t("service.appointmentPill2Clicks"),
              t("service.appointmentPillVerifiedWorkshops"),
            ].map((pill) => (
              <span
                key={pill}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#a0a0a0",
                  border: "1px solid #efebe4",
                  background: "#fafaf9",
                  padding: "5px 12px",
                  borderRadius: 30,
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 18, marginBottom: 12, border: "1px solid rgba(139,92,246,0.22)", background: "rgba(250,245,255,0.6)" }}>
        <div style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
          {t("service.appointmentIdCarSectionLabel")}
        </div>

        {isLoadingVehicles ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>{t("service.appointmentLoadingIdCars")}</div>
        ) : !hasAnyVehicles ? (
          <>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 10 }}>
              {t("service.appointmentNoIdCarMessage")}
            </div>
            <button
              type="button"
              onClick={onManageIdCars}
              style={{
                border: "none",
                borderRadius: 10,
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                color: "#fff",
                padding: "9px 13px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("service.appointmentGoManageIdCars")}
            </button>
          </>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#5b21b6", fontWeight: 700 }}>
              {t("service.appointmentSelectIdCarHint")}
            </div>
            <select
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              style={{
                border: "1px solid rgba(139,92,246,0.32)",
                borderRadius: 10,
                background: "#fff",
                padding: "9px 11px",
                fontSize: 13,
                color: "#312e81",
                fontWeight: 700,
              }}
            >
              <option value="">{t("service.appointmentSelectIdCarPlaceholder")}</option>
              {vehicleOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 700 }}>{t("service.appointmentProvinceLabel")}</span>
                <input
                  type="text"
                  value={province}
                  onChange={(event) => setProvince(event.target.value)}
                  placeholder={t("service.appointmentProvincePlaceholder")}
                  style={{
                    border: "1px solid rgba(139,92,246,0.32)",
                    borderRadius: 10,
                    background: "#fff",
                    padding: "9px 11px",
                    fontSize: 13,
                    color: "#312e81",
                    fontWeight: 600,
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 700 }}>{t("service.appointmentPostalCodeLabel")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={postalCode}
                  onChange={(event) => setPostalCode(String(event.target.value || "").replace(/\D/g, "").slice(0, 5))}
                  placeholder="28001"
                  style={{
                    border: "1px solid rgba(139,92,246,0.32)",
                    borderRadius: 10,
                    background: "#fff",
                    padding: "9px 11px",
                    fontSize: 13,
                    color: "#312e81",
                    fontWeight: 700,
                  }}
                />
              </label>
            </div>

            {!hasLocationContext ? (
              <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>
                {t("service.appointmentLocationHint")}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ ...cardStyle, padding: 18, opacity: canChooseRevision ? 1 : 0.65 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            {t("service.appointmentRevisionSectionLabel")}
          </div>
          {!canChooseRevision ? (
            <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, marginBottom: 8 }}>
              {t("service.appointmentSelectIdCarFirst")}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
                {REVISION_TYPES.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedRevision(idx);
                  setSelectedSpecificSection("");
                  setSelectedSpecificType("");
                }}
                disabled={!canChooseRevision}
                style={{
                  border: idx === selectedRevision ? "2px solid rgba(139,92,246,0.7)" : "1px solid #ece8df",
                  borderRadius: 10,
                  background: idx === selectedRevision ? "rgba(139,92,246,0.07)" : "#fafaf9",
                  textAlign: "left",
                  padding: "10px 12px",
                  cursor: canChooseRevision ? "pointer" : "not-allowed",
                  opacity: canChooseRevision ? 1 : 0.75,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3b3b3b" }}>{t(item.nameKey)}</div>
                <div style={{ fontSize: 12, color: "#9a9a9a" }}>{t(item.subtitleKey)}</div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => setIsSpecificOpen((prev) => !prev)}
              disabled={!canChooseRevision}
              style={{
                border: "1px solid rgba(139,92,246,0.32)",
                borderRadius: 10,
                background: "rgba(139,92,246,0.08)",
                color: "#6d28d9",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "9px 11px",
                textAlign: "left",
                cursor: canChooseRevision ? "pointer" : "not-allowed",
                opacity: canChooseRevision ? 1 : 0.75,
              }}
            >
              {t("service.appointmentSpecificToggleLabel")} {isSpecificOpen ? "▲" : "▼"}
            </button>

            {isSpecificOpen ? (
              <div
                style={{
                  border: "1px solid rgba(139,92,246,0.2)",
                  borderRadius: 12,
                  background: "rgba(139,92,246,0.05)",
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#6d28d9", fontWeight: 700 }}>{t("service.appointmentSpecificSectionLabel")}</label>
                  <select
                    value={selectedSpecificSection}
                    onChange={(event) => {
                      setSelectedSpecificSection(event.target.value);
                      setSelectedSpecificType("");
                      setSelectedRevision(-1);
                    }}
                    style={{
                      border: "1px solid rgba(139,92,246,0.35)",
                      borderRadius: 10,
                      background: "#fff",
                      padding: "9px 10px",
                      fontSize: 13,
                      color: "#4c1d95",
                      fontWeight: 700,
                    }}
                  >
                    <option value="">{t("service.appointmentSpecificSectionPlaceholder")}</option>
                    {SPECIFIC_APPOINTMENT_SECTIONS.map((section) => (
                      <option key={section.title} value={section.title}>{t(section.titleKey)}</option>
                    ))}
                  </select>
                </div>

                {selectedSpecificSectionModel ? (
                  <>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label style={{ fontSize: 12, color: "#6d28d9", fontWeight: 700 }}>{t("service.appointmentSpecificTypeLabel")}</label>
                      <select
                        value={selectedSpecificType}
                        onChange={(event) => {
                          setSelectedSpecificType(event.target.value);
                          if (event.target.value) {
                            setSelectedRevision(-1);
                          }
                        }}
                        style={{
                          border: "1px solid rgba(139,92,246,0.35)",
                          borderRadius: 10,
                          background: "#fff",
                          padding: "9px 10px",
                          fontSize: 13,
                          color: "#4c1d95",
                          fontWeight: 700,
                        }}
                      >
                        <option value="">{t("service.appointmentSpecificTypePlaceholder")}</option>
                        {specificTypeOptions.map((item) => (
                          <option key={`${selectedSpecificSection}-${item.id}`} value={item.id}>{t(item.labelKey)}</option>
                        ))}
                      </select>
                    </div>

                    {selectedSpecificSectionModel.noteKey ? (
                      <div style={{ fontSize: 11, color: "#6d28d9", fontWeight: 700 }}>
                        👉 {t(selectedSpecificSectionModel.noteKey)}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18, opacity: canChooseRevision ? 1 : 0.65 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            {t("service.appointmentProviderSectionLabel")}
          </div>
          {isSearchingWorkshops ? (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              {t("service.appointmentLoadingWorkshops")}
            </div>
          ) : null}
          {!isSearchingWorkshops && workshopSearchError ? (
            <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
              {workshopSearchError}
            </div>
          ) : null}
          {!hasSelectedProvider ? (
            <div style={{ fontSize: 12, color: "#7c3aed", marginBottom: 8, fontWeight: 700 }}>
              {t("service.appointmentSelectProviderHint")}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8, maxHeight: providerOffers.length > 6 ? 420 : "none", overflowY: providerOffers.length > 6 ? "auto" : "visible", paddingRight: providerOffers.length > 6 ? 4 : 0 }}>
            {!hasLocationContext && (
              <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700 }}>
                {t("service.appointmentWorkshopCompleteLocation")}
              </div>
            )}
            {hasLocationContext && !isSearchingWorkshops && providerOffers.length === 0 && (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                No se encontraron talleres en tu zona. Prueba con otro código postal.
              </div>
            )}
            {providerOffers.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedProvider(item.key)}
                disabled={!canChooseRevision}
                style={{
                  border: item.key === selectedProvider ? "1px solid rgba(139,92,246,0.35)" : "1px solid #ece8df",
                  borderRadius: 10,
                  background: item.key === selectedProvider ? "rgba(139,92,246,0.08)" : "#fafaf9",
                  textAlign: "left",
                  padding: "10px 12px",
                  cursor: canChooseRevision ? "pointer" : "not-allowed",
                  opacity: canChooseRevision ? 1 : 0.75,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: item.key === selectedProvider ? "#7c3aed" : "#3b3b3b" }}>
                    {item.name}
                  </span>
                  {item.isIndependent && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "1px 6px" }}>
                      Independiente
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#9a9a9a", marginTop: 2 }}>
                  {item?.nearby?.workshop
                    ? `${item.nearby.workshop.distanceKm} km · ETA ${item.nearby.workshop.etaMinutes} min`
                    : ""}
                </div>
                {item?.nearby?.workshop?.address ? (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {item.nearby.workshop.address}
                  </div>
                ) : null}
                {item.isIndependent ? (
                  <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 4, fontWeight: 700 }}>
                    Precio a consultar · Tarifa CarsWise aplicable
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 4, fontWeight: 700 }}>
                    {t("service.appointmentPricingParticular", { price: formatPriceTag(item.particular, priceOptions) })} · {t("service.appointmentPricingCarsWise", { price: formatPriceTag(item.withCarsWise, priceOptions) })}
                  </div>
                )}
                {item.savings !== null ? (
                  <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2, fontWeight: 700 }}>
                    {t("service.appointmentSavings", { savings: item.savings })}
                  </div>
                ) : null}
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }} title={pricingNotice}>
                  {t("service.appointmentPricingOrientative")}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            {t("service.appointmentPriceSectionLabel")}
          </div>
          <div style={{ border: "1px solid rgba(139,92,246,0.28)", borderRadius: 12, background: "rgba(139,92,246,0.08)", padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {selectedRevisionName} · {selectedProviderLabel}
            </div>
            <div style={{ fontSize: 13, color: "#b9b9b9", marginTop: 6 }}>
              {t("service.appointmentPvpParticular", { price: formatPriceTag(selectedProviderOffer?.particular, priceOptions) })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
              <div style={{ fontSize: 14, color: "#8b5cf6", fontWeight: 700 }}>
                {t("service.appointmentWithCarsWise", { price: formatPriceTag(selectedProviderOffer?.withCarsWise, priceOptions) })}
              </div>
              <div style={{ fontSize: 24, color: "#7c3aed", fontWeight: 800, lineHeight: 1 }}>
                {formatPriceTag(selectedProviderOffer?.withCarsWise, priceOptions)}
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
              ℹ {pricingNotice}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              t("service.appointmentFeature1"),
              t("service.appointmentFeature2"),
              t("service.appointmentFeature3"),
              t("service.appointmentFeature4"),
              t("service.appointmentFeature5"),
            ].map((item) => (
              <div key={item} style={{ fontSize: 14, color: "#636363", lineHeight: 1.35 }}>✓ {item}</div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "18px 20px",
        }}
      >
          <div>
          <div style={{ fontSize: 18, color: "#303030", fontWeight: 700, marginBottom: 3 }}>
            {t("service.appointmentConfirmTitle", { workshop: selectedProviderOffer?.nearby?.workshop?.name || selectedProviderLabel })}
          </div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            {selectedRevisionName}{selectedVehicleLabel ? ` · ${selectedVehicleLabel}` : ""} · {formatPriceTag(selectedProviderOffer?.withCarsWise, priceOptions)} {t("service.appointmentIncludesVat")}{selectedProviderOffer?.nearby?.workshop?.distanceKm ? ` · ${selectedProviderOffer.nearby.workshop.distanceKm} km` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onGoBack}
            style={{ border: "none", background: "transparent", color: "#bbb", fontSize: 14, cursor: "pointer" }}
          >
            {t("common.backArrow")}
          </button>
          <button
            type="button"
            onClick={handleConfirmAppointment}
            disabled={!canContinueBooking || isSubmittingAppointment}
            style={{
              border: "none",
              borderRadius: 14,
              background: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: !canContinueBooking || isSubmittingAppointment ? "not-allowed" : "pointer",
              opacity: !canContinueBooking || isSubmittingAppointment ? 0.65 : 1,
              boxShadow: "0 8px 20px rgba(124,58,237,0.3)",
            }}
          >
            {isSubmittingAppointment ? t("service.appointmentSubmitting") : t("service.appointmentSubmit")}
          </button>
        </div>
      </section>
    </div>
  );
}
