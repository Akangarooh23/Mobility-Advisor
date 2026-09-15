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
  test("un PDF o una foto del papel", () => {
    for (const t of ["application/pdf", "image/jpeg", "image/png"]) {
      assert.equal(M.esUnTipoQueVale(t), true, t);
    }
  });

  test("y nada más", () => {
    // Un .docx no es un papel firmado, es el borrador otra vez.
    for (const t of ["application/msword", "text/plain", "", null]) {
      assert.equal(M.esUnTipoQueVale(t), false, String(t));
    }
  });

  test("se dice POR QUÉ no vale, no solo que no vale", () => {
    // «No se puede subir» a secas hace que vuelva a intentarlo con el mismo
    // fichero.
    assert.match(M.porQueNoSePuedeSubir({ tipo: "text/plain", tamano: 100 }), /PDF o una foto/);
    assert.match(M.porQueNoSePuedeSubir({ tipo: "application/pdf", tamano: 0 }), /vacío/);
    assert.match(
      M.porQueNoSePuedeSubir({ tipo: "application/pdf", tamano: M.TAMANO_MAXIMO + 1 }),
      /pesa demasiado/
    );
  });

  test("y uno bueno no da ningún motivo", () => {
    assert.equal(M.porQueNoSePuedeSubir({ tipo: "application/pdf", tamano: 120000 }), "");
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

  test("y el plazo arranca en la misma sentencia", () => {
    /*
     * Dos escrituras separadas se quedan a medias el día que una falle, y
     * entonces hay un encargo firmado sin plazo: no se le podría cobrar la
     * cancelación nunca.
     */
    assert.match(M.SQL_MARCA_FIRMADO, /libre_desde = CASE WHEN acepto_el_precio/);
    assert.match(M.SQL_MARCA_FIRMADO, /INTERVAL '30 days'/);
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
