import "./ComoSubirTuCochePage.css";
import {
  TITULO, ENTRADILLA, PASOS, DESPUES, LO_TUYO, EL_TRATO, DUDAS,
} from "../utils/comoSubirTuCoche";
import { descargaLaGuia } from "../utils/guiaDescargable";

/**
 * «Cómo subir tu coche», para el cliente que acaba de decir que sí.
 *
 * Se lee en pantalla y se descarga, y las dos cosas dicen lo mismo porque salen
 * del mismo sitio. Se descarga porque la necesita **mientras trabaja**: abierta
 * en el ordenador con el móvil en la mano haciendo las fotos, reenviada a su
 * hijo, o impresa. Un correo con seis enlaces no sirve para eso.
 *
 * Cada paso lleva su porqué. Sin él, «sube seis fotos» es una orden; con él es
 * una razón, y quien entiende la razón hace mejor la foto — que es justo lo que
 * queremos, porque esas fotos son el anuncio.
 *
 * No lleva cabecera ni menú: se llega desde un correo o desde un enlace que le
 * hemos mandado, y lo único que tiene que hacer aquí es leer y descargar.
 */
export default function ComoSubirTuCochePage({ onIrAlPanel }) {
  return (
    <div className="csc-root">
      <div className="csc-hoja">
        <header className="csc-cab">
          <p className="csc-eyebrow">Nosotros lo vendemos por ti</p>
          <h1>{TITULO}</h1>
          <p className="csc-entradilla">{ENTRADILLA}</p>

          <div className="csc-acciones">
            <button type="button" className="csc-descargar" onClick={descargaLaGuia}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
              </svg>
              Descargar esta guía
            </button>
            {onIrAlPanel && (
              <button type="button" className="csc-panel" onClick={onIrAlPanel}>
                Ir a mi panel
              </button>
            )}
          </div>
        </header>

        <ol className="csc-pasos">
          {PASOS.map((p, i) => (
            <li className="csc-paso" key={p.titulo}>
              <div className="csc-num">{i + 1}</div>
              <div className="csc-cuerpo">
                <h2>{p.titulo}</h2>
                <p className="csc-donde">{p.donde}</p>

                <ul className="csc-que">
                  {p.que.map((q) => <li key={q}>{q}</li>)}
                </ul>

                {/*
                  * El porqué va con el paso y no al final.
                  *
                  * Quien lee esto está solo delante de su coche. «Sube seis
                  * fotos» sin motivo se cumple a medias; sabiendo que esas fotos
                  * son el anuncio, se cumple bien.
                  */}
                <p className="csc-porque"><strong>Por qué:</strong> {p.porque}</p>
                <p className="csc-consejo"><strong>Un consejo:</strong> {p.consejo}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="csc-bloque">
          <h2>Y a partir de ahí, nos encargamos nosotros</h2>
          <ul>{DESPUES.map((d) => <li key={d}>{d}</li>)}</ul>
        </section>

        <section className="csc-bloque">
          <h2>Y lo que sigue siendo tuyo</h2>
          <ul>{LO_TUYO.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>

        <section className="csc-bloque csc-trato">
          <h2>El trato</h2>
          <ul>{EL_TRATO.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>

        <p className="csc-dudas">{DUDAS}</p>
      </div>
    </div>
  );
}
