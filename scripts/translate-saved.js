/**
 * One-shot script to add react-i18next t() calls to UserDashboardSaved.js
 * Run: node scripts/translate-saved.js
 */
const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardSaved.js");
let s = fs.readFileSync(p, "utf8");

// ---- Add import ----
s = s.replace(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useState } from "react";\nimport { useTranslation } from "react-i18next";'
);

// ---- buildAlertChips: add t param ----
s = s.replace(
  "function buildAlertChips(alert, formatCurrency) {",
  "function buildAlertChips(alert, formatCurrency, t) {"
);
s = s.replace(
  '    alert?.brand ? `Marca ${alert.brand}` : "",\n    alert?.model ? `Modelo ${alert.model}` : "",\n    alert?.maxPrice ? `Hasta ${formatCurrency(Number(alert.maxPrice))}` : "",',
  '    alert?.brand ? t("dashboard.alertChipBrand", { brand: alert.brand }) : "",\n    alert?.model ? t("dashboard.alertChipModel", { model: alert.model }) : "",\n    alert?.maxPrice ? t("dashboard.alertChipMaxPrice", { price: formatCurrency(Number(alert.maxPrice)) }) : "",'
);
s = s.replace(
  '    alert?.location ? `Zona ${alert.location}` : "",\n    alert?.color ? `Color ${alert.color}` : "",',
  '    alert?.location ? t("dashboard.alertChipZone", { zone: alert.location }) : "",\n    alert?.color ? t("dashboard.alertChipColor", { color: alert.color }) : "",'
);

// ---- Add useTranslation inside component (after first const isDark) ----
s = s.replace(
  "}) {\n  const isDark = themeMode === \"dark\";",
  "}) {\n  const { t } = useTranslation();\n  const isDark = themeMode === \"dark\";"
);

// ---- Feedback strings ----
s = s.replace(
  '"Inicia sesión o indica un correo para activar el aviso por email de esta alerta."',
  't("dashboard.alertNoEmail")'
);
s = s.replace(
  '"No se pudo guardar la alerta. Revisa los filtros y vuelve a intentarlo."',
  't("dashboard.alertSaveError")'
);
s = s.replace(
  ': "Alerta guardada: te avisaremos aquí cuando aparezcan ofertas nuevas que encajen."',
  ': t("dashboard.alertSavedOk")'
);
// savedWithEmail template in handleCreateAlert
s = s.replace(
  '? `Alerta guardada con resumen por email para ${createdAlert.email}.`',
  '? t("dashboard.alertSavedWithEmail", { email: createdAlert.email })'
);
s = s.replace(
  'throw new Error(data?.error || "No se pudo actualizar el catálogo.");',
  'throw new Error(data?.error || t("dashboard.savedCatalogError"));'
);
s = s.replace(
  'setCatalogAdminFeedback("Catálogo actualizado correctamente.");',
  'setCatalogAdminFeedback(t("dashboard.savedCatalogSuccess"));'
);
s = s.replace(
  'setCatalogAdminFeedback(error instanceof Error ? error.message : "No se pudo actualizar el catálogo.");',
  'setCatalogAdminFeedback(error instanceof Error ? error.message : t("dashboard.savedCatalogError"));'
);

// ---- JSX strings ----
// Section header
s = s.replace(
  '>RECOMENDACIONES GUARDADAS<',
  '>{t("dashboard.savedSectionLabel")}<'
);
// Alerts activas badge in stats
s = s.replace(
  '["Alertas activas", marketAlerts.length, "#34d399"],',
  '[t("dashboard.savedStatAlerts"), marketAlerts.length, "#34d399"],'
);
// Gestionar alertas button
s = s.replace(
  />\s*Gestionar alertas\s*</g,
  ">{t(\"dashboard.savedManageAlerts\")}<"
);
// Empty saved comparisons
s = s.replace(
  "          Todavía no tienes recomendaciones guardadas. Cuando guardes una comparativa, aparecerá aquí.",
  "          {t(\"dashboard.savedEmpty\")}"
);
// Catalog section label
s = s.replace(
  '>CATÁLOGO DE MARCAS Y MODELOS<',
  '>{t("dashboard.savedCatalogLabel")}<'
);
// showCatalogAdmin toggle
s = s.replace(
  '{showCatalogAdmin ? "Cerrar" : "Gestionar catálogo"}',
  '{showCatalogAdmin ? t("dashboard.savedCatalogClose") : t("dashboard.savedManageCatalog")}'
);
// Añadir marca / Añadir modelo buttons in catalog admin
s = s.replace(
  />\s*Añadir marca\s*</g,
  ">{t(\"dashboard.savedCatalogAddBrand\")}<"
);
s = s.replace(
  />\s*Añadir modelo\s*</g,
  ">{t(\"dashboard.savedCatalogAddModel\")}<"
);
// ALERTAS DE MERCADO section in saved
s = s.replace(
  '>ALERTAS DE MERCADO<',
  '>{t("dashboard.alertSectionLabel")}<'
);
// emailDigest
s = s.replace(
  '{emailDigestLoading ? "Enviando…" : "Enviar resumen por email"}',
  '{emailDigestLoading ? t("dashboard.alertSending") : t("dashboard.alertSendEmail")}'
);
// show/hide alert form button
s = s.replace(
  '{showAlertForm ? "Cerrar" : "Añadir alerta"}',
  '{showAlertForm ? t("dashboard.alertClose") : t("dashboard.alertAddAlert")}'
);
// Precio maximo, Kilometraje maximo, Localizacion
s = s.replace(
  />\s*Precio máximo \(€\)\s*</g,
  ">{t(\"dashboard.alertMaxPrice\")}<"
);
s = s.replace(
  />\s*Kilometraje máximo\s*</g,
  ">{t(\"dashboard.alertMaxMileage\")}<"
);
s = s.replace(
  />\s*Localización\s*</g,
  ">{t(\"dashboard.alertLocation\")}<"
);
// Guardar alerta
s = s.replace(
  />\s*Guardar alerta\s*</g,
  ">{t(\"dashboard.alertSaveButton\")}<"
);
// email checkbox
s = s.replace(
  />\s*Enviarme también un resumen por email\s*</g,
  ">{t(\"dashboard.alertEmailCheckbox\")}<"
);
// No coincidencias
s = s.replace(
  "Aún no vemos coincidencias en el marketplace VO con estos filtros. Seguimos vigilando el mercado.",
  '{t("dashboard.alertNoMatches")}'
);
// Todavía no alertas activas
s = s.replace(
  "            Todavía no tienes alertas activas. Crea una y deja vigilado el mercado para compra o renting con los filtros que necesites.",
  "            {t(\"dashboard.alertEmpty\")}"
);
// buildAlertChips call site
s = s.replace(
  "buildAlertChips({ ...alert, email: alertEmail }, formatCurrency)",
  "buildAlertChips({ ...alert, email: alertEmail }, formatCurrency, t)"
);
// Marcar revisada, Ir al marketplace, Eliminar, Ver oferta
s = s.replace(
  />\s*Marcar revisada\s*</g,
  ">{t(\"dashboard.alertMarkReviewed\")}<"
);
s = s.replace(
  />\s*Ir al marketplace\s*</g,
  ">{t(\"dashboard.alertGoMarketplace\")}<"
);
s = s.replace(
  />\s*Eliminar\s*</g,
  ">{t(\"dashboard.alertDelete\")}<"
);
s = s.replace(
  />\s*Ver oferta ↗\s*</g,
  ">{t(\"dashboard.alertViewOffer\")}<"
);

// Novedades pendientes
s = s.replace(
  '🔔 Tienes {totalNewMatches} {totalNewMatches === 1 ? "novedad pendiente" : "novedades pendientes"} en tus alertas de mercado.',
  '{`🔔 `}{t("dashboard.homeNewMatches", { count: totalNewMatches })}'
);

// Match count badge in saved alerts
s = s.replace(
  '{alertMatchInfo.count === 1 ? "1 coincidencia ahora" : `${alertMatchInfo.count} coincidencias ahora`}',
  '{t("dashboard.alertMatch", { count: alertMatchInfo.count })}'
);

fs.writeFileSync(p, s, "utf8");
console.log("Done. Bytes:", s.length);
