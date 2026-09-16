// coches.com – transform: HTML .htm → __NEXT_DATA__ classifieds.classifiedList → UPSERT market_offers
const httpOut = $input.item.json;
const html = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');

let list = [];
try {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (m) {
    const pp = JSON.parse(m[1]).props.pageProps;
    list = (pp.classifieds && pp.classifieds.classifiedList) || [];
  }
} catch (e) { list = []; }
if (!list.length) return [{ json: { sql: null, count: 0 } }];

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function titleCase(s) { return String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
function normFuel(s) {
  s = String(s || '').toLowerCase();
  const ench = (s.indexOf('enchufable') !== -1 || s.indexOf('plug') !== -1) && s.indexOf('no enchufable') === -1;
  if (s.indexOf('diesel') !== -1 || s.indexOf('diésel') !== -1) return 'Diesel';
  if (s.indexOf('híbrido') !== -1 || s.indexOf('hibrido') !== -1 || s.indexOf('hybrid') !== -1) return ench ? 'Híbrido enchufable' : 'Híbrido';
  if (s.indexOf('eléctric') !== -1 || s.indexOf('electric') !== -1) return 'Eléctrico';
  if (s.indexOf('gasolina') !== -1) return 'Gasolina';
  if (s.indexOf('glp') !== -1 || s.indexOf('gnc') !== -1 || s.indexOf('gas') !== -1) return 'Gas';
  return '';
}
function normGear(s) { s = String(s || '').toLowerCase(); if (s.indexOf('autom') !== -1) return 'Automatica'; if (s.indexOf('manual') !== -1) return 'Manual'; return ''; }
function normLabel(s) {
  s = String(s || '').toUpperCase().trim();
  if (s === '0' || s.indexOf('0 EMIS') !== -1 || s === 'ZERO' || s === 'CERO') return '0 Emisiones';
  if (s === 'ECO') return 'ECO';
  if (s === 'C') return 'C';
  if (s === 'B') return 'B';
  return s || '';
}

const rows = [];
for (const it of list) {
  const vid = it.visibleId || it.id;
  if (!vid) continue;
  const id = 'cc_' + vid;
  const brand = titleCase(it.make && it.make.name);
  const model = (it.model && it.model.name) || '';
  const version = (it.version && it.version.name) || '';
  const title = (brand + ' ' + model + ' ' + version).replace(/\s+/g, ' ').trim();
  const year = (it.registration && it.registration.year) ? String(it.registration.year) : null;
  const mileage = (it.mileage && it.mileage.amount != null) ? it.mileage.amount : null;
  const price = (it.price && it.price.amount != null) ? it.price.amount : null;
  if (price === null) continue;
  const fuel = normFuel(it.fuel && it.fuel.name);
  const transmission = normGear(it.transmission && it.transmission.name);
  const powerCv = (it.engine && it.engine.powerCv) ? it.engine.powerCv : null;
  const powerKw = powerCv ? Math.round(powerCv / 1.35962) : null;
  const bodyType = (it.body && it.body.name) || '';
  const doors = (it.measures && it.measures.bodyDoors) ? it.measures.bodyDoors : null;
  const seats = (it.measures && it.measures.bodySeats) ? it.measures.bodySeats : null;
  const color = (it.color && it.color.name) || '';
  const envLabel = normLabel(it.pollutionTag);
  const province = (it.currentProvince && it.currentProvince.name) || '';
  const imageUrl = it.image || '';
  const imgs = Array.isArray(it.imageList) ? it.imageList.map(im => im && im.name ? ('https://images.coches.com/_ccom_/' + im.name) : null).filter(Boolean).slice(0, 15) : (imageUrl ? [imageUrl] : []);
  const imagesJson = JSON.stringify(imgs).replace(/'/g, "''");
  const dealerName = (it.dealer && it.dealer.name) || '';
  const sellerType = (it.dealer && /priv|particular/i.test(it.dealer.type || '')) ? 'particular' : 'profesional';
  // Use canonical URL from API if available (it.link = '/coches-segunda-mano/slug.htm')
  // Fallback: construct with make slug + ?id= (stable even without full slug)
  const rawLink = it.link || it.href || '';
  const fallbackSlug = ('ocasion-' + brand + '-' + model).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ocasion';
  const url = rawLink
    ? ('https://www.coches.com' + rawLink + (String(rawLink).includes('?') ? '' : ('?id=' + vid)))
    : ('https://www.coches.com/coches-segunda-mano/' + fallbackSlug + '.htm?id=' + vid);

  const row = '(' +
    esc(id) + ", 'cochescom', " + esc(url) + ', ' + esc(title) + ', ' + esc(brand) + ', ' + esc(model) + ', ' + esc(version) + ', ' +
    (year || 'NULL') + ', ' + (mileage !== null ? mileage : 'NULL') + ', ' + price + ', ' +
    esc(fuel) + ', ' + esc(transmission) + ', ' + esc(color) + ', ' +
    esc(imageUrl) + ", '" + imagesJson + "', " + esc(envLabel) + ', ' + esc(dealerName) + ', ' +
    esc(province) + ', ' + esc(province) + ', ' + esc(province) + ', ' +
    "'" + sellerType + "', 'compra', " +
    (powerCv !== null ? powerCv : 'NULL') + ', ' + (powerKw !== null ? powerKw : 'NULL') + ', ' +
    esc(bodyType) + ', ' + (doors !== null ? doors : 'NULL') + ', ' + (seats !== null ? seats : 'NULL') +
    ', NOW(), NOW(), NOW()' +
  ')';
  rows.push(row);
}
if (!rows.length) return [{ json: { sql: null, count: 0 } }];

const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, fuel, transmission, color, ' +
  'image_url, images, environmental_label, dealer_name, city, province, location, seller_type, listing_type, ' +
  'power_cv, power_kw, body_type, doors, seats, first_seen_at, scraped_at, last_seen_at';

const onConflict = 'ON CONFLICT (id) DO UPDATE SET ' +
  'url = EXCLUDED.url, title = EXCLUDED.title, price = EXCLUDED.price, mileage = EXCLUDED.mileage, ' +
  'year = COALESCE(EXCLUDED.year, moveadvisor_market_offers.year), ' +
  "image_url = COALESCE(NULLIF(moveadvisor_market_offers.image_url,''), EXCLUDED.image_url), " +
  "images = COALESCE(NULLIF(moveadvisor_market_offers.images,''), EXCLUDED.images), " +
  'power_cv = COALESCE(EXCLUDED.power_cv, moveadvisor_market_offers.power_cv), ' +
  'power_kw = COALESCE(EXCLUDED.power_kw, moveadvisor_market_offers.power_kw), ' +
  'environmental_label = COALESCE(NULLIF(moveadvisor_market_offers.environmental_label,\'\'), EXCLUDED.environmental_label), ' +
  'last_seen_at = NOW(), updated_at = NOW(), ' +
  // Verla en el listado ES la prueba de vida, asi que resucita.
  //
  // Sin esto, una oferta que el verificador diera de baja por error se queda
  // muerta para siempre aunque el scraper la vuelva a ver cada pocos dias: el
  // UPSERT le refresca precio y kilometros y la deja is_active = FALSE. Mismo
  // agujero que tenia Autocasion, y hay que taparlo ANTES de poner a nadie a
  // dar bajas.
  'is_active = TRUE';

const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length } }];
