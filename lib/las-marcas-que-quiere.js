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
 * Qué marca es de cada familia es una decisión de producto, no técnica. Aquí
 * está la que ya existía, tal cual: Ford y Opel no cuentan como generalistas
 * europeas aunque fabriquen en Valencia y en Zaragoza. Si eso cambia, se
 * cambia aquí y lo aplican todos.
 */

const LAS_MARCAS_DE_CADA_FAMILIA = {
  generalista_europea: ["volkswagen", "seat", "renault", "skoda", "peugeot", "citroen", "dacia"],
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
