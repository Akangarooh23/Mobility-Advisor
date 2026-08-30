/**
 * Poner la página del panel y acto seguido «entrar» no lleva a esa página.
 *
 * `handleUserAccessClick` es «entrar en mi panel»: decide la página él solo, a
 * partir de la dirección del navegador, y si no hay ninguna deja el resumen. Un
 * `setUserDashboardPage("solicitudes")` justo antes se lo lleva por delante.
 *
 * Eso es lo que le pasaba a la campana: enseñaba un 1, la pulsabas estando ya en
 * el panel y no ocurría nada, porque ponía «solicitudes» y la llamada siguiente
 * lo devolvía a «home». Sin error, sin aviso: un botón muerto.
 *
 * Para ir a una página concreta está `navigateToUserDashboardPage`, que además
 * sincroniza la dirección. Esto vigila que no vuelva a colarse el par.
 */
const fs = require("fs");
const path = require("path");

const APP = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");

test("nadie pone una página del panel para que la siguiente línea la pise", () => {
  // `setUserDashboardPage(...)` y, en las tres líneas siguientes,
  // `handleUserAccessClick()`.
  const lineas = APP.split("\n");
  const sospechosas = [];
  lineas.forEach((linea, i) => {
    if (!/setUserDashboardPage\(\s*["']/.test(linea)) return;
    const siguientes = lineas.slice(i + 1, i + 4).join(" ");
    if (/handleUserAccessClick\(\)/.test(siguientes)) {
      sospechosas.push(`App.js:${i + 1} — ${linea.trim()}`);
    }
  });

  expect(sospechosas).toEqual([]);
});

test("la campana lleva a las solicitudes, que es donde está la cita", () => {
  const campana = APP.slice(APP.indexOf("<CampanaAvisos"), APP.indexOf("<CampanaAvisos") + 600);
  expect(campana).toMatch(/navigateToUserDashboardPage\(\s*["']solicitudes["']\s*\)/);
});
