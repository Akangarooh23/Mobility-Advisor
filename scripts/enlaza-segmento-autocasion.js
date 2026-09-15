/**
 * Le dice al orquestador de Autocasión a quién tiene que llamar.
 *
 *   npm run enlaza-segmento-autocasion
 *
 * Busca «Autocasión – Segmento (marca)» en la base de n8n, coge su id, lo escribe en
 * el generador y vuelve a generar los dos ficheros.
 *
 * Existe para no pegar el id a mano: el orquestador llevaba desde agosto con el
 * literal REEMPLAZA_CON_ID_DEL_SEGMENTO_AC, y un id mal pegado da
 * «Workflow does not exist» sin decir por qué.
 */
"use strict";
const { DatabaseSync } = require("node:sqlite");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const GENERADOR = path.join(__dirname, "genera-scraper-autocasion.js");
const NOMBRE = "Autocasión – Segmento (marca)";

const base = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");
if (!fs.existsSync(base)) {
  console.error("No encuentro la base de n8n en " + base);
  process.exit(1);
}
const db = new DatabaseSync(base, { readOnly: true });
const filas = db.prepare("SELECT id, name, active FROM workflow_entity WHERE name = ?").all(NOMBRE);
db.close();

if (!filas.length) {
  console.error("«" + NOMBRE + "» no está importado en n8n todavía.");
  console.error("Impórtalo primero (n8n-workflows/autocasion-segmento.json) y vuelve a lanzar esto.");
  process.exit(1);
}
if (filas.length > 1) {
  console.error("Hay " + filas.length + " workflows llamados «" + NOMBRE + "». Borra los que sobren:");
  for (const f of filas) console.error("      id " + f.id + (f.active ? "  ACTIVO" : "  parado"));
  process.exit(1);
}

const id = filas[0].id;
let t = fs.readFileSync(GENERADOR, "utf8");
const antes = (t.match(/^const ID_SEGMENTO = "(.*)";$/m) || [])[1];
if (antes === id) {
  console.log("  ya estaba enlazado al id " + id);
} else {
  t = t.replace(/^const ID_SEGMENTO = ".*";$/m, 'const ID_SEGMENTO = "' + id + '";');
  fs.writeFileSync(GENERADOR, t);
  console.log("  enlazado: " + (antes || "?") + "  ->  " + id);
}

execFileSync(process.execPath, [GENERADOR], { stdio: "inherit", cwd: RAIZ });
console.log("\n  Ahora reimporta n8n-workflows/autocasion-scraper-brands.json en n8n.");
