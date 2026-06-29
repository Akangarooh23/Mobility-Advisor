import { useEffect, useMemo, useState } from "react";
import "./PricingPlansPage.css";

const PENDING_PLANS_SCROLL_KEY = "movilidad-advisor.plans.scroll-target";

export default function PricingPlansPage({
  uiLanguage = "es",
  onStartFree,
  onStartPlus,
  plusCheckoutLoading = false,
  plusCheckoutFeedback = "",
  onOpenServices,
  onOpenSellManagement,
  onOpenMarketReport,
  onOpenInsuranceReview,
  onOpenBoostListing,
  onOpenGuaranteeSeal,
  onOpenPremiumPublish,
  onTalkToTeam,
}) {
  const [billingMode, setBillingMode] = useState("monthly");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [activeSection, setActiveSection] = useState("planes");

  const handleStartFree = onStartFree || (() => {});
  const handleStartPlus = onStartPlus || (() => {});
  const handleOpenServices =
    onOpenServices ||
    (() => {
      if (typeof window === "undefined") {
        return;
      }

      const target = document.getElementById("premium");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  const handleSellManagement = onOpenSellManagement || (() => {});
  const handleMarketReport = onOpenMarketReport || (() => {});
  const handleInsuranceReview = onOpenInsuranceReview || (() => {});
  const handleBoostListing = onOpenBoostListing || (() => {});
  const handleGuaranteeSeal = onOpenGuaranteeSeal || (() => {});
  const handlePremiumPublish = onOpenPremiumPublish || (() => {});
  const handleTalkToTeam = onTalkToTeam || (() => {});

  const copy = useMemo(() => {
    if (uiLanguage === "en") {
      return {
        navPlans: "Plans",
        navServices: "Services",
        navCompare: "Compare",
        navFaq: "FAQ",
        heroBadge: "Simple pricing. Ongoing value.",
        heroTitleA: "Your car,",
        heroTitleB: "always under control",
        heroTitleC: ". No surprises.",
        heroSub: "Start free. Control, save and sell better with CarsWise AI.",
        monthly: "Monthly",
        annual: "Yearly",
        startFree: "Start free",
        startPlus: "Get Plus",
        premiumHeader: "Services on demand",
        premiumSub: "No extra subscription. Pay only when you need it.",
        compareTitle: "Everything included in each plan",
        compareEyebrow: "Full comparison",
        ctaTitle: "Start controlling your car today",
        ctaSub: "Free forever in the Free plan. No card required.",
        talkTeam: "Talk to the team",
        freeTag: "For exploration",
        freeTagline: "Compare cars, save options and register your vehicle.",
        plusTag: "For owners",
        plusTagline: "Total car control. No missed deadlines. No surprises.",
        includesLabel: "Includes",
        freeFeatures: [
          "Basic car comparison",
          "AI needs test",
          "1 IDCar with basic alert",
          "Estimated valuation",
          "Save up to 3 opportunities",
        ],
        plusFeatures: [
          "Control: up to 3 IDCars, full history and monthly value tracking",
          "Alerts: MOT, insurance and taxes",
          "Savings: avoid costs from missed deadlines",
        ],
        plusFutureFeatures: ["Workshop discounts", "Best time-to-sell alert"],
        servicesTag: "Pay only for what you need",
        servicesName: "Services",
        servicesTagline: "For selling, certifying and visibility boosts. No subscription.",
        servicesList: [
          ["Boost listing", "9-19 EUR"],
          ["Advanced market report", "10 EUR"],
          ["CarsWise guarantee seal", "29-49 EUR"],
          ["Insurance review", "Free"],
          ["Managed sale", "from 149 EUR"],
        ],
        servicesButton: "See all services",
        guaranteeText: "No card required for Free - cancel Plus anytime",
        plusPerMonth: "/month",
        plusIncludesLabel: "Everything in Free, plus",
        premiumTitle: "Resolve the specific moment you need",
        sellPills: ["Optimal valuation", "Professional listing", "Buyer filtering", "Assisted negotiation"],
        tableFeature: "Feature",
        tableFree: "Free",
        tablePlus: "Plus",
        compareRows: {
          s1: "Comparison and AI test",
          r1: ["Basic car comparison", "✓", "✓"],
          r2: ["AI needs test", "With account", "✓"],
          r3: ["Advanced comparison + AI shortlist", "-", "✓"],
          s2: "Vehicle control",
          r4: ["IDCar", "1", "Up to 3"],
          r5: ["History and documents", "-", "✓"],
          r6: ["Value tracking", "-", "Monthly"],
          s3: "Alerts",
          r7: ["Basic alert", "1 alert", "✓"],
          r8: ["MOT, insurance and taxes", "-", "✓"],
          r9: ["Best time to sell", "-", "Soon"],
        },
        premiumCards: {
          sell: {
            tag: "Resolution - High ticket",
            title: "Full sale management",
            desc: "CarsWise handles valuation, listing, buyers and closing.",
            price: "149-249 EUR",
            sub: "fixed fee or 2-3%",
            cta: "Request managed sale",
            note: "Pay fixed fee or success fee, depending on chosen model.",
          },
          report: {
            tag: "Resolution",
            title: "Advanced market report",
            desc: "Optimal price, historical trend and best moment-to-sell signal.",
            price: "10 EUR",
            sub: "one-time payment",
            cta: "Request report",
            note: "Automatic delivery in less than 5 minutes.",
          },
          insurance: {
            tag: "Resolution - Free",
            title: "Insurance review",
            desc: "Policy analysis and alternative quotes with better value.",
            price: "Free",
            sub: "affiliate-based",
            cta: "Review my insurance",
            note: "No direct cost for the end user.",
          },
          boost: {
            tag: "Visibility",
            title: "Boost listing",
            desc: "Move your listing to top positions for 7 or 14 days.",
            price: "9-19 EUR",
            sub: "per listing",
            cta: "Activate boost",
            note: "Instant activation.",
          },
          seal: {
            tag: "Trust",
            title: "CarsWise guarantee seal",
            desc: "Workshop inspection and verified badge in your ad.",
            price: "29-49 EUR",
            sub: "per vehicle",
            cta: "Certify my car",
            note: "Coordinated with CarsWise workshop network.",
          },
          publish: {
            tag: "Enhanced profile",
            title: "Premium listing",
            desc: "Up to 20 photos, video and verified seller badge for 30 days.",
            price: "29-39 EUR",
            sub: "per listing",
            cta: "Publish premium",
            note: "Compatible with boost listing.",
          },
        },
        faqEyebrow: "Frequently asked questions",
        faqTitle: "Everything you need to know",
        faqItems: [
          {
            q: "What is an IDCar?",
            a: "Your digital vehicle profile in CarsWise with key dates, documents and alerts.",
          },
          {
            q: "Can I cancel Plus anytime?",
            a: "Yes. No lock-in period and no penalty.",
          },
          {
            q: "Can Free users buy Premium services?",
            a: "Yes. Premium services are available independently for Free and Plus users.",
          },
          {
            q: "What does managed sale include?",
            a: "Valuation, listing, buyer filtering, negotiation support and transfer documentation.",
          },
          {
            q: "What does 'Soon' mean in Plus features?",
            a: "Those capabilities are in active development and will be released once operationally ready.",
          },
        ],
      };
    }

    return {
      navPlans: "Planes",
      navServices: "Servicios",
      navCompare: "Comparar",
      navFaq: "FAQ",
      heroBadge: "Precio simple. Valor continuo.",
      heroTitleA: "Tu coche,",
      heroTitleB: "siempre bajo control",
      heroTitleC: ". Sin sorpresas.",
      heroSub: "Empieza gratis. Controla, ahorra y vende mejor con CarsWise AI.",
      monthly: "Mensual",
      annual: "Anual",
      startFree: "Empezar gratis",
      startPlus: "Contratar",
      premiumHeader: "Servicios bajo demanda",
      premiumSub: "Sin suscripcion adicional. Pagas solo cuando lo necesitas.",
      compareTitle: "Todo lo que incluye cada plan",
      compareEyebrow: "Comparativa completa",
      ctaTitle: "Empieza a controlar tu coche hoy",
      ctaSub: "Gratis para siempre en el plan Free. Sin tarjeta.",
      talkTeam: "Hablar con el equipo",
      freeTag: "Para explorar",
      freeTagline: "Compara coches, guarda opciones y registra tu vehiculo.",
      plusTag: "Para propietarios",
      plusTagline: "Control total del coche. Sin olvidos, sin sorpresas, sin pagar de mas.",
      includesLabel: "Incluye",
      freeFeatures: [
        "Comparador basico de coches",
        "Test IA de necesidades",
        "1 IDCar con alerta basica",
        "Tasacion orientativa",
        "Guardar hasta 3 oportunidades",
      ],
      plusFeatures: [
        "Control: hasta 3 IDCars, historial y valor mensual",
        "Avisos: ITV, seguro e impuestos",
        "Ahorro: evita costes por olvidos",
      ],
      plusFutureFeatures: ["Descuentos en taller", "Mejor momento para vender"],
      servicesTag: "Paga solo lo que necesitas",
      servicesName: "Servicios",
      servicesTagline: "Para vender, certificar o destacar. Sin suscripcion.",
      servicesList: [
        ["Destacar anuncio", "9-19 EUR"],
        ["Informe de mercado", "10 EUR"],
        ["Sello de Garantia", "29-49 EUR"],
        ["Revision de seguro", "Gratis"],
        ["Gestion de venta", "desde 149 EUR"],
      ],
      servicesButton: "Ver todos los servicios",
      guaranteeText: "Sin tarjeta para el plan Free - Cancela Plus cuando quieras",
      plusPerMonth: "/mes",
      plusIncludesLabel: "Todo lo de Free, mas",
      premiumTitle: "Resuelve el momento que necesitas",
      sellPills: ["Valoracion optima", "Anuncio profesional", "Filtrado de compradores", "Negociacion asistida"],
      tableFeature: "Feature",
      tableFree: "Free",
      tablePlus: "Plus",
      compareRows: {
        s1: "Comparador y test IA",
        r1: ["Comparador basico de coches", "✓", "✓"],
        r2: ["Test IA de necesidades", "Con registro", "✓"],
        r3: ["Comparador avanzado + shortlist IA", "-", "✓"],
        s2: "Control del vehiculo",
        r4: ["IDCar", "1", "Hasta 3"],
        r5: ["Historial y documentacion", "-", "✓"],
        r6: ["Seguimiento de valor", "-", "Mensual"],
        s3: "Alertas",
        r7: ["Alerta basica", "1 alerta", "✓"],
        r8: ["ITV, seguro e impuestos", "-", "✓"],
        r9: ["Mejor momento para vender", "-", "Pronto"],
      },
      premiumCards: {
        sell: {
          tag: "Resolucion · Mayor ticket",
          title: "Gestion integral de venta",
          desc: "CarsWise gestiona valoracion, anuncio, compradores y cierre.",
          price: "149-249 EUR",
          sub: "fee fijo o 2-3%",
          cta: "Solicitar gestion",
          note: "Pago por fee o exito, segun modalidad.",
        },
        report: {
          tag: "Resolucion",
          title: "Informe de mercado avanzado",
          desc: "Precio optimo, historico y recomendacion de momento de venta.",
          price: "10 EUR",
          sub: "pago unico",
          cta: "Solicitar informe",
          note: "Entrega automatica en menos de 5 minutos.",
        },
        insurance: {
          tag: "Resolucion · Gratis",
          title: "Revision de seguro",
          desc: "Analisis de poliza y alternativas para ahorrar sin perder cobertura.",
          price: "Gratis",
          sub: "ingreso por afiliacion",
          cta: "Revisar mi seguro",
          note: "Sin coste para el usuario final.",
        },
        boost: {
          tag: "Visibilidad",
          title: "Destacar anuncio",
          desc: "Sube tu anuncio a posiciones top durante 7 o 14 dias.",
          price: "9-19 EUR",
          sub: "por anuncio",
          cta: "Activar destacar",
          note: "Activacion inmediata.",
        },
        seal: {
          tag: "Confianza",
          title: "Sello de Garantia CarsWise",
          desc: "Inspeccion en taller y badge verificado en tu anuncio.",
          price: "29-49 EUR",
          sub: "por vehiculo",
          cta: "Certificar mi coche",
          note: "Coordinacion con red de talleres CarsWise.",
        },
        publish: {
          tag: "Ficha ampliada",
          title: "Publicacion premium",
          desc: "Hasta 20 fotos, video y badge de vendedor verificado durante 30 dias.",
          price: "29-39 EUR",
          sub: "por anuncio",
          cta: "Publicar premium",
          note: "Compatible con destacar anuncio.",
        },
      },
      faqEyebrow: "Preguntas frecuentes",
      faqTitle: "Todo lo que necesitas saber",
      faqItems: [
        {
          q: "Que es una IDCar?",
          a: "La IDCar es la ficha digital de tu vehiculo en CarsWise con alertas, documentos e hitos clave.",
        },
        {
          q: "Puedo cancelar Plus cuando quiera?",
          a: "Si. Sin permanencia ni penalizacion.",
        },
        {
          q: "Los Servicios Premium son compatibles con Free?",
          a: "Si. Free y Plus pueden contratar Premium de forma independiente.",
        },
        {
          q: "Que incluye la gestion integral de venta?",
          a: "Valoracion, publicacion, filtrado de compradores, apoyo en negociacion y documentacion.",
        },
        {
          q: "Que significa 'Pronto' en la tabla?",
          a: "Son funcionalidades en desarrollo que se activaran cuando esten operativamente listas.",
        },
      ],
    };
  }, [uiLanguage]);

  useEffect(() => {
    const sections = ["planes", "premium", "comparar", "faq"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const pendingTarget = window.sessionStorage.getItem(PENDING_PLANS_SCROLL_KEY);
    if (!pendingTarget) {
      return undefined;
    }

    window.sessionStorage.removeItem(PENDING_PLANS_SCROLL_KEY);

    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(pendingTarget);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const plusPrice = billingMode === "annual"
    ? (uiLanguage === "en" ? "4.67 EUR" : "4,67 EUR")
    : (uiLanguage === "en" ? "6.99 EUR" : "6,99 EUR");
  const plusAnnual = billingMode === "annual"
    ? (uiLanguage === "en" ? "55.99 EUR/year - equivalent to 4.67 EUR/month" : "55,99 EUR/ano - equivale a 4,67 EUR/mes")
    : (uiLanguage === "en" ? "or 55.99 EUR/year - 2 months free" : "o 55,99 EUR/ano - 2 meses gratis");

  return (
    <div className="cw-pricing-page">
      <nav className="cw-pricing-subnav-wrap" aria-label="Secciones de precios">
        <ul className="cw-pricing-subnav">
          <li><a href="#planes" className={activeSection === "planes" ? "active" : ""}>{copy.navPlans}</a></li>
          <li><a href="#premium" className={activeSection === "premium" ? "active" : ""}>{copy.navServices}</a></li>
          <li><a href="#comparar" className={activeSection === "comparar" ? "active" : ""}>{copy.navCompare}</a></li>
          <li><a href="#faq" className={activeSection === "faq" ? "active" : ""}>{copy.navFaq}</a></li>
        </ul>
      </nav>

      <section className="cw-pricing-hero">
        <div className="cw-pricing-badge"><span className="cw-pricing-badge-dot" />{copy.heroBadge}</div>
        <h1>{copy.heroTitleA} <em>{copy.heroTitleB}</em>{copy.heroTitleC}</h1>
        <p>{copy.heroSub}</p>
        <div className="cw-billing-toggle">
          <button
            type="button"
            className={`cw-billing-btn${billingMode === "monthly" ? " active" : ""}`}
            onClick={() => setBillingMode("monthly")}
          >
            {copy.monthly}
          </button>
          <button
            type="button"
            className={`cw-billing-btn${billingMode === "annual" ? " active" : ""}`}
            onClick={() => setBillingMode("annual")}
          >
            {copy.annual} <span className="cw-save-badge">-33%</span>
          </button>
        </div>
      </section>

      <section className="cw-plans-section" id="planes">
        <div className="cw-plans-grid">
          <article className="cw-plan-card">
            <div className="cw-plan-tag">{copy.freeTag}</div>
            <div className="cw-plan-name">Free</div>
            <div className="cw-plan-tagline">{copy.freeTagline}</div>
            <div className="cw-plan-price"><span className="cw-price-amount">0 EUR</span></div>
            <div className="cw-price-annual">&nbsp;</div>
            <button type="button" className="cw-plan-cta" onClick={handleStartFree}>{copy.startFree}</button>
            <div className="cw-features-label">{copy.includesLabel}</div>
            <ul className="cw-feature-list">
              {copy.freeFeatures.map((item) => (
                <li key={item} className="cw-feature-item"><span className="cw-feature-check yes">✓</span><span>{item}</span></li>
              ))}
            </ul>
          </article>

          <article className="cw-plan-card featured">
            <div className="cw-plan-tag">{copy.plusTag}</div>
            <div className="cw-plan-name">Plus</div>
            <div className="cw-plan-tagline">{copy.plusTagline}</div>
            <div className="cw-plan-price"><span className="cw-price-amount">{plusPrice}</span><span className="cw-price-period">{copy.plusPerMonth}</span></div>
            <div className="cw-price-annual">{plusAnnual}</div>
            <button
              type="button"
              className="cw-plan-cta primary"
              onClick={() => handleStartPlus(billingMode)}
              disabled={plusCheckoutLoading}
              style={{ opacity: plusCheckoutLoading ? 0.7 : 1, cursor: plusCheckoutLoading ? "wait" : "pointer" }}
            >
              {plusCheckoutLoading ? "Cargando..." : copy.startPlus}
            </button>
            {plusCheckoutFeedback && (
              <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8, textAlign: "center", fontWeight: 600 }}>
                {plusCheckoutFeedback}
              </div>
            )}
            <div className="cw-features-label">{copy.plusIncludesLabel}</div>
            <ul className="cw-feature-list">
              {copy.plusFeatures.map((item) => (
                <li key={item} className="cw-feature-item"><span className="cw-feature-check yes">✓</span><span>{item}</span></li>
              ))}
              <hr className="cw-plan-divider" />
              {copy.plusFutureFeatures.map((item) => (
                <li key={item} className="cw-feature-item"><span className="cw-feature-check phase">F2</span><span>{item}</span></li>
              ))}
            </ul>
          </article>

          <article className="cw-plan-card services">
            <div className="cw-plan-tag" style={{ color: "var(--cw-teal)" }}>{copy.servicesTag}</div>
            <div className="cw-plan-name">{copy.servicesName}</div>
            <div className="cw-plan-tagline">{copy.servicesTagline}</div>
            <div className="cw-services-items">
              {copy.servicesList.map(([name, price]) => (
                <div key={name} className="cw-service-row"><span className="cw-service-row-name">{name}</span><span className="cw-service-row-price">{price}</span></div>
              ))}
            </div>
            <button type="button" className="cw-services-cta" onClick={handleOpenServices}>{copy.servicesButton} →</button>
          </article>
        </div>
        <div className="cw-guarantee">{copy.guaranteeText}</div>
      </section>

      <section className="cw-premium-section" id="premium">
        <div className="cw-section-header">
          <div className="cw-section-eyebrow">{copy.premiumHeader}</div>
          <h2 className="cw-section-title">{copy.premiumTitle}</h2>
          <p className="cw-section-sub">{copy.premiumSub}</p>
        </div>

        <div className="cw-premium-grid">
          <div className="cw-premium-row">
            <article className="cw-premium-card wide">
              <div className="cw-p-header">
                <div>
                  <span className="cw-p-tag res">{copy.premiumCards.sell.tag}</span>
                  <div className="cw-p-name">{copy.premiumCards.sell.title}</div>
                  <div className="cw-p-desc">{copy.premiumCards.sell.desc}</div>
                </div>
                <div className="cw-p-price"><span className="cw-p-price-main">{copy.premiumCards.sell.price}</span><span className="cw-p-price-sub">{copy.premiumCards.sell.sub}</span></div>
              </div>
              <div className="cw-p-pills">
                {copy.sellPills.map((pill) => (
                  <span key={pill} className="cw-p-pill">{pill}</span>
                ))}
              </div>
              <div className="cw-p-footer"><span className="cw-p-note">{copy.premiumCards.sell.note}</span><button type="button" className="cw-service-cta" onClick={handleSellManagement}>{copy.premiumCards.sell.cta} →</button></div>
            </article>

            <article className="cw-premium-card">
              <div className="cw-p-header">
                <div>
                  <span className="cw-p-tag res">{copy.premiumCards.report.tag}</span>
                  <div className="cw-p-name">{copy.premiumCards.report.title}</div>
                  <div className="cw-p-desc">{copy.premiumCards.report.desc}</div>
                </div>
                <div className="cw-p-price"><span className="cw-p-price-main">{copy.premiumCards.report.price}</span><span className="cw-p-price-sub">{copy.premiumCards.report.sub}</span></div>
              </div>
              <div className="cw-p-footer"><span className="cw-p-note">{copy.premiumCards.report.note}</span><button type="button" className="cw-service-cta" onClick={handleMarketReport}>{copy.premiumCards.report.cta} →</button></div>
            </article>

            <article className="cw-premium-card">
              <div className="cw-p-header">
                <div>
                  <span className="cw-p-tag res">{copy.premiumCards.insurance.tag}</span>
                  <div className="cw-p-name">{copy.premiumCards.insurance.title}</div>
                  <div className="cw-p-desc">{copy.premiumCards.insurance.desc}</div>
                </div>
                <div className="cw-p-price"><span className="cw-p-price-main">{copy.premiumCards.insurance.price}</span><span className="cw-p-price-sub">{copy.premiumCards.insurance.sub}</span></div>
              </div>
              <div className="cw-p-footer"><span className="cw-p-note">{copy.premiumCards.insurance.note}</span><button type="button" className="cw-service-cta" onClick={handleInsuranceReview}>{copy.premiumCards.insurance.cta} →</button></div>
            </article>

            <article className="cw-premium-card">
              <div className="cw-p-header">
                <div>
                  <span className="cw-p-tag vis">{copy.premiumCards.boost.tag}</span>
                  <div className="cw-p-name">{copy.premiumCards.boost.title}</div>
                  <div className="cw-p-desc">{copy.premiumCards.boost.desc}</div>
                </div>
                <div className="cw-p-price"><span className="cw-p-price-main">{copy.premiumCards.boost.price}</span><span className="cw-p-price-sub">{copy.premiumCards.boost.sub}</span></div>
              </div>
              <div className="cw-p-footer"><span className="cw-p-note">{copy.premiumCards.boost.note}</span><button type="button" className="cw-service-cta" onClick={handleBoostListing}>{copy.premiumCards.boost.cta} →</button></div>
            </article>

            <article className="cw-premium-card">
              <div className="cw-p-header">
                <div>
                  <span className="cw-p-tag vis">{copy.premiumCards.seal.tag}</span>
                  <div className="cw-p-name">{copy.premiumCards.seal.title}</div>
                  <div className="cw-p-desc">{copy.premiumCards.seal.desc}</div>
                </div>
                <div className="cw-p-price"><span className="cw-p-price-main">{copy.premiumCards.seal.price}</span><span className="cw-p-price-sub">{copy.premiumCards.seal.sub}</span></div>
              </div>
              <div className="cw-p-footer"><span className="cw-p-note">{copy.premiumCards.seal.note}</span><button type="button" className="cw-service-cta" onClick={handleGuaranteeSeal}>{copy.premiumCards.seal.cta} →</button></div>
            </article>

            <article className="cw-premium-card">
              <div className="cw-p-header">
                <div>
                  <span className="cw-p-tag vis">{copy.premiumCards.publish.tag}</span>
                  <div className="cw-p-name">{copy.premiumCards.publish.title}</div>
                  <div className="cw-p-desc">{copy.premiumCards.publish.desc}</div>
                </div>
                <div className="cw-p-price"><span className="cw-p-price-main">{copy.premiumCards.publish.price}</span><span className="cw-p-price-sub">{copy.premiumCards.publish.sub}</span></div>
              </div>
              <div className="cw-p-footer"><span className="cw-p-note">{copy.premiumCards.publish.note}</span><button type="button" className="cw-service-cta" onClick={handlePremiumPublish}>{copy.premiumCards.publish.cta} →</button></div>
            </article>
          </div>
        </div>
      </section>

      <section className="cw-compare-section" id="comparar">
        <div className="cw-section-header" style={{ textAlign: "left" }}>
          <div className="cw-section-eyebrow">{copy.compareEyebrow}</div>
          <h2 className="cw-section-title">{copy.compareTitle}</h2>
        </div>
        <table className="cw-compare-table">
          <thead>
            <tr>
              <th style={{ width: "48%" }}>{copy.tableFeature}</th>
              <th className="center" style={{ width: "22%" }}>{copy.tableFree}</th>
              <th className="center plus-col" style={{ width: "30%" }}>{copy.tablePlus} · {plusPrice}{copy.plusPerMonth}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="cw-row-section"><td colSpan="3">{copy.compareRows.s1}</td></tr>
            <tr><td>{copy.compareRows.r1[0]}</td><td className="center">{copy.compareRows.r1[1]}</td><td className="center plus-col">{copy.compareRows.r1[2]}</td></tr>
            <tr><td>{copy.compareRows.r2[0]}</td><td className="center">{copy.compareRows.r2[1]}</td><td className="center plus-col">{copy.compareRows.r2[2]}</td></tr>
            <tr><td>{copy.compareRows.r3[0]}</td><td className="center">{copy.compareRows.r3[1]}</td><td className="center plus-col">{copy.compareRows.r3[2]}</td></tr>
            <tr className="cw-row-section"><td colSpan="3">{copy.compareRows.s2}</td></tr>
            <tr><td>{copy.compareRows.r4[0]}</td><td className="center">{copy.compareRows.r4[1]}</td><td className="center plus-col">{copy.compareRows.r4[2]}</td></tr>
            <tr><td>{copy.compareRows.r5[0]}</td><td className="center">{copy.compareRows.r5[1]}</td><td className="center plus-col">{copy.compareRows.r5[2]}</td></tr>
            <tr><td>{copy.compareRows.r6[0]}</td><td className="center">{copy.compareRows.r6[1]}</td><td className="center plus-col">{copy.compareRows.r6[2]}</td></tr>
            <tr className="cw-row-section"><td colSpan="3">{copy.compareRows.s3}</td></tr>
            <tr><td>{copy.compareRows.r7[0]}</td><td className="center">{copy.compareRows.r7[1]}</td><td className="center plus-col">{copy.compareRows.r7[2]}</td></tr>
            <tr><td>{copy.compareRows.r8[0]}</td><td className="center">{copy.compareRows.r8[1]}</td><td className="center plus-col">{copy.compareRows.r8[2]}</td></tr>
            <tr><td>{copy.compareRows.r9[0]}</td><td className="center">{copy.compareRows.r9[1]}</td><td className="center plus-col">{copy.compareRows.r9[2]}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="cw-faq-section" id="faq">
        <div className="cw-faq-inner">
          <div className="cw-section-header">
            <div className="cw-section-eyebrow">{copy.faqEyebrow}</div>
            <h2 className="cw-section-title">{copy.faqTitle}</h2>
          </div>
          <div className="cw-faq-list">
            {copy.faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.q} className={`cw-faq-item${isOpen ? " open" : ""}`}>
                  <button type="button" className="cw-faq-q" onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}>
                    {item.q}
                    <span className="cw-faq-icon">+</span>
                  </button>
                  <div className="cw-faq-a">{item.a}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="cw-cta-section">
        <h2>{copy.ctaTitle}</h2>
        <p>{copy.ctaSub}</p>
        <div className="cw-cta-group">
          <button type="button" className="cw-cta-btn-primary" onClick={handleStartFree}>{copy.startFree} →</button>
          <button type="button" className="cw-cta-btn-outline" onClick={handleTalkToTeam}>{copy.talkTeam}</button>
        </div>
      </section>
    </div>
  );
}
