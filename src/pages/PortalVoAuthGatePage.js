import { useTranslation } from "react-i18next";

export default function PortalVoAuthGatePage({
  themeMode,
  styles,
  onLogin,
  onRegister,
  onGoHome,
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();

  const cardBg = isDark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.95)";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const accentColor = isDark ? "#38bdf8" : "#0284c7";

  const features = [
    { icon: "🚗", text: t("marketplaceGate.feature1", "Cientos de vehículos de ocasión verificados") },
    { icon: "💰", text: t("marketplaceGate.feature2", "Precios competitivos con valoración de mercado") },
    { icon: "📸", text: t("marketplaceGate.feature3", "Fotos reales y ficha técnica completa") },
    { icon: "📞", text: t("marketplaceGate.feature4", "Contacto directo con el vendedor en 1 clic") },
  ];

  return (
    <div style={{ ...styles.center, paddingTop: 32, paddingBottom: 48 }}>
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          margin: "0 auto",
          background: cardBg,
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: isDark
            ? "0 8px 40px rgba(0,0,0,0.5)"
            : "0 8px 40px rgba(14,165,233,0.10)",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(14,165,233,0.15)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "1px",
              color: accentColor,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            {t("marketplaceGate.badge", "Marketplace de Vehículos de Ocasión")}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: titleColor, lineHeight: 1.2, marginBottom: 12 }}>
            {t("marketplaceGate.title", "Encuentra tu próximo coche")}
          </div>
          <div style={{ fontSize: 14, color: bodyColor, lineHeight: 1.6 }}>
            {t("marketplaceGate.subtitle", "Crea tu cuenta gratuita o inicia sesión para ver todas las ofertas del Marketplace VO.")}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(14,165,233,0.05)",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <span style={{ fontSize: 18 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: bodyColor }}>{f.text}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={onRegister}
            style={{
              background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "14px 24px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {t("marketplaceGate.registerCta", "Crear cuenta gratuita")}
          </button>
          <button
            type="button"
            onClick={onLogin}
            style={{
              background: "transparent",
              color: accentColor,
              border: `1.5px solid ${isDark ? "rgba(56,189,248,0.35)" : "rgba(2,132,199,0.3)"}`,
              borderRadius: 12,
              padding: "13px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {t("marketplaceGate.loginCta", "Ya tengo cuenta — Iniciar sesión")}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            style={{
              background: "transparent",
              border: "none",
              color: isDark ? "#64748b" : "#94a3b8",
              fontSize: 12,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            {t("marketplaceGate.backHome", "Volver al inicio")}
          </button>
        </div>
      </div>
    </div>
  );
}
