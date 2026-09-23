/**
 * Qué workflows del repositorio están sin llevar a n8n.
 *
 *   npm run que-reimporto
 *   npm run que-reimporto -- --todo    (enseña también los que están al día)
 *
 * ── Por qué hace falta ─────────────────────────────────────────────────────
 *
 * Arreglar el repositorio no arregla lo que corre. Un workflow vive en dos
 * sitios —el JSON del repositorio y la copia que tiene n8n— y se separan en
 * silencio: el 10 de septiembre la copia de n8n del comprobador de daños era
 * dos horas más vieja que la regla, y por eso salieron 29 coches dañados
 * publicados.
 *
 * Mirar la fecha del fichero NO sirve: un fichero regenerado puede ser idéntico
 * al que ya está importado, y uno viejo puede llevar un cambio sin llevar.
 *
 * ── Las normalizaciones, que son el quid ───────────────────────────────────
 *
 * n8n cambia cosas al importar, y compararlas en crudo da «distinto» en todo.
 * La primera versión de esto decía «42 por reimportar» de 43 workflows, y la
 * respuesta de verdad eran tres:
 *
 *   1. LA CREDENCIAL. El repositorio llevaba escrito el id «zoxD0jV8hxZqH0uY»,
 *      que en esta máquina no existe. Se creía que n8n le ponía el bueno al
 *      importar, y no: desde la versión 2 los nodos entran **sin credencial**,
 *      corren y no escriben nada. El 23 de septiembre de 2026 se corrigió en
 *      los 62 ficheros del repositorio, así que hoy llevan el id de verdad
 *      —«uG6rcC7AqSKyEJOW»—. La comparación la sigue ignorando igual: no es lo
 *      que hace el workflow, y compararla marcaba como distinto TODO lo que
 *      escribe en la base.
 *   2. EL «=» DE LAS EXPRESIONES. En el JSON, una expresión se escribe
 *      «={{ $json.sql }}»; n8n la guarda sin el igual.
 *   3. additionalFields -> options, que n8n renombra solo.
 *
 * Tampoco se comparan posiciones ni ids de nodo: son decoración del editor.
 * Solo lo que de verdad hace el workflow —el código, el SQL, las urls, el cron
 * y a quién llama— y sus conexiones.
 */
"use strict";
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const TODO = process.argv.includes("--todo");

const BASE = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");
if (!fs.existsSync(BASE)) {
  console.error("No encuentro la base de n8n en " + BASE);
  process.exit(1);
}

/*
 * Un JSON con las claves siempre en el mismo orden.
 *
 * n8n REORDENA las claves de `options` al importar: mismo contenido, otro
 * orden. Comparando el texto tal cual salía «distinto» en los 41 workflows que
 * tienen algún nodo HTTP. Es la cuarta normalización que hizo falta, después
 * de la credencial, el «=» de las expresiones y additionalFields -> options.
 */
const canonico = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return "[" + v.map(canonico).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonico(v[k])).join(",") + "}";
};

// Lo que de verdad hace un nodo. Sin posiciones, sin ids, sin credencial.
const sinIgual = (v) => String(v === undefined || v === null ? "" : v).replace(/^=/, "");
/*
 * Solo lo que n8n conserva TAL CUAL: el codigo, el SQL, las urls, el comando,
 * a quien llama y el horario. Mas las conexiones, que se comparan aparte.
 *
 * Fuera quedan options, cabeceras, onError y typeVersion, y no por pereza: n8n
 * BORRA LOS VALORES POR DEFECTO al importar. Un nodo con
 * followRedirects: true se guarda como {}, porque true es el predeterminado.
 * Compararlo exigiria conocer los defaults de cada tipo de nodo y de cada
 * version, y eso se rompe en cuanto n8n cambie uno.
 *
 * Asi que esto contesta «tiene n8n mi logica?», no «esta cada casilla igual?».
 * Para lo segundo estan los tests de cada workflow, que miran el JSON del
 * repositorio -donde las casillas si estan escritas- antes de importarlo.
 */
const huellaNodo = (n) => {
  const p = n.parameters || {};
  const partes = [n.name, n.type];
  for (const campo of ["jsCode", "query", "url", "command", "workflowId"]) {
    if (p[campo] !== undefined) partes.push(campo + ":" + sinIgual(p[campo]));
  }
  if (p.rule) partes.push("rule:" + canonico(p.rule));
  return partes.join("|");
};
const porNodo = (nodos) => {
  const m = {};
  for (const n of nodos) m[n.name] = huellaNodo(n);
  return m;
};
/*
 * Las conexiones, quitando las salidas vacias del final.
 *
 * Un IF con la rama «false» sin conectar se escribe [[algo], []] en el JSON, y
 * n8n lo guarda como [[algo]]: se come el array vacio. Cinco workflows salian
 * «distintos» solo por eso.
 */
const podaVacias = (con) => {
  const out = {};
  for (const [nombre, x] of Object.entries(con || {})) {
    const ramas = [...(x.main || [])];
    while (ramas.length && (!ramas[ramas.length - 1] || !ramas[ramas.length - 1].length)) ramas.pop();
    out[nombre] = { main: ramas };
  }
  return out;
};
const mismasConexiones = (a, b) => canonico(podaVacias(a)) === canonico(podaVacias(b));

const db = new DatabaseSync(BASE, { readOnly: true });
const enN8n = db.prepare("SELECT name, nodes, connections, active FROM workflow_entity").all();
db.close();

const ficheros = fs.readdirSync(path.join(RAIZ, "n8n-workflows"))
  .filter((f) => f.endsWith(".json")).sort();

const pendientes = [], alDia = [], sinImportar = [];
for (const f of ficheros) {
  let wf;
  try { wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", f), "utf8")); } catch (e) { continue; }
  const suyo = enN8n.find((x) => x.name === wf.name);
  if (!suyo) { sinImportar.push({ f, nombre: wf.name }); continue; }

  const mio = porNodo(wf.nodes), suyos = porNodo(JSON.parse(suyo.nodes));
  const cambiados = Object.keys(mio).filter((k) => suyos[k] !== mio[k]);
  const sobran = Object.keys(suyos).filter((k) => mio[k] === undefined);
  const conexionesIguales = mismasConexiones(wf.connections, JSON.parse(suyo.connections || "{}"));

  if (!cambiados.length && !sobran.length && conexionesIguales) { alDia.push(f); continue; }
  pendientes.push({ f, nombre: wf.name, cambiados, sobran, conexionesIguales, activo: !!suyo.active });
}

if (pendientes.length) {
  console.log("  HAY QUE REIMPORTAR " + pendientes.length + "\n");
  for (const p of pendientes) {
    console.log("      " + p.f + (p.activo ? "" : "   (está parado en n8n)"));
    if (p.cambiados.length) console.log("          cambian : " + p.cambiados.join(", "));
    if (p.sobran.length) console.log("          sobran  : " + p.sobran.join(", ")
      + "   <- nodos sueltos de una importación anterior");
    if (!p.conexionesIguales) console.log("          y las conexiones no casan");
  }
} else {
  console.log("  Nada que reimportar: n8n tiene lo mismo que el repositorio.");
}

if (sinImportar.length) {
  console.log("\n  NUNCA IMPORTADOS (" + sinImportar.length + ")");
  for (const s of sinImportar) console.log("      " + s.f.padEnd(42) + "«" + s.nombre + "»");
}
console.log("\n  " + alDia.length + " al día" + (TODO ? ":" : ""));
if (TODO) for (const f of alDia) console.log("      " + f);
