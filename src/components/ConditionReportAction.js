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
 * Va a `_blank` y no a una ventana con nombre. Con nombre se evitaban pestañas
 * duplicadas, pero si ya había una captura abierta —aunque fuera en otra
 * ventana o minimizada— el navegador la reutilizaba sin traerla al frente: el
 * usuario pinchaba, no veía nada y daba por hecho que el botón no funcionaba.
 * Un enlace no puede forzar el foco, así que la única salida es una pestaña
 * nueva. Una de más se cierra; una invisible parece una avería.
 *
 * `rel="opener"` mantiene el canal por el que la captura avisa de que ha
 * terminado: con `_blank` los navegadores lo cortan salvo que se pida.
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
      // El `opener` es el canal de vuelta y se quiere. La regla protege de que
      // una página ajena pueda redirigir a la que la abrió; aquí el destino es
      // nuestra propia captura, y el escuchador comprueba el origen igualmente.
      // eslint-disable-next-line react/jsx-no-target-blank
      <a href={url.trim()} target="_blank" rel="opener" style={comun}>
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
