/**
 * Ir a una pantalla es una sola cosa.
 *
 * ## Qué había
 *
 * `setEntryMode(X); setStep(-1);` escrito **ochenta y siete veces**: 81 en
 * `App.js` y 6 en tres hooks. Lo más repetido del proyecto, con diferencia.
 *
 * Y no son dos instrucciones sueltas. `entryMode` dice qué pantalla y
 * `step === -1` dice «no estás en el cuestionario». Casi todas las pantallas se
 * dibujan con `step === -1 && entryMode === "algo"`, así que cambiar el modo sin
 * poner el paso a -1 deja **la pantalla en blanco**: el modo nuevo no encaja con
 * ninguna condición, y el cuestionario tampoco sale.
 *
 * Escrito ochenta y siete veces, la pareja dependía de que nadie se olvidara de
 * la segunda línea. Y ya había pasado: en la cuarta copia de «abrir la ficha de
 * un coche» faltaba, y solo era inocuo porque ese manejador vivía dentro de una
 * pantalla que ya exigía `step === -1`.
 *
 * ## Los que no vi a la primera
 *
 * Mi primer recuento dio 83, no 87. Cuatro estaban escritas **en una sola
 * línea** —`{ setEntryMode("serviceAppointment"); setStep(-1); }`— y mi patrón
 * exigía un salto entre las dos. Es la tercera vez en este trabajo que un patrón
 * mío se deja casos por una diferencia de forma, así que este vigilante busca
 * las dos formas.
 *
 * Y había dos pares **partidos**: uno por un `syncBrowserPath` en medio, y otro
 * repartido entre dos ficheros —`openPortalVoOfferDetail` ponía el modo y quien
 * la llamaba ponía el paso—. Ésos son los peores, porque no se ven leyendo
 * ninguno de los dos lados.
 *
 * ## Y es la costura
 *
 * Aquí no hay `react-router`: la navegación se deduce a mano de
 * `window.location.pathname`. Con «ir a una pantalla» en un solo sitio, migrar
 * algún día es cambiar el cuerpo de una función, no reescribir ochenta y siete
 * manejadores y un efecto de ciento veinte líneas a la vez.
 */

const fs = require("fs");
const path = require("path");

const HOOKS = __dirname;
const APP = path.join(__dirname, "..", "App.js");

function losFicheros() {
  const hooks = fs
    .readdirSync(HOOKS)
    .filter((n) => n.endsWith(".js") && !n.endsWith(".test.js"))
    .map((n) => path.join(HOOKS, n));

  return [APP, ...hooks];
}

/** El cuerpo de `vasA`, que es el único sitio donde la pareja es legítima. */
const DENTRO_DE_VASA = /const vasA = useCallback\(\(modo\) => \{\s*setEntryMode\(modo\);\s*setStep\(-1\);\s*\}, \[\]\);/;

function sinLaFuncionNiSuDocumentacion(fuente) {
  return fuente
    .replace(DENTRO_DE_VASA, "")
    // Los comentarios nombran la pareja para explicar por qué existe la función.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("la pareja no se escribe a mano en ningún sitio", () => {
  test("ni con salto de línea entre las dos", () => {
    const culpables = [];

    for (const fichero of losFicheros()) {
      const fuente = sinLaFuncionNiSuDocumentacion(
        fs.readFileSync(fichero, "utf8").replace(/\r\n/g, "\n")
      );
      if (/setEntryMode\([^;]*\);\n\s*setStep\(-1\);/.test(fuente)) {
        culpables.push(path.basename(fichero));
      }
    }

    expect(culpables).toEqual([]);
  });

  test("ni en la misma línea, que es como se me escaparon cuatro", () => {
    const culpables = [];

    for (const fichero of losFicheros()) {
      const fuente = sinLaFuncionNiSuDocumentacion(
        fs.readFileSync(fichero, "utf8").replace(/\r\n/g, "\n")
      );
      if (/setEntryMode\([^;]*\);\s+setStep\(-1\);/.test(fuente)) {
        culpables.push(path.basename(fichero));
      }
    }

    expect(culpables).toEqual([]);
  });

  test("y la función existe, con su cuerpo", () => {
    // Si desaparece, los ochenta y nueve sitios que la llaman se caen.
    expect(fs.readFileSync(APP, "utf8").replace(/\r\n/g, "\n")).toMatch(DENTRO_DE_VASA);
  });
});

describe("y se usa de verdad", () => {
  test("hay muchas más llamadas que las que había pares", () => {
    /*
     * Ochenta y nueve sitios. Si este número se desploma, alguien volvió a
     * escribir la pareja de otra forma que los patrones de arriba no ven.
     */
    let llamadas = 0;

    for (const fichero of losFicheros()) {
      const fuente = fs.readFileSync(fichero, "utf8");
      llamadas += fuente.split("vasA(").length - 1;
    }

    expect(llamadas).toBeGreaterThanOrEqual(85);
  });

  test("y los tres hooks la reciben, en vez de los dos setters", () => {
    /*
     * Es lo que impide que vuelvan a escribirla: sin `setStep` no se puede.
     * `useResumeQuestionnaireDraft` sí lo conserva, porque también pone el paso
     * guardado, que es otra cosa.
     */
    for (const nombre of ["useAdvisorController", "useDashboardNavigation", "useResumeQuestionnaireDraft"]) {
      const fuente = fs.readFileSync(path.join(HOOKS, `${nombre}.js`), "utf8");
      expect(fuente).toContain("vasA,");
    }

    const panel = fs.readFileSync(path.join(HOOKS, "useDashboardNavigation.js"), "utf8");
    expect(panel).not.toContain("setStep");

    const ctrl = fs.readFileSync(path.join(HOOKS, "useAdvisorController.js"), "utf8");
    // Conserva `setStep` porque también hace `setStep(0)` al reiniciar el
    // cuestionario, que no es ir a una pantalla.
    expect(ctrl).toContain("setStep(0)");
  });
});

describe("el que queda suelto, y por qué", () => {
  test("«ya estás dentro» pone el paso sin decidir la pantalla", () => {
    /*
     * Es el único `setStep(-1)` a mano que sobrevive, y es correcto: al entrar en
     * la cuenta la pantalla la deciden tres ramas de abajo, y una de ellas es
     * «quédate donde estabas». Poner el modo aquí sería justo lo contrario.
     *
     * Se prueba para que quien lo vea sepa que no es un olvido.
     */
    const fuente = fs.readFileSync(APP, "utf8").replace(/\r\n/g, "\n");
    const trozo = fuente.slice(
      fuente.indexOf("entraEnLaCuenta(nextUser);"),
      fuente.indexOf("entraEnLaCuenta(nextUser);") + 400
    );

    expect(trozo).toContain("setStep(-1);");
    expect(trozo).toContain("la deciden las ramas de abajo");
  });
});
