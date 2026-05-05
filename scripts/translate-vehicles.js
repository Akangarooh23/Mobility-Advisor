/**
 * Translate UserDashboardVehicles.js
 * Run: node scripts/translate-vehicles.js
 */
const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardVehicles.js");
let s = fs.readFileSync(p, "utf8");

// 1. Add import
s = s.replace(
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { useTranslation } from "react-i18next";'
);

// 2. Add const { t } = useTranslation() as first line of component (after isDark)
s = s.replace(
  '}) {\n  const isDark = themeMode === "dark";\n  const cardBg = isDark',
  '}) {\n  const { t } = useTranslation();\n  const isDark = themeMode === "dark";\n  const cardBg = isDark'
);

// 3. Rename param t -> rawTx inside mapErpTransmission to avoid shadowing
s = s.replace(
  '  function mapErpTransmission(t = "") {\n    const v = String(t).toLowerCase()',
  '  function mapErpTransmission(rawTx = "") {\n    const v = String(rawTx).toLowerCase()'
);

// 4. JSX: section header
s = s.replace(
  '>MIS VEHÍCULOS<',
  '>{t("dashboard.vehSectionLabel")}<'
);
s = s.replace(
  '>Hub de ciclo de vida<',
  '>{t("dashboard.vehTitle")}<'
);

// 5. Stats labels (Vehículos, Alertas activas, Valoraciones, km)
s = s.replace(
  /\["Vehículos en garaje",\s*dashboardVehicleCount,\s*"#2563eb"\]/,
  '[t("dashboard.vehStatGarage"), dashboardVehicleCount, "#2563eb"]'
);
s = s.replace(
  /\["Km medios del parque",\s*avgKm,\s*"#0ea5e9"\]/,
  '[t("dashboard.vehStatKm"), avgKm, "#0ea5e9"]'
);
s = s.replace(
  /\["Alertas de servicio activas",\s*urgentAlertCount,\s*"#f59e0b"\]/,
  '[t("dashboard.vehStatAlerts"), urgentAlertCount, "#f59e0b"]'
);
s = s.replace(
  /\["Documentos activos",\s*activeDocsCount,\s*"#10b981"\]/,
  '[t("dashboard.vehStatDocs"), activeDocsCount, "#10b981"]'
);

// 6. Button/action strings
s = s.replace(/>Añadir vehículo</g, '>{t("dashboard.vehAddVehicle")}<');
s = s.replace(/>Explorar marketplace VO</g, '>{t("dashboard.vehExploreMarket")}<');
s = s.replace(/>Solicitar tasación</g, '>{t("dashboard.vehRequestValuation")}<');
s = s.replace(/>Solicitar cita</g, '>{t("dashboard.vehRequestAppt")}<');
s = s.replace(/>Ver en marketplace</g, '>{t("dashboard.vehViewMarket")}<');
s = s.replace(/>Publicar en marketplace</g, '>{t("dashboard.vehPublishMarket")}<');
s = s.replace(/>Guardar cambios</g, '>{t("dashboard.vehSave")}<');
s = s.replace(/>Guardando\.\.\.</g, '>{t("dashboard.vehSaving")}<');
s = s.replace(/>Eliminando\.\.\.</g, '>{t("dashboard.vehRemoving")}<');
s = s.replace(/>Cancelar</g, '>{t("dashboard.vehCancel")}<');
s = s.replace(/>Eliminar vehículo</g, '>{t("dashboard.vehRemove")}<');
s = s.replace(/>Confirmar publicación</g, '>{t("dashboard.vehConfirmPublish")}<');
s = s.replace(/>Publicando\.\.\.</g, '>{t("dashboard.vehPublishing")}<');
s = s.replace(/>Cerrar</g, '>{t("dashboard.vehClose")}<');
s = s.replace(/>Añadir registro</g, '>{t("dashboard.vehAddRecord")}<');
s = s.replace(/>Añadir seguro</g, '>{t("dashboard.vehAddInsurance")}<');

// 7. Tab labels
s = s.replace('"Resumen"', 't("dashboard.vehTabOverview")');
s = s.replace('"Mantenimiento"', 't("dashboard.vehTabMaintenance")');
s = s.replace('"Seguro"', 't("dashboard.vehTabInsurance")');
s = s.replace('"Documentos"', 't("dashboard.vehTabDocs")');
s = s.replace('"Estado / Venta"', 't("dashboard.vehTabState")');

// 8. Form field labels/placeholders
// Matricula
s = s.replace(/>\s*Matrícula\s*\*/g, '>{t("dashboard.vehPlate")} *');
s = s.replace('placeholder="Matrícula"', 'placeholder={t("dashboard.vehPlate")}');
// Marca
s = s.replace(/>\s*Marca\s*\*/g, '>{t("dashboard.vehBrand")} *');
s = s.replace('placeholder="Marca"', 'placeholder={t("dashboard.vehBrand")}');
// Modelo
s = s.replace(/>\s*Modelo\s*\*/g, '>{t("dashboard.vehModel")} *');
s = s.replace('placeholder="Modelo"', 'placeholder={t("dashboard.vehModel")}');
// Versión / Variante
s = s.replace(/>\s*Versión \/ Variante\s*</g, '>{t("dashboard.vehVersion")}<');
s = s.replace('placeholder="Versión/variante"', 'placeholder={t("dashboard.vehVersion")}');
// Año
s = s.replace(/>\s*Año\s*\*/g, '>{t("dashboard.vehYear")} *');
s = s.replace('placeholder="Año"', 'placeholder={t("dashboard.vehYear")}');
// Kilometraje
s = s.replace(/>\s*Kilometraje\s*</g, '>{t("dashboard.vehMileage")}<');
s = s.replace('placeholder="Kilometraje"', 'placeholder={t("dashboard.vehMileage")}');
// Color
s = s.replace(/>\s*Color\s*</g, '>{t("dashboard.vehColor")}<');
s = s.replace('placeholder="Color"', 'placeholder={t("dashboard.vehColor")}');
// Combustible
s = s.replace(/>\s*Combustible\s*</g, '>{t("dashboard.vehFuel")}<');
// Carrocería
s = s.replace(/>\s*Carrocería\s*</g, '>{t("dashboard.vehBodyType")}<');
// Transmisión
s = s.replace(/>\s*Transmisión\s*</g, '>{t("dashboard.vehTransmission")}<');
// Potencia
s = s.replace(/>\s*Potencia \(CV\)\s*</g, '>{t("dashboard.vehPower")}<');
s = s.replace('placeholder="CV"', 'placeholder={t("dashboard.vehPower")}');
// Notas
s = s.replace(/>\s*Notas\s*</g, '>{t("dashboard.vehNotes")}<');
s = s.replace('placeholder="Notas adicionales..."', 'placeholder={t("dashboard.vehNotesPlaceholder")}');

// 9. Select options (body type and fuel)
s = s.replace('>Seleccionar carrocería<', '>{t("dashboard.vehSelectBodyType")}<');
s = s.replace('>Seleccionar combustible<', '>{t("dashboard.vehSelectFuel")}<');
s = s.replace('>Seleccionar transmisión<', '>{t("dashboard.vehSelectTransmission")}<');

// 10. No vehicles empty state
s = s.replace(
  "Todavía no tienes vehículos registrados.",
  '{t("dashboard.vehEmpty")}'
);

// 11. Feedback
s = s.replace(
  '"Matrícula requerida."',
  't("dashboard.vehPlateRequired")'
);
s = s.replace(
  '"Marca y modelo son requeridos."',
  't("dashboard.vehBrandModelRequired")'
);
s = s.replace(
  '"Año inválido."',
  't("dashboard.vehYearInvalid")'
);
s = s.replace(
  '"Vehículo guardado correctamente."',
  't("dashboard.vehSavedOk")'
);
s = s.replace(
  '"No se pudo guardar el vehículo."',
  't("dashboard.vehSaveError")'
);
s = s.replace(
  '"Vehículo eliminado."',
  't("dashboard.vehRemovedOk")'
);
s = s.replace(
  '"No se pudo eliminar el vehículo."',
  't("dashboard.vehRemoveError")'
);

fs.writeFileSync(p, s, "utf8");
console.log("Done. Bytes:", s.length);
