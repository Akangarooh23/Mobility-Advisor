/**
 * La marca, en un solo sitio.
 *
 * Todo lo que el cliente ve en un documento o en un correo —el nombre, el
 * dominio, los colores— sale de aquí. Antes estaba repetido a mano en cada
 * generador de PDF y en cada plantilla de correo, y cambiar de marca obligaba a
 * perseguir cadenas por media docena de ficheros.
 *
 * `razonSocial` va aparte del nombre comercial a propósito: es la entidad
 * inscrita, y lo que la factura tiene que decir es el nombre con el que la
 * sociedad figura en el Registro y en el CIF, no la marca. Son dos campos
 * distintos y se cambian en momentos distintos.
 *
 * Regla del amarillo, la misma que en la web: es relleno, o texto sobre negro.
 * Nunca texto pequeño sobre blanco — en papel y en un correo no llega al
 * contraste mínimo. Para eso está `amarilloTexto`, que es el mismo tono
 * llevado a una luminosidad legible.
 */

const MARCA = {
  nombre: "PopCar",
  sitio: "www.popcar.tech",
  sitioUrl: "https://www.popcar.tech",

  // El buzón sigue en el dominio viejo porque es el que existe y recibe. Cuando
  // haya hola@popcar.tech, se cambia aquí y ya está.
  correoSoporte: "hola@carswiseai.com",

  // Resend solo tiene verificado carswiseai.com. Mandar desde un dominio sin
  // verificar no falla en silencio: rebota. El nombre visible ya es el nuevo;
  // la dirección cambia el día que se verifique popcar.tech.
  remitentePorDefecto: "PopCar <noreply@carswiseai.com>",

  razonSocial: "PopCar Mobility S.L.",
};

const COLOR = {
  // Los tres oficiales de PopCar. Estos no se retocan.
  negro: "#111111",      // Pop Black  · 17, 17, 17
  amarillo: "#FFC400",   // Pop Yellow · 255, 196, 0
  blanco: "#FFFFFF",     // Pop White  · 255, 255, 255

  // Derivados del amarillo oficial, manteniendo la relación entre canales:
  // uno para el estado pulsado, otro para fondos suaves y otro para cuando el
  // acento tiene que ser texto sobre blanco (7,4:1 de contraste, pasa AA).
  amarilloOscuro: "#E6B000",
  amarilloTenue: "#FFF6D9",
  amarilloTexto: "#6B5200",

  negroProfundo: "#050505",

  texto: "#111111",
  textoSuave: "#5E5E59",
  textoTenue: "#96968F",
  linea: "#E4E4DF",
  fondoSuave: "#F7F7F3",
};

/**
 * Desde que direccion sale un correo.
 *
 * Estaba resuelto a mano en 25 sitios, y no todos en el mismo orden: el de
 * facturas miraba antes RESEND_FROM_EMAIL y el de restaurar contrasena antes
 * ALERT_EMAIL_FROM. Con las dos variables puestas a valores distintos, la
 * mitad de los correos salia con una direccion y la otra mitad con otra, y
 * eso no se ve en ningun sitio hasta que un cliente responde y no llega.
 *
 * Ahora el orden es uno: la variable especifica, la general, y si no hay
 * ninguna, lo que diga la marca.
 *
 * Se lee en cada llamada y no al cargar el modulo, porque en una funcion
 * serverless el modulo se cachea entre invocaciones y una variable que se
 * lee arriba del todo se queda congelada con el valor del primer arranque.
 */
function remitente() {
  const nt = (v) => String(v || "").trim();
  return nt(process.env.RESEND_FROM_EMAIL) || nt(process.env.ALERT_EMAIL_FROM) || MARCA.remitentePorDefecto;
}

module.exports = { MARCA, COLOR, remitente };
