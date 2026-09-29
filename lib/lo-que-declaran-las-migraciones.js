"use strict";

/**
 * Qué tablas y columnas declaran las migraciones.
 *
 * ## Para qué
 *
 * Varias pruebas comprobaban que una columna existe mirando si el código tenía
 * el `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` correspondiente. Era lo único
 * que se podía comprobar cuando el esquema lo creaba cada manejador por su
 * cuenta, pero comprobaba la **forma** y no el hecho: la columna podía estar
 * declarada ahí y no existir en producción —que es exactamente lo que pasó con
 * `rectifica_numero`, y por lo que descargar una factura en PDF fallaba—.
 *
 * Ahora el esquema lo declaran las migraciones, así que la pregunta correcta es
 * ésta: **¿lo declara alguna migración?** Eso es lo que responde este módulo, y
 * es lo que deben preguntar las pruebas.
 *
 * ## Qué no es
 *
 * No consulta la base de datos. Lee `migrations/*.sql`, que es lo que se aplica
 * a cualquier entorno: si algo está declarado aquí, existe en cualquier base
 * que esté al día, y si no, no existe en una base nueva por mucho que esté en
 * la de producción.
 */

const fs = require("node:fs");
const path = require("node:path");

const DIRECTORIO = path.join(__dirname, "..", "migrations");

let _cache = null;

/** Todo el SQL de las migraciones, en orden y sin comentarios de línea. */
function todoElSql() {
  return fs
    .readdirSync(DIRECTORIO)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => fs.readFileSync(path.join(DIRECTORIO, f), "utf8"))
    .join("\n")
    .replace(/^\s*--.*$/gm, "");
}

function leeLasMigraciones() {
  if (_cache) return _cache;

  const sql = todoElSql();
  const tablas = new Set();
  const columnas = new Map(); // tabla -> Set(columna)

  const apunta = (tabla, columna) => {
    const t = tabla.toLowerCase();
    if (!columnas.has(t)) columnas.set(t, new Set());
    columnas.get(t).add(columna.toLowerCase());
  };

  // Las columnas del cuerpo de un CREATE TABLE.
  for (const m of sql.matchAll(
    /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([A-Za-z_][\w]*)"?\s*\(([\s\S]*?)\n\s*\);/gi
  )) {
    tablas.add(m[1].toLowerCase());
    for (const linea of m[2].split("\n")) {
      const c = /^\s*"?([a-z_][\w]*)"?\s+[a-z]/i.exec(linea);
      if (!c) continue;
      // Una restricción no es una columna, aunque empiece igual.
      const primera = c[1].toUpperCase();
      if (["PRIMARY", "UNIQUE", "FOREIGN", "CONSTRAINT", "CHECK", "EXCLUDE", "LIKE"].includes(primera)) continue;
      apunta(m[1], c[1]);
    }
  }

  // Y las que se añaden después con un ALTER.
  for (const m of sql.matchAll(
    /ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(?:public\.)?"?([A-Za-z_][\w]*)"?([\s\S]*?);/gi
  )) {
    for (const c of m[2].matchAll(/ADD COLUMN (?:IF NOT EXISTS )?"?([A-Za-z_][\w]*)"?/gi)) {
      apunta(m[1], c[1]);
    }
  }

  _cache = { tablas, columnas, sql };
  return _cache;
}

/** ¿Declaran las migraciones esa tabla? */
function declaraTabla(tabla) {
  return leeLasMigraciones().tablas.has(String(tabla).toLowerCase());
}

/** ¿Declaran las migraciones esa columna, en **esa** tabla? */
function declaraColumna(tabla, columna) {
  const enEsaTabla = leeLasMigraciones().columnas.get(String(tabla).toLowerCase());
  return Boolean(enEsaTabla && enEsaTabla.has(String(columna).toLowerCase()));
}

/** El texto entero, para lo que no encaje en las dos preguntas de arriba. */
function elSqlDeLasMigraciones() {
  return leeLasMigraciones().sql;
}

module.exports = { declaraTabla, declaraColumna, elSqlDeLasMigraciones };
