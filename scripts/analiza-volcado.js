/**
 * Qué trae un volcado que no tengamos, y qué tenemos que él no.
 *
 *   npm run analiza-volcado -- <fichero.jsonl.gz>
 *
 * SOLO LEE. No escribe una fila. Es el paso previo a cargar o a limpiar, y
 * existe porque con AutoScout24 se hizo a mano y las respuestas cambiaban el
 * arreglo por completo:
 *
 *   - ¿lo que falta es RECIENTE?  -> el scraper no llega a las altas nuevas
 *   - ¿es VIEJO?                  -> nunca lo cogimos
 *   - ¿lo tenemos DE BAJA?        -> lo estamos enterrando vivo
 *   - ¿se concentra en un vendedor, provincia o precio? -> el scraper tiene un
 *     filtro que no sabíamos que tenía
 *
 * En AutoScout24 la respuesta fue la primera -faltaba el 85 % de lo de menos de
 * una semana y solo el 5 % de lo viejo-, y de ahí salió el flujo de altas. Si
 * la respuesta hubiera sido otra, el arreglo habría sido otro.
 *
 * TAMBIÉN DICE SI EL CARGADOR VA A SERVIR
 *
 * Lista los campos del volcado con cuántos vienen rellenos. Los de coches.net y
 * AutoScout24 traían los mismos 92 campos, así que el cargador vale para los
 * dos; si milanuncios o wallapop traen otros nombres, se ve aquí antes de
 * escribir una línea de mapeo.
 *
 * EL PREFIJO ES LO PRIMERO QUE HAY QUE MIRAR
 *
 * Nuestros ids llevan prefijo por portal y NO son todos de dos letras:
 * cochesnet 'cn_', autoscout24 'as_', wallapop 'wp_' y milanuncios 'mil_'.
 * Equivocarlo no da error: da cero coincidencias, y entonces el volcado parece
 * traer un catálogo completamente ajeno. Por eso el script avisa fuerte cuando
 * el cruce sale a cero.
 */
"use strict";
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const FICHERO = process.argv.find((a) => a.indexOf(".jsonl") !== -1);
/*
 * --sin-base se queda en la primera mitad: qué trae el fichero y con qué
 * campos. No abre Postgres.
 *
 * Está para poder mirar un volcado nuevo mientras el scoring corre, que son
 * cuarenta minutos, sin ponerle encima una lectura de 878.726 ids. El 23-sep
 * lancé una consulta gorda mientras Ana tenía el scoring en marcha y hubo que
 * matar las dos.
 */
const SIN_BASE = process.argv.includes("--sin-base");

// Los mismos que limpia-con-volcado.js, comprobados contra la base.
const PORTALES = {
  "coches.net": { portal: "cochesnet", prefijo: "cn_" },
  "autoscout24.es": { portal: "autoscout24", prefijo: "as_" },
  "autoscout24": { portal: "autoscout24", prefijo: "as_" },
  "milanuncios.com": { portal: "milanuncios", prefijo: "mil_" },
  "wallapop.com": { portal: "wallapop", prefijo: "wp_" },
};

const tabla = (etq, falta, total) => {
  console.log("\n      " + etq);
  for (const k of Object.keys(total || falta).sort()) {
    const f = falta[k] || 0;
    const t = total ? (total[k] || 0) : 0;
    console.log("        " + String(k).padEnd(16) + String(f).padStart(8)
      + (total ? "  de " + String(t).padStart(8) + "   " + Math.round(100 * f / (t || 1)) + " % se nos escapa" : ""));
  }
};

(async () => {
  if (!FICHERO || !fs.existsSync(FICHERO)) {
    console.log("\n  Falta el fichero. Uso:");
    console.log("      npm run analiza-volcado -- C:\\Users\\Anapi\\Volcados\\2026-09-21\\objects_xxx.jsonl.gz\n");
    process.exit(1);
  }

  // ── Primera pasada: el fichero ───────────────────────────────────────────
  let plataforma = null, refDay = null, n = 0;
  const campos = {}, ejemplo = {};
  const ids = [];
  const filas = [];

  const gz = fs.createReadStream(FICHERO).pipe(
    FICHERO.endsWith(".gz") ? zlib.createGunzip() : new (require("stream").PassThrough)());
  let resto = "";
  for await (const chunk of gz) {
    resto += chunk.toString("utf8");
    const partes = resto.split("\n");
    resto = partes.pop();
    for (const l of partes) {
      if (!l.trim()) continue;
      let o; try { o = JSON.parse(l); } catch (e) { continue; }
      n++;
      if (!plataforma) { plataforma = String(o.platform || ""); refDay = String(o.ref_day || "").slice(0, 10); }
      for (const k of Object.keys(o)) {
        const v = o[k];
        const lleno = !(v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length));
        if (!campos[k]) campos[k] = { lleno: 0, visto: 0 };
        campos[k].visto++;
        if (lleno) { campos[k].lleno++; if (ejemplo[k] === undefined) ejemplo[k] = v; }
      }
      const id = String(o.article_id != null ? o.article_id : (o.dealer_id != null ? o.dealer_id : ""));
      if (id) ids.push(id);
      filas.push({
        id: id,
        creado: String(o.created || "").slice(0, 10),
        precio: Number(o.price_public_euro || o.price_cash_public_euro || o.asking_price || 0),
        vendedor: String(o.dealer_type || "?"),
        cp: String(o.zip_code || "").slice(0, 2),
        marca: String(o.make || ""), modelo: String(o.model || ""),
      });
    }
  }

  console.log("\n  EL VOLCADO");
  console.log("      fichero    : " + path.basename(FICHERO));
  console.log("      plataforma : " + plataforma + "      fecha: " + refDay);
  console.log("      registros  : " + n.toLocaleString("es") + "   (con id: " + ids.length.toLocaleString("es") + ")");

  // ── Los campos, para saber si el cargador sirve ──────────────────────────
  const claves = Object.keys(campos).sort();
  console.log("\n  LOS " + claves.length + " CAMPOS  (cuántos vienen rellenos)");
  const vacios = claves.filter((k) => campos[k].lleno === 0);
  for (const k of claves) {
    if (campos[k].lleno === 0) continue;
    const pct = Math.round(100 * campos[k].lleno / campos[k].visto);
    console.log("      " + k.padEnd(26) + String(pct).padStart(3) + " %   "
      + String(JSON.stringify(ejemplo[k])).slice(0, 46));
  }
  if (vacios.length) {
    console.log("\n      VACÍOS EN TODOS LOS REGISTROS (" + vacios.length + "): " + vacios.join(", "));
    console.log("      No merecen columna: una que siempre es NULL solo sirve para");
    console.log("      que dentro de seis meses alguien crea que ha perdido datos.");
  }

  if (SIN_BASE) {
    console.log("\n  (--sin-base: no se ha abierto Postgres. Quita la opción para el cruce.)\n");
    return;
  }

  const cfg = PORTALES[plataforma];
  if (!cfg) {
    console.log("\n  No sé a qué portal nuestro corresponde «" + plataforma + "».");
    console.log("  Añádelo a PORTALES aquí y en limpia-con-volcado.js, con el prefijo");
    console.log("  de id que use ese portal en moveadvisor_market_offers.\n");
    return;
  }

  // ── Segunda pasada: contra lo nuestro ────────────────────────────────────
  const c = new Client({ connectionString: DB_URL, statement_timeout: 600000 });
  await c.connect();
  const vivos = new Set(), muertos = new Set();
  for (const r of (await c.query(
    `SELECT id, is_active FROM moveadvisor_market_offers
      WHERE portal = $1 AND COALESCE(country,'ES') = 'ES'`, [cfg.portal])).rows) {
    const id = String(r.id).slice(cfg.prefijo.length);
    if (r.is_active) vivos.add(id); else muertos.add(id);
  }
  await c.end();
  console.log("\n  LO NUESTRO DE " + cfg.portal + ": " + vivos.size.toLocaleString("es")
    + " vivas y " + muertos.size.toLocaleString("es") + " de baja");

  const ref = new Date(refDay);
  const dias = (f) => { const d = new Date(f); return isNaN(d) ? null : Math.round((ref - d) / 86400000); };

  let tenemosVivo = 0, tenemosMuerto = 0;
  const falta = { total: 0, edad: {}, vendedor: {}, precio: {}, prov: {}, modelo: {} };
  const todos = { edad: {}, vendedor: {} };
  for (const f of filas) {
    const d = dias(f.creado);
    const edad = d === null ? "(sin fecha)" : d < 7 ? "0-7 días" : d < 30 ? "7-30" : d < 90 ? "30-90" : "más de 90";
    todos.edad[edad] = (todos.edad[edad] || 0) + 1;
    todos.vendedor[f.vendedor] = (todos.vendedor[f.vendedor] || 0) + 1;
    if (vivos.has(f.id)) { tenemosVivo++; continue; }
    if (muertos.has(f.id)) { tenemosMuerto++; continue; }
    falta.total++;
    falta.edad[edad] = (falta.edad[edad] || 0) + 1;
    falta.vendedor[f.vendedor] = (falta.vendedor[f.vendedor] || 0) + 1;
    const p = f.precio;
    falta.precio[p < 5000 ? "<5.000" : p < 15000 ? "5-15.000" : p < 30000 ? "15-30.000" : "30.000+"] =
      (falta.precio[p < 5000 ? "<5.000" : p < 15000 ? "5-15.000" : p < 30000 ? "15-30.000" : "30.000+"] || 0) + 1;
    if (f.cp) falta.prov[f.cp] = (falta.prov[f.cp] || 0) + 1;
    const m = (f.marca + " " + f.modelo).trim();
    if (m) falta.modelo[m] = (falta.modelo[m] || 0) + 1;
  }

  console.log("\n  EL CRUCE");
  console.log("      los tenemos VIVOS   : " + tenemosVivo.toLocaleString("es"));
  console.log("      los tenemos DE BAJA : " + tenemosMuerto.toLocaleString("es")
    + (tenemosMuerto ? "   <- los enterramos y siguen a la venta" : ""));
  console.log("      NO los tenemos      : " + falta.total.toLocaleString("es")
    + "   (" + Math.round(100 * falta.total / (n || 1)) + " % del volcado)");

  if (tenemosVivo + tenemosMuerto === 0) {
    console.log("\n      CERO COINCIDENCIAS. Casi seguro que el prefijo de id está mal:");
    console.log("      uso '" + cfg.prefijo + "'. Míralo con:");
    console.log("        SELECT min(id) FROM moveadvisor_market_offers WHERE portal='" + cfg.portal + "';");
    console.log("      Un volcado del mismo portal no puede no tener NADA en común.\n");
    return;
  }

  tabla("POR ANTIGÜEDAD DEL ANUNCIO", falta.edad, todos.edad);
  tabla("POR TIPO DE VENDEDOR", falta.vendedor, todos.vendedor);
  tabla("POR PRECIO (solo los que faltan)", falta.precio, null);

  const prov = Object.entries(falta.prov).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (prov.length) {
    console.log("\n      LAS SEIS PROVINCIAS CON MÁS AUSENCIAS (dos dígitos del CP)");
    console.log("        " + prov.map(([k, v]) => k + ":" + v).join("   "));
  }
  const mods = Object.entries(falta.modelo).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (mods.length) {
    console.log("\n      LOS SEIS MODELOS QUE MÁS FALTAN");
    for (const [k, v] of mods) console.log("        " + String(v).padStart(7) + "  " + k);
  }

  console.log("\n  QUÉ HACER CON ESTO");
  const pctReciente = Math.round(100 * (falta.edad["0-7 días"] || 0) / (todos.edad["0-7 días"] || 1));
  const pctViejo = Math.round(100 * (falta.edad["más de 90"] || 0) / (todos.edad["más de 90"] || 1));
  if (pctReciente > pctViejo + 20) {
    console.log("      Falta sobre todo lo RECIENTE (" + pctReciente + " % de lo de esta semana");
    console.log("      frente al " + pctViejo + " % de lo viejo): el scraper no llega a las altas.");
    console.log("      Es el caso de AutoScout24, y se arregló con un flujo de altas.");
  } else if (pctViejo > pctReciente + 20) {
    console.log("      Falta sobre todo lo VIEJO: nunca llegamos al fondo del catálogo.");
  } else {
    console.log("      Falta parejo por edades: no es latencia, es que no cubrimos el portal.");
  }
  if (tenemosMuerto > vivos.size * 0.02) {
    console.log("      Y hay " + tenemosMuerto.toLocaleString("es") + " que dimos de baja y siguen a la venta:");
    console.log("      limpia-con-volcado.js los resucita.");
  }
  console.log("");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
