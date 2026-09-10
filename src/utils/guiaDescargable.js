import {
  TITULO, ENTRADILLA, PASOS, DESPUES, LO_TUYO, EL_TRATO, DUDAS,
} from "./comoSubirTuCoche";

/**
 * La guía, en un fichero que el cliente puede guardarse.
 *
 * Es HTML con el tipo de Word, igual que los manuales del ERP: Word lo abre
 * como suyo, respeta negritas y márgenes, y el documento queda editable. Un
 * `.docx` de verdad haría falta una biblioteca entera para lo mismo.
 *
 * Se descarga en vez de mandarse en el cuerpo de un correo porque el cliente lo
 * necesita **mientras trabaja**: abierto en el ordenador con el móvil en la
 * mano haciendo las fotos, reenviado a su hijo, o impreso. Un correo con seis
 * enlaces no sirve para eso.
 */

function escapa(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const P = (texto, tam = "11pt", color = "#1c1917") =>
  `<p style="margin:0 0 8pt;font-size:${tam};line-height:1.5;color:${color}">${texto}</p>`;

/** El documento entero. */
export function elDocumento() {
  const pasos = PASOS.map((p, i) => `
    <div style="margin:0 0 20pt">
      <p style="margin:0 0 3pt;font-size:9.5pt;font-weight:bold;color:#8a6d00;
                letter-spacing:1pt">PASO ${i + 1}</p>
      <h2 style="margin:0 0 4pt;font-size:14pt;color:#1c1917">${escapa(p.titulo)}</h2>
      ${P(`<i>${escapa(p.donde)}</i>`, "10pt", "#57534e")}
      <ul style="margin:0 0 8pt 16pt;padding:0">
        ${p.que.map((q) => `<li style="font-size:11pt;margin-bottom:3pt">${escapa(q)}</li>`).join("")}
      </ul>
      ${P(`<b>Por qué:</b> ${escapa(p.porque)}`, "10.5pt", "#44403c")}
      ${P(`<b>Un consejo:</b> ${escapa(p.consejo)}`, "10.5pt", "#57534e")}
    </div>`).join("");

  const lista = (titulo, cosas) => `
    <h2 style="margin:22pt 0 8pt;font-size:13pt;color:#1c1917">${escapa(titulo)}</h2>
    <ul style="margin:0 0 8pt 16pt;padding:0">
      ${cosas.map((c) => `<li style="font-size:11pt;line-height:1.5;margin-bottom:5pt">${escapa(c)}</li>`).join("")}
    </ul>`;

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" `
    + `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`
    + `<head><meta charset="utf-8"><title>${escapa(TITULO)}</title>`
    + `<style>@page{size:A4;margin:2cm} body{font-family:Calibri,sans-serif;color:#1c1917}</style>`
    + `</head><body>`
    + `<h1 style="font-size:22pt;margin:0 0 6pt;color:#1c1917">${escapa(TITULO)}</h1>`
    + P(escapa(ENTRADILLA), "11.5pt", "#57534e")
    + `<hr style="border:none;border-top:0.5pt solid #e7e5e4;margin:16pt 0">`
    + pasos
    + lista("Y a partir de ahí, nos encargamos nosotros", DESPUES)
    + lista("Y lo que sigue siendo tuyo", LO_TUYO)
    + lista("El trato", EL_TRATO)
    + `<hr style="border:none;border-top:0.5pt solid #e7e5e4;margin:16pt 0">`
    + P(escapa(DUDAS), "10.5pt", "#57534e")
    + `</body></html>`;
}

/**
 * Y el fichero.
 *
 * La marca del principio es lo que hace que Word reconozca que el texto viene
 * en UTF-8. Sin ella abre el documento con la codificación del sistema y las
 * tildes salen rotas — que en una guía llena de «matrícula» y «técnica» se nota
 * en la primera línea.
 */
export function descargaLaGuia() {
  const blob = new Blob(["﻿", elDocumento()], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "como-subir-tu-coche.doc";
  a.click();
  URL.revokeObjectURL(url);
}
