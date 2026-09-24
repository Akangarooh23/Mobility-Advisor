/**
 * «Qué le falta al análisis» está escrita dos veces, y tienen que coincidir.
 *
 * ## Lo que pasó
 *
 * La comprobación existe en `api/analyze.js` —que decide si se queda con lo
 * que devolvió el modelo o cae al respaldo determinista— y en
 * `src/utils/advisorResults.js`, que decide si la pantalla enseña el resultado
 * o un error.
 *
 * Al bajar de cinco modelos recomendados a dos se cambió **solo la del
 * servidor**. Resultado: el servidor mandaba un análisis correcto con dos
 * modelos y la pantalla lo rechazaba con «La IA ha devuelto un analisis
 * incompleto». Veinte preguntas contestadas y dos minutos de espera para un
 * recuadro rojo.
 *
 * ## Por qué no se unifican en un fichero
 *
 * Porque `src/` no puede importar de `api/` ni de `lib/` en este proyecto. La
 * copia está permitida; separarse sin que nadie se entere, no.
 *
 * ## Por qué esta prueba las ejecuta en vez de leerlas
 *
 * La primera versión comparaba el **texto** de las dos con una expresión
 * regular, y duró exactamente un cambio: en cuanto una se reescribió con otra
 * forma, la prueba falló sin que el comportamiento hubiera cambiado. Ahora se
 * les dan los mismos casos y se compara lo que contestan.
 *
 * ## Y por qué vive aquí y no en las pruebas de pantalla
 *
 * Porque cargar `api/analyze.js` desde Jest arrastra `pg`, que no funciona en
 * ese entorno. Aquí sí, y la copia de `src/` se lee como texto —es un módulo
 * ESM— igual que hace el arnés que contesta el test entero.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { queLeFaltaAlAnalisis: laDelServidor } = require("../../api/analyze");

/**
 * Carga una función de un módulo de `src/`, que es ESM.
 *
 * Se le quitan los `export` y los `import`, y las dependencias se le pasan
 * como argumentos. Sirve para comparar, no para ejecutar la aplicación.
 */
function laDeLaPantalla() {
  const raiz = path.join(__dirname, "..", "..");
  const fuente = fs
    .readFileSync(path.join(raiz, "src", "utils", "advisorResults.js"), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "");

  const ayudas = fs
    .readFileSync(path.join(raiz, "src", "utils", "offerHelpers.js"), "utf8")
    .replace(/\r\n/g, "\n");

  /*
   * De las ayudas solo hacen falta dos funciones, y el fichero entero trae
   * dependencias de marca y de rutas que no vienen a cuento.
   */
  const unaFuncion = (nombre) => {
    const desde = ayudas.indexOf("export function " + nombre);
    if (desde < 0) throw new Error("no encuentro " + nombre + " en offerHelpers");
    const siguiente = ayudas.indexOf("\nexport ", desde + 10);
    return ayudas.slice(desde, siguiente > 0 ? siguiente : undefined).replace(/^export /, "");
  };

  return new Function(
    unaFuncion("normalizeText")
    + "\n" + unaFuncion("normalizeStringArray")
    + "\n" + fuente
    + "\n return queLeFaltaAlAnalisis;"
  )();
}

const deLaPantalla = laDeLaPantalla();

/** Un análisis que pasa todas las comprobaciones. */
const UNO_COMPLETO = {
  alineacion_pct: 81,
  solucion_principal: {
    tipo: "compra_contado",
    score: 81,
    titulo: "Compra al contado de un compacto",
    resumen: "Encaja con tu uso diario y tu horizonte largo.",
    ventajas: ["sin intereses", "propiedad desde el primer dia", "mas barato a largo plazo"],
    inconvenientes: ["inmoviliza ahorro", "la depreciacion es tuya"],
    coste_estimado: "280 - 350 EUR/mes",
    empresas_recomendadas: ["Una", "Otra", "Otra mas"],
    etiqueta_dgt: "B o C",
  },
  score_desglose: {
    encaje_uso: 25, coste_total: 18, flexibilidad: 16, viabilidad_real: 14, ajuste_preferencias: 8,
  },
  por_que_gana: ["motivo uno", "motivo dos", "motivo tres", "motivo cuatro"],
  alternativas: [{ tipo: "compra_financiada", score: 70, titulo: "Financiarlo", razon: "si prefieres no tocar el ahorro" }],
  tco_aviso: "El coste real incluye seguro y mantenimiento.",
  tco_detalle: {
    total_mensual: 320, total_anual: 3840, base_mensual: 200,
    seguro: 50, energia: 40, mantenimiento: 20, extras: 10,
  },
  consejo_experto: "Compara tres unidades antes de cerrar nada.",
  siguiente_paso: "Pide cita para verlos.",
  propulsiones_viables: ["gasolina eficiente", "hibrido"],
  vehiculos_recomendados: [
    { rank: 1, marca: "Renault", modelo: "Clio", titulo: "Renault Clio", razon: "hay stock" },
    { rank: 2, marca: "Volkswagen", modelo: "Polo", titulo: "Volkswagen Polo", razon: "hay stock" },
  ],
};

const sin = (campo, valor) => {
  const copia = JSON.parse(JSON.stringify(UNO_COMPLETO));
  if (campo in copia.solucion_principal) copia.solucion_principal[campo] = valor;
  else copia[campo] = valor;
  return copia;
};

/** Casos que hay que juzgar igual en los dos lados. */
const LOS_CASOS = {
  completo: UNO_COMPLETO,
  vacio: {},
  "sin titulo": sin("titulo", ""),
  "una sola ventaja": sin("ventajas", ["solo una"]),
  "sin alternativas": sin("alternativas", []),
  "sin tco": sin("tco_detalle", { total_mensual: 0 }),
  "un solo motivo": sin("por_que_gana", ["uno"]),
  "sin desglose": sin("score_desglose", {}),
  "sin propulsiones": sin("propulsiones_viables", []),
  /*
   * Este es el que separo a las dos: el servidor lo daba por bueno y la
   * pantalla lo rechazaba.
   */
  "sin modelos recomendados": sin("vehiculos_recomendados", []),
};

describe("las dos copias juzgan igual", () => {
  for (const nombre of Object.keys(LOS_CASOS)) {
    test(nombre, () => {
      assert.deepEqual(deLaPantalla(LOS_CASOS[nombre]), laDelServidor(LOS_CASOS[nombre]));
    });
  }
});

describe("y lo que dicen tiene sentido", () => {
  test("uno completo no echa nada en falta", () => {
    assert.deepEqual(deLaPantalla(UNO_COMPLETO), []);
  });

  test("uno vacio los echa todos en falta, con su nombre", () => {
    const falta = deLaPantalla({});

    assert.ok(falta.includes("titulo"));
    assert.ok(falta.includes("alternativas"));
    assert.ok(falta.length > 10, "solo echa en falta " + falta.length);
  });

  test("y sin modelos recomendados NO falta nada", () => {
    /*
     * Al filtrar el relleno por marca, la lista se queda vacia para premium
     * alemana, escandinava y nueva china. Si esto volviera a exigirse, esas
     * tres familias verian un recuadro rojo despues de contestar el test.
     */
    assert.deepEqual(deLaPantalla(LOS_CASOS["sin modelos recomendados"]), []);
  });

  test("y el que falta se dice por su nombre, no como un booleano", () => {
    assert.deepEqual(deLaPantalla(sin("titulo", "")), ["titulo"]);
  });
});

describe("y la pantalla lo cuenta", () => {
  test("el aviso lleva los campos que faltan", () => {
    /*
     * Antes decia solo «La IA ha devuelto un analisis incompleto», con quince
     * campos candidatos y ninguna pista. Se arreglaron tres cosas a ciegas y
     * el recuadro rojo seguia saliendo.
     */
    const app = fs
      .readFileSync(path.join(__dirname, "..", "..", "src", "App.js"), "utf8")
      .replace(/\r\n/g, "\n");

    assert.match(app, /const loQueFalta = queLeFaltaAlAnalisis\(normalizedResult\)/);
    assert.match(app, /\(falta: " \+ loQueFalta\.join\(", "\)/);
  });
});
