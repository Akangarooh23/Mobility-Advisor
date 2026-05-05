const fs = require("fs");
const path = require("path");

// ─── 1. Add missing locale keys ────────────────────────────────────────────
const enPath = path.join(__dirname, "..", "src", "locales", "en.json");
const esPath = path.join(__dirname, "..", "src", "locales", "es.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const es = JSON.parse(fs.readFileSync(esPath, "utf8"));

const newEn = {
  vehMyVehicles: "My vehicles",
  vehTabBought: "Bought",
  vehTabSold: "Sold",
  vehTabActiveSale: "Active listings",
  vehRegistros_one: "{{count}} record",
  vehRegistros_other: "{{count}} records",
  vehSelectVehicle: "Select a vehicle to manage quick actions or create a new one.",
  vehFillLabel: "Fill:",
  vehCharacteristicsDesc: "Base data, technical specs and commercial attributes",
  vehAliasLabel: "Alias / name",
  vehBrandLabel: "Brand",
  vehModelLabel: "Model",
  vehVersionLabel: "Version",
  vehVersionPlaceholder: "Enter version",
  vehTransmissionLabel: "Transmission",
  vehTypeLabel: "Car type",
  vehSeatsLabel: "Seats",
  vehDoorsLabel: "Doors",
  vehLocationLabel: "Location",
  vehLabelTag: "Label",
  vehLastItv: "Last MOT",
  vehNextItv: "Next MOT",
  vehCo2Label: "CO2 (g/km)",
  vehYearLabel: "Year",
  vehPlateLabel: "Plate",
  vehManualValue: "Manual value defined",
  vehValuationValue: "Publication subject to valuation",
  vehPricingStrategy: "Pricing strategy for publication",
  vehPriceFixed: "Set manual price",
  vehPriceValuate: "First get a valuation",
  vehDocsSection: "Vehicle documents",
  vehPhotosSelected: "{{count}} selected",
  vehPhotosHint: "JPG, PNG, WEBP \u00b7 multiple selection",
  vehDocsHint: "PDF, JPG, PNG \u00b7 multiple selection",
  vehAttachItv: "Attach MOT",
  vehDocsSummary: "{{saved}} saved \u00b7 {{pending}} attachments ready",
  vehPolicyNumber: "Policy number",
  vehInsuranceSummary: "{{saved}} saved \u00b7 {{pending}} insurance documents ready",
  vehMaintenanceSummary: "{{saved}} saved \u00b7 {{pending}} maintenance invoices ready",
  vehDeleteBtn: "Remove",
  vehEditBtn: "Edit",
  vehManageBtn: "Manage",
  vehHideManage: "Hide management",
  vehSavedInFile: "Saved in file",
  vehRequiredFields: "Add brand, model and version to save your vehicle.",
  vehSavedNew: "Vehicle {{title}} saved to My vehicles.",
  vehSavedUpdated: "Vehicle {{title}} updated.",
  vehSavedSkipped: "Vehicle {{title}} {{action}}. {{count}} files exceeded 2 MB.",
  vehBrandLoading: "Loading brands\u2026",
  vehSelectBrand: "Select brand",
  vehModelLoading: "Loading models\u2026",
  vehSelectBrandFirst: "Select brand first",
  vehSelectModel: "Select model",
  vehVersionLoading: "Loading versions\u2026",
  vehSelectModelFirst: "Select model first",
  vehNoVersions: "No versions in catalogue",
  vehSelectVersion: "Select version",
  vehRequestAppointment: "Book appointment",
  vehRequestValuation: "Request valuation",
  vehPublish: "Publish",
  vehMoreFiles: "+{{count}} more file(s)",
};
const newEs = {
  vehMyVehicles: "Mis veh\u00edculos",
  vehTabBought: "Comprados",
  vehTabSold: "Vendidos",
  vehTabActiveSale: "Activos en venta",
  vehRegistros_one: "{{count}} registro",
  vehRegistros_other: "{{count}} registros",
  vehSelectVehicle: "Elige un veh\u00edculo para gestionar acciones r\u00e1pidas o crea uno nuevo.",
  vehFillLabel: "Relleno:",
  vehCharacteristicsDesc: "Datos base, ficha t\u00e9cnica y atributos comerciales",
  vehAliasLabel: "Alias / nombre",
  vehBrandLabel: "Marca",
  vehModelLabel: "Modelo",
  vehVersionLabel: "Versi\u00f3n",
  vehVersionPlaceholder: "Escribe la versi\u00f3n",
  vehTransmissionLabel: "Tipo de cambio",
  vehTypeLabel: "Tipo de coche",
  vehSeatsLabel: "Plazas",
  vehDoorsLabel: "Puertas",
  vehLocationLabel: "Ubicaci\u00f3n",
  vehLabelTag: "Etiqueta",
  vehLastItv: "\u00daltima ITV",
  vehNextItv: "Pr\u00f3xima ITV",
  vehCo2Label: "CO2 (g/km)",
  vehYearLabel: "A\u00f1o",
  vehPlateLabel: "Matr\u00edcula",
  vehManualValue: "Valor manual definido",
  vehValuationValue: "Publicaci\u00f3n condicionada a tasaci\u00f3n",
  vehPricingStrategy: "Estrategia de precio para publicar",
  vehPriceFixed: "Fijar precio manual",
  vehPriceValuate: "Primero tasar el coche",
  vehDocsSection: "Documentos del veh\u00edculo",
  vehPhotosSelected: "{{count}} seleccionadas",
  vehPhotosHint: "JPG, PNG, WEBP \u00b7 selecci\u00f3n m\u00faltiple",
  vehDocsHint: "PDF, JPG, PNG \u00b7 selecci\u00f3n m\u00faltiple",
  vehAttachItv: "Adjuntar ITV",
  vehDocsSummary: "{{saved}} guardados \u00b7 {{pending}} adjuntos preparados",
  vehPolicyNumber: "N\u00famero de p\u00f3liza",
  vehInsuranceSummary: "{{saved}} guardados \u00b7 {{pending}} documentos de seguro preparados",
  vehMaintenanceSummary: "{{saved}} guardadas \u00b7 {{pending}} facturas de mantenimiento preparadas",
  vehDeleteBtn: "Quitar",
  vehEditBtn: "Editar",
  vehManageBtn: "Gestionar",
  vehHideManage: "Ocultar gesti\u00f3n",
  vehSavedInFile: "Guardados en ficha",
  vehRequiredFields: "A\u00f1ade marca, modelo y versi\u00f3n para guardar tu veh\u00edculo.",
  vehSavedNew: "Veh\u00edculo {{title}} guardado en Mis veh\u00edculos.",
  vehSavedUpdated: "Veh\u00edculo {{title}} actualizado.",
  vehSavedSkipped: "Veh\u00edculo {{title}} {{action}}. {{count}} ficheros superaban 2 MB.",
  vehBrandLoading: "Cargando marcas\u2026",
  vehSelectBrand: "Selecciona marca",
  vehModelLoading: "Cargando modelos\u2026",
  vehSelectBrandFirst: "Primero selecciona marca",
  vehSelectModel: "Selecciona modelo",
  vehVersionLoading: "Cargando versiones\u2026",
  vehSelectModelFirst: "Primero selecciona modelo",
  vehNoVersions: "Sin versiones en cat\u00e1logo",
  vehSelectVersion: "Selecciona versi\u00f3n",
  vehRequestAppointment: "Pedir cita",
  vehRequestValuation: "Solicitar tasaci\u00f3n",
  vehPublish: "Publicar",
  vehMoreFiles: "+{{count}} archivo(s) m\u00e1s",
};

Object.assign(en.dashboard, newEn);
Object.assign(es.dashboard, newEs);
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), "utf8");
fs.writeFileSync(esPath, JSON.stringify(es, null, 2), "utf8");
console.log("Locale keys added.");

// ─── 2. Patch UserDashboardVehicles.js ────────────────────────────────────
const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardVehicles.js");
let s = fs.readFileSync(p, "utf8");
let count = 0;

function r(from, to) {
  if (!s.includes(from)) { console.warn("NOT FOUND:", from.substring(0, 80)); return; }
  s = s.replace(from, to);
  count++;
}

// Critical bug: t() call printed as literal text
r(
  '>t("dashboard.vehTitle") de vehículos</div>',
  '>{t("dashboard.vehTitle")}</div>'
);

// Section description
r(
  'Controla en una sola vista tus coches comprados, activos en venta y operaciones cerradas.',
  '{t("dashboard.vehDesc")}'
);

// Records badge
r(
  '{totalVehiclesCount} registros',
  '{t("dashboard.vehRegistros", { count: totalVehiclesCount })}'
);

// vehicleTabs: "Mis vehículos" + section titles from safeSections
r(
  `  const vehicleTabs = [
    {
      key: "my-garage",
      title: "Mis vehículos",
      count: myVehicles.length,
    },
    ...safeSections.map((section) => ({
      key: section.key,
      title: section.title,
      count: Array.isArray(section.items) ? section.items.length : 0,
    })),
  ];`,
  `  const vehSectionTitleMap = {
    "owned": t("dashboard.vehTabBought"),
    "sold": t("dashboard.vehTabSold"),
    "active-sale": t("dashboard.vehTabActiveSale"),
  };
  const vehicleTabs = [
    {
      key: "my-garage",
      title: t("dashboard.vehMyVehicles"),
      count: myVehicles.length,
    },
    ...safeSections.map((section) => ({
      key: section.key,
      title: vehSectionTitleMap[section.key] || section.title,
      count: Array.isArray(section.items) ? section.items.length : 0,
    })),
  ];`
);

// Select vehicle hint
r(
  'Elige un vehículo para gestionar acciones rápidas o crea uno nuevo.',
  '{t("dashboard.vehSelectVehicle")}'
);

// Max vehicles badge
r(
  'Máximo 20 vehículos',
  '{t("dashboard.vehMaxVehicles")}'
);

// Characteristics desc
r(
  'Datos base, ficha técnica y atributos comerciales',
  '{t("dashboard.vehCharacteristicsDesc")}'
);

// Fill label
r(
  '<span style={{ fontSize: 11, fontWeight: 700, color: bodyColor }}>Relleno:</span>',
  '<span style={{ fontSize: 11, fontWeight: 700, color: bodyColor }}>{t("dashboard.vehFillLabel")}</span>'
);

// Alias / nombre
r(
  '                Alias / nombre',
  '                {t("dashboard.vehAliasLabel")}'
);

// Marca label
r(
  '                Marca\n',
  '                {t("dashboard.vehBrandLabel")}\n'
);

// Brand dropdown options
r(
  '{erpBrandsLoading ? "Cargando marcas…" : "Selecciona marca"}',
  '{erpBrandsLoading ? t("dashboard.vehBrandLoading") : t("dashboard.vehSelectBrand")}'
);

// Modelo label
r(
  '                Modelo\n',
  '                {t("dashboard.vehModelLabel")}\n'
);

// Model dropdown options
r(
  '{erpModelsLoading ? "Cargando modelos…" : !erpSelectedBrandId ? "Primero selecciona marca" : "Selecciona modelo"}',
  '{erpModelsLoading ? t("dashboard.vehModelLoading") : !erpSelectedBrandId ? t("dashboard.vehSelectBrandFirst") : t("dashboard.vehSelectModel")}'
);

// Versión (ERP mode - label + dropdown)
r(
  `                Versión
`,
  `                {t("dashboard.vehVersionLabel")}
`
);

// Version dropdown
r(
  '{erpVersionsLoading ? "Cargando versiones…" : !erpSelectedModelId ? "Primero selecciona modelo" : erpVersions.length === 0 ? "Sin versiones en catálogo" : "Selecciona versión"}',
  '{erpVersionsLoading ? t("dashboard.vehVersionLoading") : !erpSelectedModelId ? t("dashboard.vehSelectModelFirst") : erpVersions.length === 0 ? t("dashboard.vehNoVersions") : t("dashboard.vehSelectVersion")}'
);

// Versión manual label (second occurrence after first replacement)
r(
  '                Versión\n',
  '                {t("dashboard.vehVersionLabel")}\n'
);

// Version placeholder
r(
  'placeholder="Escribe la versión"',
  'placeholder={t("dashboard.vehVersionPlaceholder")}'
);

// Tipo de cambio
r(
  '                Tipo de cambio',
  '                {t("dashboard.vehTransmissionLabel")}'
);

// Tipo de coche
r(
  '                Tipo de coche',
  '                {t("dashboard.vehTypeLabel")}'
);

// Plazas
r(
  '                Plazas',
  '                {t("dashboard.vehSeatsLabel")}'
);

// Puertas
r(
  '                Puertas',
  '                {t("dashboard.vehDoorsLabel")}'
);

// Ubicación
r(
  '                Ubicación',
  '                {t("dashboard.vehLocationLabel")}'
);

// Etiqueta
r(
  '                Etiqueta',
  '                {t("dashboard.vehLabelTag")}'
);

// Última ITV
r(
  '                Última ITV',
  '                {t("dashboard.vehLastItv")}'
);

// Próxima ITV
r(
  '                Próxima ITV',
  '                {t("dashboard.vehNextItv")}'
);

// CO2 label
r(
  '                CO2 (g/km)',
  '                {t("dashboard.vehCo2Label")}'
);

// Año
r(
  '                Año',
  '                {t("dashboard.vehYearLabel")}'
);

// Matrícula
r(
  '                Matrícula',
  '                {t("dashboard.vehPlateLabel")}'
);

// Market value section title
r(
  '"Valor del Vehículo en el mercado",',
  't("dashboard.vehMarketValue"),'
);

// Pricing mode subtitle
r(
  'vehicleForm.marketplacePricingMode === "manual" ? "Valor manual definido" : "Publicación condicionada a tasación"',
  'vehicleForm.marketplacePricingMode === "manual" ? t("dashboard.vehManualValue") : t("dashboard.vehValuationValue")'
);

// Pricing strategy label
r(
  '<span>Estrategia de precio para publicar</span>',
  '<span>{t("dashboard.vehPricingStrategy")}</span>'
);

// Set manual price button
r(
  '                      Fijar precio manual\n',
  '                      {t("dashboard.vehPriceFixed")}\n'
);

// First get valuation button
r(
  '                      Primero tasar el coche\n',
  '                      {t("dashboard.vehPriceValuate")}\n'
);

// Docs section title
r(
  '"Documentos del vehículo",',
  't("dashboard.vehDocsSection"),'
);

// Photos selected
r(
  '{pendingPhotos.length} seleccionadas',
  '{t("dashboard.vehPhotosSelected", { count: pendingPhotos.length })}'
);

// Photos hint
r(
  'JPG, PNG, WEBP · selección múltiple',
  '{t("dashboard.vehPhotosHint")}'
);

// Docs hint
r(
  'PDF, JPG, PNG · selección múltiple',
  '{t("dashboard.vehDocsHint")}'
);

// Attach sheet
r(
  '<span>Adjuntar ficha</span>',
  '<span>{t("dashboard.vehAttachSheet")}</span>'
);

// Attach permit
r(
  '<span>Adjuntar permiso</span>',
  '<span>{t("dashboard.vehAttachPermit")}</span>'
);

// Attach ITV
r(
  '<span>Adjuntar ITV</span>',
  '<span>{t("dashboard.vehAttachItv")}</span>'
);

// Docs summary
r(
  '`${storedVehicleDocumentsEditorCount} guardados · ${pendingPhotos.length + pendingDocuments.length + pendingTechnicalSheetDocuments.length + pendingCirculationPermitDocuments.length + pendingIvtDocuments.length} adjuntos preparados`',
  't("dashboard.vehDocsSummary", { saved: storedVehicleDocumentsEditorCount, pending: pendingPhotos.length + pendingDocuments.length + pendingTechnicalSheetDocuments.length + pendingCirculationPermitDocuments.length + pendingIvtDocuments.length })'
);

// Insurance section title
r(
  '"Seguros",',
  't("dashboard.vehInsurance"),'
);

// Insurer
r(
  '                Aseguradora',
  '                {t("dashboard.vehInsurer")}'
);

// Coverage
r(
  '                Cobertura',
  '                {t("dashboard.vehCoverage")}'
);

// Policy
r(
  '                Póliza',
  '                {t("dashboard.vehPolicy")}'
);

// Policy number placeholder
r(
  'placeholder="Número de póliza"',
  'placeholder={t("dashboard.vehPolicyNumber")}'
);

// Attach insurance
r(
  '<span>Adjuntar seguro</span>',
  '<span>{t("dashboard.vehAttachInsurance")}</span>'
);

// Insurance summary
r(
  '`${storedInsuranceDocumentsCount} guardados · ${pendingInsuranceDocuments.length} documentos de seguro preparados`',
  't("dashboard.vehInsuranceSummary", { saved: storedInsuranceDocumentsCount, pending: pendingInsuranceDocuments.length })'
);

// Maintenance section title
r(
  '"Mantenimientos",',
  't("dashboard.vehMaintenance"),'
);

// Maintenance type label
r(
  '                Tipo mantenimiento',
  '                {t("dashboard.vehMaintenanceType")}'
);

// Maintenance description label
r(
  '                Descripción mantenimiento',
  '                {t("dashboard.vehMaintenanceDesc")}'
);

// Maintenance notes label
r(
  '              Notas mantenimiento',
  '              {t("dashboard.vehMaintenanceNotes")}'
);

// Maintenance type placeholder
r(
  'placeholder="Revisión, aceite, frenos..."',
  'placeholder={t("dashboard.vehMaintPlaceholderType") || "Revisión, aceite, frenos..."}'
);

// Maintenance desc placeholder
r(
  'placeholder="Qué se le ha hecho al coche"',
  'placeholder={t("dashboard.vehMaintPlaceholderDesc") || "Qué se le ha hecho al coche"}'
);

// Maintenance notes placeholder
r(
  'placeholder="Detalle del mantenimiento"',
  'placeholder={t("dashboard.vehMaintPlaceholderNotes") || "Detalle del mantenimiento"}'
);

// Maintenance invoices label
r(
  '<div>Facturas de mantenimiento</div>',
  '<div>{t("dashboard.vehMaintenanceInvoices")}</div>'
);

// Attach invoices
r(
  '<span>Adjuntar facturas</span>',
  '<span>{t("dashboard.vehAttachInvoices")}</span>'
);

// Maintenance summary
r(
  '`${storedMaintenanceInvoicesCount} guardadas · ${pendingMaintenanceInvoices.length} facturas de mantenimiento preparadas`',
  't("dashboard.vehMaintenanceSummary", { saved: storedMaintenanceInvoicesCount, pending: pendingMaintenanceInvoices.length })'
);

// Notes section title
r(
  '"Notas internas",',
  't("dashboard.vehNotes"),'
);

// "Guardados en ficha" in renderStoredAttachmentPreview
r(
  '          Guardados en ficha\n',
  '          {t("dashboard.vehSavedInFile")}\n'
);

// Required fields feedback
r(
  'setVehicleFeedback("Añade marca, modelo y versión para guardar tu vehículo.");',
  'setVehicleFeedback(t("dashboard.vehRequiredFields"));'
);

// Save success feedback
r(
  'setVehicleFeedback(\n      skippedLargeFilesCount > 0\n        ? `Vehículo ${title} ${existingVehicle ? "actualizado" : "guardado"}. ${skippedLargeFilesCount} ficheros superaban 2 MB y se guardaron sin contenido.`\n        : `Vehículo ${title} ${existingVehicle ? "actualizado" : "guardado en Mis vehículos"}.`\n    );',
  'setVehicleFeedback(\n      skippedLargeFilesCount > 0\n        ? t("dashboard.vehSavedSkipped", { title, action: existingVehicle ? t("dashboard.vehSavedUpdated", { title: "" }).replace(" .", "") : t("dashboard.vehSavedNew", { title: "" }).replace(" .", ""), count: skippedLargeFilesCount })\n        : existingVehicle ? t("dashboard.vehSavedUpdated", { title }) : t("dashboard.vehSavedNew", { title })\n    );'
);

// Card buttons: Quitar, Editar, Gestionar
r(
  '                        Quitar\n',
  '                        {t("dashboard.vehDeleteBtn")}\n'
);
r(
  '                        Editar\n',
  '                        {t("dashboard.vehEditBtn")}\n'
);
r(
  '{isManagementOpen ? "Ocultar gestión" : "Gestionar"}',
  '{isManagementOpen ? t("dashboard.vehHideManage") : t("dashboard.vehManageBtn")}'
);

// Management sub-buttons
r(
  '                            Pedir cita\n',
  '                            {t("dashboard.vehRequestAppointment")}\n'
);
r(
  '                            Solicitar tasación\n',
  '                            {t("dashboard.vehRequestValuation")}\n'
);
r(
  '                            Gestionar seguro\n',
  '                            {t("dashboard.vehManageInsurance")}\n'
);
r(
  '                            Publicar\n',
  '                            {t("dashboard.vehPublish")}\n'
);

// Empty state
r(
  'Todavía no tienes vehículos en tu área privada. Añade uno para empezar a gestionar citas, tasaciones, marketplace y seguro.',
  '{t("dashboard.vehEmpty")}'
);

// More files
r(
  '+{files.length - 3} archivo(s) más',
  '+{t("dashboard.vehMoreFiles", { count: files.length - 3 }).replace("+", "")}'
);

fs.writeFileSync(p, s, "utf8");
console.log("Vehicles.js patched.", count, "replacements.");
