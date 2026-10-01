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

/**
 * Cuánto se respeta el freno de mano antes de pasar de él.
 *
 * Sin caducidad, ese fichero es un interruptor de apagado permanente. La limpieza
 * lo borra en un `finally`, que cubre una excepción pero **no** que el proceso
 * muera de golpe: un Ctrl-C, un reinicio, un corte de luz o un `kill` entre el
 * `ponFreno()` y el `finally`. Y la limpieza corre a las 03:00 sin nadie delante,
 * que es justo cuando un reinicio no lo ve nadie.
 *
 * Si eso pasa: n8n apagado, el guardián viéndolo apagado cada cinco minutos y
 * decidiendo no tocarlo, y el latido diciendo «alguien lo ha parado a propósito»
 * —que es lo que cualquiera leería como normal—. Un fichero de cero bytes apagando
 * los 52 flujos indefinidamente.
 *
 * Media hora es de sobra: la limpieza entera tarda minutos.
 */
const FRENO_CADUCA_EN_MINUTOS = 30;

/**
 * ¿Hay que respetar el freno de mano?
 *
 * Tres respuestas, no dos: no está, está y vale, o está y ha caducado. La tercera
 * es la que faltaba.
 */
function elFreno() {
  let stat;
  try { stat = fs.statSync(FRENO); } catch { return { puesto: false }; }

  const minutos = Math.round((Date.now() - stat.mtimeMs) / 60000);
  if (minutos > FRENO_CADUCA_EN_MINUTOS) {
    return { puesto: false, caducado: true, minutos };
  }

  let quien = "";
  try { quien = fs.readFileSync(FRENO, "utf8").trim().slice(0, 120); } catch { /* da igual */ }
  return { puesto: true, minutos, quien };
}

/** Cuántas veces se intenta levantarlo en una hora antes de rendirse. */
const MAX_INTENTOS = 3;

/**
 * Los intentos, en un fichero local y no en Postgres.
 *
 * ## Por qué se movieron
 *
 * El enfriamiento —«¿se intentó hace menos de cinco minutos?»— y la cuenta de
 * intentos por hora se consultaban con dos `SELECT` a Postgres, y el `connect()`
 * estaba **fuera de todo `try`**. O sea que si Neon no contestaba —o cambiaba la
 * contraseña, o se iba la red— este guion salía con 1 y **n8n se quedaba caído**.
 *
 * Eso es la dependencia al revés: un vigilante de n8n no puede necesitar que
 * Postgres esté bien para poder reiniciar n8n. Y una parada de n8n y un problema de
 * base no son sucesos independientes: comparten máquina y comparten red.
 *
 * ## Qué sigue en Postgres
 *
 * El latido, que es un **registro** y no una condición: sirve para ver desde fuera
 * —desde Vercel, donde corren los avisos— que esta máquina sigue encendida. Si no
 * se puede escribir, se dice y se sigue; levantar n8n no depende de ello.
 */
const LOS_INTENTOS = path.join(os.homedir(), ".n8n", "ultimos-intentos.json");

/** Los intentos de la última hora, y de paso se tira lo viejo. */
function losIntentos() {
  let lista = [];
  try { lista = JSON.parse(fs.readFileSync(LOS_INTENTOS, "utf8")); } catch { lista = []; }
  if (!Array.isArray(lista)) lista = [];
  const desde = Date.now() - 60 * 60 * 1000;
  return lista.map(Number).filter((n) => Number.isFinite(n) && n >= desde);
}

function apuntaElIntento() {
  const lista = [...losIntentos(), Date.now()];
  try {
    fs.mkdirSync(path.dirname(LOS_INTENTOS), { recursive: true });
    fs.writeFileSync(LOS_INTENTOS, JSON.stringify(lista));
  } catch (e) {
    // Si no se puede escribir, se sigue: perder la cuenta es menos grave que no
    // levantar n8n. Lo que no se puede es callarlo.
    console.error("  no he podido apuntar el intento: " + e.message);
  }
}

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

/**
 * La base, si se puede. Y si no, se sigue.
 *
 * Devuelve `null` cuando no se puede conectar, y lo dice por el registro. El
 * guardián funciona sin ella: lo único que se pierde es el latido.
 */
async function laBaseSiSePuede() {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 60000 });
  try {
    await c.connect();
    return c;
  } catch (e) {
    console.error("  sin base de datos (" + e.message + "): sigo sin apuntar el latido");
    try { await c.end(); } catch { /* ya estaba cerrada */ }
    return null;
  }
}

(async () => {
  const c = await laBaseSiSePuede();

  const apunta = async (vivo, actuo, detalle) => {
    if (!c) {
      console.log("  " + new Date().toLocaleTimeString("es")
        + "   " + (vivo ? "vivo" : "CAIDO") + (actuo ? "  -> levantado" : "")
        + (detalle ? "   " + detalle : "") + "   [sin apuntar: no hay base]");
      return;
    }
    await c.query(
      "INSERT INTO moveadvisor_latidos_n8n (vivo, actuo, detalle) VALUES ($1, $2, $3)",
      [vivo, actuo, detalle]);
    console.log("  " + new Date().toLocaleTimeString("es")
      + "   " + (vivo ? "vivo" : "CAIDO") + (actuo ? "  -> levantado" : "")
      + (detalle ? "   " + detalle : ""));
  };

  try {
    const freno = elFreno();
    if (freno.puesto) {
      await apunta(escucha(), false,
        "freno de mano puesto hace " + freno.minutos + " min"
        + (freno.quien ? ": " + freno.quien : ": alguien lo ha parado a proposito"));
      return;
    }
    if (freno.caducado) {
      // Caducado = la limpieza murió sin borrarlo. Se sigue como si no estuviera, y
      // se dice, porque significa que algo se cortó a medias.
      console.log("  el freno de mano lleva " + freno.minutos + " min puesto: caducado, sigo");
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
    const hace5min = Date.now() - 5 * 60 * 1000;
    const reciente = losIntentos().filter((n) => n > hace5min).length;
    if (reciente) {
      await apunta(false, false, "ya se lanzo hace menos de 5 min: dejandolo arrancar");
      return;
    }

    /*
     * Cuántas veces se ha intentado en la última hora. Si n8n no arranca por
     * un motivo de fondo, insistir cada cinco minutos no lo arregla.
     */
    const intentos = losIntentos().length;
    if (intentos >= MAX_INTENTOS) {
      await apunta(false, false,
        "ya se ha intentado " + intentos + " veces en una hora: no arranca solo, hay que mirarlo");
      return;
    }

    apuntaElIntento();
    levanta();
    await apunta(false, true, "intento " + (intentos + 1) + " de " + MAX_INTENTOS);
  } finally {
    /*
     * La poda. Son 288 latidos al día y pasado un mes no dicen nada; sin esto
     * seria otra tabla que crece sola y que hay que limpiar a mano algun dia.
     */
    if (c) {
      await c.query("DELETE FROM moveadvisor_latidos_n8n WHERE momento < now() - interval '30 days'");
      await c.end();
    }
  }
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
