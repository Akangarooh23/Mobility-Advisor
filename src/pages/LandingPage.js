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
  const [activeJourneyStep, setActiveJourneyStep] = useState(0);
  const sectionGap = isMobileView ? 44 : 72;
  const sectionPadding = isMobileView ? "18px 12px" : "24px 20px";

  const experienceSteps = [
    {
      id: "discover",
      stage: "FASE 1",
      title: "Diagnóstico inicial de movilidad",
      description: "Definimos tu contexto: presupuesto, uso real, tipo de operación y objetivos personales.",
      highlights: [
        "Cuestionario guiado en pocos minutos",
        "Lectura de señales clave para compra o renting",
        "Sin dependencia de formularios complejos",
      ],
      metric: "~5 min",
      metricLabel: "Tiempo medio para tener un perfil útil",
      actionKey: "advice",
      actionLabel: "Iniciar diagnóstico",
      accent: "#38bdf8",
    },
    {
      id: "market",
      stage: "FASE 2",
      title: "Análisis y filtrado inteligente",
      description: "Combinamos IA + reglas de negocio para quedarnos con opciones realistas y rentables.",
      highlights: [
        "Descarta configuraciones con mal encaje financiero",
        "Prioriza equilibrio entre coste, fiabilidad y uso",
        "Visión comparativa clara para decidir con confianza",
      ],
      metric: "9+",
      metricLabel: "Variables de movilidad evaluadas",
      actionKey: "vehicle",
      actionLabel: "Explorar opciones",
      accent: "#22d3ee",
    },
    {
      id: "execution",
      stage: "FASE 3",
      title: "Activación de servicios y operativa",
      description: "Desde vender mejor tu coche hasta negociar seguro y mantenimiento con enfoque colectivo.",
      highlights: [
        "Flujos de venta con informe o certificado",
        "Servicios de ahorro y gestión del vehículo",
        "Panel privado con seguimiento centralizado",
      ],
      metric: "360°",
      metricLabel: "Cobertura integral del ciclo de movilidad",
      actionKey: "services",
      actionLabel: "Ver servicios",
      accent: "#34d399",
    },
  ];

  const activeExperience = experienceSteps[activeJourneyStep] || experienceSteps[0];

  const handleExperienceAction = (actionKey) => {
    if (actionKey === "vehicle") {
      onSelectVehicle?.();
      return;
    }
    if (actionKey === "services") {
      onSelectService?.();
      return;
    }
    onSelectAdvice?.();
  };

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
        🧠 ASESOR INTELIGENTE DE MOVILIDAD · ESPAÑA
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
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))",
          gap: 16,
          marginTop: 30,
          textAlign: "left",
          paddingBottom: isMobileView ? 22 : 28,
          borderBottom: "1px solid rgba(148,163,184,0.16)",
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
          <span style={{ fontSize: 28, minWidth: 40 }}>🚗</span>
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
          <span style={{ fontSize: 28, minWidth: 40 }}>💶</span>
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
          <span style={{ fontSize: 28, minWidth: 40 }}>🛠️</span>
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
      </section>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
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
          ✨ Ofertas VO únicas de nuestro portal
        </button>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: "#334155" }}>
        Sin registro · Sin tarjeta · ~5 minutos
      </p>

      <section
        className="ma-fade-stagger"
        style={{
          marginTop: sectionGap,
          textAlign: "left",
          borderRadius: 22,
          border: "1px solid rgba(56,189,248,0.22)",
          background:
            "radial-gradient(100% 160% at 5% 0%, rgba(56,189,248,0.14), rgba(56,189,248,0) 45%), radial-gradient(120% 120% at 100% 0%, rgba(52,211,153,0.12), rgba(52,211,153,0) 42%), linear-gradient(150deg, rgba(15,23,42,0.88), rgba(2,6,23,0.9))",
          padding: sectionPadding,
          animationDelay: "280ms",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
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
              color: "#a5f3fc",
              background: "rgba(8,145,178,0.2)",
              border: "1px solid rgba(103,232,249,0.3)",
            }}
          >
            COMO FUNCIONA CARADVISOR
          </div>
          <h2
            style={{
              margin: "12px 0 8px",
              fontSize: isMobileView ? "30px" : "clamp(26px,4.4vw,38px)",
              color: "#f8fafc",
              letterSpacing: "-0.9px",
              lineHeight: 1.1,
            }}
          >
            Qué te ofrecemos y qué puedes conseguir
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: isMobileView ? 13 : 14, lineHeight: 1.7 }}>
            No es solo un comparador: es una plataforma de decisión y ejecución para optimizar todo tu ciclo de movilidad.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobileView ? "1fr" : "minmax(280px,0.9fr) minmax(0,1.1fr)",
            gap: 14,
            alignItems: "stretch",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            {experienceSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveJourneyStep(index)}
                className="ma-card-interactive"
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 14,
                  padding: "12px 12px",
                  border:
                    activeJourneyStep === index
                      ? `1px solid ${step.accent}`
                      : "1px solid rgba(148,163,184,0.22)",
                  background:
                    activeJourneyStep === index
                      ? "linear-gradient(140deg, rgba(15,23,42,0.95), rgba(30,41,59,0.78))"
                      : "rgba(15,23,42,0.55)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.6px", color: "#7dd3fc" }}>
                    {step.stage}
                  </span>
                  <span style={{ fontSize: 11, color: step.accent, fontWeight: 700 }}>
                    {step.metric}
                  </span>
                </div>
                <div style={{ fontSize: 15, color: "#f8fafc", fontWeight: 800, marginBottom: 4 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                  {step.description}
                </div>
              </button>
            ))}
          </div>

          <article
            className="ma-card-interactive"
            style={{
              borderRadius: 16,
              border: `1px solid ${activeExperience.accent}66`,
              background: "linear-gradient(140deg, rgba(15,23,42,0.92), rgba(30,41,59,0.72))",
              padding: isMobileView ? "14px 12px" : "16px 14px",
              display: "grid",
              gap: 12,
              alignContent: "start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.6px", color: activeExperience.accent }}>
                  DETALLE DE LA FASE ACTIVA
                </div>
                <div style={{ marginTop: 4, fontSize: "clamp(18px,3.2vw,24px)", fontWeight: 800, color: "#f8fafc", lineHeight: 1.2 }}>
                  {activeExperience.title}
                </div>
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid ${activeExperience.accent}66`,
                  background: "rgba(15,23,42,0.72)",
                  padding: "8px 10px",
                  minWidth: isMobileView ? "100%" : 170,
                  textAlign: isMobileView ? "left" : "center",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", lineHeight: 1.1 }}>
                  {activeExperience.metric}
                </div>
                <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 3 }}>
                  {activeExperience.metricLabel}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65 }}>
              {activeExperience.description}
            </div>

            <div style={{ display: "grid", gap: 7 }}>
              {activeExperience.highlights.map((item) => (
                <div
                  key={item}
                  className="ma-card-soft"
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "rgba(15,23,42,0.55)",
                    padding: "9px 10px",
                    color: "#dbeafe",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: activeExperience.accent, marginRight: 8 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
              <button
                type="button"
                className="ma-card-soft"
                onClick={() => handleExperienceAction(activeExperience.actionKey)}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {activeExperience.actionLabel}
              </button>
              <button
                type="button"
                className="ma-card-soft"
                onClick={onSelectPortalVo}
                style={{
                  border: "1px solid rgba(148,163,184,0.28)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "rgba(15,23,42,0.55)",
                  color: "#e2e8f0",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Ver marketplace VO
              </button>
            </div>
          </article>
        </div>
      </section>

      <section
        style={{
          marginTop: sectionGap,
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
                    <span style={{ color: plan.accent, marginRight: 7 }}>✓</span>
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
          marginTop: isMobileView ? 40 : 56,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: isMobileView ? 28 : 36,
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
          marginTop: isMobileView ? 28 : 36,
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
