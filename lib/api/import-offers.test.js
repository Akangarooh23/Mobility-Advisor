/**
 * Los filtros de la sección de Importación.
 *
 * Se revisaron porque no funcionaban: el orden por precio no hacía nada —ni se
 * mandaba desde la pantalla ni se leía aquí—, y la horquilla de precio filtraba
 * por el precio del anuncio alemán, que no es el número que el cliente tiene
 * delante. Con la marca no pasaba nada: devolvía cero porque de esa marca no hay
 * ningún coche, y eso se lee como un filtro roto.
 *
 * Lo que se fija aquí es el SQL que sale de cada filtro, sin base de datos: la
 * consulta se intercepta y se mira. Cubre lo que hay que vigilar —que el filtro
 * llegue a la consulta y que ordene y corte por lo que se está viendo—, no el
 * comportamiento de Postgres.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const handler = require("./import-offers-handler.js");

// El mismo que usa el manejador, traído de donde vive: si se copiara aquí, la
// prueba pasaría aunque los dos dejaran de decir lo mismo.
const { sqlPrecioPuestoAqui, FEE_POPCAR_CON_IVA } = require("../coste-importacion.js");
const PUESTO = sqlPrecioPuestoAqui();

/**
 * Pide la lista con unos filtros y devuelve las consultas que ha hecho.
 *
 * Cada llamada se queda con las suyas: los tests de un `describe` corren a la
 * vez, y un array compartido acaba con un test leyendo lo de otro.
 */
async function pide(query = {}, catalogo = []) {
  const capturadas = [];
  const original = Pool.prototype.query;
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    capturadas.push({ sql: t.replace(/\s+/g, " "), params: params || [] });
    // El catálogo de garantías se pide antes que la lista: de él sale cuánto
    // sube el precio publicado, y por tanto por qué se ordena y por dónde corta
    // la horquilla. Sin contestarlo, esto solo vería el caso sin catálogo.
    const esCatalogo = /market_garantias/i.test(t);
    const filas = esCatalogo ? catalogo : (/COUNT\(\*\)/i.test(t) ? [{ total: 0 }] : []);
    const r = { rows: filas, rowCount: filas.length };
    return cb ? cb(null, r) : Promise.resolve(r);
  };
  const res = {
    status() { return res; }, json() { return res; },
    setHeader() { return res; }, end() { return res; },
  };
  try {
    await handler({ method: "GET", headers: {}, query }, res);
  } finally {
    Pool.prototype.query = original;
  }
  const esLista = (c) => /FROM moveadvisor_market_offers/i.test(c.sql)
    && !/COUNT\(\*\)/i.test(c.sql) && !/GROUP BY brand/i.test(c.sql);
  return {
    lista: capturadas.find(esLista),
    total: capturadas.find((c) => /COUNT\(\*\)::int AS total/i.test(c.sql)),
    marcas: capturadas.find((c) => /GROUP BY brand/i.test(c.sql)),
  };
}

describe("el orden de la lista", { concurrency: 1 }, () => {
  test("por defecto manda lo que más compensa", async () => {
    const { lista } = await pide();
    assert.match(lista.sql, /ORDER BY import_score DESC/);
  });

  test("«precio más bajo primero» ordena por el precio que se enseña", async () => {
    const { lista } = await pide({ sort: "price_asc" });
    assert.ok(lista.sql.includes(`ORDER BY ${PUESTO} ASC`), lista.sql);
  });

  test("y el más alto, al revés", async () => {
    const { lista } = await pide({ sort: "price_desc" });
    assert.ok(lista.sql.includes(`ORDER BY ${PUESTO} DESC`), lista.sql);
  });

  test("no se ordena por el precio alemán, que no es el que ve el cliente", async () => {
    const { lista } = await pide({ sort: "price_asc" });
    assert.ok(!/ORDER BY price ASC/.test(lista.sql),
      "el precio de la tarjeta es el puesto aquí: anuncio + coste de traerlo");
  });

  test("el año y los kilómetros también ordenan", async () => {
    assert.match((await pide({ sort: "year_desc" })).lista.sql, /ORDER BY year DESC/);
    assert.match((await pide({ sort: "km_asc" })).lista.sql, /ORDER BY mileage ASC/);
  });

  test("un orden que no existe no rompe nada: se queda el de siempre", async () => {
    const { lista } = await pide({ sort: "lo_que_sea; DROP TABLE" });
    assert.match(lista.sql, /ORDER BY import_score DESC/);
  });
});

describe("la horquilla de precio", { concurrency: 1 }, () => {
  test("corta por el precio puesto aquí, que es el de la tarjeta", async () => {
    const { lista } = await pide({ maxPrice: "15000" });
    assert.ok(lista.sql.includes(`${PUESTO} <=`),
      "«hasta 15.000» tiene que dejar fuera lo que se enseña por encima de 15.000");
    assert.ok(lista.params.includes(15000));
  });

  test("no corta por el precio del anuncio alemán", async () => {
    const { lista } = await pide({ minPrice: "5000" });
    assert.ok(!/AND price >= /.test(lista.sql), lista.sql);
    assert.ok(lista.sql.includes(`${PUESTO} >=`));
  });
});

describe("los filtros llegan a la consulta", { concurrency: 1 }, () => {
  const casos = [
    ["marca",       { brand: "SEAT" },              /lower\(COALESCE\(brand/,        "seat"],
    ["modelo",      { model: "Arona" },             /lower\(COALESCE\(model/,        "arona"],
    ["año mínimo",  { minYear: "2018" },            /year >=/,                       2018],
    ["año máximo",  { maxYear: "2020" },            /year <=/,                       2020],
    ["kilómetros",  { maxMileage: "80000" },        /mileage <=/,                    80000],
    ["combustible", { fuel: "diesel" },             /fuel/i,                         "diesel"],
    ["color",       { color: "azul" },              /lower\(color\)/,                "azul"],
    ["cambio",      { transmission: "automatico" }, /lower\(COALESCE\(transmission/, "automatico"],
  ];
  for (const [nombre, filtro, enSql, valor] of casos) {
    test(nombre, async () => {
      const { lista } = await pide(filtro);
      assert.match(lista.sql, enSql);
      assert.ok(
        lista.params.some((p) => String(p).toLowerCase().includes(String(valor).toLowerCase())),
        `el valor no llega a la consulta: ${JSON.stringify(lista.params)}`
      );
    });
  }

  test("la cilindrada acota por rangos", async () => {
    const { lista } = await pide({ displacement: "1200_1600" });
    assert.match(lista.sql, /> 1200 AND .* <= 1600/);
  });

  test("el buscador mira título, marca y modelo", async () => {
    const { lista } = await pide({ query: "arona" });
    assert.match(lista.sql, /title.*OR.*brand.*OR.*model/i);
  });

  test("sin filtros no se inventa ninguna condición", async () => {
    const { lista } = await pide();
    assert.ok(!/lower\(COALESCE\(brand/.test(lista.sql));
  });

  test("el total cuenta lo mismo que se lista", async () => {
    const { lista, total } = await pide({ brand: "SEAT", maxPrice: "15000" });
    const desdeWhere = (s) => s.slice(s.indexOf("WHERE"));
    assert.equal(desdeWhere(total.sql), desdeWhere(lista.sql).split(" ORDER BY ")[0],
      "si el total se cuenta con otro filtro, la paginación miente");
  });
});

describe("la paginación", { concurrency: 1 }, () => {
  test("el límite y el desplazamiento van como parámetros, no pegados al SQL", async () => {
    const { lista } = await pide({ limit: "24", offset: "48" });
    assert.match(lista.sql, /LIMIT \$\d+ OFFSET \$\d+/,
      "sin el $ delante, el número del hueco se cuela como el límite de verdad");
    assert.ok(lista.params.includes(24) && lista.params.includes(48));
  });

  test("el orden desempata siempre por lo mismo", async () => {
    for (const sort of ["", "price_asc", "price_desc", "year_desc", "km_asc"]) {
      const { lista } = await pide({ sort });
      assert.match(lista.sql, /ORDER BY [^;]*, id ASC/,
        `sin desempate, «ver más» repite coches ya vistos (orden: ${sort || "relevancia"})`);
    }
  });

  test("y con filtros los huecos siguen cuadrando", async () => {
    const { lista } = await pide({ brand: "SEAT", limit: "24", offset: "0" });
    const huecos = (lista.sql.match(/\$(\d+)/g) || []).map((h) => Number(h.slice(1)));
    assert.equal(Math.max(...huecos), lista.params.length);
  });
});

describe("las marcas que se pueden importar", { concurrency: 1 }, () => {
  test("se devuelven, para que el desplegable no ofrezca lo que no hay", async () => {
    const { marcas } = await pide();
    assert.ok(marcas, "sin esta lista, elegir una marca sin coches parece un filtro roto");
    assert.match(marcas.sql, /GROUP BY brand/);
  });

  test("no dependen del filtro puesto: son las que hay en total", async () => {
    const { marcas } = await pide({ brand: "SEAT" });
    assert.ok(!marcas.params.length,
      "si dependieran del filtro, elegir una marca dejaría el desplegable con esa sola");
  });
});

/**
 * Ordenar por lo que se ahorra.
 *
 * Lo pidió Ana: ver primero los coches que más compensan en proporción, no en
 * euros. Se comprueba que el orden llegue a la consulta, que es donde fallaba
 * el de precio antes de arreglarlo.
 */
describe("el orden por ahorro", { concurrency: 1 }, () => {
  test("«mayor ahorro primero» ordena por el porcentaje, no por euros", async () => {
    const { lista } = await pide({ sort: "ahorro_desc" });
    assert.ok(lista, "no se llegó a pedir la lista");
    assert.match(lista.sql, /ORDER BY.*market_price_es.*DESC/i);
    assert.doesNotMatch(lista.sql, /ORDER BY import_margin_pct/i,
      "esa columna la escribe el flujo una vez al día: el orden no cuadraría con los porcentajes que se ven");
  });

  test("y desempata por id, como los demás órdenes", async () => {
    const { lista } = await pide({ sort: "ahorro_desc" });
    assert.match(lista.sql, /id ASC/);
  });

  test("sin pedir orden sigue mandando la relevancia", async () => {
    const { lista } = await pide({});
    assert.match(lista.sql, /import_score DESC/);
  });
});
    // Con los paréntesis: la consulta de la lista lleva «country» dentro, y
    // un «COUNT» a secas la daba por la del recuento.

/**
 * El precio por el que se ordena lleva la garantía dentro.
 *
 * El de la tarjeta la lleva: es la más barata que se le pueda dar a ese coche, y
 * quitarla en la ficha **baja** el total. Si la lista se ordenara por un precio
 * sin ella, «precio más bajo primero» daría un orden que no se corresponde con
 * los números que el cliente está viendo, y eso se lee como un filtro roto.
 *
 * Y no es una cantidad fija: a un coche de quince años no se le puede dar
 * ninguna, así que su precio no sube nada. Por eso va como un CASE y no como un
 * número.
 */
describe("la garantía dentro del precio de la lista", { concurrency: 1 }, () => {
  const CATALOGO = [
    { id: "g12", nombre: "12 meses", nivel: 1, precio: 190, antiguedad_max_anios: 12, km_max_vehiculo: 180000, activo: true },
    { id: "g24", nombre: "24 meses", nivel: 2, precio: 290, antiguedad_max_anios: 10, km_max_vehiculo: 150000, activo: true },
  ];

  test("se ordena por el precio con ella puesta", async () => {
    const { lista } = await pide({ sort: "price_asc" }, CATALOGO);
    assert.match(lista.sql, /ORDER BY \(COALESCE\(price,0\) \+ \d+ \+ \(CASE WHEN/,
      lista.sql);
    assert.ok(lista.sql.includes("THEN 190"), lista.sql);
  });

  test("y la horquilla corta por ese mismo precio", async () => {
    const { lista } = await pide({ maxPrice: "20000" }, CATALOGO);
    assert.ok(/\(CASE WHEN .* THEN 190 .* ELSE 0 END\).*\) <= \$/.test(lista.sql), lista.sql);
    assert.ok(lista.params.includes(20000));
  });

  test("y el ahorro por el que se ordena, también", async () => {
    // Si el precio sube y el ahorro se cuenta sobre el de antes, «mayor ahorro
    // primero» ordena por unos porcentajes que no son los de la pantalla.
    const { lista } = await pide({ sort: "ahorro_desc" }, CATALOGO);
    assert.ok(lista.sql.includes("THEN 190"), lista.sql);
    assert.match(lista.sql, /ORDER BY \(\(COALESCE\(market_price_es,0\)/);
  });

  test("el CASE mira la edad y los kilómetros del coche, no una cifra fija", async () => {
    // Un coche de quince años no lleva garantía dentro y su precio no sube. Con
    // una cantidad fija, la lista le sumaría 190 € que nadie le va a cobrar.
    const { lista } = await pide({ sort: "price_asc" }, CATALOGO);
    assert.ok(lista.sql.includes("year IS NULL"), lista.sql);
    assert.ok(lista.sql.includes("mileage IS NULL"), lista.sql);
    assert.ok(lista.sql.includes("ELSE 0 END"), lista.sql);
  });

  test("sin catálogo cargado no suma nada y la consulta sigue igual", async () => {
    // Mientras no haya productos no se ofrece ninguna, así que no hay nada que
    // sumar. Y esto tiene que seguir funcionando: es el estado de hoy.
    const { lista } = await pide({ sort: "price_asc" }, []);
    // El hueco de la garantía es un cero pelado, no un CASE. El CASE que sí
    // hay es el de la banda del impuesto, que no depende del catálogo.
    assert.ok(lista.sql.includes(`+ ${FEE_POPCAR_CON_IVA} + 0 +`), lista.sql);
    assert.ok(lista.sql.includes(`ORDER BY ${PUESTO} ASC`), lista.sql);
  });

  test("el catálogo se pide antes que la lista, o no podría entrar en ella", async () => {
    const capturadas = [];
    const original = Pool.prototype.query;
    Pool.prototype.query = function (sql, params, cb) {
      const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
      capturadas.push(t);
      const filas = /market_garantias/i.test(t) ? CATALOGO
        : (/COUNT\(\*\)/i.test(t) ? [{ total: 0 }] : []);
      const r = { rows: filas, rowCount: filas.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    const res = { status() { return res; }, json() { return res; }, setHeader() { return res; }, end() { return res; } };
    try {
      await handler({ method: "GET", headers: {}, query: { sort: "price_asc" } }, res);
    } finally {
      Pool.prototype.query = original;
    }
    const iCat = capturadas.findIndex((t) => /market_garantias/i.test(t));
    const iLista = capturadas.findIndex((t) => /FROM moveadvisor_market_offers/i.test(t) && !/COUNT\(\*\)/i.test(t));
    assert.ok(iCat >= 0 && iLista >= 0, JSON.stringify(capturadas.map((t) => t.slice(0, 40))));
    assert.ok(iCat < iLista, "el catálogo tiene que ir primero");
  });
});
