"use strict";

/**
 * Refresca los desplegables del buscador de coches.
 *
 * Las listas de marcas, modelos, combustibles, cambios, carrocerías y
 * provincias salen de dos vistas materializadas —`lib/facetas-del-buscador.js`
 * explica por qué— y hay que rehacerlas cada cierto tiempo para que un coche
 * nuevo de una marca que no teníamos aparezca en la lista.
 *
 * ## Cada hora, y una vista por vez
 *
 * Rehacer las dos cuesta unos tres minutos contra los 4,3 GB del pool, y una
 * función de Vercel no dura eso. Por eso la tarea admite `?vista=` y hay dos
 * entradas en `vercel.json`, a horas distintas: cada una rehace la suya.
 *
 * ## Si no se refresca, no se rompe nada
 *
 * Los desplegables siguen enseñando lo de la última vez. Una marca nueva tarda
 * en aparecer, que es mucho mejor que lo que había antes: la lista tardaba
 * cuarenta segundos en salir y la pantalla no se podía usar mientras tanto.
 */

const { elPoolObligatorio } = require("../postgres");
const { cronAutorizado } = require("../cron-autorizado");
const { prepara, refresca } = require("../facetas-del-buscador");

let _pool = null;
function getPool() {
  return elPoolObligatorio();
}

module.exports = async function cronFacetasBuscador(req, res) {
  if (!cronAutorizado(req)) return res.status(401).json({ ok: false, error: "no autorizado" });

  const url = new URL(req.url || "/", "http://local");
  const cual = String(url.searchParams.get("vista") || "").trim();

  try {
    const pool = getPool();
    await prepara(pool);
    const hechas = await refresca(pool, cual);
    return res.status(200).json({ ok: true, hechas });
  } catch (err) {
    console.error("[facetas-buscador] no se han podido refrescar:", err && err.message);
    return res.status(500).json({ ok: false, error: "no se han podido refrescar" });
  }
};
