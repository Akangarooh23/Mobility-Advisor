import { useEffect, useMemo, useState } from "react";
import { getWorkshopAvailabilityJson, postWorkshopReservationJson } from "../utils/apiClient";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(baseDate, daysToAdd) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + Number(daysToAdd || 0));
  return next;
}

function buildMonthCells(referenceDate) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
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

function toDateLabel(date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function toDateTimeLabel(date, timeText = "") {
  const safe = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safe.getTime())) {
    return "";
  }

  const day = String(safe.getDate()).padStart(2, "0");
  const month = String(safe.getMonth() + 1).padStart(2, "0");
  const year = safe.getFullYear();
  return `${day}/${month}/${year} ${timeText}`.trim();
}

function hashText(value = "") {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 1000003;
  }
  return hash;
}

function buildWorkshopProfile(workshopId = "", provider = "") {
  const profileSeed = normalizeText(workshopId) || normalizeText(provider) || "carswise-workshop";
  const hash = hashText(profileSeed);

  return {
    busySlotModulo: 3 + (hash % 3),
    fullDayModulo: 5 + (hash % 4),
    weekendOpenBias: hash % 2 === 0,
    eveningOpenBias: hash % 5 <= 2,
  };
}

function buildSlotsForDate(date, seed = "", profile = null) {
  const weekday = date.getDay();
  const weekend = weekday === 0 || weekday === 6;
  const workshopProfile = profile || buildWorkshopProfile();

  const baseSlots = weekend
    ? (workshopProfile.weekendOpenBias
      ? ["09:30", "11:00", "12:30", "16:00"]
      : ["10:00", "11:30", "13:00"])
    : (workshopProfile.eveningOpenBias
      ? ["09:00", "10:30", "12:00", "13:30", "16:00", "17:30", "19:00"]
      : ["08:30", "10:00", "11:30", "13:00", "15:30", "17:00"]);

  return baseSlots.map((timeText) => {
    const slotHash = hashText(`${seed}-${dateKeyFromDate(date)}-${timeText}`);
    const available = slotHash % workshopProfile.busySlotModulo !== 0;
    return {
      time: timeText,
      available,
    };
  });
}

function isDayFullyBooked(date, seed = "", profile = null) {
  const workshopProfile = profile || buildWorkshopProfile();
  const dayHash = hashText(`${seed}-${dateKeyFromDate(date)}-day`);
  return dayHash % workshopProfile.fullDayModulo === 0;
}

export default function ServiceAppointmentCalendarPage({
  bookingDraft = null,
  onBack = () => {},
  onConfirmBooking = async () => {},
  onGoHome = () => {},
}) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const safeDraft = bookingDraft && typeof bookingDraft === "object" ? bookingDraft : {};
  const workshopName = normalizeText(safeDraft?.workshopName) || normalizeText(safeDraft?.provider) || "Taller";
  const workshopId = normalizeText(safeDraft?.workshopId);
  const workshopProfile = useMemo(
    () => buildWorkshopProfile(workshopId, normalizeText(safeDraft?.provider)),
    [workshopId, safeDraft?.provider]
  );
  const appointmentType = normalizeText(safeDraft?.appointmentType) || "Cita de mantenimiento";
  const draftSeed = [
    normalizeText(safeDraft?.vehicleId),
    workshopId,
    normalizeText(safeDraft?.provider),
    normalizeText(safeDraft?.postalCode),
  ].filter(Boolean).join("-") || "carswise";

  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);
  const monthKey = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`;

  const fallbackDayAvailability = useMemo(() => {
    const map = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    monthCells.forEach((cell) => {
      const date = cell.date;
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      const inPast = dayStart.getTime() < today.getTime();
      const fullyBooked = !inPast && isDayFullyBooked(date, draftSeed, workshopProfile);
      const slots = !inPast && !fullyBooked ? buildSlotsForDate(date, draftSeed, workshopProfile) : [];
      const availableSlots = slots.filter((slot) => slot.available);

      map.set(cell.key, {
        inPast,
        fullyBooked,
        slots,
        availableSlots,
      });
    });

    return map;
  }, [monthCells, draftSeed, workshopProfile]);

  useEffect(() => {
    let disposed = false;

    const loadAvailability = async () => {
      if (!workshopId) {
        if (!disposed) {
          setAvailabilityMap({});
          setAvailabilityError("");
          setIsLoadingAvailability(false);
        }
        return;
      }

      setIsLoadingAvailability(true);
      setAvailabilityError("");

      try {
        const { response, data } = await getWorkshopAvailabilityJson({
          workshopId,
          provider: normalizeText(safeDraft?.provider),
          monthKey,
        });

        if (!disposed) {
          if (response.ok && data?.availabilityByDate && typeof data.availabilityByDate === "object") {
            setAvailabilityMap(data.availabilityByDate);
          } else {
            setAvailabilityMap({});
            setAvailabilityError(normalizeText(data?.error) || "No se pudo cargar la disponibilidad del taller.");
          }
        }
      } catch {
        if (!disposed) {
          setAvailabilityMap({});
          setAvailabilityError("No se pudo cargar la disponibilidad del taller.");
        }
      } finally {
        if (!disposed) {
          setIsLoadingAvailability(false);
        }
      }
    };

    void loadAvailability();
    return () => {
      disposed = true;
    };
  }, [workshopId, safeDraft?.provider, monthKey]);

  const dayAvailability = useMemo(() => {
    const map = new Map();

    monthCells.forEach((cell) => {
      const remote = availabilityMap?.[cell.key];
      if (remote && Array.isArray(remote?.slots)) {
        const slots = remote.slots.map((slot) => ({
          time: normalizeText(slot?.time),
          available: Boolean(slot?.available),
        }));
        map.set(cell.key, {
          inPast: false,
          fullyBooked: Boolean(remote?.fullyBooked),
          slots,
          availableSlots: slots.filter((slot) => slot.available),
        });
      } else {
        map.set(cell.key, fallbackDayAvailability.get(cell.key) || { inPast: false, fullyBooked: false, slots: [], availableSlots: [] });
      }
    });

    return map;
  }, [monthCells, availabilityMap, fallbackDayAvailability]);

  const selectedDay = monthCells.find((cell) => cell.key === selectedDayKey) || null;
  const selectedDayData = selectedDay ? dayAvailability.get(selectedDay.key) : null;

  const canConfirm = Boolean(selectedDay && selectedTime) && !isSaving;

  const handleConfirm = async () => {
    if (!canConfirm || !selectedDay) {
      return;
    }

    setIsSaving(true);
    try {
      if (workshopId) {
        const { response, data } = await postWorkshopReservationJson({
          workshopId,
          provider: normalizeText(safeDraft?.provider),
          dateKey: selectedDay.key,
          time: selectedTime,
        });

        if (!response.ok) {
          const message = normalizeText(data?.error) || "La franja horaria ya no esta disponible.";
          throw new Error(message);
        }
      }

      await onConfirmBooking({
        selectedDateKey: selectedDay.key,
        selectedTime,
        requestedAt: toDateTimeLabel(selectedDay.date, selectedTime),
      });
      onGoHome();
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : "No se pudo reservar la franja seleccionada.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto", color: "#1a1a1a", padding: "0 8px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button
          type="button"
          onClick={onBack}
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
          Servicios › Cita Mantenimientos › <span style={{ color: "#7c3aed", fontWeight: 700 }}>Calendario</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#8b5cf6" }} />
        <div style={{ padding: "22px 24px" }}>
          <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>
            Seleccion de fecha y hora
          </div>
          <div style={{ fontSize: 24, lineHeight: 1.2, color: "#111", fontWeight: 800 }}>
            Elige dia y hora para tu cita
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            {appointmentType} · {workshopName}
            {normalizeText(safeDraft?.workshopDistanceKm) ? ` · ${safeDraft.workshopDistanceKm} km` : ""}
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
        {isLoadingAvailability ? (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
            Cargando disponibilidad real del taller...
          </div>
        ) : null}
        {availabilityError ? (
          <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
            {availabilityError}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, color: "#64748b" }}
          >
            ← Mes anterior
          </button>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#334155", textTransform: "capitalize" }}>
            {new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(monthCursor)}
          </div>
          <button
            type="button"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, color: "#64748b" }}
          >
            Mes siguiente →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {["L", "M", "X", "J", "V", "S", "D"].map((label) => (
            <div key={label} style={{ textAlign: "center", fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{label}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {monthCells.map((cell) => {
            const data = dayAvailability.get(cell.key);
            const isSelected = selectedDayKey === cell.key;
            const isDisabled = data?.inPast;
            const full = data?.fullyBooked;
            const hasAnyAvailable = (data?.availableSlots || []).length > 0;

            const background = isSelected
              ? "rgba(139,92,246,0.18)"
              : full
                ? "rgba(239,68,68,0.12)"
                : hasAnyAvailable
                  ? "rgba(34,197,94,0.12)"
                  : "#fafaf9";

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => {
                  if (isDisabled) {
                    return;
                  }
                  setSelectedDayKey(cell.key);
                  setSelectedTime("");
                }}
                disabled={isDisabled}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: isSelected ? "1px solid rgba(124,58,237,0.55)" : "1px solid rgba(148,163,184,0.2)",
                  background,
                  color: isDisabled ? "#cbd5e1" : full ? "#b91c1c" : hasAnyAvailable ? "#166534" : "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: cell.inCurrentMonth ? 1 : 0.55,
                  position: "relative",
                }}
              >
                {cell.day}
                {full ? (
                  <span style={{ position: "absolute", right: 4, top: 3, fontSize: 9, color: "#b91c1c", fontWeight: 800 }}>LLENO</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 8 }}>
          {selectedDay ? `Horario para ${toDateLabel(selectedDay.date)}` : "Selecciona un dia para ver horas disponibles"}
        </div>

        {selectedDay ? (
          selectedDayData?.fullyBooked ? (
            <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>
              Dia completo, no disponible. Selecciona otro dia.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
              {(selectedDayData?.slots || []).map((slot) => {
                const active = selectedTime === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => slot.available && setSelectedTime(slot.time)}
                    disabled={!slot.available}
                    style={{
                      border: active ? "1px solid rgba(124,58,237,0.55)" : "1px solid rgba(148,163,184,0.25)",
                      borderRadius: 10,
                      padding: "9px 10px",
                      fontSize: 13,
                      fontWeight: 700,
                      background: !slot.available ? "#f8fafc" : active ? "rgba(139,92,246,0.14)" : "#fff",
                      color: !slot.available ? "#94a3b8" : active ? "#6d28d9" : "#334155",
                      cursor: !slot.available ? "not-allowed" : "pointer",
                    }}
                  >
                    {slot.time}
                    {!slot.available ? " · No disp." : ""}
                  </button>
                );
              })}
            </div>
          )
        ) : null}
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
            Confirmar reserva de cita
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.45 }}>
            {selectedDay && selectedTime
              ? `${appointmentType} · ${toDateTimeLabel(selectedDay.date, selectedTime)} · ${workshopName}`
              : "Selecciona un dia y despues una hora para confirmar tu cita."}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, cursor: "pointer" }}
          >
            ← Volver
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              border: "none",
              borderRadius: 14,
              background: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: !canConfirm ? "not-allowed" : "pointer",
              opacity: !canConfirm ? 0.65 : 1,
              boxShadow: "0 8px 20px rgba(124,58,237,0.3)",
            }}
          >
            {isSaving ? "Confirmando..." : "Confirmar cita →"}
          </button>
        </div>
      </section>
    </div>
  );
}
