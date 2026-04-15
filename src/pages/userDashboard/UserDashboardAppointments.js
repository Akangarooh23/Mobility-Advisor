export default function UserDashboardAppointments({
  dashboardAppointments,
  panelStyle,
  getOfferBadgeStyle,
  onRequestAppointment,
}) {
  const appointmentActions = [
    { key: "workshop", label: "🛠️ Taller" },
    { key: "maintenance", label: "🔧 Mantenimiento" },
    { key: "certification", label: "✅ Garantía / calidad" },
  ];

  return (
    <section id="user-dashboard-appointments" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#fbbf24", letterSpacing: "0.6px" }}>CITAS Y GESTIONES</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Tu agenda de taller y mantenimiento</div>
        </div>
        <span style={{ ...getOfferBadgeStyle("amber"), fontSize: 11 }}>{dashboardAppointments.length} activas</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {appointmentActions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onRequestAppointment(option.key)}
            style={{
              background: "rgba(245,158,11,0.18)",
              border: "1px solid rgba(251,191,36,0.22)",
              color: "#92400e",
              padding: "7px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {dashboardAppointments.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {dashboardAppointments.map((item) => (
            <div
              key={item.id}
              style={{
                background: "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))",
                border: "1px solid rgba(148,163,184,0.26)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{item.meta}</div>
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 3 }}>
                {item.status}
                {item.requestedAt ? ` · ${item.requestedAt}` : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Aún no tienes citas programadas. Cuando reserves una, se verá aquí.
        </div>
      )}
    </section>
  );
}
