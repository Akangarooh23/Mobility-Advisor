/**
 * El JSON-LD, sin poder cerrar su propia etiqueta.
 *
 * ## Qué pasaba
 *
 * `App.js` pinta los esquemas de datos estructurados así:
 *
 *     <script type="application/ld+json"
 *             dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
 *
 * Y `JSON.stringify` **no escapa `<`**. Si algún valor contiene `</script>`, la
 * etiqueta se cierra ahí y lo que venga detrás lo ejecuta el navegador.
 *
 * ## Por qué se arregla si hoy no es alcanzable
 *
 * Hoy no lo es, y lo comprobé hasta el final: lo único que entra en esos esquemas
 * son `SITE_NAME`, `SITE_URL`, `SITE_LOGO_URL` y los títulos y «slugs» de
 * `src/data/blogPosts.js`, que es un fichero estático del repositorio. Para
 * atacarlo habría que commitear primero, y entonces el XSS es el menor de los
 * problemas.
 *
 * Se pone porque es una línea y porque el día que alguien añada el esquema
 * `Vehicle` con el título de un coche rascado —que es el siguiente paso obvio de
 * SEO para el marketplace, y esos títulos vienen de portales ajenos— pasa a ser un
 * XSS almacenado **sin que nada avise**. Inocular ahora cuesta nada; descubrirlo
 * después cuesta una incidencia.
 *
 * ## Por qué `<` y no otra cosa
 *
 * Es un escape válido de JSON, así que cualquier lector —Google incluido— ve
 * exactamente el mismo `<` al interpretarlo. No se pierde nada y no hay que tocar
 * los datos.
 */
export function aJsonLd(objeto) {
  return JSON.stringify(objeto).replace(/</g, "\\u003c");
}
