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

describe("las tareas programadas", () => {
  test("hay alguna declarada", () => {
    assert.ok((VERCEL.crons || []).length > 0, "si no hay ninguna, esta prueba no vigila nada");
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
    // Una reescritura que apunta a `/api/user?route=X` no sirve de nada si
    // `api/user.js` no tiene un `case "X"`: contestaría 404 en silencio.
    const router = fs.readFileSync(path.join(RAIZ, "api", "user.js"), "utf8");
    for (const tarea of VERCEL.crons || []) {
      const reescritura = (VERCEL.rewrites || []).find((r) => sinConsulta(r.source) === sinConsulta(tarea.path));
      const destino = reescritura ? String(reescritura.destination) : "";
      const m = /\/api\/user\?route=([a-z0-9-]+)/i.exec(destino);
      if (!m) continue;
      assert.match(router, new RegExp(`case "${m[1]}"`), `api/user.js no atiende "${m[1]}"`);
    }
  });
});
