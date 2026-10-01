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

/*
 * ── El GET, que fallaba abierto igual que el POST ───────────────────────────────
 *
 * Esto se encontró buscando otra cosa: mirando si WhatsApp estaba vivo vi que la
 * verificación de Meta, treinta líneas por encima del POST, tenía el mismo fallo.
 *
 *     token === process.env.META_WA_VERIFY_TOKEN
 *
 * Sin la variable puesta el lado derecho es `undefined`. Si la petición tampoco trae
 * `hub.verify_token`, el izquierdo también. Y `undefined === undefined` es `true`, así
 * que un `GET ?hub.mode=subscribe&hub.challenge=X` devolvía 200 con la X: cualquiera
 * pasaba la verificación y apuntaba la suscripción del webhook donde quisiera.
 *
 * En producción la variable está puesta —comprobado: el GET contesta 403, no 200— así
 * que hoy estaba cerrado. Lo que no la tiene es un despliegue de vista previa.
 */

const whatsappHandler = require("./whatsapp-handler");

function elGet(params) {
  return { method: "GET", query: params, headers: {} };
}

/** Un `res` que también apunta lo que se manda con `send`. */
function elResConSend() {
  const r = elRes();
  r.send = (b) => { r.body = b; return r; };
  return r;
}

describe("la verificación de Meta tampoco falla abierta", () => {
  let antesVerify;
  beforeEach(() => { antesVerify = process.env.META_WA_VERIFY_TOKEN; });
  afterEach(() => {
    if (antesVerify === undefined) delete process.env.META_WA_VERIFY_TOKEN;
    else process.env.META_WA_VERIFY_TOKEN = antesVerify;
  });

  test("sin token esperado y sin token recibido, NO cuela", async () => {
    delete process.env.META_WA_VERIFY_TOKEN;
    const res = elResConSend();

    await whatsappHandler(elGet({ "hub.mode": "subscribe", "hub.challenge": "PRUEBA" }), res);

    assert.notEqual(res.code, 200, "este era el fallo: undefined === undefined daba 200");
    assert.equal(res.code, 503, "sin configurar no se verifica a nadie");
    assert.notEqual(res.body, "PRUEBA", "y sobre todo no se devuelve el reto");
  });

  test("con el token puesto y el bueno, devuelve el reto", async () => {
    process.env.META_WA_VERIFY_TOKEN = "el-token-de-verificacion";
    const res = elResConSend();

    await whatsappHandler(
      elGet({ "hub.mode": "subscribe", "hub.verify_token": "el-token-de-verificacion", "hub.challenge": "PRUEBA" }),
      res
    );

    assert.equal(res.code, 200);
    assert.equal(res.body, "PRUEBA");
  });

  test("con el token puesto y otro, 403", async () => {
    process.env.META_WA_VERIFY_TOKEN = "el-token-de-verificacion";
    const res = elResConSend();

    await whatsappHandler(
      elGet({ "hub.mode": "subscribe", "hub.verify_token": "me-lo-invento", "hub.challenge": "PRUEBA" }),
      res
    );

    assert.equal(res.code, 403);
  });
});

describe("el secreto vale con cualquiera de los dos nombres", () => {
  /*
   * El ERP la llama `WHATSAPP_APP_SECRET`; en este fichero todo lo de Meta se llama
   * `META_WA_*`. Si solo valiera uno, poner la variable con el nombre que pide la
   * convención del fichero dejaría el webhook en 503 sin más pista que el 503.
   */
  let a, b;
  beforeEach(() => {
    a = process.env.WHATSAPP_APP_SECRET;
    b = process.env.META_WA_APP_SECRET;
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.META_WA_APP_SECRET;
  });
  afterEach(() => {
    if (a === undefined) delete process.env.WHATSAPP_APP_SECRET; else process.env.WHATSAPP_APP_SECRET = a;
    if (b === undefined) delete process.env.META_WA_APP_SECRET; else process.env.META_WA_APP_SECRET = b;
  });

  for (const nombre of ["WHATSAPP_APP_SECRET", "META_WA_APP_SECRET"]) {
    test(`vale con ${nombre}`, async () => {
      process.env[nombre] = SECRETO;
      const res = elRes();
      const bruto = JSON.stringify(CUERPO);

      const pasa = await loMandaMeta(laPeticion({ firma: firmaDe(bruto), bruto }), res);

      assert.equal(pasa, true, `${nombre} tiene que servir`);
    });
  }
});
