/**
 * Las series de facturación y lo que una rectificativa tiene que decir.
 *
 * Estaban en tres sitios y ninguno sabía de los otros: la de importación en el
 * webhook, la de rectificativas en el manejador de devoluciones, y la de los
 * informes de tasación no era una serie —era el final del identificador de la
 * sesión de Stripe pegado a un año, que parece un número de factura y no lo es—.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  SERIES, siguienteNumeroDeFactura, referenciaALaOriginal,
  TITULO_RECTIFICATIVA, faltaParaRectificar, ENSURE_RECTIFICATIVA,
} = require("./series-de-factura.js");

/** Un pool de mentira que cuenta como el de verdad, sin base. */
function contador() {
  const cuenta = new Map();
  return {
    pedidas: [],
    async query(sql, params) {
      const [serie, year] = params;
      const clave = `${serie}-${year}`;
      const n = (cuenta.get(clave) || 0) + 1;
      cuenta.set(clave, n);
      this.pedidas.push({ sql, serie, year });
      return { rows: [{ last_n: n }] };
    },
  };
}

describe("una serie por servicio", () => {
  test("cada servicio tiene la suya, y no se repiten", () => {
    // Lo pidió el asesor: «hay que tener serie por cada servicio que damos».
    const prefijos = Object.values(SERIES);
    assert.equal(new Set(prefijos).size, prefijos.length, "hay dos servicios con el mismo prefijo");
    assert.equal(SERIES.importacion, "SRV");
    assert.equal(SERIES.tasacion, "TAS");
    assert.equal(SERIES.rectificativa, "RECT");
  });

  test("la de las fianzas se queda reservada aunque ya no se use", () => {
    // El modelo ya no tiene fianzas, pero sus facturas existen: si alguien
    // reutiliza el prefijo para otra cosa, esa serie deja de ser correlativa.
    assert.equal(SERIES.fianza, "FIA");
  });

  test("los números van de uno en uno dentro de su serie y su año", () => {
    const pool = contador();
    return Promise.all([]).then(async () => {
      const uno = await siguienteNumeroDeFactura(pool, SERIES.importacion, new Date("2026-03-01"));
      const dos = await siguienteNumeroDeFactura(pool, SERIES.importacion, new Date("2026-11-30"));
      assert.equal(uno, "SRV-2026-0001");
      assert.equal(dos, "SRV-2026-0002");
    });
  });

  test("y cada serie lleva su propia cuenta", async () => {
    const pool = contador();
    await siguienteNumeroDeFactura(pool, SERIES.importacion, new Date("2026-03-01"));
    const primera = await siguienteNumeroDeFactura(pool, SERIES.tasacion, new Date("2026-03-01"));
    assert.equal(primera, "TAS-2026-0001", "la de tasación empieza por uno, no por dos");
  });

  test("el año reinicia la cuenta", async () => {
    const pool = contador();
    await siguienteNumeroDeFactura(pool, SERIES.importacion, new Date("2026-12-31"));
    const enero = await siguienteNumeroDeFactura(pool, SERIES.importacion, new Date("2027-01-01"));
    assert.equal(enero, "SRV-2027-0001");
  });

  test("el número se pide con un INSERT que no se puede duplicar", async () => {
    /*
     * Dos cobros a la vez no pueden llevarse el mismo número. Con un SELECT y
     * un UPDATE aparte, se lo llevan: el `ON CONFLICT DO UPDATE` de Postgres es
     * lo que lo hace atómico, y un número repetido no es un fallo cosmético,
     * es una factura inválida.
     */
    const pool = contador();
    await siguienteNumeroDeFactura(pool, SERIES.importacion);
    assert.match(pool.pedidas[0].sql, /ON CONFLICT \(series, year\) DO UPDATE/);
  });
});

describe("lo que una rectificativa tiene que decir", () => {
  test("a cuál rectifica, con su número y su fecha", () => {
    assert.equal(
      referenciaALaOriginal({ numero: "SRV-2026-0001", fecha: "2026-09-03T10:00:00Z" }),
      "Rectificación de la factura SRV-2026-0001 de fecha 3/9/2026"
    );
  });

  test("y sin fecha, al menos el número", () => {
    // Una devolución de algo que se facturó antes de que esto existiera.
    assert.equal(
      referenciaALaOriginal({ numero: "SRV-2026-0001" }),
      "Rectificación de la factura SRV-2026-0001"
    );
  });

  test("sin original no se inventa una referencia", () => {
    assert.equal(referenciaALaOriginal({}), "");
    assert.equal(referenciaALaOriginal({ numero: "   " }), "");
  });

  test("el texto va en el encabezado y se lee de un vistazo", () => {
    assert.equal(TITULO_RECTIFICATIVA, "FACTURA RECTIFICATIVA");
  });

  test("y se dice qué falta, en vez de un sí o un no", () => {
    // Una rectificativa a medias se emite igual y el problema aparece meses
    // después, cuando alguien intenta casarla con la que corrige.
    assert.deepEqual(faltaParaRectificar({}), [
      "a qué factura rectifica",
      "la fecha de la factura original",
      "el motivo de la rectificación",
    ]);
    assert.deepEqual(faltaParaRectificar({
      rectifica_numero: "SRV-2026-0001",
      rectifica_fecha: "2026-09-03",
      rectifica_motivo: "Devolución de la fianza",
    }), []);
  });

  test("las columnas se crean solas, como el resto del esquema", () => {
    // Nadie corre migraciones a mano en este proyecto.
    assert.match(ENSURE_RECTIFICATIVA, /ADD COLUMN IF NOT EXISTS rectifica_numero/);
    assert.match(ENSURE_RECTIFICATIVA, /ADD COLUMN IF NOT EXISTS rectifica_fecha/);
    assert.match(ENSURE_RECTIFICATIVA, /ADD COLUMN IF NOT EXISTS rectifica_motivo/);
  });
});

/**
 * Y que nadie vuelva a numerar por su cuenta.
 *
 * Esto se comprueba leyendo el código: lo que hay que sostener no es un
 * resultado sino que **el contador sea uno**. Tres sitios numerando es como
 * estaba, y así es como una serie deja de ser correlativa sin que nadie lo vea.
 */
describe("nadie numera por su cuenta", () => {
  const lee = (p) => fs.readFileSync(path.join(__dirname, p), "utf8");

  for (const fichero of ["api/billing-webhook-handler.js", "api/fianza-devolucion-handler.js"]) {
    test(`${fichero} pide el número al contador compartido`, () => {
      const fuente = lee(fichero);
      assert.match(fuente, /require\("\.\.\/series-de-factura\.js"\)/);
      assert.ok(!/INSERT INTO moveadvisor_invoice_counters/.test(fuente),
        "vuelve a llevar su propio contador");
    });
  }

  test("y ningún número de factura sale del identificador de Stripe", () => {
    /*
     * La regla, no la fórmula que había.
     *
     * Los informes de tasación se numeraban con los seis últimos caracteres de
     * la sesión de Stripe pegados a un año. Eso parece un número de factura y
     * no lo es: no es correlativo, tiene huecos por definición y dos sesiones
     * pueden acabar igual.
     *
     * Se mira cada sitio donde se decide un número, en vez de buscar la cadena
     * concreta: escrita de otra manera, el mismo fallo volvería a pasar.
     */
    const lineas = lee("api/billing-webhook-handler.js").split("\n");
    // La asignación puede ocupar varias líneas, así que se mira el trozo.
    const donde = lineas
      .map((l, i) => (/invoiceNum\s*=/.test(l) ? lineas.slice(i, i + 4).join(" ") : null))
      .filter(Boolean);
    assert.ok(donde.length, "no encuentro dónde se numeran las facturas");
    for (const trozo of donde) {
      assert.ok(!/sessionId|session\.id/.test(trozo),
        `un número de factura sale de Stripe: ${trozo.trim().slice(0, 90)}`);
    }
    assert.ok(donde.some((t) => /siguienteNumeroDeFactura/.test(t)),
      "ninguno pide su número al contador");
  });
});
