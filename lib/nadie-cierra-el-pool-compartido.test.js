"use strict";

/**
 * Nadie cierra el pool compartido.
 *
 * ## Qué pasaba
 *
 * Ocho manejadores llamaban a `pool.end()` sobre el pool que devuelve
 * `elPool()` —**veintiún sitios**—. Y `elPool()` memoriza ese pool: `pool.end()`
 * no resetea la memoria, así que la siguiente petición de esa misma instancia de
 * Vercel recibía **el pool ya cerrado** y toda consulta fallaba con
 * «Cannot use a pool after calling end on the pool».
 *
 * Reproducido contra la base de verdad:
 *
 *     peticion 1: consulta ok
 *     peticion 1: pool.end() llamado
 *     peticion 2: elPool() devuelve EL MISMO pool cerrado
 *     peticion 2: FALLA -> Cannot use a pool after calling end on the pool
 *
 * ## Por qué no se había notado
 *
 * Porque la base tiene siete usuarios. Con tan poco tráfico, una instancia
 * caliente rara vez recibe otra petición entre el `end()` y su reciclado —y
 * cuando pasa, parece un 500 aleatorio y se echa la culpa a la red.
 *
 * Es el fallo que aparece **el día del lanzamiento**, cuando las instancias
 * empiezan a reutilizarse de verdad: descargar un informe de estado, publicar un
 * coche, pedir una visita o subir un fichero dejaría rota la petición siguiente
 * de esa instancia.
 *
 * ## Lo que ya estaba escrito
 *
 * `lib/postgres.js` tiene `cierraElPool()`, que **sí** resetea la memoria, y su
 * propia documentación dice:
 *
 *   > Una función sin servidor no llama a esto: el proceso muere y se lleva las
 *   > conexiones. Llamarlo ahí dejaría a la siguiente petición de esa misma
 *   > instancia sin pool.
 *
 * O sea: la regla estaba escrita y los ocho manejadores no la seguían, porque
 * llamaban al `end()` del objeto en vez de a la función del módulo. Nada lo
 * impedía. Ahora sí.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/** Los ficheros que se despliegan: nada de `scripts/`, que sí terminan. */
function losDesplegados() {
  const encontrados = [];
  const pendientes = [path.join(RAIZ, "lib"), path.join(RAIZ, "api")];

  while (pendientes.length) {
    const aqui = pendientes.pop();
    if (!fs.existsSync(aqui)) continue;

    for (const entrada of fs.readdirSync(aqui, { withFileTypes: true })) {
      if (entrada.name === "node_modules") continue;
      const completo = path.join(aqui, entrada.name);
      if (entrada.isDirectory()) pendientes.push(completo);
      else if (entrada.name.endsWith(".js") && !entrada.name.endsWith(".test.js")) {
        encontrados.push(completo);
      }
    }
  }

  return encontrados;
}

describe("en lo que se despliega, nadie cierra el pool", () => {
  test("ni un solo `pool.end()`", () => {
    const culpables = [];

    for (const fichero of losDesplegados()) {
      const fuente = fs.readFileSync(fichero, "utf8").replace(/\r\n/g, "\n");
      const veces = (fuente.match(/\.end\(\)/g) || []).length;
      if (!veces) continue;

      /*
       * `lib/postgres.js` es el dueño: dentro de `cierraElPool()` y del cambio de
       * cadena, cerrar es exactamente lo que toca, y ahí sí se resetea la memoria.
       */
      if (path.basename(fichero) === "postgres.js") continue;

      const linea = fuente.split("\n").findIndex((l) => /(pool|Pool)\w*\.end\(\)/.test(l));
      if (linea >= 0) culpables.push(`${path.relative(RAIZ, fichero)}:${linea + 1}`);
    }

    assert.deepEqual(
      culpables,
      [],
      "un manejador cierra el pool compartido: la siguiente peticion de esa\n" +
        "instancia recibira un pool cerrado y fallara. Si de verdad hace falta\n" +
        "cerrar —un guion que termina—, se llama a `cierraElPool()`, que resetea\n" +
        "la memoria."
    );
  });

  test("y nadie recibe el pool solo para cerrarlo", () => {
    /*
     * La forma en que se colaba: `const pool = elPoolObligatorio()` arriba y
     * `await pool.end()` en el `finally`. Sin el segundo, el primero está bien.
     */
    for (const fichero of losDesplegados()) {
      const fuente = fs.readFileSync(fichero, "utf8");
      assert.ok(
        !/finally\s*\{[^}]*\.end\(\)/s.test(fuente),
        `${path.relative(RAIZ, fichero)} cierra el pool en un finally`
      );
    }
  });
});

describe("y el módulo sigue sabiendo cerrarlo bien", () => {
  const POSTGRES = fs.readFileSync(path.join(RAIZ, "lib", "postgres.js"), "utf8");

  test("`cierraElPool` resetea la memoria antes de cerrar", () => {
    /*
     * Éste es el orden que importa: si cerrara primero y reseteara después, una
     * petición que entrara en medio recibiría el pool moribundo.
     */
    const fn = POSTGRES.slice(POSTGRES.indexOf("async function cierraElPool"));
    const resetea = fn.indexOf("_pool = null");
    const cierra = fn.indexOf("viejo.end()");

    assert.ok(resetea > 0 && cierra > 0);
    assert.ok(resetea < cierra, "se cierra antes de resetear la memoria");
  });

  test("y lo exporta, que es lo que hay que usar", () => {
    assert.match(POSTGRES, /module\.exports\s*=\s*\{[^}]*cierraElPool/);
  });
});
