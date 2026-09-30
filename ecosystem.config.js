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
 *   08:00  (carswise-visibles)   decide qué se le puede enseñar -TODAVÍA NO, ver abajo-
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
    /*
     * ── `carswise-visibles` NO está aquí todavía, y es a propósito ─────────
     *
     * `recalcula-visibles` iría a las 08:00, después del agrupador de las
     * 07:30, porque el motivo `duplicada` sale de la tabla que aquél
     * reconstruye. Pero tal como está tarda demasiado para correr a diario.
     *
     * Medido el 29-sep-2026, la pasada completa con lotes de 10.000:
     * 5 h 40 min. Correría de las 08:00 a las 13:40 machacando la tabla, y la
     * segunda pasada no seria mas rapida: escribe poco, pero lee lo mismo.
     *
     * El motivo es el tamaño del lote. Recorrer por índice con LIMIT obliga a
     * ir a buscar cada fila por separado, y contra el almacenamiento remoto
     * de Neon eso es lentísimo: 124 s por cada 10.000 filas. La misma lectura
     * hecha de una sola vez, con barrido secuencial y en paralelo, tarda
     * 6 minutos para el millón y medio. Al partirlo en lotes gané que no
     * bloquea a los scrapers y perdí un factor de cincuenta.
     *
     * Antes de programarlo hay que medir dos salidas: lotes mucho más grandes
     * -100.000 o 200.000, que vuelven a permitir el barrido secuencial- o que
     * sea incremental y mire solo lo que ha cambiado desde la última pasada.
     *
     * Mientras tanto se lanza a mano:  npm run recalcula-visibles -- --aplica
     */
  ],
};
