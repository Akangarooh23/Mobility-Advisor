/**
 * Devuelve a las filas de Autocasión una url que el verificador pueda mirar.
 *
 *   npm run arregla-urls-autocasion              (solo mira)
 *   npm run arregla-urls-autocasion -- --aplica
 *
 * EL PROBLEMA
 *
 * El scraper coge `off.url` del JSON de la página, y cuando ahí no viene la
 * ficha del coche guarda LA URL DEL LISTADO:
 *
 *     300 filas -> .../coches-segunda-mano/peugeot-2008-ocasion/madrid
 *     268 filas -> .../coches-segunda-mano/peugeot-208-ocasion/madrid
 *
 * No son duplicados: el id sale de `car.identifier` y es bueno, así que son
 * coches distintos con precios distintos y la url mal guardada.
 *
 * Y NO MUEREN NUNCA. El verificador solo mira las urls que acaban en
 * `ref######`, y hace bien -pedir una página de búsqueda devolvería 200 siempre
 * y las daría por vivas eternamente-, así que estas se quedan fuera:
 *
 *     url válida     156.583 filas   144.776 vivas (92 %)   mediana 4 días
 *     url de listado  35.324 filas    35.324 vivas (100 %)  mediana 58 días
 *
 * Cien por cien vivas, ni una enterrada jamás, y las 35.324 en el pool de
 * comparables. Su last_checked_at es el 2-sep-2026 en TODAS: una operación en
 * bloque de aquel día, y nadie las ha tocado desde entonces.
 *
 * POR QUÉ LA URL SE PUEDE RECONSTRUIR
 *
 * Porque el id ES el ref: comprobado en las 156.583 filas con url buena, sin
 * una sola excepción.
 *
 * Y porque Autocasión resuelve por el ref e ignora el resto de la ruta. Medido
 * el 23-sep-2026 con tres peticiones:
 *
 *     la url buena                        301 -> la ficha del coche
 *     .../x-ocasion/x-ref20387515         301 -> LA MISMA ficha
 *     .../coches-segunda-mano/ref2038...  404   (hace falta la forma completa)
 *
 * Un slug inventado vale. Y un ref que no existe da 410, que es justo lo que el
 * verificador entiende como vendida.
 *
 * LO REMATA EL VERIFICADOR, NO ESTE SCRIPT
 *
 * Este script no pide nada a Autocasión. Solo deja la url en la forma mínima.
 * A partir de ahí la fila entra en la cola del verificador y él hace el resto,
 * porque ya tiene el caso contemplado: «un 3xx cuyo destino conserva el
 * refNNNNNN no es una venta, es el portal cambiando el slug» -guarda la url
 * nueva-, y 410/404 es vendida.
 *
 * O sea que a la primera pasada cada fila se cura sola: o recibe su url
 * canónica de verdad, o se entierra. Nosotros solo le damos la llave.
 *
 * CUÁNTO TARDA EN NOTARSE
 *
 * El verificador hace 1.500 por pasada y seis pasadas al día = 9.000 diarias, y
 * elige al azar entre las elegibles. Al añadir estas 35.324 la cola pasa de
 * 144.776 a 180.100, o sea unos 20 días para dar la vuelta. No se toca el LOTE
 * para acelerar: está en 1.500 porque n8n se degrada en bucles largos -de 50 a
 * 19 ofertas/min- y una pasada larga no tarda más, sale más cara.
 *
 * No toca updated_at: el anuncio no ha cambiado, lo que estaba mal era nuestra
 * copia de su dirección.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");
const POR_LOTE = 2000;

// El slug da igual -Autocasión resuelve por el ref- pero tiene que tener la
// forma de una ficha, con sus dos tramos, o da 404.
const url = (id) => "https://www.autocasion.com/coches-segunda-mano/x-ocasion/x-ref"
  + String(id).replace(/^ac_/, "");

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 900000 });
  await c.connect();

  const { rows } = await c.query(`SELECT id, is_active,
      EXTRACT(day FROM NOW() - last_seen_at)::int dias
    FROM moveadvisor_market_offers
    WHERE portal = 'autocasion'
      AND (url IS NULL OR NOT (url ~ 'ref[0-9]{6,}$'))
      AND id ~ '^ac_[0-9]{6,}$'`);

  /*
   * El id tiene que ser numérico y de al menos seis cifras, como los refs de
   * verdad. Si alguna fila llevara un id de otra forma, la url construida daría
   * 410 y el verificador la enterraría por un fallo nuestro, no del portal.
   */
  const raros = (await c.query(`SELECT count(*)::int n FROM moveadvisor_market_offers
    WHERE portal = 'autocasion' AND (url IS NULL OR NOT (url ~ 'ref[0-9]{6,}$'))
      AND NOT (id ~ '^ac_[0-9]{6,}$')`)).rows[0].n;

  const vivas = rows.filter((r) => r.is_active).length;
  const dias = rows.filter((r) => r.dias != null).map((r) => r.dias).sort((a, b) => a - b);
  console.log("\n  FILAS CON URL QUE EL VERIFICADOR NO PUEDE MIRAR");
  console.log("      en total        : " + rows.length.toLocaleString("es"));
  console.log("      de ellas vivas  : " + vivas.toLocaleString("es")
    + "   (" + Math.round(100 * vivas / (rows.length || 1)) + " %)");
  if (dias.length) console.log("      mediana de días sin verlas: " + dias[Math.floor(dias.length / 2)]);
  if (raros) {
    console.log("      con id NO numérico: " + raros.toLocaleString("es")
      + "   <- se dejan como están: no se les puede construir la url");
  }
  console.log("\n      ejemplo de url nueva: " + (rows.length ? url(rows[0].id) : "-"));

  if (!rows.length) { console.log("\n  Nada que arreglar.\n"); await c.end(); return; }

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run arregla-urls-autocasion -- --aplica\n");
    await c.end();
    return;
  }

  console.log("\n  APLICANDO en lotes de " + POR_LOTE.toLocaleString("es"));
  let hechas = 0;
  for (let i = 0; i < rows.length; i += POR_LOTE) {
    const lote = rows.slice(i, i + POR_LOTE);
    const r = await c.query(
      `UPDATE moveadvisor_market_offers o SET url = v.u
         FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS u) v
        WHERE o.id = v.id AND o.portal = 'autocasion'`,
      [lote.map((x) => x.id), lote.map((x) => url(x.id))]);
    hechas += r.rowCount;
    if ((i / POR_LOTE) % 5 === 0) console.log("      " + hechas.toLocaleString("es"));
  }

  const fin = (await c.query(`SELECT
      count(*) FILTER (WHERE url ~ 'ref[0-9]{6,}$')::int verificables,
      count(*)::int total
    FROM moveadvisor_market_offers WHERE portal = 'autocasion' AND is_active`)).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      urls corregidas            : " + hechas.toLocaleString("es"));
  console.log("      activas que el verificador puede mirar: "
    + fin.verificables.toLocaleString("es") + " de " + fin.total.toLocaleString("es"));
  console.log("\n      A partir de su próxima pasada las irá curando solo: cada una");
  console.log("      recibe su url canónica de verdad (301 con el ref) o se entierra (410).");
  console.log("");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
