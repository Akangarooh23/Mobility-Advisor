/**
 * A las 48 horas, recordarle que nos diga si se lo queda.
 *
 * El correo de después de la visita sale en la hora siguiente a acabar, que es
 * cuando lo tiene decidido, y ahí se acababa: quien lo leía con el móvil en la
 * mano y decidía mañana no tenía quien se lo recordara, mientras la ventana
 * para contestar dura catorce días y quien vende espera la respuesta.
 *
 * Se recorre el cron de verdad con una base simulada: lo que se protege es a
 * quién se le manda, cuándo, y que no se mande dos veces.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const path = require("node:path");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.CRON_SECRET = "secreto-de-mentira";

let avisos = [];
const rutaDeAvisos = require.resolve(path.join(__dirname, "..", "avisos-push"));
require.cache[rutaDeAvisos] = {
  id: rutaDeAvisos, filename: rutaDeAvisos, loaded: true,
  exports: {
    enviaAviso: async (correos, aviso) => { avisos.push({ a: correos, ...aviso }); return { enviados: 1 }; },
  },
};

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

const haceHoras = (h) => new Date(Date.now() - h * 3600000).toISOString();

/** La visita de hace dos días que nadie ha contestado. */
const RESERVA = {
  id: "b-1",
  buyer_email: "cliente@example.com",
  buyer_name: "Juan",
  vehicle_title: "Toyota C-HR",
  starts_at: haceHoras(50),
  ends_at: haceHoras(49),
  token_buyer: "t-buena",
  offer_id: "idcar-veh-1",
  seller_email: "vendedor@example.com",
  meeting_place: "Calle Coso 12",
};

let correos = [];
let marcada = "";
/** Si el coche es de un particular: entonces se puede empezar la compra. */
let deParticular = true;

beforeEach(() => {
  correos = [];
  avisos = [];
  marcada = "";
  deParticular = true;

  Pool.prototype.query = async (sql, valores) => {
    const t = String(sql || "").replace(/\s+/g, " ");
    // La pasada del recordatorio, y solo esa: lo demás vacío, para que salga un
    // correo y no veinte.
    if (/FROM vehicle_visit_bookings/i.test(t) && /recordatorio_resultado_at IS NULL/i.test(t)) {
      return {
        rows: [{
          ...RESERVA,
          offer_id: deParticular ? RESERVA.offer_id : "erp-9",
          seller_email: deParticular ? RESERVA.seller_email : null,
        }],
        rowCount: 1,
      };
    }
    if (/UPDATE vehicle_visit_bookings SET recordatorio_resultado_at/i.test(t)) {
      marcada = String(valores?.[0] || "");
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) correos.push(JSON.parse(opciones.body));
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./cron-appointment-reminders-handler.js");
const FUENTE = require("node:fs").readFileSync(__filename.replace("recordar-que-conteste.test.js", "cron-appointment-reminders-handler.js"), "utf8");

async function corre() {
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json() { return res; }, setHeader() { return res; }, end() { return res; },
  };
  await handler({ method: "GET", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query: {} }, res);
  return res._codigo;
}

// En el coche de un particular el asunto pregunta si se lo queda; en el de un
// concesionario, qué tal fue. Es el mismo correo con dos caras.
const elRecordatorio = () => correos.find((c) => /te quedas con|qué tal fue/i.test(c.subject));

describe("el recordatorio de las 48 horas", () => {
  test("sale, con las tres salidas y la de comprar", async () => {
    await corre();
    const c = elRecordatorio();
    assert.ok(c, "no ha salido el recordatorio");
    assert.match(c.html, /\/quiero-comprarlo\?id=b-1&amp;token=t-buena/);
    for (const r of ["fue", "no_fue"]) {
      assert.match(c.html, new RegExp(`/como-fue\\?id=b-1&amp;token=t-buena&amp;r=${r}`));
    }
  });

  test("dice que es el último, que es lo honrado", async () => {
    await corre();
    assert.match(elRecordatorio().html, /último correo/i);
  });

  test("y suena en el móvil, como el primero", async () => {
    await corre();
    const aviso = avisos.find((a) => /has decidido/i.test(a.titulo));
    assert.ok(aviso, "no ha sonado");
    assert.deepEqual(aviso.a, ["cliente@example.com"]);
  });

  test("queda apuntado, para no mandarlo dos veces", async () => {
    await corre();
    assert.equal(marcada, "b-1");
  });

  test("en el coche de un concesionario no se ofrece comprar", async () => {
    deParticular = false;
    await corre();
    const c = elRecordatorio();
    assert.ok(c, "el recordatorio sale igual");
    assert.ok(!c.html.includes("/quiero-comprarlo"), "ha ofrecido una compra que esa página rechaza");
  });
});

describe("a quién se le manda, escrito en la consulta", () => {
  test("solo a quien no ha contestado, y solo si el primero salió", () => {
    assert.match(FUENTE, /resultado IS NULL AND followup_sent_at IS NOT NULL/);
  });

  test("a las 48 horas de la visita", () => {
    assert.match(FUENTE, /ends_at <= NOW\(\) - INTERVAL '48 hours'/);
  });

  test("y dentro de los catorce días en que todavía se puede comprar", () => {
    /*
     * Trece y no catorce a propósito: recordarle el último día algo que caduca
     * ese mismo día es mandarle a una página que dice que ha pasado demasiado
     * tiempo.
     */
    assert.match(FUENTE, /ends_at > NOW\(\) - INTERVAL '13 days'/);
  });

  test("lo manda la pasada de cada hora, no la de las ocho", () => {
    assert.match(FUENTE, /\["followup", "recordatorio_resultado"\]\.includes\(tipo\)/);
  });
});
