export default function SellOptionsPage({ styles, onSelectCertificate, onSelectReport, onGoBack }) {
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#000000";
  const mutedColor = isDark ? "#cbd5e1" : "#94a3b8";

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

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: titleColor, letterSpacing: "-0.9px" }}>
        Quiero vender mi coche
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6 }}>
        Elige el servicio que mejor se adapte al punto en el que estás.
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
          onClick={onSelectCertificate}
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
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            Certificado B2Cars
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.5 }}>
            Certificamos el estado de tu vehículo de forma oficial y nos encargamos de todas las
            gestiones para la venta. Solo tienes que enseñárselo al comprador.
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectReport}
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
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            Informe B2Cars
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.5 }}>
            Te damos información en tiempo real sobre el precio de venta promedio en España de tu
            coche o similares.
          </div>
        </button>
      </div>
    </div>
  );
}
