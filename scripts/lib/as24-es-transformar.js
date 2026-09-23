// AutoScout24 España: del HTML del listado a un UPSERT.
const httpOut = $input.item.json;
const html = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');

let listings = [];
try {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (m) { listings = JSON.parse(m[1]).props.pageProps.listings || []; }
} catch (e) { listings = []; }

if (!listings.length) return [{ json: { sql: null, count: 0 } }];

function normalizeFuel(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.indexOf('electro/gasolina') !== -1 || s.indexOf('electro/di') !== -1 || (s.indexOf('electro') !== -1 && s.indexOf('/') !== -1)) return 'Híbrido';
  if (s.indexOf('diesel') !== -1 || s.indexOf('diésel') !== -1) return 'Diesel';
  if (s.indexOf('eléctrico') !== -1 || s.indexOf('electrico') !== -1 || s === 'electro') return 'Eléctrico';
  if (s.indexOf('gasolina') !== -1) return 'Gasolina';
  if (s.indexOf('glp') !== -1 || s.indexOf('gnc') !== -1 || s.indexOf('gas ') !== -1 || s.indexOf('gas licuado') !== -1 || s.indexOf('gas natural') !== -1) return 'Gas';
  if (s.indexOf('híbrido') !== -1 || s.indexOf('hibrido') !== -1) return 'Híbrido';
  return raw || '';
}
function normalizeGear(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.indexOf('autom') !== -1) return 'Automatica';
  if (s.indexOf('manual') !== -1) return 'Manual';
  return '';
}
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function num(s) { const n = parseInt(String(s).replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; }

const rows = [];
for (const it of listings) {
  const v = it.vehicle || {};
  const id = 'as_' + String(it.id || it.identifier || '');
  if (id === 'as_') continue;
  const url = it.url ? ('https://www.autoscout24.es' + it.url) : '';
  const brand = v.make || '';
  const model = v.model || '';
  const version = v.modelVersionInput || v.variant || '';
  const title = (brand + ' ' + model + ' ' + version).replace(/\s+/g, ' ').trim();
  const price = (it.price && it.price.priceRaw != null) ? String(it.price.priceRaw) : 'NULL';
  const mileage = (num(v.mileageInKm) != null) ? String(num(v.mileageInKm)) : 'NULL';
  const fuel = normalizeFuel(v.fuel);
  const transmission = normalizeGear(v.transmission);

  // año y potencia salen de vehicleDetails, que es una lista de etiquetas.
  let year = 'NULL', powerCv = null, powerKw = null;
  const det = Array.isArray(it.vehicleDetails) ? it.vehicleDetails : [];
  for (const d of det) {
    const lab = String(d.ariaLabel || '').toLowerCase();
    const val = String(d.data || '');
    if (lab.indexOf('año') !== -1 || lab.indexOf('ano') !== -1) { const y = (val.match(/(\d{4})/) || [])[1]; if (y) year = y; }
    if (lab.indexOf('potencia') !== -1) {
      const kw = (val.match(/(\d+)\s*kW/i) || [])[1];
      const cv = (val.match(/(\d+)\s*CV/i) || [])[1];
      if (kw) powerKw = parseInt(kw, 10);
      if (cv) powerCv = parseInt(cv, 10);
    }
  }
  if (powerCv == null && powerKw != null) powerCv = Math.round(powerKw * 1.35962);
  if (powerKw == null && powerCv != null) powerKw = Math.round(powerCv / 1.35962);

  let displacement = null;
  { const cc = parseInt(String(v.engineDisplacementInCCM || '').replace(/[^\d]/g, ''), 10);
    if (!isNaN(cc) && cc > 0) displacement = cc; }

  const imgsArr = Array.isArray(it.images) ? it.images.filter(Boolean).slice(0, 15) : [];
  const imageUrl = imgsArr[0] || '';
  const imagesJson = JSON.stringify(imgsArr).replace(/'/g, "''");
  const loc = it.location || {};
  const city = loc.city || '';
  const seller = it.seller || {};
  const dealerName = seller.companyName || '';
  const sellerType = (seller.type === 'Dealer' || (seller.dealer)) ? 'profesional' : 'particular';
  const rawPayload = JSON.stringify(it).replace(/'/g, "''");

  // El color sale del slug de la URL: ~98% fiable y sin una petición extra.
  let color = '';
  { const CMAP = {blanco:'Blanco',negro:'Negro',gris:'Gris',antracita:'Gris',plata:'Plata',plateado:'Plata',azul:'Azul',rojo:'Rojo',verde:'Verde',amarillo:'Amarillo',naranja:'Naranja',marron:'Marrón',beige:'Beige',dorado:'Dorado',granate:'Granate',burdeos:'Granate',morado:'Morado',violeta:'Morado',rosa:'Rosa',cobre:'Cobre',bronce:'Bronce'};
    const slug = String(it.url || '').replace(/-cat_.*$/, '').split('/').pop();
    const toks = slug.split('-');
    for (let i = toks.length - 1; i >= 0; i--) { if (CMAP[toks[i]]) { color = CMAP[toks[i]]; break; } } }

  const row = '(' +
    esc(id) + ", 'autoscout24', " + esc(url) + ', ' + esc(title) + ', ' + esc(brand) + ', ' + esc(model) + ', ' + esc(version) + ', ' +
    year + ', ' + mileage + ', ' + price + ', ' +
    esc(fuel) + ', ' + esc(transmission) + ', ' +
    esc(imageUrl) + ", '" + imagesJson + "', " +
    esc(city) + ', ' + esc(city) + ', ' + esc(city) + ', ' +
    esc(dealerName) + ", '" + sellerType + "', 'compra', " +
    (powerCv !== null ? String(powerCv) : 'NULL') + ', ' + (powerKw !== null ? String(powerKw) : 'NULL') + ', ' +
    (displacement !== null ? String(displacement) : 'NULL') + ', ' + esc(color) + ", '" + rawPayload + "', " +
    "'ES', NOW(), NOW(), NOW(), " + price +
  ')';
  rows.push(row);
}

if (!rows.length) return [{ json: { sql: null, count: 0 } }];

const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, fuel, transmission, '
  + 'image_url, images, city, province, location, dealer_name, seller_type, listing_type, '
  + 'power_cv, power_kw, displacement, color, raw_payload, country, first_seen_at, scraped_at, last_seen_at, finance_price';

const onConflict = 'ON CONFLICT (id) DO UPDATE SET '
  + 'url = EXCLUDED.url, title = EXCLUDED.title, '
  // El precio NO se pisa si la fila ya tiene un precio al contado corregido.
  // Se reconoce porque finance_price está puesto y es distinto de price.
  + 'price = CASE WHEN moveadvisor_market_offers.finance_price IS NOT NULL '
  + 'AND moveadvisor_market_offers.finance_price IS DISTINCT FROM moveadvisor_market_offers.price '
  + 'AND moveadvisor_market_offers.finance_price = EXCLUDED.finance_price '
  + 'THEN moveadvisor_market_offers.price ELSE EXCLUDED.price END, '
  + 'finance_price = EXCLUDED.finance_price, '
  + 'mileage = EXCLUDED.mileage, '
  + "image_url = COALESCE(NULLIF(moveadvisor_market_offers.image_url,''), EXCLUDED.image_url), "
  + "images = COALESCE(NULLIF(moveadvisor_market_offers.images,''), EXCLUDED.images), "
  + 'power_cv = COALESCE(EXCLUDED.power_cv, moveadvisor_market_offers.power_cv), '
  + 'power_kw = COALESCE(EXCLUDED.power_kw, moveadvisor_market_offers.power_kw), '
  + 'displacement = COALESCE(EXCLUDED.displacement, moveadvisor_market_offers.displacement), '
  // Dos comillas, no cuatro: con '''' se comparaba contra la cadena «''», de
  // dos caracteres, y un color vacío no se rellenaba jamás.
  + "color = COALESCE(NULLIF(moveadvisor_market_offers.color,''), EXCLUDED.color), "
  + 'country = EXCLUDED.country, '
  // Volver a verla es señal de que sigue viva: sin esto el verificador la daría
  // por muerta aunque el listado la acabe de enseñar.
  + 'is_active = TRUE, last_checked_at = NOW(), '
  + 'raw_payload = EXCLUDED.raw_payload, last_seen_at = NOW(), updated_at = NOW()';

const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length } }];