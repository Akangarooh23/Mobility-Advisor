"use strict";

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
} = require("docx");
const fs = require("fs");
const path = require("path");

const BRAND_BLUE = "1E3A5F";
const BRAND_ACCENT = "2563EB";
const LIGHT_GRAY = "F1F5F9";
const MID_GRAY = "CBD5E1";
const WHITE = "FFFFFF";

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    run: { bold: true, color: BRAND_BLUE, size: 32 },
  });
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BRAND_ACCENT, size: 26 })],
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_GRAY } },
  });
}

function heading3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BRAND_BLUE, size: 22 })],
    spacing: { before: 280, after: 80 },
  });
}

function body(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: "334155", ...options })],
    spacing: { before: 60, after: 60 },
  });
}

function bullet(text, boldPart = "") {
  const children = boldPart
    ? [
        new TextRun({ text: "• ", size: 20, color: "2563EB" }),
        new TextRun({ text: boldPart, bold: true, size: 20, color: "0F172A" }),
        new TextRun({ text: text.replace(boldPart, ""), size: 20, color: "334155" }),
      ]
    : [
        new TextRun({ text: "• ", size: 20, color: "2563EB" }),
        new TextRun({ text, size: 20, color: "334155" }),
      ];
  return new Paragraph({ children, spacing: { before: 40, after: 40 }, indent: { left: 360 } });
}

function step(num, text) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}.  `, bold: true, size: 20, color: BRAND_ACCENT }),
      new TextRun({ text, size: 20, color: "334155" }),
    ],
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
  });
}

function arrow(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "     ↓  ", size: 18, color: MID_GRAY }),
      new TextRun({ text, size: 18, color: "64748B", italics: true }),
    ],
    spacing: { before: 20, after: 20 },
    indent: { left: 360 },
  });
}

function spacer() {
  return new Paragraph({ text: "", spacing: { before: 80, after: 80 } });
}

function divider() {
  return new Paragraph({
    text: "",
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_GRAY } },
    spacing: { before: 200, after: 200 },
  });
}

function headerCell(text) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 18, color: WHITE })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 80, after: 80 },
    })],
    shading: { type: ShadingType.SOLID, color: BRAND_BLUE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function dataCell(text, shade = false) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 18, color: "334155" })],
      spacing: { before: 60, after: 60 },
    })],
    shading: shade ? { type: ShadingType.SOLID, color: LIGHT_GRAY } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
  });
}

function simpleTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h) => headerCell(h)), tableHeader: true }),
      ...rows.map((row, ri) =>
        new TableRow({ children: row.map((cell) => dataCell(cell, ri % 2 === 0)) })
      ),
    ],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 20, color: "0F172A" },
        paragraph: { spacing: { line: 276 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
        },
      },
      children: [

        // ── PORTADA ──────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: "CarsWise", bold: true, size: 72, color: BRAND_BLUE })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 1200, after: 160 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Marketplace & Flujos de Operación", size: 36, color: BRAND_ACCENT })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Documentación técnica y funcional", size: 22, color: "64748B", italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 1600 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Versión: Mayo 2026`, size: 20, color: "94A3B8" })],
          alignment: AlignmentType.CENTER,
        }),

        divider(),

        // ── 1. VISIÓN GENERAL ────────────────────────────────────────
        heading1("1. Visión general"),
        body("El marketplace de CarsWise admite dos tipos de vehículos publicados:"),
        spacer(),
        bullet("Vehículos gestionados directamente por CarsWise, importados desde el ERP mediante Excel o entrada manual.", "CarsWise: "),
        bullet("Vehículos publicados por clientes particulares a través de su IDCar desde el portal privado.", "Particulares: "),
        spacer(),
        body("Ambos conviven en el mismo listado del marketplace, diferenciados por etiquetas visuales y con flujos de contacto distintos adaptados a cada caso."),

        divider(),

        // ── 2. TIPOS DE VEHÍCULOS ────────────────────────────────────
        heading1("2. Tipos de vehículos en el marketplace"),

        heading2("2.1 Vehículos de CarsWise"),
        body("Origen del stock: Los vehículos se registran en la tabla moveadvisor_marketplace_vo_offers con seller_type = 'carswise'. La entrada puede ser manual desde el ERP o importada por Excel."),
        spacer(),
        body("Flujo de contacto:"),
        step("1", "El cliente ve el vehículo en el marketplace."),
        step("2", "Rellena el formulario de Solicitudes (info, visita, consulta)."),
        step("3", "Se crea un Lead en el ERP visible en la sección Leads."),
        step("4", "El equipo de CarsWise gestiona el lead: contacta, agenda visita, actualiza estado."),

        spacer(),
        heading2("2.2 Vehículos de clientes particulares (IDCar)"),
        body("Origen del stock: El cliente crea un IDCar en su portal, sube fotos y documentos (almacenados en Supabase Storage) y pulsa 'Publicar Marketplace VO'. El sistema crea una oferta con seller_type = 'particular' e id = idcar-{vehicleId}."),
        spacer(),
        body("En el ERP estas ofertas aparecen con un badge naranja «IDCar cliente» para distinguirlas del stock de CarsWise."),

        divider(),

        // ── 3. FLUJO DE VISITA P2P ───────────────────────────────────
        heading1("3. Flujo de visita P2P — vehículos de particular"),
        body("Cuando un comprador quiere ver un vehículo publicado por un cliente particular, el flujo está completamente mediado por email y no requiere que ninguna de las partes esté logueada en el momento de la gestión."),
        spacer(),

        heading3("Paso 1 — Solicitud de visita"),
        step("1", "El comprador pulsa «Solicitar visita al vendedor» en la tarjeta del marketplace."),
        step("2", "Se abre un modal: introduce nombre, email y mensaje opcional."),
        step("3", "Se crea un registro en moveadvisor_viewing_appointments con status: pending_seller."),
        arrow("Email automático al vendedor: «Alguien quiere ver tu vehículo»"),

        spacer(),
        heading3("Paso 2 — Vendedor propone fechas"),
        step("1", "El vendedor recibe el email con un link único (token, sin login necesario)."),
        step("2", "Abre /cita/proponer?token=xxx y selecciona hasta 3 franjas horarias disponibles."),
        step("3", "El registro pasa a status: pending_buyer."),
        arrow("Email automático al comprador: «El vendedor propone estas fechas»"),

        spacer(),
        heading3("Paso 3 — Comprador confirma fecha"),
        step("1", "El comprador recibe el email con un link único (token, sin login necesario)."),
        step("2", "Abre /cita/confirmar?token=xxx y elige la franja que más le conviene."),
        step("3", "El registro pasa a status: confirmed."),
        arrow("Email de confirmación al comprador con fecha y datos del vehículo"),
        arrow("Email de confirmación al vendedor con fecha y nombre del comprador"),

        spacer(),
        body("El vendedor también puede ver todas sus solicitudes de visita en la sección Solicitudes de su portal, con un botón «Proponer fechas →» para los casos pendientes."),

        divider(),

        // ── 4. PORTAL DEL CLIENTE ────────────────────────────────────
        heading1("4. Portal del cliente — secciones"),
        spacer(),
        simpleTable(
          ["Sección", "Contenido"],
          [
            ["Marketplace VO", "Listado de todos los vehículos publicados. Filtros por marca, precio, combustible, ubicación. En vehículos de particular: botón «Solicitar visita al vendedor»."],
            ["Mis vehículos (IDCar)", "Gestión del garage: subir fotos y documentos, publicar o despublicar en el marketplace, introducir precio de venta."],
            ["Solicitudes", "Historial de solicitudes enviadas (info/visita sobre vehículos de CarsWise) y solicitudes de visita recibidas sobre los propios vehículos publicados."],
            ["Citas Mantenimiento", "Citas de taller, revisión, seguro y garantía coordinadas con CarsWise. No incluye citas de ver vehículos (esas van en Solicitudes)."],
            ["Tasaciones", "Valoraciones de vehículos solicitadas o guardadas, con informes vinculados."],
            ["Cuenta", "Perfil personal, suscripción activa, historial de facturas y método de pago."],
          ]
        ),

        divider(),

        // ── 5. ERP ───────────────────────────────────────────────────
        heading1("5. ERP — visión del equipo CarsWise"),
        spacer(),
        simpleTable(
          ["Sección", "Contenido"],
          [
            ["Marketplace", "Tabla de todas las ofertas activas. Badge naranja «IDCar cliente» en las de particulares."],
            ["IDCars", "Listado de todos los IDCars registrados. Ficha detallada con galería de fotos, documentos y panel de publicación al marketplace."],
            ["Leads", "Solicitudes de contacto generadas desde el marketplace o el portal por vehículos de CarsWise."],
            ["Citas Mant.", "Agenda de citas de mantenimiento gestionadas por el equipo técnico."],
            ["Usuarios", "Ficha de cada cliente con historial completo de actividad."],
            ["Talleres", "Red de talleres asociados con disponibilidad y servicios."],
            ["Facturación", "Suscripciones activas, pagos y gestión de planes de los clientes."],
          ]
        ),

        divider(),

        // ── 6. ALMACENAMIENTO ────────────────────────────────────────
        heading1("6. Almacenamiento de ficheros"),
        body("Todos los archivos de los IDCars (fotos y documentos) se almacenan en Supabase Storage:"),
        spacer(),
        bullet("Bucket: vehicle-files (público)", "Bucket: "),
        bullet("Ruta: vehicles/{vehicleId}/{category}/{timestamp}_{filename}", "Ruta: "),
        bullet("La URL pública se guarda en la columna file_url de las tablas de archivos.", "Persistencia: "),
        bullet("Límite por archivo: 50 MB.", "Límite: "),

        divider(),

        // ── 7. EMAILS ────────────────────────────────────────────────
        heading1("7. Emails transaccionales (Resend)"),
        spacer(),
        simpleTable(
          ["Evento", "Destinatario", "Asunto"],
          [
            ["Nueva solicitud de visita P2P", "Vendedor (particular)", "Solicitud de visita · {vehículo}"],
            ["Vendedor propone fechas", "Comprador", "El vendedor propone fechas · {vehículo}"],
            ["Comprador confirma fecha", "Comprador", "✅ Cita confirmada · {vehículo}"],
            ["Comprador confirma fecha", "Vendedor", "✅ Cita confirmada · {vehículo}"],
            ["Alertas de mercado", "Cliente suscrito", "Novedades en tus alertas de MoveAdvisor"],
          ]
        ),
        spacer(),
        body("Los emails de visita incluyen links con tokens de un solo uso que abren páginas públicas sin necesidad de login. El remitente es support@carswiseai.com gestionado a través de Resend."),

        divider(),

        // ── 8. TABLAS CLAVE ──────────────────────────────────────────
        heading1("8. Tablas de base de datos clave"),
        spacer(),
        simpleTable(
          ["Tabla", "Propósito"],
          [
            ["moveadvisor_marketplace_vo_offers", "Catálogo unificado del marketplace. seller_type distingue CarsWise vs. particular."],
            ["moveadvisor_user_vehicles", "Vehículos registrados en el garage de cada cliente (IDCars)."],
            ["moveadvisor_user_vehicle_files", "Fotos de cada IDCar con URL de Supabase Storage."],
            ["moveadvisor_user_vehicle_documents", "Documentos de cada IDCar con URL de Supabase Storage."],
            ["moveadvisor_viewing_appointments", "Solicitudes de visita P2P con estado, slots propuestos y tokens de email."],
            ["moveadvisor_market_leads", "Leads generados por solicitudes de contacto sobre vehículos de CarsWise."],
            ["moveadvisor_market_appointments", "Citas de mantenimiento coordinadas con talleres."],
          ]
        ),

        spacer(),
        spacer(),
        new Paragraph({
          children: [new TextRun({ text: "© 2026 CarsWise — Documento interno", size: 16, color: "94A3B8", italics: true })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
  ],
});

const outputPath = path.join(__dirname, "..", "CarsWise_Marketplace_Flujos.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Documento generado: ${outputPath}`);
});
