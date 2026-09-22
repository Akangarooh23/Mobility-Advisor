// CanalCar – transform: HTML del listado → tarjetas <article> → UPSERT market_offers
//
// El id es «cnc_» + el data-coche-id de la tarjeta, que es como están las 644
// filas que ya hay. Cualquier otra forma de construirlo las duplicaría todas.
const httpOut = $input.item.json;
const html = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');

/*
 * Aplanar ANTES de partir.
 *
 * Las etiquetas de la tarjeta llevan saltos de línea y sangrados dentro, así
 * que buscar literales como 'class="vehicle__specs vehicle__features">' sobre
 * el html crudo no encuentra nada.
 */
const plano = html.split(/\s+/).join(' ');
const tarjetas = plano.split('<article class="vehicle').slice(1);
if (!tarjetas.length) return [{ json: { sql: null, count: 0 } }];

function txt(v) {
  return "'" + String(v === null || v === undefined ? '' : v).replace(/'/g, "''") + "'";
}
function num(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  const n = Number(v);
  return isNaN(n) ? 'NULL' : String(n);
}
/** El valor de un atributo, sin expresiones regulares. */
function atributo(trozo, nombre) {
  const i = trozo.indexOf(nombre + '="');
  if (i === -1) return null;
  const desde = i + nombre.length + 2;
  const fin = trozo.indexOf('"', desde);
  return fin === -1 ? null : trozo.slice(desde, fin);
}
/** Lo que hay entre dos marcas, que es como se saca el texto de un span. */
function entre(trozo, desde, hasta) {
  const i = trozo.indexOf(desde);
  if (i === -1) return null;
  const j = trozo.indexOf(hasta, i + desde.length);
  return j === -1 ? null : trozo.slice(i + desde.length, j).trim();
}
/** Quita las etiquetas de un trozo de html y deja el texto. */
function sinEtiquetas(s) {
  let out = '';
  let dentro = false;
  const t = String(s || '');
  for (let i = 0; i < t.length; i++) {
    const ch = t.charAt(i);
    if (ch === '<') dentro = true;
    else if (ch === '>') dentro = false;
    else if (!dentro) out += ch;
  }
  return out.split(/\s+/).join(' ').trim();
}
/** Los dígitos de un texto: «50.400kms» -> 50400, «442 €» -> 442. */
function digitos(t) {
  if (t === null || t === undefined) return null;
  let n = '';
  const s = String(t);
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch >= '0' && ch <= '9') n += ch;
  }
  return n ? Number(n) : null;
}
/** 'land-rover' -> 'Land Rover'. Es como están guardadas las 644 filas. */
function cap(s) {
  return String(s || '').split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}
function normFuel(s) {
  s = String(s || '').toLowerCase();
  if (s.indexOf('gnc') !== -1 || s.indexOf('glp') !== -1 || s.indexOf('gas natural') !== -1) return 'Gas';
  if (s.indexOf('ctric') !== -1) return 'Eléctrico';
  if (s.indexOf('brid') !== -1) return 'Híbrido';
  if (s.indexOf('sel') !== -1) return 'Diesel';
  if (s.indexOf('gasolina') !== -1) return 'Gasolina';
  return '';
}
function normGear(s) {
  s = String(s || '').toLowerCase();
  if (s.indexOf('autom') !== -1) return 'Automatica';
  if (s.indexOf('manual') !== -1) return 'Manual';
  return '';
}

const vistos = new Set();
const rows = [];
for (const t of tarjetas) {
  const idWeb = atributo(t, 'data-coche-id');
  if (!idWeb || vistos.has(idWeb)) continue;
  vistos.add(idWeb);
  const id = 'cnc_' + idWeb;

  const ruta = atributo(t, 'data-url') || atributo(t, 'href') || '';
  if (ruta.indexOf('/coches-ocasion/') !== 0) continue;
  const url = 'https://www.canalcar.es' + ruta.split('?')[0];

  /*
   * MARCA Y MODELO SALEN DE LA RUTA, no del título.
   *
   * No porque la ruta sea mejor dato -no lo es-, sino porque así están
   * guardadas las 644 filas que ya hay: 'Citroen | Ds3', 'Volvo | Xc60'. La
   * ficha dice 'DS | DS 3', que es lo correcto, pero cambiarlo aquí le
   * cambiaría la marca a 356 coches vivos de golpe, y con ella su comparable.
   *
   * De las 454 tarjetas, 11 enlazan a una ruta cuyo último tramo es de otra
   * versión. Lo que no casa en esas once es la VERSIÓN, no la marca ni el
   * modelo: las tres que miré eran /nissan/townstar/, /renault/kadjar/ y
   * /seat/tarraco/, correctas hasta el segundo tramo. Por eso la versión se
   * toma del span de la tarjeta y no de la ruta, como hacía el scraper viejo.
   */
  const tramos = ruta.split('/').filter(Boolean);
  const brand = cap(tramos[1] || '');
  const model = cap(tramos[2] || '');
  const version = sinEtiquetas(entre(t, '<span class="vehicle__version">', '</span>') || '').slice(0, 80);

  // El title del enlace es el nombre entero tal como lo escriben ellos.
  const titulo = (atributo(t, 'title') || (brand + ' ' + model + ' ' + version))
    .split(/\s+/).join(' ').trim();

  /*
   * La línea de datos: <li>2023</li><li>50.400kms</li><li>Híbrido</li><li>Automático</li>
   *
   * Se lee de la primera lista, no de la segunda: la de la ubicación lleva
   * también la clase 'vehicle__features', y buscar el literal entero
   * 'vehicle__specs vehicle__features"' distingue una de otra.
   */
  const specs = entre(t, 'class="vehicle__specs vehicle__features">', '</ul>') || '';
  let anio = null;
  let km = null;
  let fuel = '';
  let cambio = '';
  for (const li of specs.split('<li>')) {
    const p = sinEtiquetas(li);
    if (!p) continue;
    const n = digitos(p);
    if (p.indexOf('km') !== -1) km = n;
    else if (n !== null && n > 1900 && n < 2100) anio = n;
    else if (normFuel(p)) fuel = normFuel(p);
    else if (normGear(p)) cambio = normGear(p);
  }

  /*
   * LA PROVINCIA, que hasta hoy estaba al 0 %.
   *
   * La tarjeta la trae en su propia lista, detrás del icono de localización.
   * Las 454 dicen «Madrid»: CanalCar es un concesionario solo, en la A-6. Aun
   * así se lee de la tarjeta en vez de escribir 'Madrid' a mano, porque el día
   * que abran en Sevilla nadie se va a acordar de esta línea.
   */
  const ubic = entre(t, 'vehicle__specs-location', '</ul>') || '';
  const provincia = sinEtiquetas(entre(ubic, '</i>', '</li>') || '');

  /*
   * EL PRECIO.
   *
   * data-precio viene como '31990.0000', así que los dígitos a pelo darían
   * 319.900.000 €. Hay que cortar por el punto, y eso lo hace parseFloat.
   */
  const crudo = atributo(t, 'data-precio');
  const precio = crudo ? Math.round(parseFloat(crudo)) : null;
  if (!(precio > 0)) continue;

  // La cuota mensual, que tampoco teníamos: «442 €/mes».
  const cuota = digitos(entre(t, 'class="vehicle__quota">', '€'));

  // La foto. El host cambió de content.canalcar.es a www.canalcar.es; los dos
  // siguen sirviendo, así que no hay prisa por reescribir las viejas.
  let imagen = '';
  const iFoto = t.indexOf('vehicle-photo');
  if (iFoto !== -1) imagen = atributo(t.slice(iFoto), 'src') || '';
  if (imagen.indexOf('http') !== 0) imagen = '';
  const imagenes = imagen ? JSON.stringify([imagen]) : '[]';

  const row = '(' +
    txt(id) + ", 'canalcar', " + txt(url) + ', ' + txt(titulo) + ', ' +
    txt(brand) + ', ' + txt(model) + ', ' + txt(version) + ', ' +
    num(anio) + ', ' + num(km) + ', ' + precio + ', ' +
    txt(fuel) + ', ' + txt(cambio) + ', ' +
    txt(provincia) + ', ' + txt(provincia ? provincia + ', ' + provincia : '') + ', ' +
    txt(imagen) + ', ' + txt(imagenes) + ', ' +
    "'profesional', 'compra', 'ES', " + num(cuota) +
    ', NOW(), NOW(), NOW()' +
  ')';
  rows.push(row);
}
if (!rows.length) return [{ json: { sql: null, count: 0 } }];

const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, fuel, ' +
  'transmission, province, location, image_url, images, seller_type, listing_type, country, ' +
  'monthly_price, first_seen_at, scraped_at, last_seen_at';

/*
 * Lo que el listado NO trae se queda como está: color, puertas, plazas,
 * carrocería, potencia y la etiqueta ambiental. De eso se encargan el
 * enriquecedor y el derivador universal, y machacarlo con vacío en cada pasada
 * sería borrar su trabajo dos veces al día.
 *
 * Marca y modelo tampoco se pisan: los de la ruta y los de la ficha no siempre
 * coinciden, y el que manda es el que ya está guardado.
 */
const onConflict = 'ON CONFLICT (id) DO UPDATE SET ' +
  'url = EXCLUDED.url, title = EXCLUDED.title, price = EXCLUDED.price, ' +
  'mileage = COALESCE(EXCLUDED.mileage, moveadvisor_market_offers.mileage), ' +
  'year = COALESCE(EXCLUDED.year, moveadvisor_market_offers.year), ' +
  "version = COALESCE(NULLIF(EXCLUDED.version, ''), moveadvisor_market_offers.version), " +
  "fuel = COALESCE(NULLIF(EXCLUDED.fuel, ''), moveadvisor_market_offers.fuel), " +
  "transmission = COALESCE(NULLIF(EXCLUDED.transmission, ''), moveadvisor_market_offers.transmission), " +
  "province = COALESCE(NULLIF(EXCLUDED.province, ''), moveadvisor_market_offers.province), " +
  "location = COALESCE(NULLIF(EXCLUDED.location, ''), moveadvisor_market_offers.location), " +
  "image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), moveadvisor_market_offers.image_url), " +
  "images = CASE WHEN EXCLUDED.images <> '[]' THEN EXCLUDED.images ELSE moveadvisor_market_offers.images END, " +
  // La cuota se pisa sin COALESCE: es dato vivo, y un NULL aquí también es la
  // verdad -«este coche ya no tiene oferta de financiación»-.
  'monthly_price = EXCLUDED.monthly_price, ' +
  'last_seen_at = NOW(), updated_at = NOW(), ' +
  // Verla en el listado ES la prueba de vida, así que resucita.
  'is_active = TRUE';

const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length } }];
