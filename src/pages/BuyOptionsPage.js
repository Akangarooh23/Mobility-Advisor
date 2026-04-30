import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function BuyOptionsPage({ styles, onSelectAdvisor, onSelectKnownModel, onOpenMarketplace, onGoBack }) {
  const { t } = useTranslation();
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const mutedColor = isDark ? "#cbd5e1" : "#475569";
  const cardBackground = isDark ? "rgba(15,23,42,0.55)" : "#ffffff";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(15,23,42,0.12)";
  const [openFlow, setOpenFlow] = useState(null);

  const toggleFlow = (flowKey) => {
    setOpenFlow((prev) => (prev === flowKey ? null : flowKey));
  };

  const flowA = [
    { title: "Selecciona el modelo", sub: "Marca, modelo y version" },
    { title: "Establece tus limites geograficos y de precio" },
    { title: "Analizamos anuncios en tiempo real", sub: "Precio, proveedor y caracteristicas del vehiculo" },
    { title: "Te ofrecemos las 5 mejores opciones" },
    { title: "Agendamos una cita con el vendedor" },
    { title: "Te buscamos la mejor financiacion" },
  ];

  const flowB = [
    { title: "Test CarsWise", sub: "Estilo de vida, desplazamientos y entorno legal" },
    { title: "Establece tus limites geograficos y de precio" },
    { title: "Analizamos anuncios en tiempo real" },
    { title: "Te ofrecemos las 5 mejores opciones" },
    { title: "Agendamos una cita con el vendedor" },
    { title: "Te buscamos la mejor financiacion" },
  ];

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
          Compra
        </span>
        <span style={{ width: 34, height: 1, background: "rgba(37,99,235,0.5)" }} />
      </div>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: titleColor, letterSpacing: "-0.9px" }}>
        {t("circularSteps.step1Title")}
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6 }}>
        Dinos cuanto sabes ya sobre lo que quieres y empezamos desde ahi. Analizamos el mercado en tiempo real para encontrar las mejores opciones.
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
            Opcion A
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
            {t("buyOptions.knowModel")}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("buyOptions.knowModelDesc")}
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
            {openFlow === "a" ? "Ocultar" : "Ver mas"}
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
            Opcion B
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
            {t("buyOptions.dontKnowModel")}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            {t("buyOptions.dontKnowModelDesc")}
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
            {openFlow === "b" ? "Ocultar" : "Ver mas"}
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
            Flujo A - Modelo conocido
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {flowA.map((item, index) => (
              <div key={`a-${item.title}`} style={{ border: cardBorder, borderRadius: 10, background: cardBackground, padding: "9px 10px" }}>
                <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginBottom: 2 }}>Paso {index + 1}</div>
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
              Acceder
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
              Minimizar
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
            Flujo B - Test CarsWise
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {flowB.map((item, index) => (
              <div key={`b-${item.title}`} style={{ border: cardBorder, borderRadius: 10, background: cardBackground, padding: "9px 10px" }}>
                <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginBottom: 2 }}>Paso {index + 1}</div>
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
              Acceder
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
              Minimizar
            </button>
          </div>
        </section>
      )}

      <section
        style={{
          marginTop: 24,
          border: cardBorder,
          background: isDark ? "rgba(15,23,42,0.62)" : "linear-gradient(180deg,#f8fbff 0%,#ffffff 100%)",
          borderRadius: 12,
          padding: "18px 18px 16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, color: "#2563eb", marginBottom: 6 }}>
            Marketplace VO
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: titleColor, lineHeight: 1.25, marginBottom: 4 }}>
            Igual te puede interesar ver nuestro marketplace de VO de Carswise
          </div>
          <div style={{ fontSize: 13, color: mutedColor, lineHeight: 1.5 }}>
            Si prefieres explorar directamente el stock disponible, puedes entrar al marketplace y ver las ofertas publicadas.
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenMarketplace}
          style={{
            border: "1px solid rgba(37,99,235,0.25)",
            background: "linear-gradient(135deg,#2563eb,#3b82f6)",
            color: "#ffffff",
            borderRadius: 10,
            padding: "11px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Ir al marketplace
        </button>
      </section>
    </div>
  );
}
