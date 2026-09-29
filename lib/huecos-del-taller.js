"use strict";

/**
 * Las horas de taller: reservadas y bloqueadas.
 *
 * ## Lo que había
 *
 * Un fichero JSON **dentro del propio despliegue** —`db/workshop-availability.json`—
 * escrito con `fs.writeFileSync`. En Vercel el sistema de ficheros es de solo
 * lectura fuera de `/tmp`, así que esa escritura lanza; y no había `try/catch`,
 * con lo que la reserva se iba en un 500.
 *
 * Y el lado de leer lo tapaba: si el fichero no existe se devuelven listas
 * vacías, así que **todas las horas salían libres siempre**. El cliente elegía
 * una y reventaba al confirmar. El fichero ni siquiera existe en el repositorio.
 *
 * ## Lo que hace esto
 *
 * Lo mismo, en Postgres. Las formas que devuelve son las que el manejador ya
 * esperaba —`reservations`, `blockedDays`, `blockedSlots`, con sus campos en
 * camelCase— para no tocar el cálculo de disponibilidad, que estaba bien.
 *
 * ## Y una cosa que el fichero no podía dar
 *
 * **Que no se reserve dos veces la misma hora.** Con el fichero, dos personas
 * que pulsaran a la vez leían el mismo contenido, cada una añadía su reserva y
 * la segunda escritura pisaba a la primera: dos clientes con la misma cita y
 * una sola apuntada. Aquí lo impide un índice único, que es una regla de la
 * base y no una comprobación que se pueda adelantar nadie.
 */

const { elPool: elPoolCompartido } = require("./postgres");

let _pool = null;
function elPool() {
  return elPoolCompartido();
}

/*
 * Aquí vivía `ASEGURA`, el `CREATE TABLE IF NOT EXISTS` de las dos tablas del
 * taller -`moveadvisor_workshop_reservations` y `moveadvisor_workshop_blocks`-,
 * que se ejecutaba en cada reserva y en cada bloqueo.
 *
 * Las declara `migrations/0013`. Y hacía falta: existían en producción sin
 * estar en ninguna migración, así que una base nueva salía sin ellas y nadie
 * se enteraba hasta intentar citar a alguien.
 *
 * El comentario que había aquí avisaba de que estas dos declaraciones eran
 * GEMELAS de las de `apps/api/src/db/schema.ts` en el ERP, y que tocar una
 * obligaba a tocar la otra. Ese apaño sobra por este lado: ahora la fuente es
 * la migración. Por el del ERP sigue en pie mientras cree su esquema al
 * arrancar.
 */


let listo = false;
async function prepara(pool) {
  if (listo) return;
  listo = true;
}

const texto = (v) => String(v ?? "").trim();
const elDia = (d) => texto(d).slice(0, 10);
const unId = (que) => `${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Lo que hay de ese taller en ese mes, con la forma que espera el manejador.
 *
 * Por mes y no entero: la pantalla pinta un calendario de un mes, y traerse
 * todas las reservas de todos los talleres para pintar treinta días es la clase
 * de consulta que va bien hasta que deja de ir.
 *
 * Sin base de datos configurada devuelve vacío —en local sin Postgres la
 * pantalla se puede seguir abriendo—, pero **si la consulta falla, levanta**.
 * No es lo mismo no tener base que no poder leerla: devolver listas vacías al
 * fallar es exactamente lo que hacía el fichero, y por eso todas las horas
 * salían libres. Un calendario que no se puede leer lo dice; no se inventa
 * huecos que luego revientan al confirmar.
 */
async function loQueHay({ workshopId, monthKey }) {
  const vacio = { reservations: [], blockedDays: [], blockedSlots: [] };
  const pool = elPool();
  const taller = texto(workshopId);
  const mes = texto(monthKey);
  if (!pool || !taller || !/^\d{4}-\d{2}$/.test(mes)) return vacio;

  await prepara(pool);
  {
    const desde = `${mes}-01`;
    const [res, blo] = await Promise.all([
      pool.query(
        `SELECT id, workshop_id, proveedor, to_char(dia, 'YYYY-MM-DD') dia, hora, estado, created_at
           FROM moveadvisor_workshop_reservations
          WHERE workshop_id = $1 AND estado = 'booked'
            AND dia >= $2::date AND dia < ($2::date + INTERVAL '1 month')`,
        [taller, desde],
      ),
      pool.query(
        `SELECT id, workshop_id, proveedor, to_char(dia, 'YYYY-MM-DD') dia, hora, motivo, created_at
           FROM moveadvisor_workshop_blocks
          WHERE workshop_id = $1
            AND dia >= $2::date AND dia < ($2::date + INTERVAL '1 month')`,
        [taller, desde],
      ),
    ]);

    const comoAntes = (f) => ({
      id: f.id,
      workshopId: f.workshop_id,
      provider: f.proveedor,
      dateKey: f.dia,
      time: f.hora ?? "",
      createdAt: f.created_at ? new Date(f.created_at).toISOString() : "",
    });

    return {
      reservations: res.rows.map((f) => ({ ...comoAntes(f), status: f.estado })),
      blockedDays: blo.rows.filter((f) => !f.hora).map((f) => ({ ...comoAntes(f), motivo: f.motivo })),
      blockedSlots: blo.rows.filter((f) => f.hora).map((f) => ({ ...comoAntes(f), motivo: f.motivo })),
    };
  }
}

/**
 * Apunta la reserva. Devuelve `'ocupada'` si otro se la llevó por delante.
 *
 * El índice único es quien decide, no una comprobación previa: entre mirar si
 * está libre y escribirla cabe otra persona haciendo lo mismo, y con el fichero
 * eso daba dos citas a la misma hora. Aquí la segunda choca y se entera.
 */
async function reserva({ workshopId, provider, dateKey, time, userEmail }) {
  const pool = elPool();
  if (!pool) throw new Error("sin_base_de_datos");
  await prepara(pool);
  try {
    await pool.query(
      `INSERT INTO moveadvisor_workshop_reservations
         (id, workshop_id, proveedor, dia, hora, estado, user_email)
       VALUES ($1, $2, $3, $4::date, $5, 'booked', $6)`,
      [unId("wres"), texto(workshopId), texto(provider), elDia(dateKey), texto(time), texto(userEmail)],
    );
    return "";
  } catch (err) {
    // 23505 es el índice único: esa hora ya está cogida.
    if (err && err.code === "23505") return "ocupada";
    throw err;
  }
}

/** Bloquea un día entero (`time` vacío) o un hueco suelto. */
async function bloquea({ workshopId, provider, dateKey, time, motivo }) {
  const pool = elPool();
  if (!pool) throw new Error("sin_base_de_datos");
  await prepara(pool);
  const hora = texto(time) || null;
  await pool.query(
    `INSERT INTO moveadvisor_workshop_blocks (id, workshop_id, proveedor, dia, hora, motivo)
     VALUES ($1, $2, $3, $4::date, $5, $6)
     ON CONFLICT DO NOTHING`,
    [unId(hora ? "wslot" : "wday"), texto(workshopId), texto(provider), elDia(dateKey), hora, texto(motivo)],
  );
}

/** Y lo quita. Sin hora, el bloqueo del día entero. */
async function desbloquea({ workshopId, dateKey, time }) {
  const pool = elPool();
  if (!pool) throw new Error("sin_base_de_datos");
  await prepara(pool);
  const hora = texto(time) || null;
  await pool.query(
    hora
      ? `DELETE FROM moveadvisor_workshop_blocks WHERE workshop_id = $1 AND dia = $2::date AND hora = $3`
      : `DELETE FROM moveadvisor_workshop_blocks WHERE workshop_id = $1 AND dia = $2::date AND hora IS NULL`,
    hora ? [texto(workshopId), elDia(dateKey), hora] : [texto(workshopId), elDia(dateKey)],
  );
}

module.exports = { loQueHay, reserva, bloquea, desbloquea };
