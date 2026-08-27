/**
 * La maqueta de los correos que salen de PopCar.
 *
 * Había dieciocho maquetas repartidas por trece ficheros, cada una escrita a
 * mano, todas con el azul y el verde de la marca anterior y setenta y cinco
 * emoji entre todas. Un cliente que reserve una visita, pida un informe y
 * reciba un aviso de precio recibe tres correos que no parecen de la misma
 * empresa.
 *
 * Esto es lo mismo que ya usa el ERP, traído aquí: si mañana cambia el color o
 * el pie, se cambia en un sitio y cambian los dieciocho.
 *
 * Sobre por qué está todo en `style=` a mano: Gmail borra cualquier `<style>`,
 * y los clientes de correo de hace veinte años siguen vivos. No se pueden usar
 * variables CSS ni clases; hay que escribir el color en cada etiqueta y
 * maquetar con tablas.
 */
const { MARCA, COLOR } = require("./marca");

const TIPO =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Lo que escribe una persona no puede escribir HTML en el correo. */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Una dirección lista para meter en un `href`.
 *
 * Las direcciones de los anuncios vienen de portales de fuera y llevan `&` y
 * parámetros dentro. Un `&` sin escapar en un atributo es HTML inválido y hay
 * clientes de correo que lo destrozan; una comilla permitiría salirse del
 * atributo y escribir marcado propio en un correo que sale con nuestro
 * remitente. Y solo http y https: `javascript:` no pinta nada en un correo.
 */
function urlSegura(url) {
  const limpia = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(limpia)) return "";
  return esc(limpia);
}

/** Un párrafo normal. */
const parrafo = (html, tam = 15) =>
  `<p style="margin:0 0 14px 0;font-size:${tam}px;line-height:1.55;color:${COLOR.texto}">${html}</p>`;

/** Una caja de datos: la cita, el vehículo, el resumen de una operación. */
function datos(filas) {
  const tr = filas
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr>
           <td style="padding:5px 12px 5px 0;font-size:14px;color:${COLOR.textoSuave};white-space:nowrap">${k}</td>
           <td style="padding:5px 0;font-size:14px;color:${COLOR.texto};font-weight:600">${v}</td>
         </tr>`
    )
    .join("");
  if (!tr) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
            style="width:100%;background:${COLOR.fondoSuave};border:1px solid ${COLOR.linea};border-radius:10px;padding:16px 18px;margin:0 0 18px 0">
            ${tr}
          </table>`;
}

/** Lo que hay que hacer para que algo ocurra. Uno por correo, o deja de destacar. */
function aviso(titulo, texto) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
            style="width:100%;background:${COLOR.amarilloTenue};border:1px solid ${COLOR.amarillo};border-radius:10px;padding:16px 18px;margin:0 0 18px 0">
            <tr><td>
              <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:${COLOR.negro}">${titulo}</p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:${COLOR.texto}">${texto}</p>
            </td></tr>
          </table>`;
}

/**
 * El botón. Amarillo relleno con texto negro: es el único sitio del correo
 * donde aparece el amarillo a este tamaño, y así no compite con nada.
 */
const boton = (texto, url) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0">
     <tr><td style="background:${COLOR.amarillo};border-radius:8px">
       <a href="${urlSegura(url)}" style="display:inline-block;padding:13px 26px;font-family:${TIPO};font-size:15px;font-weight:700;color:${COLOR.negro};text-decoration:none">${texto}</a>
     </td></tr>
   </table>`;

/** Dos botones al lado, para cuando hay que elegir: confirmar o rechazar. */
function botones(principal, secundario) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0">
     <tr>
       <td style="background:${COLOR.amarillo};border-radius:8px">
         <a href="${urlSegura(principal.url)}" style="display:inline-block;padding:13px 26px;font-family:${TIPO};font-size:15px;font-weight:700;color:${COLOR.negro};text-decoration:none">${principal.texto}</a>
       </td>
       <td style="width:10px"></td>
       <td style="border:1px solid ${COLOR.linea};border-radius:8px">
         <a href="${urlSegura(secundario.url)}" style="display:inline-block;padding:12px 22px;font-family:${TIPO};font-size:14px;font-weight:600;color:${COLOR.textoSuave};text-decoration:none">${secundario.texto}</a>
       </td>
     </tr>
   </table>`;
}

/**
 * Un código para copiar: el de recuperar la contraseña.
 *
 * Grande, espaciado y en negro sobre el amarillo tenue. Lo que importa es que
 * se lea de un vistazo y se distinga un 0 de una O, así que va en monoespaciada
 * y con las letras separadas.
 */
function codigo(valor) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
            style="width:100%;background:${COLOR.amarilloTenue};border:1px solid ${COLOR.amarillo};border-radius:10px;margin:0 0 18px 0">
            <tr><td align="center" style="padding:22px 16px">
              <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:1.5px;color:${COLOR.amarilloTexto}">TU CÓDIGO</p>
              <p style="margin:0;font-family:'SFMono-Regular',Consolas,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:${COLOR.negro}">${esc(valor)}</p>
            </td></tr>
          </table>`;
}

/** Un enlace discreto, para lo secundario. */
const enlace = (texto, url) =>
  `<p style="margin:0 0 14px 0;font-size:14px"><a href="${urlSegura(url)}" style="color:${COLOR.negro};font-weight:600">${texto}</a></p>`;

/**
 * La maqueta completa: cabecera negra con la marca, tarjeta blanca y pie.
 *
 * El ancho va a 560 px porque es lo que cabe en la vista previa de Gmail sin
 * que haya que desplazarse de lado en el móvil.
 *
 * `pie` es para lo que solo aparece en algunos: por qué se recibe este correo,
 * cómo dejar de recibirlo.
 */
function plantilla({ titulo, cuerpo, pie = "" }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${COLOR.fondoSuave}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${COLOR.fondoSuave}">
    <tr><td align="center" style="padding:28px 12px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;font-family:${TIPO}">

        <tr><td style="background:${COLOR.negro};border-radius:12px 12px 0 0;padding:20px 26px">
          <span style="font-size:19px;font-weight:800;letter-spacing:-0.3px;color:${COLOR.amarillo}">Pop</span><span style="font-size:19px;font-weight:800;letter-spacing:-0.3px;color:${COLOR.blanco}">Car</span>
        </td></tr>

        <tr><td style="background:${COLOR.blanco};border:1px solid ${COLOR.linea};border-top:none;border-radius:0 0 12px 12px;padding:28px 26px 22px">
          <h1 style="margin:0 0 18px 0;font-size:20px;line-height:1.3;font-weight:700;color:${COLOR.negro}">${esc(titulo)}</h1>
          ${cuerpo}
        </td></tr>

        <tr><td style="padding:16px 26px 0">
          ${pie ? `<p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:${COLOR.textoTenue}">${pie}</p>` : ""}
          <p style="margin:0;font-size:12px;line-height:1.5;color:${COLOR.textoSuave}">
            ${MARCA.nombre} — <a href="${MARCA.sitioUrl}" style="color:${COLOR.textoSuave}">${MARCA.sitio}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = { plantilla, parrafo, datos, aviso, boton, botones, enlace, codigo, esc, urlSegura };
