"use strict";

/**
 * La pantalla de pedir visita, sin cuenta.
 *
 * Antes, quien no había entrado veía un candado y un botón de «iniciar sesión».
 * Alguien que llega de coches.net a ver un coche no se hace una cuenta para
 * mirar tres huecos: ese candado era el final del camino para casi todos.
 *
 * Lo que se comprueba aquí es que al quitarlo no se ha quitado también lo que
 * el candado protegía.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const PICKER = leer("src/components/SlotPicker.js");
const APP = leer("src/App.js");
const CONFIRMAR = leer("src/pages/ConfirmarVisitaPage.js");

describe("el candado ya no está", () => {
  test("sin sesión ya no se manda a iniciar sesión", () => {
    assert.ok(!/Entra para pedir la visita/.test(PICKER), "sigue el muro de la cuenta");
  });

  test("sin sesión se pide por correo, con sesión se reserva", () => {
    assert.match(PICKER, /route: haySesion \? "book" : "solicitar"/);
  });
});

describe("lo que el candado protegía sigue protegido", () => {
  test("con sesión, el correo NO sale del formulario", () => {
    /*
     * Es el agujero entero. Si con sesión se cogiera el del formulario,
     * cualquiera podría escribir otro y hacer que a esa persona le llegaran los
     * correos de una cita que no pidió.
     */
    assert.match(PICKER, /buyerEmail: haySesion \? userEmail : form\.email/);
  });

  test("y el correo solo se pregunta a quien no ha entrado", () => {
    assert.match(PICKER, /\{!haySesion && \([\s\S]{0,900}Tu correo/);
  });

  test("sin correo y sin teléfono no se puede pedir", () => {
    // El correo porque es donde va el enlace que prueba quién es; el teléfono
    // porque al vendedor le prometemos compradores con los que se pueda hablar.
    assert.match(PICKER, /haySesion \|\| \(form\.email\.trim\(\) && form\.phone\.trim\(\)\)/);
  });
});

describe("lo que se le dice al pedirla", () => {
  test("no se le dice que está reservada, porque no lo está", () => {
    /*
     * Si se le diera por hecha, quien no pulsa el enlace se presentaría igual y
     * el vendedor no estaría esperándole. Eso es peor que no decir nada.
     */
    assert.match(PICKER, /Todavía no está reservada/);
    assert.match(PICKER, /Mira tu correo/);
  });

  test("el botón no dice «confirmar» cuando solo se pide", () => {
    assert.match(PICKER, /haySesion \? "Confirmar visita →" : "Pedir la visita →"/);
  });
});

describe("la pregunta de la financiación", () => {
  test("es una casilla y nada más", () => {
    // Nada de datos económicos para ver un coche: este formulario es la boca
    // del embudo y eso espanta a la mitad de la gente.
    assert.match(PICKER, /¿Te interesaría financiarlo\?/);
    assert.match(PICKER, /type="checkbox"/);
    assert.match(PICKER, /quiereFinanciar: form\.quiereFinanciar/);
  });
});

describe("la página del enlace", () => {
  test("está montada en /confirmar-visita", () => {
    assert.match(APP, /window\.location\.pathname === "\/confirmar-visita"/);
  });

  test("confirma una sola vez aunque se abra dos", () => {
    // Algunos clientes de correo abren el enlace solos para previsualizarlo, y
    // en desarrollo React monta dos veces.
    assert.match(CONFIRMAR, /if \(yaFue\.current\) return;/);
  });

  test("que se lo lleve otro no se enseña como un error", () => {
    /*
     * Es la consecuencia de no apartar el hueco, y le va a pasar a gente. Un
     * error rojo ahí es echar a alguien que quería el coche.
     */
    assert.match(CONFIRMAR, /Esa hora ya la ha cogido otro/);
    assert.match(CONFIRMAR, /Elegir otra hora/);
  });

  test("y se dice «pedida», no «confirmada»", () => {
    // Toda visita nace pendiente de que alguien hable con quien tiene el coche.
    assert.match(CONFIRMAR, /Visita pedida/);
    assert.ok(!/>Visita confirmada</.test(CONFIRMAR));
  });
});
