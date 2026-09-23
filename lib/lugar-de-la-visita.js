"use strict";

/**
 * Dónde enseña el vendedor su coche.
 *
 * Hasta ahora esto no se guardaba en ningún sitio: el vendedor lo escribía
 * **cada vez** que confirmaba una visita, en la casilla «dónde» de su enlace.
 * Con tres compradores lo escribía tres veces, y si un día lo escribía distinto
 * —«en casa», «Alcalá 120», «el parking de siempre»— cada comprador recibía una
 * dirección diferente del mismo coche.
 *
 * Se pone una vez, junto a las franjas, y desde ahí sale sola en cada
 * confirmación. Es el mismo sitio y el mismo momento: decidir cuándo puedes
 * enseñarlo y decir dónde es la misma decisión.
 *
 * ## Por qué la dirección entera y no la ciudad
 *
 * El anuncio dice la ciudad, que es lo que un comprador necesita para saber si
 * le pilla lejos. Pero quien ya tiene hora necesita el portal: el número, el
 * piso si hace falta y por quién preguntar. «Madrid» a las diez de la mañana
 * con el coche esperando no sirve de nada.
 *
 * ## Y por qué no se publica
 *
 * Esta dirección **no sale nunca en el anuncio ni en ningún sitio público**. La
 * ciudad la ve cualquiera; el portal de su casa solo quien tiene una visita
 * confirmada. Publicar dónde duerme un coche que está en venta, con las horas a
 * las que su dueño no está, es exactamente el anuncio que no hay que poner. Por
 * eso vive en su propia tabla y sale por rutas que piden sesión y comprueban
 * que el coche es suyo, nunca por la ficha pública.
 */

/** Su propia tabla: ni la ficha pública ni el anuncio la miran. */
const SQL_ASEGURA_TABLA = `
  CREATE TABLE IF NOT EXISTS vehicle_visit_places (
    offer_id    TEXT PRIMARY KEY,
    direccion   TEXT NOT NULL DEFAULT '',
    codigo_postal TEXT NOT NULL DEFAULT '',
    ciudad      TEXT NOT NULL DEFAULT '',
    contacto    TEXT NOT NULL DEFAULT '',
    notas       TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

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
  SQL_ASEGURA_TABLA,
  SQL_LEE,
  SQL_GUARDA,
  esUnCodigoPostal,
  queLeFaltaAlLugar,
  comoSeLee,
  elSitioDeLaCita,
  losDatosDeGuardar,
  comoLoVeSuDuenno,
};
