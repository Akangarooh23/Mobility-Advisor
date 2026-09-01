/**
 * Preparar una oferta alemana para cruzarla contra Eurotax.
 *
 * Los textos de estas pruebas son reales: salen de las ofertas publicadas. Es a
 * propósito. Un titular alemán inventado sale siempre más limpio de lo que son,
 * y lo que hay que aguantar es lo que escribe el anunciante de verdad.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  cilindradaDelTitular,
  motorDelTitular,
  carroceriaDelTitular,
  modeloNormalizado,
  combustibleNormalizado,
  claveDeCruce,
  preparaParaEurotax,
} = require("./cruce-eurotax.js");

describe("la cilindrada, sacada del titular", () => {
  test("la encuentra donde está, con punto o con coma", () => {
    assert.equal(cilindradaDelTitular("SC 1.2 TSI FR"), 1.2);
    assert.equal(cilindradaDelTitular("V Lim. Trendline 1,4 SERVICE NEU"), 1.4);
    assert.equal(cilindradaDelTitular("2.2 CRDi Edition 7 2WD/1.HAND/AHK"), 2.2);
  });

  test("aunque venga pegada a asteriscos o a letras", () => {
    assert.equal(cilindradaDelTitular("1.4**CABRIO **LEDER **TÜV & AU NEU **"), 1.4);
    assert.equal(cilindradaDelTitular("2.2CRDI Platinum Edition 4WD"), 2.2);
  });

  test("y dice que no la hay cuando no la hay", () => {
    // «null» no es cero: es que el anuncio no la dice.
    assert.equal(cilindradaDelTitular("Style/1Hand/7Sitzer/Kamera/Navi/B-Xenon"), null);
    assert.equal(cilindradaDelTitular("Standard Model"), null);
    assert.equal(cilindradaDelTitular(""), null);
  });

  test("no confunde una fecha con un motor", () => {
    // «11.2015» es la matriculación. Un 11,2 no existe en un turismo.
    assert.equal(cilindradaDelTitular("Erstzulassung 11.2015"), null);
  });

  test("ni «1.Hand», que es el primer dueño", () => {
    assert.equal(cilindradaDelTitular("Style/1.Hand/Navi"), null);
  });

  test("ni un 4WD ni un 360°", () => {
    assert.equal(cilindradaDelTitular("Platinum 4WD Aut. Kamera 360°"), null);
  });
});

describe("el código del motor", () => {
  test("los del grupo VAG y los de Kia", () => {
    assert.equal(motorDelTitular("1.6 FSI Trendline"), "FSI");
    assert.equal(motorDelTitular("SC 1.2 TSI FR"), "TSI");
    assert.equal(motorDelTitular("Reference 1.0 TGI LED/KLIMA"), "TGI");
    assert.equal(motorDelTitular("2.2 CRDi Edition 7"), "CRDI");
  });

  test("aunque venga pegado a lo que sigue", () => {
    // «TDICR» es como lo escribe el anuncio, todo junto.
    assert.equal(motorDelTitular("ST 1.6 TDICR 110PS STYLE"), "TDI");
    assert.equal(motorDelTitular("2.0TDI DSG"), "TDI");
  });

  test("y no se come uno con otro", () => {
    // «tfsi» contiene «fsi»: si ganara el corto, un gasolina turbo pasaría por
    // atmosférico, y no emiten lo mismo.
    assert.equal(motorDelTitular("1.4 TFSI"), "TFSI");
    assert.equal(motorDelTitular("GTD Line"), "GTD");
  });

  test("sin motor reconocible, null", () => {
    assert.equal(motorDelTitular("Style/1Hand/7Sitzer"), null);
  });
});

describe("la carrocería", () => {
  test("la que dice el titular, traducida", () => {
    assert.equal(carroceriaDelTitular("ST 1.6 TDICR STYLE"), "familiar");
    assert.equal(carroceriaDelTitular("Sportswagon GT"), "familiar");
    assert.equal(carroceriaDelTitular("SC 1.2 TSI FR"), "3 puertas");
    assert.equal(carroceriaDelTitular("Golf V 5-Türer 1.6 FSI"), "5 puertas");
    assert.equal(carroceriaDelTitular("1.4**CABRIO **LEDER"), "descapotable");
  });

  test("«Standard Model» no es un familiar", () => {
    // El «st» de «Standard» no puede colarse: es la trampa evidente.
    assert.equal(carroceriaDelTitular("Standard Model"), null);
  });
});

describe("el modelo, escrito de una sola manera", () => {
  test("las dos ortografías pegadas por una barra se quedan en una", () => {
    assert.equal(modeloNormalizado("Ceed / cee'd"), "Ceed");
    assert.equal(modeloNormalizado("ProCeed / pro_cee'd"), "ProCeed");
  });

  test("pero no se juntan coches que son distintos", () => {
    // Un Altea y un Altea XL no emiten lo mismo, ni valen lo mismo. Juntarlos
    // sería perder justo lo que vamos a preguntar.
    assert.equal(modeloNormalizado("Altea XL"), "Altea XL");
    assert.equal(modeloNormalizado("Golf Plus"), "Golf Plus");
    assert.equal(modeloNormalizado("Passat CC"), "Passat CC");
    assert.equal(modeloNormalizado("e-Niro"), "e-Niro");
  });
});

describe("el combustible", () => {
  test("llega en varios idiomas y sale en uno", () => {
    assert.equal(combustibleNormalizado("Diesel"), "diesel");
    assert.equal(combustibleNormalizado("Gasolina"), "gasolina");
    assert.equal(combustibleNormalizado("Benzin"), "gasolina");
    assert.equal(combustibleNormalizado("Gas"), "gas");
    assert.equal(combustibleNormalizado("Eléctrico"), "electrico");
    assert.equal(combustibleNormalizado("Híbrido"), "hibrido");
  });
});

describe("la clave con la que se pregunta", () => {
  const OFERTA = {
    brand: "SEAT", model: "León", year: 2015, fuel: "Diesel",
    power_kw: 81, power_cv: 110, version: "ST 1.6 TDICR 110PS STYLE",
  };

  test("son cinco campos, y va en kW", () => {
    // Eurotax indexa por kW. El CV de los anuncios es una conversión redondeada,
    // y redondear dos veces separa coches que son el mismo.
    assert.equal(claveDeCruce(OFERTA), "seat|leon|2015|diesel|81");
  });

  test("dos anuncios del mismo coche dan la misma clave", () => {
    const otro = { ...OFERTA, version: "1.6 TDI Style Navi", power_cv: 109 };
    assert.equal(claveDeCruce(otro), claveDeCruce(OFERTA));
  });

  test("si falta un campo, no hay clave", () => {
    // Media clave cruza con lo que no es, y eso es peor que no cruzar.
    for (const falta of ["brand", "model", "year", "fuel", "power_kw"]) {
      assert.equal(claveDeCruce({ ...OFERTA, [falta]: null }), null, `sin ${falta} no debería haber clave`);
    }
  });
});

describe("lo que sabemos decir antes de preguntar", () => {
  test("con desempate, la confianza es alta", () => {
    const r = preparaParaEurotax({
      brand: "SEAT", model: "Ibiza", year: 2015, fuel: "Gasolina",
      power_kw: 77, version: "SC 1.2 TSI FR",
    });
    assert.equal(r.confianza, "alta");
    assert.equal(r.cilindrada, 1.2);
    assert.equal(r.motor, "TSI");
    assert.equal(r.carroceria, "3 puertas");
  });

  test("sin nada que desempate, media", () => {
    const r = preparaParaEurotax({
      brand: "SEAT", model: "Alhambra", year: 2013, fuel: "Diesel",
      power_kw: 103, version: "Style/1Hand/7Sitzer/Kamera/Navi/B-Xenon",
    });
    assert.equal(r.confianza, "media");
    assert.equal(r.cilindrada, null);
  });

  test("y sin clave, baja: ese no se puede cruzar", () => {
    const r = preparaParaEurotax({ brand: "Kia", model: "", year: 2018, fuel: "Diesel", power_kw: 100 });
    assert.equal(r.confianza, "baja");
    assert.equal(r.clave, null);
  });
});

/**
 * El consumo disfrazado de cilindrada.
 *
 * «Polo IV Trendline 4.5l Euro 4 Tüv neu» no lleva un motor de 4,5 litros:
 * lleva uno que gasta 4,5 cada cien. Por valor no se distinguen —un consumo y
 * una cilindrada viven en el mismo rango—, así que se mira la potencia por
 * litro, que es lo que sí separa un motor real de un número que no lo es.
 */
describe("la cilindrada que no puede ser", () => {
  const { cilindradaCreible, preparaParaEurotax } = require("./cruce-eurotax.js");

  test("un Polo no tiene 4,5 litros", () => {
    assert.equal(cilindradaCreible(4.5, 47), false, "10 kW por litro no es un motor de coche");
  });

  test("pero un Touareg V8 sí tiene 4,2", () => {
    assert.equal(cilindradaCreible(4.2, 228), true);
  });

  test("y los extremos corrientes pasan", () => {
    assert.equal(cilindradaCreible(1.9, 47), true, "un diésel atmosférico viejo");
    assert.equal(cilindradaCreible(1.0, 85), true, "un tres cilindros turbo moderno");
    assert.equal(cilindradaCreible(2.0, 221), true, "un Cupra");
  });

  test("sin potencia no se descarta: no poder comprobar no es motivo", () => {
    assert.equal(cilindradaCreible(1.6, null), true);
  });

  test("y el filtro se aplica de verdad al preparar la oferta", () => {
    // Sin esto la comprobación existiría y no serviría de nada.
    const r = preparaParaEurotax({
      brand: "Volkswagen", model: "Polo", year: 2006, fuel: "Gasolina",
      power_kw: 47, version: "IV Trendline 4.5l Euro 4 Tüv neu Sh.gepfl.",
    });
    assert.equal(r.cilindrada, null, "se habría publicado un Polo de 4.500 cc");
  });
});
