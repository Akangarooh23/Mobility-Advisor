"use strict";

/**
 * El esquema lo declaran las migraciones. Nadie más.
 *
 * ## De dónde viene esta prueba
 *
 * Veinticinco ficheros creaban esquema dentro de las peticiones —224
 * sentencias— con `CREATE TABLE IF NOT EXISTS` y `ADD COLUMN IF NOT EXISTS`.
 * Funciona: la primera petición que pasa deja la tabla hecha. El problema es la
 * que **no** pasa, y el que depende de ella.
 *
 * `lib/api/invoice-pdf-handler.js` pedía al leer una factura:
 *
 *     SELECT i.rectifica_numero, i.rectifica_fecha, i.rectifica_motivo, ...
 *
 * Esas tres columnas las creaba `ENSURE_RECTIFICATIVA`, en otro fichero, y a
 * ése solo lo ejecutaba `fianza-devolucion-handler` — que nunca se había
 * ejecutado porque le faltaba una variable de entorno. Contra producción:
 *
 *     column i.rectifica_numero does not exist
 *
 * **Descargar una factura en PDF estaba roto**, y el motivo estaba repartido
 * entre tres ficheros y una variable. Nadie podía verlo leyendo ninguno.
 *
 * ## Qué se fija
 *
 * Que no vuelva a haberlo. Ninguna tabla, columna ni índice se crea desde
 * `lib/` ni desde `api/`: se declaran en `migrations/`, que es lo que se aplica
 * a cualquier entorno y lo que se puede leer entero de una vez.
 *
 * La versión anterior de esta prueba era más floja —admitía el DDL en caliente
 * mientras la tabla estuviera *también* en una migración—. Era el suelo
 * mientras quedaban 224 sentencias por quitar. Ya no quedan.
 *
 * No necesita red ni base de datos: lee los ficheros.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { declaraTabla } = require("./lo-que-declaran-las-migraciones");

const RAIZ = path.join(__dirname, "..");

/**
 * Lo único que puede crear esquema, y por qué.
 *
 * Quien añada algo aquí tiene que escribir el motivo. Si no cabe en una línea,
 * probablemente no lo hay.
 */
const PUEDEN = new Map([
  [
    path.join("lib", "facetas-del-buscador.js"),
    "son vistas materializadas -datos derivados que se reconstruyen desde la " +
      "tabla de ofertas-, y no las crea ninguna petición: solo el cron de las " +
      "facetas y el guion de refrescarlas a mano",
  ],
]);

const DDL = /CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|ADD COLUMN IF NOT EXISTS|CREATE MATERIALIZED VIEW/;

/** Sin comentarios: un ejemplo dentro de un comentario no crea nada. */
function loQueSeEjecuta(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .map((l) => l.replace(/\/\/.*$/, ""));
}

function recorre(directorio, encontrados = []) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const completa = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules") continue;
      recorre(completa, encontrados);
      continue;
    }
    if (!entrada.name.endsWith(".js")) continue;
    // Una prueba puede escribir el SQL que le haga falta: no se despliega.
    if (entrada.name.endsWith(".test.js")) continue;
    encontrados.push(completa);
  }
  return encontrados;
}

describe("nadie crea esquema fuera de migrations/", () => {
  const ficheros = [
    ...recorre(path.join(RAIZ, "lib")),
    ...recorre(path.join(RAIZ, "api")),
  ];

  test("hay ficheros que revisar", () => {
    // Si el recorrido se rompe, esta prueba pasaría sin mirar nada.
    assert.ok(ficheros.length > 100, `solo he encontrado ${ficheros.length} ficheros`);
  });

  test("ni un CREATE TABLE, ni un ALTER, ni un índice", () => {
    const culpables = [];
    for (const completo of ficheros) {
      const rel = path.relative(RAIZ, completo);
      if (PUEDEN.has(rel)) continue;
      const cuantas = loQueSeEjecuta(fs.readFileSync(completo, "utf8")).filter((l) => DDL.test(l)).length;
      if (cuantas) culpables.push(`${rel} (${cuantas})`);
    }

    assert.deepEqual(
      culpables,
      [],
      "el esquema se declara en migrations/ y se aplica con `node scripts/migra.mjs`. " +
        "Una tabla que solo existe si alguien pasa por cierto manejador no existe " +
        "en una base nueva, y quien dependa de ella fallará cuando nadie mire."
    );
  });

  test("y la única excepción sigue siendo la que era", () => {
    /*
     * Al revés también importa: si el fichero se borra o se renombra y la lista
     * se queda con un nombre muerto, la excepción dejaría de vigilarse sin que
     * nadie se entere.
     */
    for (const [rel, porque] of PUEDEN) {
      assert.ok(fs.existsSync(path.join(RAIZ, rel)), `ya no existe ${rel}`);
      assert.ok(porque.length > 30, `el motivo de ${rel} no explica nada`);
    }
  });
});

describe("y lo que el código usa, existe", () => {
  test("las tablas del dominio están declaradas", () => {
    /*
     * Una muestra de las que se usan por todas partes. No es la lista entera a
     * propósito: mantenerla al día sería un trabajo que nadie hace, y basta con
     * que si alguien borra media migración, esto lo diga.
     */
    for (const tabla of [
      "moveadvisor_users",
      "moveadvisor_user_vehicles",
      "moveadvisor_user_invoices",
      "moveadvisor_market_leads",
      "moveadvisor_market_offers",
      "vehicle_visit_bookings",
      "vehicle_visit_requests",
      "erp_appointments",
      "moveadvisor_workshop_reservations",
      "moveadvisor_user_saved_comparisons",
      "moveadvisor_user_preferences",
    ]) {
      assert.ok(declaraTabla(tabla), `migrations/ no declara ${tabla}`);
    }
  });
});
