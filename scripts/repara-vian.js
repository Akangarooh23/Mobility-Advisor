/**
 * Repara el catálogo de VIAN contra su listado.
 *
 *   node scripts/repara-vian.js              (en seco, no escribe)
 *   ESCRIBIR=1 node scripts/repara-vian.js   (de verdad)
 *
 * ── Por qué el listado y no la ficha ───────────────────────────────────────
 *
 * En Gamboa un coche vendido se reconoce por su ficha: redirige al listado de
 * la categoría con un 301. En VIAN no sirve, y eso hay que medirlo antes de
 * diseñar nada: **la ficha de un coche vendido sigue devolviendo HTTP 200**.
 * Comprobado el 2026-09-07 sobre una que constaba de baja.
 *
 * O sea que preguntar oferta por oferta no distingue nada aquí. Lo que sí es
 * concluyente es el listado: 52 páginas de 12 coches, barridas en un minuto,
 * dan el catálogo completo. Lo que no está ahí, está vendido.
 *
 * Es la misma forma que Modrive con su sitemap, y la contraria a Gamboa.
 * Conviene no dar por hecho ninguna: cada concesionario dice las cosas a su
 * manera y equivocarse aquí significa vaciar el escaparate o dejarlo lleno de
 * coches que no existen.
 *
 * ── Lo que NO se toca ──────────────────────────────────────────────────────
 *
 * updated_at de las que siguen vivas. Volver a verlas en el listado no es un
 * cambio del anuncio, y el escaparate ordena por esa fecha: moverla en 609
 * filas pondría VIAN entero por delante de Gamboa y de Modrive sin que ningún
 * coche haya cambiado. En las bajas sí se mueve, que ahí el estado cambia.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const ESCRIBIR = process.env.ESCRIBIR === "1";

const BASE = "https://www.comprayconduce.es/coches-ocasion/";
const MAX_PAGINAS = 80;   // tope de seguridad; se para solo al quedarse sin coches
const ESPERA_MS = 1200;
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

/** El número final de la URL de la ficha, que es el id del coche en VIAN. */
const idDe = (u) => (String(u).match(/\/(\d{6,})\/?$/) || [])[1] || "";

(async () => {
  const vivos = new Set();
  let vacias = 0, leidas = 0;
  for (let p = 1; p <= MAX_PAGINAS; p++) {
    const url = BASE + (p > 1 ? "?pagina=" + p : "");
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) });
    if (r.status !== 200) throw new Error("la pagina " + p + " devolvio HTTP " + r.status);
    const t = await r.text();
    const ids = [...new Set([...t.matchAll(/\/ficha-vehiculo-ocasion\/[^"'\s]*?\/(\d{6,})/g)].map((m) => m[1]))];
    leidas++;
    const antes = vivos.size;
    ids.forEach((i) => vivos.add(i));

    // Se para cuando una página no aporta ningún coche NUEVO, no cuando viene
    // vacía: pasada la última, VIAN no devuelve una página en blanco sino que
    // repite la última una y otra vez. Esperando páginas vacías se pedían 80 en
    // vez de las 53 que hay.
    if (vivos.size === antes) { if (++vacias >= 2) break; } else vacias = 0;
    if (p < MAX_PAGINAS) await new Promise((s) => setTimeout(s, ESPERA_MS));
  }
  console.log(`${ESCRIBIR ? "" : "[EN SECO] "}listado de VIAN: ${leidas} páginas, ${vivos.size} coches`);

  // La misma salvaguarda que en Modrive: si el listado devuelve cuatro coches,
  // no es que hayan liquidado el concesionario, es que ha cambiado el maquetado.
  if (vivos.size < 100) throw new Error("el listado solo trae " + vivos.size + " coches: no me fío, no toco nada");

  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const filas = (await c.query(`SELECT id, source_url, is_active
    FROM moveadvisor_marketplace_vo_offers WHERE portal='vian'`)).rows;

  const bajas = [], resucitar = [], nuestros = new Set();
  for (const f of filas) {
    const i = idDe(f.source_url);
    if (!i) continue;
    nuestros.add(i);
    if (vivos.has(i)) { if (f.is_active === false) resucitar.push(f.id); }
    else if (f.is_active !== false) bajas.push(f.id);
  }
  const nuevas = [...vivos].filter((i) => !nuestros.has(i)).length;

  console.log(`  de nuestras ${filas.length}:`);
  console.log(`    siguen en el listado : ${filas.length - bajas.length}`);
  console.log(`    bajas                : ${bajas.length}`);
  console.log(`    reaparecidas         : ${resucitar.length}`);
  console.log(`  en el listado y no tenemos : ${nuevas}   (las trae el scraper)`);

  const mortandad = filas.length ? bajas.length / filas.length : 0;
  if (mortandad > 0.85) {
    console.log(`\n  ABORTADO: saldrían de baja el ${Math.round(mortandad * 100)}%.`);
    await c.end();
    process.exit(1);
  }

  if (!ESCRIBIR) {
    console.log("\n[EN SECO] no se ha tocado la base.");
    console.log("Para hacerlo de verdad: ESCRIBIR=1 node scripts/repara-vian.js");
    await c.end();
    return;
  }

  if (bajas.length) {
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
      SET is_active = FALSE, last_checked_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1)`, [bajas]);
    console.log(`\n  dadas de baja : ${q.rowCount}`);
  }
  if (resucitar.length) {
    const q = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
      SET is_active = TRUE, last_checked_at = NOW(), last_seen_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1)`, [resucitar]);
    console.log(`  resucitadas   : ${q.rowCount}`);
  }
  // Las que siguen en el listado quedan vistas hoy. updated_at no se toca.
  const vistas = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
    SET last_seen_at = NOW(), last_checked_at = NOW()
    WHERE portal='vian' AND is_active`);
  console.log(`  marcadas como vistas hoy : ${vistas.rowCount}`);

  const fin = (await c.query(`SELECT count(*) FILTER (WHERE is_active) act,
    count(*) FILTER (WHERE is_active IS FALSE) inact
    FROM moveadvisor_marketplace_vo_offers WHERE portal='vian'`)).rows[0];
  console.log(`\n  VIAN queda en ${fin.act} activas y ${fin.inact} de baja (el listado publica ${vivos.size}).`);
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
