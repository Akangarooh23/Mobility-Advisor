
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import CircularSteps from "../components/CircularSteps";
import HomeProcessSections from "../components/HomeProcessSections";
import HomePricingPlans from "../components/HomePricingPlans";

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
  onSelectBuyStart,
  onResumeAdvice,
  onSelectDecision,
  onSelectSell,
  onSelectService,
  onSelectServiceAutogestor,
  onSelectServiceMaintenance,
  onSelectServiceAppointment,
  onSelectServiceMonthlyPlan,
  onSelectServiceInsurance,
  onSelectPortalVo,
  onSelectSubscriptionPlan,
}) {
  const { t } = useTranslation();
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
  const heroScale = useTransform(scrollYProgress, [0, 0.26], [1, isMobileView ? 1 : 1.11]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, isMobileView ? 1 : 0.18]);
  const heroY = useTransform(scrollYProgress, [0, 0.28], [0, isMobileView ? 0 : -52]);
  const bgParallaxNear = useTransform(scrollYProgress, [0, 1], [0, isMobileView ? -38 : -92]);
  const bgParallaxFar = useTransform(scrollYProgress, [0, 1], [0, isMobileView ? 24 : 58]);
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
          position: "relative",
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
        {t("landing.heroTitle")}
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
              {t("landing.draftBadge")}
            </div>
            <div style={{ fontSize: 14, color: draftCardTitleColor, fontWeight: 700 }}>
              {t("landing.draftTitle")}
            </div>
            <div style={{ fontSize: 12, color: draftCardMetaColor, marginTop: 4 }}>
              {t("landing.draftMeta", { answeredSteps: draftAnsweredSteps, totalSteps: draftTotalSteps })}
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
            {t("landing.draftContinue")}
          </button>
        </div>
      )}

      {/* NUEVO: CircularSteps reemplaza los tres recuadros de features */}
      <div style={{ marginTop: 30, marginBottom: 18 }}>
        <CircularSteps
          onSelectBuy={onSelectBuyStart || onSelectVehicle}
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
          position: "relative",
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
        <HomeProcessSections
          onAccessBuyKnownModel={onSelectDecision}
          onAccessBuyGuided={onSelectAdvice}
          onAccessSellInfo={onSelectSell}
          onAccessSellManaged={onSelectSell}
          onAccessServiceAutogestor={onSelectServiceAutogestor}
          onAccessServiceMaintenance={onSelectServiceMaintenance}
          onAccessServiceAppointment={onSelectServiceAppointment}
          onAccessServiceMonthlyPlan={onSelectServiceMonthlyPlan}
          onAccessServiceInsurance={onSelectServiceInsurance}
        />
      </m.section>

      <m.section
        ref={pricingSectionRef}
        style={{
          minHeight: panelMinHeight,
          display: "grid",
          position: "relative",
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
        <HomePricingPlans
          onSelectSubscriptionPlan={onSelectSubscriptionPlan}
          planCheckoutLoadingId={planCheckoutLoadingId}
          planCheckoutFeedback={planCheckoutFeedback}
        />
      </m.section>

      <m.section
        ref={metricsSectionRef}
        style={{
          position: "relative",
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
