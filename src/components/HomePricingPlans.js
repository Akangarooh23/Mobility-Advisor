import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PLAN_COMPARISON_ROWS, SERVICE_PLANS } from "../data/servicePlans";
import "./HomePricingPlans.css";

const DISCOUNT_FACTOR = 0.8;

function getPriceByMode(monthlyPrice, isAnnual) {
  const monthly = Number(monthlyPrice || 0);
  if (!Number.isFinite(monthly)) {
    return monthlyPrice;
  }
  if (!isAnnual) {
    return String(monthly);
  }
  return String(Math.round(monthly * DISCOUNT_FACTOR));
}

export default function HomePricingPlans({
  onSelectSubscriptionPlan,
  planCheckoutLoadingId,
  planCheckoutFeedback,
  uiLanguage = "es",
}) {
  const { t } = useTranslation();
  const [isAnnual, setIsAnnual] = useState(false);
  const sectionRef = useRef(null);
  
  const isEnglish = uiLanguage === "en";

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !sectionRef.current) {
      return undefined;
    }

    const targets = sectionRef.current.querySelectorAll(".cw-plans-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
          }
        });
      },
      { threshold: 0.1 }
    );

    targets.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const plans = useMemo(
    () =>
      SERVICE_PLANS.map((plan) => ({
        ...plan,
        displayPrice: getPriceByMode(plan.monthlyPrice, isAnnual),
      })),
    [isAnnual]
  );

  return (
    <section className="cw-plans" ref={sectionRef}>
      <div className="cw-plans-hero">
        <div className="cw-plans-hero-badge">{t("homePricingPlans.badge")}</div>
        <h2>
          {t("homePricingPlans.title")} <span>{t("homePricingPlans.titleHighlight")}</span>
        </h2>
        <p>
          {t("homePricingPlans.description")}
        </p>

        <div className="cw-plans-toggle-wrap">
          <span className={`cw-plans-toggle-label ${!isAnnual ? "active" : ""}`}>{t("homePricingPlans.monthly")}</span>
          <button
            type="button"
            className={`cw-plans-toggle ${isAnnual ? "is-annual" : ""}`}
            onClick={() => setIsAnnual((prev) => !prev)}
            aria-label="Change billing type"
          />
          <span className={`cw-plans-toggle-label ${isAnnual ? "active" : ""}`}>{t("homePricingPlans.annual")}</span>
          <span className="cw-plans-save">{t("homePricingPlans.save")}</span>
        </div>
      </div>

      <div className="cw-plans-grid">
        {plans.map((plan, index) => {
          const theme = plan.id;
          return (
            <article
              key={plan.id}
              className={`cw-plan-card ${theme} ${plan.featured ? "featured" : ""} cw-plans-reveal cw-plans-reveal-d${Math.min(index, 5)}`}
            >
              {plan.featured ? <div className="cw-plan-featured-badge">{t("homePricingPlans.mostPopular")}</div> : null}
              <div className="cw-plan-tag">{isEnglish ? plan.badgeEn : plan.badge}</div>
              <div className="cw-plan-name">{isEnglish ? plan.nameEn : plan.name}</div>
              <div className="cw-plan-price">
                <span className="currency">EUR</span>
                <span className="amount">{plan.displayPrice}</span>
                <span className="period">/{isAnnual ? t("homePricingPlans.annualPeriod") : t("homePricingPlans.monthlyPeriod")}</span>
              </div>
              <div className="cw-plan-divider" />
              <ul className="cw-plan-features">
                {(isEnglish ? plan.highlightsEn : plan.highlights).map((item) => (
                  <li key={`${plan.id}-${item}`}>{item}</li>
                ))}
              </ul>
              <button
                type="button"
                className="cw-plan-cta"
                onClick={() => onSelectSubscriptionPlan?.(plan)}
                disabled={Boolean(planCheckoutLoadingId && planCheckoutLoadingId !== plan.id)}
              >
                {planCheckoutLoadingId === plan.id ? t("homePricingPlans.loading") : (isEnglish ? plan.ctaLabelEn : plan.ctaLabel)}
              </button>
              <div className="cw-plan-secure">{t("homePricingPlans.secure")}</div>
            </article>
          );
        })}
      </div>

      {planCheckoutFeedback ? <div className="cw-plans-feedback">{planCheckoutFeedback}</div> : null}

      <div className="cw-plans-table-wrap cw-plans-reveal">
        <div className="cw-plans-table-title">{t("homePricingPlans.comparisonTitle")}</div>
        <table className="cw-plans-comp-table">
          <thead>
            <tr>
              <th>{t("homePricingPlans.comparisonColumnLabel")}</th>
              {plans.map((plan) => (
                <th key={`${plan.id}-th`} className={plan.featured ? "col-featured" : ""}>
                  {(isEnglish ? plan.nameEn : plan.name).replace("Plan ", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_COMPARISON_ROWS.map((row) => (
              <tr key={row.label}>
                <td>{isEnglish ? row.labelEn : row.label}</td>
                {(isEnglish ? row.valuesEn : row.values).map((value, index) => (
                  <td key={`${row.label}-${index}`} className={plans[index]?.featured ? "col-featured" : ""}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
