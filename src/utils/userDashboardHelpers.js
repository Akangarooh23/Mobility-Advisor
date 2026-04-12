import { normalizeText } from "./offerHelpers";

export function buildUserDashboardModel({
  savedComparisons = [],
  userAppointments = [],
  result = null,
  sellAiResult = null,
  sellAnswers = {},
  sellListingResult = null,
}) {
  const dashboardSavedComparisons = Array.isArray(savedComparisons)
    ? savedComparisons.slice(0, 3)
    : [];

  const advisorAppointments = result
    ? [
        {
          id: "advisor-follow-up",
          title: "Revisión personalizada MoveAdvisor",
          meta: `${normalizeText(result?.solucion_principal?.titulo) || "Tu plan de movilidad"} · pendiente de reservar`,
          status: "Pendiente",
        },
      ]
    : [];

  const dashboardAppointments = [...userAppointments, ...advisorAppointments].slice(0, 6);

  const dashboardValuations = sellAiResult
    ? [
        {
          id: "sell-valuation",
          title:
            sellAnswers?.brand && sellAnswers?.model
              ? `${sellAnswers.brand} ${sellAnswers.model}`
              : "Vehículo en valoración",
          meta:
            normalizeText(sellAiResult?.report) ||
            "Tasación generada a partir del estado, kilometraje y demanda estimada.",
          status: sellListingResult ? "Tasación vinculada a venta activa" : "Última tasación disponible",
        },
      ]
    : [];

  const userVehicleSections = [
    {
      key: "owned",
      title: "Comprados",
      items: [],
      empty: "Todavía no has marcado vehículos como comprados.",
    },
    {
      key: "sold",
      title: "Vendidos",
      items: [],
      empty: "Aún no tienes operaciones de venta cerradas.",
    },
    {
      key: "active-sale",
      title: "Activos en venta",
      items:
        sellAnswers?.brand && sellAnswers?.model
          ? [
              {
                title: `${sellAnswers.brand} ${sellAnswers.model}`,
                meta: `${sellAnswers.year || "Año pendiente"} · ${sellAnswers.sellerType === "profesional" ? "Venta profesional" : "Venta particular"}`,
                status: sellListingResult ? "Publicado en seguimiento" : "Borrador listo para publicar",
              },
            ]
          : [],
      empty: "No hay anuncios activos en venta ahora mismo.",
    },
  ];

  return {
    dashboardSavedComparisons,
    dashboardAppointments,
    dashboardValuations,
    userVehicleSections,
  };
}
