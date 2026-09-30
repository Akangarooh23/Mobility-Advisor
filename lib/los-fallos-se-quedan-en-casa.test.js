"use strict";

/**
 * Los fallos se quedan en casa.
 *
 * ## Por qué esto y no Sentry
 *
 * Las tres piezas difíciles ya estaban: recoger es un endpoint, agrupar es un
 * `GROUP BY` y avisar es un cron con Resend —y ya había siete corriendo—. Lo que
 * se gana montándolo en casa es que los datos no salen: un error del navegador
 * lleva la pantalla, el coche que se estaba mirando y a veces el correo de quien
 * lo sufrió, y mandar eso a otra empresa es un tratamiento que hay que documentar.
 *
 * Y no hay cupo. Los planes gratuitos tienen tope de errores al mes, y el día que
 * algo se rompa de verdad es justo el día que genera cincuenta mil.
 *
 * ## Lo que se prueba aquí
 *
 * Tres cosas, y la primera es de seguridad.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { laHuella } = require("./errores-guardados");
const { seGuardanEnLaBase } = require("./registra");

const RAIZ = path.join(__dirname, "..");

describe("sin la variable puesta, NO se escribe en la base", () => {
  /*
   * Ésta es la importante, y no es prudencia genérica: el entorno local de esta
   * máquina apunta a la base de PRODUCCIÓN. Con el guardado encendido por
   * omisión, cualquier prueba que llame a `registra` metería filas en la tabla de
   * errores de verdad, y las pruebas llaman a `registra` a propósito.
   */
  test("apagado mientras no valga exactamente «1»", () => {
    const antes = process.env.GUARDA_LOS_ERRORES;

    try {
      for (const valor of [undefined, "", "0", "no", "true", "si", " 1 x"]) {
        if (valor === undefined) delete process.env.GUARDA_LOS_ERRORES;
        else process.env.GUARDA_LOS_ERRORES = valor;

        assert.equal(seGuardanEnLaBase(), false, `con ${JSON.stringify(valor)} debería estar apagado`);
      }

      process.env.GUARDA_LOS_ERRORES = "1";
      assert.equal(seGuardanEnLaBase(), true);

      // Con espacios alrededor también, que es como se pega en un panel.
      process.env.GUARDA_LOS_ERRORES = " 1 ";
      assert.equal(seGuardanEnLaBase(), true);
    } finally {
      if (antes === undefined) delete process.env.GUARDA_LOS_ERRORES;
      else process.env.GUARDA_LOS_ERRORES = antes;
    }
  });

  test("y `registra` no carga el módulo de la base cuando está apagado", () => {
    /*
     * El `require` es perezoso justo por esto: mientras no haya que guardar, ni se
     * carga Postgres. Si alguien lo sube arriba del fichero, las pruebas empiezan
     * a abrir conexiones contra producción sin que nadie lo pida.
     */
    const fuente = fs.readFileSync(path.join(__dirname, "registra.js"), "utf8");
    const arriba = fuente.slice(0, fuente.indexOf("function conecta"));

    assert.ok(!arriba.includes('require("./errores-guardados")'));
    assert.ok(!arriba.includes('require("./postgres")'));
    assert.ok(fuente.includes('require("./errores-guardados")'), "pero en algún sitio sí se pide");
  });
});

describe("la huella: qué hace que dos fallos sean el mismo", () => {
  test("los números no cuentan", () => {
    /*
     * Un id de coche distinto, un importe distinto o una hora distinta no son dos
     * fallos: son el mismo cuatrocientas veces. Sin esto, el aviso diría «400
     * fallos distintos» y no serviría para nada.
     */
    assert.equal(
      laHuella("publicar", "no existe el vehiculo 1234"),
      laHuella("publicar", "no existe el vehiculo 9999")
    );
  });

  test("los uuid tampoco", () => {
    assert.equal(
      laHuella("publicar", "oferta 3f2504e0-4f89-11d3-9a0c-0305e82c3301 no encontrada"),
      laHuella("publicar", "oferta 550e8400-e29b-41d4-a716-446655440000 no encontrada")
    );
  });

  test("ni los correos ya tapados", () => {
    // `registra` los tapa, pero deja el dominio: dos dominios no son dos fallos.
    assert.equal(
      laHuella("acceso", "no existe an***@popcar.es"),
      laHuella("acceso", "no existe lu***@gmail.com")
    );
  });

  test("pero el sitio SÍ cuenta", () => {
    /*
     * El mismo mensaje desde dos sitios distintos son dos problemas distintos, y
     * juntarlos escondería uno de los dos.
     */
    assert.notEqual(laHuella("publicar", "la base no contesta"), laHuella("facturar", "la base no contesta"));
  });

  test("y el mensaje también", () => {
    assert.notEqual(laHuella("publicar", "la base no contesta"), laHuella("publicar", "falta el precio"));
  });

  test("y no se cae sin nada", () => {
    assert.doesNotThrow(() => laHuella());
    assert.doesNotThrow(() => laHuella(null, null));
    assert.ok(laHuella().includes("sin sitio"));
  });

  test("ni se hace enorme con un mensaje enorme", () => {
    // Va a una columna y a un GROUP BY: una huella de 100 kB no agrupa nada.
    const largo = "x".repeat(50000);
    assert.ok(laHuella("algo", largo).length < 400);
  });

  test("y un mensaje enorme no la deja pensando", () => {
    /*
     * Esta prueba nació de un fallo mío. El recorte estaba al FINAL, así que
     * `\S*\*\*\*@\S+` —la de los correos tapados— se ponía a retroceder sobre todo
     * el mensaje buscando un `***@` que no estaba: 2 ms con mil caracteres, 127 ms
     * con diez mil y **3,2 segundos con cincuenta mil**. Cuadrático.
     *
     * Y medio millón de caracteres no es raro: el cuerpo de una respuesta HTML que
     * alguien metió en un `new Error`. Eso habría colgado una función serverless
     * tres segundos, justo cuando ya estaba fallando algo.
     *
     * Se arregla recortando antes de las expresiones. El límite es generoso —cien
     * veces más de lo que tarda ahora— para que la prueba no falle por una máquina
     * lenta, pero pilla un retroceso cuadrático de sobra.
     */
    const enorme = "x".repeat(500000);
    const empezo = Date.now();
    laHuella("algo", enorme);

    assert.ok(Date.now() - empezo < 200, `tardó ${Date.now() - empezo} ms: hay retroceso`);
  });
});

describe("y las piezas están enchufadas", () => {
  test("el endpoint del navegador tiene su puerta", () => {
    /*
     * Vercel cobra por función, así que esto no es un fichero suelto en `api/`:
     * cuelga de `api/user`, que ya aloja `funnel-event` —que es lo mismo pero para
     * eventos— y las cinco tareas programadas.
     */
    const puerta = fs.readFileSync(path.join(RAIZ, "api", "user.js"), "utf8");
    assert.ok(puerta.includes('["error", "error"]'), "falta el alias");
    assert.ok(puerta.includes("error-del-navegador-handler"), "falta la ruta");

    const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));
    const regla = vercel.rewrites.find((r) => r.source === "/api/error");
    assert.ok(regla, "falta la regla en vercel.json");
    assert.equal(regla.destination, "/api/user?route=error");
  });

  test("el cron del aviso corre cada hora", () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));
    const cron = vercel.crons.find((c) => c.path.includes("cron-avisa-de-los-fallos"));

    assert.ok(cron, "el cron no está declarado");
    assert.match(cron.schedule, /^\d+ \* \* \* \*$/, "tiene que ser cada hora");

    const regla = vercel.rewrites.find((r) => r.source === "/api/cron-avisa-de-los-fallos");
    assert.ok(regla, "el cron no tiene regla: Vercel lo llamaría y daría 404");
  });

  test("y el interruptor de crons lo cubre", () => {
    /*
     * `CRON_ACTIVO=0` existe para el día que haya un segundo despliegue contra la
     * misma base. Un cron nuevo fuera de esa lista mandaría correos duplicados
     * justo en ese caso.
     */
    const puerta = fs.readFileSync(path.join(RAIZ, "api", "user.js"), "utf8");
    const lista = puerta.slice(puerta.indexOf("RUTAS_CRON = new Set("), puerta.indexOf("]);", puerta.indexOf("RUTAS_CRON")));

    assert.ok(lista.includes("cron-avisa-de-los-fallos"));
  });

  test("y todos los crons declarados tienen su regla", () => {
    // Uno sin regla es una llamada cada hora a un 404, y no se nota.
    const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));
    const sinRegla = vercel.crons
      .map((c) => c.path.split("?")[0])
      .filter((p) => !vercel.rewrites.some((r) => r.source === p));

    assert.deepEqual(sinRegla, []);
  });

  test("la migración crea la tabla y sus índices", () => {
    const sql = fs.readFileSync(
      path.join(RAIZ, "migrations", "0016-los-fallos-se-quedan-en-casa.sql"),
      "utf8"
    );

    assert.match(sql, /CREATE TABLE IF NOT EXISTS moveadvisor_errores/);
    // El de agrupar y el de «qué ha pasado hoy».
    assert.match(sql, /ix_errores_huella_cuando/);
    assert.match(sql, /ix_errores_cuando/);
    /*
     * Y el parcial de lo pendiente de avisar: en cuanto se avisa, la fila sale del
     * índice, así que el índice mide lo pendiente y no la tabla, que crece sin
     * parar.
     */
    assert.match(sql, /ix_errores_sin_avisar[\s\S]*WHERE avisado_en IS NULL/);
  });
});

describe("el aviso solo habla de lo nuevo", () => {
  const CRON = fs.readFileSync(
    path.join(RAIZ, "lib", "api", "cron-avisa-de-los-fallos-handler.js"),
    "utf8"
  );

  test("solo mira lo que no se ha avisado", () => {
    /*
     * Un aviso que llega siempre se deja de leer en una semana. Por eso el correo
     * contesta a «¿ha aparecido algo nuevo?» y no a «¿cuántos errores hay?», que
     * es un número que nunca baja.
     */
    assert.match(CRON, /WHERE avisado_en IS NULL/);
  });

  test("y marca DESPUÉS de mandar, no antes", () => {
    /*
     * Al revés se perdería el aviso justo el día que Resend tenga un problema: se
     * marcarían como avisados unos fallos de los que nadie se enteró.
     */
    const mandar = CRON.indexOf("await mandaElCorreo(");
    const marcar = CRON.indexOf("SET avisado_en = NOW()");

    assert.ok(mandar > 0 && marcar > 0);
    assert.ok(mandar < marcar, "se marca antes de mandar: un fallo de Resend perdería el aviso");
  });

  test("cuenta a cuánta gente le pasa, no solo cuántas veces", () => {
    /*
     * Es el dato que separa «un móvil raro» de «esto le pasa a todo el mundo», y
     * la diferencia entre mirarlo el lunes y mirarlo ahora.
     */
    assert.match(CRON, /COUNT\(DISTINCT quien\)\s+AS personas/);
  });

  test("y no se manda a nadie si no hay a quién", () => {
    // `correoInterno()` ya se queja una vez en el registro si no hay destinatario.
    assert.match(CRON, /const paraQuien = correoInterno\(\);/);
    assert.match(CRON, /if \(!paraQuien\)/);
  });
});

describe("el endpoint del navegador no se puede usar para llenar la base", () => {
  const ENDPOINT = fs.readFileSync(
    path.join(RAIZ, "lib", "api", "error-del-navegador-handler.js"),
    "utf8"
  );

  test("tiene freno por IP", () => {
    /*
     * Y no hace falta mala intención: un error dentro de un `useEffect` se repite
     * en cada renderizado y un solo móvil mandaría miles de peticiones.
     */
    assert.match(ENDPOINT, /FRENO\.pide\(/);
    assert.match(ENDPOINT, /LIMITE = \{ veces: \d+, segundos:/);
  });

  test("y contesta 204 pase lo que pase", () => {
    /*
     * La web que manda esto ya está teniendo un problema: lo último que necesita es
     * otro error al intentar contarlo. Ni cuando se frena, ni cuando no hay base,
     * ni cuando el cuerpo viene vacío.
     */
    assert.ok(!ENDPOINT.includes("status(500)"));
    assert.ok((ENDPOINT.match(/status\(204\)/g) || []).length >= 4);
  });

  test("y tapa los correos que llegan en el mensaje", () => {
    // El mensaje lo manda el navegador y puede traer una dirección dentro.
    assert.match(ENDPOINT, /tapaElCorreo\(mensaje\)/);
  });
});
