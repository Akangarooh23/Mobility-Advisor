/**
 * Que ninguna pregunta del test se quede sin llegar al motor.
 *
 * ## De dónde sale esto
 *
 * Tres veces en el mismo día. Primero `answers.carroceria`, que el motor leía
 * para decidir el tipo de coche y **no existía como pregunta**: por eso todo el
 * mundo salía con «un compacto equilibrado». Después, barriendo en serio las 30
 * preguntas contra las 23 respuestas que lee el código, aparecieron las dos
 * gordas:
 *
 *     la pregunta guarda        el motor lee        resultado
 *     ──────────────────────────────────────────────────────────
 *     uso_km_anuales            km_anuales          siempre vacío
 *     horizonte_tenencia        horizonte           siempre vacío
 *
 * Cuántos kilómetros haces al año y cuánto tiempo quieres el coche: las dos
 * preguntas que más deberían pesar, y ninguna pesaba. No fallaba nada —
 * `undefined` no casa con ningún `===` y el score salía igual para todos.
 *
 * ## Por qué una prueba y no cuidado
 *
 * Porque no se ve. Una respuesta que no llega no rompe la pantalla, no deja
 * rastro en los registros y no da un resultado raro: da un resultado plausible
 * calculado con menos información de la que el cliente ha dado.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "..");

/** Lo que el cuestionario guarda: los `id` y las claves compuestas. */
function loQueSePregunta() {
  const pasos = fs.readFileSync(path.join(RAIZ, "src/data/questionnaireSteps.js"), "utf8");
  const claves = new Set();
  for (const m of pasos.matchAll(/id:\s*"([a-z0-9_]+)"/g)) claves.add(m[1]);
  /*
   * La pregunta doble no guarda su propio `id`: guarda las dos claves de
   * `compositeKeys`. Sin esto, `horizonte_tenencia` parecería no preguntarse
   * nunca y la prueba avisaría de algo que está bien.
   */
  for (const m of pasos.matchAll(/compositeKeys:\s*\[([^\]]+)\]/g)) {
    for (const c of m[1].matchAll(/"([a-z0-9_]+)"/g)) claves.add(c[1]);
  }
  return claves;
}

/** Y lo que el código lee de `answers`. */
function loQueSeLee() {
  const leidas = new Map();
  const mira = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      if (f === "node_modules" || f === "build") continue;
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { mira(p); continue; }
      if (!/\.jsx?$/.test(f) || /\.test\./.test(f)) continue;
      const s = fs.readFileSync(p, "utf8");
      for (const m of s.matchAll(/answers[?]?\.([a-z][a-z0-9_]+)/g)) {
        if (!leidas.has(m[1])) leidas.set(m[1], new Set());
        leidas.get(m[1]).add(path.relative(RAIZ, p));
      }
    }
  };
  mira(path.join(RAIZ, "src"));
  mira(path.join(RAIZ, "api"));
  /*
   * Y , donde viven los puentes.
   *
   * Sin esto, una pregunta leida solo desde 
   * salia como que no la usa nadie. Lo cazó esta misma prueba al añadir el
   * presupuesto y los kilometros, que es justo para lo que esta.
   */
  mira(path.join(RAIZ, "lib"));
  return leidas;
}

/**
 * Las que el motor lee sin que sean preguntas, y por qué está bien.
 *
 * Cada una con su motivo escrito: el día que una deje de tener sentido, la
 * prueba de abajo lo dice en vez de tragárselo.
 */
const LAS_QUE_VIENEN_DE_OTRO_SITIO = {
  km_anuales: "la traduce `lib/las-respuestas-del-test.js` desde uso_km_anuales",
  horizonte: "la traduce `lib/las-respuestas-del-test.js` desde horizonte_tenencia",
  carroceria: "la traduce `lib/las-respuestas-del-test.js` desde carroceria_preferida",
  marca_objetivo: "viene del buscador de coche conocido, no del test",
  modelo_objetivo: "viene del buscador de coche conocido, no del test",
  validacion_rapida: "se contesta después del resultado, en la validación rápida",
};

/**
 * Y las preguntas que hoy no lee nadie.
 *
 * No están bien: son ocho pantallas que el cliente rellena para nada. Se
 * apuntan para que la cuenta no crezca sin que nadie lo note, y la decisión —
 * usarlas o quitarlas del test— es de producto.
 */
const LAS_QUE_NO_USA_NADIE = [
  "carga_trabajo",
  "financiacion_gestion",
  "financiacion_plazo",
  "provincia_zona",
  "vehiculo_actual_antiguedad",
  "vehiculo_actual_deuda",
  "vehiculo_actual_km",
];

describe("el barrido encuentra algo", () => {
  test("hay preguntas y hay respuestas leídas", () => {
    // Si los dos lados salieran vacíos, todo lo de abajo pasaría sin mirar nada.
    assert.ok(loQueSePregunta().size > 20, String(loQueSePregunta().size));
    assert.ok(loQueSeLee().size > 15, String(loQueSeLee().size));
  });
});

describe("lo que el motor lee, se pregunta", () => {
  test("o se traduce, o está apuntado con su motivo", () => {
    const preguntadas = loQueSePregunta();
    const huerfanas = [];
    for (const [clave, donde] of loQueSeLee()) {
      if (preguntadas.has(clave)) continue;
      if (clave in LAS_QUE_VIENEN_DE_OTRO_SITIO) continue;
      huerfanas.push(`${clave} (en ${[...donde].join(", ")})`);
    }
    assert.deepEqual(huerfanas, [],
      `el motor lee respuestas que nadie pregunta:\n  ${huerfanas.join("\n  ")}`);
  });

  test("y las traducidas llegan de verdad, con su valor", () => {
    /*
     * Ejecutando el puente, no leyendo su texto.
     *
     * La primera version de esta prueba miraba si el fichero contenia
     * «salida.km_anuales» y pasaba igual con la traduccion borrada: la linea
     * seguia estando en el `if` de arriba. Comprobaba la letra, no el hecho.
     */
    const { comoLasLeeElMotor } = require("../las-respuestas-del-test.js");

    const delTest = {
      uso_km_anuales: "20k_35k",
      horizonte_tenencia: "menos_1_ano",
      carroceria_preferida: "suv",
    };
    const paraElMotor = comoLasLeeElMotor(delTest);

    // 20k_35k y mas_35k caen en el tramo alto, que es el unico que el motor
    // sabe distinguir. La opcion «mas_20k» que el motor compara NO EXISTE en
    // el cuestionario: sin esta traduccion, esa rama no se cumple jamas.
    assert.equal(paraElMotor.km_anuales, "mas_20k");
    assert.equal(paraElMotor.horizonte, "menos_1_ano");
    assert.equal(paraElMotor.carroceria, "suv");
  });

  test("«me da igual» no se convierte en una carroceria", () => {
    const { comoLasLeeElMotor } = require("../las-respuestas-del-test.js");
    const r = comoLasLeeElMotor({ carroceria_preferida: "indiferente_carroceria" });
    assert.equal(r.carroceria, undefined, "deduciria un SUV de un «me da igual»");
  });

  test("y lo que ya viene con el nombre del motor no se pisa", () => {
    const { comoLasLeeElMotor } = require("../las-respuestas-del-test.js");
    const r = comoLasLeeElMotor({ km_anuales: "menos_10k", uso_km_anuales: "mas_35k" });
    assert.equal(r.km_anuales, "menos_10k");
  });
});

describe("lo que se pregunta, se usa", () => {
  test("o está en la lista de las que no usa nadie", () => {
    const leidas = loQueSeLee();
    const puente = fs.readFileSync(path.join(RAIZ, "lib/las-respuestas-del-test.js"), "utf8");
    const mudas = [];
    for (const clave of loQueSePregunta()) {
      if (leidas.has(clave)) continue;
      // Las que el puente traduce sí se usan, aunque sea con otro nombre.
      if (puente.includes(`answers.${clave}`)) continue;
      // Los contenedores no guardan nada: guardan sus `compositeKeys`.
      if (clave === "horizonte_y_antiguedad") continue;
      if (LAS_QUE_NO_USA_NADIE.includes(clave)) continue;
      mudas.push(clave);
    }
    assert.deepEqual(mudas, [],
      `preguntas nuevas que no lee nadie:\n  ${mudas.join("\n  ")}`);
  });

  test("y la lista de las que no usa nadie no crece sola", () => {
    /*
     * Siete. Si mañana son ocho, que sea porque alguien lo ha escrito aquí y
     * ha tenido que explicárselo a sí mismo.
     */
    assert.equal(LAS_QUE_NO_USA_NADIE.length, 7);
  });
});
