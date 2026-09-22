/**
 * Muda al cajón privado los papeles que ya están subidos al público.
 *
 * El código nuevo guarda en `erp-documentos`, que es privado. Pero lo que se
 * subió antes sigue en `vehicle-files`, que es público: una peritación, cuatro
 * facturas de proveedor, los documentos de los expedientes y los papeles de los
 * coches se abren hoy con la dirección a pelo, sin sesión ninguna. Arreglar el
 * código no mueve un solo fichero.
 *
 * Lo que hace, carpeta por carpeta:
 *   1. copia el fichero al cubo privado, con el mismo camino;
 *   2. comprueba que está;
 *   3. cambia la dirección guardada en la base, si alguna fila la usa;
 *   4. borra el del cubo público.
 *
 * En ese orden y con la comprobación en medio: si algo falla, el fichero sigue
 * donde estaba y la base sigue apuntando ahí. Lo único que pasa es que queda una
 * copia en el cajón privado, que no molesta a nadie.
 *
 * Uso:
 *   node scripts/muda-los-papeles-al-cajon-privado.mjs            (solo mira)
 *   node scripts/muda-los-papeles-al-cajon-privado.mjs --de-verdad
 *
 * **Las fotos no se tocan.** `vehicles/<id>/photos/` se queda en el cubo
 * público: son el escaparate y se sirven por dirección directa.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const DE_VERDAD = process.argv.includes("--de-verdad");

const PUBLICO = "vehicle-files";
const PRIVADO = "erp-documentos";

/**
 * Lo que se muda.
 *
 * Las tres primeras son carpetas enteras. `vehicles` se recorre coche a coche y
 * se salta `photos`, que es lo único de ahí que tiene que seguir siendo público.
 */
const CARPETAS = ["peritaciones", "provider-invoices", "documentos", "cw-invoices", "invoices"];
/**
 * `inspeccion` **no** está aquí, y es a propósito.
 *
 * Esas fotos las sube el servicio de PopCar Check con sus propias credenciales y
 * las enseña el informe de estado por su dirección. Moverlas desde aquí dejaría
 * el informe con las fotos rotas y al servicio subiendo al cubo de antes.
 * Cambiarlo es un apaño de los dos lados, y va aparte.
 */
const DENTRO_DE_CADA_COCHE = ["documents", "circulation-permit", "itv", "technical-sheet"];

/** Las columnas que guardan una de estas direcciones. */
const COLUMNAS = [
  ["erp_peritaciones", "id", "informe_url"],
  ["moveadvisor_provider_invoices", "id", "pdf_url"],
  ["moveadvisor_user_invoices", "id", "pdf_url"],
  ["moveadvisor_user_invoices", "id", "cw_pdf_url"],
  ["moveadvisor_user_vehicle_files", "id", "file_url"],
  ["moveadvisor_user_vehicle_documents", "id", "file_url"],
];

// ── Las llaves ──────────────────────────────────────────────────────────────

function delEntorno(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  const fichero = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(fichero)) return "";
  const lineas = fs.readFileSync(fichero, "utf8").split(/\r?\n/).filter((l) => l.startsWith(nombre + "="));
  return lineas.length ? lineas[lineas.length - 1].slice(nombre.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const SUPABASE_URL = delEntorno("SUPABASE_URL");
const SERVICIO = delEntorno("SUPABASE_SERVICE_KEY");
const BASE = delEntorno("DATABASE_URL") || delEntorno("POSTGRES_URL");

if (!SUPABASE_URL || !SERVICIO) {
  console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const cabeceras = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };

// ── El almacén ──────────────────────────────────────────────────────────────

async function lista(cubo, prefijo) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${cubo}`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({ prefix: prefijo, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  const datos = await r.json().catch(() => []);
  return Array.isArray(datos) ? datos : [];
}

/** Todos los ficheros bajo un prefijo, bajando por las subcarpetas. */
async function ficheros(cubo, prefijo, nivel = 0) {
  if (nivel > 4) return [];
  const encontrados = [];
  for (const o of await lista(cubo, prefijo)) {
    const camino = prefijo ? `${prefijo}/${o.name}` : o.name;
    if (o.id) encontrados.push(camino);
    else encontrados.push(...(await ficheros(cubo, camino, nivel + 1)));
  }
  return encontrados;
}

async function copia(camino) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/copy`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      bucketId: PUBLICO,
      sourceKey: camino,
      destinationBucket: PRIVADO,
      destinationKey: camino,
    }),
  });
  if (r.ok) return "";
  return `copiar: ${r.status} ${(await r.text().catch(() => "")).slice(0, 120)}`;
}

async function esta(cubo, camino) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/info/${cubo}/${camino}`, { headers: cabeceras });
  if (r.ok) return true;
  // Supabase viejo no tiene `object/info`: se pregunta al listado de su carpeta.
  const carpeta = camino.split("/").slice(0, -1).join("/");
  const nombre = camino.split("/").pop();
  return (await lista(cubo, carpeta)).some((o) => o.name === nombre && o.id);
}

async function borraDelPublico(camino) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${PUBLICO}/${camino}`, {
    method: "DELETE",
    headers: cabeceras,
  });
  return r.ok ? "" : `borrar: ${r.status}`;
}

// ── La base ─────────────────────────────────────────────────────────────────

const pool = BASE ? new pg.Pool({ connectionString: BASE }) : null;

const publica = (camino) => `${SUPABASE_URL}/storage/v1/object/public/${PUBLICO}/${camino}`;
const privada = (camino) => `${SUPABASE_URL}/storage/v1/object/${PRIVADO}/${camino}`;

/** Cambia la dirección en todas las columnas donde aparezca. Devuelve cuántas. */
async function apuntaAlPrivado(camino) {
  if (!pool) return 0;
  let tocadas = 0;
  for (const [tabla, , columna] of COLUMNAS) {
    try {
      const r = await pool.query(
        `UPDATE ${tabla} SET ${columna} = $2 WHERE ${columna} = $1`,
        [publica(camino), privada(camino)]
      );
      tocadas += r.rowCount || 0;
    } catch {
      // La tabla o la columna pueden no existir en esta base. No es un fallo:
      // es que aquí eso no se guarda.
    }
  }
  return tocadas;
}

// ── Adelante ────────────────────────────────────────────────────────────────

async function main() {
  const porMudar = [];
  for (const carpeta of CARPETAS) porMudar.push(...(await ficheros(PUBLICO, carpeta)));

  // Los coches, saltando las fotos.
  for (const coche of await lista(PUBLICO, "vehicles")) {
    if (coche.id) continue;
    for (const cajon of DENTRO_DE_CADA_COCHE) {
      porMudar.push(...(await ficheros(PUBLICO, `vehicles/${coche.name}/${cajon}`)));
    }
  }

  console.log(`${porMudar.length} ficheros en el cubo público que no deberían estar ahí.\n`);
  if (!DE_VERDAD) {
    for (const c of porMudar) console.log("  " + c);
    console.log("\nEsto era solo mirar. Con --de-verdad se mudan.");
    if (pool) await pool.end();
    return;
  }

  let bien = 0;
  const mal = [];
  for (const camino of porMudar) {
    const falloAlCopiar = await copia(camino);
    if (falloAlCopiar && !(await esta(PRIVADO, camino))) { mal.push(`${camino}  ${falloAlCopiar}`); continue; }
    if (!(await esta(PRIVADO, camino))) { mal.push(`${camino}  no aparece en el cajón privado`); continue; }

    const filas = await apuntaAlPrivado(camino);
    const falloAlBorrar = await borraDelPublico(camino);
    if (falloAlBorrar) { mal.push(`${camino}  ${falloAlBorrar} (ya está copiado y la base ya apunta al privado)`); continue; }

    bien++;
    console.log(`  ✓ ${camino}${filas ? `  (${filas} fila${filas === 1 ? "" : "s"} apuntando ahora al privado)` : ""}`);
  }

  console.log(`\nMudados: ${bien}. Con problemas: ${mal.length}.`);
  for (const m of mal) console.log("  ✗ " + m);
  if (pool) await pool.end();
  if (mal.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
