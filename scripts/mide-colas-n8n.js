/**
 * Cuanto esperan los flujos de n8n antes de arrancar.
 *
 *   npm run mide-colas
 *   npm run mide-colas -- 14        (los ultimos 14 dias)
 *
 * SOLO LEE la base de n8n, y en modo readOnly. No toca Postgres.
 *
 * ── POR QUE ────────────────────────────────────────────────────────────────
 *
 * El 24-sep-2026 n8n tenia N8N_CONCURRENCY_PRODUCTION_LIMIT = 2: como mucho DOS
 * ejecuciones a la vez, con 26 flujos disparando entre las 8 y las 23. Por eso
 * un enriquecedor largo impedia arrancar a los de detras. Se subio a 3, y esto
 * es lo que dice si sirvio de algo en vez de suponerlo.
 *
 * La espera se mide como createdAt -> startedAt: n8n apunta la ejecucion cuando
 * el disparador salta y la arranca cuando hay hueco. Esa diferencia ES la cola.
 *
 * ── LO QUE NO MIDE, Y CONVIENE TENERLO PRESENTE ────────────────────────────
 *
 * Solo ve las ejecuciones GUARDADAS. Varios flujos llevan
 * saveDataSuccessExecution: 'none' -las que van bien no se guardan- y ademas
 * hay poda puesta: EXECUTIONS_DATA_MAX_AGE = 24 horas y un tope de 100. Asi que
 * la ventana real son las ultimas horas, no los dias que se pidan.
 *
 * Y una cola de n8n no es la unica cola que hay. El scoring bloquea
 * moveadvisor_market_offers cerca de una hora, y lo que espera ahi no espera en
 * n8n sino en Postgres: eso se ve con pg_stat_activity, no con esto.
 */
"use strict";
const path = require("path");
const os = require("os");
const { DatabaseSync } = require("node:sqlite");

const DIAS = Number(process.argv[2] || 7);
const BASE = path.join(os.homedir(), ".n8n", "database.sqlite");

const min = (ms) => (ms / 60000);
const fmt = (m) => (m >= 1 ? m.toFixed(1) + " min" : Math.round(m * 60) + " s");

(() => {
  const db = new DatabaseSync(BASE, { readOnly: true });
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString();

  const filas = db.prepare(
    `SELECT e.workflowId, w.name, e.createdAt, e.startedAt, e.stoppedAt, e.status
       FROM execution_entity e
       LEFT JOIN workflow_entity w ON w.id = e.workflowId
      WHERE e.startedAt IS NOT NULL AND e.createdAt >= ?`).all(desde);

  if (!filas.length) {
    console.log("\n  No hay ejecuciones guardadas en los ultimos " + DIAS + " dias.");
    console.log("  Es lo normal: la mayoria de los flujos solo guardan las que fallan,");
    console.log("  y la poda borra a las 24 horas. Vuelve a mirar despues de un dia\n"
      + "  con actividad, o baja el numero de dias.\n");
    return;
  }

  const porFlujo = new Map();
  let esperaTotal = 0, conEspera = 0;
  const esperas = [];

  for (const f of filas) {
    const espera = min(new Date(f.startedAt) - new Date(f.createdAt));
    const dura = f.stoppedAt ? min(new Date(f.stoppedAt) - new Date(f.startedAt)) : null;
    esperas.push(espera);
    esperaTotal += espera;
    if (espera > 0.5) conEspera++;
    const k = f.name || f.workflowId;
    if (!porFlujo.has(k)) porFlujo.set(k, { n: 0, espera: 0, peor: 0, dura: 0, conDura: 0 });
    const r = porFlujo.get(k);
    r.n++; r.espera += espera;
    if (espera > r.peor) r.peor = espera;
    if (dura != null) { r.dura += dura; r.conDura++; }
  }

  esperas.sort((a, b) => a - b);
  console.log("\n  " + filas.length + " ejecuciones guardadas en los ultimos " + DIAS + " dias");
  console.log("    esperaron mas de 30 s : " + conEspera + "   ("
    + Math.round(100 * conEspera / filas.length) + " %)");
  console.log("    espera media          : " + fmt(esperaTotal / filas.length));
  console.log("    mediana               : " + fmt(esperas[Math.floor(esperas.length / 2)]));
  console.log("    la peor               : " + fmt(esperas[esperas.length - 1]));

  const orden = [...porFlujo.entries()].sort((a, b) => (b[1].espera / b[1].n) - (a[1].espera / a[1].n));
  console.log("\n  LOS QUE MAS ESPERAN  (media por ejecucion)");
  console.log("    espera   dura     veces   flujo");
  for (const [nom, r] of orden.slice(0, 12)) {
    console.log("    " + fmt(r.espera / r.n).padStart(8)
      + (r.conDura ? fmt(r.dura / r.conDura).padStart(9) : "        -")
      + String(r.n).padStart(8) + "   " + String(nom).slice(0, 52));
  }

  /*
   * Cuantas coincidian en el tiempo. Si el maximo se queda pegado al limite de
   * concurrencia, el limite es lo que manda; si se queda por debajo, el cuello
   * esta en otro sitio -en Postgres, o en el propio portal-.
   */
  const tramos = filas.filter((f) => f.stoppedAt).map((f) => [
    new Date(f.startedAt).getTime(), new Date(f.stoppedAt).getTime()]);
  let solape = 0;
  for (const [a] of tramos) {
    const n = tramos.filter(([x, y]) => x <= a && y >= a).length;
    if (n > solape) solape = n;
  }
  console.log("\n    maximo de ejecuciones a la vez que se han visto: " + solape);
  console.log("    (el limite configurado se lee con:");
  console.log("       [Environment]::GetEnvironmentVariable('N8N_CONCURRENCY_PRODUCTION_LIMIT','User')");
  console.log("     y si el maximo visto NO llega al limite, el cuello no es la concurrencia)\n");
})();
