/**
 * La puerta del mercado: 23 reglas de `vercel.json` entran por aquí.
 *
 * El reparto lo hace `lib/api/enrutador.js`, que es el mismo para las tres
 * puertas. Aquí solo queda la tabla: qué ruta lleva a qué manejador, y qué
 * trozo de URL vale por un `?route=` cuando no viene.
 *
 * Los manejadores se cargan al usarse, no al arrancar. Antes se requerían los
 * 24 arriba del todo y eso eran 311 módulos y 313 ms en cada arranque en frío,
 * los pidiera la petición o no.
 */
const { creaEnrutador } = require("../lib/api/enrutador");

/**
 * Sin `?route=`, se mira la URL. El orden manda: gana el primero que encaja,
 * igual que la cadena de `if` que había aquí. `import-lead` va antes que
 * `import-offers` y eso no es casualidad.
 */
const ALIAS = [
  ["market-price", "price"],
  ["import-lead", "import-lead"],
  // La pide el ERP con el secreto compartido: la clave de Stripe vive aqui.
  ["fianza-devolucion", "fianza-devolucion"],
  ["fianza-confirmar", "fianza-confirmar"],
  ["entrega-direccion", "entrega-direccion"],
  ["mandato-firmado", "mandato-firmado"],
  ["cita-taller", "cita-taller"],
  ["clausula-precio", "clausula-precio"],
  ["papeles-venta", "papeles-venta"],
  ["import-offers", "import"],
  ["marketplace-vo", "vo"],
  ["workshops-nearby", "nearby"],
  ["workshop-availability", "availability"],
  ["workshops-enrich", "enrich"],
  ["workshops-photo", "photo"],
];

const RUTAS = {
  price:       () => require("../lib/api/market-price-handler"),
  vo:          () => require("../lib/api/marketplace-vo-handler"),
  "modelo-3d": () => require("../lib/api/vehicle-model-public-handler"),
  import:      () => require("../lib/api/import-offers-handler"),
  // El catálogo entero en una lista, solo para la app: la web sigue con sus
  // tres buscadores y sus tres pantallas.
  "app-catalogo": () => require("../lib/api/app-catalogo-handler"),
  "import-lead":  () => require("../lib/api/import-lead-handler"),
  "fianza-devolucion": () => require("../lib/api/fianza-devolucion-handler"),
  "fianza-confirmar":  () => require("../lib/api/fianza-confirmar-handler"),
  "entrega-direccion": () => require("../lib/api/entrega-direccion-handler"),
  "mandato-firmado":   () => require("../lib/api/mandato-firmado-handler"),
  "cita-taller":       () => require("../lib/api/cita-del-taller-handler"),
  "clausula-precio":   () => require("../lib/api/clausula-precio-handler"),
  "papeles-venta":     () => require("../lib/api/papeles-de-la-venta-handler"),
  "tasacion-pdf":      () => require("../lib/api/tasacion-pdf-handler"),
  og:           () => require("../lib/api/marketplace-og-handler"),
  nearby:       () => require("../lib/api/workshops-nearby-handler"),
  availability: () => require("../lib/api/workshop-availability-handler"),
  enrich:       () => require("../lib/api/workshops-enrich-handler"),
  photo:        () => require("../lib/api/workshops-photo-handler"),
  whatsapp:     () => require("../lib/api/whatsapp-handler"),
  "erp-appointment":       () => require("../lib/api/erp-appointment-handler"),
  "user-erp-appointments": () => require("../lib/api/user-erp-appointments-handler"),
  "condition-report":      () => require("../lib/api/condition-report-handler"),
  // Para el ERP, con el secreto compartido: ver el manejador.
  "informe-de-estado-interno": () => require("../lib/api/informe-de-estado-interno-handler"),
};

module.exports = creaEnrutador({
  rutas: RUTAS,
  alias: ALIAS,
  noEncontrada: "Market route not found",
});
