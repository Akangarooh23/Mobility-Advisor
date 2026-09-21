/**
 * Las ejecuciones que se quedan «running» o «queued» para siempre.
 *
 *   npm run limpia-fantasmas              → en seco, no escribe nada
 *   npm run limpia-fantasmas -- --aplica  → las marca como canceladas
 *
 * ── Por qué hacen falta ────────────────────────────────────────────────────
 *
 * Cuando n8n se para -o se cae, como el 17-sep por falta de memoria- lo que
 * estuviera en marcha se queda escrito como «running» en su base, y lo que
 * estuviera en cola como «new». Al arrancar otra vez, nadie las recoge: la
 * cola de n8n vive en la memoria del proceso. Se quedan ahí de adorno,
 * confundiendo cada vez que uno mira la lista para saber si algo va mal.
 *
 * Desde la pantalla de Executions casi siempre se pueden parar y borrar. Esto
 * es para cuando no se dejan.
 *
 * ── Los dos seguros ────────────────────────────────────────────────────────
 *
 *   1. NO ESCRIBE CON n8n EN MARCHA. SQLite no perdona que otro proceso le
 *      escriba por debajo: se corrompe la base. Se comprueba el puerto 5678.
 *
 *   2. NO TOCA LO RECIENTE. Solo lo que lleve parado más de MINUTOS_MINIMOS.
 *      Una pasada de verdad puede tardar media hora -el scraper de AutoScout24
 *      tarda casi tres-, y matarla a mitad seria peor que la lista sucia.
 *
 * Se marcan como «canceled», no se borran: asi n8n las cuenta para su propia
 * poda y desaparecen solas en 24 horas, sin que nosotros toquemos las tablas
 * de datos que cuelgan de cada ejecucion.
 */
"use strict";
const { DatabaseSync } = require("node:sqlite");
const net = require("net");
const path = require("path");

const APLICA = process.argv.includes("--aplica");
const MINUTOS_MINIMOS = Number((process.argv.find((a) => a.indexOf("--minutos=") === 0) || "").split("=")[1]) || 45;
const BASE = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");

/** ¿Hay alguien escuchando en el 5678? */
function n8nEnMarcha() {
  return new Promise((resolve) => {
    const s = net.connect({ port: 5678, host: "127.0.0.1" });
    const fin = (r) => { s.destroy(); resolve(r); };
    s.setTimeout(1500);
    s.on("connect", () => fin(true));
    s.on("timeout", () => fin(false));
    s.on("error", () => fin(false));
  });
}

(async () => {
  const vivo = await n8nEnMarcha();
  console.log("  n8n: " + (vivo ? "EN MARCHA (puerto 5678)" : "parado"));

  const db = new DatabaseSync(BASE, { readOnly: !APLICA || vivo });
  const corte = Date.now() - MINUTOS_MINIMOS * 60000;
  /*
   * Las fechas de n8n, a milisegundos de verdad.
   *
   * SQLite las guarda como «2026-09-21 09:00:00.000», en UTC y con un ESPACIO.
   * Comparar eso como texto contra un ISO -«2026-09-21T08:20:00.000Z»- da
   * siempre «más viejo», porque el espacio va antes que la T en el abecedario
   * de los caracteres. La primera versión de este script daba por fantasmas
   * ejecuciones de hacía tres minutos, incluida la que estaba arreglando los
   * precios de Flexicar. Lo cazó la pasada en seco.
   */
  const enMilis = (t) => {
    if (!t) return 0;
    const s = String(t).replace(" ", "T");
    return new Date(/[zZ]$|[+-][0-9]{2}:?[0-9]{2}$/.test(s) ? s : s + "Z").getTime();
  };
  const filas = db.prepare(`SELECT e.id, e.status, e.mode, e.createdAt, e.startedAt, w.name
      FROM execution_entity e LEFT JOIN workflow_entity w ON w.id = e.workflowId
     WHERE e.status IN ('running', 'new')
     ORDER BY e.id`).all();

  const viejas = [], recientes = [];
  for (const f of filas) {
    const cuando = enMilis(f.startedAt || f.createdAt);
    (cuando > 0 && cuando < corte ? viejas : recientes).push(f);
  }

  console.log("\n  " + filas.length + " sin terminar: " + viejas.length + " paradas hace más de "
    + MINUTOS_MINIMOS + " min, " + recientes.length + " recientes\n");
  const pinta = (f, etiqueta) => console.log("      " + etiqueta + " " + String(f.id).padEnd(6)
    + String(f.status).padEnd(8) + String(f.mode).padEnd(11)
    + String(f.startedAt || f.createdAt).slice(5, 16) + "  " + String(f.name).slice(0, 44));
  for (const f of viejas) pinta(f, "fantasma ");
  for (const f of recientes) pinta(f, "TRABAJANDO");

  if (!viejas.length) {
    console.log("\n  No hay nada que limpiar.");
    db.close();
    return;
  }
  if (!APLICA) {
    console.log("\n  En seco: no se ha tocado nada. Con --aplica se marcan como canceladas.");
    db.close();
    return;
  }
  if (vivo) {
    console.log("\n  NO ESCRIBO: n8n está en marcha y escribirle la base por debajo la corrompe.");
    console.log("  Párale primero, lanza esto, y vuelve a arrancarlo.");
    db.close();
    process.exit(1);
  }

  const upd = db.prepare(`UPDATE execution_entity
      SET status = 'canceled', stoppedAt = COALESCE(startedAt, createdAt)
    WHERE id = ? AND status IN ('running', 'new')`);
  let n = 0;
  for (const f of viejas) n += upd.run(f.id).changes;
  console.log("\n  " + n + " marcadas como canceladas.");
  console.log("  n8n las podará solo en 24 h (EXECUTIONS_DATA_MAX_AGE).");
  db.close();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
