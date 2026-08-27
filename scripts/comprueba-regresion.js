/**
 * ¿Se ha perdido algo por el camino?
 *
 * Compara lo que hay ahora con lo que está publicado —`origin/main`— y lista lo
 * que existía y ya no: ficheros, funciones exportadas, endpoints de la API y
 * pantallas.
 *
 * No dice si algo está mal: dice qué desapareció. Cada desaparición puede ser
 * un descuido o algo que se quitó a propósito, y hay que mirarla una por una.
 *
 *   node scripts/comprueba-regresion.js [rama]
 */
const { execFileSync } = require("child_process");
const fs = require("fs");

const BASE = process.argv[2] || "origin/main";

function ficheros(rama, filtro) {
  const salida = rama
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", rama], { encoding: "utf8" })
    : execFileSync("git", ["ls-files"], { encoding: "utf8" });
  return salida.split("\n").filter((f) => filtro.test(f));
}

function leer(rama, fichero) {
  try {
    return rama
      ? execFileSync("git", ["show", `${rama}:${fichero}`], { encoding: "utf8" })
      : fs.readFileSync(fichero, "utf8");
  } catch {
    return "";
  }
}

/** Los módulos que hay: si desaparece uno, algo dejó de existir. */
function modulos(rama) {
  return new Set(ficheros(rama, /^(lib|api|src)\/.*\.jsx?$/).filter((f) => !/\.test\.jsx?$/.test(f)));
}

/** Lo que exporta cada módulo de lib y api, por nombre. */
function exportados(rama) {
  const fuera = new Set();
  for (const f of ficheros(rama, /^(lib|api)\/.*\.js$/)) {
    if (/\.test\.js$/.test(f)) continue;
    const src = leer(rama, f);
    for (const m of src.matchAll(/module\.exports\s*=\s*\{([^}]*)\}/g)) {
      for (const n of m[1].split(",")) {
        const nombre = n.split(":")[0].trim();
        if (/^[A-Za-z0-9_]+$/.test(nombre)) fuera.add(nombre);
      }
    }
    for (const m of src.matchAll(/module\.exports\.([A-Za-z0-9_]+)\s*=/g)) fuera.add(m[1]);
    for (const m of src.matchAll(/^exports\.([A-Za-z0-9_]+)\s*=/gm)) fuera.add(m[1]);
  }
  for (const f of ficheros(rama, /^src\/.*\.jsx?$/)) {
    if (/\.test\.jsx?$/.test(f)) continue;
    const src = leer(rama, f);
    for (const m of src.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/gm)) {
      fuera.add(m[1]);
    }
  }
  return fuera;
}

/** Direcciones que sirve la aplicación: las de vercel.json y los ficheros de api/. */
function endpoints(rama) {
  const fuera = new Set();
  for (const f of ficheros(rama, /^api\/.*\.js$/)) fuera.add("/" + f.replace(/\.js$/, ""));
  try {
    const v = JSON.parse(leer(rama, "vercel.json") || "{}");
    for (const r of v.rewrites || []) fuera.add(r.source);
    for (const c of v.crons || []) fuera.add("cron " + c.path);
  } catch { /* sin vercel.json */ }
  return fuera;
}

/** Las rutas públicas que la aplicación conoce. */
function rutasPublicas(rama) {
  const src = leer(rama, "src/App.js");
  const fuera = new Set();
  for (const m of src.matchAll(/normalizePublicPath\("([^"]+)"\)/g)) fuera.add(m[1]);
  for (const m of src.matchAll(/syncBrowserPath\("([^"]+)"/g)) fuera.add(m[1]);
  for (const m of src.matchAll(/^\s{2}[a-zA-Z]+:\s*"(\/[^"]*)"/gm)) fuera.add(m[1]);
  return fuera;
}

const COMPROBACIONES = [
  ["Módulos", modulos],
  ["Funciones exportadas", exportados],
  ["Endpoints", endpoints],
  ["Rutas públicas", rutasPublicas],
];

let perdidas = 0;
console.log(`  Comparando el árbol de trabajo con ${BASE}\n`);

for (const [titulo, fn] of COMPROBACIONES) {
  const antes = fn(BASE);
  const ahora = fn(null);
  const faltan = [...antes].filter((x) => !ahora.has(x));
  const nuevas = [...ahora].filter((x) => !antes.has(x));

  console.log(`  ── ${titulo} ──`);
  console.log(`     antes ${antes.size} · ahora ${ahora.size} · nuevas ${nuevas.length}`);
  if (faltan.length) {
    perdidas += faltan.length;
    console.log(`     YA NO ESTÁN (${faltan.length}):`);
    for (const x of faltan) console.log(`        ${x}`);
  } else {
    console.log("     no falta ninguna");
  }
  console.log("");
}

console.log(perdidas ? `  ${perdidas} cosas que estaban y ya no. Míralas una por una.`
                     : "  No se ha perdido nada.");
process.exit(perdidas ? 1 : 0);
