const userSavedHandler = require("../lib/api/user-saved-handler");
const userAlertsHandler = require("../lib/api/user-alerts-handler");
const userPreferencesHandler = require("../lib/api/user-preferences-handler");
const attachmentFileHandler = require("../lib/api/attachment-file-handler");
const leadsHandler = require("../lib/api/leads-handler");
const vehiclePublishHandler = require("../lib/api/vehicle-publish-handler");
const viewingHandler = require("../lib/api/viewing-handler");
const funnelEventHandler = require("../lib/api/funnel-event-handler");
const cronAppointmentRemindersHandler = require("../lib/api/cron-appointment-reminders-handler");
const cronConditionReportReadyHandler = require("../lib/api/cron-condition-report-ready-handler");
const cronAlertCheckHandler = require("../lib/api/cron-alert-check-handler");
const storagePresignHandler = require("../lib/api/storage-presign-handler");

module.exports.config = { api: { bodyParser: { sizeLimit: "20mb" } } };

function resolveRoute(req) {
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) {
    return explicitRoute;
  }

  const url = String(req.url || "").toLowerCase();
  if (url.includes("user-saved")) return "saved";
  if (url.includes("user-alerts")) return "alerts";
  if (url.includes("user-preferences")) return "preferences";
  if (url.includes("attachment-file")) return "attachment-file";
  if (url.includes("vehicle-publish")) return "vehicle-publish";
  if (url.includes("leads")) return "leads";
  if (url.includes("viewing-request")) return "viewing-request";
  if (url.includes("viewing-propose")) return "viewing-propose";
  if (url.includes("viewing-confirm")) return "viewing-confirm";
  if (url.includes("viewing-get"))     return "viewing-get";
  if (url.includes("funnel-event"))    return "funnel-event";
  if (url.includes("cron-appointment-reminders")) return "cron-appointment-reminders";
  if (url.includes("cron-alert-check"))           return "cron-alert-check";
  if (url.includes("cron-condition-report-ready")) return "cron-condition-report-ready";
  return "";
}

// Las tres tareas programadas están declaradas en vercel.json, y ese fichero
// viaja con el repositorio: cualquier despliegue que lo lleve las ejecuta. Hoy
// hay un solo proyecto, así que corren por omisión. El interruptor existe para
// el día que haya un segundo despliegue contra la misma base — dos recordatorios
// por cita y dos correos con el mismo informe—: allí se pone CRON_ACTIVO=0 y se
// calla.
//
// Apagado por omisión sería peor: al fusionar esta rama, producción se quedaría
// sin la variable y los avisos dejarían de enviarse sin dar ningún error.
const RUTAS_CRON = new Set([
  "cron-appointment-reminders",
  "cron-alert-check",
  "cron-condition-report-ready",
]);

module.exports = async function userRouter(req, res) {
  const ruta = resolveRoute(req);

  if (RUTAS_CRON.has(ruta) && process.env.CRON_ACTIVO === "0") {
    return res.status(204).end();
  }

  switch (ruta) {
    case "saved":
      return userSavedHandler(req, res);
    case "alerts":
      return userAlertsHandler(req, res);
    case "preferences":
      return userPreferencesHandler(req, res);
    case "attachment-file":
      return attachmentFileHandler(req, res);
    case "vehicle-publish":
      return vehiclePublishHandler(req, res);
    case "leads":
      return leadsHandler(req, res);
    case "viewing-request":
    case "viewing-propose":
    case "viewing-confirm":
    case "viewing-get":
      return viewingHandler(req, res);
    case "funnel-event":
      return funnelEventHandler(req, res);
    case "cron-appointment-reminders":
      return cronAppointmentRemindersHandler(req, res);
    case "cron-alert-check":
      return cronAlertCheckHandler(req, res);
    case "cron-condition-report-ready":
      return cronConditionReportReadyHandler(req, res);
    case "storage-presign":
      return storagePresignHandler(req, res);
    default:
      return res.status(404).json({ error: "User route not found" });
  }
};