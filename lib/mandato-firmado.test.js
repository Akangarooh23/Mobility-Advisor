"use strict";

/**
 * El mandato que sube el cliente firmado.
 *
 * Lo que se protege: que **la fecha de la primera firma no se reescriba** —es la
 * que hace correr los 30 días— y que las dos cifras que están escritas aquí y
 * en el ERP digan lo mismo.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const M = require("./mandato-firmado");

describe("qué se acepta", () => {
  test("PDF, Word y fotos del papel", () => {
    /*
     * Word está porque el mandato se le manda como `.doc`: pedirle que lo
     * devuelva en otro formato es pedirle una conversión, y ahí es donde la
     * gente lo deja para luego.
     */
    for (const t of [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png",
    ]) {
      assert.equal(M.esUnTipoQueVale(t), true, t);
    }
  });

  test("y por extensión también, que es lo que de verdad aguanta", () => {
    /*
     * El navegador no siempre sabe decir el tipo de un `.doc`. Y el nuestro es
     * HTML con extensión `.doc` —para que Word lo abra—, así que al
     * devolvérnoslo tal cual puede llegar como `text/html`. Rechazarle por eso
     * el papel que acaba de firmar sería culparle de cómo su sistema etiqueta
     * un fichero.
     */
    for (const n of ["mandato.doc", "mandato.docx", "MANDATO.DOCX", "x.odt", "x.rtf", "x.pdf"]) {
      assert.equal(M.esUnaExtensionQueVale(n), true, n);
    }
    assert.equal(M.porQueNoSePuedeSubir({ tipo: "text/html", nombre: "mandato.doc", tamano: 5000 }), "");
    assert.equal(M.porQueNoSePuedeSubir({ tipo: "", nombre: "mandato.docx", tamano: 5000 }), "");
  });

  test("pero un archivo que no es un documento no cuela", () => {
    // Ni por tipo ni por extensión: las dos puertas tienen que fallar.
    assert.match(
      M.porQueNoSePuedeSubir({ tipo: "application/zip", nombre: "cosas.zip", tamano: 100 }),
      /PDF, Word o una foto/
    );
    assert.match(
      M.porQueNoSePuedeSubir({ tipo: "text/plain", nombre: "notas.txt", tamano: 100 }),
      /PDF, Word o una foto/
    );
  });

  test("se dice POR QUÉ no vale, no solo que no vale", () => {
    // «No se puede subir» a secas hace que vuelva a intentarlo con el mismo
    // fichero.
    assert.match(M.porQueNoSePuedeSubir({ tipo: "application/pdf", nombre: "x.pdf", tamano: 0 }), /vacío/);
    assert.match(
      M.porQueNoSePuedeSubir({ tipo: "application/pdf", nombre: "x.pdf", tamano: M.TAMANO_MAXIMO + 1 }),
      /pesa demasiado/
    );
  });

  test("y uno bueno no da ningún motivo", () => {
    assert.equal(M.porQueNoSePuedeSubir({ tipo: "application/pdf", nombre: "x.pdf", tamano: 120000 }), "");
  });

  test("ocho megas, que una foto de móvil pasa de cuatro", () => {
    // Rechazarle el papel por el tamaño despues de haberlo firmado es la peor
    // forma de perder un mandato.
    assert.equal(M.TAMANO_MAXIMO, 8 * 1024 * 1024);
  });
});

describe("quién puede subirlo", () => {
  test("se busca por su correo, no solo por el identificador", () => {
    /*
     * El identificador viaja por la red y no prueba nada. Lo que autoriza a
     * subir el mandato de un encargo es ser el dueño de ese encargo.
     */
    assert.match(M.SQL_SU_ENCARGO, /lower\(e\.cliente_email\) = lower\(\$2\)/);
  });

  test("y un encargo cerrado no acepta papeles", () => {
    assert.match(M.SQL_SU_ENCARGO, /e\.cerrado_at IS NULL/);
  });
});

describe("lo que pasa al subirlo", () => {
  test("la fecha de la primera firma no se reescribe", () => {
    /*
     * Es la que hace correr los 30 días. Subirlo dos veces —porque la primera
     * salió mal la foto— no puede mover el plazo.
     */
    assert.match(M.SQL_MARCA_FIRMADO, /firmado_at IS NULL/);
  });

  test("queda apuntado que lo subió él, no que lo marcamos nosotros", () => {
    assert.equal(M.FIRMA_COMO, "subido_por_el");
    assert.match(M.SQL_MARCA_FIRMADO, /firma_como = 'subido_por_el'/);
  });

  test("y el plazo no arranca al firmar, sino al publicar", () => {
    /*
     * Los 30 días son de venta: hasta que el coche está anunciado no corren.
     * Firmar el mandato y esperar tres semanas al taller no le gasta el mes.
     */
    assert.match(M.SQL_MARCA_FIRMADO, /libre_desde = CASE WHEN acepto_el_precio AND publicado_at IS NOT NULL/);
    assert.match(M.SQL_MARCA_FIRMADO, /publicado_at \+ INTERVAL '30 days'/);
    assert.doesNotMatch(M.SQL_MARCA_FIRMADO, /NOW\(\) \+ INTERVAL/);
  });

  test("y solo si aceptó el precio: si no, no hay plazo que contar", () => {
    // Al que no acepta la cláusula se le cobra desde el día uno, así que
    // `libre_desde` no existe para él.
    assert.match(M.SQL_MARCA_FIRMADO, /ELSE NULL END/);
  });

  test("el documento se guarda donde el ERP lo enseña", () => {
    assert.match(M.SQL_GUARDA_DOCUMENTO, /INSERT INTO erp_documentos/);
    assert.match(M.SQL_GUARDA_DOCUMENTO, /'encargo'/);
    assert.match(M.SQL_GUARDA_DOCUMENTO, /'mandato_firmado'/);
  });
});

/**
 * Y que no se separe del ERP.
 *
 * Las dos cifras viven allí. Aquí están repetidas porque son dos repositorios
 * que no se pueden importar; esta prueba lee **su código** y las compara.
 */
describe("no se separa del ERP", () => {
  const ERP = path.join(__dirname, "..", "..", "carswise-erp-backoffice", "apps", "api", "src", "lib");
  const hayErp = fs.existsSync(ERP);

  test("los 30 días son los suyos", (t) => {
    if (!hayErp) return t.skip("el ERP no está al lado");
    const src = fs.readFileSync(path.join(ERP, "encargo-de-venta.ts"), "utf8");
    const m = src.match(/export const DIAS_HASTA_SALIR_GRATIS = (\d+)/);
    assert.ok(m, "no encuentro DIAS_HASTA_SALIR_GRATIS en el ERP");
    assert.equal(M.DIAS_HASTA_SALIR_GRATIS, Number(m[1]));
    assert.match(M.SQL_MARCA_FIRMADO, new RegExp(`INTERVAL '${m[1]} days'`));
  });

  test("y el nombre de la firma es uno que el ERP entiende", (t) => {
    if (!hayErp) return t.skip("el ERP no está al lado");
    /*
     * Si aquí se escribiera otro, el encargo quedaría firmado con un valor que
     * la pantalla del ERP no sabe traducir: saldría en blanco o en crudo.
     */
    const src = fs.readFileSync(path.join(ERP, "mandato-de-venta.ts"), "utf8");
    const m = src.match(/export const LA_QUE_SUBE_EL: ComoSeFirma = '([a-z_]+)'/);
    assert.ok(m, "no encuentro LA_QUE_SUBE_EL en el ERP");
    assert.equal(M.FIRMA_COMO, m[1]);
  });
});
