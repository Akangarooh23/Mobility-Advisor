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

const { precioPuestoAqui } = require("../coste-importacion.js");

const OFERTA = {
  id: "de-123456", title: "Volkswagen Golf 1.5 TSI",
  price: 12000, import_cost: 2000, market_price_es: 18000, year: 2019, mileage: 90000,
};

/**
 * La fianza sale del precio puesto aquí, no de la columna `import_cost`.
 *
 * Se calcula con la misma función que pinta el precio en la oferta: si fueran
 * dos, al cliente se le enseñaría un precio y se le cobraría el 30 % de otro.
 */
const FIANZA = Math.round(precioPuestoAqui(OFERTA.price, OFERTA.market_price_es) * 0.30);
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
      return responde(publicada ? [{ ...OFERTA }] : []);
    }
    if (/INSERT INTO moveadvisor_market_leads/i.test(t)) {
      guardado = {
        id: p[0], email: p[1], oferta: p[2], titulo: p[3], url: p[4],
        nombre: p[5], telefono: p[6], contacto: p[7], fianza: p[8],
        entrega: { calle: p[11], cp: p[12], ciudad: p[13], provincia: p[14] },
        servicios: p[15],
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

  test("el enlace al anuncio se guarda entero", async () => {
    await pide();
    // A quien atiende la solicitud se le enseña este enlace desde el ERP, que
    // vive en otro dominio: guardado solo con el trozo final, allí no lleva a
    // ninguna parte.
    assert.match(guardado.url, /^https:\/\/www\.popcar\.tech\/marketplace-vo\//);
    assert.ok(guardado.url.endsWith(OFERTA.id), "y es el de ese coche");
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

/**
 * Donde se lo llevamos, dicho al pedirlo.
 *
 * La ficha ya le pregunta la direccion entera, y se la rellena con la que
 * tiene en sus datos. De ahi sale el segundo viaje del ERP: de nuestras
 * instalaciones a su casa. Guardando solo la ciudad, ese viaje salia apuntando
 * a «Madrid» a secas, y a el le tocaba escribir su calle otra vez en el panel.
 */
describe("la direccion de entrega que dijo en la ficha", () => {
  test("se guarda entera, con calle y codigo postal", async () => {
    await pide({
      entrega_direccion: "Calle Mauricio Legendre 45 G2B",
      entrega_cp: "28046",
      entrega_ciudad: "Madrid",
      entrega_provincia: "Madrid",
    });
    assert.equal(guardado.entrega.calle, "Calle Mauricio Legendre 45 G2B",
      "sin la calle, el transporte del ERP no sabe a que puerta va");
    assert.equal(guardado.entrega.cp, "28046");
    assert.equal(guardado.entrega.ciudad, "Madrid");
    assert.equal(guardado.entrega.provincia, "Madrid");
  });

  test("y si no dice nada, se queda en blanco, no a medias", async () => {
    // Es lo normal: puede pedir el coche sin decir donde y ponerlo despues
    // desde su panel. Lo que no vale es inventarse una direccion.
    await pide();
    assert.equal(guardado.entrega.calle, "");
    assert.equal(guardado.entrega.ciudad, "");
  });
});

/**
 * Lo que contrata aparte, y lo que no cambia por contratarlo.
 *
 * El precio trae el coche hasta nuestras instalaciones de Madrid, lo matricula y
 * le da su garantía. Llevárselo a su casa, asegurarlo o dejarlo a punto son
 * servicios, y **no entran en la fianza**: la fianza cubre el compromiso de
 * comprar el coche en Alemania, no un seguro que todavía no tiene.
 */
describe("los servicios que se contratan aparte", () => {
  test("se guardan los que ha marcado", async () => {
    await pide({ servicios: ["entrega", "seguro"] });
    assert.deepEqual(JSON.parse(guardado.servicios), ["entrega", "seguro"]);
  });

  test("lo que llegue y no sea un servicio, fuera", async () => {
    // El cuerpo lo manda el navegador: lo que venga de ahí no se guarda tal cual.
    await pide({ servicios: ["entrega", "un-descuento-del-90", ""] });
    assert.deepEqual(JSON.parse(guardado.servicios), ["entrega"]);
  });

  test("la fianza no sube por marcarlos", async () => {
    // Es lo importante de todo esto. Si entraran en la fianza, se le estaría
    // cobrando por adelantado un servicio que no se le ha hecho.
    const sin = await pide();
    const con = await pide({ servicios: ["entrega", "seguro", "reacondicionado"] });
    assert.equal(Number(con.cuerpo.deposit), Number(sin.cuerpo.deposit));
    assert.equal(Number(con.cuerpo.deposit), FIANZA);
  });

  test("sin marcar nada, se guarda una lista vacía, no un nulo", async () => {
    await pide();
    assert.deepEqual(JSON.parse(guardado.servicios), []);
  });
});
