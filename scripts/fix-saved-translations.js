const fs = require("fs");
const path = require("path");

// --- Add missing locale keys ---
const enPath = path.join(__dirname, "..", "src", "locales", "en.json");
const esPath = path.join(__dirname, "..", "src", "locales", "es.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const es = JSON.parse(fs.readFileSync(esPath, "utf8"));

const newEnKeys = {
  alertNoEmailHint: "Enable \"Send me an email summary\" when creating an alert to activate this button. {{email}}",
  alertEmailDigest: "📧 Email summary to {{email}}",
  alertNewMatches: "🔔 {{count}} new match",
  alertNewMatches_one: "🔔 {{count}} new match",
  alertNewMatches_other: "🔔 {{count}} new matches",
  alertNoNewMatches: "No pending matches",
  alertStatusActive: "Active",
};
const newEsKeys = {
  alertNoEmailHint: "Activa \"Enviarme también un resumen por email\" al crear una alerta para habilitar este botón. {{email}}",
  alertEmailDigest: "📧 Resumen por email a {{email}}",
  alertNewMatches: "🔔 {{count}} novedad",
  alertNewMatches_one: "🔔 {{count}} novedad",
  alertNewMatches_other: "🔔 {{count}} novedades",
  alertNoNewMatches: "Sin novedades pendientes",
  alertStatusActive: "Activa",
};

Object.assign(en.dashboard, newEnKeys);
Object.assign(es.dashboard, newEsKeys);
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), "utf8");
fs.writeFileSync(esPath, JSON.stringify(es, null, 2), "utf8");
console.log("Locale keys added.");

// --- Patch UserDashboardSaved.js ---
const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardSaved.js");
let s = fs.readFileSync(p, "utf8");

let count = 0;
function r(from, to) {
  if (!s.includes(from)) { console.warn("NOT FOUND:", from.substring(0, 60)); return; }
  s = s.replace(from, to);
  count++;
}

// Tabs
r(
  '{ key: "overview", label: "Resumen", count: null },',
  '{ key: "overview", label: t("dashboard.savedTabOverview"), count: null },'
);
r(
  '{ key: "saved", label: "Guardadas", count: savedComparisons.length },',
  '{ key: "saved", label: t("dashboard.savedTabSaved"), count: savedComparisons.length },'
);

// Section title
r(
  '>Tus comparativas y ofertas favoritas</div>',
  '>{t("dashboard.savedTitle")}</div>'
);

// Badges
r(
  '>{savedComparisons.length} guardadas</span>',
  '>{t("dashboard.savedBadge", { count: savedComparisons.length })}</span>'
);
r(
  '>{totalNewMatches} novedades marketplace</span>',
  '>{t("dashboard.savedNewsBadge", { count: totalNewMatches })}</span>'
);

// Stats
r(
  '["Guardadas", savedComparisons.length, "#60a5fa"],',
  '[t("dashboard.savedStatSaved"), savedComparisons.length, "#60a5fa"],'
);
r(
  '["Novedades", totalNewMatches, "#f59e0b"],',
  '[t("dashboard.savedStatNews"), totalNewMatches, "#f59e0b"],'
);

// Explore marketplace button
r(
  '              Explorar marketplace VO\n            </button>',
  '              {t("dashboard.savedExploreMarketplace")}\n            </button>'
);

// Catalog title
r(
  '>Gestiona el selector de marca/modelo</div>',
  '>{t("dashboard.savedCatalogTitle")}</div>'
);

// Email hint for digest
r(
  '            Activa <strong>"Enviarme también un resumen por email"</strong> al crear una alerta para habilitar este botón aquí mismo.\n            {normalizedCurrentUserEmail ? ` Usaremos tu cuenta ${normalizedCurrentUserEmail} como destinatario por defecto.` : ""}',
  '            {t("dashboard.alertNoEmailHint", { email: normalizedCurrentUserEmail ? `Usaremos tu cuenta ${normalizedCurrentUserEmail} como destinatario.` : "" })}'
);

// Email digest label on alert card
r(
  '                        📧 Resumen por email a {alertEmail}',
  '                        {t("dashboard.alertEmailDigest", { email: alertEmail })}'
);

// New matches badge
r(
  '                            🔔 {newMatchesCount} {newMatchesCount === 1 ? "novedad" : "novedades"}',
  '                            {t("dashboard.alertNewMatches", { count: newMatchesCount })}'
);

// No matches badge
r(
  '                            Sin novedades pendientes',
  '                            {t("dashboard.alertNoNewMatches")}'
);

// Alert status "Activa"
r(
  '{alert.createdAt} · {alert.status || "Activa"}',
  '{alert.createdAt} · {alert.status || t("dashboard.alertStatusActive")}'
);

fs.writeFileSync(p, s, "utf8");
console.log("Saved.js patched.", count, "replacements.");
