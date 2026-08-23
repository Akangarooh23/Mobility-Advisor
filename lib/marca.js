/**
 * La marca, en un solo sitio.
 *
 * Todo lo que el cliente ve en un documento o en un correo —el nombre, el
 * dominio, los colores— sale de aquí. Antes estaba repetido a mano en cada
 * generador de PDF y en cada plantilla de correo, y cambiar de marca obligaba a
 * perseguir cadenas por media docena de ficheros.
 *
 * Lo que NO va aquí es la razón social. `CarsWise AI S.L.` es la entidad
 * inscrita, no la marca comercial: la factura tiene que seguir diciéndola
 * mientras la sociedad se llame así, aunque el nombre de cara al público sea
 * otro. Son dos campos distintos y se cambian en momentos distintos.
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

  razonSocial: "CarsWise AI S.L.",
};

const COLOR = {
  negro: "#111111",
  negroProfundo: "#050505",
  amarillo: "#FFCC00",
  amarilloOscuro: "#E6B800",
  amarilloTenue: "#FFF6D2",
  amarilloTexto: "#6B5200",
  blanco: "#FFFFFF",

  texto: "#111111",
  textoSuave: "#5E5E59",
  textoTenue: "#96968F",
  linea: "#E4E4DF",
  fondoSuave: "#F7F7F3",
};

module.exports = { MARCA, COLOR };
