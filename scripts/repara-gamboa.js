/**
 * Repara las URLs de Gamboa contra su listado.
 *
 *   node scripts/repara-gamboa.js              (en seco, no escribe)
 *   ESCRIBIR=1 node scripts/repara-gamboa.js   (de verdad)
 *
 * ── Qué pasó ───────────────────────────────────────────────────────────────
 *
 * Gamboa cambió la estructura de sus fichas el 2026-09-08:
 *
 *   guardado : /nissan-juke-ocasion-madrid/nissan-juke-dig-t-36863
 *   ahora    : /coches-ocasion-madrid/nissan/juke/nissan-juke-dig-t-36863
 *
 * Todas las URLs que teníamos redirigen. Es lo mismo que le pasó a Modrive el
 * día anterior, y por eso este script es hermano de repara-modrive.js.
 *
 * ── Lo que evitó el desastre ───────────────────────────────────────────────
 *
 * El verificador tiene una regla: un 301 cuyo destino CONSERVA el número del
 * coche no es una venta, es la web cambiando su slug. Sin ella habría dado de
 * baja las 638 ofertas de Gamboa en una noche, porque todas redirigen.
 *
 * Con ella, las bajas reales de esas 30 horas fueron dos, y las dos estaban
 * muertas de verdad. Pero mientras las URLs sigan desfasadas el verificador no
 * verifica nada: clasifica todo como «redirect propio» y pasa de largo. De ahí
 * los partes con vivas=0.
 *
 * ── Lo que NO se toca ──────────────────────────────────────────────────────
 *
 * updated_at. Corregir una ruta es un arreglo nuestro, no un cambio del
 * anuncio, y el escaparate ordena por esa fecha: moverla en 638 filas pondría
 * Gamboa entero por delante de VIAN y de Modrive sin que ningún coche haya
 * cambiado.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const ESCRIBIR = process.env.ESCRIBIR === "1";

const BASE = "https://www.gamboaocasion.com";
const LISTADO = BASE + "/coches-ocasion-madrid";
const MAX_PAGINAS = 60;
const ESPERA_MS = 1200;
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

/** El número final de la URL, que es el id del coche en Gamboa. */
const idDe = (u) => (String(u).match(/-(\d{4,})\/?$/) || [])[1] || "";

(async () => {
  const vivos = new Map();
  let repes = 0, leidas = 0;
  for (let p = 1; p <= MAX_PAGINAS; p++) {
    const url = LISTADO + (p > 1 ? "?pagina=" + p : "");
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) });
    if (r.status !== 200) throw new Error("la pagina " + p + " devolvio HTTP " + r.status);
    const t = await r.text();
    leidas++;
    const antes = vivos.size;
    // Las fichas del listado, con su ruta completa tal como la publica hoy.
    for (const m of t.matchAll(/href="(\/coches-ocasion-madrid\/[^"]*?-(\d{4,}))"/g)) {
      vivos.set(m[2], BASE + m[1]);
    }
    // Se para cuando una pagina no aporta ningun coche nuevo: fuera de rango
    // estos listados repiten la ultima en vez de venir vacios.
    if (vivos.size === antes) { if (++repes >= 2) break; } else repes = 0;
    if (p < MAX_PAGINAS) await new Promise((s) => setTimeout(s, ESPERA_MS));
  }
  console.log(`${ESCRIBIR ? "" : "[EN SECO] "}listado de Gamboa: ${leidas} páginas, ${vivos.size} coches`);
  if (vivos.size < 100) throw new Error("el listado solo trae " + vivos.size + " coches: no me fío, no toco nada");

  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const filas = (await c.query(`SELECT id, source_url, is_active
    FROM moveadvisor_marketplace_vo_offers WHERE portal='gamboa'`)).rows;

  const arreglar = [], bajas = [], resucitar = [], nuestros = new Set();
  for (const f of filas) {
    const i = idDe(f.source_url);
    if (!i) continue;
    nuestros.add(i);
    const buena = vivos.get(i);
    if (buena) {
      if (buena !== f.source_url) arreglar.push([f.id, buena]);
      if (f.is_active === false) resucitar.push(f.id);
    } else if (f.is_active !== false) bajas.push(f.id);
  }
  const nuevas = [...vivos.keys()].filter((i) => !nuestros.has(i)).length;

  console.log(`  de nuestras ${filas.length}:`);
  console.log(`    urls que hay que corregir : ${arreglar.length}`);
  console.log(`    bajas                     : ${bajas.length}`);
  console.log(`    reaparecidas              : ${resucitar.length}`);
  console.log(`  en el listado y no tenemos  : ${nuevas}   (las trae el scraper)`);

  const mortandad = filas.length ? bajas.length / filas.length : 0;
  if (mortandad > 0.85) {
    console.log(`\n  ABORTADO: saldrían de baja el ${Math.round(mortandad * 100)}%.`);
    await c.end();
    process.exit(1);
  }
  if (!ESCRIBIR) {
    console.log("\n[EN SECO] no se ha tocado la base.");
    console.log("Para hacerlo de verdad: ESCRIBIR=1 node scripts/repara-gamboa.js");
    await c.end();
    return;
  }

  const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";
  let corregidas = 0;
  for (let i = 0; i < arreglar.length; i += 500) {
    const lote = arreglar.slice(i, i + 500);
    const tabla = lote.map(([id, u]) => "(" + esc(id) + ", " + esc(u) + ")").join(", ");
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers t
      SET source_url = m.url FROM (VALUES ${tabla}) AS m(id, url) WHERE t.id = m.id`);
    corregidas += q.rowCount;
  }
  console.log(`\n  urls corregidas : ${corregidas}`);
  if (bajas.length) {
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
      SET is_active = FALSE, last_checked_at = NOW(), updated_at = NOW() WHERE id = ANY($1)`, [bajas]);
    console.log(`  dadas de baja   : ${q.rowCount}`);
  }
  if (resucitar.length) {
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
      SET is_active = TRUE, last_checked_at = NOW(), last_seen_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1)`, [resucitar]);
    console.log(`  resucitadas     : ${q.rowCount}`);
  }
  const vistas = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
    SET last_seen_at = NOW(), last_checked_at = NOW() WHERE portal='gamboa' AND is_active`);
  console.log(`  marcadas como vistas hoy : ${vistas.rowCount}`);

  const fin = (await c.query(`SELECT count(*) FILTER (WHERE is_active) act,
    count(*) FILTER (WHERE is_active IS FALSE) inact
    FROM moveadvisor_marketplace_vo_offers WHERE portal='gamboa'`)).rows[0];
  console.log(`\n  Gamboa queda en ${fin.act} activas y ${fin.inact} de baja (el listado publica ${vivos.size}).`);
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
