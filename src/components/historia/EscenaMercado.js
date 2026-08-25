import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SEARCH_OFFERS_API_ENDPOINT } from "../../utils/apiClient";
import "./EscenaMercado.css";

/**
 * Escena 01 · el mercado reduciéndose.
 *
 * Lo que cuenta: hay medio millón de coches a la venta y casi ninguno es para
 * ti. Cada filtro apaga una parte del mercado, y al final quedan los que
 * encajan.
 *
 * Los números no son de adorno. Salen de contar en la base con estos filtros
 * exactos, en cascada, y el estado final lo devuelve la misma API que usa el
 * buscador: al llegar abajo se piden las ofertas de verdad y se pintan con la
 * tarjeta real del listado. Si el mercado cambia, la escena cambia con él.
 *
 * Los filtros son los que existen en el buscador, con su nombre tal cual:
 * Marca, Modelo, Combustible, Año, Kilómetros como máximo, Provincia y Cambio.
 *
 * Sobre el campo de puntos. Cada punto es una parcela del mercado, no un
 * adorno: se apagan en un orden fijo —cada uno tiene su umbral— así que bajar y
 * subir con el scroll enciende y apaga siempre los mismos, sin parpadeos. Los
 * apagados no desaparecen: se quedan en gris muy claro, porque siguen siendo
 * mercado, solo que no el tuyo. Va en Canvas porque son novecientos puntos
 * repintándose en cada fotograma y el DOM ahí se atraganta.
 *
 * Nada de esto pasa por el estado de React. El avance llega por `registrar` y se
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

const num = (n) => Math.round(n).toLocaleString("es-ES");

/** Umbral fijo por punto: define en qué orden se apagan. Estable entre renders. */
function sembrarUmbrales(total) {
  const umbrales = new Array(total);
  // Congruencial simple: hace falta que sea repartido y siempre igual, no que
  // sea criptográfico.
  let semilla = 20260825;
  for (let i = 0; i < total; i += 1) {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    umbrales[i] = semilla / 2147483648;
  }
  return umbrales;
}

export default function EscenaMercado({ registrar, indice }) {
  const lienzo = useRef(null);
  const cifra = useRef(null);
  const pie = useRef(null);
  const chips = useRef([]);
  const bloqueMercado = useRef(null);
  const bloqueResultados = useRef(null);
  const umbrales = useRef(sembrarUmbrales(PUNTOS));

  const [ofertas, setOfertas] = useState([]);
  const [totalReal, setTotalReal] = useState(null);
  // El mismo número que la API acaba de devolver, al alcance del lienzo. Sin
  // esto el contador terminaría en el 20 de la instantánea mientras la cabecera
  // de resultados enseña el de hoy, y bastaría una oferta nueva para que la
  // escena se contradijera a sí misma.
  const finalVivo = useRef(null);

  // Las ofertas del final son las que devuelve el buscador ahora mismo con esos
  // filtros. Si la llamada falla, la escena sigue funcionando: se queda con el
  // recuento de la cascada y sin tarjetas, que es mejor que inventarlas.
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
    // Sin contexto 2D —jsdom, navegadores muy viejos, impresión— la escena no
    // se queda muerta: se pierde el campo de puntos, no la cifra ni los filtros.
    const ctx2d = typeof cv.getContext === "function" ? cv.getContext("2d") : null;
    let ancho = 0;
    let alto = 0;
    let radio = 0;
    let sepX = 0;
    let sepY = 0;

    const medir = () => {
      if (!ctx2d) return;
      const caja = cv.getBoundingClientRect();
      // El lienzo se dibuja a la densidad real de la pantalla, pero se limita a
      // 2: por encima de ahí no se nota y sí se paga.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = caja.width;
      alto = caja.height;
      cv.width = Math.round(ancho * dpr);
      cv.height = Math.round(alto * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      const filas = Math.ceil(PUNTOS / COLUMNAS);
      sepX = ancho / COLUMNAS;
      sepY = alto / filas;
      radio = Math.max(1.4, Math.min(sepX, sepY) * 0.19);
    };

    const pintar = (fraccion, remate) => {
      if (!ctx2d) return;
      ctx2d.clearRect(0, 0, ancho, alto);
      for (let i = 0; i < PUNTOS; i += 1) {
        const col = i % COLUMNAS;
        const fil = Math.floor(i / COLUMNAS);
        const x = sepX * (col + 0.5);
        const y = sepY * (fil + 0.5);
        const vivo = umbrales.current[i] < fraccion;
        if (vivo) {
          // En el último tramo los que quedan son ya «los tuyos»: se marcan.
          ctx2d.fillStyle = remate > 0 ? "#FFC400" : "#111111";
          ctx2d.beginPath();
          ctx2d.arc(x, y, radio * (1 + remate * 1.6), 0, Math.PI * 2);
          ctx2d.fill();
        } else {
          ctx2d.fillStyle = "#E4E4DF";
          ctx2d.beginPath();
          ctx2d.arc(x, y, radio * 0.72, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }
    };

    /**
     * Reparte el avance de la escena entre los pasos del embudo.
     *
     * El primer tramo es de respiro —se ve el mercado entero, sin tocar nada— y
     * el último deja los resultados a la vista. En medio, un tramo por filtro.
     */
    const aplicar = (p) => {
      const RESPIRO = 0.12;
      const CIERRE = 0.16;
      const pasos = EMBUDO.length - 1;
      const util = 1 - RESPIRO - CIERRE;

      let avance = (p - RESPIRO) / util;
      avance = avance < 0 ? 0 : avance > 1 ? 1 : avance;

      const enPasos = avance * pasos;
      const i = Math.min(pasos - 1, Math.floor(enPasos));
      const dentro = enPasos - i;

      const desde = EMBUDO[i].ofertas;
      const hasta = i + 1 === pasos && finalVivo.current != null
        ? Math.max(1, finalVivo.current)
        : EMBUDO[i + 1].ofertas;
      // Interpolación en escala logarítmica: de 568.358 a 20 en lineal, el
      // número se desploma en el primer suspiro y luego no se mueve. En
      // logarítmica cada filtro se nota lo mismo, que es justo lo que cuenta la
      // escena: todos recortan.
      const valor = Math.exp(Math.log(desde) + (Math.log(hasta) - Math.log(desde)) * dentro);

      const total = EMBUDO[0].ofertas;
      const fraccion = valor / total;
      // Suelo para que en la recta final quede algo encendido que mirar.
      const conSuelo = Math.max(fraccion, avance >= 1 ? 0.004 : 0);
      const remate = p > 1 - CIERRE ? Math.min(1, (p - (1 - CIERRE)) / CIERRE) : 0;

      pintar(conSuelo, remate);

      if (cifra.current) cifra.current.textContent = num(valor);
      if (pie.current) {
        // Se mira el tramo, no el número: la interpolación logarítmica devuelve
        // 568.357,999… en el arranque y un `===` contra el total nunca acierta.
        pie.current.textContent =
          avance >= 1
            ? "coches encontrados"
            : avance <= 0
            ? "coches a la venta ahora mismo"
            : "coches siguen encajando";
      }

      // Los filtros se marcan según los va aplicando el embudo.
      chips.current.forEach((chip, k) => {
        if (!chip) return;
        const activo = enPasos > k;
        chip.classList.toggle("es-puesto", activo);
      });

      // Del mercado a los resultados: el campo se retira y entran las fichas.
      if (bloqueMercado.current) {
        bloqueMercado.current.style.opacity = String(1 - remate);
        bloqueMercado.current.style.transform = `scale(${1 - remate * 0.06})`;
      }
      if (bloqueResultados.current) {
        bloqueResultados.current.style.opacity = String(remate);
        bloqueResultados.current.style.transform = `translateY(${(1 - remate) * 24}px)`;
        bloqueResultados.current.style.pointerEvents = remate > 0.5 ? "auto" : "none";
      }
    };

    // Se recuerda el último avance para poder repintar al redimensionar sin
    // perder el sitio: si no, girar el móvil devolvería la escena al principio.
    const ultimo = { valor: 0 };
    const conMemoria = (p) => { ultimo.valor = p; aplicar(p); };
    const alRedimensionar = () => { medir(); aplicar(ultimo.valor); };

    medir();
    conMemoria(0);
    registrar(indice, conMemoria);

    window.addEventListener("resize", alRedimensionar);
    return () => {
      window.removeEventListener("resize", alRedimensionar);
      registrar(indice, null);
    };
  }, [registrar, indice]);

  const totalPortada = totalReal ?? EMBUDO[EMBUDO.length - 1].ofertas;

  return (
    <div className="em-root">
      <div className="em-mercado" ref={bloqueMercado}>
        <div className="em-cifra">
          <strong ref={cifra}>{num(EMBUDO[0].ofertas)}</strong>
          <span ref={pie}>coches a la venta ahora mismo</span>
        </div>
        <canvas ref={lienzo} className="em-lienzo" aria-hidden="true" />
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
        <div className="em-rejilla">
          {ofertas.slice(0, 4).map((o) => (
            <article key={o.id} className="em-oferta">
              <div className="em-oferta-foto">
                {o.image ? <img src={o.image} alt="" loading="lazy" /> : <span />}
              </div>
              <div className="em-oferta-cuerpo">
                <h4>{o.brand} {o.model}</h4>
                <p className="em-oferta-version">{o.version}</p>
                <p className="em-oferta-datos">
                  {o.year} · {num(o.mileage)} km · {o.fuel}
                </p>
                <p className="em-oferta-precio">{o.priceText}</p>
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
