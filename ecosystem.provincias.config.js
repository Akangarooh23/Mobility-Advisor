/**
 * La normalización de provincias, declarada para pm2.
 *
 *   pm2 start ecosystem.provincias.config.js     (desde PowerShell COMO ADMINISTRADOR)
 *   pm2 save
 *
 * ── Por qué un fichero y no un comando ─────────────────────────────────────
 *
 * Porque el comando equivalente no se puede escribir en PowerShell. El script
 * necesita recibir `--aplica`, y en pm2 los argumentos del script van detrás
 * de un `--` que los separa de los suyos:
 *
 *     pm2 start ... -- --aplica
 *
 * PowerShell se come ese `--` -lo interpreta como suyo- y pm2 recibe
 * `--aplica` suelto: «unknown option». El `--%`, que es el token de
 * PowerShell para dejar de parsear, se pasa literal y falla igual. Aquí los
 * argumentos son un array y no los toca nadie.
 *
 * Y de paso queda en el repositorio, que es donde se puede leer y revisar. El
 * resto de procesos de pm2 se declararon a mano y solo existen en
 * `~/.pm2/dump.pm2`, que es un sitio donde nadie mira.
 *
 * ── Las tres cosas que no son adorno ───────────────────────────────────────
 *
 * `autorestart: false` — pm2 ve un script que termina y, por defecto, lo
 * relanza. En bucle, para siempre. El agrupador lo tiene puesto por lo mismo.
 *
 * `cron_restart` a las 07:00 — media hora antes que `carswise-duplicados`,
 * que corre a las 07:30. La provincia conviene tenerla puesta antes de que
 * nada más lea la tabla esa mañana, y separarlos evita que dos escrituras
 * grandes se peleen: el 24-sep hubo un deadlock entre esta normalización y un
 * verificador de n8n.
 *
 * `--aplica` — sin esta bandera el script solo cuenta y NO escribe. Correría
 * todas las mañanas, en verde, sin hacer nada. Después de instalarlo conviene
 * comprobarlo con `pm2 describe carswise-provincias` y ver la bandera ahí.
 *
 * ── Por qué hace falta que corra solo ──────────────────────────────────────
 *
 * El buscador filtra por la columna `provincia`, y una oferta recién raspada
 * la tiene a NULL hasta que pase esto. Mientras tanto no aparece si alguien
 * filtra por provincia. Entre el 24 y el 29 de septiembre se acumularon 67.572
 * así, por no haberlo lanzado. Con una pasada diaria son unas 13.000, que es
 * lo que entra al día, y tarda segundos.
 */
"use strict";

module.exports = {
  apps: [
    {
      name: "carswise-provincias",
      script: "scripts/normaliza-provincias.js",
      cwd: "C:/Users/Anapi/Projects/Mobility-Advisor",
      args: ["--aplica"],
      node_args: ["--env-file=.env.local"],
      autorestart: false,
      cron_restart: "0 7 * * *",
      exec_mode: "fork",
    },
  ],
};
