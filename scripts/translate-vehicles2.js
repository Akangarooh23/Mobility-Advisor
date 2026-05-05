/**
 * Comprehensive translation script for UserDashboardVehicles.js
 * Uses exact string replacements
 */
const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardVehicles.js");
let s = fs.readFileSync(p, "utf8");

function r(from, to) {
  if (!s.includes(from)) {
    console.warn("NOT FOUND:", JSON.stringify(from).substring(0, 80));
    return;
  }
  s = s.replace(from, to);
}

// Section header title
r(
  `>Hub de ciclo de vida<`,
  `>{t("dashboard.vehTitle")}<`
);

// Stats array
r(
  `["Mis vehículos", myVehicles.length, "#2563eb"],`,
  `[t("dashboard.vehSectionLabel"), myVehicles.length, "#2563eb"],`
);
r(
  `["Comprados", lifecycleTotals.owned, "#60a5fa"],`,
  `[t("dashboard.vehStatBought"), lifecycleTotals.owned, "#60a5fa"],`
);
r(
  `["Activos en venta", lifecycleTotals.activeSale, "#f59e0b"],`,
  `[t("dashboard.vehStatActive"), lifecycleTotals.activeSale, "#f59e0b"],`
);
r(
  `["Vendidos", lifecycleTotals.sold, "#34d399"],`,
  `[t("dashboard.vehStatSold"), lifecycleTotals.sold, "#34d399"],`
);

// Add vehicle button
r(
  `                Añadir nuevo vehículo`,
  `                {t("dashboard.vehAddNew")}`
);
// Add vehicle form header
r(
  `<div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>Añadir vehículo propio</div>`,
  `<div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>{t("dashboard.vehAddOwn")}</div>`
);
r(
  `<div style={{ fontSize: 11, color: bodyColor, marginTop: 3 }}>Crea tu garage personal con fotos, documentación y acciones rápidas.</div>`,
  `<div style={{ fontSize: 11, color: bodyColor, marginTop: 3 }}>{t("dashboard.vehAddSubtitle")}</div>`
);

// Back to list button
r(`Volver al listado`, `{t("dashboard.vehBackToList")}`);

// Save buttons
r(
  `{editingVehicleId ? "Guardar cambios" : "Guardar en mis vehículos"}`,
  `{editingVehicleId ? t("dashboard.vehSaveChanges") : t("dashboard.vehSaveNew")}`
);
r(`"Guardando..."`, `t("dashboard.vehFeedbackSaved")`);

// Cancel edit
r(`"Cancelar edición"`, `t("dashboard.vehCancelEdit")`);

// Vehicle fill mode
r(`>Cómo quieres registrar el vehículo?<`, `>{t("dashboard.vehFillMode")}<`);
r(`>Catálogo ERP<`, `>{t("dashboard.vehModeErp")}<`);
r(`>Datos manuales<`, `>{t("dashboard.vehModeManual")}<`);

// Characteristics section
r(`>Características del vehículo<`, `>{t("dashboard.vehCharacteristics")}<`);

// Form field labels
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Alias / Nombre<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehAlias")}<`
);
r(`placeholder="Alias (opcional)"`, `placeholder={t("dashboard.vehAliasPlaceholder")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Marca *<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehBrand")} *<`
);
r(`>Cargando marcas...</`, `>{t("dashboard.vehBrandLoading")}</`);
r(`>Seleccionar marca<`, `>{t("dashboard.vehBrandSelect")}<`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Modelo *<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehModel")} *<`
);
r(`>Cargando modelos...</`, `>{t("dashboard.vehModelLoading")}</`);
r(`>Selecciona primero una marca<`, `>{t("dashboard.vehModelSelectFirst")}<`);
r(`>Seleccionar modelo<`, `>{t("dashboard.vehModelSelect")}<`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Versión / Variante<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehVersion")}<`
);
r(`>Cargando versiones...</`, `>{t("dashboard.vehVersionLoading")}</`);
r(`>Selecciona primero un modelo<`, `>{t("dashboard.vehVersionSelectFirst")}<`);
r(`>Sin versión específica<`, `>{t("dashboard.vehVersionNone")}<`);
r(`>Seleccionar versión<`, `>{t("dashboard.vehVersionSelect")}<`);

// Manual brand/model/version
r(`placeholder="Marca del vehículo"`, `placeholder={t("dashboard.vehBrandManualPlaceholder")}`);
r(`placeholder="Modelo del vehículo"`, `placeholder={t("dashboard.vehModelManualPlaceholder")}`);
r(`placeholder="Versión/variante (opcional)"`, `placeholder={t("dashboard.vehVersionManualPlaceholder")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Marca<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehBrand")}<`
);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Modelo<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehModel")}<`
);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Versión<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehVersion")}<`
);

// Transmission
r(`>Seleccionar transmisión<`, `>{t("dashboard.vehTransmissionSelect")}<`);
r(`>Manual<`, `>{t("dashboard.vehTransmissionManual")}<`);
r(`>Automático<`, `>{t("dashboard.vehTransmissionAuto")}<`);

// Body type
r(`>Seleccionar carrocería<`, `>{t("dashboard.vehBodyType")}<`);
r(`>Berlina<`, `>{t("dashboard.vehBodyBerlina")}<`);
r(`>Compacto<`, `>{t("dashboard.vehBodyCompact")}<`);
r(`>Cabriolet<`, `>{t("dashboard.vehBodyCabrio")}<`);
r(`>SUV<`, `>{t("dashboard.vehBodySuv")}<`);
r(`>Familiar<`, `>{t("dashboard.vehBodyFamiliar")}<`);
r(`>Coupé<`, `>{t("dashboard.vehBodyCoupe")}<`);
r(`>Monovolumen<`, `>{t("dashboard.vehBodyMonovolumen")}<`);
r(`>Pickup<`, `>{t("dashboard.vehBodyPickup")}<`);
r(`>Todoterreno<`, `>{t("dashboard.vehBodyTodoterreno")}<`);
r(`>Furgoneta<`, `>{t("dashboard.vehBodyFurgoneta")}<`);

// HP / power
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Potencia (CV)<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehHp")}<`
);
r(`placeholder="CV (opcional)"`, `placeholder={t("dashboard.vehHp")}`);

// Year, plate
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Año de matriculación *<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehYear")} *<`
);
r(`placeholder="AAAA"`, `placeholder={t("dashboard.vehYear")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Matrícula *<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehPlate")} *<`
);
r(`placeholder="Matrícula"`, `placeholder={t("dashboard.vehPlate")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Kilometraje<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehMileage")}<`
);
r(`placeholder="km"`, `placeholder={t("dashboard.vehMileage")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Combustible<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehFuel")}<`
);
r(`placeholder="Combustible"`, `placeholder={t("dashboard.vehFuelPlaceholder")}`);

// Color placeholder
r(`placeholder="p. ej. Blanco"`, `placeholder={t("dashboard.vehColorPlaceholder")}`);

// Seats, doors
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Plazas<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehSeats")}<`
);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Puertas<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehDoors")}<`
);

// Location
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Localización<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehLocation")}<`
);

// Label/alias
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Etiqueta personalizada<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehLabel")}<`
);
r(`placeholder="Ej: Mi coche del trabajo"`, `placeholder={t("dashboard.vehLabelPlaceholder")}`);

// Notes field (textarea label - already done for some, but check other instances)
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Notas internas<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehInternalNotes")}<`
);
r(`placeholder="Notas adicionales del vehículo..."`, `placeholder={t("dashboard.vehNotesPlaceholder")}`);

// MOT dates
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Última ITV<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehLastMot")}<`
);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Próxima ITV<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehNextMot")}<`
);

// CO2
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Emisiones CO₂<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehCo2")}<`
);

// Market value / price
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Valor de mercado (€)<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehMarketValue")}<`
);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Precio fijo de venta (€)<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehFixPrice")}<`
);

// Documents section
r(`>Documentos y fotos<`, `>{t("dashboard.vehDocuments")}<`);
r(`>Fotos del vehículo<`, `>{t("dashboard.vehPhotos")}<`);
r(`>Subir fotos<`, `>{t("dashboard.vehUploadPhotos")}<`);
r(`>Documentación técnica<`, `>{t("dashboard.vehDocumentation")}<`);
r(`>Subir documentos<`, `>{t("dashboard.vehUploadDocs")}<`);

// Maintenance section
r(`>Mantenimiento<`, `>{t("dashboard.vehMaintenance")}<`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Tipo de mantenimiento<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehMaintenanceType")}<`
);
r(`placeholder="Ej: Cambio de aceite"`, `placeholder={t("dashboard.vehMaintenanceTypePlaceholder")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Descripción<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehMaintenanceDesc")}<`
);
r(`placeholder="Descripción del servicio"`, `placeholder={t("dashboard.vehMaintenanceDescPlaceholder")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Notas adicionales<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehMaintenanceNotes")}<`
);
r(`placeholder="Notas opcionales del mantenimiento"`, `placeholder={t("dashboard.vehMaintenanceNotesPlaceholder")}`);
r(`>Facturas / documentos<`, `>{t("dashboard.vehMaintenanceInvoices")}<`);
r(`>Añadir registro de mantenimiento<`, `>{t("dashboard.vehMaintenance")}<`);

// Insurance section
r(`>Seguro del vehículo<`, `>{t("dashboard.vehInsurance")}<`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Aseguradora<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehInsurer")}<`
);
r(`placeholder="Nombre de la aseguradora"`, `placeholder={t("dashboard.vehInsurerPlaceholder")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Tipo de cobertura<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehCoverage")}<`
);
r(`placeholder="Todo riesgo, terceros..."`, `placeholder={t("dashboard.vehCoveragePlaceholder")}`);
r(
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>Número de póliza<`,
  `<label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>{t("dashboard.vehPolicy")}<`
);
r(`placeholder="Nº póliza"`, `placeholder={t("dashboard.vehPolicyPlaceholder")}`);

// Vehicle empty state
r(
  `>Todavía no tienes vehículos en tu garaje.<`,
  `>{t("dashboard.vehEmpty")}<`
);

// Publish dialog
r(`>Publicar en Marketplace<`, `>{t("dashboard.vehDialogTitle")}<`);
r(`>Precio de publicación<`, `>{t("dashboard.vehDialogPrice")}<`);
r(
  `{publishLoading ? "Publicando..." : "Confirmar publicación"}`,
  `{publishLoading ? t("dashboard.vehPublishing") : t("dashboard.vehDialogPublish")}`
);

// View pipeline
r(`>Ver ciclo de vida<`, `>{t("dashboard.vehViewPipeline")}<`);

// Vehicle actions
r(`>Solicitar tasación<`, `>{t("dashboard.vehRequestVal")}<`);
r(`>Reservar cita<`, `>{t("dashboard.vehBookAppt")}<`);
r(`>Gestionar seguro<`, `>{t("dashboard.vehManageInsurance")}<`);
r(`>Publicar en marketplace<`, `>{t("dashboard.vehPublish")}<`);
r(`>Editar<`, `>{t("dashboard.vehEdit")}<`);
r(`>Eliminar vehículo<`, `>{t("dashboard.vehRemove")}<`);
r(`>Ocultar gestión<`, `>{t("dashboard.vehHideManage")}<`);
r(`>Gestionar<`, `>{t("dashboard.vehManage")}<`);

// feedback strings
r(
  `"Matrícula requerida."`,
  `t("dashboard.vehFeedbackSaved")`
);
r(
  `\`Vehículo ${title} ${existingVehicle ? "actualizado" : "guardado en Mis vehículos"}.\``,
  `existingVehicle ? t("dashboard.vehFeedbackUpdated", { title }) : t("dashboard.vehFeedbackSaved", { title })`
);
r(
  `setVehicleFeedback("Vehículo eliminado de Mis vehículos.");`,
  `setVehicleFeedback(t("dashboard.vehFeedbackDeleted"));`
);

// No photo text
r(`>Sin foto<`, `>{t("dashboard.vehNoPhoto")}<`);

// Tabs (tabs are set as strings in tab config)
r(`"Mi garaje"`, `t("dashboard.vehTab")`);

fs.writeFileSync(p, s, "utf8");
console.log("Done. Bytes:", s.length);
