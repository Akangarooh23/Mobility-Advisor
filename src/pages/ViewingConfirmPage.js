import React, { useEffect, useState } from "react";

function formatSlot(iso) {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
    });
  } catch { return iso; }
}

export default function ViewingConfirmPage() {
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  const token = new URLSearchParams(window.location.search).get("token") || "";

  useEffect(() => {
    if (!token) { setError("Token inválido o caducado."); setLoading(false); return; }
    fetch(`/api/viewing-get?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok || data.role !== "buyer") {
          setError(data.error || "Enlace inválido.");
        } else {
          setAppointment(data.appointment);
          if (data.appointment.status === "confirmed") {
            setConfirmed(data.appointment.confirmed_slot);
          }
        }
      })
      .catch(() => setError("Error al cargar la solicitud."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/viewing-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slot: selected }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfirmed(selected);
      } else {
        setError(data.error || "Error al confirmar la cita.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const containerStyle = {
    minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center",
    justifyContent: "center", padding: "20px", fontFamily: "Arial, sans-serif",
  };
  const cardStyle = {
    background: "white", borderRadius: 16, padding: "32px 36px", maxWidth: 520,
    width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  };

  if (loading) return <div style={containerStyle}><div style={cardStyle}><p>Cargando…</p></div></div>;
  if (error) return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ color: "#dc2626" }}>⚠️ Error</h2>
        <p style={{ color: "#475569" }}>{error}</p>
      </div>
    </div>
  );

  if (confirmed) return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <h2 style={{ color: "#16a34a", margin: "8px 0" }}>Cita confirmada</h2>
          <p style={{ color: "#475569", fontSize: 14 }}>Recibirás un email de confirmación en breve.</p>
        </div>
        <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Vehículo</div>
          <div style={{ fontWeight: 600 }}>{appointment?.vehicle_title}</div>
        </div>
        <div style={{ background: "#dcfce7", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, color: "#166534" }}>Fecha y hora</div>
          <div style={{ fontWeight: 700, color: "#166534", fontSize: 16 }}>📅 {formatSlot(confirmed)}</div>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 20, textAlign: "center" }}>
          ¿Necesitas cambiar la cita? Contacta con CarsWise · <a href="mailto:hola@carswiseai.com" style={{ color: "#2563eb" }}>hola@carswiseai.com</a>
        </p>
      </div>
    </div>
  );

  const slots = Array.isArray(appointment?.proposed_slots) ? appointment.proposed_slots : [];

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>🚗</span>
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>CarsWise · Confirmar visita</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>{appointment.vehicle_title}</div>
          </div>
        </div>

        {appointment.status !== "pending_buyer" ? (
          <div style={{ background: "#fef9c3", borderRadius: 10, padding: "12px 16px", color: "#854d0e" }}>
            Esta solicitud ya no está disponible para confirmar.
          </div>
        ) : slots.length === 0 ? (
          <p style={{ color: "#475569" }}>El vendedor aún no ha propuesto fechas. Te avisaremos por email cuando lo haga.</p>
        ) : (
          <>
            <p style={{ fontSize: 15, color: "#334155", marginBottom: 16 }}>
              El vendedor propone las siguientes fechas. Elige la que más te convenga:
            </p>
            {slots.map((slot, i) => (
              <button
                key={i}
                onClick={() => setSelected(slot)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: selected === slot ? "#dbeafe" : "#f8fafc",
                  border: selected === slot ? "2px solid #2563eb" : "1px solid #e2e8f0",
                  borderRadius: 10, padding: "12px 16px", marginBottom: 10,
                  cursor: "pointer", fontSize: 15, fontWeight: selected === slot ? 600 : 400,
                  color: selected === slot ? "#1d4ed8" : "#334155",
                }}
              >
                📅 {formatSlot(slot)}
              </button>
            ))}
            <button
              onClick={handleConfirm}
              disabled={!selected || submitting}
              style={{
                width: "100%", background: "#16a34a", color: "white", border: "none",
                borderRadius: 8, padding: "12px 20px", fontSize: 15, fontWeight: 600,
                cursor: (!selected || submitting) ? "not-allowed" : "pointer",
                marginTop: 8, opacity: (!selected || submitting) ? 0.6 : 1,
              }}
            >
              {submitting ? "Confirmando…" : "Confirmar esta fecha"}
            </button>
          </>
        )}

        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 20, textAlign: "center" }}>
          ¿Dudas? Contacta con CarsWise · <a href="mailto:hola@carswiseai.com" style={{ color: "#2563eb" }}>hola@carswiseai.com</a>
        </p>
      </div>
    </div>
  );
}
