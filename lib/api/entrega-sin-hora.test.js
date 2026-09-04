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

/**
 * Y a quién espera, que en una entrega es lo contrario de lo que parece.
 *
 * En una visita a un concesionario el cliente va a un sitio y pregunta por
 * alguien: «Pregunta por» dice lo que hay que decir. En una entrega a domicilio
 * no va a ninguna parte —viene alguien a su puerta— y esa misma fila le estaba
 * diciendo que preguntara por sí mismo, que es lo que sale al rellenarla con el
 * contacto del expediente.
 *
 * Lo que necesita saber es quién le lleva el coche, para abrir la puerta.
 */
test("la fila cambia de sentido según sea visita o entrega", () => {
  assert.match(FUENTE, /const esEntrega = String\(lead\.lead_type \|\| "visit"\) !== "visit";/);
  assert.match(FUENTE, /esEntrega \? "Te lo lleva" : "Pregunta por"/);
});

test("y el resto del correo sigue distinguiendo lo mismo", () => {
  // Sin esto se calculaba dos veces la misma condición con dos nombres, que es
  // como acaban diciendo cosas distintas.
  assert.match(FUENTE, /const esVisita = !esEntrega;/);
});
