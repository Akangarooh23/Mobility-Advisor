/**
 * Los tipos de cobertura.
 *
 * Lo mismo que con las aseguradoras: que no se pierda lo que ya estaba escrito,
 * que quien tenga algo raro pueda decirlo, y que la misma cobertura escrita de
 * dos maneras se reconozca como una.
 *
 * Y una cosa más que aquí importa: **cada una tiene que explicarse**. «Terceros
 * ampliado» no dice nada a quien no ha contratado un seguro nunca, y sin la
 * frase al lado se elige a ojo — que es peor que no preguntarlo.
 */
import { COBERTURAS, NOMBRES_DE_COBERTURA, laCobertura, comoSeAbre, loQueCubre } from "./coberturas";
import { OTRA, loQueSeGuarda } from "./listaCerrada";

describe("la lista", () => {
  test("están las diecinueve que pidió Ana", () => {
    expect(COBERTURAS).toHaveLength(19);
    expect(NOMBRES_DE_COBERTURA[0]).toBe("Terceros básico");
    expect(NOMBRES_DE_COBERTURA).toContain("Todo riesgo sin franquicia");
    expect(NOMBRES_DE_COBERTURA).toContain("Seguro telemático");
  });

  test("las siete franquicias, cada una con su cifra", () => {
    /*
     * «Todo riesgo» a secas y «todo riesgo con 300 €» son dos seguros que se
     * comportan distinto el día del parte, y la diferencia es justo la cifra.
     */
    for (const cuanto of ["150 €", "200 €", "300 €", "400 €", "500 €", "600 €", "1.000 €"]) {
      expect(NOMBRES_DE_COBERTURA).toContain(`Todo riesgo con franquicia ${cuanto}`);
      expect(loQueCubre(`Todo riesgo con franquicia ${cuanto}`)).toContain(cuanto);
    }
  });

  test("sin repetidas", () => {
    expect(new Set(NOMBRES_DE_COBERTURA).size).toBe(NOMBRES_DE_COBERTURA.length);
  });

  test("y ninguna se queda sin explicar", () => {
    // Una opción sin frase es una opción que se elige a ojo.
    for (const c of COBERTURAS) {
      expect(c.explica.trim().length).toBeGreaterThan(10);
      expect(c.explica.trim()).toMatch(/\.$/);
    }
  });
});

describe("reconocer una cobertura escrita a mano", () => {
  test("da igual cómo se escriba", () => {
    expect(laCobertura("TERCEROS BÁSICO")).toBe("Terceros básico");
    expect(laCobertura("terceros basico")).toBe("Terceros básico");
    expect(laCobertura("  Todo riesgo sin franquicia  ")).toBe("Todo riesgo sin franquicia");
  });

  test("lo que no está, no está", () => {
    // «Todo riesgo» a secas no es ninguna de la lista: falta decir la franquicia.
    expect(laCobertura("Todo riesgo")).toBe("");
    expect(laCobertura("")).toBe("");
  });
});

describe("abrir una ficha que ya tenía cobertura", () => {
  test("una de la lista sale seleccionada", () => {
    expect(comoSeAbre("terceros basico")).toEqual({ seleccion: "Terceros básico", escrita: "" });
  });

  test("y lo escrito antes a mano no se pierde", () => {
    /*
     * El caso de verdad: las fichas viejas dicen «Todo riesgo» o «Terceros», sin
     * más. Si salieran vacías, el primer guardado las borraría.
     */
    expect(comoSeAbre("Todo riesgo")).toEqual({ seleccion: OTRA, escrita: "Todo riesgo" });
  });
});

describe("la explicación", () => {
  test("sale la de la elegida", () => {
    expect(loQueCubre("Terceros ampliado")).toMatch(/robo, incendio, lunas/);
    expect(loQueCubre("Seguro telemático")).toMatch(/comportamiento de conducción/);
  });

  test("y de una que no es de la lista no se inventa ninguna", () => {
    // Explicar «Todo riesgo» con la frase de otra sería ponerle palabras en la
    // boca a un dato que escribió el cliente.
    expect(loQueCubre("Todo riesgo")).toBe("");
    expect(loQueCubre("")).toBe("");
  });
});

describe("lo guardado se puede volver a abrir igual", () => {
  test("ida y vuelta, sin perder nada", () => {
    for (const original of [...NOMBRES_DE_COBERTURA, "Todo riesgo", "Terceros", ""]) {
      const abierta = comoSeAbre(original);
      expect(loQueSeGuarda(abierta.seleccion, abierta.escrita)).toBe(original);
    }
  });
});
