"use strict";

/**
 * Las marcas de cada familia, en un solo sitio.
 *
 * ## Por qué esto está aquí y no en el buscador
 *
 * Estaba solo en `api/find-listing.js`, y se usaba solo para filtrar en
 * JavaScript las ofertas ya traídas. Así que dos cosas que tenían que saberlo
 * no lo sabían:
 *
 *   - La **consulta**, que se traía coches de marcas que el cliente había
 *     descartado y los tiraba después, sobre una ventana pequeña.
 *   - La **lista de modelos recomendados**, que a quien pidió «generalista
 *     europea» le propuso un Ford Focus y un Toyota Yaris. Los dos existían y
 *     cumplían todo lo demás, pero el filtro de marca los tiraba justo
 *     después: le recomendaba dos coches que no le iba a enseñar.
 *
 * ## Lo que NO decide este fichero
 *
 * Qué marca es de cada familia es una decisión de producto, no técnica. Lo que
 * hay aquí lo decidió Ana, y las razones están anotadas para que la próxima
 * persona no tenga que volver a discutirlas.
 */

const LAS_MARCAS_DE_CADA_FAMILIA = {
  /*
   * Generalistas europeas: nueve marcas.
   *
   * Opel y Fiat se añadieron después. Faltaban, y no era un detalle: medido
   * sobre las ofertas españolas visibles, dejarlas fuera escondía **91.676
   * coches** a quien elegía esta opción —Opel 53.527 y Fiat 38.149—, más que
   * Skoda y Dacia juntas, que sí estaban.
   *
   * Opel es de Rüsselsheim; fue de General Motors hasta 2017 y hoy está en
   * Stellantis. Por origen y por dueño actual, europea. Fiat es italiana y
   * generalista de manual.
   *
   * FORD NO ESTÁ, y es a propósito: es de Dearborn, Michigan. Fabrica en
   * Almussafes desde 1976, pero la marca no es europea, y son 64.902 ofertas
   * que no salen por esta opción.
   *
   * Alfa Romeo, DS, Lancia y Abarth tampoco: son europeas, pero son las
   * marcas deportivas o premium de estos mismos grupos, no generalistas.
   * Cupra queda fuera por lo mismo, aunque sea de Martorell.
   */
  generalista_europea: [
    "volkswagen", "seat", "renault", "skoda", "peugeot", "citroen", "dacia",
    "opel", "fiat",
  ],
  asiatica_fiable: ["toyota", "kia", "hyundai", "nissan", "lexus", "mazda", "honda", "byd", "mg", "xpeng"],
  premium_alemana: ["bmw", "audi", "mercedes"],
  premium_escandinava: ["volvo"],
  nueva_china: ["byd", "mg", "xpeng", "omoda", "jaecoo"],
};

/** Las marcas que acepta, o `null` si no ha pedido ninguna familia. */
function lasMarcasQueQuiere(answers = {}) {
  const familia = String(answers.marca_preferencia ?? "").trim();
  const marcas = LAS_MARCAS_DE_CADA_FAMILIA[familia];
  return marcas && marcas.length ? [...marcas] : null;
}

module.exports = { LAS_MARCAS_DE_CADA_FAMILIA, lasMarcasQueQuiere };
