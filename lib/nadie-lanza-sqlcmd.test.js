"use strict";

/**
 * Que la segunda base de datos, la que ya no se usa, solo pueda menguar.
 *
 * ## Qué había
 *
 * `lib/sqlserverMobilityStore.js`, 2.618 líneas que hablaban con SQL Server
 * **lanzando `sqlcmd.exe` con `execFileSync`** —un proceso externo, de forma
 * bloqueante— desde dentro de una petición, y escribiendo la consulta a un
 * fichero temporal cuando era larga. El escape de valores era
 * `String(v).replace(/'/g, "''")`: concatenación de cadenas.
 *
 * Diecinueve ramas de `billingStore` preguntaban por él antes de ir a Postgres.
 * Ninguna podía ejecutarse:
 *
 *   · `AUTH_PROVIDER=postgres`;
 *   · en la máquina no hay SQL Server instalado ni `sqlcmd` en el PATH;
 *   · en Vercel tampoco existe ese binario;
 *   · y los datos —coches, seguros, tasaciones, mantenimientos, citas y
 *     usuarios— llevan tiempo en Postgres, con filas.
 *
 * El almacén y esas ramas ya no están. Pero quedan cuatro ficheros con código
 * de SQL Server dentro, y uno es `api/auth.js`: el peor sitio del repositorio
 * para equivocarse, porque si se tuerce no entra nadie.
 *
 * ## Qué se fija
 *
 * Que lo que queda **solo baje**. No pone un cero que hoy sería mentira: pone
 * el número de hoy como techo. Quitar código hace que la prueba siga pasando;
 * añadirlo, no.
 *
 * Es deliberado que sea incómodo de subir. Si algún día hay que volver a SQL
 * Server de verdad, esto se borra entero y se escribe por qué — que es una
 * conversación, no un ajuste de un número.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

/**
 * Lo que todavía tiene SQL Server dentro, y cuánto.
 *
 * Para bajar un número: quita el código y baja el número. Medido el 29 de
 * septiembre de 2026, después de borrar el almacén.
 */
const TECHO = new Map([
  [path.join("api", "auth.js"), 3],
  [path.join("api", "vehicle-catalog.js"), 76],
  [path.join("api", "erp-catalog.js"), 69],
  [path.join("lib", "inventoryStore.js"), 13],
]);

const SQL_SERVER = /mssql|Mssql|MSSQL|sqlcmd|Sqlcmd|SQLCMD/g;

function recorre(directorio, encontrados = []) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const completa = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules") continue;
      recorre(completa, encontrados);
      continue;
    }
    if (!entrada.name.endsWith(".js") || entrada.name.endsWith(".test.js")) continue;
    encontrados.push(completa);
  }
  return encontrados;
}

/** Sin comentarios: se cuenta lo que se ejecuta, no lo que se explica. */
function loQueSeEjecuta(completo) {
  return fs
    .readFileSync(completo, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

const ficheros = [...recorre(path.join(RAIZ, "lib")), ...recorre(path.join(RAIZ, "api"))];

describe("el almacén viejo no vuelve", () => {
  test("hay ficheros que revisar", () => {
    // Si el recorrido se rompe, esto pasaría sin mirar nada.
    assert.ok(ficheros.length > 100, `solo he visto ${ficheros.length} ficheros`);
  });

  test("nadie importa sqlserverMobilityStore", () => {
    // Éste sí es un cero de verdad: el fichero ya no existe.
    const culpables = ficheros
      .map((f) => path.relative(RAIZ, f))
      .filter((rel) => /sqlserverMobilityStore/.test(loQueSeEjecuta(path.join(RAIZ, rel))));

    assert.deepEqual(culpables, [], "ese fichero se borró; lo que hacía lo hace Postgres");
  });

  test("y no aparece SQL Server donde no lo había", () => {
    /*
     * Cualquier fichero que no esté en el techo tiene que estar limpio. Así, el
     * código de SQL Server no se puede extender a sitios nuevos mientras se
     * quita de los viejos, que es como estas cosas no terminan nunca.
     */
    const nuevos = ficheros
      .map((f) => path.relative(RAIZ, f))
      .filter((rel) => !TECHO.has(rel))
      .filter((rel) => SQL_SERVER.test(loQueSeEjecuta(path.join(RAIZ, rel))));

    assert.deepEqual(
      nuevos,
      [],
      "la base es Postgres. Si de verdad hace falta SQL Server aquí, esta " +
        "prueba se borra entera y se escribe por qué."
    );
  });
});

describe("y donde queda, solo puede menguar", () => {
  for (const [rel, techo] of TECHO) {
    test(`${rel}: como mucho ${techo}`, () => {
      const completo = path.join(RAIZ, rel);
      assert.ok(fs.existsSync(completo), `ya no existe ${rel}: quítalo del techo`);

      const cuantas = (loQueSeEjecuta(completo).match(SQL_SERVER) || []).length;
      assert.ok(
        cuantas <= techo,
        `${rel} tiene ${cuantas} menciones de SQL Server y el techo es ${techo}. ` +
          "Este número baja, no sube."
      );
    });
  }

  test("y si alguno llega a cero, que se note", () => {
    /*
     * Un techo que ya nadie usa es ruido. Cuando un fichero se quede limpio,
     * esto lo dice para quitarle la línea y cerrar el asunto, en vez de
     * dejarlo ahí para siempre.
     */
    const limpios = [];
    for (const [rel] of TECHO) {
      const completo = path.join(RAIZ, rel);
      if (!fs.existsSync(completo)) continue;
      if ((loQueSeEjecuta(completo).match(SQL_SERVER) || []).length === 0) limpios.push(rel);
    }

    assert.deepEqual(limpios, [], "estos ya están limpios: quítalos del techo de arriba");
  });
});
