// Flexicar – transform: JSON de services.flexicar.es/api/v1/vehicles → UPSERT market_offers
//
// El id de la oferta es el id de Flexicar TAL CUAL, sin prefijo: así están las
// 27.454 filas que ya hay en la base. Ponerle 'fx_' delante las duplicaría
// todas y dejaría las viejas muertas para siempre.
const httpOut = $input.item.json;
const cuerpo = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');

let list = [];
try {
  const j = JSON.parse(cuerpo);
  list = j.results || [];
} catch (e) { list = []; }
if (!list.length) return [{ json: { sql: null, count: 0 } }];

// Slug del concesionario -> provincia. Lo trae el listado en pageProps y lo
// pasa el orquestador: son 182 y aparecen nuevos, así que se lee en vivo en
// vez de dejarlo escrito aquí.
let provinciaDe = {};
try {
  const seg = $('Params').first().json || {};
  provinciaDe = seg.provincias || {};
} catch (e) { provinciaDe = {}; }

// Dos escapadores, y la diferencia importa: casi todas las columnas de texto
// de esta tabla son NOT NULL con '' por defecto -url, title, brand, color,
// province, environmental_label...-, así que un vacío tiene que viajar como
// cadena vacía y no como NULL, o la fila entera se rechaza.
function txt(v) {
  return "'" + String(v === null || v === undefined ? '' : v).replace(/'/g, "''") + "'";
}
function num(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  const n = Number(v);
  return isNaN(n) ? 'NULL' : String(n);
}
function normFuel(s) {
  s = String(s || '').toLowerCase();
  const ench = s.indexOf('enchufable') !== -1 && s.indexOf('no enchufable') === -1;
  if (s.indexOf('diesel') !== -1 || s.indexOf('diésel') !== -1) return 'Diesel';
  if (s.indexOf('híbrido') !== -1 || s.indexOf('hibrido') !== -1) return ench ? 'Híbrido enchufable' : 'Híbrido';
  // OJO con el acento: "eléctrico".indexOf("lectric") da -1 porque la é no es
  // una e. En coches.com esto habría dejado a todos los eléctricos sin CO₂.
  if (s.indexOf('éctric') !== -1 || s.indexOf('ectric') !== -1) return 'Eléctrico';
  if (s.indexOf('gasolina') !== -1) return 'Gasolina';
  if (s.indexOf('glp') !== -1 || s.indexOf('gnc') !== -1 || s.indexOf('gas') !== -1) return 'Gas';
  return '';
}
function normGear(s) {
  s = String(s || '').toLowerCase();
  if (s.indexOf('autom') !== -1) return 'Automatica';
  if (s.indexOf('manual') !== -1) return 'Manual';
  return '';
}
function normLabel(s) {
  s = String(s || '').toUpperCase().trim();
  if (s === '0' || s === 'ZERO' || s === 'CERO' || s.indexOf('0 EMIS') !== -1) return '0 Emisiones';
  if (s === 'ECO' || s === 'C' || s === 'B') return s;
  return '';
}

const rows = [];
for (const it of list) {
  const vid = it.id;
  if (!vid) continue;
  const id = String(vid);
  const slug = String(it.slug || '');
  // Sin slug no hay ficha que mirar después, y una URL inventada es peor que
  // ninguna: el enriquecedor la seguiría y escribiría lo que encontrase.
  if (!slug) continue;
  const url = 'https://www.flexicar.es/coches-ocasion/' + slug + '/';

  const brand = String(it.brand || '');
  const model = String(it.model || '');
  const version = String(it.version || '');
  const title = (brand + ' ' + model + ' ' + version).replace(/\s+/g, ' ').trim();

  /*
   * LOS TRES PRECIOS, Y CUÁL ES «EL PRECIO».
   *
   * Flexicar llama `price` al precio CON financiación, y `cashPrice` al de
   * contado. Son distintos y no por poco: un Toyota C-HR sale a 17.290
   * financiado y 19.490 al contado; un BMW Serie 1, 20.490 y 23.490.
   *
   * Guardar `price` como precio -lo que venía haciéndose desde el scraper
   * viejo, no es cosa de la versión nueva- mete el catálogo español entero
   * entre 1.500 y 3.000 € por debajo de lo que vale. Y estas ofertas son
   * COMPARABLES: de su mediana sale market_price_es, y de ahí el margen de
   * cada coche alemán. Un comparable barato de más hace que un coche alemán
   * parezca peor negocio de lo que es.
   *
   * El precio que se publica es el de contado, que es lo que cuesta el coche
   * sin comprometerse a financiar.
   */
  const contado = Number(it.cashPrice) > 0 ? Number(it.cashPrice) : null;
  const financiado = Number(it.price) > 0 ? Number(it.price) : null;
  const price = (contado !== null) ? contado : financiado;
  if (price === null) continue;
  // El financiado solo se guarda si de verdad hay dos precios distintos. Si el
  // coche no tiene oferta de financiación, repetir el mismo número en las dos
  // columnas haría pensar que sí la tiene.
  const finance = (contado !== null && financiado !== null && financiado < contado) ? financiado : null;
  const cuota = Number(it.quotaPrice) > 0 ? Number(it.quotaPrice) : null;

  const year = Number(it.year) > 0 ? Number(it.year) : null;
  /*
   * Los kilómetros, y «no lo sé» no son cero.
   *
   * `Number('')` es 0, así que un coche que llegara sin el dato entraba con
   * 0 km: en el buscador sale como seminuevo y, peor, hace de comparable de
   * coches casi nuevos. Un 0 de verdad —un km 0— sí se guarda.
   */
  const kmTexto = String(it.km ?? '').trim();
  const km = (kmTexto !== '' && Number.isFinite(Number(kmTexto))) ? Number(kmTexto) : null;
  /*
   * La sede es «Madrid - Villaverde»: la ciudad es lo de delante.
   *
   * Iba entera en `city`, y `city` es un dato con el que se filtra y con el que
   * se compone «Madrid - Villaverde, Madrid» en el listado. Las 27.454 filas
   * viejas llevan solo la ciudad —así lo hacía el scraper anterior—, con lo
   * que el catálogo tenía dos criterios según la antigüedad de la fila.
   */
  const sede = String(it.carDealership || '').trim();
  const ciudad = sede.split(' - ')[0].trim();
  const provincia = provinciaDe[String(it.carDealershipSlug || '')] || '';

  // Las imágenes llegan de dos formas: cadenas en el listado y objetos
  // {image, detail, label} en la ficha. Se aceptan las dos.
  const fotos = Array.isArray(it.images)
    ? it.images.map(x => (typeof x === 'string' ? x : (x && x.image) || null)).filter(Boolean).slice(0, 15)
    : (it.image ? [it.image] : []);
  const imagesJson = JSON.stringify(fotos).replace(/'/g, "''");

  const row = '(' +
    txt(id) + ", 'flexicar', " + txt(url) + ', ' + txt(title) + ', ' +
    txt(brand) + ', ' + txt(model) + ', ' + txt(version) + ', ' +
    num(year) + ', ' + num(km) + ', ' + price + ', ' +
    txt(normFuel(it.fuel)) + ', ' + txt(normGear(it.transmission)) + ', ' + txt(it.color) + ', ' +
    txt(it.image) + ", '" + imagesJson + "', " + txt(normLabel(it.ecoSticker)) + ', ' +
    txt(sede) + ', ' + txt(ciudad) + ', ' + txt(provincia) + ', ' + txt(ciudad) + ', ' +
    "'profesional', 'compra', 'ES', " + num(finance) + ', ' + num(cuota) +
    ', NOW(), NOW(), NOW()' +
  ')';
  rows.push(row);
}
if (!rows.length) return [{ json: { sql: null, count: 0 } }];

const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, fuel, transmission, color, ' +
  'image_url, images, environmental_label, dealer_name, city, province, location, seller_type, listing_type, ' +
  'country, finance_price, monthly_price, first_seen_at, scraped_at, last_seen_at';

// Lo que el listado NO trae -puertas, plazas, carrocería, cilindrada, potencia-
// se queda como está: lo rellena el enriquecedor mirando la ficha, y machacarlo
// con NULL en cada pasada sería borrar su trabajo cada noche.
const onConflict = 'ON CONFLICT (id) DO UPDATE SET ' +
  // Los kilómetros no se pisan con NULL: si una vuelta no trae el dato, los que
  // había siguen siendo verdad y el enriquecedor no los rellena.
  'url = EXCLUDED.url, title = EXCLUDED.title, price = EXCLUDED.price, ' +
  'mileage = COALESCE(EXCLUDED.mileage, moveadvisor_market_offers.mileage), ' +
  'year = COALESCE(EXCLUDED.year, moveadvisor_market_offers.year), ' +
  'fuel = COALESCE(NULLIF(EXCLUDED.fuel, \'\'), moveadvisor_market_offers.fuel), ' +
  'transmission = COALESCE(NULLIF(EXCLUDED.transmission, \'\'), moveadvisor_market_offers.transmission), ' +
  'color = COALESCE(NULLIF(EXCLUDED.color, \'\'), moveadvisor_market_offers.color), ' +
  'province = COALESCE(NULLIF(EXCLUDED.province, \'\'), moveadvisor_market_offers.province), ' +
  // La sede, la ciudad y el sitio sí se refrescan: no estaban en el UPSERT, y
  // por eso convivían dos criterios de `city` según cuándo entró la fila. Una
  // vuelta del scraper las deja todas iguales. El concesionario también cambia
  // —un coche se mueve de sede—, así que tampoco vale dejarlo del alta.
  "dealer_name = COALESCE(NULLIF(EXCLUDED.dealer_name, ''), moveadvisor_market_offers.dealer_name), " +
  "city = COALESCE(NULLIF(EXCLUDED.city, ''), moveadvisor_market_offers.city), " +
  "location = COALESCE(NULLIF(EXCLUDED.location, ''), moveadvisor_market_offers.location), " +
  "image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), moveadvisor_market_offers.image_url), " +
  "images = COALESCE(NULLIF(EXCLUDED.images, '[]'), moveadvisor_market_offers.images), " +
  'environmental_label = COALESCE(NULLIF(EXCLUDED.environmental_label, \'\'), moveadvisor_market_offers.environmental_label), ' +
  // Los tres precios se PISAN, sin COALESCE. Son datos vivos y además es lo
  // que corrige las filas que se escribieron con el precio financiado en la
  // columna del de contado: basta una vuelta del scraper. Un NULL aquí también
  // es la verdad -«este coche no tiene oferta de financiación»- y por eso tiene
  // que poder borrar lo que hubiera.
  'finance_price = EXCLUDED.finance_price, ' +
  'monthly_price = EXCLUDED.monthly_price, ' +
  'last_seen_at = NOW(), updated_at = NOW(), ' +
  // Verla en el catálogo ES la prueba de vida, así que resucita.
  //
  // Sin esto, una oferta que el verificador diera de baja por error se queda
  // muerta para siempre aunque el scraper la vuelva a ver: el UPSERT le
  // refresca precio y kilómetros y la deja is_active = FALSE.
  'is_active = TRUE';

const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length } }];
