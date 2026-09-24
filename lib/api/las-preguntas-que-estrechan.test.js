/**
 * Las preguntas nuevas tienen que llegar hasta el WHERE.
 *
 * ## La regla con la que se eligieron
 *
 * Solo se pregunta por lo que el pool sabe responder. Medido sobre una muestra
 * de 23.715 ofertas antes de escribir ninguna pregunta:
 *
 *     transmission        100%
 *     seller_type         100%
 *     power_cv             95%
 *     doors                60%
 *     seats                26%
 *     traction             16%
 *
 * Por eso se pregunta por el cambio, por quién vende y por la potencia, y NO
 * por las plazas ni por la tracción aunque parezcan igual de útiles: filtrar
 * por una columna vacía en tres cuartas partes esconde tres de cada cuatro
 * coches buenos por no haberlos sabido describir.
 *
 * ## Y por qué esta prueba recorre el camino entero
 *
 * Porque una pregunta puede existir, guardarse y no filtrar nada. El cambio y
 * el vendedor ya llegaban a `listInventoryOffers` y morían ahí: el objeto de
 * criterios que se armaba dentro no los nombraba. Nadie se entera de eso
 * mirando la pantalla.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { elEncargoDeBusqueda } = require("../el-encargo-de-busqueda");
const { condicionesDelConsejero, LOS_CRITERIOS } = require("../lo-que-busca-el-consejero");
const { porQueNoVale, losLimites } = require("../lo-que-de-verdad-cumple");
const { comoLasLeeElMotor } = require("../las-respuestas-del-test");

const RESPUESTAS = {
  cambio_preferido: "automatico",
  quien_vende: "profesional",
  potencia_minima: "al_menos_110",
  zbe_impacto: "alta",
};

describe("del test al encargo", () => {
  test("las tres respuestas se convierten en criterios", () => {
    const encargo = elEncargoDeBusqueda(comoLasLeeElMotor(RESPUESTAS));

    // «automat», que es la raiz que casa con el «Automatica» del pool.
    assert.equal(encargo.transmission, "automat");
    assert.equal(encargo.sellerType, "profesional");
    assert.equal(encargo.minPowerCv, 110);
  });

  test("«me da igual» no pone ningun filtro", () => {
    const encargo = elEncargoDeBusqueda({
      cambio_preferido: "indiferente_cambio",
      quien_vende: "indiferente_vendedor",
      potencia_minima: "indiferente_potencia",
    });

    assert.deepEqual(encargo, {});
  });

  test("la etiqueta sale de las ZBE, que ya se preguntaban", () => {
    /*
     * A Madrid Central no se entra con una B ni con una C. Quien dice que las
     * zonas restringidas le afectan mucho ya ha contestado que necesita ECO o
     * CERO; preguntarselo otra vez seria pedirle que traduzca su respuesta.
     */
    assert.equal(elEncargoDeBusqueda({ zbe_impacto: "alta" }).environmentalLabel, "eco_o_cero");
  });

  test("y con «algo» no se filtra: le valen la mayoria de los dias", () => {
    assert.equal(elEncargoDeBusqueda({ zbe_impacto: "media" }).environmentalLabel, undefined);
  });
});

describe("del encargo al WHERE", () => {
  test("el cambio, el vendedor y la potencia llegan a la consulta", () => {
    const { condiciones } = condicionesDelConsejero({
      transmission: "automatico",
      sellerType: "profesional",
      minPowerCv: 110,
    });

    const sql = condiciones.join(" AND ");
    assert.match(sql, /transmission/);
    assert.match(sql, /seller_type/);
    assert.match(sql, /power_cv >= /);
  });

  test("y lo que no se pregunta no pone condicion", () => {
    const { condiciones } = condicionesDelConsejero({});
    assert.deepEqual(condiciones, []);
  });

  test("la potencia va como minimo, nunca como maximo", () => {
    const { condiciones } = condicionesDelConsejero({ minPowerCv: 150 });
    assert.equal(condiciones.length, 1);
    assert.match(condiciones[0], /power_cv >= \$1/);
  });
});

describe("la lista de criterios es una sola", () => {
  test("estan los que se pueden perder por el camino", () => {
    /*
     * Esta lista es la que recorre inventoryStore para armar los criterios.
     * Antes los copiaba a mano y tres veces se dejo alguno sin que nada
     * fallara: la provincia, los kilometros, y el cambio con el vendedor.
     */
    for (const clave of ["maxMileage", "maxPrice", "provinciaFormas", "transmission", "sellerType", "minPowerCv"]) {
      assert.ok(LOS_CRITERIOS.includes(clave), `falta ${clave} en LOS_CRITERIOS`);
    }
  });

  test("y quien arma los criterios la recorre en vez de copiarla", () => {
    const fs = require("node:fs");
    const fuente = fs.readFileSync(require.resolve("../inventoryStore.js"), "utf8");

    assert.match(fuente, /for \(const clave of LOS_CRITERIOS\)/);
  });
});

describe("y al final, el colador", () => {
  test("un manual no se le cuela a quien pidio automatico", () => {
    const limites = losLimites({ transmission: "automat" });
    assert.equal(porQueNoVale({ transmission: "Manual" }, limites), "otro cambio");
    assert.equal(porQueNoVale({ transmission: "Automática" }, limites), null);
  });

  test("ni un particular a quien queria garantia", () => {
    const limites = losLimites({ sellerType: "profesional" });
    assert.equal(porQueNoVale({ sellerType: "particular" }, limites), "otro vendedor");
  });

  test("ni un coche de 90 CV a quien pidio 150", () => {
    const limites = losLimites({ minPowerCv: 150 });
    assert.equal(porQueNoVale({ powerCv: 90 }, limites), "menos potencia de la pedida");
    assert.equal(porQueNoVale({ powerCv: 150 }, limites), null);
  });
});

/**
 * El coche importado, que no es solo un filtro más.
 *
 * Uno de cada siete anuncios del pool viene de Alemania: 6.214 de 47.696
 * medidos, con la columna rellena en el 100%.
 *
 * Pero lo que hace que esta pregunta importe es otra cosa. La mediana con la
 * que se juzga si un coche está bien de precio **se calcula solo con coches ya
 * matriculados en España** —`WHERE is_active AND country = 'ES'`— así que un
 * importado sale siempre «por debajo del mercado» en parte porque todavía no
 * está matriculado aquí. Ese descuento no es un chollo: es la matriculación,
 * el impuesto y la ITV que quien lo compre va a pagar después.
 *
 * Quien no quiera papeleo no los ve. Quien diga que le da igual los ve
 * marcados, para que sepa lo que está comparando.
 */
describe("el coche importado", () => {
  test("«solo coches ya en España» pide país, y lo demás no pide nada", () => {
    assert.equal(elEncargoDeBusqueda({ coche_importado: "solo_nacional" }).country, "ES");
    assert.equal(elEncargoDeBusqueda({ coche_importado: "importado_vale" }).country, undefined);
    assert.equal(elEncargoDeBusqueda({}).country, undefined);
  });

  test("y llega a la consulta con igualdad, no por parecido", () => {
    const { condiciones } = condicionesDelConsejero({ country: "ES" });
    assert.equal(condiciones.length, 1);
    assert.match(condiciones[0], /upper\(COALESCE\(country,''\)\) = \$1/);
  });

  test("un pais que no es un pais no pone condicion", () => {
    // Que no se cuele nada raro en el WHERE por la puerta de atras.
    assert.deepEqual(condicionesDelConsejero({ country: "' OR 1=1 --" }).condiciones, []);
  });

  test("el colador tira el aleman a quien pidio nacional", () => {
    const limites = losLimites({ country: "ES" });

    assert.equal(porQueNoVale({ country: "DE" }, limites), "esta importado");
    assert.equal(porQueNoVale({ country: "es" }, limites), null);
  });

  test("y sin saber de donde viene, tampoco pasa", () => {
    assert.equal(porQueNoVale({ country: "" }, losLimites({ country: "ES" })), "no dicen de donde viene");
  });

  test("a quien le da igual, el aleman le vale", () => {
    assert.equal(porQueNoVale({ country: "DE" }, losLimites({})), null);
  });

  test("pero se le ensena marcado, que es lo que evita el chollo falso", () => {
    const fs = require("node:fs");
    const fuente = fs.readFileSync(require.resolve("../../api/find-listing.js"), "utf8");

    assert.match(fuente, /\? "importado"/);
  });
});

/**
 * La etiqueta no puede contradecir la motorización elegida.
 *
 * Esto estuvo mal y se vio en producción. A quien pidió un compacto de
 * gasolina de menos de 10.000 € y dijo que las ZBE le afectan mucho, se le
 * exigía además etiqueta ECO o CERO. Medido sobre el pool, contando cómo se
 * va cerrando la búsqueda:
 *
 *     86.077  precio y kilómetros
 *     59.263  + gasolina
 *      3.740  + compacto
 *          0  + etiqueta ECO o CERO
 *
 * Cero en 2.360.000 anuncios. Un gasolina barato no lleva ECO, así que las dos
 * respuestas se contradicen — y el filtro resolvía la contradicción en
 * silencio, dejando al cliente sin una sola oferta y sin saber por qué.
 *
 * Esa tensión hay que contarla, no arreglarla escondiendo el mercado entero.
 */
describe("la etiqueta no deja a nadie sin coches", () => {
  test("a quien pide gasolina no se le exige ademas ECO", () => {
    const encargo = elEncargoDeBusqueda({
      propulsion_preferida: ["gasolina"],
      zbe_impacto: "alta",
      presupuesto_total: "hasta_10k",
    });

    assert.equal(encargo.environmentalLabel, undefined);
    // Y lo que si ha pedido sigue estando.
    assert.equal(encargo.maxPrice, 10000);
  });

  test("ni a quien pide diesel", () => {
    assert.equal(
      elEncargoDeBusqueda({ propulsion_preferida: ["diesel"], zbe_impacto: "alta" }).environmentalLabel,
      undefined
    );
  });

  test("pero a quien pide hibrido o electrico si, que pueden llevarla", () => {
    for (const motor of ["hibrido_no_enchufable", "hibrido_enchufable", "electrico_puro", "glp_gnc"]) {
      assert.equal(
        elEncargoDeBusqueda({ propulsion_preferida: [motor], zbe_impacto: "alta" }).environmentalLabel,
        "eco_o_cero",
        motor
      );
    }
  });

  test("y a quien no ha elegido motor, tambien", () => {
    /*
     * Quien no elige deja que se decida por el, y entonces si se le buscan
     * coches que puedan entrar en la ZBE que ha dicho que le afecta.
     */
    assert.equal(elEncargoDeBusqueda({ zbe_impacto: "alta" }).environmentalLabel, "eco_o_cero");
    assert.equal(
      elEncargoDeBusqueda({ propulsion_preferida: ["indiferente_motor"], zbe_impacto: "alta" }).environmentalLabel,
      "eco_o_cero"
    );
  });

  test("si elige gasolina Y electrico, la etiqueta se queda", () => {
    // Uno de los dos puede llevarla, asi que el filtro no le deja sin nada.
    assert.equal(
      elEncargoDeBusqueda({ propulsion_preferida: ["gasolina", "electrico_puro"], zbe_impacto: "alta" }).environmentalLabel,
      "eco_o_cero"
    );
  });
});

/**
 * «5_anos» no es el año 5.
 *
 * ## El fallo, que llevaba ahí desde siempre
 *
 * La búsqueda hacía esto con la respuesta de antigüedad:
 *
 *     targetYear: answers?.antiguedad_vehiculo_buscada?.[0]
 *
 * Y esa respuesta es una **cadena**, «5_anos», no una lista. Así que `[0]` es
 * el carácter `"5"`, que entraba en la consulta **como si fuera un año de
 * matriculación**: se buscaban coches de alrededor del año 5.
 *
 * Medido con un perfil real —compacto automático en Valencia, hasta 20.000 €—
 * pasando exactamente ese carácter a la búsqueda:
 *
 *     targetYear: null   ->  3 ofertas
 *     targetYear: "5"    ->  0 ofertas
 *
 * Y no fallaba: devolvía cero, se disparaban las búsquedas de emergencia y
 * acababan saliendo SUV donde se había pedido un compacto. Le pasaba a
 * cualquiera que contestara la antigüedad, que es casi todo el mundo.
 */
describe("la antiguedad es una antiguedad, no un ano", () => {
  const ESTE_ANO = new Date().getFullYear();

  test("cinco años son los matriculados de hace cinco en adelante", () => {
    assert.equal(elEncargoDeBusqueda({ antiguedad_vehiculo_buscada: "5_anos" }).minYear, ESTE_ANO - 5);
  });

  test("y «0 años o km 0» es este mismo año", () => {
    assert.equal(elEncargoDeBusqueda({ antiguedad_vehiculo_buscada: "cero_anos" }).minYear, ESTE_ANO);
  });

  test("«más de 7 años» y «me es indiferente» no ponen tope", () => {
    assert.equal(elEncargoDeBusqueda({ antiguedad_vehiculo_buscada: "mas_7_anos" }).minYear, undefined);
    assert.equal(elEncargoDeBusqueda({ antiguedad_vehiculo_buscada: "indiferente" }).minYear, undefined);
  });

  test("y en ningun caso sale un ano de una sola cifra", () => {
    /*
     * Lo que caracterizaba al fallo: un «ano» de un digito. Si alguna vez
     * vuelve a salir algo asi, es que se esta leyendo un caracter suelto.
     */
    for (const respuesta of ["cero_anos", "2_3_anos", "5_anos", "7_anos", "mas_7_anos", "indiferente"]) {
      const { minYear } = elEncargoDeBusqueda({ antiguedad_vehiculo_buscada: respuesta });
      if (minYear !== undefined) {
        assert.ok(minYear > 1950, respuesta + " ha dado el ano " + minYear);
      }
    }
  });

  test("y la busqueda ya no lee el primer caracter de la respuesta", () => {
    const fs = require("node:fs");
    const fuente = fs.readFileSync(require.resolve("../../api/find-listing.js"), "utf8");

    // Se busca la asignacion, no la palabra: el comentario que lo explica la lleva.
    assert.doesNotMatch(fuente, /targetYear: answers\?\.antiguedad_vehiculo_buscada/);
    assert.match(fuente, /minYear: filters\?\.minYear \|\| delTest\.minYear/);
  });
});
