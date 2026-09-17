/**
 * La ficha de un coche se ve sin iniciar sesión.
 *
 * Empezó como apertura temporal —con fecha de cierre el 21 de agosto de 2026—
 * para enseñar un anuncio concreto a gente sin cuenta. Pero el camino entero del
 * particular gestionado depende de esto: el comprador de coches.net o Wallapop
 * no tiene cuenta, entra por `popcar.com.es/v/MATRÍCULA`, ve la ficha y pide la
 * cita sin registrarse. Con la fecha pasada, ese comprador se encontraba el
 * diálogo de iniciar sesión y se iba: el anuncio pagado no llevaba a nadie.
 *
 * Así que ya no caduca. Afecta solo a la **ficha** —`/marketplace-vo/<id>`— y a
 * la dirección corta que lleva a ella, `/v/<matrícula>`; el listado sigue
 * pidiendo sesión. Y solo a lo que se pinta: los datos del anuncio ya eran
 * públicos, los sirve la misma API sin credenciales.
 *
 * Hacen falta dos puertas y están en sitios distintos: la pantalla que se pinta
 * (`App.js`) y el diálogo de sesión que el arranque levanta encima cuando la
 * ruta no está en su lista blanca (`useAppBootstrap.js`). Abrir solo una deja el
 * modal tapándolo todo igual.
 */

export const FICHA_VO_PUBLICA = true;

/** ¿Esta ruta es la ficha de un coche concreto, o la dirección corta que lleva a ella? */
export function esFichaDeUnCoche(pathname = "") {
  const ruta = String(pathname || "").replace(/\/+$/, "");
  // Con algo detrás: `/marketplace-vo` a secas es el listado, que sigue cerrado.
  if (ruta.startsWith("/marketplace-vo/") && ruta.length > "/marketplace-vo/".length) return true;
  // `/v/8888LXR`: la que va escrita en los anuncios de los portales.
  return /^\/v\/[^/]+$/i.test(ruta);
}
