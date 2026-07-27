const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, PageBreak,
  UnderlineType, PageOrientation,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ── Helpers ──────────────────────────────────────────────────────────────────

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, ...opts })],
    spacing: { after: 120 },
  });
}

function bold(text) {
  return new TextRun({ text, bold: true, size: 22 });
}

function normal(text) {
  return new TextRun({ text, size: 22 });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    bullet: { level },
    spacing: { after: 80 },
  });
}

function step(num, text) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 22, color: "2563EB" }),
      new TextRun({ text, size: 22 }),
    ],
    spacing: { after: 100 },
    indent: { left: 360 },
  });
}

function note(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "ℹ️  ", size: 22 }),
      new TextRun({ text, size: 22, italics: true, color: "475569" }),
    ],
    spacing: { after: 120, before: 80 },
    indent: { left: 360 },
  });
}

function warning(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "⚠️  ", size: 22 }),
      new TextRun({ text, size: 22, bold: true, color: "92400E" }),
    ],
    spacing: { after: 120, before: 80 },
    indent: { left: 360 },
  });
}

function emailBox(title, body) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: "EFF6FF" },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "BFDBFE" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFDBFE" },
              left: { style: BorderStyle.THICK, size: 12, color: "2563EB" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "BFDBFE" },
            },
            children: [
              new Paragraph({
                children: [new TextRun({ text: `📧 ${title}`, bold: true, size: 22, color: "1E40AF" })],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text: body, size: 20, color: "374151" })],
                spacing: { after: 0 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" } },
    spacing: { before: 160, after: 160 },
    text: "",
  });
}

function statusBadge(status, meaning) {
  return new Paragraph({
    children: [
      new TextRun({ text: `  ${status}  `, bold: true, size: 20, color: "FFFFFF", highlight: undefined }),
      new TextRun({ text: `  →  ${meaning}`, size: 20, color: "374151" }),
    ],
    spacing: { after: 80 },
    indent: { left: 360 },
  });
}

function tableOfContents() {
  const items = [
    "1. Tipos de leads y su origen",
    "2. Estados de un lead",
    "3. Flujo completo: del cliente al ERP",
    "4. Gestión en el ERP — Solicitudes",
    "    4.1 Solicitar información (tipo info)",
    "    4.2 Agendar visita (tipo visit)",
    "    4.3 Preguntar sobre el coche (tipo question)",
    "    4.4 Leads con reagendado solicitado",
    "5. Notificaciones al equipo CarsWise",
    "6. Emails que se envían en cada paso",
    "7. Panel del cliente: qué puede hacer",
    "8. Cola de llamadas proactivas",
    "9. Exportar leads a Excel",
    "10. Historial de cambios por lead",
  ];
  return items.map((t) =>
    new Paragraph({
      children: [new TextRun({ text: t, size: 21, color: "2563EB" })],
      spacing: { after: 60 },
      indent: { left: t.startsWith("    ") ? 480 : 0 },
    })
  );
}

// ── Document ─────────────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
  },
  sections: [
    {
      children: [

        // ── Portada ──
        new Paragraph({
          children: [new TextRun({ text: "CARSWISE", bold: true, size: 52, color: "2563EB" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 800, after: 160 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Guía de Gestión de Leads", bold: true, size: 40, color: "0F172A" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Manual para el equipo de CarsWise", size: 26, color: "64748B" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 },
        }),
        divider(),

        // ── Índice ──
        h1("Índice"),
        ...tableOfContents(),
        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("1. Tipos de leads y su origen"),

        p("Un lead se genera cuando un cliente realiza alguna acción en la web de CarsWise. Hay tres tipos:"),

        h3("Solicitar información (tipo: info)"),
        bullet("El cliente encuentra un vehículo en el Marketplace VO y quiere saber más sobre él."),
        bullet("Rellena un formulario con su nombre, teléfono, email y cuándo prefiere que le llamen."),
        bullet("No implica intención de visita inmediata — es una consulta."),

        h3("Agendar visita (tipo: visit)"),
        bullet("El cliente quiere ir a ver el vehículo físicamente."),
        bullet("Rellena el mismo formulario indicando cuándo puede ir."),
        bullet("Este tipo activa el flujo completo de citas: CarsWise asigna fecha, cliente confirma, vehículo queda reservado."),

        h3("Preguntar sobre el coche (tipo: question)"),
        bullet("El cliente tiene una duda concreta sobre el vehículo (mecánica, historial, financiación, etc.)."),
        bullet("Misma estructura que el de información pero con una intención más específica."),

        note("Los leads de 'Agendar visita' son los más valiosos porque implican intención de compra real y reservan el vehículo cuando se confirman."),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("2. Estados de un lead"),

        p("Cada lead pasa por diferentes estados a lo largo de su ciclo de vida:"),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Estado", bold: true, size: 20 })] })], shading: { type: ShadingType.SOLID, color: "1E40AF" }, children: [new Paragraph({ children: [new TextRun({ text: "Estado", bold: true, size: 20, color: "FFFFFF" })] })] }),
                new TableCell({ shading: { type: ShadingType.SOLID, color: "1E40AF" }, children: [new Paragraph({ children: [new TextRun({ text: "Significado", bold: true, size: 20, color: "FFFFFF" })] })] }),
                new TableCell({ shading: { type: ShadingType.SOLID, color: "1E40AF" }, children: [new Paragraph({ children: [new TextRun({ text: "¿Quién lo activa?", bold: true, size: 20, color: "FFFFFF" })] })] }),
              ],
            }),
            ...[
              ["Pendiente",              "Lead recién llegado, nadie lo ha gestionado aún.",                 "Sistema (automático)"],
              ["Contactado",             "El equipo CarsWise ya ha contactado con el cliente.",              "Empleado CarsWise en ERP"],
              ["En proceso",             "Negociación activa, visita en proceso de agendado.",               "Empleado CarsWise en ERP"],
              ["Cita confirmada",        "El cliente ha confirmado la cita. El vehículo queda reservado.",  "Cliente desde su panel"],
              ["Reagendar solicitado",   "El cliente quiere cambiar la fecha de su cita.",                  "Cliente desde su panel"],
              ["Cancelado",             "El cliente o CarsWise ha cancelado la solicitud.",                 "Cliente o empleado CarsWise"],
              ["Cerrado",               "Gestión finalizada con éxito (venta completada u otro cierre).",   "Empleado CarsWise en ERP"],
              ["Descartado",            "Lead no cualificado o sin interés real.",                          "Empleado CarsWise en ERP"],
            ].map(([estado, significado, quien]) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: estado, bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: significado, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: quien, size: 20, italics: true })] })] }),
                ],
              })
            ),
          ],
        }),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("3. Flujo completo: del cliente al ERP"),

        h2("3.1 Flujo de un lead de Información o Pregunta"),

        step("1", "El cliente visita el Marketplace VO en carswiseai.com y hace clic en 'Solicitar información' o 'Preguntar'."),
        step("2", "Rellena el formulario: nombre, teléfono, email, cuándo prefiere que le llamen."),
        step("3", "El sistema guarda el lead en la base de datos con estado Pendiente."),
        step("4", "Se envían dos emails automáticamente:\n        • Al cliente: confirmación de que se ha recibido su solicitud.\n        • Al equipo interno de CarsWise: alerta con los datos del lead."),
        step("5", "El ERP muestra el lead con estado Pendiente y una notificación en tiempo real (badge rojo + toast)."),
        step("6", "Un empleado de CarsWise abre el lead, contacta al cliente por teléfono o email."),
        step("7", "El empleado actualiza el estado y escribe una respuesta en el campo 'Respuesta al cliente'."),
        step("8", "Pulsa 'Guardar y notificar cliente' → el cliente recibe un email con la respuesta y la puede ver en su panel."),
        step("9", "Cuando la gestión finaliza, el empleado cambia el estado a Cerrado o Descartado."),

        h2("3.2 Flujo de un lead de Visita (el más importante)"),

        step("1", "El cliente hace clic en 'Agendar visita' en un vehículo del Marketplace."),
        step("2", "Rellena el formulario: nombre, teléfono, email, disponibilidad horaria."),
        step("3", "Lead guardado con estado Pendiente. Se envían los mismos dos emails automáticos."),
        step("4", "El equipo CarsWise contacta al cliente para concretar fecha y lugar."),
        step("5", "El empleado abre el lead en el ERP y rellena la sección 'Datos de la cita': fecha, hora, dirección y persona de contacto."),
        step("6", "El empleado cambia el estado a 'Contactado' o 'En proceso' y pulsa 'Guardar y notificar cliente'."),
        step("7", "El cliente recibe un email con los detalles de la cita y los ve en su panel."),
        step("8", "En el panel del cliente aparece un aviso urgente: '⚠️ Confirma tu cita para reservar el vehículo'."),
        step("9", "El cliente pulsa 'Confirmar cita y reservar vehículo' → estado cambia a 'Cita confirmada'. El vehículo queda reservado para él."),
        step("10", "El cliente recibe un email de confirmación. El equipo recibe también un email interno avisando de la confirmación."),
        step("11", "El empleado gestiona la visita. Cuando finaliza, cierra el lead con estado 'Cerrado'."),

        warning("El vehículo NO queda reservado hasta que el cliente confirma desde su panel. Si no confirma, otro cliente puede adquirirlo."),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("4. Gestión en el ERP — Sección Leads"),

        p("Para acceder: en el menú lateral del ERP, haz clic en 'Leads'. La página tiene dos pestañas: 'Solicitudes' y 'Cola de llamadas'."),

        h2("Vista general de Solicitudes"),
        bullet("En la parte superior aparecen contadores: Total, Pendientes, Esta semana, Contactados, Resueltos."),
        bullet("Debajo hay filtros por estado, tipo de solicitud y origen (Marketplace Compra / Renting / portales externos)."),
        bullet("La tabla muestra todos los leads con: fecha, origen, modalidad, tipo, contacto, vehículo, cuándo y estado."),
        bullet("Haz clic en cualquier fila para abrir el modal de gestión de ese lead."),

        note("El badge rojo en 'Leads' del menú lateral indica cuántos leads Pendientes hay ahora mismo. Se actualiza cada 30 segundos."),

        h2("4.1 Gestionar un lead de Información o Pregunta"),

        step("1", "Haz clic sobre el lead en la tabla. Se abre el modal con todos sus datos."),
        step("2", "Llama o escribe al cliente usando el teléfono y email que aparecen."),
        step("3", "En 'Estado', selecciona 'Contactado' cuando le hayas contactado."),
        step("4", "En 'Respuesta al cliente', escribe un mensaje claro con la información solicitada. Este mensaje lo verá el cliente en su panel y lo recibirá por email."),
        step("5", "En 'Notas internas', puedes apuntar detalles que solo verá el equipo CarsWise (no llegan al cliente)."),
        step("6", "Pulsa 'Guardar y notificar cliente' para enviar el email y guardar los cambios."),
        step("7", "Cuando la gestión esté completa, vuelve a abrir el lead y cambia el estado a 'Cerrado'."),
        step("8", "Pulsa 'Guardar borrador' (sin notificar) si solo quieres guardar el estado sin enviar email."),

        h2("4.2 Gestionar un lead de Visita"),

        step("1", "Haz clic sobre el lead. Verás la sección azul '📅 Datos de la cita'."),
        step("2", "Contacta al cliente para acordar fecha, hora y lugar."),
        step("3", "Rellena los campos: Fecha, Hora, Dirección, Persona de contacto (nombre del comercial que atenderá la visita)."),
        step("4", "Cambia el estado a 'Contactado' o 'En proceso'."),
        step("5", "En 'Respuesta al cliente', puedes añadir un mensaje personalizado (opcional, si quieres añadir algo además de los datos de cita)."),
        step("6", "Pulsa 'Guardar y notificar cliente' → el cliente recibe email con los detalles y puede confirmar desde su panel."),
        step("7", "Espera a que el cliente confirme. Cuando lo haga, el estado cambiará automáticamente a 'Cita confirmada' y el vehículo quedará reservado."),
        step("8", "Recibirás un email interno avisando de que el cliente confirmó."),
        step("9", "Tras la visita, cierra el lead con estado 'Cerrado'."),

        warning("Si el cliente no confirma en un tiempo razonable, llámale y recuérdale que debe confirmar para que el vehículo no se venda a otro."),

        h2("4.3 Gestionar un lead con Reagendado solicitado"),

        p("Cuando el cliente ya tenía una cita asignada pero quiere cambiar la fecha, el estado pasa a 'Reagendar solicitado'. En el modal del ERP verás una sección naranja con las fechas alternativas que el cliente propuso."),

        step("1", "Abre el lead. Verás la sección naranja '🔄 El cliente propone estas opciones'."),
        step("2", "Haz clic en la fecha que mejor encaje con la disponibilidad del concesionario (botón 'Usar esta →')."),
        step("3", "Los campos de Fecha y Hora se rellenan automáticamente con la opción elegida."),
        step("4", "Completa o actualiza la Dirección y Persona de contacto si es necesario."),
        step("5", "Cambia el estado a 'Contactado'."),
        step("6", "Pulsa 'Guardar y notificar cliente' para que el cliente vea la nueva cita y pueda confirmarla."),

        note("El cliente deberá volver a confirmar la nueva cita desde su panel para que el vehículo quede reservado de nuevo."),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("5. Notificaciones al equipo CarsWise"),

        p("El ERP notifica al equipo en tiempo real cuando llegan nuevos leads:"),

        bullet("Badge rojo con número en el menú lateral sobre 'Leads' (se actualiza cada 30 segundos)."),
        bullet("Toast (mensaje emergente) en la esquina inferior derecha con el texto '📩 X nuevo/s lead/s pendiente/s'."),
        bullet("La lista de leads se recarga automáticamente al detectar nuevos pendientes."),
        bullet("Email al email interno configurado en el sistema (INTERNAL_LEADS_EMAIL) con todos los datos del lead."),

        note("Si el equipo tiene el ERP abierto, no es necesario recargar la página manualmente. Las notificaciones llegan solas."),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("6. Emails que se envían en cada paso"),

        h2("6.1 Nuevo lead recibido"),
        p("Se envían automáticamente dos emails al mismo tiempo:"),
        new Paragraph({ spacing: { after: 80 }, text: "" }),
        emailBox(
          "Al cliente (confirmación de solicitud)",
          "Asunto: 'Solicitud recibida — [Nombre del vehículo]'\n\n" +
          "Contenido: Confirmación de que su solicitud fue recibida, con el tipo de solicitud y el vehículo. " +
          "Se indica que el equipo contactará en menos de 2 horas (o en el horario que el cliente indicó)."
        ),
        new Paragraph({ spacing: { after: 120 }, text: "" }),
        emailBox(
          "Al equipo interno CarsWise (alerta de nuevo lead)",
          "Asunto: '🔔 Nuevo lead: [Tipo] — [Nombre del vehículo]'\n\n" +
          "Contenido: Todos los datos del lead: tipo, vehículo, URL del anuncio, nombre del cliente, " +
          "teléfono, email y disponibilidad horaria."
        ),
        new Paragraph({ spacing: { after: 160 }, text: "" }),

        h2("6.2 Al notificar al cliente desde el ERP"),
        emailBox(
          "Al cliente (notificación de respuesta o cita)",
          "Asunto: personalizado según el contenido.\n\n" +
          "Contenido: La respuesta que el empleado haya escrito en 'Respuesta al cliente', más los datos " +
          "de la cita si se trata de un lead de tipo Visita (fecha, hora, dirección, persona de contacto)."
        ),
        new Paragraph({ spacing: { after: 120 }, text: "" }),
        emailBox(
          "Al equipo interno CarsWise (alerta de cambio de estado)",
          "Asunto: '🔄 Lead [nuevo estado] — [Nombre del vehículo]'\n\n" +
          "Contenido: Estado actual del lead, datos del cliente (nombre, teléfono, email), " +
          "fecha de cita si aplica."
        ),
        new Paragraph({ spacing: { after: 160 }, text: "" }),

        h2("6.3 Cuando el cliente confirma la cita"),
        emailBox(
          "Al cliente (confirmación de cita y reserva)",
          "Asunto: '¡Cita confirmada! Reserva tu vehículo — [Nombre del vehículo]'\n\n" +
          "Contenido: Confirmación de que la cita está reservada con todos los detalles: " +
          "fecha, hora, dirección y persona de contacto. Mensaje recordatorio de que el " +
          "vehículo está reservado hasta la fecha de la visita."
        ),
        new Paragraph({ spacing: { after: 120 }, text: "" }),
        emailBox(
          "Al equipo interno CarsWise",
          "Asunto: '🔄 Lead Cita confirmada — [Nombre del vehículo]'\n\n" +
          "Notificación de que el cliente confirmó la cita."
        ),
        new Paragraph({ spacing: { after: 160 }, text: "" }),

        h2("6.4 Cuando el cliente cancela una cita (con vehículo reservado)"),
        emailBox(
          "A usuarios en lista de espera de ese vehículo",
          "Asunto: '🚗 Disponible de nuevo — [Nombre del vehículo]'\n\n" +
          "Contenido: Aviso de que el vehículo que habían marcado para seguir vuelve a estar disponible. " +
          "Incluye enlace directo al anuncio."
        ),
        new Paragraph({ spacing: { after: 160 }, text: "" }),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("7. Panel del cliente: qué puede hacer"),

        p("El cliente accede a su panel en carswiseai.com/panel/solicitudes. Aquí ve todas sus solicitudes organizadas en cuatro pestañas:"),

        bullet("Pendiente gestionar: solicitudes activas que aún no tienen cita confirmada."),
        bullet("En curso: citas confirmadas con fecha futura."),
        bullet("Finalizadas: citas pasadas y solicitudes cerradas."),
        bullet("Canceladas: solicitudes anuladas."),

        h2("Acciones disponibles para el cliente"),

        h3("Ver el estado de su solicitud"),
        bullet("Ve el estado actual (Pendiente, Contactado, En proceso, etc.) en tiempo real."),
        bullet("El panel se actualiza automáticamente cada 30 segundos para reflejar cambios hechos desde el ERP."),

        h3("Ver la respuesta de CarsWise"),
        bullet("Si el empleado ha escrito una respuesta en el ERP, el cliente la ve en un cuadro azul dentro de su solicitud."),

        h3("Ver los detalles de la cita asignada"),
        bullet("Fecha, hora, dirección y persona de contacto (nombre del comercial)."),

        h3("Confirmar la cita"),
        bullet("Solo disponible cuando CarsWise ha asignado una fecha y el estado es 'Contactado' o 'En proceso'."),
        bullet("Aparece un aviso urgente en amarillo: '⚠️ Confirma tu cita para reservar el vehículo'."),
        bullet("Al confirmar, el vehículo queda reservado y el estado cambia a 'Cita confirmada'."),

        h3("Solicitar cambio de fecha (reagendado)"),
        bullet("Disponible cuando hay una cita asignada y no está en estado 'Reagendar solicitado'."),
        bullet("El cliente propone hasta 3 opciones de fecha y hora."),
        bullet("Las propuestas se guardan y aparecen en el ERP para que el empleado elija una."),
        bullet("El cliente puede ver las fechas que propuso en su panel (debajo del mensaje de 'Reagendar solicitado')."),
        bullet("El empleado selecciona una opción y vuelve a notificar al cliente, que debe confirmar de nuevo."),

        h3("Anular la cita"),
        bullet("El cliente puede cancelar en cualquier momento desde su panel."),
        bullet("Si el vehículo estaba reservado, la reserva se libera y los usuarios en lista de espera reciben un email."),
        bullet("El empleado recibe un email interno con el aviso de cancelación."),

        h3("Ver el anuncio del vehículo"),
        bullet("Enlace directo al anuncio del portal donde se encontró el vehículo."),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("8. Cola de llamadas proactivas"),

        p("En la pestaña 'Cola de llamadas' del ERP hay dos segmentos de usuarios que NO han hecho ninguna solicitud pero sí han mostrado interés:"),

        h2("8.1 Vieron oferta (sin solicitud)"),
        p("Usuarios que visitaron una o más fichas de vehículo en el marketplace pero no llegaron a solicitar visita ni información. Son leads calientes que se han 'enfriado'. La llamada proactiva puede ser:"),
        bullet("'Hola, hemos visto que viste el [nombre del vehículo]. ¿Puedo ayudarte a resolver alguna duda?'"),

        h2("8.2 Registrados inactivos"),
        p("Usuarios que crearon una cuenta en CarsWise pero nunca hicieron ninguna solicitud. Ya confiaron en la plataforma (se registraron) pero no dieron el paso. La llamada proactiva puede ser:"),
        bullet("'Hola, hemos visto que creaste una cuenta. ¿Te puedo ayudar a encontrar el vehículo que buscas?'"),

        h2("Cómo gestionar la cola de llamadas"),

        step("1", "Abre el ERP → Leads → pestaña 'Cola de llamadas'."),
        step("2", "Selecciona el segmento: 'Vieron oferta' o 'Registrados inactivos'."),
        step("3", "Ajusta el período (7, 14, 30 o 60 días) según cuánto tiempo atrás quieres buscar."),
        step("4", "Haz clic en una fila para ver los detalles del contacto y su actividad en la web."),
        step("5", "Llama al cliente (si tiene teléfono conocido) o escríbele al email que aparece."),
        step("6", "Registra el resultado con uno de estos botones:\n" +
                   "        • ✓ Llamado: la llamada se realizó con éxito.\n" +
                   "        • ↩ No contesta: marcar para volver a intentarlo.\n" +
                   "        • × Descartar: no hay interés real."),
        step("7", "Puedes añadir notas sobre la llamada (ej: 'Interesado pero pide financiación, volver en 2 semanas')."),

        note("Los contactos resueltos (Llamado / Descartado) se ocultan de la cola por defecto. Usa 'Mostrar resueltos' para verlos todos."),
        note("Puedes reabrir un contacto con '↩ Reabrir' si necesitas volver a llamarle más adelante."),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("9. Exportar leads a Excel"),

        step("1", "Aplica los filtros que quieras (estado, tipo, origen, búsqueda de texto)."),
        step("2", "Haz clic en el botón '↓ Exportar Excel' (esquina superior derecha de la tabla)."),
        step("3", "Se descarga un archivo CSV con hasta 1.000 registros que incluye: fecha, email, vehículo, tipo, origen, estado, nombre del contacto, teléfono, disponibilidad y respuesta de CarsWise."),
        note("El archivo CSV se puede abrir directamente en Excel. Si los caracteres especiales (tildes, ñ) se muestran mal, abre Excel → Datos → Desde texto/CSV → selecciona codificación UTF-8."),

        divider(),

        // ══════════════════════════════════════════════════════════════════════
        h1("10. Historial de cambios por lead"),

        p("Cada lead guarda un registro de todos los cambios que se han hecho, con fecha, hora y quién lo hizo. Para verlo:"),

        step("1", "Abre cualquier lead haciendo clic en su fila."),
        step("2", "En la parte inferior del modal, debajo de las notas, aparece la sección 'Historial'."),
        step("3", "Cada línea muestra: fecha/hora, operador (email del empleado) y qué cambió (estado, respuesta al cliente, fecha de cita, etc.)."),

        note("El historial es de solo lectura. Sirve para auditar quién hizo qué y cuándo, y para resolver dudas si hay discrepancias."),

        divider(),

        // ── Pie de página ──
        new Paragraph({
          children: [
            new TextRun({ text: "CarsWise · Guía interna de gestión de leads · ", size: 18, color: "94A3B8" }),
            new TextRun({ text: "Versión 1.0", size: 18, color: "94A3B8", italics: true }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        }),
      ],
    },
  ],
});

const outPath = path.join(__dirname, "..", "Guia_Gestion_Leads_CarsWise.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("✅ Documento generado:", outPath);
});
