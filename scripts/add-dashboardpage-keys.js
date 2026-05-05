const fs = require("fs");
const path = require("path");

const enPath = path.join(__dirname, "..", "src", "locales", "en.json");
const esPath = path.join(__dirname, "..", "src", "locales", "es.json");

const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const es = JSON.parse(fs.readFileSync(esPath, "utf8"));

// Missing dashboardPage keys
const enNew = {
  alertsLabel: "Alerts",
  alertsTitle: "Market alerts",
  alertsDescription: "Monitor your alerts and review new matches in the marketplace.",
  preferencesLabel: "Preferences",
  preferencesTitle: "Account preferences",
  preferencesDescription: "Set language, region and panel notifications.",
  greeting: "Good morning, {{name}}",
};
const esNew = {
  alertsLabel: "Alertas",
  alertsTitle: "Alertas de mercado",
  alertsDescription: "Controla tus alertas y revisa coincidencias nuevas en el marketplace.",
  preferencesLabel: "Preferencias",
  preferencesTitle: "Preferencias de cuenta",
  preferencesDescription: "Configura idioma, región y avisos del panel.",
  greeting: "Buenos días, {{name}}",
};

Object.assign(en.dashboardPage, enNew);
Object.assign(es.dashboardPage, esNew);

fs.writeFileSync(enPath, JSON.stringify(en, null, 2), "utf8");
fs.writeFileSync(esPath, JSON.stringify(es, null, 2), "utf8");
console.log("Done. Added", Object.keys(enNew).length, "keys to dashboardPage.");
