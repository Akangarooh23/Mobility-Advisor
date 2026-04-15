export default function UserDashboardValuations({
  themeMode,
  dashboardValuations,
  panelStyle,
  getOfferBadgeStyle,
}) {
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";

  return (
    <section id="user-dashboard-valuations" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#c084fc", letterSpacing: "0.6px" }}>MIS TASACIONES</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>Valoraciones e informes guardados</div>
        </div>
        <span style={{ ...getOfferBadgeStyle("slate"), fontSize: 11 }}>{dashboardValuations.length} informes</span>
      </div>

      {dashboardValuations.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {dashboardValuations.map((item) => (
            <div
              key={item.id}
              style={{
                background: cardBg,
                border: "1px solid rgba(148,163,184,0.26)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569", marginTop: 3 }}>{item.meta}</div>
              <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 3 }}>{item.status}</div>
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
