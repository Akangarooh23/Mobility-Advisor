/**
 * La puerta de la facturación: la cuenta, el pago, el portal y las facturas.
 *
 * El reparto lo hace `lib/api/enrutador.js`, el mismo de las otras dos puertas.
 *
 * ── Lo que había y ya no está ──────────────────────────────────────────────
 *
 * El `resolveRoute` de este fichero devolvía `"webhook"` para las URLs que
 * llevaran `billing-webhook`, y el `switch` no tenía ese caso: el webhook de
 * Stripe vive en su propia función, `api/billing-webhook.js`, porque necesita
 * el cuerpo en crudo para comprobar la firma. Así que esa rama caía al 404 sin
 * decir nada.
 *
 * Se quita. Sin ella, esas URLs no resuelven ninguna ruta y caen al mismo 404
 * con el mismo texto: el comportamiento es idéntico, solo que ahora no hay una
 * línea que sugiera que el webhook se atiende aquí.
 */
const { creaEnrutador } = require("../lib/api/enrutador");

/** Sin `?route=`, se mira la URL. El orden manda: gana el primero que encaja. */
const ALIAS = [
  ["billing-account", "account"],
  ["billing-checkout", "checkout"],
  ["billing-portal", "portal"],
  ["invoice-pdf", "invoice-pdf"],
];

const RUTAS = {
  // Solo por `?route=ping`: no tiene alias y nunca lo tuvo.
  ping:     () => require("../lib/api/billing-ping-handler"),
  account:  () => require("../lib/api/billing-account-handler"),
  checkout: () => require("../lib/api/billing-checkout-handler"),
  portal:   () => require("../lib/api/billing-portal-handler"),
  "invoice-pdf": () => require("../lib/api/invoice-pdf-handler"),
};

module.exports = creaEnrutador({
  rutas: RUTAS,
  alias: ALIAS,
  noEncontrada: "Billing route not found",
});
