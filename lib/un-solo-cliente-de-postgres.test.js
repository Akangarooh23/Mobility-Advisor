"use strict";

/**
 * Que no vuelva a haber cuarenta y nueve clientes de Postgres.
 *
 * ## Qué pasó
 *
 * Cuarenta y nueve ficheros abrían el suyo, con veintiséis versiones distintas
 * de la misma función de ocho líneas. Unas con `max: 3`, otras con `max: 5`,
 * la mayoría sin decir nada. Unas verificando el certificado y otras sin
 * mencionarlo. Y siete que devolvían un `Pool` **nuevo en cada llamada**:
 * `lib/viewingStore.js` lo hacía cinco veces por petición.
 *
 * Nada de eso se nota mientras sobran conexiones. Se nota el día que faltan, y
 * ese día no parece lo que es: parece que la base va lenta.
 *
 * ## Por qué una prueba y no una nota
 *
 * Porque la nota no falla. Esto se arregló una vez entero; sin algo que lo
 * vigile, el siguiente manejador que alguien escriba vuelve a copiar el
 * `getPool` del de al lado —es lo natural, está ahí mismo— y nadie se entera
 * hasta que se agotan las conexiones.
 *
 * Es el mismo razonamiento de `comprueba-rutas-api` y de `postgres-ssl.js`.
 *
 * No necesita red ni base de datos: lee los ficheros.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

/**
 * Los tres que pueden, y por qué.
 *
 * Quien añada un cuarto tiene que escribir aquí el motivo. Si el motivo no se
 * puede escribir en una línea, probablemente no lo hay.
 */
const PUEDEN = new Map([
  [path.join("lib", "postgres.js"), "es el módulo compartido: es su trabajo"],
  [
    path.join("lib", "api", "billing-ping-handler.js"),
    "la sonda de salud necesita su propia conexión para no esperar en la cola " +
      "del pool compartido justo el día que el pool está lleno",
  ],
  [
    path.join("lib", "inventoryStore.js"),
    "también lee la cadena del fichero .env local, de lo que viven los guiones " +
      "de scripts/; el módulo compartido solo mira el entorno, a propósito",
  ],
]);

function recorre(directorio, encontrados = []) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const completa = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules") continue;
      recorre(completa, encontrados);
      continue;
    }
    if (!entrada.name.endsWith(".js")) continue;
    // Una prueba puede montar el Pool de mentira que le haga falta.
    if (entrada.name.endsWith(".test.js")) continue;
    encontrados.push(completa);
  }
  return encontrados;
}

/** Las líneas con `new Pool(` que no son un comentario. */
function abrePool(fuente) {
  return fuente
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .some((l) => l.includes("new Pool("));
}

describe("un solo cliente de Postgres", () => {
  const ficheros = [
    ...recorre(path.join(RAIZ, "lib")),
    ...recorre(path.join(RAIZ, "api")),
  ];

  test("hay ficheros que revisar", () => {
    // Si el recorrido se rompe, esta prueba pasaría sin mirar nada.
    assert.ok(ficheros.length > 100, `solo he encontrado ${ficheros.length} ficheros`);
  });

  test("nadie abre el suyo salvo los tres que pueden", () => {
    const intrusos = ficheros
      .map((f) => path.relative(RAIZ, f))
      .filter((rel) => !PUEDEN.has(rel))
      .filter((rel) => abrePool(fs.readFileSync(path.join(RAIZ, rel), "utf8")));

    assert.deepEqual(
      intrusos,
      [],
      "usa lib/postgres.js: elPool() si puedes seguir sin base, " +
        "elPoolObligatorio() si no. Si de verdad hace falta uno propio, " +
        "añádelo a PUEDEN con el motivo escrito."
    );
  });

  test("y los tres que pueden siguen estando", () => {
    /*
     * Al revés también importa: si uno de estos se borra o se renombra y la
     * lista se queda con un nombre muerto, la prueba dejaría de vigilarlo sin
     * decir nada.
     */
    for (const [rel, porque] of PUEDEN) {
      assert.ok(fs.existsSync(path.join(RAIZ, rel)), `ya no existe ${rel}`);
      assert.ok(porque.length > 20, `el motivo de ${rel} no explica nada`);
    }
  });
});

describe("y el módulo compartido ofrece las dos puertas", () => {
  test("elPool y elPoolObligatorio, que no son lo mismo", () => {
    // Los sitios que pueden seguir sin base contestan 503; los que no, se
    // paran. Juntarlas en una obligaría a elegir mal en la mitad.
    const pg = require("./postgres");
    assert.equal(typeof pg.elPool, "function");
    assert.equal(typeof pg.elPoolObligatorio, "function");
    assert.equal(typeof pg.hayBase, "function");
    assert.equal(typeof pg.cierraElPool, "function");
  });
});
