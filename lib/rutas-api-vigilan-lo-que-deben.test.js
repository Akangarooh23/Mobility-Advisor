"use strict";

/**
 * La prueba de la prueba.
 *
 * `scripts/comprueba-rutas-api.js` decide si el repositorio puede desplegarse,
 * y su regla se equivocaba en las dos direcciones a la vez:
 *
 *   · **gritaba donde no había nada.** Daba por mala cualquier línea con
 *     `= "/api/…"`, incluida `ruta = "/api/mandato-firmado"` de
 *     `LoQueTeFaltaDelEncargo`, que al usarse pasa por `rutaApi(ruta)` y por
 *     tanto lleva la base. Dejó el comprobador en rojo con nada roto;
 *
 *   · **y callaba donde sí lo había.** No veía
 *     `const API = apiBase || "/api/visit-availability"` de
 *     `AvailabilityEditor`, porque el literal no iba pegado al `=`. De ahí
 *     salían cuatro `fetch` sin base, y ninguno de los cuatro sitios que montan
 *     ese componente pasa `apiBase`: dentro del APK, poner franjas de visita
 *     fallaba sin decir por qué. Que es exactamente lo que ese comprobador
 *     existe para impedir.
 *
 * Una prueba que hace las dos cosas acaba desactivada, y con razón. Así que
 * ahora las dos formas están escritas aquí, con el nombre del fichero del que
 * salieron.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { revisaFuente } = require("../scripts/comprueba-rutas-api");

describe("lo que tiene que dejar pasar", () => {
  test("una ruta relativa que se envuelve al usarla", () => {
    // El caso de src/components/LoQueTeFaltaDelEncargo.js
    const fuente = `
      function SubirElMandato({ ruta = "/api/mandato-firmado" }) {
        const res = await fetch(rutaApi(ruta), { method: "POST" });
      }
    `;
    assert.deepEqual(revisaFuente(fuente), []);
  });

  test("una constante ya envuelta al definirla", () => {
    // El caso de src/pages/MiCitaPage.js
    const fuente = `
      const API = rutaApi("/api/visit-availability");
      const r = await fetch(\`\${API}?offerId=1\`);
    `;
    assert.deepEqual(revisaFuente(fuente), []);
  });

  test("y una ruta guardada que nunca llega a un fetch", () => {
    // Una ruta que se enseña o se compone para otra cosa no es una llamada.
    const fuente = `const DONDE_MIRAR = "/api/leads"; console.log(DONDE_MIRAR);`;
    assert.deepEqual(revisaFuente(fuente), []);
  });
});

describe("lo que tiene que cazar", () => {
  test("la ruta escrita a pelo dentro del fetch", () => {
    const fallos = revisaFuente(`await fetch("/api/leads", { method: "POST" });`);
    assert.equal(fallos.length, 1);
    assert.match(fallos[0], /escrita a pelo/);
  });

  test("y la de reserva que va a un fetch sin base", () => {
    /*
     * Este es el que se escapaba, y el que de verdad estaba roto en la app.
     * Si esta prueba deja de fallar con esta fuente, la regla ha vuelto a
     * quedarse corta.
     */
    const fuente = `
      export default function AvailabilityEditor({ apiBase }) {
        const API = apiBase || "/api/visit-availability";
        const r = await fetch(\`\${API}?offerId=1\`);
      }
    `;
    const fallos = revisaFuente(fuente);
    assert.equal(fallos.length, 1, "esta es la forma que rompía las franjas en el APK");
    assert.match(fallos[0], /sin base y la usa en un fetch/);
  });

  test("y la variable suelta que se pasa entera al fetch", () => {
    const fuente = `
      const API = "/api/visit-availability";
      const r = await fetch(API, { method: "POST" });
    `;
    assert.equal(revisaFuente(fuente).length, 1);
  });
});

describe("y lo que no es una llamada", () => {
  test("un comentario que enseña la ruta es documentación", () => {
    const fuente = `
      // Ejemplo: const API = "/api/leads"; await fetch(API);
      const API = rutaApi("/api/leads");
      await fetch(API);
    `;
    assert.deepEqual(revisaFuente(fuente), []);
  });
});

/**
 * Y las direcciones que acaban en un enlace, no en un `fetch`.
 *
 * Esta regla llegó tarde. `src/hooks/useConditionReport.js` devolvía:
 *
 *     descargaUrl: `/api/market?route=condition-report&vehicleId=${vid}...`
 *
 * y `ConditionReportDownload` lo pintaba como `<a href={url} target="_blank">`,
 * a propósito: el navegador sabe abrir un PDF y así funcionan el clic derecho y
 * «guardar como».
 *
 * Como no hay ningún `fetch` por medio, las reglas anteriores ni lo miraban. En
 * el navegador daba igual —`API_BASE` es cadena vacía— pero dentro del APK esa
 * dirección no lleva a ninguna parte, exactamente igual que pasó con las
 * franjas de visita.
 */
describe("las direcciones que van a un href", () => {
  test("una propiedad *Url con la ruta a pelo se caza", () => {
    const fuente = `
      const informe = {
        descargaUrl: terminado ? \`/api/market?route=condition-report&vehicleId=\${vid}\` : "",
      };
    `;
    const fallos = revisaFuente(fuente);
    assert.equal(fallos.length, 1, "este es el caso que se escapó");
    assert.match(fallos[0], /sin base/);
  });

  test("y envuelta en rutaApi pasa", () => {
    const fuente = `
      const informe = {
        descargaUrl: terminado ? rutaApi(\`/api/market?route=condition-report&vehicleId=\${vid}\`) : "",
      };
    `;
    assert.deepEqual(revisaFuente(fuente), []);
  });

  test("href y src, igual", () => {
    assert.equal(revisaFuente('<a href="/api/informe.pdf">bajar</a>').length, 1);
    assert.equal(revisaFuente('const src = "/api/foto.jpg";').length, 1);
  });
});
