import { ETAPAS_IMPORTACION, grupoDeImportacion } from "./gruposSolicitudes";

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

test("antes de pagar, está pendiente de que le llamen", () => {
  expect(grupoDeImportacion("Pendiente")).toBe("pendiente");
  expect(grupoDeImportacion("Contactado")).toBe("pendiente");
});

test("desde que paga hasta que lo tiene, está en curso", () => {
  expect(grupoDeImportacion("Fianza pagada")).toBe("en_curso");
  expect(grupoDeImportacion("Pedido a Alemania")).toBe("en_curso");
  expect(grupoDeImportacion("En transporte")).toBe("en_curso");
  expect(grupoDeImportacion("En trámites")).toBe("en_curso");
});

test("entregado se acabó", () => {
  expect(grupoDeImportacion("Entregado")).toBe("finalizadas");
});

test("un estado que no es de importación no se toca aquí", () => {
  expect(grupoDeImportacion("Cita confirmada")).toBeNull();
  expect(grupoDeImportacion("Cancelado")).toBeNull();
});
