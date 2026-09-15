"use strict";

/**
 * Que el renombrado esté enchufado donde se guardan los papeles.
 *
 * `como-se-llama-el-papel.js` puede estar perfecto y probado y no servir de
 * nada: basta con que el INSERT siga metiendo `fileName`. Eso es lo que pasó
 * antes con el correo de la factura —la función existía, nadie la llamaba— y es
 * lo que estos tests miran: no cómo se calcula el nombre, sino que el nombre
 * que llega a la base sea el calculado.
 *
 * Se lee el código fuente a propósito. Probarlo de verdad pide una base de
 * datos; lo que aquí se protege es el cable, y el cable se ve en el fuente.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TIENDA = fs.readFileSync(path.join(__dirname, "billingStore.js"), "utf8");
const MANDATO = fs.readFileSync(path.join(__dirname, "api", "mandato-firmado-handler.js"), "utf8");

describe("los papeles del coche se guardan con su nombre", () => {
  test("los tres tipos con ficha propia pasan por el renombrado", () => {
    for (const tipo of ["technicalSheet", "circulationPermit", "itv"]) {
      assert.ok(
        TIENDA.includes(`comoSeLlamaElPapel(VEHICLE_DOCUMENT_TYPES.${tipo},`),
        `${tipo} se guardaría con el nombre del fichero del cliente`
      );
    }
  });

  test("y los sueltos también", () => {
    // «Otros documentos» es donde acaba lo que no encaja en los tres de arriba.
    assert.ok(TIENDA.includes('comoSeLlamaElPapel("document",'),
      "los documentos sueltos se guardarían como 02384u723.pdf");
  });

  test("el mandato firmado que sube el cliente, igual", () => {
    assert.ok(MANDATO.includes("comoSeLlamaElPapel(M.PAPEL,"),
      "el mandato firmado se guardaría con el nombre del móvil del cliente");
  });
});

describe("y no se queda ninguno fuera", () => {
  /*
   * El guardián de verdad.
   *
   * Cuando alguien añada un cuarto tipo de documento —el informe de la
   * inspección, la tasación— copiará uno de estos bloques. Si copia el INSERT y
   * se deja el renombrado, aquí se entera.
   */
  test("cada documento que se inserta lleva su nombre calculado", () => {
    const inserts = (TIENDA.match(/INSERT INTO moveadvisor_user_vehicle_documents/g) || []).length;
    const renombrados = (TIENDA.match(/comoSeLlamaElPapel\(/g) || []).length;
    assert.ok(inserts > 0, "no hay ningún INSERT de documentos: el fichero ha cambiado de sitio");
    assert.equal(
      renombrados,
      inserts + 1, // los tres con ficha propia, más el de los sueltos
      `hay ${inserts} inserciones de documentos y ${renombrados} renombrados: falta enchufar alguna`
    );
  });

  test("pero las fotos no se tocan", () => {
    /*
     * Una foto no es un papel. «Documento · 8888LXR» delante de la foto del
     * frontal no dice qué foto es, y el orden en que las subió sí.
     */
    const lineaFoto = TIENDA.split("\n").find((l) => l.includes("VALUES ($1, 'photo'"));
    assert.ok(lineaFoto, "ya no se guardan fotos: mira si esto sigue teniendo sentido");
    const cuerpo = TIENDA.slice(TIENDA.indexOf(lineaFoto), TIENDA.indexOf(lineaFoto) + 400);
    assert.ok(!cuerpo.includes("comoSeLlamaElPapel"),
      "las fotos han entrado en el renombrado y ahí no aporta nada");
  });
});
