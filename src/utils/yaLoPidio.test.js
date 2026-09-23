/**
 * Que la página se acuerde de lo que ya pidió.
 *
 * El caso que hay que impedir es el de Juan: vuelve a «Nosotros lo vendemos por
 * ti», la encuentra vacía como la primera vez y lo pide otra vez porque desde
 * donde él está no ha pasado nada.
 */
import {
  laDeEsteCoche, laMasRecienteViva, sigueViva, cuandoLaPidio, porDondeVa,
  YA_NO_ESPERA, TIPO_VENTA,
} from "./yaLoPidio";

const fs = require("fs");
const path = require("path");

/** Una solicitud como la que manda el panel. */
const suya = (extra = {}) => ({
  id: "lead-1",
  vehicle_id: "veh-1",
  type: TIPO_VENTA,
  title: "Lancia Ypsilon 2005 · 0296DYJ",
  meta: JSON.stringify({ matricula_encargo: "0296DYJ" }),
  status: "Pendiente",
  createdAt: "2026-09-22T20:40:06.676Z",
  ...extra,
});

describe("la solicitud de este coche", () => {
  test("se encuentra por el coche que eligió de su garaje", () => {
    expect(laDeEsteCoche([suya()], { vehicleId: "veh-1" })).toBeTruthy();
  });

  test("y por la matrícula que escribió a mano, con espacios o sin ellos", () => {
    expect(laDeEsteCoche([suya()], { matricula: "0296DYJ" })).toBeTruthy();
    expect(laDeEsteCoche([suya()], { matricula: "0296 dyj" })).toBeTruthy();
  });

  test("aunque solo venga dentro del título", () => {
    const sinMeta = suya({ meta: "{}" });
    expect(laDeEsteCoche([sinMeta], { matricula: "0296DYJ" })).toBeTruthy();
  });

  test("pero no la de otro coche suyo", () => {
    expect(laDeEsteCoche([suya()], { vehicleId: "veh-2" })).toBeNull();
    expect(laDeEsteCoche([suya()], { matricula: "1234ABC" })).toBeNull();
  });

  test("ni nada mientras no se sepa de qué coche habla", () => {
    expect(laDeEsteCoche([suya()], {})).toBeNull();
  });

  test("ni una que ya se atendió y se cerró", () => {
    /*
     * Volver a escribir cuando lo suyo ya se cerró es una solicitud de verdad:
     * el formulario tiene que dejarle.
     */
    for (const estado of YA_NO_ESPERA) {
      expect(laDeEsteCoche([suya({ status: estado })], { vehicleId: "veh-1" })).toBeNull();
    }
  });

  test("ni una que no es de vender su coche", () => {
    expect(laDeEsteCoche([suya({ type: "info" })], { vehicleId: "veh-1" })).toBeNull();
  });

  test("y con un meta roto no revienta", () => {
    expect(laDeEsteCoche([suya({ meta: "{ esto no es json" })], { vehicleId: "veh-1" })).toBeTruthy();
    expect(laDeEsteCoche(null, { vehicleId: "veh-1" })).toBeNull();
  });
});

describe("la más reciente que sigue viva", () => {
  test("es la última que pidió", () => {
    const vieja = suya({ id: "lead-vieja", createdAt: "2026-09-01T10:00:00.000Z" });
    const nueva = suya({ id: "lead-nueva", createdAt: "2026-09-22T20:40:06.676Z" });
    expect(laMasRecienteViva([vieja, nueva]).id).toBe("lead-nueva");
  });

  test("y si todas están cerradas, no hay ninguna", () => {
    expect(laMasRecienteViva([suya({ status: "Cerrado" })])).toBeNull();
    expect(laMasRecienteViva([])).toBeNull();
  });
});

describe("lo que se le cuenta", () => {
  test("el día en que la pidió, en español", () => {
    expect(cuandoLaPidio(suya())).toMatch(/22 de septiembre/);
    expect(cuandoLaPidio(suya({ createdAt: "" }))).toBe("");
    expect(cuandoLaPidio(suya({ createdAt: "vete a saber" }))).toBe("");
  });

  test("y por dónde va, sin palabras del ERP", () => {
    expect(porDondeVa(suya())).toMatch(/Te llamamos/);
    expect(porDondeVa(suya({ status: "Contactado" }))).toMatch(/hemos hablado/);
    // Un estado que no esté contemplado cae en algo que sirve igual.
    expect(porDondeVa(suya({ status: "En proceso" }))).toBeTruthy();
    for (const estado of ["Pendiente", "Contactado", "En proceso", "Cita confirmada"]) {
      expect(porDondeVa(suya({ status: estado }))).not.toMatch(/Pendiente|Contactado|Cita confirmada/);
    }
  });
});

describe("la lista de estados cerrados", () => {
  test("es la misma que la del servidor", () => {
    /*
     * Son dos ficheros porque `src/` no puede importar de `lib/`. Si se
     * separan, la página deja pedir algo que el servidor va a tragarse, o al
     * revés: le dice que ya lo tiene pedido y el servidor apunta un segundo.
     */
    const delServidor = fs.readFileSync(path.join(__dirname, "../../lib/lead-repetido.js"), "utf8");
    const linea = delServidor.match(/const YA_NO_ESPERA = \[([^\]]*)\]/);
    expect(linea).toBeTruthy();
    const suyos = linea[1].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    expect([...suyos].sort()).toEqual([...YA_NO_ESPERA].sort());
  });

  test("y no incluye ninguno en el que todavía espere algo", () => {
    for (const estado of ["Pendiente", "Contactado", "En proceso", "Cita confirmada", "Interesado"]) {
      expect(sigueViva({ status: estado })).toBe(true);
    }
    expect(sigueViva({ status: "Cerrado" })).toBe(false);
  });
});
