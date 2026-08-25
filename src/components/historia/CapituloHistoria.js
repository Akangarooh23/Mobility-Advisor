import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Un capítulo del recorrido: varias escenas que se suceden mientras el capítulo
 * permanece fijo en pantalla.
 *
 * Sobre el «pin». ScrollTrigger sabe hacerlo con `pin: true`, pero para eso
 * inserta un elemento espaciador y recalcula alturas; con ocho capítulos
 * encadenados eso da saltos al entrar y salir, y se pelea con el redimensionado.
 * Aquí el capítulo se queda quieto con `position: sticky`, que lo resuelve el
 * navegador sin tocar el documento, y ScrollTrigger se dedica solo a lo que hace
 * mejor: convertir el scroll en el avance de una línea de tiempo. El efecto que
 * ve el usuario es el mismo y el comportamiento es bastante más estable.
 *
 * La altura de la sección la marca el número de escenas: cada una ocupa una
 * pantalla de recorrido. Así un capítulo de cuatro escenas pide cuatro pantallas
 * de scroll, y el ritmo sale parejo entre capítulos sin ajustarlo a mano.
 *
 * Todo va con `scrub`, así que la animación se recorre hacia delante y hacia
 * atrás: es el usuario quien la mueve, no un reproductor.
 */
export default function CapituloHistoria({
  capitulo,
  indice,
  onActivo,
  children,
}) {
  const seccion = useRef(null);
  const escenas = useRef([]);

  const numEscenas = capitulo.escenas.length;

  useLayoutEffect(() => {
    const el = seccion.current;
    if (!el) return undefined;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          anima: "(prefers-reduced-motion: no-preference)",
          quieto: "(prefers-reduced-motion: reduce)",
        },
        (contexto) => {
          const { anima } = contexto.conditions;
          const partes = escenas.current.filter(Boolean);
          const riel = el.querySelector("[data-riel]");

          // Sin movimiento: las escenas se leen una detrás de otra, con el mismo
          // texto y el mismo orden. Se pierde la animación, no el contenido.
          if (!anima) {
            gsap.set(partes, { autoAlpha: 1, y: 0, clearProps: "transform" });
            el.dataset.quieto = "si";
            return;
          }
          delete el.dataset.quieto;

          // Estado inicial: solo la primera escena a la vista.
          gsap.set(partes, { autoAlpha: 0, y: 28 });
          gsap.set(partes[0], { autoAlpha: 1, y: 0 });
          if (riel) gsap.set(riel, { scaleX: 0 });

          const linea = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.5,
              onToggle: (self) => { if (self.isActive) onActivo(indice); },
              onUpdate: (self) => {
                // El riel se escribe en el DOM, no en el estado de React: cambia
                // en cada fotograma y no merece un repintado del arbol.
                if (riel) riel.style.transform = `scaleX(${self.progress})`;
              },
            },
          });

          // Cada escena ocupa una fracción igual de la línea de tiempo. El relevo
          // entre dos escenas se solapa un poco para que no haya un hueco en
          // blanco entre ellas.
          const paso = 1 / numEscenas;
          const relevo = paso * 0.42;

          partes.forEach((parte, i) => {
            if (i === 0) return;
            const inicio = i * paso - relevo / 2;
            linea.to(partes[i - 1], { autoAlpha: 0, y: -28, ease: "none", duration: relevo }, inicio);
            linea.fromTo(
              parte,
              { autoAlpha: 0, y: 28 },
              { autoAlpha: 1, y: 0, ease: "none", duration: relevo },
              inicio
            );
          });

          // Un hueco al final para que la última escena se quede a la vista
          // mientras se recorre el ultimo tramo, en vez de irse antes de tiempo.
          linea.to({}, { duration: paso * 0.5 });
        }
      );
    }, seccion);

    return () => ctx.revert();
  }, [indice, numEscenas, onActivo]);

  return (
    <section
      ref={seccion}
      className="cf-capitulo"
      style={{ "--escenas": numEscenas }}
      aria-labelledby={`cap-${capitulo.id}`}
    >
      <div className="cf-capitulo-fijo">
        <div className="cf-capitulo-ancho">
          <header className="cf-capitulo-cab">
            <p className="cf-capitulo-eyebrow">
              <span className="cf-capitulo-n">{capitulo.n}</span>
              {capitulo.titulo}
            </p>
            <h2 id={`cap-${capitulo.id}`} className="cf-capitulo-titular">
              {capitulo.titular}
            </h2>
            <p className="cf-capitulo-entrada">{capitulo.entrada}</p>
            <span className="cf-capitulo-riel"><i data-riel={capitulo.id} /></span>
          </header>

          <div className="cf-capitulo-lienzo">
            {capitulo.escenas.map((escena, i) => (
              <div
                key={escena.id}
                className="cf-escena"
                ref={(nodo) => { escenas.current[i] = nodo; }}
              >
                <p className="cf-escena-paso">{escena.paso}</p>
                <h3 className="cf-escena-titulo">{escena.titulo}</h3>
                <p className="cf-escena-texto">{escena.texto}</p>
                <div className="cf-escena-visual">
                  {children ? children(escena, i) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
