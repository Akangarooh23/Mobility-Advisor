import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SEARCH_OFFERS_API_ENDPOINT } from "../../utils/apiClient";
import "./EscenaMercado.css";

/**
 * Escena 01 · el mercado reduciéndose.
 *
 * Lo que cuenta: hay medio millón de coches a la venta y casi ninguno es para
 * ti. Cada filtro apaga una parte del mercado, y al final los que quedan se
 * convierten en las ofertas de verdad.
 *
 * Los números no son de adorno. Salen de contar en la base con estos filtros
 * exactos, en cascada, y el final lo devuelve la misma API que usa el buscador:
 * al llegar abajo se piden las ofertas reales y se pintan. Si el mercado cambia,
 * la escena cambia con él.
 *
 * Los filtros son los que existen en el buscador, con su nombre tal cual:
 * Marca, Modelo, Combustible, Año, Kilómetros como máximo, Provincia y Cambio.
 *
 * Tres decisiones sostienen la escena:
 *
 *  - **El filtro provoca la caída.** Dentro del tramo de cada filtro, el primer
 *    tercio lo dedica a aparecer con el número quieto, y en los dos tercios
 *    restantes el número baja. Sin esa pausa el número no para nunca y el chip
 *    parece que sale porque sí, en vez de ser la causa.
 *
 *  - **Los puntos acaban siendo los coches.** Durante casi toda la escena cada
 *    punto es una parcela del mercado y se apagan por proporción. En el último
 *    tramo dejan de representar proporción y pasan a ser exactamente las ofertas
 *    que hay: veinte puntos, que vuelan hasta las fichas y se convierten en
 *    ellas. Ahí es donde el dato abstracto se vuelve un coche que puedes abrir.
 *
 *  - **Se apagan en un orden fijo.** Cada punto tiene su sitio en la cola, así
 *    que subir y bajar con el scroll enciende y apaga siempre los mismos, sin
 *    parpadeos. Los apagados no desaparecen: quedan en gris claro, porque siguen
 *    siendo mercado, solo que no el tuyo.
 *
 * Va en Canvas porque son novecientos puntos repintándose en cada fotograma. Y
 * nada de esto pasa por el estado de React: el avance llega por `registrar` y se
 * escribe directamente en el lienzo y en el texto.
 */

/** El embudo, contado en la base el 25 de agosto de 2026. */
export const EMBUDO = [
  { filtro: null, valor: null, ofertas: 568358 },
  { filtro: "Marca", valor: "Volkswagen", ofertas: 36310 },
  { filtro: "Modelo", valor: "Golf", ofertas: 7527 },
  { filtro: "Combustible", valor: "Gasolina", ofertas: 3490 },
  { filtro: "Año", valor: "desde 2021", ofertas: 1349 },
  { filtro: "Kilómetros como máximo", valor: "60.000", ofertas: 749 },
  { filtro: "Provincia", valor: "Madrid", ofertas: 66 },
  { filtro: "Cambio", valor: "Automática", ofertas: 20 },
];

/** Los mismos filtros, en el idioma de la API. */
const CONSULTA_FINAL =
  "brand=Volkswagen&model=Golf&fuel=Gasolina&minYear=2021&maxMileage=60000" +
  "&province=Madrid&transmission=Automatica&limit=6";

const PUNTOS = 900;
const COLUMNAS = 45;
/** Parte del tramo de cada filtro en la que el chip aparece y el número espera. */
const PAUSA = 0.32;

const num = (n) => Math.round(n).toLocaleString("es-ES");
const suave = (t) => t * t * (3 - 2 * t);
const entre = (a, b, t) => a + (b - a) * t;

/**
 * Orden fijo en el que se van apagando los puntos. Repartido pero siempre el
 * mismo: hace falta que no parpadee al subir y bajar, no que sea criptográfico.
 */
function sembrarOrden(total) {
  const claves = new Array(total);
  let semilla = 20260825;
  for (let i = 0; i < total; i += 1) {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    claves[i] = { i, k: semilla / 2147483648 };
  }
  claves.sort((a, b) => a.k - b.k);
  // orden[p] = índice del punto que ocupa la posición p de la cola. Los
  // primeros son los últimos en apagarse: los supervivientes.
  return claves.map((c) => c.i);
}

export default function EscenaMercado({ registrar, indice }) {
  const lienzo = useRef(null);
  const banda = useRef(null);
  const cifra = useRef(null);
  const pie = useRef(null);
  const chips = useRef([]);
  const bloqueMercado = useRef(null);
  const bloqueResultados = useRef(null);
  const rejilla = useRef(null);
  const orden = useRef(sembrarOrden(PUNTOS));

  const [ofertas, setOfertas] = useState([]);
  const [totalReal, setTotalReal] = useState(null);
  // El número que la API acaba de devolver, al alcance del lienzo. Sin esto el
  // contador terminaría en el 20 de la instantánea mientras la cabecera de
  // resultados enseña el de hoy.
  const finalVivo = useRef(null);
  // El avance vive fuera del efecto: cuando llegan las ofertas el efecto se
  // rehace, y si la memoria estuviera dentro la escena daria un salto al
  // principio justo cuando termina la llamada.
  const avanceActual = useRef(0);

  useEffect(() => {
    let vivo = true;
    fetch(`${SEARCH_OFFERS_API_ENDPOINT}?${CONSULTA_FINAL}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo || !d?.ok) return;
        setOfertas(d.ofertas || []);
        if (typeof d.total === "number") { setTotalReal(d.total); finalVivo.current = d.total; }
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useLayoutEffect(() => {
    const cv = lienzo.current;
    if (!cv) return undefined;
    // Sin contexto 2D —jsdom, navegadores viejos, impresión— la escena no muere:
    // se pierde el campo de puntos, no la cifra ni los filtros.
    const ctx2d = typeof cv.getContext === "function" ? cv.getContext("2d") : null;

    let ancho = 0;
    let alto = 0;
    let radio = 2;
    const rejillaPuntos = [];   // posición de cada punto en reposo
    let destinos = [];          // rectángulos de las fichas, para el aterrizaje

    const medir = () => {
      if (!ctx2d) return;
      const caja = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = caja.width;
      alto = caja.height;
      cv.width = Math.round(ancho * dpr);
      cv.height = Math.round(alto * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

      // El campo de puntos ocupa la franja que le reserva el maquetado, no una
      // medida inventada aquí: así el CSS sigue mandando sobre la composición.
      const zona = banda.current?.getBoundingClientRect();
      const x0 = (zona?.left ?? caja.left) - caja.left;
      const y0 = (zona?.top ?? caja.top) - caja.top;
      const w = zona?.width ?? ancho;
      const h = zona?.height ?? alto;

      const filas = Math.ceil(PUNTOS / COLUMNAS);
      const sepX = w / COLUMNAS;
      const sepY = h / filas;
      radio = Math.max(1.3, Math.min(sepX, sepY) * 0.2);

      rejillaPuntos.length = 0;
      for (let i = 0; i < PUNTOS; i += 1) {
        rejillaPuntos.push({
          x: x0 + sepX * ((i % COLUMNAS) + 0.5),
          y: y0 + sepY * (Math.floor(i / COLUMNAS) + 0.5),
        });
      }

      // Las fichas están en el DOM aunque todavía no se vean: de ahí salen los
      // destinos exactos, en vez de calcular posiciones a mano que luego no
      // cuadran con lo que se pinta encima.
      const tarjetas = rejilla.current?.querySelectorAll(".em-oferta") || [];
      destinos = Array.from(tarjetas).map((t) => {
        const r = t.getBoundingClientRect();
        return { x: r.left - caja.left, y: r.top - caja.top, w: r.width, h: r.height };
      });
    };

    const pintar = (encendidos, remate) => {
      if (!ctx2d) return;
      ctx2d.clearRect(0, 0, ancho, alto);
      const t = suave(remate);

      for (let p = 0; p < PUNTOS; p += 1) {
        const i = orden.current[p];
        const casa = rejillaPuntos[i];
        if (!casa) continue;
        const vivo = p < encendidos;

        if (!vivo) {
          // Apagado, pero presente: sigue siendo mercado.
          ctx2d.globalAlpha = 1 - t;          // en el aterrizaje se retira
          ctx2d.fillStyle = "#E4E4DF";
          ctx2d.beginPath();
          ctx2d.arc(casa.x, casa.y, radio * 0.72, 0, Math.PI * 2);
          ctx2d.fill();
          continue;
        }

        let x = casa.x;
        let y = casa.y;
        let r = radio;

        if (t > 0 && destinos.length) {
          // Los supervivientes vuelan a su ficha y se reparten dentro de ella.
          const destino = destinos[p % destinos.length];
          const fila = Math.floor(p / destinos.length);
          const dx = destino.x + destino.w * (0.22 + 0.56 * ((fila % 3) / 2));
          const dy = destino.y + destino.h * (0.24 + 0.52 * ((Math.floor(fila / 3) % 3) / 2));
          x = entre(casa.x, dx, t);
          y = entre(casa.y, dy, t);
          r = entre(radio, radio * 2.2, t);
        }

        ctx2d.globalAlpha = 1;
        ctx2d.fillStyle = remate > 0 ? "#FFC400" : "#111111";
        ctx2d.beginPath();
        ctx2d.arc(x, y, r, 0, Math.PI * 2);
        ctx2d.fill();
      }

      // Ya juntos, los puntos cuajan en la silueta de cada ficha. Es el paso que
      // convierte el dato en un coche que se puede abrir.
      if (t > 0.45 && destinos.length) {
        const cuaje = (t - 0.45) / 0.55;
        ctx2d.globalAlpha = cuaje;
        ctx2d.fillStyle = "#FFC400";
        destinos.forEach((d) => {
          const radioCaja = 12;
          ctx2d.beginPath();
          if (ctx2d.roundRect) ctx2d.roundRect(d.x, d.y, d.w, d.h, radioCaja);
          else ctx2d.rect(d.x, d.y, d.w, d.h);
          ctx2d.fill();
        });
      }
      ctx2d.globalAlpha = 1;
    };

    /**
     * Reparte el avance de la escena: un respiro con el mercado entero, un tramo
     * por filtro, y el aterrizaje en las fichas.
     */
    const aplicar = (p) => {
      const RESPIRO = 0.1;
      const CIERRE = 0.2;
      const pasos = EMBUDO.length - 1;
      const util = 1 - RESPIRO - CIERRE;

      let avance = (p - RESPIRO) / util;
      avance = avance < 0 ? 0 : avance > 1 ? 1 : avance;

      const enPasos = avance * pasos;
      const i = Math.min(pasos - 1, Math.floor(enPasos));
      // Dentro del tramo: primero el chip, con el número quieto; después baja.
      const bruto = enPasos - i;
      const dentro = bruto <= PAUSA ? 0 : (bruto - PAUSA) / (1 - PAUSA);

      const desde = EMBUDO[i].ofertas;
      const hasta = i + 1 === pasos && finalVivo.current != null
        ? Math.max(1, finalVivo.current)
        : EMBUDO[i + 1].ofertas;
      // Escala logarítmica: en lineal, de 568.358 a 20 el número se desploma en
      // el primer suspiro y los seis filtros siguientes no se notan.
      const valor = Math.exp(entre(Math.log(desde), Math.log(hasta), suave(dentro)));

      const total = EMBUDO[0].ofertas;
      const remate = p > 1 - CIERRE ? Math.min(1, (p - (1 - CIERRE)) / CIERRE) : 0;

      // Los puntos encendidos son la proporción del mercado que queda… hasta el
      // aterrizaje, donde pasan a ser exactamente las ofertas que hay.
      const resultados = Math.max(1, Math.round(finalVivo.current ?? EMBUDO[pasos].ofertas));
      const porProporcion = Math.round((valor / total) * PUNTOS);
      const encendidos = remate > 0
        ? Math.round(entre(porProporcion, resultados, suave(remate)))
        : Math.max(porProporcion, avance >= 1 ? resultados : 0);

      pintar(Math.max(0, Math.min(PUNTOS, encendidos)), remate);

      if (cifra.current) cifra.current.textContent = num(valor);
      if (pie.current) {
        pie.current.textContent =
          avance >= 1 ? "coches encontrados"
            : avance <= 0 ? "coches a la venta ahora mismo"
            : "coches siguen encajando";
      }

      chips.current.forEach((chip, k) => {
        if (chip) chip.classList.toggle("es-puesto", enPasos > k);
      });

      if (bloqueMercado.current) {
        // La cifra y los filtros se retiran; el campo de puntos no, que es quien
        // hace el viaje hasta las fichas.
        bloqueMercado.current.style.opacity = String(1 - suave(remate));
      }
      if (bloqueResultados.current) {
        // Las fichas entran cuando los puntos ya han llegado a su sitio.
        const entrada = remate < 0.55 ? 0 : (remate - 0.55) / 0.45;
        bloqueResultados.current.style.opacity = String(entrada);
        bloqueResultados.current.style.pointerEvents = entrada > 0.6 ? "auto" : "none";
      }
    };

    const conMemoria = (p) => { avanceActual.current = p; aplicar(p); };
    const alRedimensionar = () => { medir(); aplicar(avanceActual.current); };

    medir();
    aplicar(avanceActual.current);
    registrar(indice, conMemoria);

    window.addEventListener("resize", alRedimensionar);
    return () => {
      window.removeEventListener("resize", alRedimensionar);
      registrar(indice, null);
    };
  }, [registrar, indice, ofertas.length]);

  const totalPortada = totalReal ?? EMBUDO[EMBUDO.length - 1].ofertas;

  return (
    <div className="em-root">
      <canvas ref={lienzo} className="em-lienzo" aria-hidden="true" />

      <div className="em-mercado" ref={bloqueMercado}>
        <div className="em-cifra">
          <strong ref={cifra}>{num(EMBUDO[0].ofertas)}</strong>
          <span ref={pie}>coches a la venta ahora mismo</span>
        </div>
        <div className="em-banda" ref={banda} aria-hidden="true" />
        <ul className="em-filtros">
          {EMBUDO.slice(1).map((paso, k) => (
            <li
              key={paso.filtro}
              className="em-filtro"
              ref={(n) => { chips.current[k] = n; }}
            >
              <span className="em-filtro-nombre">{paso.filtro}</span>
              <span className="em-filtro-valor">{paso.valor}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="em-resultados" ref={bloqueResultados}>
        <p className="em-resultados-cab">
          <strong>{num(totalPortada)}</strong> coches encontrados
        </p>
        <div className="em-rejilla" ref={rejilla}>
          {(ofertas.length ? ofertas.slice(0, 4) : [null, null, null, null]).map((o, k) => (
            <article key={o ? o.id : `hueco-${k}`} className="em-oferta">
              <div className="em-oferta-foto">
                {o?.image ? <img src={o.image} alt="" loading="lazy" /> : <span />}
              </div>
              <div className="em-oferta-cuerpo">
                <h4>{o ? `${o.brand} ${o.model}` : ""}</h4>
                <p className="em-oferta-version">{o?.version || ""}</p>
                <p className="em-oferta-datos">
                  {o ? `${o.year} · ${num(o.mileage)} km · ${o.fuel}` : ""}
                </p>
                <p className="em-oferta-precio">{o?.priceText || ""}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="em-resultados-pie">
          Ofertas reales, traídas del buscador con esos mismos filtros.
        </p>
      </div>
    </div>
  );
}
