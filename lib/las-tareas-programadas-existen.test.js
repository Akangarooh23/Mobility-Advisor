/**
 * Cada tarea programada tiene que llegar a alguna parte.
 *
 * `vercel.json` declaraba una tarea diaria a `/api/cron-vigila-scrapers` y esa
 * dirección **no existía**: faltaba su reescritura hacia `/api/user`, que es
 * donde vive el manejador. Vercel la llamaba cada día a las 10:00, recibía la
 * página web —200 OK, porque cualquier ruta que no es de la API devuelve el
 * index de la aplicación— y se quedaba tan contento. La tarea vigila que siga
 * entrando catálogo de los portales: llevaba desde el 1 de septiembre de 2026
 * sin ejecutarse ni una vez, y sin avisar a nadie de que no se ejecutaba.
 *
 * Eso es lo peor que puede pasarle a una alarma: que la alarma sea lo que está
 * roto. Esta prueba lo mira desde el repositorio, que es donde se ve.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const VERCEL = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));

/** La dirección sin la cadena de consulta: `/api/x?solo=y` → `/api/x`. */
const sinConsulta = (p) => String(p || "").split("?")[0];

/** ¿A qué fichero de `api/` acaba llegando esta dirección? */
function aQueFicheroLlega(direccion) {
  const ruta = sinConsulta(direccion);

  // 1. ¿Hay un fichero con ese nombre? `/api/analyze` → `api/analyze.js`.
  const directo = path.join(RAIZ, "api", ruta.replace(/^\/api\//, "") + ".js");
  if (fs.existsSync(directo)) return path.relative(RAIZ, directo);

  // 2. ¿Alguna reescritura la lleva a uno?
  for (const r of VERCEL.rewrites || []) {
    if (sinConsulta(r.source) !== ruta) continue;
    const destino = path.join(RAIZ, "api", sinConsulta(r.destination).replace(/^\/api\//, "") + ".js");
    if (fs.existsSync(destino)) return path.relative(RAIZ, destino);
    return `(reescrita a ${r.destination}, que tampoco existe)`;
  }

  return "";
}

/**
 * Las ocho que tienen que estar, clavadas.
 *
 * ## Por qué hace falta una lista escrita a mano
 *
 * Todo lo demás de este fichero recorre `VERCEL.crons` y comprueba que cada una
 * llega a su manejador. Eso caza una tarea que apunta a la nada —que es lo que
 * pasó—, pero **no caza que una tarea desaparezca**: con una menos, las que
 * quedan siguen siendo válidas y todo sale verde.
 *
 * Lo comprobé rompiéndolo: quité la primera tarea de `vercel.json` y las
 * pruebas de este fichero pasaron igual. Con lo cual la alarma seguía sin cubrir
 * la mitad del caso que la hizo nacer, y es la mitad que no hace ruido:
 * *«Un fallo grita; una ausencia no hace ruido»* —eso está escrito en
 * `lib/vigila-scrapers.js`, sobre los quince días que n8n estuvo parado—.
 *
 * ## Cómo se toca esta lista
 *
 * Quitar una línea de aquí tiene que ser un acto deliberado, con su motivo en el
 * mensaje del commit. Si alguien la cambia para que la prueba pase, la prueba ha
 * dejado de servir.
 */
const LAS_QUE_TIENEN_QUE_ESTAR = [
  "/api/cron-appointment-reminders",
  "/api/cron-appointment-reminders?solo=seguimiento",
  "/api/cron-alert-check",
  "/api/cron-condition-report-ready",
  "/api/cron-vigila-scrapers",
  "/api/cron-avisa-de-los-fallos",
  "/api/cron-facetas-buscador?vista=mmo_modelos",
  "/api/cron-facetas-buscador?vista=mmo_facetas",
];

describe("las tareas programadas", () => {
  test("hay alguna declarada", () => {
    assert.ok((VERCEL.crons || []).length > 0, "si no hay ninguna, esta prueba no vigila nada");
  });

  test("y no falta ninguna de las que tienen que estar", () => {
    const declaradas = new Set((VERCEL.crons || []).map((c) => String(c.path)));
    const faltan = LAS_QUE_TIENEN_QUE_ESTAR.filter((p) => !declaradas.has(p));

    assert.deepEqual(
      faltan,
      [],
      `estas tareas ya no están en vercel.json: ${faltan.join(", ")}.\n` +
        "Si se han quitado a propósito, quítalas también de LAS_QUE_TIENEN_QUE_ESTAR " +
        "y di en el commit por qué. Si no, es que se han caído sin que nadie lo note, " +
        "que es exactamente lo que este fichero existe para evitar."
    );
  });

  test("y las nuevas se apuntan aquí, para que la lista siga sirviendo", () => {
    /*
     * Al revés también: una tarea nueva en `vercel.json` que no esté en la lista
     * no está vigilada contra su desaparición. Esto obliga a apuntarla.
     */
    const esperadas = new Set(LAS_QUE_TIENEN_QUE_ESTAR);
    const sinApuntar = (VERCEL.crons || [])
      .map((c) => String(c.path))
      .filter((p) => !esperadas.has(p));

    assert.deepEqual(
      sinApuntar,
      [],
      `estas tareas están en vercel.json y no en la lista: ${sinApuntar.join(", ")}. ` +
        "Añádelas a LAS_QUE_TIENEN_QUE_ESTAR o no se notará el día que desaparezcan."
    );
  });

  for (const tarea of VERCEL.crons || []) {
    test(`${tarea.path} llega a su manejador`, () => {
      const donde = aQueFicheroLlega(tarea.path);
      assert.ok(
        donde && !donde.startsWith("("),
        `Vercel la llamará ${tarea.schedule} y recibirá la página web, no la tarea. ` +
        `Falta el fichero o su reescritura en vercel.json. ${donde}`
      );
    });
  }

  test("y el enrutador de /api/user sabe de todas las que van por él", () => {
    /*
     * Una reescritura que apunta a `/api/user?route=X` no sirve de nada si el
     * enrutador no atiende "X": contestaría 404 en silencio, y a una tarea
     * programada nadie le mira la respuesta.
     *
     * Esto se comprobaba leyendo el fichero y buscando el texto `case "X"`.
     * Vigilaba lo correcto de la manera equivocada: ataba la prueba a que el
     * reparto estuviera escrito con un `switch`, y el día que dejó de estarlo
     * la prueba falló sin que ninguna tarea se hubiera roto.
     *
     * Ahora se le pregunta al enrutador por sus rutas, que es el hecho. Si
     * mañana el reparto se escribe de otra forma, esto sigue valiendo; si
     * desaparece una tarea, sigue fallando.
     */
    const enrutadorDeUsuario = require(path.join(RAIZ, "api", "user.js"));
    const atiende = new Set(Object.keys(enrutadorDeUsuario.rutas || {}));

    for (const tarea of VERCEL.crons || []) {
      const reescritura = (VERCEL.rewrites || []).find((r) => sinConsulta(r.source) === sinConsulta(tarea.path));
      const destino = reescritura ? String(reescritura.destination) : "";
      const m = /\/api\/user\?route=([a-z0-9-]+)/i.exec(destino);
      if (!m) continue;
      assert.ok(
        atiende.has(m[1].toLowerCase()),
        `api/user.js no atiende "${m[1]}", así que ${tarea.path} contestaría 404`
      );
    }
  });
});
