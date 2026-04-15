export default function ServiceOptionsPage({
  styles,
  onSelectInsurance,
  onSelectMaintenance,
  onSelectAutogestor,
  onGoBack,
}) {
  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <button
        type="button"
        onClick={onGoBack}
        style={{
          border: "1px solid rgba(148,163,184,0.35)",
          background: "rgba(15,23,42,0.5)",
          color: "#cbd5e1",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        ← Volver
      </button>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: "#000000", letterSpacing: "-0.9px" }}>
        Quiero contratar un Servicio
      </h2>
      <p style={{ margin: "0 0 22px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Selecciona el servicio que quieras activar para tu vehículo.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <button
          type="button"
          onClick={onSelectInsurance}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 18,
            border: "1px solid rgba(37,99,235,0.32)",
            background: "rgba(37,99,235,0.12)",
            color: "#f1f5f9",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 8,
            minHeight: "clamp(170px, 24vw, 210px)",
            animationDelay: "60ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: "#000000" }}>Seguro</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
            Negociamos las condiciones para muchos particulares como uno solo, de forma que conseguimos
            mejores precios.
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectMaintenance}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 18,
            border: "1px solid rgba(14,165,233,0.34)",
            background: "rgba(14,165,233,0.12)",
            color: "#f1f5f9",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 8,
            minHeight: "clamp(170px, 24vw, 210px)",
            animationDelay: "150ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: "#000000" }}>Mantenimiento</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
            Paga una cuota mensual por el mantenimiento de tu coche actual y dejate de sustos y gastos
            inesperados.
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectAutogestor}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 18,
            border: "1px solid rgba(16,185,129,0.34)",
            background: "rgba(16,185,129,0.12)",
            color: "#f1f5f9",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 8,
            minHeight: "clamp(170px, 24vw, 210px)",
            animationDelay: "240ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: "#000000" }}>AutoGestor</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
            Utiliza nuestra IA de gestion integral para monitorizar y archivar todo lo relacionado con
            tu vehículo.
          </div>
        </button>
      </div>
    </div>
  );
}
