/**
 * La marca, del lado del navegador.
 *
 * Es un gemelo de `lib/marca.js` a proposito, no un descuido: create-react-app
 * monta un ModuleScopePlugin que prohibe importar nada de fuera de `src/`, asi
 * que una pantalla no puede leer el fichero del servidor por mucho que sea el
 * mismo dato. La alternativa era la que habia: el dominio escrito a mano en
 * cinco sitios de `src/` y en `public/index.html`, y al cambiarlo se quedaba
 * medio actualizado sin que nada lo dijera.
 *
 * Que los dos ficheros no se separen lo vigila `npm run test:marca`, que los
 * compara y falla si dicen cosas distintas.
 *
 * Aqui no van colores: los de pantalla estan en las hojas de estilo, y los de
 * `lib/marca.js` son para los PDF y los correos, que se pintan en el servidor.
 */

export const NOMBRE = "PopCar";
export const SITIO = "www.popcar.com.es";
export const SITIO_URL = "https://www.popcar.com.es";

/** El dominio a secas, para comparar contra el host de una URL. */
export const DOMINIO = "popcar.com.es";

/**
 * El dominio anterior. Sigue sirviendo y redirige al nuevo, y hay imagenes
 * guardadas en la base con URLs suyas: si desaparece de las comprobaciones,
 * esas fichas dejan de enseñar foto.
 */
export const DOMINIO_ANTERIOR = "popcar.tech";
