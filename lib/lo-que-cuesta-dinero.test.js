"use strict";

/**
 * Los dos endpoints que cuestan dinero, con freno.
 *
 * ## Qué pasaba
 *
 * `/api/analyze` y `/api/find-listing` eran los dos más caros del sistema y
 * estaban **abiertos a Internet sin sesión y sin freno**.
 *
 * El de análisis es el grave: acepta `body.prompt` —una cadena arbitraria de
 * quien llama— y la manda a Gemini con la clave del proyecto. El navegador
 * construye el prompt entero y el servidor lo relaya sin mirarlo. O sea:
 * cualquiera podía usar la clave de Gemini como si fuera suya, sin límite.
 *
 * Y lo que más duele no es la factura. Si alguien genera contenido que viola las
 * políticas de Google a través de esa clave, **el incumplimiento es del
 * proyecto**, y eso no se paga: se pierde el servicio.
 *
 * Además, al agotarse la cuota el análisis cae al respaldo determinista, que
 * contesta 200 con un análisis de aspecto normal. Quemar la cuota empeora el
 * producto **sin que nada dé error**.
 *
 * El de búsqueda golpea siete portales, DuckDuckGo y r.jina.ai durante hasta 300
 * segundos. Ahí lo caro es que alguien puede hacer que **los portales de los que
 * depende el producto bloqueen las IPs de Vercel**.
 *
 * ## Por qué freno y no sesión
 *
 * El cuestionario no exige sesión —comprobado— así que pedirla rompería el flujo
 * anónimo, que es por donde entra la gente. El freno no cambia nada para quien
 * usa la web.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  seHaPasado,
  elPromptEsEnorme,
  LIMITES,
  TOPE_DEL_PROMPT,
  deQuienViene,
} = require("./lo-que-cuesta-dinero");

const RAIZ = path.join(__dirname, "..");

/**
 * Un `res` que apunta lo que le piden, sin red.
 */
function unaRespuesta() {
  const apuntes = { estado: 0, cuerpo: null, cabeceras: {} };
  return {
    apuntes,
    setHeader(k, v) { apuntes.cabeceras[k] = v; },
    status(n) { apuntes.estado = n; return this; },
    json(c) { apuntes.cuerpo = c; return this; },
  };
}

/**
 * Un pool de mentira que cuenta como cuenta el de verdad.
 *
 * No se prueba contra la base: el freno real ya tiene sus pruebas
 * (`lib/freno.test.js`), y lo que hace falta comprobar aquí es que estos dos
 * endpoints lo usan bien y se salen cuando toca.
 */
function unPoolQueCuenta() {
  const cuentas = new Map();
  return {
    cuentas,
    async query(sql, valores) {
      const clave = `${valores[0]}|${valores[1]}`;
      const n = (cuentas.get(clave) || 0) + 1;
      cuentas.set(clave, n);
      /*
       * Los nombres son los que de verdad devuelve el `RETURNING` de `freno.js`:
       * `intentos` y `quedan`. Empecé escribiendo `faltan` y la prueba pasaba
       * igual —`enSegundos` quedaba en `undefined` y el `|| 60` lo tapaba—, que
       * es exactamente cómo una imitación mal hecha hace que una prueba mienta.
       */
      return { rows: [{ intentos: n, quedan: 30 }] };
    },
  };
}

describe("el tope del prompt", () => {
  test("uno normal pasa", () => {
    // El de un perfil completo mide unos 6.000 caracteres.
    const res = unaRespuesta();
    assert.equal(elPromptEsEnorme("x".repeat(6000), res), false);
    assert.equal(res.apuntes.estado, 0, "no debería haber contestado");
  });

  test("uno enorme se rechaza con 400", () => {
    const res = unaRespuesta();
    assert.equal(elPromptEsEnorme("x".repeat(TOPE_DEL_PROMPT + 1), res), true);
    assert.equal(res.apuntes.estado, 400);
  });

  test("y justo en el tope todavía pasa", () => {
    const res = unaRespuesta();
    assert.equal(elPromptEsEnorme("x".repeat(TOPE_DEL_PROMPT), res), false);
  });

  test("lo que no es una cadena no lo juzga esto", () => {
    /*
     * De eso se encarga el `if (!prompt || typeof prompt !== "string")` que ya
     * había. Aquí solo se mira el tamaño.
     */
    const res = unaRespuesta();
    for (const cosa of [null, undefined, 42, {}, []]) {
      assert.equal(elPromptEsEnorme(cosa, res), false);
    }
  });

  test("el tope deja sitio de sobra para el prompt real", () => {
    // 6.000 medidos. Si alguien lo baja por debajo, el producto deja de funcionar.
    assert.ok(TOPE_DEL_PROMPT > 20000, "demasiado bajo: cortaría prompts buenos");
  });
});

describe("el freno", () => {
  test("deja pasar mientras quepa", async () => {
    const pool = unPoolQueCuenta();
    const req = { headers: { "x-forwarded-for": "1.2.3.4" } };

    for (let n = 0; n < LIMITES.analisis.veces; n += 1) {
      const res = unaRespuesta();
      assert.equal(await seHaPasado(pool, req, res, "analisis"), false, `el intento ${n + 1} debería pasar`);
    }
  });

  test("y corta al pasarse, con 429 y Retry-After", async () => {
    const pool = unPoolQueCuenta();
    /*
     * Con su sesión, para que cuente contra la cuota de la PERSONA.
     *
     * Sin galleta el tope que manda es el de la IP, que es mucho más alto a
     * propósito: detrás de una sola dirección móvil puede haber miles.
     */
    const req = {
      headers: { "x-forwarded-for": "1.2.3.4", cookie: "moveadvisor_session=abc123" },
    };

    for (let n = 0; n < LIMITES.analisis.veces; n += 1) {
      await seHaPasado(pool, req, unaRespuesta(), "analisis");
    }

    const res = unaRespuesta();
    assert.equal(await seHaPasado(pool, req, res, "analisis"), true);
    assert.equal(res.apuntes.estado, 429);
    // Y con los segundos que de verdad quedan, no con el 60 de reserva.
    assert.equal(res.apuntes.cabeceras["Retry-After"], "30");
    // Y el mensaje es para una persona, no para un registro.
    assert.match(res.apuntes.cuerpo.error, /vuelve a intentarlo/i);
  });

  test("cada IP tiene su cuenta", async () => {
    // Si no, una oficina entera compartiría el límite de la primera persona.
    const pool = unPoolQueCuenta();

    for (let n = 0; n < LIMITES.analisis.veces + 5; n += 1) {
      await seHaPasado(pool, { headers: { "x-forwarded-for": "1.1.1.1" } }, unaRespuesta(), "analisis");
    }

    const otra = unaRespuesta();
    assert.equal(
      await seHaPasado(pool, { headers: { "x-forwarded-for": "2.2.2.2" } }, otra, "analisis"),
      false
    );
  });

  test("y los dos endpoints cuentan por separado", async () => {
    /*
     * Analizar y buscar son dos gastos distintos: haber analizado mucho no debe
     * impedir buscar.
     */
    const pool = unPoolQueCuenta();
    const req = { headers: { "x-forwarded-for": "1.2.3.4" } };

    for (let n = 0; n < LIMITES.analisis.veces + 5; n += 1) {
      await seHaPasado(pool, req, unaRespuesta(), "analisis");
    }

    assert.equal(await seHaPasado(pool, req, unaRespuesta(), "busqueda"), false);
  });

  test("si la base no contesta, SE DEJA PASAR", async () => {
    /*
     * Cerrar la puerta por un fallo del portero dejaría el producto caído. El
     * riesgo de un abuso durante ese rato es menor que el de no funcionar.
     */
    const roto = { async query() { throw new Error("la base no contesta"); } };
    const res = unaRespuesta();

    assert.equal(await seHaPasado(roto, { headers: {} }, res, "analisis"), false);
    assert.equal(res.apuntes.estado, 0, "no debería haber contestado nada");
  });

  test("y sin pool tampoco se bloquea", async () => {
    // En local puede no haber base configurada.
    assert.equal(await seHaPasado(null, { headers: {} }, unaRespuesta(), "analisis"), false);
  });

  test("un ámbito que no existe no bloquea", async () => {
    assert.equal(await seHaPasado(unPoolQueCuenta(), { headers: {} }, unaRespuesta(), "inventado"), false);
  });
});

describe("de quién viene", () => {
  test("la primera del x-forwarded-for, que es la del cliente", () => {
    /*
     * Vercel añade su propia IP detrás. Coger la última contaría todas las
     * peticiones del mundo en la misma cuenta.
     */
    assert.equal(deQuienViene({ headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1, 10.0.0.2" } }), "9.9.9.9");
  });

  test("y si no hay cabecera, el socket", () => {
    assert.equal(deQuienViene({ headers: {}, socket: { remoteAddress: "5.5.5.5" } }), "5.5.5.5");
  });

  test("y si no hay nada, una clave que no es vacía", () => {
    /*
     * `freno.js` deja pasar con clave vacía. Sin esto, quien llegara sin IP no
     * tendría freno ninguno.
     */
    assert.equal(deQuienViene({}), "desconocida");
    assert.equal(deQuienViene(null), "desconocida");
  });
});

describe("y los dos endpoints lo usan de verdad", () => {
  test("analyze frena y acota el prompt, antes de llamar a Gemini", () => {
    const fuente = fs.readFileSync(path.join(RAIZ, "api", "analyze.js"), "utf8");

    assert.match(fuente, /if \(elPromptEsEnorme\(prompt, res\)\) return undefined;/);
    assert.match(fuente, /if \(await seHaPasado\(getPostgresPool\(\), req, res, "analisis"\)\) return undefined;/);

    // Y antes de la llamada al modelo, no después.
    const freno = fuente.indexOf('seHaPasado(getPostgresPool(), req, res, "analisis")');
    const modelo = fuente.indexOf("generativelanguage.googleapis.com/v1beta/models");
    assert.ok(freno > 0 && modelo > 0);
    assert.ok(freno < modelo, "el freno va después de llamar al modelo: no sirve de nada");
  });

  test("y el tope se mira antes del freno", () => {
    // Rechazar algo enorme no debe gastarle un intento a quien se ha equivocado.
    const fuente = fs.readFileSync(path.join(RAIZ, "api", "analyze.js"), "utf8");
    assert.ok(fuente.indexOf("elPromptEsEnorme") < fuente.indexOf('seHaPasado(getPostgresPool(), req, res, "analisis")'));
  });

  test("find-listing frena antes de salir a los portales", () => {
    const fuente = fs.readFileSync(path.join(RAIZ, "api", "find-listing.js"), "utf8");

    assert.match(fuente, /if \(await seHaPasado\(getPostgresPool\(\), req, res, "busqueda"\)\) return;/);

    const freno = fuente.indexOf('seHaPasado(getPostgresPool(), req, res, "busqueda")');
    const salida = fuente.indexOf("html.duckduckgo.com");
    assert.ok(freno > 0 && salida > 0);
    // DuckDuckGo se declara arriba como constante; lo que importa es que el freno
    // esté en el manejador, antes del try que hace el trabajo.
    assert.ok(fuente.indexOf("module.exports = async function handler") < freno);
  });
});

/**
 * Una IP no es una persona, y contar como si lo fuera deja gente fuera.
 *
 * ## Lo que pasaba
 *
 * El freno contaba solo por IP: doce busquedas a la hora por direccion. En una
 * conexion domestica eso sobra. Pero en **datos moviles** los operadores meten
 * miles de clientes detras de una sola IP, y en una oficina o un concesionario
 * sale toda la red por la misma. Doce personas con la misma operadora dejaban
 * sin buscar a la decimotercera, que no habia hecho nada: veia «has hecho
 * muchas consultas seguidas» habiendo hecho una.
 *
 * Salio probando en produccion el 1 de octubre de 2026: entre las pruebas de
 * Ana y seis busquedas mias desde su misma conexion se agoto la cuota, y la
 * pantalla decia que no habia ofertas. No es que no las hubiera.
 *
 * ## Como se cuenta ahora
 *
 * Quien ha entrado con su cuenta gasta de SU cuota, vaya por donde vaya. La IP
 * sigue contando siempre, con un techo mucho mas alto, como red de seguridad:
 * ahi no se raciona a nadie, se cierra la puerta a usar la clave del proyecto
 * como un servicio gratuito desde un script.
 */
describe("la cuota es de la persona, no de su red", () => {
  const { LO_QUE_AGUANTA_UNA_IP, quienEs, comoSeLeDiceQueEspere } = require("./lo-que-cuesta-dinero");

  const conSesion = (testigo) => ({
    headers: { "x-forwarded-for": "1.2.3.4", cookie: "moveadvisor_session=" + testigo },
  });

  test("dos personas en la misma IP no se estorban", async () => {
    const pool = unPoolQueCuenta();

    // La primera agota SU cuota.
    for (let n = 0; n < LIMITES.busqueda.veces; n += 1) {
      await seHaPasado(pool, conSesion("ana"), unaRespuesta(), "busqueda");
    }
    assert.equal(await seHaPasado(pool, conSesion("ana"), unaRespuesta(), "busqueda"), true);

    // Y la de al lado, con la misma IP, puede buscar.
    assert.equal(await seHaPasado(pool, conSesion("otro"), unaRespuesta(), "busqueda"), false);
  });

  test("pero la IP tiene su techo, para que no sea una puerta abierta", async () => {
    /*
     * Si la sesion diera cuota ilimitada, bastaria inventarse una galleta
     * nueva en cada peticion para gastar la clave del proyecto sin freno.
     */
    const pool = unPoolQueCuenta();

    for (let n = 0; n < LO_QUE_AGUANTA_UNA_IP.busqueda.veces; n += 1) {
      await seHaPasado(pool, conSesion("inventada-" + n), unaRespuesta(), "busqueda");
    }

    assert.equal(await seHaPasado(pool, conSesion("inventada-nueva"), unaRespuesta(), "busqueda"), true);
  });

  test("y el techo de la IP es bastante mas alto que el de una persona", () => {
    // Si no, no sirve de nada: la red compartida seguiria quedandose corta.
    assert.ok(LO_QUE_AGUANTA_UNA_IP.busqueda.veces >= LIMITES.busqueda.veces * 3);
    assert.ok(LO_QUE_AGUANTA_UNA_IP.analisis.veces >= LIMITES.analisis.veces * 3);
  });

  test("quien viene sin cuenta gasta del de la IP, no del de una persona", async () => {
    const pool = unPoolQueCuenta();
    const anonimo = { headers: { "x-forwarded-for": "9.9.9.9" } };

    for (let n = 0; n < LIMITES.busqueda.veces + 1; n += 1) {
      assert.equal(await seHaPasado(pool, anonimo, unaRespuesta(), "busqueda"), false,
        "el intento " + (n + 1) + " deberia pasar: el tope anonimo es el de la IP");
    }
  });

  test("la sesion no se guarda en claro", () => {
    /*
     * Esta clave acaba escrita en `frenos_de_ritmo`. Una sesion en claro en una
     * tabla es una sesion que se puede robar de ahi.
     */
    const clave = quienEs(conSesion("un-testigo-secreto"));

    assert.ok(clave);
    assert.equal(clave.includes("un-testigo-secreto"), false);
  });

  test("y sin galleta no hay persona a la que contar", () => {
    assert.equal(quienEs({ headers: {} }), null);
    assert.equal(quienEs({ headers: { cookie: "otra=x" } }), null);
    assert.equal(quienEs({ headers: { cookie: "moveadvisor_session=" } }), null);
  });

  test("el aviso dice cuanto falta, no «un momento»", () => {
    /*
     * Quien lee «espera un momento» vuelve a los diez segundos, se lo encuentra
     * otra vez y se va creyendo que esta roto.
     */
    assert.match(comoSeLeDiceQueEspere(296), /5 minutos/);
    assert.match(comoSeLeDiceQueEspere(30), /un minuto/);
    assert.doesNotMatch(comoSeLeDiceQueEspere(296), /un momento/i);
  });
});
