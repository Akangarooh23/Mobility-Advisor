const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} = require("docx");

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 220, after: 120 } });
}

function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 } });
}

function p(text) {
  return new Paragraph({ text, spacing: { after: 70 } });
}

function b(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    spacing: { after: 40 },
  });
}

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 30 },
  });
}

async function generate() {
  const now = new Date();
  const dateText = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${now.getFullYear()}`;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: "INFORME FUNCIONAL CARSWISE", bold: true, size: 34 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Resumen por hojas, funcionalidades y arquitectura", size: 24 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Fecha: ${dateText}`, italics: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
          }),

          h1("1. Resumen ejecutivo"),
          p("CarsWise es una plataforma digital de movilidad que cubre el ciclo completo del coche: decision de compra o renting, gestion del vehiculo durante su uso, valoracion para venta y operativa de cuenta/suscripcion del usuario."),
          b("Capas funcionales del producto:"),
          bullet("Captacion y conversion: landing, contenido, contacto y onboarding."),
          bullet("Decision inteligente: cuestionario, analisis IA y recomendaciones accionables."),
          bullet("Operacion de usuario: panel privado con guardadas, alertas, vehiculos y gestiones."),
          bullet("Monetizacion: suscripciones, checkout y portal de cliente."),

          h1("2. Frontend principal (paginas)"),
          h2("Nucleo"),
          bullet("src/App.js: orquestador de rutas y estado global. Activa el flujo adecuado (home, consejo, decision, sell, servicios, portal VO, dashboard, blog)."),
          bullet("src/index.js: punto de entrada de React."),
          bullet("src/i18n.js + src/locales/es.json + src/locales/en.json: internacionalizacion de la interfaz."),

          h2("Flujos de negocio"),
          bullet("src/pages/LandingPage.js: portada comercial con CTA, pricing y acceso a flujos."),
          bullet("src/pages/VehicleOptionsPage.js, BuyOptionsPage.js, RentingOptionsPage.js: seleccion de via de adquisicion."),
          bullet("src/pages/QuestionnairePage.js: cuestionario multietapa con pasos avanzados (multi, dual timeline, score weights)."),
          bullet("src/pages/AdviceResultsPage.js: resultados del asesor con vista de analisis y vista de ofertas."),
          bullet("src/pages/DecisionPage.js: filtros detallados de decision (precio, kilometraje, edad, potencia, ubicacion, combustible)."),
          bullet("src/pages/SellPage.js: valoracion de coche para venta con estrategia y comparables."),

          h2("Servicios y marca"),
          bullet("src/pages/ServiceOptionsPage.js: menu de servicios."),
          bullet("src/pages/ServiceInsurancePage.js: simulacion de seguro."),
          bullet("src/pages/ServiceMaintenancePage.js: estimacion de mantenimiento."),
          bullet("src/pages/ServiceAutogestorPage.js: recordatorios operativos del vehiculo (ITV, seguro, mantenimiento)."),
          bullet("src/pages/AboutCarswisePage.js, ContactCarswisePage.js, BlogIndexPage.js, BlogArticlePage.js: contenido corporativo, contacto y SEO."),

          h1("3. Submodulos de resultados"),
          bullet("src/pages/adviceResults/ResultsHeader.js: cabecera y navegacion entre vistas."),
          bullet("src/pages/adviceResults/ResultsAnalysisView.js: explicacion de recomendacion, score, TCO y transparencia."),
          bullet("src/pages/adviceResults/ResultsOffersView.js: ofertas recomendadas y validacion rapida del usuario."),
          bullet("src/pages/adviceResults/adviceResults.helpers.js: normalizacion de datos y armado de modelos de vista."),

          h1("4. Dashboard de usuario"),
          bullet("src/pages/userDashboard/UserDashboardPage.js: contenedor principal del panel."),
          bullet("src/pages/userDashboard/UserDashboardHome.js: resumen, indicadores y avisos."),
          bullet("src/pages/userDashboard/UserDashboardSaved.js: recomendaciones guardadas, alertas y coincidencias."),
          bullet("src/pages/userDashboard/UserDashboardOperations.js: operaciones/citas/gestiones y cobertura por plan."),
          bullet("src/pages/userDashboard/UserDashboardVehicles.js: garaje de usuario, alta/baja/edicion de vehiculos y adjuntos."),
          bullet("src/pages/userDashboard/UserDashboardValuations.js: historico de valoraciones."),
          bullet("src/pages/userDashboard/UserDashboardBilling.js: perfil de facturacion y suscripcion."),

          h1("5. Componentes UI relevantes"),
          bullet("src/components/CircularSteps.js + src/components/CircularSteps.css: componente visual circular de pasos clave del journey."),
          bullet("src/components/offers/ResolvedOfferImage.js: render robusto de imagenes de oferta con fallback y sello de garantia."),

          h1("6. Hooks (logica de estado)"),
          bullet("src/hooks/useAdvisorController.js: controlador maestro de navegacion y acciones de flujo."),
          bullet("src/hooks/useAppBootstrap.js: hidratacion inicial de sesion, preferencias y datos persistidos."),
          bullet("src/hooks/useDashboardNavigation.js: sincronizacion de panel con ruta/historial."),
          bullet("src/hooks/useMarketCatalog.js: carga de catalogo de vehiculos desde API con fallback."),
          bullet("src/hooks/useUserMobilitySync.js: sincronizacion de movilidad del usuario."),
          bullet("src/hooks/useSavedRecommendations.js, usePlanCheckout.js, useAuthSessionReset.js, useAppPreferences.js: guardados, checkout, sesion y preferencias."),

          h1("7. Utils (motor funcional)"),
          bullet("src/utils/apiClient.js: cliente API centralizado con parseo robusto."),
          bullet("src/utils/analysisFlows.js: prompts y flujos de analisis IA."),
          bullet("src/utils/advisorResults.js: parseo y normalizacion de respuestas IA."),
          bullet("src/utils/businessHelpers.js: calculos de negocio (ranking, presupuestos, validaciones)."),
          bullet("src/utils/offerHelpers.js y portalVoHelpers.js: utilidades de ofertas, proveedores, media y marketplace VO."),
          bullet("src/utils/storage.js: persistencia local de estado de usuario, alertas y borradores."),

          h1("8. Backend API"),
          bullet("api/analyze.js: endpoint de recomendacion IA."),
          bullet("api/find-listing.js: agregacion y normalizacion de ofertas externas de compra/renting."),
          bullet("api/offer-image.js: proxy de imagenes y fallback visual."),
          bullet("api/auth.js y api/auth-status.js: autenticacion, sesiones y diagnostico de proveedor."),
          bullet("api/billing-account.js, billing-checkout.js, billing-portal.js, billing-webhook.js: cuenta, suscripcion y ciclo Stripe."),
          bullet("api/send-alert-email.js: envio de resumentes de alertas (Resend o simulado)."),
          bullet("api/vehicle-catalog.js y api/erp-catalog.js: catalogo de marcas/modelos/versiones."),

          h1("9. Persistencia y datos"),
          bullet("lib/billingStore.js: almacenamiento de cuenta/movilidad con backend local o Postgres."),
          bullet("lib/sqlserverMobilityStore.js: almacenamiento equivalente para SQL Server."),
          bullet("src/data/*: fuentes estaticas de pasos, catalogos, planes y contenido editorial."),

          h1("10. Entorno tecnico y lenguajes"),
          bullet("Frontend: React + JavaScript + CSS."),
          bullet("Backend: Node.js (handlers HTTP modulares)."),
          bullet("Bases de datos: JSON local, PostgreSQL y SQL Server segun configuracion."),
          bullet("Integraciones: Gemini (analisis IA), Stripe (suscripciones), Resend (email)."),
          bullet("i18n: i18next + react-i18next."),

          h1("11. Conclusion"),
          p("CarsWise esta construido como una plataforma modular: una capa de experiencia comercial, una capa de inteligencia de decision, una capa operativa para el usuario y una capa de monetizacion. La arquitectura permite evolucionar componentes de forma independiente (frontend, APIs, storage y proveedores externos) manteniendo coherencia de producto end-to-end."),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), "Informe_CarsWise_Detallado.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log(`Documento generado: ${outputPath}`);
}

generate().catch((error) => {
  console.error("Error generando el documento:", error);
  process.exit(1);
});
