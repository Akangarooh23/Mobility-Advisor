"use strict";

/**
 * Las puertas de `api/auth.js` que se pueden empujar sin haber entrado.
 *
 * ## Qué se me escapó
 *
 * Dos cosas, y las dos por mirar una acción y no las de al lado.
 *
 * **Una.** `login` tenía freno en base por correo y por IP, con un comentario
 * largo explicando por qué hacen falta los dos. `register` no tenía ninguno, y
 * contesta 409 «Ya existe una cuenta con ese correo»: con una lista de
 * direcciones y una petición por cada una se sabía quién tiene cuenta aquí,
 * tan rápido como aguantara la máquina. El cuidado de una acción quedaba
 * deshecho por la de al lado.
 *
 * **Dos.** El mensaje único del login —el mismo 401 para «no existe» y para
 * «contraseña mala»— se delataba por el reloj:
 *
 *     Boolean(user) && hashPassword(password, user.passwordSalt) === user.passwordHash
 *
 * El `&&` corta. Sin usuario, `scrypt` no se llamaba, y `scrypt` cuesta 46 ms
 * medidos. Un correo con cuenta tardaba 46 ms más que uno sin ella, que es una
 * eternidad comparado con el ruido de la red. Tanto trabajo en no decirlo con
 * palabras, y lo decía el cronómetro.
 *
 * ## Por qué esta prueba lee el fuente en vez de llamar al manejador
 *
 * Porque `authHandler` habla con tres bases y el andamio para montarlo diría
 * más del andamio que del código —lo dice el propio fichero al final, donde
 * asoma solo las dos piezas puras—. Lo que se vigila aquí es una **forma**: que
 * cada puerta abierta tenga su freno dentro, y que el hash del login no viva
 * detrás de un cortocircuito. Las dos veces que esto falló, falló así.
 *
 * Una prueba de forma se rompe cuando alguien reescribe el fichero de otra
 * manera igual de válida. Cuando eso pase, hay que mirar si la propiedad sigue
 * cumpliéndose y actualizar el patrón, no borrar la prueba.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * El fuente sin sus comentarios.
 *
 * Esta prueba falló la primera vez que la lancé, y falló contra sí misma: el
 * comentario que puse en `api/auth.js` para explicar el cortocircuito **cita el
 * cortocircuito**, y el patrón lo encontró ahí. La prosa que explica un patrón
 * no puede contar como el patrón.
 *
 * Así que se quitan los comentarios antes de mirar. De paso todas las
 * comprobaciones de abajo se vuelven más fuertes: ahora hablan del código y no
 * de lo que el código dice de sí mismo.
 *
 * Se quitan los de bloque y los de línea que empiezan una línea. Los `//` a
 * mitad de línea se quedan, porque un `https://` dentro de una cadena también
 * lo parece y prefiero dejar de más que romper el fuente.
 */
function sinComentarios(fuente) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const AUTH = sinComentarios(
  fs.readFileSync(path.join(__dirname, "..", "api", "auth.js"), "utf8")
);

/** El trozo de fuente entre `if (action === "x")` y el siguiente `if (action ===`. */
function elBloqueDe(accion) {
  const abre = AUTH.indexOf(`if (action === "${accion}")`);
  assert.ok(abre > 0, `no encuentro la acción "${accion}" en api/auth.js`);

  const resto = AUTH.slice(abre + 1);
  const siguiente = resto.indexOf("if (action ===");
  return siguiente > 0 ? resto.slice(0, siguiente) : resto;
}

/**
 * Las que se pueden llamar sin cookie de sesión.
 *
 * `logout` no está: no crea nada, no cuenta nada y no contesta nada distinto
 * según quién seas, así que frenarla no protege de nada. Las de consentimientos
 * tampoco: exigen sesión, y quien ya la tiene no necesita adivinar nada.
 */
const PUERTAS_ABIERTAS = ["login", "register", "request_password_reset", "reset_password"];

test("ninguna acción de auth sin sesión se queda sin freno", () => {
  const sinFreno = [];

  for (const accion of PUERTAS_ABIERTAS) {
    const bloque = elBloqueDe(accion);

    // Dos mecanismos valen: el de base (`FRENO.pide`, el bueno, cuenta igual en
    // todas las instancias) y el de memoria (`consumeRateLimit`, que en Vercel
    // frena poco porque cada petición puede caer en otra instancia, pero está).
    const enBase = bloque.includes("FRENO.pide");
    const enMemoria = bloque.includes("consumeRateLimit") || bloque.includes("readBackoff");

    if (!enBase && !enMemoria) sinFreno.push(accion);
  }

  assert.deepEqual(
    sinFreno,
    [],
    `estas acciones se pueden llamar sin sesión y sin freno: ${sinFreno.join(", ")}.\n` +
      "Añade su límite a LIMITES en lib/freno.js y un FRENO.pide al principio del bloque."
  );
});

test("el alta frena por IP, que es la que corta un barrido de correos", () => {
  const bloque = elBloqueDe("register");

  assert.match(
    bloque,
    /FRENO\.pide\([^)]*clientIp/,
    "el alta contesta 409 si el correo ya existe, así que sin freno por IP se puede " +
      "preguntar por una lista entera de direcciones. Frenar solo por correo no sirve: " +
      "para preguntar por mil correos basta una petición por correo."
  );
});

test("el login calcula el hash aunque la cuenta no exista", () => {
  const bloque = elBloqueDe("login");

  // Lo que había: el hash detrás de un `&&` que corta cuando no hay usuario.
  assert.doesNotMatch(
    bloque,
    /Boolean\(user\)\s*&&\s*hashPassword/,
    "el hash está detrás de un cortocircuito: si la cuenta no existe, scrypt no se " +
      "llama y la respuesta llega 46 ms antes. Eso delata qué correos tienen cuenta y " +
      "deja sin valor el 401 único de arriba. Calcula el hash siempre, contra SAL_DE_PEGA."
  );

  assert.ok(
    bloque.includes("SAL_DE_PEGA"),
    "falta la sal de pega: es con la que se hashea cuando no hay usuario, para que " +
      "los dos casos cuesten lo mismo."
  );
});

test("la sal de pega existe y no es un valor fijo escrito a mano", () => {
  assert.match(
    AUTH,
    /const SAL_DE_PEGA = crypto\.randomBytes\(\d+\)\.toString\("hex"\)/,
    "SAL_DE_PEGA tiene que salir de randomBytes. El valor da igual —lo que importa es " +
      "que scrypt trabaje— pero una constante escrita a mano invita a que alguien la " +
      "reutilice para algo donde sí importe."
  );
});

test("el 500 de auth no cuenta lo que dijo Postgres", () => {
  /*
   * Iba `details: normalizeText(err?.message)`. El mensaje de Postgres lleva
   * nombres de tabla, de columna y de restricción, y este es el endpoint donde
   * más se busca eso: con un par de peticiones mal formadas se dibuja el
   * esquema de usuarios y sesiones.
   */
  const elCatch = AUTH.slice(AUTH.indexOf("authHandler uncaught error"));
  const hastaElCierre = elCatch.slice(0, elCatch.indexOf("async function _authHandlerInner"));

  assert.doesNotMatch(
    hastaElCierre,
    /details:\s*normalizeText\(err/,
    "el 500 de auth está devolviendo err.message al cliente. Va a registra(), que lo " +
      "guarda en moveadvisor_errores; al cliente solo el mensaje escrito para una persona."
  );
});
