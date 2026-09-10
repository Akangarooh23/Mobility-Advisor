"use strict";

/**
 * La dirección corta de los anuncios de portal.
 *
 * Lo que se protege: que la matrícula del anuncio lleve al coche del anuncio,
 * la escriba como la escriba quien la copia, y que cuando el coche ya no esté
 * a la venta eso se pueda contar en vez de reventar.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const M = require("./coche-por-matricula");

describe("cómo la escribe la gente", () => {
  test("con espacios, con guion o en minúscula es la misma", () => {
    // Quien copia de un anuncio se trae los espacios, y quien la teclea en el
    // móvil no pone mayúsculas.
    for (const escrita of ["8888LXR", "8888 LXR", "8888-lxr", " 8888 lxr ", "8888.LXR"]) {
      assert.equal(M.comoSeCompara(escrita), "8888LXR", escrita);
    }
  });

  test("y lo que no es nada devuelve nada", () => {
    assert.equal(M.comoSeCompara(null), "");
    assert.equal(M.comoSeCompara(undefined), "");
    assert.equal(M.comoSeCompara("---"), "");
  });
});

describe("qué puede ser una matrícula", () => {
  test("las de aquí, y también las viejas", () => {
    for (const buena of ["8888LXR", "8888 LXR", "M1234AB", "B-1234-CD"]) {
      assert.equal(M.pareceUnaMatricula(buena), true, buena);
    }
  });

  test("y lo que evidentemente no lo es, no", () => {
    // Sirve para no ir a la base a buscar cosas que pide el navegador solo.
    for (const mala of ["", "favicon.ico", "robots", "12345", "ABCDEFG", "a".repeat(40)]) {
      assert.equal(M.pareceUnaMatricula(mala), false, mala);
    }
  });

  test("hacen falta letras Y números", () => {
    assert.equal(M.pareceUnaMatricula("ABCDEF"), false);
    assert.equal(M.pareceUnaMatricula("123456"), false);
  });
});

describe("la matrícula que viene en la dirección", () => {
  test("se saca de /v/loquesea", () => {
    assert.equal(M.laMatriculaDeLaRuta("/v/8888LXR"), "8888LXR");
    assert.equal(M.laMatriculaDeLaRuta("/v/8888LXR/"), "8888LXR");
    assert.equal(M.laMatriculaDeLaRuta("/v/8888LXR?utm_source=coches"), "8888LXR");
  });

  test("con espacios escapados también", () => {
    // Un enlace copiado de un correo llega así.
    assert.equal(M.laMatriculaDeLaRuta("/v/8888%20LXR"), "8888 LXR");
  });

  test("y cualquier otro camino no es este", () => {
    for (const otro of ["/", "/v", "/v/", "/marketplace-vo/idcar-1", "/v/a/b", ""]) {
      assert.equal(M.laMatriculaDeLaRuta(otro), "", otro);
    }
  });
});

describe("cuál es la del anuncio cuando hay varias", () => {
  const nuestra = { id: "idcar-veh-1", updated_at: "2026-01-01" };
  const ajena   = { id: "erp-9",       updated_at: "2026-09-01" };
  const otra    = { id: "erp-3",       updated_at: "2026-05-01" };

  test("con una sola, esa", () => {
    assert.equal(M.laDelAnuncio([ajena]).id, "erp-9");
  });

  test("gana la nuestra aunque sea más vieja", () => {
    /*
     * El enlace lo hemos puesto nosotros en el anuncio de un coche que
     * gestionamos. Elegir la más reciente mandaría al comprador a la ficha de
     * un concesionario que tiene otro coche con la matrícula mal tecleada.
     */
    assert.equal(M.laDelAnuncio([ajena, nuestra, otra]).id, "idcar-veh-1");
  });

  test("y si ninguna es nuestra, la más recién tocada", () => {
    // Es la que sigue viva: la vieja lleva meses sin que nadie la mire.
    assert.equal(M.laDelAnuncio([otra, ajena]).id, "erp-9");
  });

  test("sin ninguna, nada — y eso no revienta", () => {
    // Le va a pasar a todo el que pulse el enlace después de que se venda.
    assert.equal(M.laDelAnuncio([]), null);
    assert.equal(M.laDelAnuncio(null), null);
    assert.equal(M.laDelAnuncio([null, undefined]), null);
  });
});

describe("la consulta", () => {
  test("compara sin espacios ni guiones y sin mayúsculas", () => {
    // Lo guardado también puede venir con espacios: no lo escribimos nosotros.
    assert.match(M.SQL_POR_MATRICULA, /upper\(regexp_replace\(COALESCE\(matricula, ''\), '\[\^A-Za-z0-9\]', '', 'g'\)\) = \$1/);
  });

  test("solo ofertas vivas", () => {
    /*
     * Un anuncio apagado es un coche que ya no está a la venta. Llevar a su
     * ficha sería enseñarle un precio que ya no vale y unas horas de visita que
     * nadie va a atender.
     */
    assert.match(M.SQL_POR_MATRICULA, /COALESCE\(is_active, FALSE\) = TRUE/);
  });

  test("y trae las que haya, no una", () => {
    // Con LIMIT 1 la desambiguación no existiría: se llevaría la que saliera.
    assert.ok(!/LIMIT/i.test(M.SQL_POR_MATRICULA), "la consulta decide por su cuenta cuál es");
    assert.match(M.SQL_POR_MATRICULA, /ORDER BY updated_at DESC/);
  });
});

describe("las dos copias de la regla dicen lo mismo", () => {
  /*
   * `laMatriculaDeLaRuta` vive aquí, en CommonJS del servidor, y otra vez en
   * `App.js`, que es lo que empaqueta el navegador y no puede requerir esto.
   *
   * Dos copias de una regla se separan: alguien arregla una y la otra sigue
   * como estaba, y entonces el enlace de un anuncio funciona en un sitio y en
   * el otro no. Esta prueba las obliga a contestar igual.
   */
  const fs = require("node:fs");
  const path = require("node:path");
  const APP = fs
    .readFileSync(path.join(__dirname, "../src/App.js"), "utf8")
    .replace(/\r\n/g, "\n");

  /** La copia de App.js, sacada de la fuente y puesta a funcionar. */
  const laDeApp = (() => {
    const desde = APP.indexOf("function matriculaDeLaRuta(camino) {");
    assert.ok(desde > 0, "App.js ya no tiene su copia; revisa esta prueba");
    const hasta = APP.indexOf("\n}", desde) + 2;
    // eslint-disable-next-line no-new-func
    return new Function(`${APP.slice(desde, hasta)}; return matriculaDeLaRuta;`)();
  })();

  test("para todo lo que se puede escribir en una barra de direcciones", () => {
    const caminos = [
      "/v/8888LXR", "/v/8888LXR/", "/v/8888%20LXR", "/v/8888-lxr",
      "/v/8888LXR?utm_source=coches", "/v/8888LXR#foto",
      "/", "/v", "/v/", "/v/a/b", "", "/marketplace-vo/idcar-1", "/como-fue",
      "/confirmar-visita?t=abc",
    ];
    for (const c of caminos) {
      assert.equal(laDeApp(c), M.laMatriculaDeLaRuta(c), `no coinciden en «${c}»`);
    }
  });

  test("y ninguna se traga las rutas que ya existen", () => {
    // Si `/v/` se quedara con cualquier camino, se comería el resto de la web.
    for (const otra of ["/confirmar-visita", "/como-fue", "/mi-cita", "/marketplace-vo"]) {
      assert.equal(M.laMatriculaDeLaRuta(otra), "", otra);
      assert.equal(laDeApp(otra), "", otra);
    }
  });
});

describe("cómo está cableado", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const APP = fs.readFileSync(path.join(__dirname, "../src/App.js"), "utf8").replace(/\r\n/g, "\n");
  const HANDLER = fs
    .readFileSync(path.join(__dirname, "api/marketplace-vo-handler.js"), "utf8")
    .replace(/\r\n/g, "\n");

  test("la ruta está montada", () => {
    assert.match(APP, /matriculaDeLaRuta\(window\.location\.pathname\)/);
  });

  test("el endpoint mira que parezca una matrícula antes de ir a la base", () => {
    // Un navegador pide cosas por su cuenta; no hay que consultar por cada una.
    const trozo = HANDLER.slice(HANDLER.indexOf("req?.query?.plate"));
    const comprueba = trozo.indexOf("pareceUnaMatricula");
    const consulta = trozo.indexOf("SQL_POR_MATRICULA");
    assert.ok(comprueba > 0 && consulta > 0);
    assert.ok(comprueba < consulta, "va a la base sin mirar qué le han pedido");
  });

  test("y desambigua en vez de quedarse con la primera", () => {
    assert.match(HANDLER, /PorMatricula\.laDelAnuncio\(r\.rows\)/);
  });

  test("«ya no está a la venta» se contesta distinto que un fallo", () => {
    // Es el caso normal cuando el anuncio sigue vivo en el portal y el coche
    // ya se vendió. La pantalla lo cuenta como una respuesta, no como un error.
    assert.match(HANDLER, /404[\s\S]{0,90}ya_no_esta_a_la_venta/);
  });
});

describe("la gemela de src/ dice lo mismo", () => {
  /*
   * `pareceUnaMatricula` vive aqui y en `src/utils/encargoDeVentaWeb.js`, y no
   * por descuido: CRA prohibe que `src/` importe de `lib/`, igual que con las
   * dos `marca.js`. Lo que hay que proteger es que no se separen.
   *
   * Si se separaran, el formulario aceptaria matriculas que el enlace `/v/...`
   * no reconoce -o al reves-, y el coche que el cliente dice que quiere vender
   * no seria el que abre su anuncio.
   */
  const fs = require("node:fs");
  const path = require("node:path");
  const GEMELA = fs
    .readFileSync(path.join(__dirname, "..", "src/utils/encargoDeVentaWeb.js"), "utf8")
    .replace(/\r\n/g, "\n");

  /** La gemela, sacada del fichero: es un modulo ES y esto es CommonJS. */
  const deSrc = (() => {
    const trozo = GEMELA.slice(
      GEMELA.indexOf("export function comoSeCompara"),
      GEMELA.indexOf("/**", GEMELA.indexOf("export function pareceUnaMatricula")),
    );
    const codigo = trozo.replace(/export /g, "") + "\nreturn { comoSeCompara, pareceUnaMatricula };";
    // eslint-disable-next-line no-new-func
    return new Function(codigo)();
  })();

  /*
   * Los bordes, no solo casos comodos.
   *
   * Aqui faltaban los de longitud 6 y 10 —los dos extremos de lo que se
   * acepta— y sin ellos el sabotaje de mover el minimo de 6 a 7 pasaba sin que
   * ninguna prueba se enterara: todos los ejemplos median siete u ocho.
   */
  const CASOS = [
    "8888LXR", "8888 LXR", "8888-lxr", " 8888 lxr ", "M1234AB", "B 1234 CD",
    "1234XYZ", "PM1234AB", "", "un Golf del 15", "12345678", "ABCDEFG", "8L",
    "0000AAA", "  ", "8888LXR8888LXR",
    // Justo en los limites: 5, 6, 10 y 11 caracteres utiles.
    "1234A", "1234AB", "1234ABCDEF", "1234ABCDEFG",
  ];

  test("normalizan igual", () => {
    for (const c of CASOS) {
      assert.equal(deSrc.comoSeCompara(c), M.comoSeCompara(c), `difieren en «${c}»`);
    }
  });

  test("y aceptan y rechazan lo mismo", () => {
    for (const c of CASOS) {
      assert.equal(
        deSrc.pareceUnaMatricula(c), M.pareceUnaMatricula(c),
        `una acepta y la otra no: «${c}»`,
      );
    }
  });
});
