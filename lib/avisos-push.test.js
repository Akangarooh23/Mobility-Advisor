"use strict";

/**
 * Lo que se puede comprobar de los avisos al móvil sin un Firebase delante.
 *
 * Que el aviso llegue al móvil de un cliente hace falta probarlo con un móvil.
 * Lo que no hace falta —y es donde está el fallo silencioso— es la credencial:
 * si el JWT va mal firmado, o el `aud` no es el que Google espera, o la clave
 * privada llega con los saltos de línea escapados, no hay error en ninguna
 * parte. Simplemente no llega ningún aviso nunca.
 *
 * Así que aquí se firma con una clave RSA fabricada al vuelo y se verifica la
 * firma con su pública, que es exactamente lo que hará Google.
 */

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const CUENTA = {
  type: "service_account",
  project_id: "popcar-de-mentira",
  client_email: "avisos@popcar-de-mentira.iam.gserviceaccount.com",
  private_key: privateKey,
};

/** Carga el módulo de cero: guarda el token de acceso en memoria entre llamadas. */
function recarga() {
  delete require.cache[require.resolve("./avisos-push")];
  return require("./avisos-push");
}

function deBase64Url(v) {
  return Buffer.from(String(v).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

test("sin credenciales no se envía nada y no se rompe nada", async () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  const avisos = recarga();

  assert.equal(avisos.estaConfigurado(), false);

  // Ni una llamada a la red ni una consulta a la base: si tocara la base aquí
  // reventaría, porque en esta prueba no hay ninguna configurada.
  let llamadas = 0;
  const original = global.fetch;
  global.fetch = async () => {
    llamadas += 1;
    throw new Error("no debería llamar a nadie");
  };
  try {
    const salida = await avisos.enviaAviso(["quien@sea.es"], { titulo: "Hola", cuerpo: "Qué tal" });
    assert.equal(salida.enviados, 0);
    assert.equal(salida.motivo, "sin configurar");
    assert.equal(llamadas, 0);
  } finally {
    global.fetch = original;
  }
});

test("el JWT que se le manda a Google va firmado con la clave de servicio", async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(CUENTA);
  const avisos = recarga();

  assert.equal(avisos.estaConfigurado(), true);

  let cuerpoEnviado = null;
  const original = global.fetch;
  global.fetch = async (url, opciones) => {
    assert.equal(url, "https://oauth2.googleapis.com/token");
    cuerpoEnviado = new URLSearchParams(opciones.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "token-de-mentira", expires_in: 3600 }),
    };
  };

  let token;
  try {
    token = await avisos.tokenDeAcceso();
  } finally {
    global.fetch = original;
  }

  assert.equal(token, "token-de-mentira");
  assert.equal(cuerpoEnviado.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");

  const [cabecera, reclamos, firma] = cuerpoEnviado.get("assertion").split(".");

  assert.deepEqual(JSON.parse(deBase64Url(cabecera)), { alg: "RS256", typ: "JWT" });

  const claims = JSON.parse(deBase64Url(reclamos));
  assert.equal(claims.iss, CUENTA.client_email);
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claims.scope, "https://www.googleapis.com/auth/firebase.messaging");
  assert.ok(claims.exp > claims.iat, "el JWT tiene que caducar después de emitirse");
  assert.ok(claims.exp - claims.iat <= 3600, "Google no admite más de una hora");

  // Lo que de verdad importa: que la firma valga con la clave pública del par.
  const valida = crypto
    .createVerify("RSA-SHA256")
    .update(`${cabecera}.${reclamos}`)
    .verify(publicKey, Buffer.from(firma.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  assert.ok(valida, "Google rechazaría esta firma");
});

test("la clave privada vale con los saltos de línea escapados, que es como se pega en un panel", async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    ...CUENTA,
    private_key: privateKey.replace(/\n/g, "\\n"),
  });
  const avisos = recarga();

  let assertion = null;
  const original = global.fetch;
  global.fetch = async (_url, opciones) => {
    assertion = new URLSearchParams(opciones.body).get("assertion");
    return { ok: true, status: 200, json: async () => ({ access_token: "vale", expires_in: 3600 }) };
  };
  try {
    await avisos.tokenDeAcceso();
  } finally {
    global.fetch = original;
  }

  const [cabecera, reclamos, firma] = assertion.split(".");
  const valida = crypto
    .createVerify("RSA-SHA256")
    .update(`${cabecera}.${reclamos}`)
    .verify(publicKey, Buffer.from(firma.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  assert.ok(valida, "una clave con \\n escapados tiene que firmar igual de bien");
});

test("la credencial también se admite en base64", async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(CUENTA)).toString("base64");
  const avisos = recarga();
  assert.equal(avisos.estaConfigurado(), true);
});

test("una credencial rota no configura nada, en vez de reventar al primer aviso", async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = "{esto no es un json}";
  assert.equal(recarga().estaConfigurado(), false);

  // Un JSON válido pero sin la clave privada tampoco sirve de nada.
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: "x", client_email: "y@z" });
  assert.equal(recarga().estaConfigurado(), false);

  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});
