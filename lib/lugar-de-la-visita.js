"use strict";


const SQL_LEE = `
  SELECT offer_id, direccion, codigo_postal, ciudad, contacto, notas, updated_at
    FROM vehicle_visit_places
   WHERE offer_id = $1`;

const SQL_GUARDA = `
  INSERT INTO vehicle_visit_places (offer_id, direccion, codigo_postal, ciudad, contacto, notas, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
  ON CONFLICT (offer_id) DO UPDATE
          SET direccion = EXCLUDED.direccion,
              codigo_postal = EXCLUDED.codigo_postal,
              ciudad = EXCLUDED.ciudad,
              contacto = EXCLUDED.contacto,
              notas = EXCLUDED.notas,
              updated_at = NOW()
    RETURNING offer_id, direccion, codigo_postal, ciudad, contacto, notas, updated_at`;

function nt(v) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

/** Un código postal español: cinco cifras, y las dos primeras una provincia. */
function esUnCodigoPostal(cp) {
  const s = nt(cp);
  if (!/^\d{5}$/.test(s)) return false;
  const provincia = Number(s.slice(0, 2));
  return provincia >= 1 && provincia <= 52;
}

/**
 * Qué le falta para que eso sea una dirección a la que se pueda ir.
 *
 * Devuelve la frase que se le enseña, o cadena vacía si está completa. Se
 * comprueba aquí y no solo en la pantalla porque esta dirección acaba en el
 * correo de un comprador que va a coger el coche para presentarse: una que no
 * lleva a ningún sitio se descubre con él parado en una calle.
 */
function queLeFaltaAlLugar({ direccion, codigoPostal, ciudad } = {}) {
  const calle = nt(direccion);
  if (!calle) return "Falta la calle y el número.";
  // Sin número no es una dirección, es una calle.
  if (!/\d/.test(calle)) return "Falta el número de la calle.";
  if (calle.length < 6) return "La dirección se queda corta: hace falta calle y número.";
  if (!esUnCodigoPostal(codigoPostal)) return "El código postal tiene que ser de cinco cifras.";
  if (nt(ciudad).length < 2) return "Falta la ciudad.";
  return "";
}

/**
 * La dirección en una línea, como se le manda al comprador.
 *
 * Mismo formato que el del comprador en «quiero comprarlo», para que las dos
 * direcciones del expediente se lean igual.
 */
function comoSeLee({ direccion, codigoPostal, ciudad } = {}) {
  const partes = [nt(direccion), [nt(codigoPostal), nt(ciudad)].filter(Boolean).join(" ")];
  return partes.filter(Boolean).join(", ");
}

/**
 * Lo que se le enseña al comprador cuando su visita se confirma.
 *
 * Lleva por quién preguntar si lo puso, porque llegar a un portal y no saber a
 * quién llamar es la mitad del problema resuelto.
 */
function elSitioDeLaCita(lugar) {
  if (!lugar) return "";
  const linea = comoSeLee(lugar);
  if (!linea) return "";
  const quien = nt(lugar.contacto);
  const notas = nt(lugar.notas);
  return [linea, quien ? `Pregunta por ${quien}` : "", notas].filter(Boolean).join(" · ");
}

/** Los parámetros de la escritura, en su orden. */
function losDatosDeGuardar(offerId, lugar = {}) {
  return [
    String(offerId || ""),
    nt(lugar.direccion),
    nt(lugar.codigoPostal),
    nt(lugar.ciudad),
    nt(lugar.contacto).slice(0, 120),
    nt(lugar.notas).slice(0, 240),
  ];
}

/** Lo que sale hacia el navegador, con los nombres que usa la pantalla. */
function comoLoVeSuDuenno(fila) {
  if (!fila) return null;
  return {
    direccion: fila.direccion || "",
    codigoPostal: fila.codigo_postal || "",
    ciudad: fila.ciudad || "",
    contacto: fila.contacto || "",
    notas: fila.notas || "",
    completo: !queLeFaltaAlLugar({
      direccion: fila.direccion,
      codigoPostal: fila.codigo_postal,
      ciudad: fila.ciudad,
    }),
    enUnaLinea: comoSeLee({
      direccion: fila.direccion,
      codigoPostal: fila.codigo_postal,
      ciudad: fila.ciudad,
    }),
  };
}

module.exports = {
  SQL_LEE,
  SQL_GUARDA,
  esUnCodigoPostal,
  queLeFaltaAlLugar,
  comoSeLee,
  elSitioDeLaCita,
  losDatosDeGuardar,
  comoLoVeSuDuenno,
};
