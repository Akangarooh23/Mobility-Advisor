/**
 * El enlace a la ficha de un coche, y cómo se abre.
 *
 * ## Por qué existe esto
 *
 * Las tarjetas del marketplace eran `<div onClick>`: con el tabulador **no había forma
 * de abrir un coche desde el listado**, y un lector de pantalla las leía como texto
 * suelto. Dentro no hay ningún botón ni enlace, así que se pueden convertir en un `<a>`
 * de verdad, que arregla cuatro cosas de una vez:
 *
 *  - el tabulador y el Intro, sin escribir un manejador de teclas;
 *  - el lector de pantalla dice «enlace» y el título del coche;
 *  - el botón derecho, el «abrir en otra pestaña» y el clic central, que en un listado
 *    de coches se usan constantemente y hoy no hacen nada;
 *  - y el listado **enlaza a las fichas**, que hoy no pasa: para un buscador, las fichas
 *    de coche no están enlazadas desde ninguna parte.
 *
 * ## Lo que no cambia
 *
 * La navegación sigue siendo la de la aplicación. El `href` está para el navegador, no
 * para sustituir al manejador.
 */

/**
 * La dirección pública de la ficha de una oferta.
 *
 * Es la misma que ya se escribe en la barra al abrir una ficha
 * —`App.js` hace `history.replaceState(..., "/marketplace-vo/<id>")`— y la misma que usa
 * `onIrAlCoche`. Aquí solo se pone donde faltaba.
 *
 * Sin `id` devuelve `undefined` y no la cadena vacía: un `<a href="">` apunta a la
 * página actual, así que un fallo de datos se convertiría en un enlace que recarga. Sin
 * `href`, el navegador no lo trata como enlace y se nota.
 */
export function laFichaDe(offer) {
  const id = offer && offer.id != null ? String(offer.id) : "";
  if (!id) return undefined;
  return `/marketplace-vo/${encodeURIComponent(id)}`;
}

/**
 * Abrir la ficha, respetando lo que pida el cliente.
 *
 * Lo normal es que la aplicación navegue sola, así que se corta el enlace y se llama al
 * manejador de siempre.
 *
 * **Salvo que haya pedido otra cosa.** Con Ctrl, Cmd, Mayúsculas, Alt o el botón central
 * no se corta nada y el navegador hace lo suyo: otra pestaña, otra ventana, una descarga.
 * Un `preventDefault` a secas se come justo eso, que es la mitad de lo que se viene a
 * ganar con el enlace.
 *
 * `button === 1` es el clic central. React lo entrega como `auxclick`/`click` según el
 * navegador, así que se mira el botón y no el tipo de evento.
 */
export function abreLaFicha(evento, offer, alAbrir) {
  if (!evento) return;

  const otraPestana =
    evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button === 1;

  if (otraPestana) return;          // que lo haga el navegador

  evento.preventDefault();
  if (typeof alAbrir === "function") alAbrir(offer);
}
