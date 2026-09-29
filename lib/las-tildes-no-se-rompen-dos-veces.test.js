"use strict";

/**
 * Las tildes no se codifican dos veces.
 *
 * ## Qué pasaba
 *
 * `api/auth.js` tenía **38 letras con doble codificación**: el texto se escribió
 * en UTF-8 y alguien lo volvió a leer como latin1, así que `contraseña` quedó
 * guardado como dos caracteres donde había uno.
 *
 * Y no era texto interno. Eran los mensajes que ve quien no consigue entrar: la
 * contraseña actual que no es correcta, la sesión que ha caducado, las
 * instrucciones que recibirás si el correo existe, el «inténtalo de nuevo»
 * cuando se han hecho demasiados intentos.
 *
 * La web los enseña tal cual —`setAuthError(error?.message)`—, así que cada
 * fallo de acceso se veía con la eñe partida. En la pantalla donde alguien ya
 * está nervioso porque no puede entrar.
 *
 * El mismo fichero tenía además eñes **correctas**, así que no se podía
 * redecodificar entero: se arregló secuencia por secuencia, y solo donde al
 * deshacerlas salía una letra española de verdad.
 *
 * ## Por qué esto es una prueba y no solo un arreglo
 *
 * Esto no lo escribió nadie a mano: lo hizo una herramienta al guardar. Puede
 * volver a pasar mañana, en cualquier fichero, y no lo nota nadie hasta que un
 * usuario ve la eñe partida —o hasta que no lo cuenta.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/*
 * La huella de lo que queda cuando un texto UTF-8 se lee como latin1.
 *
 * Se construye a partir de los códigos y no se escribe literal, para que este
 * fichero no se señale a sí mismo: un vigilante que salta por su propia
 * documentación es un vigilante que alguien apaga.
 */
const A_TILDE = String.fromCharCode(0xc3);   // la A con tilde que precede a la letra
const A_CIRC = String.fromCharCode(0xc2);    // la A con circunflejo de espacios y simbolos
const HUELLA = new RegExp(
  `${A_TILDE}[\\u0080-\\u00bf\\u00a0-\\u00ff]|${A_CIRC}[\\u0080-\\u00bf]`
);

const CARPETAS = ["api", "lib", "src", "scripts", "migrations"];
const EXTENSIONES = new Set([".js", ".mjs", ".jsx", ".json", ".sql", ".md"]);

function ficherosDe(carpeta) {
  const encontrados = [];
  const pendientes = [path.join(RAIZ, carpeta)];

  while (pendientes.length) {
    const aqui = pendientes.pop();
    if (!fs.existsSync(aqui)) continue;

    for (const entrada of fs.readdirSync(aqui, { withFileTypes: true })) {
      if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue;
      const completo = path.join(aqui, entrada.name);
      if (entrada.isDirectory()) pendientes.push(completo);
      else if (EXTENSIONES.has(path.extname(entrada.name))) encontrados.push(completo);
    }
  }

  return encontrados;
}

describe("ningún fichero lleva texto codificado dos veces", () => {
  for (const carpeta of CARPETAS) {
    test(`${carpeta}/`, () => {
      const rotos = [];
      let vistos = 0;

      for (const fichero of ficherosDe(carpeta)) {
        vistos += 1;
        const texto = fs.readFileSync(fichero, "utf8");
        if (!HUELLA.test(texto)) continue;

        const linea = texto.split("\n").findIndex((l) => HUELLA.test(l)) + 1;
        rotos.push(`${path.relative(RAIZ, fichero)}:${linea}`);
      }

      // Que de verdad se haya mirado algo, y no una carpeta que ya no existe.
      assert.ok(vistos > 0, `no he visto ni un fichero en ${carpeta}/`);

      /*
       * Si esto salta: no redecodifiques el fichero entero, que puede tener
       * letras buenas mezcladas. Cambia solo las secuencias rotas, y solo si al
       * deshacerlas sale una letra española de verdad.
       */
      assert.deepEqual(rotos, [], "texto codificado dos veces");
    });
  }
});

describe("y los mensajes de auth se leen", () => {
  const AUTH = fs.readFileSync(path.join(RAIZ, "api", "auth.js"), "utf8");

  test("la contraseña se llama contraseña", () => {
    // Es la palabra que más veces ve quien no consigue entrar.
    assert.ok(AUTH.includes("La contraseña actual no es correcta."));
  });

  test("y la sesión, sesión", () => {
    assert.ok(AUTH.includes("Sesión cerrada."));
  });

  test("y lo que se responde a quien no recuerda su correo", () => {
    /*
     * Se responde lo mismo exista o no el correo, para no decir quién está
     * registrado. Con la tilde partida, además, parecía roto.
     */
    assert.ok(AUTH.includes("Si el correo existe, recibirás instrucciones para recuperar tu contraseña."));
  });
});
