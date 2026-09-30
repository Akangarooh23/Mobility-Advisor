/**
 * Comprueba las reglas de `visible`.
 *
 *   npm run test:visibles
 *
 * ── Qué prueba, y contra qué ───────────────────────────────────────────────
 *
 * Las condiciones SQL de scripts/recalcula-visibles.js, leídas del propio
 * fichero y evaluadas por Postgres contra coches inventados. No toca la tabla
 * real: los coches van en un VALUES, así que se pueden construir los casos
 * raros que en los datos aparecen una vez cada diez mil.
 *
 * Leerlas del fichero en vez de copiarlas aquí no es pereza: una copia y el
 * original se separan el día que alguien toca uno de los dos, y entonces el
 * test dice que todo va bien mientras prueba una regla que ya no corre.
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 *
 * El 30-sep-2026 el consejero y el buscador dejaron de tener cada uno sus
 * condiciones y pasaron a leer `visible`. Cinco comprobaciones de
 * las-preguntas-que-estrechan.test.js dejaron de tener sentido allí, porque
 * miraban la redacción de la consulta:
 *
 *     assert.ok(condiciones.includes("is_damaged IS NOT TRUE"))
 *
 * Las garantías que encerraban siguen siendo ciertas, pero ahora se cumplen
 * aquí. Borrarlas sin traerlas habría sido perder cobertura de verdad a
 * cambio de poner los tests en verde.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

/*
 * Las reglas, sacadas del script que las aplica.
 *
 * Se ejecuta el fichero con un `module.exports` falso para quedarse con
 * MOTIVOS sin que arranque su main: el script solo escribe cuando le pasan
 * --aplica, pero ni siquiera se le deja llegar ahí.
 */
function losMotivos() {
  const src = fs.readFileSync(path.join(RAIZ, "scripts", "recalcula-visibles.js"), "utf8");
  const i = src.indexOf("const MOTIVOS = [");
  if (i === -1) throw new Error("no encuentro MOTIVOS en recalcula-visibles.js");
  const fin = src.indexOf("\n];", i);
  const cuerpo = src.slice(i, fin + 3);
  /* Las constantes que interpola: se sacan del mismo sitio. */
  const num = (n) => {
    const m = src.match(new RegExp("const " + n + " = (\\d+);"));
    if (!m) throw new Error("no encuentro " + n);
    return m[1];
  };
  const f = new Function(
    "PRECIO_SOSPECHOSO", "PRECIO_ABSURDO", "PRECIO_MAXIMO", "KM_MAXIMO",
    "ANOS_QUE_LO_JUSTIFICAN", "KM_QUE_LO_JUSTIFICAN",
    cuerpo + "\nreturn MOTIVOS;");
  return f(num("PRECIO_SOSPECHOSO"), num("PRECIO_ABSURDO"), num("PRECIO_MAXIMO"),
    num("KM_MAXIMO"), num("ANOS_QUE_LO_JUSTIFICAN"), num("KM_QUE_LO_JUSTIFICAN"));
}

const MOTIVOS = losMotivos();
const CASE_MOTIVO = "CASE\n"
  + MOTIVOS.map(([m, cond]) => `    WHEN ${cond} THEN '${m}'`).join("\n")
  + "\n    ELSE NULL END";

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

/** Un coche por defecto que SÍ se enseña. Cada caso cambia solo lo suyo. */
const BUENO = {
  price: 15000, year: 2018, mileage: 90000, image_url: "http://x/a.jpg",
  es_coche: true, is_damaged: null, color: "gris", doors: 5, seats: 5,
};

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 120000 });
  await c.connect();

  const ANIO = new Date().getFullYear();

  /*
   * Cada caso: nombre, lo que cambia respecto al coche bueno, y el motivo que
   * se espera (null = se enseña).
   */
  const casos = [
    ["un coche normal se enseña", {}, null],

    /* ── Lo dañado ──────────────────────────────────────────────────────── */
    ["lo que el anuncio declara dañado, fuera", { is_damaged: true }, "danada"],
    ["pero lo que NO se ha mirado se enseña", { is_damaged: null }, null],
    ["y lo declarado sano también", { is_damaged: false }, null],

    /* ── El año y los kilómetros, que tienen que poder ser verdad ───────── */
    ["matriculado dentro de dos años, fuera", { year: ANIO + 2 }, "anio_imposible"],
    /* Con pocos km: uno del año que viene con 90.000 lo caza km_por_anio,
       y hace bien. */
    ["el año que viene se admite", { year: ANIO + 1, mileage: 5000 }, null],
    ["más kilómetros de los que dan sus años, fuera",
      { year: ANIO, mileage: 200000 }, "km_por_anio"],
    ["sin año no se descarta por esto", { year: null, mileage: 300000 }, null],
    ["sin kilómetros tampoco", { year: ANIO, mileage: null }, null],

    /* ── El precio: bajo no es lo mismo que imposible ───────────────────── */
    ["un Cupra de 2026 con 0 km a 354 EUR no existe",
      { year: ANIO, mileage: 0, price: 354 }, "precio_imposible"],
    ["un coche de 1999 con 450.000 km a 1.000 EUR sí",
      { year: 1999, mileage: 450000, price: 1000 }, null],
    ["y uno de 2007 con 323.000 km a 3.300 EUR también",
      { year: 2007, mileage: 323000, price: 3300 }, null],
    ["diez años bastan aunque haya rodado poco",
      { year: ANIO - 10, mileage: 40000, price: 3000 }, null],
    /*
     * Las dos reglas encajan en vez de contradecirse: los 150.000 km que
     * justifican un precio bajo no se alcanzan legítimamente antes de los
     * tres años, porque el tope por año de vida son 50.000. Un coche de hace
     * dos años con 160.000 km lo caza km_por_anio, y hace bien: 80.000 al año
     * no es normal.
     */
    ["150.000 km bastan sin necesidad de ser viejo",
      { year: ANIO - 4, mileage: 160000, price: 3000 }, null],
    ["pero 160.000 km en dos años es el dato el que está mal",
      { year: ANIO - 2, mileage: 160000, price: 3000 }, "km_por_anio"],
    ["reciente, pocos km y barato: fuera",
      { year: ANIO - 2, mileage: 40000, price: 3000 }, "precio_imposible"],
    ["por debajo de 300 EUR no hay coche que valga",
      { year: 1990, mileage: 400000, price: 100 }, "precio_imposible"],
    ["sin precio, fuera", { price: null }, "precio_imposible"],
    ["por encima de 200.000 EUR, fuera", { price: 250000 }, "precio_alto"],

    /* ── Lo que ya había ─────────────────────────────────────────────────── */
    ["sin foto, fuera", { image_url: "" }, "sin_foto"],
    ["lo que no es un coche, fuera", { es_coche: false }, "no_es_coche"],
    ["kilómetros imposibles, fuera", { mileage: 600000, year: 1995 }, "km_imposible"],
  ];

  console.log("\n  LAS REGLAS DE `visible`, contra coches inventados\n");
  /*
   * El tipo de cada columna, porque los parámetros llegan como texto y las
   * reglas hacen `es_coche IS FALSE` o comparan números. Sin el cast,
   * Postgres corta con «argument of IS FALSE must be type boolean».
   */
  const TIPOS = {
    price: "numeric", year: "int", mileage: "int", image_url: "text",
    es_coche: "boolean", is_damaged: "boolean", color: "text",
    doors: "int", seats: "int",
  };
  const cols = Object.keys(TIPOS);
  for (const [nombre, cambios, esperado] of casos) {
    const o = { ...BUENO, ...cambios };
    const sql = `SELECT (${CASE_MOTIVO}) AS motivo FROM (SELECT `
      + cols.map((k, i) => `$${i + 1}::${TIPOS[k]} AS "${k}"`).join(", ")
      + `, ''::text AS id) o`;
    const r = await c.query(sql, cols.map((k) => o[k]));
    const dio = r.rows[0].motivo;
    comprueba(nombre, dio === esperado, "da " + String(dio) + ", esperaba " + String(esperado));
  }

  /*
   * Y que el orden de los motivos se respete: una oferta con varios defectos
   * guarda el PRIMERO, que es el más informativo. Saber que está duplicada
   * dice más que saber que además no tiene foto.
   */
  console.log("\n  el orden de los motivos");
  const nombres = MOTIVOS.map(([m]) => m);
  comprueba("duplicada va antes que sin_foto",
    nombres.indexOf("duplicada") < nombres.indexOf("sin_foto"),
    nombres.join(" > "));
  comprueba("no_es_coche va antes que cualquier pega de precio",
    nombres.indexOf("no_es_coche") < nombres.indexOf("precio_imposible"));

  console.log("\n  " + (fallos ? fallos + " FALLOS" : "todo en orden") + "\n");
  await c.end();
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
