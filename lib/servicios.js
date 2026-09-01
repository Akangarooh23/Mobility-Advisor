"use strict";

/**
 * Lo que se puede contratar aparte del coche.
 *
 * El precio de una importacion cubre el coche, **el viaje entero hasta su
 * casa**, matricularlo y su garantia. Lo que queda fuera es lo que no todo el
 * mundo quiere: asegurarlo y dejarlo a punto.
 *
 * Se separan del coche por una razon que no es de precio: **no entran en la
 * fianza**. La fianza es el 30 % del coche, que es lo que nos comprometemos a
 * pagar en Alemania. Meter dentro un seguro seria cobrarle por adelantado algo
 * que todavia no se le ha hecho.
 *
 * Hoy ninguno tiene importe cerrado. Salen igual, como peticion: el cliente
 * marca lo que quiere y se le confirma al llamarle. Poner un numero inventado
 * en un precio publico es peor que decir que se confirma.
 */

/**
 * Los dos, en el orden en que se le ofrecen.
 *
 * La entrega en su casa **no esta aqui**: va dentro del precio. El transporte
 * que se le cobra cubre el viaje entero, de la ciudad alemana a Zaragoza y de
 * Zaragoza a su puerta. Que por dentro sean dos camiones es cosa nuestra.
 */
const SERVICIOS = [
  {
    id: "seguro",
    nombre: "Seguro",
    resumen: "Te buscamos poliza para que puedas circular el mismo dia que lo recibas.",
  },
  {
    id: "reacondicionado",
    nombre: "Reacondicionamiento",
    resumen: "Lo que necesite al llegar: neumaticos, frenos, chapa. Se presupuesta antes de tocarlo.",
    // No puede llevar precio y no es una carencia: hasta que el coche no llega a
    // la campa y se mira, nadie sabe lo que necesita.
    siempreAConsultar: true,
  },
];

/**
 * Los servicios tal y como se le ensenan, con precio donde lo haya.
 *
 * `precio: null` quiere decir «a consultar», y la pantalla lo dice con esas
 * palabras. Un servicio a consultar **no suma** al total: no se puede sumar lo
 * que no se sabe.
 */
function serviciosParaElCliente() {
  return SERVICIOS.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    resumen: s.resumen,
    precio: null,
  }));
}

/** Lo que suman los que ha elegido. Los que van a consultar suman cero. */
function precioDeLosElegidos(servicios, elegidos) {
  if (!Array.isArray(servicios) || !Array.isArray(elegidos)) return 0;
  return servicios
    .filter((s) => elegidos.includes(s.id) && s.precio != null)
    .reduce((t, s) => t + Number(s.precio || 0), 0);
}

/** Solo los identificadores que existen. Lo que llegue de fuera y no sea uno, fuera. */
function soloLosQueExisten(elegidos) {
  if (!Array.isArray(elegidos)) return [];
  const validos = SERVICIOS.map((s) => s.id);
  return elegidos.map((x) => String(x || "")).filter((x) => validos.includes(x));
}

module.exports = {
  SERVICIOS,
  serviciosParaElCliente,
  precioDeLosElegidos,
  soloLosQueExisten,
};
