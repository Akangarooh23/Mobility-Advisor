import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./CircularSteps.css";

const STEP_DEFINITIONS = [
  { key: "step1", icon: "🚗", color: "#F6C21B", action: "buy", position: "top" },
  { key: "step2", icon: "🛠️", color: "#21C7C9", action: "service", position: "right" },
  { key: "step3", icon: "💵", color: "#E84DAE", action: "sell", position: "left" },
];

const AUTO_ADVANCE_MS = 3600;
const CIRCLE_SIZE = 360;
const CENTER = CIRCLE_SIZE / 2;
const RADIUS = 118;
const GAP_DEGREES = 16;

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function CircularSteps({ onSelectBuy, onSelectService, onSelectSell }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const steps = useMemo(() => {
    const segmentSweep = (360 - GAP_DEGREES * STEP_DEFINITIONS.length) / STEP_DEFINITIONS.length;

    return STEP_DEFINITIONS.map((step, index) => {
      const startAngle = -90 + index * (segmentSweep + GAP_DEGREES);
      const endAngle = startAngle + segmentSweep;
      const midAngle = startAngle + segmentSweep / 2;

      return {
        ...step,
        tag: t(`circularSteps.${step.key}Tag`),
        title: t(`circularSteps.${step.key}Title`),
        desc: t(`circularSteps.${step.key}Desc`),
        startAngle,
        endAngle,
        midAngle,
        arcPath: describeArc(CENTER, CENTER, RADIUS, startAngle, endAngle),
        iconPoint: polarToCartesian(CENTER, CENTER, RADIUS, midAngle),
      };
    });
  }, [t]);

  const stepActions = {
    buy: onSelectBuy,
    sell: onSelectSell,
    service: onSelectService,
  };

  useEffect(() => {
    if (isHovering) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [isHovering, steps.length]);

  function handleSelect(step) {
    const action = stepActions[step.action];
    if (typeof action === "function") {
      action();
    }
  }

  function handleKeyDown(event, step) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(step);
    }
  }

  return (
    <section className="cw-process-wrap">
      <header className="cw-process-header">
        <h2>{t("circularSteps.whatToDoToday")}</h2>
        <p>{t("circularSteps.selectOption")}</p>
      </header>

      <div className="cw-process-visual" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
        <div className="cw-process-ring-stage">
          <svg className="cw-process-ring" viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`} role="img" aria-label="Ciclo de servicios CarsWise">
            <circle cx={CENTER} cy={CENTER} r={RADIUS} className="cw-process-ring-base" />

            {steps.map((step, index) => {
              const isActive = currentStep === index;

              return (
                <path
                  key={step.key}
                  d={step.arcPath}
                  className={`cw-process-segment ${isActive ? "is-active" : ""}`}
                  stroke={step.color}
                  style={{ opacity: isActive ? 1 : 0.35 }}
                />
              );
            })}
          </svg>

          <div className="cw-process-center" aria-hidden="true">
            <span>{`${currentStep + 1} ${t("circularSteps.stepsOf")}`}</span>
            <strong>{currentStep + 1}</strong>
          </div>

          {steps.map((step, index) => {
            const isActive = currentStep === index;
            const iconStyle = {
              left: `${step.iconPoint.x}px`,
              top: `${step.iconPoint.y}px`,
              borderColor: isActive ? step.color : "rgba(148,163,184,0.28)",
              color: step.color,
            };

            return (
              <button
                key={`${step.key}-icon`}
                type="button"
                className={`cw-process-icon ${isActive ? "is-active" : ""}`}
                style={iconStyle}
                onClick={() => {
                  setCurrentStep(index);
                  handleSelect(step);
                }}
                aria-label={`${t("circularSteps.goTo")} ${step.title}`}
              >
                {step.icon}
              </button>
            );
          })}
        </div>

        {steps.map((step, index) => {
          const isActive = currentStep === index;
          return (
            <article
              key={`${step.key}-text`}
              className={`cw-process-copy cw-process-copy-${step.position} ${isActive ? "is-active" : ""}`}
              onMouseEnter={() => setCurrentStep(index)}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(step)}
              onKeyDown={(event) => handleKeyDown(event, step)}
            >
              <span style={{ color: step.color }}>{step.tag}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
