export const PRICING_SECTION_COPY = {
  pill: "PLANES VISUALES (SIN RESTRICCIONES ACTIVAS)",
  title: "Planes de gestión y servicios",
  description:
    "Esta sección es solo de presentación. Precios y características se podrán editar más adelante sin tocar lógica.",
  comparisonTitle: "Cobertura",
  ctaSoonLabel: "Próximamente",
};

export const SERVICE_PLANS = [
  {
    id: "gratis",
    name: "Plan Gratis",
    monthlyPrice: "0",
    accent: "#22c55e",
    background: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.30)",
    badge: "Para empezar",
    badgeBackground: "rgba(34,197,94,0.18)",
    highlights: [
      "1 alerta activa",
      "Comparador básico",
      "Acceso a ofertas destacadas",
      "Soporte comunitario",
    ],
    ctaLabel: "Empezar gratis",
    billing: {
      checkoutEnabled: false,
      stripePriceId: "",
    },
  },
  {
    id: "bronce",
    name: "Plan Bronce",
    monthlyPrice: "29",
    accent: "#b45309",
    background: "rgba(180,83,9,0.10)",
    border: "rgba(245,158,11,0.28)",
    badge: "Entrada",
    badgeBackground: "rgba(245,158,11,0.18)",
    highlights: [
      "Alertas y comparador básico",
      "Revisión documental inicial",
      "Descuento en tasación externa",
      "Soporte por email",
    ],
    ctaLabel: "Elegir Bronce",
    billing: {
      checkoutEnabled: false,
      stripePriceId: "",
    },
  },
  {
    id: "plata",
    name: "Plan Plata",
    monthlyPrice: "79",
    accent: "#94a3b8",
    background: "rgba(148,163,184,0.10)",
    border: "rgba(148,163,184,0.28)",
    badge: "Más equilibrado",
    badgeBackground: "rgba(148,163,184,0.2)",
    highlights: [
      "Todo lo de Bronce",
      "1 tasación profesional incluida",
      "1 informe de historial incluido",
      "Gestión de transferencia asistida",
    ],
    featured: true,
    ctaLabel: "Elegir Plata",
    billing: {
      checkoutEnabled: false,
      stripePriceId: "",
    },
  },
  {
    id: "oro",
    name: "Plan Oro",
    monthlyPrice: "149",
    accent: "#f59e0b",
    background: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.30)",
    badge: "Servicio avanzado",
    badgeBackground: "rgba(245,158,11,0.18)",
    highlights: [
      "Todo lo de Plata",
      "3 tasaciones profesionales",
      "3 informes de historial",
      "Verificación mecánica partner",
    ],
    ctaLabel: "Elegir Oro",
    billing: {
      checkoutEnabled: false,
      stripePriceId: "",
    },
  },
  {
    id: "platino",
    name: "Plan Platino",
    monthlyPrice: "299",
    accent: "#22d3ee",
    background: "rgba(34,211,238,0.10)",
    border: "rgba(34,211,238,0.30)",
    badge: "Integral",
    badgeBackground: "rgba(34,211,238,0.2)",
    highlights: [
      "Todo lo de Oro",
      "Cupo alto de tasaciones e informes",
      "Gestor personal de operaciones",
      "SLA y soporte prioritario",
    ],
    ctaLabel: "Elegir Platino",
    billing: {
      checkoutEnabled: false,
      stripePriceId: "",
    },
  },
];

export const PLAN_COMPARISON_ROWS = [
  {
    label: "Tasaciones incluidas",
    values: ["0", "0", "1", "3", "Cupo alto"],
  },
  {
    label: "Informes de historial",
    values: ["No incluido", "Con descuento", "1 incluido", "3 incluidos", "Cupo alto"],
  },
  {
    label: "Gestión de transferencia",
    values: ["No incluida", "Guía", "Asistida", "Completa", "Completa + gestor"],
  },
  {
    label: "Soporte",
    values: ["Comunidad", "Email", "Prioritario", "Prioritario + teléfono", "SLA dedicado"],
  },
];

export const FUTURE_BILLING_BLUEPRINT = {
  provider: "stripe",
  enabled: false,
  note: "Estructura lista para activar checkout cuando toque integrar pagos reales.",
};