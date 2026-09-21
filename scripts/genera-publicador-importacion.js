/**
 * Importación – Publicar (aplica la regla de la ficha)
 *
 * El origen de n8n-workflows/importacion-publicar.json.
 *
 *   node scripts/genera-publicador-importacion.js
 *   npm run test:publicar
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 *
 * El 21-sep se le quitó al flujo de scoring la decisión de publicar, porque
 * había dos reglas escribiendo la misma columna y se despublicaban la una a la
 * otra cada día a las 13:10. Ahora manda una sola, la de la ficha, que vive en
 * `lib/coste-importacion.js`.
 *
 * Pero esa vive en código, no en SQL, y se aplica con un script. Así que desde
 * ese momento NADIE publicaba solo: el escaparate solo cambiaba cuando alguien
 * se acordaba de lanzarlo a mano. Un coche vendido se quedaba ofreciéndose, y
 * uno nuevo y bueno no entraba.
 *
 * Esto es ese «alguien».
 *
 * ── Por qué a las 13:40 y no a cualquier hora ──────────────────────────────
 *
 * La regla necesita `market_price_es`, el precio español de coches comparables,
 * y ese lo calcula el flujo de scoring a las 13:10 —tarda unos 15 minutos—.
 * Publicar antes es decidir con el precio de ayer.
 *
 * La segunda pasada, a las 21:40, no recalcula nada nuevo del mercado: está
 * para que los coches que el verificador haya dado por vendidos durante la
 * tarde salgan del escaparate el mismo día. Un cliente puede pedir un coche
 * vendido y pagar su fianza; eso ya pasó en septiembre con 454 de 484.
 *
 * ── Lo que puede salir mal ─────────────────────────────────────────────────
 *
 * Es el primer nodo de comandos de esta instalación. Si n8n no puede ejecutar
 * node, o la ruta cambia, el nodo falla. Por eso:
 *
 *   - `onError: continueRegularOutput`, para que el parte se escriba IGUAL y
 *     quede constancia de que la pasada no hizo nada.
 *   - El parte guarda el código de salida y marca `blocked` si no es cero.
 *   - El workflow tiene errorWorkflow, así que además llega un correo.
 *
 * Un fallo silencioso aquí es el peor de todos: el escaparate se congela y por
 * fuera todo parece normal.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// La ruta absoluta del repositorio, con las barras de Windows. El «cd /d» hace
// falta porque el script lee .env.local del directorio en el que corre, y
// porque cmd.exe no cambia de unidad sin él.
const CARPETA = path.resolve(RAIZ).replace(/\//g, "\\");
const COMANDO = 'cd /d "' + CARPETA + '" && node scripts\\recalcula-publicacion.cjs --aplica';

const CODE_PARTE = `// Lo que ha hecho la pasada, leído de su propia salida.
//
// Sin expresiones regulares a propósito: aquí el código viaja dentro de una
// cadena de JavaScript y dentro de un JSON, y por el camino «\\\\d» se queda en
// «d». Ha pasado cuatro veces esta semana. Partir por líneas no se rompe.
const res = $input.first().json || {};
const salida = String(res.stdout || '');
const error = String(res.stderr || '');
const codigo = Number(res.exitCode === undefined ? 0 : res.exitCode);

const numeroDe = (etiqueta) => {
  for (const linea of salida.split('\\n')) {
    const i = linea.indexOf(etiqueta);
    if (i === -1) continue;
    const trozo = linea.slice(linea.indexOf(':', i) + 1).trim().replace(/\\./g, '');
    const n = parseInt(trozo, 10);
    if (!isNaN(n)) return n;
  }
  return null;
};

const miradas = numeroDe('ofertas alemanas');
const antes = numeroDe('publicadas antes');
const ahora = numeroDe('publicadas ahora');
const entran = numeroDe('entran');
const salen = numeroDe('salen');

// Que el script haya terminado NO basta: si no ha escrito nada, algo va mal
// aunque el código de salida sea cero.
const fue = (codigo === 0 && ahora !== null);

console.log('[publicar] ── resumen ──');
console.log('  código de salida : ' + codigo);
console.log('  ofertas miradas  : ' + (miradas === null ? '?' : miradas));
console.log('  publicadas antes : ' + (antes === null ? '?' : antes));
console.log('  publicadas ahora : ' + (ahora === null ? '?' : ahora));
console.log('  entran / salen   : ' + (entran === null ? '?' : entran) + ' / ' + (salen === null ? '?' : salen));
if (!fue) {
  console.log('  LA PASADA NO HA PUBLICADO NADA.');
  if (error) console.log('  error: ' + error.slice(0, 500));
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='publicar':
//     checked  ofertas alemanas miradas   alive  publicadas ahora
//     deactivated  las que salen          unclassified  las que entran
//     blocked  TRUE si la pasada no llegó a publicar
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('publicar', NOW(), " + n(miradas) + ', ' + n(ahora) + ', '
  + n(salen) + ', ' + n(entran) + ', 0, ' + (fue ? 'FALSE' : 'TRUE') + ', 0)';

return [{ json: { sql: sql, codigo: codigo, miradas: miradas, antes: antes,
  ahora: ahora, entran: entran, salen: salen, bien: fue,
  error: error.slice(0, 500) } }];`;

const L = (n) => ({ node: n, type: "main", index: 0 });
const CRON = "2 veces/día (13:40 y 21:40)";
const nodos = [
  { parameters: {}, id: "pu-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-520, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 40 13,21 * * *" }] } },
    id: "pu-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-520, 400] },
  { parameters: { command: COMANDO },
    id: "pu-cmd", name: "Aplicar la regla de la ficha",
    // Que el nodo falle no puede dejar la pasada sin parte: un fallo silencioso
    // aquí congela el escaparate y por fuera todo parece normal.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.executeCommand", typeVersion: 1, position: [-280, 300] },
  { parameters: { jsCode: CODE_PARTE }, id: "pu-parte", name: "Code: Qué ha hecho",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-40, 300] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "pu-pg", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [200, 300],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":         { main: [[L("Aplicar la regla de la ficha")]] },
  [CRON]:                         { main: [[L("Aplicar la regla de la ficha")]] },
  "Aplicar la regla de la ficha": { main: [[L("Code: Qué ha hecho")]] },
  "Code: Qué ha hecho":           { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Importación – Publicar (regla de la ficha)",
  nodes: nodos,
  connections: conexiones,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveDataSuccessExecution: "none",
    saveDataErrorExecution: "all",
    callerPolicy: "workflowsFromSameOwner",
    errorWorkflow: ERROR_WF,
  },
  pinData: {},
};

const destino = path.join(RAIZ, "n8n-workflows", "importacion-publicar.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos");
console.log("  comando: " + COMANDO);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + PASADAS + " pasadas/día, después del scoring de las 13:10");

// Que la carpeta del comando exista de verdad, aquí y ahora.
const raizOk = fs.existsSync(path.join(CARPETA, "scripts", "recalcula-publicacion.cjs"));
console.log("  " + (raizOk ? "ok   " : "MAL  ") + "el script está donde dice el comando");
if (!raizOk) process.exit(1);
