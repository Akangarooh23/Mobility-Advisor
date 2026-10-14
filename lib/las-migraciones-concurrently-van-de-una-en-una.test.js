/**
 * Que una migración se parta por donde hay que partirla.
 *
 * Esto protege dos fallos que no se parecen en nada y acaban igual: una
 * migración aplicada a medias.
 *
 * **El primero ya pasó.** La 0024 crea un índice con `CONCURRENTLY` y tira el
 * viejo: dos sentencias. El aplicador las mandaba juntas, Postgres las envolvía
 * en una transacción implícita —aunque nadie escribiera BEGIN— y rechazaba el
 * CONCURRENTLY con «cannot run inside a transaction block». Un mensaje que
 * habla de una transacción que no existe en el fichero.
 *
 * **El segundo no ha pasado todavía**, y es por lo que partir no es cortar por
 * `;`: un punto y coma dentro de un texto, de un comentario o del cuerpo de
 * una función no separa nada. El día que una migración lleve uno, cortar a lo
 * bruto la parte por la mitad y se aplica el primer trozo. Y como va sin
 * transacción, no hay vuelta atrás.
 */
"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { lasSentencias, vaSinTransaccion, sinElPooler } = require("./las-sentencias-de-una-migracion.js");

describe("partir una migración", () => {
  test("dos sentencias son dos", () => {
    const sql = "CREATE INDEX CONCURRENTLY a ON t (x);\nDROP INDEX CONCURRENTLY b;";
    assert.equal(lasSentencias(sql).length, 2);
  });

  test("la última cuenta aunque no lleve punto y coma", () => {
    // Perderla sería aplicar la migración a medias sin decirlo.
    assert.equal(lasSentencias("SELECT 1; SELECT 2").length, 2);
  });

  test("un comentario suelto no es una sentencia", () => {
    /*
     * Casi toda migración acaba en un comentario o en una línea en blanco.
     * Contarlos engaña al que lee la salida: diría tres de un fichero de dos.
     *
     * El de delante sí se queda pegado a su sentencia, y a propósito: Postgres
     * lo ignora, y si algo falla el error enseña la sentencia **con su
     * explicación encima**, que es justo lo que hace falta para entenderlo.
     */
    const sql = "-- lo que hace\nSELECT 1;\n\n-- y ya está\n";
    const trozos = lasSentencias(sql);
    assert.equal(trozos.length, 1);
    assert.match(trozos[0], /SELECT 1;$/);
    assert.match(trozos[0], /-- lo que hace/);
  });

  test("y un fichero que solo son comentarios no tiene ninguna", () => {
    assert.deepEqual(lasSentencias("-- nada que hacer\n/* de momento */\n"), []);
  });
});

describe("los puntos y coma que no cortan", () => {
  test("el de dentro de un texto", () => {
    const sql = "INSERT INTO t (x) VALUES ('hola; adiós');";
    assert.equal(lasSentencias(sql).length, 1);
  });

  test("y la comilla escapada doblándola", () => {
    const sql = "INSERT INTO t (x) VALUES ('no ''acaba; aquí');";
    assert.equal(lasSentencias(sql).length, 1);
  });

  test("el de dentro de un comentario de línea", () => {
    const sql = "SELECT 1; -- y esto no; es otra\nSELECT 2;";
    assert.equal(lasSentencias(sql).length, 2);
  });

  test("el de dentro de un comentario de bloque anidado", () => {
    // El primer cierre cierra el de dentro: si se buscara el primero, se
    // saldría antes de tiempo y lo de después se tomaría por código.
    const sql = "/* uno /* dos */ sigue dentro; todavía */ SELECT 1;";
    assert.equal(lasSentencias(sql).length, 1);
  });

  test("el del cuerpo de una función entre dólares", () => {
    const sql = "CREATE FUNCTION f() RETURNS void AS $$ BEGIN PERFORM 1; PERFORM 2; END $$ LANGUAGE plpgsql;";
    assert.equal(lasSentencias(sql).length, 1);
  });

  test("y el de un identificador con comillas dobles", () => {
    const sql = 'ALTER TABLE t RENAME COLUMN "raro; nombre" TO normal;';
    assert.equal(lasSentencias(sql).length, 1);
  });
});

describe("cuándo se sale de la transacción", () => {
  test("cuando CONCURRENTLY está en el código", () => {
    assert.equal(vaSinTransaccion("CREATE INDEX CONCURRENTLY a ON t (x);"), true);
  });

  test("pero no cuando solo se menciona al explicarse", () => {
    /*
     * Pasó con la 0020: su comentario decía «con tráfico habría que usar
     * CONCURRENTLY» y el detector la sacó de la transacción. No reventó nada,
     * pero salir de la transacción es perder la vuelta atrás, y eso se paga
     * solo cuando Postgres lo exige.
     */
    assert.equal(vaSinTransaccion("-- con tráfico habría que usar CONCURRENTLY\nCREATE INDEX a ON t (x);"), false);
    assert.equal(vaSinTransaccion("/* ojo: sin CONCURRENTLY bloquea */\nCREATE INDEX a ON t (x);"), false);
  });
});

describe("por dónde se conecta una migración", () => {
  /*
   * El 14-oct-2026 la 0024 salió con un «✓ (203 ms)» y el índice quedó
   * INVÁLIDO: vacío, sin usarlo nadie, y con el viejo ya tirado. La causa es
   * el pooler, que reparte las transacciones entre sesiones distintas y deja
   * a medias un CONCURRENTLY, que necesita todas en la misma.
   */
  test("por el directo, no por el pooler", () => {
    assert.equal(
      sinElPooler("postgresql://u:p@ep-algo-123-pooler.c-3.eu-central-1.aws.neon.tech/db?sslmode=require"),
      "postgresql://u:p@ep-algo-123.c-3.eu-central-1.aws.neon.tech/db?sslmode=require",
    );
  });

  test("y lo que no pasa por pooler se queda igual", () => {
    const u = "postgresql://u:p@localhost:5432/db";
    assert.equal(sinElPooler(u), u);
  });

  test("solo se toca el host, nunca la contraseña", () => {
    /*
     * Una contraseña puede contener cualquier cosa, «-pooler» incluido. Un
     * buscar y reemplazar sobre la cadena entera la rompería, y el fallo
     * sería un «contraseña incorrecta» que no apunta a ningún sitio.
     */
    const u = "postgresql://u:mi-pooler-secreta@ep-algo.c-3.aws.neon.tech/db";
    assert.equal(sinElPooler(u), u);
  });

  test("y una cadena que no es una URL se deja en paz", () => {
    // Postgres también acepta `host=... port=...`. Mejor conectar por donde
    // sea que no conectar: el aviso del índice inválido sigue vigilando.
    const u = "host=localhost port=5432 dbname=db";
    assert.equal(sinElPooler(u), u);
  });
});

describe("la 0024, que es la que lo destapó", () => {
  const fichero = path.join(__dirname, "..", "migrations", "0024-la-pantalla-de-portales-recorria-4-gb.sql");

  test("va sin transacción y son dos sentencias", () => {
    const sql = fs.readFileSync(fichero, "utf8");
    assert.equal(vaSinTransaccion(sql), true);
    assert.equal(lasSentencias(sql).length, 2);
  });

  test("y la 0025, que la repara, tira el roto ANTES de crearlo", () => {
    /*
     * Al revés no haría nada: el `IF NOT EXISTS` vería que ya existe uno con
     * ese nombre —el inválido— y lo daría por hecho. Así es como un fallo así
     * se vuelve permanente y silencioso.
     */
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "migrations", "0025-el-indice-de-portales-quedo-invalido.sql"),
      "utf8",
    );
    const [primera, segunda] = lasSentencias(sql);
    assert.match(primera, /DROP INDEX CONCURRENTLY IF EXISTS ix_market_offers_portal_cubre/i);
    assert.match(segunda, /CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_market_offers_portal_cubre/i);
  });

  test("y las dos son repetibles, que es lo que la hace reintentable", () => {
    /*
     * Sin transacción, si la segunda falla la primera se queda hecha. Que las
     * dos lleven IF NOT EXISTS / IF EXISTS es lo que permite volver a lanzarla
     * sin mirar en qué punto se quedó.
     */
    const [crea, tira] = lasSentencias(fs.readFileSync(fichero, "utf8"));
    assert.match(crea, /IF NOT EXISTS/i);
    assert.match(tira, /IF EXISTS/i);
  });
});
