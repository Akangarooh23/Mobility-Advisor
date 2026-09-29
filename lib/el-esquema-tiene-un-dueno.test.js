"use strict";

/**
 * Que ninguna tabla exista solo porque alguien pasó por el sitio que la crea.
 *
 * ## Qué pasó
 *
 * Veinticinco ficheros crean esquema dentro de las peticiones. Funciona: la
 * primera petición que pasa deja la tabla hecha. El problema es la que **no**
 * pasa, y el que depende de ella.
 *
 * `lib/api/invoice-pdf-handler.js` pedía al leer una factura:
 *
 *     SELECT i.rectifica_numero, i.rectifica_fecha, i.rectifica_motivo, ...
 *
 * Esas tres columnas las crea `ENSURE_RECTIFICATIVA`, en otro fichero, y a ése
 * solo lo ejecuta `fianza-devolucion-handler` — que hasta el 24 de septiembre
 * de 2026 no se había ejecutado nunca porque le faltaba una variable de
 * entorno. Así que las columnas no existían, y la consulta contra producción
 * contestaba, literalmente:
 *
 *     column i.rectifica_numero does not exist
 *
 * O sea: **descargar una factura en PDF estaba roto**, y el motivo estaba
 * repartido entre tres ficheros y una variable de entorno. Nadie podía verlo
 * leyendo ninguno de los tres.
 *
 * ## Qué se fija aquí
 *
 * Que toda tabla que el código cree en caliente esté **también** declarada en
 * `migrations/`. Mientras eso se cumpla, el esquema tiene un dueño —las
 * migraciones— y el DDL de las peticiones es a lo sumo redundante, nunca la
 * única forma de que algo exista.
 *
 * Lo ideal sería que no hubiera DDL en las peticiones en absoluto. Eso es un
 * trabajo aparte y más largo; esto es el suelo por debajo del cual no se baja
 * mientras tanto.
 *
 * No necesita red ni base de datos: lee los ficheros.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

/** Sin comentarios: un ejemplo dentro de un comentario no crea nada. */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
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
    if (entrada.name.endsWith(".test.js")) continue;
    encontrados.push(completa);
  }
  return encontrados;
}

/** Lo que el código crea en caliente: tabla -> ficheros que la crean. */
function loQueSeCreaEnCaliente() {
  const tablas = new Map();
  for (const completo of [
    ...recorre(path.join(RAIZ, "lib")),
    ...recorre(path.join(RAIZ, "api")),
  ]) {
    const fuente = sinComentarios(fs.readFileSync(completo, "utf8"));
    for (const m of fuente.matchAll(/CREATE TABLE IF NOT EXISTS\s+([A-Za-z_][\w]*)/gi)) {
      const nombre = m[1].toLowerCase();
      if (!tablas.has(nombre)) tablas.set(nombre, []);
      tablas.get(nombre).push(path.relative(RAIZ, completo));
    }
  }
  return tablas;
}

/** Lo que declaran las migraciones. */
function loQueDeclaranLasMigraciones() {
  const sql = fs
    .readdirSync(path.join(RAIZ, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => fs.readFileSync(path.join(RAIZ, "migrations", f), "utf8"))
    .join("\n")
    .replace(/^--.*$/gm, "");

  return {
    tablas: new Set(
      [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([A-Za-z_][\w]*)"?/gi)]
        .map((m) => m[1].toLowerCase())
    ),
    texto: sql.toLowerCase(),
  };
}

describe("el esquema tiene un dueño, y son las migraciones", () => {
  const enCaliente = loQueSeCreaEnCaliente();
  const migraciones = loQueDeclaranLasMigraciones();

  test("hay algo que revisar", () => {
    // Si el recorrido o la expresión se rompen, esto pasaría sin mirar nada.
    assert.ok(enCaliente.size > 20, `solo he visto ${enCaliente.size} tablas en caliente`);
    assert.ok(migraciones.tablas.size > 50, `solo he visto ${migraciones.tablas.size} en migrations/`);
  });

  test("toda tabla creada en una petición está declarada en migrations/", () => {
    const huerfanas = [...enCaliente.keys()]
      .filter((t) => !migraciones.tablas.has(t))
      .map((t) => `${t}  (la crea ${enCaliente.get(t).join(", ")})`);

    assert.deepEqual(
      huerfanas,
      [],
      "una tabla que solo existe si alguien pasa por su manejador no existe " +
        "en una base nueva, y el que dependa de ella fallará cuando nadie " +
        "esté mirando. Declárala en migrations/."
    );
  });

  test("y las columnas que se añaden sobre la marcha, también", () => {
    /*
     * Ésta es la que habría cazado lo de la factura: `rectifica_numero` se
     * añadía con un ALTER en series-de-factura.js y no estaba en ninguna
     * migración, así que solo existía si alguien devolvía una fianza.
     *
     * Se comprueba por nombre y no por tabla porque en las migraciones las
     * columnas viven dentro del cuerpo de un CREATE TABLE: buscar el nombre
     * es suficiente para saber que alguien las declaró a propósito.
     */
    const sueltas = [];
    for (const completo of [
      ...recorre(path.join(RAIZ, "lib")),
      ...recorre(path.join(RAIZ, "api")),
    ]) {
      const fuente = sinComentarios(fs.readFileSync(completo, "utf8"));
      for (const m of fuente.matchAll(/ADD COLUMN IF NOT EXISTS\s+([A-Za-z_][\w]*)/gi)) {
        const columna = m[1].toLowerCase();
        if (!new RegExp(`\\b${columna}\\b`).test(migraciones.texto)) {
          sueltas.push(`${columna}  (la añade ${path.relative(RAIZ, completo)})`);
        }
      }
    }

    assert.deepEqual(
      sueltas,
      [],
      "una columna que solo se crea al pasar por cierto sitio deja rota a " +
        "cualquier consulta que la pida por otro camino. Declárala en migrations/."
    );
  });
});
