/**
 * Saca a fichero un ejemplo de cada correo, para poder mirarlos.
 *
 * No es una prueba: es la única forma de ver lo que le llega a un cliente sin
 * mandárselo. Usa las mismas piezas que los envíos de verdad, así que si la
 * maqueta cambia, estos cambian con ella.
 *
 *   node scripts/muestra-correos.js <carpeta>
 */
const fs = require("fs");
const path = require("path");
const { MARCA } = require("../lib/marca");
const {
  plantilla, parrafo, datos, aviso, boton, enlace, codigo, esc,
} = require("../lib/correo");

const salida = process.argv[2] || path.join(__dirname, "..", "muestras-correo");
fs.mkdirSync(salida, { recursive: true });

const PANEL = `${MARCA.sitioUrl}/panel/solicitudes`;

const CORREOS = {
  "cita-confirmada": plantilla({
    titulo: "Tu cita está confirmada",
    cuerpo:
      parrafo("Hola <strong>Ana Picazo</strong>,") +
      parrafo("Te esperamos para ver el vehículo <strong>Volkswagen T-Roc 1.5 TSI Sport</strong>.") +
      datos([
        ["Fecha", "martes, 8 de septiembre de 2026"],
        ["Hora", "17:30"],
        ["Dirección", "Calle Alcalá 120, Madrid"],
        ["Pregunta por", "Javier Ruiz"],
      ]) +
      parrafo("Si necesitas cancelar o cambiar la fecha, puedes hacerlo desde tu panel antes de la cita.", 14) +
      enlace("Ver mi cita", PANEL),
  }),

  "solicitud-visita": plantilla({
    titulo: "Alguien quiere ver tu vehículo",
    cuerpo:
      parrafo("<strong>Marcos Gil</strong> quiere visitar tu coche.") +
      datos([
        ["Vehículo", "Jaguar S-TYPE 2.7D V6"],
        ["Mensaje", "¿Se puede ver un sábado por la mañana?"],
      ]) +
      parrafo("Propón hasta tres franjas horarias y que elija la que mejor le venga.") +
      boton("Proponer fechas", `${MARCA.sitioUrl}/cita/proponer?token=abc`),
    pie: "Si no has publicado ningún vehículo, ignora este correo.",
  }),

  "alerta-de-precio": plantilla({
    titulo: "2 nuevas ofertas para tu alerta",
    cuerpo:
      parrafo("Volkswagen T-Roc hasta 20.000 €", 14) +
      datos([["Volkswagen T-Roc 1.5 TSI", "2021 · 92.367 km · Gasolina"], ["", "18.900 €"]]) +
      datos([["Volkswagen T-Roc Advance", "2022 · 30.000 km · Gasolina"], ["", "19.400 €"]]) +
      enlace("Ver todas las ofertas", `${MARCA.sitioUrl}/marketplace-vo`),
    pie: "Recibes este correo porque tienes alertas activas. Puedes gestionarlas desde tu perfil.",
  }),

  "recuperar-contrasena": plantilla({
    titulo: "Recupera tu contraseña",
    cuerpo:
      parrafo("Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Introduce este código en la aplicación:") +
      codigo("4F7B29") +
      aviso("El código caduca en 15 minutos", "Si no has pedido el cambio, ignora este correo: tu contraseña no se toca."),
  }),

  "importacion": plantilla({
    titulo: "Hemos recibido tu solicitud de importación",
    cuerpo:
      parrafo("Hola <strong>Ana Picazo</strong>,") +
      parrafo("Tu solicitud para importar <strong>BMW Serie 3 320d Touring</strong> ha quedado registrada.") +
      aviso("Reservarlo pide una fianza del 30 %: 8.400 €", "Te llamamos para explicarte el proceso y confirmar la disponibilidad."),
  }),

  "factura": plantilla({
    titulo: "Tu factura está lista",
    cuerpo:
      parrafo("Va adjunta en PDF.") +
      datos([
        ["Nº de factura", "SUBS-2026-0042"],
        ["Concepto", esc("Suscripción PopCar — plan Avanzado")],
        ["Total", "30,00 €"],
      ]),
  }),
};

for (const [nombre, html] of Object.entries(CORREOS)) {
  fs.writeFileSync(path.join(salida, nombre + ".html"), html, "utf8");
}
console.log(Object.keys(CORREOS).length + " correos en " + salida);
