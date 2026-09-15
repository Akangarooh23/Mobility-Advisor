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
const TASACIONES = lee("..", "src", "pages", "userDashboard", "UserDashboardValuations.js");
const FICHA = lee("..", "src", "pages", "userDashboard", "UserDashboardVehicles.js");

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
});

describe("el botón está en los dos sitios", () => {
  test("en la lista de tasaciones", () => {
    assert.match(TASACIONES, /route=tasacion-pdf&id=/);
  });

  test("y en la ficha del coche", () => {
    // Es donde Ana lo pidió la segunda vez: mirando su coche, no la lista.
    assert.match(FICHA, /route=tasacion-pdf&id=/);
    assert.match(FICHA, /laTasacion\.id/);
  });

  test("y no se esconde cuando no hay PDF guardado", () => {
    /*
     * Lo escondía, y dejaba al cliente buscando un botón que no existe: la
     * pregunta llegó por otro lado, que es justo lo que la pantalla tenía que
     * haber resuelto sola. Ahora la ruta lo rehace la primera vez que se pide.
     */
    assert.doesNotMatch(TASACIONES, /item\.pdfPath \?/,
      "el botón vuelve a esconderse cuando no hay PDF guardado");
  });
});

describe("una tasación vieja se rehace, no se recalcula", () => {
  test("con el precio que se le dijo", () => {
    /*
     * Recalcularlo da otro número: en la prueba real, 20.036 € frente a los
     * 20.795 € guardados. Un informe que contradice el número de su propia
     * ficha es peor que no tener informe.
     */
    assert.match(HANDLER, /rehazElInforme\(\{/);
    assert.match(HANDLER, /precioGuardado: suya\.estimate_value/);
  });

  test("y se guarda, para no rehacerlo en cada descarga", () => {
    assert.match(HANDLER, /UPDATE moveadvisor_user_valuations SET pdf_path/);
  });

  test("si no se puede rehacer, se dice dónde está", () => {
    // Sin coche en el garaje no hay con qué. Un 404 pelado parece un fallo nuestro.
    assert.match(HANDLER, /sin_archivar/);
    assert.match(HANDLER, /lo tienes en el correo/i);
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
    assert.match(HANDLER, /WHERE t\.id = \$1 AND lower\(t\.user_email\) = lower\(\$2\)/);
  });

  test("la dirección que se da caduca", () => {
    // Sin caducidad sería una URL pública con más pasos.
    assert.match(HANDLER, /urlFirmada\(camino, SEGUNDOS\)/);
    assert.match(HANDLER, /const SEGUNDOS = \d+/);
  });
});
