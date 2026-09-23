/**
 * Da de baja lo que un volcado dice que ya no se vende.
 *
 *   npm run limpia-con-volcado -- <fichero.jsonl.gz>            (solo mira)
 *   npm run limpia-con-volcado -- <fichero.jsonl.gz> --aplica
 *
 * PARA QUÉ
 *
 * Un volcado es el catálogo entero de un portal un día concreto. Lo que
 * tenemos por vivo y no aparece en él, ya se vendió. Es un verificador que
 * hace en una pasada lo que al nuestro le cuesta semanas.
 *
 * EL CASO QUE LO MOTIVA (23-sep-2026, AutoScout24 España)
 *
 *     nuestras filas vivas          382.860
 *     el volcado del 21-sep trae    267.710
 *     nuestras que no están en él   174.787
 *
 * Y de esas 174.787, nuestro PROPIO scraper solo había visto 375 en los dos
 * últimos días. La mediana llevaba 42 días sin que nadie la viera. No es que
 * el volcado sea parcial: es que arrastramos medio portal vendido.
 *
 * El verificador no está roto, está pequeño: mira 1.500 al azar seis veces al
 * día, o sea 9.000 de 382.860. Son 43 días para dar una vuelta, y encima al
 * azar, así que unas filas se revisan dos veces por semana y otras esperan
 * meses.
 *
 * LOS TRES FRENOS
 *
 * Dar de baja 174.000 filas a partir de un fichero es exactamente el tipo de
 * cosa que hay que hacer con miedo:
 *
 *   1. EL VOLCADO TIENE QUE SER CREÍBLE. Si trae menos de la mitad de lo que
 *      nosotros damos por vivo, o viene cortado, no se toca nada. Un fichero
 *      a medias daría de baja el portal entero.
 *
 *   2. NO SE TOCA LO QUE HEMOS VISTO DESPUÉS. El volcado es una foto de un
 *      día; lo que nuestro scraper vio después de esa fecha son altas nuevas y
 *      se quedan vivas, estén o no en la foto.
 *
 *   3. TECHO DE MORTANDAD. Si saliera más del 70 % hay algo mal en el cruce
 *      -otro formato de id, otro portal- y se para.
 *
 * No toca updated_at: esto no es que el anuncio haya cambiado, es que nosotros
 * no nos habíamos enterado.
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

// Cómo se llama cada portal en el volcado y cómo en nuestra tabla, con el
// prefijo que llevan nuestros ids.
const PORTALES = {
  "coches.net": { portal: "cochesnet", prefijo: "cn_" },
  "autoscout24.es": { portal: "autoscout24", prefijo: "as_" },
  "autoscout24": { portal: "autoscout24", prefijo: "as_" },
  "milanuncios.com": { portal: "milanuncios", prefijo: "ml_" },
  "wallapop.com": { portal: "wallapop", prefijo: "wp_" },
};

const MINIMO_CREIBLE = 0.5;   // el volcado, frente a lo que damos por vivo
const TOPE_MORTANDAD = 0.7;
const POR_TROZO = 2000;

(async () => {
  if (!FICHERO || !fs.existsSync(FICHERO)) {
    console.log("\n  Falta el fichero. Uso:");
    console.log("      npm run limpia-con-volcado -- ruta/al/volcado.jsonl.gz [--aplica]\n");
    process.exit(1);
  }

  // ── Leer el volcado ──────────────────────────────────────────────────────
  const suyos = new Set();
  let plataforma = null;
  let refDay = null;
  let n = 0;
  const gz = fs.createReadStream(FICHERO).pipe(zlib.createGunzip());
  let resto = "";
  for await (const chunk of gz) {
    resto += chunk.toString("utf8");
    const partes = resto.split("\n");
    resto = partes.pop();
    for (const linea of partes) {
      if (!linea.trim()) continue;
      let o;
      try { o = JSON.parse(linea); } catch (e) { continue; }
      n++;
      if (!plataforma) { plataforma = String(o.platform || ""); refDay = String(o.ref_day || "").slice(0, 10); }
      if (o.article_id) suyos.add(String(o.article_id));
    }
  }

  const cfg = PORTALES[plataforma];
  if (!cfg) {
    console.log("\n  No sé a qué portal nuestro corresponde «" + plataforma + "».");
    console.log("  Añádelo a PORTALES en este fichero antes de seguir.\n");
    process.exit(1);
  }
  console.log("\n  EL VOLCADO");
  console.log("      plataforma : " + plataforma + "   ->  portal '" + cfg.portal + "'");
  console.log("      fecha      : " + refDay);
  console.log("      coches     : " + n.toLocaleString("es") + "   (ids distintos: " + suyos.size.toLocaleString("es") + ")");

  // ── Lo nuestro ───────────────────────────────────────────────────────────
  const c = new Client({ connectionString: DB_URL, statement_timeout: 900000 });
  await c.connect();
  const { rows } = await c.query(`SELECT id, (last_seen_at > $2::date) AS visto_despues,
      EXTRACT(day FROM NOW() - last_seen_at)::int dias
    FROM moveadvisor_market_offers
    WHERE portal = $1 AND is_active AND COALESCE(country,'ES') = 'ES'`, [cfg.portal, refDay]);
  console.log("\n  LO NUESTRO: " + rows.length.toLocaleString("es") + " filas vivas de " + cfg.portal);

  /*
   * FRENO 1: ¿es creíble el volcado?
   *
   * Un fichero cortado a la mitad parece un catálogo pequeño y daría de baja
   * el portal entero.
   */
  if (suyos.size < rows.length * MINIMO_CREIBLE) {
    console.log("\n  NO SE TOCA NADA: el volcado trae " + suyos.size.toLocaleString("es")
      + " y nosotros damos por vivas " + rows.length.toLocaleString("es")
      + ". Menos del " + Math.round(MINIMO_CREIBLE * 100) + " %: o está cortado o no es del mismo portal.\n");
    await c.end();
    return;
  }

  const bajas = [];
  let salvados = 0;
  const dias = [];
  for (const r of rows) {
    const id = String(r.id).slice(cfg.prefijo.length);
    if (suyos.has(id)) continue;
    // FRENO 2: lo visto después de la foto son altas nuevas.
    if (r.visto_despues) { salvados++; continue; }
    bajas.push(r.id);
    dias.push(r.dias);
  }
  dias.sort((a, b) => a - b);
  const mediana = dias.length ? dias[Math.floor(dias.length / 2)] : 0;

  console.log("      están en el volcado        : " + (rows.length - bajas.length - salvados).toLocaleString("es"));
  console.log("      NO están, pero vistas después del " + refDay + ": " + salvados.toLocaleString("es") + "   (se quedan vivas)");
  console.log("      NO están y sin ver desde antes: " + bajas.length.toLocaleString("es") + "   <- las bajas");
  if (bajas.length) console.log("      mediana de días sin verlas    : " + mediana);

  // FRENO 3
  const pct = bajas.length / (rows.length || 1);
  if (pct > TOPE_MORTANDAD) {
    console.log("\n  NO SE TOCA NADA: saldrían de baja el " + Math.round(pct * 100)
      + " % de las nuestras. Con esa cifra lo que falla es el cruce, no el portal.\n");
    await c.end();
    return;
  }
  if (!bajas.length) { console.log("\n  Nada que dar de baja.\n"); await c.end(); return; }

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run limpia-con-volcado -- " + path.basename(FICHERO) + " --aplica\n");
    await c.end();
    return;
  }

  console.log("\n  APLICANDO, en trozos de " + POR_TROZO.toLocaleString("es"));
  let hechas = 0;
  for (let i = 0; i < bajas.length; i += POR_TROZO) {
    const trozo = bajas.slice(i, i + POR_TROZO);
    const r = await c.query(`UPDATE moveadvisor_market_offers
      SET is_active = FALSE, last_checked_at = NOW() WHERE id = ANY($1)`, [trozo]);
    hechas += r.rowCount;
    if ((i / POR_TROZO) % 10 === 0) console.log("      " + hechas.toLocaleString("es"));
  }

  const desp = (await c.query(`SELECT count(*) FILTER (WHERE is_active)::int vivas,
      count(*)::int total FROM moveadvisor_market_offers
    WHERE portal = $1 AND COALESCE(country,'ES') = 'ES'`, [cfg.portal])).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      bajas dadas : " + hechas.toLocaleString("es"));
  console.log("      vivas ahora : " + desp.vivas.toLocaleString("es") + " de " + desp.total.toLocaleString("es"));
  console.log("      el volcado decía: " + suyos.size.toLocaleString("es"));
  console.log("");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
