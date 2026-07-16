import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

function getSlotsForWeekday(weekday) {
  if (weekday === 0) return null; // Sunday — closed
  if (weekday === 6) return ["09:00", "10:00", "11:00", "12:00", "13:00"]; // Saturday
  return ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00", "18:00", "19:00"]; // Mon–Fri
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
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedDetail, setConfirmedDetail] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  const { t } = useTranslation();

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const safeDraft = bookingDraft && typeof bookingDraft === "object" ? bookingDraft : {};
  const workshopName = normalizeText(safeDraft?.workshopName) || normalizeText(safeDraft?.provider) || t("service.appointmentCalWorkshopFallback");
  const workshopId = normalizeText(safeDraft?.workshopId);
  const appointmentType = normalizeText(safeDraft?.appointmentType) || t("service.appointmentCalTypeFallback");

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
      const weekday = date.getDay();
      const isSunday = weekday === 0;
      const slotTimes = !inPast && !isSunday ? (getSlotsForWeekday(weekday) || []) : [];
      const slots = slotTimes.map((t) => ({ time: t, available: true }));

      map.set(cell.key, {
        inPast,
        closed: isSunday,
        fullyBooked: false,
        slots,
        availableSlots: slots,
      });
    });

    return map;
  }, [monthCells]);

  useEffect(() => {
    let disposed = false;

    const loadAvailability = async () => {
      if (!workshopId) {
        if (!disposed) {
          setAvailabilityMap({});
          setBookingError("");
          setIsLoadingAvailability(false);
        }
        return;
      }

      setIsLoadingAvailability(true);
      setBookingError("");

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
            setBookingError(normalizeText(data?.error) || t("service.appointmentCalLoadError"));
          }
        }
      } catch {
        if (!disposed) {
          setAvailabilityMap({});
          setBookingError(t("service.appointmentCalLoadError"));
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
  }, [workshopId, safeDraft?.provider, monthKey, t]);

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
          closed: Boolean(remote?.closed),
          fullyBooked: Boolean(remote?.fullyBooked),
          slots,
          availableSlots: slots.filter((slot) => slot.available),
        });
      } else {
        map.set(cell.key, fallbackDayAvailability.get(cell.key) || { inPast: false, closed: false, fullyBooked: false, slots: [], availableSlots: [] });
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
          const message = normalizeText(data?.error) || t("service.appointmentCalSlotUnavailable");
          throw new Error(message);
        }
      }

      const detail = toDateTimeLabel(selectedDay.date, selectedTime);
      await onConfirmBooking({
        selectedDateKey: selectedDay.key,
        selectedTime,
        requestedAt: detail,
      });
      setConfirmedDetail(detail);
      setIsConfirmed(true);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : t("service.appointmentCalReservationError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isConfirmed || bookingError) {
    const isError = Boolean(bookingError);
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}>
        <div style={{
          background: "#fff", borderRadius: 20, padding: "36px 28px",
          maxWidth: 400, width: "100%", textAlign: "center",
          boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: isError
              ? "linear-gradient(135deg,#dc2626,#ef4444)"
              : "linear-gradient(135deg,#7c3aed,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <span style={{ fontSize: 30, color: "#fff" }}>{isError ? "✕" : "✓"}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
            {isError ? "Error al enviar" : "¡Solicitud enviada!"}
          </div>
          {isError ? (
            <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 24, lineHeight: 1.5 }}>
              {bookingError}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6, lineHeight: 1.5 }}>
                <strong style={{ color: "#1e293b" }}>{appointmentType}</strong> en <strong style={{ color: "#1e293b" }}>{workshopName}</strong>
              </div>
              {confirmedDetail && (
                <div style={{ fontSize: 13, color: "#7c3aed", fontWeight: 700, marginBottom: 4 }}>
                  {confirmedDetail}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 24 }}>
                El taller verificará disponibilidad y te confirmará en 24 h.
              </div>
            </>
          )}
          <button
            type="button"
            onClick={isError ? () => setBookingError("") : onGoHome}
            style={{
              width: "100%", padding: "13px 0",
              background: isError
                ? "linear-gradient(135deg,#dc2626,#ef4444)"
                : "linear-gradient(135deg,#7c3aed,#8b5cf6)",
              color: "#fff", border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: isError
                ? "0 8px 20px rgba(220,38,38,0.3)"
                : "0 8px 20px rgba(124,58,237,0.3)",
            }}
          >
            {isError ? "Volver e intentarlo" : "Ver mi solicitud en el panel →"}
          </button>
        </div>
      </div>
    );
  }

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
          {t("common.backArrow")}
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          {t("common.breadcrumbServices")} › {t("service.appointmentBreadcrumb")} › <span style={{ color: "#7c3aed", fontWeight: 700 }}>{t("service.appointmentCalBreadcrumb")}</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#8b5cf6" }} />
        <div style={{ padding: "22px 24px" }}>
          <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>
            {t("service.appointmentCalSectionBadge")}
          </div>
          <div style={{ fontSize: 24, lineHeight: 1.2, color: "#111", fontWeight: 800 }}>
            {t("service.appointmentCalTitle")}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            {appointmentType} · {workshopName}
            {normalizeText(safeDraft?.workshopDistanceKm) ? ` · ${safeDraft.workshopDistanceKm} km` : ""}
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>
          <strong>Horario orientativo del taller.</strong> Selecciona el día y la franja que mejor te venga.
          Una vez enviada tu solicitud, el taller verificará disponibilidad y te confirmará la cita en 24 h.
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
        {isLoadingAvailability ? (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
            {t("service.appointmentCalLoadingAvailability")}
          </div>
        ) : null}
        {/* API availability error suppressed — fallback slots are used instead */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, color: "#64748b" }}
          >
            {t("service.appointmentCalPrevMonth")}
          </button>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#334155", textTransform: "capitalize" }}>
            {new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(monthCursor)}
          </div>
          <button
            type="button"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, color: "#64748b" }}
          >
            {t("service.appointmentCalNextMonth")}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {(t("service.appointmentCalWeekDays", { returnObjects: true }) || ["L","M","X","J","V","S","D"]).map((label) => (
            <div key={label} style={{ textAlign: "center", fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{label}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {monthCells.map((cell) => {
            const data = dayAvailability.get(cell.key);
            const isSelected = selectedDayKey === cell.key;
            const isClosed = data?.closed;
            const isDisabled = data?.inPast || isClosed;
            const hasSlots = (data?.slots || []).length > 0;

            const background = isSelected
              ? "rgba(139,92,246,0.18)"
              : isClosed
                ? "#f1f5f9"
                : data?.inPast
                  ? "#fafaf9"
                  : hasSlots
                    ? "rgba(34,197,94,0.10)"
                    : "#fafaf9";

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => {
                  if (isDisabled) return;
                  setSelectedDayKey(cell.key);
                  setSelectedTime("");
                }}
                disabled={isDisabled}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: isSelected ? "1px solid rgba(124,58,237,0.55)" : "1px solid rgba(148,163,184,0.2)",
                  background,
                  color: data?.inPast ? "#cbd5e1" : isClosed ? "#94a3b8" : hasSlots ? "#166534" : "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: cell.inCurrentMonth ? 1 : 0.45,
                  position: "relative",
                }}
              >
                {cell.day}
                {isClosed ? (
                  <span style={{ position: "absolute", right: 3, top: 3, fontSize: 8, color: "#94a3b8", fontWeight: 700 }}>CERR</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(34,197,94,0.20)", border: "1px solid rgba(34,197,94,0.3)", display: "inline-block" }} />
            Disponible
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f1f5f9", border: "1px solid rgba(148,163,184,0.2)", display: "inline-block" }} />
            Cerrado
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(139,92,246,0.18)", border: "1px solid rgba(124,58,237,0.4)", display: "inline-block" }} />
            Seleccionado
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 8 }}>
          {selectedDay ? t("service.appointmentCalScheduleFor", { date: toDateLabel(selectedDay.date) }) : t("service.appointmentCalSelectDay")}
        </div>

        {selectedDay ? (
          selectedDayData?.closed ? (
            <div style={{ fontSize: 13, color: "#64748b" }}>
              El taller está cerrado los domingos. Elige otro día.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8 }}>
              {(selectedDayData?.slots || []).map((slot) => {
                const active = selectedTime === slot.time;
                const isUnavailable = !slot.available;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => !isUnavailable && setSelectedTime(slot.time)}
                    disabled={isUnavailable}
                    style={{
                      border: active ? "1px solid rgba(124,58,237,0.55)" : "1px solid rgba(148,163,184,0.25)",
                      borderRadius: 10,
                      padding: "10px 8px",
                      fontSize: 14,
                      fontWeight: 700,
                      background: isUnavailable ? "#f8fafc" : active ? "rgba(139,92,246,0.14)" : "#fff",
                      color: isUnavailable ? "#94a3b8" : active ? "#6d28d9" : "#334155",
                      cursor: isUnavailable ? "not-allowed" : "pointer",
                    }}
                  >
                    {slot.time}
                    {isUnavailable ? (
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", marginTop: 2 }}>Ocupado</div>
                    ) : null}
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
            {t("service.appointmentCalConfirmTitle")}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.45 }}>
            {selectedDay && selectedTime
              ? t("service.appointmentCalConfirmDetail", { type: appointmentType, datetime: toDateTimeLabel(selectedDay.date, selectedTime), workshop: workshopName })
              : t("service.appointmentCalConfirmHint")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, cursor: "pointer" }}
          >
            {t("common.backArrow")}
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
            {isSaving ? t("service.appointmentCalConfirming") : t("service.appointmentCalConfirm")}
          </button>
        </div>
      </section>
    </div>
  );
}
