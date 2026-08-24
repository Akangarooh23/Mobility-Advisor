import { useTranslation } from "react-i18next";

export default function PortalVoAuthGatePage({
  themeMode,
  styles,
  onLogin,
  onRegister,
  onGoHome,
  offer,
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();

  const cardBg = isDark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.95)";
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const bodyColor = isDark ? "var(--gris-300)" : "var(--gris-600)";
  const accentColor = isDark ? "#38bdf8" : "#0284c7";
  const mutedColor = isDark ? "var(--gris-400)" : "var(--gris-500)";

  const features = [
    { icon: "🚗", text: t("marketplaceGate.feature1", "Cientos de vehículos de ocasión verificados") },
    { icon: "💰", text: t("marketplaceGate.feature2", "Precios competitivos con valoración de mercado") },
    { icon: "📸", text: t("marketplaceGate.feature3", "Fotos reales y ficha técnica completa") },
    { icon: "📞", text: t("marketplaceGate.feature4", "Contacto directo con el vendedor en 1 clic") },
  ];

  const hasOffer = Boolean(offer?.brand || offer?.title);
  const offerTitle = offer?.title || [offer?.brand, offer?.model].filter(Boolean).join(" ") || "";
  const offerPrice = offer?.price != null ? Number(offer.price).toLocaleString("es-ES") : null;
  const offerImage = offer?.image || offer?.image_url || offer?.imageUrl || "";
  const offerSpecs = [offer?.year, offer?.mileage != null ? `${Number(offer.mileage).toLocaleString("es-ES")} km` : null]
    .filter(Boolean).join(" · ");

  return (
    <div style={{ ...styles.center, paddingTop: 32, paddingBottom: 48 }}>

      {/* ── Teaser del vehículo cuando viene de una ficha concreta ── */}
      {hasOffer && (
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            margin: "0 auto 16px",
            borderRadius: 16,
            overflow: "hidden",
            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(14,165,233,0.18)",
            boxShadow: isDark ? "none" : "0 4px 20px rgba(14,165,233,0.08)",
            position: "relative",
          }}
        >
          {offerImage && (
            <div style={{ width: "100%", height: 180, overflow: "hidden", position: "relative" }}>
              <img
                src={offerImage}
                alt={offerTitle}
                referrerPolicy="no-referrer"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "blur(3px) brightness(0.75)", transform: "scale(1.05)" }}
              />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "0 16px", textAlign: "center",
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)", lineHeight: 1.2 }}>
                  {offerTitle}
                </div>
                {offerSpecs && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{offerSpecs}</div>}
                {offerPrice && <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)", marginTop: 4 }}>{offerPrice} €</div>}
              </div>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
                height: 60,
              }} />
            </div>
          )}
          <div style={{
            background: isDark ? "rgba(15,23,42,0.85)" : "rgba(239,246,255,0.95)",
            padding: "12px 18px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ fontSize: 18 }}>🔒</div>
            <div style={{ fontSize: 13, color: mutedColor, lineHeight: 1.4 }}>
              <strong style={{ color: titleColor }}>Inicia sesión</strong> para ver la ficha completa y contactar al vendedor.
            </div>
          </div>
        </div>
      )}

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
            {hasOffer
              ? "Crea tu cuenta para ver esta oferta"
              : t("marketplaceGate.title", "Encuentra tu próximo coche")}
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
              background: "linear-gradient(135deg, #0ea5e9, var(--marca))",
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
              color: isDark ? "var(--gris-500)" : "var(--gris-400)",
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
