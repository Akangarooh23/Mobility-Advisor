"use strict";

/**
 * Los papeles firmados que el cliente puede volver a bajarse.
 *
 * Firma el mandato y la aceptación del precio, los sube, y desaparecen: se
 * guardan en el cajón privado y los enseña el ERP, que es nuestro. Del suyo no
 * quedaba copia — y son los dos papeles que dicen qué ha aceptado y por cuánto
 * sale su coche. El día que discuta una factura lo tendría todo nuestro y nada
 * suyo.
 *
 * Lo que se protege aquí es el candado —que solo vea los suyos— y que la lista
 * sea **cerrada**: del encargo cuelgan más cosas, y no todas son de él.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const H = require("./papeles-de-la-venta-handler");
const FUENTE = fs.readFileSync(path.join(__dirname, "papeles-de-la-venta-handler.js"), "utf8");

describe("solo ve los suyos", () => {
  test("la consulta filtra por el correo de la sesión", () => {
    /*
     * Sin esto, el identificador de un documento —que viaja por la red— sería
     * suficiente para bajarse el mandato firmado de otro.
     */
    assert.match(H.SQL_SUS_PAPELES, /lower\(e\.cliente_email\) = lower\(\$1\)/);
  });

  test("y el correo sale de la sesión", () => {
    assert.ok(FUENTE.includes("identidadDeLaPeticion(req"), "la identidad no sale de la sesión");
    assert.ok(!/query\?\.email/.test(FUENTE), "se está leyendo el correo de la dirección");
  });

  test("sin sesión no se enseña nada", () => {
    assert.ok(FUENTE.includes("status(401)"));
  });
});

describe("y solo los papeles que son suyos de verdad", () => {
  test("la lista es cerrada: los dos que firma él", () => {
    /*
     * De `erp_documentos` cuelgan más cosas del encargo —notas nuestras, lo que
     * suba quien lleva el expediente—. Una lista abierta acabaría enseñándole
     * cualquier cosa que alguien guarde ahí mañana.
     */
    assert.deepEqual(Object.keys(H.LOS_SUYOS), ['mandato_firmado', 'clausula_precio_firmada']);
  });

  test("y la consulta la usa", () => {
    assert.match(H.SQL_SUS_PAPELES, /d\.papel = ANY\(\$3\)/);
  });

  test("cada uno dice qué es, no solo cómo se llama el fichero", () => {
    // «documento (1).pdf» no dice cuál de los dos es.
    for (const texto of Object.values(H.LOS_SUYOS)) assert.ok(texto.length > 3);
  });
});

describe("la descarga", () => {
  test("es una dirección que caduca, no el fichero", () => {
    /*
     * El cajón privado no tiene dirección pública: esa es toda la gracia.
     * Servir el fichero desde aquí pasaría megas por la función, y dejarlo en el
     * cajón público lo haría alcanzable por cualquiera con el enlace.
     */
    assert.ok(FUENTE.includes("urlFirmada("), "no se está firmando la URL");
    assert.ok(FUENTE.includes("status(302)"), "no se redirige al fichero");
  });

  test("y solo después de comprobar que es suyo", () => {
    // El `find` es sobre las filas que ya vienen filtradas por su correo.
    const orden = FUENTE.indexOf("const suyo = rows.find");
    const firma = FUENTE.indexOf("urlFirmada(");
    assert.ok(orden > 0 && firma > orden, "se firma la URL antes de comprobar de quién es");
  });

  test("y uno que no es suyo no existe", () => {
    // Mismo mensaje que si no existiera: no se le confirma que haya algo.
    assert.ok(FUENTE.includes("No encontramos ese documento."));
  });
});

/**
 * Y los que le abrimos a mano, papel a papel.
 *
 * Es la parte con más filo de todo esto: aquí se decide qué papel NUESTRO ve
 * un cliente. Un fallo no da error — da un informe interno en la pantalla de
 * alguien, y no hay forma de enterarse.
 */
describe('los papeles que le abrimos a mano', () => {
  test('de una revisión no se ve nada sin marcar', () => {
    /*
     * De la visita del perito no hay ningún papel que sea suyo por defecto.
     * De la misma cita cuelga el informe que se le enseña y el presupuesto
     * interno de la reparación, que no. O está marcado, o no existe para él.
     *
     * Se comprueba que en la rama de `revision` NO aparece la lista cerrada:
     * si alguien le añadiera el `papel = ANY($3)`, se abriría entera.
     */
    const rama = H.SQL_SUS_PAPELES.slice(H.SQL_SUS_PAPELES.indexOf("d.ambito = 'revision'"));
    assert.match(rama, /visible_cliente'\s*=\s*'true'/);
    assert.ok(!/papel = ANY/.test(rama), 'la rama de la revisión ha abierto la lista cerrada');
  });

  test('y solo de SUS coches', () => {
    /*
     * La revisión se ata al encargo por el vehículo, y el encargo al cliente
     * por su correo. Sin ese salto, un identificador de revisión que viaje
     * por la red enseñaría los papeles de la visita de otro.
     */
    assert.match(H.SQL_SUS_PAPELES, /JOIN mios m ON m\.vehicle_id = r\.vehicle_id/);
  });

  test('la marca se lee con to_jsonb, para que esto no dependa de la migración', () => {
    /*
     * Nombrar la columna directamente haría que Postgres rechazara la
     * consulta entera mientras no exista —mira la frase antes de ejecutarla—
     * y el cliente se quedaría sin ver ni su mandato, que lleva funcionando
     * desde septiembre, por una columna que no usa.
     *
     * Pasó el 14-oct-2026 en el ERP con `perito_email`: el guardado de la
     * revisión fallaba por una columna que ni se estaba tocando.
     */
    assert.match(H.SQL_SUS_PAPELES, /to_jsonb\(d\)->>'visible_cliente'/);
    assert.ok(!/\bd\.visible_cliente\b/.test(H.SQL_SUS_PAPELES), 'se nombra la columna a pelo');
  });

  test('los dos que firma él siguen sin necesitar marca', () => {
    // Son suyos desde que los firmó. Que ahora haya un interruptor no puede
    // esconderle lo que ya veía.
    const rama = H.SQL_SUS_PAPELES.slice(
      H.SQL_SUS_PAPELES.indexOf("d.ambito = 'encargo'"),
      H.SQL_SUS_PAPELES.indexOf('UNION ALL'),
    );
    assert.match(rama, /d\.papel = ANY\(\$3\) OR/);
  });

  test('y el filtro por coche sigue valiendo para las dos ramas', () => {
    /*
     * Va en el `WITH`, no repetido en cada rama: repetirlo es la forma de que
     * un día se arregle en una y no en la otra, y entonces pedir los papeles
     * de un coche devuelve también los de otro suyo.
     */
    const antesDelUnion = H.SQL_SUS_PAPELES.slice(0, H.SQL_SUS_PAPELES.indexOf('UNION ALL'));
    assert.match(antesDelUnion, /WITH mios AS/);
    assert.equal((H.SQL_SUS_PAPELES.match(/upper\(replace/g) || []).length, 2, 'el filtro por matrícula está repetido');
  });
});
