/**
 * Limpia la base de n8n: borra los fantasmas y compacta el fichero.
 *
 *   npm run limpia-n8n            (solo mira)
 *   npm run limpia-n8n -- --hazlo
 *
 * **CON n8n PARADO.** El script se niega a escribir si detecta que está
 * escuchando en el 5678: SQLite deja tocar el fichero con otro proceso dentro
 * y el resultado es una base corrupta.
 *
 * ── Los fantasmas ─────────────────────────────────────────────────────────
 *
 * n8n poda las ejecuciones TERMINADAS a las 24 horas -EXECUTIONS_DATA_PRUNE
 * con MAX_AGE=24- pero **nunca toca las que se quedaron en `new`**: las que se
 * encolaron y no llegaron a arrancar porque n8n se cayó antes.
 *
 * El 30-sep-2026 había 171 acumuladas desde el 24 de septiembre, contra 25
 * ejecuciones buenas del día. Se acumulan para siempre y engañan al mirar:
 * leyendo la tabla parecía que el 28 de septiembre no había arrancado ni una
 * de las 70 programadas, cuando ese día se raspó más que ningún otro -37.061
 * ofertas-. Lo que pasaba es que los éxitos ya estaban podados y los
 * fantasmas no.
 *
 * ── Por qué hace falta el VACUUM ──────────────────────────────────────────
 *
 * Porque en SQLite borrar filas NO encoge el fichero: deja el hueco marcado
 * como libre dentro. La base estaba en 885 MB con 25 ejecuciones vivas, más
 * 351 MB de diario sin consolidar.
 *
 * Y eso se paga en el arranque: n8n tarda tres minutos en levantarse porque
 * tiene que recuperar ese diario. La última limpieza, el 9-sep-2026, la dejó
 * en 2,7 MB.
 *
 * Unas pocas ejecuciones pesan cientos de MB -una pasada del scraper de VIAN
 * son 347 MB-, así que podar por número no basta: con que queden tres gordas,
 * el fichero vuelve a estar en un giga.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const { DatabaseSync } = require("node:sqlite");

const DB = path.join(require("os").homedir(), ".n8n", "database.sqlite");
const HAZLO = process.argv.includes("--hazlo");

/*
 * ── `--con-parada`: para n8n, limpia y lo vuelve a levantar ────────────────
 *
 * Es el modo para la tarea de las 03:00. Los workflows corren de 08:00 a
 * 00:00, así que a esa hora no se interrumpe nada.
 *
 * EL ARRANQUE VA EN UN `finally`, y no es paranoia: si algo falla a mitad,
 * n8n se queda parado y nadie se entera. Ya pasó en agosto -quince días sin
 * raspar hasta que alguien lo miró por casualidad- y por eso existe el aviso
 * diario de lib/vigila-scrapers.js. Una tarea automática que pueda dejar el
 * sistema apagado tiene que encenderlo sí o sí.
 *
 * Y NO SE HACE SIN `--hazlo`: parar n8n para luego no limpiar nada sería lo
 * peor de los dos mundos.
 */
const CON_PARADA = process.argv.includes("--con-parada");
const mb = (f) => (fs.existsSync(f) ? (fs.statSync(f).size / 1048576).toFixed(0) : "0");
const mil = (n) => Number(n).toLocaleString("es");

/** Que n8n no esté escuchando. Tocar el fichero con él dentro lo corrompe. */
function n8nParado() {
  try {
    const salida = execSync(
      'powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5678 -State Listen '
      + '-ErrorAction SilentlyContinue) { \'vivo\' } else { \'parado\' }"',
      { encoding: "utf8", timeout: 20000 });
    return /parado/.test(salida);
  } catch {
    return false;   // si no se puede saber, se asume que está vivo
  }
}

const ps = (cmd) => execSync('powershell -NoProfile -Command "' + cmd.replace(/"/g, '\\"') + '"',
  { encoding: "utf8", timeout: 60000 });

/*
 * ── El freno de mano ──────────────────────────────────────────────────────
 *
 * scripts/vigila-n8n.js corre en pm2 cada cinco minutos y levanta n8n si no
 * responde. Sin avisarle, nos lo levantaría por debajo justo mientras
 * compactamos, con el fichero abierto por los dos: base corrupta.
 *
 * El fichero se borra en un `finally`, así que se quita aunque esto reviente
 * a mitad. Si se quedara puesto, el guardián dejaría de vigilar en silencio,
 * que es peor que no tenerlo.
 */
const FRENO = path.join(require("os").homedir(), ".n8n", "no-me-levantes");
const ponFreno = () => fs.writeFileSync(FRENO,
  "Lo puso scripts/limpia-n8n.js el " + new Date().toISOString()
  + "\nMientras exista, scripts/vigila-n8n.js no levanta n8n.\n");
const quitaFreno = () => { try { fs.unlinkSync(FRENO); } catch { /* ya no estaba */ } };

/** Para n8n, su cmd y su task runner. Devuelve si había algo que parar. */
function paraN8n() {
  const antes = n8nParado();
  if (antes) { console.log("      n8n ya estaba parado"); return false; }
  ps("Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | "
    + "Where-Object { $_.CommandLine -like '*n8n\\bin\\n8n*' -or $_.CommandLine -like '*task-runner*' } | "
    + "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; "
    + "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | "
    + "Where-Object { $_.CommandLine -like '*n8n start*' } | "
    + "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }");
  for (let i = 0; i < 20 && !n8nParado(); i++) execSync("ping -n 2 127.0.0.1 > nul", { shell: true });
  console.log("      n8n parado: " + (n8nParado() ? "sí" : "NO, sigue escuchando"));
  return true;
}

/**
 * Lo levanta. Con el límite de concurrencia, que no se hereda de la sesión.
 *
 * DESPRENDIDO, y no con execSync: éste espera a que se cierren las tuberías
 * de salida del hijo, y el n8n recién arrancado las hereda y no las cierra
 * nunca. El guardián se quedaba colgado hasta agotar el tiempo -«spawnSync
 * cmd.exe ETIMEDOUT»- sin llegar a hacer nada.
 */
function levantaN8n() {
  console.log("\n  LEVANTANDO n8n");
  spawnSync("powershell", ["-NoProfile", "-Command",
    "$env:N8N_CONCURRENCY_PRODUCTION_LIMIT = '3'; "
    + "Start-Process cmd.exe -ArgumentList '/c','n8n start' -WorkingDirectory $env:USERPROFILE "
    + "-RedirectStandardOutput \"$env:USERPROFILE\\.n8n\\arranque.log\" "
    + "-RedirectStandardError \"$env:USERPROFILE\\.n8n\\arranque.err.log\" -WindowStyle Hidden"],
  /*
   * `stdio: "ignore"` es la pieza: sin tuberias que capturar no hay nada
   * que esperar, y spawnSync vuelve en cuanto Start-Process ha lanzado. Con
   * execSync se quedaba colgado -el n8n nuevo hereda las tuberias y no las
   * cierra nunca- y con spawn desprendido moria con el padre, que termina en
   * decimas.
   */
  { stdio: "ignore", windowsHide: true, timeout: 30000 });
  /* Tarda entre uno y dos minutos en registrar los 53 triggers. */
  for (let i = 0; i < 60; i++) {
    execSync("ping -n 4 127.0.0.1 > nul", { shell: true });
    if (!n8nParado()) { console.log("      escuchando tras " + ((i + 1) * 3) + " s"); return true; }
  }
  console.log("      NO HA LEVANTADO en 180 s");
  return false;
}

/** Lo que hay dentro, para el parte. Solo lee. */
function mira() {
  const d = new DatabaseSync(DB, { readOnly: true });
  const estados = d.prepare(
    `SELECT status, count(*) n, min(substr(createdAt,1,10)) desde
       FROM execution_entity GROUP BY 1 ORDER BY n DESC`).all();
  const fantasmas = d.prepare(
    "SELECT count(*) c FROM execution_entity WHERE startedAt IS NULL").get().c;
  const corriendo = d.prepare(
    "SELECT count(*) c FROM execution_entity WHERE status = 'running'").get().c;
  d.close();
  return { estados, fantasmas, corriendo };
}

/** Borra los fantasmas y compacta. Exige que nadie tenga el fichero abierto. */
function limpia() {
  const d = new DatabaseSync(DB);
  const fantasmas = d.prepare("DELETE FROM execution_entity WHERE startedAt IS NULL").run().changes;
  /*
   * Las marcadas 'running' con n8n parado también son mentira: nadie las está
   * ejecutando. Si no se limpian se quedan así para siempre, y son las que
   * hacen creer que hay trabajo en marcha cuando no lo hay.
   */
  const zombis = d.prepare("DELETE FROM execution_entity WHERE status = 'running'").run().changes;
  d.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  d.exec("VACUUM");
  d.close();
  return { fantasmas, zombis };
}

(async () => {
  console.log("\n  LA BASE DE n8n");
  console.log("      database.sqlite      " + mb(DB).padStart(6) + " MB");
  console.log("      database.sqlite-wal  " + mb(DB + "-wal").padStart(6) + " MB   (el diario)");

  const antes = mira();
  console.log("\n  LO QUE HAY DENTRO");
  for (const x of antes.estados) {
    console.log("      " + String(x.status).padEnd(12) + String(x.n).padStart(6)
      + "   desde " + x.desde);
  }
  console.log("\n      fantasmas (encoladas y nunca arrancadas): " + mil(antes.fantasmas));
  console.log("      en marcha                               : " + mil(antes.corriendo));

  if (!HAZLO) {
    console.log("\n  NO SE HA TOCADO NADA. Para hacerlo, CON n8n PARADO:");
    console.log("      npm run limpia-n8n -- --hazlo");
    console.log("  O que lo pare y lo levante él mismo:");
    console.log("      npm run limpia-n8n -- --hazlo --con-parada\n");
    return;
  }

  let loHeParado = false;
  if (!n8nParado()) {
    if (!CON_PARADA) {
      console.log("\n  n8n SIGUE ESCUCHANDO EN EL 5678. No se toca nada.");
      console.log("      Tocar el fichero con n8n dentro corrompe la base.");
      console.log("      Para que lo pare él mismo: --hazlo --con-parada\n");
      process.exit(1);
    }
    if (antes.corriendo) {
      /*
       * Con n8n vivo, 'running' significa que de verdad está trabajando. No
       * se le corta una pasada a medias: se vuelve en la siguiente vuelta.
       */
      console.log("\n  HAY " + antes.corriendo + " EJECUCIONES EN MARCHA. No se para nada.");
      console.log("      Esto corre a las 03:00, cuando no debería haber ninguna.\n");
      process.exit(1);
    }
    console.log("\n  PARANDO n8n");
    ponFreno();
    console.log("      freno de mano puesto: el guardián no lo levantará");
    loHeParado = paraN8n();
    if (!n8nParado()) {
      console.log("      no se ha podido parar; no se toca la base\n");
      quitaFreno();
      process.exit(1);
    }
  }

  /*
   * A partir de aquí n8n está parado por nuestra culpa, así que pase lo que
   * pase hay que volver a levantarlo. Un fallo a mitad que deje el sistema
   * apagado es peor que la base gorda: en agosto estuvo quince días sin
   * raspar y nadie se enteró.
   */
  try {
    console.log("\n  LIMPIANDO");
    const t0 = Date.now();
    const { fantasmas, zombis } = limpia();
    console.log("      fantasmas borrados      : " + mil(fantasmas));
    console.log("      'running' que no corrían: " + mil(zombis));
    console.log("      compactado en " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
    console.log("\n  DESPUÉS");
    console.log("      database.sqlite      " + mb(DB).padStart(6) + " MB");
    console.log("      database.sqlite-wal  " + mb(DB + "-wal").padStart(6) + " MB");
  } finally {
    if (loHeParado) {
      if (!levantaN8n()) {
        console.error("\n  n8n NO HA VUELTO A LEVANTAR. Hay que mirarlo a mano.\n");
        process.exitCode = 1;
      }
    }
    /*
     * El freno se quita SIEMPRE, también si lo de arriba ha fallado. Dejarlo
     * puesto apagaría el guardián en silencio, y un guardián que no vigila y
     * no lo dice es peor que no tenerlo.
     */
    quitaFreno();
  }
  console.log("");
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
