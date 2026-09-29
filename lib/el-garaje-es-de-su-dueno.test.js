"use strict";

/**
 * El garaje del cliente, y que sea suyo.
 *
 * ## Por qué existe esta prueba
 *
 * Hasta hoy, estas once funciones tenían un camino alternativo por SQL Server.
 * Ese camino no podía ejecutarse —no hay SQL Server en ninguna parte y los
 * datos llevan tiempo en Postgres— y se ha borrado. Lo que queda es el camino
 * de Postgres, que es el que corre de verdad y estaba **casi sin probar**: de
 * once funciones, solo una aparecía nombrada en un test.
 *
 * Mueven el garaje de una persona: sus coches, sus seguros, sus tasaciones, sus
 * revisiones y sus citas.
 *
 * ## Qué se fija, y qué no
 *
 * No se comprueba el SQL palabra por palabra —eso ata la prueba a cómo está
 * escrito hoy y falla cuando alguien lo mejora sin romper nada—. Se comprueban
 * las tres cosas que no pueden cambiar sin que alguien salga perjudicado:
 *
 *   1. **sin correo no se toca nada**, ni se lee ni se borra;
 *   2. **toda consulta lleva al dueño dentro**, y no solo el identificador de
 *      la fila. Sin eso, quien adivine un id lee o borra lo de otro;
 *   3. **la doble llave**. Las filas viejas tienen `user_id` a nulo y solo se
 *      reconocen por el correo; las nuevas, por el identificador. Es la
 *      migración `0006-el-correo-deja-de-ser-la-atadura`, que está a medias, y
 *      mientras lo esté hay que mirar las dos. El día que alguien simplifique
 *      esa condición «porque sobra», las filas viejas desaparecen del panel de
 *      su dueño sin un solo error.
 *
 * No hace falta base de datos: se sustituye `lib/postgres` por un doble que
 * apunta lo que le piden.
 */

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

/* ── el doble de la base ─────────────────────────────────────────────────── */

let consultas = [];
let respuestas = [];

const rutaPostgres = require.resolve("./postgres");
require.cache[rutaPostgres] = {
  id: rutaPostgres,
  filename: rutaPostgres,
  loaded: true,
  exports: {
    elPool: () => elDoble(),
    elPoolObligatorio: () => elDoble(),
    hayBase: () => true,
    cierraElPool: async () => {},
  },
};

function elDoble() {
  return {
    async query(sql, params) {
      const limpio = String(sql).replace(/\s+/g, " ").trim();
      consultas.push({ sql: limpio, params: params || [] });
      // La identidad se pide siempre primero; se contesta con un id conocido
      // salvo que la prueba haya encolado otra cosa.
      if (/FROM moveadvisor_users WHERE lower\(email\)/i.test(limpio)) {
        return { rows: [{ id: "usr-1" }], rowCount: 1 };
      }
      return respuestas.shift() ?? { rows: [], rowCount: 0 };
    },
  };
}

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://doble/nada";
const tienda = require("./billingStore");

beforeEach(() => {
  consultas = [];
  respuestas = [];
});

/** Las consultas que tocan datos, sin la de resolver la identidad. */
function lasDeDatos() {
  return consultas.filter((c) => !/FROM moveadvisor_users WHERE lower\(email\)/i.test(c.sql));
}

/** ¿Esta consulta lleva al dueño dentro, de alguna de las dos formas? */
function llevaAlDueno(c) {
  const porId = /user_id\s*=/.test(c.sql);
  const porCorreo = /user_email\s*=/.test(c.sql) || /lower\(user_email\)/.test(c.sql);
  return porId || porCorreo;
}

const YO = "ana@popcar.es";

/* ── 1. sin correo, nada ─────────────────────────────────────────────────── */

describe("sin saber de quién es, no se toca nada", () => {
  const SIN_CORREO = [
    ["listGarageVehicles", () => tienda.listGarageVehicles("")],
    ["listGarageVehicleSummaries", () => tienda.listGarageVehicleSummaries("")],
    ["listAppointments", () => tienda.listAppointments("")],
    ["listMaintenances", () => tienda.listMaintenances("")],
    ["listInsurances", () => tienda.listInsurances("")],
    ["listValuations", () => tienda.listValuations("")],
  ];

  for (const [nombre, llamar] of SIN_CORREO) {
    test(`${nombre}("") devuelve vacío y no consulta`, async () => {
      const r = await llamar();
      assert.deepEqual(r, [], "sin correo no hay lista de nadie");
      assert.deepEqual(lasDeDatos(), [], "y no se le pregunta nada a la base");
    });
  }

  test('removeGarageVehicle("", id) no borra nada', async () => {
    /*
     * Ésta es la que más daño haría. Un DELETE al que le falta el dueño y le
     * sobra confianza borra la fila de quien sea.
     */
    await tienda.removeGarageVehicle("", "veh-1");
    const borrados = lasDeDatos().filter((c) => /^DELETE/i.test(c.sql));
    assert.deepEqual(borrados, [], "sin correo no se borra");
  });

  test("removeGarageVehicle(correo, «») tampoco", async () => {
    await tienda.removeGarageVehicle(YO, "");
    const borrados = lasDeDatos().filter((c) => /^DELETE/i.test(c.sql));
    assert.deepEqual(borrados, [], "sin coche no se borra");
  });
});

/* ── 2. el dueño va dentro de la consulta ────────────────────────────────── */

describe("todo lo que se lee y se borra lleva al dueño dentro", () => {
  const CON_CORREO = [
    ["listGarageVehicles", () => tienda.listGarageVehicles(YO)],
    ["listAppointments", () => tienda.listAppointments(YO)],
    ["listMaintenances", () => tienda.listMaintenances(YO)],
    ["listInsurances", () => tienda.listInsurances(YO)],
    ["listValuations", () => tienda.listValuations(YO)],
  ];

  for (const [nombre, llamar] of CON_CORREO) {
    test(`${nombre} filtra por quien pregunta`, async () => {
      await llamar();
      const deDatos = lasDeDatos();
      assert.ok(deDatos.length > 0, "algo tendrá que preguntar");
      for (const c of deDatos) {
        assert.ok(
          llevaAlDueno(c),
          `esta consulta de ${nombre} no dice de quién es:\n      ${c.sql.slice(0, 140)}`
        );
      }
    });
  }

  test("y el borrado no se conforma con el id del coche", async () => {
    await tienda.removeGarageVehicle(YO, "veh-de-otro");
    const borrado = lasDeDatos().find((c) => /^DELETE/i.test(c.sql));
    assert.ok(borrado, "no ha llegado a borrar");
    assert.ok(
      llevaAlDueno(borrado),
      "un DELETE por id a secas borra el coche de otro:\n      " + borrado.sql
    );
    assert.ok(
      borrado.params.includes(YO) || borrado.params.includes("usr-1"),
      "el dueño tiene que viajar en los parámetros, no pegado al SQL"
    );
  });
});

/* ── 3. la doble llave, que es la migración a medias ─────────────────────── */

describe("las filas viejas siguen siendo de quien son", () => {
  /*
   * `0006-el-correo-deja-de-ser-la-atadura` añadió `user_id` y lo rellenó donde
   * pudo. Lo que quedó sin rellenar solo se reconoce por el correo. Por eso la
   * condición mira las dos cosas, y por eso esto está escrito: parece redundante
   * y no lo es.
   */
  test("se pregunta por el identificador Y por el correo", async () => {
    await tienda.listGarageVehicles(YO);
    const lectura = lasDeDatos().find((c) => /FROM moveadvisor_user_vehicles/i.test(c.sql));
    assert.ok(lectura, "no encuentro la lectura del garaje");
    assert.match(lectura.sql, /user_id/, "sin esto, las filas nuevas no salen");
    assert.match(lectura.sql, /user_email/, "sin esto, las filas viejas desaparecen del panel");
  });

  test("y al borrar, igual", async () => {
    await tienda.removeGarageVehicle(YO, "veh-1");
    const borrado = lasDeDatos().find((c) => /^DELETE/i.test(c.sql));
    assert.match(borrado.sql, /user_id/);
    assert.match(borrado.sql, /user_email/, "un coche viejo no se podría borrar nunca");
  });

  test("primero se averigua quién es, y por correo en minúsculas", async () => {
    // El correo llega como lo escriba quien entre; la tabla no tiene por qué
    // haberlo guardado con las mismas mayúsculas.
    await tienda.listGarageVehicles("Ana@PopCar.es");
    const quienEs = consultas.find((c) => /FROM moveadvisor_users/i.test(c.sql));
    assert.ok(quienEs, "no se ha resuelto la identidad");
    assert.match(quienEs.sql, /lower\(email\) = lower\(\$1\)/);
    assert.deepEqual(quienEs.params, ["ana@popcar.es"]);
  });
});

/* ── y que no se cuelgue si la base falla ────────────────────────────────── */

describe("si la base se cae, el panel no", () => {
  test("una lista que revienta sale vacía, no rota", async () => {
    /*
     * El panel enseña seis listas. Que una avería en la de seguros deje al
     * cliente sin ver sus coches sería castigarle dos veces.
     */
    respuestas.push(Promise.reject(new Error("se cayó la base")));
    const r = await tienda.listInsurances(YO);
    assert.ok(Array.isArray(r), "tiene que seguir siendo una lista");
  });
});
