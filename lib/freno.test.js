/**
 * El freno de ritmo cuenta bien, y cuenta en la base.
 *
 * Lo que había vivía en un `Map` del proceso, y en Vercel eso no frena: cada
 * petición puede caer en otra instancia. Aquí lo que se comprueba es la
 * aritmética —cuándo deja pasar, cuándo no, cuándo se reinicia— y las dos
 * decisiones que no son obvias:
 *
 *   · si la base no contesta, **se deja pasar**: un freno roto no puede dejar a
 *     nadie fuera de su cuenta;
 *   · el intento que hace de tope pasa, y el siguiente ya no.
 */
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const FRENO = require("./freno");

/** Una base de mentira que cuenta de verdad, como lo haría Postgres. */
function baseQueCuenta() {
  const filas = new Map();
  return {
    filas,
    async query(sql, params) {
      const t = String(sql);
      if (/INSERT INTO frenos_de_ritmo/.test(t)) {
        const [ambito, clave, segundos] = params;
        const k = `${ambito}|${clave}`;
        const ahora = Date.now();
        const fila = filas.get(k);
        if (!fila || fila.hasta < ahora) filas.set(k, { intentos: 1, hasta: ahora + segundos * 1000 });
        else fila.intentos += 1;
        const f = filas.get(k);
        return { rows: [{ intentos: f.intentos, quedan: Math.max(1, Math.ceil((f.hasta - ahora) / 1000)) }] };
      }
      if (/DELETE FROM frenos_de_ritmo WHERE ambito/.test(t)) {
        filas.delete(`${params[0]}|${params[1]}`);
        return { rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

const LIMITE = { veces: 3, segundos: 900 };

describe("pedir paso", () => {
  let base;
  beforeEach(() => { base = baseQueCuenta(); });

  test("los primeros pasan y el de después no", async () => {
    const paso = [];
    for (let i = 0; i < 5; i++) {
      paso.push((await FRENO.pide(base, "login", "ana@example.com", LIMITE)).paso);
    }
    assert.deepEqual(paso, [true, true, true, false, false], "el tercero es el último que pasa");
  });

  test("dice cuántos quedan, para poder avisar antes de cerrar", async () => {
    const uno = await FRENO.pide(base, "login", "ana@example.com", LIMITE);
    assert.equal(uno.faltan, 2);
    assert.ok(uno.enSegundos > 0, "y cuándo se abre otra vez");
  });

  test("cada clave cuenta por su cuenta", async () => {
    for (let i = 0; i < 4; i++) await FRENO.pide(base, "login", "ana@example.com", LIMITE);
    const otra = await FRENO.pide(base, "login", "juan@example.com", LIMITE);
    assert.equal(otra.paso, true, "frenar a uno no puede frenar a todos");
  });

  test("y cada ámbito también", async () => {
    for (let i = 0; i < 4; i++) await FRENO.pide(base, "login", "ana@example.com", LIMITE);
    const otro = await FRENO.pide(base, "reset", "ana@example.com", LIMITE);
    assert.equal(otro.paso, true, "el login y la recuperación no comparten cuenta");
  });

  test("el correo se normaliza: mayúsculas y espacios no son otra persona", async () => {
    for (let i = 0; i < 3; i++) await FRENO.pide(base, "login", "ana@example.com", LIMITE);
    const disfrazado = await FRENO.pide(base, "login", "  Ana@Example.COM ", LIMITE);
    assert.equal(disfrazado.paso, false, "si no, el freno se salta escribiendo una mayúscula");
  });

  test("sin clave no se frena a nadie", async () => {
    // Una IP vacía es lo que llega cuando falta la cabecera, y no puede
    // convertirse en una única cuenta compartida por todo el mundo.
    const r = await FRENO.pide(base, "login-ip", "", LIMITE);
    assert.equal(r.paso, true);
    assert.equal(base.filas.size, 0);
  });

  test("cuando pasa el plazo, se empieza de cero", async () => {
    for (let i = 0; i < 4; i++) await FRENO.pide(base, "login", "ana@example.com", LIMITE);
    assert.equal((await FRENO.pide(base, "login", "ana@example.com", LIMITE)).paso, false);

    // Se adelanta el reloj de la fila: es lo que hace el plazo al vencer.
    base.filas.get("login|ana@example.com").hasta = Date.now() - 1;

    const despues = await FRENO.pide(base, "login", "ana@example.com", LIMITE);
    assert.equal(despues.paso, true, "pasada la ventana se vuelve a contar desde uno");
    assert.equal(despues.faltan, LIMITE.veces - 1);
  });
});

describe("soltar", () => {
  test("después de acertar, la cuenta se borra", async () => {
    const base = baseQueCuenta();
    for (let i = 0; i < 3; i++) await FRENO.pide(base, "login", "ana@example.com", LIMITE);
    assert.equal((await FRENO.pide(base, "login", "ana@example.com", LIMITE)).paso, false);

    await FRENO.suelta(base, "login", "ana@example.com");
    assert.equal((await FRENO.pide(base, "login", "ana@example.com", LIMITE)).paso, true,
      "un día torpe no puede dejar frenado a quien ya ha entrado bien");
  });
});

describe("cuando la base falla", () => {
  test("se deja pasar, y se dice en el registro", async () => {
    const rota = { async query() { throw new Error("no hay base"); } };
    const errores = [];
    const antes = console.error;
    console.error = (...a) => errores.push(a.join(" "));
    try {
      const r = await FRENO.pide(rota, "login", "ana@example.com", LIMITE);
      assert.equal(r.paso, true, "un freno roto no puede dejar a nadie fuera de su cuenta");
    } finally {
      console.error = antes;
    }
    assert.match(errores.join(" "), /freno/);
  });

  test("sin base, tampoco se frena", async () => {
    assert.equal((await FRENO.pide(null, "login", "ana@example.com", LIMITE)).paso, true);
  });
});

describe("los límites de cada sitio", () => {
  test("están todos y son números con sentido", () => {
    for (const [donde, l] of Object.entries(FRENO.LIMITES)) {
      assert.ok(l.veces >= 1, `${donde}: un tope de cero cierra la puerta a todo el mundo`);
      assert.ok(l.segundos >= 60, `${donde}: una ventana de segundos no frena nada`);
    }
  });

  test("por IP se aguanta más que por correo", () => {
    // Detrás de una IP hay una oficina o una familia; detrás de un correo, una
    // persona. Si el tope por IP fuera el mismo, el primero que se equivoca deja
    // sin entrar a los demás.
    assert.ok(FRENO.LIMITES.loginPorIp.veces > FRENO.LIMITES.login.veces);
    assert.ok(FRENO.LIMITES.visitaPorIp.veces > FRENO.LIMITES.visita.veces);
  });
});
