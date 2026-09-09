/**
 * El formulario de «Nosotros lo vendemos por ti».
 *
 * Hasta ahora ese botón llevaba al formulario de contacto general: nombre,
 * apellido, correo, teléfono y un mensaje libre. Dos problemas.
 *
 * El primero es que **prometía otra cosa**. El botón dice «cuéntanos qué coche
 * tienes y en cuánto tiempo quieres venderlo», y luego no preguntaba ninguna de
 * las dos. Quien cogía el teléfono empezaba de cero sobre algo que el cliente ya
 * había accedido a contar.
 *
 * El segundo es que **no creaba nada**: mandaba un correo a una bandeja. Un
 * cliente que pide que le vendamos el coche no aparecía en ninguna pantalla.
 *
 * Aquí están las dos preguntas que sí hay que hacer y cómo viajan al ERP.
 */

/**
 * En cuánto tiempo quiere venderlo.
 *
 * Es la pregunta que decide la conversación: al que tiene prisa se le habla de
 * precio de salida y al que no, de precio máximo. Y es la que separa a quien va
 * a aceptar nuestro precio de quien no — que es justo lo que parte en dos la
 * penalización por cancelar.
 *
 * Cerrada y corta a propósito. Un campo libre da «lo antes posible», «depende» y
 * «cuando salga», que no se pueden ordenar ni contar.
 */
export const PLAZOS = [
  { clave: "ya", etiqueta: "Cuanto antes" },
  { clave: "1mes", etiqueta: "En un mes" },
  { clave: "3meses", etiqueta: "En dos o tres meses" },
  { clave: "sinprisa", etiqueta: "Sin prisa, busco el mejor precio" },
];

/** El tipo con el que entra en el ERP. */
export const TIPO = "venta_gestionada";

/** De dónde vino, para poder contar qué convierte. */
export const ORIGEN = "web-vender";

function nt(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function pareceUnCorreo(v) {
  const s = nt(v);
  return s.length > 4 && s.length < 255 && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(s);
}

export function elPlazo(clave) {
  return PLAZOS.find((p) => p.clave === nt(clave)) || null;
}

/**
 * Qué falta para poder mandarlo, en la frase que se le enseña.
 *
 * El coche se pide como texto libre —«Seat Ibiza 2019», o la matrícula, o «un
 * Golf del 15»— y no en tres desplegables de marca, modelo y año. Quien está
 * decidiendo si nos deja su coche no va a rellenar tres desplegables; ya se lo
 * preguntaremos por teléfono, que es lo que va a pasar de todas formas.
 */
export function faltaParaMandarlo({ coche, plazo, nombre, telefono, email } = {}) {
  if (!nt(coche)) return "Dinos qué coche quieres vender.";
  if (!elPlazo(plazo)) return "Dinos en cuánto tiempo quieres venderlo.";
  if (!nt(nombre)) return "Escribe tu nombre.";
  if (nt(telefono).replace(/\D/g, "").length < 9) return "Escribe un teléfono: te llamamos nosotros.";
  if (!pareceUnCorreo(email)) return "Escribe un correo válido.";
  return "";
}

/**
 * Lo que se manda al ERP.
 *
 * El plazo viaja en `contact_when`, que ya es el campo de detalles libres —en
 * renting lleva «Plazo: 36m · 15.000 km/año»—, con la misma forma de
 * «Etiqueta: valor» para que se lea igual en la ficha del lead.
 */
export function loQueSeManda({ coche, plazo, nombre, telefono, email }) {
  const p = elPlazo(plazo);
  return {
    type: TIPO,
    portal: ORIGEN,
    email: nt(email).toLowerCase(),
    name: nt(nombre),
    phone: nt(telefono),
    vehicle_title: nt(coche),
    when: `Quiere vender: ${p ? p.etiqueta.toLowerCase() : "sin decir"}`,
  };
}

