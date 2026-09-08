/**
 * El filtro de atipicos protegia el precio y dejaba crudo todo lo demas.
 *
 * El informe de tasacion calcula el precio recomendado como la mediana de los
 * comparables tras quitar los atipicos con la valla de Tukey. Eso estaba bien.
 * Lo que estaba mal es que la valla se aplicaba solo a la **lista de precios**,
 * y las tablas de debajo seguian leyendo la lista entera de ofertas: el precio
 * medio por portal, los anuncios parecidos que se le ensenan al cliente, la
 * tendencia y la regresion de km y ano.
 *
 * Una mediana aguanta un anuncio absurdo; una media no. En la base hay ahora
 * mismo un Hyundai i20 de 2022 a 453.545 euros y un SEAT Leon de 2024 a
 * 247.990: uno solo de esos, en un portal con pocos anuncios, deja la tabla
 * diciendo cifras que no existen.
 *
 * Y el informe se contradecia solo: arriba «187 comparables validos, 3 atipicos
 * excluidos» y dos paginas despues la media de los 190.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { tukeyFence, aggregateByPortal } = require("./inventoryStore");

// ── La valla ────────────────────────────────────────────────────────────────

test("la valla deja fuera el precio absurdo y dentro los normales", () => {
  const precios = [11000, 11500, 12000, 12500, 13000, 247990].sort((a, b) => a - b);
  const { lo, hi } = tukeyFence(precios);
  assert.ok(247990 > hi, "el SEAT Leon a 247.990 tendria que caer fuera");
  for (const p of [11000, 11500, 12000, 12500, 13000]) {
    assert.ok(p >= lo && p <= hi, `${p} tendria que caer dentro`);
  }
});

test("con menos de cuatro precios la valla se abre, no inventa", () => {
  const { lo, hi } = tukeyFence([10000, 12000, 400000]);
  assert.equal(lo, -Infinity);
  assert.equal(hi, Infinity);
});

test("y si todos valen lo mismo tampoco hay valla que poner", () => {
  const { lo, hi } = tukeyFence([12000, 12000, 12000, 12000]);
  assert.equal(lo, -Infinity);
  assert.equal(hi, Infinity);
});

// ── Lo que se le ensena al cliente ──────────────────────────────────────────

const oferta = (portal, price) => ({ portal, price, listedAt: null, updatedAt: null });

test("un solo anuncio absurdo dobla la media de su portal", () => {
  const limpias = [
    oferta("autocasion", 11000),
    oferta("autocasion", 12000),
    oferta("autocasion", 13000),
  ];
  const conElRaro = [...limpias, oferta("autocasion", 247990)];

  const bien = aggregateByPortal(limpias, "venta")[0].avgPrice;
  const mal = aggregateByPortal(conElRaro, "venta")[0].avgPrice;

  assert.equal(bien, 12000);
  assert.ok(mal > 70000, `con el raro dentro la media sale ${mal}`);
  // No es un matiz: es la diferencia entre «12.000 €» y «70.998 €» en la misma
  // tabla, debajo de un precio recomendado que si estaba bien calculado.
});

// ── Que las tablas beban de la lista filtrada, y no de la cruda ─────────────

/**
 * Esto se comprueba sobre el codigo y no ejecutandolo porque la funcion que lo
 * arma, `getMarketPriceSnapshot`, va a la base de datos: para llamarla haria
 * falta un Postgres delante, y entonces la prueba dejaria de correr sola.
 *
 * Lo que se protege es el cableado: que nadie vuelva a pasarle a una tabla del
 * informe el pool sin filtrar. Es exactamente el fallo que hubo.
 */
test("las tablas del informe reciben las ofertas sanas, no el pool crudo", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");

  const debenBeberDeSanos = [
    { que: "la tabla de precio medio por portal", patron: /byPortal:\s*aggregateByPortal\(([A-Za-z]+),/ },
    // Sin el «no precedido de function», el patron casa con la declaracion de
    // la funcion —que empieza por `(offers,`— y no con la llamada de verdad.
    { que: "la regresion de km y ano", patron: /(?<!function )computeUsageImpact\(([A-Za-z]+),/ },
    { que: "la tendencia de precios", patron: /(?<!function )computePriceTrend\(([A-Za-z]+),/ },
    { que: "los anuncios parecidos que se ensenan", patron: /\?\s*\[\.\.\.([A-Za-z]+)\]\.sort/ },
  ];

  for (const { que, patron } of debenBeberDeSanos) {
    const m = fuente.match(patron);
    assert.ok(m, `no encuentro ${que} en inventoryStore.js: esta prueba ya no mira donde debe`);
    assert.equal(
      m[1],
      "sanos",
      `${que} lee «${m[1]}» en vez de «sanos»: vuelve a promediar los anuncios absurdos`
    );
  }
});

test("y el recuento de atipicos excluidos sigue saliendo del pool crudo", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");
  // Si esto tambien se filtrara, el informe diria siempre «0 atipicos
  // excluidos» y nadie se enteraria de que el filtro esta funcionando.
  assert.match(fuente, /rawComparables:\s*rawPrices\.length/);
  assert.match(fuente, /const rawPrices = computeOffers/);
});
