import React, { useCallback, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import EscenaMercado from "../components/historia/EscenaMercado";
import "./ComoFuncionaPage.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Cómo funciona PopCar.
 *
 * Tres bloques —comprar, vender, gestionar— y en cada uno una escena grande que
 * se transforma con el scroll. La idea es que en minuto y medio se entienda qué
 * hace PopCar sin apenas leer: manda lo que se ve y el texto solo pone nombre.
 *
 * Todo lo que aparece es interfaz o dato de la aplicación, no maqueta:
 *
 *  - Comprar reutiliza la escena del mercado, que llama al mismo endpoint que el
 *    buscador y pinta ofertas de verdad.
 *  - Vender enseña los seis campos que pide el formulario y las cifras del
 *    informe de mercado, medidas en la base.
 *  - Gestionar enseña los cuatro servicios que existen, con sus nombres.
 *
 * Se anima con GSAP y ScrollTrigger, siempre con `scrub`: el usuario mueve la
 * animación, no se le reproduce. Sin 3D. Si algún día una funcionalidad gana
 * algo de verdad con volumen, se añade entonces y solo ahí.
 */

/** Informe de mercado del Golf 2020-2022, contado en la base el 26/08/2026. */
const MERCADO = { unidades: 2638, media: 20739, desde: 16900, hasta: 22690 };

/** Los seis datos que pide el formulario de venta, en su orden. */
const DATOS_VENTA = [
  { etiqueta: "Matrícula", valor: "1234 KLM" },
  { etiqueta: "Marca", valor: "Volkswagen" },
  { etiqueta: "Modelo", valor: "Golf" },
  { etiqueta: "Versión", valor: "1.5 TSI Life" },
  { etiqueta: "Año", valor: "2021" },
  { etiqueta: "Kilómetros", valor: "48.300" },
];

/** Los cuatro servicios de Gestionar, con el nombre que tienen en la web. */
const SERVICIOS = [
  { id: "garaje", titulo: "Crea tu garaje", pie: "21 campos", icono: "coche" },
  { id: "aviso", titulo: "Recordatorio inteligente", pie: "ITV y seguro", icono: "reloj" },
  { id: "taller", titulo: "Cita de mantenimiento", pie: "Talleres de la red", icono: "punto" },
  { id: "seguro", titulo: "Seguro", pie: "Entiende tu póliza", icono: "escudo" },
];

const num = (n) => n.toLocaleString("es-ES");

/**
 * Los iconos van en SVG, no en emoji. Ya se aprendió montando el home: los
 * glifos de texto salen desiguales entre sistemas y en Windows algunos se ven
 * como un cuadrado vacío.
 */
function Icono({ nombre }) {
  const comun = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  };
  if (nombre === "coche") {
    return (<svg {...comun}><path d="M5 13h14l-1.4-4.2A2 2 0 0 0 15.7 7H8.3a2 2 0 0 0-1.9 1.8L5 13Z" /><path d="M4 13h16v4H4z" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></svg>);
  }
  if (nombre === "reloj") {
    return (<svg {...comun}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></svg>);
  }
  if (nombre === "punto") {
    return (<svg {...comun}><path d="M12 21s6.5-5.6 6.5-10a6.5 6.5 0 1 0-13 0c0 4.4 6.5 10 6.5 10Z" /><circle cx="12" cy="11" r="2.4" /></svg>);
  }
  return (<svg {...comun}><path d="M12 3l7 3v5.5c0 4.3-3 8.2-7 9.5-4-1.3-7-5.2-7-9.5V6l7-3Z" /></svg>);
}

export default function ComoFuncionaPage({ onGoHome }) {
  const raiz = useRef(null);
  const embudo = useRef(null);

  // La escena del mercado se mueve por referencia: su avance cambia en cada
  // fotograma y no puede pasar por el estado de React.
  const registrarEmbudo = useCallback((_, fn) => { embudo.current = fn; }, []);

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return undefined;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add({ anima: "(prefers-reduced-motion: no-preference)" }, (contexto) => {
        if (!contexto.conditions.anima) {
          // Sin movimiento: el embudo se enseña ya resuelto, que es el estado
          // que cuenta la historia entera de un vistazo.
          embudo.current?.(1);
          return;
        }

        /* ── Portada ──────────────────────────────────────────────────────
           Las tres manchas se mueven a distinta velocidad. Es lo único
           decorativo de la página, y va aquí a propósito: la portada no
           explica nada, invita a bajar. */
        gsap.timeline({
          scrollTrigger: { trigger: ".cf-hero", start: "top top", end: "bottom top", scrub: true },
        })
          .to(".cf-hero-texto", { y: -170, opacity: 0, ease: "none" }, 0)
          .to(".cf-mancha-1", { x: -230, y: -190, scale: 1.45, ease: "none" }, 0)
          .to(".cf-mancha-2", { x: 240, y: -90, scale: 0.65, ease: "none" }, 0)
          .to(".cf-mancha-3", { x: -140, y: 140, scale: 1.7, ease: "none" }, 0);

        /* ── 01 Comprar ───────────────────────────────────────────────────
           El scroll del bloque mueve el embudo: medio millón de ofertas,
           siete filtros y las que quedan, con sus fichas reales. La
           transformación la hace la escena; aquí solo se le dice por dónde va. */
        ScrollTrigger.create({
          trigger: "#comprar",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
          onUpdate: (self) => { embudo.current?.(self.progress); },
        });

        /* ── 02 Vender ────────────────────────────────────────────────────
           Los seis datos entran uno a uno, la ficha se retira y en su sitio se
           abre el informe con los comparables alrededor. */
        const vender = gsap.timeline({
          scrollTrigger: { trigger: "#vender", start: "top top", end: "bottom bottom", scrub: 0.6 },
        });
        gsap.utils.toArray("#vender .cf-dato").forEach((dato, i) => {
          vender.fromTo(dato, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, ease: "none", duration: 0.06 }, 0.04 + i * 0.055);
        });
        vender
          .fromTo(".cf-informe", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, ease: "none", duration: 0.1 }, 0.44)
          .fromTo(".cf-barra i", { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 0.22 }, 0.52)
          .to(".cf-ficha-venta", { y: -26, scale: 0.94, ease: "none", duration: 0.3 }, 0.55);
        gsap.utils.toArray("#vender .cf-comparable").forEach((b, i) => {
          vender.fromTo(b, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, ease: "none", duration: 0.08 }, 0.6 + i * 0.05);
        });

        /* ── 03 Gestionar ─────────────────────────────────────────────────
           Los cuatro servicios se acercan y al final se apagan mientras sube
           la ficha: es el argumento del bloque, todo acaba dentro del IdCar. */
        const gestionar = gsap.timeline({
          scrollTrigger: { trigger: "#gestionar", start: "top top", end: "bottom bottom", scrub: 0.6 },
        });
        gsap.utils.toArray("#gestionar .cf-servicio").forEach((s, i) => {
          gestionar.fromTo(s,
            { autoAlpha: 0, scale: 0.86, x: i % 2 ? 60 : -60 },
            { autoAlpha: 1, scale: 1, x: 0, ease: "none", duration: 0.12 },
            0.06 + i * 0.13);
        });
        gestionar
          .fromTo(".cf-idcar-lleno", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, ease: "none", duration: 0.14 }, 0.62)
          .to("#gestionar .cf-servicio", { scale: 0.82, autoAlpha: 0.4, ease: "none", duration: 0.16 }, 0.74);

        /* ── Profundidad ──────────────────────────────────────────────────
           El rótulo sube más que la escena. Deja claro quién manda: la escena
           se queda, el texto pasa de largo. */
        gsap.utils.toArray(".cf-bloque").forEach((bloque) => {
          const rotulo = bloque.querySelector(".cf-rotulo");
          if (!rotulo) return;
          gsap.to(rotulo, {
            y: -90,
            ease: "none",
            scrollTrigger: { trigger: bloque, start: "top bottom", end: "bottom top", scrub: true },
          });
        });
      });
    }, raiz);

    return () => ctx.revert();
  }, []);

  return (
    <div className="cf-root" ref={raiz}>

      <section className="cf-hero">
        <div className="cf-manchas" aria-hidden="true">
          <span className="cf-mancha cf-mancha-1" />
          <span className="cf-mancha cf-mancha-2" />
          <span className="cf-mancha cf-mancha-3" />
        </div>
        <div className="cf-hero-texto">
          <p className="cf-eyebrow">Cómo funciona</p>
          <h1>Todo lo que necesitas<br /><span>para tu coche.</span></h1>
          <p className="cf-hero-pie">Encuentra. Vende. Gestiona.</p>
          <p className="cf-baja" aria-hidden="true">Baja<span className="cf-baja-linea" /></p>
        </div>
      </section>

      <section className="cf-intro">
        <div>
          <p className="cf-eyebrow">Una forma distinta</p>
          <h2>Tu coche no es<br /><span>solo un coche.</span></h2>
        </div>
      </section>

      {/* ── 01 Comprar ─────────────────────────────────────────────────── */}
      <section className="cf-bloque" id="comprar">
        <div className="cf-fijo">
          <div className="cf-rotulo">
            <p className="cf-paso">01</p>
            <p className="cf-eyebrow">Comprar</p>
            <h2>Encuentra<br /><span>el tuyo.</span></h2>
            <p className="cf-apoyo">Todo el mercado, hasta los que encajan contigo.</p>
          </div>
          <div className="cf-escena">
            <EscenaMercado registrar={registrarEmbudo} indice={0} />
          </div>
        </div>
      </section>

      {/* ── 02 Vender ──────────────────────────────────────────────────── */}
      <section className="cf-bloque cf-bloque-claro" id="vender">
        <div className="cf-fijo">
          <div className="cf-rotulo">
            <p className="cf-paso">02</p>
            <p className="cf-eyebrow">Vender</p>
            <h2>Dale una<br /><span>salida.</span></h2>
            <p className="cf-apoyo">Lo que pide hoy el mercado por un coche como el tuyo.</p>
          </div>

          <div className="cf-escena cf-escena-venta">
            <div className="cf-ficha-venta">
              <p className="cf-ficha-titulo">Tu coche</p>
              <dl className="cf-datos">
                {DATOS_VENTA.map((d) => (
                  <div className="cf-dato" key={d.etiqueta}>
                    <dt>{d.etiqueta}</dt>
                    <dd>{d.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="cf-informe">
              <p className="cf-informe-etq">Precio medio del mercado</p>
              <p className="cf-informe-cifra">{num(MERCADO.media)} €</p>
              <p className="cf-informe-pie">{num(MERCADO.unidades)} unidades similares a la venta</p>
              <div className="cf-barra"><i /></div>
              <p className="cf-informe-rango">
                <span>{num(MERCADO.desde)} €</span>
                <span>{num(MERCADO.hasta)} €</span>
              </p>
              {/* No es una tasación y no puede parecerlo: la cifra es del
                  mercado, nunca del coche del usuario. */}
              <p className="cf-limite">Información de mercado. PopCar no tasa tu coche.</p>
            </div>

            <span className="cf-comparable cf-comparable-1">18.400 €</span>
            <span className="cf-comparable cf-comparable-2">21.900 €</span>
            <span className="cf-comparable cf-comparable-3">16.950 €</span>
            <span className="cf-comparable cf-comparable-4">22.500 €</span>
          </div>
        </div>
      </section>

      {/* ── 03 Gestionar ───────────────────────────────────────────────── */}
      <section className="cf-bloque" id="gestionar">
        <div className="cf-fijo">
          <div className="cf-rotulo">
            <p className="cf-paso">03</p>
            <p className="cf-eyebrow">Gestionar</p>
            <h2>Todo sobre<br /><span>tu coche.</span></h2>
            <p className="cf-apoyo">Papeles, avisos y taller, en un solo sitio.</p>
          </div>

          <div className="cf-escena cf-escena-servicios">
            {SERVICIOS.map((s) => (
              <article className={`cf-servicio cf-servicio-${s.id}`} key={s.id}>
                <span className="cf-servicio-icono"><Icono nombre={s.icono} /></span>
                <span className="cf-servicio-texto">
                  <strong>{s.titulo}</strong>
                  <small>{s.pie}</small>
                </span>
              </article>
            ))}

            <div className="cf-idcar-lleno">
              <p className="cf-ficha-titulo">IdCar</p>
              <p className="cf-idcar-resumen">Volkswagen Golf · 1234 KLM</p>
              <ul className="cf-idcar-adjuntos">
                <li><b>12</b> fotos</li>
                <li><b>4</b> documentos</li>
                <li><b>2</b> ITV</li>
                <li><b>1</b> seguro</li>
                <li><b>6</b> facturas</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="cf-final">
        <div>
          <p className="cf-eyebrow">PopCar</p>
          <h2>Un coche.<br /><span>Todo lo demás.</span></h2>
          <p className="cf-final-pie">Compra, vende y gestiona. En un solo sitio.</p>
          <button type="button" className="cf-final-boton" onClick={onGoHome}>Empezar</button>
        </div>
      </section>

    </div>
  );
}
