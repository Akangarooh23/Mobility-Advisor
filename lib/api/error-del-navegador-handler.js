"use strict";

const { elPool } = require("../postgres");
const { guarda } = require("../errores-guardados");
const { tapaElCorreo } = require("../registra");
const { aplicaCors } = require("../cors");
const FRENO = require("../freno");

/**
 * Los fallos del navegador, que era el agujero grande.
 *
 * ## Qué no se veía
 *
 * Todo lo que hay del lado del servidor. Si a alguien se le queda la web **en
 * blanco** en su móvil —un error de JavaScript en una pantalla concreta, con un
 * coche concreto— no se enteraba nadie. Esa persona se va y no escribe.
 *
 * Esto lo recoge: la pantalla, la dirección, el navegador, quién era si había
 * sesión, y qué estaba haciendo.
 *
 * ## Lo que se pierde, y se compensa
 *
 * La pila vendrá **ilegible**: el JavaScript de producción está minificado, así
 * que en vez de `abreLaFichaDelCoche` se verá `a.b is not a function en
 * chunk.js:1:48219`. Eso lo arreglan los *source maps*, que es lo que vende
 * Sentry.
 *
 * Se compensa mandando contexto en vez de pila: qué pantalla, qué acción, qué
 * coche. En la práctica eso dice más que la pila, porque el fallo casi nunca está
 * donde salta.
 *
 * ## El freno, que aquí no es opcional
 *
 * Un endpoint público que escribe en la base es un sitio por donde llenarla. Y no
 * hace falta mala intención: un error dentro de un `useEffect` que se repite en
 * cada renderizado manda miles de peticiones desde un solo móvil, y sin freno
 * escribe miles de filas de lo mismo.
 *
 * Veinte por IP cada cinco minutos. Quien pase de ahí recibe un 204 igual —no
 * tiene sentido decirle a una web rota que además su queja no se ha registrado—
 * pero no se escribe nada.
 */

/** Lo que se acepta de un solo navegador. */
const LIMITE = { veces: 20, segundos: 5 * 60 };

function deQuienViene(req) {
  const cabecera = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return cabecera || String(req.socket?.remoteAddress || "desconocida");
}

/** El cuerpo, que puede llegar como objeto o como cadena. */
function elCuerpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body || "{}"));
  } catch {
    return {};
  }
}

function texto(valor, tope) {
  return String(valor == null ? "" : valor).slice(0, tope);
}

module.exports = async function errorDelNavegadorHandler(req, res) {
  if (aplicaCors(req, res)) return undefined;

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const cuerpo = elCuerpo(req);
  const donde = texto(cuerpo.donde, 200).trim();
  const mensaje = texto(cuerpo.mensaje, 2000).trim();

  // Sin sitio ni mensaje no hay nada que guardar, y tampoco es un error suyo.
  if (!donde && !mensaje) return res.status(204).end();

  const pool = elPool();
  if (!pool) return res.status(204).end();

  /*
   * El freno antes de escribir. Si falla el propio freno se sigue: perder un
   * fallo por eso sería cambiar un problema por otro.
   */
  try {
    const { paso } = await FRENO.pide(pool, "error-navegador", deQuienViene(req), LIMITE);
    if (!paso) return res.status(204).end();
  } catch {}

  await guarda(
    {
      donde: donde || "navegador: sin sitio",
      // Los correos se tapan también aquí: el mensaje lo manda el navegador y
      // puede traer una dirección dentro.
      mensaje: tapaElCorreo(mensaje),
      pila: cuerpo.pila ? tapaElCorreo(texto(cuerpo.pila, 4000)) : null,
      contexto: cuerpo.contexto && typeof cuerpo.contexto === "object" ? cuerpo.contexto : {},
    },
    {
      lado: "navegador",
      pantalla: texto(cuerpo.pantalla, 120),
      direccion: texto(cuerpo.direccion, 500),
      navegador: texto(req.headers?.["user-agent"], 300),
      quien: cuerpo.quien ? tapaElCorreo(texto(cuerpo.quien, 200)) : null,
      version: texto(cuerpo.version, 80),
    }
  );

  /*
   * Siempre 204, pase lo que pase. La web que manda esto ya está teniendo un
   * problema: lo último que necesita es otro error al intentar contarlo.
   */
  return res.status(204).end();
};

module.exports.LIMITE = LIMITE;
