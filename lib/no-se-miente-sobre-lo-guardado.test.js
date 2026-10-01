"use strict";

/**
 * Nada contesta «guardado» cuando la base ha dicho no.
 *
 * ## Lo que pasaba
 *
 * Las diecinueve funciones de datos del cliente de `billingStore.js` tenían esta
 * forma, y ocho de ellas escribían:
 *
 *     try {
 *       return await addAppointmentByEmailPostgres(email, appointment);
 *     } catch {
 *       return [];
 *     }
 *
 * Y `billing-account-handler.js` las usaba así:
 *
 *     const appointments = await addAppointment(identity, body.appointment);
 *     return res.status(200).json({ ok: true, appointments, message: "Cita guardada." });
 *
 * O sea que un `INSERT` fallido contestaba **200, `ok: true` y «Cita
 * guardada.»**, con la lista vacía al lado. La pantalla enseñaba las dos cosas a
 * la vez y quien estaba delante no podía saber cuál era verdad. Ocho acciones
 * así, y la peor `valuation_add`, porque la tasación es el producto.
 *
 * Lo mismo en la tasación: `readPostgresInventory` devolvía `[]` al fallar, y
 * `readInventoryUniverse` leía ese `[]` como «no hay comparables» y caía a
 * `data/inventory-offers.json` — 2.749 ofertas congeladas el 14 de agosto, el
 * 0,1 % del pool, y sin filtrar—. Un fallo de base se convertía en un precio.
 *
 * ## Por qué se comprueba sobre el fuente
 *
 * Porque `billingStore` se conecta con `getPgPool()` por dentro y montar una
 * base falsa diría más del andamio que del código. Lo que se vigila es una
 * forma, y las dos veces que esto falló, falló así: un `catch` que devuelve un
 * vacío en vez de dejar pasar el error.
 *
 * Se leen los ficheros sin sus comentarios: la prosa que explica un patrón no
 * puede contar como el patrón —eso ya me pasó con la prueba de los frenos—.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

function sinComentarios(fuente) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

function lee(rel) {
  return sinComentarios(fs.readFileSync(path.join(RAIZ, rel), "utf8"));
}

const TIENDA = lee(path.join("lib", "billingStore.js"));
const INVENTARIO = lee(path.join("lib", "inventoryStore.js"));
const MANEJADOR = lee(path.join("lib", "api", "billing-account-handler.js"));

/**
 * El cuerpo de una función declarada con `function nombre(` o `async function`.
 *
 * Busca la llave del cuerpo **después de cerrar los paréntesis**, y no la
 * primera que aparezca. La primera versión cogía la primera `{` y con
 * `readInventoryUniverse(options = {})` eso es el valor por omisión del
 * parámetro: devolvía `{}` como cuerpo entero y la prueba pasaba mirando nada.
 */
function cuerpoDe(fuente, nombre) {
  const i = fuente.search(new RegExp(`(?:async )?function ${nombre}\\s*\\(`));
  assert.ok(i >= 0, `no encuentro la función ${nombre}`);

  const abreParen = fuente.indexOf("(", i);
  let p = 0;
  let cierraParen = -1;
  for (let j = abreParen; j < fuente.length; j++) {
    if (fuente[j] === "(") p++;
    else if (fuente[j] === ")") {
      p--;
      if (p === 0) { cierraParen = j; break; }
    }
  }
  assert.ok(cierraParen > 0, `no encuentro los parámetros de ${nombre}`);

  const abre = fuente.indexOf("{", cierraParen);
  let prof = 0;
  for (let j = abre; j < fuente.length; j++) {
    if (fuente[j] === "{") prof++;
    else if (fuente[j] === "}") {
      prof--;
      if (prof === 0) return fuente.slice(abre, j + 1);
    }
  }
  throw new Error(`no encuentro el final de ${nombre}`);
}

describe("las que escriben dejan pasar el error", () => {
  /**
   * Las ocho que escriben datos de alguien.
   *
   * `addMaintenanceByEmail` y `upsertInsuranceByEmail` no están porque **ya
   * estaban bien** antes de esto: nunca tuvieron `catch`. Se quedan fuera de la
   * lista y dentro de la regla general de abajo, que las cubre.
   */
  const ESCRIBEN = [
    "addAppointmentByEmail",
    "deleteAppointmentByEmail",
    "addValuationByEmail",
    "upsertVehicleStateByEmail",
    "addSavedOfferByEmail",
    "removeSavedOfferByEmail",
    "addGarageVehicleByEmail",
    "removeGarageVehicleByEmail",
  ];

  test("ninguna de las ocho se traga el error de Postgres", () => {
    const tragan = [];

    for (const fn of ESCRIBEN) {
      const cuerpo = cuerpoDe(TIENDA, fn);
      // El `catch` solo puede existir si no oculta el fallo, y aquí no hay
      // ninguno que haga eso: lo correcto es no tenerlo.
      if (/\}\s*catch/.test(cuerpo)) tragan.push(fn);
    }

    assert.deepEqual(
      tragan,
      [],
      `estas escriben datos de alguien y tienen un catch: ${tragan.join(", ")}.\n` +
        "Un guardado que falla no puede contestar en pasado. Quita el catch y deja que " +
        "levante; el manejador ya lo recoge y contesta 503."
    );
  });

  test("y la regla vale para cualquiera que se añada mañana", () => {
    /*
     * La general, sobre todo el fichero: ninguna función que empiece por
     * add/upsert/remove/delete y hable con Postgres puede tener un catch que
     * devuelva un valor.
     */
    const culpables = [];
    const re = /(?:async )?function ((?:add|upsert|remove|delete)[A-Za-z0-9_]*ByEmail)\s*\(/g;
    let m;
    while ((m = re.exec(TIENDA))) {
      const cuerpo = cuerpoDe(TIENDA, m[1]);
      if (/\}\s*catch\s*\{\s*return/.test(cuerpo)) culpables.push(m[1]);
    }

    assert.deepEqual(
      culpables,
      [],
      `estas devuelven un valor desde un catch: ${culpables.join(", ")}. ` +
        "Eso hace indistinguible «no se pudo guardar» de «no hay nada»."
    );
  });

  test("el manejador recoge lo que levanta y no se lo calla", () => {
    assert.match(
      MANEJADOR,
      /catch \(err\)[\s\S]{0,400}status\(503\)/,
      "las funciones de datos ya levantan, así que el manejador necesita un catch " +
        "que lo diga. Un 503, que es lo que se reintenta."
    );
    assert.match(
      MANEJADOR,
      /registra\("billing-account"/,
      "y el error tiene que quedar guardado, no solo contestado."
    );
  });
});

describe("la tasación no se inventa un mercado", () => {
  test("readPostgresInventory levanta en vez de devolver una lista vacía", () => {
    const cuerpo = cuerpoDe(INVENTARIO, "readPostgresInventory");

    assert.match(
      cuerpo,
      /catch \(err\)[\s\S]*throw err/,
      "si devuelve [] al fallar, «no hay comparables» y «no he podido preguntar» " +
        "son la misma respuesta, y quien llama elige mal."
    );
  });

  test("con base de datos, el universo no sale nunca del fichero del repositorio", () => {
    const cuerpo = cuerpoDe(INVENTARIO, "readInventoryUniverse");

    /*
     * `readLocalInventory()` puede aparecer una sola vez, y solo dentro del
     * `if (!hasPostgresConnection())` del principio: sin base no hay mercado que
     * consultar y el fichero es para desarrollar en local.
     */
    const veces = (cuerpo.match(/readLocalInventory\(\)/g) || []).length;
    assert.equal(
      veces,
      1,
      `readLocalInventory() aparece ${veces} veces en readInventoryUniverse. ` +
        "Solo puede estar en la salida de «no hay base de datos»: en cualquier otro " +
        "sitio significa tasar contra 2.749 ofertas del 14 de agosto."
    );

    const antes = cuerpo.slice(0, cuerpo.indexOf("readLocalInventory()"));
    assert.match(
      antes,
      /if \(!hayBase\)/,
      "la única llamada a readLocalInventory() tiene que ir detrás de la comprobación " +
        "de que no hay base de datos."
    );

    /*
     * Y que lo que se comprueba exista de verdad.
     *
     * Esta prueba pasó mientras el código estaba roto: buscaba el texto
     * `if (!hasPostgresConnection())` y lo encontraba, pero esa función no existe
     * en `inventoryStore.js` —está en `billingStore.js`, y los confundí—. Cada
     * llamada levantaba un `ReferenceError` y la tasación estuvo caída horas.
     *
     * Comprobar que una cadena está escrita no es comprobar que la función
     * exista. Así que ahora se mira que el identificador que se usa esté
     * declarado en el mismo fichero.
     */
    // Sin punto delante: `Array.isArray(` es un método, no una función suelta.
    const usados = [...cuerpo.matchAll(/(?<![.\w])([a-z][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1]);
    const declarados = new Set([
      ...[...INVENTARIO.matchAll(/function\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]),
      ...[...INVENTARIO.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]),
      ...[...INVENTARIO.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require/g)]
        .flatMap((m) => m[1].split(",").map((x) => x.trim().split(":").pop().trim())),
    ]);
    const DE_NODE = new Set(["require", "Number", "String", "Boolean", "Array", "Object", "parseInt",
      "parseFloat", "isNaN", "map", "filter", "slice", "join", "push", "split", "trim", "test",
      "replace", "includes", "some", "every", "sort", "find", "round", "max", "min", "abs", "catch",
      "then", "if", "for", "while", "return", "await", "async", "function", "typeof", "normalizeToken"]);

    const sinDeclarar = [...new Set(usados)].filter((u) => !declarados.has(u) && !DE_NODE.has(u));
    assert.deepEqual(
      sinDeclarar,
      [],
      `readInventoryUniverse llama a algo que no está declarado en inventoryStore.js: ${sinDeclarar.join(", ")}. ` +
        "Eso es un ReferenceError en cada llamada, y es exactamente lo que pasó."
    );
  });

  test("cero comparables se dice, no se rellena", () => {
    const cuerpo = cuerpoDe(INVENTARIO, "readInventoryUniverse");
    assert.match(
      cuerpo,
      /source: "postgres-sin-comparables"/,
      "un perfil sin comparables tiene que salir identificado, para que quien mire " +
        "el informe sepa que la lista está vacía porque no hay, no porque falló algo."
    );
  });
});
