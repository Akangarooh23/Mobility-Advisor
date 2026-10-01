import { aJsonLd } from "./aJsonLd";

/**
 * Lo que vigila esta prueba.
 *
 * `App.js` mete el resultado dentro de un `<script type="application/ld+json">` con
 * `dangerouslySetInnerHTML`. Si un valor contiene `</script>`, la etiqueta se cierra
 * ahí y lo de detrás se ejecuta.
 *
 * Hoy no es alcanzable —solo entran constantes y los títulos de `blogPosts.js`, que
 * es un fichero del repositorio— y por eso esto es una inoculación: el día que
 * alguien añada el esquema `Vehicle` con el título de un coche rascado, ya está
 * puesto. Y el día que alguien «simplifique» esto a `JSON.stringify`, falla.
 */
describe("el JSON-LD no puede cerrar su propia etiqueta", () => {
  test("escapa el menor-que", () => {
    expect(aJsonLd({ name: "<b>hola</b>" })).toBe('{"name":"\\u003cb>hola\\u003c/b>"}');
  });

  test("y por tanto un </script> no sale literal", () => {
    const salida = aJsonLd({ name: "fin</script><script>alert(1)</script>" });
    expect(salida).not.toContain("</script>");
    expect(salida).toContain("\\u003c/script>");
  });

  test("sigue siendo JSON válido y con el mismo contenido", () => {
    /*
     * Esto es la mitad que importa: escapar no puede cambiar lo que lee Google.
     * `\u003c` es un escape de JSON, así que al interpretarlo vuelve a ser `<`.
     */
    const original = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Comparativa <2026> de SUV",
      url: "https://www.popcar.com.es/blog/suv",
    };
    expect(JSON.parse(aJsonLd(original))).toEqual(original);
  });

  test("no toca nada cuando no hay menor-que", () => {
    const sinNada = { name: "PopCar", url: "https://www.popcar.com.es/" };
    expect(aJsonLd(sinNada)).toBe(JSON.stringify(sinNada));
  });

  test("aguanta lo que no es un objeto", () => {
    // Por si algún día se le pasa un valor suelto: no debe reventar la página.
    expect(aJsonLd(null)).toBe("null");
    expect(aJsonLd("<x>")).toBe('"\\u003cx>"');
  });
});
