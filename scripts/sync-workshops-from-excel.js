/**
 * Lee talleres_carswise.xlsx y actualiza en BD los campos que hayan cambiado.
 * Usa el ID como clave — solo toca filas que existan en el Excel.
 *
 * Uso:
 *   node scripts/sync-workshops-from-excel.js
 *   node scripts/sync-workshops-from-excel.js --dry-run   (muestra cambios sin aplicar)
 */

require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const XLSX    = require("xlsx");
const path    = require("path");

const DRY_RUN  = process.argv.includes("--dry-run");
const XLSX_PATH = path.join(__dirname, "../talleres_carswise.xlsx");
const pool     = new Pool({ connectionString: process.env.DATABASE_URL });

// Columnas del Excel → columnas de BD
const COLUMN_MAP = {
  "Nombre":             "name",
  "Dirección":          "address",
  "Ciudad":             "city",
  "Cód. Postal":        "postcode",
  "Provincia":          "province",
  "Teléfono":           "phone",
  "Partner":            "partner",
  "Web":                "website",
  "Valoración":         "rating",
  "Nº Reseñas":         "rating_count",
  "Tipos de servicio":  "service_types",
  "Activo":             "is_active",
  "Horario comercial":  "business_hours",
};

function parseValue(col, raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const val = String(raw).trim();
  if (col === "rating")       return isNaN(parseFloat(val)) ? null : parseFloat(val);
  if (col === "rating_count") return isNaN(parseInt(val))   ? null : parseInt(val);
  if (col === "is_active")    return val === "Sí" || val === "SI" || val === "1" || val === "true";
  if (col === "service_types") return val ? val.split(",").map(s => s.trim()).filter(Boolean) : null;
  return val || null;
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no se aplicarán cambios ===" : "=== SYNC Excel → BD ===");

  // Leer Excel
  const wb   = XLSX.readFile(XLSX_PATH);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  console.log(`Filas en Excel: ${rows.length}`);

  const client = await pool.connect();
  let updated = 0, skipped = 0, errors = 0;

  try {
    for (const row of rows) {
      const id = parseInt(row["ID"], 10);
      if (!id || isNaN(id)) { skipped++; continue; }

      // Construir SET con los campos del COLUMN_MAP que tengan valor
      const setParts = [];
      const values   = [];
      let   paramIdx = 1;

      for (const [excelCol, dbCol] of Object.entries(COLUMN_MAP)) {
        const parsed = parseValue(dbCol, row[excelCol]);
        if (parsed === null) continue;

        if (dbCol === "service_types") {
          setParts.push(`${dbCol} = $${paramIdx}::text[]`);
          values.push(parsed);
        } else if (dbCol === "rating") {
          setParts.push(`${dbCol} = $${paramIdx}::numeric`);
          values.push(parsed);
        } else if (dbCol === "rating_count") {
          setParts.push(`${dbCol} = $${paramIdx}::integer`);
          values.push(parsed);
        } else if (dbCol === "is_active") {
          setParts.push(`${dbCol} = $${paramIdx}::boolean`);
          values.push(parsed);
        } else {
          setParts.push(`${dbCol} = $${paramIdx}`);
          values.push(parsed);
        }
        paramIdx++;
      }

      if (!setParts.length) { skipped++; continue; }

      values.push(id);
      const sql = `UPDATE workshop_locations SET ${setParts.join(", ")} WHERE id = $${paramIdx}`;

      if (DRY_RUN) {
        console.log(`ID ${id}: ${setParts.length} campos →`, Object.fromEntries(
          Object.entries(COLUMN_MAP)
            .filter(([ec]) => row[ec] !== "" && row[ec] !== undefined)
            .map(([ec, dc]) => [dc, parseValue(dc, row[ec])])
        ));
      } else {
        try {
          const r = await client.query(sql, values);
          if (r.rowCount) updated++;
          else { console.warn(`  ID ${id} no encontrado en BD`); skipped++; }
        } catch (e) {
          console.error(`  Error ID ${id}:`, e.message);
          errors++;
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  if (DRY_RUN) {
    console.log(`\nDry run completado — ${rows.length} filas leídas`);
  } else {
    console.log(`\nResultado: ${updated} actualizados · ${skipped} sin cambios · ${errors} errores`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
