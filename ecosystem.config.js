/**
 * Las tareas de mantenimiento nocturno, declaradas para pm2.
 *
 *   pm2 start ecosystem.config.js     (desde PowerShell COMO ADMINISTRADOR)
 *   pm2 save
 *
 * ── La mañana, y por qué en este orden ─────────────────────────────────────
 *
 *   07:00  carswise-provincias   normaliza `provincia` desde lo que trae cada portal
 *   07:30  carswise-duplicados   reconstruye la tabla de duplicados
 *   08:00  carswise-visibles     decide qué se le puede enseñar a un cliente
 *
 * Y aparte, cada cinco minutos: carswise-n8n-vivo, que comprueba que n8n
 * sigue en pie y lo levanta si no. Ver el bloque de abajo.
 *
 * El orden NO es estético: hay una dependencia real. `recalcula-visibles`
 * marca ofertas con el motivo `duplicada`, y ese motivo sale de la tabla que
 * reconstruye `agrupar-duplicados`. Si corriera antes, estaría decidiendo con
 * los duplicados de ayer.
 *
 * Y media hora entre cada una para que dos escrituras grandes no se peleen
 * sobre `moveadvisor_market_offers`: el 24-sep hubo un deadlock entre la
 * normalización y un verificador de n8n, que también escribe ahí.
 *
 * `carswise-duplicados` no está aquí porque se declaró a mano hace tiempo y
 * ya vive en `~/.pm2/dump.pm2`. Cuando haya que tocarlo, el sitio es éste.
 *
 * ── Por qué un fichero y no un comando ─────────────────────────────────────
 *
 * Porque el comando no se puede escribir en PowerShell. Los scripts necesitan
 * su bandera -`--aplica`- y en pm2 los argumentos del script van detrás de un
 * `--` que los separa de los suyos:
 *
 *     pm2 start ... -- --aplica
 *
 * PowerShell se come ese `--` -lo toma por suyo- y pm2 recibe `--aplica`
 * suelto: «unknown option». El `--%`, que es el token de PowerShell para dejar
 * de parsear, se pasa literal y falla igual. Aquí los argumentos son un array
 * y no los toca nadie.
 *
 * ── Las banderas que no son adorno ─────────────────────────────────────────
 *
 * `autorestart: false` — pm2 ve un script que termina y por defecto lo
 * relanza, en bucle, para siempre. Sin esto, un script de tres minutos se
 * convierte en un proceso que no para nunca.
 *
 * `--aplica` — sin ella los dos scripts solo CUENTAN y no escriben. Correrían
 * cada mañana, en verde, sin hacer nada. Después de instalarlo conviene
 * comprobarlo con `pm2 describe <nombre>` y ver la bandera ahí.
 *
 * ── Instalarlo necesita administrador ──────────────────────────────────────
 *
 * El demonio de pm2 lo arranca la tarea «Jarvis (pm2 resurrect)» con RunLevel
 * Highest. Desde una sesión normal, pm2 da `connect EPERM \\.\pipe\rpc.sock` e
 * intenta levantar un SEGUNDO demonio, que sería peor que no hacer nada: dos
 * listas de procesos y los crones corriendo dos veces.
 *
 * Y esa tarea NO hay que deshabilitarla aunque se llame Jarvis: es la que
 * restaura todo esto al arrancar Windows.
 */
"use strict";

const RAIZ = "C:/Users/Anapi/Projects/Mobility-Advisor";

/** Lo que comparten las dos: mismo repositorio, mismo .env, y no relanzar. */
const comun = {
  cwd: RAIZ,
  node_args: ["--env-file=.env.local"],
  autorestart: false,
  exec_mode: "fork",
};

module.exports = {
  apps: [
    {
      ...comun,
      name: "carswise-provincias",
      script: "scripts/normaliza-provincias.js",
      args: ["--aplica"],
      cron_restart: "0 7 * * *",
    },
    {
      /*
       * Va DESPUÉS del agrupador de las 07:30, no antes: el motivo
       * `duplicada` sale de la tabla que aquél reconstruye. Si corriera
       * antes, estaría decidiendo con los duplicados de ayer.
       *
       * Medido el 30-sep-2026 con la versión que hace un portal por
       * sentencia: 12 minutos y 4.913 filas cambiadas de 1,63 millones. El
       * cálculo es estable entre pasadas, así que una diaria no reescribe la
       * tabla entera cada noche.
       *
       * La primera versión, con lotes de 10.000 por cursor de id, tardaba
       * 5 h 40 min. Está contado en la cabecera del script.
       */
      ...comun,
      name: "carswise-visibles",
      script: "scripts/recalcula-visibles.js",
      args: ["--aplica"],
      cron_restart: "0 8 * * *",
    },
    {
      /*
       * ── El guardián de n8n ────────────────────────────────────────────
       *
       * n8n se cayó tres veces la semana del 24 al 30 de septiembre y las
       * tres se descubrieron por casualidad. Entre el 28 y el 29 dejó 157
       * ejecuciones encoladas sin arrancar, y el verificador de wallapop
       * perdió trece pasadas seguidas.
       *
       * Esto mira el puerto 5678 cada cinco minutos y lo levanta si no
       * responde: convierte una parada de dos días en una de cinco minutos.
       * El aviso que había -lib/vigila-scrapers.js- mira si ENTRA CATÁLOGO,
       * tarda dos días en decidirlo y comprueba una vez al día, así que una
       * parada de hasta cuarenta y ocho horas se le cuela entera.
       *
       * Cada pasada deja un latido en `moveadvisor_latidos_n8n`. Eso cubre
       * lo que el guardián no puede: si la máquina entera está apagada no
       * hay guardián, pero desde fuera se ve que el último latido es de hace
       * tres horas.
       *
       * Va a TODAS HORAS, también de madrugada: los workflows corren de
       * 08:00 a 00:00, pero n8n tiene que estar en pie antes de las ocho
       * para que el primer cron lo encuentre.
       */
      ...comun,
      name: "carswise-n8n-vivo",
      script: "scripts/vigila-n8n.js",
      args: ["--levanta"],
      cron_restart: "*/5 * * * *",
    },
  ],
};
