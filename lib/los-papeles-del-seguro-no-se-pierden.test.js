"use strict";

/**
 * Los papeles del seguro y las facturas del taller, que se perdían de dos
 * maneras a la vez.
 *
 * ── Lo que pasó ────────────────────────────────────────────────────────────
 *
 * 1-oct-2026, Opel Corsa 5228HNS. En el cajón privado del almacén estaban la
 * póliza subida tres veces —el mismo PDF a las 10:19, las 10:21 y las 10:37—
 * y las ocho facturas del taller. En la base: cero documentos de seguro, y
 * ocho facturas con medio mega de `file_size` y cero bytes de contenido.
 *
 * Dos averías distintas, y las dos en el mismo sitio:
 *
 *  · Las tablas no tenían `file_url`, así que cuando la app sube el fichero al
 *    almacén y manda su dirección, lo que se guardaba era el nombre y nada
 *    más. Papeles que no se pueden abrir.
 *  · Cada guardado borraba la tabla entera y la reescribía con lo que trajera
 *    la llamada. Como la ficha del seguro se guarda en cuanto hay número de
 *    póliza, cualquier guardado posterior del coche se llevaba los papeles por
 *    delante.
 *
 * Por eso el cliente subió su póliza tres veces: la pantalla seguía diciendo
 * que no estaba.
 *
 * Estas pruebas van contra la función de verdad con un `pool` de mentira, que
 * es lo más cerca de la base a lo que se puede llegar sin una.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { guardaLosPapelesDeLaFicha } = require("./billingStore");
const { declaraColumna } = require("./lo-que-declaran-las-migraciones");

/** Un pool que apunta lo que le piden y contesta lo que se le diga. */
function poolDeMentira(filas = []) {
  const hechas = [];
  return {
    hechas,
    borrados: () => hechas.filter((h) => /^DELETE/.test(h.sql)),
    insertados: () => hechas.filter((h) => /^INSERT/.test(h.sql)),
    query: async (sql, params) => {
      const limpio = String(sql).trim();
      hechas.push({ sql: limpio, params });
      // La pregunta del andamio: si la columna `file_url` existe ya. Aquí sí,
      // que es el caso que se quiere probar; sin ella no se guarda nada a
      // propósito, y eso se cuenta en la migración 0021.
      if (limpio.includes("information_schema.columns")) return { rows: [{ n: 2 }] };
      return /^SELECT/.test(limpio) ? { rows: filas } : { rows: [] };
    },
  };
}

const guarda = (pool, papeles) =>
  guardaLosPapelesDeLaFicha(pool, {
    tabla: "moveadvisor_user_insurance_documents",
    columnaPadre: "insurance_id",
    fichaId: "ins-coche-1",
    vehicleId: "coche-1",
    placa: "5228HNS",
    tipo: "insurance",
    carpeta: "insurance",
    papeles,
    nowIso: "2026-10-01T12:00:00.000Z",
  });

const POLIZA = {
  name: "0101_CP_1565172.pdf",
  size: 120000,
  mimeType: "application/pdf",
  contentBase64: "",
  url: "erp-documentos/vehicles/coche-1/insurance/1790851071406_poliza.pdf",
};

describe("guardar los papeles de una ficha", () => {
  test("el papel que llega con dirección se guarda con ella", async () => {
    const pool = poolDeMentira([]);
    await guarda(pool, [POLIZA]);

    const insertados = pool.insertados();
    assert.equal(insertados.length, 1);
    assert.match(insertados[0].sql, /file_url/, "la fila tiene que llevar la dirección del fichero");
    assert.equal(
      insertados[0].params[5],
      POLIZA.url,
      "sin esto la fila es un nombre y un tamaño, y el papel no se puede abrir"
    );
    // Y el contenido no se duplica: el fichero ya está en el almacén.
    assert.equal(insertados[0].params[4], "");
  });

  test("y se le pone nuestro nombre, para que la lista se lea", async () => {
    const pool = poolDeMentira([]);
    await guarda(pool, [POLIZA]);
    // «0101_CP_1565172» no dice nada -dos letras y números-, así que no se
    // arrastra detrás: lo decide `comoSeLlamaElPapel`, y aquí solo se
    // comprueba que estos papeles pasan por él como los del coche.
    assert.equal(pool.insertados()[0].params[1], "Seguro · 5228HNS.pdf");
  });

  test("guardar otra cosa del coche no se lleva los papeles por delante", async () => {
    /*
     * El caso exacto del Corsa: la póliza ya guardada, y una llamada que no
     * trae papeles porque venía a cambiar los kilómetros. Antes esto era un
     * `DELETE` de la tabla entera.
     */
    const pool = poolDeMentira([{ id: 7, file_url: POLIZA.url }]);
    await guarda(pool, [POLIZA]);

    assert.deepEqual(pool.borrados(), [], "no se borra nada: el papel sigue llegando");
    assert.deepEqual(pool.insertados(), [], "ni se vuelve a escribir el que ya estaba");
  });

  test("pero quitar un papel sí lo borra", async () => {
    const pool = poolDeMentira([{ id: 7, file_url: POLIZA.url }]);
    await guarda(pool, []);

    const borrados = pool.borrados();
    assert.equal(borrados.length, 1);
    assert.deepEqual(borrados[0].params[0], [7]);
  });

  test("las filas viejas sin dirección se rehacen desde lo que llega", async () => {
    // Las del base64 no se pueden emparejar con nada: no tienen por dónde.
    const pool = poolDeMentira([{ id: 3, file_url: "" }]);
    await guarda(pool, [POLIZA]);

    assert.deepEqual(pool.borrados()[0].params[0], [3]);
    assert.equal(pool.insertados().length, 1);
  });

  test("un papel sin nombre no se guarda", async () => {
    const pool = poolDeMentira([]);
    await guarda(pool, [{ name: "", url: "loquesea" }]);
    assert.deepEqual(pool.insertados(), []);
  });
});

describe("la columna existe de verdad", () => {
  /*
   * No vale con que el código la escriba: `file_url` tiene que estar declarada
   * en las migraciones, o en una base al día no existe y el guardado entero se
   * cae. Y se cae en silencio, porque quien lo llama se traga el error y tira
   * del almacén de fichero.
   */
  for (const tabla of [
    "moveadvisor_user_insurance_documents",
    "moveadvisor_user_maintenance_invoices",
  ]) {
    test(`${tabla}.file_url la declara una migración`, () => {
      assert.ok(declaraColumna(tabla, "file_url"), `nadie declara ${tabla}.file_url`);
    });
  }
});

describe("mientras la columna no exista", () => {
  /*
   * El andamio de la migración 0021, que se puede quitar cuando esté aplicada
   * en todas las bases.
   *
   * El código se despliega al empujar a `main` y la migración la lanza una
   * persona, así que puede llegar primero el código. Entonces esto no toca
   * nada: no borra, no escribe y lo dice por consola. Perder un papel recién
   * subido se arregla volviéndolo a subir; borrar los que había, no.
   */
  test("no se borra nada", async () => {
    // Un módulo nuevo, porque la respuesta se recuerda para no preguntarla en
    // cada lectura.
    delete require.cache[require.resolve("./billingStore")];
    const { guardaLosPapelesDeLaFicha: sinColumna } = require("./billingStore");

    const hechas = [];
    const pool = {
      query: async (sql) => {
        hechas.push(String(sql).trim());
        return { rows: [{ n: 0 }] };
      },
    };

    const antes = console.warn;
    console.warn = () => {};
    try {
      await sinColumna(pool, {
        tabla: "moveadvisor_user_insurance_documents",
        columnaPadre: "insurance_id",
        fichaId: "ins-coche-1",
        vehicleId: "coche-1",
        placa: "5228HNS",
        tipo: "insurance",
        carpeta: "insurance",
        papeles: [POLIZA],
        nowIso: "2026-10-01T12:00:00.000Z",
      });
    } finally {
      console.warn = antes;
    }

    assert.deepEqual(
      hechas.filter((s) => /^(DELETE|INSERT)/.test(s)),
      [],
      "sin la columna no se puede guardar, pero tampoco se puede borrar lo que había"
    );
  });
});
