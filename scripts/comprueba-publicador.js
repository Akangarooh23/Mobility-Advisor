/**
 * Comprueba el workflow que publica.
 *
 *   npm run test:publicar
 *
 * Es el primer nodo de comandos de esta instalación, y el fallo que da miedo no
 * es que pete: es que se quede callado. Si n8n no puede ejecutar node, o la
 * ruta cambia, el escaparate se congela y por fuera todo parece normal —los
 * coches vendidos siguen ofreciéndose, los nuevos no entran, y nadie se entera
 * hasta que un cliente pide un coche que ya no está—.
 *
 * Así que aquí se comprueban tres cosas:
 *
 *   1. Que el comando funciona DE VERDAD en esta máquina. Se lanza, en seco,
 *      el mismo comando que llevará el nodo.
 *   2. Que el parte sabe leer la salida: cuántas entran, cuántas salen.
 *   3. Que una pasada fallida se apunta como fallida. Es lo que convierte un
 *      fallo silencioso en un correo.
 */
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "importacion-publicar.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
function ejecuta(js, entrada) {
  const log = [];
  const f = new Function("$input", "console", js);
  const r = f({ first: () => ({ json: entrada }), all: () => [{ json: entrada }] },
    { log: (m) => log.push(String(m)) });
  return { json: (r || [])[0] ? r[0].json : {}, log };
}

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  // El scoring calcula market_price_es a las 13:10 y tarda unos 15 minutos.
  // Publicar antes es decidir con el precio español de ayer.
  comprueba("la primera pasada es DESPUÉS del scoring de las 13:10",
    Math.min(...horas) >= 13 && !(Math.min(...horas) === 13 && Number(String(expr).split(" ")[1]) < 30),
    "primera a las " + Math.min(...horas) + ":" + String(expr).split(" ")[1]);
  comprueba("hay una segunda pasada para los vendidos de la tarde", horas.length >= 2,
    horas.length + " pasadas");

  const cmd = nodo("Aplicar la regla de la ficha");
  comprueba("el nodo de comandos existe", !!cmd && cmd.type.endsWith("executeCommand"));
  comprueba("un fallo del comando NO deja la pasada sin parte",
    cmd.onError === "continueRegularOutput");
  comprueba("el comando aplica de verdad (lleva --aplica)",
    String(cmd.parameters.command).indexOf("--aplica") !== -1);
  comprueba("y se mete en la carpeta del proyecto, que es donde está .env.local",
    String(cmd.parameters.command).indexOf("cd /d") === 0);
  comprueba("el nodo de Postgres reintenta",
    wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
  comprueba("el workflow avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  const baseN8n = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");
  if (fs.existsSync(baseN8n)) {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(baseN8n, { readOnly: true });
    const existen = new Set(db.prepare("SELECT id FROM credentials_entity WHERE type = 'postgres'").all().map((x) => x.id));
    db.close();
    const usada = nodo("PG: Apuntar el parte").credentials.postgres.id;
    comprueba("la credencial de Postgres existe en n8n", existen.has(usada), usada);
  }

  // ══ el comando, de verdad ════════════════════════════════════════════════
  console.log("\nEL COMANDO, EN ESTA MÁQUINA (en seco, no escribe)");
  const enSeco = String(cmd.parameters.command).replace(" --aplica", "");
  let salida = "", codigo = 0;
  try {
    salida = execSync(enSeco, { encoding: "utf8", timeout: 600000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    codigo = e.status || 1;
    salida = String(e.stdout || "");
    console.log("      el comando ha fallado con código " + codigo);
  }
  comprueba("el comando se ejecuta", codigo === 0, "código " + codigo);
  comprueba("y devuelve el resumen del recálculo",
    salida.indexOf("publicadas ahora") !== -1, salida.split("\n").filter((l) => l.indexOf("publicadas ahora") !== -1)[0] || "");
  comprueba("en seco NO escribe nada", salida.indexOf("no se ha escrito nada") !== -1);

  // ══ el parte ═════════════════════════════════════════════════════════════
  console.log("\nEL PARTE, LEYENDO ESA SALIDA");
  const bueno = ejecuta(nodo("Code: Qué ha hecho").parameters.jsCode,
    { stdout: salida, stderr: "", exitCode: 0 });
  comprueba("lee cuántas quedan publicadas", bueno.json.ahora !== null && bueno.json.ahora > 0,
    String(bueno.json.ahora));
  comprueba("y cuántas entran y salen",
    bueno.json.entran !== null && bueno.json.salen !== null,
    bueno.json.entran + " entran, " + bueno.json.salen + " salen");
  comprueba("lee bien los números con puntos de millar",
    bueno.json.miradas !== null && bueno.json.miradas > 1000, String(bueno.json.miradas));
  comprueba("apunta la pasada", String(bueno.json.sql).indexOf("INSERT INTO moveadvisor_verify_runs") !== -1
    && String(bueno.json.sql).indexOf("'publicar'") !== -1);
  comprueba("y la da por buena", bueno.json.bien === true
    && String(bueno.json.sql).indexOf("FALSE, 0)") !== -1);

  console.log("\nY CUANDO EL COMANDO FALLA");
  for (const [nombre, entrada] of [
    ["node no está en el PATH", { stdout: "", stderr: "'node' no se reconoce", exitCode: 1 }],
    ["la base no contesta", { stdout: "ERROR: connect ETIMEDOUT", stderr: "", exitCode: 1 }],
    ["termina bien pero no publica nada", { stdout: "garantías en catálogo: 3", stderr: "", exitCode: 0 }],
  ]) {
    const malo = ejecuta(nodo("Code: Qué ha hecho").parameters.jsCode, entrada);
    comprueba(nombre + ": se apunta como fallida",
      malo.json.bien === false && String(malo.json.sql).indexOf("TRUE, 0)") !== -1);
  }
  const sinNada = ejecuta(nodo("Code: Qué ha hecho").parameters.jsCode,
    { stdout: "", stderr: "", exitCode: 0 });
  comprueba("una salida vacía con código 0 tampoco cuela", sinNada.json.bien === false,
    "que termine no es que haya publicado");

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
