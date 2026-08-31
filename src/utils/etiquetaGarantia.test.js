import { etiquetaDeGarantia, importeDeGarantia } from "./etiquetaGarantia";

/**
 * Cómo se escribe la garantía en la ficha.
 *
 * Lo que se vigila: que no se repitan los meses y que lo que se enseña al lado
 * del total sea **lo que cambia**, no el precio entero del producto.
 */
describe("el nombre de una garantía", () => {
  test("no repite los meses si el nombre ya los lleva", () => {
    expect(etiquetaDeGarantia({ nombre: "Ampliada a 24 meses", meses: 24 }))
      .toBe("Ampliada a 24 meses");
  });

  test("y los añade si no", () => {
    expect(etiquetaDeGarantia({ nombre: "Garantía incluida", meses: 12 }))
      .toBe("Garantía incluida · 12 meses");
  });

  test("sin meses, solo el nombre", () => {
    expect(etiquetaDeGarantia({ nombre: "Sin garantía", meses: null })).toBe("Sin garantía");
  });

  test("un 24 metido dentro de otro número no cuenta como el plazo", () => {
    // «Ampliada 240.000 km» lleva un 24, y no dice veinticuatro meses.
    expect(etiquetaDeGarantia({ nombre: "Ampliada 240.000 km", meses: 24 }))
      .toBe("Ampliada 240.000 km · 24 meses");
  });

  test("sin nombre no se inventa nada", () => {
    expect(etiquetaDeGarantia(null)).toBe("");
    expect(etiquetaDeGarantia({ nombre: "  ", meses: 12 })).toBe("");
  });
});

describe("lo que suma al total", () => {
  const eur = (n) => `${n} €`;

  test("la que ya está dentro del precio dice «incluida»", () => {
    expect(importeDeGarantia(0, eur)).toBe("incluida");
  });

  test("una ampliación, lo que sube", () => {
    // No 420 €, que es lo que cuesta: 290 €, que es lo que cambia el total.
    expect(importeDeGarantia(290, eur)).toBe("+290 €");
  });

  test("y quitarla, lo que baja, con el menos de verdad", () => {
    expect(importeDeGarantia(-180, eur)).toBe("−180 €");
  });
});
