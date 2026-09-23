/**
 * Un secreto que falta cierra la puerta; nunca la abre.
 *
 * Las cuatro tareas programadas decían lo mismo: con `CRON_SECRET` puesto se
 * exige, y **sin él basta con decir que eres Vercel**, porque se miraba la
 * cabecera `user-agent`. Esa cabecera la escribe quien llama: es una línea de
 * texto, no una credencial. Y detrás de esas direcciones están los correos a
 * los clientes —recordatorios de visita, avisos de alertas, informes listos—,
 * que se podían disparar en bucle desde fuera. De paso se queman los testigos
 * de «ya avisado», así que el recordatorio de verdad ya no sale.
 */
const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { cronAutorizado } = require("./cron-autorizado");

const ORIGINAL = { CRON: process.env.CRON_SECRET, INTERNA: process.env.INTERNAL_API_KEY };
after(() => {
  if (ORIGINAL.CRON === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = ORIGINAL.CRON;
  if (ORIGINAL.INTERNA === undefined) delete process.env.INTERNAL_API_KEY; else process.env.INTERNAL_API_KEY = ORIGINAL.INTERNA;
});

const peticion = (headers = {}) => ({ headers });

/** Se traga lo que escriba en el registro y lo devuelve. */
async function sinRuido(fn) {
  const dicho = [];
  const antes = console.error;
  console.error = (...a) => dicho.push(a.join(" "));
  try { return { resultado: await fn(), dicho: dicho.join(" ") }; }
  finally { console.error = antes; }
}

describe("con el secreto puesto", () => {
  beforeEach(() => { process.env.CRON_SECRET = "el-secreto"; delete process.env.INTERNAL_API_KEY; });

  test("pasa quien lo lleva", () => {
    assert.equal(cronAutorizado(peticion({ authorization: "Bearer el-secreto" })), true);
  });

  test("no pasa quien lleva otro", () => {
    assert.equal(cronAutorizado(peticion({ authorization: "Bearer otro" })), false);
  });

  test("ni quien no lleva ninguno", () => {
    assert.equal(cronAutorizado(peticion()), false);
  });

  test("y decir que eres Vercel no vale de nada", () => {
    // Es lo que valía antes cuando faltaba el secreto, y es una cabecera que
    // escribe quien llama.
    assert.equal(cronAutorizado(peticion({ "user-agent": "vercel-cron/1.0" })), false);
  });
});

describe("sin el secreto", () => {
  beforeEach(() => { delete process.env.CRON_SECRET; delete process.env.INTERNAL_API_KEY; });

  test("no pasa nadie, ni diciendo que eres Vercel", async () => {
    const { resultado } = await sinRuido(() => cronAutorizado(peticion({ "user-agent": "vercel-cron/1.0" })));
    assert.equal(resultado, false, "un fallo de configuración no puede abrir una puerta");
  });

  test("y se dice en el registro, que es como se arregla", async () => {
    const { dicho } = await sinRuido(() => cronAutorizado(peticion()));
    assert.match(dicho, /CRON_SECRET/);
    assert.match(dicho, /no se ejecutan|no se ejecutan|Vercel/);
  });
});

describe("la llave interna", () => {
  beforeEach(() => { process.env.CRON_SECRET = "el-secreto"; process.env.INTERNAL_API_KEY = "la-llave"; });

  test("vale donde se pide", () => {
    assert.equal(cronAutorizado(peticion({ "x-internal-key": "la-llave" }), { conLlaveInterna: true }), true);
  });

  test("y no donde no", () => {
    // Solo la usa el aviso del informe de estado, para desatascarlo a mano.
    assert.equal(cronAutorizado(peticion({ "x-internal-key": "la-llave" })), false);
  });

  test("una llave que no es, tampoco", () => {
    assert.equal(cronAutorizado(peticion({ "x-internal-key": "otra" }), { conLlaveInterna: true }), false);
  });

  test("y con la llave vacía no se cuela una petición sin cabecera", async () => {
    process.env.INTERNAL_API_KEY = "";
    const { resultado } = await sinRuido(() => cronAutorizado(peticion({ "x-internal-key": "" }), { conLlaveInterna: true }));
    assert.equal(resultado, false, "vacío contra vacío no es una credencial");
  });
});

describe("las cuatro tareas usan esta regla", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  for (const fichero of [
    "cron-alert-check-handler.js",
    "cron-appointment-reminders-handler.js",
    "cron-condition-report-ready-handler.js",
    "cron-vigila-scrapers-handler.js",
  ]) {
    test(fichero, () => {
      const fuente = fs.readFileSync(path.join(__dirname, "api", fichero), "utf8");
      assert.match(fuente, /cronAutorizado\(req/, "esta tarea tiene su propio portero otra vez");
      assert.ok(
        !/user-agent.*vercel-cron/i.test(fuente.replace(/\/\*[\s\S]*?\*\//g, "")),
        "vuelve a fiarse del agente, que lo escribe quien llama"
      );
    });
  }
});
