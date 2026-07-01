import { useEffect, useState } from "react";

const API = "/api/visit-availability";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Default time options every 30 min from 08:00 to 21:00
const TIME_OPTIONS = [];
for (let h = 8; h <= 21; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AvailabilityEditor({ offerId, source }) {
  const [slots, setSlots]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [adding, setAdding]     = useState(false);
  const [form, setForm]         = useState({ date: todayStr(), timeStart: "10:00", timeEnd: "12:00" });
  const [removing, setRemoving] = useState(null);

  async function loadSlots() {
    if (!offerId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}?offerId=${encodeURIComponent(offerId)}`);
      const d = await r.json();
      setSlots(d.slots || []);
    } catch {
      setError("No se pudo cargar la disponibilidad");
    }
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, [offerId]); // eslint-disable-line

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
      else { setSuccess("Franja añadida"); setSlots((prev) => [...prev, d.slot].sort((a, b) => a.starts_at > b.starts_at ? 1 : -1)); }
    } catch { setError("Error de conexión"); }
    setAdding(false);
  }

  async function removeSlot(slot) {
    if (slot.status === "booked") { setError("Este horario ya tiene una reserva — cancela la cita primero"); return; }
    setRemoving(slot.id);
    try {
      await fetch(`${API}?route=delete_slot&slotId=${slot.id}&offerId=${offerId}`, { method: "DELETE" });
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch { setError("Error al eliminar"); }
    setRemoving(null);
  }

  const available = slots.filter((s) => s.status === "available");
  const booked    = slots.filter((s) => s.status === "booked");

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>Disponibilidad para visitas</div>
      <div style={styles.subtitle}>Añade las franjas horarias en las que puedes enseñar el vehículo</div>

      {/* Add slot form */}
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

      {error   && <div style={styles.errorMsg}>{error}</div>}
      {success && <div style={styles.successMsg}>{success}</div>}

      {loading ? (
        <div style={styles.hint}>Cargando…</div>
      ) : slots.length === 0 ? (
        <div style={styles.hint}>Aún no tienes franjas de disponibilidad añadidas.</div>
      ) : (
        <div style={styles.slotGrid}>
          {/* Available */}
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
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
          {/* Booked */}
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
  wrap:       { border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "18px 20px", background: "#fff", marginBottom: 20 },
  title:      { fontSize: 15, fontWeight: 700, color: "#1C2B33", marginBottom: 4 },
  subtitle:   { fontSize: 13, color: "#64748b", marginBottom: 16 },
  addRow:     { display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 },
  field:      { display: "flex", flexDirection: "column", gap: 4 },
  label:      { fontSize: 11, fontWeight: 600, color: "#64748b" },
  input:      { border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#1C2B33", outline: "none", minWidth: 120 },
  addBtn:     { background: "#1C2B33", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  errorMsg:   { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  successMsg: { color: "#16a34a", fontSize: 13, marginBottom: 8 },
  hint:       { color: "#94a3b8", fontSize: 13, padding: "8px 0" },
  slotGrid:   { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  groupLabel: { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" },
  slotRow:    { display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", borderRadius: 8, padding: "8px 12px" },
  slotIcon:   { fontSize: 12 },
  slotText:   { flex: 1, fontSize: 13, color: "#1C2B33" },
  removeBtn:  { background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: "0 4px", fontWeight: 700 },
  bookedTag:  { fontSize: 11, fontWeight: 600, color: "#0369a1", background: "#e0f2fe", borderRadius: 6, padding: "2px 8px" },
};
