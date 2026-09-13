"use strict";

/**
 * El segundo correo al que nos encarga la venta.
 *
 * El primero es un acuse de recibo —«lo hemos apuntado, te llamamos»— y entre
 * ese correo y la llamada hay horas en las que él ya ha decidido y no sabe qué
 * hacer. Este le dice las cuatro cosas y dónde se hacen.
 *
 * Se comprueba sobre el código, no ejecutándolo: mandar correos de verdad desde
 * una prueba es lo que acaba con clientes recibiendo pruebas.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs
  .readFileSync(path.join(__dirname, "api", "leads-handler.js"), "utf8")
  .replace(/\r\n/g, "\n");

/**
 * Solo el trozo del correo, sin sus comentarios.
 *
 * Los porqués hablan de lo mismo que el texto, así que buscando en el fichero
 * entero la prueba se daría por buena leyendo una explicación en vez de una
 * línea del correo. Ya pasó una vez en este proyecto.
 */
const EL_CORREO = (() => {
  const i = FUENTE.indexOf("const gestionadaHtml = esVentaGestionada");
  const f = FUENTE.indexOf("const results = await Promise.allSettled", i);
  assert.ok(i > 0 && f > i, "no encuentro el correo en el handler");
  return FUENTE.slice(i, f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
})();

describe("le dice las cuatro cosas", () => {
  test("los papeles, y cuáles son", () => {
    assert.match(EL_CORREO, /Los papeles del coche/);
    assert.match(EL_CORREO, /permiso de circulación, la ficha técnica y la última ITV/);
  });

  test("la tasación, y que es gratis", () => {
    assert.match(EL_CORREO, /La tasación/);
    assert.match(EL_CORREO, /Es gratis/);
  });

  test("el informe de estado, y que no pone precio", () => {
    /*
     * Es la frase que no puede faltar. El informe enseña daños; el precio sale
     * de la tasación. Si el correo sugiere que el informe tasa, le estamos
     * prometiendo una valoración que no hace.
     */
    assert.match(EL_CORREO, /El informe de estado/);
    assert.match(EL_CORREO, /no pone precio/);
  });

  test("y el mandato, diciendo que se lo mandamos nosotros", () => {
    /*
     * No se le puede pedir que firme algo que todavía no existe: el mandato
     * nace del encargo, y el encargo se abre después de la llamada. Decirle
     * «firma el mandato» sin mandato es el callejón sin salida de siempre.
     */
    assert.match(EL_CORREO, /El mandato de gestión/);
    assert.match(EL_CORREO, /Te lo mandamos nosotros/);
  });
});

describe("y dónde se hace cada cosa", () => {
  test("lleva a su panel de solicitudes, que es donde está la lista", () => {
    assert.match(EL_CORREO, /\/panel\/solicitudes/);
    assert.match(EL_CORREO, /Mis solicitudes/);
  });

  test("y a la guía entera", () => {
    assert.match(EL_CORREO, /\/como-subir-tu-coche/);
  });
});

describe("lo que promete", () => {
  test("las 24 horas laborables, que es lo que dice la web", () => {
    // Prometer dos horas y llamar al día siguiente es peor que prometer un día
    // y cumplirlo.
    assert.match(EL_CORREO, /24 horas laborables/);
  });

  test("y que no hay compromiso", () => {
    assert.match(EL_CORREO, /Nada de esto es un compromiso|sin compromiso/i);
  });
});

describe("a quién se le manda", () => {
  test("solo al de venta gestionada", () => {
    // A quien pide información sobre un coche ajeno este correo no le dice
    // nada: le estaríamos pidiendo los papeles de un coche que no es suyo.
    assert.match(FUENTE, /const gestionadaHtml = esVentaGestionada \?/);
    assert.match(FUENTE, /gestionadaHtml \? \[fetch/);
  });

  test("y va aparte del acuse de recibo, no dentro", () => {
    /*
     * Mezclarlos convierte un acuse de recibo de tres líneas en una lista de
     * deberes, y de un correo así se lee la primera frase.
     */
    assert.match(FUENTE, /subject: `Lo que necesitamos para vender tu/);
    assert.doesNotMatch(EL_CORREO, /Hemos recibido tu coche/);
  });
});
