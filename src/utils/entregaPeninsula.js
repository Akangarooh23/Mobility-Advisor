/**
 * Si a esa provincia el coche llega por carretera o hay que meterlo en un barco.
 *
 * Se usa en la ficha del coche para avisar **antes** de que pague la fianza, no
 * después. Alguien en Palma tiene que saber que puede haber un recargo mientras
 * está mirando el precio, no cuando ya ha puesto el 30 %.
 *
 * La lista está también en el servidor, que es quien manda: aquí solo sirve para
 * enseñar el aviso sin tener que preguntar. Una prueba comprueba que las dos
 * digan lo mismo, porque separarse significaría avisar de un recargo que no se
 * aplica, o cobrarlo sin haber avisado.
 */

export const FUERA_DE_PENINSULA = [
  "baleares", "illes balears", "islas baleares",
  "las palmas", "santa cruz de tenerife", "canarias",
  "ceuta", "melilla",
];

function sinAcentos(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Si esa provincia lleva recargo por no estar en la península. */
export function llevaRecargo(provincia) {
  const p = sinAcentos(provincia);
  if (!p) return false;
  return FUERA_DE_PENINSULA.some((x) => p.includes(x));
}
