/**
 * Pedir el mismo coche dos veces, y pedir que te llamen.
 *
 * Volver a la ficha y solicitarlo otra vez —porque se cerró el pago, porque se
 * volvió atrás— creaba otro expediente. Tres solicitudes idénticas del mismo
 * SEAT Ibiza, tres correos y tres tarjetas en el panel, para un coche que se
 * quiere una sola vez. Pasó de verdad el 29 de agosto.
 *
 * Y el botón de «prefiero que me llaméis», que es la otra respuesta razonable a
 * que te pidan dos mil euros: la pantalla ya decía que se puede esperar a la
 * llamada, pero no había forma de decirlo.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const path = require("node:path");
const os = require("node:os");

process.env.BILLING_STORE_PATH = path.join(os.tmpdir(), `popcar-sin-duplicados-${process.pid}.json`);
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";

const CLIENTE = "cliente@ejemplo.es";
const OFERTA = "as_d67e602f";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

/** Las solicitudes que hay en la base. */
let solicitudes;
/** Lo que ha pasado. */
let insertadas;
let actualizaciones;
let correos;

beforeEach(() => {
  solicitudes = [];
  insertadas = [];
  actualizaciones = [];
  correos = [];

  Pool.prototype.query = async (sql, params) => {
    const t = String(sql || "");
    const p = params || [];

    if (/FROM moveadvisor_market_offers/i.test(t)) {
      return { rows: [{ title: "SEAT Ibiza 1.0", price: 5500, import_cost: 2077 }], rowCount: 1 };
    }
    // La búsqueda de una solicitud abierta del mismo coche.
    if (/SELECT id FROM moveadvisor_market_leads/i.test(t)) {
      const suyas = solicitudes.filter((x) => x.email === p[0] && x.oferta === p[1] && !x.pagada);
      return { rows: suyas.map((x) => ({ id: x.id })), rowCount: suyas.length };
    }
    if (/INSERT INTO moveadvisor_market_leads/i.test(t)) {
      const id = p[0];
      solicitudes.push({ id, email: p[1], oferta: p[2], pagada: false, cuando: p[8] });
      insertadas.push(id);
      return { rows: [], rowCount: 1 };
    }
    if (/UPDATE moveadvisor_market_leads/i.test(t)) {
      actualizaciones.push({ sql: t.replace(/\s+/g, " "), params: p });
      const deQuienEs = /lower\(user_email\) = \$2/.test(t) ? p[1] : null;
      const fila = solicitudes.find((x) => x.id === p[0] && (deQuienEs === null || x.email === deQuienEs));
      // La marca de «que me llamen» se pega al final de «cuándo».
      if (fila && /contact_when = CASE/i.test(t)) {
        fila.cuando = fila.cuando ? `${fila.cuando} · ${p[2]}` : p[2];
      }
      return { rows: fila ? [{ id: fila.id }] : [], rowCount: fila ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) {
      correos.push(JSON.parse(opciones.body).subject || "");
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./import-lead-handler.js");

async function pide(cuerpo = {}) {
  let salida = null;
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json(b) { salida = { codigo: res._codigo, ...b }; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler({
    method: "POST", headers: {},
    body: { offer_id: OFERTA, email: CLIENTE, name: "Ana", phone: "682791928", ...cuerpo },
  }, res);
  return salida;
}

describe("pedir el mismo coche dos veces", { concurrency: 1 }, () => {
  test("la primera crea la solicitud", async () => {
    const r = await pide({ message: "vvv" });
    assert.equal(r.ok, true);
    assert.equal(insertadas.length, 1);
  });

  test("la segunda no crea otra: es la misma", async () => {
    const primera = await pide({ message: "vvv" });
    const segunda = await pide({ message: "mmm" });
    assert.equal(insertadas.length, 1, "tres tarjetas en el panel para un solo coche");
    assert.equal(segunda.id, primera.id);
    assert.equal(segunda.yaEstaba, true);
  });

  test("y no le llega un segundo correo de lo mismo", async () => {
    await pide({ message: "vvv" });
    const trasLaPrimera = correos.length;
    await pide({ message: "mmm" });
    assert.equal(correos.length, trasLaPrimera, "dos confirmaciones seguidas de lo mismo son ruido");
  });

  test("pero lo último que escribe se guarda: puede haber cambiado el teléfono", async () => {
    await pide({ message: "vvv" });
    await pide({ message: "mmm", phone: "600111222" });
    const u = actualizaciones.find((x) => /contact_phone/.test(x.sql));
    assert.ok(u, "la segunda vez tiene que actualizar sus datos");
    assert.ok(u.params.includes("600111222"));
  });

  test("otro coche sí es otra solicitud", async () => {
    await pide();
    await pide({ offer_id: "as_otro" });
    assert.equal(insertadas.length, 2);
  });

  test("con la fianza ya pagada, volver a pedirlo es un expediente nuevo", async () => {
    await pide();
    solicitudes[0].pagada = true;
    await pide();
    assert.equal(insertadas.length, 2,
      "una fianza cobrada es un expediente en marcha: no se le cuelga otra petición encima");
  });
});

describe("prefiero que me llaméis", { concurrency: 1 }, () => {
  test("queda anotado en su solicitud", async () => {
    const r = await pide();
    const llamada = await pide({ accion: "llamada", lead_id: r.id });
    assert.equal(llamada.codigo, 200);
    assert.equal(llamada.anotado, true);
    assert.match(solicitudes[0].cuando, /Pide que le llamen antes de pagar/);
  });

  test("no crea ninguna solicitud ni manda ningún correo", async () => {
    const r = await pide();
    const antes = { creadas: insertadas.length, correos: correos.length };
    await pide({ accion: "llamada", lead_id: r.id });
    assert.equal(insertadas.length, antes.creadas);
    assert.equal(correos.length, antes.correos);
  });

  test("la solicitud de otro no se toca", async () => {
    // Una solicitud que existe de verdad, pero de otra persona: es el caso que
    // importa. Con un identificador inventado no se comprueba nada, porque no
    // hay fila que encontrar aunque se mire sin mirar de quién es.
    const suya = await pide();
    solicitudes.push({ id: "imp-de-otro", email: "vecino@ejemplo.es", oferta: "as_x", pagada: false, cuando: "" });

    const ajena = await pide({ accion: "llamada", lead_id: "imp-de-otro" });
    assert.equal(ajena.codigo, 404);
    assert.equal(solicitudes.find((x) => x.id === "imp-de-otro").cuando, "",
      "con el identificador de otro se le escribiría en su expediente");

    // Y la suya sí, para que se vea que la diferencia es de quién es.
    const propia = await pide({ accion: "llamada", lead_id: suya.id });
    assert.equal(propia.codigo, 200);
  });

  test("sin decir de qué solicitud, no se anota nada", async () => {
    const r = await pide({ accion: "llamada" });
    assert.equal(r.codigo, 400);
  });
});

/**
 * Si al volver cambia la garantía, cambia la fianza.
 *
 * Reutilizar la solicitud abierta está bien —es el mismo coche— pero se
 * reutilizaba entera, con la fianza de la primera vez. El cliente elegía la
 * ampliada a 36 meses, veía el precio subir en la ficha, volvía a pedirlo, y
 * lo que quedaba guardado para cobrarle era el 30 % del precio de antes.
 */
describe("volver a pedirlo con otra garantía", { concurrency: 1 }, () => {
  test("la fianza guardada es la de ahora, no la de la primera vez", async () => {
    const primera = await pide({ message: "vvv" });
    const segunda = await pide({ message: "vvv", garantia_id: "ninguna-de-verdad" });
    assert.equal(segunda.id, primera.id, "sigue siendo la misma solicitud");
    const u = actualizaciones.find((x) => /deposit_quoted/.test(x.sql));
    assert.ok(u, "al reutilizarla no se tocaba la fianza: se le cobraría la de antes");
    // Que el número viaje no basta: aquí quien decide es el simulacro, no la
    // consulta. Lo que de verdad guarda la fianza es que la columna esté en el
    // SET apuntando a ese parámetro, y eso se mira en el SQL.
    assert.ok(u.sql.includes("deposit_quoted   = $5") || u.sql.includes("deposit_quoted = $5"),
      "sin la columna en el SET, la fianza guardada sigue siendo la de la primera vez");
    assert.equal(Number(u.params[4]), Number(segunda.deposit),
      "lo guardado tiene que ser lo que se le acaba de decir");
  });

  test("y la dirección nueva también", async () => {
    await pide({ message: "vvv" });
    await pide({ message: "vvv", entrega_direccion: "Calle Mauricio Legendre 45 G2B", entrega_cp: "28046" });
    const u = actualizaciones.find((x) => /entrega_direccion/.test(x.sql));
    assert.ok(u);
    assert.equal(u.params[7], "Calle Mauricio Legendre 45 G2B");
    assert.equal(u.params[8], "28046");
  });

  test("pero si la deja en blanco, no borra la que ya tenía puesta en su panel", async () => {
    await pide({ message: "vvv" });
    await pide({ message: "vvv" });
    const u = actualizaciones.find((x) => /entrega_direccion/.test(x.sql));
    assert.ok(u.sql.includes("entrega_direccion = COALESCE(NULLIF($8, ''), entrega_direccion)"),
      "sin el COALESCE, pedirlo otra vez sin escribir nada le vacía la dirección");
  });
});
