export default function UserDashboardVehicles({
  userVehicleSections,
  dashboardVehicleCount,
  panelStyle,
  getOfferBadgeStyle,
}) {
  return (
    <section id="user-dashboard-vehicles" style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#34d399", letterSpacing: "0.6px" }}>MIS VEHÍCULOS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Seguimiento de tu actividad</div>
        </div>
        <span style={{ ...getOfferBadgeStyle("green"), fontSize: 11 }}>
          {dashboardVehicleCount} registros
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {userVehicleSections.map((section) => (
          <div
            key={section.key}
            style={{
              background: "rgba(15,23,42,0.34)",
              border: "1px solid rgba(148,163,184,0.14)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{section.title}</div>
              <span style={{ fontSize: 11, color: "#93c5fd" }}>{section.items.length}</span>
            </div>
            {section.items.length > 0 ? (
              section.items.map((vehicle, index) => (
                <div key={`${section.key}-${index}`} style={{ fontSize: 12, color: "#cbd5e1", marginTop: 8 }}>
                  <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{vehicle.title}</div>
                  <div style={{ marginTop: 2 }}>{vehicle.meta}</div>
                  <div style={{ marginTop: 2, color: "#6ee7b7" }}>{vehicle.status}</div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{section.empty}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
