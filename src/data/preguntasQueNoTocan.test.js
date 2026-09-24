/**
 * A quien no tiene coche no se le pregunta por su coche.
 *
 * ## Lo que pasaba
 *
 * Las preguntas activas se filtraban por dos cosas: si el test iba en modo
 * avanzado y si venías de la puerta de comprar o de la de renting. **Ninguna
 * respuesta del cliente cambiaba la lista.**
 *
 * Así que a quien acababa de contestar «No tengo vehículo actualmente» se le
 * preguntaba a continuación de qué año es el coche que entrega, cuántos
 * kilómetros tiene y si le queda financiación pendiente. Y a quien había dicho
 * que paga al contado, qué plazo de financiación prefiere.
 *
 * Se notaba en que las dos preguntas de financiación llevan «No quiero
 * financiar» como primera opción: la pregunta traía dentro la prueba de que se
 * estaba haciendo a quien no tocaba.
 *
 * ## Por qué se comprueba aquí
 *
 * Porque es de las cosas que dan mala espina al cliente sin que él sepa decir
 * por qué: acaba de decirte que no tiene coche y le preguntas tres veces por
 * él. No rompe nada, no sale en ningún registro, y deja la sensación de que el
 * test no le está escuchando.
 */
import { STEPS, ADVANCED_STEPS, seLePregunta } from "./questionnaireSteps";

const TODAS = [...STEPS, ...ADVANCED_STEPS];
const paso = (id) => TODAS.find((s) => s.id === id);
const cuales = (respuestas) => TODAS.filter((s) => seLePregunta(s, respuestas)).map((s) => s.id);

describe("las preguntas del coche que entrega", () => {
  const delCoche = ["vehiculo_actual_antiguedad", "vehiculo_actual_km", "vehiculo_actual_deuda"];

  test("existen y dependen de tener uno", () => {
    // Si no existieran, todo lo de abajo pasaria sin comprobar nada.
    for (const id of delCoche) {
      expect(paso(id)).toBeTruthy();
      expect(paso(id).soloSi).toEqual({ vehiculo_actual: ["si_entrego", "si_vendo"] });
    }
  });

  test("no se le hacen a quien ha dicho que no tiene coche", () => {
    const salen = cuales({ vehiculo_actual: "no" });
    for (const id of delCoche) expect(salen).not.toContain(id);
  });

  test("y sí a quien lo entrega o lo vende", () => {
    for (const respuesta of ["si_entrego", "si_vendo"]) {
      const salen = cuales({ vehiculo_actual: respuesta });
      for (const id of delCoche) expect(salen).toContain(id);
    }
  });

  test("mientras no conteste, la pregunta sigue ahí esperándole", () => {
    /*
     * Esconderla antes de tiempo seria adivinar: quien aun no ha dicho si
     * entrega coche puede acabar diciendo que si.
     */
    const salen = cuales({});
    for (const id of delCoche) expect(salen).toContain(id);
  });
});

describe("las preguntas de financiacion", () => {
  const deFinanciar = ["financiacion_plazo", "financiacion_gestion"];

  test("no se le hacen a quien paga al contado", () => {
    const salen = cuales({ flexibilidad: "propiedad_contado" });
    for (const id of deFinanciar) expect(salen).not.toContain(id);
  });

  test("ni a quien va a renting", () => {
    const salen = cuales({ flexibilidad: "renting" });
    for (const id of deFinanciar) expect(salen).not.toContain(id);
  });

  test("sí a quien financia o da entrada", () => {
    for (const respuesta of ["propiedad_financiada", "propiedad_entrada_inicial"]) {
      const salen = cuales({ flexibilidad: respuesta });
      for (const id of deFinanciar) expect(salen).toContain(id);
    }
  });

  test("y a quien no lo tiene claro, porque puede acabar financiando", () => {
    const salen = cuales({ flexibilidad: "no_tengo_claro" });
    for (const id of deFinanciar) expect(salen).toContain(id);
  });
});

describe("el resto del test no se toca", () => {
  test("una respuesta no puede hacer desaparecer las preguntas de siempre", () => {
    const sinNada = cuales({});
    const conTodo = cuales({ vehiculo_actual: "no", flexibilidad: "propiedad_contado" });
    const desaparecidas = sinNada.filter((id) => !conTodo.includes(id));

    expect(desaparecidas.sort()).toEqual([
      // La cuota mensual tambien: a quien paga al contado no le dice nada, y
      // el precio total ya se le ha preguntado antes.
      "cuota_mensual",
      "financiacion_gestion",
      "financiacion_plazo",
      "vehiculo_actual_antiguedad",
      "vehiculo_actual_deuda",
      "vehiculo_actual_km",
    ]);
  });
});

/**
 * La del coche importado no se le pregunta a quien compra a un particular.
 *
 * Medido sobre el pool: de 6.461 anuncios importados, los 6.461 los vende un
 * profesional. Ni uno solo es de particular. Así que a quien ya ha dicho que
 * se lo quiere comprar a un particular, esta pregunta no le puede cambiar
 * nada — y preguntar algo cuya respuesta no cambia nada solo alarga el test.
 */
describe("el importado solo a quien puede encontrarse uno", () => {
  const laDelImportado = STEPS.find((p) => p.id === "coche_importado");

  test("existe y es una pregunta aparte", () => {
    expect(laDelImportado).toBeTruthy();
    expect(laDelImportado.type).toBe("cards");
  });

  test("a quien compra a un particular no se le pregunta", () => {
    expect(seLePregunta(laDelImportado, { quien_vende: "particular" })).toBe(false);
  });

  test("pero al que va a profesional, o le da igual, sí", () => {
    expect(seLePregunta(laDelImportado, { quien_vende: "profesional" })).toBe(true);
    expect(seLePregunta(laDelImportado, { quien_vende: "indiferente_vendedor" })).toBe(true);
  });

  test("y antes de contestar a la del vendedor, sigue estando", () => {
    /*
     * Esconderla antes seria adivinar: quien aun no ha dicho a quien se lo
     * compra puede acabar diciendo «profesional».
     */
    expect(seLePregunta(laDelImportado, {})).toBe(true);
  });

  test("y la del vendedor se pregunta antes que ella", () => {
    const vendedor = STEPS.findIndex((p) => p.id === "quien_vende");
    const importado = STEPS.findIndex((p) => p.id === "coche_importado");

    expect(vendedor).toBeGreaterThan(-1);
    expect(vendedor).toBeLessThan(importado);
  });
});
