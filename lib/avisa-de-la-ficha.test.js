/**
 * Que la ficha del cliente se lea sola.
 *
 * El lector vive en el ERP y se engancho a la subida de documentos **del ERP**,
 * que es el lado que no usa nadie: la ficha la sube el cliente desde su panel.
 * Por ese camino no se leia nunca, y seguia haciendo falta que alguien pulsara
 * un boton — que es justo lo que se venia a quitar. Este es el aviso que lo
 * cierra.
 *
 * Lo que mas se protege: que un ERP caido no rompa la subida del cliente. Su
 * coche ya esta guardado; perder la lectura es una molestia nuestra.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const AVISA = require("./avisa-de-la-ficha");

const fetchOriginal = global.fetch;
const entornoOriginal = { url: process.env.ERP_API_URL, secreto: process.env.INTERNAL_API_SECRET };

let llamadas;

beforeEach(() => {
  llamadas = [];
  process.env.ERP_API_URL = "https://erp.example.com";
  process.env.INTERNAL_API_SECRET = "un-secreto";
  global.fetch = async (url, opciones) => {
    llamadas.push({ url: String(url), opciones });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
});

afterEach(() => {
  global.fetch = fetchOriginal;
  process.env.ERP_API_URL = entornoOriginal.url ?? "";
  process.env.INTERNAL_API_SECRET = entornoOriginal.secreto ?? "";
});

const conFicha = { id: "veh-1", technicalSheetDocuments: [{ url: "https://almacen/ficha.pdf" }] };
const sinFicha = { id: "veh-1", technicalSheetDocuments: [], documents: [{ url: "https://almacen/otro.pdf" }] };

describe("cuando avisa", () => {
  test("al guardarse un coche con ficha técnica", async () => {
    await AVISA.avisaDeLaFicha(conFicha);
    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0].url, /\/api\/interno\/ficha-tecnica$/);
    assert.equal(JSON.parse(llamadas[0].opciones.body).vehicleId, "veh-1");
  });

  test("y va con el secreto compartido", () => {
    // Sin el, el ERP contesta 401: es la unica puerta que tiene esa ruta.
    return AVISA.avisaDeLaFicha(conFicha).then(() => {
      assert.equal(llamadas[0].opciones.headers.Authorization, "Bearer un-secreto");
    });
  });
});

describe("cuando no avisa", () => {
  test("si lo guardado no trae ficha técnica", async () => {
    /*
     * Se mira lo guardado y no lo que venia en la peticion: lo que viene puede
     * no haberse llegado a guardar, y avisar de una ficha que no existe pone al
     * ERP a buscarla para nada.
     */
    await AVISA.avisaDeLaFicha(sinFicha);
    assert.equal(llamadas.length, 0);
  });

  test("ni sin coche, ni sin nada", async () => {
    await AVISA.avisaDeLaFicha({ technicalSheetDocuments: [{ url: "x" }] });
    await AVISA.avisaDeLaFicha(null);
    await AVISA.avisaDeLaFicha(undefined);
    assert.equal(llamadas.length, 0);
  });

  test("ni sin ERP configurado, que en local no hay ninguno al lado", async () => {
    process.env.ERP_API_URL = "";
    await AVISA.avisaDeLaFicha(conFicha);
    assert.equal(llamadas.length, 0);
  });

  test("ni sin secreto: sin el no habria entrado igual", async () => {
    process.env.INTERNAL_API_SECRET = "";
    await AVISA.avisaDeLaFicha(conFicha);
    assert.equal(llamadas.length, 0);
  });
});

describe("y si el ERP falla, el cliente no se entera", () => {
  test("un error de red no revienta el guardado de su coche", async () => {
    global.fetch = async () => { throw new Error("ECONNREFUSED"); };
    await AVISA.avisaDeLaFicha(conFicha);   // no lanza
  });

  test("ni un 500 del otro lado", async () => {
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await AVISA.avisaDeLaFicha(conFicha);   // no lanza
  });

  test("y no se queda esperando para siempre", () => {
    /*
     * Un cliente mirando cómo se guarda su coche no puede esperar a que el
     * lector de otro sistema vaya lento. Ocho segundos y se sigue sin él.
     */
    assert.ok(AVISA.ESPERA_MS > 0 && AVISA.ESPERA_MS <= 10000);
  });
});

describe("saber si trae ficha", () => {
  test("una lista con algo sí, una vacía no", () => {
    assert.equal(AVISA.traeFichaTecnica(conFicha), true);
    assert.equal(AVISA.traeFichaTecnica(sinFicha), false);
    assert.equal(AVISA.traeFichaTecnica({}), false);
    assert.equal(AVISA.traeFichaTecnica(null), false);
  });
});

/**
 * Y que esté enganchado donde sube el cliente.
 *
 * Esto es el fallo que este trabajo vino a arreglar, escrito como prueba: la
 * lectura estaba enganchada a la subida del ERP, que es el lado que no usa
 * nadie, y **ninguna prueba se enteraba**. Todas las de arriba siguen pasando
 * con el aviso desconectado del manejador: comprueban que avisa bien, no que
 * se llame a avisar.
 *
 * Se lee el fuente porque lo que se protege es el cableado. Montar el manejador
 * para esto necesita una base entera, y aun así habría que acordarse de mirar
 * que no se llamó — que es justo lo que no se miró.
 */
describe("el enganche, que es lo que se rompió", () => {
  const MANEJADOR = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "api", "billing-account-handler.js"), "utf8",
  );

  test("se avisa al guardar el coche del cliente", () => {
    assert.match(MANEJADOR, /avisaDeLaFicha\(/, "nadie llama a avisar de la ficha");
  });

  test("y va en la rama que guarda el garaje, no en otra", () => {
    const rama = MANEJADOR.indexOf('action === "garage_add"');
    const aviso = MANEJADOR.indexOf("avisaDeLaFicha(persistedVehicle)");
    assert.ok(rama > 0, "no encuentro dónde se guarda el coche del cliente");
    assert.ok(aviso > rama, "el aviso no está en la rama que guarda el coche");
  });

  test("y se espera: en Vercel lo que no se espera se corta", () => {
    /*
     * Una promesa suelta después de responder no se ejecuta: la función se
     * apaga en cuanto contesta. El aviso saldría a veces sí y a veces no, que
     * es peor que no salir nunca porque nadie lo investiga.
     */
    assert.match(MANEJADOR, /await avisaDeLaFicha\(/);
  });
});
