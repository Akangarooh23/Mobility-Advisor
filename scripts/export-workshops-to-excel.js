/**
 * Exporta todos los talleres de BD a talleres_carswise.xlsx
 * Uso: node scripts/export-workshops-to-excel.js
 */

require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const XLSX    = require("xlsx");
const path    = require("path");

const pool     = new Pool({ connectionString: process.env.DATABASE_URL });
const OUT_PATH = path.join(__dirname, "../talleres_carswise.xlsx");

async function main() {
  console.log("Leyendo talleres de BD…");
  const client = await pool.connect();
  let rows;
  try {
    const { rows: r } = await client.query(`
      SELECT id, source, name, address, city, postcode, province,
             lat, lon, phone, partner, website,
             rating, rating_count, service_types, is_active, business_hours
      FROM workshop_locations
      ORDER BY id ASC
    `);
    rows = r;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`${rows.length} talleres obtenidos. Generando Excel…`);

  const data = rows.map((w) => ({
    "ID":                w.id,
    "Fuente":            w.source || "",
    "Nombre":            w.name || "",
    "Dirección":         w.address || "",
    "Ciudad":            w.city || "",
    "Cód. Postal":       w.postcode || "",
    "Provincia":         w.province || "",
    "Latitud":           w.lat != null ? Number(w.lat) : "",
    "Longitud":          w.lon != null ? Number(w.lon) : "",
    "Teléfono":          w.phone || "",
    "Partner":           w.partner || "",
    "Web":               w.website || "",
    "Valoración":        w.rating != null ? Number(w.rating) : "",
    "Nº Reseñas":        w.rating_count != null ? Number(w.rating_count) : "",
    "Tipos de servicio": Array.isArray(w.service_types) ? w.service_types.join(", ") : "",
    "Activo":            w.is_active ? "Sí" : "No",
    "Horario comercial": w.business_hours || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Ajustar ancho de columnas
  ws["!cols"] = [
    { wch: 8 },   // ID
    { wch: 12 },  // Fuente
    { wch: 30 },  // Nombre
    { wch: 35 },  // Dirección
    { wch: 20 },  // Ciudad
    { wch: 10 },  // CP
    { wch: 16 },  // Provincia
    { wch: 10 },  // Latitud
    { wch: 10 },  // Longitud
    { wch: 16 },  // Teléfono
    { wch: 12 },  // Partner
    { wch: 30 },  // Web
    { wch: 10 },  // Valoración
    { wch: 10 },  // Nº Reseñas
    { wch: 30 },  // Tipos de servicio
    { wch: 8 },   // Activo
    { wch: 40 },  // Horario comercial
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Talleres");
  XLSX.writeFile(wb, OUT_PATH);
  console.log(`Excel guardado en: ${OUT_PATH}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
