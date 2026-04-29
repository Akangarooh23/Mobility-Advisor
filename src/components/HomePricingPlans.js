import { useEffect, useMemo, useRef, useState } from "react";
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
}) {
  const [isAnnual, setIsAnnual] = useState(false);
  const sectionRef = useRef(null);

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
        <div className="cw-plans-hero-badge">Planes de gestion y servicios</div>
        <h2>
          Elige el plan <span>que mejor se adapta a ti</span>
        </h2>
        <p>
          Sin permanencias. Cambia o cancela cuando quieras. Todos los planes incluyen acceso a tu panel CarWise.
        </p>

        <div className="cw-plans-toggle-wrap">
          <span className={`cw-plans-toggle-label ${!isAnnual ? "active" : ""}`}>Mensual</span>
          <button
            type="button"
            className={`cw-plans-toggle ${isAnnual ? "is-annual" : ""}`}
            onClick={() => setIsAnnual((prev) => !prev)}
            aria-label="Cambiar tipo de facturacion"
          />
          <span className={`cw-plans-toggle-label ${isAnnual ? "active" : ""}`}>Anual</span>
          <span className="cw-plans-save">Ahorra 20%</span>
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
              {plan.featured ? <div className="cw-plan-featured-badge">Mas popular</div> : null}
              <div className="cw-plan-tag">{plan.badge}</div>
              <div className="cw-plan-name">{plan.name}</div>
              <div className="cw-plan-price">
                <span className="currency">EUR</span>
                <span className="amount">{plan.displayPrice}</span>
                <span className="period">/{isAnnual ? "mes (fact. anual)" : "mes"}</span>
              </div>
              <div className="cw-plan-divider" />
              <ul className="cw-plan-features">
                {plan.highlights.map((item) => (
                  <li key={`${plan.id}-${item}`}>{item}</li>
                ))}
              </ul>
              <button
                type="button"
                className="cw-plan-cta"
                onClick={() => onSelectSubscriptionPlan?.(plan)}
                disabled={Boolean(planCheckoutLoadingId && planCheckoutLoadingId !== plan.id)}
              >
                {planCheckoutLoadingId === plan.id ? "Abriendo pasarela..." : plan.ctaLabel}
              </button>
              <div className="cw-plan-secure">Pago seguro</div>
            </article>
          );
        })}
      </div>

      {planCheckoutFeedback ? <div className="cw-plans-feedback">{planCheckoutFeedback}</div> : null}

      <div className="cw-plans-table-wrap cw-plans-reveal">
        <div className="cw-plans-table-title">Comparativa detallada de coberturas</div>
        <table className="cw-plans-comp-table">
          <thead>
            <tr>
              <th>Cobertura</th>
              {plans.map((plan) => (
                <th key={`${plan.id}-th`} className={plan.featured ? "col-featured" : ""}>
                  {plan.name.replace("Plan ", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_COMPARISON_ROWS.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                {row.values.map((value, index) => (
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
