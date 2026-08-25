import React from "react";

/**
 * El IdCar que acompaña todo el recorrido.
 *
 * Es el hilo conductor: empieza vacío y se va construyendo capítulo a capítulo,
 * hasta quedar completo al final. La idea que sostiene toda la página es que lo
 * que PopCar acumula no es un coche, es su historia.
 *
 * Dos reglas que no se rompen:
 *
 *  - Los campos son los que un IdCar guarda de verdad —marca, modelo, año,
 *    kilómetros, matrícula, distintivo ambiental, próxima ITV, aseguradora— y
 *    los adjuntos son los cinco tipos que admite: fotos, documentos, ITV,
 *    seguro y facturas de mantenimiento.
 *  - Cada dato aparece en el capítulo donde el usuario lo consigue de verdad.
 *    La matrícula no sale hasta que hay que darla, en «Cuéntanos tu coche»,
 *    porque hasta ese momento PopCar no la tiene.
 *
 * El relleno se decide por el capítulo activo, que cambia ocho veces en todo el
 * recorrido. Nada de esto va atado al fotograma.
 */

/** Campos de la ficha, con el capítulo en el que se rellena cada uno. */
export const CAMPOS_IDCAR = [
  { clave: "marca", etiqueta: "Marca", valor: "Volkswagen", desde: 0 },
  { clave: "modelo", etiqueta: "Modelo", valor: "Golf", desde: 0 },
  { clave: "anio", etiqueta: "Año", valor: "2021", desde: 0 },
  { clave: "km", etiqueta: "Kilómetros", valor: "48.300 km", desde: 0 },
  { clave: "combustible", etiqueta: "Combustible", valor: "Gasolina", desde: 0 },
  { clave: "version", etiqueta: "Versión", valor: "1.5 TSI Life", desde: 3 },
  { clave: "cv", etiqueta: "Potencia", valor: "150 CV", desde: 3 },
  { clave: "cambio", etiqueta: "Cambio", valor: "Manual", desde: 3 },
  { clave: "matricula", etiqueta: "Matrícula", valor: "1234 KLM", desde: 4 },
  { clave: "color", etiqueta: "Color", valor: "Gris", desde: 4 },
  { clave: "etiqueta", etiqueta: "Distintivo", valor: "C", desde: 7 },
  { clave: "itv", etiqueta: "Próxima ITV", valor: "03/2027", desde: 7 },
];

/** Datos que no son campos de la ficha, sino resultados de cada flujo. */
export const SELLOS_IDCAR = [
  { clave: "encaje", texto: "Encaje 92 / 100", desde: 1 },
  { clave: "comparado", texto: "1.º de 4 comparados", desde: 2 },
  { clave: "cuota", texto: "285 €/mes · 60 meses", desde: 3 },
  { clave: "mercado", texto: "Media del mercado 18.400 €", desde: 5 },
  { clave: "venta", texto: "Venta gestionada solicitada", desde: 6 },
];

/** Los cinco tipos de adjunto que admite un IdCar. */
export const ADJUNTOS_IDCAR = [
  { clave: "fotos", etiqueta: "Fotos", n: 12 },
  { clave: "docs", etiqueta: "Documentos", n: 4 },
  { clave: "itv", etiqueta: "ITV", n: 2 },
  { clave: "seguro", etiqueta: "Seguro", n: 1 },
  { clave: "facturas", etiqueta: "Facturas", n: 6 },
];

export default function IdCarHilo({ capitulo, visible }) {
  const camposLlenos = CAMPOS_IDCAR.filter((c) => capitulo >= c.desde).length;
  const total = CAMPOS_IDCAR.length;
  const conAdjuntos = capitulo >= 7;

  return (
    <aside
      className={`cf-idcar${visible ? " es-visible" : ""}${conAdjuntos ? " es-completo" : ""}`}
      aria-label="Ficha del coche que se construye durante el recorrido"
    >
      <header className="cf-idcar-cab">
        <span className="cf-idcar-marca">IdCar</span>
        <span className="cf-idcar-cuenta">
          {camposLlenos} / {total}
        </span>
      </header>

      <dl className="cf-idcar-campos">
        {CAMPOS_IDCAR.map((campo) => {
          const lleno = capitulo >= campo.desde;
          return (
            <div key={campo.clave} className={`cf-idcar-campo${lleno ? " es-lleno" : ""}`}>
              <dt>{campo.etiqueta}</dt>
              <dd>{lleno ? campo.valor : ""}</dd>
            </div>
          );
        })}
      </dl>

      <div className="cf-idcar-sellos">
        {SELLOS_IDCAR.filter((s) => capitulo >= s.desde).map((sello) => (
          <span key={sello.clave} className="cf-idcar-sello">{sello.texto}</span>
        ))}
      </div>

      {conAdjuntos && (
        <div className="cf-idcar-adjuntos">
          {ADJUNTOS_IDCAR.map((a) => (
            <span key={a.clave} className="cf-idcar-adjunto">
              <b>{a.n}</b> {a.etiqueta}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
