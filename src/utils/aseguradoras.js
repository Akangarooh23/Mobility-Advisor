import {
  OTRA,
  comoSeCompara,
  laDeLaLista as deLaLista,
  comoSeAbre as abrirDeLista,
  loQueSeGuarda,
} from "./listaCerrada";

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

/** La de la lista que se llama así, o cadena vacía. */
export function laDeLaLista(nombre) {
  return deLaLista(ASEGURADORAS, nombre);
}

/** Cómo se abre el desplegable para una aseguradora ya guardada. */
export function comoSeAbre(guardado) {
  return abrirDeLista(ASEGURADORAS, guardado);
}

export { OTRA, comoSeCompara, loQueSeGuarda };
