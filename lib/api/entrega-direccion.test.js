/**
 * Dónde se le entrega el coche.
 *
 * No se pide al solicitarlo: la entrega en península va incluida en el precio,
 * así que preguntar la dirección antes de dejarle pedir el coche es un campo más
 * entre él y el botón, a cambio de nada. Se pide después, en su panel.
 *
 * Lo que se vigila aquí: que nadie cambie la dirección de una solicitud ajena, y
 * que fuera de la península se avise **sin inventarse un importe**.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const handler = require("./entrega-direccion-handler.js");
const { llevaRecargo } = handler;

const DUENO = "cliente@example.com";
let guardado = null;
let sqlUsado = "";

/** Manda una dirección y devuelve lo que contesta. */
async function pide(cuerpo, { duenoReal = DUENO, pagada = false } = {}) {
  guardado = null;
  const original = Pool.prototype.query;
  Pool.prototype.query = async (sql, params) => {
    const t = String(sql || "");
    if (/UPDATE/i.test(t)) sqlUsado = t;
    if (/UPDATE moveadvisor_market_leads/i.test(t)) {
      // El correo del dueño va en el WHERE: si no es el suyo, no toca nada.
      const [id, direccion, ciudad, provincia, cp, email] = params;
      if (String(email).toLowerCase() !== duenoReal.toLowerCase()) {
        return { rows: [], rowCount: 0 };
      }
      // El «deposit_paid_at IS NULL» del WHERE, aquí a mano.
      if (pagada && /deposit_paid_at IS NULL/i.test(t)) return { rows: [], rowCount: 0 };
      guardado = { id, direccion, ciudad, provincia, cp };
      return { rows: [{ id }], rowCount: 1 };
    }
    if (/SELECT deposit_paid_at/i.test(t)) {
      const [, email] = params;
      if (String(email).toLowerCase() !== duenoReal.toLowerCase()) return { rows: [], rowCount: 0 };
      return { rows: [{ deposit_paid_at: pagada ? "2026-09-01" : null }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
  };
  try {
    await handler({ method: "POST", headers: {}, body: cuerpo }, res);
  } finally {
    Pool.prototype.query = original;
  }
  return salida;
}

describe("poner la dirección de entrega", () => {
  test("se guarda con su calle y su ciudad", async () => {
    const r = await pide({ lead_id: "imp-1", email: DUENO, direccion: "Gran Vía 1", ciudad: "Madrid", provincia: "Madrid", cp: "28013" });
    assert.equal(r.codigo, 200);
    assert.equal(guardado.direccion, "Gran Vía 1");
    assert.equal(guardado.ciudad, "Madrid");
  });

  test("sin calle o sin ciudad, no: no se puede llevar un coche a media dirección", async () => {
    const sinCalle = await pide({ lead_id: "imp-1", email: DUENO, ciudad: "Madrid" });
    assert.equal(sinCalle.codigo, 400);
    const sinCiudad = await pide({ lead_id: "imp-1", email: DUENO, direccion: "Gran Vía 1" });
    assert.equal(sinCiudad.codigo, 400);
    assert.equal(guardado, null);
  });

  test("sin decir de qué solicitud, tampoco", async () => {
    const r = await pide({ email: DUENO, direccion: "Gran Vía 1", ciudad: "Madrid" });
    assert.equal(r.codigo, 400);
  });

  test("la solicitud de otro no se toca", async () => {
    const r = await pide(
      { lead_id: "imp-de-otro", email: DUENO, direccion: "Gran Vía 1", ciudad: "Madrid" },
      { duenoReal: "otra.persona@example.com" }
    );
    assert.equal(r.codigo, 404);
    assert.equal(guardado, null, "con el identificador de una solicitud ajena se le cambiaría a otro dónde recibe su coche");
  });

  test("y no se toca porque lo impide la consulta, no el remedo", async () => {
    // La prueba de arriba la pasaría igual una consulta sin filtro: quien decide
    // ahí es el simulacro. Lo que de verdad protege es que el correo del dueño
    // esté en el WHERE, y eso hay que mirarlo en el SQL.
    await pide({ lead_id: "imp-1", email: DUENO, direccion: "Gran Vía 1", ciudad: "Madrid" });
    assert.match(sqlUsado, /WHERE[\s\S]*user_email/i,
      "sin el correo en el WHERE, cualquiera con un identificador cambia la dirección de otro");
  });

  test("sin identificarse, nada", async () => {
    const r = await pide({ lead_id: "imp-1", direccion: "Gran Vía 1", ciudad: "Madrid" });
    assert.equal(r.codigo, 401);
  });
});

describe("el recargo de fuera de la península", () => {
  test("en la península no hay recargo", async () => {
    const r = await pide({ lead_id: "imp-1", email: DUENO, direccion: "Gran Vía 1", ciudad: "Madrid", provincia: "Madrid" });
    assert.equal(r.cuerpo.recargo, null);
  });

  test("en las islas se avisa, y sin cifra", async () => {
    const r = await pide({ lead_id: "imp-1", email: DUENO, direccion: "Paseo Marítimo 3", ciudad: "Palma", provincia: "Illes Balears" });
    assert.ok(r.cuerpo.recargo, "meter un coche en un barco no lo cubre lo que se le ha cobrado");
    assert.doesNotMatch(r.cuerpo.recargo, /\d+\s*€/,
      "no hay tarifa de nadie para esos viajes: poner un número sería adivinar");
  });

  test("las cuatro que no son península, con o sin acentos", () => {
    for (const p of ["Illes Balears", "Islas Baleares", "Las Palmas", "Santa Cruz de Tenerife", "Ceuta", "Melilla"]) {
      assert.equal(llevaRecargo(p), true, `${p} debería llevar recargo`);
    }
  });

  test("y las que sí lo son, no", () => {
    for (const p of ["Madrid", "Barcelona", "Almería", "A Coruña", ""]) {
      assert.equal(llevaRecargo(p), false, `${p} no debería llevarlo`);
    }
  });
});

/**
 * Con la fianza pagada, la dirección queda fijada.
 *
 * Lo que se le cobró incluye llevárselo a donde dijo. Dejarle cambiarla después
 * sería dejarle pagar un precio de península y pedir la entrega en Palma.
 */
describe("una vez pagada la fianza", () => {
  test("ya no se cambia", async () => {
    const r = await pide(
      { lead_id: "imp-1", email: DUENO, direccion: "Otra calle 2", ciudad: "Palma", provincia: "Illes Balears" },
      { pagada: true }
    );
    assert.equal(r.codigo, 409);
    assert.equal(r.cuerpo.error, "fianza_pagada");
    assert.equal(guardado, null);
  });

  test("y se le dice qué hacer, no solo que no", async () => {
    const r = await pide(
      { lead_id: "imp-1", email: DUENO, direccion: "Otra calle 2", ciudad: "Palma" },
      { pagada: true }
    );
    assert.match(r.cuerpo.detail, /escríbenos/i,
      "un «no se puede» a secas deja al cliente sin salida");
  });

  test("lo impide la consulta, no una comprobación aparte", async () => {
    // Entre leer y escribir cabe un pago. Si la condición no está en el WHERE,
    // una solicitud que se acaba de pagar se podría sobrescribir igual.
    await pide({ lead_id: "imp-1", email: DUENO, direccion: "Gran Vía 1", ciudad: "Madrid" });
    assert.match(sqlUsado, /deposit_paid_at IS NULL/i);
  });

  test("sin pagar sí se cambia, que es lo normal", async () => {
    const r = await pide({ lead_id: "imp-1", email: DUENO, direccion: "Gran Vía 1", ciudad: "Madrid" });
    assert.equal(r.codigo, 200);
    assert.equal(guardado.ciudad, "Madrid");
  });
});
