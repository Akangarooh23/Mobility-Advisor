"use strict";

/**
 * El cliente se baja el informe de su tasación desde el panel.
 *
 * Hasta ahora el PDF solo existía en el correo que le mandamos: se generaba, se
 * adjuntaba y se tiraba. Quien perdía ese correo se quedaba sin informe, con el
 * precio guardado en su ficha y el documento en ninguna parte.
 *
 * ## Por qué no se sirve una URL pública
 *
 * El informe lleva la matrícula y los datos de su coche, y vive en el cajón
 * privado. Aquí se comprueba **primero** que la tasación es suya y solo después
 * se firma una dirección que caduca en unos minutos. Una URL pública sería
 * alcanzable por quien tuviera el enlace, sin sesión y para siempre.
 *
 * ## Por qué la comprobación va contra la base y no contra el camino
 *
 * El camino del fichero lleva el correo dentro, así que sería tentador mirar si
 * empieza por el suyo. Eso es comparar una cadena que viaja por la red: se
 * comprueba en la fila, que es donde consta de quién es.
 */
const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../postgres-ssl");
const { urlFirmada } = require("../supabaseStorage");
const { identidadDeLaPeticion } = require("./identidad");

/** Cuánto vale la dirección firmada. Lo justo para que el navegador la siga. */
const SEGUNDOS = 300;

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 5, ssl: SSL_POSTGRES });
  }
  return _pool;
}

module.exports = async function tasacionPdfHandler(req, res) {
  const { email } = await identidadDeLaPeticion(req);
  if (!email) {
    return res.status(401).json({ ok: false, error: "Inicia sesión para descargar tu informe." });
  }

  const id = String((req.query && req.query.id) || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "Falta de qué tasación es." });
  }

  try {
    const { rows } = await getPool().query(
      `SELECT pdf_path, title FROM moveadvisor_user_valuations
        WHERE id = $1 AND lower(user_email) = lower($2)`,
      [id, email]
    );
    const suya = rows[0];
    if (!suya) {
      // Ni suya ni existe: se contesta igual en los dos casos, que si no esto
      // dice cuáles existen.
      return res.status(404).json({ ok: false, error: "No encontramos ese informe." });
    }
    if (!suya.pdf_path) {
      /*
       * Las de antes de guardarlos no tienen fichero. Se dice lo que pasa y qué
       * hacer, en vez de un 404 que parece un fallo nuestro: el informe está en
       * su correo, y repetir la tasación deja uno nuevo guardado.
       */
      return res.status(404).json({
        ok: false, error: "sin_archivar",
        detail: "De esta tasación no guardamos el PDF: lo tienes en el correo que te enviamos. Si repites la valoración, el informe nuevo queda aquí para descargarlo.",
      });
    }

    const url = await urlFirmada(suya.pdf_path, SEGUNDOS);
    if (!url) {
      return res.status(502).json({ ok: false, error: "No hemos podido preparar la descarga. Prueba otra vez." });
    }
    // Se redirige en vez de hacer de intermediarios con el fichero: una función
    // sin estado no tiene por qué cargarse un PDF entero en memoria.
    res.writeHead(302, { Location: url });
    return res.end();
  } catch (err) {
    console.error("[tasacion-pdf]", err && err.message);
    return res.status(500).json({ ok: false, error: "No se ha podido descargar. Prueba otra vez." });
  }
};
