/**
 * El login no dice quién tiene cuenta, y no se puede probar sin parar.
 *
 * Contestaba «No existe ninguna cuenta con ese correo» (404) cuando el correo
 * no estaba, y «La contraseña no es correcta» (401) cuando sí. Esa diferencia
 * **es** una lista de clientes: con un listado de correos y una petición por
 * cada uno se sabe quién tiene cuenta aquí sin acertar ni una contraseña. En un
 * sitio donde la gente sube su coche, sus papeles y su teléfono, eso ya es algo
 * que alguien querría comprar.
 *
 * Y no había ningún freno: se podían probar contraseñas en bucle.
 *
 * Se comprueba sobre el fuente porque `api/auth.js` habla con tres bases
 * distintas y montarlas para una prueba diría más del andamio que del código.
 * Lo que hay que fijar es qué contesta y en qué orden pregunta, y eso se lee.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const AUTH = fs.readFileSync(path.join(__dirname, "..", "..", "api", "auth.js"), "utf8");

/**
 * El trozo que atiende `action === "login"`, **sin comentarios**.
 *
 * Sin quitarlos, esta prueba se leería a sí misma: el código explica arriba por
 * qué ya no contesta «No existe ninguna cuenta», y esa frase, dentro de un
 * comentario, haría saltar la comprobación de que la frase no está.
 */
function elLogin() {
  const i = AUTH.indexOf('if (action === "login")');
  assert.ok(i > 0, "ya no hay rama de login: ¿se ha movido?");
  const j = AUTH.indexOf('if (action === "register")', i);
  const trozo = AUTH.slice(i, j > i ? j : i + 6000);
  return trozo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

describe("cuando el login falla", () => {
  const login = elLogin();

  test("no dice si la cuenta existe", () => {
    assert.ok(
      !/No existe ninguna cuenta/.test(login),
      "ese mensaje convierte el login en un comprobador de correos"
    );
    assert.ok(!/status\(404\)/.test(login), "y un 404 lo dice igual de claro sin palabras");
  });

  test("y contesta lo mismo se equivoque en lo que se equivoque", () => {
    const mensajes = [...login.matchAll(/status\(401\)\.json\(\{\s*error:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.equal(mensajes.length, 1, "hay más de una forma de fallar: eso es lo que se mide desde fuera");
    assert.match(mensajes[0], /correo o la contrase/i);
  });
});

describe("y antes de mirar nada", () => {
  const login = elLogin();

  test("se cuenta el intento, por correo y por IP", () => {
    assert.match(login, /FRENO\.pide\([^)]*"login",\s*email/);
    assert.match(login, /FRENO\.pide\([^)]*"login-ip",\s*clientIp/);
  });

  test("el freno va delante de la búsqueda del usuario", () => {
    // Si fuera al revés, cada intento costaría una consulta a la base y el
    // tiempo de respuesta diría si el correo existe aunque el mensaje no.
    const freno = login.indexOf("FRENO.pide");
    const busca = login.indexOf("findUserByEmail");
    assert.ok(freno > 0 && busca > 0 && freno < busca, "primero se cuenta, luego se busca");
  });

  test("y cuando acierta, la cuenta se suelta", () => {
    assert.match(login, /FRENO\.suelta\([^)]*"login",\s*email\)/);
  });
});

describe("el freno cuenta en la base", () => {
  test("no en un Map del proceso", () => {
    // Un `Map` en Vercel no frena: cada petición puede caer en otra instancia.
    const freno = fs.readFileSync(path.join(__dirname, "..", "freno.js"), "utf8");
    assert.match(freno, /INSERT INTO frenos_de_ritmo/);
    assert.ok(!/new Map\(\)/.test(freno), "si vuelve a contar en memoria, deja de contar");
  });

  test("y la tabla se crea en una migración, no al vuelo", () => {
    const migraciones = fs.readdirSync(path.join(__dirname, "..", "..", "migrations"));
    assert.ok(
      migraciones.some((f) => /frenos_de_ritmo/.test(fs.readFileSync(path.join(__dirname, "..", "..", "migrations", f), "utf8"))),
      "el esquema se cambia en migrations/, no dentro de un manejador"
    );
  });
});
