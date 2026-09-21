"use strict";

/**
 * El catálogo de la app: tres fuentes, una lista.
 *
 * Los tres buscadores de verdad tienen sus propias pruebas y su propia base;
 * aquí se les cambia por unos que contestan lo que se les diga, porque lo que
 * hay que proteger es lo de en medio: que se traduzca cada coche a lo mismo,
 * que el orden valga para las tres a la vez, que el mismo coche no salga dos
 * veces y que si una fuente se cae las otras sigan.
 */
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

/** Lo que va a contestar cada fuente en la prueba de turno. */
let respuestas = {};
/** Lo que se le ha pedido a cada una, para comprobar que no se pregunta de más. */
let pedido = {};

function fuenteDeMentira(nombre, clave) {
  const ruta = require.resolve(path.join(__dirname, nombre));
  require.cache[ruta] = {
    id: ruta, filename: ruta, loaded: true,
    exports: async (req, res) => {
      pedido[clave] = req.query;
      const r = respuestas[clave];
      if (r === "se cae") throw new Error("la base no contesta");
      return res.status(200).json(r);
    },
  };
}

fuenteDeMentira("search-offers-handler", "portales");
fuenteDeMentira("marketplace-vo-handler", "popcar");
fuenteDeMentira("import-offers-handler", "importacion");

const handler = require("./app-catalogo-handler.js");

const delPortal = (id, extra = {}) => ({
  id, title: "Fiat 500 Lounge", brand: "Fiat", model: "500", version: "Lounge",
  price: 9500, year: 2019, mileage: 60000, fuel: "Gasolina", transmission: "Manual",
  powerCv: 69, city: "Madrid", province: "Madrid", dealerName: "Ocasión SL",
  image: "https://portal/foto.jpg", images: ["https://portal/foto.jpg"],
  url: "https://portal.es/anuncio/1", portal: "coches.net", ...extra,
});

const delMarketplace = (id, extra = {}) => ({
  id, title: "Fiat 500 Lounge", brand: "Fiat", model: "500",
  price: 10500, year: 2020, mileage: 40000, fuel: "Gasolina", transmission: "Manual",
  power: "69 CV", location: "Zaragoza", seller: "Gamboa", sellerType: "concesionario",
  image: "https://popcar/foto.jpg", images: [], portal: "marketplace-vo",
  availableForPurchase: true, warrantyMonths: 12, hasGuaranteeSeal: true, ...extra,
});

const aleman = (id, extra = {}) => ({
  ...delMarketplace(id), price: 12000, importSavings: 3000, importSavingsPct: 20, ...extra,
});

async function pide(query = {}) {
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; },
  };
  await handler({ method: "GET", query, headers: {} }, res);
  return salida;
}

beforeEach(() => {
  pedido = {};
  respuestas = {
    portales: { ok: true, total: 800, ofertas: [delPortal("p-1")] },
    popcar: { ok: true, totalUniverse: 20, offers: [delMarketplace("idcar-1")] },
    importacion: { ok: true, total: 5, offers: [aleman("de-1")] },
  };
});

describe("los tres botones de la pestaña", () => {
  test("«todo el mercado» pregunta a las tres", async () => {
    const r = await pide({ q: "fiat 500" });
    assert.equal(r.cuerpo.coches.length, 3);
    assert.deepEqual(r.cuerpo.coches.map((c) => c.origen), ["popcar", "importacion", "portal"]);
    assert.equal(r.cuerpo.total, 825);
  });

  test("«marketplace» no pregunta ni a portales ni a importación", async () => {
    const r = await pide({ fuente: "popcar" });
    assert.deepEqual(r.cuerpo.coches.map((c) => c.origen), ["popcar"]);
    assert.equal(pedido.portales, undefined);
    assert.equal(pedido.importacion, undefined);
  });

  test("«importación» solo trae alemanes, con su ahorro", async () => {
    const r = await pide({ fuente: "importacion" });
    assert.deepEqual(r.cuerpo.coches.map((c) => c.origen), ["importacion"]);
    assert.equal(r.cuerpo.coches[0].ahorro, 3000);
    assert.equal(pedido.popcar, undefined);
  });

  test("una fuente inventada no cuela: se trata como «todo»", async () => {
    const r = await pide({ fuente: "lo-que-sea" });
    assert.equal(r.cuerpo.fuente, "todo");
  });
});

describe("el coche se dice igual venga de donde venga", () => {
  test("del portal: con su anuncio original", async () => {
    const c = (await pide({ fuente: "todo" })).cuerpo.coches.find((x) => x.origen === "portal");
    assert.equal(c.titulo, "Fiat 500 Lounge");
    assert.equal(c.precio, 9500);
    assert.equal(c.donde, "Madrid, Madrid");
    assert.equal(c.enlaceOriginal, "https://portal.es/anuncio/1");
  });

  test("del marketplace: sin anuncio ajeno, y con la potencia en número", async () => {
    const c = (await pide({ fuente: "popcar" })).cuerpo.coches[0];
    assert.equal(c.potencia, 69, "«69 CV» tiene que llegar como número");
    assert.equal(c.enlaceOriginal, "");
    assert.equal(c.garantia, 12);
  });
});

describe("el orden vale para las tres a la vez", () => {
  test("por precio, sin importar de dónde venga cada uno", async () => {
    const r = await pide({ orden: "precio_asc" });
    assert.deepEqual(r.cuerpo.coches.map((c) => c.precio), [9500, 10500, 12000]);
  });

  test("y sin orden pedido, primero lo que se puede ir a ver", async () => {
    const r = await pide({});
    assert.equal(r.cuerpo.coches[0].origen, "popcar");
    assert.equal(r.cuerpo.coches.at(-1).origen, "portal");
  });
});

describe("el mismo coche no sale dos veces", () => {
  test("si el concesionario lo anuncia también en un portal, gana el nuestro", async () => {
    // Mismo coche: misma marca, modelo, año, kilómetros y precio.
    respuestas.portales.ofertas = [delPortal("p-2", { year: 2020, mileage: 40000, price: 10500 })];
    const r = await pide({});
    const fiats = r.cuerpo.coches.filter((c) => c.precio === 10500);
    assert.equal(fiats.length, 1);
    assert.equal(fiats[0].origen, "popcar");
  });

  test("dos coches parecidos pero con km distintos siguen siendo dos", async () => {
    respuestas.portales.ofertas = [delPortal("p-3", { year: 2020, mileage: 41000, price: 10500 })];
    assert.equal((await pide({})).cuerpo.coches.length, 3);
  });
});

describe("la paginación", () => {
  test("recorta la página y dice si hay más", async () => {
    const r = await pide({ limit: 2 });
    assert.equal(r.cuerpo.coches.length, 2);
    assert.equal(r.cuerpo.hayMas, true);
  });

  test("y la última página lo dice también", async () => {
    const r = await pide({ limit: 2, offset: 2 });
    assert.equal(r.cuerpo.coches.length, 1);
    assert.equal(r.cuerpo.hayMas, false);
  });

  test("no se le piden a una fuente más de las que caben", async () => {
    await pide({ limit: 48, offset: 0 });
    assert.ok(pedido.portales.limit <= 48, "el buscador de portales tiene tope de 48");
  });
});

describe("si una fuente se cae", () => {
  test("las demás siguen, y se dice cuál ha fallado", async () => {
    respuestas.portales = "se cae";
    const r = await pide({});
    assert.equal(r.codigo, 200);
    assert.deepEqual(r.cuerpo.coches.map((c) => c.origen), ["popcar", "importacion"]);
    assert.equal(r.cuerpo.fuentes.portales, false);
    assert.equal(r.cuerpo.fuentes.popcar, true);
  });

  test("y una que contesta «ok: false» no rompe nada", async () => {
    respuestas.popcar = { ok: false, error: "sin base" };
    const r = await pide({});
    assert.ok(r.cuerpo.coches.every((c) => c.origen !== "popcar"));
  });
});
