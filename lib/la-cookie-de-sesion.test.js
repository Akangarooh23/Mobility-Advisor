/**
 * La cookie de sesión sale marcada como segura, salvo en local.
 *
 * La regla decía `AUTH_COOKIE_SECURE || "false"`: **por omisión, sin `Secure`**.
 * Y esa variable no está puesta en Vercel, así que la cookie de sesión de todos
 * los clientes salía sin la marca que impide que viaje por una conexión sin
 * cifrar. El dominio lleva HSTS y eso lo tapa casi siempre; «casi» no es una
 * defensa, y la marca existe justo para el rato en que el navegador todavía no
 * ha visto esa cabecera.
 *
 * Lo que se fija aquí es que lo seguro sea lo de por omisión, y que la puerta
 * de atrás siga existiendo para el desarrollo en local, donde no hay HTTPS y
 * con `Secure` no se podría entrar.
 */
const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const auth = require("../api/auth");

const ORIGINAL = { NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL, COOKIE: process.env.AUTH_COOKIE_SECURE };
after(() => {
  for (const [n, v] of [["NODE_ENV", ORIGINAL.NODE_ENV], ["VERCEL", ORIGINAL.VERCEL], ["AUTH_COOKIE_SECURE", ORIGINAL.COOKIE]]) {
    if (v === undefined) delete process.env[n]; else process.env[n] = v;
  }
});

describe("cuándo lleva Secure", () => {
  test("en producción, sí, aunque nadie ponga la variable", () => {
    assert.equal(auth.cookieSegura({ NODE_ENV: "production" }), true);
  });

  test("en Vercel, también", () => {
    assert.equal(auth.cookieSegura({ VERCEL: "1" }), true);
  });

  test("en local, no: si no, el login no funcionaría sin HTTPS", () => {
    assert.equal(auth.cookieSegura({ NODE_ENV: "development" }), false);
  });

  test("y se puede forzar en los dos sentidos", () => {
    assert.equal(auth.cookieSegura({ NODE_ENV: "development", AUTH_COOKIE_SECURE: "true" }), true);
    assert.equal(auth.cookieSegura({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "false" }), false);
  });
});

describe("la cookie que se escribe", () => {
  test("en producción lleva las cuatro marcas", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_SECURE;
    const cookie = auth.buildSessionCookie("abc.def", { maxAgeSeconds: 3600 });

    assert.match(cookie, /HttpOnly/, "sin esto la lee cualquier script de la página");
    assert.match(cookie, /Secure/, "sin esto viaja por una conexión sin cifrar");
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /Max-Age=3600/);
  });

  test("y al cerrar sesión se borra con las mismas", () => {
    process.env.NODE_ENV = "production";
    const cookie = auth.buildSessionCookie("", { maxAgeSeconds: 0 });
    assert.match(cookie, /Max-Age=0/);
    assert.match(cookie, /Secure/, "una cookie que se borra sin Secure no borra la que tenía Secure");
  });
});
