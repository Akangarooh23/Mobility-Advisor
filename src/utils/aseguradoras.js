/**
 * Las aseguradoras que se ofrecen al decir con quién está asegurado el coche.
 *
 * ## Por qué una lista y no texto libre
 *
 * Escrito a mano, la misma compañía entra de nueve maneras —«Mapfre», «MAPFRE»,
 * «mapfre seguros», «Mafre»— y entonces no se puede contar, ni filtrar, ni
 * cruzar con nada. Con una lista, «cuántos clientes tienen Mapfre» es una
 * pregunta que se puede contestar.
 *
 * ## Por qué hay «Otra»
 *
 * La lista son las veinticinco que cubren casi todo el mercado español, y «casi»
 * no es «todo»: quedan fuera mutuas pequeñas, compañías de nicho y las de quien
 * tiene el coche asegurado fuera de España. Sin una salida, a esa persona se le
 * estaría pidiendo que mienta o que deje el campo vacío — y un campo vacío se
 * parece demasiado a «no tiene seguro».
 *
 * ## Y por qué no se pierde lo que ya estaba escrito
 *
 * Antes de esto el campo era libre, así que hay fichas con valores que no están
 * en la lista. Si al abrirlas el desplegable saliera vacío, el primer guardado
 * borraría ese dato sin que nadie lo tocara. `comoSeAbre` se encarga: lo que no
 * esté en la lista se abre como «Otra» con su texto intacto.
 */

/** Las de la lista, en el orden en que se ofrecen. */
export const ASEGURADORAS = [
  "MAPFRE",
  "Mutua Madrileña",
  "Allianz",
  "AXA",
  "Generali",
  "Línea Directa",
  "Occident",
  "Reale",
  "Pelayo",
  "Verti",
  "Qualitas Auto",
  "Direct Seguros",
  "Balumba",
  "Génesis",
  "Nuez",
  "Penélope Seguros",
  "MMT",
  "RACE",
  "Prima",
  "Tuio",
  "FIATC",
  "Helvetia",
  "Zurich",
  "Caser",
  "AMV",
];

/** El valor que marca «no está en la lista». No es el nombre de nadie. */
export const OTRA = "__otra__";

/** El nombre reducido a lo que no cambia al escribirlo. */
export function comoSeCompara(nombre) {
  return String(nombre || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * La de la lista que se llama así, o cadena vacía.
 *
 * Se compara sin acentos ni mayúsculas porque lo guardado viene de un campo
 * libre: «linea directa» y «Línea Directa» son la misma compañía, y tratarlas
 * como distintas es justo lo que esta lista viene a arreglar.
 */
export function laDeLaLista(nombre) {
  const busco = comoSeCompara(nombre);
  if (!busco) return "";
  return ASEGURADORAS.find((a) => comoSeCompara(a) === busco) || "";
}

/**
 * Cómo se abre el desplegable para un valor ya guardado.
 *
 * Devuelve qué hay que seleccionar y qué texto llevaba, para que una ficha
 * antigua con una compañía de fuera de la lista se abra en «Otra» con su
 * nombre, en vez de aparecer vacía y perderse al guardar.
 */
export function comoSeAbre(guardado) {
  const texto = String(guardado || "").trim();
  if (!texto) return { seleccion: "", escrita: "" };
  const enLista = laDeLaLista(texto);
  if (enLista) return { seleccion: enLista, escrita: "" };
  return { seleccion: OTRA, escrita: texto };
}

/** Lo que se guarda, según lo elegido y lo escrito. */
export function loQueSeGuarda(seleccion, escrita) {
  if (seleccion === OTRA) return String(escrita || "").trim();
  return String(seleccion || "").trim();
}
