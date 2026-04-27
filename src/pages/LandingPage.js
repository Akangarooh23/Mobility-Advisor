
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { PLAN_COMPARISON_ROWS, PRICING_SECTION_COPY, SERVICE_PLANS } from "../data/servicePlans";
import CircularSteps from "../components/CircularSteps";

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
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#000000";

  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.innerWidth < 768;
  });
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const howItWorksSectionRef = useRef(null);
  const pricingSectionRef = useRef(null);
  const metricsSectionRef = useRef(null);

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

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const html = document.documentElement;
    const previousHtmlSnap = html.style.scrollSnapType;
    const previousHtmlBehavior = html.style.scrollBehavior;

    if (!prefersReducedMotion && !isMobileView) {
      const snapMode = "y proximity";
      html.style.scrollSnapType = snapMode;
      html.style.scrollBehavior = "smooth";
    }

    return () => {
      html.style.scrollSnapType = previousHtmlSnap;
      html.style.scrollBehavior = previousHtmlBehavior;
    };
  }, [isMobileView, prefersReducedMotion]);

  const draftAnsweredSteps = Number(questionnaireDraft?.answeredSteps || 0);
  const draftTotalSteps = Number(questionnaireDraft?.totalSteps || totalSteps || 0);
  const hasDraftAnswers = Object.keys(questionnaireDraft?.answers || {}).length > 0;
  const draftStep = Number(questionnaireDraft?.step ?? -1);
  const draftWasStarted = Number.isFinite(draftStep) && draftStep >= 0;
  const showResumeAdvice = (draftAnsweredSteps > 0 || hasDraftAnswers || draftWasStarted) && typeof onResumeAdvice === "function";
  const comparisonGridTemplate = `1.3fr repeat(${SERVICE_PLANS.length},1fr)`;
  const planCardBasis = `calc((100% - ${(SERVICE_PLANS.length - 1) * 12}px) / ${SERVICE_PLANS.length})`;
  const [activeJourneyStep, setActiveJourneyStep] = useState(0);
  const sectionPadding = isMobileView ? "18px 12px" : "24px 20px";
  const heroScale = useTransform(scrollYProgress, [0, 0.26], [1, isMobileView ? 1 : 1.11]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, isMobileView ? 1 : 0.18]);
  const heroY = useTransform(scrollYProgress, [0, 0.28], [0, isMobileView ? 0 : -52]);
  const bgParallaxNear = useTransform(scrollYProgress, [0, 1], [0, isMobileView ? -38 : -92]);
  const bgParallaxFar = useTransform(scrollYProgress, [0, 1], [0, isMobileView ? 24 : 58]);
  const tapFeedback = prefersReducedMotion
    ? {}
    : { scale: isMobileView ? 0.985 : 0.992 };

  const enableInViewReveals = !prefersReducedMotion && !isMobileView;
  const revealInitial = enableInViewReveals ? { opacity: 0, y: 20, scale: 0.985 } : false;
  const revealInView = enableInViewReveals ? { opacity: 1, y: 0, scale: 1 } : undefined;
  const revealViewport = enableInViewReveals ? { once: true, amount: 0.26 } : undefined;
  const showLightBackgroundFx = !isDark;
  const panelMinHeight = isMobileView ? "auto" : "96vh";
  const panelRevealInitial = !prefersReducedMotion && !isMobileView ? { opacity: 0, y: 28, scale: 0.985 } : false;
  const panelRevealInView = !prefersReducedMotion && !isMobileView ? { opacity: 1, y: 0, scale: 1 } : undefined;
  const panelRevealViewport = !prefersReducedMotion && !isMobileView ? { once: true, amount: 0.18 } : undefined;
  const mobilePanelSpacing = isMobileView ? 18 : 0;
  const metricsSectionBackground = isDark
    ? "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.92))"
    : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))";
  const metricsSectionBorder = isDark ? "1px solid rgba(148,163,184,0.28)" : "1px solid rgba(148,163,184,0.24)";
  const metricsLabelColor = isDark ? "#e2e8f0" : "#475569";
  const metricsDividerColor = isDark ? "1px solid rgba(148,163,184,0.3)" : "1px solid rgba(148,163,184,0.22)";

  const { scrollYProgress: howItWorksProgress } = useScroll({
    target: howItWorksSectionRef,
    offset: ["start 98%", "start 18%"],
  });
  const { scrollYProgress: pricingProgress } = useScroll({
    target: pricingSectionRef,
    offset: ["start 98%", "start 18%"],
  });
  const { scrollYProgress: metricsProgress } = useScroll({
    target: metricsSectionRef,
    offset: ["start 98%", "start 18%"],
  });

  const howItWorksMobileOpacity = useTransform(howItWorksProgress, [0, 1], [0.06, 1]);
  const howItWorksMobileY = useTransform(howItWorksProgress, [0, 1], [34, 0]);
  const pricingMobileOpacity = useTransform(pricingProgress, [0, 1], [0.08, 1]);
  const pricingMobileY = useTransform(pricingProgress, [0, 1], [32, 0]);
  const metricsMobileOpacity = useTransform(metricsProgress, [0, 1], [0.1, 1]);
  const metricsMobileY = useTransform(metricsProgress, [0, 1], [28, 0]);
  const draftCardTitleColor = isDark ? "#e2e8f0" : "#0f172a";
  const draftCardMetaColor = isDark ? "#cbd5e1" : "#334155";

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
    <LazyMotion features={domAnimation}>
      {showLightBackgroundFx && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(105% 84% at 8% 0%, rgba(14,165,233,0.08), rgba(14,165,233,0) 52%), radial-gradient(95% 78% at 100% 0%, rgba(16,185,129,0.06), rgba(16,185,129,0) 50%), linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,0.985))",
            }}
          />

          <m.div
            style={{
              position: "absolute",
              top: isMobileView ? -130 : -180,
              left: isMobileView ? -120 : -150,
              width: isMobileView ? 280 : 420,
              height: isMobileView ? 280 : 420,
              borderRadius: "50%",
              background: "radial-gradient(circle at 40% 40%, rgba(59,130,246,0.13), rgba(59,130,246,0.02) 62%, rgba(59,130,246,0) 76%)",
              filter: "blur(10px)",
              y: prefersReducedMotion ? 0 : bgParallaxNear,
            }}
          />

          <m.div
            style={{
              position: "absolute",
              top: isMobileView ? "34%" : "26%",
              right: isMobileView ? -110 : -160,
              width: isMobileView ? 260 : 390,
              height: isMobileView ? 260 : 390,
              borderRadius: "50%",
              background: "radial-gradient(circle at 58% 42%, rgba(6,182,212,0.1), rgba(6,182,212,0.015) 58%, rgba(6,182,212,0) 74%)",
              filter: "blur(12px)",
              y: prefersReducedMotion ? 0 : bgParallaxFar,
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
              backgroundSize: isMobileView ? "24px 24px" : "32px 32px",
              opacity: isMobileView ? 0.08 : 0.11,
              maskImage: "radial-gradient(circle at 50% 28%, rgba(0,0,0,0.42), rgba(0,0,0,0.06) 60%, transparent 86%)",
            }}
          />

          <m.div
            style={{
              position: "absolute",
              top: isMobileView ? "18%" : "14%",
              left: 0,
              right: 0,
              height: isMobileView ? 160 : 220,
              background: "linear-gradient(100deg, rgba(255,255,255,0), rgba(37,99,235,0.08) 42%, rgba(14,165,233,0.06) 58%, rgba(255,255,255,0))",
              filter: "blur(22px)",
              y: prefersReducedMotion ? 0 : bgParallaxNear,
            }}
          />
        </div>
      )}

      <div style={{ ...styles.center, maxWidth: 1280, textAlign: "center", position: "relative", overflow: "visible", zIndex: 1 }}>
      <section
        style={{
          minHeight: panelMinHeight,
          display: "grid",
          alignContent: "center",
          paddingTop: isMobileView
            ? (showResumeAdvice ? 136 : 122)
            : (showResumeAdvice ? 126 : 112),
          paddingBottom: isMobileView ? 8 : 0,
          scrollSnapAlign: "start",
          scrollSnapStop: "normal",
        }}
      >
      <m.div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: isDark
            ? "rgba(37,99,235,0.1)"
            : "linear-gradient(135deg, rgba(219,234,254,0.92), rgba(191,219,254,0.9))",
          border: isDark
            ? "1px solid rgba(37,99,235,0.22)"
            : "1px solid rgba(59,130,246,0.34)",
          padding: "6px 16px",
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 800,
          color: isDark ? "#60a5fa" : "#1d4ed8",
          margin: `${isMobileView ? 14 : 20}px auto ${isMobileView ? 34 : 42}px`,
          letterSpacing: "0.6px",
          position: "relative",
          zIndex: 1,
          width: "fit-content",
          textAlign: "center",
          opacity: prefersReducedMotion ? 1 : heroOpacity,
        }}
      >
        🧠 ASESOR INTELIGENTE DE MOVILIDAD · ESPAÑA
      </m.div>
      <m.h1
        style={{
          fontSize: "clamp(24px,4.8vw,42px)",
          fontWeight: 800,
          letterSpacing: "-2px",
          margin: "0 auto 36px",
          color: titleColor,
          lineHeight: 1.1,
          maxWidth: 860,
          position: "relative",
          zIndex: 1,
          y: prefersReducedMotion ? 0 : heroY,
          scale: prefersReducedMotion ? 1 : heroScale,
          opacity: prefersReducedMotion ? 1 : heroOpacity,
        }}
      >
        Te ayudamos a encontrar el coche usado con mejor relación calidad precio y que el proceso
        de compra y venta sea fiable, transparente y rentable.
      </m.h1>

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
            <div style={{ fontSize: 14, color: draftCardTitleColor, fontWeight: 700 }}>
              Tienes un cuestionario a medias
            </div>
            <div style={{ fontSize: 12, color: draftCardMetaColor, marginTop: 4 }}>
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

      {/* NUEVO: CircularSteps reemplaza los tres recuadros de features */}
      <div style={{ marginTop: 30, marginBottom: 18 }}>
        <CircularSteps
          onSelectBuy={onSelectDecision}
          onSelectService={onSelectService}
          onSelectSell={onSelectSell}
        />
      </div>

      </section>

      <m.section
        ref={howItWorksSectionRef}
        style={{
          minHeight: panelMinHeight,
          display: "grid",
          alignContent: "center",
          marginTop: mobilePanelSpacing,
          paddingBottom: isMobileView ? 6 : 0,
          scrollSnapAlign: "start",
          scrollSnapStop: "normal",
          opacity: !prefersReducedMotion && isMobileView ? howItWorksMobileOpacity : 1,
          y: !prefersReducedMotion && isMobileView ? howItWorksMobileY : 0,
        }}
        initial={panelRevealInitial}
        whileInView={panelRevealInView}
        viewport={panelRevealViewport}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
      <m.section
        className="ma-fade-stagger"
        style={{
          marginTop: 0,
          textAlign: "left",
          borderRadius: 22,
          border: "1px solid rgba(56,189,248,0.22)",
          background:
            "radial-gradient(100% 160% at 5% 0%, rgba(56,189,248,0.14), rgba(56,189,248,0) 45%), radial-gradient(120% 120% at 100% 0%, rgba(52,211,153,0.12), rgba(52,211,153,0) 42%), linear-gradient(150deg, rgba(15,23,42,0.88), rgba(2,6,23,0.9))",
          padding: sectionPadding,
          animationDelay: "280ms",
          position: "relative",
          zIndex: 1,
        }}
        initial={revealInitial}
        whileInView={revealInView}
        viewport={revealViewport}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
            COMO FUNCIONA CARSWISE
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
          <m.div
            style={{
              display: "grid",
              gap: 10,
            }}
            initial={revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            {experienceSteps.map((step, index) => (
              <m.button
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
                whileTap={tapFeedback}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={revealViewport}
                transition={{ duration: 0.34, delay: 0.03 * index, ease: [0.22, 1, 0.36, 1] }}
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
              </m.button>
            ))}
          </m.div>

          <m.article
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
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={activeExperience.id}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -22 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "grid", gap: 12 }}
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
                  <m.button
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
                    whileTap={tapFeedback}
                  >
                    Ver marketplace VO
                  </m.button>
                </div>
              </m.div>
            </AnimatePresence>
          </m.article>
        </div>
      </m.section>
      </m.section>

      <m.section
        ref={pricingSectionRef}
        style={{
          minHeight: panelMinHeight,
          display: "grid",
          alignContent: "center",
          marginTop: mobilePanelSpacing,
          scrollSnapAlign: "start",
          scrollSnapStop: "normal",
          opacity: !prefersReducedMotion && isMobileView ? pricingMobileOpacity : 1,
          y: !prefersReducedMotion && isMobileView ? pricingMobileY : 0,
        }}
        initial={panelRevealInitial}
        whileInView={panelRevealInView}
        viewport={panelRevealViewport}
        transition={{ duration: 0.76, ease: [0.22, 1, 0.36, 1] }}
      >
      <section
        style={{
          marginTop: 0,
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: isMobileView ? "wrap" : "nowrap" }}>
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
                    marginLeft: isMobileView ? 0 : "auto",
                  }}
                >
                  {plan.badge}
                </span>
              </div>

              <div style={{ marginTop: 10, marginBottom: 12 }}>
                <span style={{ color: "#f8fafc", fontWeight: 800, fontSize: isMobileView ? 24 : 26 }}>{plan.monthlyPrice}€</span>
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
                  alignItems: isMobileView ? "flex-start" : "center",
                  justifyContent: "space-between",
                  flexDirection: isMobileView ? "column" : "row",
                  gap: 8,
                  textAlign: isMobileView ? "left" : "inherit",
                  opacity: planCheckoutLoadingId && planCheckoutLoadingId !== plan.id ? 0.6 : 1,
                }}
                aria-label={plan.ctaLabel || "Elegir plan"}
              >
                <span style={{ wordBreak: "break-word" }}>
                  {planCheckoutLoadingId === plan.id
                    ? "Abriendo pasarela..."
                    : plan.ctaLabel || "Elegir plan"}
                </span>
                <span style={{ color: "#94a3b8", fontSize: 11, whiteSpace: isMobileView ? "normal" : "nowrap" }}>
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

        {isMobileView ? (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#93c5fd", textAlign: "center" }}>
              {PRICING_SECTION_COPY.comparisonTitle}
            </div>
            {SERVICE_PLANS.map((plan, planIndex) => (
              <div
                key={`${plan.id}-mobile-comparison`}
                className="ma-card-soft"
                style={{
                  borderRadius: 12,
                  border: `1px solid ${plan.border}`,
                  background: "rgba(15,23,42,0.5)",
                  padding: "10px 10px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>{plan.name}</div>
                {PLAN_COMPARISON_ROWS.map((row) => (
                  <div
                    key={`${plan.id}-${row.label}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "start",
                      columnGap: 10,
                      rowGap: 2,
                      borderTop: "1px solid rgba(148,163,184,0.14)",
                      paddingTop: 6,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 700 }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>{row.values[planIndex]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="ma-card-soft"
            style={{
              marginTop: 14,
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(148,163,184,0.22)",
              overflowX: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: comparisonGridTemplate,
                background: "rgba(15,23,42,0.85)",
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
        )}
      </section>
      </m.section>

      <m.section
        ref={metricsSectionRef}
        style={{
          marginTop: isMobileView ? 18 : 24,
          borderRadius: 16,
          border: metricsSectionBorder,
          background: metricsSectionBackground,
          padding: isMobileView ? "18px 12px" : "20px 16px",
          opacity: !prefersReducedMotion && isMobileView ? metricsMobileOpacity : 1,
          y: !prefersReducedMotion && isMobileView ? metricsMobileY : 0,
        }}
        initial={!prefersReducedMotion && !isMobileView ? { opacity: 0, y: 30, scale: 0.985 } : false}
        whileInView={!prefersReducedMotion && !isMobileView ? { opacity: 1, y: 0, scale: 1 } : undefined}
        viewport={!prefersReducedMotion && !isMobileView ? { once: true, amount: 0.28 } : undefined}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 12,
        }}
      >
        {[
          [String(totalSteps), "Preguntas del marco"],
          ["9+", "Opciones de movilidad"],
          ["IA", "Análisis personalizado"],
        ].map(([n, l]) => (
          <div key={l}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2563EB" }}>{n}</div>
            <div style={{ fontSize: 12, color: metricsLabelColor, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: isMobileView ? 18 : 24,
          paddingTop: isMobileView ? 12 : 16,
          borderTop: metricsDividerColor,
        }}
      >
        {Object.entries(blockColors).map(([name, color]) => (
          <span
            key={name}
            style={{
              background: `${color}12`,
              border: `1px solid ${color}33`,
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
      </m.section>
    </div>
    </LazyMotion>
  );
}
