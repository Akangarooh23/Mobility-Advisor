/**
 * El mismo cliente pidiendo dos veces lo mismo no son dos leads.
 *
 * Es lo que pasó con Juan: pidió «vender su coche» a las 22:40:06 y otra vez a
 * las 22:40:46, y en el ERP salieron dos solicitudes idénticas. Quien las mira
 * no sabe si son dos coches o un dedo nervioso, así que llama dos veces o deja
 * una muerta en Pendientes.
 *
 * Se llama al manejador de verdad; lo simulado es la base y el correo.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const REPE = require("../lead-repetido");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";

let guardados = [];
let correos = [];

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

/** La base, con lo justo: guarda leads y contesta a la consulta del repetido. */
before(() => {
  Pool.prototype.query = async (sql, p = []) => {
    const t = String(sql || "").replace(/\s+/g, " ");
    if (/SELECT id, numero, created_at FROM moveadvisor_market_leads/.test(t)) {
      const [email, tipo, cocheId, titulo, , cerrados] = p;
      const vivo = guardados.find((l) =>
        l.email.toLowerCase() === String(email).toLowerCase()
        && l.tipo === tipo
        && !cerrados.includes(l.estado)
        && (cocheId ? l.cocheId === cocheId : (titulo ? l.titulo === titulo : true)));
      return { rows: vivo ? [{ id: vivo.id, numero: "LEAD-2026-0003", created_at: new Date() }] : [], rowCount: vivo ? 1 : 0 };
    }
    if (/INSERT INTO moveadvisor_market_leads/.test(t)) {
      guardados.push({ id: p[0], email: p[1], tipo: p[2], cocheId: p[3], titulo: p[4], estado: "Pendiente" });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  global.fetch = async (_u, o) => {
    correos.push(JSON.parse(o.body).subject || "");
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => { guardados = []; correos = []; correoDeLaPrueba = otroCorreo(); });

const handler = require("./leads-handler.js");

/*
 * Un correo distinto por prueba.
 *
 * El manejador trae de antes un tope de tres solicitudes por correo cada diez
 * minutos, y lo cuenta en la memoria del proceso: con el mismo correo en todas,
 * la cuarta prueba recibiría un 429 y estaría midiendo el tope, no el repetido.
 */
let cuantas = 0;
const otroCorreo = () => `juan${++cuantas}@example.com`;
let correoDeLaPrueba = "juan0@example.com";

/** La solicitud de Juan, tal como la manda el formulario de «vender tu coche». */
const deJuan = (extra = {}) => ({
  name: "Juan", phone: "679084422", email: correoDeLaPrueba,
  type: "venta_gestionada", when: "Quiere vender: en un mes",
  vehicle_id: "idcar-1790076532522-w3hajh", vehicle_title: "Lancia Ypsilon 2005 · 0296DYJ",
  portal: "web-vender", ...extra,
});

async function pide(body) {
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler({ method: "POST", headers: {}, query: {}, body }, res);
  return salida;
}

describe("pedirlo dos veces", { concurrency: 1 }, () => {
  test("la primera se guarda", async () => {
    const r = await pide(deJuan());
    assert.equal(r.codigo, 201);
    assert.equal(guardados.length, 1);
  });

  test("la segunda, igual y seguida, no se guarda otra vez", async () => {
    await pide(deJuan());
    const r = await pide(deJuan());
    assert.equal(guardados.length, 1, "en el ERP salen dos solicitudes idénticas");
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.ya_estaba, true);
  });

  test("y a él se le dice que está recibida, no que sea un repetido", async () => {
    await pide(deJuan());
    const r = await pide(deJuan());
    assert.match(r.cuerpo.message, /recibida/);
    assert.ok(!/repet|duplic/i.test(r.cuerpo.message));
  });

  test("ni se vuelve a avisar al equipo", async () => {
    await pide(deJuan());
    const cuantos = correos.length;
    await pide(deJuan());
    assert.equal(correos.length, cuantos, "el equipo recibe dos veces el mismo aviso");
  });
});

describe("pero sigue siendo una solicitud nueva", { concurrency: 1 }, () => {
  test("si es otro coche suyo", async () => {
    await pide(deJuan());
    await pide(deJuan({ vehicle_id: "idcar-otro", vehicle_title: "Seat Ibiza 2019 · 1234ABC" }));
    assert.equal(guardados.length, 2);
  });

  test("si es otra persona con el mismo coche", async () => {
    await pide(deJuan());
    await pide(deJuan({ email: otroCorreo() }));
    assert.equal(guardados.length, 2);
  });

  test("si lo que pide es otra cosa", async () => {
    await pide(deJuan());
    await pide(deJuan({ type: "info" }));
    assert.equal(guardados.length, 2);
  });

  test("y si la de antes ya se cerró, vuelve a contar", async () => {
    await pide(deJuan());
    guardados[0].estado = "Vendido";
    await pide(deJuan());
    assert.equal(guardados.length, 2, "ya se atendió y se cerró: volver a escribir es una solicitud de verdad");
  });
});

describe("la regla", () => {
  test("dura un día: al siguiente es otra conversación", () => {
    assert.equal(REPE.HORAS_DE_LA_VENTANA, 24);
    assert.match(REPE.SQL_YA_LO_PIDIO, /created_at > NOW\(\) - \(\$5 \|\| ' hours'\)::interval/);
  });

  test("y mira si el de antes sigue esperando algo", () => {
    assert.ok(REPE.YA_NO_ESPERA.includes("Vendido"));
    assert.ok(!REPE.YA_NO_ESPERA.includes("Pendiente"));
    assert.ok(!REPE.YA_NO_ESPERA.includes("Contactado"));
  });

  test("y los estados que cierran son los que el ERP sabe escribir", () => {
    /*
     * Un estado inventado aquí no cierra nada: la consulta pregunta si el de
     * antes está en la lista, y «Perdido» —que el ERP no escribe nunca— deja
     * viva para siempre una solicitud ya atendida. El efecto no es que sobre un
     * lead, es que al cliente que vuelve a escribir se le traga el mensaje.
     */
    const DEL_ERP = [
      "Pendiente", "Contactado", "En proceso", "Cerrado", "Descartado",
      "Reagendar solicitado", "Cancelado", "Cita confirmada", "Visita realizada",
      "Interesado", "Vendido",
      "Depósito retenido", "Verificado y pagado", "En transporte", "En trámites", "Entregado",
    ];
    for (const e of REPE.YA_NO_ESPERA) {
      assert.ok(DEL_ERP.includes(e), `«${e}» no es un estado que el ERP escriba`);
    }
    assert.ok(REPE.YA_NO_ESPERA.includes("Cerrado"), "una solicitud cerrada seguía contando como viva");
  });
});
