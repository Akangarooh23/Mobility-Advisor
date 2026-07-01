import { useEffect, useState } from "react";

const API = "/api/visit-availability";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDayShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("es-ES", { weekday: "short" }),
    day:     d.toLocaleDateString("es-ES", { day: "numeric" }),
    month:   d.toLocaleDateString("es-ES", { month: "short" }),
  };
}
function fmtDayLong(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10);
}
function isMorning(iso) {
  return new Date(iso).getHours() < 14;
}
function buildIcsBlob(booking) {
  function dt(iso) { return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"; }
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CarsWise AI//ES", "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTART:${dt(booking.starts_at)}`, `DTEND:${dt(booking.ends_at)}`,
    `SUMMARY:Visita: ${booking.vehicle_title || "Vehículo"}`,
    `DESCRIPTION:Cita confirmada.\\nID: ${booking.id}`,
    `UID:${booking.id}@carswiseai.com`, "STATUS:CONFIRMED",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return new Blob([lines.join("\r\n")], { type: "text/calendar" });
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function SlotPicker({ offerId, vehicleTitle, sellerEmail, userEmail, userName, userPhone, source, onBooked }) {
  const [slots,      setSlots]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [activeDay,  setActiveDay]  = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [step,       setStep]       = useState("pick"); // pick | confirm | done
  const [form,       setForm]       = useState({ name: userName || "", phone: userPhone || "", notes: "" });
  const [booking,    setBooking]    = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!offerId) return;
    fetch(`${API}?offerId=${encodeURIComponent(offerId)}`)
      .then((r) => r.json())
      .then((d) => {
        const s = d.slots || [];
        setSlots(s);
        if (s.length) setActiveDay(s[0].starts_at.slice(0, 10));
        setLoading(false);
      })
      .catch(() => { setError("No se pudieron cargar los horarios"); setLoading(false); });
  }, [offerId]);

  async function confirmBooking() {
    if (!selected || !userEmail) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: "book", slotId: selected.id, offerId, vehicleTitle,
          buyerEmail: userEmail, buyerName: form.name, buyerPhone: form.phone,
          sellerEmail: sellerEmail || null, notes: form.notes,
          source: source || "marketplace",
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Error al reservar");
        if (d.error?.includes("disponible")) {
          setSlots((prev) => prev.filter((s) => s.id !== selected.id));
          setSelected(null); setStep("pick");
        }
      } else {
        setBooking(d.booking); setStep("done");
        if (onBooked) onBooked(d.booking);
      }
    } catch { setError("Error de conexión"); }
    setSubmitting(false);
  }

  function downloadIcs() {
    if (!booking) return;
    const url = URL.createObjectURL(buildIcsBlob(booking));
    const a = document.createElement("a");
    a.href = url; a.download = "cita-carswise.ics"; a.click();
    URL.revokeObjectURL(url);
  }

  const byDay  = groupByDay(slots);
  const days   = Object.keys(byDay).sort().slice(0, 14);
  const daySlots = activeDay ? (byDay[activeDay] || []) : [];
  const morning  = daySlots.filter((s) => isMorning(s.starts_at));
  const afternoon = daySlots.filter((s) => !isMorning(s.starts_at));

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.loading}>
      <span style={S.spinner} />
      Cargando disponibilidad…
    </div>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done" && booking) return (
    <div style={S.doneWrap}>
      <div style={S.doneIcon}>✅</div>
      <div style={S.doneTitle}>¡Visita confirmada!</div>
      <div style={S.doneCard}>
        <div style={S.doneDate}>{fmtDayLong(booking.starts_at.slice(0, 10))}</div>
        <div style={S.doneTime}>{fmtTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</div>
      </div>
      <p style={S.doneHint}>Recibirás un email de confirmación con todos los detalles y un archivo para tu calendario.</p>
      <button onClick={downloadIcs} style={S.icsBtn}>
        ⬇ Añadir al calendario (.ics)
      </button>
    </div>
  );

  // ── Confirm ───────────────────────────────────────────────────────────────
  if (step === "confirm" && selected) return (
    <div style={S.confirmWrap}>
      <button onClick={() => { setStep("pick"); setError(""); }} style={S.backLink}>
        ← Cambiar hora
      </button>

      <div style={S.selectedBadge}>
        <span style={S.selectedIcon}>📅</span>
        <div>
          <div style={S.selectedDate}>{fmtDayLong(selected.starts_at.slice(0, 10))}</div>
          <div style={S.selectedTime}>{fmtTime(selected.starts_at)} – {fmtTime(selected.ends_at)}</div>
        </div>
      </div>

      {error && <div style={S.errMsg}>{error}</div>}

      <div style={S.field}>
        <label style={S.label}>Tu nombre <span style={{ color: "#ef4444" }}>*</span></label>
        <input
          style={S.input}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ana García"
          autoFocus
        />
      </div>
      <div style={S.field}>
        <label style={S.label}>Teléfono de contacto</label>
        <input
          style={S.input}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="600 000 000"
          type="tel"
        />
      </div>
      <div style={S.field}>
        <label style={S.label}>Notas para el vendedor (opcional)</label>
        <textarea
          style={{ ...S.input, height: 64, resize: "vertical", paddingTop: 10 }}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="¿Algún detalle que quieras comentar?"
        />
      </div>

      <button
        style={{ ...S.confirmBtn, opacity: submitting || !form.name.trim() ? 0.55 : 1 }}
        disabled={submitting || !form.name.trim()}
        onClick={confirmBooking}
      >
        {submitting ? "Reservando…" : "Confirmar visita →"}
      </button>
    </div>
  );

  // ── Pick ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      <div style={S.pickerTitle}>Elige fecha y hora</div>

      {slots.length === 0 ? (
        <div style={S.noSlots}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
          No hay horarios disponibles en este momento.
        </div>
      ) : (
        <>
          {/* Day tabs */}
          <div style={S.dayTabsWrap}>
            <div style={S.dayTabs}>
              {days.map((day) => {
                const { weekday, day: d, month } = fmtDayShort(day);
                const isActive = activeDay === day;
                const today = isToday(day);
                return (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day)}
                    style={{
                      ...S.dayTab,
                      ...(isActive ? S.dayTabActive : {}),
                      ...(today && !isActive ? { borderColor: "#0ea5e9", color: "#0ea5e9" } : {}),
                    }}
                  >
                    <span style={S.dayTabWeekday}>{today ? "Hoy" : weekday}</span>
                    <span style={S.dayTabNum}>{d}</span>
                    <span style={S.dayTabMonth}>{month}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot grid */}
          <div style={S.slotSection}>
            {morning.length > 0 && (
              <>
                <div style={S.periodLabel}>Mañana</div>
                <div style={S.slotGrid}>
                  {morning.map((s) => (
                    <SlotButton key={s.id} slot={s} selected={selected} onSelect={() => { setSelected(s); setStep("confirm"); setError(""); }} />
                  ))}
                </div>
              </>
            )}
            {afternoon.length > 0 && (
              <>
                <div style={{ ...S.periodLabel, marginTop: morning.length ? 16 : 0 }}>Tarde</div>
                <div style={S.slotGrid}>
                  {afternoon.map((s) => (
                    <SlotButton key={s.id} slot={s} selected={selected} onSelect={() => { setSelected(s); setStep("confirm"); setError(""); }} />
                  ))}
                </div>
              </>
            )}
            {morning.length === 0 && afternoon.length === 0 && (
              <div style={S.noSlots}>No hay horarios disponibles este día.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SlotButton({ slot, selected, onSelect }) {
  const isActive = selected?.id === slot.id;
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...S.slotBtn,
        ...(isActive || hover ? S.slotBtnActive : {}),
      }}
    >
      {new Date(slot.starts_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  loading:       { display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 14, padding: "24px 0" },
  spinner:       { width: 16, height: 16, border: "2px solid #e2e8f0", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 },

  wrap:          { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  pickerTitle:   { fontSize: 15, fontWeight: 700, color: "#1C2B33", marginBottom: 14 },
  noSlots:       { color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "20px 0", lineHeight: 1.6 },

  dayTabsWrap:   { overflowX: "auto", marginBottom: 18, paddingBottom: 4, WebkitOverflowScrolling: "touch" },
  dayTabs:       { display: "flex", gap: 8, minWidth: "max-content" },
  dayTab:        { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 56, transition: "all .15s", color: "#475569" },
  dayTabActive:  { background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff" },
  dayTabWeekday: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", opacity: 0.7 },
  dayTabNum:     { fontSize: 18, fontWeight: 800, lineHeight: 1 },
  dayTabMonth:   { fontSize: 10, opacity: 0.65 },

  slotSection:   { },
  periodLabel:   { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 },
  slotGrid:      { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 },
  slotBtn:       { background: "#f0f9ff", border: "1.5px solid #bae6fd", color: "#0369a1", borderRadius: 8, padding: "9px 6px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .12s", textAlign: "center" },
  slotBtnActive: { background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff", transform: "scale(1.04)" },

  // Confirm step
  confirmWrap:   { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  backLink:      { background: "none", border: "none", color: "#0ea5e9", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 },
  selectedBadge: { display: "flex", alignItems: "center", gap: 12, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: "14px 16px", marginBottom: 20 },
  selectedIcon:  { fontSize: 22, flexShrink: 0 },
  selectedDate:  { fontSize: 14, fontWeight: 700, color: "#166534" },
  selectedTime:  { fontSize: 13, color: "#15803d", marginTop: 2 },
  field:         { marginBottom: 14 },
  label:         { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".3px" },
  input:         { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 13px", fontSize: 14, color: "#1C2B33", boxSizing: "border-box", outline: "none", fontFamily: "inherit", transition: "border-color .15s" },
  confirmBtn:    { width: "100%", background: "linear-gradient(135deg, #0ea5e9, #0284c7)", border: "none", color: "#fff", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 4, letterSpacing: ".2px", transition: "all .15s" },
  errMsg:        { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 },

  // Done step
  doneWrap:      { textAlign: "center", padding: "12px 0", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  doneIcon:      { fontSize: 44, marginBottom: 10 },
  doneTitle:     { fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 12 },
  doneCard:      { background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: "16px 20px", marginBottom: 14, display: "inline-block", minWidth: 220 },
  doneDate:      { fontSize: 15, fontWeight: 700, color: "#166534", marginBottom: 4 },
  doneTime:      { fontSize: 20, fontWeight: 800, color: "#0f172a" },
  doneHint:      { fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 16 },
  icsBtn:        { background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#475569", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
};
