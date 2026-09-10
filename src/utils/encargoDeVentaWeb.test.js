/**
 * El formulario de «Nosotros lo vendemos por ti».
 *
 * Lo que se protege: que lo que el botón promete preguntar se pregunte de
 * verdad, y que lo que el cliente cuenta llegue al ERP en vez de a una bandeja
 * de correo.
 */
import { PLAZOS, elPlazo, faltaParaMandarlo, loQueSeManda, loQueLeQueda, GUIA } from "./encargoDeVentaWeb";

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


describe("qué se le dice después de mandarlo", () => {
  /*
   * Había un solo texto y decía «no tienes que hacer nada más». Para quien no
   * ha entrado eso es una promesa que no podemos sostener: no sabemos si tiene
   * el coche dado de alta, y si no lo tiene, lo que le espera es matrícula,
   * fotos y papeles.
   */
  test("a quien eligió uno de sus coches no le queda nada", () => {
    const r = loQueLeQueda({ haySesion: true, eligioUnCoche: true });
    expect(r.texto).toMatch(/no tienes que hacer nada más/i);
    // No hace falta enseñarle la guía: su coche ya está dado de alta.
    expect(r.guia).toBe(false);
  });

  test("a quien no ha entrado NO se le promete eso", () => {
    const r = loQueLeQueda({ haySesion: false, eligioUnCoche: false });
    expect(r.texto).not.toMatch(/no tienes que hacer nada más/i);
    expect(r.texto).toMatch(/matrícula/i);
    expect(r.guia).toBe(true);
  });

  test("y tener sesión no basta: hay que haber elegido el coche", () => {
    /*
     * Se puede haber entrado y escribir el coche a mano. Ahí estamos igual de
     * a oscuras que sin sesión, y dar por hecho que el coche existe porque hay
     * una cuenta es exactamente el atajo que hace falsa la promesa.
     */
    const r = loQueLeQueda({ haySesion: true, eligioUnCoche: false });
    expect(r.guia).toBe(true);
    expect(r.texto).not.toMatch(/no tienes que hacer nada más/i);
  });

  test("sin saber nada, se elige la versión prudente", () => {
    // De las dos maneras de equivocarse, prometer de menos se corrige en la
    // llamada; prometer de más ya se ha prometido.
    expect(loQueLeQueda().guia).toBe(true);
    expect(loQueLeQueda({}).guia).toBe(true);
  });

  test("ninguna de las dos suena a requisito nuevo", () => {
    // No es algo que le pidamos por no haberse registrado: es lo mismo que iba
    // a tener que hacer de todas formas.
    for (const r of [
      loQueLeQueda({ haySesion: true, eligioUnCoche: true }),
      loQueLeQueda({ haySesion: false, eligioUnCoche: false }),
    ]) {
      expect(r.texto).toMatch(/no hay ningún compromiso/i);
    }
  });
});

describe("la guía se puede encontrar", () => {
  const FUENTE = require("fs")
    .readFileSync(require("path").join(__dirname, "../components/FormularioEncargoVenta.js"), "utf8")
    .replace(/\r\n/g, "\n");

  test("tiene una ruta, y es la página que existe", () => {
    expect(GUIA).toBe("/como-subir-tu-coche");
  });

  test("el formulario la ofrece también a quien no ha entrado", () => {
    /*
     * El enlace vivía en un solo sitio: dentro del aviso que solo ve quien ha
     * entrado y no tiene coches. Desde fuera no se llegaba a la guía por
     * ningún lado, que es justo el caso de quien llega de coches.net.
     *
     * Se mira **la rama del texto libre**, no el fichero entero: buscando
     * «GUIA» a secas bastaba con el import para dar la prueba por buena, y con
     * eso el enlace podía desaparecer de aquí sin que nadie se enterara.
     */
    const desde = FUENTE.indexOf('placeholder="Seat Ibiza 2019');
    const hasta = FUENTE.indexOf("{!sinCoches &&", desde);
    expect(desde).toBeGreaterThan(0);
    expect(hasta).toBeGreaterThan(desde);
    expect(FUENTE.slice(desde, hasta)).toMatch(/GUIA/);
  });

  test("y en la pantalla de después, cuando no sabemos si tiene coche", () => {
    // La otra mitad: a quien acaba de mandarlo sin haber entrado hay que
    // poder enseñarle cómo se hace, no solo decirle que hará falta.
    const desde = FUENTE.indexOf("if (hecho) {");
    const hasta = FUENTE.indexOf("const sinCoches", desde);
    expect(desde).toBeGreaterThan(0);
    expect(FUENTE.slice(desde, hasta)).toMatch(/queda\.guia &&[\s\S]{0,200}GUIA/);
  });

  test("y el texto de después sale de la regla, no escrito a mano", () => {
    // Escrito en el JSX vuelve a poder decir «no tienes que hacer nada más» a
    // alguien que sí tiene que hacer algo.
    expect(FUENTE).toMatch(/loQueLeQueda\(/);
  });
});
