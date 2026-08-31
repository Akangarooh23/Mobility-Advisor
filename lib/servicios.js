"use strict";

/**
 * Lo que se puede contratar aparte del coche.
 *
 * El precio de una importacion cubre traer el coche **hasta nuestras
 * instalaciones de Madrid**, matricularlo y su garantia. Ahi se acaba lo
 * incluido. Llevarselo a su casa, asegurarlo o dejarlo a punto son servicios, y
 * se contratan uno a uno.
 *
 * Se separan del coche por una razon que no es de precio: **no entran en la
 * fianza**. La fianza es el 30 % del coche, que es lo que nos comprometemos a
 * pagar en Alemania. Meter dentro un seguro o una entrega seria cobrarle por
 * adelantado algo que todavia no se le ha hecho.
 *
 * Hoy ninguno tiene importe cerrado. Salen igual, como peticion: el cliente
 * marca lo que quiere y se le confirma al llamarle. Poner un numero inventado
 * en un precio publico es peor que decir que se confirma.
 */

/**
 * Los tres, en el orden en que se le ofrecen.
 *
 * Van aqui y no en la base porque son una decision de producto, no un dato que
 * cambie: lo que cambia es su precio, y eso si vive en una tabla.
 */
const SERVICIOS = [
  {
    id: "entrega",
    nombre: "Entrega en tu domicilio",
    resumen: "Te lo llevamos desde Madrid hasta tu puerta, ya matriculado y listo para usar.",
    // Sin esto no se sabe a donde: es el unico que necesita su direccion.
    pideDireccion: true,
    siNo: "Si no, lo recoges tu en nuestras instalaciones de Madrid.",
  },
  {
    id: "seguro",
    nombre: "Seguro",
    resumen: "Te buscamos poliza para que puedas circular el mismo dia que lo recojas.",
    siNo: "",
  },
  {
    id: "reacondicionado",
    nombre: "Reacondicionamiento",
    resumen: "Lo que necesite al llegar: neumaticos, frenos, chapa. Se presupuesta antes de tocarlo.",
    // No puede llevar precio aqui y no es una carencia: hasta que el coche no
    // llega y se mira, nadie sabe lo que necesita.
    siempreAConsultar: true,
    siNo: "",
  },
];

/** Sin acentos, sin mayusculas y sin lo que sobra. Para comparar provincias. */
function normaliza(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Lo que cuesta llevarselo a su provincia.
 *
 * Sale de una tabla por zonas, no de un precio unico: llevar un coche de Madrid
 * a Toledo y de Madrid a Pontevedra no cuesta lo mismo, y un precio unico se
 * come el margen en los viajes largos o infla los cortos.
 *
 * Devuelve `null` cuando no hay tarifa para esa provincia, o cuando todavia no
 * ha dicho donde vive. `null` no es cero: es «se le confirma».
 */
function precioDeEntrega(tarifas, provincia) {
  if (!Array.isArray(tarifas) || !tarifas.length) return null;
  const busca = normaliza(provincia);
  if (!busca) return null;
  const fila = tarifas.find((t) => normaliza(t.provincia) === busca);
  if (!fila || fila.activo === false || fila.precio == null) return null;
  const precio = Number(fila.precio);
  return Number.isFinite(precio) ? precio : null;
}

/**
 * Los servicios tal y como se le ensenan, con precio donde lo haya.
 *
 * `precio: null` quiere decir «a consultar», y la pantalla lo dice con esas
 * palabras. Un servicio a consultar **no suma** al total: no se puede sumar lo
 * que no se sabe.
 */
function serviciosParaElCliente(tarifas, provincia) {
  return SERVICIOS.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    resumen: s.resumen,
    pideDireccion: Boolean(s.pideDireccion),
    siNo: s.siNo || "",
    precio: s.id === "entrega" && !s.siempreAConsultar ? precioDeEntrega(tarifas, provincia) : null,
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

/**
 * Las tarifas de entrega que haya cargadas.
 *
 * Si la tabla no existe o esta vacia, no hay tarifas y la entrega sale a
 * consultar. Es el estado de hoy y no rompe nada.
 */
async function tarifasDeEntrega(pool) {
  if (!pool) return [];
  try {
    const r = await pool.query(
      `SELECT provincia, zona, precio::numeric AS precio, activo
         FROM market_entrega_tarifas WHERE activo`,
      []
    );
    return r.rows;
  } catch {
    return [];
  }
}

module.exports = {
  SERVICIOS,
  precioDeEntrega,
  serviciosParaElCliente,
  precioDeLosElegidos,
  soloLosQueExisten,
  tarifasDeEntrega,
};
