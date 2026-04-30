import { useEffect, useMemo, useState } from "react";
import { getGarageVehiclesJson, getNearbyWorkshopsJson } from "../utils/apiClient";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

  const exactIndex = revisionTypes.findIndex((item) => normalizeToken(item?.[0]) === target);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const partialIndex = revisionTypes.findIndex((item) => {
    const label = normalizeToken(item?.[0]);
    return label && (target.includes(label) || label.includes(target));
  });

  if (partialIndex >= 0) {
    return partialIndex;
  }

  if (target.includes("itv") || target.includes("inspeccion")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.[0]).includes("itv"));
  }

  if (target.includes("fren")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.[0]).includes("freno"));
  }

  if (target.includes("neumatic") || target.includes("rueda") || target.includes("llanta")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.[0]).includes("neumatic"));
  }

  if (target.includes("mayor") || target.includes("completa")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.[0]).includes("mayor"));
  }

  if (target.includes("aceite") || target.includes("filtro") || target.includes("menor")) {
    return revisionTypes.findIndex((item) => normalizeToken(item?.[0]).includes("menor"));
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
      const itemToken = normalizeToken(item);
      if (itemToken && (target.includes(itemToken) || itemToken.includes(target))) {
        return {
          sectionTitle: normalizeText(section?.title),
          itemLabel: item,
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

function formatPriceTag(value) {
  if (value === null || value === undefined) {
    return "No disponible";
  }

  if (typeof value === "number") {
    return value <= 0 ? "Gratis" : `${value}€`;
  }

  return String(value);
}

const REVISION_TYPES = [
  ["Revision menor", "Aceite + filtros"],
  ["Revision mayor", "Completa de marca"],
  ["Revision de frenos", "Pastillas y discos"],
  ["Neumaticos", "Cambio o equilibrado"],
  ["Revision ITV", "Pre-ITV incluida"],
];

const SPECIFIC_APPOINTMENT_SECTIONS = [
  {
    title: "🔧 1. Neumaticos",
    items: [
      "Cambio de neumaticos",
      "Equilibrado",
      "Alineacion",
      "Reparacion de pinchazos",
      "Permutacion de ruedas",
      "Diagnostico de neumaticos",
    ],
  },
  {
    title: "🛠️ 2. Mecanica general y reparaciones",
    items: [
      "Frenos (pastillas, discos)",
      "Suspension (amortiguadores, rotulas)",
      "Direccion",
      "Embrague",
      "Transmision",
      "Escapes",
      "Correa de distribucion",
      "Reparaciones generales",
    ],
    note: "En Midas entra dentro de mantenimiento y mecanica.",
  },
  {
    title: "🛢️ 3. Mantenimiento y revisiones",
    items: [
      "Revision oficial (tipo fabricante)",
      "Cambio de aceite",
      "Cambio de filtros",
      "Revision de niveles",
      "AdBlue",
      "Bateria",
    ],
    note: "Midas lo agrupa como Revision y mantenimiento.",
  },
  {
    title: "❄️ 4. Climatizacion / Aire acondicionado",
    items: [
      "Recarga de aire acondicionado",
      "Deteccion de averias",
      "Eliminacion de olores (tipo AirCare)",
    ],
  },
  {
    title: "🔍 5. Diagnostico",
    items: [
      "Diagnostico electronico",
      "Diagnostico de bateria",
      "Diagnostico de frenos",
      "Diagnostico de amortiguadores",
      "Diagnostico general del vehiculo",
    ],
    note: "En Midas muchos son gratuitos con cita previa.",
  },
  {
    title: "🚗 6. Pre-ITV e ITV",
    items: [
      "Revision Pre-ITV",
      "Servicio de pasar ITV por ti",
    ],
    note: "Lo ofrecen ambos.",
  },
  {
    title: "💡 7. Iluminacion y visibilidad",
    items: [
      "Cambio de bombillas",
      "Reglaje de faros",
      "Pulido de faros",
      "Escobillas limpiaparabrisas",
    ],
  },
  {
    title: "🧼 8. Servicios especificos / especiales",
    items: [
      "Descarbonizacion / limpieza de motor (MotorCare en Midas)",
      "Desinfeccion del habitaculo",
      "Eliminacion de olores",
    ],
  },
  {
    title: "🔩 9. Instalacion de accesorios",
    items: [
      "Matriculas",
      "Accesorios y equipamiento",
      "Multimedia / radio",
      "Enganches",
    ],
  },
  {
    title: "🏍️ 10. Moto",
    items: [
      "Mantenimiento de moto",
      "Neumaticos moto",
      "Frenos moto",
      "Bateria moto",
      "Suspension y transmision moto",
    ],
    note: "Extra que destaca en Midas.",
  },
  {
    title: "🚚 11. Servicios adicionales",
    items: [
      "Recogida y entrega del vehiculo",
      "Servicio a domicilio (algunas operaciones)",
      "Servicios para flotas/empresas",
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
  const pricingNotice = "Precios orientativos basados en rangos historicos (min/medio/alto). El importe final puede variar segun modelo, piezas, mano de obra, ciudad y disponibilidad del taller.";

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const [selectedRevision, setSelectedRevision] = useState(-1);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [garageVehicles, setGarageVehicles] = useState([]);
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

      setIsLoadingVehicles(true);
      try {
        const { response, data } = await getGarageVehiclesJson(normalizedEmail);
        if (!disposed && response.ok && Array.isArray(data?.vehicles)) {
          const nextVehicles = data.vehicles.filter((item) => item && normalizeText(item?.id));
          setGarageVehicles(nextVehicles);
        }
      } catch {
        if (!disposed) {
          setGarageVehicles([]);
        }
      } finally {
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
            setWorkshopSearchError(normalizeText(data?.error) || "No se pudieron cargar talleres cercanos.");
          }
        }
      } catch {
        if (!disposed) {
          setNearbyProviders([]);
          setWorkshopSearchError("No se pudieron cargar talleres cercanos.");
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
  }, [hasLocationContext, postalCode, province]);

  const canChooseRevision = hasAnyVehicles && Boolean(vehicleId) && hasLocationContext;
  const selectedPopularRevisionName = selectedRevision >= 0 ? REVISION_TYPES[selectedRevision][0] : "";
  const selectedAppointmentTypeName = selectedSpecificType || selectedPopularRevisionName;
  const hasSelectedProvider = Boolean(normalizeText(selectedProvider));
  const canContinueBooking = canChooseRevision && Boolean(selectedAppointmentTypeName) && hasSelectedProvider;
  const selectedVehicle = garageVehicles.find((item) => normalizeText(item?.id) === vehicleId) || null;
  const selectedVehicleLabel = vehicleOptions.find((item) => item.id === vehicleId)?.label || "";

  const selectedProviderLabel = selectedProvider === "midas" ? "MIDAS" : selectedProvider === "norauto" ? "Norauto" : "Proveedor";
  const selectedRevisionName = selectedAppointmentTypeName || "Selecciona tipo de revision";
  const selectedCatalogServiceName = resolveCatalogServiceName(selectedAppointmentTypeName);
  const selectedServicePricing = SERVICE_PRICE_CATALOG[selectedCatalogServiceName] || null;

  const providerOffers = [
    {
      key: "norauto",
      name: "Norauto",
      range: selectedServicePricing?.norauto || null,
    },
    {
      key: "midas",
      name: "MIDAS",
      range: selectedServicePricing?.midas || null,
    },
  ].map((item) => {
    const nearby = nearbyProviders.find((provider) => provider?.providerKey === item.key);
    const particular = chooseParticularPrice(item.range);
    const withCarsWise = chooseCarsWisePrice(item.range);
    const savings = typeof particular === "number" && typeof withCarsWise === "number" ? Math.max(0, particular - withCarsWise) : null;
    return {
      ...item,
      particular,
      withCarsWise,
      savings,
      nearby,
    };
  });

  const selectedProviderOffer = providerOffers.find((item) => item.key === selectedProvider) || null;

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
          ← Volver
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          Servicios › <span style={{ color: "#8b5cf6", fontWeight: 700 }}>Cita Mantenimientos</span>
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
            C · Cita Mantenimientos
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            Precios de acuerdo, no de particular
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            Aprovecha nuestros acuerdos con talleres partner para conseguir precios mas reducidos que como cliente
            particular. Agenda tu proxima revision en segundos a traves de CarWise.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {[
              "Precios negociados",
              "Cita en 2 clics",
              "Talleres verificados",
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
          IDCar para esta cita
        </div>

        {isLoadingVehicles ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>Cargando IDCars...</div>
        ) : !hasAnyVehicles ? (
          <>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 10 }}>
              No tienes ningun IDCar disponible. Sube primero un IDCar para poder pedir la cita.
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
              Ir a gestionar IDCars
            </button>
          </>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#5b21b6", fontWeight: 700 }}>
              Selecciona IDCar, provincia y codigo postal antes de confirmar la cita
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
              <option value="">Selecciona un IDCar</option>
              {vehicleOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 700 }}>Provincia</span>
                <input
                  type="text"
                  value={province}
                  onChange={(event) => setProvince(event.target.value)}
                  placeholder="Ej: Madrid"
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
                <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 700 }}>Codigo postal</span>
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
                Introduce provincia y un codigo postal valido (5 digitos) para buscar taller cercano.
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ ...cardStyle, padding: 18, opacity: canChooseRevision ? 1 : 0.65 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            Tipo de revision (mas populares)
          </div>
          {!canChooseRevision ? (
            <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, marginBottom: 8 }}>
              Primero selecciona el IDCar para continuar.
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
                {REVISION_TYPES.map((item, idx) => (
              <button
                key={item[0]}
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
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3b3b3b" }}>{item[0]}</div>
                <div style={{ fontSize: 12, color: "#9a9a9a" }}>{item[1]}</div>
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
              Cita especifica {isSpecificOpen ? "▲" : "▼"}
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
                  <label style={{ fontSize: 12, color: "#6d28d9", fontWeight: 700 }}>Seccion</label>
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
                    <option value="">Selecciona una seccion</option>
                    {SPECIFIC_APPOINTMENT_SECTIONS.map((section) => (
                      <option key={section.title} value={section.title}>{section.title}</option>
                    ))}
                  </select>
                </div>

                {selectedSpecificSectionModel ? (
                  <>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label style={{ fontSize: 12, color: "#6d28d9", fontWeight: 700 }}>Tipo de cita especifica</label>
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
                        <option value="">Selecciona el tipo de cita</option>
                        {specificTypeOptions.map((item) => (
                          <option key={`${selectedSpecificSection}-${item}`} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>

                    {selectedSpecificSectionModel.note ? (
                      <div style={{ fontSize: 11, color: "#6d28d9", fontWeight: 700 }}>
                        👉 {selectedSpecificSectionModel.note}
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
            Taller partner (elige proveedor)
          </div>
          {isSearchingWorkshops ? (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Buscando talleres cercanos por codigo postal...
            </div>
          ) : null}
          {!isSearchingWorkshops && workshopSearchError ? (
            <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
              {workshopSearchError}
            </div>
          ) : null}
          {!hasSelectedProvider ? (
            <div style={{ fontSize: 12, color: "#7c3aed", marginBottom: 8, fontWeight: 700 }}>
              Selecciona un proveedor para habilitar la confirmacion de cita.
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: item.key === selectedProvider ? "#7c3aed" : "#3b3b3b" }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "#9a9a9a", marginTop: 2 }}>
                  {item?.nearby?.available && item?.nearby?.workshop
                    ? `${item.nearby.workshop.name} · ${item.nearby.workshop.distanceKm} km`
                    : (hasLocationContext ? `Cerca de ${normalizeText(province)} (${postalCode})` : "Completa ubicacion para buscar cerca")}
                </div>
                {item?.nearby?.available && item?.nearby?.workshop ? (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {item.nearby.workshop.address} · ETA {item.nearby.workshop.etaMinutes} min
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 2, fontWeight: 700 }}>
                  Particular: {formatPriceTag(item.particular)} · Con CarWise: {formatPriceTag(item.withCarsWise)}
                </div>
                {item.savings !== null ? (
                  <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2, fontWeight: 700 }}>
                    Ahorras {item.savings}€ vs particular
                  </div>
                ) : null}
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }} title={pricingNotice}>
                  ℹ Precio orientativo
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            Resumen de precio
          </div>
          <div style={{ border: "1px solid rgba(139,92,246,0.28)", borderRadius: 12, background: "rgba(139,92,246,0.08)", padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {selectedRevisionName} · {selectedProviderLabel}
            </div>
            <div style={{ fontSize: 13, color: "#b9b9b9", marginTop: 6 }}>
              PVP particular: {formatPriceTag(selectedProviderOffer?.particular)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
              <div style={{ fontSize: 14, color: "#8b5cf6", fontWeight: 700 }}>
                ✓ Con CarWise: {formatPriceTag(selectedProviderOffer?.withCarsWise)}
              </div>
              <div style={{ fontSize: 24, color: "#7c3aed", fontWeight: 800, lineHeight: 1 }}>
                {formatPriceTag(selectedProviderOffer?.withCarsWise)}
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
              ℹ {pricingNotice}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              "Aceite sintetico 5W30 incluido",
              "Filtros de aceite y aire",
              "Revision de 20 puntos",
              "Informe digital del estado",
              "Sin sorpresas en el precio final",
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
            Confirmar cita en {selectedProviderOffer?.nearby?.workshop?.name || selectedProviderLabel}
          </div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            {selectedRevisionName} · Hoy a las 15:00h · {formatPriceTag(selectedProviderOffer?.withCarsWise)} (incluye IVA){selectedVehicleLabel ? ` · ${selectedVehicleLabel}` : ""}{selectedProviderOffer?.nearby?.workshop?.distanceKm ? ` · ${selectedProviderOffer.nearby.workshop.distanceKm} km` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onGoBack}
            style={{ border: "none", background: "transparent", color: "#bbb", fontSize: 14, cursor: "pointer" }}
          >
            ← Volver
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
            {isSubmittingAppointment ? "Preparando calendario..." : "Pedir cita →"}
          </button>
        </div>
      </section>
    </div>
  );
}
