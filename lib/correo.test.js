/**
 * La maqueta de los correos de PopCar.
 *
 * Un correo enviado no se puede corregir, y es lo único de todo el sistema que
 * ve alguien de fuera. Lo que se fija aquí:
 *
 *   · Que lo que escribe una persona —su nombre, el título de un coche, una
 *     nota— no pueda escribir HTML en el correo.
 *   · Que las direcciones que vienen de portales de fuera acaben en el `href`
 *     sin poder salirse del atributo.
 *   · Que no vuelva lo que se acaba de quitar: el azul, el verde, los emoji y
 *     la marca anterior.
 *
 * Se ejecuta con `npm run test:lib` (Jest de CRA solo mira dentro de src/).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  plantilla, parrafo, datos, aviso, boton, botones, enlace, esc, urlSegura,
} = require("./correo");
const { COLOR } = require("./marca");

describe("lo que escribe una persona no escribe HTML", () => {
  test("las etiquetas se quedan en texto", () => {
    assert.equal(esc("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("las comillas no dejan salirse de un atributo", () => {
    assert.ok(!esc('" onmouseover="robar()').includes('"'));
    assert.ok(!esc("' onclick='x").includes("'"));
  });

  test("el ampersand se escapa antes que nada", () => {
    // Si se escapara al final, `&lt;` volvería a convertirse en `<`.
    assert.equal(esc("&lt;script&gt;"), "&amp;lt;script&amp;gt;");
  });

  test("sin dato no se escribe «undefined»", () => {
    assert.equal(esc(undefined), "");
    assert.equal(esc(null), "");
  });

  test("un nombre normal no se toca", () => {
    assert.equal(esc("Citroën C4 Hybrid 145 E-DC56 Max"), "Citroën C4 Hybrid 145 E-DC56 Max");
  });
});

describe("las direcciones que van a un href", () => {
  test("una dirección de portal, con sus parámetros, pasa escapada", () => {
    assert.equal(urlSegura("https://x.es/ver?id=15&codigo=abc"), "https://x.es/ver?id=15&amp;codigo=abc");
  });

  test("no se puede salir del atributo", () => {
    assert.ok(!urlSegura('https://x.com/" onmouseover="robar()').includes('"'));
  });

  test("javascript: y compañía no salen en un correo", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,<script>x</script>", "file:///etc/passwd", "//evil.com"]) {
      assert.equal(urlSegura(u), "", u);
    }
  });

  test("el botón y el enlace usan esa limpieza", () => {
    assert.ok(!boton("Ir", "javascript:alert(1)").includes("javascript"));
    assert.ok(!enlace("Ver", 'https://x.com/" onclick="y').includes('onclick="y'));
  });

  test("los dos botones también", () => {
    const html = botones({ texto: "Sí", url: "javascript:x" }, { texto: "No", url: "https://x.es" });
    assert.ok(!html.includes("javascript"));
    assert.ok(html.includes("https://x.es"));
  });
});

describe("la caja de datos", () => {
  test("una fila sin valor no se pinta", () => {
    // Media docena de correos arman la caja con campos opcionales. Una fila
    // que diga «Hora: » es peor que no ponerla.
    const html = datos([["Fecha", "8 de septiembre"], ["Hora", ""], ["Dirección", null]]);
    assert.ok(html.includes("Fecha"));
    assert.ok(!html.includes("Hora"));
    assert.ok(!html.includes("Dirección"));
  });

  test("sin ninguna fila no se pinta la caja", () => {
    assert.equal(datos([["Hora", ""], ["Sitio", undefined]]), "");
  });
});

describe("la maqueta", () => {
  const correo = plantilla({
    titulo: "Tu cita está confirmada",
    cuerpo:
      parrafo("Hola <strong>Ana</strong>,") +
      datos([["Fecha", "martes, 8 de septiembre"]]) +
      aviso("Confirma la cita", "Si no la confirmas, el turno puede asignarse a otro cliente.") +
      boton("Ver mi cita", "https://www.popcar.tech/panel"),
    pie: "Recibes este correo porque pediste ver un vehículo en PopCar.",
  });

  test("es un documento completo", () => {
    assert.ok(correo.startsWith("<!doctype html>"));
    assert.ok(correo.includes('<meta charset="utf-8">'));
    assert.ok(correo.trim().endsWith("</html>"));
  });

  test("lleva la marca de ahora, no la de antes", () => {
    assert.ok(correo.includes("PopCar"));
    assert.ok(!/carswise/i.test(correo));
  });

  test("sin los colores de la maqueta vieja", () => {
    // El azul #2563eb y el verde #059669 estaban en veintiún sitios.
    assert.ok(!/2563eb|059669/i.test(correo));
  });

  test("con los colores de la marca", () => {
    assert.ok(correo.includes(COLOR.negro));
    assert.ok(correo.includes(COLOR.amarillo));
  });

  test("sin emoji", () => {
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(correo));
  });

  test("el título también se escapa", () => {
    assert.ok(!plantilla({ titulo: "<script>x</script>", cuerpo: "" }).includes("<script>"));
  });

  test("va con tablas y estilos a mano, que es lo que aguanta en Gmail", () => {
    // Gmail borra cualquier <style>: un correo que dependa de él se ve roto.
    assert.ok(!correo.includes("<style"));
    assert.ok(correo.includes('role="presentation"'));
  });

  test("el pie solo aparece si se le da", () => {
    assert.ok(correo.includes("Recibes este correo porque"));
    assert.ok(!plantilla({ titulo: "x", cuerpo: "" }).includes("Recibes este correo"));
  });
});
