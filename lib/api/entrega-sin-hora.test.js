/**
 * Una entrega a domicilio muchas veces no tiene hora, y no es un descuido.
 *
 * Lo dijo Ana: sabe el día —lo dio el transportista al aceptar el segundo
 * viaje— pero la hora la pone el conductor el mismo día, cuando llama antes de
 * llegar. Nadie la sabe todavía.
 *
 * El recordatorio se manda igual, porque el día es lo que hay que recordar. Lo
 * que no puede es callarse lo de la hora: un cliente que recibe «tu cita es
 * mañana» sin hora pregunta por la hora, y la respuesta ya podía estar en el
 * correo. Y no se dice cuando sí hay hora: repetirlo al lado de una hora escrita
 * haría dudar de esa hora.
 *
 * Una visita a un concesionario es otra cosa: ahí la hora se acuerda y sin ella
 * no hay cita.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs
  .readFileSync(path.join(__dirname, "cron-appointment-reminders-handler.js"), "utf8")
  .replace(/\r\n/g, "\n");

test("lo de la hora se dice solo cuando falta la hora", () => {
  assert.match(
    FUENTE,
    /const sinHora = !esVisita && !String\(lead\.appointment_time \|\| ""\)\.trim\(\);/
  );
});

test("y solo en una entrega, no en una visita al concesionario", () => {
  // En una visita la hora se acuerda antes: si falta, lo que hay es un fallo,
  // no un dato que llega después.
  assert.match(FUENTE, /const sinHora = !esVisita &&/);
});

test("dice quién pone la hora y qué tiene que hacer el cliente", () => {
  assert.match(FUENTE, /La hora exacta la pone el transportista: te llama antes de llegar/);
  assert.match(FUENTE, /alguien para recibir el coche y firmar la entrega/);
});

test("va en los dos recordatorios, el de la víspera y el del día", () => {
  // El de la víspera es el que sirve para organizarse; el del día, para no
  // salir de casa. Los dos tienen el mismo agujero sin esto.
  assert.equal((FUENTE.match(/loDeLaHora \+/g) || []).length, 2);
});

test("y la fila de la hora no se pinta vacía", () => {
  // La tabla de datos ya quita las filas sin valor. Si alguien la cambiara,
  // el correo diría «Hora:» y nada detrás, que es peor que no decirlo.
  const correo = fs
    .readFileSync(path.join(__dirname, "..", "correo.js"), "utf8")
    .replace(/\r\n/g, "\n");
  assert.match(correo, /\.filter\(\(\[, v\]\) => v !== null && v !== undefined && v !== ""\)/);
});
