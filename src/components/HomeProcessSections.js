import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./HomeProcessSections.css";

const INITIAL_OPEN = {
  como: null,
  comprar: null,
  vender: null,
};

function FlowCard({
  badge,
  title,
  description,
  isOpen,
  onClick,
  className = "",
}) {
  return (
    <button
      type="button"
      className={`cw-home-path-card ${isOpen ? "open" : ""} ${className}`.trim()}
      onClick={onClick}
    >
      <span className="cw-home-path-badge">{badge}</span>
      <span className="cw-home-path-arrow">&gt;</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </button>
  );
}

function StepItem({ n, title, sub }) {
  return (
    <div className="cw-home-flow-step">
      <div className="cw-home-step-n">{n}</div>
      <div>
        <div className="cw-home-step-title">{title}</div>
        {sub ? <div className="cw-home-step-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

function FlowPanel({ isOpen, header, steps, onAccess }) {
  const { t } = useTranslation();
  return (
    <div className={`cw-home-flow-panel ${isOpen ? "open" : ""}`}>
      <div className="cw-home-flow-inner">
        <div className="cw-home-flow-header">{header}</div>
        <div className="cw-home-flow-steps">
          {steps.map((step) => (
            <StepItem key={`${header}-${step.n}-${step.title}`} n={step.n} title={step.title} sub={step.sub} />
          ))}
        </div>
        <div className="cw-home-flow-actions">
          <button type="button" className="cw-home-flow-access-btn" onClick={onAccess}>{t("buyOptions.accessButton")}</button>
        </div>
      </div>
    </div>
  );
}

export default function HomeProcessSections({
  onAccessBuyKnownModel,
  onAccessBuyGuided,
  onAccessSellInfo,
  onAccessSellManaged,
  onAccessServiceAutogestor,
  onAccessServiceMaintenance,
  onAccessServiceAppointment,
  onAccessServiceMonthlyPlan,
  onAccessServiceInsurance,
}) {
  const { t } = useTranslation();
  const [openPanels, setOpenPanels] = useState(INITIAL_OPEN);
  const rootRef = useRef(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !rootRef.current) {
      return undefined;
    }

    const targets = rootRef.current.querySelectorAll(".cw-home-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const togglePanel = (section, option) => {
    setOpenPanels((prev) => ({
      ...prev,
      [section]: prev[section] === option ? null : option,
    }));
  };

  return (
    <div className="cw-home-process" ref={rootRef}>
      <section id="como">
        <div className="cw-home-section-label cw-home-reveal">{t("homeProcessSections.processLabel")}</div>
        <h1 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">{t("homeProcessSections.procesTitle")}</h1>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          {t("homeProcessSections.processDesc")}
        </p>
      </section>

      <section id="comprar">
        <div className="cw-home-section-num">1</div>
        <div className="cw-home-section-label cw-home-reveal">{t("homeProcessSections.buyLabel")}</div>
        <h2 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">{t("homeProcessSections.buyTitle")}</h2>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          {t("homeProcessSections.buyDesc")}
        </p>

        <div className="cw-home-path-grid">
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d1"
            badge={t("homeProcessSections.optionA")}
            title={t("homeProcessSections.optionATitle")}
            description={t("homeProcessSections.optionADesc")}
            isOpen={openPanels.comprar === "a"}
            onClick={() => togglePanel("comprar", "a")}
          />
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d2"
            badge={t("homeProcessSections.optionB")}
            title={t("homeProcessSections.optionBTitle")}
            description={t("homeProcessSections.optionBDesc")}
            isOpen={openPanels.comprar === "b"}
            onClick={() => togglePanel("comprar", "b")}
          />
        </div>

        <FlowPanel
          isOpen={openPanels.comprar === "a"}
          header={t("homeProcessSections.flowAHeader")}
          onAccess={onAccessBuyKnownModel}
          steps={[
            { n: 1, title: t("homeProcessSections.flowAStep1"), sub: t("homeProcessSections.flowAStep1Sub") },
            { n: 2, title: t("homeProcessSections.flowAStep2") },
            { n: 3, title: t("homeProcessSections.flowAStep3"), sub: t("homeProcessSections.flowAStep3Sub") },
            { n: 4, title: t("homeProcessSections.flowAStep4") },
            { n: 5, title: t("homeProcessSections.flowAStep5") },
            { n: 6, title: t("homeProcessSections.flowAStep6") },
          ]}
        />

        <FlowPanel
          isOpen={openPanels.comprar === "b"}
          header={t("homeProcessSections.flowBHeader")}
          onAccess={onAccessBuyGuided}
          steps={[
            { n: 1, title: t("homeProcessSections.flowBStep1"), sub: t("homeProcessSections.flowBStep1Sub") },
            { n: 2, title: t("homeProcessSections.flowBStep2") },
            { n: 3, title: t("homeProcessSections.flowBStep3") },
            { n: 4, title: t("homeProcessSections.flowBStep4") },
            { n: 5, title: t("homeProcessSections.flowBStep5") },
            { n: 6, title: t("homeProcessSections.flowBStep6") },
          ]}
        />
      </section>

      <section id="servicios">
        <div className="cw-home-section-num">2</div>
        <div className="cw-home-section-label cw-home-reveal">{t("homeProcessSections.serviceLabel")}</div>
        <h2 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">{t("homeProcessSections.serviceTitle")}</h2>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          {t("homeProcessSections.serviceDesc")}
        </p>

        <div className="cw-home-svc-grid">
          <button type="button" className="cw-home-svc-card cw-home-reveal" onClick={onAccessServiceAutogestor}>
            <div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg></div>
            <div className="cw-home-svc-pill">{t("homeProcessSections.serviceAutogestorLabel")}</div>
            <h3>{t("homeProcessSections.serviceAutogestorTitle")}</h3>
            <p>{t("homeProcessSections.serviceAutogestorDesc")}</p>
          </button>
          <button type="button" className="cw-home-svc-card cw-home-reveal cw-home-reveal-d1" onClick={onAccessServiceMaintenance}>
            <div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
            <div className="cw-home-svc-pill">{t("homeProcessSections.serviceMaintenanceLabel")}</div>
            <h3>{t("homeProcessSections.serviceMaintenanceTitle")}</h3>
            <p>{t("homeProcessSections.serviceMaintenanceDesc")}</p>
          </button>
          <button type="button" className="cw-home-svc-card cw-home-reveal cw-home-reveal-d2" onClick={onAccessServiceAppointment}>
            <div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg></div>
            <div className="cw-home-svc-pill">{t("homeProcessSections.serviceAppointmentLabel")}</div>
            <h3>{t("homeProcessSections.serviceAppointmentTitle")}</h3>
            <p>{t("homeProcessSections.serviceAppointmentDesc")}</p>
          </button>
          <button type="button" className="cw-home-svc-card cw-home-reveal cw-home-reveal-d1" onClick={onAccessServiceMonthlyPlan}>
            <div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg></div>
            <div className="cw-home-svc-pill">{t("homeProcessSections.serviceMonthlyLabel")}</div>
            <h3>{t("homeProcessSections.serviceMonthlyTitle")}</h3>
            <p>{t("homeProcessSections.serviceMonthlyDesc")}</p>
          </button>
          <button type="button" className="cw-home-svc-card cw-home-reveal cw-home-reveal-d2" onClick={onAccessServiceInsurance}>
            <div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg></div>
            <div className="cw-home-svc-pill">{t("homeProcessSections.serviceInsuranceLabel")}</div>
            <h3>{t("homeProcessSections.serviceInsuranceTitle")}</h3>
            <p>{t("homeProcessSections.serviceInsuranceDesc")}</p>
          </button>
        </div>
      </section>

      <section id="vender">
        <div className="cw-home-section-num">3</div>
        <div className="cw-home-section-label cw-home-reveal">{t("homeProcessSections.sellLabel")}</div>
        <h2 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">{t("homeProcessSections.sellTitle")}</h2>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          {t("homeProcessSections.sellDesc")}
        </p>

        <div className="cw-home-path-grid">
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d1"
            badge={t("homeProcessSections.optionA")}
            title={t("homeProcessSections.sellOptionATitle")}
            description={t("homeProcessSections.sellOptionADesc")}
            isOpen={openPanels.vender === "a"}
            onClick={() => togglePanel("vender", "a")}
          />
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d2"
            badge={t("homeProcessSections.optionB")}
            title={t("homeProcessSections.sellOptionBTitle")}
            description={t("homeProcessSections.sellOptionBDesc")}
            isOpen={openPanels.vender === "b"}
            onClick={() => togglePanel("vender", "b")}
          />
        </div>

        <div className={`cw-home-flow-panel ${openPanels.vender === "a" ? "open" : ""}`}>
          <div className="cw-home-flow-inner">
            <div className="cw-home-flow-header">{t("homeProcessSections.sellFlowAHeader")}</div>
            <div className="cw-home-filter-grid">
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowAPlateLabel")}</div><div className="cw-home-filter-value">1234 ABC</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowABrandLabel")}</div><div className="cw-home-filter-value">Volkswagen</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowAModelLabel")}</div><div className="cw-home-filter-value">Golf</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowAVersionLabel")}</div><div className="cw-home-filter-value">1.5 TSI Life</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowARegistrationLabel")}</div><div className="cw-home-filter-value">2020</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowAMileageLabel")}</div><div className="cw-home-filter-value">45.000 km</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowADamagesLabel")}</div><div className="cw-home-filter-value">{t("homeProcessSections.sellFlowADamagesValue")}</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">{t("homeProcessSections.sellFlowAResultLabel")}</div><div className="cw-home-filter-value acc">{t("homeProcessSections.sellFlowAResultValue")}</div></div>
            </div>
            <div className="cw-home-result-note">
              {t("homeProcessSections.sellFlowANote")}
            </div>
            <div className="cw-home-flow-actions">
              <button type="button" className="cw-home-flow-access-btn" onClick={onAccessSellInfo}>{t("sell.accessButton")}</button>
            </div>
          </div>
        </div>

        <FlowPanel
          isOpen={openPanels.vender === "b"}
          header={t("homeProcessSections.sellFlowBHeader")}
          onAccess={onAccessSellManaged}
          steps={[
            { n: 1, title: t("homeProcessSections.sellFlowBStep1"), sub: t("homeProcessSections.sellFlowBStep1Sub") },
            { n: 2, title: t("homeProcessSections.sellFlowBStep2") },
            { n: 3, title: t("homeProcessSections.sellFlowBStep3"), sub: t("homeProcessSections.sellFlowBStep3Sub") },
            { n: 4, title: t("homeProcessSections.sellFlowBStep4") },
            { n: 5, title: t("homeProcessSections.sellFlowBStep5") },
            { n: 6, title: t("homeProcessSections.sellFlowBStep6") },
            { n: 7, title: t("homeProcessSections.sellFlowBStep7") },
          ]}
        />
      </section>
    </div>
  );
}