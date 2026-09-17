"use strict";

/**
 * Un correo que se lanza sin esperarlo, en Vercel, no sale.
 *
 * La reserva de visita hacía esto: `sendBookingEmails(bk).catch(() => {})` y a
 * contestar. En un servidor normal funciona. En Vercel no: en cuanto la función
 * responde se congela, y la llamada a Resend se queda cortada a medias. El
 * comprador no recibía «hemos recibido tu solicitud» y el vendedor no recibía
 * el aviso — sin un solo error en ninguna parte, porque el `.catch(() => {})`
 * se tragaba hasta eso.
 *
 * Pasaba en cuatro sitios del mismo fichero. Esta prueba mira **todos** los de
 * `lib/api`, porque el patrón se copia bien y se nota mal: la reserva se crea,
 * la pantalla dice que todo ha ido bien, y el correo simplemente no llega.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Las llamadas a algo que manda correo, sin `await` ni `return` delante.
 *
 * Una línea que empieza por `sendAlgo(...)` no la espera nadie — salvo que esté
 * dentro de un `await Promise.all([ ... ])`, que es la otra forma buena de
 * hacerlo y la que ya usaba `service-requests-handler.js`, con este mismo fallo
 * explicado al lado. Sin distinguirlo, la prueba acusaría justo al que lo
 * arregló bien primero.
 */
function lanzadasSinEsperar(fuente) {
  const culpables = [];
  let dentroDeUnAwait = false;
  fuente.split(/\r?\n/).forEach((bruta, i) => {
    const linea = bruta.trim();
    if (/await Promise\.(all|allSettled)\(\[/.test(linea)) dentroDeUnAwait = true;
    if (!dentroDeUnAwait && /^send\w*\(.*\)\.catch\(/.test(linea)) {
      culpables.push({ linea, n: i + 1 });
    }
    if (dentroDeUnAwait && /^\]\);?$/.test(linea)) dentroDeUnAwait = false;
  });
  return culpables;
}

describe("los correos de las visitas", () => {
  const VISITAS = fs.readFileSync(path.join(__dirname, "visit-availability-handler.js"), "utf8");

  test("ninguno se lanza sin esperarlo", () => {
    assert.deepEqual(lanzadasSinEsperar(VISITAS).map((x) => `línea ${x.n}: ${x.linea}`), []);
  });

  test("y los cuatro se esperan", () => {
    // La solicitud, el cambio de hora, la hora elegida y la cancelación.
    for (const quien of [
      /await sendBookingEmails\(bk\)\.catch/,
      /await sendBookingEmails\(bk, \{ isReschedule: true \}\)\.catch/,
      /await sendEleccionEmails\(bk\)\.catch/,
      /await sendCancelEmails\(booking\)\.catch/,
    ]) {
      assert.match(VISITAS, quien);
    }
  });

  test("y un fallo del correo no se traga en silencio", () => {
    // El `.catch` se queda —la reserva ya está guardada y no se deshace por un
    // correo—, pero lo apunta: con `() => {}` no había manera de enterarse.
    assert.doesNotMatch(VISITAS, /send\w*Emails?\([^)]*\)\.catch\(\(\) => \{\}\)/);
  });
});

describe("y en el resto de la API", () => {
  test("tampoco se lanza ningún correo sin esperarlo", () => {
    const dir = __dirname;
    const culpables = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js") && !x.endsWith(".test.js"))) {
      for (const x of lanzadasSinEsperar(fs.readFileSync(path.join(dir, f), "utf8"))) {
        culpables.push(`${f}:${x.n} ${x.linea}`);
      }
    }
    assert.deepEqual(culpables, []);
  });
});
