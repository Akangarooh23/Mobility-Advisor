/**
 * El precio de la tasacion, del lado del navegador.
 *
 * Es el gemelo de `lib/tasacion.js`. No es un descuido: create-react-app monta
 * un ModuleScopePlugin que prohibe importar nada de fuera de `src/`, asi que
 * esta pantalla no puede leer el fichero del servidor por mucho que sea el
 * mismo dato. Lo mismo que pasa con la marca.
 *
 * Antes esta tabla estaba escrita tres veces en SellReportMarketPage.js, en
 * euros enteros, y una cuarta en el checkout del servidor. Cuando el precio bajo
 * a 1,99 se cambio la del servidor y las del navegador siguieron diciendo 10:
 * la pantalla ensenaba «3 vehiculos · 9 €/unidad · Total 27 €» y el cobro real
 * eran otros numeros. Un descuadre asi no da error, solo miente.
 *
 * Que los dos ficheros digan lo mismo lo vigila `npm run test:marca`.
 */

/** Precio por unidad en centimos, segun cuantos coches se tasan. */
export const TRAMOS = [
  { hasta: 1, centimos: 199 },
  { hasta: 4, centimos: 179 },
  { hasta: 9, centimos: 159 },
  { hasta: 19, centimos: 139 },
  { hasta: 49, centimos: 119 },
  { hasta: 99, centimos: 99 },
];

/** El precio por unidad de una flota de `cuantos`, en centimos, o null. */
export function precioPorUnidad(cuantos) {
  const tramo = TRAMOS.find((t) => cuantos <= t.hasta);
  return tramo ? tramo.centimos : null;
}

/** Los mismos centimos, en euros, para pintarlos. */
export function enEuros(centimos) {
  if (centimos == null) return null;
  return (centimos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Lo que se cobra por tasar `cuantos` coches, contando la gratuita.
 *
 * El tramo se calcula sobre el total y no sobre los que se pagan: quien trae
 * cinco entra en el tramo de cinco aunque pague cuatro. Tiene que decidir lo
 * mismo que `importe()` en el servidor, o la pantalla ensena un total y la
 * pasarela cobra otro.
 */
export function importe({ cuantos, conGratuita }) {
  const unidad = precioPorUnidad(cuantos);
  if (unidad === null) return null;
  const gratis = conGratuita ? Math.min(1, cuantos) : 0;
  const aCobrar = cuantos - gratis;
  return { unidadCentimos: unidad, gratis, aCobrar, totalCentimos: unidad * aCobrar };
}
