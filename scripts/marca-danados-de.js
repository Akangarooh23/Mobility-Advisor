/**
 * Va a las fichas de AutoScout24 y apunta cuáles están dañadas y cuáles llevan
 * precio neto sin IVA.
 *
 *   node scripts/marca-danados-de.js                 (candidatas a publicar)
 *   LIMITE=3000 node scripts/marca-danados-de.js     (más de golpe)
 *
 * ── Por qué hace falta ─────────────────────────────────────────────────────
 *
 * El 2026-09-10, al abrir el escaparate de importación por debajo de 12.000 €,
 * entraban 1.003 ofertas alemanas nuevas. Y no eran gangas:
 *
 *     5.500 €  2017  125.000 km   Land Rover Discovery Sport // MOTORSCHADEN
 *     4.900 €  2021   87.000 km   Citroen Jumper Kasten
 *     7.800 €  2020  120.000 km   Mercedes Vito ... *Mwst
 *
 * Por el título se detectaba un 5% de siniestrados y un 4% de «motor roto». Pero
 * el primero de la lista -un Mercedes E 300 de 2024 a 11.900 €- no decía nada en
 * el título, y su ficha sí:
 *
 *     damageConditions : ["Dañado"]
 *     isFinalPrice     : false
 *     netPrice         : 10.000 €   (el anunciado lleva 19% de IVA deducible)
 *
 * O sea que el título no basta.
 *
 * ── Lo del IVA importa tanto como el daño ──────────────────────────────────
 *
 * Un precio neto comparado contra precios españoles con IVA se inventa un 19%
 * de ahorro que no existe. Es típico de furgonetas y vehículos comerciales, que
 * es justo lo que llenaba esa franja de precio.
 *
 * ── Qué distingue NULL de FALSE ────────────────────────────────────────────
 *
 * NULL es «no lo hemos mirado», FALSE es «lo hemos mirado y no lo está». La
 * diferencia importa: publicar algo con is_damaged NULL es publicarlo sin saber.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const LIMITE = Number(process.env.LIMITE || 1500);
const ESPERA = Number(process.env.ESPERA || 900);
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Las candidatas a estar publicadas, MÁS las que ya están publicadas hoy.
 *
 * Las publicadas hacen falta porque la regla nueva exige haber comprobado el
 * coche: sin mirarlas se retirarían 447 que a lo mejor están perfectamente, y
 * no por estar mal sino por no saberlo.
 */
const CANDIDATAS = `
  country = 'DE' AND is_active
  AND (
    -- las que ya se están ofreciendo hoy
    import_published
    -- o las que la regla nueva ofrecería
    OR (
      import_comps >= 15
      AND import_margin_pct IS NOT NULL
      AND import_margin_pct <= 0.5
      AND (   (price >= 4000  AND price < 25000  AND import_margin_pct >= 0.20)
           OR (price >= 25000 AND price < 45000  AND import_margin_pct >= 0.25)
           OR (price >= 45000 AND price < 100000 AND import_margin_pct >= 0.30))
    )
  )`;

async function mira(url) {
  let r;
  try {
    r = await fetch(url, { headers: H, redirect: "follow", signal: AbortSignal.timeout(25000) });
  } catch (e) { return { estado: 0 }; }
  if (r.status !== 200) return { estado: r.status };
  const b = await r.text();
  const m = b.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return { estado: 200, sinDatos: true };
  let ld;
  try { ld = ((JSON.parse(m[1]).props || {}).pageProps || {}).listingDetails; } catch (e) { return { estado: 200, sinDatos: true }; }
  if (!ld || !ld.vehicle) return { estado: 200, sinDatos: true };

  const v = ld.vehicle;
  const danos = Array.isArray(v.damageConditions) ? v.damageConditions.filter(Boolean) : [];
  const precios = ld.prices || ld.price || {};
  const publico = precios.public || precios;
  return {
    estado: 200,
    danado: ("damageConditions" in v) ? danos.length > 0 : null,
    nota: danos.join(", ").slice(0, 200),
    accidente: typeof v.hadAccident === "boolean" ? v.hadAccident : null,
    neto: typeof publico.isFinalPrice === "boolean"
      ? (publico.isFinalPrice === false && Number(publico.netPriceRaw) > 0) : null,
  };
}

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 120000 });
  await c.connect();

  const pend = (await c.query(`SELECT count(*)::int n FROM moveadvisor_market_offers
    WHERE ${CANDIDATAS} AND is_damaged IS NULL AND COALESCE(url,'') <> ''`)).rows[0].n;
  const filas = (await c.query(`SELECT id, url, price::int, title FROM moveadvisor_market_offers
    WHERE ${CANDIDATAS} AND is_damaged IS NULL AND COALESCE(url,'') <> ''
    ORDER BY price ASC LIMIT $1`, [LIMITE])).rows;

  console.log("  " + pend.toLocaleString("es") + " candidatas sin mirar. Se miran "
    + filas.length + " (una cada " + (ESPERA / 1000) + " s, unos "
    + Math.round(filas.length * (ESPERA + 400) / 60000) + " min)\n");

  const cuenta = { danado: 0, sano: 0, neto: 0, accidente: 0, fallo: 0, muerta: 0, sinDatos: 0 };
  let n = 0;
  for (const o of filas) {
    const r = await mira(o.url);
    n++;

    if (r.estado === 0) { cuenta.fallo++; await dormir(ESPERA); continue; }
    if (r.estado !== 200) {
      // Vendida: se apunta para que no vuelva a mirarse y no se publique.
      cuenta.muerta++;
      await c.query("UPDATE moveadvisor_market_offers SET is_active = FALSE, last_checked_at = NOW() WHERE id = $1", [o.id]);
      await dormir(ESPERA);
      continue;
    }
    if (r.sinDatos) { cuenta.sinDatos++; await dormir(ESPERA); continue; }

    await c.query(`UPDATE moveadvisor_market_offers SET
        is_damaged = $2, damage_note = NULLIF($3,''), had_accident = $4, price_is_net = $5
      WHERE id = $1`, [o.id, r.danado, r.nota, r.accidente, r.neto]);

    if (r.danado) { cuenta.danado++; console.log("      DAÑADO   " + String(o.price).padStart(6)
      + " €  " + (r.nota || "") + "   " + String(o.title || "").slice(0, 46)); }
    else cuenta.sano++;
    if (r.neto) { cuenta.neto++; console.log("      NETO     " + String(o.price).padStart(6)
      + " €  precio sin IVA   " + String(o.title || "").slice(0, 46)); }
    if (r.accidente) cuenta.accidente++;

    if (n % 100 === 0) console.log("      ... " + n + " de " + filas.length);
    await dormir(ESPERA);
  }

  console.log("\n  RESUMEN de " + n + " miradas");
  console.log("      dañadas          : " + cuenta.danado);
  console.log("      con accidente    : " + cuenta.accidente);
  console.log("      precio neto      : " + cuenta.neto);
  console.log("      sanas            : " + cuenta.sano);
  console.log("      ya vendidas      : " + cuenta.muerta + "   (marcadas inactivas)");
  console.log("      sin datos / fallo: " + (cuenta.sinDatos + cuenta.fallo));

  const q = (await c.query(`SELECT count(*)::int n FROM moveadvisor_market_offers
    WHERE ${CANDIDATAS} AND is_damaged IS NULL AND COALESCE(url,'') <> ''`)).rows[0].n;
  console.log("\n      quedan sin mirar: " + q);
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
