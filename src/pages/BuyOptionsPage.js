import { useState } from "react";
import { useTranslation } from "react-i18next";

const FLOW_A_ES = [
  { title: "Selecciona el modelo", sub: "Marca, modelo y versión" },
  { title: "Establece tus límites geográficos y de precio" },
  { title: "Analizamos anuncios en tiempo real", sub: "Precio, proveedor y características del vehículo" },
  { title: "Te ofrecemos las 5 mejores opciones" },
  { title: "Agendamos una cita con el vendedor" },
  { title: "Te buscamos la mejor financiación" },
];

const FLOW_A_EN = [
  { title: "Select the model", sub: "Brand, model and version" },
  { title: "Set your geographic and price limits" },
  { title: "We analyze listings in real time", sub: "Price, seller and vehicle characteristics" },
  { title: "We offer you the 5 best options" },
  { title: "We schedule an appointment with the seller" },
  { title: "We find you the best financing" },
];

const FLOW_B_ES = [
  { title: "Test CarsWise", sub: "Estilo de vida, desplazamientos, entorno legal" },
  { title: "Establece tus límites geográficos y de precio" },
  { title: "Analizamos anuncios en tiempo real" },
  { title: "Te ofrecemos las 5 mejores opciones" },
  { title: "Agendamos una cita con el vendedor" },
  { title: "Te buscamos la mejor financiación" },
];

const FLOW_B_EN = [
  { title: "CarsWise Test", sub: "Lifestyle, commuting, legal environment" },
  { title: "Set your geographic and price limits" },
  { title: "We analyze listings in real time" },
  { title: "We offer you the 5 best options" },
  { title: "We schedule an appointment with the seller" },
  { title: "We find you the best financing" },
];

export default function BuyOptionsPage({ styles, onSelectAdvisor, onSelectKnownModel, onGoBack }) {
  const { t, i18n } = useTranslation();
  const uiLanguage = i18n.language === "en" ? "en" : "es";
  const FLOW_A = uiLanguage === "en" ? FLOW_A_EN : FLOW_A_ES;
  const FLOW_B = uiLanguage === "en" ? FLOW_B_EN : FLOW_B_ES;
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const mutedColor = isDark ? "#cbd5e1" : "#475569";
  const cardBackground = isDark ? "rgba(15,23,42,0.55)" : "#ffffff";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(15,23,42,0.12)";
  const [openFlow, setOpenFlow] = useState(null);

  const toggleFlow = (flowKey) => {
    setOpenFlow((prev) => (prev === flowKey ? null : flowKey));
  };

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <button
        type="button"
        onClick={onGoBack}
        style={{
          border: "1px solid rgba(148,163,184,0.35)",
          background: isDark ? "rgba(15,23,42,0.5)" : "rgba(148,163,184,0.16)",
          color: isDark ? "#cbd5e1" : "#475569",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        {t("buyOptions.goBack")}
      </button>

      <div style={{ marginBottom: 10, marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", fontWeight: 800, color: "#2563eb", textTransform: "uppercase" }}>
          {t("buyOptions.badgeLabel")}
        </span>
        <span style={{ width: 34, height: 1, background: "rgba(37,99,235,0.5)" }} />
      </div>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: titleColor, letterSpacing: "-0.9px" }}>
        {t("circularSteps.step1Title")}
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6 }}>
        {t("buyOptions.pageSubtitle")}
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
            boxShadow: isDark ? "none" : "0 8px 22px rgba(15,23,42,0.05)",
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
          onClick={onSelectKnownModel}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectKnownModel();
            }
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid rgba(37,99,235,0.24)",
              background: "rgba(37,99,235,0.1)",
              color: "#2563eb",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {t("buyOptions.optionABadge")}
          </span>
          <span
            style={{
              position: "absolute",
              top: 22,
              right: 20,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#64748b",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            &gt;
          </span>
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            {t("buyOptions.optionATitle")}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("buyOptions.optionADesc")}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFlow("a");
            }}
            style={{
              marginTop: 2,
              border: "1px solid rgba(37,99,235,0.28)",
              background: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {openFlow === "a" ? t("buyOptions.hideButton") : t("buyOptions.showMore")}
          </button>
        </article>

        <article
          className="ma-card-interactive ma-fade-stagger"
          style={{
            position: "relative",
            border: cardBorder,
            borderRadius: 12,
            background: cardBackground,
            boxShadow: isDark ? "none" : "0 8px 22px rgba(15,23,42,0.05)",
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
          onClick={onSelectAdvisor}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectAdvisor();
            }
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid rgba(37,99,235,0.24)",
              background: "rgba(37,99,235,0.1)",
              color: "#2563eb",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {t("buyOptions.optionBBadge")}
          </span>
          <span
            style={{
              position: "absolute",
              top: 22,
              right: 20,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#64748b",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            &gt;
          </span>
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            {t("buyOptions.optionBTitle")}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("buyOptions.optionBDesc")}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFlow("b");
            }}
            style={{
              marginTop: 2,
              border: "1px solid rgba(37,99,235,0.28)",
              background: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {openFlow === "b" ? t("buyOptions.hideButton") : t("buyOptions.showMore")}
          </button>
        </article>
      </div>

      {openFlow === "a" && (
        <section
          style={{
            marginTop: 14,
            border: cardBorder,
            background: isDark ? "rgba(15,23,42,0.7)" : "#f8fafc",
            borderRadius: 12,
            padding: "14px 14px 12px",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: 10 }}>
            {t("buyOptions.flowAHeader")}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {FLOW_A.map((item, index) => (
              <div key={`a-${item.title}`} style={{ border: cardBorder, borderRadius: 10, background: cardBackground, padding: "9px 10px" }}>
                <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginBottom: 2 }}>{t("buyOptions.step")} {index + 1}</div>
                <div style={{ fontSize: 13, color: titleColor, fontWeight: 700, lineHeight: 1.35 }}>{item.title}</div>
                {item.sub ? <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{item.sub}</div> : null}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
              type="button"
              onClick={onSelectKnownModel}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "linear-gradient(135deg,#2563eb,#3b82f6)",
                color: "#ffffff",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("buyOptions.accessButton")}
            </button>
            <button
              type="button"
              onClick={() => setOpenFlow(null)}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "rgba(37,99,235,0.08)",
                color: "#1d4ed8",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("buyOptions.minimizeButton")}
            </button>
          </div>
        </section>
      )}

      {openFlow === "b" && (
        <section
          style={{
            marginTop: 14,
            border: cardBorder,
            background: isDark ? "rgba(15,23,42,0.7)" : "#f8fafc",
            borderRadius: 12,
            padding: "14px 14px 12px",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: 10 }}>
            {t("buyOptions.flowBHeader")}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {FLOW_B.map((item, index) => (
              <div key={`b-${item.title}`} style={{ border: cardBorder, borderRadius: 10, background: cardBackground, padding: "9px 10px" }}>
                <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginBottom: 2 }}>{t("buyOptions.step")} {index + 1}</div>
                <div style={{ fontSize: 13, color: titleColor, fontWeight: 700, lineHeight: 1.35 }}>{item.title}</div>
                {item.sub ? <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{item.sub}</div> : null}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSelectAdvisor}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "linear-gradient(135deg,#2563eb,#3b82f6)",
                color: "#ffffff",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("buyOptions.accessButton")}
            </button>
            <button
              type="button"
              onClick={() => setOpenFlow(null)}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "rgba(37,99,235,0.08)",
                color: "#1d4ed8",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("buyOptions.minimizeButton")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
