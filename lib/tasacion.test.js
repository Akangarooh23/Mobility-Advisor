"use strict";

/**
 * El precio de una tasacion, que es donde se pierde dinero sin enterarse.
 *
 * Un descuadre aqui no rompe nada: cobra de mas o de menos y sigue adelante. Por
 * eso se comprueban los saltos de tramo uno a uno —que es donde se equivoca un
 * `<=` mal puesto— y el caso de cero euros, que no puede llegar a Stripe.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { precioPorUnidad, importe, TRAMOS } = require("./tasacion.js");

describe("el precio por unidad", () => {
  test("una sola cuesta 1,99", () => {
    assert.equal(precioPorUnidad(1), 199);
  });

  test("los saltos de tramo caen donde deben", () => {
    // El limite pertenece al tramo que lo nombra: 4 son 1,79 y 5 ya son 1,59.
    assert.equal(precioPorUnidad(4), 179, "cuatro todavia es el tramo de 1,79");
    assert.equal(precioPorUnidad(5), 159, "cinco ya baja a 1,59");
    assert.equal(precioPorUnidad(9), 159);
    assert.equal(precioPorUnidad(10), 139);
    assert.equal(precioPorUnidad(19), 139);
    assert.equal(precioPorUnidad(20), 119);
    assert.equal(precioPorUnidad(49), 119);
    assert.equal(precioPorUnidad(50), 99);
    assert.equal(precioPorUnidad(99), 99);
  });

  test("a partir de 100 no hay precio: eso lo lleva el equipo comercial", () => {
    assert.equal(precioPorUnidad(100), null);
    assert.equal(precioPorUnidad(500), null);
  });

  test("la curva baja siempre, nunca sube", () => {
    // Un tramo mas caro que el anterior seria un descuento que castiga traer
    // mas coches. No se veria hasta que alguien lo calculara a mano.
    for (let i = 1; i < TRAMOS.length; i++) {
      assert.ok(
        TRAMOS[i].centimos < TRAMOS[i - 1].centimos,
        `el tramo de ${TRAMOS[i].hasta} no es mas barato que el de ${TRAMOS[i - 1].hasta}`,
      );
    }
  });
});

describe("lo que se cobra", () => {
  test("la primera de un cliente nuevo sale a cero", () => {
    const r = importe({ cuantos: 1, conGratuita: true });
    assert.equal(r.gratis, 1);
    assert.equal(r.aCobrar, 0);
    assert.equal(r.totalCentimos, 0, "y con cero no se puede abrir una sesion de Stripe");
  });

  test("la segunda ya se cobra entera", () => {
    const r = importe({ cuantos: 1, conGratuita: false });
    assert.equal(r.aCobrar, 1);
    assert.equal(r.totalCentimos, 199);
  });

  test("en una flota la gratuita descuenta un coche, no el tramo", () => {
    // Cinco coches entran en el tramo de cinco aunque solo se paguen cuatro.
    const r = importe({ cuantos: 5, conGratuita: true });
    assert.equal(r.unidadCentimos, 159, "el tramo se calcula sobre el total");
    assert.equal(r.aCobrar, 4);
    assert.equal(r.totalCentimos, 636);
  });

  test("sin gratuita, la misma flota paga los cinco", () => {
    const r = importe({ cuantos: 5, conGratuita: false });
    assert.equal(r.aCobrar, 5);
    assert.equal(r.totalCentimos, 795);
  });

  test("la gratuita descuenta una vez, no una por coche", () => {
    const r = importe({ cuantos: 50, conGratuita: true });
    assert.equal(r.gratis, 1);
    assert.equal(r.aCobrar, 49);
    assert.equal(r.totalCentimos, 49 * 99);
  });

  test("ningun importe cobrado cae por debajo del minimo de Stripe", () => {
    // Stripe no acepta cobros de menos de 0,50 € en euros. El caso peligroso es
    // el mas barato que se llega a cobrar: dos coches con la gratuita puesta.
    for (let n = 2; n <= 99; n++) {
      const r = importe({ cuantos: n, conGratuita: true });
      assert.ok(
        r.totalCentimos >= 50,
        `con ${n} coches se cobrarian ${r.totalCentimos} centimos, por debajo del minimo`,
      );
    }
  });

  test("una flota de mas de 99 no tiene importe", () => {
    assert.equal(importe({ cuantos: 100, conGratuita: true }), null);
  });
});
