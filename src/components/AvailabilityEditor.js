import { useEffect, useState, useMemo } from "react";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

const TIME_OPTIONS = [];
for (let h = 8; h <= 21; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// JS getDay(): 0=Dom,1=Lun,2=Mar,3=Mié,4=Jue,5=Vie,6=Sáb
const DAY_LABELS = [
  { label: "L", jsDay: 1 },
  { label: "M", jsDay: 2 },
  { label: "X", jsDay: 3 },
  { label: "J", jsDay: 4 },
  { label: "V", jsDay: 5 },
  { label: "S", jsDay: 6 },
  { label: "D", jsDay: 0 },
];

const PERIOD_OPTIONS = [
  { value: "4w",        label: "Próximas 4 semanas" },
  { value: "8w",        label: "Próximas 8 semanas" },
  { value: "thismonth", label: "Este mes" },
  { value: "nextmonth", label: "Mes siguiente" },
];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getPeriodRange(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = new Date(today);
  let end;

  if (period === "4w")  { end = addDays(today, 27); }
  else if (period === "8w") { end = addDays(today, 55); }
  else if (period === "thismonth") {
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (period === "nextmonth") {
    start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    end   = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  }
  return { start, end };
}

function generateSlots(selectedDays, timeStart, timeEnd, period) {
  if (!selectedDays.length || !timeStart || !timeEnd || timeEnd <= timeStart) return [];
  const { start, end } = getPeriodRange(period);
  const slots = [];
  let d = new Date(start);
  while (d <= end) {
    if (selectedDays.includes(d.getDay())) {
      // Parse as LOCAL time (browser timezone) then convert to UTC for storage
      const s = new Date(`${dateStr(d)}T${timeStart}:00`);
      const e = new Date(`${dateStr(d)}T${timeEnd}:00`);
      slots.push({ startsAt: s.toISOString(), endsAt: e.toISOString() });
    }
    d = addDays(d, 1);
  }
  return slots;
}

export default function AvailabilityEditor({ offerId, source, onSlotsChange, apiBase }) {
  const API = apiBase || "/api/visit-availability";

  const [slots, setSlots]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [removing, setRemoving] = useState(null);

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState("specific"); // "specific" | "recurring"

  // ── Specific mode ──────────────────────────────────────────────────────────
  const [adding, setAdding] = useState(false);
  const [form, setForm]     = useState({ date: todayStr(), timeStart: "10:00", timeEnd: "12:00" });

  // ── Recurring mode ─────────────────────────────────────────────────────────
  const [recDays,      setRecDays]      = useState([1, 2, 3, 4, 5]); // L-V default
  const [recTimeStart, setRecTimeStart] = useState("10:00");
  const [recTimeEnd,   setRecTimeEnd]   = useState("14:00");
  const [recPeriod,    setRecPeriod]    = useState("4w");
  const [applying,     setApplying]     = useState(false);

  const previewSlots = useMemo(
    () => generateSlots(recDays, recTimeStart, recTimeEnd, recPeriod),
    [recDays, recTimeStart, recTimeEnd, recPeriod]
  );

  async function loadSlots() {
    if (!offerId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}?offerId=${encodeURIComponent(offerId)}`);
      const d = await r.json();
      setSlots(d.slots || []);
      if (onSlotsChange) onSlotsChange(d.slots || []);
    } catch {
      setError("No se pudo cargar la disponibilidad");
    }
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, [offerId]); // eslint-disable-line

  // ── Specific: add single slot ──────────────────────────────────────────────
  async function addSlot() {
    setError(""); setSuccess("");
    const { date, timeStart, timeEnd } = form;
    if (!date || !timeStart || !timeEnd) return;
    if (timeEnd <= timeStart) { setError("La hora de fin debe ser posterior a la de inicio"); return; }
    const startsAt = new Date(`${date}T${timeStart}:00`).toISOString();
    const endsAt   = new Date(`${date}T${timeEnd}:00`).toISOString();
    setAdding(true);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "add_slot", offerId, startsAt, endsAt, source: source || "marketplace" }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "Error al añadir"); }
      else {
        setSuccess("Franja añadida");
        const updated = [...slots, d.slot].sort((a, b) => a.starts_at > b.starts_at ? 1 : -1);
        setSlots(updated);
        if (onSlotsChange) onSlotsChange(updated);
      }
    } catch { setError("Error de conexión"); }
    setAdding(false);
  }

  // ── Recurring: apply bulk slots ────────────────────────────────────────────
  async function applyRecurring() {
    setError(""); setSuccess("");
    if (!recDays.length) { setError("Selecciona al menos un día"); return; }
    if (recTimeEnd <= recTimeStart) { setError("La hora de fin debe ser posterior a la de inicio"); return; }
    if (!previewSlots.length) { setError("No hay franjas para el período seleccionado"); return; }
    setApplying(true);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: "add_bulk_slots",
          offerId,
          slots: previewSlots,
          source: source || "marketplace",
        }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "Error al aplicar"); }
      else {
        const skippedMsg = d.skipped > 0 ? ` (${d.skipped} ya existían)` : "";
        setSuccess(`${d.inserted} franjas añadidas${skippedMsg}`);
        // Immediately merge inserted slots into state so parent's onSlotsChange fires at once
        const newSlots = d.slots || [];
        const merged = [...slots, ...newSlots].sort((a, b) => (a.starts_at > b.starts_at ? 1 : -1));
        setSlots(merged);
        if (onSlotsChange) onSlotsChange(merged);
        // Then reload for an accurate picture (handles duplicates etc.)
        await loadSlots();
      }
    } catch { setError("Error de conexión"); }
    setApplying(false);
  }

  async function removeSlot(slot) {
    if (slot.status === "booked") { setError("Este horario ya tiene una reserva — cancela la cita primero"); return; }
    setRemoving(slot.id);
    try {
      await fetch(`${API}?route=delete_slot&slotId=${slot.id}&offerId=${offerId}`, { method: "DELETE" });
      const updated = slots.filter((s) => s.id !== slot.id);
      setSlots(updated);
      if (onSlotsChange) onSlotsChange(updated);
    } catch { setError("Error al eliminar"); }
    setRemoving(null);
  }

  function toggleDay(jsDay) {
    setRecDays((prev) =>
      prev.includes(jsDay) ? prev.filter((d) => d !== jsDay) : [...prev, jsDay]
    );
  }

  function setPreset(preset) {
    if (preset === "lv")  setRecDays([1, 2, 3, 4, 5]);
    if (preset === "fds") setRecDays([6, 0]);
    if (preset === "all") setRecDays([0, 1, 2, 3, 4, 5, 6]);
  }

  const available = slots.filter((s) => s.status === "available");
  const booked    = slots.filter((s) => s.status === "booked");

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>Disponibilidad para visitas</div>
      <div style={styles.subtitle}>Añade los horarios en los que puedes enseñar el vehículo</div>

      {/* Tab switch */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(mode === "specific"  ? styles.tabActive : {}) }}
          onClick={() => { setMode("specific");  setError(""); setSuccess(""); }}
        >
          Fecha concreta
        </button>
        <button
          style={{ ...styles.tab, ...(mode === "recurring" ? styles.tabActive : {}) }}
          onClick={() => { setMode("recurring"); setError(""); setSuccess(""); }}
        >
          Horario recurrente
        </button>
      </div>

      {/* ── Specific mode form ──────────────────────────────────────────────── */}
      {mode === "specific" && (
        <div style={styles.formBlock}>
          <div style={styles.addRow}>
            <div style={styles.field}>
              <label style={styles.label}>Fecha</label>
              <input
                type="date"
                style={styles.input}
                min={todayStr()}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Desde</label>
              <select style={styles.input} value={form.timeStart} onChange={(e) => setForm((f) => ({ ...f, timeStart: e.target.value }))}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Hasta</label>
              <select style={styles.input} value={form.timeEnd} onChange={(e) => setForm((f) => ({ ...f, timeEnd: e.target.value }))}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button
              style={{ ...styles.addBtn, opacity: adding ? 0.6 : 1 }}
              disabled={adding}
              onClick={addSlot}
            >
              {adding ? "Añadiendo…" : "+ Añadir"}
            </button>
          </div>
        </div>
      )}

      {/* ── Recurring mode form ─────────────────────────────────────────────── */}
      {mode === "recurring" && (
        <div style={styles.formBlock}>
          {/* Day toggles */}
          <div style={styles.field}>
            <label style={styles.label}>Días de la semana</label>
            <div style={styles.dayRow}>
              {DAY_LABELS.map(({ label, jsDay }) => (
                <button
                  key={jsDay}
                  style={{
                    ...styles.dayBtn,
                    ...(recDays.includes(jsDay) ? styles.dayBtnOn : {}),
                  }}
                  onClick={() => toggleDay(jsDay)}
                >
                  {label}
                </button>
              ))}
              <span style={styles.presetSep}>|</span>
              <button style={styles.presetBtn} onClick={() => setPreset("lv")}>L–V</button>
              <button style={styles.presetBtn} onClick={() => setPreset("fds")}>Fin de sem.</button>
              <button style={styles.presetBtn} onClick={() => setPreset("all")}>Todos</button>
            </div>
          </div>

          {/* Times + period */}
          <div style={{ ...styles.addRow, marginTop: 12 }}>
            <div style={styles.field}>
              <label style={styles.label}>Desde</label>
              <select style={styles.input} value={recTimeStart} onChange={(e) => setRecTimeStart(e.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Hasta</label>
              <select style={styles.input} value={recTimeEnd} onChange={(e) => setRecTimeEnd(e.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Período</label>
              <select style={styles.input} value={recPeriod} onChange={(e) => setRecPeriod(e.target.value)}>
                {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Preview + apply */}
          <div style={styles.previewRow}>
            <span style={styles.previewText}>
              {previewSlots.length > 0
                ? `→ Se añadirán ${previewSlots.length} franja${previewSlots.length !== 1 ? "s" : ""}`
                : "→ Selecciona días y horas"}
            </span>
            <button
              style={{ ...styles.addBtn, opacity: applying || !previewSlots.length ? 0.6 : 1 }}
              disabled={applying || !previewSlots.length}
              onClick={applyRecurring}
            >
              {applying ? "Aplicando…" : "Aplicar"}
            </button>
          </div>
        </div>
      )}

      {error   && <div style={styles.errorMsg}>{error}</div>}
      {success && <div style={styles.successMsg}>{success}</div>}

      {/* ── Slot list ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={styles.hint}>Cargando…</div>
      ) : slots.length === 0 ? (
        <div style={styles.hint}>Aún no tienes franjas de disponibilidad añadidas.</div>
      ) : (
        <div style={styles.slotGrid}>
          {available.length > 0 && (
            <>
              <div style={styles.groupLabel}>Disponibles ({available.length})</div>
              {available.map((s) => (
                <div key={s.id} style={styles.slotRow}>
                  <span style={styles.slotIcon}>🟢</span>
                  <span style={styles.slotText}>{fmtDate(s.starts_at)} · {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}</span>
                  <button
                    style={{ ...styles.removeBtn, opacity: removing === s.id ? 0.4 : 1 }}
                    disabled={removing === s.id}
                    onClick={() => removeSlot(s)}
                  >✕</button>
                </div>
              ))}
            </>
          )}
          {booked.length > 0 && (
            <>
              <div style={{ ...styles.groupLabel, marginTop: 12 }}>Reservadas ({booked.length})</div>
              {booked.map((s) => (
                <div key={s.id} style={{ ...styles.slotRow, opacity: 0.75 }}>
                  <span style={styles.slotIcon}>🔵</span>
                  <span style={styles.slotText}>{fmtDate(s.starts_at)} · {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}</span>
                  <span style={styles.bookedTag}>Reservada</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap:        { border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "18px 20px", background: "#fff", marginBottom: 20 },
  title:       { fontSize: 15, fontWeight: 700, color: "#1C2B33", marginBottom: 4 },
  subtitle:    { fontSize: 13, color: "#64748b", marginBottom: 12 },
  tabs:        { display: "flex", gap: 0, marginBottom: 16, borderBottom: "1.5px solid #e2e8f0" },
  tab:         { background: "none", border: "none", borderBottom: "2.5px solid transparent", padding: "7px 16px", fontSize: 13, fontWeight: 600, color: "#94a3b8", cursor: "pointer", marginBottom: -1.5 },
  tabActive:   { color: "#1C2B33", borderBottomColor: "#1C2B33" },
  formBlock:   { marginBottom: 12 },
  addRow:      { display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" },
  field:       { display: "flex", flexDirection: "column", gap: 4 },
  label:       { fontSize: 11, fontWeight: 600, color: "#64748b" },
  input:       { border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#1C2B33", outline: "none", minWidth: 120 },
  addBtn:      { background: "#1C2B33", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  dayRow:      { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 },
  dayBtn:      { width: 34, height: 34, border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  dayBtnOn:    { background: "#1C2B33", color: "#fff", borderColor: "#1C2B33" },
  presetSep:   { color: "#e2e8f0", fontSize: 18, margin: "0 2px" },
  presetBtn:   { background: "none", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#64748b", cursor: "pointer", whiteSpace: "nowrap" },
  previewRow:  { display: "flex", alignItems: "center", gap: 12, marginTop: 14 },
  previewText: { fontSize: 13, color: "#64748b", flex: 1 },
  errorMsg:    { color: "#dc2626", fontSize: 13, marginBottom: 8, marginTop: 6 },
  successMsg:  { color: "#16a34a", fontSize: 13, marginBottom: 8, marginTop: 6 },
  hint:        { color: "#94a3b8", fontSize: 13, padding: "8px 0" },
  slotGrid:    { display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 260, overflowY: "auto", paddingRight: 2 },
  groupLabel:  { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" },
  slotRow:     { display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", borderRadius: 8, padding: "8px 12px" },
  slotIcon:    { fontSize: 12 },
  slotText:    { flex: 1, fontSize: 13, color: "#1C2B33" },
  removeBtn:   { background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: "0 4px", fontWeight: 700 },
  bookedTag:   { fontSize: 11, fontWeight: 600, color: "#0369a1", background: "#e0f2fe", borderRadius: 6, padding: "2px 8px" },
};
