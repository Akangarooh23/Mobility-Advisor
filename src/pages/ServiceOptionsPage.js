export default function ServiceOptionsPage({
  styles,
  onSelectInsurance,
  onSelectMaintenance,
  onSelectAutogestor,
  onGoBack,
}) {
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#000000";
  const mutedColor = isDark ? "#cbd5e1" : "#94a3b8";

  const serviceCards = [
    {
      id: "autogestor",
      badge: "A - AUTOGESTOR",
      title: "ID digital de tu vehiculo",
      description:
        "Toda la informacion de tu coche desde una unica plataforma: documentacion, poliza, facturas de mantenimientos y garantias. No vuelvas a perder un papel.",
      onClick: onSelectAutogestor,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      ),
    },
    {
      id: "mantenimientos",
      badge: "B - MANTENIMIENTOS",
      title: "Recordatorio inteligente",
      description:
        "Cruzamos los datos de tu vehiculo con el plan de mantenimientos definido por la marca y te avisamos cuando toca. Agenda cita con nuestros proveedores.",
      onClick: onSelectMaintenance,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      id: "cita",
      badge: "C - CITA MANTENIMIENTOS",
      title: "Precios de acuerdo, no de particular",
      description:
        "Aprovecha nuestros acuerdos para conseguir precios mas reducidos y agenda tu proxima revision a traves nuestra.",
      onClick: onSelectMaintenance,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      id: "cuota",
      badge: "D - CUOTA MENSUAL",
      title: "Tu mantenimiento en una cuota fija",
      description:
        "Quieres pagar una cuota mensual por el mantenimiento preventivo de tu coche y no llevarte mas sustos antes de vacaciones? Con nosotros es posible.",
      onClick: onSelectMaintenance,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      ),
    },
    {
      id: "insurance",
      badge: "E - SEGURO - AINSURANCE",
      title: "Entiende de verdad tu poliza",
      description:
        "Sube tu poliza y nuestra IA lee las condiciones. Te resumimos ventajas, puntos debiles y te ayudamos a buscar opciones mas completas o economicas en la renovacion.",
      onClick: onSelectInsurance,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 12l2 2 4-4" />
          <path d="M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ ...styles.center, maxWidth: 1240, textAlign: "left" }}>
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
        Quiero contratar un Servicio
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6 }}>
        Selecciona el servicio que quieras activar para tu vehículo.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        {serviceCards.map((card, idx) => (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className="ma-card-interactive ma-fade-stagger"
            style={{
              border: isDark ? "1px solid rgba(148,163,184,0.28)" : "1px solid rgba(148,163,184,0.3)",
              background: isDark ? "rgba(15,23,42,0.52)" : "#ffffff",
              borderRadius: 14,
              boxShadow: isDark ? "none" : "0 8px 24px rgba(15,23,42,0.08)",
              padding: "18px 18px 16px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              gap: 10,
              minHeight: "clamp(190px, 24vw, 240px)",
              animationDelay: `${60 + idx * 70}ms`,
              cursor: "pointer",
              color: titleColor,
              gridColumn: idx < 3 ? "span 2" : "span 3",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "1px solid rgba(37,99,235,0.3)",
                background: "rgba(37,99,235,0.08)",
                color: "#2563eb",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {card.icon}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 10px",
                borderRadius: 999,
                background: "rgba(37,99,235,0.1)",
                color: "#1d4ed8",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {card.badge}
            </div>
            <div style={{ fontWeight: 800, fontSize: "clamp(20px,2.4vw,33px)", lineHeight: 1.2, color: titleColor }}>
              {card.title}
            </div>
            <div style={{ fontSize: 16, color: mutedColor, lineHeight: 1.55 }}>
              {card.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
