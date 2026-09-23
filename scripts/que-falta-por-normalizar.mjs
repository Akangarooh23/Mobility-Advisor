/**
 * Qué le falta a la base para estar normalizada. Solo mira, no toca nada.
 *
 * Busca cuatro cosas, que son las cuatro que duelen:
 *
 *  1. **Relaciones sin declarar.** Una columna que se llama `vehicle_id` y
 *     guarda identificadores de coches, pero sin una clave ajena que lo diga.
 *     Mientras no está declarada, la base deja escribir un coche que no existe
 *     y deja borrar un coche dejando huérfano todo lo suyo. Además dice si los
 *     datos de hoy aguantarían la relación: si no aguantan, ya hay huérfanos.
 *  2. **Tablas sin clave primaria.** No hay forma de señalar una fila concreta.
 *  3. **Claves prestadas.** La clave es un correo, un nombre o algo que nos dio
 *     otro (Stripe): cosas que cambian, y al cambiar se pierde la fila.
 *  4. **Datos copiados.** El nombre del taller guardado al lado del taller, el
 *     correo del usuario al lado del usuario. Dos sitios donde mirar y uno que
 *     se queda viejo.
 *
 *   node scripts/que-falta-por-normalizar.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
function delEntorno(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  const f = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(f)) return "";
  const l = fs.readFileSync(f, "utf8").split(/\r?\n/).filter((x) => x.startsWith(nombre + "="));
  return l.length ? l[l.length - 1].slice(nombre.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const pool = new pg.Pool({ connectionString: delEntorno("DATABASE_URL") || delEntorno("POSTGRES_URL") });

/** A qué tabla apunta una columna, por su nombre. */
const A_DONDE_APUNTA = {
  vehicle_id: ["moveadvisor_user_vehicles", "id"],
  user_id: ["moveadvisor_users", "id"],
  lead_id: ["moveadvisor_market_leads", "id"],
  encargo_id: ["erp_encargos_venta", "id"],
  booking_id: ["vehicle_visit_bookings", "id"],
  offer_id: ["moveadvisor_market_offers", "id"],
  proveedor_id: ["erp_proveedores", "id"],
  workshop_id: ["moveadvisor_workshops", "id"],
  pedido_id: ["erp_pedidos", "id"],
  peritacion_id: ["erp_peritaciones", "id"],
  invoice_id: ["moveadvisor_user_invoices", "id"],
};

async function main() {
  const { rows: cuantas } = await pool.query(`
    SELECT c.relname AS tabla, COALESCE(s.n_live_tup, 0)::int AS filas
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
     WHERE c.relkind = 'r'`);
  const filasDe = new Map(cuantas.map((r) => [r.tabla, r.filas]));
  const existe = (t) => filasDe.has(t);

  // ── 1. Relaciones sin declarar ──────────────────────────────────────────
  const { rows: columnas } = await pool.query(`
    SELECT table_name AS tabla, column_name AS columna
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = ANY($1::text[])
     ORDER BY table_name, column_name`,
    [Object.keys(A_DONDE_APUNTA)]
  );
  const { rows: declaradas } = await pool.query(`
    SELECT c.relname AS tabla, a.attname AS columna
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      JOIN LATERAL unnest(con.conkey) AS k(att) ON TRUE
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.att
     WHERE con.contype = 'f'`);
  const yaDeclarada = new Set(declaradas.map((d) => `${d.tabla}.${d.columna}`));

  console.log("── 1 · RELACIONES SIN DECLARAR ─────────────────────────────────────\n");
  const candidatas = [];
  for (const c of columnas) {
    if (yaDeclarada.has(`${c.tabla}.${c.columna}`)) continue;
    const [destino, clave] = A_DONDE_APUNTA[c.columna];
    if (!existe(destino) || c.tabla === destino) continue;
    let huerfanos = null;
    try {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM "${c.tabla}" t
          WHERE t."${c.columna}" IS NOT NULL AND t."${c.columna}"::text <> ''
            AND NOT EXISTS (SELECT 1 FROM "${destino}" d WHERE d."${clave}"::text = t."${c.columna}"::text)`
      );
      huerfanos = rows[0].n;
    } catch (e) {
      huerfanos = `(no se puede comprobar: ${e.message.slice(0, 40)})`;
    }
    candidatas.push({ ...c, destino, clave, huerfanos, filas: filasDe.get(c.tabla) ?? 0 });
  }
  for (const c of candidatas) {
    const marca = c.huerfanos === 0 ? "✓ se puede declarar ya" : `⚠ ${c.huerfanos} filas apuntan a algo que no existe`;
    console.log(`  ${(c.tabla + "." + c.columna).padEnd(48)} → ${c.destino.padEnd(30)} ${marca}`);
  }
  console.log(`\n  ${candidatas.filter((c) => c.huerfanos === 0).length} de ${candidatas.length} se pueden declarar sin tocar datos.`);

  // ── 2. Tablas sin clave primaria ────────────────────────────────────────
  const { rows: sinClave } = await pool.query(`
    SELECT c.relname AS tabla
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE c.relkind = 'r'
       AND NOT EXISTS (SELECT 1 FROM pg_constraint p WHERE p.conrelid = c.oid AND p.contype = 'p')
     ORDER BY c.relname`);
  console.log("\n── 2 · TABLAS SIN CLAVE PRIMARIA ───────────────────────────────────\n");
  for (const t of sinClave) console.log(`  ${t.tabla.padEnd(50)} ${filasDe.get(t.tabla) ?? 0} filas`);
  if (!sinClave.length) console.log("  (ninguna)");

  // ── 3. Claves prestadas ─────────────────────────────────────────────────
  console.log("\n── 3 · CLAVES PRESTADAS ────────────────────────────────────────────\n");
  const { rows: clavesTexto } = await pool.query(`
    SELECT c.relname AS tabla, a.attname AS columna, format_type(a.atttypid, a.atttypmod) AS tipo
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      JOIN LATERAL unnest(con.conkey) AS k(att) ON TRUE
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.att
     WHERE con.contype = 'p' AND format_type(a.atttypid, a.atttypmod) ~ 'char|text'
     ORDER BY c.relname`);
  /**
   * Lo que parece una clave prestada y no lo es.
   *
   * `migraciones_aplicadas` se identifica por el nombre del fichero, y eso es
   * correcto: el fichero **es** la migración. Darle un número propio no añadiría
   * nada y haría más difícil de leer la única tabla que se mira a mano cuando
   * algo va mal con el esquema.
   */
  const ESTA_BIEN_ASI = new Set(["migraciones_aplicadas.nombre"]);

  for (const c of clavesTexto) {
    if (ESTA_BIEN_ASI.has(`${c.tabla}.${c.columna}`)) continue;
    let motivo = "";
    if (/email|correo/.test(c.columna)) motivo = "la clave es un correo: cambiarlo pierde la fila";
    else if (/nombre|name/.test(c.columna)) motivo = "la clave es un nombre: corregir una tilde crea una fila nueva";
    if (!motivo) {
      // ¿Los valores parecen de otro? (una sesión de Stripe, por ejemplo)
      try {
        const { rows } = await pool.query(`SELECT "${c.columna}"::text AS v FROM "${c.tabla}" LIMIT 3`);
        if (rows.some((r) => /^(cs_|pi_|sub_|cus_|in_)/.test(r.v || ""))) motivo = "la clave nos la puso Stripe";
        else if (rows.some((r) => /@/.test(r.v || ""))) motivo = "guarda correos";
      } catch { /* da igual */ }
    }
    if (motivo) console.log(`  ${(c.tabla + "." + c.columna).padEnd(48)} ${motivo}`);
  }

  // ── 4. Datos copiados ───────────────────────────────────────────────────
  console.log("\n── 4 · DATOS COPIADOS ──────────────────────────────────────────────\n");
  const PAREJAS = [
    ["user_id", "user_email"], ["workshop_id", "workshop_name"],
    ["proveedor_id", "provider_name"], ["vehicle_id", "vehicle_title"],
  ];
  const { rows: todas } = await pool.query(`
    SELECT table_name AS tabla, array_agg(column_name::text) AS cols
      FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name`);
  for (const t of todas) {
    for (const [ref, copia] of PAREJAS) {
      if (t.cols.includes(ref) && t.cols.includes(copia)) {
        console.log(`  ${t.tabla.padEnd(44)} tiene ${ref} y además ${copia}  (${filasDe.get(t.tabla) ?? 0} filas)`);
      }
    }
  }

  // ── Y lo que está vacío, que es lo barato de arreglar ───────────────────
  const vacias = [...filasDe.entries()].filter(([, n]) => n === 0).map(([t]) => t);
  console.log(`\n── VACÍAS: ${vacias.length} de ${filasDe.size} tablas no tienen ni una fila ──`);
  console.log("  (cambiar una tabla vacía no cuesta nada: es el momento)");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
