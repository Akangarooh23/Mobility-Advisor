import React from "react";

/**
 * Indicador de progreso del recorrido de «Cómo funciona».
 *
 * Enseña los ocho capítulos y en cuál estás. Se puede pulsar: el recorrido es
 * largo y obligar a rebobinar con el dedo para volver a un capítulo anterior
 * seria castigar al que quiere repasar algo.
 *
 * La barra de dentro de cada marca NO se mueve desde React. La mueve GSAP
 * escribiendo directamente en el DOM, porque el progreso cambia en cada
 * fotograma y pasar eso por el estado de React repintaría el arbol entero
 * sesenta veces por segundo. React solo se entera del cambio de capitulo, que
 * ocurre ocho veces en todo el recorrido.
 */
export default function ProgresoHistoria({ capitulos, activo, onIr }) {
  return (
    <nav className="cf-progreso" aria-label="Capítulos">
      <ol>
        {capitulos.map((cap, i) => {
          const estado = i < activo ? "visto" : i === activo ? "actual" : "pendiente";
          return (
            <li key={cap.id} className={`cf-progreso-item es-${estado}`}>
              <button
                type="button"
                onClick={() => onIr(i)}
                aria-current={i === activo ? "step" : undefined}
              >
                <span className="cf-progreso-n">{cap.n}</span>
                <span className="cf-progreso-riel">
                  {/* GSAP escribe aqui el scaleX; empieza a cero. */}
                  <i data-riel={cap.id} />
                </span>
                <span className="cf-progreso-titulo">{cap.titulo}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
