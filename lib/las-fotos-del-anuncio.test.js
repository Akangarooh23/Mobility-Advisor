"use strict";

/**
 * Las fotos de un anuncio, leídas del coche y no de cuando se publicó.
 *
 * Al publicar se copiaba la lista de fotos al anuncio y ahí se quedaba. El coche
 * tenía nueve fotos en el ERP y su ficha pública enseñaba tres: las del día que
 * se publicó. Es el mismo fallo que tuvo el precio.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { lasFotosDelAnuncio } = require("./inventoryStore");

const NUEVE = Array.from({ length: 9 }, (_, i) => `https://fotos/${i + 1}.jpg`);
const TRES_VIEJAS = JSON.stringify(NUEVE.slice(0, 3));

describe("un coche de garaje", () => {
  test("enseña las fotos que tiene ahora, no las del día que se publicó", () => {
    const fotos = lasFotosDelAnuncio({ fotos_vivas: NUEVE, image_urls: TRES_VIEJAS, image_url: NUEVE[0] });
    assert.equal(fotos.length, 9);
  });

  test("en el orden en que se subieron", () => {
    // El mismo que usa publicar y el que enseña el ERP.
    const fotos = lasFotosDelAnuncio({ fotos_vivas: NUEVE, image_urls: TRES_VIEJAS, image_url: "" });
    assert.deepEqual(fotos, NUEVE);
  });

  test("con la principal elegida a mano delante, si sigue existiendo", () => {
    // «Hacer principal» es la única decisión sobre las fotos que vive en el
    // anuncio, y no se puede perder por leer las fotos del coche.
    const fotos = lasFotosDelAnuncio({ fotos_vivas: NUEVE, image_urls: TRES_VIEJAS, image_url: NUEVE[5] });
    assert.equal(fotos[0], NUEVE[5]);
    assert.equal(fotos.length, 9, "la principal no se duplica");
  });

  test("y si la principal ya no existe, no se resucita", () => {
    // Una foto borrada no puede seguir saliendo la primera.
    const fotos = lasFotosDelAnuncio({ fotos_vivas: NUEVE, image_urls: TRES_VIEJAS, image_url: "https://fotos/borrada.jpg" });
    assert.equal(fotos[0], NUEVE[0]);
    assert.ok(!fotos.includes("https://fotos/borrada.jpg"));
  });

  test("también cuando la base las devuelve como texto", () => {
    const fotos = lasFotosDelAnuncio({ fotos_vivas: JSON.stringify(NUEVE), image_urls: TRES_VIEJAS });
    assert.equal(fotos.length, 9);
  });
});

describe("un anuncio que no es de garaje", () => {
  test("sigue con su lista de siempre", () => {
    // Concesionarios e importación no tienen fotos en el garaje de nadie.
    const fotos = lasFotosDelAnuncio({ fotos_vivas: null, image_urls: TRES_VIEJAS, image_url: NUEVE[0] });
    assert.equal(fotos.length, 3);
  });

  test("y si su lista está rota, se queda con la principal suelta", () => {
    assert.deepEqual(lasFotosDelAnuncio({ fotos_vivas: null, image_urls: "no es json", image_url: NUEVE[0] }), [NUEVE[0]]);
  });

  test("y sin nada, ninguna", () => {
    assert.deepEqual(lasFotosDelAnuncio({}), []);
  });
});

describe("y la consulta las trae", () => {
  const FUENTE = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");
  const SELECT = FUENTE.slice(
    FUENTE.indexOf("const MARKETPLACE_VO_OFFER_SELECT"),
    FUENTE.indexOf("function mapMarketplaceVoRow"),
  );

  test("solo para los coches de garaje", () => {
    assert.match(SELECT, /CASE WHEN o\.id LIKE 'idcar-%' THEN/);
    assert.match(SELECT, /AS fotos_vivas/);
  });

  test("ordenadas por fecha, no por una columna que no existe", () => {
    /*
     * `sort_order` la crea el ERP la primera vez que alguien reordena, y en
     * producción nadie lo ha hecho: no existe. Usarla aquí rompería la
     * consulta, y con ella **todas** las fichas del marketplace.
     */
    assert.match(SELECT, /ORDER BY f\.created_at, f\.id/);
    assert.doesNotMatch(SELECT, /sort_order/);
  });

  test("y la ficha las usa", () => {
    assert.match(FUENTE, /const fotos = lasFotosDelAnuncio\(row\)/);
    assert.match(FUENTE, /images: fotos,/);
  });
});
