/**
 * Lo que la etiqueta de la versión dice del coche.
 *
 * ## El fallo que esto arregla
 *
 * Cuando el cliente elige su versión de la lista, la pantalla pide los datos de
 * esa versión —potencia, CO₂, plazas, puertas, cambio— y los rellena sola. Esa
 * llamada existe, funciona y **no rellena nada**: de las 16.809 versiones del
 * catálogo, **cero** tienen esas columnas escritas. Están todas vacías.
 *
 * Así que el cliente elige «R-Line 1.5 TSI 110kW (150CV) DSG», no se rellena
 * nada, y escribe a mano lo que cree: en el T-Roc de la prueba puso **110 CV**
 * —que es el número que ve, pero son kilovatios— y **Manual** en un DSG. Los
 * dos datos malos vienen de la misma pantalla y del mismo hueco.
 *
 * Y el arreglo estaba delante: **la etiqueta lo lleva escrito**. «R-Line 1.5
 * TSI 110kW (150CV) DSG» dice la cilindrada, los kilovatios, los caballos y el
 * cambio. No hace falta ninguna columna.
 *
 * ## Por qué esto no sustituye a la ficha técnica
 *
 * La etiqueta dice lo que **esa versión** lleva; la ficha dice lo que **ese
 * coche** lleva. Casi siempre coinciden, y cuando no, manda el papel. Esto
 * sirve para que lo que el cliente escribe salga bien de entrada, no para
 * comprobarlo.
 */

/** Lo que se entiende por cambio automático en el nombre de una versión. */
export const AUTOMATICOS = [
  "dsg", "s tronic", "stronic", "tiptronic", "tronic", "multitronic",
  "dct", "edc", "pdk", "automatico", "automático", "aut.", "auto",
  "eat", "eat6", "eat8", "cvt", "steptronic", "g-tronic", "gtronic",
  "7g", "9g", "powershift", "dsg7", "dsg6", "xtronic", "e-cvt",
];

const nt = (v) => String(v ?? "").trim();

/**
 * La cilindrada, en centímetros cúbicos.
 *
 * «1.5» son 1.500. Se pide que no lleve dígitos pegados delante ni detrás para
 * no confundirla con un «2.0 TDI 4x4» ni con una fecha.
 */
export function laCilindrada(etiqueta) {
  const m = nt(etiqueta).match(/(?<![\d.,])([0-9])[.,]([0-9])(?![\d.,])/);
  return m ? Math.round(Number(`${m[1]}.${m[2]}`) * 1000) : null;
}

/** Los kilovatios: «110kW», «110 kw». */
export function losKilovatios(etiqueta) {
  const m = nt(etiqueta).match(/([0-9]{2,3})\s*kw\b/i);
  return m ? Number(m[1]) : null;
}

/**
 * Los caballos.
 *
 * Primero los que la etiqueta dice —«(150CV)»— y si no los dice, los que salen
 * de los kilovatios. Es la conversión que el cliente no hace: ve «110kW» y
 * escribe 110.
 */
export function losCaballos(etiqueta) {
  const m = nt(etiqueta).match(/([0-9]{2,4})\s*(cv|hp)\b/i);
  if (m) return Number(m[1]);
  const kw = losKilovatios(etiqueta);
  return kw ? Math.round(kw * 1.35962) : null;
}

/**
 * Si es automático, por el nombre de su cambio.
 *
 * Devuelve `"automatico"` cuando lo dice y **cadena vacía cuando no dice
 * nada**, que no es lo mismo que manual: la mayoría de las versiones manuales
 * no escriben «manual» en su nombre, y dar por manual todo lo que calla es
 * volver a poner un dato inventado donde había un hueco.
 */
export function elCambio(etiqueta) {
  const s = nt(etiqueta).toLowerCase();
  if (!s) return "";
  const suelto = ` ${s.replace(/[()]/g, " ")} `;
  const loDice = AUTOMATICOS.some((a) => suelto.includes(` ${a} `) || suelto.includes(` ${a}-`));
  if (loDice) return "automatico";
  if (/\bmanual\b|\bmt\b/.test(suelto)) return "manual";
  return "";
}

/**
 * Todo junto, tal como lo rellena el formulario.
 *
 * Solo lo que la etiqueta dice. Lo que no dice se queda fuera del objeto, para
 * que quien lo use no pise con un vacío algo que el cliente ya había escrito.
 */
export function loQueDiceLaVersion(etiqueta) {
  const dice = {};
  const cc = laCilindrada(etiqueta);
  const cv = losCaballos(etiqueta);
  const kw = losKilovatios(etiqueta);
  const cambio = elCambio(etiqueta);
  if (cc) dice.displacement = String(cc);
  if (cv) dice.cv = String(cv);
  if (kw) dice.horsepower = String(kw);
  if (cambio) dice.transmissionType = cambio;
  return dice;
}

/**
 * Si esa versión encaja con el motor que dice la ficha técnica.
 *
 * Sirve para quedarse solo con las versiones que ese coche puede tener. Una
 * etiqueta que no dice ni cilindrada ni potencia **no se descarta**: descartar
 * por falta de datos dejaría al cliente sin su versión y sin saber por qué.
 *
 * Los márgenes son los mismos que en el ERP: medio litro largo para la
 * cilindrada, porque «1.5» se anuncia igual para 1.498 y 1.512, y tres
 * kilovatios para la potencia, que es lo que se pierde al redondear.
 */
export function encajaConElMotor(etiqueta, { cc = null, kw = null } = {}) {
  const suya = laCilindrada(etiqueta);
  const suyos = losKilovatios(etiqueta);
  if (suya === null && suyos === null) return true;
  if (cc !== null && suya !== null && Math.abs(suya - cc) > 150) return false;
  if (kw !== null && suyos !== null && Math.abs(suyos - kw) > 3) return false;
  // Si la ficha no dice nada, no hay con qué descartar.
  return true;
}
