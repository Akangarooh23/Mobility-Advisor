/**
 * La dirección que salía escrita dos veces.
 *
 * En la ficha se leía «tu casa, "Calle Mauricio Legendre 45 G2B, 28046 Calle
 * Mauricio Legendre 45 G2B, 28046, MADRID, (MADRID)"», y así viajaba a la
 * solicitud y al documento de entrega.
 *
 * Venía de rellenar el campo de ciudad con `billingAddress`, que no es la ciudad
 * sino la dirección entera en una línea. Eso ya está arreglado donde se leía,
 * pero lo que se guardó sigue en el navegador de cada uno: arreglar el código no
 * limpia lo que ya está escrito ahí.
 */
import { ciudadDeVerdad } from "./ciudadDeVerdad";

describe("una ciudad que no es una ciudad", () => {
  test("la que lleva la calle dentro se tira", () => {
    expect(
      ciudadDeVerdad(
        "Calle Mauricio Legendre 45 G2B, 28046, MADRID",
        "Calle Mauricio Legendre 45 G2B",
        "28046"
      )
    ).toBe("");
  });

  test("y la que lleva el código postal, también", () => {
    // Aunque la calle no coincida: un número de cinco cifras dentro de un nombre
    // de ciudad no es un nombre de ciudad.
    expect(ciudadDeVerdad("28046 Madrid", "Otra calle", "28046")).toBe("");
  });

  test("una ciudad de verdad se queda como está", () => {
    expect(ciudadDeVerdad("Madrid", "Calle Mauricio Legendre 45 G2B", "28046")).toBe("Madrid");
    expect(ciudadDeVerdad("San Sebastián de los Reyes", "Avenida de España 1", "28700"))
      .toBe("San Sebastián de los Reyes");
  });

  test("sin calle ni código postal con los que comparar, se respeta", () => {
    // Es el caso de quien la escribió a mano y todavía no ha puesto lo demás.
    expect(ciudadDeVerdad("Bilbao", "", "")).toBe("Bilbao");
  });

  test("los espacios de más no cuentan como ciudad", () => {
    expect(ciudadDeVerdad("   ", "Calle X", "28046")).toBe("");
    expect(ciudadDeVerdad(null, "Calle X", "28046")).toBe("");
    expect(ciudadDeVerdad(undefined, "", "")).toBe("");
  });

  test("y las mayúsculas no salvan a una dirección de serlo", () => {
    expect(ciudadDeVerdad("CALLE MAURICIO LEGENDRE 45 G2B, MADRID", "Calle Mauricio Legendre 45 G2B", ""))
      .toBe("");
  });
});
