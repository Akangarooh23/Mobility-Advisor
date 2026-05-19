import React, { useEffect, useState } from "react";

function StatusBanner({ status }) {
  if (status === "pending_buyer") {
    return (
      <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
        <strong>✅ Fechas enviadas al comprador</strong>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#166534" }}>El comprador recibirá un email para elegir la fecha que más le convenga.</p>
      </div>
    );
  }
  if (status === "confirmed") {
    return (
      <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
        <strong>✅ Cita ya confirmada</strong>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#166534" }}>El comprador ya eligió una fecha. Ambos recibiréis la confirmación por email.</p>
      </div>
    );
  }
  return null;
}

export default function ViewingProposePage() {
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token") || "";

  useEffect(() => {
    if (!token) { setError("Token inválido o caducado."); setLoading(false); return; }
    fetch(`/api/viewing-get?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok || data.role !== "seller") {
          setError(data.error || "Enlace inválido.");
        } else {
          setAppointment(data.appointment);
        }
      })
      .catch(() => setError("Error al cargar la solicitud."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    const validSlots = slots.filter(s => s.trim());
    if (validSlots.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/viewing-propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slots: validSlots }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        setAppointment(a => ({ ...a, status: "pending_buyer" }));
      } else {
        setError(data.error || "Error al enviar las fechas.");
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

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>🚗</span>
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>CarsWise · Solicitud de visita</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>{appointment.vehicle_title}</div>
          </div>
        </div>

        <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14 }}>
          <div><strong>Interesado:</strong> {appointment.buyer_name || "—"}</div>
          {appointment.buyer_message && (
            <div style={{ marginTop: 6, color: "#475569", fontStyle: "italic" }}>"{appointment.buyer_message}"</div>
          )}
        </div>

        <StatusBanner status={appointment.status} />

        {appointment.status === "pending_seller" && !done && (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 15, color: "#334155", marginBottom: 16 }}>
              Propón hasta <strong>3 franjas horarias</strong> para que el comprador elija la que mejor le venga:
            </p>
            {slots.map((slot, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>
                  Opción {i + 1}{i === 0 ? " *" : ""}
                </label>
                <input
                  type="datetime-local"
                  value={slot}
                  onChange={e => setSlots(prev => prev.map((s, j) => j === i ? e.target.value : s))}
                  required={i === 0}
                  style={{
                    width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1",
                    borderRadius: 8, fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={submitting || !slots[0]}
              style={{
                width: "100%", background: "#2563eb", color: "white", border: "none",
                borderRadius: 8, padding: "12px 20px", fontSize: 15, fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer", marginTop: 8,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Enviando…" : "Enviar fechas al comprador"}
            </button>
          </form>
        )}

        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 20, textAlign: "center" }}>
          ¿Dudas? Contacta con CarsWise · <a href="mailto:hola@carswiseai.com" style={{ color: "#2563eb" }}>hola@carswiseai.com</a>
        </p>
      </div>
    </div>
  );
}
