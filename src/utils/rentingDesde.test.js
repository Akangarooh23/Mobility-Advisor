/**
 * El «desde X €/mes» del listado tiene que ser un precio contratable.
 *
 * Un renting no tiene un precio: tiene una rejilla de plazos por tramos de
 * kilómetros al año. El listado anunciaba el mínimo de las cinco columnas
 * sueltas, que son solo la fila de 15.000 km, así que enseñaba el suelo de un
 * tramo y no el suelo. Estas pruebas fijan que el número anunciado existe en la
 * rejilla y que va acompañado de las condiciones que lo hacen posible.
 */
import {
  getRentingDesde,
  getMinRentingPrice,
  describeRentingDesde,
} from "./portalVoHelpers";

/** Una oferta como las que hay hoy en la base: 5 tramos, plazos 24 y 36. */
const ofertaReal = (extra = {}) => ({
  rentingAvailable: true,
  rentingKmYear: 15000,
  renting24m: 259,
  renting36m: 253,
  rentingPricesJson: {
    km_options: [10000, 15000, 20000, 25000, 30000],
    "24m": [243, 259, 273, 287, 300],
    "36m": [237, 253, 267, 280, 294],
  },
  ...extra,
});

describe("el suelo del renting", () => {
  test("sale de la rejilla, no de las columnas", () => {
    // 253 es lo que se anunciaba: el mínimo de las columnas, es decir el suelo
    // a 15.000 km. El suelo de verdad es 237.
    expect(getRentingDesde(ofertaReal())).toEqual({ precio: 237, plazo: "36m", km: 10000 });
  });

  test("el precio anunciado existe en la rejilla", () => {
    const oferta = ofertaReal();
    const { precio, plazo, km } = getRentingDesde(oferta);
    const i = oferta.rentingPricesJson.km_options.indexOf(km);
    expect(oferta.rentingPricesJson[plazo][i]).toBe(precio);
  });

  test("sin rejilla, se usan las columnas y se dicen sus kilómetros", () => {
    const oferta = ofertaReal({ rentingPricesJson: null });
    expect(getRentingDesde(oferta)).toEqual({ precio: 253, plazo: "36m", km: 15000 });
  });

  test("una rejilla vacía no deja la oferta sin precio", () => {
    const oferta = ofertaReal({ rentingPricesJson: { km_options: [10000, 15000] } });
    expect(getRentingDesde(oferta).precio).toBe(253);
  });

  test("los huecos de la rejilla no cuentan", () => {
    const oferta = ofertaReal({
      rentingPricesJson: {
        km_options: [10000, 15000, 20000],
        "36m": [null, 253, 0],
      },
    });
    expect(getRentingDesde(oferta)).toEqual({ precio: 253, plazo: "36m", km: 15000 });
  });

  test("el plazo de 12 meses cuenta como cualquier otro", () => {
    const oferta = ofertaReal({
      rentingPricesJson: {
        km_options: [10000, 15000],
        "12m": [199, 210],
        "36m": [237, 253],
      },
    });
    expect(getRentingDesde(oferta)).toEqual({ precio: 199, plazo: "12m", km: 10000 });
  });

  test("una oferta sin ningún precio no anuncia nada", () => {
    expect(getRentingDesde({ rentingAvailable: true })).toBeNull();
    expect(getRentingDesde(null)).toBeNull();
  });

  test("ordenar sigue funcionando con solo la cifra", () => {
    expect(getMinRentingPrice(ofertaReal())).toBe(237);
    expect(getMinRentingPrice({})).toBeNull();
  });
});

describe("las condiciones se escriben al lado", () => {
  test("plazo y kilómetros, en formato de aquí", () => {
    expect(describeRentingDesde({ precio: 237, plazo: "36m", km: 10000 }))
      .toBe("36 meses · 10.000 km/año");
  });

  test("sin datos no se inventa una condición", () => {
    expect(describeRentingDesde(null)).toBe("");
  });
});
