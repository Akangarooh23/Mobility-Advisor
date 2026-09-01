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

  test("no coger ninguna no cuesta nada", () => {
    // Y se dice así, no con un «0 €»: cero euros al lado de una lista de
    // precios se lee como un producto gratis, y esto es no coger producto.
    expect(importeDeGarantia(0, eur)).toBe("sin coste");
  });

  test("y la que elija, lo que sube el total", () => {
    // Con el signo delante aunque el precio sea positivo: no dice cuánto vale
    // el producto, dice cuánto le sube el número que está mirando.
    expect(importeDeGarantia(590, eur)).toBe("+590 €");
  });

  test("un precio negativo no se pinta: es un dato malo", () => {
    // Antes se podía «quitar» la garantía incluida y el total bajaba, así que
    // había diferencias negativas. Ahora se empieza sin ninguna y un número por
    // debajo de cero no significa nada: «+−180 €» sería peor que no decir nada.
    expect(importeDeGarantia(-180, eur)).toBe("sin coste");
  });
});
