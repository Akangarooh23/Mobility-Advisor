export default function RentingOptionsPage({ styles, onSelectAdvisor, onSelectKnownModel, onGoBack }) {
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

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: "#f8fafc", letterSpacing: "-0.9px" }}>
        Renting
      </h2>
      <p style={{ margin: "0 0 22px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Selecciona la opción que mejor describa tu punto de partida.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <button
          type="button"
          onClick={onSelectAdvisor}
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
            minHeight: "clamp(148px, 22vw, 180px)",
            animationDelay: "60ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2 }}>No sé qué modelo</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
            Ayúdanos a conocerte en 3 minutos con nuestro CarAdvisor para encontrar las opciones de renting que más se adapten a ti.
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectKnownModel}
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
            minHeight: "clamp(148px, 22vw, 180px)",
            animationDelay: "150ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2 }}>Tengo claro cuál quiero</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
            Analizamos el mercado en tiempo real para ofrecerte las mejores opciones de renting en base al precio y la fiabilidad del proveedor.
          </div>
        </button>
      </div>
    </div>
  );
}
