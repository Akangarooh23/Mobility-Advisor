import { ETAPAS_IMPORTACION, PESTANAS, grupoDeImportacion } from "./gruposSolicitudes";

/**
 * Ninguna etapa de una importación puede quedarse sin pestaña.
 *
 * Las pestañas del panel se escribieron para visitas, y las etapas de una
 * importación no estaban contempladas: al pagar la fianza, la solicitud dejaba
 * de caer en ningún grupo y **desaparecía de la pantalla**. Justo después de
 * pagar cuatro mil euros. Pasó el 30 de agosto.
 */
test("cada etapa que existe tiene su pestaña", () => {
  const huerfanas = ETAPAS_IMPORTACION.filter((e) => grupoDeImportacion(e) === null);
  expect(huerfanas).toEqual([]);
});

/**
 * Y la pestaña tiene que existir de verdad.
 *
 * Tener grupo no basta: devolver "contratada" en singular, o cualquier nombre
 * que no sea una de las cinco, deja la solicitud fuera de todas las listas y
 * desaparece igual que si no tuviera ninguno. Es el mismo fallo con otra cara.
 */
test("y el grupo es una pestaña que existe", () => {
  const inventadas = ETAPAS_IMPORTACION
    .map((e) => grupoDeImportacion(e))
    .filter((g) => !PESTANAS.includes(g));
  expect(inventadas).toEqual([]);
});

test("antes de pagar, está pendiente de que le llamen", () => {
  expect(grupoDeImportacion("Pendiente")).toBe("pendiente");
  expect(grupoDeImportacion("Contactado")).toBe("pendiente");
});

test("desde que paga hasta que lo tiene, está en curso", () => {
  expect(grupoDeImportacion("Depósito retenido")).toBe("en_curso");
  expect(grupoDeImportacion("Verificado y pagado")).toBe("en_curso");
  expect(grupoDeImportacion("En transporte")).toBe("en_curso");
  expect(grupoDeImportacion("En trámites")).toBe("en_curso");
});

/**
 * Entregado no es «se acabó», es «ya es tuyo».
 *
 * Estuvo en finalizadas, junto a las visitas que ya pasaron. Una importación
 * entregada está pagada, facturada y en manos del cliente: pertenece a la
 * pestaña de lo comprado, que es lo que esa pestaña dice recoger.
 */
test("entregado es un coche comprado, no una visita cerrada", () => {
  expect(grupoDeImportacion("Entregado")).toBe("contratadas");
  expect(grupoDeImportacion("Entregado")).not.toBe("finalizadas");
});

test("un estado que no es de importación no se toca aquí", () => {
  expect(grupoDeImportacion("Cita confirmada")).toBeNull();
  expect(grupoDeImportacion("Cancelado")).toBeNull();
});
