import { normalizeText } from "./offerHelpers";

export function buildUserDashboardModel({
  savedComparisons = [],
  userAppointments = [],
  userValuations = [],
  userVehicleStates = [],
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
          title: "Revisión personalizada CarAdvisor",
          meta: `${normalizeText(result?.solucion_principal?.titulo) || "Tu plan de movilidad"} · pendiente de reservar`,
          status: "Pendiente",
        },
      ]
    : [];

  const dashboardAppointments = [...userAppointments, ...advisorAppointments].slice(0, 6);

  const persistedValuations = Array.isArray(userValuations)
    ? userValuations
        .map((item) => ({
          id: normalizeText(item?.id),
          title: normalizeText(item?.title) || normalizeText(item?.vehicleTitle) || "Vehiculo en valoracion",
          meta: normalizeText(item?.meta) || normalizeText(item?.report),
          status: normalizeText(item?.status) || "Ultima tasacion disponible",
        }))
        .filter((item) => item.id)
        .slice(0, 6)
    : [];

  const derivedValuations = sellAiResult
    ? [
        {
          id: "sell-valuation",
          title:
            sellAnswers?.brand && sellAnswers?.model
              ? `${sellAnswers.brand} ${sellAnswers.model}`
              : "Vehiculo en valoracion",
          meta:
            normalizeText(sellAiResult?.report) ||
            "Tasacion generada a partir del estado, kilometraje y demanda estimada.",
          status: sellListingResult ? "Tasacion vinculada a venta activa" : "Ultima tasacion disponible",
        },
      ]
    : [];

  const dashboardValuations = [...persistedValuations, ...derivedValuations].slice(0, 6);

  const persistedSections = {
    owned: [],
    sold: [],
    "active-sale": [],
  };

  if (Array.isArray(userVehicleStates)) {
    userVehicleStates.forEach((item) => {
      const state = normalizeText(item?.state).toLowerCase();
      const sectionKey = state === "active_sale" ? "active-sale" : state;

      if (!persistedSections[sectionKey]) {
        return;
      }

      const title = normalizeText(item?.title)
        || `${normalizeText(item?.brand)} ${normalizeText(item?.model)}`.trim()
        || "Vehiculo";

      const extraMeta = [normalizeText(item?.year), normalizeText(item?.notes)].filter(Boolean).join(" · ");

      persistedSections[sectionKey].push({
        id: normalizeText(item?.vehicleId),
        title,
        meta: extraMeta,
        status:
          sectionKey === "active-sale"
            ? "Publicado en seguimiento"
            : sectionKey === "sold"
            ? "Operacion cerrada"
            : "Vehiculo disponible",
      });
    });
  }

  const userVehicleSections = [
    {
      key: "owned",
      title: "Comprados",
      items: persistedSections.owned,
      empty: "Todavía no has marcado vehículos como comprados.",
    },
    {
      key: "sold",
      title: "Vendidos",
      items: persistedSections.sold,
      empty: "Aún no tienes operaciones de venta cerradas.",
    },
    {
      key: "active-sale",
      title: "Activos en venta",
      items: [
        ...persistedSections["active-sale"],
        ...(
        sellAnswers?.brand && sellAnswers?.model
          ? [
              {
                title: `${sellAnswers.brand} ${sellAnswers.model}`,
                meta: `${sellAnswers.year || "Año pendiente"} · ${sellAnswers.sellerType === "profesional" ? "Venta profesional" : "Venta particular"}`,
                status: sellListingResult ? "Publicado en seguimiento" : "Borrador listo para publicar",
              },
            ]
          : []
        ),
      ],
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
