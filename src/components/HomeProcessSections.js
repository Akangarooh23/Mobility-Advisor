import { useEffect, useRef, useState } from "react";
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
          <button type="button" className="cw-home-flow-access-btn" onClick={onAccess}>Acceder</button>
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
}) {
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
      [section]: option,
    }));
  };

  return (
    <div className="cw-home-process" ref={rootRef}>
      <section id="como">
        <div className="cw-home-section-label cw-home-reveal">El proceso</div>
        <h1 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">Como funciona?</h1>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          Elige tu punto de partida y te guiamos paso a paso. Tanto si ya sabes lo que buscas como si necesitas orientacion para encontrarlo.
        </p>
      </section>

      <section id="comprar">
        <div className="cw-home-section-num">1</div>
        <div className="cw-home-section-label cw-home-reveal">Compra</div>
        <h2 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">Quiero comprar</h2>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          Dinos cuanto sabes ya sobre lo que quieres y empezamos desde ahi. Analizamos el mercado en tiempo real para encontrar las mejores opciones.
        </p>

        <div className="cw-home-path-grid">
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d1"
            badge="Opcion A"
            title="Ya se que modelo me interesa"
            description="Si tienes claro que modelo quieres, indicanos area, rango de precios y kilometros. Analizamos las ofertas actuales bajo esos parametros."
            isOpen={openPanels.comprar === "a"}
            onClick={() => togglePanel("comprar", "a")}
          />
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d2"
            badge="Opcion B"
            title="Ayudame a encontrar los modelos que mejor se adapten a mi"
            description="Realiza nuestro test para conocernos y ayudarte a elegir el coche que encaje con tu estilo de vida y desplazamientos."
            isOpen={openPanels.comprar === "b"}
            onClick={() => togglePanel("comprar", "b")}
          />
        </div>

        <FlowPanel
          isOpen={openPanels.comprar === "a"}
          header="Flujo A - Modelo conocido - 6 pasos"
          onAccess={onAccessBuyKnownModel}
          steps={[
            { n: 1, title: "Selecciona el modelo", sub: "Marca, modelo y version" },
            { n: 2, title: "Establece tus limites geograficos y de precio" },
            { n: 3, title: "Analizamos anuncios en tiempo real", sub: "Precio, proveedor y caracteristicas del vehiculo" },
            { n: 4, title: "Te ofrecemos las 5 mejores opciones" },
            { n: 5, title: "Agendamos una cita con el vendedor" },
            { n: 6, title: "Te buscamos la mejor financiacion" },
          ]}
        />

        <FlowPanel
          isOpen={openPanels.comprar === "b"}
          header="Flujo B - Test CarWise - seleccion personalizada"
          onAccess={onAccessBuyGuided}
          steps={[
            { n: 1, title: "Test CarWise", sub: "Estilo de vida, desplazamientos, entorno legal" },
            { n: 2, title: "Establece tus limites geograficos y de precio" },
            { n: 3, title: "Analizamos anuncios en tiempo real" },
            { n: 4, title: "Te ofrecemos las 5 mejores opciones" },
            { n: 5, title: "Agendamos una cita con el vendedor" },
            { n: 6, title: "Te buscamos la mejor financiacion" },
          ]}
        />
      </section>

      <section id="vender">
        <div className="cw-home-section-num">2</div>
        <div className="cw-home-section-label cw-home-reveal">Venta</div>
        <h2 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">Quiero vender</h2>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          Tanto si quieres gestionar la venta tu mismo con informacion de mercado como si prefieres que lo hagamos por ti de principio a fin.
        </p>

        <div className="cw-home-path-grid">
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d1"
            badge="Opcion A"
            title="Te damos la informacion para vender"
            description="No tasamos tu vehiculo, te damos informacion de mercado: precio medio actual y numero de unidades en venta en los principales portales."
            isOpen={openPanels.vender === "a"}
            onClick={() => togglePanel("vender", "a")}
          />
          <FlowCard
            className="cw-home-reveal cw-home-reveal-d2"
            badge="Opcion B"
            title="Te ayudamos a vender como un profesional"
            description="Definimos el precio, publicamos en portales, filtramos llamadas, agendamos citas y gestionamos la venta completa por ti."
            isOpen={openPanels.vender === "b"}
            onClick={() => togglePanel("vender", "b")}
          />
        </div>

        <div className={`cw-home-flow-panel ${openPanels.vender === "a" ? "open" : ""}`}>
          <div className="cw-home-flow-inner">
            <div className="cw-home-flow-header">Consulta de valor de mercado - introduce los datos de tu vehiculo</div>
            <div className="cw-home-filter-grid">
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Matricula</div><div className="cw-home-filter-value">1234 ABC</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Marca</div><div className="cw-home-filter-value">Volkswagen</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Modelo</div><div className="cw-home-filter-value">Golf</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Version</div><div className="cw-home-filter-value">1.5 TSI Life</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Matriculacion</div><div className="cw-home-filter-value">2020</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Kilometros</div><div className="cw-home-filter-value">45.000 km</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Danos</div><div className="cw-home-filter-value">Sin danos visibles</div></div>
              <div className="cw-home-filter-field"><div className="cw-home-filter-label">Resultado</div><div className="cw-home-filter-value acc">Precio medio + unidades</div></div>
            </div>
            <div className="cw-home-result-note">
              Recibiras el precio medio al que se oferta actualmente en los principales portales y el numero de unidades encontradas a la venta con esas caracteristicas.
            </div>
            <div className="cw-home-flow-actions">
              <button type="button" className="cw-home-flow-access-btn" onClick={onAccessSellInfo}>Acceder</button>
            </div>
          </div>
        </div>

        <FlowPanel
          isOpen={openPanels.vender === "b"}
          header="Flujo B - Venta asistida integral - 7 pasos"
          onAccess={onAccessSellManaged}
          steps={[
            { n: 1, title: "Acudimos a verte si es necesario", sub: "Certificamos el estado real del vehiculo" },
            { n: 2, title: "Acordamos el precio de venta contigo" },
            { n: 3, title: "Valoramos arreglarlo si mejora su posicionamiento", sub: "Opcion de preparacion previa a la venta" },
            { n: 4, title: "Publicamos anuncios en los principales portales", sub: "Con las mejores fotos y descripcion, por ti" },
            { n: 5, title: "Recibimos y filtramos las llamadas de interesados", sub: "Solo te trasladamos clientes potenciales reales" },
            { n: 6, title: "Agendamos citas segun tu disponibilidad", sub: "Los compradores van a tu casa a ver el coche" },
            { n: 7, title: "Soporte integral en todos los tramites de la venta", sub: "Contrato, transferencia y gestion documental" },
          ]}
        />
      </section>

      <section id="servicios">
        <div className="cw-home-section-num">3</div>
        <div className="cw-home-section-label cw-home-reveal">Servicios</div>
        <h2 className="cw-home-section-title cw-home-reveal cw-home-reveal-d1">Quiero contratar un servicio</h2>
        <p className="cw-home-section-desc cw-home-reveal cw-home-reveal-d2">
          Herramientas para que tu relacion con tu coche sea mas sencilla, economica y sin sorpresas.
        </p>

        <div className="cw-home-svc-grid">
          <article className="cw-home-svc-card cw-home-reveal"><div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg></div><div className="cw-home-svc-pill">A - Autogestor</div><h3>ID digital de tu vehiculo</h3><p>Toda la informacion de tu coche desde una unica plataforma: documentacion, poliza, facturas de mantenimientos y garantias. No vuelvas a perder un papel.</p></article>
          <article className="cw-home-svc-card cw-home-reveal cw-home-reveal-d1"><div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div><div className="cw-home-svc-pill">B - Mantenimientos</div><h3>Recordatorio inteligente</h3><p>Cruzamos los datos de tu vehiculo con el plan de mantenimientos definido por la marca y te avisamos cuando toca. Agenda cita con nuestros proveedores.</p></article>
          <article className="cw-home-svc-card cw-home-reveal cw-home-reveal-d2"><div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg></div><div className="cw-home-svc-pill">C - Cita mantenimientos</div><h3>Precios de acuerdo, no de particular</h3><p>Aprovecha nuestros acuerdos para conseguir precios mas reducidos y agenda tu proxima revision a traves nuestra.</p></article>
          <article className="cw-home-svc-card cw-home-reveal cw-home-reveal-d1"><div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg></div><div className="cw-home-svc-pill">D - Cuota mensual</div><h3>Tu mantenimiento en una cuota fija</h3><p>Quieres pagar una cuota mensual por el mantenimiento preventivo de tu coche y no llevarte mas sustos antes de vacaciones? Con nosotros es posible.</p></article>
          <article className="cw-home-svc-card cw-home-reveal cw-home-reveal-d2"><div className="cw-home-svc-icon"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg></div><div className="cw-home-svc-pill">E - Seguro - AInsurance</div><h3>Entiende de verdad tu poliza</h3><p>Sube tu poliza y nuestra IA lee las condiciones. Te resumimos ventajas, puntos debiles y te ayudamos a buscar opciones mas completas o economicas en la renovacion.</p></article>
        </div>
      </section>
    </div>
  );
}