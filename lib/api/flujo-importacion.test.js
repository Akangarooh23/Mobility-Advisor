/**
 * El flujo de una solicitud de importación, de principio a fin.
 *
 * No es una visita: en la sección de **Importación** del marketplace no hay
 * calendario. El cliente pide traer el coche, se guarda como lead y alguien le
 * llama. Lo que sí tiene y las visitas no es una **fianza**: el 30 % del precio
 * con el coste de traerlo.
 *
 * Esa cifra es lo que más cuidado necesita. Se le manda por correo, y hasta hoy
 * no se guardaba: el precio de la oferta puede cambiar después y entonces no
 * habría forma de saber qué número se le dio. Aquí se fija que quede guardada y
 * que sea la que se le dijo.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const OFERTA = { id: "de-123456", title: "Volkswagen Golf 1.5 TSI", price: 12000, import_cost: 2000 };
// 12.000 + 2.000 = 14.000, y el 30 % son 4.200.
const FIANZA = 4200;
const CLIENTE = "cliente@example.com";

let publicada = true;
let guardado = null;
let correos = [];

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const p = params || [];
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    if (/FROM moveadvisor_market_offers/i.test(t)) {
      // La consulta pide país e import_published: si no está publicada, no hay fila.
      return responde(publicada ? [{ title: OFERTA.title, price: OFERTA.price, import_cost: OFERTA.import_cost }] : []);
    }
    if (/INSERT INTO moveadvisor_market_leads/i.test(t)) {
      guardado = {
        id: p[0], email: p[1], oferta: p[2], titulo: p[3], url: p[4],
        nombre: p[5], telefono: p[6], contacto: p[7], fianza: p[8],
        // El tipo y el portal van escritos en la consulta, no como parámetros.
        tipo: (t.match(/VALUES \(\$1, \$2, '([a-z]+)'/) || [])[1],
        portal: (t.match(/'([a-z]+)', \$6/) || [])[1],
      };
      return responde([]);
    }
    return responde([]);
  };
  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) {
      const c = JSON.parse(opciones.body);
      correos.push({ to: String(c.to), subject: String(c.subject), html: String(c.html || "") });
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => { publicada = true; guardado = null; correos = []; });

const handler = require("./import-lead-handler.js");

async function pide(datos = {}) {
  const req = {
    method: "POST",
    headers: {},
    query: {},
    body: { offer_id: OFERTA.id, name: "Juan", email: CLIENTE, phone: "600000000", message: "¿Cuánto tarda?", ...datos },
  };
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler(req, res);
  await new Promise((r) => setImmediate(r));
  return salida;
}

describe("pedir un coche de importación", () => {
  test("se guarda como solicitud de importación, no como una visita", async () => {
    const r = await pide();
    assert.equal(r.codigo, 200);
    assert.equal(guardado.tipo, "import");
    assert.equal(guardado.portal, "importacion");
    assert.equal(guardado.email, CLIENTE);
    assert.ok(guardado.id.startsWith("imp-"));
  });

  test("la fianza que se le dice queda guardada", async () => {
    const r = await pide();
    assert.equal(r.cuerpo.deposit, FIANZA, "el 30 % del precio con el coste de traerlo");
    assert.equal(Number(guardado.fianza), FIANZA,
      "si no se guarda, cambia el precio de la oferta y ya nadie sabe qué se le prometió");
  });

  test("y es la misma que va en su correo", async () => {
    await pide();
    const suyo = correos.find((c) => c.to.includes(CLIENTE));
    assert.ok(suyo, "algo tiene que recibir");
    assert.ok(/importaci/i.test(suyo.subject));
    assert.ok(suyo.html.includes(FIANZA.toLocaleString("es-ES")) || suyo.html.includes(String(FIANZA)),
      "la cifra del correo y la guardada tienen que ser la misma");
  });

  test("el teléfono y el mensaje quedan con la solicitud", async () => {
    await pide();
    assert.ok(guardado.contacto.includes("600000000"));
    assert.ok(guardado.contacto.includes("¿Cuánto tarda?"));
  });

  test("y el teléfono, además, en su propia columna", async () => {
    await pide();
    assert.equal(guardado.telefono, "600000000",
      "metido solo dentro de «cuándo», en el ERP el campo Teléfono sale vacío");
  });

  test("el equipo se entera", async () => {
    await pide();
    const interno = correos.find((c) => !c.to.includes(CLIENTE));
    assert.ok(interno, "sin aviso, la solicitud se queda esperando a que alguien mire la lista");
  });
});

describe("lo que no se deja pedir", () => {
  test("una oferta que no está publicada", async () => {
    publicada = false;
    const r = await pide();
    assert.equal(r.codigo, 404);
    assert.equal(guardado, null);
  });

  test("sin un correo con arroba no hay a quién contestar", async () => {
    const r = await pide({ email: "esto-no-es-un-correo" });
    assert.equal(r.codigo, 400);
    assert.equal(guardado, null);
  });

  test("sin oferta no hay nada que importar", async () => {
    const r = await pide({ offer_id: "" });
    assert.equal(r.codigo, 400);
    assert.equal(guardado, null);
  });
});

describe("pedir una importación sin haber entrado", () => {
  // Se cogía el correo del cuerpo sin comprobar nada: cualquiera podía pedir una
  // importación a nombre de otro, y a ese otro le llegaba un correo con una
  // fianza de miles de euros que no ha pedido. Es el mismo agujero que se cerró
  // en las visitas, que seguía abierto aquí.
  test("en producción se rechaza, aunque mande un correo", async () => {
    const antes = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const r = await pide();
    process.env.NODE_ENV = antes;
    assert.equal(r.codigo, 401);
    assert.equal(guardado, null, "no se guarda nada a nombre de nadie");
    assert.equal(correos.length, 0, "y no le llega ningún correo con una fianza que no ha pedido");
  });

  test("fuera de producción sí, para poder probarlo con curl", async () => {
    const r = await pide();
    assert.equal(r.codigo, 200);
  });
});
