import { useEffect, useState } from "react";

const API = "/api/visit-availability";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function MiCitaPage() {
  const params    = new URLSearchParams(window.location.search);
  const bookingId = params.get("id") || "";
  const token     = params.get("token") || "";

  const [booking,   setBooking]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled,  setCancelled]  = useState(false);

  useEffect(() => {
    if (!bookingId || !token) { setError("Enlace inválido."); setLoading(false); return; }
    fetch(`${API}?route=booking_detail&bookingId=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setBooking(d.booking);
        else setError(d.error || "Cita no encontrada");
      })
      .catch(() => setError("Error de conexión"))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  async function cancelBooking() {
    if (!window.confirm("¿Seguro que quieres cancelar esta visita?")) return;
    setCancelling(true);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "cancel", bookingId, token }),
      });
      const d = await r.json();
      if (d.ok) setCancelled(true);
      else setError(d.error || "Error al cancelar");
    } catch { setError("Error de conexión"); }
    setCancelling(false);
  }

  const s = styles;

  if (loading) return (
    <div style={s.page}><div style={s.card}><div style={s.loadingText}>Cargando tu cita…</div></div></div>
  );

  if (error) return (
    <div style={s.page}><div style={s.card}>
      <div style={s.iconBox}>❌</div>
      <div style={s.title}>No encontrada</div>
      <div style={s.sub}>{error}</div>
    </div></div>
  );

  if (cancelled) return (
    <div style={s.page}><div style={s.card}>
      <div style={s.iconBox}>✅</div>
      <div style={s.title}>Cita cancelada</div>
      <div style={s.sub}>Tu visita ha sido cancelada correctamente. La franja horaria ha quedado libre.</div>
      <a href="/" style={s.btnPrimary}>Volver al inicio →</a>
    </div></div>
  );

  const isCancelled = booking.status === "cancelled";

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <span style={s.logo}>Cars<span style={{ color: "#38bdf8" }}>Wise</span></span>
        </div>

        <div style={s.iconBox}>{isCancelled ? "❌" : "📅"}</div>
        <div style={s.title}>{isCancelled ? "Cita cancelada" : "Tu visita"}</div>
        {isCancelled && <div style={s.cancelBadge}>Esta cita fue cancelada</div>}

        {/* Booking card */}
        <div style={s.infoCard}>
          <div style={s.row}>
            <span style={s.label}>Vehículo</span>
            <span style={s.value}>{booking.vehicle_title || booking.offer_id}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>Fecha</span>
            <span style={s.value}>{fmtDate(booking.starts_at)}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>Hora</span>
            <span style={s.value}>{fmtTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</span>
          </div>
          {booking.buyer_name && (
            <div style={s.row}>
              <span style={s.label}>Nombre</span>
              <span style={s.value}>{booking.buyer_name}</span>
            </div>
          )}
          {booking.notes && (
            <div style={s.row}>
              <span style={s.label}>Notas</span>
              <span style={{ ...s.value, fontStyle: "italic", color: "#64748b" }}>{booking.notes}</span>
            </div>
          )}
        </div>

        {!isCancelled && (
          <>
            <p style={s.hint}>¿Necesitas cancelar? Puedes hacerlo hasta 2 horas antes de la visita.</p>
            <button
              onClick={cancelBooking}
              disabled={cancelling}
              style={{ ...s.btnDanger, opacity: cancelling ? 0.6 : 1 }}
            >
              {cancelling ? "Cancelando…" : "Cancelar esta visita"}
            </button>
          </>
        )}

        <a href="/" style={s.btnSecondary}>Volver al marketplace</a>
      </div>
    </div>
  );
}

const styles = {
  page:        { minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  card:        { background: "#fff", borderRadius: 16, boxShadow: "0 4px 32px rgba(0,0,0,.08)", padding: "32px 28px", maxWidth: 440, width: "100%", textAlign: "center" },
  header:      { marginBottom: 24 },
  logo:        { fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-.3px" },
  iconBox:     { fontSize: 40, marginBottom: 12 },
  title:       { fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 6 },
  sub:         { fontSize: 14, color: "#64748b", marginBottom: 24, lineHeight: 1.5 },
  cancelBadge: { display: "inline-block", background: "#fee2e2", color: "#dc2626", fontSize: 12, fontWeight: 700, borderRadius: 6, padding: "4px 10px", marginBottom: 20 },
  infoCard:    { background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "18px 20px", marginBottom: 20, textAlign: "left" },
  row:         { display: "flex", gap: 12, marginBottom: 10, fontSize: 14, alignItems: "flex-start" },
  label:       { fontWeight: 700, color: "#0f172a", minWidth: 72, flexShrink: 0 },
  value:       { color: "#334155", flex: 1 },
  hint:        { fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.5 },
  btnPrimary:  { display: "block", background: "#0ea5e9", color: "#fff", textDecoration: "none", padding: "12px 0", borderRadius: 8, fontWeight: 700, fontSize: 14, marginBottom: 10 },
  btnDanger:   { width: "100%", background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fecaca", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12, transition: "all .15s" },
  btnSecondary:{ display: "block", color: "#64748b", textDecoration: "none", fontSize: 13, marginTop: 4 },
  loadingText: { color: "#64748b", fontSize: 14, padding: "32px 0" },
};
