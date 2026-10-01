"use strict";

/**
 * El cliente elige dónde se le hace la peritación y dice cuándo puede.
 *
 * Lo que se protege aquí es que **lo que pide quede en el mismo sitio que mira
 * quien lo atiende**, y que no se pueda pedir sobre el coche de otro. Lo
 * segundo es lo de siempre: el identificador del vehículo viaja por la red y no
 * prueba nada.
 *
 * Y una tercera, menos evidente: que esto **no confirma** ninguna hora. La
 * agenda del perito es nuestra; él propone. Un día que se da por bueno aquí y
 * luego se mueve es peor que un día que se tarda en confirmar.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Los de mentira, antes de que nadie los pida ─────────────────────────────

const rutaAuth = require.resolve("../../api/auth");
let sesionQueDevuelve = null;
require.cache[rutaAuth] = {
  id: rutaAuth,
  filename: rutaAuth,
  loaded: true,
  exports: { getSessionUserFromRequest: async () => sesionQueDevuelve },
};

let respuestasDeLaBase = [];
const consultasHechas = [];
const rutaPg = require.resolve("pg");
require.cache[rutaPg] = {
  id: rutaPg,
  filename: rutaPg,
  loaded: true,
  exports: {
    Pool: class {
      async query(sql, params) {
        consultasHechas.push({ sql: String(sql), params });
        return respuestasDeLaBase.shift() ?? { rows: [], rowCount: 0 };
      }
      async end() {}
      on() { return this; }
    },
  },
};

const peritacion = require("./peritacion-handler");
const { lasFranjasQueValen, CUANTAS_FRANJAS } = peritacion;

// ── Andamio ─────────────────────────────────────────────────────────────────

const entorno = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH: process.env.AUTH_BILLING_REQUIRE_SESSION,
  BASE: process.env.DATABASE_URL,
};

before(() => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_BILLING_REQUIRE_SESSION = "true";
  process.env.DATABASE_URL = "postgres://de-mentira/base";
});

after(() => {
  for (const [nombre, valor] of [
    ["NODE_ENV", entorno.NODE_ENV],
    ["AUTH_BILLING_REQUIRE_SESSION", entorno.AUTH],
    ["DATABASE_URL", entorno.BASE],
  ]) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
});

beforeEach(() => {
  respuestasDeLaBase = [];
  consultasHechas.length = 0;
  sesionQueDevuelve = { user: { id: "u1", email: "ana@example.com" } };
});

function respuesta() {
  const r = { codigo: 200, cuerpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (d) => { r.cuerpo = d; return r; };
  r.end = () => r;
  r.setHeader = () => {};
  return r;
}

const enDias = (n, hora = 10) => {
  const d = new Date(Date.now() + n * 86400000);
  d.setUTCHours(hora, 0, 0, 0);
  return d.toISOString();
};

const peticion = (body) => ({ method: "POST", headers: {}, query: {}, body });

/** Su coche, con encargo abierto y sin revisión todavía. */
const SUYO_SIN_REVISION = { rows: [{ encargo_id: "enc-1", revision_id: null, cita_at: null }], rowCount: 1 };
const SUYO_CON_REVISION = { rows: [{ encargo_id: "enc-1", revision_id: "rev-7", cita_at: null }], rowCount: 1 };
const NADA = { rows: [], rowCount: 0 };

const deLas = (patron) => consultasHechas.filter((c) => patron.test(c.sql));

describe("qué franjas valen", () => {
  test("se queda con tres como mucho", () => {
    const pedidas = [1, 2, 3, 4, 5].map((n) => enDias(n));
    assert.equal(lasFranjasQueValen(pedidas).length, CUANTAS_FRANJAS);
  });

  test("tira las repetidas, que es pulsar dos veces lo mismo", () => {
    const una = enDias(2);
    assert.deepEqual(lasFranjasQueValen([una, una]), [una]);
  });

  test("y las que ya pasaron, que no son una cita", () => {
    assert.deepEqual(lasFranjasQueValen([enDias(-3)]), []);
  });

  test("ni las de dentro de un año, que son una intención", () => {
    assert.deepEqual(lasFranjasQueValen([enDias(400)]), []);
  });

  test("ni lo que no es una fecha", () => {
    assert.deepEqual(lasFranjasQueValen(["el martes por la mañana", null, 42]), []);
  });
});

describe("pedir la peritación", () => {
  test("solo se pide, no se consulta", async () => {
    const res = respuesta();
    await peritacion({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.codigo, 405);
  });

  test("sin sesión, no", async () => {
    sesionQueDevuelve = null;
    const res = respuesta();
    await peritacion(peticion({ vehicle_id: "veh-1", modalidad: "en_taller" }), res);
    assert.equal(res.codigo, 401);
  });

  test("sin saber dónde quiere hacerla, tampoco", async () => {
    const res = respuesta();
    await peritacion(peticion({ vehicle_id: "veh-1", modalidad: "en-su-garaje" }), res);
    assert.equal(res.codigo, 400);
  });

  test("a domicilio sin dirección no se guarda", async () => {
    // Mandar un perito «a su casa» sin saber dónde es mandarlo a ninguna parte.
    const res = respuesta();
    await peritacion(
      peticion({ vehicle_id: "veh-1", modalidad: "a_domicilio", horas: [enDias(2)] }),
      res,
    );
    assert.equal(res.codigo, 400);
    assert.match(res.cuerpo.error, /dirección/i);
  });

  test("ni sin una hora a la que pueda", async () => {
    const res = respuesta();
    await peritacion(
      peticion({ vehicle_id: "veh-1", modalidad: "a_domicilio", direccion: "C/ Alcalá 120", horas: [] }),
      res,
    );
    assert.equal(res.codigo, 400);
  });

  test("el coche de otro no existe, y no se dice que no es suyo", async () => {
    respuestasDeLaBase = [NADA];
    const res = respuesta();
    await peritacion(peticion({ vehicle_id: "veh-de-otro", modalidad: "en_taller" }), res);
    assert.equal(res.codigo, 404);
    assert.doesNotMatch(res.cuerpo.error, /tuyo|otro/i);
  });

  test("con la hora ya confirmada no se cambia de idea por aquí", async () => {
    /*
     * Con perito y hora avisada, cambiar de modalidad no es elegir: es pedir
     * que se mueva la cita, y eso va por el camino que deja aviso a quien la
     * atiende.
     */
    respuestasDeLaBase = [{ rows: [{ encargo_id: "enc-1", revision_id: "rev-7", cita_at: enDias(3) }], rowCount: 1 }];
    const res = respuesta();
    await peritacion(
      peticion({ vehicle_id: "veh-1", modalidad: "a_domicilio", direccion: "C/ Alcalá 120", horas: [enDias(2)] }),
      res,
    );
    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.ya_tiene_cita, true);
    assert.deepEqual(deLas(/INSERT INTO erp_revisiones_taller_horas/), []);
  });
});

describe("lo que queda escrito", () => {
  test("si no había revisión, nace con lo que ha elegido", async () => {
    respuestasDeLaBase = [SUYO_SIN_REVISION];
    const res = respuesta();
    await peritacion(
      peticion({
        vehicle_id: "veh-1", modalidad: "a_domicilio",
        direccion: "C/ Alcalá 120, Madrid", horas: [enDias(2), enDias(3)],
      }),
      res,
    );

    assert.equal(res.codigo, 200);
    const alta = deLas(/INSERT INTO erp_revisiones_taller\b/)[0];
    assert.ok(alta, "no se ha dado de alta la revisión");
    // Nace «Por llevar»: pedirla no es haberla hecho.
    assert.match(alta.sql, /'Por llevar'/);
    assert.equal(alta.params[3], "a_domicilio");
    assert.equal(alta.params[4], "C/ Alcalá 120, Madrid");
    // Y queda apuntado que la pidió él, no nosotros.
    assert.match(alta.sql, /'el cliente'/);
  });

  test("y si ya la había, se actualiza en vez de duplicarse", async () => {
    /*
     * Hay un índice único de una revisión viva por coche: dar de alta otra
     * fallaría. Pero antes que fiarlo al índice, no se intenta.
     */
    respuestasDeLaBase = [SUYO_CON_REVISION];
    const res = respuesta();
    await peritacion(
      peticion({ vehicle_id: "veh-1", modalidad: "a_domicilio", direccion: "C/ Alcalá 120", horas: [enDias(2)] }),
      res,
    );

    assert.equal(res.codigo, 200);
    assert.deepEqual(deLas(/INSERT INTO erp_revisiones_taller\b/), []);
    assert.equal(deLas(/UPDATE erp_revisiones_taller/).length, 1);
  });

  test("las franjas se reemplazan, y solo las suyas", async () => {
    /*
     * Volver a mandarlas es corregirse. Si se acumularan, quien tiene que
     * elegir una vería las descartadas mezcladas con las buenas.
     *
     * Y se borran solo las que puso él: las que le ofrecemos nosotros cuando
     * ninguna suya encaja no son suyas para tirarlas.
     */
    respuestasDeLaBase = [SUYO_CON_REVISION];
    const res = respuesta();
    await peritacion(
      peticion({
        vehicle_id: "veh-1", modalidad: "a_domicilio",
        direccion: "C/ Alcalá 120", horas: [enDias(2), enDias(4)],
      }),
      res,
    );

    assert.equal(res.codigo, 200);
    const borrado = deLas(/DELETE FROM erp_revisiones_taller_horas/)[0];
    assert.ok(borrado);
    assert.match(borrado.sql, /la_puso = 'cliente'/);
    assert.equal(deLas(/INSERT INTO erp_revisiones_taller_horas/).length, 2);
    assert.deepEqual(res.cuerpo.data.horas.length, 2);
  });

  test("llevándolo al taller no se guarda ninguna hora", async () => {
    // Las horas del taller las da el taller por teléfono: ofrecerle un
    // calendario sería prometer algo que no podemos cumplir.
    respuestasDeLaBase = [SUYO_SIN_REVISION];
    const res = respuesta();
    await peritacion(
      peticion({ vehicle_id: "veh-1", modalidad: "en_taller", horas: [enDias(2)] }),
      res,
    );

    assert.equal(res.codigo, 200);
    assert.deepEqual(deLas(/INSERT INTO erp_revisiones_taller_horas/), []);
    assert.deepEqual(res.cuerpo.data.horas, []);
  });

  test("y nada de esto confirma la cita", async () => {
    // Lo que se escribe no toca `cita_at` ni `avisado_at`: eso lo hace quien
    // asigna el perito, con su agenda delante.
    respuestasDeLaBase = [SUYO_SIN_REVISION];
    await peritacion(
      peticion({ vehicle_id: "veh-1", modalidad: "a_domicilio", direccion: "C/ A 1", horas: [enDias(2)] }),
      respuesta(),
    );
    for (const c of consultasHechas) {
      assert.doesNotMatch(c.sql, /SET[\s\S]*cita_at/i);
      assert.doesNotMatch(c.sql, /avisado_at\s*=/i);
    }
  });
});

describe("la tabla donde escribe la declara una migración", () => {
  const { declaraTabla, declaraColumna } = require("../lo-que-declaran-las-migraciones");

  test("las horas propuestas tienen tabla", () => {
    assert.ok(declaraTabla("erp_revisiones_taller_horas"));
  });

  for (const columna of ["modalidad", "perito", "perito_id"]) {
    test(`y la revisión tiene «${columna}»`, () => {
      assert.ok(
        declaraColumna("erp_revisiones_taller", columna),
        `nadie declara erp_revisiones_taller.${columna}`,
      );
    });
  }
});
