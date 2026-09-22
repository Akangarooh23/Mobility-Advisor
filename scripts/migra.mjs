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
    try {
      await cliente.query("BEGIN");
      await cliente.query(p.texto);
      const tardo = Date.now() - empezo;
      await cliente.query(
        "INSERT INTO migraciones_aplicadas (nombre, huella, tardo_ms) VALUES ($1, $2, $3)",
        [p.f, p.huella, tardo]
      );
      await cliente.query("COMMIT");
      console.log(`  ✓ ${p.f}  (${tardo} ms)`);
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      console.error(`  ✗ ${p.f}\n     ${e.message}`);
      console.error("\n  No ha entrado nada de esa migración. Las anteriores sí.");
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
