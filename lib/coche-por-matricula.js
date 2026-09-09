"use strict";

/**
 * La dirección corta que va en los anuncios de los portales: `/v/8888LXR`.
 *
 * En coches.net o en Milanuncios no hay forma de enlazar a nuestra ficha: lo
 * único que se puede meter es una línea de texto que alguien teclea o copia. Y
 * `popcar.es/marketplace-vo/idcar-veh-1778144236925` no lo teclea nadie.
 *
 * La matrícula sirve porque el comprador la tiene delante —está en el anuncio y
 * en el coche— y porque no hay que inventar ningún código nuevo que luego haya
 * que guardar en algún sitio.
 *
 * ## Lo que hay que resolver bien
 *
 * **Cómo la escribe la gente.** «8888LXR», «8888 LXR», «8888-lxr» y «8888 lxr »
 * son el mismo coche. Quien copia de un anuncio se trae los espacios.
 *
 * **Que ya no esté a la venta.** Los anuncios viven en los portales después de
 * que el coche se venda: alguien va a pulsar ese enlace la semana que viene. Eso
 * no es un 404, es una respuesta —«ya se ha vendido»— y una oportunidad de
 * enseñarle otros.
 *
 * **Que haya dos.** Hoy no hay ninguna repetida entre las 3.465 ofertas activas,
 * pero eso es hoy: basta con que un concesionario reponga un anuncio o alguien
 * teclee mal una matrícula. Que no pase nunca no es lo mismo que no poder pasar.
 */

/**
 * La matrícula, como se compara.
 *
 * Fuera todo lo que no sea letra o número, y a mayúsculas. Así se compara igual
 * lo que hay guardado que lo que llega por la dirección.
 */
function comoSeCompara(matricula) {
  return String(matricula ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Si eso puede ser una matrícula española.
 *
 * No se valida el formato exacto —hay matrículas viejas, de ciclomotor y
 * extranjeras— sino que tenga la pinta: entre 6 y 10 caracteres de letras y
 * números. Vale para no ir a la base a buscar «favicon.ico».
 */
function pareceUnaMatricula(matricula) {
  const m = comoSeCompara(matricula);
  return m.length >= 6 && m.length <= 10 && /[0-9]/.test(m) && /[A-Z]/.test(m);
}

/**
 * De todas las ofertas activas con esa matrícula, cuál es la del anuncio.
 *
 * El enlace lo hemos puesto **nosotros** en un anuncio de un coche que
 * gestionamos, así que si hay varias gana la nuestra: la de un IDCar. Si no hay
 * ninguna nuestra, la más recién tocada, que es la que sigue viva.
 *
 * Elegir por orden de llegada mandaría al comprador a la ficha de un
 * concesionario que tiene otro coche con la misma matrícula mal tecleada.
 */
function laDelAnuncio(ofertas) {
  const vivas = (ofertas || []).filter((o) => o && o.id);
  if (vivas.length <= 1) return vivas[0] || null;

  const nuestra = vivas.find((o) => String(o.id).startsWith("idcar-"));
  if (nuestra) return nuestra;

  return vivas
    .slice()
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0];
}

/**
 * La matrícula que viene en la dirección.
 *
 * Se acepta con o sin barra al final y con lo que sea que haya escrito. Devuelve
 * cadena vacía si el camino no es uno de estos.
 */
function laMatriculaDeLaRuta(camino) {
  const limpio = String(camino ?? "").split("?")[0].split("#")[0].replace(/\/+$/, "");
  const trozos = limpio.split("/").filter(Boolean);
  if (trozos.length !== 2 || trozos[0].toLowerCase() !== "v") return "";
  try {
    return decodeURIComponent(trozos[1]);
  } catch {
    return trozos[1];
  }
}

/**
 * La consulta.
 *
 * Solo activas: un anuncio apagado es un coche que ya no está a la venta, y
 * llevar a su ficha sería enseñar un precio que ya no vale.
 */
const SQL_POR_MATRICULA = `
  SELECT id, title, matricula, is_active, updated_at
    FROM moveadvisor_marketplace_vo_offers
   WHERE upper(regexp_replace(COALESCE(matricula, ''), '[^A-Za-z0-9]', '', 'g')) = $1
     AND COALESCE(is_active, FALSE) = TRUE
   ORDER BY updated_at DESC NULLS LAST`;

module.exports = {
  comoSeCompara,
  pareceUnaMatricula,
  laDelAnuncio,
  laMatriculaDeLaRuta,
  SQL_POR_MATRICULA,
};
