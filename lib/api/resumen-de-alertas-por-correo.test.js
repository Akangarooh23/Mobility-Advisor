/**
 * El resumen de alertas no es un relé de correo.
 *
 * Esta dirección estuvo abierta: sin sesión, y con el destinatario, el
 * remitente y el HTML saliendo del cuerpo de la petición. Con el SPF y el DKIM
 * del dominio detrás, eso es un buzón para mandar engaños en nuestro nombre.
 *
 * Lo que se fija aquí: sin sesión no se manda nada, y lo que llegue en el
 * cuerpo diciendo a quién, de parte de quién y con qué contenido se ignora.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// El módulo de auth abre conexiones al cargarse; se sustituye antes de que
// identidad.js lo pida.
const rutaAuth = require.resolve("../../api/auth");
let sesionQueDevuelve = null;
require.cache[rutaAuth] = {
  id: rutaAuth,
  filename: rutaAuth,
  loaded: true,
  exports: { getSessionUserFromRequest: async () => sesionQueDevuelve },
};

const manejador = require("../../api/send-alert-email");

const entornoOriginal = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH: process.env.AUTH_BILLING_REQUIRE_SESSION,
  RESEND: process.env.RESEND_API_KEY,
  PROVEEDOR: process.env.ALERT_EMAIL_PROVIDER,
};
const fetchOriginal = global.fetch;

/** Lo último que se le pasó a Resend, o null si no se llamó. */
let loEnviado = null;

before(() => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_BILLING_REQUIRE_SESSION = "true";
  process.env.RESEND_API_KEY = "re_de_mentira";
  process.env.ALERT_EMAIL_PROVIDER = "resend";
  global.fetch = async (_url, opciones) => {
    loEnviado = JSON.parse(String(opciones?.body || "{}"));
    return { ok: true, json: async () => ({ id: "env_1" }) };
  };
});

after(() => {
  global.fetch = fetchOriginal;
  process.env.NODE_ENV = entornoOriginal.NODE_ENV;
  if (entornoOriginal.AUTH) process.env.AUTH_BILLING_REQUIRE_SESSION = entornoOriginal.AUTH;
  else delete process.env.AUTH_BILLING_REQUIRE_SESSION;
  if (entornoOriginal.RESEND) process.env.RESEND_API_KEY = entornoOriginal.RESEND;
  else delete process.env.RESEND_API_KEY;
  if (entornoOriginal.PROVEEDOR) process.env.ALERT_EMAIL_PROVIDER = entornoOriginal.PROVEEDOR;
  else delete process.env.ALERT_EMAIL_PROVIDER;
});

beforeEach(() => {
  loEnviado = null;
});

/** Una respuesta de mentira que guarda el código y el cuerpo. */
function respuesta() {
  const r = { codigo: 200, cuerpo: null, terminada: false };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (d) => { r.cuerpo = d; r.terminada = true; return r; };
  r.end = () => { r.terminada = true; return r; };
  return r;
}

const peticion = (body) => ({ method: "POST", headers: {}, query: {}, body });

const UNA_ALERTA = [{ title: "Golf GTI", summary: "3 novedades", newMatchesCount: 3, matches: [] }];

describe("el resumen de alertas por correo", () => {
  test("sin sesión no se manda nada", async () => {
    sesionQueDevuelve = null;
    const res = respuesta();
    await manejador(peticion({ to: ["victima@example.com"], notifications: UNA_ALERTA }), res);

    assert.equal(res.codigo, 401, "una dirección que manda correo no puede estar abierta");
    assert.equal(loEnviado, null, "y no se llega a llamar a Resend");
  });

  test("va al correo de la sesión, no al del cuerpo", async () => {
    sesionQueDevuelve = { user: { id: "u1", email: "Ana@Example.com" } };
    const res = respuesta();
    await manejador(
      peticion({ to: ["victima@example.com"], recipients: ["otra@example.com"], notifications: UNA_ALERTA }),
      res
    );

    assert.equal(res.codigo, 200);
    assert.deepEqual(loEnviado.to, ["ana@example.com"]);
  });

  test("el remitente lo pone el servidor", async () => {
    sesionQueDevuelve = { user: { id: "u1", email: "ana@example.com" } };
    const res = respuesta();
    await manejador(peticion({ from: "banco@ejemplo.es", notifications: UNA_ALERTA }), res);

    assert.equal(res.codigo, 200);
    assert.ok(!String(loEnviado.from).includes("banco@ejemplo.es"), "el `from` del cuerpo se ignora");
    assert.ok(String(loEnviado.reply_to || "").length > 0, "y la respuesta sigue yendo a un buzón que existe");
  });

  test("el cuerpo del correo no se coge de la petición", async () => {
    sesionQueDevuelve = { user: { id: "u1", email: "ana@example.com" } };
    const res = respuesta();
    await manejador(
      peticion({
        subject: "Su cuenta ha sido bloqueada",
        html: "<a href='https://sitio-falso.example'>entra aquí</a>",
        text: "entra aquí",
        notifications: UNA_ALERTA,
      }),
      res
    );

    assert.equal(res.codigo, 200);
    assert.ok(!loEnviado.html.includes("sitio-falso.example"), "un HTML de fuera es un engaño firmado por nosotros");
    assert.ok(!loEnviado.text.includes("entra aquí"));
    assert.ok(!String(loEnviado.subject).includes("bloqueada"));
    assert.ok(loEnviado.html.includes("Golf GTI"), "pero el resumen de verdad sigue saliendo");
  });

  test("lo que escribe el usuario en el título de su alerta va escapado", async () => {
    sesionQueDevuelve = { user: { id: "u1", email: "ana@example.com" } };
    const res = respuesta();
    await manejador(
      peticion({ notifications: [{ title: "<script>alert(1)</script>", summary: "x", newMatchesCount: 1 }] }),
      res
    );

    assert.equal(res.codigo, 200);
    assert.ok(!loEnviado.html.includes("<script>"), "ni siquiera en su propio correo");
  });
});
