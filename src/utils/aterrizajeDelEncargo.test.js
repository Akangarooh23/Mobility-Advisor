import { loQueLaUrlPide, elCocheDeLaUrl, elAnclaDe, comoSeCompara, SECCIONES } from "./aterrizajeDelEncargo";

/**
 * Aterrizar donde pedía el enlace del encargo.
 *
 * Lo que se protege: que «Subir los documentos» abra **su** coche y baje a la
 * parte que toca. Si abre la lista y ya, quien tiene tres coches tiene que
 * adivinar cuál — y el enlace parece que funciona, que es lo peor.
 */
describe("qué pide la dirección", () => {
  test("saca la matrícula y la sección", () => {
    expect(loQueLaUrlPide("?matricula=8888LXR", "#documentos"))
      .toEqual({ matricula: "8888LXR", seccion: "documentos" });
  });

  test("la matrícula se normaliza, venga como venga", () => {
    // En la dirección va como la escribió él; en la base, como la guardó el
    // sistema. No tienen por qué estar escritas igual.
    expect(loQueLaUrlPide("?matricula=8888%20lxr", "").matricula).toBe("8888LXR");
    expect(loQueLaUrlPide("?matricula=8888-LXR", "").matricula).toBe("8888LXR");
  });

  test("una sección que no conocemos se descarta", () => {
    /*
     * Bajar a un sitio que no existe deja la pantalla en un punto cualquiera y
     * parece un fallo. Mejor abrir el coche y quedarse arriba.
     */
    expect(loQueLaUrlPide("?matricula=8888LXR", "#loquesea").seccion).toBe("");
  });

  test("sin nada en la dirección devuelve las dos claves vacías", () => {
    // Nunca null: un null obliga a comprobarlo en cada uso, y el día que se
    // olvide una comprobación se cae el panel, que es lo que más se abre.
    expect(loQueLaUrlPide("", "")).toEqual({ matricula: "", seccion: "" });
    expect(loQueLaUrlPide(undefined, undefined)).toEqual({ matricula: "", seccion: "" });
  });

  test("una dirección rota no rompe la pantalla", () => {
    expect(() => loQueLaUrlPide("%%%", "#datos")).not.toThrow();
  });
});

describe("cuál de sus coches es", () => {
  const COCHES = [
    { id: "v1", plate: "1234ABC" },
    { id: "v2", plate: "8888 LXR" },
  ];

  test("lo encuentra aunque esté escrita distinto", () => {
    expect(elCocheDeLaUrl(COCHES, "8888lxr")?.id).toBe("v2");
  });

  test("y si no es de ninguno, no inventa uno", () => {
    // Devolver el primero abriría el coche equivocado, que es peor que no abrir
    // ninguno: se pondrían las fotos en otro sitio.
    expect(elCocheDeLaUrl(COCHES, "0000ZZZ")).toBeNull();
  });

  test("sin matrícula tampoco", () => {
    expect(elCocheDeLaUrl(COCHES, "")).toBeNull();
  });
});

describe("el ancla", () => {
  test("cada sección tiene la suya y son distintas", () => {
    const anclas = SECCIONES.map(elAnclaDe);
    expect(new Set(anclas).size).toBe(SECCIONES.length);
    expect(anclas.every((a) => a.startsWith("encargo-"))).toBe(true);
  });

  test("y una sección que no existe no tiene ancla", () => {
    expect(elAnclaDe("loquesea")).toBe("");
  });
});

describe("comoSeCompara", () => {
  test("quita todo lo que no sea letra o número", () => {
    expect(comoSeCompara(" 8888-lxr ")).toBe("8888LXR");
    expect(comoSeCompara(null)).toBe("");
  });
});
