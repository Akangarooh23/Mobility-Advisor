/**
 * Cuando alguien se da de baja en Stripe, nos enteramos.
 *
 * ## Lo que pasaba
 *
 * El webhook sacaba el correo de la cuenta con `getEmailByStripeCustomerId`, y
 * eso lo buscaba en el fichero de `billingStore`. Ese fichero **en producción
 * no se lee nunca** —`readStore()` devuelve vacío a propósito, para no
 * arrastrar datos de prueba—, así que la respuesta era siempre «no lo
 * conozco». Y sin correo, la rama entera se salta sin decir nada: la baja
 * llegaba, se respondía 200, y no se apuntaba en ningún sitio.
 *
 * El dato estaba en Postgres desde el principio: `moveadvisor_users.
 * stripe_customer_id` se escribe en cada activación. Se buscaba en el sitio
 * equivocado.
 *
 * ## Por qué un 500 cuando la base no responde
 *
 * Porque Stripe reintenta lo que falla durante tres días, y da por entregado lo
 * que responde 200. Contestar «no lo conozco» cuando lo que pasa es que no se
 * ha podido mirar es perder la baja para siempre.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { Pool } = require("pg");

const SECRETO = "whsec_de_mentira";
process.env.STRIPE_WEBHOOK_SECRET = SECRETO;
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
// El almacén de fichero, fuera del repositorio: aquí no pinta nada, y lo que se
// comprueba es justo que no haga falta.
process.env.BILLING_STORE_PATH = path.join(os.tmpdir(), `popcar-baja-stripe-${process.pid}.json`);

const handler = require("./billing-webhook-handler.js");

const CLIENTE = "cus_abc123";
const SUSCRIPCION = "sub_abc123";
const CORREO = "cliente@ejemplo.es";

const queryOriginal = Pool.prototype.query;

/** Cómo está el mundo en cada prueba. */
let laCuentaEstaEnLaBase;
let laBaseFalla;
/** Lo que se ha escrito. */
let planesEscritos;

beforeEach(() => {
  laCuentaEstaEnLaBase = true;
  laBaseFalla = false;
  planesEscritos = [];

  /*
   * El fichero, vacío en cada prueba.
   *
   * Apuntar un plan escribe también ahí —en local el fichero sigue valiendo—,
   * así que una prueba le dejaba a la siguiente el cliente que acababa de
   * escribir y la de «este no es nuestro» lo encontraba. En producción no pasa:
   * allí ese fichero no se lee nunca.
   */
  fs.rmSync(process.env.BILLING_STORE_PATH, { force: true });

  Pool.prototype.query = async (sql, params) => {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");

    if (/SELECT email FROM moveadvisor_users/i.test(t)) {
      if (laBaseFalla) throw new Error("la base no responde");
      // La base mira el WHERE, así que aquí también: si no, la prueba pasaría
      // igual con la consulta buscando por una columna que no es.
      const buscaPorCliente = /stripe_customer_id/.test(t);
      const valor = params[0];
      const encaja = buscaPorCliente ? valor === CLIENTE : valor === SUSCRIPCION;
      return { rows: laCuentaEstaEnLaBase && encaja ? [{ email: CORREO }] : [], rowCount: 0 };
    }

    if (/UPDATE moveadvisor_users/i.test(t) && /plan_status/.test(t)) {
      planesEscritos.push({ plan: params[0], estado: params[1], correo: params[2] });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
});

/** Un `res` de mentira. */
function unRes() {
  return {
    code: 0,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

/** El aviso de Stripe, firmado como lo firma Stripe. */
async function avisaStripe(evento) {
  const rawBody = JSON.stringify(evento);
  const t = Math.floor(Date.now() / 1000);
  const firma = crypto.createHmac("sha256", SECRETO).update(`${t}.${rawBody}`, "utf8").digest("hex");

  const res = unRes();
  await handler(
    {
      method: "POST",
      rawBody,
      headers: { "stripe-signature": `t=${t},v1=${firma}` },
    },
    res
  );
  return res;
}

const LA_BAJA = {
  type: "customer.subscription.deleted",
  data: { object: { id: SUSCRIPCION, customer: CLIENTE, status: "canceled" } },
};

describe("la baja de una suscripcion", { concurrency: 1 }, () => {
  test("se apunta en la cuenta de quien se da de baja", async () => {
    const res = await avisaStripe(LA_BAJA);

    assert.equal(res.code, 200);
    assert.equal(planesEscritos.length, 1, "la baja no ha llegado a la base");
    assert.equal(planesEscritos[0].correo, CORREO);
    assert.equal(planesEscritos[0].estado, "cancelado");
  });

  test("si la base no se puede leer, se le pide a Stripe que lo repita", async () => {
    laBaseFalla = true;

    const res = await avisaStripe(LA_BAJA);

    assert.equal(res.code, 500, "con un 200 Stripe da la baja por entregada y no vuelve");
    assert.equal(planesEscritos.length, 0);
  });

  test("y de un cliente que no es nuestro no se toca nada", async () => {
    laCuentaEstaEnLaBase = false;

    const res = await avisaStripe(LA_BAJA);

    // Aquí sí: se ha podido mirar y no es nuestro. Reintentarlo no arreglaría
    // nada, solo dejaria el webhook en rojo en el panel de Stripe.
    assert.equal(res.code, 200);
    assert.equal(planesEscritos.length, 0);
  });
});

describe("un cambio de plan", { concurrency: 1 }, () => {
  test("llega aunque Stripe no mande el correo en el evento", async () => {
    /*
     * Los eventos de suscripción no traen `customer_email`: solo el id del
     * cliente. Por eso esta rama dependía entera de la busqueda que no
     * funcionaba, mientras que las facturas se salvaban de casualidad.
     */
    const res = await avisaStripe({
      type: "customer.subscription.updated",
      data: { object: { id: SUSCRIPCION, customer: CLIENTE, status: "past_due" } },
    });

    assert.equal(res.code, 200);
    assert.equal(planesEscritos.length, 1);
    assert.equal(planesEscritos[0].estado, "pendiente");
  });
});

describe("una factura pagada", { concurrency: 1 }, () => {
  test("se apunta por el correo que trae, sin preguntar a la base", async () => {
    laCuentaEstaEnLaBase = false;

    const res = await avisaStripe({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          number: "F-1",
          customer: CLIENTE,
          customer_email: CORREO,
          amount_paid: 2900,
          created: Math.floor(Date.now() / 1000),
        },
      },
    });

    assert.equal(res.code, 200);
  });
});
