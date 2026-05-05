const fs = require("fs");
const path = require("path");
const s = fs.readFileSync(path.join(__dirname,"..","src","pages","userDashboard","UserDashboardVehicles.js"), "utf8");
const matches = [...s.matchAll(/t\("dashboard\.([^"]+)"\)/g)].map(m => m[1]);
const unique = [...new Set(matches)];
const en = require(path.join(__dirname,"..","src","locales","en.json")).dashboard;
const missing = unique.filter(k => !(k in en));
console.log("Total t() calls:", unique.length);
console.log("Missing keys:", JSON.stringify(missing, null, 2));
