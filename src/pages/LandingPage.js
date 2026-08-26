import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import LogoPopCar from "../ui/LogoPopCar";
import PiePopCar from "../ui/PiePopCar";
import "./LandingPage.css";

/**
 * Home de PopCar.
 *
 * Portado de la maqueta que se estuvo revisando en local (mockups/popgo). Lo
 * que cambia respecto a la maqueta:
 *
 *  - Los enlaces sueltos pasan a ser los manejadores que ya recibía esta
 *    pantalla, para no romper la navegación de la aplicación.
 *  - Vuelve el bilingüe. La maqueta era solo en español; aquí los textos salen
 *    de un diccionario según el idioma, en vez de un ternario por línea.
 *  - Los iconos eran glifos de texto (⌕ ◇ ✓ ☏). En Windows salen desiguales y
 *    algunos como cuadrado vacío, así que van en SVG.
 *  - La tarjeta de valoración lleva su asterisco y su nota a la vista, no en el
 *    pie: una cifra exacta sin decir de dónde sale afirma más de lo que puede.
 */

const TEXTOS = {
  es: {
    nav: { comprar: "Comprar", vender: "Vender", gestionar: "Gestionar", idcar: "IdCar", como: "Cómo funciona", empresas: "Empresas", productos: "Productos" },
    entrar: "Iniciar sesión",
    registro: "Regístrate",
    panel: "Mi panel",
    eyebrow: "MOVILIDAD INTELIGENTE",
    h1a: "Tu coche.",
    h1b: "Todo, más fácil.",
    heroTexto: "Compra, vende o gestiona tu coche en una sola plataforma, con el estado del vehículo documentado desde el primer momento.",
    rasgos: [
      ["Encuentra tu coche ideal", "Ofertas que se adaptan a lo que necesitas."],
      ["Vende al mejor precio", "Informe de daños y gestión de la venta."],
      ["Gestiona tu coche", "Documentación, avisos y talleres en un sitio."],
    ],
    empezar: "Empieza ahora",
    descubrir: "Descubre IdCar",
    valoracion: "Valoración inteligente con IA",
    nota: ["* Estimación orientativa.", " Sale de comparar operaciones recientes de coches parecidos. No es una oferta de compra ni una tasación: el precio real depende del estado del coche, y eso lo fija el informe."],
    confianza: [
      "Informe de estado en cada coche",
      "Ni matrículas ni caras: se tapan antes de publicar",
      "La mecánica solo la firma un taller",
    ],
    formasA: "Tres formas de ",
    formasB: "ayudarte",
    formasSub: "Elige lo que necesitas y PopCar se encarga del resto.",
    tarjetas: [
      ["Comprar", "Buscamos por ti", "Encontramos las mejores opciones según tu presupuesto y tu forma de conducir."],
      ["Vender", "Te ayudamos a vender", "Tasamos tu coche, generamos el informe de daños y gestionamos todo por ti."],
      ["Gestionar", "Tu coche, siempre al día", "Todo lo que necesitas para el día a día de tu coche, en un solo lugar."],
    ],
    idcarTitulo: "Tu coche, tu identidad digital.",
    idcarTexto: "Sube tu coche a IdCar y gestiónalo o véndelo cuando quieras.",
    idcarBoton: "Quiero subir mi coche",
    facilA: "Así de ",
    facilB: "fácil",
    facilSub: "Cuatro pasos, y en ninguno tienes que moverte de casa.",
    pasos: [
      ["Cuéntanos qué necesitas", "Dinos qué buscas o qué quieres hacer con tu coche."],
      ["Documentamos el coche", "Fotos guiadas desde el móvil y el informe de estado."],
      ["Recibe recomendaciones", "Te mostramos lo que de verdad encaja contigo."],
      ["Tú decides, nosotros gestionamos", "Nos ocupamos del papeleo, del cobro y del traspaso."],
    ],
    todoA: "Todo lo que tu coche necesita,",
    todoB: "en un solo lugar.",
    checks: [
      ["Documentación", "Toda la del coche, siempre a mano."],
      ["Mantenimientos", "Revisiones, kilometraje y próximos servicios."],
      ["Alertas", "Te avisamos de la ITV y del seguro antes de que caduquen."],
      ["Historial", "Consulta lo que se le ha hecho al coche en segundos."],
      ["Talleres", "Encuentra talleres de la red cerca de ti."],
      ["Expediente visual", "Las fotos y el informe, guardados contigo."],
    ],
    movilTitulo: "PopCar en tu móvil",
    movilTexto: "La captura se hace con la cámara del teléfono, desde el navegador.",
    movilChips: ["Sin instalar nada", "Se abre en el navegador"],
    boletinTitulo: "¿Quieres estar al día?",
    boletinTexto: "Recibe novedades y ofertas que encajen con lo que buscas.",
    boletinPlaceholder: "Tu correo",
    boletinBoton: "Suscribirme",
    boletinHecho: "Hecho",
    lemaPie: "Tu coche. Todo, más fácil.",
    pie: {
      comprar: ["Comprar", ["Buscar coches", "Ofertas destacadas", "Cómo funciona"]],
      vender: ["Vender", ["Tasación", "Informe de daños", "Cómo vendemos tu coche"]],
      gestionar: ["Gestionar", ["Documentación", "Mantenimientos", "Talleres"]],
      idcar: ["IdCar", ["Qué es IdCar", "Subir mi coche", "Preguntas frecuentes"]],
      nosotros: ["Nosotros", ["Sobre PopCar", "Contacto", "Planes"]],
    },
    derechos: "Todos los derechos reservados.",
    legal: "Aviso legal · Privacidad · Cookies",
  },
  en: {
    nav: { comprar: "Buy", vender: "Sell", gestionar: "Manage", idcar: "IdCar", como: "How it works", empresas: "Business", productos: "Products" },
    entrar: "Log in",
    registro: "Sign up",
    panel: "My dashboard",
    eyebrow: "SMART MOBILITY",
    h1a: "Your car.",
    h1b: "All of it, easier.",
    heroTexto: "Buy, sell or manage your car in one place, with the vehicle's condition documented from the start.",
    rasgos: [
      ["Find the right car", "Listings that match what you actually need."],
      ["Sell at the right price", "Damage report and full sale management."],
      ["Manage your car", "Paperwork, reminders and garages in one place."],
    ],
    empezar: "Start now",
    descubrir: "Discover IdCar",
    valoracion: "AI-assisted valuation",
    nota: ["* Indicative estimate.", " Based on recent sales of similar cars. It is not an offer nor a formal appraisal: the real price depends on the car's condition, and that is what the report establishes."],
    confianza: [
      "A condition report on every car",
      "No plates, no faces: masked before publishing",
      "Mechanics are only signed off by a garage",
    ],
    formasA: "Three ways to ",
    formasB: "help you",
    formasSub: "Pick what you need and PopCar handles the rest.",
    tarjetas: [
      ["Buy", "We search for you", "We find the best options for your budget and the way you drive."],
      ["Sell", "We help you sell", "We value your car, produce the damage report and handle everything."],
      ["Manage", "Your car, always up to date", "Everything your car needs day to day, in one place."],
    ],
    idcarTitulo: "Your car, its digital identity.",
    idcarTexto: "Upload your car to IdCar and manage or sell it whenever you want.",
    idcarBoton: "Upload my car",
    facilA: "That ",
    facilB: "simple",
    facilSub: "Four steps, and none of them means leaving home.",
    pasos: [
      ["Tell us what you need", "What you are looking for, or what you want to do with your car."],
      ["We document the car", "Guided photos from your phone and the condition report."],
      ["Get recommendations", "We show you what genuinely fits."],
      ["You decide, we handle it", "Paperwork, payment and transfer of ownership."],
    ],
    todoA: "Everything your car needs,",
    todoB: "in one place.",
    checks: [
      ["Paperwork", "All of the car's documents, always at hand."],
      ["Servicing", "Services, mileage and what's coming up."],
      ["Reminders", "We warn you before the MOT and insurance expire."],
      ["History", "See what's been done to the car in seconds."],
      ["Garages", "Find network garages near you."],
      ["Visual record", "The photos and the report, kept with you."],
    ],
    movilTitulo: "PopCar on your phone",
    movilTexto: "Capture happens with your phone camera, in the browser.",
    movilChips: ["Nothing to install", "Opens in the browser"],
    boletinTitulo: "Want to keep up?",
    boletinTexto: "Get news and listings that match what you are after.",
    boletinPlaceholder: "Your email",
    boletinBoton: "Subscribe",
    boletinHecho: "Done",
    lemaPie: "Your car. All of it, easier.",
    pie: {
      comprar: ["Buy", ["Search cars", "Featured listings", "How it works"]],
      vender: ["Sell", ["Valuation", "Damage report", "How we sell your car"]],
      gestionar: ["Manage", ["Paperwork", "Servicing", "Garages"]],
      idcar: ["IdCar", ["What is IdCar", "Upload my car", "FAQ"]],
      nosotros: ["About", ["About PopCar", "Contact", "Plans"]],
    },
    derechos: "All rights reserved.",
    legal: "Legal notice · Privacy · Cookies",
  },
};

/* ── Iconos ────────────────────────────────────────────────────────────────
   En SVG y no como glifos de texto: los caracteres tipo ⌕ ◇ ☏ se dibujan
   distinto en cada sistema y en Windows varios salen como cuadrado vacío. */
const Ico = ({ d, ...r }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...r}>{d}</svg>
);
const IcoLupa   = (p) => <Ico {...p} d={<><circle cx="11" cy="11" r="6.5" /><path d="M15.8 15.8 20.5 20.5" /></>} />;
const IcoEtiq   = (p) => <Ico {...p} d={<><path d="M12.6 2.6H20a1.4 1.4 0 0 1 1.4 1.4v7.4L11.6 21.4 2.6 12.4z" /><circle cx="17" cy="7" r="1.4" /></>} />;
const IcoCheck  = (p) => <Ico {...p} d={<path d="M4.5 12.6 9.4 17.5 19.5 6.8" />} />;
const IcoEscudo = (p) => <Ico {...p} d={<><path d="M12 2.5 20 5.8v6c0 5.1-3.4 9.1-8 10.2-4.6-1.1-8-5.1-8-10.2v-6z" /><path d="M8.4 12.1 11 14.7l4.8-5" /></>} />;
const IcoOjo    = (p) => <Ico {...p} d={<><path d="M1.9 12S5.4 5.6 12 5.6 22.1 12 22.1 12 18.6 18.4 12 18.4 1.9 12 1.9 12z" /><path d="M3 3l18 18" /></>} />;
const IcoLlave  = (p) => <Ico {...p} d={<><path d="M4 19.5h16" /><path d="M6.5 19.5V11a5.5 5.5 0 0 1 11 0v8.5" /><path d="M12 5.5V2.8" /></>} />;
const IcoChat   = (p) => <Ico {...p} d={<path d="M20.5 12.6c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.7-.36L4 21.4l1.5-3.7a6.8 6.8 0 0 1-2-4.7c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" />} />;
const IcoCamara = (p) => <Ico {...p} d={<><path d="M3 8.4h3.4l1.5-2.3h8.2l1.5 2.3H21v10.2H3z" /><circle cx="12" cy="13.2" r="3.4" /></>} />;
const IcoLista  = (p) => <Ico {...p} d={<><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" /></>} />;
const IcoSobre  = (p) => <Ico {...p} d={<><path d="M2.8 5.8h18.4v12.4H2.8z" /><path d="m2.8 6.4 9.2 6.4 9.2-6.4" /></>} />;
const IcoFlecha = (p) => <Ico {...p} d={<><path d="M4.5 12h14" /><path d="m13 6.5 5.5 5.5L13 17.5" /></>} />;

/**
 * El coche entra una sola vez por carga de página.
 *
 * La marca vive fuera del componente a propósito: volver al home desde dentro de
 * la aplicación lo vuelve a montar, y sin esto la animación se repetiría cada
 * vez. Y vive en `window` y no en una variable del módulo porque lo que se
 * quiere es exactamente esa vida —la de la página—: al recargar desaparece, que
 * es justo cuando sí tiene que verse otra vez.
 */
const MARCA_ENTRADA = "popcarEntradaHecha";
const yaEntro = () => typeof window !== "undefined" && Boolean(window[MARCA_ENTRADA]);

export default function LandingPage({
  isUserLoggedIn,
  onSelectAdvice,
  onSelectVehicle,
  onSelectBuyStart,
  onSelectSell,
  onSelectService,
  onSelectPortalVo,
  onSelectEmpresas,
  onSelectAbout,
  onSelectContact,
  onOpenPlans,
  onComoFunciona,
  onEntrar,
  onRegistro,
  // Props que sigue pasando App.js y esta vista no usa
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
  const t = isEN ? TEXTOS.en : TEXTOS.es;

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1000 : false
  );
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [suscrito, setSuscrito] = useState(false);

  /**
   * La entrada del coche: «espera» mientras no se puede, «entra» durante el
   * recorrido y «hecha» cuando ya pasó —o si se llega al home desde dentro, que
   * entonces sale directamente en su sitio—.
   */
  const [entrada, setEntrada] = useState(() => (yaEntro() ? "hecha" : "espera"));
  const foto = useRef(null);

  const arrancarEntrada = useCallback(() => {
    if (yaEntro()) return;
    window[MARCA_ENTRADA] = true;
    setEntrada("entra");
  }, []);

  /**
   * Arranca en cuanto la foto está cargada.
   *
   * Sin la foto lista lo que entraría es un hueco, y esto se ve una sola vez: no
   * hay segunda oportunidad.
   *
   * Ya no espera al aviso de cookies. Cuando era una capa a pantalla completa
   * había que esperarlo —la animación pasaba entera detrás del velo—, pero ahora
   * es una barra al pie y no tapa nada de aquí arriba.
   */
  useEffect(() => {
    if (yaEntro()) return undefined;
    const img = foto.current;
    if (!img) return undefined;
    // `complete` cubre la imagen que ya estaba en caché, donde `load` no salta.
    if (img.complete) { arrancarEntrada(); return undefined; }
    // Si la foto falla tampoco se deja la escena a medias: entra la tarjeta.
    img.addEventListener("load", arrancarEntrada);
    img.addEventListener("error", arrancarEntrada);
    return () => {
      img.removeEventListener("load", arrancarEntrada);
      img.removeEventListener("error", arrancarEntrada);
    };
  }, [arrancarEntrada]);

  useEffect(() => {
    const fn = () => {
      setIsMobile(window.innerWidth < 1000);
      if (window.innerWidth >= 1000) setMenuAbierto(false);
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const go = (fn) => () => {
    setMenuAbierto(false);
    if (typeof fn === "function") fn();
  };

  const irComprar   = go(onSelectBuyStart || onSelectVehicle);
  const irVender    = go(onSelectSell);
  const irGestionar = go(onSelectService);
  const irPlanes    = go(onOpenPlans);
  /* Se llamaba `irInicio` y no lleva al inicio: abre el asesor de compra. Con
     ese nombre acabo puesto en el logotipo y en los dos botones de sesion, que
     es como pulsar «Iniciar sesion» terminaba en el cuestionario de comprar. */
  const irAsesor    = go(onSelectAdvice || onSelectBuyStart);
  const irComoFunciona = go(onComoFunciona);
  const irEntrar    = go(onEntrar);
  const irRegistro  = go(onRegistro);
  // Estando ya en el inicio, el logotipo sube arriba del todo.
  const irArriba    = go(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  });
  const irOfertas   = go(onSelectPortalVo);
  const irContacto  = go(onSelectEmpresas);
  const irSobre     = go(onSelectAbout);
  const irContactar = go(onSelectContact);
  const irPanel     = go(onOpenDashboard);

  const Logotipo = ({ tono = "oscuro", size = 32 }) => (
    <button type="button" className="pc-logo" onClick={irArriba} aria-label={`PopCar – ${isEN ? "Home" : "Inicio"}`}>
      <LogoPopCar size={size} tono={tono} />
    </button>
  );

  const enlacesNav = [
    [t.nav.comprar, irComprar],
    [t.nav.vender, irVender],
    [t.nav.gestionar, irGestionar],
    [t.nav.idcar, irGestionar],
    [t.nav.empresas, irContacto],
    [t.nav.productos, irPlanes],
    [t.nav.como, irComoFunciona],
  ];

  const iconosRasgo = [IcoLupa, IcoEtiq, IcoCheck];
  const iconosPaso = [IcoChat, IcoCamara, IcoLista, IcoCheck];
  const accionesTarjeta = [irComprar, irVender, irGestionar];

  return (
    <div className="pc-root">

      {/* ─────────── Cabecera ─────────── */}
      <header className="pc-header">
        <Logotipo />

        {!isMobile && (
          <nav className="pc-nav" aria-label={isEN ? "Main navigation" : "Navegación principal"}>
            {enlacesNav.map(([texto, accion]) => (
              <button key={texto} type="button" onClick={accion}>{texto}</button>
            ))}
          </nav>
        )}

        {!isMobile && (
          <div className="pc-header-acciones">
            {isUserLoggedIn ? (
              <button className="pc-btn pc-btn-amarillo" onClick={irPanel}>{t.panel}</button>
            ) : (
              <>
                <button className="pc-btn pc-btn-linea" onClick={irEntrar}>{t.entrar}</button>
                <button className="pc-btn pc-btn-amarillo" onClick={irRegistro}>{t.registro}</button>
              </>
            )}
          </div>
        )}

        {isMobile && (
          <button
            className="pc-menu-movil"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-expanded={menuAbierto}
            aria-label={isEN ? "Open menu" : "Abrir menú"}
          >
            <span /><span /><span />
          </button>
        )}
      </header>

      {isMobile && menuAbierto && (
        <div className="pc-menu-desplegado">
          {enlacesNav.map(([texto, accion]) => (
            <button key={texto} type="button" onClick={accion}>{texto}</button>
          ))}
          <div className="pc-menu-acciones">
            {isUserLoggedIn
              ? <button className="pc-btn pc-btn-amarillo" onClick={irPanel}>{t.panel}</button>
              : <button className="pc-btn pc-btn-amarillo" onClick={irRegistro}>{t.registro}</button>}
          </div>
        </div>
      )}

      <main>
        {/* ─────────── Hero ─────────── */}
        <section className="pc-hero">
          <div className="pc-hero-texto">
            <p className="pc-eyebrow">{t.eyebrow}</p>
            <h1>{t.h1a}<br /><span>{t.h1b}</span></h1>
            <p className="pc-hero-lead">{t.heroTexto}</p>

            <div className="pc-rasgos">
              {t.rasgos.map(([titulo, sub], i) => {
                const Icono = iconosRasgo[i];
                return (
                  <article key={titulo}>
                    <div className="pc-rasgo-ico"><Icono width={19} height={19} /></div>
                    <div><b>{titulo}</b><small>{sub}</small></div>
                  </article>
                );
              })}
            </div>

            <div className="pc-hero-acciones">
              <button className="pc-btn pc-btn-amarillo pc-btn-grande" onClick={irComprar}>
                {t.empezar} <IcoFlecha width={17} height={17} />
              </button>
              <button className="pc-btn pc-btn-linea pc-btn-grande" onClick={irGestionar}>
                {t.descubrir} <IcoFlecha width={17} height={17} />
              </button>
            </div>
          </div>

          <div className={`pc-hero-visual pc-entrada-${entrada}`}>
            <img
              ref={foto}
              src="/popcar-beetle.png"
              alt={isEN ? "White Volkswagen Beetle, front three-quarter view" : "Volkswagen Beetle blanco visto de tres cuartos delantero"}
            />
            {/* La cifra viene del diseño; el asterisco es lo que la hace
                defendible, y la horquilla evita afirmar una precisión que
                ninguna estimación tiene. */}
            <aside className="pc-tarjeta-ia">
              <span>{t.valoracion} <sup>*</sup></span>
              <strong>12.450 €</strong>
              <div className="pc-rango"><i /></div>
              <div className="pc-rango-topes"><span>11.900 €</span><span>13.100 €</span></div>
            </aside>
          </div>

          <p className="pc-nota"><b>{t.nota[0]}</b>{t.nota[1]}</p>
        </section>

        {/* ─────────── Franja de confianza ─────────── */}
        <section className="pc-confianza">
          {t.confianza.map((texto, i) => {
            const Icono = [IcoEscudo, IcoOjo, IcoLlave][i];
            return (
              <div key={texto}>
                <span className="pc-confianza-ico"><Icono width={18} height={18} /></span>
                <span>{texto}</span>
              </div>
            );
          })}
        </section>

        {/* ─────────── Tres formas ─────────── */}
        <section className="pc-formas">
          <div className="pc-titulo-seccion">
            <h2>{t.formasA}<span>{t.formasB}</span></h2>
            <p>{t.formasSub}</p>
          </div>

          <div className="pc-formas-rejilla">
            {t.tarjetas.map(([pill, titulo, texto], i) => (
              <article className="pc-tarjeta" key={pill}>
                <span className="pc-pill">{pill}</span>
                <h3>{titulo}</h3>
                <p>{texto}</p>
                <button className="pc-tarjeta-ir" onClick={accionesTarjeta[i]} aria-label={titulo}>
                  <IcoFlecha width={18} height={18} />
                </button>
              </article>
            ))}

            <article className="pc-idcar">
              <div>
                <h3><span>Id</span>Car</h3>
                <p>{t.idcarTitulo}</p>
                <p className="pc-idcar-sub">{t.idcarTexto}</p>
                <button className="pc-btn pc-btn-amarillo" onClick={irGestionar}>{t.idcarBoton}</button>
              </div>
              <div className="pc-movil" aria-hidden="true">
                <div className="pc-movil-pantalla">
                  <b>Mi IdCar</b>
                  <strong>Volkswagen T-Roc</strong>
                  <span className="pc-ok"><IcoCheck width={13} height={13} /> {isEN ? "All up to date" : "Todo al día"}</span>
                  <span>{isEN ? "Insurance" : "Seguro"}</span>
                  <span>{isEN ? "Servicing" : "Mantenimiento"}</span>
                  <span className="pc-aviso">ITV</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ─────────── Así de fácil ─────────── */}
        <section className="pc-pasos-seccion">
          <div className="pc-titulo-seccion">
            <h2>{t.facilA}<span>{t.facilB}</span></h2>
            <p>{t.facilSub}</p>
          </div>
          <div className="pc-pasos">
            {t.pasos.map(([titulo, texto], i) => {
              const Icono = iconosPaso[i];
              return (
                <article key={titulo}>
                  <div className="pc-paso-ico"><Icono width={20} height={20} /></div>
                  <h3>{titulo}</h3>
                  <p>{texto}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ─────────── Bloque negro ─────────── */}
        <section className="pc-todo">
          <div className="pc-todo-texto">
            <h2>{t.todoA}<br /><span>{t.todoB}</span></h2>
            <div className="pc-checks">
              {t.checks.map(([titulo, sub]) => (
                <p key={titulo}>
                  <IcoCheck width={15} height={15} />
                  <b>{titulo}</b>
                  <small>{sub}</small>
                </p>
              ))}
            </div>
          </div>
          <div className="pc-todo-visual" aria-hidden="true">
            <div className="pc-movil-grande">
              <b>Mi IdCar</b>
              <strong>Volkswagen T-Roc</strong>
              <span className="pc-ok"><IcoCheck width={13} height={13} /> {isEN ? "All up to date" : "Todo al día"}</span>
              <span>{isEN ? "Insurance · valid" : "Seguro · vigente"}</span>
              <span>{isEN ? "Servicing · 2.000 km" : "Mantenimiento · 2.000 km"}</span>
              <span className="pc-aviso">ITV · 04/2026</span>
            </div>
          </div>
        </section>

        {/* ─────────── Banda amarilla ─────────── */}
        <section className="pc-banda">
          <div>
            <h2>{t.movilTitulo}</h2>
            <p>{t.movilTexto}</p>
            <div className="pc-chips">
              {t.movilChips.map((c) => <span key={c}>{c}</span>)}
            </div>
          </div>
          <div className="pc-banda-movil" aria-hidden="true">
            <div>
              <b>PopCar</b>
              <p>{isEN ? "Hi! What do you need today?" : "¡Hola! ¿Qué necesitas hoy?"}</p>
              <span>{isEN ? "Find a car" : "Buscar coche"}</span>
              <span>{isEN ? "Sell my car" : "Vender mi coche"}</span>
              <span>{isEN ? "Manage my car" : "Gestionar mi coche"}</span>
            </div>
          </div>
        </section>

        {/* ─────────── Boletín ─────────── */}
        <section className="pc-boletin">
          <div>
            <span className="pc-boletin-ico"><IcoSobre width={20} height={20} /></span>
            <div><b>{t.boletinTitulo}</b><small>{t.boletinTexto}</small></div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const campo = e.currentTarget.querySelector("input");
              if (!campo.value.trim()) return;
              campo.value = "";
              setSuscrito(true);
              setTimeout(() => setSuscrito(false), 2200);
            }}
          >
            <input type="email" placeholder={t.boletinPlaceholder} aria-label={t.boletinPlaceholder} />
            <button type="submit">{suscrito ? t.boletinHecho : t.boletinBoton}</button>
          </form>
        </section>
      </main>

      <PiePopCar
        lema={t.lemaPie}
        derechos={t.derechos}
        onLogo={irArriba}
        columnas={[
          { titulo: t.pie.comprar[0],   enlaces: t.pie.comprar[1].map((x, i)   => ({ texto: x, onClick: [irComprar, irOfertas, irAsesor][i] })) },
          { titulo: t.pie.vender[0],    enlaces: t.pie.vender[1].map((x)       => ({ texto: x, onClick: irVender })) },
          { titulo: t.pie.gestionar[0], enlaces: t.pie.gestionar[1].map((x)    => ({ texto: x, onClick: irGestionar })) },
          { titulo: t.pie.idcar[0],     enlaces: t.pie.idcar[1].map((x)        => ({ texto: x, onClick: irGestionar })) },
          { titulo: t.pie.nosotros[0],  enlaces: t.pie.nosotros[1].map((x, i)  => ({ texto: x, onClick: [irSobre, irContactar, irPlanes][i] })) },
        ]}
        legales={t.legal.split(" · ").map((x) => ({ texto: x }))}
      />
    </div>
  );
}
