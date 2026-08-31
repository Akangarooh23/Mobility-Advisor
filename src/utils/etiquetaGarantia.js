/**
 * Cómo se escribe una garantía en la ficha del coche.
 *
 * Dos cosas que parecen tonterías y no lo son.
 *
 * **No repetir los meses.** El nombre del producto ya suele llevarlos
 * —«Ampliada a 24 meses»— y añadirle «· 24 meses» detrás queda como un
 * tartamudeo. Se añade solo cuando el nombre no lo dice.
 *
 * **Decir lo que cambia, no lo que cuesta.** En el desglose la garantía no se
 * escribe con su precio entero sino con lo que le suma al total: «incluida» si
 * no suma nada, «+290 €» si es una ampliación. Poner 420 € al lado de un total
 * que solo ha subido 290 obliga al cliente a hacer una resta para entenderlo.
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

/** Lo que le suma al total: «incluida», «+290 €» o «−180 €». */
function importeDeGarantia(diferencia, formatea) {
  const d = Number(diferencia) || 0;
  if (d === 0) return "incluida";
  const signo = d > 0 ? "+" : "−";
  return `${signo}${formatea(Math.abs(d))}`;
}

export { etiquetaDeGarantia, importeDeGarantia };
