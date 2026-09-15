/**
 * Lo que ya sabemos de un coche y no se veía en su ficha: la tasación.
 *
 * ## Por qué aquí
 *
 * La tasación se entrega por correo y se guarda en una lista aparte, así que
 * desde el coche no se veía: quien abría su vehículo no tenía manera de saber
 * si estaba tasado ni por cuánto, y el precio que le dimos vivía solo en un PDF
 * de su bandeja de entrada.
 *
 * El informe de estado no está aquí porque ya lo trae `useConditionReport`, que
 * habla con su API. Esto es solo lo que se puede sacar de lo que el panel ya
 * tiene cargado.
 */

/** La matrícula como se compara: sin espacios ni guiones y en mayúsculas. */
export function comoSeCompara(matricula) {
  return String(matricula || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * La tasación de este coche, la última, o `null`.
 *
 * Solo las que tienen **precio**: una fila sin importe es una entrega que se
 * quedó a medias —pasó de verdad, por un nombre de campo mal escrito— y
 * enseñarla diría «ya está tasado» sin ningún número que enseñar.
 *
 * Se busca por identificador y, si no, por matrícula: las de antes del arreglo
 * se guardaron sueltas, sin coche, y son suyas igual.
 */
export function laTasacionDe(tasaciones, coche) {
  const id = String(coche?.id || "").trim();
  const placa = comoSeCompara(coche?.plate);

  const suyas = (tasaciones || []).filter((t) => {
    if (!t || !(Number(t.estimateValue) > 0)) return false;
    const suId = String(t.vehicleId || "").trim();
    if (suId) return suId === id;
    // Sin coche: se acepta si el título nombra su matrícula, y nunca si él no
    // tiene matrícula —si no, la primera tasación suelta se pegaría a cualquier
    // coche recién creado.
    return Boolean(placa) && comoSeCompara(t.vehicleTitle || t.title).includes(placa);
  });

  if (!suyas.length) return null;

  // La última que se hizo. Sin fecha se queda como está: el orden de la lista
  // ya viene del servidor, de la más nueva a la más vieja.
  const cuando = (t) => new Date(t.createdAt || t.updatedAt || 0).getTime() || 0;
  return [...suyas].sort((a, b) => cuando(b) - cuando(a))[0];
}

/** «20.795 €», con el punto de los miles como se escribe aquí. */
export function enEuros(importe) {
  const n = Number(importe);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Math.round(n).toLocaleString("es-ES")} €`;
}

/** El día en que se hizo, o vacío. */
export function elDia(fecha) {
  const d = new Date(fecha || 0);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
