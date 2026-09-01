/**
 * Nada de comentarios de JavaScript dentro de una consulta SQL.
 *
 * Pasó de verdad, y tumbó el circuito entero: al arreglar otra cosa se colaron
 * dos líneas de `//` dentro de la consulta que busca la oferta. En SQL `//` no
 * es un comentario, así que Postgres contestaba
 *
 *     syntax error at or near "siga"
 *
 * y **no se podía pedir ningún coche**. El fallo no lo vio ninguna prueba porque
 * las que tocan esa consulta usan un simulacro: el simulacro no analiza SQL, así
 * que una consulta rota le parece igual de buena que una entera.
 *
 * Esto se mira sobre el código, que es donde está el problema. Un comentario en
 * una consulta se escribe con `--`, y lo normal es ponerlo fuera.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

/**
 * Las consultas de un fichero: los trozos entre acentos graves que **empiezan**
 * por una palabra de SQL.
 *
 * Se pide que empiecen para no coger de paso un texto cualquiera que mencione
 * un SELECT, que era lo que hacía saltar la alarma en ficheros sanos.
 */
function consultasDe(fuente) {
  const trozos = fuente.match(/`[^`]*`/g) || [];
  return trozos.filter((t) => /^`\s*(WITH|SELECT|INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i.test(t));
}

const CARPETA = __dirname;
const FICHEROS = fs.readdirSync(CARPETA)
  .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));

describe("las consultas SQL no llevan comentarios de JavaScript", () => {
  test("en ninguno de los manejadores", () => {
    const malos = [];
    for (const f of FICHEROS) {
      const fuente = fs.readFileSync(path.join(CARPETA, f), "utf8");
      for (const q of consultasDe(fuente)) {
        const linea = q.split("\n").find((l) => /^\s*\/\//.test(l));
        if (linea) malos.push(`${f}: ${linea.trim().slice(0, 60)}`);
      }
    }
    assert.deepEqual(malos, [],
      "hay un comentario de JavaScript dentro de una consulta: Postgres la rechaza entera");
  });

  test("y la que se rompió sigue entera", () => {
    // La consulta que busca la oferta al pedir un coche. Es la que se rompió, y
    // es la que deja el circuito sin arrancar si se vuelve a romper.
    const fuente = fs.readFileSync(path.join(CARPETA, "import-lead-handler.js"), "utf8");
    const oferta = consultasDe(fuente).find((q) => /FROM moveadvisor_market_offers/.test(q));
    assert.ok(oferta, "no encuentro la consulta de la oferta");
    assert.ok(!oferta.includes("//"), "vuelve a haber un // dentro");
    assert.match(oferta, /COALESCE\(is_active, TRUE\) = TRUE/,
      "y sigue sin ofrecer coches vendidos");
  });
});

/**
 * El detector no puede gritar por todo.
 *
 * Un comentario **encima** de una consulta es correcto y hay decenas. Si la
 * comprobación los diera por malos, se apagaría a la semana.
 */
describe("y no se queja de lo que está bien", () => {
  test("un comentario encima de la consulta no cuenta", () => {
    const sano = [
      "// Esto sí es un comentario, y está donde va.",
      "const r = await pool.query(`SELECT 1 FROM tabla`);",
    ].join("\n");
    assert.deepEqual(consultasDe(sano).filter((q) => /^\s*\/\//m.test(q)), []);
  });

  test("ni un texto que hable de un SELECT sin serlo", () => {
    const texto = "const ayuda = `escribe un SELECT aquí\\n// y comenta lo que quieras`;";
    assert.deepEqual(consultasDe(texto), []);
  });

  test("pero uno dentro sí", () => {
    const roto = "await q(`SELECT a\n // esto revienta\n FROM t`);";
    assert.equal(consultasDe(roto).length, 1);
    assert.ok(/^\s*\/\//m.test(consultasDe(roto)[0]));
  });
});
