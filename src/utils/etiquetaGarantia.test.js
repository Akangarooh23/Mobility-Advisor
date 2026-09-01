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

describe("lo que le mueve al total", () => {
  const eur = (n) => `${n} €`;

  test("la que ya lleva el precio no lo mueve, y se dice con palabras", () => {
    // No con un «+0 €», que no significa nada, ni con «sin coste», que diría
    // que es gratis. Cuesta 190 €: lo que pasa es que ya están contados.
    expect(importeDeGarantia(0, eur)).toBe("va en el precio");
  });

  test("una más cara, lo que le sube", () => {
    // Con el signo delante: no dice cuánto vale el producto, dice cuánto le
    // mueve el número que está mirando.
    expect(importeDeGarantia(300, eur)).toBe("+300 €");
  });

  test("y quitarla lo baja, en negativo", () => {
    // Esto es lo que hace que el modelo se lea bien. Anunciar sin garantía y
    // ofrecerla después es el mismo dinero, pero se lee como una subida al
    // final; anunciarla puesta y poder quitarla se lee como una rebaja.
    //
    // Con un signo menos de verdad (−, U+2212): un guion al lado de una cifra
    // se lee como un separador.
    expect(importeDeGarantia(-190, eur)).toBe("−190 €");
  });

  test("lo que no es un número no mueve nada", () => {
    expect(importeDeGarantia(undefined, eur)).toBe("va en el precio");
    expect(importeDeGarantia("hola", eur)).toBe("va en el precio");
  });
});
