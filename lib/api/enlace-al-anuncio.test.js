/**
 * El enlace a la ficha de un coche.
 *
 * Se escribió porque no llevaba a ningún sitio: ni desde el panel del cliente
 * ni desde el ERP. Todo `/marketplace-vo/<id>` pasa por este manejador —lo
 * reescribe `vercel.json`, también para una persona con un navegador—, y él
 * solo sabía buscar en el marketplace de ocasión. Los coches de importación
 * viven en otra tabla, así que no los encontraba y mandaba al listado: pinchabas
 * «ver el anuncio» y acababas en la lista de coches.
 *
 * Aquí no hay base de datos: se intercepta la consulta y se responde a mano.
 */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

// El manejador coge la función del marketplace al cargarse, así que hay que
// cambiarla antes de pedirlo.
const inventario = require("../inventoryStore.js");
inventario.getMarketplaceVoOfferById = async () => null;

const handler = require("./marketplace-og-handler.js");

const COCHE_ALEMAN = {
  id: "as_1", title: "BMW Serie 3", brand: "BMW", model: "Serie 3",
  year: 2021, mileage: 40000, price: "28000", fuel: "diésel",
  transmission: "automático", color: "gris", power_cv: 190,
  displacement: 1995, image_url: "https://img/1.jpg", images: null,
  url: "https://mobile.de/1", dealer_name: "Autohaus", location: "Baviera",
  market_price_es: 34000, import_comps: 12, import_cost: 3000,
  import_margin: 3000, import_margin_pct: 10, landed_price: 31000,
};

/** Pide la página de un coche con la base contestando lo que se le diga. */
async function pide(id, filas) {
  const original = Pool.prototype.query;
  Pool.prototype.query = async () => ({ rows: filas, rowCount: filas.length });
  try {
    const res = {
      codigo: null, cabeceras: {}, cuerpo: "",
      setHeader(k, v) { this.cabeceras[k] = v; },
      status(c) { this.codigo = c; return this; },
      end(b) { this.cuerpo = b || ""; return this; },
    };
    await handler({ query: { id } }, res);
    return res;
  } finally {
    Pool.prototype.query = original;
  }
}

/** La página que sirve Vercel. En local puede no estar construida. */
const INDEX = path.join(process.cwd(), "build", "index.html");
let laPusimosNosotros = false;

describe("el enlace a la ficha de un coche", { concurrency: 1 }, () => {
  before(() => {
    if (fs.existsSync(INDEX)) return;
    fs.mkdirSync(path.dirname(INDEX), { recursive: true });
    fs.writeFileSync(INDEX, "<!DOCTYPE html><html><head><title>x</title></head><body></body></html>");
    laPusimosNosotros = true;
  });
  after(() => { if (laPusimosNosotros) fs.rmSync(INDEX); });

  test("un coche de importación abre su ficha, no el listado", async () => {
    const res = await pide("as_1", [COCHE_ALEMAN]);
    assert.equal(res.codigo, 200);
    assert.equal(res.cabeceras.Location, undefined,
      "no puede mandar al listado un coche que sí existe");
  });

  test("y la vista previa es la de ese coche", async () => {
    const res = await pide("as_1", [COCHE_ALEMAN]);
    assert.match(res.cuerpo, /BMW Serie 3/);
    assert.match(res.cuerpo, /og:image[^>]*img\/1\.jpg/);
  });

  test("el precio de la vista previa es el del coche puesto aquí", async () => {
    const res = await pide("as_1", [COCHE_ALEMAN]);
    // 31.000, no los 28.000 del anuncio alemán.
    assert.match(res.cuerpo, /31\.000/);
    assert.doesNotMatch(res.cuerpo, /og:title[^>]*28\.000/);
  });

  test("un coche que no está en ninguna tabla deja decidir a la pantalla", async () => {
    const res = await pide("as_no_existe", []);
    assert.equal(res.codigo, 200);
    assert.equal(res.cabeceras.Location, undefined,
      "redirigir al listado es afirmar que ese coche no existe");
  });

  test("sin id sí se va al listado: no hay ficha que enseñar", async () => {
    const res = await pide("", []);
    assert.equal(res.codigo, 302);
    assert.equal(res.cabeceras.Location, "/marketplace-vo");
  });
});
