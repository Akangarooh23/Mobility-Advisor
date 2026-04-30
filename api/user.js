const userSavedHandler = require("../lib/api/user-saved-handler");
const userAlertsHandler = require("../lib/api/user-alerts-handler");
const userPreferencesHandler = require("../lib/api/user-preferences-handler");
const attachmentFileHandler = require("../lib/api/attachment-file-handler");

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
    default:
      return res.status(404).json({ error: "User route not found" });
  }
};