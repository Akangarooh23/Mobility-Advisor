"use strict";

/**
 * Que el informe de la tasación se pueda volver a bajar.
 *
 * Antes solo existía en el correo: se generaba, se mandaba adjunto y se tiraba.
 * Quien perdía ese correo se quedaba sin él — con el precio guardado en su
 * ficha y el documento en ninguna parte.
 *
 * El camino tiene cuatro saltos y en cada uno hay que nombrar el campo a mano:
 * se archiva al entregar, se escribe en la fila, se lee de vuelta y se prepara
 * para el panel. Es justo la forma del fallo que dejó las tasaciones sin coche
 * y sin precio, y el que se cae no da ningún error: el botón simplemente no
 * sale nunca.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const lee = (...p) => fs.readFileSync(path.join(__dirname, ...p), "utf8");
const TASACION = lee("tasacion.js");
const TIENDA = lee("billingStore.js");
const HANDLER = lee("api", "tasacion-pdf-handler.js");
const RUTAS = lee("..", "api", "market.js");
const MODELO = lee("..", "src", "utils", "userDashboardHelpers.js");
const PANTALLA = lee("..", "src", "pages", "userDashboard", "UserDashboardValuations.js");

describe("el PDF llega del correo al panel", () => {
  test("se archiva al entregarlo", () => {
    assert.match(TASACION, /pdfPath: await guardaElInforme\(/,
      "el informe no se archiva: no habría nada que descargar");
    assert.match(TASACION, /registrarEntregada\(\{ email, vehicle, reportData, pagada, pdfBuffer \}\)/,
      "el PDF no llega a quien lo archiva");
  });

  test("va al cajón privado, no al de las fotos", () => {
    /*
     * El informe lleva la matrícula y los datos de su coche. En el bucket
     * público es alcanzable por quien tenga la dirección, sin sesión.
     */
    assert.match(TASACION, /BUCKET_PRIVADO/);
  });

  test("se escribe en la fila", () => {
    assert.match(TIENDA, /pdf_path/, "la columna no se toca al escribir");
    assert.match(TIENDA, /normalizeText\(valuation\?\.pdfPath\)/,
      "el escritor no lee pdfPath: se guardaría vacío sin decir nada");
  });

  test("y una entrega sin PDF no borra el que ya estaba", () => {
    assert.match(TIENDA, /pdf_path = CASE WHEN EXCLUDED\.pdf_path <> '' THEN/);
  });

  test("se lee de vuelta", () => {
    assert.match(TIENDA, /val\.pdf_path/, "no se selecciona la columna");
    assert.match(TIENDA, /pdfPath: normalizeText\(row\.pdf_path\)/, "no se devuelve");
  });

  test("el modelo del panel lo conserva", () => {
    // El salto que se cayó con `vehicleId` y dejó la ficha diciendo «sin hacer».
    assert.match(MODELO, /pdfPath: normalizeText\(item\?\.pdfPath\)/);
  });

  test("y la pantalla solo ofrece la descarga si hay PDF", () => {
    /*
     * Las de antes de archivarlos no tienen ninguno. Un botón que lleva a un
     * error es peor que no tenerlo.
     */
    assert.match(PANTALLA, /item\.pdfPath \?/);
    assert.match(PANTALLA, /route=tasacion-pdf&id=/);
  });
});

describe("y solo se lo baja su dueño", () => {
  test("la ruta existe", () => {
    assert.match(RUTAS, /case "tasacion-pdf":\s*return tasacionPdfHandler/,
      "el botón apuntaría a una ruta que no existe");
  });

  test("hace falta sesión", () => {
    assert.match(HANDLER, /identidadDeLaPeticion/);
    assert.match(HANDLER, /res\.status\(401\)/);
  });

  test("y la tasación tiene que ser suya, comprobado en la base", () => {
    /*
     * El camino del fichero lleva el correo dentro, así que sería tentador
     * mirar si empieza por el suyo. Eso es comparar una cadena que viaja por la
     * red: se comprueba en la fila, que es donde consta de quién es.
     */
    assert.match(HANDLER, /WHERE id = \$1 AND lower\(user_email\) = lower\(\$2\)/);
  });

  test("la dirección que se da caduca", () => {
    // Sin caducidad sería una URL pública con más pasos.
    assert.match(HANDLER, /urlFirmada\(suya\.pdf_path, SEGUNDOS\)/);
    assert.match(HANDLER, /const SEGUNDOS = \d+/);
  });

  test("y de una tasación vieja se explica qué pasa, no un error pelado", () => {
    assert.match(HANDLER, /sin_archivar/);
    assert.match(HANDLER, /lo tienes en el correo/);
  });
});
