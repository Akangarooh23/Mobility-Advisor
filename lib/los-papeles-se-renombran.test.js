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
   * El guardián de verdad, y la segunda versión.
   *
   * La primera contaba los INSERT de **una** tabla, `vehicle_documents`. Pero
   * los papeles del coche viven en tres: los del seguro y las facturas de
   * mantenimiento tienen la suya. Así que el seguro y el mantenimiento se
   * guardaron con el nombre del móvil durante un día entero y esto no dijo
   * nada — miraba justo donde no estaba el problema.
   *
   * Ahora busca **toda** inserción que escriba un nombre de fichero, sea la
   * tabla que sea, y exige que ese nombre esté calculado. El día que aparezca
   * una cuarta tabla entra sola en la cuenta.
   */
  test("todo INSERT que guarde un nombre de fichero lo lleva calculado", () => {
    const lineas = TIENDA.split("\n");
    const sinRenombrar = [];

    lineas.forEach((linea, i) => {
      const m = linea.match(/INSERT INTO (moveadvisor_\w+)\s*\(([^)]*)/);
      if (!m) return;
      // Solo las que guardan el nombre de un fichero subido.
      if (!/\bfile_name\b/.test(m[2])) return;
      // Las fotos no se renombran: «Documento · 8888LXR» delante de la foto del
      // frontal no dice qué foto es, y el orden en que las subió sí.
      const bloque = lineas.slice(i, i + 8).join("\n");
      if (/VALUES \(\$1, 'photo'/.test(bloque)) return;
      if (!bloque.includes("comoSeLlamaElPapel(")) sinRenombrar.push(`${m[1]} (línea ${i + 1})`);
    });

    assert.deepEqual(
      sinRenombrar,
      [],
      `estos INSERT guardan el nombre del fichero del móvil: ${sinRenombrar.join(", ")}`
    );
  });

  test("y se está mirando en más de una tabla", () => {
    /*
     * Sin esto, el guardián de arriba pasaría por vacío el día que alguien
     * renombre las tablas: cero coincidencias, cero fallos, cero protección.
     * Es exactamente cómo el anterior dejó pasar dos tablas enteras.
     */
    const tablas = new Set(
      [...TIENDA.matchAll(/INSERT INTO (moveadvisor_\w+)\s*\([^)]*\bfile_name\b/g)].map((m) => m[1])
    );
    assert.ok(
      tablas.size >= 3,
      `solo veo ${tablas.size} tablas con ficheros: ${[...tablas].join(", ")}`
    );
  });

  test("el seguro y el mantenimiento, por su nombre", () => {
    // Los dos que se quedaron fuera. Escritos aparte para que se lea qué pasó.
    assert.ok(TIENDA.includes('comoSeLlamaElPapel("insurance",'),
      "los papeles del seguro se guardarían con el nombre del móvil");
    assert.ok(TIENDA.includes('comoSeLlamaElPapel("maintenance",'),
      "las facturas de revisión se guardarían con el nombre del móvil");
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
