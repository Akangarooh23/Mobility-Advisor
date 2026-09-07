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
  sitio: "www.popcar.com.es",
  sitioUrl: "https://www.popcar.com.es",

  // El dominio a secas, sin www ni esquema. Va aparte porque hay dos sitios
  // que no quieren una URL: el UID de una invitación de calendario y la
  // comprobación de si una imagen es nuestra, que compara el host pelado.
  dominio: "popcar.com.es",

  // El dominio anterior. Sigue apuntando a este mismo despliegue y redirige
  // aquí con un 308, y hay correos ya enviados con enlaces suyos —citas,
  // alertas— que tienen que seguir abriendo. No se retira hasta que deje de
  // recibir visitas.
  dominioAnterior: "popcar.tech",

  // El espacio de nombres de los UID de calendario. NO sigue a la marca.
  //
  // Un UID no es una direccion, es un identificador estable: es lo que hace que
  // reenviar una cita actualice la del calendario del cliente en vez de crear
  // una segunda. Las citas confirmadas antes del cambio de dominio llevan este
  // valor, asi que moverlo les daria un UID distinto al reenviarse y al cliente
  // le apareceria la cita duplicada.
  //
  // Nadie lo ve. No se cambia aunque cambie el dominio de la web. Lo movi al
  // dominio nuevo por descuido al hacer la mudanza, y el aviso que me hizo
  // verlo estaba escrito en el ERP, no aqui.
  dominioUid: "popcar.tech",

  // Solo vale un dominio verificado en Resend: mandar desde otro no falla en
  // silencio, rebota. popcarmobility.com lo esta desde el 7 de septiembre de
  // 2026, con su SPF en send.popcarmobility.com y la clave DKIM en
  // resend._domainkey, las dos en la zona de GoDaddy.
  //
  // Van en subdominios propios y no en la raiz porque la raiz ya tiene el SPF
  // de Microsoft 365 y sus MX, que es de donde vive el buzon de verdad. Solo
  // puede haber un SPF por nombre: tocar el de la raiz para meter aqui el de
  // Resend habria dejado sin correo el unico buzon que recibe, y con `-all` al
  // final el fallo habria sido inmediato y total.
  //
  // Es la misma direccion que `correoContacto`, a proposito: sale de donde
  // recibe, asi que quien responda llega aunque su cliente de correo ignore el
  // reply_to. La contrapartida es que los rebotes automaticos caen en la misma
  // bandeja que el correo de personas.
  remitentePorDefecto: "PopCar <hola@popcarmobility.com>",

  // El unico buzon de la casa que recibe de verdad. Ninguno de los tres
  // dominios de la web tiene MX —ni popcar.com.es, ni popcar.tech, ni el
  // carswiseai.com que quedaba escrito por las pantallas—, asi que no vale
  // ninguna direccion suya para que alguien conteste. Este vive en el
  // Microsoft 365 de popcarmobility.com. Se cambia con CONTACT_EMAIL.
  correoContacto: "hola@popcarmobility.com",

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
 * Ahora vive en CONTACT_EMAIL. Devolvia cadena vacia sin variable a proposito:
 * era mejor que una factura no ensenara ningun correo a que ensenara uno
 * muerto.
 *
 * Ya no hace falta esa precaucion. `correoContacto` es un buzon que recibe de
 * verdad —comprobado: popcarmobility.com tiene MX apuntando a Microsoft 365—,
 * asi que sin variable se ensena ese en vez de nada. Quien la usa sigue
 * comprobando si hay algo, que la variable puede quedarse vacia a mano.
 */
function correoSoporte() {
  return String(process.env.CONTACT_EMAIL || MARCA.correoContacto || "").trim();
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
