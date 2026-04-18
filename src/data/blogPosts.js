export const BLOG_POSTS = [
  {
    slug: "guia-compra-coche-segunda-mano-espana",
    title: "Guia 2026 para comprar coche de segunda mano en Espana sin errores caros",
    description:
      "Checklist practico para revisar precio, historial, kilometraje, mantenimiento y riesgo legal antes de comprar un coche usado.",
    publishedAt: "2026-04-18",
    readTime: "8 min",
    category: "Compra inteligente",
    intro:
      "Comprar un coche usado puede ser una gran decision o un problema caro. Esta guia resume un proceso claro para reducir riesgo y negociar mejor.",
    sections: [
      {
        heading: "1) Valida primero el encaje financiero real",
        paragraphs: [
          "No te quedes solo con el precio de compra. Calcula coste total mensual: financiacion, seguro, combustible, mantenimiento y posibles averias.",
          "Como regla rapida, intenta que el coste total del coche no supere el 20% de tus ingresos netos mensuales si no tienes otras deudas relevantes.",
        ],
      },
      {
        heading: "2) Contrasta el precio con mercado real",
        paragraphs: [
          "Compara al menos 20 anuncios equivalentes: mismo modelo, motorizacion, ano, kilometraje y acabado.",
          "Si una unidad esta muy por debajo del rango, exige explicaciones documentadas. Lo barato sin trazabilidad suele salir caro.",
        ],
      },
      {
        heading: "3) Revisa historial y trazabilidad",
        bullets: [
          "Informe de vehiculo y titularidad al dia.",
          "Libro de mantenimiento o facturas verificables.",
          "ITV coherente con kilometraje y fechas.",
          "Comprobacion de cargas o reservas de dominio antes de firmar.",
        ],
      },
      {
        heading: "4) Inspeccion tecnica minima antes de reservar",
        bullets: [
          "Arranque en frio y test de ruidos anormales.",
          "Revision de humos, vibraciones y cambios de marcha.",
          "Desgaste irregular de neumaticos y frenos.",
          "Comprobacion de fugas y estado de bateria.",
        ],
      },
      {
        heading: "5) Negociacion basada en datos",
        paragraphs: [
          "Negocia sobre hechos: mantenimientos pendientes, neumaticos, frenos, pequenos danos y dispersion de precio frente a mercado.",
          "Pide por escrito lo acordado: garantia, fecha de entrega, kilometraje declarado y estado de elementos criticos.",
        ],
      },
    ],
    conclusion:
      "La compra inteligente no depende de encontrar un milagro, sino de reducir incertidumbre con un proceso. Cuanto mejor documentada este la operacion, menor riesgo asumiras.",
  },
  {
    slug: "renting-vs-compra-2026-que-conviene-segun-tu-uso",
    title: "Renting vs compra en 2026: que te conviene segun uso, kilometros y liquidez",
    description:
      "Analisis claro para decidir entre renting y compra segun horizonte de uso, estabilidad de ingresos y riesgo de depreciacion.",
    publishedAt: "2026-04-18",
    readTime: "7 min",
    category: "Decision de movilidad",
    intro:
      "No existe una respuesta universal. Renting y compra tienen sentido en escenarios distintos. Esta comparativa te ayuda a elegir con criterio economico.",
    sections: [
      {
        heading: "1) Cuando renting suele ganar",
        bullets: [
          "Quieres cuota predecible y evitar sorpresas de mantenimiento.",
          "Renuevas coche cada 3-5 anos.",
          "Priorizas liquidez y no quieres inmovilizar entrada alta.",
          "Buscas simplificar gestion (seguro, mantenimiento, asistencia).",
        ],
      },
      {
        heading: "2) Cuando compra suele ganar",
        bullets: [
          "Vas a mantener el coche muchos anos.",
          "Haces kilometraje estable y bien conocido.",
          "Puedes asumir mantenimiento con plan preventivo.",
          "Tu objetivo es reducir coste total tras amortizacion.",
        ],
      },
      {
        heading: "3) Variables clave para comparar bien",
        paragraphs: [
          "Compara coste total anual, no solo cuota. Incluye seguro, impuestos, neumáticos, mantenimientos, averias probables y valor futuro de reventa.",
          "Mide tambien el coste de oportunidad del dinero: entrada inicial, financiacion y liquidez que dejas de tener.",
        ],
      },
      {
        heading: "4) Errores frecuentes",
        bullets: [
          "Elegir por cuota mensual sin revisar limite de kilometros.",
          "Subestimar depreciacion en compra.",
          "No valorar penalizaciones por uso o devolucion en renting.",
          "Decidir sin escenario de ingresos y cambios familiares a 3 anos.",
        ],
      },
      {
        heading: "5) Regla practica para decidir",
        paragraphs: [
          "Si valoras estabilidad de gasto, flexibilidad de renovacion y menor carga operativa, renting suele encajar mejor.",
          "Si priorizas coste total a largo plazo y puedes gestionar el ciclo completo del vehiculo, compra suele ser superior.",
        ],
      },
    ],
    conclusion:
      "La mejor decision es la que encaja con tu uso real y tu contexto financiero. Un buen analisis previo evita cambiar de estrategia a mitad de camino.",
  },
];

export function getBlogPostBySlug(slug = "") {
  return BLOG_POSTS.find((post) => post.slug === slug) || null;
}
