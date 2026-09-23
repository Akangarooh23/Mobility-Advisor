/**
 * Las horas del taller salen de la base, no de un fichero.
 *
 * ## Qué se rompía
 *
 * Las reservas se guardaban en `db/workshop-availability.json`, dentro del
 * propio despliegue. En Vercel el disco es de solo lectura fuera de `/tmp`, así
 * que esa escritura lanzaba y la función se caía sin decir nada: el cliente
 * elegía su hora, pulsaba confirmar y se comía un error.
 *
 * Y lo de leer lo tapaba: si el fichero no estaba se devolvían listas vacías,
 * de modo que **todas las horas salían libres siempre**. El calendario no
 * mentía a veces; mentía entero.
 *
 * ## Qué se fija aquí
 *
 * Que una hora ocupada se vea ocupada, que reservar escriba de verdad, que dos
 * personas no se lleven el mismo hueco, y —lo que más cuesta ver— que cuando la
 * base no se puede leer **no se inventen horas libres**: eso es volver al
 * fichero por otro camino.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const handler = require("./workshop-availability-handler");

/** Un miércoles de verdad: en domingo el taller cierra y no habría huecos. */
const DIA = (() => {
  const d = new Date(2026, 6, 1);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  return `2026-07-${String(d.getDate()).padStart(2, "0")}`;
})();
const MES = DIA.slice(0, 7);
const TALLER = "norauto-mad-sur";

let reservasEnLaBase = [];
let bloqueosEnLaBase = [];
let laLecturaFalla = false;
let laHoraYaEstaCogida = false;
let escrituras = [];

const queryOriginal = Pool.prototype.query;

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    const revienta = (err) => (cb ? cb(err) : Promise.reject(err));

    if (/CREATE TABLE/i.test(t)) return responde([]);

    if (/SELECT[\s\S]*FROM moveadvisor_workshop_reservations/i.test(t)) {
      if (laLecturaFalla) return revienta(new Error("la base no responde"));
      return responde(reservasEnLaBase);
    }
    if (/SELECT[\s\S]*FROM moveadvisor_workshop_blocks/i.test(t)) {
      if (laLecturaFalla) return revienta(new Error("la base no responde"));
      return responde(bloqueosEnLaBase);
    }

    if (/INSERT INTO moveadvisor_workshop_reservations/i.test(t)) {
      escrituras.push({ que: "reserva", params });
      if (laHoraYaEstaCogida) {
        const choque = new Error("duplicate key value violates unique constraint");
        choque.code = "23505";
        return revienta(choque);
      }
      return responde([]);
    }
    if (/INSERT INTO moveadvisor_workshop_blocks/i.test(t)) {
      escrituras.push({ que: "bloqueo", params });
      return responde([]);
    }
    if (/DELETE FROM moveadvisor_workshop_blocks/i.test(t)) {
      escrituras.push({ que: "desbloqueo", sql: t, params });
      return responde([]);
    }

    throw new Error("consulta que la prueba no esperaba: " + t.slice(0, 120));
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
});

beforeEach(() => {
  reservasEnLaBase = [];
  bloqueosEnLaBase = [];
  laLecturaFalla = false;
  laHoraYaEstaCogida = false;
  escrituras = [];
});

/** Un `res` de mentira que se queda con lo que le digan. */
function unRes() {
  return {
    code: 0,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const pideElMes = async () => {
  const res = unRes();
  await handler({ method: "GET", query: { workshopId: TALLER, monthKey: MES } }, res);
  return res;
};

const reserva = async (hora) => {
  const res = unRes();
  await handler(
    { method: "POST", body: { action: "reserve", workshopId: TALLER, provider: "Norauto", dateKey: DIA, time: hora } },
    res,
  );
  return res;
};

describe("las horas del taller", () => {
  test("una hora reservada en la base se ve ocupada", async () => {
    reservasEnLaBase = [
      { id: "r1", workshop_id: TALLER, proveedor: "Norauto", dia: DIA, hora: "10:00", estado: "booked", created_at: new Date() },
    ];

    const res = await pideElMes();
    assert.equal(res.code, 200);

    const horas = res.body.availabilityByDate[DIA].slots;
    const diez = horas.find((h) => h.time === "10:00");
    const nueve = horas.find((h) => h.time === "09:00");

    assert.equal(diez.available, false, "la hora reservada sale libre");
    assert.equal(nueve.available, true, "se ha ocupado una hora que nadie pidio");
  });

  test("reservar escribe en la base", async () => {
    const res = await reserva("11:00");

    assert.equal(res.code, 200);
    assert.equal(res.body.ok, true);
    const apuntada = escrituras.filter((e) => e.que === "reserva");
    assert.equal(apuntada.length, 1, "la reserva no se ha guardado");
    assert.ok(apuntada[0].params.includes(DIA) && apuntada[0].params.includes("11:00"));
  });

  test("si otro se lleva el hueco entre medias, sale ocupado y no un error", async () => {
    /*
     * El caso que el fichero no podía cubrir: dos personas miran el mismo
     * calendario, las dos ven la hora libre y las dos pulsan. Con el fichero la
     * segunda escritura pisaba a la primera —dos citas, una apuntada—. Aquí la
     * segunda choca contra el índice único, y lo que ve es que está cogida.
     */
    laHoraYaEstaCogida = true;

    const res = await reserva("11:00");

    assert.equal(res.code, 409);
    assert.equal(res.body.code, "SLOT_NOT_AVAILABLE");
  });

  test("si la base no se puede leer, no se inventan horas libres", async () => {
    /*
     * Ésta es la importante. Devolver un calendario vacío al fallar es lo que
     * hacía el fichero: todo libre, el cliente elige, y revienta al confirmar.
     * Más vale decir que no se puede mirar.
     */
    laLecturaFalla = true;

    const res = await pideElMes();

    assert.equal(res.code, 500);
    assert.equal(res.body.availabilityByDate, undefined, "ha devuelto un calendario que no ha podido leer");
  });

  test("y tampoco se reserva a ciegas", async () => {
    laLecturaFalla = true;

    const res = await reserva("11:00");

    assert.equal(res.code, 500);
    assert.equal(escrituras.length, 0, "ha apuntado una reserva sin poder mirar si el hueco existia");
  });

  test("bloquear el día entero va sin hora; bloquear un hueco, con ella", async () => {
    const dia = unRes();
    await handler({ method: "POST", body: { action: "block_day", workshopId: TALLER, dateKey: DIA } }, dia);
    const hueco = unRes();
    await handler({ method: "POST", body: { action: "block_slot", workshopId: TALLER, dateKey: DIA, time: "09:00" } }, hueco);

    assert.equal(dia.code, 200);
    assert.equal(hueco.code, 200);

    const [delDia, delHueco] = escrituras.filter((e) => e.que === "bloqueo");
    // La hora a nulo es lo que distingue «este día no» de «esta hora no».
    assert.equal(delDia.params[4], null);
    assert.equal(delHueco.params[4], "09:00");
  });

  test("y un día bloqueado deja el día sin huecos", async () => {
    bloqueosEnLaBase = [
      { id: "b1", workshop_id: TALLER, proveedor: "", dia: DIA, hora: null, motivo: "vacaciones", created_at: new Date() },
    ];

    const res = await pideElMes();

    assert.equal(res.body.availabilityByDate[DIA].slots.length, 0);
    assert.equal(res.body.availabilityByDate[DIA].fullyBooked, true);
  });

  test("desbloquear el día no se lleva por delante las horas sueltas", async () => {
    const res = unRes();
    await handler({ method: "POST", body: { action: "unblock_day", workshopId: TALLER, dateKey: DIA } }, res);

    const borrado = escrituras.find((e) => e.que === "desbloqueo");
    assert.match(borrado.sql, /hora IS NULL/, "el borrado del dia se llevaria tambien los huecos bloqueados");
  });

  test("el calendario no vuelve al fichero", () => {
    /*
     * Una prueba sobre el propio texto del fichero, porque el fallo no era una
     * cuenta mal hecha: era guardar el estado en el disco de una función que se
     * despliega de nuevo cada vez. Si alguien vuelve a escribir ahí, esto lo
     * dice antes de que se pierda una cita.
     */
    const fuente = readFileSync(__dirname + "/workshop-availability-handler.js", "utf8");
    assert.doesNotMatch(fuente, /require\(["']fs["']\)/, "el calendario vuelve a tocar el disco");
    assert.doesNotMatch(fuente, /workshop-availability\.json/, "el calendario vuelve al fichero");
  });
});
