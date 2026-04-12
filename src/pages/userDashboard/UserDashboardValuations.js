export default function UserDashboardValuations({
  dashboardValuations,
  panelStyle,
  getOfferBadgeStyle,
}) {
  return (
    <section id="user-dashboard-valuations" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#c084fc", letterSpacing: "0.6px" }}>MIS TASACIONES</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Valoraciones e informes guardados</div>
        </div>
        <span style={{ ...getOfferBadgeStyle("slate"), fontSize: 11 }}>{dashboardValuations.length} informes</span>
      </div>

      {dashboardValuations.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {dashboardValuations.map((item) => (
            <div
              key={item.id}
              style={{
                background: "rgba(15,23,42,0.34)",
                border: "1px solid rgba(148,163,184,0.14)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{item.meta}</div>
              <div style={{ fontSize: 11, color: "#c084fc", marginTop: 3 }}>{item.status}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Cuando hagas una tasación de tu coche, la verás aquí guardada.
        </div>
      )}
    </section>
  );
}
