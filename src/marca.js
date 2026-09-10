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
 * El espacio de nombres de los UID de calendario. NO sigue a la marca.
 *
 * Un UID no es una direccion, es un identificador estable: es lo que hace que
 * reenviar una cita actualice la del calendario del cliente en vez de crear una
 * segunda. Las citas confirmadas antes del cambio de dominio llevan este valor,
 * asi que moverlo les daria un UID distinto al reenviarse y al cliente le
 * apareceria la cita duplicada. Nadie lo ve.
 */
export const DOMINIO_UID = "popcar.tech";

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

/**
 * El telefono al que se nos llama.
 *
 * Estaba escrito a mano en tres pantallas y con **dos valores distintos**: la
 * ficha del portal llevaba el bueno y la pagina de Contacto seguia enseñando un
 * `600 000 000` de relleno —en produccion, con su enlace de WhatsApp a un
 * numero que no es de nadie—. Quien entraba por Contacto no tenia forma de
 * llamarnos.
 */
export const TELEFONO = "+34 684 717 736";

/**
 * Y como lo quiere `wa.me`: pegado, con prefijo y sin signos.
 *
 * No se deriva del de arriba quitando caracteres. El dia que el numero lleve
 * una extension, derivarlo daria un enlace roto que nadie prueba porque abre
 * igual: WhatsApp no falla, simplemente no encuentra a nadie.
 */
export const TELEFONO_WHATSAPP = "34684717736";

/** El enlace de WhatsApp, ya montado. */
export const ENLACE_WHATSAPP = `https://wa.me/${TELEFONO_WHATSAPP}`;
