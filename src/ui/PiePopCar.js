import React from "react";
import LogoPopCar from "./LogoPopCar";
import "./PiePopCar.css";

/**
 * El pie de PopCar, uno solo para toda la aplicacion.
 *
 * Antes habia dos: el del home y otro distinto en el resto de pantallas, con
 * otra maqueta, otras columnas y otro aspecto. Este es el del home, y recibe
 * los enlaces de fuera para que cada pantalla pueda enchufar sus manejadores
 * reales sin duplicar la maqueta.
 *
 *   columnas → [{ titulo, enlaces: [{ texto, onClick }] }]
 *   legales  → [{ texto, onClick }]   (sin onClick se pinta como texto)
 */
export default function PiePopCar({ columnas = [], legales = [], lema, onLogo, derechos }) {
  return (
    <footer className="pc-pie">
      <div className="pc-pie-rejilla">
        <div>
          <button
            type="button"
            className="pc-logo"
            onClick={onLogo}
            aria-label="PopCar"
            disabled={!onLogo}
            style={!onLogo ? { cursor: "default" } : undefined}
          >
            <LogoPopCar size={26} tono="claro" />
          </button>
          {lema ? <p>{lema}</p> : null}
        </div>

        {columnas.map((col) => (
          <div key={col.titulo}>
            <h4>{col.titulo}</h4>
            {col.enlaces.map((e) => (
              <button key={e.texto} type="button" onClick={e.onClick}>{e.texto}</button>
            ))}
          </div>
        ))}
      </div>

      <div className="pc-pie-abajo">
        <span>© {new Date().getFullYear()} PopCar · {derechos}</span>
        <span className="pc-pie-legal">
          {legales.map((l, i) => (
            <React.Fragment key={l.texto}>
              {i > 0 ? <i aria-hidden="true"> · </i> : null}
              {l.onClick
                ? <button type="button" onClick={l.onClick}>{l.texto}</button>
                : <span>{l.texto}</span>}
            </React.Fragment>
          ))}
        </span>
      </div>
    </footer>
  );
}
