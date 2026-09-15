/**
 * Lo que sabemos del mantenimiento de un coche, preguntado de forma que sirva.
 *
 * ## Por qué tres preguntas cerradas y no una caja de texto
 *
 * Había una caja libre —«Qué se le ha hecho al coche»— y de ahí no sale nada
 * utilizable: no se puede poner en el anuncio, ni filtrar, ni comparar dos
 * coches. El historial de revisiones es de lo poco que mueve el precio de
 * verdad y es la primera pregunta de cualquier comprador, así que se pregunta
 * como se va a usar: cerrado.
 *
 * ## Por qué «no lo sé» es una respuesta y no un hueco
 *
 * Sin esa opción, el que no lo sabe deja el campo vacío, y entonces «vacío»
 * significa dos cosas a la vez: no ha contestado y no lo sabe. La primera se
 * arregla llamándole, la segunda no — y son llamadas distintas. Un coche
 * heredado o comprado de segunda mano sin papeles es el caso normal, no el raro.
 *
 * ## Por qué nada de esto es obligatorio
 *
 * Una puerta significa «sin esto no podemos publicar», y con el mantenimiento
 * eso no es cierto: se publica igual. Cada puerta nueva se la cobras a los que
 * sí iban a vender. Se pregunta, se enseña lo que aporta, y si no lo contesta
 * nadie se decide entonces con un dato delante.
 */

/** Las tres respuestas posibles. Vacío es «no ha contestado», que es otra cosa. */
const RESPUESTAS = ['si', 'no', 'no_lo_se'];

/** Cómo se leen. */
const COMO_SE_LEEN = {
  si: 'Sí',
  no: 'No',
  no_lo_se: 'No lo sé',
};

/**
 * Lo que se pregunta, en orden.
 *
 * `porQue` no es decoración: es lo que se le enseña al vendedor para que
 * conteste. Pedir un dato sin decir para qué es pedirle un favor.
 */
const LAS_PREGUNTAS = [
  {
    clave: 'libroMantenimiento',
    columna: 'service_book',
    pregunta: '¿Tienes el libro de mantenimiento o las facturas de las revisiones?',
    porQue: 'Es lo primero que pregunta quien compra, y sube el precio.',
  },
  {
    clave: 'revisionesOficiales',
    columna: 'official_service',
    pregunta: '¿Las revisiones son de taller oficial de la marca?',
    porQue: 'Con sello de la marca el coche vale más y se vende antes.',
  },
];

/** La fecha y los kilómetros de la última revisión, que van juntos. */
const LA_ULTIMA_REVISION = [
  { clave: 'ultimaRevisionFecha', columna: 'last_service_date' },
  { clave: 'ultimaRevisionKm', columna: 'last_service_km' },
];

/** Todo lo que se guarda, para no repetir la lista en cada capa. */
const LO_QUE_SE_GUARDA = [...LAS_PREGUNTAS, ...LA_ULTIMA_REVISION];

/**
 * Una respuesta, o vacío.
 *
 * Lo que no sea una de las tres se queda en vacío en vez de guardarse tal cual:
 * un valor inventado en esta columna se cuela en el anuncio como si el vendedor
 * lo hubiera dicho.
 */
function laRespuesta(valor) {
  const v = String(valor ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return RESPUESTAS.includes(v) ? v : '';
}

/** Los kilómetros, solo dígitos y con un tope que no sea absurdo. */
function losKilometros(valor) {
  const soloNumeros = String(valor ?? '').replace(/[^\d]/g, '');
  if (!soloNumeros) return '';
  const n = Number(soloNumeros);
  // Dos millones: por encima de eso es una errata, no un coche.
  return n > 0 && n <= 2000000 ? String(n) : '';
}

/**
 * La fecha, en el formato en que se guardan las otras del coche.
 *
 * Una revisión futura no existe: si viene una, es que se ha equivocado de campo
 * —confundiéndola con la próxima ITV— y guardarla diría que el coche está más
 * al día de lo que está.
 */
function laFecha(valor, hoy = new Date()) {
  const v = String(valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const cuando = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(cuando.getTime())) return '';
  return cuando > hoy ? '' : v;
}

/**
 * Lo que se guarda de un coche, limpio.
 *
 * Se devuelven siempre las cuatro claves, con vacío donde no haya nada: así la
 * pantalla no tiene que distinguir «no vino» de «vino vacío».
 */
function loQueSeSabe(entrada = {}, hoy = new Date()) {
  return {
    libroMantenimiento: laRespuesta(entrada.libroMantenimiento),
    revisionesOficiales: laRespuesta(entrada.revisionesOficiales),
    ultimaRevisionFecha: laFecha(entrada.ultimaRevisionFecha, hoy),
    ultimaRevisionKm: losKilometros(entrada.ultimaRevisionKm),
  };
}

/** Si el vendedor ha contestado algo. Sirve para no dar por dicho lo que nadie dijo. */
function haContestadoAlgo(loSabido = {}) {
  return LO_QUE_SE_GUARDA.some(({ clave }) => Boolean(String(loSabido[clave] ?? '').trim()));
}

module.exports = {
  RESPUESTAS,
  COMO_SE_LEEN,
  LAS_PREGUNTAS,
  LA_ULTIMA_REVISION,
  LO_QUE_SE_GUARDA,
  laRespuesta,
  losKilometros,
  laFecha,
  loQueSeSabe,
  haContestadoAlgo,
};
