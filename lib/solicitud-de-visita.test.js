"use strict";

/**
 * Pedir visita sin cuenta, sin reponer lo que la cuenta arreglaba.
 *
 * La sesión se puso a propósito: antes cualquiera reservaba a nombre de otro
 * —y a esa persona le llegaban los correos de una cita que no pidió— o llenaba
 * el calendario de un vendedor desde una terminal. Lo que se prueba aquí es que
 * el enlace por correo tapa esos dos agujeros, no que el formulario sea bonito.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const S = require("./solicitud-de-visita");

describe("qué falta para pedirla", () => {
  const bien = {
    slotId: "s1", offerId: "idcar-1",
    buyerEmail: "quien@ejemplo.com", buyerName: "Ana", buyerPhone: "684717736",
  };

  test("con todo puesto, nada", () => {
    assert.equal(S.faltaParaPedirla(bien), "");
  });

  test("sin un correo de verdad no se puede probar nada", () => {
    // Es la pieza entera: si el correo no vale, el enlace no llega y no hay
    // forma de saber que quien pide es quien dice.
    for (const malo of ["", "ana", "ana@", "@ejemplo.com", "ana@ejemplo", null]) {
      assert.notEqual(S.faltaParaPedirla({ ...bien, buyerEmail: malo }), "", String(malo));
    }
  });

  test("el teléfono se exige, y de verdad", () => {
    /*
     * La mitad de lo que nos paga el vendedor es que le llevemos compradores
     * con los que se pueda hablar. Un correo suelto no lo es.
     */
    assert.notEqual(S.faltaParaPedirla({ ...bien, buyerPhone: "" }), "");
    assert.notEqual(S.faltaParaPedirla({ ...bien, buyerPhone: "12345" }), "");
    assert.equal(S.faltaParaPedirla({ ...bien, buyerPhone: "+34 684 71 77 36" }), "");
  });

  test("y el nombre también", () => {
    // Quien va a abrirle la puerta de su casa a alguien tiene derecho a saber
    // a quién.
    assert.notEqual(S.faltaParaPedirla({ ...bien, buyerName: "" }), "");
  });

  test("sin hueco no hay nada que pedir", () => {
    assert.notEqual(S.faltaParaPedirla({ ...bien, slotId: "" }), "");
    assert.notEqual(S.faltaParaPedirla({ ...bien, offerId: "" }), "");
  });

  test("lo que falta se dice en una frase que se puede leer", () => {
    // Sale en el formulario, delante de una persona.
    assert.match(S.faltaParaPedirla({ ...bien, buyerEmail: "" }), /correo/i);
  });
});

describe("el hueco no se aparta al pedirlo", () => {
  test("guardar una solicitud no toca la disponibilidad", () => {
    /*
     * Es la decisión que evita todo un reloj: apartar obligaría a soltar
     * después, y mientras tanto bastaría con pedir seis veces para dejar un
     * coche sin horas sin haber confirmado ni un correo.
     */
    assert.ok(!/vehicle_visit_availability/.test(S.SQL_GUARDA), "la solicitud está apartando el hueco");
    assert.ok(!/UPDATE/i.test(S.SQL_GUARDA));
    assert.match(S.SQL_GUARDA, /INSERT INTO vehicle_visit_requests/);
  });
});

describe("el enlace", () => {
  test("vale un día", () => {
    assert.equal(S.HORAS_DE_VALIDEZ, 24);
  });

  test("una solicitud ya confirmada no vuelve a valer", () => {
    // Reenviar el enlace crearía una segunda cita para la misma persona y el
    // mismo hueco.
    assert.match(S.SQL_POR_TOKEN, /confirmada_at IS NULL/);
  });

  test("ni una caducada", () => {
    assert.match(S.SQL_POR_TOKEN, /expira_at > NOW\(\)/);
  });

  test("y solo se confirma una vez, aunque se pulse dos", () => {
    /*
     * Dos pestañas, o un cliente de correo que precarga enlaces. Sin esto,
     * salen dos citas del mismo enlace.
     */
    assert.match(S.SQL_MARCA_CONFIRMADA, /WHERE id = \$1 AND confirmada_at IS NULL/);
    assert.match(S.SQL_MARCA_CONFIRMADA, /RETURNING id/);
  });

  test("cada token es distinto", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => S.nuevoToken()));
    assert.equal(vistos.size, 200);
  });

  test("la dirección lleva el token y no se come la barra", () => {
    assert.equal(S.elEnlace("https://popcar.es", "abc"), "https://popcar.es/confirmar-visita?t=abc");
    assert.equal(S.elEnlace("https://popcar.es/", "abc"), "https://popcar.es/confirmar-visita?t=abc");
  });
});

describe("cuántas se aguantan sin confirmar", () => {
  test("tres a la vez por correo", () => {
    // No es contra el que se equivoca: es contra el que pide veinte para que
    // el vendedor reciba veinte correos.
    assert.equal(S.SIN_CONFIRMAR_A_LA_VEZ, 3);
  });

  test("y las caducadas no cuentan contra ese tope", () => {
    // Si contaran, quien pidió tres hace un mes no podría volver a pedir nunca.
    assert.match(S.SQL_CUANTAS_SIN_CONFIRMAR, /expira_at > NOW\(\)/);
    assert.match(S.SQL_CUANTAS_SIN_CONFIRMAR, /confirmada_at IS NULL/);
  });

  test("el tope es por correo, mires como mires las mayúsculas", () => {
    assert.match(S.SQL_CUANTAS_SIN_CONFIRMAR, /lower\(buyer_email\) = lower\(\$1\)/);
  });
});

describe("el correo que se manda", () => {
  const correo = S.elCorreoDeConfirmacion({
    vehicleTitle: "Seat Ibiza 2019", cuando: "jueves 12 a las 18:00",
    enlace: "https://popcar.es/confirmar-visita?t=abc",
  });

  test("desde el asunto se sabe que hay que hacer algo", () => {
    assert.match(correo.subject, /Confirma/);
    assert.match(correo.subject, /Seat Ibiza 2019/);
  });

  test("y dice claramente que todavía no hay cita", () => {
    /*
     * Un correo que diera la cita por hecha haría que quien no pulsa se
     * presentara igual, y el vendedor no estaría esperándole. Eso es peor que
     * no mandar nada.
     */
    assert.match(correo.html, /todavía no está reservada/i);
  });

  test("lleva el enlace", () => {
    assert.match(correo.html, /https:\/\/popcar\.es\/confirmar-visita\?t=abc/);
  });

  test("y le dice al que no pidió nada que no tiene que hacer nada", () => {
    // Es la otra mitad de tapar el agujero: si alguien pone tu correo, lo que
    // te llega no te obliga a nada.
    assert.match(correo.html, /Si no has sido tú, no hagas nada/i);
  });
});

describe("cómo está cableado en la ruta", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const FUENTE = fs
    .readFileSync(path.join(__dirname, "api/visit-availability-handler.js"), "utf8")
    .replace(/\r\n/g, "\n");

  test("sin sesión, «book» no reserva: manda a pedirlo por correo", () => {
    /*
     * Es la línea que separa esto de reponer el fallo que la sesión arreglaba.
     * Si «book» aceptara un correo del cuerpo sin comprobarlo, volveríamos a
     * poder reservar a nombre de otro.
     */
    assert.match(FUENTE, /if \(!buyerEmail\) \{[\s\S]{0,600}pide_por_correo/);
    assert.ok(
      !/route === "book"[\s\S]{0,2000}buyerEmail: body\.buyerEmail/.test(FUENTE),
      "«book» está usando el correo del cuerpo sin comprobarlo",
    );
  });

  test("«solicitar» comprueba antes de guardar nada", () => {
    const trozo = FUENTE.slice(FUENTE.indexOf('route === "solicitar"'));
    const valida = trozo.indexOf("faltaParaPedirla");
    const guarda = trozo.indexOf("SQL_GUARDA");
    assert.ok(valida > 0 && guarda > 0);
    assert.ok(valida < guarda, "guarda la solicitud antes de mirar si vale");
  });

  test("y mira el tope de sin confirmar", () => {
    assert.match(FUENTE, /SQL_CUANTAS_SIN_CONFIRMAR/);
    assert.match(FUENTE, /SIN_CONFIRMAR_A_LA_VEZ/);
  });

  test("«confirmar» reserva con el correo guardado, no con el que llegue", () => {
    /*
     * El agujero entero estaría aquí: si el correo del comprador saliera del
     * cuerpo de la petición de confirmar, el enlace no probaría nada.
     */
    const trozo = FUENTE.slice(FUENTE.indexOf('route === "confirmar"'));
    assert.match(trozo, /buyerEmail: s\.buyer_email/);
    assert.ok(!/buyerEmail: body\./.test(trozo.slice(0, 2000)), "coge el correo del cuerpo");
  });

  test("y se marca gastado DESPUÉS de reservar", () => {
    // Al revés, si la reserva falla el enlace queda gastado sin haber
    // conseguido nada y hay que pedir la visita otra vez.
    const trozo = FUENTE.slice(FUENTE.indexOf('route === "confirmar"'));
    const reserva = trozo.indexOf("await bookSlot(");
    const marca = trozo.indexOf("SQL_MARCA_CONFIRMADA");
    assert.ok(reserva > 0 && marca > 0);
    assert.ok(reserva < marca, "gasta el enlace antes de saber si se pudo reservar");
  });

  test("si otro se adelantó, se le dice y se le manda a elegir otra", () => {
    assert.match(FUENTE, /Se te ha adelantado alguien con esa hora/);
  });
});
