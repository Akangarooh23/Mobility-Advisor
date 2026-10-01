"use strict";

/**
 * Los filtros de la búsqueda llevan marcador, no un entero desnudo.
 *
 * ## Lo que pasaba, y es el fallo más gordo de toda la revisión
 *
 * Esta línea:
 *
 *     condiciones.push(sql.replace("$?", `${valores.length}`));
 *
 * `replace("$?", "1")` sustituye el `$?` **entero** —el dólar forma parte de lo
 * buscado— así que `"lower(brand) = $?"` se convertía en
 *
 *     lower(brand) = 1
 *
 * Un entero desnudo donde tenía que ir `$1`. Y como **todos** los filtros se
 * construyen con ese mismo ayudante, cualquiera de ellos devolvía un 500. Comprobado
 * contra producción antes de arreglarlo:
 *
 *     GET /api/search-offers?limit=1                 ->  200
 *     GET /api/search-offers?brand=Audi&limit=1      ->  500
 *     GET /api/search-offers?maxPrice=10000&limit=1  ->  500
 *     GET /api/search-offers?fuel=diesel&limit=1     ->  500
 *     GET /api/search-offers?minYear=2020&limit=1    ->  500
 *
 * Con dos caras según el tipo de columna: `operator does not exist: text = integer`
 * para las de texto, y `bind message supplies 1 parameters, but prepared statement ""
 * requires 0` para las numéricas —el valor sí se empujaba a `valores` y el marcador
 * desaparecía, así que se mandaba un parámetro para una consulta sin ninguno—.
 *
 * **La búsqueda sin filtros funcionaba**, y de ahí que pasara desapercibido: la
 * portada carga, el listado sale, y solo rompe cuando alguien toca un filtro. En una
 * web de coches, tocar un filtro es lo primero que hace cualquiera.
 *
 * ## Cómo se encontró
 *
 * No con un barrido. Arrancando la aplicación y recorriendo el camino de compra
 * —la capa 5—: el tercer `curl` con un parámetro raro devolvió el error de Postgres, y
 * al probar `brand=Audi` para descartar que fuera cosa del parámetro raro, también
 * falló. Dieciocho clases de defecto pasadas por todo el código no lo vieron, porque
 * no es una clase: es una cadena que se come un carácter.
 *
 * ## Qué fija esta prueba
 *
 * Que cada filtro deje un `$n` en el SQL, que la numeración sea seguida, y que el
 * número de marcadores cuadre con el número de valores. Lo último es lo que convierte
 * el fallo en rojo en vez de en silencio.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { construirFiltros } = require("./search-offers-handler");

/** Los marcadores que aparecen en un WHERE, en orden. */
function marcadores(where) {
  return [...where.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
}

describe("cada filtro deja su marcador", () => {
  const CASOS = [
    ["marca", { brand: "Audi" }],
    ["modelo", { brand: "Audi", model: "A3" }],
    ["precio máximo", { maxPrice: "10000" }],
    ["precio mínimo", { minPrice: "30000" }],
    ["año", { minYear: "2020", maxYear: "2024" }],
    ["kilómetros", { minMileage: "0", maxMileage: "100000" }],
    ["potencia", { minPower: "90", maxPower: "200" }],
    ["combustible", { fuel: "diesel" }],
    ["cambio", { transmission: "automatico" }],
    ["carrocería", { bodyType: "suv" }],
    ["color", { color: "negro" }],
    ["tipo de vendedor", { sellerType: "profesional" }],
    ["provincia", { province: "madrid" }],
    ["texto libre", { query: "corsa" }],
    ["todo a la vez", {
      brand: "Audi", model: "A3", minPrice: "5000", maxPrice: "25000",
      minYear: "2018", fuel: "diesel", color: "negro", province: "madrid",
    }],
  ];

  for (const [nombre, q] of CASOS) {
    test(`${nombre}: tantos marcadores como valores, y numerados seguidos`, () => {
      const { where, valores } = construirFiltros(q);

      /*
       * Ésta es la afirmación que habría cazado el fallo. Con el bug, `valores` tenía
       * su valor y el WHERE no tenía marcador: 1 valor y 0 marcadores, que es
       * exactamente lo que Postgres contestaba —«supplies 1 parameters, but prepared
       * statement requires 0»—.
       */
      /*
       * Se cuentan los marcadores **distintos**, no las veces que aparecen.
       *
       * Porque el filtro de texto libre reutiliza el mismo `$1` en cuatro columnas a
       * propósito -título, marca, modelo y versión- con un solo valor. Mi primera
       * versión contaba las apariciones y lo marcaba como fallo: cuatro marcadores
       * para un valor. Reutilizar un parámetro es correcto; lo que no puede pasar es
       * que haya valores sin marcador, que era la avería.
       */
      const nums = [...new Set(marcadores(where))];
      assert.equal(
        nums.length, valores.length,
        `${nums.length} marcadores distintos para ${valores.length} valores.\n  WHERE: ${where}\n  valores: ${JSON.stringify(valores)}`
      );

      // Y numerados 1, 2, 3… sin huecos.
      assert.deepEqual(
        nums.sort((a, b) => a - b),
        valores.map((_, i) => i + 1),
        `la numeración no es seguida.\n  WHERE: ${where}`
      );
    });
  }

  test("y no queda ningún `$?` sin sustituir", () => {
    for (const [, q] of CASOS) {
      const { where } = construirFiltros(q);
      assert.ok(!where.includes("$?"), `queda un $? sin sustituir: ${where}`);
    }
  });

  test("ni una comparación contra un entero desnudo, que era la avería", () => {
    /*
     * La forma exacta del fallo: `lower(brand) = 1`. Se busca una comparación de una
     * columna de texto contra un número literal, que no la hay en ningún filtro
     * legítimo —los valores van siempre por parámetro—.
     */
    for (const [nombre, q] of CASOS) {
      const { where } = construirFiltros(q);
      assert.ok(
        !/lower\([^)]*\)\s*=\s*\d/.test(where),
        `«${nombre}» compara texto contra un entero desnudo: ${where}`
      );
    }
  });
});

describe("y los valores siguen yendo por parámetro", () => {
  test("lo que escribe el cliente no acaba dentro del SQL", () => {
    /*
     * Lo de arriba comprueba que los marcadores están. Esto comprueba lo contrario y
     * es lo que impide que «arreglar» el marcador se convierta en interpolar el valor:
     * una marca con una comilla tiene que seguir viajando en `valores`, no en el
     * texto de la consulta.
     */
    const feo = "Audi' OR 1=1--";
    const { where, valores } = construirFiltros({ brand: feo });

    assert.ok(!where.includes("OR 1=1"), `el valor se ha metido en el SQL: ${where}`);
    assert.ok(!where.includes("--"), `el comentario del valor está en el SQL: ${where}`);

    /*
     * La comilla se busca **fuera de la base del WHERE**, no en todo él.
     *
     * Mi primera versión afirmaba que el WHERE no llevara ninguna comilla, y tropezó
     * con el `country = 'ES'` de la base, que es un literal nuestro y legítimo. Una
     * prueba que se pone roja por el código correcto no mide lo que dice medir.
     */
    const sinLaBase = where.replace(/is_active AND country = 'ES' AND visible IS NOT FALSE/, "");
    assert.ok(!sinLaBase.includes("'"), `hay una comilla del cliente en el SQL: ${sinLaBase}`);
    assert.ok(
      valores.some((v) => String(v).includes("or 1=1")),
      `el valor tendría que estar en los parámetros: ${JSON.stringify(valores)}`
    );
  });

  test("y un filtro vacío no añade nada", () => {
    const { where, valores } = construirFiltros({});
    assert.equal(valores.length, 0);
    assert.equal(marcadores(where).length, 0);
    // Pero la base del WHERE sigue ahí: solo lo activo, de España y visible.
    assert.match(where, /is_active/);
  });
});
