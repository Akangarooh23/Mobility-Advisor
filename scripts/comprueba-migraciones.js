/**
 * Que la cuenta de migraciones siga siendo una cuenta.
 *
 * Dos cosas, y la segunda es la que importa.
 *
 * **1. Los ficheros están bien puestos.** Numerados, sin repetir número y sin
 * saltos raros. Si dos personas escriben la 0004 a la vez, esto lo dice antes
 * de que se aplique una y la otra se quede fuera para siempre.
 *
 * **2. El esquema no vuelve a escribirse a escondidas.** Hoy hay 22 ficheros de
 * la web y 25 del ERP que crean tablas o añaden columnas al vuelo, la primera
 * vez que alguien entra en la pantalla que los ejecuta. Por eso nadie podía
 * decir qué había en la base sin arrancar la aplicación entera.
 *
 * Esos 47 no se arreglan de golpe —cada uno hay que mirarlo—, así que esto hace
 * de trinquete: el número puede **bajar**, nunca subir. Si alguien escribe una
 * pantalla nueva con su `CREATE TABLE` dentro, esto falla y le recuerda dónde
 * va eso. Y cada vez que se quita uno, se baja el tope aquí.
 *
 *   npm run test:migraciones
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ERP = path.join(RAIZ, "..", "carswise-erp-backoffice", "apps", "api", "src");

/** Cuántos ficheros pueden seguir tocando el esquema por su cuenta. Solo baja. */
const TOPE_WEB = 22;
const TOPE_ERP = 25;

const ESQUEMA_A_MANO = /CREATE TABLE IF NOT EXISTS|ADD COLUMN IF NOT EXISTS/;

const fallos = [];

// ── 1. Los ficheros de migración ─────────────────────────────────────────
const carpeta = path.join(RAIZ, "migrations");
const ficheros = fs.existsSync(carpeta)
  ? fs.readdirSync(carpeta).filter((f) => f.endsWith(".sql")).sort()
  : [];

if (!ficheros.length) fallos.push("no hay ni una migración: el esquema vuelve a no estar escrito");

const vistos = new Map();
for (const f of ficheros) {
  const m = /^(\d{4})-[a-z0-9-]+\.sql$/.exec(f);
  if (!m) {
    fallos.push(`${f}: se llama NNNN-lo-que-hace.sql, en minúsculas y con guiones`);
    continue;
  }
  if (vistos.has(m[1])) fallos.push(`${f} y ${vistos.get(m[1])} llevan el mismo número: uno se quedará sin aplicar`);
  vistos.set(m[1], f);
}

// ── 2. El trinquete ──────────────────────────────────────────────────────
function cuantosTocanElEsquema(raiz, carpetas, extension) {
  const encontrados = [];
  const anda = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules") anda(completo);
      } else if (e.name.endsWith(extension) && !e.name.includes(".test.")) {
        if (ESQUEMA_A_MANO.test(fs.readFileSync(completo, "utf8"))) encontrados.push(completo);
      }
    }
  };
  for (const c of carpetas) anda(path.join(raiz, c));
  return encontrados;
}

const web = cuantosTocanElEsquema(RAIZ, ["lib", "api"], ".js");
const erp = fs.existsSync(ERP) ? cuantosTocanElEsquema(ERP, ["."], ".ts") : null;

if (web.length > TOPE_WEB) {
  fallos.push(
    `${web.length} ficheros de la web crean tablas por su cuenta, y el tope era ${TOPE_WEB}.\n` +
    `      El esquema se cambia en migrations/, no dentro de un manejador.\n` +
    web.filter((f) => true).slice(-3).map((f) => "      · " + path.relative(RAIZ, f)).join("\n")
  );
}
if (erp && erp.length > TOPE_ERP) {
  fallos.push(
    `${erp.length} ficheros del ERP crean tablas por su cuenta, y el tope era ${TOPE_ERP}.\n` +
    `      Las migraciones del ERP también van en Mobility-Advisor/migrations: la base es la misma.`
  );
}

// Y si han bajado, se dice, para que alguien baje el tope.
if (web.length < TOPE_WEB || (erp && erp.length < TOPE_ERP)) {
  console.log(`[migraciones] han bajado: web ${web.length} (tope ${TOPE_WEB})` +
    (erp ? `, ERP ${erp.length} (tope ${TOPE_ERP})` : "") + ". Baja el tope en este fichero.");
}

if (fallos.length) {
  console.error("[migraciones] FALLA:\n");
  for (const f of fallos) console.error("  · " + f);
  process.exit(1);
}

console.log(
  `[migraciones] OK: ${ficheros.length} migraciones bien numeradas; ` +
  `${web.length} ficheros de la web y ${erp === null ? "?" : erp.length} del ERP todavía tocan el esquema a mano.`
);
