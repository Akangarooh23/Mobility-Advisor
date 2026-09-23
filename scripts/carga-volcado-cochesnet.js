/**
 * Carga el volcado de coches.net en moveadvisor_market_offers.
 *
 *   npm run carga-volcado-cochesnet -- <fichero.jsonl.gz>            (solo mira)
 *   npm run carga-volcado-cochesnet -- <fichero.jsonl.gz> --aplica
 *
 * QUÉ ES ESTO
 *
 * Un volcado que nos pasaron: 285.119 coches de coches.net del 21-sep-2026, con
 * 92 campos cada uno. Frente a las 150 filas que teníamos de ese portal.
 *
 * POR QUÉ NO LO RASPAMOS NOSOTROS
 *
 * Porque no se puede. Medido el 23-sep: los anuncios vienen dentro del HTML
 * -no hay API-, pero solo te sirven ese HTML si pasas un desafío antibot de
 * Radware. Un navegador lo pasa; un fetch no (HTTP 494 incluso con las galletas
 * del navegador). Y el navegador aguanta unas decenas de páginas antes de que
 * te bloqueen la IP, que es lo que nos pasó. Para los 267.000 coches harían
 * falta más de 9.000 páginas.
 *
 * LA FECHA QUE SE GUARDA ES LA DEL VOLCADO, NO «AHORA»
 *
 * Esto es lo más importante del fichero. last_seen_at se pone al ref_day del
 * volcado -el 21 de septiembre-, no a NOW(). Dos razones:
 *
 *   1. Es la verdad: ese día estaban a la venta; hoy no lo sabemos.
 *   2. Así ENVEJECEN SOLOS. No podemos verificar 285.119 coches -ni por ficha
 *      ni por listado, nos bloquean-, así que en vez de darlos de baja se deja
 *      que caduquen: el comparable filtra por «visto hace poco» y estos van
 *      saliendo del cálculo según pasan los días.
 *
 * Poner NOW() los haría pasar por frescos para siempre, que es exactamente el
 * problema que tenía Autohero esta mañana: 2.340 vendidos contando como vivos.
 *
 * LO QUE SE COMPROBÓ ANTES DE MAPEAR NADA
 *
 * En Autohero di por buena una traducción heredada y 839 coches acabaron con
 * el combustible equivocado. Aquí se miraron los valores reales de los 285.119:
 *
 *   - `power` son CV, no kW: el VW up! «60kW82CV» trae power 82.
 *   - `warranty` son meses: 12 (134.578), 24, 36, 60, 6...
 *   - `transmission` NO es el cambio: es la TRACCIÓN (Delantera FWD, Trasera
 *     RWD, Integral). El cambio está en `gearing`. Mapearlo por el nombre
 *     habría metido «Delantera» en el cambio de 145.000 coches.
 *   - `price_public_euro` y `price_cash_public_euro` son idénticos en los
 *     285.119, así que aquí no hay la trampa del precio financiado.
 *   - Hay basura: body_type «8» en 12.448 coches y fuel «8» en cuatro. No se
 *     copia lo que no se reconoce.
 */
"use strict";
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const FICHERO = process.argv.find((a) => a.indexOf(".jsonl.gz") !== -1);
const APLICA = process.argv.includes("--aplica");
/*
 * --ensayo: escribe de verdad los primeros lotes y lo deshace.
 *
 * El modo «solo mirar» no ejecuta ni un INSERT, así que no prueba el SQL: un
 * valor demasiado largo o un tipo mal puesto no aparecerían hasta la carga de
 * verdad, con 282.000 filas por delante. Esto lo lanza contra la base dentro
 * de BEGIN/ROLLBACK.
 */
const ENSAYO = process.argv.includes("--ensayo");
const LOTES_ENSAYO = 6;
const PORTAL = "cochesnet";
const POR_LOTE = 500;

// ── Diccionarios, todos comprobados contra los 285.119 ──────────────────────
const FUEL = {
  "Diésel": "Diesel", "Gasolina": "Gasolina", "Híbrido": "Híbrido",
  "Híbrido enchufable": "Híbrido enchufable", "Eléctrico": "Eléctrico",
  "Gas licuado (GLP)": "Gas", "Gas natural (CNG)": "Gas",
};
const CAMBIO = { "Manual": "Manual", "Automático": "Automatica" };
const TRACCION = {
  "Delantera (FWD)": "Delantera", "Trasera (RWD)": "Trasera",
  "Integral (AWD, 4WD, 4x4)": "4x4",
};
const ETIQUETA = { "C": "C", "ECO": "ECO", "B": "B", "0": "0 Emisiones" };
// Las carrocerías que usan. «8» y cualquier otra cosa se dejan vacías.
const CARROCERIA = {
  "Berlina": "Berlina", "4x4 SUV": "SUV", "Monovolumen": "Monovolumen",
  "Familiar": "Familiar", "Coupe": "Coupé", "Cabrio": "Cabrio", "Pick Up": "Pick Up",
  "Furgoneta": "Furgoneta", "Descapotable": "Cabrio",
};

// Los dos primeros dígitos del código postal son la provincia, sin ambigüedad.
const CP = ["", "Álava", "Albacete", "Alicante", "Almería", "Ávila", "Badajoz", "Baleares",
  "Barcelona", "Burgos", "Cáceres", "Cádiz", "Castellón", "Ciudad Real", "Córdoba", "A Coruña",
  "Cuenca", "Girona", "Granada", "Guadalajara", "Guipúzcoa", "Huelva", "Huesca", "Jaén", "León",
  "Lleida", "La Rioja", "Lugo", "Madrid", "Málaga", "Murcia", "Navarra", "Ourense", "Asturias",
  "Palencia", "Las Palmas", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife", "Cantabria",
  "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia", "Valladolid",
  "Vizcaya", "Zamora", "Zaragoza", "Ceuta", "Melilla"];
function provinciaDe(cp) {
  const s = String(cp || "").trim();
  if (s.length < 2) return "";
  const n = Number(s.slice(0, 2));
  return (n >= 1 && n <= 52) ? CP[n] : "";
}

// El largo de cada columna, del esquema. Un valor raro no puede tirar el lote
// entero: el INSERT va entero o no va. Lo aprendimos con una «ciudad» de 136
// caracteres en Autohero que se llevó por delante 100 ofertas.
const LARGO = {
  country: 2, id: 40, listing_type: 40, co2: 50, displacement: 50,
  environmental_label: 50, next_itv: 50, fuel: 60, portal: 60, transmission: 60,
  body_type: 80, color: 80, seller_type: 80, brand: 100, traction: 100,
  city: 120, model: 120, province: 120, location: 160, version: 180,
  dealer_name: 200, title: 500, url: 1024, image_url: 2000,
};
function txt(v, col) {
  let s = String(v === null || v === undefined ? "" : v);
  const max = LARGO[col];
  if (max && s.length > max) s = s.slice(0, max);
  return "'" + s.replace(/'/g, "''") + "'";
}
function num(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  const n = Number(v);
  return isNaN(n) ? "NULL" : String(n);
}
function entero(v, min, max) {
  const n = Math.round(Number(v));
  if (!isFinite(n) || n < min || n > max) return null;
  return n;
}

const COLS = "id, portal, url, title, brand, model, version, year, mileage, price, fuel, " +
  "transmission, power_cv, displacement, co2, consumption, traction, environmental_label, " +
  "color, body_type, doors, seats, province, city, location, dealer_name, image_url, images, " +
  "seller_type, listing_type, country, finance_price, monthly_price, warranty_months, " +
  "first_seen_at, scraped_at, last_seen_at, is_active";

/*
 * Lo que ya tengamos NO se pisa con lo del volcado, salvo el precio.
 *
 * Solo 34 de los 285.119 estaban ya en nuestra base, así que esto casi no
 * actúa; pero si un día se carga un volcado más nuevo encima, la regla tiene
 * que estar puesta: lo que llena el enriquecedor se queda.
 */
const ON_CONFLICT = "ON CONFLICT (id) DO UPDATE SET " +
  "url = EXCLUDED.url, title = EXCLUDED.title, price = EXCLUDED.price, " +
  "mileage = COALESCE(EXCLUDED.mileage, moveadvisor_market_offers.mileage), " +
  "year = COALESCE(EXCLUDED.year, moveadvisor_market_offers.year), " +
  "version = COALESCE(NULLIF(EXCLUDED.version, ''), moveadvisor_market_offers.version), " +
  "fuel = COALESCE(NULLIF(EXCLUDED.fuel, ''), moveadvisor_market_offers.fuel), " +
  "transmission = COALESCE(NULLIF(EXCLUDED.transmission, ''), moveadvisor_market_offers.transmission), " +
  "power_cv = COALESCE(EXCLUDED.power_cv, moveadvisor_market_offers.power_cv), " +
  "displacement = COALESCE(NULLIF(EXCLUDED.displacement, ''), moveadvisor_market_offers.displacement), " +
  "co2 = COALESCE(NULLIF(EXCLUDED.co2, ''), moveadvisor_market_offers.co2), " +
  "consumption = COALESCE(EXCLUDED.consumption, moveadvisor_market_offers.consumption), " +
  "traction = COALESCE(NULLIF(EXCLUDED.traction, ''), moveadvisor_market_offers.traction), " +
  "environmental_label = COALESCE(NULLIF(EXCLUDED.environmental_label, ''), moveadvisor_market_offers.environmental_label), " +
  "color = COALESCE(NULLIF(moveadvisor_market_offers.color, ''), NULLIF(EXCLUDED.color, '')), " +
  "body_type = COALESCE(NULLIF(EXCLUDED.body_type, ''), moveadvisor_market_offers.body_type), " +
  "doors = COALESCE(EXCLUDED.doors, moveadvisor_market_offers.doors), " +
  "seats = COALESCE(EXCLUDED.seats, moveadvisor_market_offers.seats), " +
  "province = COALESCE(NULLIF(EXCLUDED.province, ''), moveadvisor_market_offers.province), " +
  "city = COALESCE(NULLIF(EXCLUDED.city, ''), moveadvisor_market_offers.city), " +
  "location = COALESCE(NULLIF(EXCLUDED.location, ''), moveadvisor_market_offers.location), " +
  "image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), moveadvisor_market_offers.image_url), " +
  "images = CASE WHEN EXCLUDED.images <> '[]' THEN EXCLUDED.images ELSE moveadvisor_market_offers.images END, " +
  "finance_price = EXCLUDED.finance_price, monthly_price = EXCLUDED.monthly_price, " +
  "warranty_months = COALESCE(EXCLUDED.warranty_months, moveadvisor_market_offers.warranty_months), " +
  // La fecha SOLO avanza. Un volcado viejo no puede rejuvenecer una fila que
  // un scraper vio ayer.
  "last_seen_at = GREATEST(moveadvisor_market_offers.last_seen_at, EXCLUDED.last_seen_at), " +
  "updated_at = NOW(), is_active = TRUE";

/** Una línea del volcado -> una fila del INSERT, o null si no sirve. */
function fila(o, refDay) {
  const id = String(o.article_id || "").trim();
  if (!id) return null;
  const precio = entero(o.price_cash_public_euro || o.price_public_euro, 100, 5000000);
  if (precio === null) return null;

  const marca = String(o.make || "").trim();
  const modelo = String(o.model || "").trim();
  if (!marca) return null;
  const version = String(o.version || "").trim();
  const titulo = [marca, modelo, version].filter(Boolean).join(" ").split(/\s+/).join(" ");

  const anio = entero(String(o.first_registration || o.construction_date || "").slice(0, 4), 1900, 2100);
  const km = entero(o.mileage, 0, 2000000);
  const cv = entero(o.power, 10, 2000);
  const cc = entero(o.displacement, 400, 10000);
  const co2 = entero(o.co2_emission, 1, 900);
  const consumo = Number(o.consumption_mixed) > 0 ? Number(o.consumption_mixed) : null;
  const puertas = entero(o.doors, 2, 7);
  const plazas = entero(o.seats, 1, 9);
  const garantia = entero(o.warranty, 1, 120);

  const provincia = provinciaDe(o.zip_code);
  const ciudad = String(o.city || "").trim();
  const financiado = entero(o.price_financed_public_euro, 100, 5000000);
  const cuota = entero(o.financing_monthly_installment_euro, 10, 9000);

  let imagenes = [];
  if (Array.isArray(o.img_list)) imagenes = o.img_list.filter((x) => String(x).indexOf("http") === 0);
  const imagen = imagenes[0] || "";

  return "(" +
    txt("cn_" + id, "id") + ", '" + PORTAL + "', " + txt(o.url, "url") + ", " + txt(titulo, "title") + ", " +
    txt(marca, "brand") + ", " + txt(modelo, "model") + ", " + txt(version, "version") + ", " +
    num(anio) + ", " + num(km) + ", " + precio + ", " +
    txt(FUEL[o.fuel] || "", "fuel") + ", " + txt(CAMBIO[o.gearing] || "", "transmission") + ", " +
    num(cv) + ", " + txt(cc === null ? "" : cc, "displacement") + ", " +
    txt(co2 === null ? "" : co2, "co2") + ", " + num(consumo) + ", " +
    txt(TRACCION[o.transmission] || "", "traction") + ", " +
    txt(ETIQUETA[o.environmental_sticker] || "", "environmental_label") + ", " +
    txt(String(o.body_color || "").trim(), "color") + ", " +
    txt(CARROCERIA[o.body_type] || "", "body_type") + ", " +
    num(puertas) + ", " + num(plazas) + ", " +
    txt(provincia, "province") + ", " + txt(ciudad, "city") + ", " +
    txt([ciudad, provincia].filter(Boolean).join(", "), "location") + ", " +
    txt("", "dealer_name") + ", " +
    txt(imagen, "image_url") + ", " + txt(JSON.stringify(imagenes)) + ", " +
    txt(o.dealer_type === "private" ? "particular" : "profesional", "seller_type") + ", " +
    "'compra', 'ES', " + num(financiado) + ", " + num(cuota) + ", " + num(garantia) + ", " +
    "'" + refDay + "', '" + refDay + "', '" + refDay + "', TRUE" +
  ")";
}

(async () => {
  if (!FICHERO || !fs.existsSync(FICHERO)) {
    console.log("\n  Falta el fichero. Uso:");
    console.log("      npm run carga-volcado-cochesnet -- ruta/al/volcado.jsonl.gz [--aplica]\n");
    process.exit(1);
  }
  const c = new Client({ connectionString: DB_URL, statement_timeout: 600000 });
  await c.connect();

  const antes = (await c.query(`SELECT count(*)::int n, count(*) FILTER (WHERE is_active)::int vivas
    FROM moveadvisor_market_offers WHERE portal = $1`, [PORTAL])).rows[0];
  console.log("\n  ANTES: " + antes.n + " filas de " + PORTAL + " (" + antes.vivas + " activas)");
  console.log("  " + (APLICA ? "APLICANDO" : "SOLO MIRANDO") + "   " + path.basename(FICHERO) + "\n");

  let n = 0, saltadas = 0, escritas = 0;
  let refDay = null;
  let lote = [];
  const vistosEnVolcado = new Set();

  if (ENSAYO) await c.query("BEGIN");
  const gz = fs.createReadStream(FICHERO).pipe(zlib.createGunzip());
  let resto = "";

  let lotesHechos = 0;
  let falloEnsayo = false;
  const vaciar = async () => {
    if (!lote.length) return;
    const sql = "INSERT INTO moveadvisor_market_offers (" + COLS + ") VALUES "
      + lote.join(", ") + " " + ON_CONFLICT;
    const cuantas = lote.length;
    lote = [];
    if (!APLICA && !ENSAYO) return;
    try {
      escritas += (await c.query(sql)).rowCount;
      lotesHechos++;
    } catch (e) {
      falloEnsayo = true;
      console.log("      LOTE " + (lotesHechos + 1) + " FALLÓ (" + cuantas + " filas): " + e.message.slice(0, 140));
      if (e.detail) console.log("          " + String(e.detail).slice(0, 160));
      if (ENSAYO) throw e;
    }
  };

  for await (const chunk of gz) {
    resto += chunk.toString("utf8");
    const partes = resto.split("\n");
    resto = partes.pop();
    for (const linea of partes) {
      if (!linea.trim()) continue;
      let o;
      try { o = JSON.parse(linea); } catch (e) { saltadas++; continue; }
      if (!refDay) refDay = String(o.ref_day || "").slice(0, 10) || "2026-09-21";
      n++;
      vistosEnVolcado.add("cn_" + String(o.article_id));
      const f = fila(o, refDay);
      if (!f) { saltadas++; continue; }
      lote.push(f);
      if (lote.length >= POR_LOTE) {
        await vaciar();
        if (ENSAYO && lotesHechos >= LOTES_ENSAYO) break;
        if (n % 25000 === 0) console.log("      " + n.toLocaleString("es") + " leídos, " + escritas.toLocaleString("es") + " escritos");
      }
    }
    if (ENSAYO && lotesHechos >= LOTES_ENSAYO) break;
  }
  if (!ENSAYO) await vaciar();

  if (ENSAYO) {
    console.log("\n  ENSAYO CONTRA LA BASE (y deshecho)");
    console.log("      lotes escritos : " + lotesHechos + " de " + POR_LOTE + " filas");
    console.log("      filas tocadas  : " + escritas.toLocaleString("es"));
    console.log("      fallos         : " + (falloEnsayo ? "SÍ" : "ninguno"));
    // Comprobar lo escrito ANTES de deshacerlo
    const v = (await c.query(`SELECT count(*)::int n,
        count(*) FILTER (WHERE COALESCE(fuel,'') <> '')::int fuel,
        count(*) FILTER (WHERE COALESCE(province,'') <> '')::int prov,
        count(power_cv)::int cv, count(warranty_months)::int gar,
        max(length(city))::int ciudad_larga, min(last_seen_at)::date fecha
      FROM moveadvisor_market_offers WHERE portal = $1 AND last_seen_at < NOW() - INTERVAL '12 hours'`,
      [PORTAL])).rows[0];
    console.log("      con combustible " + v.fuel + "   provincia " + v.prov
      + "   potencia " + v.cv + "   garantía " + v.gar);
    console.log("      ciudad más larga: " + v.ciudad_larga + " caracteres   fecha guardada: " + String(v.fecha).slice(0, 10));
    await c.query("ROLLBACK");
    console.log("\n  Deshecho. Para cargarlo de verdad:");
    console.log("      npm run carga-volcado-cochesnet -- " + path.basename(FICHERO) + " --aplica\n");
    await c.end();
    return;
  }

  console.log("\n  EL VOLCADO");
  console.log("      fecha de referencia : " + refDay);
  console.log("      coches leídos       : " + n.toLocaleString("es"));
  console.log("      saltados            : " + saltadas.toLocaleString("es") + "   (sin precio, sin marca o ilegibles)");
  console.log("      escritos            : " + (APLICA ? escritas.toLocaleString("es") : "(nada: falta --aplica)"));

  /*
   * LO QUE NO ESTÁ EN EL VOLCADO, SE DA DE BAJA.
   *
   * El volcado es el catálogo entero de ese día, así que una fila nuestra de
   * coches.net que no aparezca en él ya no se vendía. Son las 116 que quedaban
   * de julio.
   */
  const fuera = (await c.query(`SELECT count(*)::int n FROM moveadvisor_market_offers
    WHERE portal = $1 AND is_active AND id <> ALL($2)`, [PORTAL, [...vistosEnVolcado].slice(0, 0)])).rows[0];
  const viejas = (await c.query(`SELECT id FROM moveadvisor_market_offers
    WHERE portal = $1 AND is_active`, [PORTAL])).rows
    .map((x) => x.id).filter((id) => !vistosEnVolcado.has(id));
  console.log("\n      nuestras que NO están en el volcado: " + viejas.length + "   (se dan de baja)");
  if (APLICA && viejas.length) {
    for (let i = 0; i < viejas.length; i += 1000) {
      await c.query(`UPDATE moveadvisor_market_offers SET is_active = FALSE, last_checked_at = NOW()
        WHERE id = ANY($1)`, [viejas.slice(i, i + 1000)]);
    }
  }

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run carga-volcado-cochesnet -- " + path.basename(FICHERO) + " --aplica\n");
    await c.end();
    return;
  }

  const desp = (await c.query(`SELECT count(*)::int n, count(*) FILTER (WHERE is_active)::int vivas,
      count(*) FILTER (WHERE COALESCE(fuel,'') <> '')::int fuel,
      count(*) FILTER (WHERE COALESCE(body_type,'') <> '')::int carroceria,
      count(*) FILTER (WHERE COALESCE(province,'') <> '')::int provincia,
      count(power_cv)::int potencia, count(warranty_months)::int garantia,
      min(last_seen_at)::date desde, max(last_seen_at)::date hasta
    FROM moveadvisor_market_offers WHERE portal = $1`, [PORTAL])).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      filas " + desp.n.toLocaleString("es") + "   activas " + desp.vivas.toLocaleString("es"));
  console.log("      con combustible " + desp.fuel.toLocaleString("es")
    + "   carrocería " + desp.carroceria.toLocaleString("es")
    + "   provincia " + desp.provincia.toLocaleString("es"));
  console.log("      con potencia " + desp.potencia.toLocaleString("es")
    + "   garantía " + desp.garantia.toLocaleString("es"));
  console.log("      last_seen_at va del " + String(desp.desde).slice(0, 10) + " al " + String(desp.hasta).slice(0, 10)
    + "   <- la fecha del volcado, no hoy");
  console.log("");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
