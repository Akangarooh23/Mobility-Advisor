import { useTranslation } from "react-i18next";

/**
 * La caja del icono, igual que la de comprar y la de gestionar: cuadrado
 * redondeado, borde y fondo del acento. Aquí faltaba y las dos tarjetas
 * arrancaban directamente con el título.
 */
const CAJA_ICONO = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid rgba(255,196,0,0.3)",
  background: "rgba(255,196,0,0.08)",
  color: "var(--marca)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

/** Un gráfico de barras: el informe es información de mercado, no una tasación. */
const ICONO_INFORME = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 19.5V4" />
    <path d="M4 19.5h16" />
    <path d="M8.5 16.5v-5" />
    <path d="M13 16.5V7.5" />
    <path d="M17.5 16.5v-7" />
  </svg>
);

/** Un apretón de manos, simplificado: la venta la lleva alguien por ti. */
const ICONO_GESTIONADA = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5h3l3.2 3.2a1.6 1.6 0 0 0 2.3 0l.5-.5" />
    <path d="M21 9.5h-3l-2.6-2.6a2 2 0 0 0-1.4-.6h-2.6a2 2 0 0 0-1.4.6L7.5 8.4" />
    <path d="M12 12.2l2.6 2.6M10.4 14.4l2 2M8.8 16.6l1.4 1.4" />
    <path d="M18 9.5v6.2M6 9.5v6.2" />
  </svg>
);

export default function SellOptionsPage({ styles, onSelectCertificate, onSelectReport, onSelectIDCar, onGoBack }) {
  const { t, i18n } = useTranslation();
  const uiLanguage = i18n.language === "en" ? "en" : "es";
  const isDark = styles?.page?.color === "var(--gris-200)";
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const mutedColor = isDark ? "var(--gris-300)" : "var(--gris-600)";
  const cardBackground = isDark ? "rgba(17,17,17,0.55)" : "var(--blanco)";
  const cardBorder = isDark ? "1px solid rgba(150,150,143,0.26)" : "1px solid rgba(17,17,17,0.12)";

  return (
    <div style={{ ...styles.center, maxWidth: 1240, textAlign: "left" }}>
      <button
        type="button"
        onClick={onGoBack}
        style={{
          border: "1px solid rgba(150,150,143,0.35)",
          background: isDark ? "rgba(17,17,17,0.5)" : "rgba(150,150,143,0.16)",
          color: isDark ? "var(--gris-300)" : "var(--gris-600)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        {t("sell.goBack")}
      </button>

      <div style={{ marginBottom: 10, marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", fontWeight: 800, color: "var(--marca)", textTransform: "uppercase" }}>
          {t("sell.badgeLabel")}
        </span>
        <span style={{ width: 34, height: 1, background: "rgba(255,196,0,0.5)" }} />
      </div>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: titleColor, letterSpacing: "-0.9px" }}>
        {t("sell.pageTitle")}
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
        {t("sell.pageSubtitle")}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <article
          className="ma-card-interactive ma-fade-stagger"
          style={{
            position: "relative",
            border: cardBorder,
            borderRadius: 12,
            background: cardBackground,
            boxShadow: isDark ? "none" : "0 8px 22px rgba(17,17,17,0.05)",
            padding: "24px 22px 20px",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 10,
            minHeight: "clamp(148px, 20vw, 178px)",
            animationDelay: "60ms",
            cursor: "pointer",
          }}
          role="button"
          tabIndex={0}
          onClick={onSelectReport}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectReport();
            }
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 22,
              right: 20,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(150,150,143,0.35)",
              color: "var(--gris-500)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            &gt;
          </span>
          <span style={CAJA_ICONO}>{ICONO_INFORME}</span>
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            {t("sell.optionATitle")}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("sell.optionADesc")}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectReport();
            }}
            style={{
              marginTop: 2,
              border: "1px solid rgba(255,196,0,0.28)",
              background: "rgba(255,196,0,0.08)",
              color: "var(--marca-oscuro)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("sell.accessButton")}
          </button>
        </article>

        <article
          className="ma-card-interactive ma-fade-stagger"
          style={{
            position: "relative",
            border: cardBorder,
            borderRadius: 12,
            background: cardBackground,
            boxShadow: isDark ? "none" : "0 8px 22px rgba(17,17,17,0.05)",
            padding: "24px 22px 20px",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 10,
            minHeight: "clamp(148px, 20vw, 178px)",
            animationDelay: "150ms",
            cursor: "pointer",
          }}
          role="button"
          tabIndex={0}
          onClick={onSelectCertificate}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectCertificate();
            }
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 22,
              right: 20,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(150,150,143,0.35)",
              color: "var(--gris-500)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            &gt;
          </span>
          <span style={CAJA_ICONO}>{ICONO_GESTIONADA}</span>
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            {t("sell.optionBTitle")}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("sell.optionBDesc")}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectCertificate();
            }}
            style={{
              marginTop: 2,
              border: "1px solid rgba(255,196,0,0.28)",
              background: "rgba(255,196,0,0.08)",
              color: "var(--marca-oscuro)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("sell.accessButton")}
          </button>
        </article>
      </div>

      <div
        style={{
          marginTop: 20,
          border: "1px solid rgba(255,196,0,0.18)",
          borderRadius: 14,
          background: isDark
            ? "rgba(255,196,0,0.08)"
            : "linear-gradient(135deg, rgba(255,196,0,0.05) 0%, rgba(255,196,0,0.07) 100%)",
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 30, lineHeight: 1 }}>🏪</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: titleColor, marginBottom: 3 }}>
            {uiLanguage === "en" ? "Prefer to manage it yourself?" : "¿Prefieres gestionarlo tú mismo?"}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.5 }}>
            {uiLanguage === "en"
              ? <>Publish your car on our <strong>Marketplace for private sellers</strong> and sell at your own pace.</>
              : <>Publica tu coche en nuestro <strong>Marketplace para particulares</strong> y lleva la venta a tu ritmo.</>}
          </div>
        </div>
        <button
          type="button"
          onClick={onSelectIDCar}
          style={{
            border: "1px solid rgba(255,196,0,0.3)",
            background: "linear-gradient(135deg, var(--marca), var(--marca-claro))",
            color: "var(--blanco)",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {uiLanguage === "en" ? "Publish with IDCar →" : "Publicar con IDCar →"}
        </button>
      </div>
    </div>
  );
}
