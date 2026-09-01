"use strict";

/**
 * El dinero del cliente, retenido hasta que alguien nuestro ve el coche.
 *
 * Aqui no hay fianza. La fianza era del modelo anterior, cuando PopCar compraba
 * el coche y se lo vendia: se cobraba un 30 % por adelantado para cubrir el
 * compromiso de comprarlo en Alemania. Ese modelo ya no existe.
 *
 * Ahora el coche se lo compra el cliente al concesionario aleman, y nosotros
 * damos el servicio. Asi que el cliente paga **el coche y nuestro fee a una
 * cuenta de deposito**, y ese dinero **no se mueve** hasta que nuestro receptivo
 * esta fisicamente delante del coche y confirma que es el que se anuncio.
 *
 * Esa es la promesa entera del producto: un particular que compra un coche en
 * Alemania por su cuenta transfiere miles de euros a un desconocido de otro pais
 * y espera. Aqui no. El dinero esta retenido, y lo suelta alguien que ha visto
 * el coche.
 *
 * El impuesto de matriculacion **si entra**, pero como **provision**: dinero
 * puesto a cuenta, no un precio cerrado. Su importe exacto no se sabe hasta que
 * se matricula, asi que se cobra lo estimado y **se liquida despues**: si sale
 * mas, paga la diferencia; si sale menos, se le devuelve.
 *
 * Eso es lo que protege el fee. Si el impuesto fuera un precio cerrado y el real
 * saliera por encima —pasa en los coches de mas de 160 g/km, que pagan el doble
 * del tramo que estimamos— la diferencia saldria de nuestro margen. Con una
 * provision, el impuesto lo paga siempre el cliente, que es de quien es.
 *
 * Y va dentro del deposito y no aparte porque la alternativa es peor: con el
 * coche ya pagado al aleman y de camino, pedirle mil cuatrocientos euros mas es
 * un cobro que se puede caer, y el coche esta a su nombre desde el principio.
 */

/**
 * Los estados por los que pasa el dinero. No hay mas, y no se saltan.
 *
 * - `pendiente` — se le ha dicho cuanto, no ha pagado.
 * - `retenido`  — esta en la cuenta de deposito. Nadie puede tocarlo.
 * - `liberado`  — nuestro receptivo confirmo el coche y el vendedor ha cobrado.
 * - `devuelto`  — el coche no era lo que decia, o el cliente se echo atras a
 *                 tiempo. Vuelve entero.
 */
const ESTADOS = ["pendiente", "retenido", "liberado", "devuelto"];

/** Desde cada estado, a donde se puede ir. */
const TRANSICIONES = {
  pendiente: ["retenido"],
  retenido: ["liberado", "devuelto"],
  liberado: [],
  devuelto: [],
};

/**
 * Lo que paga el cliente a la cuenta de deposito.
 *
 * Dos cosas con dos destinos distintos, y por eso van separadas y no como un
 * total: **el coche** es del vendedor aleman y **el fee** es nuestro. El dia que
 * haya que liberar, se libera lo del vendedor; lo nuestro no viaja a Alemania.
 *
 * La garantia va si la ha elegido, y es de un tercero: se le paga al proveedor
 * de la garantia, no al vendedor ni a nosotros.
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
    // A quien va cada parte, para que el ERP no tenga que adivinarlo. Y cual es
    // firme y cual es a cuenta, que es lo que decide si hay que liquidar.
    destinos: [
      { concepto: "Precio del coche", importe: coche, a: "vendedor", firme: true },
      { concepto: "Servicio PopCar", importe: nuestro, a: "popcar", firme: true },
      ...(aHacienda ? [{ concepto: "Impuesto de matriculación", importe: aHacienda, a: "hacienda", firme: false }] : []),
      ...(cobertura ? [{ concepto: "Garantía mecánica", importe: cobertura, a: "proveedor", firme: true }] : []),
    ],
  };
}

/**
 * Lo que hay que liquidar cuando se sabe el impuesto de verdad.
 *
 * Positivo: nos debe esa diferencia. Negativo: se la devolvemos. Cero: cuadraba.
 *
 * Nuestro fee no entra en esta cuenta y no puede entrar: la provision es del
 * cliente y el ajuste es suyo, en los dos sentidos.
 */
function liquidacionDelImpuesto({ provision, real }) {
  const puesto = Math.round(Number(provision) || 0);
  const cierto = Math.round(Number(real) || 0);
  const diferencia = cierto - puesto;
  return {
    provision: puesto,
    real: cierto,
    diferencia,
    quien: diferencia > 0 ? "cobrar" : diferencia < 0 ? "devolver" : "cuadra",
  };
}

/**
 * Si se puede soltar el dinero.
 *
 * Una sola condicion, y es la que sostiene el producto: **que alguien nuestro
 * haya visto el coche**. No que el vendedor diga que esta bien, no que hayan
 * pasado tres dias, no que el cliente tenga prisa.
 *
 * Se devuelve el motivo cuando no se puede, porque en el ERP hay que poder
 * decirle a quien lo intenta por que no, en vez de dejar el boton apagado.
 */
function sePuedeLiberar({ estado, verificadoEnAlemania }) {
  if (estado !== "retenido") {
    return {
      puede: false,
      motivo: estado === "liberado" ? "ya_liberado"
        : estado === "devuelto" ? "ya_devuelto"
        : "sin_pagar",
    };
  }
  if (!verificadoEnAlemania) return { puede: false, motivo: "sin_verificar" };
  return { puede: true, motivo: null };
}

/** Lo que se le dice a quien intenta liberar y no puede. */
const PORQUE_NO_SE_LIBERA = {
  sin_pagar: "El cliente todavía no ha depositado el dinero.",
  sin_verificar: "Nadie ha confirmado el coche en Alemania. El dinero no se suelta antes de eso.",
  ya_liberado: "Ya se liberó.",
  ya_devuelto: "Este depósito se devolvió.",
};

/** Si una transición de estado del depósito es de las que existen. */
function transicionValida(desde, hasta) {
  if (!ESTADOS.includes(desde) || !ESTADOS.includes(hasta)) return false;
  return (TRANSICIONES[desde] || []).includes(hasta);
}

module.exports = {
  ESTADOS,
  TRANSICIONES,
  loQuePagaAhora,
  liquidacionDelImpuesto,
  sePuedeLiberar,
  PORQUE_NO_SE_LIBERA,
  transicionValida,
};
