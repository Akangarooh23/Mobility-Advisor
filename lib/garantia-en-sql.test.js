/**
 * La misma regla, escrita dos veces.
 *
 * `seLePuedeOfrecer` decide en JavaScript qué garantía se le puede dar a un
 * coche. Ordenar la lista por precio y cortar la horquilla necesitan esa misma
 * decisión **dentro de la consulta**, porque el precio publicado lleva la
 * garantía dentro y no cuesta lo mismo en todos los coches: a uno de quince años
 * no se le puede dar ninguna y su precio no sube nada.
 *
 * Tenerla en dos sitios es feo. La alternativa era traerse las 25.000 filas y
 * ordenarlas en memoria, que es peor. Lo que queda es esto: pasar los mismos
 * coches por las dos y exigir que digan lo mismo.
 *
 * El SQL se evalúa con un traductor de tres líneas que solo entiende la forma
 * exacta que genera `sqlGarantiaPorDefecto`. Si un día genera otra cosa, el
 * traductor revienta y este fichero se entera.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { opcionesParaElCoche, sqlGarantiaPorDefecto } = require("./garantias.js");

const CATALOGO = [
  { id: "g12", nombre: "Garantía mecánica · 12 meses", nivel: 1, precio: 190, antiguedad_max_anios: 12, km_max_vehiculo: 180000, activo: true },
  { id: "g24", nombre: "Garantía mecánica · 24 meses", nivel: 2, precio: 290, antiguedad_max_anios: 10, km_max_vehiculo: 150000, activo: true },
  { id: "g36", nombre: "Garantía mecánica · 36 meses", nivel: 3, precio: 690, antiguedad_max_anios: 6,  km_max_vehiculo: 100000, activo: true },
];

/**
 * Ejecuta el CASE de Postgres en JavaScript.
 *
 * Solo sabe de la gramática que genera la función: `CASE WHEN … THEN n … ELSE 0
 * END`, con `IS NULL`, `AND`, `OR` y `TRUE`. Nada más, a propósito: un traductor
 * que entienda de todo puede tragarse un SQL que Postgres rechazaría.
 */
function comoLoHariaPostgres(sql, coche) {
  if (sql === "0") return 0;
  const cuerpo = sql.replace(/^\(CASE | END\)$/g, "").trim();
  const js = cuerpo
    .replace(/\b(year|mileage) IS NULL\b/g, "($1 === null)")
    .replace(/\bAND\b/g, "&&")
    .replace(/\bOR\b/g, "||")
    .replace(/\bTRUE\b/g, "true")
    .replace(/^WHEN /, "")
    .split(/\bWHEN\b/)
    .map((r) => r.trim())
    .join("|||");
  // «c THEN v ||| c THEN v ||| c THEN v ELSE 0» → ternarios anidados.
  const ramas = js.split("|||");
  const ultimo = ramas.pop().split(/\bELSE\b/);
  const pares = [...ramas.map((r) => r.split(/\bTHEN\b/)), ultimo[0].split(/\bTHEN\b/)];
  const expr = pares.reduceRight(
    (resto, [cond, val]) => `(${cond}) ? (${val}) : (${resto})`,
    ultimo[1].trim()
  );
  const year = coche.year == null ? null : Number(coche.year);
  const mileage = coche.mileage == null ? null : Number(coche.mileage);
  // eslint-disable-next-line no-new-func
  return Number(new Function("year", "mileage", `return ${expr};`)(year, mileage));
}

const HOY = new Date().getFullYear();
const COCHES = [
  { que: "recién matriculado", year: HOY, mileage: 5000 },
  { que: "de cinco años y pocos km", year: HOY - 5, mileage: 60000 },
  { que: "de cinco años pero con 120.000 km", year: HOY - 5, mileage: 120000 },
  { que: "de siete años", year: HOY - 7, mileage: 90000 },
  { que: "de once años", year: HOY - 11, mileage: 140000 },
  { que: "de doce justos", year: HOY - 12, mileage: 170000 },
  { que: "de trece: ya no le toca ninguna", year: HOY - 13, mileage: 100000 },
  { que: "con 200.000 km: tampoco", year: HOY - 3, mileage: 200000 },
  { que: "en el tope de km justo", year: HOY - 3, mileage: 180000 },
  { que: "sin año", year: null, mileage: 50000 },
  { que: "sin kilómetros", year: HOY - 8, mileage: null },
  { que: "sin nada de nada", year: null, mileage: null },
];

describe("la garantía de por defecto, en SQL y en JavaScript", () => {
  const sql = sqlGarantiaPorDefecto(CATALOGO);

  for (const coche of COCHES) {
    test(`un coche ${coche.que} paga lo mismo por las dos`, () => {
      const enJs = opcionesParaElCoche(CATALOGO, coche).porDefecto?.precio ?? 0;
      assert.equal(comoLoHariaPostgres(sql, coche), enJs, sql);
    });
  }

  test("y la más barata que se le pueda dar es la que sale", () => {
    // Lo que se comprueba arriba es que las dos coinciden. Que además sea la
    // barata y no otra hay que decirlo aparte: dos funciones pueden coincidir
    // las dos en lo mismo mal.
    assert.equal(opcionesParaElCoche(CATALOGO, { year: HOY - 5, mileage: 60000 }).porDefecto.precio, 190);
    assert.equal(comoLoHariaPostgres(sql, { year: HOY - 5, mileage: 60000 }), 190);
  });

  test("con el catálogo vacío no suma nada", () => {
    // Mientras no haya productos cargados no se ofrece ninguna, así que el
    // precio publicado no lleva garantía y no puede subir por ella.
    assert.equal(sqlGarantiaPorDefecto([]), "0");
    assert.equal(sqlGarantiaPorDefecto(null), "0");
  });

  test("una desactivada no entra en la cuenta", () => {
    const conBaja = [{ ...CATALOGO[0], activo: false }, CATALOGO[1]];
    assert.equal(comoLoHariaPostgres(sqlGarantiaPorDefecto(conBaja), { year: HOY - 2, mileage: 20000 }), 290);
  });

  test("en una sola línea: se pega dentro de un ORDER BY", () => {
    assert.ok(!sql.includes("\n"), sql);
  });

  test("y con el alias delante cuando la consulta lo lleva", () => {
    const conAlias = sqlGarantiaPorDefecto(CATALOGO, "o");
    assert.ok(conAlias.includes("o.year"), conAlias);
    assert.ok(conAlias.includes("o.mileage"), conAlias);
  });
});
