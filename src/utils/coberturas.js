import { laDeLaLista, comoSeAbre as abrirDeLista } from "./listaCerrada";

/**
 * Los tipos de cobertura de un seguro de coche.
 *
 * ## Por qué cada una lleva su explicación
 *
 * «Terceros ampliado» no dice nada a quien no ha contratado seguros nunca, y el
 * que no lo entiende elige a ojo o deja el campo en blanco. Con la frase al lado
 * —«terceros + robo, incendio, lunas»— se elige sabiendo qué se elige, y lo que
 * queda guardado vale para algo.
 *
 * La explicación se enseña debajo del desplegable, solo la de la elegida:
 * ponerlas todas en la lista haría un menú de diecinueve párrafos.
 *
 * ## Por qué las franquicias son opciones distintas
 *
 * «Todo riesgo» a secas y «todo riesgo con 300 € de franquicia» son dos seguros
 * que se comportan distinto el día del parte, y la diferencia es justo la cifra.
 * Guardar solo «todo riesgo» pierde el único dato que importa cuando hay que
 * decidir si se declara un golpe o se paga aparte.
 */
export const COBERTURAS = [
  { valor: "Terceros básico", explica: "Responsabilidad civil y daños a terceros." },
  { valor: "Terceros ampliado", explica: "Terceros más robo, incendio, lunas y similares." },
  { valor: "Todo riesgo con franquicia 150 €", explica: "Daños propios, con franquicia de 150 €." },
  { valor: "Todo riesgo con franquicia 200 €", explica: "Daños propios, con franquicia de 200 €." },
  { valor: "Todo riesgo con franquicia 300 €", explica: "Daños propios, con franquicia de 300 €." },
  { valor: "Todo riesgo con franquicia 400 €", explica: "Daños propios, con franquicia de 400 €." },
  { valor: "Todo riesgo con franquicia 500 €", explica: "Daños propios, con franquicia de 500 €." },
  { valor: "Todo riesgo con franquicia 600 €", explica: "Daños propios, con franquicia de 600 €." },
  { valor: "Todo riesgo con franquicia 1.000 €", explica: "Daños propios, con franquicia de 1.000 €." },
  { valor: "Todo riesgo sin franquicia", explica: "Daños propios sin franquicia." },
  { valor: "Terceros + lunas", explica: "Terceros más rotura de lunas." },
  { valor: "Terceros + robo e incendio", explica: "Terceros más robo e incendio." },
  { valor: "Seguro por días", explica: "Cobertura durante un periodo muy corto." },
  { valor: "Seguro temporal", explica: "Cobertura durante un periodo determinado." },
  { valor: "Seguro para coches clásicos", explica: "Para vehículos clásicos o históricos." },
  { valor: "Seguro para vehículos de colección", explica: "Para vehículos de especial valor o colección." },
  { valor: "Seguro para vehículos eléctricos", explica: "Coberturas específicas para eléctricos." },
  { valor: "Seguro por uso / pago por uso", explica: "El precio puede depender del uso o el kilometraje." },
  { valor: "Seguro telemático", explica: "El precio puede depender del comportamiento de conducción." },
];

/** Solo los nombres, que es lo que se guarda. */
export const NOMBRES_DE_COBERTURA = COBERTURAS.map((c) => c.valor);

/** La de la lista que se llama así, o cadena vacía. */
export function laCobertura(texto) {
  return laDeLaLista(NOMBRES_DE_COBERTURA, texto);
}

/** Cómo se abre el desplegable para una cobertura ya guardada. */
export function comoSeAbre(guardado) {
  return abrirDeLista(NOMBRES_DE_COBERTURA, guardado);
}

/** La explicación de una cobertura, o cadena vacía si no es de la lista. */
export function loQueCubre(texto) {
  const nombre = laCobertura(texto);
  if (!nombre) return "";
  return COBERTURAS.find((c) => c.valor === nombre)?.explica ?? "";
}
