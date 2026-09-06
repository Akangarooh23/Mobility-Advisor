/**
 * Repara el catálogo de Modrive contra su sitemap.
 *
 *   node scripts/repara-modrive.js              (en seco, no escribe)
 *   ESCRIBIR=1 node scripts/repara-modrive.js   (de verdad)
 *
 * ── Que paso ───────────────────────────────────────────────────────────────
 *
 * Modrive cambio la ruta de sus fichas y nadie se entero:
 *
 *   guardado : /coches-segunda-mano/hyundai-i20-...-2304743/
 *   ahora    : /coches-ocasion/kia-e-niro-...-593538/
 *
 * Las 2.626 URLs que teniamos redirigen al listado generico. O sea que durante
 * semanas, cada cliente que pinchaba un Modrive del escaparate acababa en una
 * pagina de resultados en vez de en el coche. Y su scraper llevaba parado desde
 * el 17 de agosto, asi que nada lo iba a arreglar solo.
 *
 * ── Por que se puede arreglar de una vez ───────────────────────────────────
 *
 * Porque Modrive publica sitemap-vehicles.xml, y ahi esta el catalogo entero:
 * 1.966 coches con su URL buena. El numero del final de la URL es el mismo de
 * siempre, asi que casa con lo que tenemos guardado.
 *
 * De ahi salen las tres cosas que hay que hacer, todas con UNA peticion:
 *
 *   - las que siguen en el sitemap  -> se les corrige la URL
 *   - las que ya no estan           -> se dan de baja
 *   - las que estan y no tenemos    -> las recogera el scraper
 *
 * ── Lo que NO se toca ──────────────────────────────────────────────────────
 *
 * updated_at, en las que solo cambian de URL. Corregir una ruta es un arreglo
 * nuestro, no un cambio del anuncio, y el escaparate ordena por esa fecha:
 * moverla en 1.788 filas pondria Modrive entero por delante de Gamboa y de VIAN
 * sin que ningun coche haya cambiado. Es el mismo error que arreglamos hoy en
 * el scraper de Gamboa.
 *
 * En las bajas si se mueve: ahi el estado cambia de verdad.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const ESCRIBIR = process.env.ESCRIBIR === "1";

const SITEMAP = "https://www.modrive.com/sitemap-vehicles.xml";
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/xml,text/xml,*/*",
};

/** El numero del final de la URL, que es el id del coche en Modrive. */
const idDe = (u) => (String(u).match(/-(\d{4,})\/?$/) || [])[1] || "";

(async () => {
  const r = await fetch(SITEMAP, { headers: H, signal: AbortSignal.timeout(30000) });
  if (r.status !== 200) throw new Error("el sitemap devolvio HTTP " + r.status);
  const xml = await r.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const vivos = new Map();
  for (const u of urls) { const i = idDe(u); if (i) vivos.set(i, u); }
  if (vivos.size < 100) throw new Error("el sitemap solo trae " + vivos.size + " coches: no me fio, no toco nada");
  console.log(`${ESCRIBIR ? "" : "[EN SECO] "}sitemap de Modrive: ${vivos.size} coches`);

  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const filas = (await c.query(`SELECT id, source_url, is_active
    FROM moveadvisor_marketplace_vo_offers WHERE portal='modrive'`)).rows;

  const arreglar = [];   // siguen vivas pero con la URL vieja
  const bajas = [];      // ya no estan en el sitemap
  const resucitar = [];  // constaban de baja y han vuelto
  for (const f of filas) {
    const i = idDe(f.source_url);
    if (!i) continue;
    const buena = vivos.get(i);
    if (buena) {
      if (buena !== f.source_url) arreglar.push([f.id, buena]);
      if (f.is_active === false) resucitar.push(f.id);
    } else if (f.is_active !== false) {
      bajas.push(f.id);
    }
  }
  const nuestros = new Set(filas.map((f) => idDe(f.source_url)).filter(Boolean));
  const nuevas = [...vivos.keys()].filter((i) => !nuestros.has(i)).length;

  console.log(`  de nuestras ${filas.length}:`);
  console.log(`    urls que hay que corregir : ${arreglar.length}`);
  console.log(`    bajas                     : ${bajas.length}`);
  console.log(`    reaparecidas              : ${resucitar.length}`);
  console.log(`  en el sitemap y no tenemos  : ${nuevas}   (las trae el scraper)`);

  // Una salvaguarda como la del verificador de Gamboa: si de golpe casi todo
  // sale de baja, es que el sitemap ha cambiado de forma, no que Modrive haya
  // vendido el concesionario entero.
  const mortandad = filas.length ? bajas.length / filas.length : 0;
  if (mortandad > 0.85) {
    console.log(`\n  ABORTADO: saldrian de baja el ${Math.round(mortandad * 100)}%.`);
    console.log("  Eso no es una liquidacion, es que el sitemap ya no dice lo que creemos.");
    await c.end();
    process.exit(1);
  }

  if (!ESCRIBIR) {
    console.log("\n[EN SECO] no se ha tocado la base.");
    console.log("Para hacerlo de verdad: ESCRIBIR=1 node scripts/repara-modrive.js");
    await c.end();
    return;
  }

  const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";

  // Las URLs, de mil en mil. updated_at NO se toca: corregir una ruta no es un
  // cambio del anuncio.
  let corregidas = 0;
  for (let i = 0; i < arreglar.length; i += 1000) {
    const lote = arreglar.slice(i, i + 1000);
    const tabla = lote.map(([id, u]) => "(" + esc(id) + ", " + esc(u) + ")").join(", ");
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers t
      SET source_url = m.url FROM (VALUES ${tabla}) AS m(id, url) WHERE t.id = m.id`);
    corregidas += q.rowCount;
  }
  console.log(`\n  urls corregidas : ${corregidas}`);

  if (bajas.length) {
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
      SET is_active = FALSE, last_checked_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1)`, [bajas]);
    console.log(`  dadas de baja   : ${q.rowCount}`);
  }
  if (resucitar.length) {
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
      SET is_active = TRUE, last_checked_at = NOW(), last_seen_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1)`, [resucitar]);
    console.log(`  resucitadas     : ${q.rowCount}`);
  }
  // Las que siguen vivas quedan vistas hoy, que es la verdad: el sitemap las lista.
  const vistas = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
    SET last_seen_at = NOW(), last_checked_at = NOW()
    WHERE portal='modrive' AND is_active`);
  console.log(`  marcadas como vistas hoy : ${vistas.rowCount}`);

  const fin = (await c.query(`SELECT count(*) FILTER (WHERE is_active) act,
    count(*) FILTER (WHERE is_active IS FALSE) inact
    FROM moveadvisor_marketplace_vo_offers WHERE portal='modrive'`)).rows[0];
  console.log(`\n  Modrive queda en ${fin.act} activas y ${fin.inact} de baja (el sitemap lista ${vivos.size}).`);
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
