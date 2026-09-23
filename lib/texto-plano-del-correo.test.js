/**
 * Que los correos lleven también su versión en texto.
 *
 * Los envíos de la aplicación mandaban solo HTML. Un correo sin parte de texto
 * es una de las señales que los filtros miran para separar lo que escribe una
 * persona de lo que escribe una máquina — no es la que más pesa, eso es la
 * autenticación del dominio, pero es gratis.
 *
 * Y hay quien lee el correo con el HTML desactivado: en un reloj o en un lector
 * de pantalla, esto es lo único que se oye.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { plantilla, parrafo, opciones, datos, textoPlano } = require("./correo");

/** El correo de «¿Te lo quedas?», tal como sale. */
const EL_CORREO = plantilla({
  titulo: "¿Te lo quedas?",
  cuerpo:
    parrafo("Acabas de ver <strong>Volkswagen T-Roc</strong>. Dinos qué quieres hacer:") +
    opciones([
      { texto: "Quiero comprarlo", url: "https://www.popcar.com.es/quiero-comprarlo?id=1&token=abc" },
      { texto: "Lo vi y no me lo quedo", url: "https://www.popcar.com.es/como-fue?r=fue" },
      { texto: "No fui", url: "https://www.popcar.com.es/como-fue?r=no_fue" },
    ]),
});

describe("lo que se lee sin HTML", () => {
  const texto = textoPlano(EL_CORREO);

  test("está el mensaje", () => {
    assert.match(texto, /Acabas de ver Volkswagen T-Roc/);
  });

  test("y las tres opciones, con su dirección al lado", () => {
    /*
     * Un botón sin su dirección escrita no se puede seguir desde el texto: el
     * lector ve «Quiero comprarlo» y no tiene dónde pulsar.
     */
    assert.match(texto, /Quiero comprarlo: https:\/\/www\.popcar\.com\.es\/quiero-comprarlo\?id=1&token=abc/);
    assert.match(texto, /Lo vi y no me lo quedo: https/);
    assert.match(texto, /No fui: https/);
  });

  test("sin una sola etiqueta ni entidad HTML", () => {
    assert.ok(!/<[a-z/]/i.test(texto), texto);
    assert.ok(!/&(nbsp|amp|lt|gt|quot|#39);/.test(texto));
  });

  test("el titular no sale dos veces", () => {
    // Salía repetido: una vez del `<title>` de la cabecera y otra del `<h1>`.
    assert.equal(texto.split("¿Te lo quedas?").length - 1, 1);
  });

  test("y el logotipo no sale partido", () => {
    /*
     * Son dos `span`, uno por color. Cambiando cada etiqueta por un espacio,
     * «PopCar» se leía «Pop Car».
     */
    assert.match(texto, /PopCar/);
    assert.ok(!/Pop Car/.test(texto));
  });

  test("ni queda un espacio antes del punto", () => {
    // «<strong>T-Roc</strong>.» se leía «T-Roc .».
    assert.ok(!/ \./.test(texto), texto);
  });
});

describe("no revienta con lo que le echen", () => {
  test("ni sin nada", () => {
    assert.equal(textoPlano(""), "");
    assert.equal(textoPlano(null), "");
    assert.equal(textoPlano(undefined), "");
  });

  test("ni con una tabla de datos", () => {
    const t = textoPlano(plantilla({
      titulo: "Tu visita está confirmada",
      cuerpo: datos([["Día", "jueves 17"], ["Hora", "10:00"]]),
    }));
    assert.match(t, /Día/);
    assert.match(t, /jueves 17/);
    assert.match(t, /10:00/);
  });

  test("y las líneas no se amontonan de tres en tres", () => {
    assert.ok(!/\n{3}/.test(textoPlano(EL_CORREO)));
  });
});

/**
 * Y que se mande de verdad.
 *
 * La función puede estar perfecta y no usarla nadie: lo que llega a Gmail es lo
 * que va en el cuerpo de la petición a Resend. Es el mismo fallo que la lectura
 * de la ficha técnica enganchada al lado que no usa nadie, y por eso se mira el
 * fuente.
 */
describe("va en el envío, no solo escrita", () => {
  /*
   * La función puede estar perfecta y no usarla nadie: lo que llega a Gmail es
   * lo que va en el cuerpo de la petición a Resend.
   *
   * Los ficheros se buscan, no se listan: una lista escrita aquí deja fuera al
   * envío nuevo sin que nadie se entere, que es el mismo fallo que tuvo la
   * lectura de la ficha técnica enganchada al lado que no usa nadie.
   */
  const ENVIO = "api.resend.com/emails";

  const losQueMandan = () => {
    const encontrados = [];
    for (const dir of ["", "api"]) {
      const carpeta = path.join(__dirname, dir);
      for (const f of fs.readdirSync(carpeta)) {
        if (!f.endsWith(".js") || f.includes(".test.")) continue;
        const ruta = path.join(carpeta, f);
        if (!fs.statSync(ruta).isFile()) continue;
        const fuente = fs.readFileSync(ruta, "utf8");
        if (fuente.includes("api.resend.com/emails")) encontrados.push([path.join(dir, f), fuente]);
      }
    }
    return encontrados;
  };

  test("se encuentran los ficheros que mandan correo", () => {
    // Si la búsqueda fallara, la prueba de abajo pasaría sin mirar nada.
    assert.ok(losQueMandan().length >= 10, losQueMandan().map(([f]) => f).join(", "));
  });

  test("y todos mandan también la versión en texto", () => {
    /*
     * Envío a envío, no fichero a fichero.
     *
     * Con un fichero que manda cuatro correos basta con que uno lleve texto
     * para que el fichero entero pase: lo comprobé quitándole el texto a uno
     * de los dos de «viewing» y la prueba se quedó en verde.
     */
    const mudos = [];
    for (const [fichero, fuente] of losQueMandan()) {
      let desde = fuente.indexOf(ENVIO);
      let anterior = 0;
      let n = 0;
      while (desde >= 0) {
        n += 1;
        /*
         * Se mira alrededor y no solo detrás: hay envíos que arman el cuerpo
         * unas líneas antes —`const payload = { ... }`— y ahí es donde está el
         * texto. Con la ventana solo hacia delante salían como mudos.
         *
         * Pero sin pasar del envío anterior: con dos seguidos en el mismo
         * fichero, el texto de uno tapaba la falta del otro. Lo comprobé
         * quitándole el texto al segundo de «viewing» y la prueba se quedaba
         * en verde.
         */
        const siguiente = fuente.indexOf(ENVIO, desde + 1);
        const hasta = siguiente < 0 ? desde + 800 : Math.min(desde + 800, siguiente);
        const trozo = fuente.slice(Math.max(anterior, desde - 1400), hasta);
        if (!trozo.includes("text:")) mudos.push(`${fichero} (envío ${n})`);
        // El trozo del siguiente empieza donde acabó éste: si no, la ventana
        // hacia atrás se metía en el cuerpo del anterior y le robaba el texto.
        anterior = hasta;
        desde = siguiente;
      }
    }
    assert.deepEqual(mudos, [], `estos mandan solo HTML: ${mudos.join(", ")}`);
  });

  test("y el que la usa la tiene importada", () => {
    const sinImportar = losQueMandan()
      .filter(([f, fuente]) => fuente.includes("textoPlano(") && !/textoPlano[,\s}]/.test(fuente.split("require")[0] + fuente.match(/const \{[^}]*\} = require\(["'][^"']*correo["']\);/)?.[0] || ""))
      .map(([f]) => f);
    assert.deepEqual(sinImportar, [], `no la importan: ${sinImportar.join(", ")}`);
  });
});
