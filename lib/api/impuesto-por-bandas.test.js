/**
 * El impuesto de matriculación, estimado por banda y sobre el valor fiscal.
 *
 * Lo destapó un Kia Sorento 2.4 de gasolina: se le estimaron 1.420 € y salieron
 * 2.491. Mil setenta y un euros que hubo que poner del margen, y no era un caso
 * raro — con un tipo fijo del 4,75 %, la segunda banda más baja de cuatro,
 * **todos** los SUV grandes salen así.
 *
 * Eran dos errores a la vez y se compensaban a medias, que es lo que hacía que
 * el número pareciera razonable: la banda siempre baja, y aplicada sobre el
 * precio español de un usado —que está muy por encima del valor que Hacienda le
 * reconoce—. Arreglar uno solo lo empeora.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  tipoDelImpuesto, bandaPorCo2, bandaEstimada, impuestoEstimado, co2Estimado, VALOR_FISCAL,
  sqlTipoDelImpuesto, CO2_BASE, CO2_POR_CV, CO2_TRACCION_TOTAL, CO2_MOTOR_GRANDE,
  CO2_HIBRIDO, CV_POR_LITRO_PEREZOSO,
} = require("../coste-importacion");

const SORENTO = {
  fuel: "Gasolina", power_cv: 175, displacement: "2400",
  title: "Kia Sorento 2.4 GDI AWD Automatik",
};

test("con el CO2 del anuncio, la banda de verdad", () => {
  assert.equal(bandaPorCo2(95), 0);
  assert.equal(bandaPorCo2(140), 0.0475);
  assert.equal(bandaPorCo2(180), 0.0975);
  assert.equal(bandaPorCo2(224), 0.1475);
});

test("y sin CO2 no se inventa una banda: se estima", () => {
  // Los anuncios alemanes no lo traen casi nunca.
  assert.equal(bandaPorCo2(null), null);
  assert.equal(bandaPorCo2(0), null);
  assert.equal(bandaPorCo2("lo que sea"), null);
});

test("el CO2 manda sobre la estimación", () => {
  // Si el anuncio lo dice, no hay nada que adivinar.
  assert.equal(tipoDelImpuesto({ ...SORENTO, co2: 130 }), 0.0475);
  assert.equal(tipoDelImpuesto(SORENTO), 0.1475, "sin CO2, estimado por el coche");
});

test("un eléctrico no paga, porque no emite", () => {
  assert.equal(bandaEstimada({ fuel: "Eléctrico", power_cv: 283 }), 0);
  assert.equal(bandaEstimada({ fuel: "Híbrido enchufable", power_cv: 204 }), 0);
});

test("y un híbrido baja un escalón, que para eso está", () => {
  assert.equal(bandaEstimada({ fuel: "Híbrido", power_cv: 122, title: "Toyota C-HR" }), 0.0475);
});

test("mover cuatro ruedas emite más, con el mismo motor", () => {
  const mismos = { fuel: "Diesel", power_cv: 200, displacement: "1968" };
  assert.equal(bandaEstimada({ ...mismos, title: "Audi A6 Avant 40 TDI" }), 0.0475);
  assert.equal(bandaEstimada({ ...mismos, title: "Audi A6 Avant 40 TDI quattro" }), 0.0975);
});

test("y un motor grande y perezoso también, aunque dé los mismos caballos", () => {
  // 175 CV en 2,4 litros atmosféricos queman bastante más que 175 CV en un
  // 1.5 turbo moderno. Con la potencia sola los dos salían iguales, y por ahí
  // se coló el Sorento.
  const turbo = { fuel: "Gasolina", power_cv: 175, displacement: "1498", title: "VW Golf" };
  const perezoso = { ...turbo, displacement: "2400" };
  assert.ok(co2Estimado(perezoso) > co2Estimado(turbo) * 1.15,
    "la cilindrada no está cambiando nada");
  assert.equal(bandaEstimada(turbo), 0.0975);
  assert.equal(bandaEstimada(perezoso), 0.1475);
});

test("en diésel la cilindrada no separa nada, y no se aplica", () => {
  // Están todos entre 70 y 80 CV por litro: el suelo del gasóleo ya lo recoge,
  // y aplicarlo encima sería cobrarles dos veces lo mismo.
  const dosLitros = { fuel: "Diesel", power_cv: 150, displacement: "1968", title: "VW Passat" };
  const tresLitros = { ...dosLitros, displacement: "2993" };
  assert.equal(co2Estimado(dosLitros), co2Estimado(tresLitros));
});

test("y no se pasa del último escalón", () => {
  assert.equal(bandaEstimada({ fuel: "Diesel", power_cv: 400, title: "BMW X5 xDrive" }), 0.1475);
});

test("estimando no se llega nunca a la banda exenta", () => {
  // El 0 % está en 120 g/km y ahí abajo se amontonan los utilitarios: acertar
  // el cero exige el CO₂ de verdad. Pasarse es recuperable; quedarse corto es
  // publicar un precio que luego no se puede cumplir.
  const polo = { fuel: "Diesel", power_cv: 90, displacement: "1598", title: "VW Polo 1.6 TDI" };
  assert.ok(co2Estimado(polo) < 120, "no estaría probando nada");
  assert.equal(bandaEstimada(polo), 0.0475);
  // Pero si el anuncio trae el CO₂, entonces no se está estimando y el cero sí.
  assert.equal(tipoDelImpuesto({ ...polo, co2: 99 }), 0);
});

test("sin saber nada del coche, el tipo de siempre", () => {
  // Es lo que había. Cambiarlo por un cero diría que ese coche no paga
  // impuesto, y ninguno de gasolina o diésel deja de pagarlo.
  assert.equal(tipoDelImpuesto(null), 0.0475);
  assert.equal(tipoDelImpuesto({}), 0.0475);
});

test("la banda se aplica sobre el valor fiscal, no sobre el precio español", () => {
  // Hacienda no calcula sobre lo que cuesta el coche en un concesionario: usa
  // las tablas del BOE por el coeficiente de antigüedad, que en los coches que
  // traemos sale en torno al 60 % de eso.
  assert.equal(VALOR_FISCAL, 0.6);
  assert.equal(Math.round(impuestoEstimado(29899, SORENTO)), 2646);
});

test("y con las dos correcciones el Sorento se cubre", () => {
  // Costó 2.491 y se estiman 2.646: pasarse ciento cincuenta es recuperable,
  // quedarse mil por debajo se come el margen del coche.
  const estimado = impuestoEstimado(29899, SORENTO);
  assert.ok(estimado > 2491, "se quedaría corto otra vez");
  assert.ok(estimado < 2491 * 1.2, "se pasa tanto que el anuncio no lo abre nadie");
});

test("un utilitario no paga como un SUV", () => {
  // Era el otro lado del mismo fallo: con un tipo único, o el SUV va corto o el
  // utilitario va caro.
  const golf = impuestoEstimado(18000, {
    fuel: "Gasolina", power_cv: 110, displacement: "999", title: "VW Golf 1.0 TSI",
  });
  const x5 = impuestoEstimado(45000, {
    fuel: "Diesel", power_cv: 265, displacement: "2993", title: "BMW X5 xDrive30d",
  });
  assert.equal(Math.round(golf), 513, "el utilitario ya no paga como un SUV");
  assert.ok(x5 > golf * 5, `el SUV grande sale a ${Math.round(x5)} y el utilitario a ${Math.round(golf)}`);
});

test("sin precio de referencia no sale un impuesto negativo ni NaN", () => {
  assert.equal(impuestoEstimado(null, SORENTO), 0);
  assert.equal(impuestoEstimado("lo que sea", SORENTO), 0);
});

/**
 * Y la versión de SQL tiene que decir lo mismo.
 *
 * El listado ordena y corta por el precio calculado en SQL; la ficha lo calcula
 * en JavaScript. Si los dos no dan el mismo tipo, un coche sale en la lista a un
 * precio y al abrirlo enseña otro, y quien lo ve deja de fiarse de los dos.
 *
 * Esto se comprueba sin base de datos: se lee el SQL y se mira que lleve dentro
 * los mismos números. La igualdad de verdad, fila a fila, está comprobada contra
 * la base con `scripts/` y sale igual en las 25.498 ofertas alemanas.
 */
test("el SQL lleva los mismos números que el JavaScript", () => {
  const sql = sqlTipoDelImpuesto();
  for (const n of [CO2_BASE.gasolina, CO2_BASE.diesel, CO2_POR_CV.gasolina,
    CO2_POR_CV.diesel, CO2_TRACCION_TOTAL, CO2_MOTOR_GRANDE, CO2_HIBRIDO,
    CV_POR_LITRO_PEREZOSO]) {
    assert.ok(sql.includes(String(n)), `al SQL le falta el ${n}`);
  }
  // Y las cuatro bandas, con el suelo del 4,75 % puesto: estimando no baja de ahí.
  assert.ok(sql.includes("<= 159 THEN 0.0475"), sql);
  assert.ok(sql.includes("<= 199 THEN 0.0975 ELSE 0.1475"), sql);
});

test("el SQL sobrevive a un CO2 o una cilindrada que no son números", () => {
  // Los raspa un scraper: llegan «124 g/km», «-» o vacíos. Un cast directo
  // revienta la consulta entera del listado, no solo esa fila.
  // La regla, no el número de veces: las dos columnas de texto solo aparecen
  // dentro de un `regexp_replace` que les quita todo lo que no sea un dígito.
  // Contar apariciones se rompería en cuanto alguien añada una rama más.
  const limpio = /regexp_replace\(COALESCE\([a-z.]*(co2|displacement),''\), '\[\^0-9\]', '', 'g'\)/g;
  const resto = sqlTipoDelImpuesto().replace(limpio, "YA_ES_UN_NUMERO");
  assert.ok(!/\bco2\b/.test(resto), "queda un CO₂ que se castea a pelo");
  assert.ok(!/\bdisplacement\b/.test(resto), "queda una cilindrada que se castea a pelo");
});

test("y con alias, para cuando la consulta lo lleva", () => {
  const sql = sqlTipoDelImpuesto("de");
  assert.ok(sql.includes("de.power_cv"), sql);
  assert.ok(sql.includes("de.displacement"), sql);
  assert.ok(!/[^.]\bpower_cv/.test(sql.replace(/de\.power_cv/g, "")), "queda una columna sin alias");
});
