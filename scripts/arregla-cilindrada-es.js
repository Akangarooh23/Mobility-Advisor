/**
 * Pasa a centímetros cúbicos las cilindradas guardadas en litros.
 *
 *   npm run arregla-cilindrada            (solo mira, no escribe)
 *   npm run arregla-cilindrada -- --aplica
 *
 * POR QUE
 *
 * El 15-sep-2026, de 231.652 ofertas españolas de AutoScout24 con cilindrada,
 * 102.937 la tenían así:
 *
 *     displacement = "1.5"      <- litros
 *     displacement = "998"      <- centímetros cúbicos
 *
 * Las dos en la misma columna de texto. Cualquier filtro por cilindrada -«de
 * 1.400 a 2.000 cc»- deja fuera a las 102.937, y una comparación por texto pone
 * «998» por encima de «1.5».
 *
 * POR QUE NO LO ARREGLA EL ENRIQUECEDOR
 *
 * Porque el portal tampoco lo sabe. Medido sobre tres grupos de ocho fichas:
 *
 *     guardada en LITROS   ficha: cilindrada 0/8
 *     guardada en cc       ficha: cilindrada 8/8
 *     SIN cilindrada       ficha: cilindrada 0/8
 *
 * AutoScout24 declara rawDisplacementInCCM exactamente en los coches que ya
 * tenemos bien. Pedir 102.937 fichas para esto sería gastar 52 días de
 * presupuesto en preguntas sin respuesta.
 *
 * Y no hace falta: 1,5 litros son 1.500 cc. La conversión es exacta para lo que
 * usamos la columna -filtrar por tamaño de motor-, aunque el fabricante declare
 * 1.498. Un motor de 1,5 l nunca cae fuera del tramo de 1.400-2.000 por 2 cc.
 *
 * LO QUE NO TOCA
 *
 *   - Lo que ya son cc: tres a cinco dígitos sin coma.
 *   - Valores absurdos: menos de 0,6 l o más de 8,0 l no son un coche de calle,
 *     son un error de lectura, y prefiero dejarlos como están y que se vean.
 *   - updated_at, que ordena el escaparate: esto no es que el anuncio haya
 *     cambiado, es que nosotros lo teníamos mal.
 */
"use strict";
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");

// Se acota a lo que es un coche de calle: de 0,6 a 8,0 litros.
const CANDIDATAS = `COALESCE(country,'ES') = 'ES'
  AND displacement ~ '^[0-9]+\\.[0-9]+$'
  AND displacement::numeric >= 0.6
  AND displacement::numeric <= 8.0`;

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 900000 });
  await c.connect();

  const antes = (await c.query(`SELECT
      count(*) FILTER (WHERE displacement ~ '^[0-9]+\\.[0-9]+$')::int en_litros,
      count(*) FILTER (WHERE displacement ~ '^[0-9]{3,5}$')::int en_cc,
      count(*) FILTER (WHERE ${CANDIDATAS})::int convertibles
    FROM moveadvisor_market_offers WHERE COALESCE(country,'ES')='ES'`)).rows[0];
  console.log("  ANTES");
  console.log("      en litros    : " + Number(antes.en_litros).toLocaleString("es"));
  console.log("      en cc        : " + Number(antes.en_cc).toLocaleString("es"));
  console.log("      convertibles : " + Number(antes.convertibles).toLocaleString("es")
    + "   (el resto son valores absurdos y se quedan como están)");

  const muestra = await c.query(`SELECT brand, model, displacement, fuel
    FROM moveadvisor_market_offers
    WHERE ${CANDIDATAS} ORDER BY random() LIMIT 8`);
  console.log("\n  UNA MUESTRA DE LO QUE VA A CAMBIAR");
  for (const x of muestra.rows) {
    console.log("      " + String((x.brand || "") + " " + (x.model || "")).slice(0, 30).padEnd(32)
      + "«" + x.displacement + "»  ->  «" + Math.round(Number(x.displacement) * 1000) + "»");
  }

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run arregla-cilindrada -- --aplica");
    await c.end();
    return;
  }

  // Por bloques, para no tener 100.000 filas bloqueadas de una vez mientras el
  // scraper y el verificador escriben en la misma tabla: el 13-sep una pasada
  // del scoring y el scraper alemán se trabaron con «deadlock detected».
  console.log("\n  APLICANDO, en bloques de 5.000");
  let total = 0;
  for (;;) {
    const r = await c.query(`UPDATE moveadvisor_market_offers SET displacement =
        round(displacement::numeric * 1000)::text
      WHERE id IN (SELECT id FROM moveadvisor_market_offers WHERE ${CANDIDATAS} LIMIT 5000)`);
    if (!r.rowCount) break;
    total += r.rowCount;
    console.log("      " + total.toLocaleString("es") + " convertidas");
  }

  const desp = (await c.query(`SELECT
      count(*) FILTER (WHERE displacement ~ '^[0-9]+\\.[0-9]+$')::int en_litros,
      count(*) FILTER (WHERE displacement ~ '^[0-9]{3,5}$')::int en_cc
    FROM moveadvisor_market_offers WHERE COALESCE(country,'ES')='ES'`)).rows[0];
  console.log("\n  DESPUES");
  console.log("      en litros: " + Number(desp.en_litros).toLocaleString("es")
    + "   en cc: " + Number(desp.en_cc).toLocaleString("es"));
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
