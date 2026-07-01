import { useEffect, useState } from "react";

const API = "/api/visit-availability";

function fmtDateLong(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtDateShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("es-ES", { weekday: "short" }),
    day:     d.toLocaleDateString("es-ES", { day: "numeric" }),
    month:   d.toLocaleDateString("es-ES", { month: "short" }),
  };
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function groupByDay(slots) {
  const map = {};
  slots.forEach((s) => {
    const day = s.starts_at.slice(0, 10);
    if (!map[day]) map[day] = [];
    map[day].push(s);
  });
  return map;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MiCitaPage() {
  const params    = new URLSearchParams(window.location.search);
  const bookingId = params.get("id") || "";
  const token     = params.get("token") || "";

  // Core state
  const [booking,    setBooking]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  // Cancel state
  const [cancelling, setCancelling] = useState(false);
  const [cancelled,  setCancelled]  = useState(false);

  // Reschedule state
  const [view,           setView]           = useState("detail"); // detail | reschedule | rescheduled
  const [slots,          setSlots]          = useState([]);
  const [slotsLoading,   setSlotsLoading]   = useState(false);
  const [activeDay,      setActiveDay]      = useState(null);
  const [selectedSlot,   setSelectedSlot]   = useState(null);
  const [rescheduling,   setRescheduling]   = useState(false);
  const [rescheduleErr,  setRescheduleErr]  = useState("");

  // Load booking
  useEffect(() => {
    if (!bookingId || !token) { setError("Enlace inválido."); setLoading(false); return; }
    fetch(`${API}?route=booking_detail&bookingId=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setBooking(d.booking); else setError(d.error || "Cita no encontrada"); })
      .catch(() => setError("Error de conexión"))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  // Load slots for reschedule
  async function openReschedule() {
    setSlotsLoading(true);
    setView("reschedule");
    setSelectedSlot(null);
    setRescheduleErr("");
    try {
      const r = await fetch(`${API}?offerId=${encodeURIComponent(booking.offer_id)}`);
      const d = await r.json();
      const available = (d.slots || []).filter((s) => s.id !== booking.availability_id);
      setSlots(available);
      if (available.length) setActiveDay(available[0].starts_at.slice(0, 10));
    } catch { setRescheduleErr("No se pudieron cargar los horarios"); }
    setSlotsLoading(false);
  }

  async function confirmReschedule() {
    if (!selectedSlot) return;
    setRescheduling(true);
    setRescheduleErr("");
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "reschedule", bookingId, token, newSlotId: selectedSlot.id }),
      });
      const d = await r.json();
      if (d.ok) {
        setBooking((prev) => ({ ...prev, starts_at: selectedSlot.starts_at, ends_at: selectedSlot.ends_at }));
        setView("rescheduled");
      } else {
        setRescheduleErr(d.error || "Error al cambiar la cita");
        if (d.error?.includes("disponible")) {
          setSlots((prev) => prev.filter((s) => s.id !== selectedSlot.id));
          setSelectedSlot(null);
        }
      }
    } catch { setRescheduleErr("Error de conexión"); }
    setRescheduling(false);
  }

  async function cancelBooking() {
    if (!window.confirm("¿Seguro que quieres cancelar esta visita?")) return;
    setCancelling(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ route: "cancel", bookingId, token }) });
      const d = await r.json();
      if (d.ok) setCancelled(true);
      else setError(d.error || "Error al cancelar");
    } catch { setError("Error de conexión"); }
    setCancelling(false);
  }

  const F = styles;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 14 }}>Cargando tu cita…</div>
      </div>
    </div>
  );

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={F.title}>Cita no encontrada</div>
          <div style={F.sub}>{error}</div>
          <a href="/" style={F.btnPrimary}>Ir al marketplace →</a>
        </div>
      </div>
    </div>
  );

  // ── Cancelled success ───────────────────────────────────────────────────────
  if (cancelled) return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={F.title}>Cita cancelada</div>
          <div style={F.sub}>Tu visita ha sido cancelada. Recibirás un email de confirmación.</div>
          <a href="/" style={F.btnPrimary}>Explorar más vehículos →</a>
        </div>
      </div>
    </div>
  );

  const isCancelled = booking?.status === "cancelled";

  // ── Reschedule success ──────────────────────────────────────────────────────
  if (view === "rescheduled") return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗓</div>
          <div style={F.title}>¡Cita actualizada!</div>
          <div style={F.sub}>Tu visita ha sido reprogramada correctamente.</div>
        </div>
        <div style={F.dateCard}>
          <div style={F.dateCardLabel}>Nueva fecha</div>
          <div style={F.dateCardDate}>{fmtDateLong(booking.starts_at)}</div>
          <div style={F.dateCardTime}>{fmtTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</div>
        </div>
        <div style={F.sub}>Recibirás un email de confirmación con los nuevos detalles.</div>
        <button onClick={() => setView("detail")} style={F.btnPrimary}>Ver mi cita →</button>
      </div>
    </div>
  );

  // ── Reschedule view ─────────────────────────────────────────────────────────
  if (view === "reschedule") {
    const byDay  = groupByDay(slots);
    const days   = Object.keys(byDay).sort().slice(0, 14);
    const daySlots = activeDay ? (byDay[activeDay] || []) : [];
    const morning   = daySlots.filter((s) => new Date(s.starts_at).getHours() < 14);
    const afternoon = daySlots.filter((s) => new Date(s.starts_at).getHours() >= 14);

    return (
      <div style={F.page}>
        <div style={{ ...F.card, maxWidth: 520 }}>
          <Logo />
          <button onClick={() => setView("detail")} style={F.backBtn}>← Volver a mi cita</button>
          <div style={F.title}>Cambiar fecha y hora</div>
          <div style={F.sub}>Selecciona el nuevo horario para tu visita.</div>

          {slotsLoading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "32px 0", fontSize: 14 }}>Cargando horarios…</div>
          ) : slots.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "32px 0", fontSize: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
              No hay otros horarios disponibles en este momento.
            </div>
          ) : (
            <>
              {/* Day tabs */}
              <div style={{ overflowX: "auto", marginBottom: 20, WebkitOverflowScrolling: "touch" }}>
                <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
                  {days.map((day) => {
                    const { weekday, day: d, month } = fmtDateShort(day);
                    const isActive = activeDay === day;
                    const today = isToday(day);
                    return (
                      <button
                        key={day}
                        onClick={() => { setActiveDay(day); setSelectedSlot(null); }}
                        style={{
                          background: isActive ? "#0ea5e9" : "#fff",
                          border: `1.5px solid ${isActive ? "#0ea5e9" : today ? "#0ea5e9" : "#e2e8f0"}`,
                          borderRadius: 10, padding: "8px 12px", cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                          minWidth: 56, color: isActive ? "#fff" : today ? "#0ea5e9" : "#475569",
                          transition: "all .15s",
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", opacity: 0.75 }}>{today ? "Hoy" : weekday}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{d}</span>
                        <span style={{ fontSize: 10, opacity: 0.65 }}>{month}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot grid */}
              {morning.length > 0 && (
                <>
                  <div style={F.periodLabel}>Mañana</div>
                  <div style={F.slotGrid}>
                    {morning.map((s) => <RescheduleSlotBtn key={s.id} slot={s} selected={selectedSlot} onSelect={() => setSelectedSlot(s)} />)}
                  </div>
                </>
              )}
              {afternoon.length > 0 && (
                <>
                  <div style={{ ...F.periodLabel, marginTop: morning.length ? 14 : 0 }}>Tarde</div>
                  <div style={F.slotGrid}>
                    {afternoon.map((s) => <RescheduleSlotBtn key={s.id} slot={s} selected={selectedSlot} onSelect={() => setSelectedSlot(s)} />)}
                  </div>
                </>
              )}
            </>
          )}

          {rescheduleErr && <div style={F.errMsg}>{rescheduleErr}</div>}

          {selectedSlot && (
            <div style={{ marginTop: 20 }}>
              <div style={F.selectedPreview}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", marginBottom: 2 }}>Nueva hora seleccionada</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0c4a6e" }}>{fmtDateLong(selectedSlot.starts_at)}</div>
                  <div style={{ fontSize: 13, color: "#0369a1" }}>{fmtTime(selectedSlot.starts_at)} – {fmtTime(selectedSlot.ends_at)}</div>
                </div>
                <button onClick={() => setSelectedSlot(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 20 }}>×</button>
              </div>
              <button
                onClick={confirmReschedule}
                disabled={rescheduling}
                style={{ ...F.btnPrimary, opacity: rescheduling ? 0.6 : 1 }}
              >
                {rescheduling ? "Cambiando…" : "Confirmar nuevo horario →"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Detail view (default) ───────────────────────────────────────────────────
  return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />

        {/* Status badge */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {isCancelled ? (
            <span style={F.badgeCancelled}>Cancelada</span>
          ) : (
            <span style={F.badgeConfirmed}>✓ Confirmada</span>
          )}
        </div>

        {/* Vehicle */}
        <div style={F.vehicleTitle}>{booking.vehicle_title || "Vehículo"}</div>

        {/* Date card */}
        <div style={F.dateCard}>
          <div style={F.dateCardLabel}>Fecha y hora</div>
          <div style={F.dateCardDate}>{fmtDateLong(booking.starts_at)}</div>
          <div style={F.dateCardTime}>{fmtTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</div>
        </div>

        {booking.buyer_name && (
          <div style={F.detail}><span style={F.detailLabel}>Reserva a nombre de</span> {booking.buyer_name}</div>
        )}
        {booking.notes && (
          <div style={{ ...F.detail, fontStyle: "italic", color: "#64748b" }}><span style={F.detailLabel}>Notas</span> {booking.notes}</div>
        )}

        {/* Actions */}
        {!isCancelled && (
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={openReschedule} style={F.btnReschedule}>
              🗓 Cambiar fecha u hora
            </button>
            <button
              onClick={cancelBooking}
              disabled={cancelling}
              style={{ ...F.btnCancel, opacity: cancelling ? 0.6 : 1 }}
            >
              {cancelling ? "Cancelando…" : "Cancelar esta visita"}
            </button>
          </div>
        )}

        <a href="/" style={F.linkBack}>← Volver al marketplace</a>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.3px" }}>
        Cars<span style={{ color: "#0ea5e9" }}>Wise</span>
      </span>
    </div>
  );
}

function RescheduleSlotBtn({ slot, selected, onSelect }) {
  const isActive = selected?.id === slot.id;
  return (
    <button
      onClick={onSelect}
      style={{
        background: isActive ? "#0ea5e9" : "#f0f9ff",
        border: `1.5px solid ${isActive ? "#0ea5e9" : "#bae6fd"}`,
        color: isActive ? "#fff" : "#0369a1",
        borderRadius: 8, padding: "9px 6px", fontSize: 14, fontWeight: 700,
        cursor: "pointer", transition: "all .12s", textAlign: "center",
      }}
    >
      {new Date(slot.starts_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
    </button>
  );
}

const styles = {
  page:           { minHeight: "100vh", background: "linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  card:           { background: "#fff", borderRadius: 20, boxShadow: "0 8px 48px rgba(0,0,0,.1)", padding: "32px 28px", maxWidth: 440, width: "100%" },
  title:          { fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 6, textAlign: "center" },
  sub:            { fontSize: 14, color: "#64748b", marginBottom: 20, lineHeight: 1.6, textAlign: "center" },
  vehicleTitle:   { fontSize: 16, fontWeight: 700, color: "#0f172a", textAlign: "center", marginBottom: 16 },

  badgeConfirmed: { display: "inline-block", background: "#f0fdf4", color: "#16a34a", fontSize: 13, fontWeight: 700, borderRadius: 20, padding: "5px 14px", border: "1.5px solid #86efac" },
  badgeCancelled: { display: "inline-block", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 700, borderRadius: 20, padding: "5px 14px", border: "1.5px solid #fecaca" },

  dateCard:       { background: "linear-gradient(135deg, #eff6ff, #f0f9ff)", border: "1.5px solid #bfdbfe", borderRadius: 14, padding: "20px", marginBottom: 14, textAlign: "center" },
  dateCardLabel:  { fontSize: 11, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 },
  dateCardDate:   { fontSize: 15, fontWeight: 700, color: "#1e40af", marginBottom: 4 },
  dateCardTime:   { fontSize: 26, fontWeight: 800, color: "#0f172a" },

  detail:         { fontSize: 13, color: "#475569", marginBottom: 6 },
  detailLabel:    { fontWeight: 700, color: "#94a3b8", marginRight: 6 },

  btnPrimary:     { display: "block", width: "100%", background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "#fff", textDecoration: "none", padding: "13px 0", borderRadius: 10, fontWeight: 800, fontSize: 15, textAlign: "center", border: "none", cursor: "pointer", boxSizing: "border-box", marginTop: 4 },
  btnReschedule:  { width: "100%", background: "#eff6ff", border: "1.5px solid #bfdbfe", color: "#1d4ed8", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  btnCancel:      { width: "100%", background: "#fef2f2", border: "1.5px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .15s" },

  linkBack:       { display: "block", textAlign: "center", color: "#94a3b8", textDecoration: "none", fontSize: 13, marginTop: 20 },
  backBtn:        { background: "none", border: "none", color: "#0ea5e9", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 16px", display: "block" },

  // Reschedule
  periodLabel:    { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 },
  slotGrid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 },
  selectedPreview:{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 12 },
  errMsg:         { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 14 },
};
