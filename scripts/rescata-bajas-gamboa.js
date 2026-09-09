/**
 * Rescata las ofertas de Gamboa dadas por muertas que en realidad siguen vivas.
 *
 *   node scripts/rescata-bajas-gamboa.js            (solo mira, no escribe)
 *   ESCRIBIR=1 node scripts/rescata-bajas-gamboa.js (aplica)
 *
 * ── Por qué hace falta ─────────────────────────────────────────────────────
 *
 * Gamboa cambia el slug de sus fichas: la URL vieja responde 301 y el Location
 * lleva el MISMO número de oferta. El verificador nunca dio de baja a esas -de
 * eso se encargaba la condición «si el destino conserva el número, no es una
 * venta»-, pero tampoco guardaba la URL nueva. Así que una oferta que ya
 * constaba de baja por otro motivo se quedaba muerta para siempre: su URL vieja
 * no iba a devolver 200 nunca más.
 *
 * Medido el 2026-09-09 sobre 25 bajas al azar: CUATRO estaban vivas en su URL
 * nueva. Sobre las 444 bajas de Gamboa son unos 70 coches fuera del escaparate
 * que se pueden vender.
 *
 * El verificador ya guarda la URL nueva a partir de ahora. Este script arregla
 * las que se quedaron atrás.
 *
 * ── Qué hace con cada una ──────────────────────────────────────────────────
 *
 *   200 en su propia URL          -> resucita
 *   301 y el destino da 200       -> corrige la URL y resucita
 *   301 al listado, o 404         -> la deja como está: está vendida de verdad
 *   500, timeout, cualquier fallo -> la deja como está
 *
 * ── Los frenos ─────────────────────────────────────────────────────────────
 *
 * Si de golpe resucitaran casi todas, no sería una buena noticia: sería que
 * hemos entendido mal la señal y estamos a punto de devolver al escaparate
 * coches vendidos. Por encima del 60% se para sin escribir nada.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const ESCRIBIR = process.env.ESCRIBIR === "1";
const TOPE_RESUCITADAS = 0.6;
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function cabeza(url) {
  try {
    const r = await fetch(url, {
      method: "HEAD", headers: H, redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    return { estado: r.status, destino: r.headers.get("location") || "" };
  } catch (e) { return { estado: 0, destino: "", error: e.message }; }
}

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  const bajas = (await c.query(`SELECT id, title, source_url
    FROM moveadvisor_marketplace_vo_offers
    WHERE portal = 'gamboa' AND NOT is_active AND COALESCE(source_url,'') <> ''
    ORDER BY updated_at DESC`)).rows;

  console.log("  " + bajas.length + " ofertas de Gamboa constan de baja."
    + (ESCRIBIR ? "  ESCRIBIENDO." : "  (solo mirando)"));
  console.log();

  const rescatar = [];   // [id, urlNueva|null, titulo]
  let vendidas = 0, fallos = 0, mirado = 0;

  for (const o of bajas) {
    mirado++;
    const num = (String(o.source_url).match(/(\d{4,})\s*$/) || [])[1] || "";
    const base = (String(o.source_url).match(/^https?:\/\/[^/]+/) || [""])[0];
    const r = await cabeza(o.source_url);

    if (r.estado === 0 || r.estado >= 500) { fallos++; await dormir(700); continue; }

    if (r.estado === 200) {
      rescatar.push([o.id, null, o.title]);
      console.log("      VIVA        " + o.id.padEnd(14) + String(o.title).slice(0, 42));
      await dormir(700);
      continue;
    }

    const conservaNumero = num && r.destino && r.destino.indexOf(num) >= 0;
    if (!conservaNumero) { vendidas++; await dormir(700); continue; }

    // Slug nuevo: hay que comprobar que la URL nueva existe antes de resucitar.
    const abs = /^https?:\/\//.test(r.destino) ? r.destino : (base + r.destino);
    await dormir(700);
    const r2 = await cabeza(abs);
    if (r2.estado === 200) {
      rescatar.push([o.id, abs, o.title]);
      console.log("      SLUG NUEVO  " + o.id.padEnd(14) + String(o.title).slice(0, 42));
      console.log("                  -> " + abs.slice(-62));
    } else if (r2.estado === 0 || r2.estado >= 500) {
      fallos++;
    } else {
      vendidas++;
    }
    await dormir(700);

    if (mirado % 50 === 0) console.log("      ... " + mirado + " de " + bajas.length);
  }

  console.log("\n  RESUMEN");
  console.log("      miradas                 : " + mirado);
  console.log("      vendidas de verdad      : " + vendidas);
  console.log("      fallos pasajeros        : " + fallos);
  console.log("      A RESUCITAR             : " + rescatar.length
    + "   (" + rescatar.filter((x) => x[1]).length + " además con URL nueva)");

  const juzgadas = mirado - fallos;
  if (juzgadas > 0 && rescatar.length / juzgadas > TOPE_RESUCITADAS) {
    console.log("\n  PARADO: resucitarían el " + Math.round(100 * rescatar.length / juzgadas)
      + "% de las bajas. Eso no es que nos hubiéramos equivocado en unas cuantas:");
    console.log("  es que la señal que estamos leyendo no significa lo que creemos.");
    console.log("  No se escribe nada.");
    await c.end();
    process.exit(1);
  }

  if (!rescatar.length) { console.log("\n  Nada que rescatar."); await c.end(); return; }
  if (!ESCRIBIR) {
    console.log("\n  Nada escrito. Para aplicarlo:  ESCRIBIR=1 node scripts/rescata-bajas-gamboa.js");
    await c.end();
    return;
  }

  const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";
  await c.query("BEGIN");
  try {
    let urls = 0;
    for (const [id, url] of rescatar) {
      if (url) {
        await c.query("UPDATE moveadvisor_marketplace_vo_offers SET source_url = "
          + esc(url) + " WHERE id = " + esc(id));
        urls++;
      }
    }
    // updated_at SÍ se mueve aquí: volver al escaparate es un cambio de verdad
    // del anuncio, no un retoque nuestro.
    const res = await c.query("UPDATE moveadvisor_marketplace_vo_offers"
      + " SET is_active = TRUE, last_seen_at = NOW(), last_checked_at = NOW(), updated_at = NOW()"
      + " WHERE id IN (" + rescatar.map((x) => esc(x[0])).join(", ") + ")");
    await c.query("COMMIT");
    console.log("\n      URLs corregidas : " + urls);
    console.log("      resucitadas     : " + res.rowCount);
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("  ERROR, nada escrito: " + e.message);
    process.exitCode = 1;
  }

  const fin = (await c.query(`SELECT count(*) FILTER (WHERE is_active) act,
     count(*) FILTER (WHERE NOT is_active) baja
     FROM moveadvisor_marketplace_vo_offers WHERE portal='gamboa'`)).rows[0];
  console.log("\n      Gamboa queda con " + fin.act + " activas y " + fin.baja + " de baja.");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
