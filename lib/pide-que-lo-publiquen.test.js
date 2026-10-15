/**
 * Pedirle al ERP que publique el coche al firmarse el precio.
 *
 * Lo que se protege es que esto **no pueda estropear la firma**. El papel del
 * cliente ya está guardado cuando esto corre; si reventara por un ERP que no
 * contesta, se perdería lo único que hizo él para salvar un anuncio que puede
 * salir cinco minutos después.
 */
"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pideQueLoPubliquen, ESPERA_MS } = require("./pide-que-lo-publiquen");

const FUENTE = fs.readFileSync(path.join(__dirname, "pide-que-lo-publiquen.js"), "utf8");

describe("no revienta nunca", () => {
  test("sin ERP configurado se calla", async () => {
    // En local no hay ERP al lado, y reventar por eso dejaría sin firmar
    // precios por una publicación que es de después.
    const antes = { ERP_API_URL: process.env.ERP_API_URL, INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET };
    delete process.env.ERP_API_URL;
    delete process.env.INTERNAL_API_SECRET;
    await assert.doesNotReject(() => pideQueLoPubliquen("idcar-1"));
    Object.assign(process.env, antes);
  });

  test("sin coche, tampoco llama", async () => {
    await assert.doesNotReject(() => pideQueLoPubliquen(""));
    await assert.doesNotReject(() => pideQueLoPubliquen(null));
  });

  test("y un ERP que no contesta se apunta, no se lanza", async () => {
    /*
     * El `catch` es lo que separa «el anuncio sale tarde» de «el cliente firma
     * y su firma no se guarda».
     */
    assert.match(FUENTE, /catch \(err\)/);
    assert.match(FUENTE, /console\.error\("\[publicar\] no se ha podido avisar al ERP:"/);
  });
});

describe("cómo llama", () => {
  test("a la ruta interna, con el secreto", () => {
    assert.match(FUENTE, /\/api\/interno\/publicar-idcar/);
    assert.match(FUENTE, /Authorization: `Bearer \$\{secreto\}`/);
  });

  test("y con un tope: el cliente está esperando su respuesta", () => {
    // Esto corre dentro de la petición en la que él sube el papel firmado.
    // Sin tope, un ERP colgado deja la pantalla girando.
    assert.ok(ESPERA_MS > 0 && ESPERA_MS <= 10000, `${ESPERA_MS} ms es demasiado para hacerle esperar`);
    assert.match(FUENTE, /AbortController/);
  });

  test("si el ERP dice que no, se apunta con su motivo", () => {
    /*
     * No publicar puede ser lo correcto —le falta el informe, las franjas—.
     * Pero sin esta línea, un coche con el precio firmado y sin anuncio no
     * tiene explicación en ninguna parte.
     */
    assert.match(FUENTE, /if \(!res\.ok\)/);
    assert.match(FUENTE, /porQue\.detail \|\| porQue\.error/);
  });
});

describe("y el que lo llama", () => {
  const HANDLER = fs.readFileSync(path.join(__dirname, "api", "clausula-precio-handler.js"), "utf8");

  test("lo hace después de guardar la firma, no antes", () => {
    /*
     * El orden es la garantía: primero queda guardado lo suyo y después se
     * intenta lo nuestro. Al revés, un fallo publicando se llevaría por
     * delante la firma.
     */
    const firma = HANDLER.indexOf("SQL_MARCA_ACEPTADA");
    const publica = HANDLER.indexOf("pideQueLoPubliquen(");
    assert.ok(firma > 0 && publica > firma, "se pide publicar antes de guardar la firma");
  });

  test("y lo espera, que en Vercel lo que no se espera se corta", () => {
    assert.match(HANDLER, /await pideQueLoPubliquen\(/);
  });
});
