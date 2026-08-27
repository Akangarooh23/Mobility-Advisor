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

  // Solo vale un dominio verificado en Resend: mandar desde otro no falla en
  // silencio, rebota. popcar.tech ya lo está —comprobado contra la cuenta—, así
  // que la reserva deja de apuntar al dominio viejo. Esto es lo que sale si no
  // hay RESEND_FROM_EMAIL, y hasta ahora era una dirección de CarsWise.
  remitentePorDefecto: "PopCar <notifications@popcar.tech>",

  // Donde vive el backoffice, para los enlaces de los avisos internos. El
  // subdominio erp.popcar.tech nunca se creo —comprobado, da 404— y habia un
  // boton apuntando ahi. Se puede cambiar con ERP_URL.
  get urlErp() {
    return String(process.env.ERP_URL || "https://carswise-erp-backoffice-api.vercel.app").replace(/\/$/, "");
  },

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
 * La direccion de contacto que se ensena y a la que se responde.
 *
 * Estaba escrita aqui como hola@carswiseai.com y ese buzon no existe: no lo
 * lee nadie y nada de lo que se mande ahi llega a ninguna parte. Salia en el
 * pie de las facturas en PDF, en el bot y como reserva del reply_to.
 *
 * Ahora vive en CONTACT_EMAIL. Sin variable devuelve cadena vacia a proposito:
 * es mejor que una factura no ensene ningun correo a que ensene uno muerto.
 * Quien la usa comprueba antes si hay algo.
 */
function correoSoporte() {
  return String(process.env.CONTACT_EMAIL || "").trim();
}
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

/**
 * A donde va la respuesta cuando un cliente le da a Responder.
 *
 * Hace falta porque el remitente es un buzon que no existe: popcar.tech no
 * tiene MX, asi que un correo enviado a notifications@ no llega a ninguna
 * parte. Sin reply_to, la respuesta de un cliente a su factura o al
 * recordatorio de su cita se pierde y nadie se entera de que existio.
 *
 * El valor real se pone en REPLY_TO_EMAIL. Aqui solo hay una direccion del
 * dominio, no un correo personal: este repositorio es publico.
 */
function respuestaA() {
  const nt = (v) => String(v || "").trim();
  return nt(process.env.REPLY_TO_EMAIL) || correoSoporte() || undefined;
}

/**
 * A donde van los avisos que lee el equipo: un lead nuevo, una visita
 * reservada, una solicitud de servicio.
 *
 * Estaban repartidos en cinco sitios y cuatro de ellos tenian el correo
 * personal de alguien escrito a mano como valor de reserva —en un
 * repositorio publico, y usandose de verdad cuando faltaba la variable—.
 *
 * Cada aviso puede seguir teniendo su propia variable si hace falta
 * separarlos; esto es la base comun cuando no la tiene.
 */
let avisado = false;
function correoInterno() {
  const nt = (v) => String(v || "").trim();
  const destino = nt(process.env.INTERNAL_EMAIL) || correoSoporte();
  if (!destino && !avisado) {
    // Sin destino, el envio fallara en Resend con un error que no dice nada.
    // Mejor que el motivo real aparezca una vez en el registro.
    avisado = true;
    console.error("[marca] no hay destinatario para los avisos internos: pon INTERNAL_EMAIL o CONTACT_EMAIL.");
  }
  return destino;
}

module.exports = { MARCA, COLOR, remitente, respuestaA, correoInterno, correoSoporte };
