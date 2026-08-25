import { useTranslation } from "react-i18next";

export default function ServiceOptionsPage({
  styles,
  onSelectInsurance,
  onSelectMaintenance,
  onSelectAppointment,
  onSelectAutogestor,
  onGoBack,
}) {
  const { t, i18n } = useTranslation();
  const uiLanguage = i18n.language === "en" ? "en" : "es";
  const isDark = styles?.page?.color === "var(--gris-200)";
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const mutedColor = isDark ? "var(--gris-300)" : "var(--gris-400)";

  const serviceCards = [
    {
      id: "autogestor",
      title: t("service.autogestorTitle"),
      description: t("service.autogestorDescription"),
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
      title: t("service.maintenanceTitle"),
      description: t("service.maintenanceDescription"),
      onClick: onSelectMaintenance,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      id: "cita",
      title: t("service.appointmentTitle"),
      description: t("service.appointmentDescription"),
      onClick: onSelectAppointment,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      id: "insurance",
      title: t("service.insuranceTitle"),
      description: t("service.insuranceDescription"),
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
          border: "1px solid rgba(150,150,143,0.35)",
          background: "rgba(17,17,17,0.5)",
          color: "var(--gris-300)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        {t("common.backArrow")}
      </button>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: titleColor, letterSpacing: "-0.9px" }}>
        {t("service.title")}
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6 }}>
        {t("service.subtitle")}
      </p>

      {/* ── Hero: IDCar ── */}
      <button
        type="button"
        onClick={serviceCards[0].onClick}
        className="ma-card-interactive ma-fade-stagger"
        style={{
          width: "100%",
          border: "1.5px solid rgba(255,196,0,0.35)",
          background: isDark
            ? "linear-gradient(135deg, rgba(255,196,0,0.18), rgba(255,196,0,0.12))"
            : "linear-gradient(135deg, var(--acento-tenue) 0%, var(--gris-100) 100%)",
          borderRadius: 16,
          boxShadow: isDark ? "none" : "0 12px 32px rgba(255,196,0,0.10)",
          padding: "28px 32px",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 28,
          flexWrap: "wrap",
          cursor: "pointer",
          color: titleColor,
          animationDelay: "60ms",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            border: "1.5px solid rgba(255,196,0,0.35)",
            background: "rgba(255,196,0,0.12)",
            color: "var(--marca)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* Mismo distintivo que en Comprar: dice de que servicio es la
              tarjeta antes de que el titulo diga que se hace. */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "var(--acento-tenue)",
              color: "var(--acento-texto)",
              border: "1px solid rgba(255,196,0,0.45)",
              borderRadius: 999,
              padding: "5px 12px 5px 9px",
              fontSize: 11.5,
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: 10,
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4.5" width="18" height="15" rx="2.4" />
              <path d="M3 9.5h18" /><path d="M7 14h4" />
            </svg>
            {t("service.autogestorTag")}
          </span>
          <div style={{ fontWeight: 800, fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.15, color: titleColor, marginBottom: 6 }}>
            {serviceCards[0].title}
          </div>
          <div style={{ fontSize: 14, color: mutedColor, lineHeight: 1.55 }}>
            {serviceCards[0].description}
          </div>
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, var(--marca), var(--marca-claro))",
            color: "#fff",
            borderRadius: 12,
            padding: "12px 22px",
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {uiLanguage === "en" ? "Create my IDCar →" : "Crear mi IDCar →"}
        </div>
      </button>

      {/* ── Resto de servicios ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {serviceCards.slice(1).map((card, idx) => (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className="ma-card-interactive ma-fade-stagger"
            style={{
              border: isDark ? "1px solid rgba(150,150,143,0.28)" : "1px solid rgba(150,150,143,0.3)",
              background: isDark ? "rgba(17,17,17,0.52)" : "var(--blanco)",
              borderRadius: 14,
              boxShadow: isDark ? "none" : "0 8px 24px rgba(17,17,17,0.06)",
              padding: "18px 18px 16px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              gap: 10,
              minHeight: 180,
              animationDelay: `${130 + idx * 70}ms`,
              cursor: "pointer",
              color: titleColor,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "1px solid rgba(255,196,0,0.3)",
                background: "rgba(255,196,0,0.08)",
                color: "var(--marca)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {card.icon}
            </div>
            <div style={{ fontWeight: 800, fontSize: "clamp(16px,2vw,22px)", lineHeight: 1.2, color: titleColor }}>
              {card.title}
            </div>
            <div style={{ fontSize: 13, color: mutedColor, lineHeight: 1.5 }}>
              {card.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
