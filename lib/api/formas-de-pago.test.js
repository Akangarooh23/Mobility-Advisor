/**
 * Cómo se paga el depósito, y a qué cuenta.
 *
 * Esto se rompió delante de un cliente. Al pulsar «Pagar el depósito ahora»,
 * Stripe devolvía «The country provided (ES) is not supported for
 * `eu_bank_transfer` details», en inglés y dentro del modal, porque la sesión ni
 * siquiera llegaba a abrirse.
 *
 * El país de `eu_bank_transfer` **no es el del cliente**: es dónde emite Stripe
 * el IBAN virtual al que transfiere, y España no está entre los que puede. Da
 * igual cuál de los cuatro sea —una transferencia SEPA en euros cuesta y tarda
 * lo mismo— pero tiene que ser uno de ellos.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  formasDePago, paisDeLaCuenta, PAISES_DE_TRANSFERENCIA,
} = require("./billing-checkout-handler.js");

const PAIS = "payment_method_options[customer_balance][bank_transfer][eu_bank_transfer][country]";

describe("el país de la cuenta a la que transfiere", () => {
  test("nunca es España, que es lo que rompía el pago", () => {
    delete process.env.STRIPE_BANK_TRANSFER_COUNTRY;
    assert.notEqual(paisDeLaCuenta(), "ES");
    assert.ok(PAISES_DE_TRANSFERENCIA.includes(paisDeLaCuenta()));
  });

  test("y tampoco si alguien la pone a mano en una variable", () => {
    // Una variable mal puesta volvería a romperlo, y se rompería en producción
    // y delante del cliente. Se valida contra la lista, no se acepta y ya está.
    process.env.STRIPE_BANK_TRANSFER_COUNTRY = "ES";
    assert.equal(paisDeLaCuenta(), "DE");
    process.env.STRIPE_BANK_TRANSFER_COUNTRY = "lo que sea";
    assert.equal(paisDeLaCuenta(), "DE");
    delete process.env.STRIPE_BANK_TRANSFER_COUNTRY;
  });

  test("uno de los que sí valen se respeta, en mayúsculas o en minúsculas", () => {
    process.env.STRIPE_BANK_TRANSFER_COUNTRY = "nl";
    assert.equal(paisDeLaCuenta(), "NL");
    delete process.env.STRIPE_BANK_TRANSFER_COUNTRY;
  });

  test("y es el que viaja en la sesión de pago", () => {
    assert.equal(formasDePago("sk_live_loquesea")[PAIS], "DE");
  });
});

describe("con qué se puede pagar", () => {
  test("en real, solo transferencia", () => {
    // Son veinte mil euros: ni pasan por la tarjeta de un particular, ni
    // queremos unos 300 € de comisión, que es el 10 % de nuestro fee.
    const real = formasDePago("sk_live_loquesea");
    assert.equal(real["payment_method_types[0]"], "customer_balance");
    assert.equal(real["payment_method_types[1]"], undefined);
  });

  test("en prueba, además tarjeta, para poder recorrer el flujo entero", () => {
    const prueba = formasDePago("sk_test_loquesea");
    assert.equal(prueba["payment_method_types[0]"], "card");
    assert.equal(prueba["payment_method_types[1]"], "customer_balance");
  });

  test("y una clave restringida de prueba también es de prueba", () => {
    // Empieza por `rk_`, no por `sk_`. Mirando el prefijo entero, una `rk_test_`
    // se tomaba por real y dejaba la prueba sin forma de pagar.
    const restringida = formasDePago("rk_test_loquesea");
    assert.equal(restringida["payment_method_types[0]"], "card");
  });

  test("una restringida real sigue siendo real", () => {
    assert.equal(formasDePago("rk_live_loquesea")["payment_method_types[0]"], "customer_balance");
  });

  test("sin clave, no se ofrece tarjeta", () => {
    assert.equal(formasDePago("")["payment_method_types[0]"], "customer_balance");
    assert.equal(formasDePago(null)["payment_method_types[0]"], "customer_balance");
  });
});
