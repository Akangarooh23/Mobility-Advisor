/**
 * Tres ofertas que encajan valen más que tres huecos llenos.
 *
 * El caso que da origen a todo esto está abajo con sus cifras reales: el Isuzu
 * Trooper de 1989 con 322.000 km que salió de primera opción a quien había
 * pedido un compacto de gasolina en Madrid con 100.000 km como máximo.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  loQueDeVerdadCumple,
  loQueSeLeDice,
  porQueNoVale,
  losLimites,
} = require("../lo-que-de-verdad-cumple");

/** Lo que pidió el cliente del caso real. */
const LO_QUE_PIDIO = {
  maxMileage: 100000,
  maxPrice: 20000,
  provinciaFormas: ["madrid"],
};

const EL_ISUZU = {
  brand: "Isuzu",
  model: "Trooper TD",
  year: 1989,
  mileage: 322000,
  price: 3500,
  province: "Sevilla",
  image: "https://x/y.jpg",
};

const UN_GOLF_QUE_ENCAJA = {
  brand: "Volkswagen",
  model: "Golf",
  year: 2022,
  mileage: 36025,
  price: 18690,
  province: "Madrid",
  image: "https://x/g.jpg",
};

describe("el Isuzu no vuelve a salir", () => {
  test("se cae por los kilometros", () => {
    assert.equal(porQueNoVale(EL_ISUZU, losLimites(LO_QUE_PIDIO)), "demasiados kilometros");
  });

  test("y aunque estuviera en Madrid y costara dos duros, se cae igual", () => {
    /*
     * Era barato y eso es justo lo que lo colaba: ordenado por precio subia al
     * primer puesto. Barato no es lo mismo que adecuado.
     */
    const enMadrid = { ...EL_ISUZU, province: "Madrid", price: 1200 };
    assert.equal(porQueNoVale(enMadrid, losLimites(LO_QUE_PIDIO)), "demasiados kilometros");
  });

  test("el Golf que si cumple pasa", () => {
    assert.equal(porQueNoVale(UN_GOLF_QUE_ENCAJA, losLimites(LO_QUE_PIDIO)), null);
  });
});

describe("salen las que cumplen, sean las que sean", () => {
  test("una sola, si es la unica", () => {
    const { cumplen, descartadas } = loQueDeVerdadCumple(
      [EL_ISUZU, UN_GOLF_QUE_ENCAJA, { ...EL_ISUZU, brand: "Infiniti", model: "FX" }],
      LO_QUE_PIDIO
    );

    assert.equal(cumplen.length, 1);
    assert.equal(cumplen[0].model, "Golf");
    assert.equal(descartadas, 2);
  });

  test("y ninguna, si no hay ninguna", () => {
    const { cumplen } = loQueDeVerdadCumple([EL_ISUZU], LO_QUE_PIDIO);
    assert.deepEqual(cumplen, []);
  });

  test("lo que no se pregunto no descarta a nadie", () => {
    /*
     * Quien no contesta al tope de kilometros no esta diciendo «pocos»: esta
     * diciendo que le da igual. Un tope inventado le esconderia ofertas que
     * habria mirado.
     */
    const { cumplen } = loQueDeVerdadCumple([EL_ISUZU, UN_GOLF_QUE_ENCAJA], {});
    assert.equal(cumplen.length, 2);
  });
});

describe("la provincia, con la columna sucia que hay", () => {
  test("«Madrid, Madrid» y «28001 Madrid» son Madrid", () => {
    for (const province of ["Madrid, Madrid", "28001 Madrid", "MADRID"]) {
      assert.equal(porQueNoVale({ ...UN_GOLF_QUE_ENCAJA, province }, losLimites(LO_QUE_PIDIO)), null, province);
    }
  });

  test("y Málaga con tilde encaja con la forma sin tilde", () => {
    const limites = losLimites({ provinciaFormas: ["malaga", "málaga"] });
    assert.equal(porQueNoVale({ ...UN_GOLF_QUE_ENCAJA, province: "Málaga" }, limites), null);
  });

  test("Umbrete (Sevilla) no es Madrid", () => {
    const enUmbrete = { ...UN_GOLF_QUE_ENCAJA, province: "Umbrete" };
    assert.equal(porQueNoVale(enUmbrete, losLimites(LO_QUE_PIDIO)), "de otra provincia");
  });
});

describe("lo que se le cuenta", () => {
  test("dice cuantas salen y por que no salen mas", () => {
    const { cumplen, descartes } = loQueDeVerdadCumple([EL_ISUZU, EL_ISUZU, UN_GOLF_QUE_ENCAJA], LO_QUE_PIDIO);
    const frase = loQueSeLeDice(cumplen.length, descartes);

    assert.match(frase, /una oferta que cumpla/);
    assert.match(frase, /kilómetros/);
  });

  test("y si no hay ninguna, lo dice sin disculparse", () => {
    const { cumplen, descartes } = loQueDeVerdadCumple([EL_ISUZU], LO_QUE_PIDIO);
    const frase = loQueSeLeDice(cumplen.length, descartes);

    assert.match(frase, /No hay ninguna oferta/);
    assert.doesNotMatch(frase, /lo siento|disculpa|perdón/i);
  });

  test("sin descartes no hay nada que contar", () => {
    assert.equal(loQueSeLeDice(3, {}), null);
  });
});

describe("una incognita no es un si", () => {
  test("sin kilometros no cumple un tope de kilometros", () => {
    const sinKm = { ...UN_GOLF_QUE_ENCAJA, mileage: null };
    assert.equal(porQueNoVale(sinKm, losLimites(LO_QUE_PIDIO)), "kilometros desconocidos");
  });

  test("pero si no hay tope, sin kilometros vale", () => {
    const sinKm = { ...UN_GOLF_QUE_ENCAJA, mileage: null };
    assert.equal(porQueNoVale(sinKm, losLimites({ maxPrice: 20000 })), null);
  });
});
