"use strict";

/**
 * Nada borra sin pedir permiso.
 *
 * ## Qué había
 *
 * De ocho guiones destructivos en `scripts/`, **tres no pedían nada**. Y el peor
 * era el peor de todo el repositorio:
 *
 * `scripts/reset-market-offers-canonical.js` terminaba en un
 * `(async () => { … })()`, así que bastaba con `node scripts/reset-…` —sin
 * argumentos, sin bandera, sin confirmación— para hacer
 * `DELETE FROM moveadvisor_market_offers`: **2,8 millones de filas, 6,7 GB, el
 * 88% de la base**. Y reponía **42 filas** escritas a mano en el propio fichero.
 *
 * Lee `DATABASE_URL`, que en la máquina de trabajo apunta a producción. Y va
 * dentro de una transacción, así que **funciona perfectamente**: el desastre es
 * el éxito, no el fallo.
 *
 * ## Por qué se borraron dos en vez de protegerlos
 *
 * Porque no tenían propósito. Al mirar de dónde venían:
 *
 *   · **`reset-market-offers-canonical.js`** era de **mayo**, de cuando la base
 *     principal era SQL Server, y su trabajo era mantener las dos bases «en
 *     paridad» con 42 ofertas de demostración. Entonces la tabla tenía 42 filas y
 *     borrarla era correcto. Hoy tiene 2,8 millones de filas reales, usa `sqlcmd`
 *     contra una base que no existe, y nadie lo llamaba;
 *   · **`cleanup-test-users-sqlserver.js`** era de abril y todo él SQL Server:
 *     inalcanzable.
 *
 * Un guion con confirmación seguiría siendo un arma en el cajón. Lo que no está
 * no se puede disparar.
 *
 * ## Y el tercero, que era peor de lo que parecía
 *
 * `drop-erp-appointments-main-db.js` hacía `DROP TABLE erp_appointments`. Yo
 * mismo dije primero que tiraba una tabla vacía —y por tanto inocua—. Al
 * mirarlo de verdad:
 *
 *   · `api/erp-appointment.js` hace `INSERT INTO erp_appointments`;
 *   · `user-erp-appointments-handler.js` lee de ella con `elPoolObligatorio()`,
 *     o sea **la base principal**.
 *
 * El commit que lo acompañaba (16-jul) decía «erp-appointment usa
 * `ERP_DATABASE_URL` + schema ERP real», pero **`ERP_DATABASE_URL` no existe** ni
 * en `.env.example` ni en `.env.local`. Esa mudanza nunca se completó, así que el
 * guion limpiaba el rastro de algo que no pasó y ejecutarlo habría roto las citas
 * de mantenimiento. Está vacía solo porque nadie ha pedido una todavía.
 *
 * **Queda una decisión abierta**: si el ERP debía tener su propia base. Hay un
 * commit que dice que sí y una variable que no existe.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const GUIONES = path.join(RAIZ, "scripts");

/** Lo que destruye datos sin poder deshacerse. */
const DESTRUYE = /\bDROP\s+TABLE\b|\bTRUNCATE\b|DELETE\s+FROM\s+[a-z_.]+\s*(?:;|`|"|')/i;

/**
 * Lo que cuenta como pedir permiso.
 *
 * Una bandera explícita en la línea de órdenes, o una pregunta por consola. Lo
 * que NO cuenta es un `if` sobre una variable de entorno: eso no lo escribe nadie
 * a mano en el momento de ejecutar.
 */
const PIDE_PERMISO = /process\.argv|readline|createInterface|prompt\(/;

function losGuiones() {
  return fs
    .readdirSync(GUIONES)
    .filter((n) => n.endsWith(".js") || n.endsWith(".mjs"))
    .map((n) => path.join(GUIONES, n));
}

describe("los guiones que destruyen datos piden permiso", () => {
  test("todos, sin excepción", () => {
    const sinFreno = [];

    for (const fichero of losGuiones()) {
      const fuente = fs.readFileSync(fichero, "utf8");
      if (!DESTRUYE.test(fuente)) continue;
      if (PIDE_PERMISO.test(fuente)) continue;

      sinFreno.push(path.basename(fichero));
    }

    assert.deepEqual(
      sinFreno,
      [],
      "un guion borra datos sin pedir permiso.\n" +
        "  Ponle una bandera explícita —como `--borra` en delete-leasys-offers— que\n" +
        "  sin ella cuente lo que haría, diga a qué base apunta y se pare.\n" +
        "  Y antes de eso, pregúntate si el guion tiene propósito: dos de los tres\n" +
        "  que había no lo tenían, y se borraron."
    );
  });

  test("y los tres sin propósito ya no están", () => {
    /*
     * Por nombre, para que volver a añadirlos cueste verlo. Si alguien los
     * recupera del historial y hay un motivo nuevo, que quite la línea a
     * sabiendas.
     */
    for (const fuera of [
      "reset-market-offers-canonical.js",
      "cleanup-test-users-sqlserver.js",
      "drop-erp-appointments-main-db.js",
    ]) {
      assert.ok(!fs.existsSync(path.join(GUIONES, fuera)), `${fuera} ha vuelto`);
    }
  });

  test("ni los llama package.json", () => {
    // `cleanup:test-users-local` apuntaba a uno de ellos.
    const paquete = fs.readFileSync(path.join(RAIZ, "package.json"), "utf8");

    for (const fuera of ["reset-market-offers-canonical", "cleanup-test-users-sqlserver", "drop-erp-appointments-main-db"]) {
      assert.ok(!paquete.includes(fuera), `package.json todavía llama a ${fuera}`);
    }
  });
});

describe("y el de leasys, que sí tiene trabajo pendiente", () => {
  const LEASYS = fs.readFileSync(path.join(GUIONES, "delete-leasys-offers.js"), "utf8");

  test("sin la bandera no borra", () => {
    assert.match(LEASYS, /const BORRA_DE_VERDAD = process\.argv\.includes\("--borra"\)/);
    assert.match(LEASYS, /if \(!BORRA_DE_VERDAD\)/);
  });

  test("y dice a qué base apunta antes de nada", () => {
    /*
     * Es el dato que de verdad importa antes de borrar: en esta máquina
     * `DATABASE_URL` apunta a producción. Sin la contraseña, solo el servidor.
     */
    assert.match(LEASYS, /Se borrarían \$\{total\} ofertas de/);
    assert.match(LEASYS, /u\.hostname/);
    assert.ok(!LEASYS.includes("u.password"), "no debe escribir la contraseña");
  });

  test("y cuenta antes de decidir", () => {
    // Si no hay ninguna, no hace falta ni preguntar.
    const cuenta = LEASYS.indexOf("SELECT COUNT(*)");
    const decide = LEASYS.indexOf("if (!BORRA_DE_VERDAD)");
    assert.ok(cuenta > 0 && decide > 0 && cuenta < decide);
  });
});
