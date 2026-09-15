/**
 * Encontrar en el catálogo la marca y el modelo que el coche ya tiene puestos.
 *
 * ## Por qué hace falta
 *
 * Los desplegables de «Marca» y «Modelo» no guardan el nombre: guardan el
 * **id** del catálogo (`89`, `488`). La ficha del coche guarda el nombre
 * («Volkswagen», «T-Roc»). Al abrir un coche que ya existe se rellenaba el
 * formulario con los nombres y nadie traducía eso a ids, así que los dos
 * desplegables se quedaban en «Selecciona marca» sobre un coche que es un
 * Volkswagen T-Roc — y quien venía a subir los papeles se encontraba la ficha
 * aparentemente vacía.
 *
 * ## Por qué se comparan así
 *
 * El nombre guardado y el del catálogo son el mismo texto escrito por dos
 * sitios distintos: «T-Roc», «T ROC», «t-roc». Comparar en crudo deja fuera al
 * coche por un guion, y el efecto para quien mira es el mismo que no buscarlo.
 */

/** El nombre reducido a lo que no cambia: sin acentos, ni guiones, ni cajas. */
export function comoSeCompara(nombre) {
  return String(nombre || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Si dos nombres del catálogo son el mismo. Vacío no es igual a nada. */
export function mismoNombre(uno, otro) {
  const a = comoSeCompara(uno);
  return Boolean(a) && a === comoSeCompara(otro);
}

/**
 * La entrada del catálogo que se llama así, o `null`.
 *
 * Devuelve `null` también cuando la lista aún no ha llegado. Quien lo use tiene
 * que distinguir «todavía no sé» de «no está»: dar por ausente lo que aún está
 * cargando llevaría a cambiar de modo por una respuesta lenta.
 */
export function cualEsDelCatalogo(lista, nombre) {
  if (!Array.isArray(lista) || !lista.length) return null;
  return lista.find((entrada) => mismoNombre(entrada?.name, nombre)) || null;
}
