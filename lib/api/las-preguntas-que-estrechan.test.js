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
