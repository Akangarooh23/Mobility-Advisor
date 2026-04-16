export const TOTAL_PURCHASE_OPTIONS = [
  { value: "hasta_10000", label: "Hasta 10.000 €", amount: 10000 },
  { value: "10000_20000", label: "10.000 - 20.000 €", amount: 20000 },
  { value: "20000_30000", label: "20.000 - 30.000 €", amount: 30000 },
  { value: "30000_45000", label: "30.000 - 45.000 €", amount: 45000 },
  { value: "45000_70000", label: "45.000 - 70.000 €", amount: 70000 },
  { value: "70000_100000", label: "70.000 - 100.000 €", amount: 100000 },
  { value: "100000_150000", label: "100.000 - 150.000 €", amount: 150000 },
  { value: "mas_150000", label: "Más de 150.000 €", amount: 180000 },
];

export const MONTHLY_BUDGET_OPTIONS = [
  { value: "hasta_200", label: "Hasta 200 €/mes" },
  { value: "200_400", label: "200 - 400 €/mes" },
  { value: "400_700", label: "400 - 700 €/mes" },
  { value: "mas_700", label: "Más de 700 €/mes" },
];

export const MOBILITY_TYPES = {
  compra_contado: { label: "Compra al Contado", icon: "🔑", color: "#2563EB" },
  compra_financiada: { label: "Compra Financiada", icon: "📝", color: "#7C3AED" },
  renting_largo: { label: "Renting a Largo Plazo", icon: "📅", color: "#059669" },
  renting_corto: { label: "Renting a Corto Plazo", icon: "🗓️", color: "#D97706" },
  rent_a_car: { label: "Rent a Car", icon: "🏢", color: "#DC2626" },
  carsharing: { label: "Carsharing", icon: "🔄", color: "#0891B2" },
  carpooling: { label: "Carpooling", icon: "🤝", color: "#65A30D" },
  transporte_publico: { label: "Transporte Público", icon: "🚇", color: "#9333EA" },
  micromovilidad: { label: "Micromovilidad", icon: "🛴", color: "#E11D48" },
};

export const ANSWER_BUDGET_TO_FILTER = {
  menos_200: "hasta_200",
  hasta_200: "hasta_200",
  "200_350": "200_400",
  "200_400": "200_400",
  "350_500": "400_700",
  "400_700": "400_700",
  mas_500: "400_700",
  mas_700: "mas_700",
};

export const INCOME_STABILITY_OPTIONS = [
  { value: "fijos_estables", label: "Fijos y estables" },
  { value: "fijos_variable", label: "Fijos + variable" },
  { value: "variables_autonomo", label: "Variables / autónomo" },
];

export const FINANCE_AMOUNT_OPTIONS = [
  { value: "hasta_10000", label: "Hasta 10.000 €", amount: 10000 },
  { value: "10000_15000", label: "10.000 - 15.000 €", amount: 15000 },
  { value: "15000_25000", label: "15.000 - 25.000 €", amount: 25000 },
  { value: "25000_40000", label: "25.000 - 40.000 €", amount: 40000 },
  { value: "mas_40000", label: "Más de 40.000 €", amount: 50000 },
];

export const ENTRY_AMOUNT_OPTIONS = [
  { value: "sin_entrada", label: "Sin entrada", amount: 0 },
  { value: "hasta_5000", label: "Hasta 5.000 €", amount: 5000 },
  { value: "5000_10000", label: "5.000 - 10.000 €", amount: 10000 },
  { value: "10000_15000", label: "10.000 - 15.000 €", amount: 15000 },
  { value: "mas_15000", label: "Más de 15.000 €", amount: 20000 },
];

export const AGE_FILTER_OPTIONS = [
  { value: "all", label: "Cualquier antigüedad" },
  { value: "2", label: "0 - 2 años" },
  { value: "4", label: "0 - 4 años" },
  { value: "6", label: "0 - 6 años" },
  { value: "8", label: "0 - 8 años" },
];

export const MILEAGE_FILTER_OPTIONS = [
  { value: "all", label: "Sin límite de kilometraje" },
  { value: "20000", label: "Hasta 20.000 km" },
  { value: "50000", label: "Hasta 50.000 km" },
  { value: "80000", label: "Hasta 80.000 km" },
  { value: "120000", label: "Hasta 120.000 km" },
];

export const SELL_FUEL_OPTIONS = ["Gasolina", "Diésel", "Híbrido", "PHEV", "Eléctrico"];

export const ADVISOR_PILLARS = [
  {
    title: "Financiación",
    text: "Analizamos ahorro disponible, cuota razonable, scoring previo y si tiene más sentido préstamo al consumo, financiera de punto de venta o renting.",
  },
  {
    title: "TCO real",
    text: "Proyectamos mantenimiento preventivo, averías probables, seguros, IVTM, combustible, parking y otros costes mensuales más allá del precio de compra.",
  },
  {
    title: "Garantías",
    text: "Valoramos la cobertura de marca y vendedor, el riesgo jurídico y la opción de defensa o extensión de garantía para proteger la operación.",
  },
  {
    title: "Pricing",
    text: "Usamos inteligencia de mercado para leer rango de precios, rotación, días anunciados y calidad de oferta en compra y renting.",
  },
  {
    title: "Mercado y sesgos",
    text: "Aplicamos señales de mercado y fiabilidad para penalizar motorizaciones o versiones con incidencias recurrentes y premiar las más sólidas.",
  },
  {
    title: "Valor futuro",
    text: "Estimamos depreciación y valor de salida probable según canal, demanda, volumen en renting y comportamiento del VO.",
  },
];
