"use strict";

/**
 * Un coche, una ficha.
 *
 * El mismo coche tenía dos: la `user_<coche>`, montada al vuelo desde el garaje,
 * y la `idcar-<coche>`, el anuncio que publica el ERP. Salían las dos en el
 * listado de particulares, y no decían lo mismo: la cilindrada corregida desde
 * el ERP llegaba a una y el enlace de la otra seguía con «—». Además las visitas
 * se pedían contra un anuncio distinto del que tiene las franjas del encargo.
 *
 * Se comprueba sobre la fuente: probarlo de verdad pide dos tablas y un coche
 * publicado, y lo que se protege es la regla.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8").replace(/\r\n/g, "\n");
const LISTADO = FUENTE.slice(FUENTE.indexOf("async function listUserPublishedVehiclesForMarketplace"));
const POR_ID = FUENTE.slice(FUENTE.indexOf("async function getMarketplaceVoOfferById"));

describe("el listado de particulares", () => {
  test("no repite un coche que ya tiene su anuncio idcar-, esté activo o no", () => {
    const trozo = LISTADO.slice(0, 1500);
    assert.match(trozo, /NOT EXISTS \(\s*SELECT 1 FROM moveadvisor_marketplace_vo_offers mp\s*WHERE mp\.id = 'idcar-' \|\| v\.id::text\s*\)/);
    assert.doesNotMatch(trozo, /mp\.is_active = FALSE/);
  });

  test("y de los del garaje enseña la cilindrada, no un cero fijo", () => {
    assert.match(LISTADO, /to_jsonb\(v\)->>'displacement' AS displacement/);
    assert.doesNotMatch(LISTADO.slice(0, 6000), /displacement: 0,/);
  });

  test("con el cambio y el combustible como se leen", () => {
    assert.match(LISTADO, /transmission: comoSeLeeElCambio\(row\.transmission_type\)/);
    assert.match(LISTADO, /fuel: comoSeLeeElCombustible\(row\.fuel\)/);
  });
});

describe("un enlace user_ a un coche publicado", () => {
  test("abre su anuncio idcar-", () => {
    const trozo = POR_ID.slice(0, 2500);
    const busca = trozo.indexOf("[`idcar-${vehiculo}`]");
    const garaje = trozo.indexOf("listUserPublishedVehiclesForMarketplace({})");
    assert.ok(busca > 0, "no busca el anuncio idcar-");
    assert.ok(garaje > busca, "mira el garaje antes que el anuncio publicado");
  });
});
