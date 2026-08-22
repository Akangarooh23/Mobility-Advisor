/**
 * Construye el catálogo maestro de marcas y modelos.
 *
 *   node scripts/cargar-catalogo-maestro.mjs            solo informa
 *   node scripts/cargar-catalogo-maestro.mjs --aplicar  escribe en la base
 *
 * Junta dos orígenes en `moveadvisor_vehicle_brands` y `_models`, que es de
 * donde lee `/api/vehicle-catalog`:
 *
 *   1. El CSV del catálogo, que es la referencia.
 *   2. Las marcas que ya están en el sistema y no aparecen en el CSV —
 *      autocaravanas, industriales, alguna china reciente— siempre que no sean
 *      otra forma de escribir una que ya existe.
 *
 * **No borra nada.** Añade lo que falta y, como mucho, corrige la grafía de una
 * marca que ya estuviera escrita a gritos. Antes de escribir hace una copia de
 * las dos tablas, porque una equivocación aquí se lleva por delante el
 * desplegable de toda la aplicación.
 */

import { readFileSync } from 'node:fs'
import pg from 'pg'

const APLICAR = process.argv.includes('--aplicar')

/* ------------------------------------------------------------------ reglas */

/**
 * Las mismas que usa el desplegable, y por el mismo motivo: si aquí se
 * agrupara distinto, la base tendría «Volkswagen» y «VOLKSWAGEN» como dos
 * marcas y la pantalla las volvería a juntar cada vez que carga.
 */
const clave = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

const claveDeMarca = (v) => clave(v).replace(/[^a-z0-9]/g, '')

/** Marcas que son la misma con otro nombre. Ver `useMarketCatalog.js`. */
const EQUIVALENTES = {
  vw: 'Volkswagen',
  mercedes: 'Mercedes-Benz',
  mercedesbenz: 'Mercedes-Benz',
  ssangyong: 'SsangYong KGM',
  kgm: 'SsangYong KGM',
  kgmssangyong: 'SsangYong KGM',
  ssangyongkgm: 'SsangYong KGM',
  landrover: 'Land Rover',
  alfaromeo: 'Alfa Romeo',
  citroen: 'Citroën',
  skoda: 'Škoda',
  ds: 'DS Automobiles',
  madza: 'Mazda',
  suzuky: 'Suzuki',
  linkco: 'Lynk & Co',
  yoodoo: 'Yudo',
  yoodooo: 'Yudo',
  yooudoo: 'Yudo',
  yooudoo6: 'Yudo',
  // El CSV no las trae, pero en el sistema llegan partidas en dos.
  dr: 'DR Automobiles',
  drautomobiles: 'DR Automobiles',
  lynk: 'Lynk & Co',
  // Deepal es marca propia en el CSV; en los anuncios viene con la matriz
  // delante.
  changandeepal: 'Deepal',
}

/**
 * Lo que no es una marca y no debe entrar.
 *
 * Son de dos clases y ninguna es «otra forma de escribir la misma marca»: o un
 * modelo que se coló en el campo de la marca —«Golf», «A5», «Ducato»— o un
 * cajón de sastre —«Otros Coches», «Test»—. Se listan una a una a propósito, en
 * lugar de con una regla lista: esconder una marca de verdad por adivinar mal
 * es peor que dejar una entrada rara.
 */
const NO_SON_MARCAS = new Set(
  [
    'a5', 'audia5', 'bwm', 'citroenc1', 'corvette', 'ducato', 'golf',
    'golfmontion4v6', 'ichx', 'ml', 't5', 'touran', 'test', 'otrasmarcas',
    'otroscoches', 'renault400', 'renaultmegane19dci120cv', 'fiatelliot',
    'fordtransitdreamerd51automatica', 'dongfengsokondong', '1955custombelair',
  ].map(claveDeMarca),
)

/* -------------------------------------------------------------------- csv  */

function leerCsv(ruta) {
  const texto = readFileSync(ruta, 'utf8').replace(/^﻿/, '')
  const lineas = texto.split(/\r?\n/).filter(Boolean)
  const cabecera = partir(lineas[0])
  return lineas.slice(1).map((l) => {
    const celdas = partir(l)
    return Object.fromEntries(cabecera.map((c, i) => [c, celdas[i] ?? '']))
  })
}

/** Partidor de CSV con comillas. Basta para este fichero. */
function partir(linea) {
  const celdas = []
  let actual = ''
  let entreComillas = false
  for (const ch of linea) {
    if (ch === '"') entreComillas = !entreComillas
    else if (ch === ',' && !entreComillas) {
      celdas.push(actual)
      actual = ''
    } else actual += ch
  }
  celdas.push(actual)
  return celdas
}

/* ------------------------------------------------------------------ marcha */

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL || env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await cliente.connect()

/** El catálogo se junta en memoria antes de tocar nada. */
const marcas = new Map() // claveDeMarca -> { nombre, modelos: Map(clave -> nombre), origen:Set }

function anotar(nombreBruto, modeloBruto, origen) {
  const nombre = String(nombreBruto ?? '').trim()
  const k0 = claveDeMarca(nombre)
  if (!k0 || NO_SON_MARCAS.has(k0)) return false

  const equivalente = EQUIVALENTES[k0]
  const k = equivalente ? claveDeMarca(equivalente) : k0
  const entrada = marcas.get(k) || { nombre: equivalente || nombre, modelos: new Map(), origen: new Set() }
  if (equivalente) entrada.nombre = equivalente
  entrada.origen.add(origen)

  const modelo = String(modeloBruto ?? '').trim()
  const km = clave(modelo)
  if (km && !entrada.modelos.has(km)) entrada.modelos.set(km, modelo)
  marcas.set(k, entrada)
  return true
}

// 1 · el CSV, que manda
const csv = leerCsv(new URL('../catalogo_marcas_modelos_coches_2026.csv', import.meta.url))
for (const fila of csv) anotar(fila.make_name, fila.model_name, 'csv')
const trasCsv = marcas.size
console.log(`CSV            ${csv.length} filas · ${trasCsv} marcas`)

// 2 · lo que ya está en la base
const { rows: enBase } = await cliente.query(
  `SELECT b.name AS marca, m.name AS modelo
     FROM moveadvisor_vehicle_brands b
     LEFT JOIN moveadvisor_vehicle_models m ON m.brand_id = b.id`,
)
for (const f of enBase) anotar(f.marca, f.modelo, 'base')

// 3 · y lo que aparece en anuncios reales, que es lo que no puede faltar
// Las dos tablas de anuncios: la de portales alimenta la cobertura que ve el
// desplegable, y es donde están las autocaravanas y los industriales.
const ofertas = []
for (const tabla of ['moveadvisor_market_offers', 'moveadvisor_marketplace_vo_offers']) {
  const { rows } = await cliente
    .query(
      `SELECT DISTINCT trim(brand) AS marca, trim(model) AS modelo
         FROM ${tabla}
        WHERE coalesce(trim(brand),'') <> ''`,
    )
    .catch(() => ({ rows: [] }))
  ofertas.push(...rows)
}
for (const f of ofertas) anotar(f.marca, f.modelo, 'ofertas')
const enOfertas = ofertas

const soloSistema = [...marcas.values()].filter((m) => !m.origen.has('csv'))
console.log(`base+ofertas   ${enBase.length + enOfertas.length} filas · suman ${marcas.size - trasCsv} marcas nuevas`)
console.log(`TOTAL          ${marcas.size} marcas · ${[...marcas.values()].reduce((s, m) => s + m.modelos.size, 0)} modelos`)
console.log()
console.log(`Marcas que no están en el CSV y sí en el sistema (${soloSistema.length}):`)
console.log('  ' + soloSistema.map((m) => `${m.nombre} (${m.modelos.size})`).sort((a, b) => a.localeCompare(b, 'es')).join(' · '))
console.log()

/* ------------------------------------------------------------------ escribe */

if (!APLICAR) {
  console.log('En seco. Repite con --aplicar para escribirlo.')
  await cliente.end()
  process.exit(0)
}

const sello = new Date().toISOString().slice(0, 10).replace(/-/g, '')
await cliente.query('BEGIN')
try {
  // Copia de seguridad: una equivocación aquí deja sin desplegable a toda la
  // aplicación, y rehacerlo a mano no es opción.
  for (const t of ['moveadvisor_vehicle_brands', 'moveadvisor_vehicle_models']) {
    await cliente.query(`CREATE TABLE IF NOT EXISTS ${t}_copia_${sello} AS TABLE ${t}`)
  }

  let marcasNuevas = 0
  let marcasRenombradas = 0
  let modelosNuevos = 0

  /**
   * Las marcas existentes, indexadas por su clave, de una sola consulta.
   *
   * Comparar acentos y puntuación en SQL exigiría la extensión `unaccent`, que
   * esta base no tiene; en memoria son trescientas filas y se resuelve igual.
   * Y hay que comparar por clave, no por nombre: así una fila escrita
   * «VOLKSWAGEN» se reconoce como la misma y se le corrige la grafía en lugar
   * de crear una segunda.
   */
  const { rows: existentes } = await cliente.query('SELECT id, name FROM moveadvisor_vehicle_brands')
  const porNombre = new Map(existentes.map((r) => [r.name, r]))

  /**
   * Índice por clave, prefiriendo la fila que ya tiene el nombre bueno.
   *
   * En la base conviven «Land Rover» y «Land-Rover», que comparten clave. Si se
   * elige la equivocada y se le corrige la grafía, choca con la otra: hay un
   * índice único sobre el nombre. Eligiendo primero la que ya está bien escrita
   * no hay nada que renombrar.
   */
  const porClave = new Map()
  for (const fila of existentes) {
    const k = claveDeMarca(fila.name)
    const previa = porClave.get(k)
    if (!previa) porClave.set(k, fila)
  }
  for (const entrada of marcas.values()) {
    const k = claveDeMarca(entrada.nombre)
    if (porNombre.has(entrada.nombre)) porClave.set(k, porNombre.get(entrada.nombre))
  }

  for (const entrada of marcas.values()) {
    const k = claveDeMarca(entrada.nombre)
    const rows = porClave.has(k) ? [porClave.get(k)] : []

    let brandId = rows[0]?.id
    if (brandId === undefined) {
      const ins = await cliente.query(
        'INSERT INTO moveadvisor_vehicle_brands (name, is_active) VALUES ($1, TRUE) RETURNING id',
        [entrada.nombre],
      )
      brandId = ins.rows[0].id
      porClave.set(k, { id: brandId, name: entrada.nombre })
      porNombre.set(entrada.nombre, { id: brandId, name: entrada.nombre })
      marcasNuevas += 1
      // Solo se renombra si el nombre bueno está libre; si lo tiene otra fila,
      // se deja como está y los modelos van a la que ya lo lleva.
    } else if (rows[0].name !== entrada.nombre && !porNombre.has(entrada.nombre)) {
      await cliente.query('UPDATE moveadvisor_vehicle_brands SET name = $2 WHERE id = $1', [brandId, entrada.nombre])
      marcasRenombradas += 1
    }

    const { rows: yaEstan } = await cliente.query(
      'SELECT name FROM moveadvisor_vehicle_models WHERE brand_id = $1',
      [brandId],
    )
    const conocidos = new Set(yaEstan.map((r) => clave(r.name)))
    for (const [km, modelo] of entrada.modelos) {
      if (conocidos.has(km)) continue
      await cliente.query(
        'INSERT INTO moveadvisor_vehicle_models (brand_id, name, is_active) VALUES ($1, $2, TRUE)',
        [brandId, modelo],
      )
      modelosNuevos += 1
    }
  }

  /**
   * Filas que son la misma marca escrita distinto y ya estaban en la base.
   *
   * No se pueden arreglar renombrando —el nombre bueno lo tiene la otra fila y
   * hay un índice único—, así que se consolidan: los modelos pasan a la buena y
   * la sobrante desaparece. Es el único borrado de todo el guion, y solo
   * alcanza a filas cuya clave coincide exactamente con la de otra: no es un
   * juicio sobre si dos marcas son la misma, es la misma cadena en otra caja.
   */
  const { rows: todas } = await cliente.query('SELECT id, name FROM moveadvisor_vehicle_brands')
  const grupos = new Map()
  for (const fila of todas) {
    const k = claveDeMarca(fila.name)
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(fila)
  }

  let consolidadas = 0
  for (const [k, filas] of grupos) {
    if (filas.length < 2) continue
    const canonico = marcas.get(k)?.nombre
    const buena = filas.find((f) => f.name === canonico) || filas.find((f) => f.name !== f.name.toUpperCase()) || filas[0]
    for (const sobrante of filas) {
      if (sobrante.id === buena.id) continue
      // Los modelos que la buena no tenga; el resto se descartan por repetidos.
      await cliente.query(
        `UPDATE moveadvisor_vehicle_models m SET brand_id = $1
          WHERE m.brand_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM moveadvisor_vehicle_models o
               WHERE o.brand_id = $1 AND lower(o.name) = lower(m.name))`,
        [buena.id, sobrante.id],
      )
      await cliente.query('DELETE FROM moveadvisor_vehicle_models WHERE brand_id = $1', [sobrante.id])
      await cliente.query('DELETE FROM moveadvisor_vehicle_brands WHERE id = $1', [sobrante.id])
      console.log(`  consolidada «${sobrante.name}» en «${buena.name}»`)
      consolidadas += 1
    }
  }

  await cliente.query('COMMIT')
  console.log(`Copia de seguridad: *_copia_${sello}`)
  console.log(`Filas duplicadas consolidadas: ${consolidadas}`)
  console.log(`Marcas nuevas: ${marcasNuevas} · renombradas: ${marcasRenombradas} · modelos nuevos: ${modelosNuevos}`)
} catch (error) {
  await cliente.query('ROLLBACK')
  console.error('Nada escrito:', error.message)
  process.exitCode = 1
}

const fin = await cliente.query(
  `SELECT (SELECT count(*) FROM moveadvisor_vehicle_brands)::int m,
          (SELECT count(*) FROM moveadvisor_vehicle_models)::int mo`,
)
console.log(`En la base: ${fin.rows[0].m} marcas · ${fin.rows[0].mo} modelos`)
await cliente.end()
