/**
 * Les pone nombre a los papeles que ya estaban guardados.
 *
 * Desde el commit del renombrado, lo que se sube se guarda como
 * «Ficha técnica · 8888LXR.pdf». Lo que ya estaba dentro se quedó con el nombre
 * del móvil —`02384u723.pdf`, `factura-26-001 (1).pdf`— y en la ficha sigue sin
 * saberse cuál es cuál sin abrirlo.
 *
 * Esto solo toca el nombre. El fichero no se mueve del almacén: la ruta es otra
 * columna y no se toca, así que la descarga sigue funcionando igual. Por eso no
 * hace falta borrar y volver a subir nada — y el mandato firmado, que es el
 * caso donde resubir no se puede (el encargo ya está marcado y el servidor
 * contesta `ya_estaba_firmado`), se arregla igual que los demás.
 *
 * ## Se numeran como al guardar
 *
 * Varios papeles del mismo coche y del mismo tipo se numeran a partir del
 * segundo, y el orden es el de subida. Por eso se leen ordenados por fecha: con
 * otro orden, los números saldrían distintos de los que habría puesto el
 * guardado, y dos pasadas darían dos resultados.
 *
 * ## Cómo se usa
 *
 *   node scripts/renombra-los-papeles.js              (prueba: BEGIN … ROLLBACK)
 *   node scripts/renombra-los-papeles.js --de-verdad  (escribe)
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../lib/postgres-ssl");
const { comoSeLlamaElPapel } = require("../lib/como-se-llama-el-papel");

const DE_VERDAD = process.argv.includes("--de-verdad");
const CONN = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

if (!CONN) {
  console.error("No hay DATABASE_URL en .env.local");
  process.exit(1);
}

/**
 * Los tres sitios donde vive el nombre de un papel.
 *
 * `tipo` es la columna que dice qué es; donde no hay ninguna —los documentos
 * sueltos del garaje— se usa `document`, que es lo que hace el guardado.
 */
const SITIOS = [
  {
    que: "documentos del coche (ficha, permiso, ITV)",
    lee: `SELECT d.id, d.file_name AS nombre, d.document_type AS tipo, v.plate
            FROM moveadvisor_user_vehicle_documents d
            LEFT JOIN moveadvisor_user_vehicles v ON v.id = d.vehicle_id
           ORDER BY d.created_at, d.id`,
    escribe: `UPDATE moveadvisor_user_vehicle_documents SET file_name = $2 WHERE id = $1`,
  },
  {
    que: "otros documentos del garaje",
    lee: `SELECT f.id, f.file_name AS nombre, 'document' AS tipo, v.plate
            FROM moveadvisor_user_vehicle_files f
            LEFT JOIN moveadvisor_user_vehicles v ON v.id = f.vehicle_id
           WHERE f.file_type = 'document'
           ORDER BY f.created_at, f.id`,
    escribe: `UPDATE moveadvisor_user_vehicle_files SET file_name = $2 WHERE id = $1`,
  },
  {
    que: "mandatos firmados que suben los clientes",
    lee: `SELECT d.id, d.nombre, d.papel AS tipo, v.plate
            FROM erp_documentos d
            JOIN erp_encargos_venta e ON e.id = d.ambito_id
            LEFT JOIN moveadvisor_user_vehicles v ON v.id = e.vehicle_id
           WHERE d.ambito = 'encargo'
           ORDER BY d.created_at, d.id`,
    escribe: `UPDATE erp_documentos SET nombre = $2 WHERE id = $1`,
  },
];

(async () => {
  const pool = new Pool({ connectionString: CONN, max: 2, ssl: SSL_POSTGRES });
  const cliente = await pool.connect();
  let tocados = 0;
  let quietos = 0;

  try {
    await cliente.query("BEGIN");

    for (const sitio of SITIOS) {
      const { rows } = await cliente.query(sitio.lee);
      console.log(`\n=== ${sitio.que}: ${rows.length} ${rows.length === 1 ? "papel" : "papeles"}`);

      const cuantos = new Map();
      const cambios = [];

      for (const r of rows) {
        const clave = `${r.plate || ""}|${r.tipo || ""}`;
        const cual = (cuantos.get(clave) || 0) + 1;
        cuantos.set(clave, cual);

        const nuevo = comoSeLlamaElPapel(r.tipo, r.plate, r.nombre, cual);
        if (nuevo === r.nombre) { quietos += 1; continue; }

        await cliente.query(sitio.escribe, [r.id, nuevo]);
        cambios.push({ antes: r.nombre, despues: nuevo });
        tocados += 1;
      }

      if (cambios.length) console.table(cambios);
      else console.log("  (ninguno cambia)");
    }

    /*
     * La prueba de que no se alarga solo, hecha sobre lo que se acaba de
     * escribir y antes de decidir si se guarda.
     *
     * Si el nombre nuevo no se reconociera como nuestro, una segunda pasada le
     * volvería a pegar el original detrás. Eso ya está probado en
     * `como-se-llama-el-papel.test.js`, pero aquí se comprueba contra las filas
     * de verdad: es lo que se va a quedar en la base.
     */
    for (const sitio of SITIOS) {
      const { rows } = await cliente.query(sitio.lee);
      const cuantos = new Map();
      for (const r of rows) {
        const clave = `${r.plate || ""}|${r.tipo || ""}`;
        const cual = (cuantos.get(clave) || 0) + 1;
        cuantos.set(clave, cual);
        const otraVez = comoSeLlamaElPapel(r.tipo, r.plate, r.nombre, cual);
        if (otraVez !== r.nombre) {
          throw new Error(
            `Pasarlo dos veces no da lo mismo:\n  ${r.nombre}\n  ${otraVez}\n` +
            "No se escribe nada."
          );
        }
      }
    }

    console.log(`\n${tocados} renombrados, ${quietos} ya estaban bien.`);

    if (DE_VERDAD) {
      await cliente.query("COMMIT");
      console.log("Guardado.");
    } else {
      await cliente.query("ROLLBACK");
      console.log("Prueba: no se ha escrito nada. Con --de-verdad se guarda.");
    }
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    console.error("\nFALLA:", e.message);
    process.exitCode = 1;
  } finally {
    cliente.release();
    await pool.end();
  }
})();
