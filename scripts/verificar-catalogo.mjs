/** ¿El catálogo maestro está completo y sin repetidos? */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = readFileSync('c:/Users/Anapi/Projects/Mobility-Advisor/.env.local', 'utf8')
  .split('\n').find((l) => l.startsWith('DATABASE_URL='))
  .slice(13).trim().replace(/^["']|["']$/g, '')

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

const clave = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
const claveMarca = (v) => clave(v).replace(/[^a-z0-9]/g, '')

let fallos = 0
const ok = (t, d = '') => console.log(`OK    ${t}${d ? ` — ${d}` : ''}`)
const mal = (t, d = '') => { fallos += 1; console.log(`FALLA ${t}${d ? ` — ${d}` : ''}`) }

/* ------------------------------------------------------------- unicidad -- */
const { rows: marcas } = await c.query('SELECT id, name FROM moveadvisor_vehicle_brands')
const { rows: modelos } = await c.query('SELECT brand_id, name FROM moveadvisor_vehicle_models')
console.log(`${marcas.length} marcas · ${modelos.length} modelos\n`)

const porClave = new Map()
for (const m of marcas) {
  const k = claveMarca(m.name)
  if (!porClave.has(k)) porClave.set(k, [])
  porClave.get(k).push(m.name)
}
const marcasRepe = [...porClave.values()].filter((v) => v.length > 1)
marcasRepe.length
  ? mal('marcas repetidas', marcasRepe.map((v) => v.join('/')).join(', '))
  : ok('cada marca aparece una sola vez')

const vacias = marcas.filter((m) => !String(m.name || '').trim())
vacias.length ? mal('marcas sin nombre', String(vacias.length)) : ok('ninguna marca sin nombre')

const porMarca = new Map()
for (const m of modelos) {
  if (!porMarca.has(m.brand_id)) porMarca.set(m.brand_id, new Map())
  const dentro = porMarca.get(m.brand_id)
  const k = clave(m.name)
  dentro.set(k, (dentro.get(k) || 0) + 1)
}
const modelosRepe = []
for (const [brandId, dentro] of porMarca) {
  for (const [k, n] of dentro) {
    if (n > 1) modelosRepe.push(`${marcas.find((x) => x.id === brandId)?.name}/${k} ×${n}`)
  }
}
modelosRepe.length
  ? mal('modelos repetidos dentro de una marca', modelosRepe.slice(0, 8).join(', '))
  : ok('ningún modelo repetido dentro de su marca')

const sinModelos = marcas.filter((m) => !porMarca.has(m.id))
sinModelos.length
  ? console.log(`OJO   ${sinModelos.length} marcas sin ningún modelo — no saldrán en el desplegable`)
  : ok('todas las marcas tienen al menos un modelo')

/* ---------------------------------------------------------- completitud -- */
const texto = readFileSync('c:/Users/Anapi/Projects/Mobility-Advisor/catalogo_marcas_modelos_coches_2026.csv', 'utf8').replace(/^\uFEFF/, '')
const partir = (l) => {
  const out = []; let cur = ''; let q = false
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = '' } else cur += ch }
  out.push(cur); return out
}
const filasCsv = texto.split(/\r?\n/).slice(1).filter(Boolean).map(partir)

const idPorClave = new Map(marcas.map((m) => [claveMarca(m.name), m.id]))
const ALIAS = { ds: 'dsautomobiles', kgm: 'ssangyongkgm', ssangyong: 'ssangyongkgm', vw: 'volkswagen', mercedes: 'mercedesbenz', dr: 'drautomobiles', lynk: 'lynkco', changandeepal: 'deepal' }
const faltanMarcas = []
const faltanModelos = []
for (const f of filasCsv) {
  const kM = claveMarca(f[2])
  const id = idPorClave.get(kM) ?? idPorClave.get(ALIAS[kM] ?? '')
  if (id === undefined) { faltanMarcas.push(f[2]); continue }
  if (!porMarca.get(id)?.has(clave(f[4]))) faltanModelos.push(`${f[2]} ${f[4]}`)
}
;[...new Set(faltanMarcas)].length
  ? mal('marcas del CSV que no están', [...new Set(faltanMarcas)].join(', '))
  : ok('todas las marcas del CSV están')
faltanModelos.length
  ? mal(`modelos del CSV que no están (${faltanModelos.length})`, faltanModelos.slice(0, 8).join(', '))
  : ok('todos los modelos del CSV están')

/* ------------------------------------------- lo que tiene anuncios reales */
const { rows: enOfertas } = await c.query(`
  SELECT DISTINCT trim(brand) AS marca FROM moveadvisor_market_offers WHERE coalesce(trim(brand),'') <> ''
  UNION SELECT DISTINCT trim(brand) FROM moveadvisor_marketplace_vo_offers WHERE coalesce(trim(brand),'') <> ''`)
const EQUIV = {
  vw: 'volkswagen', mercedes: 'mercedesbenz', ssangyong: 'ssangyongkgm', kgm: 'ssangyongkgm',
  kgmssangyong: 'ssangyongkgm', ssangyongkgm: 'ssangyongkgm', landrover: 'landrover',
  alfaromeo: 'alfaromeo', ds: 'dsautomobiles', madza: 'mazda', suzuky: 'suzuki',
  linkco: 'lynkco', lynk: 'lynkco', yoodoo: 'yudo', yoodooo: 'yudo', yooudoo: 'yudo',
  yooudoo6: 'yudo', dr: 'drautomobiles', changandeepal: 'deepal',
}
const EXCLUIDAS = new Set(['a5', 'audia5', 'bwm', 'citroenc1', 'corvette', 'ducato', 'golf',
  'golfmontion4v6', 'ichx', 'ml', 't5', 'touran', 'test', 'otrasmarcas', 'otroscoches',
  'renault400', 'renaultmegane19dci120cv', 'fiatelliot', 'fordtransitdreamerd51automatica',
  'dongfengsokondong', '1955custombelair'])
const sinFicha = enOfertas
  .map((r) => claveMarca(r.marca))
  .filter((k) => k && !EXCLUIDAS.has(k))
  .map((k) => EQUIV[k] || k)
  .filter((k) => !idPorClave.has(k))
;[...new Set(sinFicha)].length
  ? mal('marcas con anuncios que faltan', [...new Set(sinFicha)].join(', '))
  : ok('todas las marcas con anuncios están en el catálogo')

console.log()
console.log(fallos === 0 ? 'COMPLETO Y SIN REPETIDOS' : `${fallos} problema(s)`)
await c.end()
