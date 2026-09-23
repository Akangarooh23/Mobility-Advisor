/**
 * Sin ficha técnica no se tasa su coche.
 *
 * Una tasación compara su coche con los que son como él, y la versión es lo que
 * dice cuáles son: una gama tiene tres «1.5» que no valen lo mismo. Esa versión
 * la elige el cliente de una lista y de memoria; si elige la que no es, el
 * número no sale mal por poco — sale comparado con **otros coches**, y de ahí
 * sale luego el precio de salida.
 *
 * Se recorre el manejador de verdad. En la pantalla el botón ya sale apagado, y
 * lo que se protege aquí es lo otro: que un botón apagado no es un bloqueo.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const ANTES = require("../antes-de-tasar");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

let tieneFicha;
let guardadas;
let revientaLaConsulta;

const queryOriginal = Pool.prototype.query;

before(() => {
  Pool.prototype.query = async function (sql, p = []) {
    const t = String(sql || "").replace(/\s+/g, " ");
    const r = (rows) => ({ rows, rowCount: rows.length });

    if (/FROM moveadvisor_user_vehicle_documents/.test(t) && /document_type = \$2/.test(t)) {
      if (revientaLaConsulta) throw new Error("la tabla no responde");
      return r(tieneFicha && p[1] === "technical_sheet" ? [{ "?column?": 1 }] : []);
    }
    // El coche es suyo, y la tasación se guarda.
    if (/FROM moveadvisor_user_vehicles WHERE id = \$1/.test(t)) return r([{ id: p[0], title: "Volkswagen T-Roc" }]);
    if (/INSERT INTO moveadvisor_user_valuations/.test(t)) { guardadas.push(p[3]); return r([]); }
    if (/FROM moveadvisor_user_valuations/.test(t)) return r([]);
    if (/FROM moveadvisor_users/.test(t)) return r([{ id: 1, email: "ana@example.com" }]);
    return r([]);
  };
});

after(() => { Pool.prototype.query = queryOriginal; });

beforeEach(() => {
  tieneFicha = false;
  guardadas = [];
  revientaLaConsulta = false;
});

describe("la regla, suelta", () => {
  const conFicha = { query: async () => ({ rows: [{ 1: 1 }] }) };
  const sinFicha = { query: async () => ({ rows: [] }) };

  test("con la ficha subida se puede tasar", async () => {
    assert.equal(await ANTES.porQueNoSePuedeTasar(conFicha, "veh-1"), "");
  });

  test("sin ella no, y se dice para qué hace falta", async () => {
    const falta = await ANTES.porQueNoSePuedeTasar(sinFicha, "veh-1");
    assert.match(falta, /ficha técnica/);
    assert.match(falta, /versión real/);
  });

  test("la tasación suelta de la web no pasa por aquí", async () => {
    /*
     * Quien todavía no tiene el coche dado de alta no tiene IDCar, ni ficha, ni
     * nada que comprobar. Bloquearle sería cerrar la puerta de entrada.
     */
    assert.equal(await ANTES.porQueNoSePuedeTasar(sinFicha, ""), "");
    assert.equal(await ANTES.porQueNoSePuedeTasar(sinFicha, null), "");
  });

  test("y si la base no responde, tampoco se tasa", async () => {
    /*
     * Esto dejaba pasar, con el argumento de que una tabla caída no puede
     * dejar sin tasar a nadie. Es el argumento equivocado: una tasación vale
     * lo que vale su fiabilidad. Si no podemos comprobar con qué coche estamos
     * comparando, lo que sale no es una tasación peor — es un número sin
     * respaldo, y encima se le cobra o se le gasta la gratuita.
     */
    const rota = { query: async () => { throw new Error("no responde"); } };
    const falta = await ANTES.porQueNoSePuedeTasar(rota, "veh-1");
    assert.equal(falta, ANTES.NO_SE_PUEDE_COMPROBAR);
    // Y no le dice que suba la ficha, que a lo mejor ya la tiene.
    assert.ok(!/sube/i.test(falta));
    assert.match(falta, /no te hemos cobrado/i);
  });

  test("ni sin base de datos siquiera", async () => {
    assert.equal(await ANTES.porQueNoSePuedeTasar(null, "veh-1"), ANTES.NO_SE_PUEDE_COMPROBAR);
  });

  test("se busca el papel por el nombre con el que se guarda", () => {
    assert.equal(ANTES.LA_FICHA, "technical_sheet");
    // Vale tanto la que está en el almacén como la que quedó guardada en base.
    assert.match(ANTES.SQL_TIENE_FICHA, /file_url/);
    assert.match(ANTES.SQL_TIENE_FICHA, /file_content_base64/);
  });
});

describe("cuando lo que hay es la matrícula", () => {
  /*
   * La tasación de pago llega con la matrícula que escribió, no con el
   * identificador del coche. Es la que cobra o gasta la gratuita, así que es
   * la que más importa que esté bien.
   */
  const base = (coche, ficha) => ({
    query: async (sql) => {
      if (/FROM moveadvisor_user_vehicles/.test(String(sql))) return { rows: coche ? [{ id: "veh-1" }] : [] };
      return { rows: ficha ? [{ 1: 1 }] : [] };
    },
  });

  test("si esa matrícula es de un coche suyo, le hace falta la ficha", async () => {
    const falta = await ANTES.porQueNoSePuedeTasarSuCoche(base(true, false), "ana@example.com", "8888 LXR");
    assert.equal(falta, ANTES.PORQUE);
  });

  test("y con la ficha subida, adelante", async () => {
    assert.equal(await ANTES.porQueNoSePuedeTasarSuCoche(base(true, true), "ana@example.com", "8888LXR"), "");
  });

  test("si no es ninguno de los suyos, es la tasación suelta y pasa", async () => {
    /*
     * Quien todavía no tiene el coche dado de alta no tiene papeles que
     * enseñar. Lo que salga depende de lo que haya escrito él, y eso es cosa
     * suya: es la puerta de entrada y cerrarla sería cerrar el negocio.
     */
    assert.equal(await ANTES.porQueNoSePuedeTasarSuCoche(base(false, false), "ana@example.com", "1234ABC"), "");
  });

  test("sin matrícula no se comprueba nada", async () => {
    assert.equal(await ANTES.porQueNoSePuedeTasarSuCoche(base(true, false), "ana@example.com", ""), "");
  });

  test("y si no se puede mirar su garaje, tampoco se tasa", async () => {
    // Sin saber si tiene IDCar no se puede decir que no haga falta comprobarlo.
    const rota = { query: async () => { throw new Error("no responde"); } };
    assert.equal(
      await ANTES.porQueNoSePuedeTasarSuCoche(rota, "ana@example.com", "8888LXR"),
      ANTES.NO_SE_PUEDE_COMPROBAR,
    );
  });

  test("la matrícula se compara sin espacios ni guiones", async () => {
    let pedida = "";
    const espia = {
      query: async (sql, p) => {
        if (/FROM moveadvisor_user_vehicles/.test(String(sql))) { pedida = p[0]; return { rows: [{ id: 'veh-1' }] }; }
        return { rows: [{ 1: 1 }] };
      },
    };
    await ANTES.porQueNoSePuedeTasarSuCoche(espia, "Ana@Example.com", "8888-lxr");
    assert.equal(pedida, "8888LXR");
  });
});

describe("los nombres del papel", () => {
  test("se busca por el nombre con el que se guarda", () => {
    assert.equal(ANTES.LA_FICHA, "technical_sheet");
    // Vale tanto la que está en el almacén como la que quedó guardada en base.
    assert.match(ANTES.SQL_TIENE_FICHA, /file_url/);
    assert.match(ANTES.SQL_TIENE_FICHA, /file_content_base64/);
  });
});

const handler = require("./billing-account-handler.js");

async function pideTasar(valuation) {
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler({
    method: "POST",
    headers: {},
    query: {},
    body: { action: "valuation_add", email: "ana@example.com", valuation },
  }, res);
  return salida;
}

describe("y el manejador no la guarda", () => {
  test("sin la ficha contesta que falta, y no apunta nada", async () => {
    tieneFicha = false;
    const r = await pideTasar({ vehicleId: "veh-1", title: "Volkswagen T-Roc" });
    assert.equal(r.codigo, 409);
    assert.equal(r.cuerpo.error, "falta_la_ficha_tecnica");
    assert.match(r.cuerpo.message, /ficha técnica/);
    assert.equal(guardadas.length, 0, "se ha guardado una tasación sin ficha técnica");
  });

  test("con la ficha subida, sigue su camino", async () => {
    tieneFicha = true;
    const r = await pideTasar({ vehicleId: "veh-1", title: "Volkswagen T-Roc" });
    assert.notEqual(r.codigo, 409);
  });
});

/**
 * Y que el bloqueo esté **antes** de cobrar.
 *
 * Esto se mira en el fuente y no montando el manejador, porque lo que se
 * protege es el **orden**, y el orden no se ve desde fuera: un bloqueo puesto
 * después de la gratuita deja la tasación cobrada —o la única gratis gastada—
 * y devuelve el error igual. Desde la prueba, las dos versiones contestan 409.
 */
describe("el orden, que es lo que decide si se le cobra", () => {
  const CHECKOUT = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "billing-checkout-handler.js"), "utf8",
  );

  test("la ficha se comprueba antes de gastar la gratuita", () => {
    const guardia = CHECKOUT.indexOf("porQueNoSePuedeTasarSuCoche(");
    const gratuita = CHECKOUT.indexOf("tasacion.leQuedaLaGratuita(");
    assert.ok(guardia > 0, "no encuentro la comprobación de la ficha técnica');");
    assert.ok(gratuita > 0, 'no encuentro dónde se entrega la gratuita');
    assert.ok(guardia < gratuita, 'la ficha se comprueba después de gastarle la gratuita');
  });

  test('y antes de abrir la pasarela de esa tasación', () => {
    /*
     * La pasarela de esta ruta, no la primera que aparezca en el fichero:
     * `upsertStripeCustomer` se llama desde cuatro sitios y la definición está
     * arriba del todo. La de la tasación es la que viene después de la
     * gratuita, que es por donde sigue quien ya no tiene la suya.
     */
    const guardia = CHECKOUT.indexOf('porQueNoSePuedeTasarSuCoche(');
    const gratuita = CHECKOUT.indexOf('tasacion.leQuedaLaGratuita(');
    const pasarela = CHECKOUT.indexOf('await upsertStripeCustomer({', gratuita);
    assert.ok(pasarela > 0, 'no encuentro dónde se abre la pasarela de la tasación');
    assert.ok(guardia < pasarela, 'se le abre la pasarela antes de comprobar la ficha');
  });
});
