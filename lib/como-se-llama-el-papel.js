/**
 * Cómo se llama un papel del coche cuando ya está guardado.
 *
 * ## Por qué no vale el nombre del fichero
 *
 * El cliente sube lo que le dio el taller o la ITV, y eso se llama
 * `02384u723.pdf`, `scan_0007.jpg` o `Rechnung_Transport_TRP-2026-002.pdf`. En
 * la ficha del coche salen cinco papeles con nombres así y no se sabe cuál es
 * cuál sin abrirlos uno a uno — ni él en su panel, ni nosotros en el ERP.
 *
 * Con el tipo y la matrícula delante, la lista se lee de un vistazo:
 * «Ficha técnica · 8888LXR».
 *
 * ## La extensión se respeta
 *
 * Es lo que hace que el navegador y Word sepan abrirlo. Renombrar a secas
 * convertiría un PDF en un fichero sin tipo que hay que descargar y adivinar.
 *
 * ## Y el original no se pierde
 *
 * Se guarda detrás, tras un guion largo, cuando aporta algo. Un papel que el cliente
 * discute —«yo os mandé el de la ITV de 2024»— se identifica por el nombre con
 * el que él lo tenía, y ese nombre es el único sitio donde vive.
 */

/** Cómo se llama cada tipo de papel, en castellano y para leerlo. */
const COMO_SE_LLAMAN = {
  technical_sheet: 'Ficha técnica',
  circulation_permit: 'Permiso de circulación',
  itv: 'ITV',
  insurance: 'Seguro',
  maintenance: 'Factura de mantenimiento',
  document: 'Documento',
  mandato_firmado: 'Mandato firmado',
};

/** Entre lo que ponemos nosotros y lo que traía el cliente. */
const SEPARADOR = ' — ';

/** La extensión, en minúsculas y con el punto. Vacía si no tiene. */
function laExtension(nombre) {
  const n = String(nombre ?? '').trim();
  const punto = n.lastIndexOf('.');
  if (punto <= 0 || punto === n.length - 1) return '';
  const ext = n.slice(punto).toLowerCase();
  // Un punto en mitad del nombre no es una extensión: «factura 26.001 del taller».
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

/** El nombre sin extensión, para poder citarlo. */
function sinExtension(nombre) {
  const n = String(nombre ?? '').trim();
  const ext = laExtension(n);
  return ext ? n.slice(0, -ext.length) : n;
}

/** La matrícula como se escribe: sin espacios ni guiones, en mayúsculas. */
function comoSeEscribe(matricula) {
  return String(matricula ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Si el nombre original aporta algo o es ruido.
 *
 * `scan_0007`, `IMG_2841`, `documento (1)` o una ristra de dígitos no dicen
 * nada: meterlos entre paréntesis alarga la línea sin informar. Un nombre con
 * palabras —`Rechnung_Transport_TRP-2026-002`— sí, porque es por el que él lo
 * conoce.
 */
function diceAlgo(nombre) {
  const base = sinExtension(nombre).trim();
  if (base.length < 4) return false;
  /*
   * Los nombres que pone el sistema, con su numerito.
   *
   * `scan_0007`, `IMG_2841` y también `documento (1)` — el que pone el
   * navegador al descargar dos veces lo mismo. El paréntesis es parte del
   * patrón: sin él, «documento (1)» se colaba como si dijera algo.
   */
  if (/^(img|image|scan|foto|photo|doc|documento|file|archivo)[\s_-]*(\(?\d+\)?)?$/i.test(base)) return false;
  // Solo dígitos, o dígitos con separadores: un identificador del taller.
  if (/^[\d\s_.-]+$/.test(base)) return false;
  return /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3}/.test(base);
}

const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Cómo empieza un nombre puesto por nosotros: la etiqueta y, detrás, algo
 * nuestro —la matrícula, el numerito o el guion del original—, o nada.
 *
 * Que sea el patrón entero y no solo la etiqueta es la diferencia entre
 * reconocer lo nuestro y quedarse con el papel de un cliente. «ITV _ 2026.04.27»
 * empieza por «ITV» y lo trajo él.
 */
const LO_NUESTRO = new RegExp(
  `^(?:${Object.values(COMO_SE_LLAMAN).map(escapa).join('|')})(?: · | \\(\\d+\\)|${escapa(SEPARADOR)}|$)`
);

/**
 * Si el nombre ya se lo pusimos nosotros.
 *
 * Al guardar por segunda vez, el panel devuelve los documentos que ya estaban
 * con el nombre que les pusimos. Sin esto, cada guardado volvería a meter ese
 * nombre como si fuera el del fichero del cliente y la lista acabaría con
 * «ITV · 8888LXR — ITV · 8888LXR — ITV · 8888LXR».
 *
 * Y sin mirar el patrón entero pasa lo contrario, que es peor: «ITV _
 * 2026.04.27.pdf» —el nombre que le puso el cliente, y lo único que distingue
 * ese papel de los otros dos suyos— se tomaba por nuestro y se tiraba.
 */
function yaSeLoPusimos(nombre) {
  return LO_NUESTRO.test(sinExtension(nombre).trim());
}

/** Lo que traía el cliente, quitándole lo que le pusimos nosotros encima. */
function loQueTrajo(nombre) {
  const base = sinExtension(nombre).trim();
  if (!yaSeLoPusimos(base)) return base;
  /*
   * De un nombre nuestro solo sobrevive lo que va detrás del guion largo, que
   * es justo lo que el cliente trajo. Sin guion no trajo nada que guardar.
   */
  const corte = base.indexOf(SEPARADOR);
  return corte === -1 ? '' : base.slice(corte + SEPARADOR.length).trim();
}

/**
 * El nombre con el que se guarda.
 *
 * `cual` sirve para numerar cuando hay varios del mismo tipo: sin él, tres ITV
 * se llamarían las tres igual y en la lista no se distinguirían.
 */
function comoSeLlamaElPapel(tipo, matricula, nombreOriginal, cual = 0) {
  const queEs = COMO_SE_LLAMAN[String(tipo ?? '').trim()] || COMO_SE_LLAMAN.document;
  const placa = comoSeEscribe(matricula);
  const ext = laExtension(nombreOriginal);

  const partes = [queEs];
  if (placa) partes.push(placa);

  let nombre = partes.join(' · ');
  if (cual > 1) nombre += ` (${cual})`;
  const suyo = loQueTrajo(nombreOriginal);
  if (diceAlgo(suyo)) nombre += `${SEPARADOR}${suyo}`;

  /*
   * Un tope, porque esto acaba en una columna y en un nombre de fichero.
   *
   * Se recorta por el final, que es donde está el original: lo que no se puede
   * perder es el tipo y la matrícula, que es para lo que se renombra.
   */
  if (nombre.length > 120) nombre = `${nombre.slice(0, 117).trimEnd()}…`;

  return `${nombre}${ext}`;
}

module.exports = {
  COMO_SE_LLAMAN,
  comoSeLlamaElPapel,
  laExtension,
  sinExtension,
  diceAlgo,
  loQueTrajo,
  yaSeLoPusimos,
};
