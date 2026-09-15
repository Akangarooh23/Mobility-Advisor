"use strict";

/**
 * Rehacer el PDF de una tasación que ya se entregó.
 *
 * ## Por qué hace falta
 *
 * Hasta hace nada el informe solo existía en el correo: se generaba, se mandaba
 * adjunto y se tiraba. Las tasaciones de antes de empezar a archivarlos no
 * tienen fichero, y quien perdió ese correo se quedó sin informe con el precio
 * guardado en su ficha.
 *
 * ## Por qué el precio se fija y no se recalcula
 *
 * Recalcularlo da otro número. No porque el mercado se haya movido, sino porque
 * el formulario de tasación pregunta cosas que la ficha del coche no guarda
 * —daños, ITV, propietarios, historial— y sin ellas la cuenta no es la misma:
 * en la prueba de Ana salían 20.036 € frente a los 20.795 € que ella tiene.
 *
 * Un informe que contradice el número de su propia ficha es peor que no tener
 * informe. Así que el precio que manda es **el que se le dijo**, y el resto del
 * documento —comparables, histograma, portales— se dibuja con los datos de
 * mercado de hoy, que es lo único que hay.
 *
 * La banda se mueve con el precio en la misma proporción: dejarla como salga
 * del cálculo nuevo podría dejar el precio fijado fuera de su propio rango, que
 * es una contradicción que se ve a simple vista en la barra del PDF.
 */

const { buildReportData, buildPdf, getClosingFactor } = require("./sellReportGenerator");
const { getMarketPriceSnapshot } = require("./inventoryStore");

/**
 * El informe, con el precio que se le dijo en su día.
 *
 * Función aparte y sin nada de red: es la regla que importa y así se puede
 * probar sin mercado, sin PDF y sin base de datos.
 */
function conElPrecioGuardado(informe, precioGuardado) {
  const precio = Math.round(Number(precioGuardado) || 0);
  const calculado = Math.round(Number(informe && informe.priceOptimal) || 0);
  // Sin un precio guardado que valga, se deja el informe como está: inventar
  // una corrección sobre un cero daría un documento a cero euros.
  if (!informe || precio <= 0 || calculado <= 0) return informe;

  const proporcion = precio / calculado;
  const cierre = getClosingFactor(precio);
  return {
    ...informe,
    priceOptimal: precio,
    priceLow: Math.round((Number(informe.priceLow) || 0) * proporcion),
    priceHigh: Math.round((Number(informe.priceHigh) || 0) * proporcion),
    priceClose: cierre ? Math.round(precio * cierre.factor) : null,
    closeTranche: (cierre && cierre.tranche) || null,
  };
}

/** Lo que el mercado necesita saber del coche para buscarle comparables. */
function comoSeBusca(vehicle = {}) {
  const numero = (v) => {
    const n = Number(String(v ?? "").replace(/\./g, "").replace(/,/g, "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    desiredType: "compra",
    brand: String(vehicle.brand || ""),
    model: String(vehicle.model || ""),
    version: String(vehicle.version || ""),
    fuel: String(vehicle.fuel || ""),
    transmission: String(vehicle.transmission || ""),
    year: numero(vehicle.year),
    mileage: numero(vehicle.mileage),
    powerCv: numero(vehicle.powerCv),
  };
}

/**
 * El PDF de una tasación ya entregada, o `null`.
 *
 * No pasa por Gemini ni escribe telemetría: esto no es una tasación nueva, es
 * volver a dibujar una que ya se hizo. Contarla otra vez en las métricas diría
 * que se han entregado dos.
 */
async function rehazElInforme({ vehicle, precioGuardado }) {
  if (!vehicle || !vehicle.brand || !vehicle.model) return null;
  const national = await getMarketPriceSnapshot(comoSeBusca(vehicle));
  const informe = buildReportData(vehicle, national, null);
  return buildPdf(conElPrecioGuardado(informe, precioGuardado));
}

module.exports = { conElPrecioGuardado, comoSeBusca, rehazElInforme };
