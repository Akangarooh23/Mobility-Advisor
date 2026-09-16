// Autocasion - transform: HTML pagina -> JSON-LD (Product/Car) -> UPSERT
const httpOut = $input.item.json;
const html = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');
let items = [];
const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim());
for (const b of blocks) {
  try {
    const j = JSON.parse(b);
    const arr = Array.isArray(j) ? j : (j['@graph'] || [j]);
    for (const o of arr) {
      if (o && (o['@type'] === 'Product' || o['@type'] === 'Car')) items.push(o);
      else if (o && o['@type'] === 'ItemList' && Array.isArray(o.itemListElement)) { for (const el of o.itemListElement) { const it = el.item || el; if (it) items.push(it); } }
    }
  } catch (e) {}
}
if (!items.length) return [{ json: { sql: null, count: 0 } }];
function esc(v){ if(v===null||v===undefined) return 'NULL'; if(typeof v==='number') return isNaN(v)?'NULL':String(v); return "'"+String(v).replace(/'/g,"''")+"'"; }
function num(s){ const n=parseInt(String(s).replace(/[^0-9]/g,''),10); return isNaN(n)?null:n; }
function normGear(r){ const s=String(r||'').toLowerCase(); if(s.indexOf('autom')!==-1) return 'Automatica'; if(s.indexOf('manual')!==-1) return 'Manual'; return ''; }
function reEsc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function inferFuel(t){ const s=String(t||'').toLowerCase();
  if(/eléctric|electric|\be-tech electric\b/.test(s)) return 'Eléctrico';
  if(/híbrid|hibrid|phev|hev|hybrid|e-tech/.test(s)) return 'Híbrido';
  if(/diésel|diesel|bluehdi|\bhdi\b|\btdi\b|\bcdi\b|\bdci\b|\btdci\b|bluetec|crdi|\bjtd\b|\bcrdi\b/.test(s)) return 'Diesel';
  if(/gasolina|puretech|\btsi\b|\btfsi\b|\btce\b|\bthp\b|\bvti\b|\bmpi\b|t-gdi|\bgdi\b|\bmhev\b|firefly/.test(s)) return 'Gasolina';
  return ''; }
const rows = [];
for (const it of items) {
  const off = it.offers || {}, car = off.itemOffered || {};
  const idf = car.identifier || (off.url ? (String(off.url).match(/ref(\d+)/) || [])[1] : null);
  if (!idf) continue;
  const id = 'ac_' + String(idf);
  const url = off.url || '';
  const brand = (it.brand && it.brand.name) || car.manufacturer || '';
  const model = car.model || '';
  const title = it.name || car.name || (brand + ' ' + model).trim();
  let version = title;
  if (brand) version = version.replace(new RegExp(reEsc(brand), 'i'), '');
  if (model) version = version.replace(new RegExp(reEsc(model), 'i'), '');
  version = version.replace(/\s+/g, ' ').trim();
  const year = car.productionDate ? parseInt(car.productionDate, 10) : null;
  const mileage = (car.mileageFromOdometer && car.mileageFromOdometer.value != null) ? num(car.mileageFromOdometer.value) : null;
  const price = off.price != null ? num(off.price) : null;
  const transmission = normGear(car.vehicleTransmission);
  const fuel = inferFuel(title);
  const color = car.color || it.color || '';
  const bodyType = car.bodyType || '';
  let cv = null; try { const ep = car.vehicleEngine && car.vehicleEngine.enginePower; if (ep && ep.value != null) cv = num(ep.value); } catch (e) {}
  const imgs = Array.isArray(it.image) ? it.image : (Array.isArray(car.image) ? car.image : (it.image ? [it.image] : []));
  const imageUrl = imgs[0] || '';
  const imagesJson = JSON.stringify(imgs.slice(0, 15)).replace(/'/g, "''");
  const rawPayload = JSON.stringify(it).replace(/'/g, "''");
  const row = '(' +
    esc(id) + ", 'autocasion', " + esc(url) + ', ' + esc(title) + ', ' + esc(brand) + ', ' + esc(model) + ', ' + esc(version) + ', ' +
    (year!=null?String(year):'NULL') + ', ' + (mileage!=null?String(mileage):'NULL') + ', ' + (price!=null?String(price):'NULL') + ', ' +
    esc(fuel) + ', ' + esc(transmission) + ', ' + esc(imageUrl) + ", '" + imagesJson + "', " +
    esc(bodyType) + ', ' + (cv!=null?String(cv):'NULL') + ', ' + esc(color) + ", 'profesional', 'compra', '" + rawPayload + "', NOW(), NOW(), NOW()" +
  ')';
  rows.push(row);
}
if (!rows.length) return [{ json: { sql: null, count: 0 } }];
const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, fuel, transmission, image_url, images, body_type, power_cv, color, seller_type, listing_type, raw_payload, first_seen_at, scraped_at, last_seen_at';
const onConflict = 'ON CONFLICT (id) DO UPDATE SET url=EXCLUDED.url, title=EXCLUDED.title, price=EXCLUDED.price, mileage=EXCLUDED.mileage, ' +
  "image_url=COALESCE(NULLIF(moveadvisor_market_offers.image_url,''), EXCLUDED.image_url), " +
  "images=COALESCE(NULLIF(moveadvisor_market_offers.images,''), EXCLUDED.images), " +
  'power_cv=COALESCE(EXCLUDED.power_cv, moveadvisor_market_offers.power_cv), ' +
  "color=COALESCE(NULLIF(moveadvisor_market_offers.color,''), EXCLUDED.color), " +
  'raw_payload=EXCLUDED.raw_payload, last_seen_at=NOW(), updated_at=NOW(), ' +
  // Verla en el listado ES la prueba de vida, asi que resucita.
  //
  // Sin esto, una oferta que el verificador diera de baja por error se quedaba
  // muerta para siempre aunque el scraper la volviera a ver cada cinco dias: el
  // UPSERT le refrescaba precio y kilometros y la dejaba is_active = FALSE.
  // Y era justo lo que hacia falta antes de poner a nadie a dar bajas.
  'is_active=TRUE';
const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length } }];