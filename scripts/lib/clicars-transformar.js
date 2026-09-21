// Clicars – transform: HTML del listado → tarjetas <article> → UPSERT market_offers
//
// El id es «clc_» + el data-vehicle-web-id de la tarjeta, que es como están las
// filas que ya hay. Cualquier otra forma de construirlo las duplicaría todas.
const httpOut = $input.item.json;
const html = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');

/*
 * Aplanar ANTES de partir.
 *
 * La etiqueta <article trae saltos de línea dentro, así que partir por
 * «<article data-vehicle-web-id=» sobre el html crudo encuentra CERO tarjetas.
 */
const plano = html.split(/\s+/).join(' ');
const tarjetas = plano.split('<article data-vehicle-web-id=').slice(1);
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
/** Los dígitos de un texto: «10.990€» -> 10990, «95.556km» -> 95556. */
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
/** Lo que hay entre dos marcas, que es como se saca el texto de un span. */
function entre(trozo, desde, hasta) {
  const i = trozo.indexOf(desde);
  if (i === -1) return null;
  const j = trozo.indexOf(hasta, i + desde.length);
  return j === -1 ? null : trozo.slice(i + desde.length, j).trim();
}
function normGear(s) {
  s = String(s || '').toLowerCase();
  if (s.indexOf('autom') !== -1) return 'Automatica';
  if (s.indexOf('manual') !== -1) return 'Manual';
  return '';
}

const rows = [];
for (const t of tarjetas) {
  // El id va al principio del trozo: data-vehicle-web-id="139250"
  const idWeb = digitos(t.slice(0, 14));
  if (!idWeb) continue;
  const id = 'clc_' + idWeb;

  /*
   * La url DEL COCHE, no la de la versión.
   *
   * Clicars sirve dos formas y solo una es de un coche concreto:
   *
   *     /coches-segunda-mano-ocasion/comprar-toyota-yaris-...-2015-139250
   *     /coches-segunda-mano-ocasion/toyota/yaris/yaris-1-0-city-...
   *
   * La segunda es la página de la VERSIÓN: en nuestra base hay 18 coches
   * distintos compartiendo una, y preguntarle por ella no dice nada de ninguno
   * en concreto. Aquí se guarda la primera, que acaba en el id.
   */
  const href = atributo(t, 'href');
  const url = (href && href.indexOf('/comprar-') !== -1)
    ? href.split('?')[0]
    : 'https://www.clicars.com/coches-segunda-mano-ocasion/comprar-coche-' + idWeb;

  const brand = atributo(t, 'data-analytics-vehicle-maker') || '';
  const modelo = atributo(t, 'data-analytics-vehicle-model') || '';
  const version = entre(t, '<span class="version ellipsis">', '</span>') || '';

  /*
   * La línea de datos: « 2015 | 95.556km | 69CV | Manual ».
   *
   * Se parte por la barra en vez de buscar cada cosa con un patrón: si un día
   * falta un trozo, los demás siguen leyéndose.
   */
  const info = entre(t, '<span class="info ellipsis">', '</span>') || '';
  const partes = info.split('|').map((x) => x.trim());
  let anio = null, km = null, cv = null, cambio = '';
  for (const p of partes) {
    const n = digitos(p);
    if (p.indexOf('km') !== -1) km = n;
    else if (p.indexOf('CV') !== -1) cv = n;
    else if (n !== null && n > 1900 && n < 2100) anio = n;
    else if (normGear(p)) cambio = normGear(p);
  }

  /*
   * LOS PRECIOS, Y CUÁL ES «EL PRECIO».
   *
   * La tarjeta da cuatro: data-price-web (contado), data-price-financing
   * (financiado), data-price-quota (cuota mensual) y data-amount-without-
   * discount (antes del descuento).
   *
   * Se guarda el de CONTADO, que es el que se ve en grande y el que paga quien
   * no se compromete a financiar. Guardar el financiado hunde el comparable
   * español, y con él el margen de cada coche alemán: eso es exactamente lo que
   * pasaba en Flexicar hasta hoy, entre 1.500 y 3.000 € por coche.
   */
  const contado = digitos(atributo(t, 'data-price-web'));
  const financiado = digitos(atributo(t, 'data-price-financing'));
  const cuota = digitos(atributo(t, 'data-price-quota'));
  const precio = contado !== null ? contado : financiado;
  if (!(precio > 0)) continue;
  // El financiado solo si de verdad es otro número: repetirlo haría pensar que
  // hay una oferta de financiación cuando no la hay.
  const finance = (contado !== null && financiado !== null && financiado < contado) ? financiado : null;

  const imagen = atributo(t, 'src') || '';
  const titulo = (brand + ' ' + modelo + ' ' + version).split(/\s+/).join(' ').trim();

  const row = '(' +
    txt(id) + ", 'clicars', " + txt(url) + ', ' + txt(titulo) + ', ' +
    txt(brand) + ', ' + txt(modelo) + ', ' + txt(version) + ', ' +
    num(anio) + ', ' + num(km) + ', ' + precio + ', ' +
    txt(cambio) + ', ' + num(cv) + ', ' +
    txt(imagen.indexOf('http') === 0 ? imagen : '') + ', ' +
    "'profesional', 'compra', 'ES', " + num(finance) + ', ' + num(cuota) +
    ', NOW(), NOW(), NOW()' +
  ')';
  rows.push(row);
}
if (!rows.length) return [{ json: { sql: null, count: 0 } }];

const cols = 'id, portal, url, title, brand, model, version, year, mileage, price, transmission, ' +
  'power_cv, image_url, seller_type, listing_type, country, finance_price, monthly_price, ' +
  'first_seen_at, scraped_at, last_seen_at';

/*
 * Lo que el listado NO trae se queda como está: combustible, color, puertas,
 * plazas, carrocería, cilindrada y etiqueta. De eso se encarga el enriquecedor,
 * y machacarlo con vacío en cada pasada sería borrar su trabajo cada noche.
 */
const onConflict = 'ON CONFLICT (id) DO UPDATE SET ' +
  // La url se pisa a propósito: 2.083 de las 2.788 filas tienen guardada la
  // página de la VERSIÓN en vez de la del coche, y esto las corrige.
  'url = EXCLUDED.url, title = EXCLUDED.title, price = EXCLUDED.price, ' +
  'mileage = COALESCE(EXCLUDED.mileage, moveadvisor_market_offers.mileage), ' +
  'year = COALESCE(EXCLUDED.year, moveadvisor_market_offers.year), ' +
  "transmission = COALESCE(NULLIF(EXCLUDED.transmission, ''), moveadvisor_market_offers.transmission), " +
  'power_cv = COALESCE(EXCLUDED.power_cv, moveadvisor_market_offers.power_cv), ' +
  "image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), moveadvisor_market_offers.image_url), " +
  // Los precios se pisan sin COALESCE: son datos vivos, y un NULL aquí también
  // es la verdad -«este coche no tiene oferta de financiación»-.
  'finance_price = EXCLUDED.finance_price, ' +
  'monthly_price = EXCLUDED.monthly_price, ' +
  'last_seen_at = NOW(), updated_at = NOW(), ' +
  // Verla en el listado ES la prueba de vida, así que resucita.
  'is_active = TRUE';

const sql = 'INSERT INTO moveadvisor_market_offers (' + cols + ') VALUES ' + rows.join(', ') + ' ' + onConflict;
return [{ json: { sql: sql, count: rows.length } }];
