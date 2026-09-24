/**
 * El buscador de coches no recorre el pool entero en cada clic.
 *
 * ## Lo que pasaba
 *
 * El pool son 2.359.000 ofertas y 4,3 GB, y la pantalla hacía cuatro consultas
 * que lo recorrían de punta a punta. Medido contra producción:
 *
 *     el desplegable de marcas                41 s
 *     los modelos de una marca                12 s
 *     combustible / cambio / carrocería...     8-15 s cada uno
 *     el listado de la primera página         16 s
 *     contar cuántas ofertas cumplen          15 s
 *
 * Y las cuatro se repetían enteras al tocar cualquier filtro, incluido el
 * orden: cambiar de «más recientes» a «precio de menor a mayor» volvía a pedir
 * las 472 marcas. Por eso el desplegable no se abría hasta que cargaba todo.
 *
 * ## Lo que se fija aquí
 *
 * Que las listas salgan de las vistas materializadas y no del pool, que el
 * total se cuente con tope, y que elegir un modelo encuentre **todas** sus
 * grafías: si «A3» no arrastra las 673 formas con la versión pegada que
 * mandaron wallapop y milanuncios, el filtro deja ofertas fuera sin decirlo.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const handler = require("./search-offers-handler.js");

/** Todo el SQL que ha salido hacia la base. */
let consultas = [];

const queryOriginal = Pool.prototype.query;

before(() => {
  Pool.prototype.query = async (sql, params) => {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    consultas.push({ sql: t, params: params || [] });

    // Lo justo para que el manejador siga su camino.
    if (/FROM mmo_modelos/.test(t) && /array_agg\(grafia\)/.test(t)) {
      /*
       * La base mira el WHERE, así que aquí también.
       *
       * La primera versión de esto devolvía las tres grafías dijera lo que
       * dijera la consulta, y entonces la prueba pasaba igual con el arreglo
       * deshecho: se creía el SQL sin leerlo. Preguntar por el modelo limpio
       * trae todas sus formas; preguntar por la grafía exacta trae una.
       */
      const porElModelo = /lower\(modelo\) = lower\(\$1\)/.test(t);
      return {
        rows: [{
          grafias: porElModelo
            ? ["a3", "a3 sportback 30 tfsi 116cv", "a3 1.6 tdi"]
            : ["a3"],
        }],
      };
    }
    if (/FROM mmo_modelos/.test(t)) {
      return { rows: [{ nombre: "A3", n: 21019 }] };
    }
    if (/FROM mmo_facetas/.test(t)) {
      return { rows: [{ clave: "audi", nombre: "Audi", n: 106858, grafias: ["Audi", "AUDI"], valor: "Audi" }] };
    }
    if (/FROM moveadvisor_brand_aliases/.test(t)) return { rows: [] };
    if (/FROM moveadvisor_vehicle_brands/.test(t) || /FROM moveadvisor_vehicle_models/.test(t)) {
      return { rows: [] };
    }
    if (/unnest\(\$1::text\[\]\)/.test(t)) return { rows: [] };
    if (/SELECT COUNT\(\*\)/.test(t)) return { rows: [{ n: 10001 }] };
    return { rows: [] };
  };
});

after(() => { Pool.prototype.query = queryOriginal; });
beforeEach(() => { consultas = []; });

function unRes() {
  return {
    code: 0, body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function pide(query) {
  const res = unRes();
  await handler({ method: "GET", url: "/api/search-offers?" + query, headers: {} }, res);
  return res;
}

/** El SQL que toca el pool de ofertas, que es el que cuesta dinero. */
const lasQueTocanElPool = () =>
  consultas.filter((c) => /FROM moveadvisor_market_offers/.test(c.sql));

describe("los desplegables no tocan el pool", () => {
  test("las marcas salen de la vista", async () => {
    await pide("facets=brands");

    assert.equal(lasQueTocanElPool().length, 0,
      "el desplegable de marcas vuelve a recorrer los 2,36 millones de ofertas");
    assert.ok(consultas.some((c) => /FROM mmo_facetas/.test(c.sql)));
  });

  test("los modelos, también", async () => {
    await pide("facets=models&brand=Audi");

    assert.equal(lasQueTocanElPool().length, 0);
    assert.ok(consultas.some((c) => /FROM mmo_modelos/.test(c.sql)));
  });

  test("y combustible, cambio, carroceria y provincia", async () => {
    await pide("facets=extra");

    assert.equal(lasQueTocanElPool().length, 0);
    const deLaVista = consultas.filter((c) => /FROM mmo_facetas/.test(c.sql));
    assert.equal(deLaVista.length, 4, "los cuatro desplegables salen de la vista");
  });
});

describe("el desplegable de modelos", () => {
  test("esconde lo que no es un modelo y no pesa nada", async () => {
    /*
     * Wallapop manda un modelo llamado «1.8 TFSI 180CV SLine» y milanuncios uno
     * llamado «.», con una oferta cada uno. Como la lista va alfabética, esos
     * encabezaban el desplegable de Audi por delante del A1.
     */
    await pide("facets=models&brand=Audi");

    const deModelos = consultas.find((c) => /FROM mmo_modelos/.test(c.sql) && /GROUP BY/.test(c.sql));
    assert.match(deModelos.sql, /del_catalogo/, "no distingue lo que pegó con el catálogo");
    assert.match(deModelos.sql, /SUM\(n\) >= 20/, "un modelo inventado con una oferta sigue saliendo");
  });
});

describe("elegir un modelo", () => {
  test("arrastra todas sus grafias, no solo la exacta", async () => {
    await pide("brand=Audi&model=A3&limit=24");

    const grupo = consultas.find((c) => /array_agg\(grafia\)/.test(c.sql));
    assert.ok(grupo, "no se han pedido las grafías del modelo");
    assert.match(grupo.sql, /FROM mmo_modelos/);

    // Y las tres han llegado al filtro del listado.
    const listado = consultas.find((c) => /ORDER BY/.test(c.sql) && /FROM moveadvisor_market_offers/.test(c.sql));
    const conGrafias = listado.params.find((p) => Array.isArray(p) && p.includes("a3 sportback 30 tfsi 116cv"));
    assert.ok(conGrafias, "el filtro busca solo «a3» y deja fuera las 673 formas con la versión pegada");
  });
});

describe("el total", () => {
  test("se cuenta con tope, y se dice que hay mas", async () => {
    /*
     * Contar el millón y medio que cumple «ningún filtro» tardaba quince
     * segundos, y la página no salía hasta tenerlo.
     */
    const res = await pide("limit=24");

    const cuenta = consultas.find((c) => /SELECT COUNT\(\*\)/.test(c.sql));
    assert.match(cuenta.sql, /LIMIT 10001/, "cuenta hasta el final");
    assert.equal(res.body.total, 10000);
    assert.equal(res.body.hayMas, true);
  });

  test("y es exacto cuando cabe por debajo del tope", async () => {
    Pool.prototype.query = async (sql, params) => {
      const t = String(sql || "");
      consultas.push({ sql: t, params: params || [] });
      if (/SELECT COUNT\(\*\)/.test(t)) return { rows: [{ n: 380 }] };
      if (/FROM mmo_/.test(t) || /FROM moveadvisor_/.test(t) || /unnest/.test(t)) return { rows: [] };
      return { rows: [] };
    };

    const res = await pide("brand=Audi&model=A3&province=Madrid&limit=24");

    assert.equal(res.body.total, 380);
    assert.equal(res.body.hayMas, false);
  });
});
