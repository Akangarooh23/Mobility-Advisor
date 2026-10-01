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

    /*
     * En cristiano, no con la clave: al modelo se le pasaban los codigos
     * internos y los repetia tal cual en su explicacion -«para sus
     * "viajes_ocio" y "7_plazas_maletero_grande"»-. Ver
     * lib/como-se-lee-el-test.js.
     */
    assert.match(suyo, /Uso principal: Ir al trabajo cada día/);
    assert.match(suyo, /Cuánto tiempo lo quiere/);
    assert.doesNotMatch(suyo, /uso_principal/);

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
    assert.match(encargo, /Una frase/);
  });

  test("y se le prohibe el adorno, que es lo que suena a folleto", () => {
    /*
     * Con la primera version del encargo, Gemini contesto esto contra
     * produccion: «El Ford Focus ofrece un excelente precio y un buen
     * equilibrio entre equipamiento y coste». Vale para cualquiera y para
     * cualquier coche, que es justo lo que no sirve. Por eso ahora se le
     * ensenan ejemplos de lo que no vale y de lo que si.
     */
    assert.match(encargo, /Así no, porque vale para cualquiera/);
    assert.match(encargo, /Así sí, porque solo vale para esta persona/);
    assert.match(encargo, /sin signos de exclamación/);
  });

  test("y se le exige nombrar algo que ha contestado", () => {
    assert.match(encargo, /NOMBRAR algo que ha contestado/);
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

  test("y con una frase delante, tambien", () => {
    /*
     * Medido contra la API: Gemini mete el JSON en ```json casi siempre, y a
     * veces le pone un «Aqui tienes» por delante. Se coge lo que hay entre la
     * primera llave y la ultima.
     */
    const dicho = 'Aqui tienes mi seleccion:\n{"elegidas":[{"n":2,"porque":"por la ciudad"}]}\nEspero que te sirva.';
    assert.deepEqual(loQueSePuedeCreer(dicho, 12, 4), [{ indice: 1, porque: "por la ciudad" }]);
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

/**
 * Y si no hay clave de Anthropic, el que ya se paga.
 *
 * Ana tiene la de Gemini y no la de Anthropic, y no tenerla no puede
 * significar quedarse sin el paso entero. Se prefiere Anthropic porque razona
 * mejor eligiendo, que es lo que se le pide aquí, pero el encargo y la
 * comprobación de lo que contesta son los mismos para los dos.
 */
describe("con la clave que haya", () => {
  /** Google contesta con otra forma: candidates -> content -> parts. */
  function unGeminiQueDice(texto) {
    const llamadas = [];
    const fetchImpl = async (url, opciones) => {
      llamadas.push({ url, opciones });
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }),
      };
    };
    return { fetchImpl, llamadas };
  }

  test("sin Anthropic se le pregunta a Google", async () => {
    const { fetchImpl, llamadas } = unGeminiQueDice('{"elegidas":[{"n":2,"porque":"por la ciudad"}]}');

    const elegidas = await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: LAS_RESPUESTAS, apiKey: "", geminiKey: "gk", fetchImpl,
    });

    assert.match(llamadas[0].url, /generativelanguage\.googleapis\.com/);
    assert.equal(elegidas.length, 1);
    assert.equal(elegidas[0].oferta.model, "Modelo1");
    assert.equal(elegidas[0].porque, "por la ciudad");
  });

  test("y se le pide exactamente lo mismo", async () => {
    const { fetchImpl, llamadas } = unGeminiQueDice('{"elegidas":[{"n":1,"porque":"x"}]}');

    await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: LAS_RESPUESTAS, apiKey: "", geminiKey: "gk", fetchImpl,
    });

    const enviado = JSON.parse(llamadas[0].opciones.body).contents[0].parts[0].text;
    assert.equal(enviado, elEncargo(LAS_QUE_HAY, LAS_RESPUESTAS, 4));
  });

  test("teniendo las dos, manda Anthropic", async () => {
    const { fetchImpl, llamadas } = unModeloQueDice('{"elegidas":[{"n":1,"porque":"x"}]}');

    await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: {}, apiKey: "ak", geminiKey: "gk", fetchImpl,
    });

    assert.match(llamadas[0].url, /api\.anthropic\.com/);
  });

  test("y lo que conteste Google se comprueba igual", async () => {
    /*
     * La respuesta de Google llega envuelta en comillas de codigo mas a
     * menudo, y una oferta inventada es igual de grave venga de quien venga.
     */
    const { fetchImpl } = unGeminiQueDice('```json\n{"elegidas":[{"n":99,"porque":"no existe"}]}\n```');

    const salida = await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: {}, apiKey: "", geminiKey: "gk", fetchImpl,
    });

    assert.equal(salida, null);
  });
});

describe("y si algo va mal, no se lleva la busqueda por delante", () => {
  test("sin ninguna clave no llama a nadie", async () => {
    const { fetchImpl, llamadas } = unModeloQueDice("{}");

    const salida = await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: {}, apiKey: "", geminiKey: "", fetchImpl,
    });

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

  test("con menos ofertas que huecos SI se llama, para explicarlas", async () => {
    /*
     * Aqui habia un corte: con menos candidatas que huecos no se llamaba,
     * porque no hay nada que ELEGIR. Correcto, y la conclusion equivocada:
     * probando con un cliente de verdad salieron tres ofertas perfectas y
     * ninguna con su porque. Cuanto mejor filtra el test, menos candidatas
     * quedan, asi que el corte saltaba justo cuando todo lo demas iba bien.
     */
    const { fetchImpl, llamadas } = unModeloQueDice(
      '{"elegidas":[{"n":1,"porque":"a"},{"n":2,"porque":"b"},{"n":3,"porque":"c"}]}'
    );

    const elegidas = await elCerebroElige({
      ofertas: LAS_QUE_HAY.slice(0, 3), answers: {}, cuantas: 4, apiKey: "k", fetchImpl,
    });

    assert.equal(llamadas.length, 1);
    assert.equal(elegidas.length, 3);
    assert.equal(elegidas[0].porque, "a");
  });

  test("y se le piden las que hay, no las que caben", async () => {
    const { fetchImpl, llamadas } = unModeloQueDice('{"elegidas":[{"n":1,"porque":"x"}]}');

    await elCerebroElige({ ofertas: LAS_QUE_HAY.slice(0, 2), answers: {}, cuantas: 4, apiKey: "k", fetchImpl });

    const encargo = JSON.parse(llamadas[0].opciones.body).messages[0].content;
    assert.match(encargo, /Elige 2/);
  });

  test("pero sin ninguna oferta no se llama a nadie", async () => {
    const { fetchImpl, llamadas } = unModeloQueDice("{}");

    assert.equal(await elCerebroElige({ ofertas: [], answers: {}, apiKey: "k", fetchImpl }), null);
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

/**
 * Quién ha contestado, para poder saberlo desde fuera.
 *
 * Se prefiere Anthropic y se cae a Google si no hay clave, y la pantalla se ve
 * exactamente igual con los dos. Al dar de alta la clave de Anthropic en
 * producción no había forma de comprobar que había entrado: solo se podía
 * mirar el texto de las ofertas y adivinar.
 */
describe("se sabe quien ha contestado", () => {
  test("lo dice en el registro, con su nombre", async () => {
    const dichos = [];
    const antes = console.log;
    console.log = (...x) => dichos.push(x.join(" "));

    try {
      const { fetchImpl } = unModeloQueDice('{"elegidas":[{"n":1,"porque":"x"}]}');
      await elCerebroElige({ ofertas: LAS_QUE_HAY, answers: {}, apiKey: "k", fetchImpl });
    } finally {
      console.log = antes;
    }

    assert.ok(
      dichos.some((d) => /el-cerebro-elige\] ha elegido anthropic/.test(d)),
      "no ha dicho quien elegia: " + JSON.stringify(dichos)
    );
  });

  test("y con Google dice Google", async () => {
    const dichos = [];
    const antes = console.log;
    console.log = (...x) => dichos.push(x.join(" "));

    try {
      const fetchImpl = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"elegidas":[{"n":1,"porque":"x"}]}' }] } }],
        }),
      });
      await elCerebroElige({ ofertas: LAS_QUE_HAY, answers: {}, apiKey: "", geminiKey: "g", fetchImpl });
    } finally {
      console.log = antes;
    }

    assert.ok(dichos.some((d) => /ha elegido google/.test(d)), JSON.stringify(dichos));
  });
});

/**
 * Que no salga dos veces el mismo coche, lo diga el modelo o no.
 *
 * ## Lo que pasó
 *
 * El encargo dice, con esas palabras, «que no sean cuatro veces el mismo
 * coche». Anthropic lo respeta. **Google no**: comparando los dos con las
 * mismas doce ofertas de Sevilla, Google eligió **dos veces el mismo Skoda
 * Superb Combi PHEV** de tres.
 *
 * Y el respaldo no es un caso raro — se usa siempre que Anthropic no esté
 * disponible, y el día que caduque la clave. Una regla que solo se cumple
 * cuando contesta el modelo bueno no es una regla.
 *
 * ## Por qué se completa en vez de devolver menos
 *
 * Las candidatas llegan ordenadas por calidad-precio, así que la siguiente de
 * la lista es una recomendación razonable, solo que sin su frase. Mejor tres
 * coches distintos —uno sin explicación— que dos iguales con ella.
 */
describe("el mismo coche no sale dos veces", () => {
  const { sinRepetirCoche } = require("../el-cerebro-elige");

  const coche = (marca, modelo, id) => ({ brand: marca, model: modelo, id });
  const CANDIDATAS = [
    coche("Skoda", "Superb", 1),
    coche("Skoda", "Superb", 2),
    coche("Seat", "Leon", 3),
    coche("Peugeot", "308", 4),
  ];
  const con = (...ofertas) => ofertas.map((o, i) => ({ oferta: o, porque: "razon " + i }));

  test("el repetido se cae", () => {
    const salida = sinRepetirCoche(con(CANDIDATAS[0], CANDIDATAS[1], CANDIDATAS[2]), CANDIDATAS, 3);
    const cuales = salida.map((x) => x.oferta.brand + " " + x.oferta.model);

    assert.equal(new Set(cuales).size, cuales.length, "hay repetidos: " + cuales.join(", "));
  });

  test("y se completa con el siguiente de la lista", () => {
    const salida = sinRepetirCoche(con(CANDIDATAS[0], CANDIDATAS[1], CANDIDATAS[2]), CANDIDATAS, 3);

    assert.equal(salida.length, 3);
    assert.equal(salida[2].oferta.model, "308");
  });

  test("el que entra para completar viene sin frase, no con una inventada", () => {
    /*
     * No lo ha elegido el modelo, asi que no tiene por que. Poner una frase
     * generica seria fingir que si.
     */
    const salida = sinRepetirCoche(con(CANDIDATAS[0], CANDIDATAS[1]), CANDIDATAS, 3);
    const completado = salida[salida.length - 1];

    assert.equal(completado.porque, "");
  });

  test("pero no rellena los huecos que el cerebro ha dejado a proposito", () => {
    /*
     * Si de doce candidatas elige dos, es que solo dos valian. Completar
     * hasta cuatro con las siguientes de la lista seria deshacer justo lo
     * que se le pidio: que salgan las que de verdad cumplen, no cuatro.
     */
    const salida = sinRepetirCoche(con(CANDIDATAS[0], CANDIDATAS[2]), CANDIDATAS, 4);

    assert.equal(salida.length, 2);
  });

  test("sin repetidos no se toca nada", () => {
    const elegidas = con(CANDIDATAS[0], CANDIDATAS[2], CANDIDATAS[3]);
    assert.deepEqual(sinRepetirCoche(elegidas, CANDIDATAS, 3), elegidas);
  });

  test("y si no hay con que completar, salen menos", () => {
    /*
     * Dos Superb y nada mas: sale uno. Menos ofertas es mejor que la misma
     * dos veces.
     */
    const soloSuperbs = [CANDIDATAS[0], CANDIDATAS[1]];
    const salida = sinRepetirCoche(con(CANDIDATAS[0], CANDIDATAS[1]), soloSuperbs, 3);

    assert.equal(salida.length, 1);
  });

  test("y el circuito lo aplica siempre, no solo con Google", async () => {
    /*
     * Se aplica a lo que devuelva cualquiera de los dos: el dia que Anthropic
     * tambien repita, tampoco saldra repetido.
     */
    const { fetchImpl } = unModeloQueDice('{"elegidas":[{"n":1,"porque":"a"},{"n":2,"porque":"b"}]}');
    const dosIguales = [coche("Skoda", "Superb", 1), coche("Skoda", "Superb", 2), coche("Seat", "Leon", 3)];

    const salida = await elCerebroElige({ ofertas: dosIguales, answers: {}, cuantas: 2, apiKey: "k", fetchImpl });
    const cuales = salida.map((x) => x.oferta.brand + " " + x.oferta.model);

    assert.equal(new Set(cuales).size, cuales.length, cuales.join(", "));
  });
});


/**
 * Ninguna oferta sale a pantalla sin decir por que esta ahi.
 *
 * ## Lo que se vio
 *
 * En produccion, el 1 de octubre de 2026, la tarjeta destacada mostraba
 * «Por que va la 1a:» y debajo **nada**. El titulo prometia una explicacion
 * que no llegaba, que es peor que no prometerla.
 *
 * ## Por que pasaba
 *
 * La rama que usa el consejero -`inventory-only`, la que pide el navegador
 * con `inventoryOnly: true`- devuelve las ofertas tal cual, sin pasar por
 * `buildRankedListingResponse`, que es la unica funcion que escribe
 * `positionReason`. Asi que en esa rama la frase solo existia si la ponia el
 * cerebro, y faltaba en tres casos que no son raros:
 *
 *   - el cerebro no contesta (sin clave, error, o tarda de mas);
 *   - la oferta entra por el relleno de `sinRepetirCoche`, que la anade con
 *     `porque` vacio **a proposito**, porque no la eligio el modelo;
 *   - la anaden los bucles de ensanchado cuando faltan ofertas.
 *
 * ## Por que esta prueba mira el codigo
 *
 * Porque el fallo no es de logica, es una rama de salida que se olvido de un
 * paso. Montar la peticion entera pide base, claves y dos modelos; lo que hay
 * que fijar es mucho mas simple: que esa rama no devuelva sin rellenar.
 */
describe("toda oferta sale con su porque", () => {
  const fuente = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../../api/find-listing.js"), "utf8"
  );

  /** El trozo entre el relleno y el final de la respuesta inventory-only. */
  const ramaInventoryOnly = () => {
    const i = fuente.indexOf("rankedInventory = rankedInventory.map");
    const j = fuente.indexOf("mode: \"inventory-only\"", i);
    return i >= 0 && j > i ? fuente.slice(i, j) : "";
  };

  test("la rama inventory-only rellena el porque antes de devolver", () => {
    assert.ok(ramaInventoryOnly(), "o se ha movido el relleno, o ya no esta antes del return");
    assert.match(ramaInventoryOnly(), /buildPositionReason\(listing\)/);
  });

  test("y no pisa el que ya trae, que es el que escribio el cerebro", () => {
    /*
     * La frase de Anthropic nombra lo que ha contestado el cliente; la de
     * respaldo es generica. Si el relleno machacara, se perderia la buena.
     */
    const rama = ramaInventoryOnly();

    // Lo mira antes de decidir...
    assert.match(rama, /listing\.positionReason/);
    // ...y si ya lo trae, devuelve la oferta tal cual.
    assert.match(rama, /\?\s*listing\s*$/m);
  });

  test("el relleno de sinRepetirCoche sigue poniendo el porque vacio", () => {
    /*
     * Es lo que hace falta aqui: una oferta que el modelo no eligio no puede
     * llevar una frase suya inventada. Se queda sin frase propia y el respaldo
     * le pone la generica.
     */
    const cerebro = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "../el-cerebro-elige.js"), "utf8"
    );
    assert.match(cerebro, /salida\.push\(\{ oferta, porque: "" \}\)/);
  });
});


/**
 * La frase no puede nombrar el puesto, porque el puesto lo decide otro.
 *
 * ## Lo que se vio
 *
 * En produccion, el 1 de octubre de 2026, tras pulsar «Recalcular ofertas»:
 *
 *     PUESTO #1  Hyundai i20   -> «Queda en la posicion #2 porque...»
 *     #2         Ford Focus    -> «Sube al puesto #1 porque...»
 *
 * Las dos frases contradecian lo que el cliente tenia delante.
 *
 * ## Por que pasaba
 *
 * La API escribia el numero dentro del texto, pero el orden final lo decide el
 * navegador DESPUES: al recalcular, `src/App.js` rota la lista para que la que
 * iba primera no vuelva a salir arriba. La frase viajaba con la oferta y se
 * quedaba hablando del orden anterior.
 *
 * Sincronizar el numero con el orden final seria perseguir el sintoma:
 * cualquier reordenacion posterior volveria a romperlo. El puesto ya se ve en
 * la tarjeta, asi que la frase se queda solo con lo que no cambia al
 * reordenar.
 */
describe("el porque no dice en que puesto va", () => {
  const fuente = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../../api/find-listing.js"), "utf8"
  );

  /*
   * Solo el CUERPO de la funcion, no el fichero entero: el comentario de
   * encima cita las frases viejas a proposito, para explicar que pasaba.
   * Buscarlas en todo el fuente daria por roto justo el texto que lo explica.
   */
  const cuerpo = () => {
    const i = fuente.indexOf("function buildPositionReason");
    const j = fuente.indexOf("\n}", i);
    return i >= 0 && j > i ? fuente.slice(i, j) : "";
  };

  test("ya no se escribe ningun numero de posicion en la frase", () => {
    assert.ok(cuerpo(), "no encuentro la funcion");
    assert.doesNotMatch(cuerpo(), /Sube al puesto/);
    assert.doesNotMatch(cuerpo(), /Queda en la posici/);
    assert.doesNotMatch(cuerpo(), /#\$\{/, "ningun numero interpolado en el texto");
  });

  test("y la frase ya no depende del indice", () => {
    /*
     * Mientras reciba el indice, alguien puede volver a meterlo en el texto.
     * Sin el parametro, no hay de donde sacarlo.
     */
    assert.match(fuente, /function buildPositionReason\(listing\)/);
    assert.doesNotMatch(fuente, /buildPositionReason\(listing, index\)/);
  });

  test("el front sigue rotando al recalcular, que es por lo que hacia falta", () => {
    /*
     * Si algun dia deja de rotar, esta prueba no obliga a volver atras: la
     * frase sin numero sigue siendo correcta. Esta aqui para que quien lea
     * esto entienda de donde venia el cruce.
     */
    const app = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "../../src/App.js"), "utf8"
    );
    assert.match(app, /previousTopIndex/);
  });
});


/**
 * Si Anthropic falla, se le pregunta a Google. Poner la clave buena no puede
 * empeorar el resultado.
 *
 * ## Lo que paso
 *
 * El proveedor se elegia UNA vez, al principio: «anthropic si hay clave, si no
 * google». Eso es un respaldo por AUSENCIA de clave, no por FALLO. Asi que,
 * desde que la clave de Anthropic entro en Vercel, cualquier fallo suyo dejaba
 * al consejero sin ninguna frase sin siquiera probar Gemini, que llevaba meses
 * funcionando.
 *
 * Visto en produccion el 1 de octubre de 2026: las dos ofertas salieron con la
 * frase generica de respaldo -«buen equilibrio general para tu perfil»-, la
 * misma para todo el mundo. Antes de poner la clave, Gemini escribia frases
 * que nombraban lo que el cliente habia contestado.
 *
 * Dos llamadas solo en el caso malo; en el bueno se gasta igual que antes.
 */
describe("si Anthropic falla, contesta Google", () => {
  /** Anthropic revienta con el codigo que se le diga; Google contesta bien. */
  function unAnthropicRotoYUnGoogleQueVa(dichoDeGoogle, { status = 401 } = {}) {
    const llamadas = [];
    const fetchImpl = async (url, opciones) => {
      llamadas.push(url);
      if (String(url).includes("anthropic")) {
        return { ok: false, status, json: async () => ({ error: { message: "nope" } }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: dichoDeGoogle }] } }] }),
      };
    };
    return { fetchImpl, llamadas };
  }

  test("con una clave invalida de Anthropic, las frases llegan igual", async () => {
    const { fetchImpl, llamadas } = unAnthropicRotoYUnGoogleQueVa(
      '{"elegidas":[{"n":1,"porque":"por la ciudad"}]}'
    );

    const elegidas = await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: LAS_RESPUESTAS, cuantas: 1,
      apiKey: "una-que-no-vale", geminiKey: "gk", fetchImpl,
    });

    assert.ok(elegidas, "se ha quedado sin nada teniendo Google a mano");
    assert.equal(elegidas[0].porque, "por la ciudad");
    assert.ok(llamadas.some((u) => u.includes("anthropic")), "no ha probado Anthropic primero");
    assert.ok(llamadas.some((u) => u.includes("generativelanguage")), "no ha caido a Google");
  });

  test("y si Anthropic contesta algo que no se puede creer, tambien", async () => {
    /*
     * No hace falta que falle la peticion: basta con que devuelva algo que no
     * se puede creer. El resultado para el cliente es el mismo.
     */
    const llamadas = [];
    const fetchImpl = async (url) => {
      llamadas.push(url);
      if (String(url).includes("anthropic")) {
        return { ok: true, status: 200, json: async () => ({ content: [{ text: "pues no se" }] }) };
      }
      return {
        ok: true, status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"elegidas":[{"n":2,"porque":"vale"}]}' }] } }] }),
      };
    };

    const elegidas = await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: LAS_RESPUESTAS, cuantas: 1,
      apiKey: "k", geminiKey: "gk", fetchImpl,
    });

    assert.ok(elegidas);
    assert.equal(elegidas[0].porque, "vale");
  });

  test("cuando Anthropic va bien, a Google no se le llama", async () => {
    /* El caso bueno no puede costar dos llamadas. */
    const { fetchImpl, llamadas } = unModeloQueDice('{"elegidas":[{"n":1,"porque":"a"}]}');

    await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: LAS_RESPUESTAS, cuantas: 1,
      apiKey: "k", geminiKey: "gk", fetchImpl,
    });

    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0].url, /anthropic/);
  });

  test("y sin clave de Google no hay segundo intento", async () => {
    const { fetchImpl, llamadas } = unAnthropicRotoYUnGoogleQueVa("{}");

    const elegidas = await elCerebroElige({
      ofertas: LAS_QUE_HAY, answers: LAS_RESPUESTAS, cuantas: 1,
      apiKey: "k", geminiKey: "", fetchImpl,
    });

    assert.equal(elegidas, null);
    assert.ok(!llamadas.some((u) => u.includes("generativelanguage")));
  });
});
