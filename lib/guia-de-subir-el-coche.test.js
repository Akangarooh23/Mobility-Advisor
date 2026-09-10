"use strict";

/**
 * La guia que se descarga el cliente.
 *
 * Quien la lee no es de la casa: es alguien que ha dicho que si y ahora tiene
 * que reunir cinco cosas en su cuenta sin nadie al lado. Si se atasca no abre
 * un ticket, lo deja.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const TEXTO = leer("src/utils/comoSubirTuCoche.js");
const DOC = leer("src/utils/guiaDescargable.js");
const PAGINA = leer("src/pages/ComoSubirTuCochePage.js");
const APP = leer("src/App.js");

describe("el texto vive en un solo sitio", () => {
  test("la pagina y el fichero leen la misma fuente", () => {
    /*
     * Son dos sitios que enseñan la misma guia. Escrita dos veces, una de las
     * dos se queda vieja — y la que se queda vieja es siempre la que no se
     * mira, que es justo la que se descarga el cliente.
     */
    assert.match(PAGINA, /from "\.\.\/utils\/comoSubirTuCoche"/);
    assert.match(DOC, /from "\.\/comoSubirTuCoche"/);
  });

  test("y ninguna de las dos reescribe los pasos", () => {
    for (const fuente of [PAGINA, DOC]) {
      assert.match(fuente, /PASOS/);
      assert.ok(!/Da de alta tu coche/.test(fuente), "un paso escrito a mano fuera de la fuente");
    }
  });
});

describe("los cinco pasos", () => {
  test("son las cinco puertas del encargo, en orden", () => {
    // El coche primero, porque todo lo demas cuelga de el. Las franjas al
    // final, porque son lo unico que caduca.
    for (const cosa of [/da de alta tu coche/i, /sube los papeles/i, /tasación gratuita/i,
                        /informe de estado/i, /cuándo puedes enseñarlo/i]) {
      assert.match(TEXTO, cosa);
    }
  });

  test("cada uno dice donde se hace", () => {
    // Lo primero que busca quien tiene el panel abierto.
    const dondes = [...TEXTO.matchAll(/donde:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.equal(dondes.length, 5, "algun paso no dice donde se hace");
    for (const d of dondes) assert.match(d, /Mi panel/);
  });

  test("y cada uno dice POR QUE", () => {
    /*
     * Es la diferencia entre una orden y una razon. «Sube seis fotos» se cumple
     * a medias; sabiendo que esas fotos son el anuncio, se cumple bien — y esas
     * fotos son lo que va a ver el comprador.
     */
    const porques = [...TEXTO.matchAll(/porque:\s*\n?\s*"/g)];
    assert.equal(porques.length, 5, "algun paso no dice por que");
  });
});

describe("el fichero que se descarga", () => {
  test("Word tiene que saber en que juego de caracteres viene", () => {
    // Sin esto una guia llena de «matricula» y «tecnica» sale rota en la
    // primera linea.
    assert.match(DOC, /<meta charset="utf-8">/);
    assert.match(DOC, /new Blob\(\["\uFEFF"/);
  });

  test("y nada del texto se cuela como etiqueta", () => {
    assert.match(DOC, /function escapa\(texto\)/);
    assert.match(DOC, /escapa\(p\.titulo\)/);
  });

  test("se llama por su nombre, no «documento1»", () => {
    assert.match(DOC, /a\.download = "como-subir-tu-coche\.doc"/);
  });
});

describe("como se llega", () => {
  test("tiene su direccion, sin sesion", () => {
    /*
     * Se llega desde un correo. Pedirle que entre para leer una guia de como
     * entrar no tendria ninguna gracia.
     */
    assert.match(APP, /window\.location\.pathname === "\/como-subir-tu-coche"/);
  });

  test("y el formulario la enlaza cuando no tiene coches", () => {
    const FORM = leer("src/components/FormularioEncargoVenta.js");
    assert.match(FORM, /href="\/como-subir-tu-coche"/);
  });
});
