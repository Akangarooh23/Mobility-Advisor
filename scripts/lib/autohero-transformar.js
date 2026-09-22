// Autohero – transform: respuesta de su API GraphQL → UPSERT market_offers
//
// El id es «ah_» + el uuid que da su API, que es como están las 7.122 filas
// que ya hay. Cualquier otra forma de construirlo las duplicaría todas.
const res = $input.item.json;
// Con fullResponse, n8n deja el cuerpo en 'body' cuando la respuesta es JSON y
// en 'data' cuando se pide como texto. Se miran los dos y, si no hay ninguno,
// el propio item: así da igual cómo esté configurado el nodo HTTP.
const raiz = (res && res.body) ? res.body : ((res && res.data && res.data.data) ? res.data : res);
const nodo = ((raiz || {}).data || {}).searchAdV9AdsV2 || {};
const cars = nodo.data || [];
if (!cars.length) return [{ json: { sql: null, count: 0, total: nodo.total || 0 } }];

function txt(v) {
  return "'" + String(v === null || v === undefined ? '' : v).replace(/'/g, "''") + "'";
}
function num(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  const n = Number(v);
  return isNaN(n) ? 'NULL' : String(n);
}
/** Los precios vienen en céntimos: { amountMinorUnits: 2089900, conversionMajor: 100 }. */
function euros(p) {
  if (!p || p.amountMinorUnits === null || p.amountMinorUnits === undefined) return null;
  const div = Number(p.conversionMajor) || 100;
  const n = Math.round(Number(p.amountMinorUnits) / div);
  return n > 0 ? n : null;
}

/*
 * EL DICCIONARIO DE COMBUSTIBLE, HECHO CON PRUEBAS.
 *
 * El scraper viejo traía uno a mano y era falso en dos entradas. Este se
 * construyó pidiendo 19 fichas y leyendo el combustible EN TEXTO en cada una:
 *
 *     1039  «Gasolina»   x5    (el viejo decía Híbrido)
 *     1040  «Diésel»     x6
 *     1044  «Eléctrico»  x4    (el viejo decía Gas)
 *     1046  «Híbrido»    x4
 *
 * Lo que ese error ha dejado en la base, medido sobre los 1.509 coches
 * nuestros que siguen vivos: 839 con el combustible equivocado, o sea el 56 %.
 * 726 «Híbrido» que son de gasolina y 33 «Gas» que son eléctricos.
 *
 * Un código que no esté aquí NO se traduce a nada: se deja el combustible como
 * estaba. Hoy hay uno así, el 1041, en un solo coche. Escribir '' pisaría un
 * dato bueno por uno vacío, y adivinar sería repetir el error de arriba.
 */
const FUEL = { 1039: 'Gasolina', 1040: 'Diesel', 1044: 'Eléctrico', 1046: 'Híbrido' };
// 1138 manual, 1139 automático, 1141 doble embrague -que es automático-.
const GEAR = { 1138: 'Manual', 1139: 'Automatica', 1140: 'Automatica', 1141: 'Automatica' };
// Su etiqueta viene en minúscula; la base la tiene así desde siempre.
const ETIQUETA = { zero: '0 Emisiones', eco: 'ECO', c: 'C', b: 'B' };

/*
 * COLOR Y CARROCERÍA, también descifrados con pruebas.
 *
 * Su API los da como números si se le piden en 'fields'. Cada código se
 * comprobó pidiendo dos fichas y leyendo el texto: los doce colores salieron
 * 2 de 2, y las ocho carrocerías igual.
 *
 * Los nombres son los que YA están en la base, no los suyos: su código 8111 lo
 * llaman «Coche pequeño» y aquí hay 1.715 filas que dicen «Compacto», y su
 * «Pickup» son 10 filas que dicen «Pick Up». Cambiarlo partiría en dos cada
 * grupo de comparables.
 *
 * Un código que no esté aquí no se traduce: se deja lo que hubiera. Es lo
 * mismo que con el combustible, y por la misma razón: adivinar fue justo lo
 * que metió 839 coches mal.
 */
const COLOR = { 1059: 'Negro', 1060: 'Gris', 1061: 'Blanco', 1062: 'Plata', 1063: 'Marrón',
  1064: 'Rojo', 1065: 'Azul', 1066: 'Verde', 1067: 'Beige', 1068: 'Amarillo',
  1069: 'Naranja', 1071: 'Dorado' };
const CARROCERIA = { 1007: 'Cabrio', 1008: 'Coupé', 1023: 'Familiar', 1025: 'Berlina',
  1027: 'Pick Up', 1035: 'SUV', 1038: 'Monovolumen', 8111: 'Compacto' };

/** front-wheel / back-wheel / all-wheel-drive(-permanent). */
function traccion(s) {
  const t = String(s || '').toLowerCase();
  if (t.indexOf('all-wheel') !== -1 || t.indexOf('4wd') !== -1) return '4x4';
  if (t.indexOf('back') !== -1 || t.indexOf('rear') !== -1) return 'Trasera';
  if (t.indexOf('front') !== -1) return 'Delantera';
  return '';
}

/*
 * LA PROVINCIA SALE DEL CÓDIGO POSTAL, no de su campo 'city'.
 *
 * esBranch trae city="Madrid" con zipcode=45224, que es Seseña, TOLEDO. Y su
 * campo 'area' está roto: dice «Seseña» también para Barcelona, Sevilla,
 * Alicante, Bilbao y Málaga. Los dos primeros dígitos del código postal sí son
 * la provincia, sin ambigüedad.
 *
 * En 'city' se guarda lo que ellos llaman la sede -«Madrid», «Barcelona»-,
 * que es como el comprador la va a buscar. Así que un coche puede quedar con
 * city=Madrid y province=Toledo: no es una errata, es que su taller de Madrid
 * está en Seseña.
 */
const CP = ['', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Ávila', 'Badajoz', 'Baleares',
  'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Castellón', 'Ciudad Real', 'Córdoba', 'A Coruña',
  'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén', 'León',
  'Lleida', 'La Rioja', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Asturias',
  'Palencia', 'Las Palmas', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Cantabria',
  'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid',
  'Vizcaya', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'];
function provinciaDe(cp) {
  const s = String(cp || '').trim();
  if (s.length < 2) return '';
  const n = Number(s.slice(0, 2));
  return (n >= 1 && n <= 52) ? CP[n] : '';
}

const vistos = new Set();
const rows = [];
for (const car of cars) {
  const uuid = String(car.id || '');
  if (!uuid || vistos.has(uuid)) continue;
  vistos.add(uuid);
  const id = 'ah_' + uuid;

  /*
   * LA URL, RECONSTRUIDA SIEMPRE.
   *
   * 1.063 de nuestras filas tienen guardada una BÚSQUEDA
   * (/es/search/?brand0=peugeot&models0=2008...) en vez de una ficha. Eso no
   * identifica a ningún coche: 3.849 coches compartían 3.093 urls.
   *
   * Su ficha resuelve por uuid y el trozo del nombre da igual: pedí
   * /es/ford-fiesta/id/<uuid-de-un-BMW>/ y me devolvió el BMW. Aun así se pone
   * el carUrlTitle que ellos dan, para que la url guardada sea la de verdad y
   * no una redirección.
   */
  const slug = String(car.carUrlTitle || 'coche');
  const url = 'https://www.autohero.com/es/' + slug + '/id/' + uuid + '/';

  const brand = String(car.manufacturer || '').trim();
  const model = String(car.model || '').trim();
  const version = [car.subType, car.subTypeExtra]
    .map((x) => String(x === null || x === undefined ? '' : x).trim())
    .filter((x) => x && x !== 'null').join(' ').trim().slice(0, 120);
  if (!brand) continue;
  const titulo = (brand + ' ' + model + ' ' + version).split(/\s+/).join(' ').trim();

  const anio = Number(car.firstRegistrationYear) || Number(car.builtYear) || null;
  const km = (car.mileage && car.mileage.distance !== undefined) ? Number(car.mileage.distance) : null;

  const precio = euros(car.offerPrice);
  if (!(precio > 0)) continue;
  const financiado = euros(car.financedPrice);
  const cuota = euros(car.monthlyPayment);

  const fuel = FUEL[car.fuelType] || '';
  const cambio = GEAR[car.gearType] || '';

  // kw viene siempre; los CV se derivan. 1 CV = 0,7355 kW.
  const kw = Number(car.kw) > 0 ? Number(car.kw) : null;
  const cv = kw !== null ? Math.round(kw / 0.7355) : null;

  const cc = Number(car.ccm) > 0 ? Math.round(Number(car.ccm)) : null;
  const co2 = Number(car.co2Value) > 0 ? Math.round(Number(car.co2Value)) : null;
  const consumo = (car.esFuelConsumption && Number(car.esFuelConsumption.combined) > 0)
    ? Number(car.esFuelConsumption.combined) : null;
  const etiqueta = ETIQUETA[String(car.emissionSticker || '').toLowerCase()] || '';
  const trac = traccion(car.driveTrain);

  // Color, carrocería, puertas y plazas: salen de la API si se le piden en
  // 'fields'. Antes había que abrir la ficha -724 KB- para esto.
  const color = COLOR[car.outerColor] || '';
  const carroceria = CARROCERIA[car.bodyType] || '';
  const puertas = Number(car.doorCount) > 0 ? Math.round(Number(car.doorCount)) : null;
  const plazas = Number(car.seatCount) > 0 ? Math.round(Number(car.seatCount)) : null;

  const sede = car.esBranch || {};
  const ciudad = String(sede.city || '').trim();
  const provincia = provinciaDe(sede.zipcode);
  const concesionario = String(sede.name || '').trim();

  // La foto lleva un hueco {size} que hay que rellenar. 768x432- es el tamaño
  // con el que están guardadas las 3.660 que ya tenemos, y responden 200.
  let imagen = String(car.mainImageUrl || car.ahMainImageUrl || '');
  if (imagen.indexOf('{size}') !== -1) imagen = imagen.split('{size}').join('768x432-');
  if (imagen.indexOf('http') !== 0) imagen = '';
  const imagenes = imagen ? JSON.stringify([imagen]) : '[]';

  const row = '(' +
    txt(id) + ", 'autohero', " + txt(url) + ', ' + txt(titulo) + ', ' +
    txt(brand) + ', ' + txt(model) + ', ' + txt(version) + ', ' +
    num(anio) + ', ' + num(km) + ', ' + precio + ', ' +
    txt(fuel) + ', ' + txt(cambio) + ', ' +
    num(cv) + ', ' + num(kw) + ', ' +
    txt(cc === null ? '' : cc) + ', ' + txt(co2 === null ? '' : co2) + ', ' + num(consumo) + ', ' +
    txt(trac) + ', ' + txt(etiqueta) + ', ' +
    txt(color) + ', ' + txt(carroceria) + ', ' + num(puertas) + ', ' + num(plazas) + ', ' +
    txt(provincia) + ', ' + txt(ciudad) + ', ' + txt(concesionario) + ', ' +
    txt([ciudad, provincia].filter(Boolean).join(', ')) + ', ' +
    txt(imagen) + ', ' + txt(imagenes) + ', ' +
    "'profesional', 'compra', 'ES', " + num(financiado) + ', ' + num(cuota) +
    ', NOW(), NOW(), NOW()' +
  ')';
  rows.push(row);
}
if (!rows.length) return [{ json: { sql: null, count: 0, total: nodo.total || 0 } }];

const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, fuel, ' +
  'transmission, power_cv, power_kw, displacement, co2, consumption, traction, ' +
  'environmental_label, color, body_type, doors, seats, ' +
  'province, city, dealer_name, location, image_url, images, ' +
  'seller_type, listing_type, country, finance_price, monthly_price, ' +
  'first_seen_at, scraped_at, last_seen_at';

/*
 * Lo único que la API NO trae es la ITV, y de eso se encarga el enriquecedor.
 * Todo lo demás sale de aquí, así que no hay nada suyo que proteger.
 *
 * El COMBUSTIBLE sí se pisa, y a conciencia: 839 de los 1.509 coches vivos lo
 * tienen mal por el diccionario falso del scraper viejo. Pero solo cuando el
 * nuevo trae algo -NULLIF-, para que un código sin traducir no borre un dato
 * bueno.
 */
const onConflict = 'ON CONFLICT (id) DO UPDATE SET ' +
  // La url se pisa a propósito: 1.063 filas tienen guardada una búsqueda.
  'url = EXCLUDED.url, title = EXCLUDED.title, price = EXCLUDED.price, ' +
  'mileage = COALESCE(EXCLUDED.mileage, moveadvisor_market_offers.mileage), ' +
  'year = COALESCE(EXCLUDED.year, moveadvisor_market_offers.year), ' +
  "version = COALESCE(NULLIF(EXCLUDED.version, ''), moveadvisor_market_offers.version), " +
  "fuel = COALESCE(NULLIF(EXCLUDED.fuel, ''), moveadvisor_market_offers.fuel), " +
  "transmission = COALESCE(NULLIF(EXCLUDED.transmission, ''), moveadvisor_market_offers.transmission), " +
  'power_cv = COALESCE(EXCLUDED.power_cv, moveadvisor_market_offers.power_cv), ' +
  'power_kw = COALESCE(EXCLUDED.power_kw, moveadvisor_market_offers.power_kw), ' +
  "displacement = COALESCE(NULLIF(EXCLUDED.displacement, ''), moveadvisor_market_offers.displacement), " +
  "co2 = COALESCE(NULLIF(EXCLUDED.co2, ''), moveadvisor_market_offers.co2), " +
  'consumption = COALESCE(EXCLUDED.consumption, moveadvisor_market_offers.consumption), ' +
  "traction = COALESCE(NULLIF(EXCLUDED.traction, ''), moveadvisor_market_offers.traction), " +
  "environmental_label = COALESCE(NULLIF(EXCLUDED.environmental_label, ''), moveadvisor_market_offers.environmental_label), " +
  // El color NO se pisa: puede llevar puesto el que contestó una persona.
  "color = COALESCE(NULLIF(moveadvisor_market_offers.color, ''), NULLIF(EXCLUDED.color, '')), " +
  "body_type = COALESCE(NULLIF(EXCLUDED.body_type, ''), moveadvisor_market_offers.body_type), " +
  'doors = COALESCE(EXCLUDED.doors, moveadvisor_market_offers.doors), ' +
  'seats = COALESCE(EXCLUDED.seats, moveadvisor_market_offers.seats), ' +
  // La sede se pisa: las 2.998 filas que tienen algo dicen «Toda España», que
  // no es una provincia ni una ciudad.
  "province = COALESCE(NULLIF(EXCLUDED.province, ''), moveadvisor_market_offers.province), " +
  "city = COALESCE(NULLIF(EXCLUDED.city, ''), moveadvisor_market_offers.city), " +
  "dealer_name = COALESCE(NULLIF(EXCLUDED.dealer_name, ''), moveadvisor_market_offers.dealer_name), " +
  "location = COALESCE(NULLIF(EXCLUDED.location, ''), moveadvisor_market_offers.location), " +
  "image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), moveadvisor_market_offers.image_url), " +
  "images = CASE WHEN EXCLUDED.images <> '[]' THEN EXCLUDED.images ELSE moveadvisor_market_offers.images END, " +
  // Los precios se pisan sin COALESCE: son datos vivos, y un NULL aquí también
  // es la verdad -«este coche ya no tiene oferta de financiación»-.
  'finance_price = EXCLUDED.finance_price, ' +
  'monthly_price = EXCLUDED.monthly_price, ' +
  'last_seen_at = NOW(), updated_at = NOW(), ' +
  // Estar en su catálogo ES la prueba de vida, así que resucita.
  'is_active = TRUE';

const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length, total: nodo.total || 0 } }];
