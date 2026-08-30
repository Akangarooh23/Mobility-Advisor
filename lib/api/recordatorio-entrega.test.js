/**
 * Quedar para entregar el coche también avisa.
 *
 * Los recordatorios de la víspera y del mismo día solo miraban las citas en
 * estado «Cita confirmada», y por ahí no pasa una importación: sus etapas son
 * las suyas. Para que el cliente recibiera el aviso había que sacar el
 * expediente de su etapa, y entonces desaparecía del tablero de Importaciones.
 * O el aviso, o el tablero.
 *
 * Lo que importa no es el estado: es que haya un día apalabrado.
 *
 * El paso de después —el que marca la cita como hecha— sigue dejando fuera las
 * importaciones, y eso también se comprueba: cambia el estado a «En proceso», y
 * eso a un expediente de importación lo saca del tablero para siempre.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
// La tarea solo la dispara Vercel, o quien traiga el secreto. Aquí se usa el
// secreto: llamarla haciéndose pasar por Vercel sería copiar el agujero que se
// cerró en su día.
process.env.CRON_SECRET = "secreto-de-mentira";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

/** Las consultas que ha hecho el cron. */
let consultas = [];

beforeEach(() => {
  consultas = [];
  Pool.prototype.query = async (sql) => {
    const t = String(sql || "").replace(/\s+/g, " ");
    consultas.push(t);
    return { rows: [], rowCount: 0 };
  };
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" });
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./cron-appointment-reminders-handler.js");

async function corre() {
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json() { return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler({ method: "GET", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query: {} }, res);
  return res._codigo;
}

/** Las tres consultas del cron, por lo que buscan. */
const laDe = (trozo) => consultas.find((c) => c.includes(trozo));

describe("los recordatorios de una entrega", { concurrency: 1 }, () => {
  test("el aviso de la víspera mira también las importaciones", async () => {
    await corre();
    const q = laDe("CURRENT_DATE + INTERVAL '1 day'");
    assert.ok(q, "no encuentro la consulta de la víspera");
    assert.match(q, /lead_type = 'import'/,
      "sin esto, para avisar de una entrega hay que sacar el expediente de su etapa");
  });

  test("y el del mismo día", async () => {
    await corre();
    const q = consultas.find((c) => /appointment_date = CURRENT_DATE(?! \+)/.test(c) && c.includes("reminder_day_of_sent_at"));
    assert.ok(q, "no encuentro la consulta del mismo día");
    assert.match(q, /lead_type = 'import'/);
  });

  test("el de después deja fuera las importaciones", async () => {
    await corre();
    const q = laDe("appointment_date < CURRENT_DATE");
    assert.ok(q, "no encuentro la consulta de después");
    assert.ok(!/lead_type = 'import'/.test(q),
      "ese paso pone «En proceso», que no es una etapa de importación: la sacaría del tablero");
    assert.match(q, /status = 'Cita confirmada'/);
  });

  test("una entrega sigue necesitando día: sin fecha no se avisa a nadie", async () => {
    await corre();
    for (const q of [laDe("CURRENT_DATE + INTERVAL '1 day'"), laDe("reminder_day_of_sent_at")]) {
      assert.match(q, /appointment_date = CURRENT_DATE/,
        "la condición del día es lo que evita avisar a todas las importaciones abiertas");
    }
  });
});
