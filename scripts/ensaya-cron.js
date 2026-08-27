/**
 * Ensayo de las tareas programadas que mandan correo.
 *
 * Los dos cron —recordatorios de cita y avisos de alertas— nunca se han
 * ejecutado, ni antes ni despues de reescribirlos, porque escriben a clientes
 * de verdad. Esto los ejecuta enteros contra la base real sin que salga nada:
 *
 *   · el envio se intercepta en `fetch` y se guarda en vez de mandarse;
 *   · toda escritura en la base se bloquea. Es lo importante: si se dejara
 *     pasar, los `UPDATE ... reminder_sent_at = NOW()` marcarian el aviso como
 *     enviado y esos clientes no lo recibirian nunca.
 *
 * Sin datos no prueba nada: hoy no hay ninguna cita confirmada ni ninguna
 * alerta, asi que los dos handler salen sin mandar y el cero enganya. Con
 * `--con-datos` se inyecta una cita y una alerta inventadas en la respuesta de
 * las consultas —la base no se toca— y entonces si se recorren los envios.
 *
 *   node scripts/ensaya-cron.js --con-datos
 */
const fs = require("fs");
const path = require("path");

const CON_DATOS = process.argv.includes("--con-datos");

// El entorno de verdad, menos la clave de Resend: aunque fallara la
// interceptacion, sin clave valida no puede salir un correo.
for (const linea of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
process.env.RESEND_API_KEY = "clave-de-mentira-para-el-ensayo";
process.env.CRON_SECRET = "secreto-del-ensayo";

const SALIDA = path.join("scripts", "ensayo-correos");
fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });

// Un correo que no existe: si algo se escapara, se veria enseguida.
const CORREO = "ensayo@example.invalid";
const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const cita = (id) => ({
  id,
  user_email: CORREO,
  contact_name: "Ana Picazo",
  vehicle_title: "Renault Clio 1.0 TCe 90 Techno",
  appointment_date: manana,
  appointment_time: "17:30",
  appointment_address: "Calle de Alcala 123, Madrid",
  appointment_contact: "Taller Ejemplo · 910 000 000",
});

// Una alerta sin filtros: asi encaja con el inventario real y el correo se
// arma con ofertas de verdad, no con relleno.
const alerta = {
  id: "ensayo-alerta",
  user_email: CORREO,
  mode: "vo",
  brand: "", model: "", query_text: "", title: "Coches que me encajan",
  min_price: null, max_price: null, min_year: null, max_year: null,
  min_mileage: null, max_mileage: null,
  fuel: "", transmission: "", displacement: "", location: "", color: "",
  notify_by_email: true, seen_count: 0, created_at: new Date(),
};

// ── Se bloquea toda escritura, y se inyectan los datos si se piden ──────────
const { Pool } = require("pg");
const queryOriginal = Pool.prototype.query;
const bloqueadas = [];
const inyectadas = [];

Pool.prototype.query = function (sql, params, cb) {
  const texto = String((typeof sql === "string" ? sql : sql && sql.text) || "");
  const responde = (rows, cual) => {
    if (cual) inyectadas.push(cual);
    const r = { rows, rowCount: rows.length };
    if (typeof cb === "function") { cb(null, r); return undefined; }
    return Promise.resolve(r);
  };

  if (/^\s*(insert|update|delete|create|alter|drop|truncate)\b/i.test(texto)) {
    bloqueadas.push(texto.replace(/\s+/g, " ").trim().slice(0, 90));
    return responde([]);
  }

  if (CON_DATOS) {
    if (/appointment_date = CURRENT_DATE \+ INTERVAL/.test(texto)) return responde([cita("ensayo-1")], "cita de manana");
    if (/appointment_date = CURRENT_DATE\b/.test(texto)) return responde([cita("ensayo-2")], "cita de hoy");
    if (/appointment_date < CURRENT_DATE/.test(texto)) return responde([cita("ensayo-3")], "visita ya pasada");
    if (/FROM market_alerts WHERE notify_by_email/.test(texto)) return responde([alerta], "alerta activa");
  }

  return queryOriginal.call(this, sql, params, cb);
};

// ── Se intercepta el envio ──────────────────────────────────────────────────
const correos = [];
const fetchOriginal = global.fetch;
global.fetch = async function (url, opciones) {
  if (String(url).includes("api.resend.com")) {
    correos.push(JSON.parse(opciones.body));
    return { ok: true, status: 200, json: async () => ({ id: "ensayo" }), text: async () => "" };
  }
  return fetchOriginal(url, opciones);
};

// ── Un req y un res de mentira ──────────────────────────────────────────────
const peticion = { headers: { authorization: "Bearer secreto-del-ensayo" }, method: "POST", body: {} };

function respuesta() {
  const r = {
    codigo: 200,
    cuerpo: null,
    status(n) { r.codigo = n; return r; },
    json(b) { r.cuerpo = b; return r; },
    end() { return r; },
    setHeader() { return r; },
  };
  return r;
}

/** Lo que tiene que cumplir un correo antes de salir a un cliente. */
function revisa(c) {
  const fallos = [];
  const todo = String(c.subject) + String(c.html);
  if (!c.from) fallos.push("sin remitente");
  if (!c.subject) fallos.push("sin asunto");
  if (!c.reply_to) fallos.push("sin direccion de respuesta");
  if (!c.html || c.html.length < 200) fallos.push("el cuerpo viene vacio o casi");
  if (/undefined|\[object|NaN/.test(todo)) fallos.push("hay un hueco sin rellenar");
  if (/carswise|moveadvisor|move advisor/i.test(todo)) fallos.push("queda una marca vieja");
  if (/<style[\s>]/i.test(String(c.html))) fallos.push("usa <style>, que Gmail quita");
  if (/display:\s*(flex|grid)/i.test(String(c.html))) fallos.push("usa flex o grid, que ningun cliente de correo entiende");
  return fallos;
}

const TAREAS = [
  ["Recordatorios de cita", "../lib/api/cron-appointment-reminders-handler.js"],
  ["Avisos de alertas", "../lib/api/cron-alert-check-handler.js"],
];

(async () => {
  console.log(`\n  Ensayo${CON_DATOS ? " con datos inventados" : ""}: se ejecuta de verdad, no sale nada.\n`);
  let malos = 0;

  for (const [nombre, modulo] of TAREAS) {
    const desde = correos.length;
    const desdeBloq = bloqueadas.length;
    console.log(`  ── ${nombre} ──`);

    let handler;
    try {
      handler = require(modulo);
    } catch (e) {
      console.log(`     NO CARGA: ${e.message}\n`);
      malos++;
      continue;
    }

    const res = respuesta();
    try {
      await handler(peticion, res);
      console.log(`     respuesta ${res.codigo}: ${JSON.stringify(res.cuerpo)}`);
      if (res.codigo !== 200) malos++;
    } catch (e) {
      console.log(`     REVIENTA: ${e.message}`);
      console.log(`     ${String(e.stack).split("\n")[1] || ""}`);
      malos++;
    }

    const mios = correos.slice(desde);
    console.log(`     correos que habria mandado: ${mios.length}`);
    for (const c of mios) {
      console.log(`        → ${Array.isArray(c.to) ? c.to.join(", ") : c.to}`);
      console.log(`          asunto:  ${c.subject}`);
      console.log(`          de:      ${c.from}`);
      console.log(`          resp a:  ${c.reply_to}`);
      const fallos = revisa(c);
      if (fallos.length) {
        malos++;
        console.log(`          MAL:     ${fallos.join(" · ")}`);
      }
    }

    const bloq = bloqueadas.slice(desdeBloq);
    if (bloq.length) {
      console.log(`     escrituras bloqueadas: ${bloq.length}`);
      for (const b of bloq) console.log(`        ${b}`);
    }
    console.log("");
  }

  correos.forEach((c, i) => {
    const nombre = `${i + 1}-${String(c.subject).replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.html`;
    fs.writeFileSync(path.join(SALIDA, nombre), c.html || "");
  });

  if (CON_DATOS && !correos.length) {
    console.log("  NADA QUE MIRAR: con datos inyectados no ha salido ni un correo. Algo no encaja.\n");
    process.exit(1);
  }

  console.log(`  ${correos.length} correos guardados en ${SALIDA}/`);
  console.log(`  ${bloqueadas.length} escrituras bloqueadas: la base queda igual que estaba.`);
  if (inyectadas.length) console.log(`  inyectado: ${inyectadas.join(", ")}`);
  console.log(malos ? `\n  ${malos} cosas mal.\n` : `\n  Todo correcto.\n`);
  process.exit(malos ? 1 : 0);
})();
