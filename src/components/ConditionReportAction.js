import React from "react";

/**
 * El disparador del informe de estado: enlace cuando ya sabemos adónde ir,
 * botón cuando hay que crear la sesión primero.
 *
 * La distinción no es estética. Abrir una pestaña por `window.open` depende de
 * que el navegador acepte que la orden viene de un clic, y ese permiso se
 * pierde en cuanto hay una espera por medio o el bloqueador está en modo
 * estricto. Un `<a target>` no pide permiso a nadie: es navegación normal.
 * Como la consulta que dice "informe a medias" ya trae el enlace de la sesión
 * abierta, en ese caso no hay ninguna razón para pasar por JavaScript.
 *
 * El nombre de destino se conserva para no abrir dos capturas del mismo coche,
 * y `rel="opener"` mantiene el canal por el que la captura avisa de que ha
 * terminado.
 */
export default function ConditionReportAction({ url, onClick, disabled, style, children }) {
  const comun = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    boxSizing: "border-box",
    ...style,
  };

  if (typeof url === "string" && url.trim() !== "") {
    return (
      <a href={url.trim()} target="carswise-check" rel="opener" style={comun}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} style={comun}>
      {children}
    </button>
  );
}
