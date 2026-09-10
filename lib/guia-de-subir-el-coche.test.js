"use strict";

/**
 * La guia que se descarga el cliente.
 *
 * Quien la lee no es de la casa: es alguien que ha dicho que si y ahora tiene
 * que reunir cinco cosas en su cuenta sin nadie al lado. Si se atasca no abre
 * un ticket, lo deja.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

/**
 * Sin comentarios: lo que se comprueba es el texto que lee el cliente.
 *
 * Los porques de esa fuente hablan de lo mismo que el texto, asi que buscando
 * en el fichero entero la prueba se daria por buena leyendo una explicacion en
 * vez de una linea de la guia. Ya paso una vez en este proyecto.
 */
const soloCodigo = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

const TEXTO = leer("src/utils/comoSubirTuCoche.js");
const DOC = leer("src/utils/guiaDescargable.js");
const PAGINA = leer("src/pages/ComoSubirTuCochePage.js");
const APP = leer("src/App.js");

describe("el texto vive en un solo sitio", () => {
  test("la pagina y el fichero leen la misma fuente", () => {
    /*
     * Son dos sitios que enseñan la misma guia. Escrita dos veces, una de las
     * dos se queda vieja — y la que se queda vieja es siempre la que no se
     * mira, que es justo la que se descarga el cliente.
     */
    assert.match(PAGINA, /from "\.\.\/utils\/comoSubirTuCoche"/);
    assert.match(DOC, /from "\.\/comoSubirTuCoche"/);
  });

  test("y ninguna de las dos reescribe los pasos", () => {
    for (const fuente of [PAGINA, DOC]) {
      assert.match(fuente, /PASOS/);
      assert.ok(!/Da de alta tu coche/.test(fuente), "un paso escrito a mano fuera de la fuente");
    }
  });
});

describe("los cinco pasos", () => {
  test("son las cinco puertas del encargo, en orden", () => {
    // El coche primero, porque todo lo demas cuelga de el. Las franjas al
    // final, porque son lo unico que caduca.
    for (const cosa of [/da de alta tu coche/i, /sube los papeles/i, /tasación gratuita/i,
                        /informe de estado/i, /cuándo puedes enseñarlo/i]) {
      assert.match(TEXTO, cosa);
    }
  });

  test("cada uno dice donde se hace", () => {
    // Lo primero que busca quien tiene el panel abierto.
    const dondes = [...TEXTO.matchAll(/donde:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.equal(dondes.length, 5, "algun paso no dice donde se hace");
    for (const d of dondes) assert.match(d, /Mi panel/);
  });

  test("y cada uno dice POR QUE", () => {
    /*
     * Es la diferencia entre una orden y una razon. «Sube seis fotos» se cumple
     * a medias; sabiendo que esas fotos son el anuncio, se cumple bien — y esas
     * fotos son lo que va a ver el comprador.
     */
    const porques = [...TEXTO.matchAll(/porque:\s*\n?\s*"/g)];
    assert.equal(porques.length, 5, "algun paso no dice por que");
  });
});

describe("el fichero que se descarga", () => {
  test("Word tiene que saber en que juego de caracteres viene", () => {
    // Sin esto una guia llena de «matricula» y «tecnica» sale rota en la
    // primera linea.
    assert.match(DOC, /<meta charset="utf-8">/);
    assert.match(DOC, /new Blob\(\["\uFEFF"/);
  });

  test("y nada del texto se cuela como etiqueta", () => {
    assert.match(DOC, /function escapa\(texto\)/);
    assert.match(DOC, /escapa\(p\.titulo\)/);
  });

  test("se llama por su nombre, no «documento1»", () => {
    assert.match(DOC, /a\.download = "como-subir-tu-coche\.doc"/);
  });
});

describe("como se llega", () => {
  test("tiene su direccion, sin sesion", () => {
    /*
     * Se llega desde un correo. Pedirle que entre para leer una guia de como
     * entrar no tendria ninguna gracia.
     */
    assert.match(APP, /window\.location\.pathname === "\/como-subir-tu-coche"/);
  });

  test("y el formulario la enlaza, por la constante y no a mano", () => {
    /*
     * Aqui se buscaba la ruta escrita a mano. Ahora sale de `GUIA`, en
     * `encargoDeVentaWeb`, porque el formulario la enlaza desde tres sitios y
     * escrita tres veces es cuestion de tiempo que una se quede vieja.
     *
     * Lo que se comprueba es que la constante valga esta ruta y que el
     * formulario la use: si se cambiara una de las dos, la guia dejaria de
     * abrirse desde el formulario y la pagina seguiria existiendo, que es la
     * manera de romperlo sin que nadie lo note.
     */
    const RUTA = leer("src/utils/encargoDeVentaWeb.js");
    assert.match(RUTA, /export const GUIA = "\/como-subir-tu-coche"/);

    const FORM = leer("src/components/FormularioEncargoVenta.js");
    assert.match(FORM, /href=\{GUIA\}/);
    assert.match(FORM, /import \{[^}]*GUIA[^}]*\} from "\.\.\/utils\/encargoDeVentaWeb"/);
  });
});

describe("lo que sigue siendo suyo", () => {
  /*
   * Sin comentarios: aqui se comprueba lo que lee el cliente, y los porques de
   * este fichero hablan de lo mismo. Buscando en el texto entero, la prueba se
   * daria por buena leyendo su propia explicacion.
   */
  const CODIGO = soloCodigo(TEXTO);

  /*
   * La guia se leia como «a partir de aqui ya no haces nada»: la seccion de
   * despues son cuatro lineas y las cuatro son nosotros -llevamos, escribimos,
   * filtramos, hacemos-. Y el hace dos cosas, las dos importantes.
   */
  test("existe, y no esta metido dentro de «nos encargamos nosotros»", () => {
    /*
     * Esa seccion se titula asi. Meter ahi lo suyo la dejaria mintiendo, que es
     * peor que no decirlo: el que lee una lista falsa deja de leer las demas.
     */
    assert.match(TEXTO, /export const LO_TUYO = \[/);
    const despues = CODIGO.slice(CODIGO.indexOf("export const DESPUES"), CODIGO.indexOf("export const LO_TUYO"));
    assert.doesNotMatch(despues, /Enseñar el coche/);
  });

  test("dice que el coche lo ensena el, que es el modelo entero", () => {
    /*
     * El lo conserva y el lo ensena: eso es lo que hace que no le cobremos nada
     * por delante. No aparecia en ninguna lista de la guia.
     */
    assert.match(CODIGO, /Enseñar el coche cuando alguien venga a verlo/);
  });

  test("y que las franjas se gastan", () => {
    /*
     * Es lo unico que puede romper el anuncio sin que se entere: se reservan
     * las seis horas y el coche queda publicado sin poder visitarse. El
     * comentario de PASOS ya lo sabia -«las franjas al final, porque son lo
     * unico que caduca»- y nunca habia llegado al texto que lee el cliente.
     */
    // Un trozo contiguo: el texto va partido en dos lineas en la fuente.
    assert.match(CODIGO, /ya nadie puede pedir cita/);
  });

  test("no va en el paso de las franjas: alli todavia no hay anuncio", () => {
    // Avisar de un problema que aun no existe es ruido, y el ruido hace que se
    // lea menos lo que si importa en ese momento.
    const pasos = CODIGO.slice(CODIGO.indexOf("export const PASOS"), CODIGO.indexOf("export const DESPUES"));
    assert.doesNotMatch(pasos, /ya nadie puede pedir cita/);
  });

  test("sale en la pagina y en el documento que se descarga", () => {
    // Las dos cosas dicen lo mismo porque salen del mismo sitio; si una se
    // dejara fuera, el que se descarga la guia leeria una version distinta.
    assert.match(PAGINA, /LO_TUYO/);
    assert.match(PAGINA, /Y lo que sigue siendo tuyo/);
    assert.match(DOC, /lista\("Y lo que sigue siendo tuyo", LO_TUYO\)/);
  });
});
