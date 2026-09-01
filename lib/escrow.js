"use strict";

/**
 * Lo que paga el cliente, y a donde va cada parte.
 *
 * Aqui no hay fianza. La fianza era del modelo anterior, cuando PopCar compraba
 * el coche y se lo vendia: se cobraba un 30 % por adelantado para cubrir el
 * compromiso de comprarlo en Alemania. Ese modelo ya no existe.
 *
 * Ahora el coche se lo compra el cliente al concesionario aleman, y nosotros
 * damos el servicio. Asi que paga **el coche, nuestro fee y el impuesto**, y ese
 * dinero **no se le paga al vendedor** hasta que nuestro receptivo esta
 * fisicamente delante del coche y confirma que es el que se anuncio.
 *
 * Esa es la promesa entera del producto: un particular que compra un coche en
 * Alemania por su cuenta transfiere veinte mil euros a un desconocido de otro
 * pais y espera. Aqui no.
 *
 * **Lo que puede pasar con ese dinero vive en el ERP**, no aqui: soltarlo,
 * devolverlo y liquidar el impuesto son acciones suyas. PopCar enseña cuanto es
 * y a donde va, pero nunca mueve dinero. Tenerlo en los dos sitios seria tener
 * dos verdades, y esta semana ya nos ha pasado dos veces que la que mandaba era
 * la que nadie miraba.
 */

/**
 * Lo que paga el cliente, partido por destino.
 *
 * Cuatro cosas con cuatro dueños distintos, y por eso van separadas y no como un
 * total: **el coche** es del vendedor aleman, **el fee** es nuestro, **el
 * impuesto** es de Hacienda y **la garantia** de su proveedor. El dia que haya
 * que liberar, se libera lo del vendedor y no lo demas.
 *
 * El impuesto va **a cuenta**, no como precio cerrado: es una estimacion
 * mientras no tengamos el CO2 de cada coche, y se liquida al matricular. Si
 * fuera cerrado y el real saliera por encima —pasa en los coches de mas de
 * 160 g/km, que pagan el doble del tramo que estimamos— esa diferencia saldria
 * de nuestro margen. Asi la paga siempre el cliente, que es de quien es.
 *
 * Y va dentro y no aparte porque la alternativa es peor: con el coche ya pagado
 * al aleman y de camino, pedirle mil cuatrocientos euros mas es un cobro que se
 * puede caer, y el coche esta a su nombre desde el principio.
 */
function loQuePagaAhora({ precioCoche, fee, impuesto = 0, garantia = 0 }) {
  const coche = Math.round(Number(precioCoche) || 0);
  const nuestro = Math.round(Number(fee) || 0);
  const aHacienda = Math.round(Number(impuesto) || 0);
  const cobertura = Math.round(Number(garantia) || 0);
  return {
    coche,
    fee: nuestro,
    impuesto: aHacienda,
    garantia: cobertura,
    total: coche + nuestro + aHacienda + cobertura,
    // A quien va cada parte, y cual es firme y cual es a cuenta: eso es lo que
    // decide si hay que liquidar algo despues.
    destinos: [
      { concepto: "Precio del coche", importe: coche, a: "vendedor", firme: true },
      { concepto: "Servicio PopCar", importe: nuestro, a: "popcar", firme: true },
      ...(aHacienda ? [{ concepto: "Impuesto de matriculación", importe: aHacienda, a: "hacienda", firme: false }] : []),
      ...(cobertura ? [{ concepto: "Garantía mecánica", importe: cobertura, a: "proveedor", firme: true }] : []),
    ],
  };
}

module.exports = { loQuePagaAhora };
