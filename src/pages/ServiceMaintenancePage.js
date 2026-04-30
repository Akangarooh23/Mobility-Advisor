import { useEffect, useMemo, useState } from "react";
import { getGarageVehiclesJson } from "../utils/apiClient";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateInput(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const monthIndex = Number(slashMatch[2]) - 1;
    const year = Number(slashMatch[3]);
    const date = new Date(year, monthIndex, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const slashDateTimeMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (slashDateTimeMatch) {
    const day = Number(slashDateTimeMatch[1]);
    const monthIndex = Number(slashDateTimeMatch[2]) - 1;
    const yearText = normalizeText(slashDateTimeMatch[3]);
    const currentYear = new Date().getFullYear();
    const year = yearText
      ? (yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText))
      : currentYear;
    const hour = Number(slashDateTimeMatch[4] || 9);
    const minute = Number(slashDateTimeMatch[5] || 0);
    const date = new Date(year, monthIndex, day, hour, minute, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function addDays(baseDate, daysToAdd) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + Number(daysToAdd || 0));
  return nextDate;
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKeyFromDate(date) {
  return `${monthKeyFromDate(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabelFromKey(key = "") {
  const [yearRaw, monthRaw] = String(key).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function toEsDateTimeText(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(safeDate);
}

function toDateTimeLocalValue(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) {
    return "";
  }

  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  const hours = String(safeDate.getHours()).padStart(2, "0");
  const minutes = String(safeDate.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeStatusToken(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isStatusCanceled(status = "") {
  const token = normalizeStatusToken(status);
  return token.includes("cancel");
}

function isStatusScheduled(status = "") {
  const token = normalizeStatusToken(status);
  return token.includes("confirm") || token.includes("programad") || token.includes("agendad") || token.includes("en taller");
}

function isAlertScheduled(alert = {}) {
  const status = normalizeText(alert?.status);

  if (!alert?.synced) {
    return false;
  }

  if (isStatusCanceled(status)) {
    return false;
  }

  if (alert?.sourceType === "maintenance") {
    return true;
  }

  return isStatusScheduled(status);
}

function buildVehicleDisplayName(vehicle = {}, fallbackIndex = 0) {
  const title = normalizeText(vehicle?.title);
  const brand = normalizeText(vehicle?.brand);
  const model = normalizeText(vehicle?.model);
  const plate = normalizeText(vehicle?.plate).toUpperCase();

  const base = title || [brand, model].filter(Boolean).join(" ") || `IDCar ${fallbackIndex + 1}`;
  return plate ? `${base} (${plate})` : base;
}

const DEFAULT_MAINTENANCE_PLAN = [
  { key: "oil", title: "Cambio de aceite y filtro", intervalKm: 15000, intervalMonths: 12 },
  { key: "brakes", title: "Revision de frenos", intervalKm: 30000, intervalMonths: 18 },
  { key: "air", title: "Filtro de aire", intervalKm: 20000, intervalMonths: 18 },
  { key: "fluid", title: "Liquido de frenos", intervalKm: 45000, intervalMonths: 24 },
];

const PLAN_OVERRIDES = [
  {
    match: (brand, model, fuel) => brand.includes("toyota") && (fuel.includes("hibr") || model.includes("corolla") || model.includes("yaris")),
    plan: [
      { key: "oil", title: "Cambio de aceite y filtro", intervalKm: 15000, intervalMonths: 12 },
      { key: "brakes", title: "Revision de frenos", intervalKm: 35000, intervalMonths: 18 },
      { key: "air", title: "Filtro de aire", intervalKm: 20000, intervalMonths: 18 },
      { key: "hybrid", title: "Revision sistema hibrido", intervalKm: 30000, intervalMonths: 24 },
    ],
  },
  {
    match: (brand, model, fuel) => fuel.includes("elect") || brand.includes("tesla") || model.includes("leaf") || model.includes("mg4"),
    plan: [
      { key: "coolant", title: "Revision circuito termico", intervalKm: 30000, intervalMonths: 24 },
      { key: "brakes", title: "Revision de frenos", intervalKm: 25000, intervalMonths: 18 },
      { key: "cabin", title: "Filtro habitaculo", intervalKm: 20000, intervalMonths: 12 },
      { key: "battery", title: "Chequeo bateria HV", intervalKm: 40000, intervalMonths: 24 },
    ],
  },
  {
    match: (brand, model, fuel) => fuel.includes("diesel") || model.includes("tdi") || model.includes("dci") || model.includes("bluehdi"),
    plan: [
      { key: "oil", title: "Cambio de aceite y filtro", intervalKm: 20000, intervalMonths: 12 },
      { key: "fuel", title: "Filtro de combustible", intervalKm: 30000, intervalMonths: 18 },
      { key: "air", title: "Filtro de aire", intervalKm: 20000, intervalMonths: 18 },
      { key: "brakes", title: "Revision de frenos", intervalKm: 30000, intervalMonths: 18 },
    ],
  },
];

function getVehicleMaintenancePlan(vehicle = {}) {
  const brand = normalizeText(vehicle?.brand).toLowerCase();
  const model = normalizeText(vehicle?.model).toLowerCase();
  const fuel = normalizeText(vehicle?.fuel).toLowerCase();

  const override = PLAN_OVERRIDES.find((item) => item.match(brand, model, fuel));
  return override?.plan || DEFAULT_MAINTENANCE_PLAN;
}

function parsePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function addMonths(baseDate, monthsToAdd) {
  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + Number(monthsToAdd || 0));
  return nextDate;
}

function monthsBetween(fromDate, toDate) {
  const yearDiff = toDate.getFullYear() - fromDate.getFullYear();
  const monthDiff = toDate.getMonth() - fromDate.getMonth();
  return yearDiff * 12 + monthDiff;
}

function buildReferenceDate(vehicle = {}, fallbackDate = new Date()) {
  const createdAt = parseDateInput(vehicle?.createdAt);
  if (createdAt) {
    return createdAt;
  }

  const year = Number(normalizeText(vehicle?.year));
  if (year >= 1990 && year <= 2100) {
    return new Date(year, 0, 1);
  }

  return fallbackDate;
}

function estimateMaintenanceDueDate({
  mileage,
  referenceDate,
  intervalKm,
  intervalMonths,
  today,
}) {
  const safeMileage = parsePositiveNumber(mileage);
  const kmInterval = parsePositiveNumber(intervalKm);
  const monthInterval = parsePositiveNumber(intervalMonths);

  let dueByKmDate = null;
  let kmToNext = 0;

  if (kmInterval > 0) {
    const nextBand = Math.max(1, Math.ceil((safeMileage + 1) / kmInterval));
    const nextKm = nextBand * kmInterval;
    kmToNext = Math.max(0, nextKm - safeMileage);
    const estimatedDays = Math.max(7, Math.round(kmToNext / 45));
    dueByKmDate = addDays(today, estimatedDays);
  }

  let dueByTimeDate = null;
  if (monthInterval > 0) {
    const elapsedMonths = Math.max(0, monthsBetween(referenceDate, today));
    const cycles = Math.floor(elapsedMonths / monthInterval) + 1;
    dueByTimeDate = addMonths(referenceDate, cycles * monthInterval);
  }

  const dueDate = dueByKmDate && dueByTimeDate
    ? (dueByKmDate.getTime() <= dueByTimeDate.getTime() ? dueByKmDate : dueByTimeDate)
    : (dueByKmDate || dueByTimeDate || addDays(today, 30));

  return {
    dueDate,
    kmToNext,
    basedOnKm: Boolean(dueByKmDate),
    basedOnTime: Boolean(dueByTimeDate),
  };
}

function buildVehicleAlerts(vehicle = {}, vehicleIndex = 0) {
  const today = new Date();
  const vehicleId = normalizeText(vehicle?.id) || `vehicle-${vehicleIndex}`;
  const displayName = buildVehicleDisplayName(vehicle, vehicleIndex);
  const mileage = Number(normalizeText(vehicle?.mileage).replace(/[^\d]/g, "") || 0);
  const maintenancePlan = getVehicleMaintenancePlan(vehicle);
  const referenceDate = buildReferenceDate(vehicle, addDays(today, -180));

  const nextIvtDate = parseDateInput(vehicle?.nextIvt);
  const lastIvtDate = parseDateInput(vehicle?.lastIvt);
  const computedIvtDate = nextIvtDate || (lastIvtDate ? addDays(lastIvtDate, 365) : null);

  const alerts = [];

  if (computedIvtDate) {
    alerts.push({
      id: `${vehicleId}-itv-${dateKeyFromDate(computedIvtDate)}`,
      vehicleId,
      vehicleName: displayName,
      date: computedIvtDate,
      type: "itv",
      title: "Revision ITV",
      subtitle: "Control periodico de inspeccion tecnica",
      urgent: computedIvtDate.getTime() <= addDays(today, 30).getTime(),
    });
  }

  maintenancePlan.forEach((rule) => {
    const estimation = estimateMaintenanceDueDate({
      mileage,
      referenceDate,
      intervalKm: rule.intervalKm,
      intervalMonths: rule.intervalMonths,
      today,
    });

    const hints = [];
    if (estimation.basedOnKm && rule.intervalKm) {
      const kmHint = estimation.kmToNext > 0 ? `~${Math.round(estimation.kmToNext).toLocaleString("es-ES")} km` : "en km objetivo";
      hints.push(`cada ${rule.intervalKm.toLocaleString("es-ES")} km (${kmHint})`);
    }
    if (estimation.basedOnTime && rule.intervalMonths) {
      hints.push(`cada ${rule.intervalMonths} mes(es)`);
    }

    alerts.push({
      id: `${vehicleId}-${rule.key}-${dateKeyFromDate(estimation.dueDate)}`,
      vehicleId,
      vehicleName: displayName,
      date: estimation.dueDate,
      type: "maintenance",
      title: rule.title,
      subtitle: hints.join(" · ") || "Mantenimiento programado",
      urgent:
        estimation.dueDate.getTime() <= addDays(today, 30).getTime() ||
        (estimation.kmToNext > 0 && estimation.kmToNext <= 1200),
    });
  });

  return alerts;
}

function buildSyncedWorkshopAlerts({
  appointments = [],
  maintenances = [],
  vehicleFilter = "all",
  vehicleNameById = new Map(),
}) {
  const output = [];
  const seen = new Set();
  const today = new Date();

  const pushAlert = ({
    id,
    vehicleId,
    vehicleName,
    date,
    title,
    subtitle,
    status,
    sourceType,
    sourceData,
    statusHistory,
  }) => {
    if (!id || seen.has(id) || !date) {
      return;
    }

    if (vehicleFilter !== "all" && vehicleId && vehicleId !== vehicleFilter) {
      return;
    }

    seen.add(id);
    output.push({
      id,
      vehicleId,
      vehicleName,
      date,
      type: "appointment",
      title,
      subtitle,
      urgent: date.getTime() <= addDays(today, 14).getTime(),
      synced: true,
      status,
      sourceType,
      sourceId: id,
      sourceData,
      statusHistory: Array.isArray(statusHistory) ? statusHistory : [],
    });
  };

  (Array.isArray(appointments) ? appointments : []).forEach((item, index) => {
    const vehicleId = normalizeText(item?.vehicleId);
    const date =
      parseDateInput(item?.scheduledAt) ||
      parseDateInput(item?.requestedAt) ||
      parseDateInput(item?.createdAt) ||
      parseDateInput(item?.updatedAt);

    const vehicleName =
      normalizeText(item?.vehicleTitle) ||
      (vehicleId ? vehicleNameById.get(vehicleId) : "") ||
      normalizeText(item?.vehiclePlate) ||
      "IDCar";

    pushAlert({
      id: normalizeText(item?.id) || `appt-synced-${index}`,
      vehicleId,
      vehicleName,
      date,
      title: normalizeText(item?.title) || "Cita de taller",
      subtitle: normalizeText(item?.meta) || normalizeText(item?.status) || "Cita sincronizada",
      status: normalizeText(item?.status),
      sourceType: "appointment",
      sourceData: item,
      statusHistory: Array.isArray(item?.statusHistory) ? item.statusHistory : [],
    });
  });

  (Array.isArray(maintenances) ? maintenances : []).forEach((item, index) => {
    const vehicleId = normalizeText(item?.vehicleId);
    const date =
      parseDateInput(item?.scheduledAt) ||
      parseDateInput(item?.createdAt) ||
      parseDateInput(item?.updatedAt);

    const vehicleName =
      normalizeText(item?.vehicleTitle) ||
      (vehicleId ? vehicleNameById.get(vehicleId) : "") ||
      normalizeText(item?.vehiclePlate) ||
      "IDCar";

    pushAlert({
      id: normalizeText(item?.id) || `mnt-synced-${index}`,
      vehicleId,
      vehicleName,
      date,
      title: normalizeText(item?.title) || "Mantenimiento de taller",
      subtitle: normalizeText(item?.notes) || normalizeText(item?.status) || "Mantenimiento sincronizado",
      status: normalizeText(item?.status),
      sourceType: "maintenance",
      sourceData: item,
      statusHistory: [],
    });
  });

  return output;
}

function getCalendarCellsFromMonthKey(monthKey = "") {
  const [yearRaw, monthRaw] = String(monthKey).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw) - 1;
  if (!year || month < 0) {
    return [];
  }

  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const firstCellDate = addDays(firstDay, -firstWeekday);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = addDays(firstCellDate, index);
    return {
      key: dateKeyFromDate(date),
      date,
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
    };
  });
}

export default function ServiceMaintenancePage({
  onGoBack,
  onGoHome,
  currentUserEmail = "",
  onManageIdCars = () => {},
  userAppointments = [],
  userMaintenances = [],
  onUpdateAppointmentStatus = () => {},
  onScheduleAppointment = () => {},
}) {
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const [garageVehicles, setGarageVehicles] = useState([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [updatingAppointment, setUpdatingAppointment] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    let disposed = false;

    const loadGarage = async () => {
      const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
      if (!normalizedEmail) {
        if (!disposed) {
          setGarageVehicles([]);
        }
        return;
      }

      setIsLoadingVehicles(true);
      try {
        const { response, data } = await getGarageVehiclesJson(normalizedEmail);
        if (!disposed && response.ok && Array.isArray(data?.vehicles)) {
          setGarageVehicles(data.vehicles.filter((item) => item && normalizeText(item?.id)));
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

  const vehicleNameById = useMemo(() => {
    const map = new Map();
    garageVehicles.forEach((vehicle, index) => {
      const id = normalizeText(vehicle?.id);
      if (!id) return;
      map.set(id, buildVehicleDisplayName(vehicle, index));
    });
    return map;
  }, [garageVehicles]);

  const vehicleById = useMemo(() => {
    const map = new Map();
    garageVehicles.forEach((vehicle) => {
      const id = normalizeText(vehicle?.id);
      if (id) {
        map.set(id, vehicle);
      }
    });
    return map;
  }, [garageVehicles]);

  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === "all") {
      return garageVehicles;
    }
    return garageVehicles.filter((vehicle) => normalizeText(vehicle?.id) === vehicleFilter);
  }, [garageVehicles, vehicleFilter]);

  const allAlerts = useMemo(() => {
    const forecastAlerts = filteredVehicles.flatMap((vehicle, index) => buildVehicleAlerts(vehicle, index));
    const syncedAlerts = buildSyncedWorkshopAlerts({
      appointments: userAppointments,
      maintenances: userMaintenances,
      vehicleFilter,
      vehicleNameById,
    });

    return [...forecastAlerts, ...syncedAlerts].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredVehicles, userAppointments, userMaintenances, vehicleFilter, vehicleNameById]);

  const monthBuckets = useMemo(() => {
    const map = new Map();

    allAlerts.forEach((alert) => {
      const key = monthKeyFromDate(alert.date);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: monthLabelFromKey(key),
          alerts: [],
        });
      }
      map.get(key).alerts.push(alert);
    });

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [allAlerts]);

  useEffect(() => {
    if (!monthBuckets.length) {
      setSelectedMonthKey("");
      setSelectedDayKey("");
      return;
    }

    const currentExists = monthBuckets.some((bucket) => bucket.key === selectedMonthKey);
    if (!currentExists) {
      setSelectedMonthKey(monthBuckets[0].key);
      setSelectedDayKey("");
    }
  }, [monthBuckets, selectedMonthKey]);

  const activeMonth = monthBuckets.find((bucket) => bucket.key === selectedMonthKey) || null;

  const activeMonthAlertMap = useMemo(() => {
    const map = new Map();
    if (!activeMonth) {
      return map;
    }

    activeMonth.alerts.forEach((alert) => {
      const key = dateKeyFromDate(alert.date);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(alert);
    });

    return map;
  }, [activeMonth]);

  const calendarCells = useMemo(() => getCalendarCellsFromMonthKey(selectedMonthKey), [selectedMonthKey]);

  const selectedDayAlerts = useMemo(() => {
    if (!selectedDayKey) {
      return [];
    }
    return activeMonthAlertMap.get(selectedDayKey) || [];
  }, [activeMonthAlertMap, selectedDayKey]);

  const monthUpcomingAlerts = useMemo(() => {
    if (!activeMonth) {
      return [];
    }
    return activeMonth.alerts.slice(0, 8);
  }, [activeMonth]);

  const hasAnyVehicles = garageVehicles.length > 0;
  const hasAnyAlerts = allAlerts.length > 0;

  const canEditSelectedAppointment =
    selectedAlert &&
    selectedAlert.synced &&
    selectedAlert.sourceType === "appointment" &&
    isAlertScheduled(selectedAlert) &&
    normalizeText(selectedAlert?.sourceId);

  const canScheduleSelectedAlert =
    selectedAlert &&
    !isAlertScheduled(selectedAlert);

  const openAlertModal = (alert) => {
    if (!alert) {
      return;
    }
    setSelectedAlert(alert);
    setRescheduleAt(toDateTimeLocalValue(alert.date));
  };

  const closeAlertModal = () => {
    setSelectedAlert(null);
    setRescheduleAt("");
    setUpdatingAppointment(false);
    setShowCancelConfirm(false);
  };

  const handleReschedule = async () => {
    if (!canEditSelectedAppointment || !rescheduleAt) {
      return;
    }

    const nextDate = new Date(rescheduleAt);
    if (Number.isNaN(nextDate.getTime())) {
      return;
    }

    setUpdatingAppointment(true);
    try {
      await onUpdateAppointmentStatus(selectedAlert.sourceId, {
        status: "Reagendada",
        requestedAt: toEsDateTimeText(nextDate),
        meta: `${normalizeText(selectedAlert.subtitle) || "Cita reagendada"} · Nueva fecha: ${toEsDateTimeText(nextDate)}`,
      });
      closeAlertModal();
    } finally {
      setUpdatingAppointment(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!canEditSelectedAppointment) {
      return;
    }

    setUpdatingAppointment(true);
    try {
      await onUpdateAppointmentStatus(selectedAlert.sourceId, {
        status: "Cancelada",
        meta: `${normalizeText(selectedAlert.subtitle) || "Cita"} · Cancelada por usuario`,
      });
      closeAlertModal();
    } finally {
      setUpdatingAppointment(false);
    }
  };

  const handleScheduleAppointment = async () => {
    if (!selectedAlert) {
      return;
    }

    const fallbackVehicle = vehicleById.get(normalizeText(selectedAlert?.vehicleId)) || {};
    const context = {
      vehicleId: normalizeText(selectedAlert?.vehicleId),
      appointmentType: normalizeText(selectedAlert?.title),
      vehicleTitle:
        normalizeText(selectedAlert?.sourceData?.vehicleTitle) ||
        normalizeText(fallbackVehicle?.title) ||
        normalizeText(selectedAlert?.vehicleName),
      vehiclePlate:
        normalizeText(selectedAlert?.sourceData?.vehiclePlate) ||
        normalizeText(fallbackVehicle?.plate),
    };

    await onScheduleAppointment(context);
    closeAlertModal();
  };

  const selectedAlertHistory = useMemo(() => {
    const baseHistory = Array.isArray(selectedAlert?.statusHistory) ? selectedAlert.statusHistory : [];
    const normalized = baseHistory
      .map((item) => ({
        previousStatus: normalizeText(item?.previousStatus || item?.previous_status),
        nextStatus: normalizeText(item?.nextStatus || item?.next_status),
        changedAt: normalizeText(item?.changedAt || item?.changed_at),
      }))
      .filter((item) => item.nextStatus || item.changedAt);

    if (!normalized.length && normalizeText(selectedAlert?.status)) {
      return [{
        previousStatus: "",
        nextStatus: normalizeText(selectedAlert.status),
        changedAt: toEsDateTimeText(selectedAlert.date),
      }];
    }

    return normalized;
  }, [selectedAlert]);

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
          Servicios › <span style={{ color: "#16a34a", fontWeight: 700 }}>Mantenimientos</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#22c55e" }} />
        <div style={{ padding: "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#16a34a",
              background: "rgba(34,197,94,0.08)",
              borderRadius: 20,
              padding: "4px 11px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            B · Mantenimientos
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            Recordatorio inteligente de mantenimiento
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            Vista mensual de mantenimientos para todos tus IDCars. Primero eliges el mes, y despues puedes entrar al detalle por dia.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {[
              "Basado en km y fecha",
              "Alertas automaticas",
              "Filtro por IDCar",
              "Sincronizado con citas",
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#7b7b7b", fontWeight: 700 }}>IDCar:</span>
            <select
              value={vehicleFilter}
              onChange={(event) => setVehicleFilter(event.target.value)}
              style={{
                border: "1px solid #ece8df",
                background: "#fff",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 12,
                color: "#404040",
                fontWeight: 600,
                minWidth: 220,
              }}
              disabled={!hasAnyVehicles}
            >
              <option value="all">Todos los IDCars</option>
              {vehicleOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <span style={{ fontWeight: 700, color: "#475569" }}>Leyenda:</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "#60a5fa", border: "1px solid rgba(37,99,235,0.5)" }} />
              Aviso para pedir cita
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "#16a34a", border: "1px solid rgba(21,128,61,0.55)" }} />
              Cita agendada
            </span>
          </div>
        </div>
      </section>

      {!hasAnyVehicles && !isLoadingVehicles ? (
        <section style={{ ...cardStyle, marginBottom: 12, padding: 22, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(254,242,242,0.55)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#991b1b", marginBottom: 6 }}>
            No tienes ningun IDCar subido
          </div>
          <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.55, marginBottom: 12 }}>
            El calendario esta vacio hasta que tengas al menos un IDCar en tu ficha. Sube un IDCar y automaticamente veras los avisos conjuntos.
          </div>
          <button
            type="button"
            onClick={onManageIdCars}
            style={{
              border: "none",
              borderRadius: 10,
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ir a gestionar IDCars
          </button>
        </section>
      ) : null}

      {hasAnyVehicles ? (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginBottom: 12 }}>
          <div style={{ ...cardStyle, padding: 22 }}>
            <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
              Meses con avisos
            </div>
            {isLoadingVehicles ? (
              <div style={{ fontSize: 13, color: "#8a8a8a" }}>Cargando IDCars...</div>
            ) : !hasAnyAlerts ? (
              <div style={{ fontSize: 13, color: "#8a8a8a" }}>No hay avisos para el filtro seleccionado.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {monthBuckets.map((bucket, index) => {
                  const isActive = bucket.key === selectedMonthKey;
                  return (
                    <button
                      key={bucket.key}
                      type="button"
                      onClick={() => {
                        setSelectedMonthKey(bucket.key);
                        setSelectedDayKey("");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        border: isActive ? "1px solid #cbd5e1" : "1px solid #ece8df",
                        borderRadius: 10,
                        background: isActive ? "#f8fafc" : "#fafaf9",
                        padding: "10px 12px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#2d2d2d", marginBottom: 2 }}>{bucket.label}</div>
                        <div style={{ fontSize: 12, color: "#909090" }}>{bucket.alerts.length} aviso(s)</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? "#475569" : "#b0b0b0" }}>{index + 1}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 22 }}>
            <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
              Calendario por dias {activeMonth ? `— ${activeMonth.label}` : ""}
            </div>

            {!activeMonth ? (
              <div style={{ fontSize: 13, color: "#8a8a8a" }}>Selecciona un mes para ver los dias.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 6 }}>
                  {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#c3c3c3", fontWeight: 700 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
                  {calendarCells.map((cell) => {
                    const cellAlerts = activeMonthAlertMap.get(cell.key) || [];
                    const isSelected = selectedDayKey === cell.key;
                    const hasAlerts = cellAlerts.length > 0;
                    const hasScheduledAlerts = cellAlerts.some((alert) => isAlertScheduled(alert));
                    const hasPendingAlerts = cellAlerts.some((alert) => !isAlertScheduled(alert));
                    const isToday = cell.key === dateKeyFromDate(new Date());

                    const dayDotColor = hasScheduledAlerts ? "#16a34a" : hasPendingAlerts ? "#3b82f6" : "transparent";

                    const selectedBackground = hasScheduledAlerts
                      ? "rgba(34,197,94,0.18)"
                      : hasPendingAlerts
                        ? "rgba(59,130,246,0.18)"
                        : "rgba(148,163,184,0.16)";

                    const selectedBorder = hasScheduledAlerts
                      ? "1px solid rgba(34,197,94,0.5)"
                      : hasPendingAlerts
                        ? "1px solid rgba(59,130,246,0.5)"
                        : "1px solid rgba(148,163,184,0.45)";

                    const normalBackground = isToday
                      ? "rgba(186,117,23,0.92)"
                      : hasScheduledAlerts
                        ? "rgba(34,197,94,0.12)"
                        : hasPendingAlerts
                          ? "rgba(59,130,246,0.12)"
                          : "#fafaf9";

                    const normalColor = isToday
                      ? "#fff"
                      : hasScheduledAlerts
                        ? "#15803d"
                        : hasPendingAlerts
                          ? "#1d4ed8"
                          : cell.inCurrentMonth
                            ? "#b2b2b2"
                            : "#d5d5d5";

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setSelectedDayKey(cell.key)}
                        style={{
                          height: 44,
                          borderRadius: 7,
                          border: isSelected ? selectedBorder : "1px solid transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: hasAlerts || isToday ? 700 : 600,
                          background: isSelected ? selectedBackground : normalBackground,
                          color: isSelected
                            ? (hasScheduledAlerts ? "#166534" : hasPendingAlerts ? "#1e40af" : "#334155")
                            : normalColor,
                          cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        {cell.day}
                        {hasAlerts ? (
                          <span style={{ position: "absolute", right: 5, top: 4, width: 5, height: 5, borderRadius: 99, background: dayDotColor }} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {(selectedDayAlerts.length ? selectedDayAlerts : monthUpcomingAlerts).map((alert, index) => (
                    <button
                      type="button"
                      onClick={() => openAlertModal(alert)}
                      key={`${alert.id}-${index}`}
                      aria-label={`Abrir detalle de ${alert.title}`}
                      style={{
                        border: isAlertScheduled(alert)
                          ? "1px solid rgba(21,128,61,0.55)"
                          : "1px solid rgba(59,130,246,0.35)",
                        borderRadius: 10,
                        background: isAlertScheduled(alert)
                          ? "linear-gradient(135deg, rgba(21,128,61,0.18), rgba(22,163,74,0.09))"
                          : "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(191,219,254,0.45))",
                        padding: "9px 11px",
                        display: "grid",
                        gap: 2,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 13, color: "#1f2937", fontWeight: 700 }}>{alert.title}</div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          borderRadius: 999,
                          padding: "3px 7px",
                          background: isAlertScheduled(alert) ? "rgba(21,128,61,0.22)" : "rgba(59,130,246,0.2)",
                          color: isAlertScheduled(alert) ? "#14532d" : "#1d4ed8",
                        }}>
                          {isAlertScheduled(alert) ? "Cita agendada" : "Agendar cita"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{alert.vehicleName}</div>
                      <div style={{ fontSize: 12, color: "#9a9a9a" }}>{alert.subtitle}</div>
                    </button>
                  ))}
                  {!selectedDayAlerts.length && !monthUpcomingAlerts.length ? (
                    <div style={{ fontSize: 12, color: "#9a9a9a" }}>Sin avisos para este mes.</div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}

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
          <div style={{ fontSize: 18, color: "#303030", fontWeight: 700, marginBottom: 3 }}>Activar recordatorios automaticos</div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            Cuando tengas IDCars subidos, combinaremos sus revisiones para darte una agenda unica por meses y dias.
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
            onClick={onGoHome}
            style={{
              border: "none",
              borderRadius: 14,
              background: "linear-gradient(135deg,#16a34a,#22c55e)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(22,163,74,0.3)",
            }}
          >
            Activar alertas →
          </button>
        </div>
      </section>

      {selectedAlert ? (
        <div
          onClick={closeAlertModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(15,23,42,0.38)",
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
            aria-label="Detalle de cita"
            style={{
              width: "min(560px, 100%)",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              boxShadow: "0 20px 40px rgba(15,23,42,0.2)",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{selectedAlert.title}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{selectedAlert.vehicleName}</div>
              </div>
              <button
                type="button"
                onClick={closeAlertModal}
                style={{ border: "none", background: "transparent", fontSize: 20, color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{selectedAlert.subtitle}</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Fecha</div>
                <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 700, marginTop: 2 }}>{toEsDateTimeText(selectedAlert.date)}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Estado</div>
                <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 700, marginTop: 2 }}>{normalizeText(selectedAlert.status) || "Pendiente"}</div>
              </div>
            </div>

            {canEditSelectedAppointment ? (
              <div style={{ border: "1px solid #dbeafe", borderRadius: 10, background: "#f8fbff", padding: 10, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>Gestion de cita</div>
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                  Nueva fecha y hora
                  <input
                    type="datetime-local"
                    value={rescheduleAt}
                    onChange={(event) => setRescheduleAt(event.target.value)}
                    style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 9px", fontSize: 12 }}
                  />
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleReschedule}
                    disabled={updatingAppointment || !rescheduleAt}
                    style={{
                      border: "none",
                      borderRadius: 9,
                      background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: updatingAppointment ? "not-allowed" : "pointer",
                      opacity: updatingAppointment || !rescheduleAt ? 0.7 : 1,
                    }}
                  >
                    Reagendar cita
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={updatingAppointment}
                    style={{
                      border: "1px solid rgba(220,38,38,0.28)",
                      borderRadius: 9,
                      background: "rgba(254,242,242,0.8)",
                      color: "#b91c1c",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: updatingAppointment ? "not-allowed" : "pointer",
                      opacity: updatingAppointment ? 0.7 : 1,
                    }}
                  >
                    Cancelar cita
                  </button>
                </div>

                {showCancelConfirm ? (
                  <div style={{ border: "1px solid rgba(220,38,38,0.28)", background: "rgba(254,242,242,0.9)", borderRadius: 8, padding: "8px 9px", display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#7f1d1d", fontWeight: 700 }}>
                      ¿Confirmas la cancelacion de esta cita?
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={handleCancelAppointment}
                        disabled={updatingAppointment}
                        style={{ border: "none", borderRadius: 8, background: "#b91c1c", color: "#fff", padding: "7px 11px", fontSize: 12, fontWeight: 700, cursor: updatingAppointment ? "not-allowed" : "pointer", opacity: updatingAppointment ? 0.7 : 1 }}
                      >
                        Sí, cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={updatingAppointment}
                        style={{ border: "1px solid #fecaca", borderRadius: 8, background: "#fff", color: "#7f1d1d", padding: "7px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        No, volver
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ border: "1px solid rgba(59,130,246,0.28)", borderRadius: 10, background: "rgba(239,246,255,0.8)", padding: 10, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#1e3a8a", fontWeight: 700 }}>
                  {canScheduleSelectedAlert ? "Aun no tienes cita agendada para este aviso." : "Este aviso es informativo."}
                </div>
                {canScheduleSelectedAlert ? (
                  <button
                    type="button"
                    onClick={handleScheduleAppointment}
                    style={{
                      border: "none",
                      borderRadius: 9,
                      background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      justifySelf: "start",
                    }}
                  >
                    Agendar cita
                  </button>
                ) : null}
              </div>
            )}

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", padding: 10, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>Historial de la cita</div>
              {selectedAlertHistory.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {selectedAlertHistory.map((item, index) => (
                    <div key={`${item.changedAt}-${item.nextStatus}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", padding: "7px 9px", display: "grid", gap: 2 }}>
                      <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 700 }}>
                        {item.previousStatus ? `${item.previousStatus} → ` : ""}{item.nextStatus || "Actualizacion"}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{item.changedAt || "Sin fecha"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#64748b" }}>Aun no hay cambios registrados en esta cita.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
