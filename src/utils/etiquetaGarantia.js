/**
 * Cómo se escribe una garantía en la ficha del coche.
 *
 * Dos cosas que parecen tonterías y no lo son.
 *
 * **No repetir los meses.** El nombre del producto ya suele llevarlos
 * —«Ampliada a 24 meses»— y añadirle «· 24 meses» detrás queda como un
 * tartamudeo. Se añade solo cuando el nombre no lo dice.
 *
 * **Decir lo que cuesta.** Antes se escribía con la diferencia respecto a una
 * garantía base que ya iba dentro del precio: «incluida», «+290 €». Ya no hay
 * base —no vendemos el coche, así que no debemos la garantía— y cada producto
 * cuesta lo que cuesta. Se empieza sin ninguna, y la que elija suma su precio.
 */

/** El nombre, con los meses solo si no los lleva ya. */
function etiquetaDeGarantia(opcion) {
  const nombre = String(opcion?.nombre ?? "").trim();
  const meses = Number(opcion?.meses) || 0;
  if (!nombre) return "";
  if (!meses) return nombre;
  // «Ampliada a 24 meses» ya lo dice: no se le añade «· 24 meses».
  //
  // Con límites de palabra: «Ampliada 240.000 km» lleva un 24 dentro y no está
  // diciendo veinticuatro meses.
  const yaLoDice = new RegExp(String.raw`\b${meses}\b`).test(nombre);
  return yaLoDice ? nombre : `${nombre} · ${meses} meses`;
}

/**
 * Lo que cuesta: «+590 €», o «sin coste» cuando no coge ninguna.
 *
 * El signo va delante aunque el precio ya sea positivo, porque lo que dice no
 * es cuánto vale el producto: es cuánto le sube el total que está mirando.
 */
function importeDeGarantia(precio, formatea) {
  const d = Number(precio) || 0;
  // Menor o igual que cero, no solo cero: un precio negativo es un dato malo, y
  // pintarlo como «+−180 €» es peor que decir que no cuesta nada.
  if (d <= 0) return "sin coste";
  return `+${formatea(d)}`;
}

export { etiquetaDeGarantia, importeDeGarantia };
