import { useEffect, useState } from "react";
import { PLAN_COMPARISON_ROWS, PRICING_SECTION_COPY, SERVICE_PLANS } from "../data/servicePlans";

export default function LandingPage({
  styles,
  totalSteps,
  blockColors,
  questionnaireDraft,
  isUserLoggedIn,
  planCheckoutLoadingId,
  planCheckoutFeedback,
  onSelectAdvice,
  onSelectVehicle,
  onResumeAdvice,
  onSelectDecision,
  onSelectSell,
  onSelectService,
  onSelectPortalVo,
  onSelectSubscriptionPlan,
}) {
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const draftAnsweredSteps = Number(questionnaireDraft?.answeredSteps || 0);
  const draftTotalSteps = Number(questionnaireDraft?.totalSteps || totalSteps || 0);
  const hasDraftAnswers = Object.keys(questionnaireDraft?.answers || {}).length > 0;
  const showResumeAdvice = (draftAnsweredSteps > 0 || hasDraftAnswers) && typeof onResumeAdvice === "function";
  const comparisonGridTemplate = `1.3fr repeat(${SERVICE_PLANS.length},1fr)`;
  const planCardBasis = `calc((100% - ${(SERVICE_PLANS.length - 1) * 12}px) / ${SERVICE_PLANS.length})`;

  return (
    <div style={{ ...styles.center, maxWidth: 1280, textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(37,99,235,0.1)",
          border: "1px solid rgba(37,99,235,0.22)",
          padding: "5px 14px",
          borderRadius: 100,
          fontSize: 11,
          color: "#60a5fa",
          marginBottom: 28,
          letterSpacing: "0.6px",
        }}
      >
        ✨ ASESOR INTELIGENTE DE MOVILIDAD · ESPAÑA
      </div>
      <h1
        style={{
          fontSize: "clamp(30px,6vw,52px)",
          fontWeight: 800,
          letterSpacing: "-2px",
          margin: "0 0 18px",
          background: "linear-gradient(135deg,#f1f5f9 30%,#64748b)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1.1,
        }}
      >
        ¿Cuál es tu mejor<br />opción de movilidad?
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "#64748b",
          lineHeight: 1.7,
          maxWidth: 440,
          margin: "0 auto 36px",
        }}
      >
        Te ayudamos a encontrar el coche usado con mejor relación calidad precio y que el proceso
        de compra y venta sea fiable, transparente y rentable.
      </p>

      {showResumeAdvice && (
        <div
          className="ma-card-soft ma-fade-stagger"
          style={{
            maxWidth: 720,
            margin: "0 auto 28px",
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(37,99,235,0.10)",
            border: "1px solid rgba(96,165,250,0.24)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            textAlign: "left",
            animationDelay: "20ms",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.4px", color: "#93c5fd", marginBottom: 4 }}>
              BORRADOR DISPONIBLE
            </div>
            <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 700 }}>
              Tienes un cuestionario a medias
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
              Llevabas {draftAnsweredSteps} de {draftTotalSteps} preguntas completadas.
            </div>
          </div>

          <button
            type="button"
            onClick={onResumeAdvice}
            style={{
              background: "linear-gradient(135deg,#2563EB,#1d4ed8)",
              border: "none",
              color: "white",
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Continuar cuestionario
          </button>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))",
          gap: 16,
          marginTop: 28,
          textAlign: "left",
        }}
      >
        <button
          onClick={onSelectVehicle}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 22,
            background: "rgba(37,99,235,0.08)",
            border: "1px solid rgba(37,99,235,0.22)",
            animationDelay: "40ms",
          }}
        >
          <span style={{ fontSize: 28, minWidth: 40 }}>🎯</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
              Quiero un vehículo
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              Índicanos si quieres comprar, alquilar o quieres que te guiemos en la mejor solución
              para ti.
            </div>
          </div>
        </button>

        <button
          onClick={onSelectSell}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 22,
            background: "rgba(5,150,105,0.08)",
            border: "1px solid rgba(5,150,105,0.22)",
            animationDelay: "120ms",
          }}
        >
          <span style={{ fontSize: 28, minWidth: 40 }}>🧭</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
              Quiero vender mi coche
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              ¿Cansado de que los concesionarios te ofrezcan mucho menos de lo que vale tu coche?
              Te ayudamos a que ganes más.
            </div>
          </div>
        </button>

        <button
          onClick={onSelectService}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 22,
            background: "rgba(217,119,6,0.08)",
            border: "1px solid rgba(217,119,6,0.22)",
            animationDelay: "200ms",
          }}
        >
          <span style={{ fontSize: 28, minWidth: 40 }}>💶</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
              Quiero contratar un Servicio
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              Únete a una nueva era en la automoción y aprovecha las economías de escala de una empresa
              en la unión de los particulares.
            </div>
          </div>
        </button>
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={onSelectPortalVo}
          className="ma-card-soft ma-fade-stagger"
          style={{
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            border: "none",
            color: "white",
            padding: isMobileView ? "12px 14px" : "13px 18px",
            borderRadius: 12,
            fontSize: isMobileView ? 13 : 14,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 14px 34px rgba(217,119,6,0.18)",
            width: "100%",
            maxWidth: 440,
            animationDelay: "260ms",
          }}
        >
          🏪 Ofertas VO únicas de nuestro portal
        </button>
      </div>

      <p style={{ marginTop: 18, fontSize: 12, color: "#334155" }}>
        Sin registro · Sin tarjeta · ~5 minutos
      </p>

      <section
        style={{
          marginTop: 42,
          textAlign: "left",
          padding: isMobileView ? "18px 12px" : "24px 18px",
          borderRadius: 20,
          background: "linear-gradient(135deg,rgba(15,23,42,0.72),rgba(2,6,23,0.72))",
          border: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.4px",
              color: "#bae6fd",
              background: "rgba(14,165,233,0.15)",
              border: "1px solid rgba(14,165,233,0.26)",
            }}
          >
            {PRICING_SECTION_COPY.pill}
          </div>
          <h2 style={{ margin: "12px 0 8px", fontSize: isMobileView ? "30px" : "clamp(24px,4vw,34px)", color: "#f8fafc", letterSpacing: "-0.8px", lineHeight: 1.15 }}>
            {PRICING_SECTION_COPY.title}
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: isMobileView ? 13 : 14, padding: isMobileView ? "0 6px" : 0 }}>
            {PRICING_SECTION_COPY.description}
          </p>
        </div>

        <div
          style={{
            display: isMobileView ? "grid" : "flex",
            gridTemplateColumns: isMobileView ? "1fr" : undefined,
            flexWrap: isMobileView ? "wrap" : "nowrap",
            gap: 12,
            overflowX: isMobileView ? "visible" : "auto",
            paddingBottom: 6,
            scrollSnapType: isMobileView ? "none" : "x mandatory",
          }}
        >
          {SERVICE_PLANS.map((plan) => (
            <article
              key={plan.id}
              className="ma-card-interactive ma-fade-stagger"
              style={{
                flex: isMobileView ? undefined : `0 0 ${planCardBasis}`,
                minWidth: isMobileView ? "100%" : 210,
                maxWidth: isMobileView ? "100%" : "none",
                scrollSnapAlign: isMobileView ? "none" : "start",
                borderRadius: 16,
                background: plan.background,
                border: `1px solid ${plan.border}`,
                padding: "16px 14px",
                boxShadow: plan.featured ? "0 16px 34px rgba(15,23,42,0.28)" : "none",
                animationDelay: `${80 + SERVICE_PLANS.findIndex((item) => item.id === plan.id) * 80}ms`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800, color: "#f8fafc", fontSize: 18 }}>{plan.name}</div>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#e2e8f0",
                    background: plan.badgeBackground,
                    border: `1px solid ${plan.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.badge}
                </span>
              </div>

              <div style={{ marginTop: 10, marginBottom: 12 }}>
                <span style={{ color: "#f8fafc", fontWeight: 800, fontSize: 26 }}>{plan.monthlyPrice}€</span>
                <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 13 }}>/mes</span>
              </div>

              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
                {plan.highlights.map((item) => (
                  <li key={item} style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.45 }}>
                    <span style={{ color: plan.accent, marginRight: 7 }}>●</span>
                    {item}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onSelectSubscriptionPlan?.(plan)}
                disabled={Boolean(planCheckoutLoadingId && planCheckoutLoadingId !== plan.id)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  border: "1px solid rgba(56,189,248,0.42)",
                  background: "linear-gradient(135deg,rgba(14,116,144,0.22),rgba(37,99,235,0.26))",
                  color: "#e2e8f0",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  opacity: planCheckoutLoadingId && planCheckoutLoadingId !== plan.id ? 0.6 : 1,
                }}
                aria-label={plan.ctaLabel || "Elegir plan"}
              >
                <span>
                  {planCheckoutLoadingId === plan.id
                    ? "Abriendo pasarela..."
                    : plan.ctaLabel || "Elegir plan"}
                </span>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>
                  {isUserLoggedIn ? "Pago seguro" : "Requiere acceso"}
                </span>
              </button>
            </article>
          ))}
        </div>

        {planCheckoutFeedback && (
          <div
            style={{
              marginTop: 10,
              borderRadius: 12,
              border: "1px solid rgba(56,189,248,0.32)",
              background: "rgba(2,132,199,0.10)",
              color: "#bae6fd",
              fontSize: 12,
              fontWeight: 600,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            {planCheckoutFeedback}
          </div>
        )}

        <div
          className="ma-card-soft"
          style={{
            marginTop: 14,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(148,163,184,0.22)",
            overflowX: isMobileView ? "auto" : "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: comparisonGridTemplate,
              background: "rgba(15,23,42,0.85)",
              minWidth: isMobileView ? 820 : "auto",
            }}
          >
            <div style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#93c5fd" }}>{PRICING_SECTION_COPY.comparisonTitle}</div>
            {SERVICE_PLANS.map((plan) => (
              <div key={`${plan.id}-head`} style={{ padding: "10px 8px", fontSize: 12, fontWeight: 700, color: "#e2e8f0", textAlign: "center" }}>
                {plan.name.replace("Plan ", "")}
              </div>
            ))}
          </div>

          {PLAN_COMPARISON_ROWS.map((row, rowIndex) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: comparisonGridTemplate,
                background: rowIndex % 2 === 0 ? "rgba(15,23,42,0.35)" : "rgba(15,23,42,0.2)",
                borderTop: "1px solid rgba(148,163,184,0.14)",
                minWidth: isMobileView ? 820 : "auto",
              }}
            >
              <div style={{ padding: "9px 12px", fontSize: 12, color: "#cbd5e1", fontWeight: 700 }}>{row.label}</div>
              {row.values.map((value, index) => (
                <div key={`${row.label}-${index}`} style={{ padding: "9px 8px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                  {value}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 12,
          marginTop: 52,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: 36,
        }}
      >
        {[
          [String(totalSteps), "Preguntas del marco"],
          ["9+", "Opciones de movilidad"],
          ["IA", "Análisis personalizado"],
        ].map(([n, l]) => (
          <div key={l}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2563EB" }}>{n}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: 36,
        }}
      >
        {Object.entries(blockColors).map(([name, color]) => (
          <span
            key={name}
            style={{
              background: `${color}15`,
              border: `1px solid ${color}28`,
              color,
              padding: "4px 12px",
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
