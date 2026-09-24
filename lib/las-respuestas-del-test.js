"use strict";

/**
 * Las respuestas del test, con los nombres que el motor busca.
 *
 * ## Lo que pasaba
 *
 * El cuestionario guarda una cosa y el motor lee otra. Salió de un barrido que
 * comparó las 30 preguntas contra las 23 respuestas que lee el código:
 *
 *     la pregunta guarda        el motor lee        resultado
 *     ──────────────────────────────────────────────────────────
 *     uso_km_anuales            km_anuales          siempre vacío
 *     horizonte_tenencia        horizonte           siempre vacío
 *     carroceria_preferida      carroceria          siempre vacío
 *
 * Son las dos preguntas más determinantes del test —cuántos kilómetros haces y
 * cuánto tiempo quieres el coche— y **ninguna de las dos pesaba en el
 * resultado**. No fallaba nada: `answers.km_anuales` era `undefined`, las
 * comparaciones daban `false` y el score salía igual para todo el mundo.
 *
 * ## Y los valores tampoco cuadraban
 *
 * Con el nombre arreglado seguiría sin funcionar la mitad. El motor pregunta si
 * los kilómetros son `"mas_20k"`, y esa opción **no existe**: el cuestionario
 * ofrece `menos_10k`, `10k_20k`, `20k_35k` y `mas_35k`. La rama de «hace muchos
 * kilómetros» no podía cumplirse aunque el nombre encajara.
 *
 * ## Por qué se traduce aquí y no se renombra
 *
 * Los identificadores de las preguntas viajan en las respuestas guardadas de
 * los clientes que ya hicieron el test. Renombrarlos dejaría esas respuestas
 * sin poder leerse. Así que el cuestionario se queda como está y aquí se pone
 * el puente, que además deja escrito el desajuste en vez de esconderlo.
 */

/**
 * Los kilómetros, en los tres tramos que el motor sabe distinguir.
 *
 * El cuestionario ofrece cuatro; el motor solo separa poco, normal y mucho. Los
 * dos tramos altos caen en el mismo sitio porque para decidir modalidad —no
 * modelo— 25.000 y 40.000 km al año piden lo mismo.
 */
const LOS_KILOMETROS = {
  menos_10k: "menos_10k",
  "10k_20k": "10k_20k",
  "20k_35k": "mas_20k",
  mas_35k: "mas_20k",
  // Las que ya venían con el nombre del motor, por si llegan de otro flujo.
  mas_20k: "mas_20k",
};

/** Y el horizonte: lo que guarda la pregunta doble pasa tal cual. */
const EL_HORIZONTE = {
  menos_1_ano: "menos_1_ano",
  "2_3": "2_3",
  "4_6": "4_6",
  mas_7: "mas_7",
  no_claro: "",
  // De los flujos cortos —renting por días o por meses—, que sí las usa.
  por_dias: "por_dias",
  menos_2_meses: "menos_2_meses",
};

const texto = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Devuelve las respuestas con los nombres que el motor espera.
 *
 * No pisa lo que ya venga puesto: si una respuesta llega con el nombre del
 * motor —de un flujo que ya lo hacía bien— se respeta.
 */
function comoLasLeeElMotor(answers) {
  if (!answers || typeof answers !== "object") return answers || {};

  const salida = { ...answers };

  if (!texto(salida.km_anuales)) {
    const delTest = texto(answers.uso_km_anuales);
    if (delTest) salida.km_anuales = LOS_KILOMETROS[delTest] || delTest;
  }

  if (!texto(salida.horizonte)) {
    const delTest = texto(answers.horizonte_tenencia);
    const traducido = delTest ? (EL_HORIZONTE[delTest] ?? delTest) : "";
    if (traducido) salida.horizonte = traducido;
  }

  if (!texto(salida.carroceria)) {
    const delTest = texto(answers.carroceria_preferida);
    // «Me da igual» no es una carrocería: que siga deduciéndose.
    if (delTest && delTest !== "indiferente_carroceria") salida.carroceria = delTest;
  }

  return salida;
}

module.exports = { comoLasLeeElMotor, LOS_KILOMETROS, EL_HORIZONTE };
