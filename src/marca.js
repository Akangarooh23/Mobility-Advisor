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

/**
 * La direccion a la que se le dice al cliente que escriba.
 *
 * Es la unica de la casa que recibe de verdad. Aqui habia tres repartidas por
 * las pantallas y los textos legales —soporte@ y privacidad@carswiseai.com, y
 * hola@carswise.es—, y ninguna de las dos zonas tiene registro MX: carswise.es
 * ni siquiera resuelve. Comprobado contra el DNS. Un correo enviado a
 * cualquiera de ellas no llegaba a ningun sitio, y estaban debajo de "¿Dudas?
 * Contacta con PopCar" y en el apartado de ejercer derechos del RGPD.
 *
 * No lleva el dominio de la web a proposito: el buzon vive en el Microsoft 365
 * de popcarmobility.com, que es donde esta dado de alta. Que no coincida con
 * popcar.com.es se ve raro pero funciona; al reves se veia bien y no llegaba.
 */
export const CORREO_CONTACTO = "hola@popcarmobility.com";
