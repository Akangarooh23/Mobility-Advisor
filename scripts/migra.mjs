/**
 * Aplica las migraciones que falten, en orden, y apunta cuáles han ido.
 *
 * La regla, que es toda la gracia: **el esquema se cambia aquí y en ningún otro
 * sitio**. Nada de `CREATE TABLE IF NOT EXISTS` escondido dentro del manejador
 * de una pantalla, que es como estaba y por eso nadie sabía qué había en la
 * base sin arrancar la aplicación entera.
 *
 * Cómo se usa:
 *
 *   npm run migra            → aplica lo que falte
 *   npm run migra -- --mirar → dice qué falta, sin tocar nada
 *
 * Cada fichero se aplica **dentro de una transacción**: o entra entero o no
 * entra. Y se guarda su huella, así que si alguien edita una migración que ya
 * se aplicó, esto lo dice en vez de callarse: lo que corre en producción ya no
 * sería lo que pone el fichero.
 *
 * **Con una excepción**: las que llevan `CONCURRENTLY` van sin transacción,
 * porque Postgres no permite `CREATE INDEX CONCURRENTLY` dentro de un `BEGIN`.
 * Antes fallaban siempre —y al aplicarse en orden, bloqueaban a las siguientes—.
 * El precio es que ésas no tienen vuelta atrás: si una falla, puede quedar un
 * índice inválido y hay que tirarlo a mano. El error lo explica cuando pasa.
 *
 * Y a ésas se les mandan **las sentencias de una en una**, porque Postgres
 * envuelve en una transacción implícita todo lo que llega en un mismo envío:
 * saltarse el BEGIN no basta si el fichero tiene dos. Ver
 * `lib/las-sentencias-de-una-migracion.js`, que es quien sabe dónde acaba
 * cada una.
 *
 * Los ficheros viven en `migrations/`, se llaman `NNNN-lo-que-hace.sql` y se
 * aplican por orden de nombre. El 0001 es la foto de lo que ya había.
 *
 * **Una sola base para los tres sitios.** La web, la app y el ERP escriben en
 * la misma base de Neon, así que las migraciones de todo viven aquí, también
 * las de las tablas `erp_`.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import { lasSentencias, vaSinTransaccion } from "../lib/las-sentencias-de-una-migracion.js";

/**
 * Una sentencia en una línea, para decir por cuál va.
 *
 * Sin los comentarios, que es lo que ocupa: la cabecera de una migración
 * nuestra son veinte líneas de explicación y una de SQL.
 */
function enUnaLinea(sentencia) {
  const limpia = sentencia
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpia.length > 72 ? limpia.slice(0, 69) + "..." : limpia;
}

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CARPETA = path.join(RAIZ, "migrations");
const SOLO_MIRAR = process.argv.includes("--mirar");

function delEntorno(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  const fichero = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(fichero)) return "";
  const l = fs.readFileSync(fichero, "utf8").split(/\r?\n/).filter((x) => x.startsWith(nombre + "="));
  return l.length ? l[l.length - 1].slice(nombre.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const cadena = delEntorno("DATABASE_URL") || delEntorno("POSTGRES_URL");
if (!cadena) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const huellaDe = (texto) => crypto.createHash("sha256").update(texto).digest("hex").slice(0, 16);

const LA_CUENTA = `
  CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
    nombre      TEXT PRIMARY KEY,
    huella      TEXT NOT NULL,
    aplicada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tardo_ms    INTEGER NOT NULL DEFAULT 0
  )`;

async function main() {
  const pool = new pg.Pool({ connectionString: cadena });
  await pool.query(LA_CUENTA);

  const { rows: yaEstan } = await pool.query("SELECT nombre, huella FROM migraciones_aplicadas");
  const aplicadas = new Map(yaEstan.map((r) => [r.nombre, r.huella]));

  const ficheros = fs.existsSync(CARPETA)
    ? fs.readdirSync(CARPETA).filter((f) => f.endsWith(".sql")).sort()
    : [];

  const pendientes = [];
  const cambiadas = [];
  for (const f of ficheros) {
    const texto = fs.readFileSync(path.join(CARPETA, f), "utf8");
    const huella = huellaDe(texto);
    if (!aplicadas.has(f)) pendientes.push({ f, texto, huella });
    else if (aplicadas.get(f) !== huella) cambiadas.push(f);
  }

  if (cambiadas.length) {
    console.error("\n⚠ Estas migraciones se han tocado DESPUÉS de aplicarse:");
    for (const f of cambiadas) console.error("   " + f);
    console.error("Lo que corre en la base ya no es lo que pone el fichero. Lo que hay que");
    console.error("hacer es escribir una migración nueva, no reescribir la vieja.\n");
    await pool.end();
    process.exit(1);
  }

  console.log(`${ficheros.length} migraciones en total, ${aplicadas.size} ya aplicadas.`);
  if (!pendientes.length) {
    console.log("No falta ninguna.");
    await pool.end();
    return;
  }

  console.log(`\nFaltan ${pendientes.length}:`);
  for (const p of pendientes) console.log("   " + p.f);

  if (SOLO_MIRAR) {
    console.log("\nEsto era solo mirar. Sin --mirar se aplican.");
    await pool.end();
    return;
  }

  for (const p of pendientes) {
    const cliente = await pool.connect();
    const empezo = Date.now();
    /*
     * `CREATE INDEX CONCURRENTLY` NO puede ir dentro de una transacción.
     *
     * Postgres lo rechaza con «cannot run inside a transaction block», y como
     * esto aplicaba todo dentro de un BEGIN, una migración con CONCURRENTLY
     * fallaba siempre —y al ir en orden, bloqueaba también a las siguientes—.
     * Es lo que pasó con la 0015: llevaba días sin poder aplicarse, y con ella
     * la 0016.
     *
     * Y CONCURRENTLY no es un capricho: sin él, crear un índice en una tabla
     * grande toma un bloqueo que para las escrituras, y `moveadvisor_market_offers`
     * es la tabla del buscador. Así que lo que se cambia es esto y no la
     * migración.
     */
    const aSolas = vaSinTransaccion(p.texto);

    try {
      if (!aSolas) await cliente.query("BEGIN");

      if (aSolas) {
        /*
         * De una en una, y ésta es la parte que costó un error desconcertante.
         *
         * Postgres mete **varias sentencias de un mismo envío en una
         * transacción implícita**, aunque nadie escriba BEGIN. Así que una
         * migración con dos CONCURRENTLY fallaba con «cannot run inside a
         * transaction block» en un fichero donde no hay ninguna transacción, y
         * mandaba a buscar el BEGIN que no existe. Pasó con la 0024, que crea
         * el índice nuevo y tira el viejo.
         *
         * Mandadas una a una no hay envoltorio que valga. Y de paso se puede
         * ir diciendo por cuál va: un índice sobre millones de filas tarda
         * minutos, y una pantalla callada no se distingue de una colgada.
         */
        const sentencias = lasSentencias(p.texto);
        for (let n = 0; n < sentencias.length; n += 1) {
          if (sentencias.length > 1) {
            console.log(`     ${n + 1}/${sentencias.length}  ${enUnaLinea(sentencias[n])}`);
          }
          await cliente.query(sentencias[n]);
        }
      } else {
        await cliente.query(p.texto);
      }
      const tardo = Date.now() - empezo;
      await cliente.query(
        "INSERT INTO migraciones_aplicadas (nombre, huella, tardo_ms) VALUES ($1, $2, $3)",
        [p.f, p.huella, tardo]
      );
      if (!aSolas) await cliente.query("COMMIT");
      console.log(`  ✓ ${p.f}  (${tardo} ms)${aSolas ? "  [sin transacción: CONCURRENTLY]" : ""}`);
    } catch (e) {
      if (!aSolas) await cliente.query("ROLLBACK").catch(() => {});
      console.error(`  ✗ ${p.f}\n     ${e.message}`);

      if (aSolas) {
        /*
         * Sin transacción no hay vuelta atrás, y un CONCURRENTLY que falla deja
         * el índice **inválido** —existiendo pero sin usarse—. Y como existe, un
         * `IF NOT EXISTS` lo daría por hecho en el siguiente intento y lo dejaría
         * inválido para siempre, en silencio. Hay que tirarlo a mano.
         */
        console.error(
          "\n  Esa migración va SIN transacción, porque lleva CONCURRENTLY, y\n" +
          "  sus sentencias se mandan de una en una. Así que **las de antes de\n" +
          "  la que ha fallado se han aplicado** y no se deshacen solas: mira\n" +
          "  arriba por cuál iba.\n\n" +
          "  Y puede haber quedado un índice inválido. Míralo con:\n\n" +
          "    SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;\n\n" +
          "  Y si sale alguno, tíralo antes de volver a intentarlo:\n\n" +
          "    DROP INDEX CONCURRENTLY <el que salga>;\n\n" +
          "  Un IF NOT EXISTS no lo arregla: el índice inválido existe, así que\n" +
          "  el siguiente intento lo daría por bueno y se quedaría así."
        );
      } else {
        console.error("\n  No ha entrado nada de esa migración. Las anteriores sí.");
      }

      cliente.release();
      await pool.end();
      process.exit(1);
    }
    cliente.release();
  }

  console.log("\nAl día.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
