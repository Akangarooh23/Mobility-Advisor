/**
 * La tasacion: quien la ha usado, cuanto cuesta y como se entrega.
 *
 * Antes solo existia pagando, asi que todo esto vivia dentro del webhook de
 * Stripe: llegaba el pago, se generaba el PDF y se mandaba. Desde que la
 * primera es gratuita hay dos caminos —uno pasa por Stripe y el otro no— y los
 * dos tienen que acabar exactamente igual: mismo PDF, mismo correo y la misma
 * fila registrada.
 *
 * Esa fila no es contabilidad, es el contador: es lo que decide si a alguien le
 * queda su gratuita. Si un camino se olvidara de escribirla, ese cliente
 * tendria tasaciones gratis para siempre.
 */
"use strict";

const { contarTasacionesDe, addValuationByEmail, listGarageVehicles } = require("./billingStore");

/** La matricula como se compara: sin espacios ni guiones y en mayusculas. */
const comoSeCompara = (m) => String(m || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Cual de sus coches es el que se ha tasado.
 *
 * La tasacion llega con la matricula que escribio, no con el identificador del
 * coche. Sin enganchar una cosa con la otra, la fila queda con `vehicle_id` a
 * nulo y la puerta de «La tasacion» de su encargo no se abre nunca: le seguimos
 * diciendo «no te la has hecho todavia» con el informe ya en su correo.
 *
 * Si no es ninguno de los suyos se devuelve nulo y ya. Tasar un coche que no
 * esta en el garaje es legitimo —para eso esta la tasacion suelta—, y lo que no
 * se puede es colgarsela al coche equivocado.
 */
async function cualDeSusCoches(email, matricula) {
  const busco = comoSeCompara(matricula);
  if (!busco) return null;
  try {
    const coches = await listGarageVehicles(email);
    const suyo = (coches || []).find((c) => comoSeCompara(c && c.plate) === busco);
    return (suyo && suyo.id) || null;
  } catch (err) {
    // Sin garaje se guarda igual, suelta. Perder el enganche es peor que nada,
    // pero mucho menos que perder la fila entera: esa es la que cuenta las
    // gratuitas.
    console.error("[tasacion] no se pudo mirar su garaje:", err && err.message);
    return null;
  }
}

/** El precio de una sola, en centimos. */
const PRECIO_UNITARIO_CENTIMOS = 199;

/**
 * Descuento por volumen: precio por unidad segun cuantos coches se tasan.
 *
 * Es la curva que ya habia —100, 90, 80, 70, 60 y 50 por ciento— aplicada al
 * precio nuevo. Antes arrancaba en 10 euros porque ese era el precio de una.
 *
 * El tramo se calcula sobre el **total** de coches, no sobre los que se cobran:
 * quien trae cinco entra en el tramo de cinco aunque pague cuatro. Es mas facil
 * de explicar —el descuento va por el tamano de tu flota— y no penaliza justo
 * en los saltos.
 */
const TRAMOS = [
  { hasta: 1, centimos: 199 },
  { hasta: 4, centimos: 179 },
  { hasta: 9, centimos: 159 },
  { hasta: 19, centimos: 139 },
  { hasta: 49, centimos: 119 },
  { hasta: 99, centimos: 99 },
];

/** El precio por unidad para una flota de `cuantos` coches, o null si no cabe. */
function precioPorUnidad(cuantos) {
  const tramo = TRAMOS.find((t) => cuantos <= t.hasta);
  return tramo ? tramo.centimos : null;
}

/**
 * Si a este usuario le queda su tasacion gratuita.
 *
 * Se ancla a la cuenta y no a la matricula a proposito: por matricula, quien
 * subiera cinco coches nuevos los tasaria los cinco gratis, y la idea era
 * regalar la primera, no la primera de cada coche.
 *
 * Ante un fallo al consultar devuelve `false` —es decir, cobra—. Es la
 * direccion prudente: equivocarse cobrando se ve y se devuelve; equivocarse
 * regalando no se ve, y regala tantas veces como se pulse el boton.
 */
async function leQuedaLaGratuita(identityOrEmail) {
  const correo =
    typeof identityOrEmail === "string"
      ? identityOrEmail
      : identityOrEmail?.email || identityOrEmail?.user?.email || "";
  try {
    const cuantas = await contarTasacionesDe(correo);
    // null es "no lo se", no "ninguna": ante la duda se cobra.
    if (cuantas === null) {
      console.error("[tasacion] no se pudo contar las previas, se cobra");
      return false;
    }
    return cuantas === 0;
  } catch (err) {
    console.error("[tasacion] no se pudo contar las previas, se cobra:", err?.message);
    return false;
  }
}

/**
 * Lo que hay que cobrar por tasar `cuantos` coches, contando la gratuita.
 *
 * Devuelve tambien `gratis`, que es cuantas van sin cobrar: hoy una o ninguna,
 * pero el que llama no tiene por que saberlo.
 */
function importe({ cuantos, conGratuita }) {
  const unidad = precioPorUnidad(cuantos);
  if (unidad === null) return null;
  const gratis = conGratuita ? Math.min(1, cuantos) : 0;
  const aCobrar = cuantos - gratis;
  return {
    unidadCentimos: unidad,
    gratis,
    aCobrar,
    totalCentimos: unidad * aCobrar,
  };
}

/**
 * Guarda el PDF del informe en el cajón privado y devuelve dónde quedó.
 *
 * Hasta ahora el informe solo existía en el correo: se generaba, se mandaba
 * adjunto y se tiraba. Quien perdía ese correo se quedaba sin él, y desde su
 * panel no había manera de volver a bajarlo — con el número ya guardado en su
 * ficha y el PDF en ninguna parte.
 *
 * Si falla, se devuelve vacío y ya. Que no se pueda archivar el PDF no puede
 * tumbar el registro de la tasación: esa fila es la que cuenta las gratuitas.
 */
async function guardaElInforme({ email, pdfBuffer, valuationId }) {
  if (!pdfBuffer) return "";
  try {
    const { uploadBase64ToSupabase, BUCKET_PRIVADO, safeName } = require("./supabaseStorage");
    const camino = `tasaciones/${safeName(String(email || "sin-correo"))}/${valuationId}.pdf`;
    const subido = await uploadBase64ToSupabase(
      pdfBuffer.toString("base64"), "application/pdf", camino, BUCKET_PRIVADO
    );
    return subido ? camino : "";
  } catch (err) {
    console.error("[tasacion] no se pudo archivar el PDF:", err && err.message);
    return "";
  }
}

/**
 * Deja constancia de una tasacion entregada.
 *
 * Se llama desde los dos caminos. Si falla, se registra y no se lanza: al
 * cliente ya se le ha mandado su informe y no se le puede dejar con un error
 * en pantalla por un problema de nuestra contabilidad. El precio de eso es que
 * una fila perdida le regala otra gratuita, que es el lado barato.
 */
async function registrarEntregada({ email, vehicle = {}, reportData = {}, pagada, pdfBuffer = null }) {
  try {
    const valuationId = `valuation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const titulo =
      [vehicle.brand, vehicle.model, vehicle.year ? `(${vehicle.year})` : ""].filter(Boolean).join(" ") ||
      "Vehiculo tasado";
    await addValuationByEmail(email, {
      id: valuationId,
      title: titulo,
      meta: pagada ? "Tasacion de pago" : "Primera tasacion, gratuita",
      status: "Ultima tasacion disponible",
      /*
       * De qué coche y por cuánto.
       *
       * Las dos faltaban, y las dos en silencio. El precio se mandaba como
       * `estimate_value` y quien escribe lee `estimateValue`: nunca coincidían,
       * así que la fila se guardaba con el importe a nulo — con el correo ya
       * salido diciendo «20.795 €». Y sin coche, la puerta de «La tasación» de
       * su encargo no se abre nunca: le seguimos pidiendo una tasación que ya
       * tiene en su bandeja de entrada.
       */
      vehicleId: await cualDeSusCoches(email, vehicle.plate),
      estimateValue: Number(reportData?.priceOptimal) || null,
      // Y el informe archivado, para que lo pueda volver a bajar desde su panel.
      pdfPath: await guardaElInforme({ email, pdfBuffer, valuationId }),
    });
    return true;
  } catch (err) {
    console.error("[tasacion] no se pudo registrar la entregada:", err?.message);
    return false;
  }
}

/**
 * Genera el informe, lo manda y deja constancia. Los dos caminos acaban aqui.
 *
 * El PDF se pide de forma perezosa —`require` dentro y no arriba— porque
 * `sellReportGenerator` arrastra pdfkit y los datos de mercado, y este modulo
 * lo carga tambien el checkout, que en la mayoria de las llamadas solo necesita
 * saber el precio. En una funcion serverless ese arranque se paga en cada frio.
 *
 * Si el PDF falla, el correo sale igual sin adjunto: es lo que ya hacia el
 * webhook, y tener el precio en el cuerpo del correo vale mas que nada.
 */
async function entregar({ email, vehicle, pagada }) {
  const { sendValuationEmail } = require("./tasacion-correo");
  let pdfBuffer = null;
  let reportData = {};
  try {
    ({ pdfBuffer, reportData } = await require("./sellReportGenerator").generateSellReport(vehicle));
  } catch (err) {
    console.error("[tasacion] no se pudo generar el PDF, va sin adjunto:", err?.message);
  }
  await sendValuationEmail({ to: email, pdfBuffer, reportData, vehicle });
  await registrarEntregada({ email, vehicle, reportData, pagada, pdfBuffer });
  return { reportData };
}

module.exports = {
  PRECIO_UNITARIO_CENTIMOS,
  TRAMOS,
  precioPorUnidad,
  leQuedaLaGratuita,
  importe,
  comoSeCompara,
  cualDeSusCoches,
  guardaElInforme,
  registrarEntregada,
  entregar,
};
