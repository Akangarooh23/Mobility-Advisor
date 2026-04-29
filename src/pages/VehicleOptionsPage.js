import { useTranslation } from "react-i18next";

export default function VehicleOptionsPage({ styles, onSelectBuy, onSelectRenting, onSelectGuide, onGoHome }) {
  const { t } = useTranslation();

  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#000000";
  const mutedColor = isDark ? "#cbd5e1" : "#94a3b8";

  return (
    <div
      style={{
        ...styles.center,
        maxWidth: 980,
        textAlign: "left",
        paddingBottom: "clamp(220px, 30vh, 420px)",
      }}
    >
      <button
        type="button"
        onClick={onGoHome}
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
        {t("vehicleOptions.backHome")}
      </button>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: titleColor, letterSpacing: "-0.9px" }}>
        {t("vehicleOptions.title")}
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6 }}>
        {t("vehicleOptions.subtitle")}
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
          onClick={onSelectBuy}
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
            minHeight: "clamp(140px, 24vw, 170px)",
            animationDelay: "40ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.25, color: titleColor }}>{t("vehicleOptions.buyTitle")}</div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("vehicleOptions.buyDesc")}
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectRenting}
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
            minHeight: "clamp(140px, 24vw, 170px)",
            animationDelay: "120ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.25, color: titleColor }}>{t("vehicleOptions.rentingTitle")}</div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("vehicleOptions.rentingDesc")}
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectGuide}
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
            minHeight: "clamp(140px, 24vw, 170px)",
            animationDelay: "200ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.25, color: titleColor }}>{t("vehicleOptions.guideTitle")}</div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("vehicleOptions.guideDesc")}
          </div>
        </button>
      </div>
    </div>
  );
}
