/**
 * Comprehensive translation script for UserDashboardVehicles.js
 * Reads/writes UTF-8, uses exact string replacements
 */
const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardVehicles.js");
let s = fs.readFileSync(p, { encoding: "utf8" });

let count = 0;
function r(from, to) {
  if (!s.includes(from)) {
    // silent skip
    return;
  }
  s = s.replace(from, to);
  count++;
}

// Section header title
r("Hub de ciclo de vida", 't("dashboard.vehTitle")');

// Stats array  
r('"Mis veh\u00edculos", myVehicles.length, "#2563eb"]', 't("dashboard.vehSectionLabel"), myVehicles.length, "#2563eb"]');
r('"Comprados", lifecycleTotals.owned, "#60a5fa"]', 't("dashboard.vehStatBought"), lifecycleTotals.owned, "#60a5fa"]');
r('"Activos en venta", lifecycleTotals.activeSale, "#f59e0b"]', 't("dashboard.vehStatActive"), lifecycleTotals.activeSale, "#f59e0b"]');
r('"Vendidos", lifecycleTotals.sold, "#34d399"]', 't("dashboard.vehStatSold"), lifecycleTotals.sold, "#34d399"]');

// Add vehicle button text node
r("A\u00f1adir nuevo veh\u00edculo", '{t("dashboard.vehAddNew")}');

// Add vehicle form header
r("A\u00f1adir veh\u00edculo propio</div>", '{t("dashboard.vehAddOwn")}</div>');
r("Crea tu garage personal con fotos, documentaci\u00f3n y acciones r\u00e1pidas.</div>", '{t("dashboard.vehAddSubtitle")}</div>');

// Back to list
r("Volver al listado", '{t("dashboard.vehBackToList")}');

// Save buttons
r('editingVehicleId ? "Guardar cambios" : "Guardar en mis veh\u00edculos"', 'editingVehicleId ? t("dashboard.vehSaveChanges") : t("dashboard.vehSaveNew")');

// Cancel edit
r("Cancelar edici\u00f3n", '{t("dashboard.vehCancelEdit")}');

// Form intro
r("C\u00f3mo quieres registrar el veh\u00edculo?", '{t("dashboard.vehFillMode")}');
r("Cat\u00e1logo ERP", '{t("dashboard.vehModeErp")}');
r("Datos manuales", '{t("dashboard.vehModeManual")}');
r("Caracter\u00edsticas del veh\u00edculo", '{t("dashboard.vehCharacteristics")}');

// Field labels (use partial matching to avoid duplication issues)
r(">Alias / Nombre<", '>{t("dashboard.vehAlias")}<');
r('placeholder="Alias (opcional)"', 'placeholder={t("dashboard.vehAliasPlaceholder")}');
r(">Marca *<", '>{t("dashboard.vehBrand")} *<');
r(">Cargando marcas...<", '>{t("dashboard.vehBrandLoading")}<');
r(">Seleccionar marca<", '>{t("dashboard.vehBrandSelect")}<');
r(">Modelo *<", '>{t("dashboard.vehModel")} *<');
r(">Cargando modelos...<", '>{t("dashboard.vehModelLoading")}<');
r(">Selecciona primero una marca<", '>{t("dashboard.vehModelSelectFirst")}<');
r(">Seleccionar modelo<", '>{t("dashboard.vehModelSelect")}<');
r(">Versi\u00f3n / Variante<", '>{t("dashboard.vehVersion")}<');
r(">Cargando versiones...<", '>{t("dashboard.vehVersionLoading")}<');
r(">Selecciona primero un modelo<", '>{t("dashboard.vehVersionSelectFirst")}<');
r(">Sin versi\u00f3n espec\u00edfica<", '>{t("dashboard.vehVersionNone")}<');
r(">Seleccionar versi\u00f3n<", '>{t("dashboard.vehVersionSelect")}<');
r('placeholder="Marca del veh\u00edculo"', 'placeholder={t("dashboard.vehBrandManualPlaceholder")}');
r('placeholder="Modelo del veh\u00edculo"', 'placeholder={t("dashboard.vehModelManualPlaceholder")}');
r('placeholder="Versi\u00f3n/variante (opcional)"', 'placeholder={t("dashboard.vehVersionManualPlaceholder")}');
r(">Marca<", '>{t("dashboard.vehBrand")}<');
r(">Modelo<", '>{t("dashboard.vehModel")}<');
r(">Versi\u00f3n<", '>{t("dashboard.vehVersion")}<');

// Transmission
r(">Seleccionar transmisi\u00f3n<", '>{t("dashboard.vehTransmissionSelect")}<');
r(">Manual<", '>{t("dashboard.vehTransmissionManual")}<');
r(">Autom\u00e1tico<", '>{t("dashboard.vehTransmissionAuto")}<');

// Body type
r(">Seleccionar carrocer\u00eda<", '>{t("dashboard.vehBodyType")}<');
r(">Berlina<", '>{t("dashboard.vehBodyBerlina")}<');
r(">Compacto<", '>{t("dashboard.vehBodyCompact")}<');
r(">Cabriolet<", '>{t("dashboard.vehBodyCabrio")}<');
r(">SUV<", '>{t("dashboard.vehBodySuv")}<');
r(">Familiar<", '>{t("dashboard.vehBodyFamiliar")}<');
r(">Cup\u00e9<", '>{t("dashboard.vehBodyCoupe")}<');
r(">Monovolumen<", '>{t("dashboard.vehBodyMonovolumen")}<');
r(">Pickup<", '>{t("dashboard.vehBodyPickup")}<');
r(">Todoterreno<", '>{t("dashboard.vehBodyTodoterreno")}<');
r(">Furgoneta<", '>{t("dashboard.vehBodyFurgoneta")}<');

// HP
r(">Potencia (CV)<", '>{t("dashboard.vehHp")}<');
r('placeholder="CV (opcional)"', 'placeholder={t("dashboard.vehHp")}');

// Year / plate / mileage / fuel / color
r(">A\u00f1o de matriculaci\u00f3n *<", '>{t("dashboard.vehYear")} *<');
r('placeholder="AAAA"', 'placeholder={t("dashboard.vehYear")}');
r(">Matr\u00edcula *<", '>{t("dashboard.vehPlate")} *<');
r('placeholder="Matr\u00edcula"', 'placeholder={t("dashboard.vehPlate")}');
r(">Kilometraje<", '>{t("dashboard.vehMileage")}<');
r('placeholder="km"', 'placeholder={t("dashboard.vehMileage")}');
r(">Combustible<", '>{t("dashboard.vehFuel")}<');
r('placeholder="Combustible"', 'placeholder={t("dashboard.vehFuelPlaceholder")}');
r('placeholder="p. ej. Blanco"', 'placeholder={t("dashboard.vehColorPlaceholder")}');

// Seats / doors / location / label
r(">Plazas<", '>{t("dashboard.vehSeats")}<');
r(">Puertas<", '>{t("dashboard.vehDoors")}<');
r(">Localizaci\u00f3n<", '>{t("dashboard.vehLocation")}<');
r(">Etiqueta personalizada<", '>{t("dashboard.vehLabel")}<');
r('placeholder="Ej: Mi coche del trabajo"', 'placeholder={t("dashboard.vehLabelPlaceholder")}');

// Internal notes
r(">Notas internas<", '>{t("dashboard.vehInternalNotes")}<');
r('placeholder="Notas adicionales del veh\u00edculo..."', 'placeholder={t("dashboard.vehNotesPlaceholder")}');

// MOT / CO2
r(">Última ITV<", '>{t("dashboard.vehLastMot")}<');
r(">Próxima ITV<", '>{t("dashboard.vehNextMot")}<');
r(">Emisiones CO₂<", '>{t("dashboard.vehCo2")}<');

// Market value / price
r(">Valor de mercado (\u20ac)<", '>{t("dashboard.vehMarketValue")}<');
r(">Precio fijo de venta (\u20ac)<", '>{t("dashboard.vehFixPrice")}<');

// Documents
r(">Documentos y fotos<", '>{t("dashboard.vehDocuments")}<');
r(">Fotos del veh\u00edculo<", '>{t("dashboard.vehPhotos")}<');
r(">Subir fotos<", '>{t("dashboard.vehUploadPhotos")}<');
r(">Documentaci\u00f3n t\u00e9cnica<", '>{t("dashboard.vehDocumentation")}<');
r(">Subir documentos<", '>{t("dashboard.vehUploadDocs")}<');

// Maintenance
r(">Mantenimiento<", '>{t("dashboard.vehMaintenance")}<');
r(">Tipo de mantenimiento<", '>{t("dashboard.vehMaintenanceType")}<');
r('placeholder="Ej: Cambio de aceite"', 'placeholder={t("dashboard.vehMaintenanceTypePlaceholder")}');
r(">Descripci\u00f3n<", '>{t("dashboard.vehMaintenanceDesc")}<');
r('placeholder="Descripci\u00f3n del servicio"', 'placeholder={t("dashboard.vehMaintenanceDescPlaceholder")}');
r(">Notas adicionales<", '>{t("dashboard.vehMaintenanceNotes")}<');
r('placeholder="Notas opcionales del mantenimiento"', 'placeholder={t("dashboard.vehMaintenanceNotesPlaceholder")}');
r(">Facturas / documentos<", '>{t("dashboard.vehMaintenanceInvoices")}<');
r(">A\u00f1adir registro de mantenimiento<", '>{t("dashboard.vehMaintenance")}<');

// Insurance
r(">Seguro del veh\u00edculo<", '>{t("dashboard.vehInsurance")}<');
r(">Aseguradora<", '>{t("dashboard.vehInsurer")}<');
r('placeholder="Nombre de la aseguradora"', 'placeholder={t("dashboard.vehInsurerPlaceholder")}');
r(">Tipo de cobertura<", '>{t("dashboard.vehCoverage")}<');
r('placeholder="Todo riesgo, terceros..."', 'placeholder={t("dashboard.vehCoveragePlaceholder")}');
r(">N\u00famero de p\u00f3liza<", '>{t("dashboard.vehPolicy")}<');
r('placeholder="N\u00ba p\u00f3liza"', 'placeholder={t("dashboard.vehPolicyPlaceholder")}');

// Empty state
r("Todav\u00eda no tienes veh\u00edculos en tu garaje.", '{t("dashboard.vehEmpty")}');

// Publish dialog
r("Publicar en Marketplace", 't("dashboard.vehDialogTitle")');
r(">Precio de publicaci\u00f3n<", '>{t("dashboard.vehDialogPrice")}<');
r('publishLoading ? "Publicando..." : "Confirmar publicaci\u00f3n"', 'publishLoading ? t("dashboard.vehPublishing") : t("dashboard.vehDialogPublish")');

// Pipeline and actions
r(">Ver ciclo de vida<", '>{t("dashboard.vehViewPipeline")}<');
r(">Solicitar tasaci\u00f3n<", '>{t("dashboard.vehRequestVal")}<');
r(">Reservar cita<", '>{t("dashboard.vehBookAppt")}<');
r(">Gestionar seguro<", '>{t("dashboard.vehManageInsurance")}<');
r(">Publicar en marketplace<", '>{t("dashboard.vehPublish")}<');
r(">Editar<", '>{t("dashboard.vehEdit")}<');
r(">Eliminar veh\u00edculo<", '>{t("dashboard.vehRemove")}<');
r(">Ocultar gesti\u00f3n<", '>{t("dashboard.vehHideManage")}<');
r(">Gestionar<", '>{t("dashboard.vehManage")}<');

// Feedback strings
r('"Matr\u00edcula requerida."', 't("dashboard.vehFeedbackSaved")');
r('"Veh\u00edculo eliminado de Mis veh\u00edculos."', 't("dashboard.vehFeedbackDeleted")');

// No photo
r(">Sin foto<", '>{t("dashboard.vehNoPhoto")}<');

// No open photo
r('">No hay foto disponible"', 't("dashboard.vehNoPhoto")');

fs.writeFileSync(p, s, { encoding: "utf8" });
console.log("Done. Replacements applied:", count, "| Bytes:", s.length);
