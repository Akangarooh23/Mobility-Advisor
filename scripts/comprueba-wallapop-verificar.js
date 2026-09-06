/**
 * Comprueba el veredicto del verificador de Wallapop.
 *
 *   npm run test:wallapop-verificar
 *
 * Distinto de `npm run test:wallapop`, que comprueba el CONTRATO de la API
 * -que el buscador siga dando lo que se espera, que un retirado siga dando 404-.
 * Este comprueba el CODIGO: saca el nodo Code del workflow tal cual esta en el
 * JSON, le da el mismo contrato que le daria n8n y lanza el SQL que genera
 * contra la base de verdad, dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, que es donde este workflow puede hacer daño:
 *
 *   - Que un 200 que NO trae el anuncio dentro no resucite ofertas muertas.
 *     La rama del 200 pone is_active=TRUE, asi que un interstitial o una pagina
 *     de mantenimiento reactivaria el catalogo entero de golpe.
 *   - Que una oferta reservada deje de constar como activa.
 *   - Que updated_at solo se mueva cuando el estado cambia de verdad, porque es
 *     el unico rastro de cuando se cayo un anuncio.
 *   - Que un 429 o un 5xx no den de baja a nadie.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "wallapop-verificar-activas.json"), "utf8"));
const JS = wf.nodes.find((n) => n.name === "Code: Veredicto").parameters.jsCode;

// Le damos lo mismo que n8n: $input.item.json es la respuesta HTTP y
// $('Loop: oferta por oferta').item.json es la fila de la base.
function veredicto(oferta, respuesta) {
  const f = new Function("$", "$input", JS);
  const r = f(
    (n) => (n === "Loop: oferta por oferta" ? { item: { json: oferta } } : { item: { json: {} } }),
    { item: { json: respuesta } });
  return r[0].json;
}

const cuerpoDe = (idPortal, reservada) => JSON.stringify({
  id: idPortal, title: "Coche", reserved: { flag: !!reservada }, price: 12000 });

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  const activa = (await c.query(`SELECT id, is_active FROM moveadvisor_market_offers
    WHERE portal='wallapop' AND is_active ORDER BY id LIMIT 1`)).rows[0];
  const inactiva = (await c.query(`SELECT id, is_active FROM moveadvisor_market_offers
    WHERE portal='wallapop' AND is_active IS FALSE ORDER BY id LIMIT 1`)).rows[0];
  const idp = (o) => o.id.replace(/^wp_/, "");
  console.log("Ofertas de prueba: " + activa.id + " (activa), " + inactiva.id + " (inactiva)\n");

  // ================================================ el 200 que no es el anuncio
  console.log("EL 200 QUE NO TRAE EL ANUNCIO — lo que mas daño puede hacer");
  for (const [eti, cuerpo] of [
    ["un interstitial con otro id", cuerpoDe("otra-cosa", false)],
    ["una pagina HTML de mantenimiento", "<html>En mantenimiento</html>"],
    ["un cuerpo vacio", ""],
    ["un JSON sin id", JSON.stringify({ mensaje: "ok" })],
  ]) {
    const v = veredicto(inactiva, { statusCode: 200, body: cuerpo });
    comprueba(eti + ": no resucita la oferta", !/is_active/.test(v.sql), "(" + v.veredicto + ")");
  }
  const vAct = veredicto(activa, { statusCode: 200, body: "<html>nada</html>" });
  comprueba("y tampoco toca una que estaba activa", !/is_active/.test(vAct.sql));
  comprueba("ni la marca como vista", !/last_seen_at/.test(vAct.sql));

  // ================================================ veredictos contra la base
  console.log("\nVEREDICTOS — contra la base real, con ROLLBACK");
  await c.query("BEGIN");
  try {
    // viva y disponible
    const v1 = veredicto(activa, { statusCode: 200, body: cuerpoDe(idp(activa), false) });
    comprueba("200 con el anuncio y sin reservar = viva", v1.veredicto === "viva");
    comprueba("no mueve updated_at si no ha cambiado nada", !/updated_at/.test(v1.sql));
    await c.query(v1.sql);
    let f = (await c.query(`SELECT is_active FROM moveadvisor_market_offers WHERE id=$1`,
      [activa.id])).rows[0];
    comprueba("sigue activa", f.is_active === true);

    // viva pero reservada
    const v2 = veredicto(activa, { statusCode: 200, body: cuerpoDe(idp(activa), true) });
    comprueba("200 con reserved.flag = reservada", v2.veredicto === "reservada");
    await c.query(v2.sql);
    f = (await c.query(`SELECT is_active FROM moveadvisor_market_offers WHERE id=$1`,
      [activa.id])).rows[0];
    comprueba("deja de constar como activa", f.is_active === false);
    comprueba("y mueve updated_at, porque el estado ha cambiado", /updated_at/.test(v2.sql));

    // resurreccion
    const v3 = veredicto(inactiva, { statusCode: 200, body: cuerpoDe(idp(inactiva), false) });
    await c.query(v3.sql);
    f = (await c.query(`SELECT is_active FROM moveadvisor_market_offers WHERE id=$1`,
      [inactiva.id])).rows[0];
    comprueba("una inactiva que reaparece disponible se resucita sola", f.is_active === true);

    // retirada
    const v4 = veredicto(activa, { statusCode: 404, body: "" });
    comprueba("404 = vendida", v4.veredicto === "vendida");
    await c.query(v4.sql);
    f = (await c.query(`SELECT is_active FROM moveadvisor_market_offers WHERE id=$1`,
      [activa.id])).rows[0];
    comprueba("la da de baja", f.is_active === false);

    // 404 sobre una que ya constaba inactiva: no se puede reescribir updated_at
    const v5 = veredicto(inactiva, { statusCode: 404, body: "" });
    comprueba("un 404 sobre una ya inactiva no toca updated_at", !/updated_at/.test(v5.sql));
    comprueba("  (si lo tocara, borraria la fecha real de la baja)", !/is_active/.test(v5.sql));
  } finally { await c.query("ROLLBACK"); }

  // ================================================ transitorios
  console.log("\nFALLOS PASAJEROS — no pueden dar de baja a nadie");
  for (const st of [429, 500, 502, 503, 0]) {
    const v = veredicto(activa, { statusCode: st, body: "" });
    comprueba("HTTP " + st + " no toca is_active", !/is_active/.test(v.sql) && v.veredicto === "transitoria");
  }

  await c.end();
  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
