import { useEffect, useState } from "react";

const API = "/api/visit-availability";

function groupByDay(slots) {
  const map = {};
  slots.forEach((s) => {
    const day = s.starts_at.slice(0, 10); // "2026-07-05"
    if (!map[day]) map[day] = [];
    map[day].push(s);
  });
  return map;
}

function fmtDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function SlotPicker({ offerId, vehicleTitle, sellerEmail, userEmail, userName, userPhone, source, onBooked }) {
  const [slots, setSlots]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState(null); // slot object
  const [step, setStep]           = useState("pick"); // pick | confirm | done
  const [form, setForm]           = useState({ name: userName || "", phone: userPhone || "", notes: "" });
  const [booking, setBooking]     = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!offerId) return;
    setLoading(true);
    fetch(`${API}?offerId=${encodeURIComponent(offerId)}`)
      .then((r) => r.json())
      .then((d) => { setSlots(d.slots || []); setLoading(false); })
      .catch(() => { setError("No se pudieron cargar los horarios"); setLoading(false); });
  }, [offerId]);

  async function confirmBooking() {
    if (!selected || !userEmail) return;
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: "book",
          slotId: selected.id,
          offerId,
          vehicleTitle,
          buyerEmail: userEmail,
          buyerName: form.name,
          buyerPhone: form.phone,
          sellerEmail: sellerEmail || null,
          notes: form.notes,
          source: source || "marketplace",
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Error al reservar");
        if (d.error?.includes("disponible")) {
          setSlots((prev) => prev.filter((s) => s.id !== selected.id));
          setSelected(null);
          setStep("pick");
        }
      } else {
        setBooking(d.booking);
        setStep("done");
        if (onBooked) onBooked(d.booking);
      }
    } catch {
      setError("Error de conexión");
    }
    setSubmitting(false);
  }

  const byDay = groupByDay(slots);
  const days  = Object.keys(byDay).sort().slice(0, 14);

  if (loading) return <div style={styles.center}>Cargando disponibilidad…</div>;

  // ── STEP: DONE ───────────────────────────────────────────────────────────
  if (step === "done" && booking) {
    return (
      <div style={styles.doneBox}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <div style={styles.doneTitle}>¡Visita confirmada!</div>
        <div style={styles.doneDetail}>
          <strong>{fmtDay(booking.starts_at.slice(0, 10))}</strong>
          {" a las "}
          <strong>{fmtTime(booking.starts_at)}</strong>
        </div>
        <div style={styles.doneHint}>Recibirás un email de confirmación con todos los detalles.</div>
      </div>
    );
  }

  // ── STEP: CONFIRM ────────────────────────────────────────────────────────
  if (step === "confirm" && selected) {
    return (
      <div style={styles.confirmBox}>
        <div style={styles.confirmHeader}>Confirmar visita</div>
        <div style={styles.selectedSlot}>
          📅 {fmtDay(selected.starts_at.slice(0, 10))} · {fmtTime(selected.starts_at)} – {fmtTime(selected.ends_at)}
        </div>
        {error && <div style={styles.errorMsg}>{error}</div>}
        <div style={styles.field}>
          <label style={styles.label}>Tu nombre</label>
          <input
            style={styles.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ana García"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Teléfono de contacto</label>
          <input
            style={styles.input}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="600 000 000"
            type="tel"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Notas (opcional)</label>
          <textarea
            style={{ ...styles.input, height: 60, resize: "vertical" }}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="¿Algún detalle que quieras comentar?"
          />
        </div>
        <div style={styles.confirmActions}>
          <button style={styles.backBtn} onClick={() => { setStep("pick"); setError(""); }}>
            ← Cambiar hora
          </button>
          <button
            style={{ ...styles.confirmBtn, opacity: submitting ? 0.6 : 1 }}
            disabled={submitting || !form.name.trim()}
            onClick={confirmBooking}
          >
            {submitting ? "Reservando…" : "Confirmar visita"}
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: PICK ───────────────────────────────────────────────────────────
  return (
    <div style={styles.pickerWrap}>
      <div style={styles.pickerTitle}>Elige fecha y hora para la visita</div>
      {slots.length === 0 ? (
        <div style={styles.noSlots}>El vendedor no tiene horarios disponibles en este momento. Inténtalo más tarde.</div>
      ) : (
        <div style={styles.scroll}>
          {days.map((day) => (
            <div key={day} style={styles.dayCol}>
              <div style={styles.dayLabel}>{fmtDay(day)}</div>
              <div style={styles.slotList}>
                {byDay[day].map((s) => (
                  <button
                    key={s.id}
                    style={{
                      ...styles.slotBtn,
                      ...(selected?.id === s.id ? styles.slotBtnActive : {}),
                    }}
                    onClick={() => { setSelected(s); setStep("confirm"); setError(""); }}
                  >
                    {fmtTime(s.starts_at)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  center:       { textAlign: "center", color: "#64748b", padding: "24px 0" },
  pickerWrap:   { padding: "4px 0" },
  pickerTitle:  { fontSize: 15, fontWeight: 600, color: "#1C2B33", marginBottom: 14 },
  noSlots:      { color: "#94a3b8", fontSize: 13, padding: "12px 0" },
  scroll:       { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 },
  dayCol:       { minWidth: 80, flexShrink: 0 },
  dayLabel:     { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, whiteSpace: "nowrap" },
  slotList:     { display: "flex", flexDirection: "column", gap: 6 },
  slotBtn:      { background: "#f0f9ff", border: "1.5px solid #bae6fd", color: "#0369a1", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s" },
  slotBtnActive:{ background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff" },
  confirmBox:   { padding: "4px 0" },
  confirmHeader:{ fontSize: 16, fontWeight: 700, color: "#1C2B33", marginBottom: 12 },
  selectedSlot: { background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#166534", marginBottom: 16 },
  field:        { marginBottom: 12 },
  label:        { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 },
  input:        { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "#1C2B33", boxSizing: "border-box", outline: "none" },
  confirmActions:{ display: "flex", gap: 10, marginTop: 16 },
  backBtn:      { background: "none", border: "1.5px solid #e2e8f0", color: "#64748b", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  confirmBtn:   { flex: 1, background: "#0ea5e9", border: "none", color: "#fff", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  errorMsg:     { color: "#dc2626", fontSize: 13, marginBottom: 10 },
  doneBox:      { textAlign: "center", padding: "24px 0" },
  doneTitle:    { fontSize: 18, fontWeight: 700, color: "#166534", marginBottom: 8 },
  doneDetail:   { fontSize: 15, color: "#1C2B33", marginBottom: 6 },
  doneHint:     { fontSize: 13, color: "#64748b" },
};
