/**
 * El formulario de «Nosotros lo vendemos por ti».
 *
 * Lo que se protege: que lo que el botón promete preguntar se pregunte de
 * verdad, y que lo que el cliente cuenta llegue al ERP en vez de a una bandeja
 * de correo.
 */
import { PLAZOS, elPlazo, faltaParaMandarlo, loQueSeManda, loQueLeQueda, GUIA, ALTA, elAlta, pareceUnaMatricula, comoSeCompara } from "./encargoDeVentaWeb";

const bien = {
  matricula: "8888LXR", plazo: "1mes",
  nombre: "Ana", telefono: "684717736", email: "ana@ejemplo.com",
};

describe("las dos preguntas que el botón prometía", () => {
  test("qué coche tiene", () => {
    // «Cuéntanos qué coche tienes» — y el formulario de antes no lo preguntaba.
    expect(faltaParaMandarlo({ ...bien, matricula: "" })).toMatch(/matrícula/i);
  });

  test("y en cuánto tiempo quiere venderlo", () => {
    expect(faltaParaMandarlo({ ...bien, plazo: "" })).toMatch(/cuánto tiempo/);
    expect(faltaParaMandarlo({ ...bien, plazo: "algún día" })).toMatch(/cuánto tiempo/);
  });

  test("el coche se pide por matrícula, no en texto libre", () => {
    /*
     * Era texto libre y valía «un Golf del 15». Eso no identifica ningún coche:
     * hay miles, y el que tiene que adivinar cuál es es el que coge el
     * teléfono, justo el que menos lo sabe.
     */
    expect(faltaParaMandarlo({ ...bien, matricula: "un Golf del 15" })).toMatch(/matrícula/i);
    expect(faltaParaMandarlo({ ...bien, matricula: "8888LXR" })).toBe("");
  });

  test("y quien elige uno de los suyos no la escribe", () => {
    // Ahí el coche está identificado por su ficha, que es mejor todavía.
    expect(faltaParaMandarlo({ ...bien, matricula: "", vehicleId: "veh-123" })).toBe("");
  });
});

describe("la matrícula", () => {
  test("se compara sin espacios ni guiones y en mayúsculas", () => {
    // Quien la copia de un papel se trae los espacios.
    for (const escrita of ["8888LXR", "8888 LXR", "8888-lxr", " 8888 lxr "]) {
      expect(comoSeCompara(escrita)).toBe("8888LXR");
    }
  });

  test("se aceptan las de todas las épocas", () => {
    // Tambien hay coches con matricula antigua, y son justo los que la gente
    // quiere vender.
    for (const buena of ["8888LXR", "8888 LXR", "M1234AB", "B 1234 CD"]) {
      expect(pareceUnaMatricula(buena)).toBe(true);
    }
  });

  test("pero no una frase ni un número suelto", () => {
    for (const mala of ["", "un Golf del 15", "12345678", "ABCDEFG", "8L", null, undefined]) {
      expect(pareceUnaMatricula(mala)).toBe(false);
    }
  });

  test("se acepta ancha a propósito", () => {
    /*
     * Rechazar la matrícula de alguien que quiere vendernos su coche cuesta
     * mucho más que dejar pasar una rara: lo segundo se arregla en la llamada
     * y lo primero le echa. Por eso no se valida el formato exacto de la DGT.
     */
    expect(pareceUnaMatricula("1234XYZ")).toBe(true);
    expect(pareceUnaMatricula("PM1234AB")).toBe(true);
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

  test("la matrícula viaja aparte y normalizada", () => {
    /*
     * Aparte del título y no dentro, porque es por donde el ERP mira si ese
     * coche ya tiene ficha. Dentro del título no se puede buscar: ahí llega
     * como la escribió él, con sus espacios y sus guiones.
     */
    expect(loQueSeManda({ ...bien, matricula: "8888 lxr" }).plate).toBe("8888LXR");
  });

  test("y el título dice lo que se sepa del coche", () => {
    // Cuando eligió uno de los suyos va su nombre; cuando escribió la
    // matrícula, la matrícula, que es lo único que sabemos.
    expect(enviado.vehicle_title).toBe("8888LXR");
    expect(loQueSeManda({ ...bien, coche: "Seat Ibiza 2019" }).vehicle_title)
      .toBe("Seat Ibiza 2019");
  });

  test("sin matrícula no se manda una vacía", () => {
    // `plate: ""` en el lead se lee como «tiene matrícula y está en blanco».
    expect(loQueSeManda({ ...bien, matricula: "" }).plate).toBeUndefined();
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
    expect(r.texto).toMatch(/ficha/i);
    expect(r.guia).toBe(true);
  });

  test("y se le invita a empezar ya, no solo se le avisa", () => {
    /*
     * Esta pantalla era un acuse de recibo y es el momento de mas intencion de
     * todo el flujo: acaba de pulsar el boton. La ficha la hace el, y la hara
     * mejor ahora que dentro de tres dias cuando le llamemos.
     */
    const r = loQueLeQueda({ haySesion: false, eligioUnCoche: false });
    expect(r.texto).toMatch(/ahora/i);
  });

  test("pero sin que suene a condición", () => {
    // Si no la crea, se le pide en la llamada como siempre. No es una puerta.
    const r = loQueLeQueda({ haySesion: false, eligioUnCoche: false });
    expect(r.texto).toMatch(/si lo prefieres|en la llamada/i);
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
     * El enlace vivía en un solo sitio: dentro del aviso que solo veía quien
     * había entrado y no tenía coches. Desde fuera no se llegaba a la guía por
     * ningún lado, que es justo el caso de quien llega de coches.net.
     *
     * Se mira **la rama de la matrícula**, no el fichero entero: buscando
     * «GUIA» a secas bastaba con el import para dar la prueba por buena, y con
     * eso el enlace podía desaparecer de aquí sin que nadie se enterara.
     */
    const desde = FUENTE.indexOf('placeholder="8888 LXR"');
    const hasta = FUENTE.indexOf("fev-campo", desde);
    expect(desde).toBeGreaterThan(0);
    expect(hasta).toBeGreaterThan(desde);
    expect(FUENTE.slice(desde, hasta)).toMatch(/GUIA/);
  });

  test("y en la pantalla de después, cuando no sabemos si tiene coche", () => {
    // La otra mitad: a quien acaba de mandarlo sin haber entrado hay que
    // poder enseñarle cómo se hace, no solo decirle que hará falta.
    const desde = FUENTE.indexOf("if (hecho) {");
    const hasta = FUENTE.indexOf("const tieneCoches", desde);
    expect(desde).toBeGreaterThan(0);
    expect(hasta).toBeGreaterThan(desde);
    expect(FUENTE.slice(desde, hasta)).toMatch(/queda\.guia &&[\s\S]*GUIA/);
  });

  test("y el texto de después sale de la regla, no escrito a mano", () => {
    // Escrito en el JSX vuelve a poder decir «no tienes que hacer nada más» a
    // alguien que sí tiene que hacer algo.
    expect(FUENTE).toMatch(/loQueLeQueda\(/);
  });
});

describe("el alta del coche, con la matrícula ya puesta", () => {
  test("lleva a donde se crea la ficha", () => {
    expect(ALTA).toBe("/panel/vehiculos");
  });

  test("y la matrícula viaja en la dirección, normalizada", () => {
    /*
     * Acaba de escribirla en el formulario. Volver a pedírsela en la pantalla
     * siguiente es el tipo de detalle por el que la gente abandona a mitad.
     */
    expect(elAlta("8888 lxr")).toBe("/panel/vehiculos?matricula=8888LXR");
  });

  test("sin matrícula, la ruta a secas", () => {
    // No una con un parámetro vacío, que llegaría a la pantalla y pondría el
    // campo en blanco de una forma rara.
    expect(elAlta("")).toBe("/panel/vehiculos");
    expect(elAlta()).toBe("/panel/vehiculos");
  });

  test("y no se cuela nada raro en la dirección", () => {
    // `comoSeCompara` ya quita todo lo que no sea letra o número, así que no
    // hay manera de meter un `&` ni un `?` — pero se comprueba, que es gratis.
    expect(elAlta("8888LXR&foo=1")).toBe("/panel/vehiculos?matricula=8888LXRFOO1");
  });

  test("la pantalla de después lleva ahí, no solo a la guía", () => {
    /*
     * Era un acuse de recibo con un enlace a un texto. El botón es lo que
     * convierte «ya te llamaremos» en algo que puede hacer ahora.
     */
    const FUENTE = require("fs")
      .readFileSync(require("path").join(__dirname, "../components/FormularioEncargoVenta.js"), "utf8");
    const desde = FUENTE.indexOf("if (hecho) {");
    const hasta = FUENTE.indexOf("const tieneCoches", desde);
    expect(desde).toBeGreaterThan(0);
    expect(hasta).toBeGreaterThan(desde);
    expect(FUENTE.slice(desde, hasta)).toMatch(/elAlta\(datos\.matricula\)/);
  });
});

describe("ya no hay muro para el que ha entrado sin coches", () => {
  const FUENTE = require("fs")
    .readFileSync(require("path").join(__dirname, "../components/FormularioEncargoVenta.js"), "utf8");

  test("el bloqueo se ha ido", () => {
    /*
     * Quien había entrado y no tenía coches no podía ni preguntar, y sin cuenta
     * sí se podía: registrarse te lo ponía más difícil. Y no conseguía lo que
     * buscaba, porque la ficha se hace cuando ya le interesa, no antes.
     */
    expect(FUENTE).not.toMatch(/sinCoches/);
    expect(FUENTE).not.toMatch(/Primero da de alta tu coche/);
  });

  test("y todos acaban en el mismo formulario", () => {
    // Una sola pregunta —qué coche— con dos maneras de contestarla según lo
    // que sepamos de él, y el resto del formulario igual para todos.
    expect(FUENTE).toMatch(/const tieneCoches = haySesion/);
  });
});

describe("y al llegar al panel, el campo viene relleno", () => {
  const { laMatriculaDeLaUrl } = require("../pages/ServiceIdCarsManagePage");

  test("lee la matrícula de la dirección", () => {
    expect(laMatriculaDeLaUrl("?matricula=8888LXR")).toBe("8888LXR");
  });

  test("y la normaliza igual que el formulario que la mandó", () => {
    /*
     * Es el mismo `comoSeCompara` a los dos lados. Si aquí se leyera en crudo,
     * «8888 lxr» llegaría al campo con el espacio y el cliente vería su
     * matrícula escrita raro justo después de escribirla bien.
     */
    expect(laMatriculaDeLaUrl("?matricula=8888%20lxr")).toBe("8888LXR");
    expect(laMatriculaDeLaUrl(elAlta("8888 lxr").split("?")[1] ? "?" + elAlta("8888 lxr").split("?")[1] : ""))
      .toBe("8888LXR");
  });

  test("sin parámetro no inventa nada", () => {
    for (const s of ["", "?", "?otra=cosa", "?matricula="]) {
      expect(laMatriculaDeLaUrl(s)).toBe("");
    }
  });

  test("la pantalla la usa para rellenar el campo", () => {
    // Leerla y no ponerla en el formulario es el mismo viaje de antes con más
    // codigo: el cliente la vuelve a escribir igual.
    const FUENTE = require("fs")
      .readFileSync(require("path").join(__dirname, "../pages/ServiceIdCarsManagePage.js"), "utf8");
    expect(FUENTE).toMatch(/plate: comoSeCompara\(matricula\)/);
    expect(FUENTE).toMatch(/createEmptyForm\(laMatriculaDeLaUrl\(\)\)/);
  });
});
