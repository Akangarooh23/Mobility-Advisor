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

/**
 * Un Audi TT Coupé a quien pidió un compacto.
 *
 * Salió en producción, de tercera opción, en la misma búsqueda que ya
 * respetaba precio, kilómetros y combustible. Ensanchar puede soltar el modelo
 * y la marca —para eso está— pero la carrocería la eligió el cliente de una
 * lista que tiene «me da igual» de primera opción. Si la eligió, no es
 * negociable.
 */
describe("la carroceria que eligio", () => {
  const PIDE_COMPACTO = { bodyType: "compacto" };

  test("el coupe se cae", () => {
    assert.equal(porQueNoVale({ bodyType: "Coupé" }, losLimites(PIDE_COMPACTO)), "es otro tipo de coche");
  });

  test("y el compacto pasa, se llame como se llame en el anuncio", () => {
    /*
     * Hay 48 valores distintos en la columna y un «compacto» es tambien un
     * «hatchback» y una «berlina compacta».
     */
    for (const como of ["Compacto", "Hatchback", "Berlina compacta", "utilitario"]) {
      assert.equal(porQueNoVale({ bodyType: como }, losLimites(PIDE_COMPACTO)), null, como);
    }
  });

  test("sin saber que coche es, SI pasa, al reves que con los kilometros", () => {
    /*
     * Con los kilometros una incognita es un riesgo para quien compra. Aqui el
     * hueco es nuestro -el anuncio no lo dice- y el WHERE ya ha filtrado por
     * carroceria, asi que descartarlo esconde coches buenos por un fallo de
     * datos nuestro. Se descarta solo lo que SE SABE que es de otro tipo.
     */
    assert.equal(porQueNoVale({ bodyType: "" }, losLimites(PIDE_COMPACTO)), null);
    assert.equal(porQueNoVale({ mileage: null }, losLimites({ maxMileage: 100000 })), "kilometros desconocidos");
  });

  test("pero si el nombre lo delata, se cae igual", () => {
    /*
     * El Audi TT Coupe que salio en produccion NO TIENE CARROCERIA en la base:
     * lo unico que dice que es un coupe es como se llama.
     */
    const elTT = { bodyType: "", brand: "Audi", model: "TT Coupé", version: "2.0 TFSI" };
    assert.equal(porQueNoVale(elTT, losLimites(PIDE_COMPACTO)), "es otro tipo de coche");
  });

  test("y la lista de palabras es corta para no llevarse coches buenos", () => {
    /*
     * «sw», «mini» o «van» aparecen dentro de nombres de coches que no son
     * familiares, urbanos ni furgonetas. Si se usara la tabla entera de formas,
     * estos tres se caerian sin motivo.
     */
    for (const coche of [
      { bodyType: "", brand: "Volkswagen", model: "Passat", version: "SW" },
      { bodyType: "", brand: "Mini", model: "Cooper" },
      { bodyType: "", brand: "Seat", model: "Ibiza", version: "1.0 Reference" },
    ]) {
      assert.equal(porQueNoVale(coche, losLimites(PIDE_COMPACTO)), null, coche.model);
    }
  });

  test("y a quien pidio un coupe, el TT le vale", () => {
    const elTT = { bodyType: "", brand: "Audi", model: "TT Coupé" };
    assert.equal(porQueNoVale(elTT, losLimites({ bodyType: "coupe" })), null);
  });

  test("y a quien dijo «me da igual» no se le descarta nada", () => {
    assert.equal(porQueNoVale({ bodyType: "Coupé" }, losLimites({})), null);
  });

  test("el circuito se lo pasa al colador", () => {
    const fs = require("node:fs");
    const fuente = fs.readFileSync(require.resolve("../../api/find-listing.js"), "utf8");
    /*
     * Hasta el cierre del objeto, no un numero de caracteres.
     *
     * Estaba cortado a 1.800 y al crecer el bloque -un criterio nuevo con su
     * comentario- `bodyType` se salio de la ventana y la prueba fallo sin que
     * el codigo tuviera nada malo.
     */
    const desde = fuente.indexOf("const loQueNoSeNegocia = {");
    const bloque = fuente.slice(desde, fuente.indexOf("\n  };", desde));

    assert.match(bloque, /bodyType: normalizeText\(/);
    // Y «me da igual» no puede convertirse en un filtro por «indiferente».
    assert.match(bloque, /indiferente_carroceria/);
  });
});
