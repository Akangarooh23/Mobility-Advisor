/**
 * La puerta del usuario: su panel, sus papeles y las cinco tareas programadas.
 *
 * El reparto lo hace `lib/api/enrutador.js`, el mismo de las otras dos puertas.
 * Aquí quedan la tabla de rutas, los alias y lo único propio de esta puerta:
 * el interruptor de los crons.
 */
/*
 * Aquí había esto, y no hacía nada:
 *
 *     module.exports.config = { api: { bodyParser: { sizeLimit: "20mb" } } };
 *
 * Dos veces nada, de hecho. Primero porque estaba antes de la asignación del
 * enrutador, y `module.exports = ...` reemplaza el objeto entero: al terminar
 * de cargarse el fichero, `module.exports.config` era `undefined`.
 *
 * Y segundo porque, aunque hubiera estado bien puesta, tampoco. Esa forma
 * -`config.api.bodyParser`- es de las rutas de API de Next.js, y esto no es
 * Next.js: son funciones sueltas de Vercel sobre Create React App. El tope del
 * cuerpo de una función lo pone la plataforma y no se sube desde el código.
 *
 * Lo que de verdad resuelve el problema ya está hecho y está aquí al lado: los
 * ficheros grandes no viajan en el cuerpo de la petición. Se pide una URL
 * firmada por `storage-presign` y el navegador sube directo al depósito.
 */
const { creaEnrutador } = require("../lib/api/enrutador");

/** Sin `?route=`, se mira la URL. El orden manda: gana el primero que encaja. */
const ALIAS = [
  ["user-saved", "saved"],
  ["user-alerts", "alerts"],
  ["user-preferences", "preferences"],
  ["attachment-file", "attachment-file"],
  ["vehicle-publish", "vehicle-publish"],
  ["leads", "leads"],
  ["viewing-request", "viewing-request"],
  ["viewing-propose", "viewing-propose"],
  ["viewing-confirm", "viewing-confirm"],
  ["viewing-get", "viewing-get"],
  ["funnel-event", "funnel-event"],
  ["error", "error"],
  ["cron-appointment-reminders", "cron-appointment-reminders"],
  ["cron-alert-check", "cron-alert-check"],
  ["cron-condition-report-ready", "cron-condition-report-ready"],
  ["cron-vigila-scrapers", "cron-vigila-scrapers"],
  ["cron-avisa-de-los-fallos", "cron-avisa-de-los-fallos"],
  ["cron-facetas-buscador", "cron-facetas-buscador"],
  ["push-device", "push-device"],
  ["papel-del-coche", "papel-del-coche"],
];

const RUTAS = {
  saved:       () => require("../lib/api/user-saved-handler"),
  alerts:      () => require("../lib/api/user-alerts-handler"),
  preferences: () => require("../lib/api/user-preferences-handler"),
  "attachment-file":  () => require("../lib/api/attachment-file-handler"),
  "vehicle-publish":  () => require("../lib/api/vehicle-publish-handler"),
  leads:              () => require("../lib/api/leads-handler"),
  // Las cuatro etapas de una visita las atiende el mismo manejador: mira la
  // ruta por dentro para saber en cuál está.
  "viewing-request": () => require("../lib/api/viewing-handler"),
  "viewing-propose": () => require("../lib/api/viewing-handler"),
  "viewing-confirm": () => require("../lib/api/viewing-handler"),
  "viewing-get":     () => require("../lib/api/viewing-handler"),
  "funnel-event":    () => require("../lib/api/funnel-event-handler"),
  // Los fallos del navegador: lo unico de lo que no habia forma de enterarse.
  error:             () => require("../lib/api/error-del-navegador-handler"),
  "cron-appointment-reminders":  () => require("../lib/api/cron-appointment-reminders-handler"),
  "cron-alert-check":            () => require("../lib/api/cron-alert-check-handler"),
  "cron-condition-report-ready": () => require("../lib/api/cron-condition-report-ready-handler"),
  "cron-facetas-buscador":       () => require("../lib/api/cron-facetas-buscador-handler"),
  "cron-vigila-scrapers":        () => require("../lib/api/cron-vigila-scrapers-handler"),
  "cron-avisa-de-los-fallos":    () => require("../lib/api/cron-avisa-de-los-fallos-handler"),
  "storage-presign": () => require("../lib/api/storage-presign-handler"),
  "push-device":     () => require("../lib/api/push-device-handler"),
  "papel-del-coche": () => require("../lib/api/papel-del-coche-handler"),
};

// Las tareas programadas están declaradas en vercel.json, y ese fichero viaja
// con el repositorio: cualquier despliegue que lo lleve las ejecuta. Hoy hay un
// solo proyecto, así que corren por omisión. El interruptor existe para el día
// que haya un segundo despliegue contra la misma base — dos recordatorios por
// cita y dos correos con el mismo informe—: allí se pone CRON_ACTIVO=0 y se
// calla.
//
// Apagado por omisión sería peor: al fusionar esta rama, producción se quedaría
// sin la variable y los avisos dejarían de enviarse sin dar ningún error.
const RUTAS_CRON = new Set([
  "cron-appointment-reminders",
  "cron-alert-check",
  "cron-condition-report-ready",
  "cron-vigila-scrapers",
  "cron-facetas-buscador",
  "cron-avisa-de-los-fallos",
]);

module.exports = creaEnrutador({
  rutas: RUTAS,
  alias: ALIAS,
  noEncontrada: "User route not found",
  antesDeDespachar: (ruta, req, res) => {
    if (RUTAS_CRON.has(ruta) && process.env.CRON_ACTIVO === "0") {
      return res.status(204).end();
    }
    return undefined;
  },
});
