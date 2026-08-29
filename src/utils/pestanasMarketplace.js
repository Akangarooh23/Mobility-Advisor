/**
 * Qué coches entran en cada pestaña del marketplace VO.
 *
 * Las cuatro pestañas de compra —Concesionarios, Ex-Renting, Particulares e
 * Importación— dicen de dónde viene el coche, y esa promesa hay que cumplirla:
 * quien entra en Ex-Renting está mirando flota devuelta de renting, no lo que
 * quede.
 *
 * La regla vive aquí y no dentro de la pantalla porque es una regla, no una
 * forma de pintar: se puede leer sin abrir la página y se puede probar.
 */

/** El tipo de vendedor de una oferta, en minúsculas y sin sorpresas. */
export function tipoDeVendedor(oferta) {
  return String(oferta?.sellerType || "").trim().toLowerCase();
}

/**
 * Las ofertas de una pestaña.
 *
 * Cada pestaña se define por lo que **sí** es, no por lo que no es. Ex-Renting
 * estaba escrita al revés —«todo lo que no sea de particular»— y por ahí se
 * colaban coches de concesionario y de importación: basta con que uno se haya
 * cargado en la lista al abrir su enlace directo para que aparezca en una
 * sección que no es la suya.
 *
 * `concesionarios` no está aquí: esa pestaña trae su propia lista del servidor,
 * porque son miles y no caben en la que se descarga para las demás.
 */
export function ofertasDeLaPestana(pestana, ofertas = []) {
  const lista = Array.isArray(ofertas) ? ofertas : [];
  if (pestana === "particulares") return lista.filter((o) => tipoDeVendedor(o) === "particular");
  // Astara, Leasys y quien venga: flota de empresa que se vende de segunda mano.
  if (pestana === "renting_empresa") return lista.filter((o) => tipoDeVendedor(o) === "professional");
  if (pestana === "importacion") return lista.filter((o) => tipoDeVendedor(o) === "importador" || Boolean(o?.isImport));
  return lista;
}
