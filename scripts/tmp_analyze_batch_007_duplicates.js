const fs = require("fs");
const text = fs.readFileSync("scripts/sql/007_seed_aliases_flexicar_next50_models.sql", "utf8");
const valuesSection = text.split("VALUES")[1].split("ON CONFLICT")[0];
const rows = valuesSection.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("('"));
const normalize = (value) => String(value || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
const seen = new Map();
for (const row of rows) {
  const match = row.match(/^\('([^']*)',\s*'([^']*)',\s*'([^']*)',/);
  if (!match) continue;
  const brand = match[1];
  const alias = match[3];
  const key = `${normalize(brand)}||${normalize(alias)}`;
  if (!seen.has(key)) seen.set(key, []);
  seen.get(key).push(`${brand} -> ${alias}`);
}
for (const [key, values] of seen.entries()) {
  if (values.length > 1) {
    console.log(`DUP ${key}`);
    for (const value of values) console.log(`  ${value}`);
  }
}
