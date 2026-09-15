/**
 * Las respuestas de las preguntas del mantenimiento, del lado de la pantalla.
 *
 * El original vive en `lib/lo-que-se-sabe-del-mantenimiento.js`, que es quien
 * las valida antes de guardarlas. Aquí están repetidas porque el empaquetador
 * de la web no deja importar de fuera de `src/`, y las dos copias las compara
 * un test: si alguien añade una respuesta en un sitio y no en el otro, la
 * pantalla ofrecería algo que el servidor tira a la basura sin decir nada.
 */

/** Valor, cómo se lee en castellano, y en inglés. */
export const LAS_RESPUESTAS = [
  ["si", "Sí", "Yes"],
  ["no", "No", "No"],
  ["no_lo_se", "No lo sé", "I don't know"],
];

/**
 * Las opciones para un desplegable, ya traducidas.
 *
 * `txt` es el traductor de la pantalla: se pasa desde dentro del componente,
 * que es donde existe.
 */
export function respuestasParaElDesplegable(txt) {
  return LAS_RESPUESTAS.map(([valor, es, en]) => [valor, txt(es, en)]);
}
