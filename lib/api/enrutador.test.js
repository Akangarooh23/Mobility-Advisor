"use strict";

/**
 * Lo que tiene que seguir siendo verdad de las tres puertas de entrada.
 *
 * El reparto de rutas estaba escrito tres veces, una por puerta. Al juntarlo en
 * `enrutador.js` lo que hay que fijar no es «que funcione» sino que funcione
 * **igual**: si el `?route=` deja de mandar, o el orden de los alias cambia, o
 * un 404 cambia de texto, deja de funcionar una regla de `vercel.json` y no se
 * entera nadie hasta que un cliente lo cuenta.
 *
 * Y hay una cosa que antes salía gratis y ahora no: cargar los manejadores al
 * arrancar hacía que un fallo de sintaxis en cualquiera de ellos reventase el
 * despliegue. Cargándolos al usarse, ese fallo esperaría a que alguien pidiera
 * esa ruta. Por eso aquí se cargan los 45, y el ruido pasa de producción a las
 * pruebas.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const { creaEnrutador } = require("./enrutador");

const RAIZ = path.join(__dirname, "..", "..");

/** Una petición de mentira, con lo poco que el enrutador mira. */
function peticion({ url = "/api/x", query = {}, method = "GET", headers = {} } = {}) {
  return { url, query, method, headers };
}

/** Una respuesta de mentira que apunta lo que le hacen. */
function respuesta() {
  const r = {
    codigo: null,
    cuerpo: null,
    terminada: false,
    cabeceras: {},
    status(c) { r.codigo = c; return r; },
    json(b) { r.cuerpo = b; return r; },
    end() { r.terminada = true; return r; },
    setHeader(k, v) { r.cabeceras[k] = v; },
  };
  return r;
}

describe("cómo se elige la ruta", () => {
  const enruta = creaEnrutador({
    rutas: {
      uno: () => (req, res) => res.status(200).json({ fue: "uno" }),
      dos: () => (req, res) => res.status(200).json({ fue: "dos" }),
    },
    alias: [["camino-uno", "uno"], ["camino", "dos"]],
    noEncontrada: "no está",
  });

  test("el ?route= explícito manda sobre la URL", async () => {
    // Es lo que usan las 49 reglas de vercel.json: todas reescriben a
    // ?route=algo. Si la URL ganara, una regla podría acabar en otra ruta.
    const res = respuesta();
    await enruta(peticion({ url: "/api/x?camino-uno=1", query: { route: "dos" } }), res);
    assert.deepEqual(res.cuerpo, { fue: "dos" });
  });

  test("y se limpia y se baja a minúsculas, como antes", async () => {
    const res = respuesta();
    await enruta(peticion({ query: { route: "  UNO  " } }), res);
    assert.deepEqual(res.cuerpo, { fue: "uno" });
  });

  test("sin ?route=, gana el primer alias que encaja, por orden", async () => {
    /*
     * El orden no es decorativo: "camino-uno" contiene "camino". Con la lista
     * al revés, /api/camino-uno acabaría en la ruta "dos". En market.js el
     * caso real es import-lead contra import-offers.
     */
    const res = respuesta();
    await enruta(peticion({ url: "/api/camino-uno" }), res);
    assert.deepEqual(res.cuerpo, { fue: "uno" });
  });

  test("y sin nada que encaje, el 404 de esa puerta", async () => {
    const res = respuesta();
    await enruta(peticion({ url: "/api/nada-de-nada" }), res);
    assert.equal(res.codigo, 404);
    assert.deepEqual(res.cuerpo, { error: "no está" });
  });

  test("una ruta que no está en la tabla también es 404, no una excepción", async () => {
    const res = respuesta();
    await enruta(peticion({ query: { route: "inventada" } }), res);
    assert.equal(res.codigo, 404);
  });

  test("y no se cuela una propiedad heredada de Object como ruta", async () => {
    // `rutas["constructor"]` existe en cualquier objeto. Sin comprobarlo, esa
    // petición intentaría llamar al constructor de Object como manejador.
    const res = respuesta();
    await enruta(peticion({ query: { route: "constructor" } }), res);
    assert.equal(res.codigo, 404);
  });
});

describe("lo que se hace antes de repartir", () => {
  test("un preflight se contesta y no llega a ningún manejador", async () => {
    let llegó = false;
    const enruta = creaEnrutador({
      rutas: { uno: () => () => { llegó = true; } },
      noEncontrada: "no está",
    });
    const res = respuesta();
    const salida = await enruta(
      peticion({ method: "OPTIONS", query: { route: "uno" } }),
      res
    );
    assert.equal(res.codigo, 204);
    assert.equal(salida, undefined, "quien llama tiene que terminar ahí");
    assert.equal(llegó, false, "el manejador no debe ejecutarse en un OPTIONS");
  });

  test("el gancho puede cortar antes de despachar", async () => {
    // Es el interruptor de los crons de api/user.js: con CRON_ACTIVO=0 la
    // tarea contesta 204 y no corre.
    let llegó = false;
    const enruta = creaEnrutador({
      rutas: { tarea: () => () => { llegó = true; } },
      noEncontrada: "no está",
      antesDeDespachar: (ruta, req, res) =>
        ruta === "tarea" ? res.status(204).end() : undefined,
    });
    const res = respuesta();
    await enruta(peticion({ query: { route: "tarea" } }), res);
    assert.equal(res.codigo, 204);
    assert.equal(llegó, false);
  });

  test("y si no corta, la petición sigue su camino", async () => {
    let llegó = false;
    const enruta = creaEnrutador({
      rutas: { tarea: () => () => { llegó = true; } },
      noEncontrada: "no está",
      antesDeDespachar: () => undefined,
    });
    await enruta(peticion({ query: { route: "tarea" } }), respuesta());
    assert.equal(llegó, true);
  });
});

describe("las averías se ven al cargar, no al pedir", () => {
  test("un alias que apunta a una ruta inexistente no se admite", () => {
    /*
     * Esta es la avería que tenía api/billing.js: su resolveRoute devolvía
     * "webhook" y el switch no tenía ese caso, así que caía al 404 y parecía
     * una URL mal escrita. Ahora eso no se puede escribir.
     */
    assert.throws(
      () => creaEnrutador({
        rutas: { uno: () => () => {} },
        alias: [["lo-que-sea", "fantasma"]],
        noEncontrada: "no está",
      }),
      /apunta a la ruta "fantasma"/
    );
  });

  test("y una ruta que no devuelve un manejador dice cuál era", async () => {
    const enruta = creaEnrutador({
      rutas: { rota: () => ({ noSoy: "una función" }) },
      noEncontrada: "no está",
    });
    await assert.rejects(
      () => enruta(peticion({ query: { route: "rota" } }), respuesta()),
      /La ruta "rota"/
    );
  });
});

describe("las tres puertas de verdad", () => {
  const PUERTAS = [
    ["api/market.js", "Market route not found", 25],
    /*
     * 21 desde que hay forma de enterarse de un fallo: `error` —los del navegador,
     * que era lo único de lo que no se enteraba nadie— y `cron-avisa-de-los-fallos`
     * —el aviso de que algo se ha roto, una vez por hora y solo de lo nuevo—.
     */
    ["api/user.js", "User route not found", 21],
    ["api/billing.js", "Billing route not found", 5],
  ];

  for (const [fichero, texto404, cuantas] of PUERTAS) {
    test(`${fichero} expone sus rutas y todas cargan`, () => {
      const enruta = require(path.join(RAIZ, fichero));
      const nombres = Object.keys(enruta.rutas);
      assert.equal(
        nombres.length,
        cuantas,
        `${fichero} tenía ${cuantas} rutas. Si has añadido o quitado una, ` +
        "cambia el número aquí a sabiendas: cada una es una regla de vercel.json."
      );

      for (const nombre of nombres) {
        const manejador = enruta.rutas[nombre]();
        assert.equal(
          typeof manejador,
          "function",
          `la ruta "${nombre}" de ${fichero} no carga un manejador`
        );
      }
    });

    test(`${fichero} contesta su propio 404`, async () => {
      const enruta = require(path.join(RAIZ, fichero));
      const res = respuesta();
      await enruta(peticion({ url: "/api/ni-idea", query: { route: "ni-idea" } }), res);
      assert.equal(res.codigo, 404);
      assert.deepEqual(res.cuerpo, { error: texto404 });
    });
  }

  test("y sus alias apuntan todos a rutas que existen", () => {
    for (const [fichero] of PUERTAS) {
      const enruta = require(path.join(RAIZ, fichero));
      for (const [trozo, ruta] of enruta.alias) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(enruta.rutas, ruta),
          `${fichero}: el alias "${trozo}" apunta a "${ruta}", que no existe`
        );
      }
    }
  });
});

describe("cargar la puerta no carga los manejadores", () => {
  /*
   * Es la razón de ser del cambio. api/market.js requería sus 24 manejadores
   * arriba del todo: 311 módulos y 313 ms en cada arranque en frío, aunque la
   * petición fuese a la ruta que solo devuelve una foto.
   *
   * Se mide en un proceso aparte porque require.cache es global y el resto de
   * las pruebas de este fichero ya ha cargado medio repositorio.
   */
  function cargaLimpia(fichero) {
    const guion = `
      require(${JSON.stringify(path.join(RAIZ, fichero))});
      const total = Object.keys(require.cache).length;
      const pesados = Object.keys(require.cache).filter((p) =>
        /billingStore|inventoryStore|pdfkit|pdf-lib|stripe/i.test(p)
      ).length;
      console.log(JSON.stringify({ total, pesados }));
    `;
    return JSON.parse(execFileSync(process.execPath, ["-e", guion], { encoding: "utf8" }));
  }

  test("api/market.js arranca sin arrastrar la mitad del repositorio", () => {
    const { total, pesados } = cargaLimpia("api/market.js");
    assert.equal(pesados, 0, "no debería cargarse ningún almacén ni generador de PDF");
    assert.ok(
      total < 60,
      `cargar la puerta ha traído ${total} módulos; antes eran 311 y el sentido ` +
      "del cambio es que no los traiga. ¿Se ha colado un require estático arriba?"
    );
  });

  test("api/user.js y api/billing.js, igual", () => {
    for (const fichero of ["api/user.js", "api/billing.js"]) {
      const { total, pesados } = cargaLimpia(fichero);
      assert.equal(pesados, 0, `${fichero} arrastra almacenes al arrancar`);
      assert.ok(total < 60, `${fichero} ha traído ${total} módulos al arrancar`);
    }
  });
});
