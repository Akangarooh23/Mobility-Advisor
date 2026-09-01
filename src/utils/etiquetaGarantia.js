/**
 * Cómo se escribe una garantía en la ficha del coche.
 *
 * Dos cosas que parecen tonterías y no lo son.
 *
 * **No repetir los meses.** El nombre del producto ya suele llevarlos
 * —«Ampliada a 24 meses»— y añadirle «· 24 meses» detrás queda como un
 * tartamudeo. Se añade solo cuando el nombre no lo dice.
 *
 * **Decir lo que le cambia el total, no lo que vale.** El precio publicado ya
 * lleva una garantía dentro: la más barata que se le pueda dar a ese coche. Así
 * que lo que necesita saber al mirar las otras no es cuánto cuestan, sino cuánto
 * le mueven el número que tiene delante. Quitarla lo **baja**, y eso hay que
 * poder leerlo: un coche que se anuncia sin garantía y luego ofrece una por
 * 190 € parece que sube de precio al final. Es el mismo dinero.
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
 * Lo que le mueve al total: «+300 €», «−190 €» o «va en el precio».
 *
 * Recibe la **diferencia**, no el precio. La que ya está puesta sale a cero y se
 * dice con palabras y no con «+0 €», que no significa nada.
 *
 * El menos es un signo menos de verdad (−, U+2212) y no un guion: al lado de una
 * cifra, un guion se lee como un separador.
 */
function importeDeGarantia(diferencia, formatea) {
  const d = Number(diferencia) || 0;
  if (d === 0) return "va en el precio";
  if (d < 0) return `−${formatea(-d)}`;
  return `+${formatea(d)}`;
}

export { etiquetaDeGarantia, importeDeGarantia };
