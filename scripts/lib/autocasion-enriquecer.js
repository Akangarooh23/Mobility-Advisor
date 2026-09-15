const dbRecord = $('Loop: oferta por oferta').item.json;
const dbId = String(dbRecord.id || '');
const dbUrl = String(dbRecord.url || '');

const httpOut = $input.item.json;
const html = typeof httpOut === 'string' ? httpOut
  : (httpOut.data || httpOut.body || httpOut.html || '');

console.log('[ac-enrich] id=' + dbId + ' url=' + dbUrl + ' html_len=' + String(html).length);

if (!dbId) {
  await new Promise(r => setTimeout(r, 800));
  return [{ json: { id: null, hasUpdates: false, updateSql: null } }];
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function normalizeBody(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return '';
  if (s.indexOf('suv') !== -1 || s.indexOf('4x4') !== -1 || s.indexOf('todo') !== -1 || s.indexOf('todoterreno') !== -1 || s.indexOf('terreno') !== -1) return 'SUV';
  if (s.indexOf('pick') !== -1) return 'Pick Up';
  if (s.indexOf('furgon') !== -1 || s.indexOf('van') !== -1 || s.indexOf('comercial') !== -1) return 'Furgoneta';
  if (s.indexOf('familiar') !== -1 || s.indexOf('estate') !== -1 || s.indexOf('combi') !== -1) return 'Familiar';
  if (s.indexOf('monovolumen') !== -1 || s.indexOf('mpv') !== -1) return 'Monovolumen';
  if (s.indexOf('coupe') !== -1 || s.indexOf('coupé') !== -1) return 'Coupé';
  if (s.indexOf('cabrio') !== -1 || s.indexOf('convert') !== -1 || s.indexOf('descapotable') !== -1) return 'Cabrio';
  if (s.indexOf('compact') !== -1 || s.indexOf('peque') !== -1 || s.indexOf('utilitario') !== -1) return 'Compacto';
  if (s.indexOf('berlina') !== -1 || s.indexOf('sedan') !== -1 || s.indexOf('turismo') !== -1 || s.indexOf('hatchback') !== -1) return 'Berlina';
  return raw || '';
}

// ── ¿Estamos leyendo la ficha que pedimos? ─────────────────────────────────
//
// Esto no estaba, y era grave. Con una URL de listado de provincia -las 35.518
// de julio y agosto- el lector de abajo coge el PRIMER coche del listado y le
// escribe sus datos a otra oferta. Probado el 15-sep-2026 contra
// /coches-segunda-mano/peugeot-2008-ocasion/madrid:
//
//     color = 'Naranja', doors = 6, power_cv = 100, body_type = 'SUV'
//
// Seis puertas. De las 34 ofertas de Autocasion con puertas guardadas, 32
// tenian mas de cinco: ese era el rastro.
//
// Pasa por dos caminos y hay que tapar los dos: una URL que no es de ficha, y
// una ficha VENDIDA, que redirige al listado del modelo.
// [0-9] y no \d a propósito: este código viaja dentro de cadenas de JavaScript
// -del generador al JSON, del JSON a n8n- y en una cadena "\d" es "d". Aquí
// mismo quedó una vez como /refd{6,}$/, que no casa con ninguna URL real.
const esFicha = /ref[0-9]{6,}$/.test(dbUrl);
const codigoHttp = Number((httpOut || {}).statusCode || 200);
if (!esFicha) {
  console.log('[ac-enrich] ' + dbId + ': la URL no es una ficha, no se lee nada.');
  return [{ json: { id: dbId, hasUpdates: true, veredicto: 'url de listado',
    updateSql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(dbId) } }];
}
if (codigoHttp >= 300 && codigoHttp < 400) {
  console.log('[ac-enrich] ' + dbId + ': redirige (HTTP ' + codigoHttp + '), o sea vendida.');
  return [{ json: { id: dbId, hasUpdates: true, veredicto: 'redirige',
    updateSql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(dbId) } }];
}

// ── Extraer JSON-LD de la ficha ────────────────────────────────────────────
let vehicle = null;
const htmlStr = String(html);

try {
  const blocks = [...htmlStr.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim());
  for (const b of blocks) {
    try {
      const j = JSON.parse(b);
      const arr = Array.isArray(j) ? j : (j['@graph'] || [j]);
      for (const o of arr) {
        if (o && (o['@type'] === 'Car' || o['@type'] === 'Product')) {
          // La ficha suele tener más datos que el listado
          const candidate = o.offers ? (o.offers.itemOffered || o) : o;
          if (candidate.color || candidate.numberOfDoors || candidate.vehicleSeatingCapacity) {
            vehicle = o;
            break;
          }
          // Guardar como candidato aunque no tenga color aún
          if (!vehicle) vehicle = o;
        }
      }
      if (vehicle) break;
    } catch (e) {}
  }
} catch(e) {
  console.log('[ac-enrich] parse error: ' + e.message);
}

if (vehicle) {
  const off = vehicle.offers || {};
  const car = off.itemOffered || vehicle;
  console.log('[ac-enrich] vehicle type=' + vehicle['@type'] + ' car keys=' + Object.keys(car).join(','));
} else {
  console.log('[ac-enrich] no JSON-LD vehicle found in html (len=' + htmlStr.length + ')');
}

// ── Extraer campos ─────────────────────────────────────────────────────────
let colorVal = '', doorsVal = 0, seatsVal = 0, hpVal = 0;
let bodyVal = '', tractionVal = '', co2Val = '';

if (vehicle) {
  const off = vehicle.offers || {};
  const car = off.itemOffered || vehicle;

  colorVal = car.color || vehicle.color || car.colour || vehicle.colour || '';

  const rawDoors = car.numberOfDoors || vehicle.numberOfDoors || car.doors || vehicle.doors || 0;
  doorsVal = parseInt(String(rawDoors).replace(/[^0-9]/g, ''), 10) || 0;

  const rawSeats = car.vehicleSeatingCapacity || vehicle.vehicleSeatingCapacity || car.seats || vehicle.seats || 0;
  seatsVal = parseInt(String(rawSeats).replace(/[^0-9]/g, ''), 10) || 0;

  try {
    const ep = car.vehicleEngine && car.vehicleEngine.enginePower;
    if (ep && ep.value != null) hpVal = parseInt(String(ep.value).replace(/[^0-9]/g, ''), 10) || 0;
  } catch(e) {}

  bodyVal = car.bodyType || vehicle.bodyType || car.carBodyType || vehicle.carBodyType || '';
  tractionVal = car.driveWheelConfiguration || vehicle.driveWheelConfiguration || car.traction || vehicle.traction || '';

  const co2Raw = car.emissionsCO2 || vehicle.emissionsCO2 || car.co2Emissions || vehicle.co2Emissions || '';
  co2Val = String(co2Raw).replace(/[^0-9]/g, '');

  console.log('[ac-enrich] extracted color=' + colorVal + ' doors=' + doorsVal + ' seats=' + seatsVal + ' body=' + bodyVal);
} else {
  // Fallback: regex sobre el HTML
  const mColor = htmlStr.match(/"color"\s*:\s*"([^"]+)"/i);
  if (mColor) colorVal = mColor[1];
  const mDoors = htmlStr.match(/"numberOfDoors"\s*:\s*(\d+)/);
  if (mDoors) doorsVal = parseInt(mDoors[1], 10);
  const mSeats = htmlStr.match(/"vehicleSeatingCapacity"\s*:\s*"?(\d+)"?/);
  if (mSeats) seatsVal = parseInt(mSeats[1], 10);
  const mBody = htmlStr.match(/"bodyType"\s*:\s*"([^"]+)"/i);
  if (mBody) bodyVal = mBody[1];
  console.log('[ac-enrich] regex fallback: color=' + colorVal + ' doors=' + doorsVal);
}

// ── Filtro de cordura ──────────────────────────────────────────────────────
// Un coche de calle no tiene mas de 5 puertas ni mas de 9 plazas. Si sale algo
// asi es que hemos leido otra cosa, y es mejor no escribir nada que escribir
// una mentira: la segunda red por si la guarda de arriba se queda corta.
if (Number(doorsVal) > 5 || Number(doorsVal) < 2) {
  if (Number(doorsVal) !== 0) console.log('[ac-enrich] ' + dbId + ': ' + doorsVal + ' puertas es imposible, se descarta.');
  doorsVal = 0;
}
if (Number(seatsVal) > 9 || Number(seatsVal) < 2) {
  if (Number(seatsVal) !== 0) console.log('[ac-enrich] ' + dbId + ': ' + seatsVal + ' plazas es imposible, se descarta.');
  seatsVal = 0;
}

// ── Construir SQL ──────────────────────────────────────────────────────────
const sets = [];

if (colorVal)              sets.push('color = COALESCE(NULLIF(color,\'\'), ' + esc(colorVal) + ')');
if (Number(doorsVal) > 0)  sets.push('doors = COALESCE(NULLIF(doors,0), ' + Number(doorsVal) + ')');
if (Number(seatsVal) > 0)  sets.push('seats = COALESCE(NULLIF(seats,0), ' + Number(seatsVal) + ')');
if (Number(hpVal) > 0)     sets.push('power_cv = COALESCE(NULLIF(power_cv,0), ' + Number(hpVal) + ')');
if (bodyVal)               sets.push('body_type = COALESCE(NULLIF(body_type,\'\'), ' + esc(normalizeBody(bodyVal)) + ')');
if (co2Val && /^\d+$/.test(co2Val)) sets.push('co2 = COALESCE(NULLIF(co2,\'\'), ' + esc(co2Val) + ')');

sets.push('enrich_tried_at = NOW()');

const hasUpdates = sets.length > 1;
// updated_at NO se toca: enriquecer no es que el anuncio haya cambiado, es que
// nosotros nos hemos puesto al día. Moverlo hace parecer recién publicado un
// coche que lleva dos meses colgado.
const updateSql = 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(dbId);

console.log('[ac-enrich] sets=' + sets.length + ' hasUpdates=' + hasUpdates);

await new Promise(r => setTimeout(r, 600));

return [{ json: { id: dbId, hasUpdates: hasUpdates, updateSql: updateSql } }];
