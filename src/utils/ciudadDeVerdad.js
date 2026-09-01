/**
 * Una ciudad que en realidad es la dirección entera.
 *
 * La ficha rellenaba el campo de ciudad con `billingAddress`, que no es la
 * ciudad sino la dirección en una línea —calle, código postal y provincia— que
 * monta el propio backend. La dirección salía escrita dos veces: «Calle Mauricio
 * Legendre 45 G2B, 28046 **Calle Mauricio Legendre 45 G2B, 28046, MADRID**,
 * (MADRID)», y así viajaba a la solicitud y al documento de entrega.
 *
 * Eso ya no pasa, pero **lo que se guardó sigue guardado**: la dirección de
 * entrega vive en el navegador de cada uno para no volver a preguntarla en cada
 * coche que mire. Arreglar el código no limpia lo que ya está escrito ahí, así
 * que hay que reconocerlo al leerlo.
 *
 * Se reconoce porque una ciudad no lleva dentro ni la calle ni el código postal.
 * Cuando los lleva, se tira: mejor un campo en blanco, que se rellena solo con
 * mirarlo, que uno mal relleno, del que hay que darse cuenta.
 */
function ciudadDeVerdad(ciudad, calle, cp) {
  const c = String(ciudad || "").trim();
  if (!c) return "";
  const dentro = (trozo) => {
    const t = String(trozo || "").trim();
    return t.length > 0 && c.toLowerCase().includes(t.toLowerCase());
  };
  return dentro(calle) || dentro(cp) ? "" : c;
}

export { ciudadDeVerdad };
