const fs = require("fs");
const path = require("path");

// Add extra locale keys
const enPath = path.join(__dirname, "..", "src", "locales", "en.json");
const esPath = path.join(__dirname, "..", "src", "locales", "es.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const es = JSON.parse(fs.readFileSync(esPath, "utf8"));

Object.assign(en.dashboard, {
  vehPlaceholderBrand: "Enter brand",
  vehPlaceholderModel: "Enter model",
  vehKm: "Km",
  vehBody: "Body",
  vehGoValuation: "Go to valuation",
  vehPublishConfirm: "Publish",
  vehCardYear: "Year",
  vehCardFuel: "Fuel",
  vehCardKm: "Km",
  vehCardTransmission: "Gearbox",
  vehCardColor: "Color",
  vehCardDoors: "Doors",
  vehCardCv: "HP",
  vehCardBody: "Body",
  vehCardLabel: "Label",
  vehCardSeats: "Seats",
});
Object.assign(es.dashboard, {
  vehPlaceholderBrand: "Escribe la marca",
  vehPlaceholderModel: "Escribe el modelo",
  vehKm: "Km",
  vehBody: "Carrocer\u00eda",
  vehGoValuation: "Ir a tasaci\u00f3n",
  vehPublishConfirm: "Publicar",
  vehCardYear: "A\u00f1o",
  vehCardFuel: "Comb.",
  vehCardKm: "Km",
  vehCardTransmission: "Cambio",
  vehCardColor: "Color",
  vehCardDoors: "Puertas",
  vehCardCv: "CV",
  vehCardBody: "Carrocer\u00eda",
  vehCardLabel: "Etiqueta",
  vehCardSeats: "Asientos",
});

fs.writeFileSync(enPath, JSON.stringify(en, null, 2), "utf8");
fs.writeFileSync(esPath, JSON.stringify(es, null, 2), "utf8");
console.log("Extra locale keys added.");

// Patch Vehicles.js
const p = path.join(__dirname, "..", "src", "pages", "userDashboard", "UserDashboardVehicles.js");
let s = fs.readFileSync(p, "utf8");
const hasCrlf = s.includes("\r\n");
if (hasCrlf) s = s.replace(/\r\n/g, "\n");
let count = 0;

function r(from, to) {
  if (!s.includes(from)) { console.warn("NOT FOUND:", from.substring(0, 80)); return; }
  s = s.replace(from, to);
  count++;
}

// Brand placeholder
r(
  'placeholder="Escribe la marca"',
  'placeholder={t("dashboard.vehPlaceholderBrand")}'
);

// Model placeholder
r(
  'placeholder="Escribe el modelo"',
  'placeholder={t("dashboard.vehPlaceholderModel")}'
);

// Insurance documents label
r(
  '<div>Documentos del seguro</div>',
  '<div>{t("dashboard.vehInsuranceDocs")}</div>'
);

// Vehicle card data array (labels inside the summary grid)
r(
  `["📅", "Año", vehicle.year],
                          ["⛽", "Comb.", vehicle.fuel],
                          ["🛣️", "Km", vehicle.mileage ? Number(vehicle.mileage).toLocaleString("es-ES") + " km" : null],
                          ["⚙️", "Cambio", vehicle.transmissionType],
                          ["🎨", "Color", vehicle.color],
                          ["🚪", "Puertas", vehicle.doors],
                          ["💪", "CV", vehicle.cv],
                          ["🚗", "Carrocería", vehicle.bodyType],
                          ["🏷️", "Etiqueta", vehicle.environmentalLabel],
                          ["💺", "Asientos", vehicle.seats],`,
  `["\u{1F4C5}", t("dashboard.vehCardYear"), vehicle.year],
                          ["\u26FD", t("dashboard.vehCardFuel"), vehicle.fuel],
                          ["\u{1F6E3}\uFE0F", t("dashboard.vehCardKm"), vehicle.mileage ? Number(vehicle.mileage).toLocaleString("es-ES") + " km" : null],
                          ["\u2699\uFE0F", t("dashboard.vehCardTransmission"), vehicle.transmissionType],
                          ["\u{1F3A8}", t("dashboard.vehCardColor"), vehicle.color],
                          ["\u{1F6AA}", t("dashboard.vehCardDoors"), vehicle.doors],
                          ["\u{1F4AA}", t("dashboard.vehCardCv"), vehicle.cv],
                          ["\u{1F697}", t("dashboard.vehCardBody"), vehicle.bodyType],
                          ["\u{1F3F7}\uFE0F", t("dashboard.vehCardLabel"), vehicle.environmentalLabel],
                          ["\u{1F4BA}", t("dashboard.vehCardSeats"), vehicle.seats],`
);

// Marketplace publish dialog button
r(
  '? "Ir a tasación"\n                          : "Publicar"',
  '? t("dashboard.vehGoValuation")\n                          : t("dashboard.vehPublishConfirm")'
);

if (hasCrlf) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(p, s, "utf8");
console.log("Vehicles.js patched.", count, "replacements.");
