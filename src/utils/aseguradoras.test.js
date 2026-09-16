/**
 * La lista de aseguradoras.
 *
 * Lo que se protege, por orden de importancia:
 *
 * 1. Que **no se pierda** lo que ya estaba escrito. El campo era libre, así que
 *    hay fichas con compañías que no están en la lista; si al abrirlas el
 *    desplegable saliera vacío, el primer guardado las borraría sin que nadie
 *    las tocara.
 * 2. Que quien tenga una compañía de fuera pueda decirlo, en vez de dejar el
 *    campo vacío — que se parece demasiado a «no tiene seguro».
 * 3. Que la misma compañía escrita de dos maneras se reconozca como una.
 */
import { ASEGURADORAS, OTRA, laDeLaLista, comoSeAbre, loQueSeGuarda } from "./aseguradoras";

describe("la lista", () => {
  test("están las que pidió Ana, en su orden", () => {
    expect(ASEGURADORAS).toHaveLength(25);
    expect(ASEGURADORAS[0]).toBe("MAPFRE");
    expect(ASEGURADORAS[ASEGURADORAS.length - 1]).toBe("AMV");
    expect(ASEGURADORAS).toContain("Línea Directa");
    expect(ASEGURADORAS).toContain("Penélope Seguros");
  });

  test("sin repetidas", () => {
    // Dos entradas iguales dan dos opciones idénticas en el desplegable.
    expect(new Set(ASEGURADORAS).size).toBe(ASEGURADORAS.length);
  });

  test("y «Otra» no es el nombre de nadie", () => {
    // Si coincidiera con una compañía real, elegirla se guardaría como el
    // centinela y la ficha diría que está asegurada en «__otra__».
    expect(ASEGURADORAS).not.toContain(OTRA);
  });
});

describe("reconocer una compañía escrita a mano", () => {
  test("da igual cómo se escriba", () => {
    for (const escrita of ["MAPFRE", "Mapfre", "mapfre", "  mapfre  "]) {
      expect(laDeLaLista(escrita)).toBe("MAPFRE");
    }
  });

  test("y sin acentos también", () => {
    // Lo guardado viene de un campo libre: casi nadie escribió la tilde.
    expect(laDeLaLista("linea directa")).toBe("Línea Directa");
    expect(laDeLaLista("GENESIS")).toBe("Génesis");
  });

  test("lo que no está, no está", () => {
    expect(laDeLaLista("Seguros del Pueblo")).toBe("");
    expect(laDeLaLista("")).toBe("");
    expect(laDeLaLista(null)).toBe("");
  });
});

describe("abrir una ficha que ya tenía compañía", () => {
  test("una de la lista sale seleccionada", () => {
    expect(comoSeAbre("mapfre")).toEqual({ seleccion: "MAPFRE", escrita: "" });
  });

  test("una de fuera sale como «Otra», con su texto", () => {
    /*
     * Este es el caso que importa: sin esto el desplegable saldría vacío y el
     * primer guardado borraría el dato.
     */
    expect(comoSeAbre("Seguros del Pueblo")).toEqual({
      seleccion: OTRA,
      escrita: "Seguros del Pueblo",
    });
  });

  test("y sin nada, no se inventa ninguna", () => {
    expect(comoSeAbre("")).toEqual({ seleccion: "", escrita: "" });
    expect(comoSeAbre(null)).toEqual({ seleccion: "", escrita: "" });
  });
});

describe("lo que se guarda", () => {
  test("una de la lista, tal cual", () => {
    expect(loQueSeGuarda("MAPFRE", "")).toBe("MAPFRE");
  });

  test("con «Otra», lo escrito y nunca el centinela", () => {
    expect(loQueSeGuarda(OTRA, "Seguros del Pueblo")).toBe("Seguros del Pueblo");
    expect(loQueSeGuarda(OTRA, "")).toBe("");
    expect(loQueSeGuarda(OTRA, "  Mutua de Propietarios  ")).toBe("Mutua de Propietarios");
  });

  test("y sin elegir nada, vacío", () => {
    expect(loQueSeGuarda("", "")).toBe("");
  });
});

describe("lo guardado se puede volver a abrir igual", () => {
  test("ida y vuelta, sin perder nada", () => {
    /*
     * El guardián: guardar y volver a abrir tiene que dar lo mismo. Si no, cada
     * visita a la ficha degrada el dato un poco más.
     */
    for (const original of [...ASEGURADORAS, "Seguros del Pueblo", "Liberty", ""]) {
      const abierta = comoSeAbre(original);
      expect(loQueSeGuarda(abierta.seleccion, abierta.escrita)).toBe(original);
    }
  });
});
