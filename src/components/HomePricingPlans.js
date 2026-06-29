import { useMemo, useState } from "react";
import "./HomePricingPlans.css";

export default function HomePricingPlans({
  onOpenPlans,
  onOpenPlansSection,
  uiLanguage = "es",
}) {
  const [isAnnual, setIsAnnual] = useState(false);
  const isEnglish = uiLanguage === "en";

  const copy = useMemo(() => {
    if (isEnglish) {
      return {
        helperText: "Start free. Control, save and sell better with CarsWise AI.",
        monthly: "Monthly",
        yearly: "Yearly",
        save: "-14%",
        featured: "Most popular",
        freeTag: "For exploration",
        freeTitle: "Free",
        freeDescription: "Compare cars, save options and register your vehicle.",
        freeCta: "Start free",
        freeIncludes: "Includes",
        freeFeatures: [
          "Basic car comparison",
          "AI needs test",
          "1 IDCar with basic alert",
          "Estimated valuation",
          "Save up to 3 opportunities",
        ],
        plusTitle: "Plus",
        plusDescription: "Total car control. No missed deadlines. No surprises.",
        plusCta: "Try 30 days free",
        plusIncludes: "Everything in Free, plus",
        plusFeatures: [
          "Control: up to 3 IDCars, full history and monthly value tracking",
          "Alerts: MOT, insurance and taxes",
          "Savings: avoid costs from missed deadlines",
        ],
        plusFuture: ["Workshop discounts", "Best time-to-sell alert"],
        servicesTag: "Pay only for what you need",
        servicesTitle: "Services",
        servicesDescription: "For selling, certifying and visibility boosts. No subscription.",
        servicesRows: [
          ["Boost listing", "9-19 EUR"],
          ["Advanced market report", "10 EUR"],
          ["CarsWise guarantee seal", "29-49 EUR"],
          ["Insurance review", "Free"],
          ["Managed sale", "from 149 EUR"],
        ],
        servicesCta: "See all services",
        goPlans: "Go to plans page",
      };
    }

    return {
      helperText: "Empieza gratis. Controla, ahorra y vende mejor con CarsWise AI.",
      monthly: "Mensual",
      yearly: "Anual",
      save: "-14%",
      featured: "Mas popular",
      freeTag: "Para explorar",
      freeTitle: "Free",
      freeDescription: "Compara coches, guarda opciones y registra tu vehiculo.",
      freeCta: "Empezar gratis",
      freeIncludes: "Incluye",
      freeFeatures: [
        "Comparador basico de coches",
        "Test IA de necesidades",
        "1 IDCar con alerta basica",
        "Tasacion orientativa",
        "Guardar hasta 3 oportunidades",
      ],
      plusTitle: "Plus",
      plusDescription: "Control total del coche. Sin olvidos. Sin sorpresas.",
      plusCta: "Probar 30 dias gratis",
      plusIncludes: "Todo lo de Free, mas",
      plusFeatures: [
        "Control: hasta 3 IDCars, historial y valor mensual",
        "Avisos: ITV, seguro e impuestos",
        "Ahorro: evita costes por olvidos",
      ],
      plusFuture: ["Descuentos en taller", "Mejor momento para vender"],
      servicesTag: "Paga solo lo que necesitas",
      servicesTitle: "Servicios",
      servicesDescription: "Para vender, certificar y destacar. Sin suscripcion.",
      servicesRows: [
        ["Destacar anuncio", "9-19 EUR"],
        ["Informe de mercado", "10 EUR"],
        ["Sello de Garantia CarsWise", "29-49 EUR"],
        ["Revision de seguro", "Gratis"],
        ["Gestion de venta", "desde 149 EUR"],
      ],
      servicesCta: "Ver todos los servicios",
      goPlans: "Ver planes completos",
    };
  }, [isEnglish]);

  const plusPrice = isAnnual
    ? (isEnglish ? "4.99 EUR" : "4,99 EUR")
    : (isEnglish ? "6.99 EUR" : "6,99 EUR");
  const plusSecondary = isAnnual
    ? (isEnglish ? "59.99 EUR/year - equivalent to 4.99 EUR/month" : "59,99 EUR/ano - equivale a 4,99 EUR/mes")
    : (isEnglish ? "or 59.99 EUR/year - 2 months free" : "o 59,99 EUR/ano - 2 meses gratis");

  return (
    <section className="cw-home-plans-preview">
      <p className="cw-home-plans-helper">{copy.helperText}</p>

      <div className="cw-home-plans-toggle" role="group" aria-label={isEnglish ? "Billing mode" : "Tipo de facturacion"}>
        <button
          type="button"
          className={`cw-home-plans-toggle-btn${!isAnnual ? " active" : ""}`}
          onClick={() => setIsAnnual(false)}
        >
          {copy.monthly}
        </button>
        <button
          type="button"
          className={`cw-home-plans-toggle-btn${isAnnual ? " active" : ""}`}
          onClick={() => setIsAnnual(true)}
        >
          {copy.yearly} <span className="cw-home-plans-save">{copy.save}</span>
        </button>
      </div>

      <div className="cw-home-plans-grid">
        <article className="cw-home-plan-card">
          <div className="cw-home-plan-tag">{copy.freeTag}</div>
          <h3 className="cw-home-plan-name">{copy.freeTitle}</h3>
          <p className="cw-home-plan-description">{copy.freeDescription}</p>
          <div className="cw-home-plan-price">0 EUR</div>
          <button type="button" className="cw-home-plan-cta" onClick={onOpenPlans}>
            {copy.freeCta}
          </button>
          <div className="cw-home-plan-includes">{copy.freeIncludes}</div>
          <ul className="cw-home-plan-list">
            {copy.freeFeatures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="cw-home-plan-card featured">
          <div className="cw-home-plan-featured">{copy.featured}</div>
          <h3 className="cw-home-plan-name">{copy.plusTitle}</h3>
          <p className="cw-home-plan-description">{copy.plusDescription}</p>
          <div className="cw-home-plan-price-row">
            <span className="cw-home-plan-price">{plusPrice}</span>
            <span className="cw-home-plan-period">{isEnglish ? "/month" : "/mes"}</span>
          </div>
          <div className="cw-home-plan-secondary">{plusSecondary}</div>
          <button type="button" className="cw-home-plan-cta primary" onClick={onOpenPlans}>
            {copy.plusCta}
          </button>
          <div className="cw-home-plan-includes">{copy.plusIncludes}</div>
          <ul className="cw-home-plan-list">
            {copy.plusFeatures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <hr className="cw-home-plan-divider" />
          <ul className="cw-home-plan-list future">
            {copy.plusFuture.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="cw-home-plan-card services">
          <div className="cw-home-plan-tag services">{copy.servicesTag}</div>
          <h3 className="cw-home-plan-name">{copy.servicesTitle}</h3>
          <p className="cw-home-plan-description">{copy.servicesDescription}</p>
          <div className="cw-home-services-list">
            {copy.servicesRows.map(([name, price]) => (
              <div key={name} className="cw-home-service-row">
                <span>{name}</span>
                <strong>{price}</strong>
              </div>
            ))}
          </div>
          <button type="button" className="cw-home-plan-cta services" onClick={() => onOpenPlansSection?.("premium") || onOpenPlans?.()}>
            {copy.servicesCta}{" ->"}
          </button>
        </article>
      </div>

      <div className="cw-home-plans-footer-cta-wrap">
        <button type="button" className="cw-home-plans-footer-cta" onClick={onOpenPlans}>
          {copy.goPlans}
        </button>
      </div>
    </section>
  );
}
