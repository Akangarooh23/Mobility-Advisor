"use strict";

/**
 * Cómo se llaman los papeles del coche.
 *
 * Lo que se protege: que en la ficha se sepa **qué es cada papel sin abrirlo**,
 * y que siga abriéndose — o sea, que la extensión no se pierda por el camino.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { comoSeLlamaElPapel, laExtension, diceAlgo, yaSeLoPusimos } = require("./como-se-llama-el-papel");

describe("el nombre dice qué es y de qué coche", () => {
  test("la ficha técnica se llama ficha técnica", () => {
    /*
     * Es el caso de Ana: sube `02384u723.pdf` y en la ficha salía eso. Con
     * cinco papeles así no se sabe cuál es cuál sin abrirlos uno a uno.
     */
    assert.equal(
      comoSeLlamaElPapel("technical_sheet", "8888LXR", "02384u723.pdf"),
      "Ficha técnica · 8888LXR.pdf"
    );
  });

  test("y cada tipo tiene el suyo", () => {
    const de = (t) => comoSeLlamaElPapel(t, "8888LXR", "x.pdf");
    assert.match(de("circulation_permit"), /^Permiso de circulación · 8888LXR/);
    assert.match(de("itv"), /^ITV · 8888LXR/);
    assert.match(de("insurance"), /^Seguro · 8888LXR/);
    assert.match(de("mandato_firmado"), /^Mandato firmado · 8888LXR/);
  });

  test("un tipo que no conocemos no se queda sin nombre", () => {
    // Mejor «Documento · 8888LXR» que el identificador del taller.
    assert.match(comoSeLlamaElPapel("lo_que_sea", "8888LXR", "x.pdf"), /^Documento · 8888LXR/);
  });

  test("la matrícula se escribe siempre igual", () => {
    // Quien la copia de un papel se trae los espacios y los guiones.
    for (const escrita of ["8888LXR", "8888 LXR", "8888-lxr"]) {
      assert.match(comoSeLlamaElPapel("itv", escrita, "x.pdf"), /· 8888LXR/);
    }
  });

  test("y sin matrícula no deja un hueco raro", () => {
    assert.equal(comoSeLlamaElPapel("itv", "", "x.pdf"), "ITV.pdf");
    assert.equal(comoSeLlamaElPapel("itv", null, "x.pdf"), "ITV.pdf");
  });
});

describe("la extensión se respeta", () => {
  test("porque es lo que hace que se abra", () => {
    /*
     * Renombrar a secas convierte un PDF en un fichero sin tipo que hay que
     * descargar y adivinar.
     */
    assert.match(comoSeLlamaElPapel("itv", "8888LXR", "algo.pdf"), /\.pdf$/);
    assert.match(comoSeLlamaElPapel("itv", "8888LXR", "foto.JPG"), /\.jpg$/);
    assert.match(comoSeLlamaElPapel("mandato_firmado", "8888LXR", "m.docx"), /\.docx$/);
  });

  test("un punto en mitad del nombre no es una extensión", () => {
    // «factura 26.001 del taller» no acaba en un tipo de fichero.
    assert.equal(laExtension("factura 26.001 del taller"), "");
    assert.equal(laExtension("sin-extension"), "");
    assert.equal(laExtension("acaba en punto."), "");
  });
});

describe("varios del mismo tipo se distinguen", () => {
  test("se numeran a partir del segundo", () => {
    // Tres ITV llamadas igual no se distinguen en la lista.
    assert.match(comoSeLlamaElPapel("itv", "8888LXR", "a.pdf", 1), /^ITV · 8888LXR\.pdf$/);
    assert.match(comoSeLlamaElPapel("itv", "8888LXR", "b.pdf", 2), /\(2\)\.pdf$/);
    assert.match(comoSeLlamaElPapel("itv", "8888LXR", "c.pdf", 3), /\(3\)\.pdf$/);
  });
});

describe("el nombre original se guarda si aporta algo", () => {
  test("un nombre con palabras se conserva", () => {
    /*
     * El día que discuta un papel —«yo os mandé el de la ITV de 2024»— se
     * identifica por el nombre con el que él lo tenía, y ese nombre solo vive
     * aquí.
     */
    const n = comoSeLlamaElPapel("technical_sheet", "8888LXR", "Rechnung_Transport_TRP-2026-002.pdf");
    assert.match(n, /^Ficha técnica · 8888LXR — Rechnung_Transport_TRP-2026-002\.pdf$/);
  });

  test("pero el ruido no", () => {
    // `scan_0007` o una ristra de dígitos alargan la línea sin informar.
    for (const ruido of ["02384u723.pdf", "scan_0007.pdf", "IMG_2841.jpg", "documento (1).pdf", "1779203208958.pdf"]) {
      assert.doesNotMatch(comoSeLlamaElPapel("itv", "8888LXR", ruido), /—/, ruido);
    }
  });

  test("y eso se decide en un solo sitio", () => {
    assert.equal(diceAlgo("Rechnung_Transport_TRP-2026-002.pdf"), true);
    assert.equal(diceAlgo("02384u723.pdf"), false);
    assert.equal(diceAlgo("IMG_2841.jpg"), false);
  });
});

describe("guardar dos veces no lo alarga", () => {
  test("renombrar lo ya renombrado da lo mismo", () => {
    /*
     * Al guardar por segunda vez el panel devuelve los documentos que ya
     * estaban, con el nombre que les pusimos. Si eso se tratara como el nombre
     * del cliente, cada guardado añadiría otra cola: «ITV · 8888LXR — ITV ·
     * 8888LXR — ITV · 8888LXR».
     */
    const una = comoSeLlamaElPapel("itv", "8888LXR", "02384u723.pdf");
    assert.equal(comoSeLlamaElPapel("itv", "8888LXR", una), una);

    const conCola = comoSeLlamaElPapel("technical_sheet", "8888LXR", "Rechnung_Transport.pdf");
    assert.equal(comoSeLlamaElPapel("technical_sheet", "8888LXR", conCola), conCola);
  });

  test("pero un papel que empieza por la etiqueta es suyo, no nuestro", () => {
    /*
     * Este salió al mirar lo que hay guardado de verdad: «ITV _ 2026.04.27.pdf»
     * se convertía en «Documento · 5380FBT (2).pdf». Empieza por «ITV», así que
     * se daba por nuestro y se tiraba — y era lo único que distinguía ese papel
     * de los otros dos del mismo coche.
     */
    assert.match(
      comoSeLlamaElPapel("document", "5380FBT", "ITV _ 2026.04.27.pdf"),
      /— ITV _ 2026\.04\.27\.pdf$/
    );
    assert.equal(yaSeLoPusimos("ITV _ 2026.04.27.pdf"), false);
    assert.equal(yaSeLoPusimos("Seguro de mi coche.pdf"), false);
    assert.equal(yaSeLoPusimos("Documento de la gestoria.pdf"), false);

    // Y lo que sí es nuestro se sigue reconociendo, con matrícula o sin ella.
    assert.equal(yaSeLoPusimos("ITV · 8888LXR.pdf"), true);
    assert.equal(yaSeLoPusimos("Documento · 5380FBT (2).pdf"), true);
    assert.equal(yaSeLoPusimos("ITV.pdf"), true);
  });

  test("y diez veces tampoco", () => {
    let n = comoSeLlamaElPapel("circulation_permit", "8888LXR", "scan_0007.pdf");
    for (let i = 0; i < 10; i++) n = comoSeLlamaElPapel("circulation_permit", "8888LXR", n);
    assert.equal(n, "Permiso de circulación · 8888LXR.pdf");
  });
});

describe("no se desborda", () => {
  test("un nombre larguísimo se recorta por el final", () => {
    /*
     * Esto acaba en una columna y en un nombre de fichero. Se recorta donde
     * está el original: lo que no se puede perder es el tipo y la matrícula,
     * que es para lo que se renombra.
     */
    const largo = `${"Informe de la revision anual del vehiculo ".repeat(6)}.pdf`;
    const n = comoSeLlamaElPapel("itv", "8888LXR", largo);
    assert.ok(n.length <= 125, `mide ${n.length}`);
    assert.match(n, /^ITV · 8888LXR/);
    assert.match(n, /\.pdf$/);
  });

  test("y sin nombre de fichero tampoco revienta", () => {
    assert.equal(comoSeLlamaElPapel("itv", "8888LXR", ""), "ITV · 8888LXR");
    assert.equal(comoSeLlamaElPapel("itv", "8888LXR", null), "ITV · 8888LXR");
  });
});
