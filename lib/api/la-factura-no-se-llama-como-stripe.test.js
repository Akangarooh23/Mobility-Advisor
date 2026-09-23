/**
 * Nuestras facturas no se llaman como las llama Stripe.
 *
 * `moveadvisor_user_invoices.id` guardaba el identificador de la sesión de pago
 * (`cs_test_a1rey…`). Una factura es nuestra: si el día de mañana se cambia de
 * pasarela, las emitidas hasta entonces se quedan nombradas por un proveedor
 * que ya no se usa, y cualquier cosa que las relacione con algo tiene dentro un
 * dato de un tercero.
 *
 * Desde la migración 0005 la clave la pone la base y lo de fuera vive en
 * `referencia_externa`, que **sigue siendo única**: es lo que evita emitir dos
 * veces la misma factura cuando un webhook de Stripe llega repetido, y llega.
 *
 * Se comprueba leyendo el fuente porque estos dos caminos hablan con Stripe y
 * con la base a la vez; lo que hay que fijar es dónde se escribe cada cosa.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WEBHOOK = fs.readFileSync(path.join(__dirname, "billing-webhook-handler.js"), "utf8");
const DEVOLUCION = fs.readFileSync(path.join(__dirname, "fianza-devolucion-handler.js"), "utf8");

/** El texto de una consulta, sin comentarios alrededor. */
function insercionDeFacturas(fuente) {
  const i = fuente.indexOf("INSERT INTO moveadvisor_user_invoices");
  assert.ok(i > 0, "ya no hay ninguna inserción de facturas: ¿se ha movido?");
  return fuente.slice(i, i + 700);
}

describe("al guardar una factura", () => {
  test("lo de Stripe va a referencia_externa, no a la clave", () => {
    const sql = insercionDeFacturas(WEBHOOK);
    assert.match(sql, /\(referencia_externa, email/, "la primera columna ya no puede ser `id`");
    assert.ok(!/\(id, email, number/.test(sql), "eso era guardar la factura con el nombre que le puso otro");
  });

  test("y el repetido se detecta por esa referencia", () => {
    // Sin esto, un webhook que llega dos veces emite dos facturas del mismo
    // cobro. Y llega dos veces: Stripe reintenta.
    assert.match(insercionDeFacturas(WEBHOOK), /ON CONFLICT \(referencia_externa\)/);
  });

  test("la rectificativa de una fianza, igual", () => {
    const sql = insercionDeFacturas(DEVOLUCION);
    assert.match(sql, /\(referencia_externa, email/);
    assert.match(sql, /ON CONFLICT \(referencia_externa\) DO NOTHING/);
  });

  test("y busca su factura original por la referencia", () => {
    // Buscarla por `id` no encontraba nada, y la rectificativa salía sin decir
    // a qué factura rectifica. Eso en una rectificativa no puede faltar.
    assert.match(DEVOLUCION, /WHERE referencia_externa = \$1 AND number IS NOT NULL/);
  });
});

describe("y después de guardarla", () => {
  test("se sigue tocando por el identificador que devuelve la base", () => {
    assert.match(WEBHOOK, /RETURNING id/, "el upsert tiene que devolver la clave de la fila");
    assert.match(WEBHOOK, /const idDeLaFila = await upsertInvoiceToPostgres/);
    // Lo que se actualiza después —el número, los suplidos, el PDF— va por esa
    // clave. Si alguien vuelve a usar `factura.id` aquí, escribe en el vacío.
    assert.ok(
      !/markInvoiceGenerated\(factura\.id\)|uploadInvoicePdfAndSaveUrl\(factura\.id/.test(WEBHOOK),
      "eso apunta a la referencia de Stripe, que ya no es la clave"
    );
    assert.ok(
      !/markInvoiceGenerated\(invoiceRecord\.id\)/.test(WEBHOOK),
      "lo mismo en el camino de la tasación"
    );
  });
});
