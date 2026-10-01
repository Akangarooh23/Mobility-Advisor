"use strict";

/**
 * Solo Meta puede escribir en el webhook de WhatsApp.
 *
 * ## Lo que pasaba
 *
 * Nada. El POST de `/api/whatsapp` aceptaba **cualquier** petición, sin firma y sin
 * secreto. Y lo que hay detrás no es un contador de visitas:
 *
 *  - se crean filas en `pre_clientes`, `whatsapp_leads` y `whatsapp_sessions` con el
 *    teléfono, el nombre y el correo que venga en el cuerpo;
 *  - y **se contesta por WhatsApp**, con `META_WA_TOKEN`. O sea que cualquiera que
 *    conociera la dirección podía hacer que la cuenta de Meta de la empresa mandara
 *    mensajes al número que eligiera.
 *
 * Coste, reputación y LOPDGDD.
 *
 * El ERP ya lo hacía bien —`apps/api/src/lib/whatsapp.ts` comprueba el HMAC y la
 * longitud antes de `timingSafeEqual`—. Los dos lados hablan con Meta y solo uno
 * comprobaba quién llamaba.
 *
 * ## Qué se fija aquí
 *
 * Las cinco respuestas, y el orden de dos de ellas:
 *
 *  1. sin secreto configurado, **no se atiende a nadie** (503);
 *  2. sin cabecera de firma, 401;
 *  3. con una firma que no cuadra, 401;
 *  4. con la firma buena, pasa;
 *  5. con una firma de **otro tamaño**, 401 y no una excepción — porque
 *     `timingSafeEqual` levanta con búferes desiguales, y eso convertiría un 401 en
 *     un 500.
 */

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { loMandaMeta } = require("./whatsapp-handler");

const SECRETO = "el-app-secret-de-mentira";
const CUERPO = { entry: [{ changes: [{ value: { messages: [{ type: "text", from: "34600000000" }] } }] }] };

/** Un `res` de mentira que apunta el código y el cuerpo. */
function elRes() {
  const r = { code: 0, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return b; };
  r.end = () => r;
  return r;
}

function laPeticion({ firma, cuerpo = CUERPO, bruto } = {}) {
  return {
    method: "POST",
    headers: firma === undefined ? {} : { "x-hub-signature-256": firma },
    body: cuerpo,
    rawBody: bruto,
  };
}

/** La firma que mandaría Meta para ese cuerpo. */
function firmaDe(bruto, secreto = SECRETO) {
  return "sha256=" + crypto.createHmac("sha256", secreto).update(bruto, "utf8").digest("hex");
}

let antes;
beforeEach(() => { antes = process.env.WHATSAPP_APP_SECRET; });
afterEach(() => {
  if (antes === undefined) delete process.env.WHATSAPP_APP_SECRET;
  else process.env.WHATSAPP_APP_SECRET = antes;
});

describe("el webhook de WhatsApp solo atiende a Meta", () => {
  test("sin secreto configurado no se atiende a nadie", async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const res = elRes();
    const bruto = JSON.stringify(CUERPO);

    const pasa = await loMandaMeta(laPeticion({ firma: firmaDe(bruto), bruto }), res);

    assert.equal(pasa, false);
    assert.equal(res.code, 503, "sin configurar es 503, no 200: fallar abierto no se nota nunca");
  });

  test("sin cabecera de firma, 401", async () => {
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const res = elRes();

    const pasa = await loMandaMeta(laPeticion({ bruto: JSON.stringify(CUERPO) }), res);

    assert.equal(pasa, false);
    assert.equal(res.code, 401);
  });

  test("con una firma que no cuadra, 401", async () => {
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const res = elRes();
    const bruto = JSON.stringify(CUERPO);
    // Firmada con otro secreto: misma longitud, contenido distinto.
    const firma = firmaDe(bruto, "otro-secreto-cualquiera");

    const pasa = await loMandaMeta(laPeticion({ firma, bruto }), res);

    assert.equal(pasa, false);
    assert.equal(res.code, 401);
  });

  test("con la firma buena, pasa", async () => {
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const res = elRes();
    const bruto = JSON.stringify(CUERPO);

    const pasa = await loMandaMeta(laPeticion({ firma: firmaDe(bruto), bruto }), res);

    assert.equal(pasa, true);
    assert.equal(res.code, 0, "si pasa, no contesta nada: contesta el manejador");
  });

  test("una firma de otro tamaño da 401 y no una excepción", async () => {
    /*
     * Esto es el orden, no el resultado. `timingSafeEqual` levanta —no devuelve
     * false— si los búferes miden distinto. Sin comprobar la longitud antes, una
     * firma recortada convertiría un 401 en un 500, y un 500 es información: dice
     * que has llegado a un sitio donde pasan cosas.
     */
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const res = elRes();
    const bruto = JSON.stringify(CUERPO);

    const pasa = await loMandaMeta(laPeticion({ firma: "sha256=abc", bruto }), res);

    assert.equal(pasa, false);
    assert.equal(res.code, 401, "no 500");
  });

  test("y la firma se calcula sobre el cuerpo en bruto, no sobre el objeto", async () => {
    /*
     * Meta firma los bytes que manda. Si el cuerpo en bruto llega con espacios
     * distintos a los que pondría `JSON.stringify`, la firma de esos bytes es la que
     * vale — y es la que hay que aceptar.
     */
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const res = elRes();
    const bruto = JSON.stringify(CUERPO, null, 2); // mismos datos, otros bytes

    const pasa = await loMandaMeta(laPeticion({ firma: firmaDe(bruto), bruto, cuerpo: CUERPO }), res);

    assert.equal(pasa, true, "tiene que firmar lo que llegó, no lo que se rearma");
  });
});
