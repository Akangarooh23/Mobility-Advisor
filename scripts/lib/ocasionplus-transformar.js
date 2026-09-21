// OcasionPlus – transform: HTML del listado → JSON-LD ItemList → UPSERT market_offers
//
// El id es «op_» más la cola de la url, que es como están las 27.000 filas que
// ya hay: comprobado sobre ocho al azar, ocho de ocho. Cualquier otra forma de
// construirlo las duplicaría todas y dejaría las viejas muertas para siempre.
const httpOut = $input.item.json;
const html = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');

/*
 * Los coches vienen en un bloque JSON-LD de tipo ItemList, veinte por página.
 *
 * El HTML tiene seis bloques JSON-LD -BreadcrumbList, WebPage, Product,
 * ItemList, Organization, WebSite- y solo uno es el que lleva coches. Se
 * recorren todos y se parsea cada uno por separado: si uno viene roto, los
 * demás siguen sirviendo.
 */
let coches = [];
for (const trozo of html.split('application/ld+json').slice(1)) {
  const ini = trozo.indexOf('>');
  const fin = trozo.indexOf('</script>');
  if (ini === -1 || fin === -1) continue;
  let j = null;
  try { j = JSON.parse(trozo.slice(ini + 1, fin).trim()); } catch (e) { continue; }
  if (!j || j['@type'] !== 'ItemList') continue;
  const lista = j.itemListElement || [];
  coches = lista.filter((x) => x && (x['@type'] === 'Vehicle' || x['@type'] === 'Car'));
  if (coches.length) break;
}
if (!coches.length) return [{ json: { sql: null, count: 0 } }];

// Dos escapadores, y la diferencia importa: casi todas las columnas de texto de
// esta tabla son NOT NULL con '' por defecto, así que un vacío tiene que viajar
// como cadena vacía y no como NULL, o la fila entera se rechaza.
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
  if (s.indexOf('diesel') !== -1 || s.indexOf('diésel') !== -1 || s.indexOf('gasoleo') !== -1) return 'Diesel';
  if (s.indexOf('híbrido') !== -1 || s.indexOf('hibrido') !== -1) return ench ? 'Híbrido enchufable' : 'Híbrido';
  // OJO con el acento: "eléctrico".indexOf("lectric") da -1 porque la é no es
  // una e. En coches.com eso habría dejado a todos los eléctricos sin CO₂.
  if (s.indexOf('éctric') !== -1 || s.indexOf('ectric') !== -1) return 'Eléctrico';
  if (s.indexOf('gasolina') !== -1) return 'Gasolina';
  if (s.indexOf('glp') !== -1 || s.indexOf('gnc') !== -1 || s.indexOf('gas') !== -1) return 'Gas';
  return '';
}
function normGear(s) {
  s = String(s || '').toUpperCase();
  if (s.indexOf('AUTOM') !== -1) return 'Automatica';
  if (s.indexOf('MANUAL') !== -1) return 'Manual';
  return '';
}
// La potencia viene dentro del nombre: «Hyundai i30 1.4 CVVT Comfort (109 CV)».
// Sin expresión regular: este código viaja dentro de una cadena y dentro de un
// JSON, y por el camino las barras se pierden.
function caballos(nombre) {
  const t = String(nombre || '');
  const i = t.indexOf(' CV)');
  if (i === -1) return null;
  const abre = t.lastIndexOf('(', i);
  if (abre === -1) return null;
  const n = Number(t.slice(abre + 1, i).trim());
  return (Number.isFinite(n) && n >= 20 && n <= 1500) ? Math.round(n) : null;
}

const rows = [];
for (const it of coches) {
  const url = String((it.offers && it.offers.url) || '').trim();
  if (!url) continue;
  // El id, de la cola de la url. Sin cola no hay id estable y la fila se queda
  // fuera: inventarse uno sería crear un duplicado en cada pasada.
  const limpia = url.charAt(url.length - 1) === '/' ? url.slice(0, -1) : url;
  const partes = limpia.split('-');
  const cola = partes[partes.length - 1];
  if (!cola || cola.length < 4) continue;
  const id = 'op_' + cola;

  const precio = Number(it.offers && it.offers.price);
  if (!(precio > 0)) continue;

  const brand = String((it.brand && it.brand.name) || '');
  const nombre = String(it.name || '');
  // `model` trae marca, modelo y versión juntos: «Hyundai i30 1.4 CVVT Comfort
  // (109 CV)». El modelo corto está en `name`: «Hyundai i30».
  const completo = String(it.model || nombre);
  const modelo = nombre.indexOf(brand) === 0 ? nombre.slice(brand.length).trim() : nombre;
  const version = completo.indexOf(nombre) === 0 ? completo.slice(nombre.length).trim() : completo;

  const anio = String(it.productionDate || '').slice(0, 4);
  const km = (it.mileageFromOdometer && it.mileageFromOdometer.value !== undefined)
    ? Number(it.mileageFromOdometer.value) : null;

  const row = '(' +
    txt(id) + ", 'ocasionplus', " + txt(limpia) + ', ' + txt(completo) + ', ' +
    txt(brand) + ', ' + txt(modelo) + ', ' + txt(version) + ', ' +
    num(anio) + ', ' + num(km) + ', ' + precio + ', ' +
    txt(normFuel(it.fuelType)) + ', ' + txt(normGear(it.vehicleTransmission)) + ', ' +
    txt(it.image) + ', ' + num(caballos(completo)) + ', ' +
    "'profesional', 'compra', 'ES'" +
    ', NOW(), NOW(), NOW()' +
  ')';
  rows.push(row);
}
if (!rows.length) return [{ json: { sql: null, count: 0 } }];

const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, fuel, transmission, ' +
  'image_url, power_cv, seller_type, listing_type, country, first_seen_at, scraped_at, last_seen_at';

/*
 * Lo que el listado NO trae se queda como está: color, carrocería, provincia,
 * etiqueta, puertas, plazas, cilindrada y CO₂.
 *
 * Las 8.036 filas vivas ya tienen color, carrocería, provincia y etiqueta al
 * 100 % de la época en que el scraper leía la ficha. Machacarlas con vacío en
 * cada pasada sería tirar ese trabajo cada noche.
 */
const onConflict = 'ON CONFLICT (id) DO UPDATE SET ' +
  'url = EXCLUDED.url, title = EXCLUDED.title, price = EXCLUDED.price, ' +
  'mileage = COALESCE(EXCLUDED.mileage, moveadvisor_market_offers.mileage), ' +
  'year = COALESCE(EXCLUDED.year, moveadvisor_market_offers.year), ' +
  "fuel = COALESCE(NULLIF(EXCLUDED.fuel, ''), moveadvisor_market_offers.fuel), " +
  "transmission = COALESCE(NULLIF(EXCLUDED.transmission, ''), moveadvisor_market_offers.transmission), " +
  "image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), moveadvisor_market_offers.image_url), " +
  'power_cv = COALESCE(EXCLUDED.power_cv, moveadvisor_market_offers.power_cv), ' +
  'last_seen_at = NOW(), updated_at = NOW(), ' +
  // Verla en el listado ES la prueba de vida, así que resucita.
  //
  // Sin esto, una oferta que el verificador diera de baja por error se queda
  // muerta para siempre aunque el scraper la vuelva a ver: el UPSERT le
  // refresca precio y kilómetros y la deja is_active = FALSE.
  'is_active = TRUE';

const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length } }];
