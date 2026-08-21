/**
 * Apertura temporal de la ficha de un vehículo sin iniciar sesión.
 *
 * Pedida para poder enseñar un anuncio concreto a gente sin cuenta. Afecta solo
 * a la **ficha** —`/marketplace-vo/<id>`—; el listado sigue pidiendo sesión. Y
 * solo a lo que se pinta: los datos del anuncio ya eran públicos, los sirve la
 * misma API sin credenciales, así que esto no destapa nada nuevo.
 *
 * **Se cierra sola.** La fecha va aquí en lugar de un interruptor porque un
 * interruptor hay que acordarse de volver a poner, y esto nació como «solo por
 * hoy». Pasada esa hora la puerta vuelve sin desplegar nada.
 *
 * Para prorrogarlo, mueve la fecha. Para cerrarlo antes, ponla en el pasado.
 *
 * Vive en su propio fichero porque hacen falta dos puertas, y estaban en sitios
 * distintos: la pantalla que se pinta (`App.js`) y el diálogo de sesión que el
 * arranque levanta encima cuando la ruta no está en su lista blanca
 * (`useAppBootstrap.js`). Abrir solo una dejaba el modal tapándolo todo igual.
 */

export const FICHA_VO_ABIERTA_HASTA = new Date("2026-08-21T23:59:59+02:00");

export const FICHA_VO_ABIERTA = Date.now() < FICHA_VO_ABIERTA_HASTA.getTime();

/** ¿Esta ruta es la ficha de un vehículo concreto, y está abierta ahora mismo? */
export function esFichaVoAbierta(pathname = "") {
  if (!FICHA_VO_ABIERTA) return false;
  const ruta = String(pathname || "").replace(/\/+$/, "");
  // Con algo detrás: `/marketplace-vo` a secas es el listado, que sigue cerrado.
  return ruta.startsWith("/marketplace-vo/") && ruta.length > "/marketplace-vo/".length;
}
