/**
 * Un vocabulario de color, en vez de un vertedero.
 *
 * La columna `color` tenia 835 valores distintos para 721.419 ofertas. Trece de
 * ellos cubrian el 95%: el resto era casi todo el mismo color escrito de otra
 * forma -"Blanco" 199.500 veces y "blanco" otras 37.813- mas una cola de 677
 * nombres comerciales que entre todos suman 952 filas: AZUL CAVANSITA, Azul
 * Navarra (metalizado), ATLAS WHITE, DARK GUN METAL.
 *
 * Con 835 valores la columna no sirve para filtrar, que es para lo unico que
 * sirve un color en un marketplace. Nadie busca "Azul Cavansita".
 *
 * ── Lo que se pierde, medido antes de aplicarlo ─────────────────────────────
 *
 * De las filas que cambian:
 *   107.598  cambian solo de forma (blanco -> Blanco). No se pierde nada.
 *     2.441  pierden el matiz comercial (ATLAS WHITE -> Blanco). Son nombres de
 *            una a cuatro filas cada uno.
 *     4.626  se vacian: "otro" (3.946), "Sin Designar", "Con", y los nombres
 *            alemanes e ingleses que no contienen ningun color reconocible
 *            -"Mitternachtsschwarz", "Penta Metal"-. Vacio es la verdad ahi.
 *
 * ── Como decide ────────────────────────────────────────────────────────────
 *
 * Gana el color que aparezca ANTES en el texto, no el primero de la lista: en
 * "Gris Plata" manda Gris porque es lo que se lee primero.
 *
 * Esto es un arreglo de una vez. De aqui en adelante lo mantiene limpio
 * universal-derivar, que aplica la misma regla a lo que vaya entrando.
 *
 *   node scripts/normaliza-color.js            (en seco, no escribe)
 *   ESCRIBIR=1 node scripts/normaliza-color.js (de verdad)
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const ESCRIBIR = process.env.ESCRIBIR === "1";

/** La misma tabla que usa universal-derivar. Si cambia una, cambian las dos. */
const COLORES = [
  ["blanco", "Blanco"], ["gris", "Gris"], ["negro", "Negro"], ["azul", "Azul"],
  ["rojo", "Rojo"], ["plata", "Plata"], ["verde", "Verde"], ["naranja", "Naranja"],
  ["marron", "Marrón"], ["beige", "Beige"], ["granate", "Granate"],
  ["amarillo", "Amarillo"], ["burdeos", "Burdeos"], ["dorado", "Dorado"],
  ["violeta", "Violeta"], ["morado", "Morado"], ["plateado", "Plata"],
  ["blanca", "Blanco"], ["negra", "Negro"], ["roja", "Rojo"], ["bronce", "Bronce"],
  ["rosa", "Rosa"], ["oro", "Dorado"], ["turquesa", "Azul"],
  // Los concesionarios de importacion escriben el nombre en ingles.
  ["white", "Blanco"], ["black", "Negro"], ["silver", "Plata"], ["grey", "Gris"],
  ["gray", "Gris"], ["blue", "Azul"], ["red", "Rojo"], ["green", "Verde"],
  ["yellow", "Amarillo"], ["brown", "Marrón"], ["orange", "Naranja"],
];

const NO_ES_COLOR = /^(otro|otros|con|sin|pendiente|no aplica|-+|n\/?d|sin\s+(designar|especificar|definir|color))$/i;

function normaliza(v) {
  const bruto = String(v || "").trim();
  if (!bruto || NO_ES_COLOR.test(bruto)) return "";
  const s = bruto.toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u");
  let mejor = null, pos = 1e9;
  for (const par of COLORES) {
    const i = s.search(new RegExp("\\b" + par[0]));
    if (i >= 0 && i < pos) { pos = i; mejor = par[1]; }
  }
  return mejor || "";
}

const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  // Se trabaja sobre los VALORES distintos, no sobre las 721.419 filas: son 835
  // y caben en una sola sentencia con su tabla de traduccion al lado.
  const valores = (await c.query(`SELECT color, count(*) n FROM moveadvisor_market_offers
    WHERE COALESCE(color, '') <> '' GROUP BY 1`)).rows;
  const total = valores.reduce((a, x) => a + Number(x.n), 0);

  const cambios = [];
  let filasCambian = 0, filasVacian = 0;
  for (const v of valores) {
    const nuevo = normaliza(v.color);
    if (nuevo === v.color) continue;
    cambios.push([v.color, nuevo]);
    if (nuevo === "") filasVacian += Number(v.n);
    else filasCambian += Number(v.n);
  }

  console.log(`${ESCRIBIR ? "" : "[EN SECO] "}Color en moveadvisor_market_offers:`);
  console.log(`  valores distintos ahora : ${valores.length}   (${total} filas con color)`);
  console.log(`  valores que cambian     : ${cambios.length}`);
  console.log(`  filas que se normalizan : ${filasCambian}`);
  console.log(`  filas que se vacian     : ${filasVacian}`);

  if (!cambios.length) { console.log("\nYa esta normalizado."); await c.end(); return; }

  if (!ESCRIBIR) {
    console.log("\n[EN SECO] no se ha tocado la base.");
    console.log("Para hacerlo de verdad: ESCRIBIR=1 node scripts/normaliza-color.js");
    await c.end();
    return;
  }

  // updated_at NO se toca: esto es una correccion de formato nuestra, no un
  // cambio del anuncio. Mover esa fecha haria parecer que 114.000 coches
  // cambiaron de precio o de estado la misma tarde.
  const tabla = cambios.map(([a, b]) => "(" + esc(a) + ", " + esc(b) + ")").join(", ");
  const t0 = Date.now();
  const r = await c.query(
    `UPDATE moveadvisor_market_offers t SET color = m.nuevo
     FROM (VALUES ${tabla}) AS m(viejo, nuevo)
     WHERE t.color = m.viejo`);
  console.log(`\nNormalizadas ${r.rowCount} filas en ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  const despues = (await c.query(`SELECT color, count(*) n FROM moveadvisor_market_offers
    WHERE COALESCE(color, '') <> '' GROUP BY 1 ORDER BY n DESC`)).rows;
  console.log(`\nvocabulario resultante (${despues.length} valores):`);
  despues.forEach((x) => console.log("   " + String(x.color).padEnd(12) + String(x.n).padStart(7)));

  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
