const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardVehicles.js");
let s = fs.readFileSync(p, "utf8");
const hasCrlf = s.includes("\r\n");
// Work in LF, then restore CRLF at the end
if (hasCrlf) s = s.replace(/\r\n/g, "\n");

let count = 0;
function r(from, to) {
  if (!s.includes(from)) { console.warn("NOT FOUND:", from.substring(0, 80)); return; }
  s = s.replace(from, to);
  count++;
}

// vehicleTabs: replace "Mis vehículos" and use key-based section titles
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

// Marca label (inside JSX label, with newlines around)
r(
  "\n                Marca\n",
  "\n                {t(\"dashboard.vehBrandLabel\")}\n"
);

// Modelo label
r(
  "\n                Modelo\n",
  "\n                {t(\"dashboard.vehModelLabel\")}\n"
);

// Versión labels (there can be 2 occurrences — handle both with replaceAll workaround)
const versionCount = (s.match(/\n                Versión\n/g) || []).length;
console.log("Versión occurrences:", versionCount);
s = s.replace(/\n                Versión\n/g, "\n                {t(\"dashboard.vehVersionLabel\")}\n");
count += versionCount;

// "Fijar precio manual" button text
r(
  "\n                      Fijar precio manual\n",
  "\n                      {t(\"dashboard.vehPriceFixed\")}\n"
);

// "Primero tasar el coche" button text  
r(
  "\n                      Primero tasar el coche\n",
  "\n                      {t(\"dashboard.vehPriceValuate\")}\n"
);

// "Guardados en ficha" label
r(
  "\n          Guardados en ficha\n",
  "\n          {t(\"dashboard.vehSavedInFile\")}\n"
);

// Save success feedback (multiline)
r(
  `    setVehicleFeedback(
      skippedLargeFilesCount > 0
        ? \`Vehículo \${title} \${existingVehicle ? "actualizado" : "guardado"}. \${skippedLargeFilesCount} ficheros superaban 2 MB y se guardaron sin contenido.\`
        : \`Vehículo \${title} \${existingVehicle ? "actualizado" : "guardado en Mis vehículos"}.\`
    );`,
  `    setVehicleFeedback(
      existingVehicle ? t("dashboard.vehSavedUpdated", { title }) : t("dashboard.vehSavedNew", { title })
    );`
);

// Card action buttons
r("\n                        Quitar\n", "\n                        {t(\"dashboard.vehDeleteBtn\")}\n");
r("\n                        Editar\n", "\n                        {t(\"dashboard.vehEditBtn\")}\n");
r("\n                            Pedir cita\n", "\n                            {t(\"dashboard.vehRequestAppointment\")}\n");
r("\n                            Solicitar tasación\n", "\n                            {t(\"dashboard.vehRequestValuation\")}\n");
r("\n                            Gestionar seguro\n", "\n                            {t(\"dashboard.vehManageInsurance\")}\n");
r("\n                            Publicar\n", "\n                            {t(\"dashboard.vehPublish\")}\n");

if (hasCrlf) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(p, s, "utf8");
console.log("Vehicles.js patched.", count, "replacements.");
