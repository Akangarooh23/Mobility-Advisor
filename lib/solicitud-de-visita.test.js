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

describe("la casilla de la financiación llega hasta el ERP", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const FUENTE = fs
    .readFileSync(path.join(__dirname, "api/visit-availability-handler.js"), "utf8")
    .replace(/\r\n/g, "\n");

  /*
   * El comprador contesta «¿te interesaría financiarlo?» al pedir la visita, y
   * esa respuesta se guardaba en `vehicle_visit_requests` — una tabla que en el
   * ERP no mira nadie. Se apuntaba y se tiraba.
   *
   * Importa porque es la operación que deja margen y la que se atiende a mano:
   * quien la vende necesita saber a quién llamar antes de la visita, no
   * descubrirlo en el parking.
   */
  test("la reserva tiene dónde guardarla", () => {
    assert.match(S.ENSURE_EN_LA_RESERVA, /ALTER TABLE vehicle_visit_bookings/);
    assert.match(S.ENSURE_EN_LA_RESERVA, /ADD COLUMN IF NOT EXISTS quiere_financiar/);
  });

  test("y la columna se crea de verdad al arrancar", () => {
    // Una constante que no ejecuta nadie es la misma nada de antes, con más
    // código: la consulta fallaría y el dato seguiría sin llegar.
    assert.match(FUENTE, /SV\.ENSURE_EN_LA_RESERVA/);
  });

  test("el INSERT de la reserva la escribe", () => {
    const trozo = FUENTE.slice(
      FUENTE.indexOf("INSERT INTO vehicle_visit_bookings"),
      FUENTE.indexOf("RETURNING *", FUENTE.indexOf("INSERT INTO vehicle_visit_bookings")),
    );
    assert.ok(trozo.length > 0, "no encuentro el INSERT de la reserva");
    assert.match(trozo, /quiere_financiar/);
  });

  test("al confirmar por correo se pasa la que dio el comprador", () => {
    /*
     * Este es el camino que importa: el que llega de coches.net no tiene
     * cuenta, pide por correo y confirma con el enlace. Si aquí no viajara, el
     * dato se perdería justo para los compradores que vienen del portal.
     */
    const trozo = FUENTE.slice(FUENTE.indexOf('route === "confirmar"'));
    assert.match(trozo, /quiereFinanciar: s\.quiere_financiar === true/);
  });

  test("y no se inventa un «sí» cuando no contestó", () => {
    // `=== true` y no un valor blando: un `undefined` no puede acabar
    // mandando a alguien a la cola de financiación.
    assert.match(FUENTE, /quiereFinanciar === true/);
  });
});

describe("de donde vino el comprador llega hasta el ERP", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const RAIZ = path.join(__dirname, "..");
  const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");
  const HANDLER = leer("lib/api/visit-availability-handler.js");
  const PICKER = leer("src/components/SlotPicker.js");

  /*
   * El comprador que llega de coches.net pulsa el enlace corto, ve el coche y
   * pide hora. Si no deja lead —y no tiene por qué—, esa visita entraba como si
   * hubiera aparecido de la nada.
   *
   * Es el unico camino que importa medir: sin esto no se puede contestar si el
   * portal trae gente o solo cuesta dinero, que es lo que decide si se sigue
   * pagando.
   */
  test("son las mismas cinco que guardan los leads", () => {
    // Guardar otras -o menos- haria que las visitas no se pudieran sumar con
    // el resto en el informe, que agrupa por `utm_source`.
    assert.deepEqual(S.UTM, [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    ]);
  });

  test("lo que llegue se recorta y nunca es nulo", () => {
    const r = S.laUtm({ utm_source: "coches.net", utm_medium: "portal" });
    assert.equal(r.utm_source, "coches.net");
    assert.equal(r.utm_campaign, "", "una que no venga tiene que ser cadena vacia");
    assert.equal(S.laUtm({ utm_source: "x".repeat(400) }).utm_source.length, 255);
    assert.equal(S.laUtm(null).utm_source, "");
  });

  test("hay dónde guardarla en la solicitud y en la reserva", () => {
    for (const c of S.UTM) {
      assert.match(S.ENSURE_UTM_EN_LA_SOLICITUD, new RegExp(`ADD COLUMN IF NOT EXISTS ${c}`));
      assert.match(S.ENSURE_EN_LA_RESERVA, new RegExp(`ADD COLUMN IF NOT EXISTS ${c}`));
    }
  });

  test("y esas columnas se crean de verdad al arrancar", () => {
    // Una constante que no ejecuta nadie es la misma nada de antes con mas
    // codigo: el INSERT fallaria y la visita no se guardaria.
    assert.match(HANDLER, /SV\.ENSURE_UTM_EN_LA_SOLICITUD/);
  });

  test("la solicitud la escribe", () => {
    assert.match(S.SQL_GUARDA, /utm_source, utm_medium, utm_campaign, utm_content, utm_term/);
    assert.match(HANDLER, /\.\.\.SV\.UTM\.map\(\(c\) => utm\[c\]\)/);
  });

  test("y la reserva también, que es la que mira el ERP", () => {
    const trozo = HANDLER.slice(
      HANDLER.indexOf("INSERT INTO vehicle_visit_bookings"),
      HANDLER.indexOf("RETURNING *", HANDLER.indexOf("INSERT INTO vehicle_visit_bookings")),
    );
    assert.ok(trozo.length > 0, "no encuentro el INSERT de la reserva");
    assert.match(trozo, /utm_source, utm_medium, utm_campaign, utm_content, utm_term/);
  });

  test("al confirmar se usa la que se guardó, no la del navegador que pulsa", () => {
    /*
     * Entre pedir la visita y confirmarla pasa hasta un dia: puede ser otro
     * dispositivo, o el mismo con la sesion vencida. Leerla ahi daria «directo»
     * justo para el que vino del portal.
     */
    const trozo = HANDLER.slice(HANDLER.indexOf('route === "confirmar"'));
    assert.match(trozo, /utm: SV\.laUtm\(s\)/);
    assert.doesNotMatch(trozo.slice(0, 2000), /utm: SV\.laUtm\(body\)/);
  });

  test("y el formulario la manda", () => {
    // Sin esto el servidor guardaria cinco cadenas vacias muy bien puestas.
    assert.match(PICKER, /\.\.\.getUtmPayload\(\)/);
    assert.match(PICKER, /from "\.\.\/utils\/utmTracker"/);
  });
});
