const fs = require("fs");
const s = fs.readFileSync("src/pages/userDashboard/UserDashboardVehicles.js", "utf8");
const lines = s.split("\n");
const tCalls = lines.filter(l => l.includes('t("dashboard')).length;
console.log("t() dashboard calls:", tCalls);
// Check if key Spanish strings remain hardcoded
const checks = ["MIS VEH", "Hub de ciclo", "Vehículos en garaje", "Añadir vehículo", "Guardar cambios", "Matrícula", "Kilometraje", "Combustible", "Carrocería", "Transmisión"];
for (const c of checks) {
  const found = lines.some(l => l.includes(c));
  console.log(found ? "HARDCODED:" : "replaced:", c);
}
