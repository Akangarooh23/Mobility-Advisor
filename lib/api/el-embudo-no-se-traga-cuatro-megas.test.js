"use strict";

/**
 * El embudo no se traga cuatro megas.
 *
 * ## Lo que pasaba
 *
 * `/api/funnel-event` **no pide sesión**, y tiene que no pedirla: es la analítica de la
 * web pública y cuenta visitas anónimas. Pero escribía **quince columnas de texto sin
 * ningún tope**, y las quince son `text` en Postgres, o sea sin límite por el lado de
 * la base.
 *
 * Así que el único tope era el del cuerpo de la petición, que lo pone Vercel y está en
 * unos 4 MB. Una sola petición podía guardar cuatro megas.
 *
 * Y la aritmética, medida el 1 de octubre y no estimada:
 *
 *     moveadvisor_funnel_events   1.696 kB   ~2.102 filas
 *
 * La tabla entera pesa 1,7 MB. **Una petición abusiva la más que duplica.**
 *
 * ## Los topes salen de lo que hay guardado
 *
 * Lo más largo en las 2.102 filas reales:
 *
 *     landing_url  1.168     offer_title  54     utm_*  34     anon_id  26
 *
 * Los topes van entre dos y seis veces por encima. La prueba los fija por eso: si
 * alguien los baja hasta apretar un caso legítimo, se nota aquí y no en la analítica
 * tres semanas después.
 *
 * ## Lo que NO cubre, y está dicho a propósito
 *
 * El ritmo. Nada impide mandar un millón de eventos de 2 kB. Eso necesita `lib/freno.js`
 * y una decisión sobre el umbral —demasiado apretado y se pierden visitas de verdad—,
 * así que está en el informe como decisión y no aquí como arreglo.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { TOPES, texto, oNada } = require("./funnel-event-handler");

const FUENTE = fs.readFileSync(path.join(__dirname, "funnel-event-handler.js"), "utf8");

describe("los topes del embudo", () => {
  test("recorta, y no se queja: la analítica no debe fallar por un campo largo", () => {
    assert.equal(texto("a".repeat(5000), 100).length, 100);
    assert.equal(texto(null, 100), "", "ausente es cadena vacía, no «null»");
    assert.equal(texto(undefined, 100), "");
    assert.equal(texto(12345, 3), "123", "un número también se recorta");
  });

  test("y `oNada` distingue el vacío del ausente, que no es lo mismo", () => {
    /*
     * En estas columnas `''` y `NULL` significan cosas distintas. Las consultas del
     * panel cuentan `WHERE offer_title IS NOT NULL`, así que convertir un ausente en
     * cadena vacía cambiaría los números del panel sin que nadie toque el panel.
     */
    assert.equal(oNada(null, 10), null);
    assert.equal(oNada(undefined, 10), null);
    assert.equal(oNada("", 10), null, "la cadena vacía también es «no hay dato»");
    assert.equal(oNada("abcdefghijk", 5), "abcde");
  });

  test("los topes son generosos respecto a lo que hay guardado de verdad", () => {
    // Lo más largo medido en las 2.102 filas, el 1-oct-2026.
    const MEDIDO = { landing_url: 1168, offer_title: 54, utm: 34, anon_id: 26 };
    for (const [campo, real] of Object.entries(MEDIDO)) {
      assert.ok(
        TOPES[campo] > real,
        `el tope de ${campo} (${TOPES[campo]}) tiene que estar por encima de lo que ya hay guardado (${real})`
      );
    }
    assert.ok(TOPES.user_email >= 254, "una dirección de correo llega a 254 por la RFC 5321");
  });

  test("y ninguno deja pasar un abuso: el cuerpo de Vercel son ~4 MB", () => {
    const todo = Object.values(TOPES).reduce((a, b) => a + b, 0);
    assert.ok(
      todo < 10_000,
      `entre todos los campos se pueden guardar ${todo} caracteres por evento; ` +
        `si esto sube de 10.000 se ha perdido el sentido del tope`
    );
  });
});

describe("y no se puede añadir una columna sin tope", () => {
  /*
   * Ésta es la que de verdad protege. Las de arriba comprueban los ayudantes; esta
   * comprueba que **se usan**, que es lo que faltaba. La columna dieciséis entrará
   * algún día, y entrará copiando la línea de al lado.
   */
  test("cada valor del INSERT pasa por un tope, o es nuestro", () => {
    const i = FUENTE.indexOf("INSERT INTO moveadvisor_funnel_events");
    assert.ok(i > 0, "no encuentro el INSERT");

    // Del `[` que abre la lista de valores al `]` que la cierra.
    const abre = FUENTE.indexOf("[", FUENTE.indexOf("ON CONFLICT", i));
    const cierra = FUENTE.indexOf("]", abre);
    assert.ok(abre > 0 && cierra > abre, "no encuentro la lista de valores");

    /*
     * Partir por las comas **de nivel cero**.
     *
     * Un `split(",")` corta `texto(anon_id, TOPES.anon_id)` por la mitad y deja
     * `TOPES.anon_id)` como si fuera un valor suelto sin tope. La primera versión de
     * esta prueba se puso roja justo por eso: trece falsos positivos, todos ellos la
     * segunda mitad de una llamada que sí tenía tope.
     */
    const valores = [];
    {
      const lista = FUENTE.slice(abre + 1, cierra);
      let prof = 0, actual = "";
      for (const c of lista) {
        if (c === "(" || c === "[" || c === "{") prof++;
        else if (c === ")" || c === "]" || c === "}") prof--;
        if (c === "," && prof === 0) { valores.push(actual.trim()); actual = ""; continue; }
        actual += c;
      }
      if (actual.trim()) valores.push(actual.trim());
    }

    // Los dos que no vienen del cliente: el id lo hacemos aquí y el tipo de evento
    // está validado contra `ALLOWED_EVENTS`, que es una lista cerrada.
    const NUESTROS = new Set(["id", "event_type"]);

    const sinTope = valores.filter(
      (v) => !NUESTROS.has(v) && !/\b(?:texto|oNada)\s*\(/.test(v)
    );

    assert.deepEqual(
      sinTope,
      [],
      "estos valores del INSERT no pasan por texto() ni oNada(), así que no tienen tope:\n  " +
        sinTope.join("\n  ")
    );

    assert.ok(valores.length >= 15, `esperaba al menos 15 valores y conté ${valores.length}`);
  });

  test("y el tipo de evento sigue viniendo de una lista cerrada", () => {
    /*
     * Es lo que permite que `event_type` no lleve tope: no es texto libre. Si alguien
     * quitara esa comprobación, pasaría a serlo y la prueba de arriba dejaría de
     * cubrirlo sin ponerse roja.
     */
    assert.match(FUENTE, /ALLOWED_EVENTS\.includes\(\s*event_type\s*\)/);
    assert.match(FUENTE, /400/, "y lo que no está en la lista se rechaza");
  });
});
