"use strict";

/**
 * Lo que decide quién recibe un correo comercial y quién no.
 *
 * Se prueba sin base delante porque la decisión no la toma la base: la toman
 * estas dos funciones. Y se equivocan de dos maneras caras.
 *
 * Una es mandarle publicidad a quien la retiró, que es una reclamación. La otra
 * es dejar de mandársela a quien sí la quiere, que es perder a un cliente sin
 * enterarse. Las dos están abajo.
 */

const test = require("node:test");
const assert = require("node:assert");
const { estadoDesde, queCambia } = require("./consentimientos");

const fila = (tipo, concedido, ocurrio_en) => ({ tipo, concedido, ocurrio_en });

test("quien consintió antes de que existiera el historial sigue consintiendo", () => {
  // No tiene ni una fila: todo lo suyo está en las columnas de siempre. Si esto
  // devolviera «no», el día de estrenar esto se dejarían de mandar de golpe
  // todos los correos que sí estaban autorizados.
  const estado = estadoDesde([], {
    consent_marketing_email_at: "2026-01-04T10:00:00Z",
    consent_marketing_sms_at: null,
    consent_thirdparty_email_at: "2026-01-04T10:00:00Z",
    consent_thirdparty_sms_at: null,
  });

  assert.deepEqual(estado, {
    marketing_email: true,
    marketing_sms: false,
    thirdparty_email: true,
    thirdparty_sms: false,
  });
});

test("el historial manda sobre la columna", () => {
  // Lo dio en su día —la columna tiene fecha— y luego lo retiró. Que la columna
  // siga teniendo fecha no puede devolverle el consentimiento.
  const estado = estadoDesde([fila("marketing_email", false, "2026-05-02T09:00:00Z")], {
    consent_marketing_email_at: "2026-01-04T10:00:00Z",
  });

  assert.equal(estado.marketing_email, false);
});

test("de tres idas y venidas vale la última", () => {
  const estado = estadoDesde(
    [
      fila("marketing_email", true, "2026-01-01T10:00:00Z"),
      fila("marketing_email", false, "2026-03-01T10:00:00Z"),
      fila("marketing_email", true, "2026-06-01T10:00:00Z"),
    ],
    {},
  );

  assert.equal(estado.marketing_email, true);
});

test("el orden de las filas no cambia el resultado", () => {
  // Llegan ordenadas por fecha, pero eso lo decide una consulta y las consultas
  // cambian. Que la respuesta dependa del orden de lectura sería un fallo que
  // solo aparece el día que alguien toque el ORDER BY.
  const alReves = estadoDesde(
    [
      fila("marketing_sms", false, "2026-06-01T10:00:00Z"),
      fila("marketing_sms", true, "2026-01-01T10:00:00Z"),
    ],
    {},
  );

  assert.equal(alReves.marketing_sms, false);
});

test("una fila de un tipo que no conocemos no ensucia nada", () => {
  const estado = estadoDesde([fila("lo_que_sea", true, "2026-06-01T10:00:00Z")], {});
  assert.deepEqual(Object.keys(estado).sort(), [
    "marketing_email",
    "marketing_sms",
    "thirdparty_email",
    "thirdparty_sms",
  ]);
});

test("guardar sin tocar nada no escribe nada", () => {
  const actual = { marketing_email: true, marketing_sms: false };
  assert.deepEqual(queCambia(actual, { marketing_email: true, marketing_sms: false }), []);
});

test("solo se apunta lo que cambia", () => {
  const actual = {
    marketing_email: true,
    marketing_sms: false,
    thirdparty_email: false,
    thirdparty_sms: false,
  };
  const cambios = queCambia(actual, {
    marketing_email: false,
    marketing_sms: false,
    thirdparty_email: true,
    thirdparty_sms: false,
  });

  assert.deepEqual(cambios, [
    { tipo: "marketing_email", concedido: false },
    { tipo: "thirdparty_email", concedido: true },
  ]);
});

test("lo que no se manda se queda como estaba", () => {
  // Una pantalla que solo enseñe dos de los cuatro no puede apagar los otros
  // dos sin que nadie los haya tocado.
  const actual = {
    marketing_email: true,
    marketing_sms: true,
    thirdparty_email: true,
    thirdparty_sms: true,
  };
  assert.deepEqual(queCambia(actual, { marketing_email: false }), [
    { tipo: "marketing_email", concedido: false },
  ]);
});

test("un valor que no es booleano no concede nada", () => {
  // Del cuerpo de una petición puede llegar cualquier cosa. «"true"», «1» o
  // «"on"» no son un sí: un consentimiento se da marcando una casilla, no
  // mandando algo que se le parezca.
  const actual = { marketing_email: false };
  assert.deepEqual(queCambia(actual, { marketing_email: "true" }), []);
  assert.deepEqual(queCambia(actual, { marketing_email: 1 }), []);
});
