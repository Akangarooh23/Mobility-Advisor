"use strict";

/**
 * Que alguien se entere.
 *
 * ## Qué había
 *
 * Nada. Ninguna dependencia de seguimiento de errores, **16 `catch {}`** y **35
 * `.catch(() => {})`** que se tragan el error del todo, y 8 `console.error` que
 * van a los registros de Vercel, que caducan y no avisan a nadie.
 *
 * El sistema de detección de fallos era Ana mirando la pantalla. Y ya falló dos
 * veces: el PDF de factura llevaba roto en producción y el aviso de cookies no
 * salía, y las dos se descubrieron por casualidad.
 *
 * ## Los tres que importaban
 *
 * No todos los `catch` vacíos son iguales, y mirarlos uno a uno era el trabajo:
 *
 *   · **facturación** se tragaba el `UPDATE` que pone `plan_id = 'plus'`. Stripe
 *     cobra y la base puede no enterarse: la persona ha pagado y la web le sigue
 *     tratando como gratuita, sin una línea en ningún sitio;
 *   · **publicar un coche** se traga **seis** `UPDATE` —entre ellos el precio y
 *     la marca de «publicado»— y después responde `{ ok: true }`;
 *   · **la vista previa al compartir** se tragaba la consulta de la oferta, así
 *     que «la base no contesta» y «ese coche no existe» acababan en lo mismo: un
 *     redirigido al listado, que es el fallo que describe su propio comentario.
 *
 * Y los cinco avisos del cron de recordatorios, que es peor de lo que parece: un
 * cron que manda avisos y se traga los fallos es invisible por definición, porque
 * nadie espera respuesta y nadie nota que no llegó.
 *
 * ## Los que se quedan callados a propósito
 *
 * Los cinco de `api/analyze.js` son una cascada de intentos de interpretar el
 * JSON que devuelve el modelo: `JSON.parse`, luego `JSON5`, luego `jsonrepair`,
 * luego dos arreglos a mano. Que uno falle es lo normal y lo siguiente lo
 * intenta. Registrarlos sería ruido que tapa lo demás.
 *
 * Y los `pool.end()` dentro de un `finally`: cerrar una conexión que ya se está
 * cayendo, después de haber informado del error de verdad.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { registra, seTragaba, conecta, tapaElCorreo } = require("./registra");

const RAIZ = path.join(__dirname, "..");

/** Se queda con lo que se escribe en `stderr` mientras corre algo. */
function loQueEscribe(hazlo) {
  const escrito = [];
  const antes = console.error;
  console.error = (...args) => escrito.push(args.join(" "));
  try {
    hazlo();
  } finally {
    console.error = antes;
  }
  return escrito;
}

describe("deja una línea que se puede buscar", () => {
  test("con el sitio, la hora y el mensaje", () => {
    const escrito = loQueEscribe(() => registra("publicar: el precio", new Error("se cayó")));

    assert.equal(escrito.length, 1);
    const linea = JSON.parse(escrito[0]);
    assert.equal(linea.donde, "publicar: el precio");
    assert.equal(linea.mensaje, "se cayó");
    assert.equal(linea.nivel, "error");
    assert.ok(Date.parse(linea.cuando) > 0);
  });

  test("y es UNA línea de JSON, que es lo que permite buscar en Vercel", () => {
    const escrito = loQueEscribe(() => registra("algo", new Error("con\nsaltos\ndentro")));

    assert.equal(escrito.length, 1);
    assert.ok(!escrito[0].includes("\n"), "la línea no puede llevar saltos");
    assert.doesNotThrow(() => JSON.parse(escrito[0]));
  });

  test("con el contexto que se le dé, que es con lo que se encuentra el caso", () => {
    const escrito = loQueEscribe(() =>
      registra("publicar: el precio", new Error("se cayó"), { vehicleId: "veh-7", price: "15000" })
    );

    const linea = JSON.parse(escrito[0]);
    assert.equal(linea.contexto.vehicleId, "veh-7");
    assert.equal(linea.contexto.price, "15000");
  });

  test("y con el código de Postgres, que dice más que el mensaje", () => {
    /*
     * 23505 es clave duplicada, 42P01 tabla que no existe, 57014 consulta
     * cancelada por tiempo. Con el código se sabe qué pasó sin adivinar.
     */
    const error = new Error("duplicate key");
    error.code = "23505";
    error.constraint = "moveadvisor_users_email_key";
    error.table = "moveadvisor_users";

    const linea = JSON.parse(loQueEscribe(() => registra("registro", error))[0]);

    assert.equal(linea.codigo, "23505");
    assert.equal(linea.restriccion, "moveadvisor_users_email_key");
    assert.equal(linea.tabla, "moveadvisor_users");
  });

  test("y con unas pocas líneas de la pila, no con todas", () => {
    // La pila entera de un serverless son cuarenta líneas de node_modules.
    const linea = JSON.parse(loQueEscribe(() => registra("algo", new Error("uy")))[0]);

    assert.ok(linea.pila.split("\n").length <= 6);
  });
});

describe("los correos no se escriben enteros", () => {
  test("se deja el dominio y dos letras", () => {
    /*
     * Un registro de errores acaba en sitios donde no debería haber datos
     * personales, y se guarda mucho tiempo. Con esto se puede seguir un caso sin
     * dejar la dirección puesta.
     */
    assert.equal(tapaElCorreo("ana@popcar.es"), "an***@popcar.es");
    /*
     * El dominio es example.com y no gmail.com a proposito: este repositorio es
     * publico, y `comprueba-marca` tira la validacion cuando encuentra escrito a
     * mano un correo de un proveedor de verdad. Aqui daba igual que la direccion
     * fuera inventada, porque quien la lea de fuera no sabe que lo es.
     *
     * example.com esta reservado por la IANA justo para esto, asi que no puede
     * ser de nadie.
     */
    assert.equal(tapaElCorreo("cliente.largo@example.com"), "cl***@example.com");
  });

  test("también dentro del mensaje del error", () => {
    const linea = JSON.parse(
      loQueEscribe(() => registra("acceso", new Error("no existe ana@popcar.es")))[0]
    );

    assert.ok(!linea.mensaje.includes("ana@popcar.es"));
    assert.ok(linea.mensaje.includes("an***@popcar.es"));
  });

  test("y si hay varios, todos", () => {
    assert.equal(
      tapaElCorreo("de ana@popcar.es a luis@otro.com"),
      "de an***@popcar.es a lu***@otro.com"
    );
  });

  test("lo que no es un correo se queda como está", () => {
    assert.equal(tapaElCorreo("coche @ 15.000 euros"), "coche @ 15.000 euros");
    assert.equal(tapaElCorreo(""), "");
    assert.equal(tapaElCorreo(null), "");
  });
});

describe("nunca se cae", () => {
  test("ni con un error que no es un Error", () => {
    for (const cosa of [null, undefined, "una cadena", 42, { a: 1 }, []]) {
      assert.doesNotThrow(() => loQueEscribe(() => registra("algo", cosa)));
    }
  });

  test("ni con un objeto con referencias circulares", () => {
    const circular = {};
    circular.yo = circular;

    assert.doesNotThrow(() => loQueEscribe(() => registra("algo", circular)));
  });

  test("ni con un contexto que no se puede serializar", () => {
    const circular = {};
    circular.yo = circular;

    assert.doesNotThrow(() => loQueEscribe(() => registra("algo", new Error("uy"), circular)));
  });

  test("y si el servicio enchufado se cae, la línea ya está escrita", () => {
    /*
     * Un registrador que se cae es peor que no tener ninguno: taparía el error de
     * verdad con el suyo.
     */
    conecta(() => { throw new Error("Sentry no contesta"); });

    const escrito = loQueEscribe(() => {
      assert.doesNotThrow(() => registra("algo", new Error("uy")));
    });

    assert.equal(escrito.length, 1);
    conecta(null);
  });
});

describe("el enchufe para un servicio de verdad", () => {
  test("recibe la misma línea que los registros", () => {
    const recibidas = [];
    conecta((linea) => recibidas.push(linea));

    loQueEscribe(() => registra("publicar: el precio", new Error("se cayó"), { vehicleId: "veh-7" }));

    assert.equal(recibidas.length, 1);
    assert.equal(recibidas[0].donde, "publicar: el precio");
    assert.equal(recibidas[0].contexto.vehicleId, "veh-7");
    conecta(null);
  });

  test("y sin enchufar, no se manda a ninguna parte", () => {
    conecta(null);
    assert.doesNotThrow(() => loQueEscribe(() => registra("algo", new Error("uy"))));
  });
});

describe("seTragaba, para las promesas", () => {
  test("se traga el error igual que antes, pero lo deja escrito", async () => {
    /*
     * Lo importante es que NO cambia el flujo: lo que se tragaba un error sigue
     * tragándoselo, y nadie recibe un 500 nuevo por esto.
     */
    let escrito = [];
    const antes = console.error;
    console.error = (...args) => escrito.push(args.join(" "));

    try {
      await Promise.reject(new Error("la base no contesta")).catch(
        seTragaba("publicar: el precio", { vehicleId: "veh-7" })
      );
    } finally {
      console.error = antes;
    }

    assert.equal(escrito.length, 1);
    const linea = JSON.parse(escrito[0]);
    assert.equal(linea.donde, "publicar: el precio");
    assert.equal(linea.contexto.vehicleId, "veh-7");
  });
});

/* ------------------------------------------------------------------ *
 * Y el vigilante: los silencios no pueden aumentar.
 * ------------------------------------------------------------------ */

function ficherosDe(carpeta) {
  const encontrados = [];
  const pendientes = [path.join(RAIZ, carpeta)];

  while (pendientes.length) {
    const aqui = pendientes.pop();
    if (!fs.existsSync(aqui)) continue;

    for (const entrada of fs.readdirSync(aqui, { withFileTypes: true })) {
      if (entrada.name === "node_modules") continue;
      const completo = path.join(aqui, entrada.name);
      if (entrada.isDirectory()) pendientes.push(completo);
      else if (entrada.name.endsWith(".js") && !entrada.name.endsWith(".test.js")) {
        encontrados.push(completo);
      }
    }
  }

  return encontrados;
}

/** Un error que se traga sin decir nada, en sus dos formas. */
const SILENCIO = /\}\s*catch\s*\{\s*\}|\.catch\(\(\)\s*=>\s*\{\s*\}\)/g;

/**
 * El techo, medido hoy.
 *
 * Este número **baja, no sube**. Cada uno que queda es una decisión: o se mira y
 * se le pone un `registra`, o se deja callado a propósito y se explica por qué.
 *
 * `api/analyze.js` se queda con sus cinco a propósito: son la cascada de intentos
 * de interpretar el JSON del modelo, y que uno falle es lo normal.
 */
/*
 * Bajado de 36 a 34 el 1-oct-2026, al sacar `el-detalle-no-sale.js` a la lista de
 * arriba. Sus tres `catch` son del caso base y contarlos inflaba el techo: un trinquete
 * con holgura no es un trinquete, es un número.
 */
const TECHO = 34;

/**
 * Los dos ficheros del propio registro, que no cuentan.
 *
 * Un `catch {}` aquí dentro es de otra categoría: es el **caso base**. Si
 * `registra` intentara registrar su propio fallo al registrar, o
 * `errores-guardados` intentara guardar el fallo de guardar, entraría en bucle. Y
 * un registrador que se cae es peor que no tener ninguno, porque taparía el error
 * de verdad con el suyo.
 *
 * Se nombran uno a uno para que añadir un tercero cueste escribirlo.
 *
 * ── El tercero, y por qué ────────────────────────────────────────────────────
 *
 * `el-detalle-no-sale.js` es la misma categoría. Su trabajo es, literalmente, *apuntar
 * el error y devolver un texto que se pueda enseñar*, así que sus tres `catch` envuelven
 * la llamada a `registra` y no pueden hacer otra cosa que callarse:
 *
 *     try {
 *       const r = registra(donde, err, contexto);
 *       if (r && typeof r.catch === "function") r.catch(() => {});
 *     } catch {
 *       // `registra` no debe poder tumbar una respuesta.
 *     }
 *
 * Si ahí se intentara registrar el fallo de registrar, sería el bucle de arriba. Y lo
 * que está en juego es peor que un error sin apuntar: si eso levanta, el cliente se
 * queda **sin respuesta ninguna**, que es lo que este módulo existe para evitar.
 */
const EL_PROPIO_REGISTRO = ["registra.js", "errores-guardados.js", "el-detalle-no-sale.js"];

describe("los silencios solo pueden menguar", () => {
  test(`en api/ y lib/ hay como mucho ${TECHO}`, () => {
    let cuantos = 0;
    const porFichero = [];

    for (const carpeta of ["api", "lib"]) {
      for (const fichero of ficherosDe(carpeta)) {
        if (EL_PROPIO_REGISTRO.includes(path.basename(fichero))) continue;

        const n = (fs.readFileSync(fichero, "utf8").match(SILENCIO) || []).length;
        if (n) {
          cuantos += n;
          porFichero.push(`${path.relative(RAIZ, fichero)}: ${n}`);
        }
      }
    }

    assert.ok(
      cuantos <= TECHO,
      `hay ${cuantos} errores que se tragan sin decir nada y el techo es ${TECHO}.\n` +
        "Este número baja, no sube. Si has añadido uno: o le pones un `registra`,\n" +
        "o explicas en un comentario por qué se queda callado.\n" +
        porFichero.join("\n")
    );
  });

  test("y los tres que costaban dinero ya no están callados", () => {
    /*
     * Éstos se comprueban por nombre y no por número, porque son los que
     * importan: si alguien vuelve a dejarlos mudos, el techo seguiría cuadrando.
     */
    const facturacion = fs.readFileSync(path.join(RAIZ, "lib", "api", "billing-account-handler.js"), "utf8");
    assert.ok(facturacion.includes("billing-account: activar el plan plus"));
    assert.ok(facturacion.includes("billing-account: preguntar a Stripe por la suscripcion"));

    const publicar = fs.readFileSync(path.join(RAIZ, "lib", "api", "vehicle-publish-handler.js"), "utf8");
    for (const cual of ["marcar is_listed", "desmarcar is_listed", "guardar el precio"]) {
      assert.ok(publicar.includes(`vehicle-publish: ${cual}`), `falta: ${cual}`);
    }

    const compartir = fs.readFileSync(path.join(RAIZ, "lib", "api", "marketplace-og-handler.js"), "utf8");
    assert.ok(compartir.includes("marketplace-og: buscar la oferta de VO"));
  });

  test("y los cinco avisos del cron tienen nombre, no número", () => {
    /*
     * Empezaron siendo «aviso push 1 de 5», que no sirve para buscar nada. Lo que
     * hace falta saber es a quién no le llegó el aviso.
     */
    const cron = fs.readFileSync(path.join(RAIZ, "lib", "api", "cron-appointment-reminders-handler.js"), "utf8");

    assert.ok(!cron.includes("aviso push 1 de 5"));
    assert.equal((cron.match(/seTragaba\("cron-recordatorios: /g) || []).length, 5);
  });
});
