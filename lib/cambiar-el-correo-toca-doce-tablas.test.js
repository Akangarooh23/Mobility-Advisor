/**
 * Cambiar el correo de un usuario toca doce tablas, no una.
 *
 * Doce tablas guardan `user_email` al lado de `user_id`. Hoy eso no hace daño,
 * y se puede decir por qué exactamente: **nada en el código cambia el correo de
 * un usuario**. Sin cambios de correo, una copia no puede quedarse vieja.
 *
 * Toda la seguridad de ese diseño se apoya en esa frase. Esta prueba es lo que
 * la sostiene: el día que alguien escriba la pantalla de «cambiar mi correo»
 * —que es una pantalla razonable y acabará existiendo—, esto falla y le dice
 * dónde están las copias. Sin esto, ese día las filas de esa persona se quedan
 * apuntando a un correo que ya no es suyo y nadie se entera hasta que algo no
 * aparece donde debería.
 *
 * Lo que hay que hacer cuando falle: cambiar el correo **y** las copias, en la
 * misma transacción. La lista está aquí abajo y sale de
 * `node scripts/que-falta-por-normalizar.mjs`.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

/** Las tablas que llevan una copia del correo. Medido contra la base. */
const LAS_COPIAS = [
  "moveadvisor_funnel_events",
  "moveadvisor_service_requests",
  "moveadvisor_user_appointments",
  "moveadvisor_user_insurances",
  "moveadvisor_user_maintenances",
  "moveadvisor_user_market_alerts",
  "moveadvisor_user_preferences",
  "moveadvisor_user_saved_comparisons",
  "moveadvisor_user_saved_offers",
  "moveadvisor_user_valuations",
  "moveadvisor_user_vehicle_states",
  "moveadvisor_user_vehicles",
];

/** Todos los .js del proyecto, sin node_modules, sin build y sin pruebas. */
function losFicheros(dir, encontrados = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "build", ".git", "migrations"].includes(e.name)) continue;
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) losFicheros(completo, encontrados);
    else if (e.name.endsWith(".js") && !e.name.includes(".test.")) encontrados.push(completo);
  }
  return encontrados;
}

/**
 * Los sitios donde se escribe el correo de un usuario.
 *
 * Se mira lo que hay entre `SET` y `WHERE`: el `WHERE lower(email) = …` de
 * media docena de consultas legítimas no es escribir el correo, es buscar por
 * él, y confundir las dos cosas haría que esta prueba gritara siempre.
 */
function dondeSeEscribeElCorreo() {
  const sitios = [];
  for (const fichero of losFicheros(path.join(RAIZ, "lib")).concat(
    losFicheros(path.join(RAIZ, "api")),
    losFicheros(path.join(RAIZ, "scripts"))
  )) {
    const fuente = fs.readFileSync(fichero, "utf8");
    const re = /UPDATE\s+moveadvisor_users\b([\s\S]{0,600}?)(?:\bWHERE\b|\bRETURNING\b|`)/gi;
    let m;
    while ((m = re.exec(fuente)) !== null) {
      const loQueSeEscribe = m[1];
      if (!/\bSET\b/i.test(loQueSeEscribe)) continue;
      if (/(^|[\s,(])email\s*=/i.test(loQueSeEscribe.replace(/^[\s\S]*?\bSET\b/i, ""))) {
        sitios.push(path.relative(RAIZ, fichero));
      }
    }
  }
  return [...new Set(sitios)];
}

describe("el correo de un usuario", () => {
  test("no se cambia en ningún sitio, que es lo que hace segura la copia", () => {
    const sitios = dondeSeEscribeElCorreo();
    assert.deepEqual(
      sitios,
      [],
      "Alguien ha puesto a cambiar el correo de un usuario en " + sitios.join(", ") + ".\n" +
        "      Eso está bien, pero hay que cambiarlo también en las copias, y en la misma\n" +
        "      transacción, o esas filas se quedan apuntando a un correo que ya no es suyo:\n" +
        LAS_COPIAS.map((t) => "        · " + t).join("\n")
    );
  });

  test("y la lista de copias sigue siendo la que se midió", () => {
    // Si aparece una tabla nueva con user_email, entra aquí. Así la lista de
    // arriba —que es la que lee quien tenga que arreglarlo— no envejece sola.
    const nuevas = [];
    for (const fichero of losFicheros(path.join(RAIZ, "lib"))) {
      const fuente = fs.readFileSync(fichero, "utf8");
      const re = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]{0,4000}?)\n\s*\)/gi;
      let m;
      while ((m = re.exec(fuente)) !== null) {
        const [, tabla, cuerpo] = m;
        if (/\buser_email\b/.test(cuerpo) && /\buser_id\b/.test(cuerpo) && !LAS_COPIAS.includes(tabla)) {
          nuevas.push(tabla);
        }
      }
    }
    assert.deepEqual(
      [...new Set(nuevas)],
      [],
      "tabla(s) nueva(s) con el correo copiado al lado del identificador: añádelas a LAS_COPIAS"
    );
  });
});
