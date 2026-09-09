/**
 * El formulario de «Nosotros lo vendemos por ti».
 *
 * Lo que se protege: que lo que el botón promete preguntar se pregunte de
 * verdad, y que lo que el cliente cuenta llegue al ERP en vez de a una bandeja
 * de correo.
 */
import { PLAZOS, elPlazo, faltaParaMandarlo, loQueSeManda } from "./encargoDeVentaWeb";

const bien = {
  coche: "Seat Ibiza 2019", plazo: "1mes",
  nombre: "Ana", telefono: "684717736", email: "ana@ejemplo.com",
};

describe("las dos preguntas que el botón prometía", () => {
  test("qué coche tiene", () => {
    // «Cuéntanos qué coche tienes» — y el formulario de antes no lo preguntaba.
    expect(faltaParaMandarlo({ ...bien, coche: "" })).toMatch(/qué coche/);
  });

  test("y en cuánto tiempo quiere venderlo", () => {
    expect(faltaParaMandarlo({ ...bien, plazo: "" })).toMatch(/cuánto tiempo/);
    expect(faltaParaMandarlo({ ...bien, plazo: "algún día" })).toMatch(/cuánto tiempo/);
  });

  test("el coche es texto libre, no tres desplegables", () => {
    /*
     * Quien está decidiendo si nos deja su coche no rellena marca, modelo y año
     * en tres desplegables. Vale la matrícula y vale «un Golf del 15».
     */
    for (const escrito of ["8888LXR", "un Golf del 15", "Seat Ibiza"]) {
      expect(faltaParaMandarlo({ ...bien, coche: escrito })).toBe("");
    }
  });
});

describe("el plazo", () => {
  test("es una lista cerrada y corta", () => {
    /*
     * Un campo libre da «lo antes posible», «depende» y «cuando salga», que no
     * se pueden ordenar ni contar. Y es la pregunta que decide la conversación:
     * al que tiene prisa se le habla de precio de salida.
     */
    expect(PLAZOS.map((p) => p.clave)).toEqual(["ya", "1mes", "3meses", "sinprisa"]);
    for (const p of PLAZOS) expect(p.etiqueta).toBeTruthy();
  });

  test("uno que no está en la lista no cuela", () => {
    expect(elPlazo("mañana")).toBeNull();
    expect(elPlazo("")).toBeNull();
    expect(elPlazo("ya").etiqueta).toBe("Cuanto antes");
  });
});

describe("los datos de contacto", () => {
  test("el teléfono se exige de verdad", () => {
    // El modelo es captación telefónica: sin teléfono este lead no vale nada.
    expect(faltaParaMandarlo({ ...bien, telefono: "" })).not.toBe("");
    expect(faltaParaMandarlo({ ...bien, telefono: "12345" })).not.toBe("");
    expect(faltaParaMandarlo({ ...bien, telefono: "+34 684 71 77 36" })).toBe("");
  });

  test("y el correo tiene que parecerlo", () => {
    for (const malo of ["", "ana", "ana@", "ana@ejemplo"]) {
      expect(faltaParaMandarlo({ ...bien, email: malo })).not.toBe("");
    }
  });

  test("con todo puesto no falta nada", () => {
    expect(faltaParaMandarlo(bien)).toBe("");
  });

  test("y sin nada tampoco revienta", () => {
    expect(faltaParaMandarlo()).not.toBe("");
    expect(faltaParaMandarlo({})).not.toBe("");
  });
});

describe("lo que llega al ERP", () => {
  const enviado = loQueSeManda(bien);

  test("entra como venta gestionada, no como «info»", () => {
    /*
     * Es lo que hace que se pueda contar y filtrar. Cayendo en «info» se
     * mezclaría con las consultas del marketplace y nadie sabría cuántos
     * encargos entran por la web.
     */
    expect(enviado.type).toBe("venta_gestionada");
  });

  test("y se sabe de dónde vino", () => {
    expect(enviado.portal).toBe("web-vender");
  });

  test("el coche llega tal cual lo escribió", () => {
    expect(enviado.vehicle_title).toBe("Seat Ibiza 2019");
  });

  test("y el plazo, en el campo de detalles y en castellano", () => {
    // `contact_when` ya es el campo libre de detalles: en renting lleva
    // «Plazo: 36m · 15.000 km/año». Se usa la misma forma para que se lea igual.
    expect(enviado.when).toBe("Quiere vender: en un mes");
  });

  test("el correo se guarda en minúsculas", () => {
    // Es la llave por la que se le busca después y por la que se le escribe.
    expect(loQueSeManda({ ...bien, email: "Ana@Ejemplo.COM" }).email).toBe("ana@ejemplo.com");
  });

  test("un plazo raro no inventa una etiqueta", () => {
    expect(loQueSeManda({ ...bien, plazo: "cuando sea" }).when).toMatch(/sin decir/);
  });
});
