/**
 * Un campo que antes era texto libre y ahora se elige de una lista.
 *
 * Aquí está lo que comparten la aseguradora y la cobertura, que son dos campos
 * distintos con exactamente el mismo problema: se escribían a mano, la misma
 * cosa entraba de nueve maneras, y al cerrarlos hay que tener cuidado de no
 * borrar lo que la gente ya había escrito.
 *
 * ## Las dos reglas que sostienen esto
 *
 * **Lo viejo no se pierde.** Hay fichas con valores que no están en ninguna
 * lista. Si al abrirlas el desplegable saliera vacío, el primer guardado las
 * borraría sin que nadie las tocara, y el cliente no se enteraría hasta que le
 * preguntáramos por teléfono algo que ya nos había dicho.
 *
 * **Siempre hay salida.** Ninguna lista cubre todo, y sin un «Otra» se le está
 * pidiendo a quien no encaja que mienta o que deje el campo vacío. Vacío se
 * parece demasiado a «no tiene».
 */

/** El valor que marca «no está en la lista». No es el nombre de nada real. */
export const OTRA = "__otra__";

/** El texto reducido a lo que no cambia al escribirlo. */
export function comoSeCompara(texto) {
  return String(texto || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * La entrada de la lista que se llama así, o cadena vacía.
 *
 * Se compara sin acentos ni mayúsculas porque lo guardado viene de un campo
 * libre: «linea directa» y «Línea Directa» son lo mismo, y tratarlos como
 * distintos es justo lo que la lista viene a arreglar.
 */
export function laDeLaLista(lista, texto) {
  const busco = comoSeCompara(texto);
  if (!busco) return "";
  return (lista || []).find((x) => comoSeCompara(x) === busco) || "";
}

/**
 * Cómo se abre el desplegable para un valor ya guardado.
 *
 * Devuelve qué seleccionar y qué texto llevaba, para que una ficha antigua con
 * un valor de fuera se abra en «Otra» con su nombre en vez de aparecer vacía.
 */
export function comoSeAbre(lista, guardado) {
  const texto = String(guardado || "").trim();
  if (!texto) return { seleccion: "", escrita: "" };
  const enLista = laDeLaLista(lista, texto);
  if (enLista) return { seleccion: enLista, escrita: "" };
  return { seleccion: OTRA, escrita: texto };
}

/** Lo que se guarda, según lo elegido y lo escrito. */
export function loQueSeGuarda(seleccion, escrita) {
  if (seleccion === OTRA) return String(escrita || "").trim();
  return String(seleccion || "").trim();
}
