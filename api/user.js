const userSavedHandler = require("../lib/api/user-saved-handler");
const userAlertsHandler = require("../lib/api/user-alerts-handler");
const userPreferencesHandler = require("../lib/api/user-preferences-handler");
const attachmentFileHandler = require("../lib/api/attachment-file-handler");
const leadsHandler = require("../lib/api/leads-handler");
const vehiclePublishHandler = require("../lib/api/vehicle-publish-handler");
const viewingHandler = require("../lib/api/viewing-handler");
const funnelEventHandler = require("../lib/api/funnel-event-handler");
const cronAppointmentRemindersHandler = require("../lib/api/cron-appointment-reminders-handler");

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
  return "";
}

module.exports = async function userRouter(req, res) {
  switch (resolveRoute(req)) {
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
    default:
      return res.status(404).json({ error: "User route not found" });
  }
};