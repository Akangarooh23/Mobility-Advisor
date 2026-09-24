/**
 * El cerebro elige entre las ofertas reales, y lo que dice se comprueba.
 *
 * ## El hueco que llena
 *
 * El circuito tenía dos etapas de las tres que hacen falta. Las preguntas
 * estrechan en SQL —de 2.360.000 anuncios a 181 con el perfil medido— y la
 * mediana juzga el precio contra lo que se pide por el mismo modelo, año y
 * tramo de kilómetros. Faltaba quien mirase las que quedaron: el modelo
 * intervenía **antes**, escribiendo cinco nombres de coche de memoria.
 *
 * ## Por qué estas pruebas y no una llamada de verdad
 *
 * Porque lo que hay que fijar no es lo que conteste el modelo —eso cambia—
 * sino **qué se le pide y qué se le cree**. Una respuesta que nombra una
 * oferta que no existe, o que no es JSON, no puede tumbar una búsqueda de
 * cuatro minutos.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  elCerebroElige,
  comoSeLeCuenta,
  comoSeCuentaElCliente,
  loQueSePuedeCreer,
  elEncargo,
} = require("../el-cerebro-elige");

const UNA_OFERTA = {
  brand: "Volkswagen",
  model: "Golf",
  version: "1.5 TSI Life",
  year: 2022,
  mileage: 36025,
  price: 18690,
  fuel: "Gasolina",
  transmission: "Manual",
  powerCv: 130,
  province: "Madrid",
  mercado: { diferencia: 7690, comparables: 1268 },
};

/** Doce ofertas distintas, que es mas de lo que caben en la pantalla. */
const LAS_QUE_HAY = Array.from({ length: 12 }, (_, i) => ({
  ...UNA_OFERTA,
  model: "Modelo" + i,
  price: 12000 + i * 500,
}));

const LAS_RESPUESTAS = {
  uso_principal: "trabajo_diario",
  entorno_uso: "ciudad",
  ocupantes: "5_plazas_maletero_medio",
  horizonte_tenencia: "mas_7",
  presupuesto_total: "15k_20k",
};

/** Un modelo de mentira que contesta lo que se le diga. */
function unModeloQueDice(texto, { ok = true, status = 200 } = {}) {
  const llamadas = [];
  const fetchImpl = async (url, opciones) => {
    llamadas.push({ url, opciones, cuerpo: JSON.parse(opciones.body) });
    return {
      ok,
      status,
      json: async () => ({ content: [{ text: texto }] }),
    };
  };
  return { fetchImpl, llamadas };
}

describe("lo que se le cuenta", () => {
  test("una oferta lleva sus datos y lo que vale en su mercado", () => {
    const linea = comoSeLeCuenta(UNA_OFERTA, 1);

    assert.match(linea, /Volkswagen Golf/);
    assert.match(linea, /2022/);
    assert.match(linea, /Gasolina/);
    assert.match(linea, /por debajo de su mercado/);
    assert.match(linea, /1268 comparables/);
  });

  test("y si esta por encima del mercado, tambien se dice", () => {
    const cara = { ...UNA_OFERTA, mercado: { diferencia: -2000, comparables: 40 } };
    assert.match(comoSeLeCuenta(cara, 1), /por encima de su mercado/);
  });

  test("una oferta sin mediana no inventa ninguna", () => {
    const sinMercado = { ...UNA_OFERTA, mercado: null };
    assert.doesNotMatch(comoSeLeCuenta(sinMercado, 1), /mercado/);
  });

  test("del cliente se le cuenta lo que no cabe en un WHERE", () => {
    const suyo = comoSeCuentaElCliente(LAS_RESPUESTAS);

    assert.match(suyo, /uso_principal/);
    assert.match(suyo, /horizonte_tenencia/);
    /*
     * El presupuesto NO va como criterio: ya esta aplicado en la base. Si se
     * le pasara para filtrar, repetiria un trabajo hecho y peor.
     */
    assert.doesNotMatch(suyo, /presupuesto_total/);
  });
});

describe("y lo que se le pide", () => {
  const encargo = elEncargo(LAS_QUE_HAY, LAS_RESPUESTAS, 4);

  test("se le dice que ya estan filtradas, para que no vuelva a filtrar", () => {
    assert.match(encargo, /TODAS cumplen ya lo que pidió/);
  });

  test("y que el precio no lo juzga el", () => {
    assert.match(encargo, /no la recalcules ni estimes precios/);
  });

  test("se le piden las cuatro y el porque de cada una", () => {
    assert.match(encargo, /Elige 4/);
    assert.match(encargo, /en una frase/);
  });

  test("y se le prohibe el adorno, que es lo que suena a folleto", () => {
    assert.match(encargo, /excelente opción/);
    assert.match(encargo, /sin signos de exclamación/);
  });
});

describe("lo que se le cree", () => {
  test("una eleccion buena pasa entera", () => {
    const dicho = '{"elegidas":[{"n":3,"porque":"cabe en la plaza"},{"n":1,"porque":"aguanta los anos"}]}';
    assert.deepEqual(loQueSePuedeCreer(dicho, 12, 4), [
      { indice: 2, porque: "cabe en la plaza" },
      { indice: 0, porque: "aguanta los anos" },
    ]);
  });

  test("una oferta que no existe se cae", () => {
    /*
     * Lo unico que no puede pasar es que nombre un coche que no esta en la
     * lista y se le ensene al cliente como si estuviera.
     */
    const dicho = '{"elegidas":[{"n":99,"porque":"inventada"},{"n":2,"porque":"buena"}]}';
    assert.deepEqual(loQueSePuedeCreer(dicho, 12, 4), [{ indice: 1, porque: "buena" }]);
  });

  test("y una repetida no ocupa dos huecos", () => {
    const dicho = '{"elegidas":[{"n":2,"porque":"a"},{"n":2,"porque":"b"},{"n":5,"porque":"c"}]}';
    assert.equal(loQueSePuedeCreer(dicho, 12, 4).length, 2);
  });

  test("si no contesta JSON, no se cree nada", () => {
    assert.equal(loQueSePuedeCreer("Pues yo elegiria el Golf, la verdad.", 12, 4), null);
  });

  test("pero un JSON entre comillas de codigo si", () => {
    const dicho = '```json\n{"elegidas":[{"n":1,"porque":"vale"}]}\n```';
    assert.deepEqual(loQueSePuedeCreer(dicho, 12, 4), [{ indice: 0, porque: "vale" }]);
  });

  test("y nunca devuelve mas de las que caben", () => {
    const muchas = { elegidas: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, porque: "x" })) };
    assert.equal(loQueSePuedeCreer(JSON.stringify(muchas), 12, 4).length, 4);
  });
});

describe("la llamada", () => {
  test("devuelve las ofertas elegidas, en su orden, con su porque", async () => {
    const { fetchImpl } = unModeloQueDice('{"elegidas":[{"n":4,"porque":"por la ciudad"},{"n":1,"porque":"por los anos"}]}');

    const elegidas = await elCerebroElige({
      ofertas: LAS_QUE_HAY,
      answers: LAS_RESPUESTAS,
      cuantas: 4,
      apiKey: "una-clave",
      fetchImpl,
    });

    assert.equal(elegidas.length, 2);
    assert.equal(elegidas[0].oferta.model, "Modelo3");
    assert.equal(elegidas[0].porque, "por la ciudad");
    assert.equal(elegidas[1].oferta.model, "Modelo0");
  });

  test("va a Anthropic con la version de la API", async () => {
    const { fetchImpl, llamadas } = unModeloQueDice('{"elegidas":[{"n":1,"porque":"x"}]}');

    await elCerebroElige({ ofertas: LAS_QUE_HAY, answers: {}, apiKey: "k", fetchImpl });

    assert.match(llamadas[0].url, /api\.anthropic\.com/);
    assert.equal(llamadas[0].opciones.headers["x-api-key"], "k");
    assert.ok(llamadas[0].opciones.headers["anthropic-version"]);
  });
});

describe("y si algo va mal, no se lleva la busqueda por delante", () => {
  test("sin clave no llama a nadie", async () => {
    const { fetchImpl, llamadas } = unModeloQueDice("{}");

    const salida = await elCerebroElige({ ofertas: LAS_QUE_HAY, answers: {}, apiKey: "", fetchImpl });

    assert.equal(salida, null);
    assert.equal(llamadas.length, 0, "ha llamado sin clave");
  });

  test("si la API contesta con error, se sigue sin el", async () => {
    const { fetchImpl } = unModeloQueDice("", { ok: false, status: 429 });
    assert.equal(await elCerebroElige({ ofertas: LAS_QUE_HAY, answers: {}, apiKey: "k", fetchImpl }), null);
  });

  test("si revienta, tambien", async () => {
    const fetchImpl = async () => { throw new Error("se ha caido la red"); };
    assert.equal(await elCerebroElige({ ofertas: LAS_QUE_HAY, answers: {}, apiKey: "k", fetchImpl }), null);
  });

  test("y con menos ofertas que huecos ni se molesta", async () => {
    /*
     * Cuatro candidatas para cuatro huecos no es una eleccion: es la misma
     * lista, cobrando.
     */
    const { fetchImpl, llamadas } = unModeloQueDice("{}");

    await elCerebroElige({ ofertas: LAS_QUE_HAY.slice(0, 3), answers: {}, cuantas: 4, apiKey: "k", fetchImpl });

    assert.equal(llamadas.length, 0);
  });
});

describe("y el circuito lo usa donde toca", () => {
  const fs = require("node:fs");
  const FUENTE = fs.readFileSync(require.resolve("../../api/find-listing.js"), "utf8");

  test("elige DESPUES del colador", () => {
    /*
     * Si eligiera antes, podria elegir una oferta que no cumple lo que el
     * cliente pidio y el colador la tiraria despues, dejando un hueco.
     */
    assert.ok(
      FUENTE.indexOf("const dedupedPrioritizedPool = loQueDeVerdadCumple(")
        < FUENTE.indexOf("const loQueEligeElCerebro = await elCerebroElige("),
      "el cerebro elige antes de colar"
    );
  });

  test("y su eleccion sustituye al recorte por modelos", () => {
    assert.match(FUENTE, /const distinctByModel = loQueEligeElCerebro/);
    assert.match(FUENTE, /: enforceDistinctModelListings\(dedupedPrioritizedPool, TOP_LISTINGS_LIMIT\)/);
  });

  test("y el porque llega a la tarjeta", () => {
    // `positionReason` es lo que pinta ResultsOffersView.
    assert.match(FUENTE, /positionReason: porque/);
  });
});
