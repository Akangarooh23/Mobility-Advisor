/**
 * El freno de ritmo: cuántas veces se puede intentar algo, y cada cuánto.
 *
 * Había uno y vivía en un `Map` dentro del proceso. En Vercel eso no frena
 * nada: cada petición puede caer en una instancia distinta, y las instancias se
 * reciclan, así que quien prueba contraseñas en bucle reparte los intentos y
 * ninguna memoria llega al tope. El contador se reiniciaba solo y a favor de
 * quien ataca.
 *
 * Esto cuenta en la base —tabla `frenos_de_ritmo`, migración 0007—, que es una
 * sola cuenta mírese desde donde se mire.
 *
 * ── Cómo se usa ───────────────────────────────────────────────────────────
 *
 *     const { paso, faltan } = await pide(pool, "login", correo, LIMITES.login);
 *     if (!paso) return res.status(429)…
 *
 * Y cuando la cosa sale bien —el login acierta—, se suelta:
 *
 *     await suelta(pool, "login", correo);
 *
 * ── Dos reglas al usarlo ──────────────────────────────────────────────────
 *
 * **Se frena por dos claves, no por una.** Por correo, para que no le revienten
 * la cuenta a alguien concreto; y por IP, para que no prueben mil correos
 * distintos desde el mismo sitio. Frenar solo por correo deja pasar el barrido;
 * solo por IP, castiga a todos los de una oficina por culpa de uno.
 *
 * **Si la base no contesta, se deja pasar.** Un freno caído no puede dejar a
 * nadie fuera de su cuenta: eso convierte un problema de base de datos en una
 * caída del login para todo el mundo. Se apunta en el registro y se sigue.
 */

/** Lo que se permite en cada sitio. En un solo lugar, para poder mirarlo. */
const LIMITES = {
  // Diez contraseñas falladas por correo cada cuarto de hora. Una persona que
  // no se acuerda prueba tres o cuatro; diez ya es otra cosa.
  login:        { veces: 10, segundos: 15 * 60 },
  // Y treinta por IP: cabe una familia o una oficina, no un barrido.
  loginPorIp:   { veces: 30, segundos: 15 * 60 },
  // Pedir el correo de recuperación: cinco por dirección cada cuarto de hora.
  reset:        { veces: 5,  segundos: 15 * 60 },
  resetPorIp:   { veces: 10, segundos: 15 * 60 },
  // Solicitudes de visita: cada una manda un correo al vendedor.
  visita:       { veces: 5,  segundos: 60 * 60 },
  visitaPorIp:  { veces: 20, segundos: 60 * 60 },
};

function nt(v) {
  return typeof v === "string" ? v.trim().toLowerCase() : String(v ?? "").trim().toLowerCase();
}

/**
 * Cuenta un intento y dice si pasa.
 *
 * El `INSERT … ON CONFLICT DO UPDATE … RETURNING` hace las tres cosas de una
 * vez —crear, sumar o reiniciar— y en una sola operación: dos peticiones a la
 * vez no pueden colarse contando cada una por su lado.
 */
async function pide(pool, ambito, clave, limite) {
  const k = nt(clave);
  if (!pool || !k || !limite) return { paso: true, faltan: 0, enSegundos: 0 };

  try {
    const { rows } = await pool.query(
      `INSERT INTO frenos_de_ritmo (ambito, clave, intentos, hasta)
       VALUES ($1, $2, 1, NOW() + make_interval(secs => $3))
       ON CONFLICT (ambito, clave) DO UPDATE SET
         intentos = CASE WHEN frenos_de_ritmo.hasta < NOW() THEN 1
                         ELSE frenos_de_ritmo.intentos + 1 END,
         hasta    = CASE WHEN frenos_de_ritmo.hasta < NOW() THEN NOW() + make_interval(secs => $3)
                         ELSE frenos_de_ritmo.hasta END
       RETURNING intentos, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (hasta - NOW()))))::int AS quedan`,
      [ambito, k, limite.segundos]
    );

    const { intentos, quedan } = rows[0];
    return {
      paso: intentos <= limite.veces,
      faltan: Math.max(0, limite.veces - intentos),
      enSegundos: quedan,
    };
  } catch (e) {
    // Un freno caído no puede dejar a nadie fuera de su cuenta.
    console.error("[freno] no se ha podido contar:", e.message);
    return { paso: true, faltan: 0, enSegundos: 0 };
  }
}

/** Borra la cuenta: se llama cuando el intento sale bien. */
async function suelta(pool, ambito, clave) {
  const k = nt(clave);
  if (!pool || !k) return;
  try {
    await pool.query("DELETE FROM frenos_de_ritmo WHERE ambito = $1 AND clave = $2", [ambito, k]);
  } catch (e) {
    console.error("[freno] no se ha podido soltar:", e.message);
  }
}

/**
 * Barre lo vencido hace rato.
 *
 * Una fila vencida no estorba —la siguiente llamada la reutiliza— pero las de
 * quien no vuelve nunca se quedan para siempre. Se llama desde una tarea
 * programada, no en cada petición: barrer en caliente es pagar en el login lo
 * que se puede pagar de madrugada.
 */
async function limpiaLosFrenos(pool, dias = 1) {
  if (!pool) return 0;
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM frenos_de_ritmo WHERE hasta < NOW() - make_interval(days => $1)",
      [dias]
    );
    return rowCount || 0;
  } catch (e) {
    console.error("[freno] no se ha podido limpiar:", e.message);
    return 0;
  }
}

module.exports = { LIMITES, pide, suelta, limpiaLosFrenos };
