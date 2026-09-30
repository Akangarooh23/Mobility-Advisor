/**
 * Que n8n esté vivo, y si no, levantarlo.
 *
 *   npm run vigila-n8n              (mira y deja el latido, no levanta)
 *   npm run vigila-n8n -- --levanta
 *
 * En pm2 corre con `--levanta` cada cinco minutos. Ver ecosystem.config.js.
 *
 * ── Por qué levantar y no solo avisar ──────────────────────────────────────
 *
 * Un aviso convierte una parada de dos días en una parada de dos días que
 * además sabes. Levantarlo la convierte en una de cinco minutos.
 *
 * n8n se cayó tres veces la semana del 24 al 30 de septiembre de 2026 y las
 * tres se descubrieron por casualidad. Entre el 28 y el 29 dejó 157
 * ejecuciones encoladas que no arrancaron nunca, y el verificador de wallapop
 * perdió trece pasadas seguidas.
 *
 * ── Los tres frenos, y por qué cada uno ────────────────────────────────────
 *
 * 1. ARRANCAR TARDA. n8n necesita entre 60 y 100 segundos en registrar sus 53
 *    triggers y empezar a escuchar. Si el guardián solo mirase el puerto,
 *    encontraría a n8n arrancando, lo daría por muerto y lanzaría otro encima.
 *    Dos n8n sobre la misma base son el doble de crones. Así que antes de
 *    levantar nada se comprueba si ya hay un PROCESO de n8n, aunque todavía no
 *    escuche.
 *
 * 2. NO INSISTIR EN VANO. Si n8n no arranca por un motivo de fondo -la base
 *    corrupta, el puerto ocupado por otra cosa- reintentarlo cada cinco
 *    minutos para siempre no lo arregla y llena la máquina de intentos. Se
 *    para después de MAX_INTENTOS en una hora y se deja constancia.
 *
 * 3. EL FRENO DE MANO. scripts/limpia-n8n.js para n8n a propósito para
 *    compactar la base. Sin esto, el guardián se lo levantaría por debajo a
 *    mitad de la operación, con el fichero abierto por los dos: base corrupta.
 *    La limpieza deja un fichero y el guardián no toca nada mientras exista.
 *
 * ── Lo que este guardián NO puede cubrir ───────────────────────────────────
 *
 * Que la máquina entera esté apagada: si no hay máquina, no hay guardián. Por
 * eso cada pasada deja su latido en `moveadvisor_latidos_n8n`, y desde fuera
 * se puede ver que el último es de hace tres horas. Ver la migración 0019.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");
const { Client } = require("pg");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const LEVANTA = process.argv.includes("--levanta");

/** El freno de mano que pone la limpieza. Ver scripts/limpia-n8n.js. */
const FRENO = path.join(os.homedir(), ".n8n", "no-me-levantes");

/** Cuántas veces se intenta levantarlo en una hora antes de rendirse. */
const MAX_INTENTOS = 3;

const ps = (cmd) => execSync('powershell -NoProfile -Command "' + cmd.replace(/"/g, '\\"') + '"',
  { encoding: "utf8", timeout: 60000 });

/** ¿Responde en el 5678? */
function escucha() {
  try {
    return /si/.test(ps("if (Get-NetTCPConnection -LocalPort 5678 -State Listen "
      + "-ErrorAction SilentlyContinue) { 'si' } else { 'no' }"));
  } catch {
    return false;
  }
}

/**
 * ¿Hay un proceso de n8n, aunque todavía no escuche?
 *
 * Esta es la diferencia entre «está muerto» y «está arrancando», y sin ella
 * el guardián lanza un segundo n8n cada cinco minutos mientras el primero
 * tarda su minuto y medio en levantarse.
 */
function hayProceso() {
  try {
    /*
     * El `@()` no es adorno. En PowerShell 5.1 una colección de UN elemento
     * se degrada al elemento, y `.Count` sobre él devuelve vacío en vez de 1.
     * Con exactamente un n8n arrancando -el caso normal- esta función
     * devolvía falso y el guardián lo daba por muerto.
     */
    const n = ps("@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | "
      + "Where-Object { $_.CommandLine -like '*n8n\\bin\\n8n*' }).Count").trim();
    return Number(n) > 0;
  } catch {
    return false;   // si no se puede saber, se asume que sí: no lanzar otro
  }
}

/*
 * Se lanza DESPRENDIDO, y no con execSync como el resto de comandos.
 *
 * `execSync` espera a que se cierren las tuberías de salida del hijo, y el
 * n8n recién arrancado las hereda y no las cierra nunca: el guardián se
 * quedaba colgado hasta agotar el tiempo -«spawnSync cmd.exe ETIMEDOUT»- y no
 * llegaba ni a apuntar el latido. Con `detached` y `stdio: ignore` no hay
 * tuberías que esperar, y `unref()` deja que este proceso termine mientras
 * n8n sigue arrancando por su cuenta.
 */
function levanta() {
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
}

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 60000 });
  await c.connect();

  const apunta = async (vivo, actuo, detalle) => {
    await c.query(
      "INSERT INTO moveadvisor_latidos_n8n (vivo, actuo, detalle) VALUES ($1, $2, $3)",
      [vivo, actuo, detalle]);
    console.log("  " + new Date().toLocaleTimeString("es")
      + "   " + (vivo ? "vivo" : "CAIDO") + (actuo ? "  -> levantado" : "")
      + (detalle ? "   " + detalle : ""));
  };

  try {
    if (fs.existsSync(FRENO)) {
      await apunta(escucha(), false, "freno de mano puesto: alguien lo ha parado a proposito");
      return;
    }

    if (escucha()) {
      await apunta(true, false, "");
      return;
    }

    /* No escucha. ¿Está arrancando o está muerto? */
    if (hayProceso()) {
      await apunta(false, false, "hay proceso pero aun no escucha: arrancando");
      return;
    }

    if (!LEVANTA) {
      await apunta(false, false, "caido (sin --levanta no se toca)");
      return;
    }

    /*
     * ── El tiempo de espera, que es lo que evita dos n8n ─────────────────
     *
     * `hayProceso()` no basta. Entre lanzar el arranque y que aparezca el
     * proceso de node pasan unos segundos -PowerShell encadena hasta cmd y
     * cmd hasta n8n-, y en esa ventana el guardián ve cero procesos y el
     * puerto libre. Probado: dos pasadas con tres segundos de diferencia
     * lanzaron DOS n8n, que es exactamente lo que esto existe para no hacer.
     *
     * Así que si ya se intentó hace poco, se deja arrancar. Cinco minutos
     * cubren de sobra los 60-100 segundos que tarda en escuchar.
     */
    const reciente = (await c.query(
      `SELECT count(*)::int n FROM moveadvisor_latidos_n8n
        WHERE actuo AND momento > now() - interval '5 minutes'`)).rows[0].n;
    if (reciente) {
      await apunta(false, false, "ya se lanzo hace menos de 5 min: dejandolo arrancar");
      return;
    }

    /*
     * Cuántas veces se ha intentado en la última hora. Si n8n no arranca por
     * un motivo de fondo, insistir cada cinco minutos no lo arregla.
     */
    const intentos = (await c.query(
      `SELECT count(*)::int n FROM moveadvisor_latidos_n8n
        WHERE actuo AND momento > now() - interval '1 hour'`)).rows[0].n;
    if (intentos >= MAX_INTENTOS) {
      await apunta(false, false,
        "ya se ha intentado " + intentos + " veces en una hora: no arranca solo, hay que mirarlo");
      return;
    }

    levanta();
    await apunta(false, true, "intento " + (intentos + 1) + " de " + MAX_INTENTOS);
  } finally {
    /*
     * La poda. Son 288 latidos al día y pasado un mes no dicen nada; sin esto
     * seria otra tabla que crece sola y que hay que limpiar a mano algun dia.
     */
    await c.query("DELETE FROM moveadvisor_latidos_n8n WHERE momento < now() - interval '30 days'");
    await c.end();
  }
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
