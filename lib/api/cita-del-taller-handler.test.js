"use strict";

/**
 * Lo que puede pedir el cliente sobre su cita del taller, y lo que no.
 *
 * Aquí se protegen las dos cosas que hacen que esto sea seguro y útil a la vez:
 * que el coche sea suyo —el identificador viaja por la red y no prueba nada— y
 * que lo que pida sea una de las dos cosas que sabemos atender.
 *
 * Se lee el fuente a propósito: probarlo de verdad pide una base de datos y una
 * sesión, y lo que aquí se vigila es el candado, que se ve en el fuente y es lo
 * que se cae al reescribir una consulta.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./cita-del-taller-handler");
const FUENTE = fs.readFileSync(path.join(__dirname, "cita-del-taller-handler.js"), "utf8");

describe("qué puede pedir", () => {
  test("dos cosas: que se la cambiemos o que se la quitemos", () => {
    /*
     * No hay «elige otra hora»: las horas las da el taller por teléfono y no las
     * tenemos, así que un calendario prometería algo que no se puede cumplir.
     */
    assert.deepEqual(H.LO_QUE_PUEDE_PEDIR, ["cambio", "cancelar"]);
  });

  test("y el motivo tiene tope", () => {
    // Lo que no cabe en una casilla es un correo. Sin tope, un pegote de diez
    // mil caracteres entra entero en la ficha y tapa lo demás.
    assert.equal(typeof H.LARGO_MAXIMO_DEL_MOTIVO, "number");
    assert.ok(H.LARGO_MAXIMO_DEL_MOTIVO > 0 && H.LARGO_MAXIMO_DEL_MOTIVO <= 2000);
    assert.ok(FUENTE.includes("slice(0, LARGO_MAXIMO_DEL_MOTIVO)"),
      "el motivo se guardaría entero, tan largo como venga");
  });
});

describe("el coche tiene que ser suyo", () => {
  test("la consulta lo comprueba por el correo de la sesión", () => {
    /*
     * Sin esto, cualquiera con una sesión podría mover la cita de otro
     * escribiendo su identificador de vehículo: los identificadores viajan por
     * la red y no prueban nada.
     */
    assert.match(H.SQL_SU_CITA, /lower\(v\.user_email\) = \$2/);
    assert.match(H.SQL_SU_CITA, /JOIN moveadvisor_user_vehicles v ON v\.id = r\.vehicle_id/);
  });

  test("y el correo sale de la sesión, no del cuerpo", () => {
    // `identidadDeLaPeticion` es la regla de quién es quien pide, y manda la
    // sesión. Leer el correo del cuerpo sería dejar que lo escriba cualquiera.
    assert.ok(FUENTE.includes("identidadDeLaPeticion(req"),
      "la identidad no sale de la sesión");
    assert.ok(!/body\.email/.test(FUENTE), "se está leyendo el correo del cuerpo");
  });

  test("una revisión ya hecha no se toca", () => {
    // Pedir que se cambie una cita a la que el coche ya fue no es una petición,
    // es un aviso encendido para siempre sobre algo que ya ocurrió.
    assert.match(H.SQL_SU_CITA, /r\.estado <> 'Hecha'/);
  });

  test("y no se dice si existe o no", () => {
    // Misma respuesta en los dos casos: al que prueba con el identificador de
    // otro no se le confirma que ese coche exista.
    assert.ok(FUENTE.includes("No encontramos esa cita."));
  });
});

describe("sin sesión no se apunta nada", () => {
  test("se contesta 401 y se para", () => {
    assert.ok(FUENTE.includes('status(401)'), "sin sesión seguiría adelante");
  });

  test("y solo se acepta POST", () => {
    assert.ok(FUENTE.includes('req.method !== "POST"'));
  });
});
