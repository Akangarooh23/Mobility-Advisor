import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./LandingPage.css";

// ── Datos de ofertas reales de la DB ──────────────────────────
const EXCLUSIVE_OFFERS = [
  {
    id: "vian_91767704",
    brand: "Fiat",
    model: "500",
    year: 2022,
    mileage: 81150,
    price: 8790,
    fuel: "Gasolina",
    badge: "Concesionario",
    badgeEN: "Dealership",
    image: "https://media.staticmf.com/media/530846/0/4788LZL/image/default/57f3b2a1a4a1251bef16e47ac340850b/qzgrpakrqzeyiqiwjpg-1.jpg",
  },
  {
    id: "leasys-vxkuphnekn4329001",
    brand: "Opel",
    model: "Corsa 6",
    year: 2022,
    mileage: 44857,
    price: 7905,
    fuel: "Gasolina",
    badge: "Renting",
    badgeEN: "Renting",
    image: "https://bvgujzrxklyreihiezcq.supabase.co/storage/v1/object/public/vehicle-files/leasys/vxkuphnekn4329001/img-0.jpg",
  },
  {
    id: "idcar-veh-1778144236925",
    brand: "Volkswagen",
    model: "T-Roc",
    year: 2022,
    mileage: 30,
    price: 16600,
    fuel: "Gasolina",
    badge: "Particulares",
    badgeEN: "Private",
    image: "https://bvgujzrxklyreihiezcq.supabase.co/storage/v1/object/public/vehicle-files/vehicles/veh-1778144236925/photos/1779203207877_IMG_4478.jpeg",
  },
  {
    id: "as_a497eda6-7365-43fe-ad3b-d4913b1bc048",
    brand: "SEAT",
    model: "Leon ST",
    year: 2019,
    mileage: 225040,
    price: 7575,
    fuel: "Gasolina",
    badge: "Importación",
    badgeEN: "Import",
    image: "https://prod.pictures.autoscout24.net/listing-images/a497eda6-7365-43fe-ad3b-d4913b1bc048_11f4621e-8713-460f-840d-174517ea7fb2.jpg/640x480.webp",
  },
];

// Breakdown coste de uso anual (demo hardcoded)
const COST_SEGMENTS = [
  { label: "Combustible",   labelEN: "Fuel",        value: 1360, color: "#3b82f6" },
  { label: "Mantenimiento", labelEN: "Maintenance", value: 590,  color: "#22c55e" },
  { label: "Seguro",        labelEN: "Insurance",   value: 640,  color: "#f59e0b" },
  { label: "Impuestos",     labelEN: "Taxes",       value: 190,  color: "#a855f7" },
];

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat("es-ES").format(n);
}

// ── SVG Mini-components ───────────────────────────────────────
function IcoCheck({ size = 16, color = "#16a34a" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.12" />
      <path d="M5 8.5l2 2 4-4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoArrow({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
function IcoChart({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IcoShield({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IcoTarget({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );
}
function IcoCart({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/>
    </svg>
  );
}
function IcoTag({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function IcoHeart({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  );
}
function IcoDatabase({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}
function IcoActivity({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IcoClock({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IcoInfo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function IcoTrend({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function IcoCrown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="5" y1="20" x2="19" y2="20"/>
    </svg>
  );
}
function IcoStar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IcoWrench({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

// ── Donut chart SVG ───────────────────────────────────────────
function DonutChart({ segments, size = 72 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.33;
  const sw = size * 0.145;
  const circ = 2 * Math.PI * r;
  let cumFrac = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const dash = frac * circ;
        const offset = circ * (1 - cumFrac);
        cumFrac += frac;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={sw}
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={offset}
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
    </svg>
  );
}

// ── Mini depreciación line ────────────────────────────────────
function MiniLineChart() {
  const LINE = "M4,6 C38,7 65,27 100,39 C132,49 165,53 196,56";
  const AREA = `${LINE} L196,63 L4,63 Z`;
  return (
    <svg width="100%" height="74" viewBox="0 0 200 74" aria-hidden="true" style={{ display: "block", marginTop: 2 }}>
      <defs>
        <linearGradient id="depAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="depLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      {/* Baseline 0% */}
      <line x1="4" y1="6" x2="196" y2="6" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
      {/* Bottom axis */}
      <line x1="4" y1="63" x2="196" y2="63" stroke="#f3f4f6" strokeWidth="1" />
      {/* Tick marks */}
      {[52, 100, 148].map((x) => (
        <line key={x} x1={x} y1="60" x2={x} y2="63" stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {/* Area fill */}
      <path d={AREA} fill="url(#depAreaGrad)" />
      {/* Curve */}
      <path d={LINE} fill="none" stroke="url(#depLineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Start dot */}
      <circle cx="4" cy="6" r="2.5" fill="#fca5a5" />
      {/* End dot */}
      <circle cx="196" cy="56" r="4" fill="#dc2626" />
      <circle cx="196" cy="56" r="7" fill="#dc2626" fillOpacity="0.15" />
      {/* Month labels */}
      {[["0", 4], ["6m", 52], ["12m", 100], ["18m", 148], ["24m", 196]].map(([label, x]) => (
        <text key={label} x={x} y="73" fontSize="7.5" fill="#9ca3af" textAnchor="middle">{label}</text>
      ))}
    </svg>
  );
}

// ── Social icon helper ────────────────────────────────────────

// ════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function LandingPage({
  isUserLoggedIn,
  onSelectAdvice,
  onSelectVehicle,
  onSelectBuyStart,
  onSelectSell,
  onSelectService,
  onSelectPortalVo,
  onOpenPlans,
  // Remaining props kept for App.js compatibility (unused in this view)
  styles,
  totalSteps,
  blockColors,
  questionnaireDraft,
  onResumeAdvice,
  onSelectDecision,
  onSelectSellInfo,
  onSelectSellManaged,
  onSelectServiceAutogestor,
  onSelectServiceMaintenance,
  onSelectServiceAppointment,
  onSelectServiceMonthlyPlan,
  onSelectServiceInsurance,
  uiLanguage,
  onOpenPlansSection,
  onOpenDashboard,
  onToggleLanguage,
}) {
  const { i18n } = useTranslation();
  const isEN = (uiLanguage || i18n.language) === "en";

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1000 : false
  );
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const fn = () => {
      setIsMobile(window.innerWidth < 1000);
      if (window.innerWidth >= 1000) setShowMobileMenu(false);
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const go = (fn) => () => { if (typeof fn === "function") fn(); };

  const handleBuy       = go(onSelectBuyStart || onSelectVehicle);
  const handleSell      = go(onSelectSell);
  const handleService   = go(onSelectService);
  const handlePlans     = go(onOpenPlans);
  const handleStart     = go(onSelectAdvice || onSelectBuyStart);
  const handleOffers    = go(onSelectPortalVo);
  const handleDashboard = go(onOpenDashboard);

  return (
    <div className="lp-root">

      {/* ══════════════ NAV ══════════════════════════════════════ */}
      <header className="lp-nav" role="banner">
        <div className="lp-nav-inner">

          {/* Logo */}
          <button className="lp-logo" onClick={handleStart} aria-label="CarsWise AI – Inicio">
            <img src="/carswise-logo.png" alt="" />
            <span className="lp-logo-text">CarsWise AI</span>
          </button>

          {/* Nav central — solo desktop */}
          {!isMobile && (
            <nav className="lp-nav-center" aria-label="Navegación principal">
              <button className="lp-nav-link lp-nav-link--active" onClick={handleStart}>{isEN ? "Home" : "Inicio"}</button>
              <button className="lp-nav-link" onClick={handleBuy}>{isEN ? "Buy" : "Comprar"}</button>
              <button className="lp-nav-link" onClick={handleSell}>{isEN ? "Sell" : "Vender"}</button>
              <button className="lp-nav-link" onClick={handleService}>{isEN ? "My car" : "Mi coche"}</button>
              <button className="lp-nav-link lp-nav-link--arrow" onClick={handlePlans}>{isEN ? "Plans ▾" : "Planes ▾"}</button>
              <button className="lp-nav-link lp-nav-link--arrow">{isEN ? "More ▾" : "Más ▾"}</button>
            </nav>
          )}

          {/* Acciones derecha */}
          <div className="lp-nav-actions">
            {!isMobile && (
              <button className="lp-nav-util" aria-label="Idioma" onClick={onToggleLanguage}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
                {isEN ? "EN" : "ES"}
              </button>
            )}
            <button className="lp-btn-panel" onClick={handleDashboard}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {isUserLoggedIn
                ? (isEN ? "My panel" : "Mi panel")
                : (isEN ? "Log in" : "Iniciar sesión")}
            </button>
            {/* Hamburger — solo móvil */}
            {isMobile && (
              <button
                className="lp-hamburger"
                onClick={() => setShowMobileMenu((prev) => !prev)}
                aria-label="Abrir menú"
                aria-expanded={showMobileMenu}
              >
                <span /><span /><span />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown móvil */}
        {isMobile && showMobileMenu && (
          <nav className="lp-mobile-nav" aria-label="Menú móvil">
            {[
              [isEN ? "Home" : "Inicio", handleStart],
              [isEN ? "Buy" : "Comprar", handleBuy],
              [isEN ? "Sell" : "Vender", handleSell],
              [isEN ? "My car" : "Mi coche", handleService],
              [isEN ? "Plans" : "Planes", handlePlans],
            ].map(([label, handler]) => (
              <button
                key={label}
                className="lp-mobile-nav-link"
                onClick={() => { handler(); setShowMobileMenu(false); }}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        <div className="lp-nav-gradient" aria-hidden="true" />
      </header>

      {/* ══════════════ HERO ═════════════════════════════════════ */}
      <section className="lp-hero">

        {/* ── Columna izquierda ── */}
        <div className="lp-hero-left">
          <span className="lp-badge">{isEN ? "MARKET INTELLIGENCE, AT THE SERVICE OF YOUR DECISION" : "INTELIGENCIA DE MERCADO, AL SERVICIO DE TU DECISIÓN"}</span>

          <h1 className="lp-h1">
            {isEN ? "Decide with data." : "Decide con datos."}<br />
            <span className="lp-h1-green">{isEN ? "Save money." : "Ahorra dinero."}</span>
          </h1>

          <p className="lp-subtitle">
            {isEN
              ? "The platform that gives you objective criteria to buy, maintain and sell your used car."
              : "La plataforma que te da criterio objetivo para comprar, mantener y vender tu coche de ocasión."}
          </p>

          <div className="lp-trust-badges">
            {[
              { ico: <IcoChart size={16} />,  text: isEN ? "Real market data" : "Datos reales del mercado" },
              { ico: <IcoShield size={16} />, text: isEN ? "Objective and updated analysis" : "Análisis objetivo y actualizado" },
              { ico: <IcoTarget size={16} />, text: isEN ? "Decisions that save you money" : "Decisiones que te hacen ahorrar" },
            ].map(({ ico, text }) => (
              <div key={text} className="lp-trust-item">
                <div className="lp-trust-icon">{ico}</div>
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="lp-examples">
            <span className="lp-examples-label">{isEN ? "Examples:" : "Ejemplos:"}</span>
            {["BMW Serie 3 320d", "Seat León 2019", "Toyota C-HR híbrido"].map((ex) => (
              <button key={ex} className="lp-example-pill" onClick={handleStart}>{ex}</button>
            ))}
          </div>
        </div>

        {/* ── Columna derecha: tarjeta demo ── */}
        <div className="lp-hero-right">
          <div className="lp-demo-card">

            {/* Imagen banner superior */}
            <div className="lp-demo-car-banner">
              <img
                src="/images/hero-bmw-dark_2.png"
                alt="BMW Serie 3 – ejemplo de análisis CarsWise"
                className="lp-demo-car-img"
              />
              <span className="lp-demo-label lp-demo-label-overlay">EJEMPLO</span>
            </div>

            {/* Cabecera debajo de la imagen */}
            <div className="lp-demo-card-top">
              <div>
                <div className="lp-demo-car-name">
                  BMW SERIE 3{" "}
                  <span style={{ fontWeight: 400, color: "#6b7280" }}>320d</span>
                </div>
                <div className="lp-demo-car-specs">2020 &middot; 190 CV &middot; 85.000 km</div>
              </div>
              <div className="lp-demo-price-block">
                <div className="lp-demo-price-label">{isEN ? "FAIR MARKET PRICE" : "PRECIO JUSTO DE MERCADO"}</div>
                <div className="lp-demo-price">22.450 €</div>
                <div className="lp-demo-price-change">{isEN ? "+1.2% vs. last week" : "+1,2% vs. semana anterior"}</div>
              </div>
            </div>

            {/* Rango de mercado */}
            <div className="lp-demo-range">
              <div className="lp-demo-row-label">{isEN ? "MARKET RANGE" : "RANGO DE MERCADO"}</div>
              <div className="lp-demo-range-vals">
                <span>20.200 €</span>
                <span style={{ color: "#9ca3af", fontWeight: 400 }}>–</span>
                <span>24.700 €</span>
              </div>
              <div className="lp-range-track">
                <div className="lp-range-fill" />
                <div className="lp-range-thumb" />
              </div>
              <div className="lp-range-sub">
                <span>{isEN ? "Lowest price" : "Precio más bajo"} &nbsp; 20.200 €</span>
                <span>24.700 € &nbsp; {isEN ? "Highest price" : "Precio más alto"}</span>
              </div>
            </div>

            {/* Fila tiempo de venta + depreciación */}
            <div className="lp-demo-stats-row">
              <div className="lp-demo-stat">
                <div className="lp-demo-row-label">{isEN ? "SOLD IN YOUR AREA IN" : "SE VENDE EN TU ZONA EN"}</div>
                <div className="lp-demo-stat-val">{isEN ? "28 days" : "28 días"}</div>
                <div className="lp-demo-stat-sub">{isEN ? "Similar listings sold in your area" : "Publicaciones similares vendidas en tu zona"}</div>
              </div>
              <div className="lp-demo-stat">
                <div className="lp-demo-row-label">{isEN ? "ESTIMATED DEPRECIATION" : "DEPRECIACIÓN ESTIMADA"}</div>
                <div className="lp-demo-stat-val-red">-16%</div>
                <MiniLineChart />
                <div className="lp-demo-stat-sub">{isEN ? "in 24 months" : "en 24 meses"}</div>
              </div>
            </div>

            {/* Coste anual */}
            <div className="lp-demo-cost">
              <DonutChart segments={COST_SEGMENTS} size={74} />
              <div className="lp-demo-cost-info">
                <div className="lp-demo-cost-label">
                  {isEN ? "ANNUAL COST OF OWNERSHIP" : "COSTE DE USO AL AÑO"}{" "}
                  <span style={{ fontWeight: 400, textTransform: "none" }}>{isEN ? "(15,000 km, excl. depreciation)" : "(15.000 km, sin depreciación)"}</span>
                </div>
                <div className="lp-demo-cost-total">
                  2.780 €{" "}
                  <span style={{ fontSize: 12, fontWeight: 400, color: "#6b7280" }}>{isEN ? "per year" : "al año"}</span>
                </div>
                {COST_SEGMENTS.map((seg) => (
                  <div key={seg.label} className="lp-demo-cost-row">
                    <span>
                      <span className="lp-cost-dot" style={{ background: seg.color }} />
                      {isEN ? seg.labelEN : seg.label}
                    </span>
                    <span style={{ fontWeight: 600 }}>{fmt(seg.value)} €</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ TRES CAMINOS ═════════════════════════════ */}
      <section className="lp-paths-section">
        <div className="lp-paths-inner">
          <p className="lp-paths-title">{isEN ? "THREE PATHS. ONE SMART DECISION." : "TRES CAMINOS. UNA DECISIÓN INTELIGENTE."}</p>
          <h2 className="lp-paths-subtitle" style={{ display: "none" }}>Elige tu camino</h2>

          <div className="lp-paths-grid">
            {/* Comprar */}
            <div className="lp-path-card">
              <div className="lp-path-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                <IcoCart size={20} />
              </div>
              <div className="lp-path-name">{isEN ? "I want to buy" : "Quiero comprar"}</div>
              <div className="lp-path-desc">{isEN ? "Find the right car at the right price." : "Encuentra el coche adecuado al precio correcto."}</div>
              <ul className="lp-path-features">
                {(isEN
                  ? ["Fair market price", "Price drop alerts", "Objective comparison"]
                  : ["Precio justo de mercado", "Alertas de bajadas de precio", "Comparación objetiva"]
                ).map((f) => (
                  <li key={f} className="lp-path-feature"><IcoCheck size={16} />{f}</li>
                ))}
              </ul>
              <img src="/images/car-white.png" alt="" className="lp-path-car" aria-hidden="true" />
              <button className="lp-path-cta" style={{ background: "#16a34a", color: "white" }} onClick={handleBuy}>
                {isEN ? "Search cars" : "Buscar coche"} <IcoArrow size={14} />
              </button>
            </div>

            {/* Vender */}
            <div className="lp-path-card">
              <div className="lp-path-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>
                <IcoTag size={20} />
              </div>
              <div className="lp-path-name">{isEN ? "I want to sell" : "Quiero vender"}</div>
              <div className="lp-path-desc">{isEN ? "Know your car's value and sell it better and faster." : "Sabe cuánto vale tu coche y véndelo mejor y más rápido."}</div>
              <ul className="lp-path-features">
                {(isEN
                  ? ["Valuation based on real data", "Tips to sell better", "More visibility for your listing"]
                  : ["Tasación basada en datos reales", "Consejos para vender mejor", "Más visibilidad para tu anuncio"]
                ).map((f) => (
                  <li key={f} className="lp-path-feature"><IcoCheck size={16} />{f}</li>
                ))}
              </ul>
              <img src="/images/car-white.png" alt="" className="lp-path-car" aria-hidden="true" style={{ transform: "scaleX(-1)" }} />
              <button className="lp-path-cta" style={{ background: "#ea580c", color: "white" }} onClick={handleSell}>
                {isEN ? "Value my car" : "Valorar mi coche"} <IcoArrow size={14} />
              </button>
            </div>

            {/* Ya tengo coche */}
            <div className="lp-path-card">
              <div className="lp-path-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                <IcoShield size={20} />
              </div>
              <div className="lp-path-name">{isEN ? "I already have a car" : "Ya tengo coche"}</div>
              <div className="lp-path-desc">{isEN ? "Manage what matters and save on every kilometre." : "Gestiona todo lo que importa y ahorra en cada kilómetro."}</div>
              <ul className="lp-path-features">
                {(isEN
                  ? ["Smart reminders", "Discounted maintenance", "Documents always up to date"]
                  : ["Recordatorios inteligentes", "Mantenimientos con descuento", "Documentación siempre al día"]
                ).map((f) => (
                  <li key={f} className="lp-path-feature"><IcoCheck size={16} />{f}</li>
                ))}
              </ul>
              <img src="/images/phone-mockup.png" alt="" className="lp-path-car" aria-hidden="true" />
              <button className="lp-path-cta" style={{ background: "#2563eb", color: "white" }} onClick={handleService}>
                {isEN ? "Go to my car" : "Ir a mi coche"} <IcoArrow size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ OFERTAS EXCLUSIVAS ═══════════════════════ */}
      <section>
        <div className="lp-offers-wrap">
          <div className="lp-section-hdr">
            <div className="lp-section-hdr-left">
              <span className="lp-section-tag">{isEN ? "EXCLUSIVE OFFERS AT CARSWISE" : "OFERTAS EXCLUSIVAS EN CARSWISE"}</span>
              <span className="lp-section-chip">{isEN ? "ONLY HERE" : "SOLO AQUÍ"}</span>
            </div>
            <button className="lp-link-btn" onClick={handleOffers}>
              {isEN ? "See all offers" : "Ver todas las ofertas"} <IcoArrow size={13} />
            </button>
          </div>

          <div className="lp-offers-grid">
            {EXCLUSIVE_OFFERS.map((car) => (
              <article key={car.id} className="lp-offer-card" onClick={handleOffers}>
                <div className="lp-offer-img-wrap">
                  <img
                    src={car.image}
                    alt={`${car.brand} ${car.model}`}
                    className="lp-offer-img"
                    loading="lazy"
                  />
                  <span className="lp-excl-badge">{isEN ? car.badgeEN : car.badge}</span>
                  <button
                    className="lp-heart-btn"
                    aria-label="Guardar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IcoHeart size={14} />
                  </button>
                </div>
                <div className="lp-offer-body">
                  <div className="lp-offer-name">{car.brand} {car.model}</div>
                  <div className="lp-offer-specs">{car.year} &middot; {fmt(car.mileage)} km</div>
                  <div className="lp-offer-foot">
                    <span className="lp-offer-price">{fmt(car.price)} €</span>
                    <span className="lp-offer-excl-tag">{isEN ? "Only on CarsWise" : "Solo en CarsWise"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ STATS BAR ════════════════════════════════ */}
      <div className="lp-stats-bar">
        <div className="lp-stats-inner">
          {[
            { ico: <IcoDatabase size={16} />, val: isEN ? "1.2M analyzed since January"    : "1,2 M analizados desde enero",         desc: isEN ? "Listings from 15 processed portals" : "Anuncios de 15 portales procesados" },
            { ico: <IcoActivity size={16} />, val: isEN ? "156,842 live listings"           : "156.842 anuncios vivos",               desc: isEN ? "Stock updated in real time"          : "Stock actualizado en tiempo real" },
            { ico: <IcoClock size={16} />,    val: isEN ? `Data updated today at ${timeStr}` : `Datos actualizados hoy a las ${timeStr}`, desc: "" },
            { ico: <IcoInfo size={16} />,     val: isEN ? "Own and transparent methodology" : "Metodología propia y transparente",    desc: isEN ? "CarsWise AI pricing engine"          : "Motor de precios CarsWise AI" },
          ].map(({ ico, val, desc }) => (
            <div key={val} className="lp-stat-item">
              <div className="lp-stat-icon">{ico}</div>
              <div>
                <div className="lp-stat-val">{val}</div>
                {desc && <div className="lp-stat-desc">{desc}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════ SERVICIOS ════════════════════════════════ */}
      <div className="lp-services-outer">
        <div className="lp-services-wrap">
          <div className="lp-services-tag">{isEN ? "SERVICES THAT SAVE YOU MONEY" : "SERVICIOS QUE TE HACEN AHORRAR"}</div>
          <div className="lp-services-row">
            {[
              { ico: <IcoChart size={15} />,  name: isEN ? "Advanced market report"         : "Informe de mercado avanzado",    price: "10 €" },
              { ico: <IcoTrend size={15} />,  name: isEN ? "Boost listing 10x more views"   : "Destacar anuncio 10x más visitas", price: "9 € – 19 €" },
              { ico: <IcoCrown size={15} />,  name: isEN ? "Premium listing"                : "Publicación premium",            price: "29 € – 39 €" },
              { ico: <IcoShield size={15} />, name: isEN ? "CarsWise Guarantee Seal"        : "Sello de Garantía CarsWise",     price: "29 € – 49 €" },
              { ico: <IcoStar size={15} />,   name: isEN ? "Full sale management"           : "Gestión integral de venta",      price: "149 € – 249 €" },
              { ico: <IcoTarget size={15} />, name: isEN ? "Insurance analysis"             : "Análisis de tu seguro",          price: isEN ? "Free" : "Gratis" },
              { ico: <IcoWrench size={15} />, name: isEN ? "Maintenance subscription"       : "Cuotas de mantenimiento",        price: isEN ? "From 29 € / mo" : "Desde 29 € / mes" },
            ].map(({ ico, name, price }) => (
              <div key={name} className="lp-service-cell" onClick={handlePlans}>
                <div className="lp-service-icon-wrap">{ico}</div>
                <div className="lp-service-name">{name}</div>
                <div className="lp-service-price">{price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════ CTA BANNER ═══════════════════════════════ */}
      <div className="lp-cta-banner">
        <div className="lp-cta-inner">
          <div>
            <div className="lp-cta-title">{isEN ? "Start for free and make better decisions" : "Empieza gratis y toma mejores decisiones"}</div>
            <div className="lp-cta-sub">{isEN ? "Join CarsWise AI and start saving today." : "Únete a CarsWise AI y empieza a ahorrar desde hoy."}</div>
          </div>
          <div className="lp-cta-btns">
            <button className="lp-btn-green" onClick={handleStart}>{isEN ? "Start for free" : "Empieza gratis"}</button>
            <button className="lp-btn-outline-white" onClick={handlePlans}>{isEN ? "View plans" : "Ver planes"}</button>
          </div>
        </div>
      </div>

      {/* ══════════════ FOOTER ═══════════════════════════════════ */}
      <footer style={{ marginTop: "auto", position: "relative", zIndex: 5, borderTop: "1px solid rgba(148,163,184,0.22)", background: "radial-gradient(120% 100% at 8% 0%, rgba(56,189,248,0.1), rgba(56,189,248,0) 45%), linear-gradient(180deg, rgba(2,6,23,0.9), rgba(2,6,23,0.98))" }}>
        <div style={{ maxWidth: 1380, margin: "0 auto", padding: "30px 24px", display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, textAlign: "left" }}>

            {/* Columna logo */}
            <div style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <img src="/carswise-logo.png" alt="CarsWise" style={{ width: 98, height: 40, objectFit: "contain", display: "block" }} />
                <div style={{ fontWeight: 800, fontSize: 14, color: "#f8fafc" }}>CarsWise</div>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                {isEN ? "Mobility platform to buy better, sell better and reduce your total vehicle cost." : "Plataforma de movilidad para comprar mejor, vender mejor y reducir el coste total de tu vehículo."}
              </div>
            </div>

            {/* Contacto */}
            <div style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>{isEN ? "CONTACT" : "CONTACTO"}</div>
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                <a href="mailto:soporte@carswise.es" style={{ color: "#e2e8f0", textDecoration: "none" }}>soporte@carswise.es</a>
                <a href="tel:+34910000000" style={{ color: "#e2e8f0", textDecoration: "none" }}>+34 910 000 000</a>
                <div style={{ color: "#94a3b8" }}>{isEN ? "Mon–Fri 09:00–18:00 (Spain)" : "L-V 09:00 a 18:00 (España)"}</div>
              </div>
            </div>

            {/* Enlaces útiles */}
            <div style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>{isEN ? "USEFUL LINKS" : "ENLACES UTILES"}</div>
              <div style={{ display: "grid", gap: 7, fontSize: 12 }}>
                <button type="button" onClick={handleStart} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>{isEN ? "Home" : "Inicio"}</button>
                <button type="button" onClick={handleOffers} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>Marketplace VO</button>
                <button type="button" onClick={handleBuy} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>{isEN ? "Vehicle advisor" : "Asesor de vehículo"}</button>
                <button type="button" style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>Blog</button>
                <button type="button" style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>{isEN ? "Contact" : "Contacto"}</button>
                <button type="button" onClick={handleService} style={{ background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left", padding: 0, cursor: "pointer" }}>{isEN ? "Services" : "Servicios"}</button>
              </div>
            </div>

            {/* Redes sociales */}
            <div style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "14px 12px", background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, letterSpacing: "0.5px", marginBottom: 8 }}>{isEN ? "SOCIAL MEDIA" : "REDES SOCIALES"}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["LinkedIn","https://www.linkedin.com"],["Instagram","https://www.instagram.com/carswiseai/"],["X","https://x.com"],["YouTube","https://www.youtube.com"]].map(([label, href]) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" style={{ border: "1px solid rgba(148,163,184,0.24)", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#e2e8f0", textDecoration: "none", background: "rgba(15,23,42,0.55)" }}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Barra inferior */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, borderTop: "1px solid rgba(148,163,184,0.2)", paddingTop: 12, fontSize: 11, color: "#94a3b8" }}>
            <div>© {new Date().getFullYear()} CarsWise. {isEN ? "All rights reserved." : "Todos los derechos reservados."}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(isEN
                ? ["Legal notice","Privacy","Cookies","Terms","Communications","Experian Policy","Experian Conditions"]
                : ["Aviso legal","Privacidad","Cookies","Términos","Comunicaciones","Política Experian","Condiciones Experian"]
              ).map((label) => (
                <button key={label} type="button" style={{ background: "transparent", border: "none", color: "#cbd5e1", padding: 0, cursor: "pointer", fontSize: 11 }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
