/**
 * Ningún botón con el texto del color del fondo.
 *
 * `--marca` valía #FFC400 y ahora vale #111111, igual que `--gris-900`. Los
 * botones escritos entonces ponían el texto en `--gris-900` sobre `--marca`,
 * que era negro sobre amarillo y pasó a ser negro sobre negro: rectángulos sin
 * texto. Pasó en cuatro sitios a la vez —pagar la fianza en la ficha y en el
 * panel, elegir hora y el número de la campana— y ninguna prueba lo vio, porque
 * el código era correcto: solo era invisible.
 *
 * Esto mira los estilos en línea del código: donde un mismo objeto fija fondo y
 * color, los dos se resuelven contra `tokens.css` y no pueden acabar en el mismo
 * valor. Solo cubre lo idéntico, no el contraste flojo: lo que se busca es que
 * nadie pueda volver a dejar un botón sin texto.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/** Los tokens de color, resueltos hasta el valor final. */
function leeTokens() {
  const css = fs.readFileSync(path.join(RAIZ, "styles", "tokens.css"), "utf8");
  const directos = {};
  for (const [, nombre, valor] of css.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    directos[nombre] = valor.trim().replace(/\s*\/\*.*$/, "").trim();
  }
  const resuelve = (v, vueltas = 0) => {
    const ref = /^var\(--([\w-]+)/.exec(v);
    if (!ref || vueltas > 8) return v.toLowerCase();
    return resuelve(directos[ref[1]] ?? v, vueltas + 1);
  };
  const tokens = {};
  for (const [n, v] of Object.entries(directos)) tokens[n] = resuelve(v);
  return tokens;
}

/** Un color de un estilo en línea, hasta su valor final. Null si no se sabe. */
function resuelveColor(bruto, tokens) {
  const texto = String(bruto).trim();
  const ref = /^var\(\s*--([\w-]+)/.exec(texto);
  if (ref) return tokens[ref[1]] ? tokens[ref[1]].toLowerCase() : null;
  if (/^#[0-9a-f]{3,8}$/i.test(texto)) {
    // #fff y #ffffff son el mismo blanco.
    const h = texto.toLowerCase();
    return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
  }
  return null;
}

function ficherosJs(dir, salida = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) ficherosJs(completo, salida);
    else if (/\.js$/.test(entrada.name) && !/\.test\.js$/.test(entrada.name)) salida.push(completo);
  }
  return salida;
}

/**
 * Los pares fondo/color de un fichero.
 *
 * Se recorta cada `style={{ … }}` por sus llaves y dentro se buscan un
 * `background` y un `color` literales. Los que se calculan con una condición se
 * quedan fuera a propósito: aquí no se ejecuta nada, y adivinar qué rama sale
 * daría avisos falsos.
 */
function paresDeColor(codigo) {
  const pares = [];
  const literal = (bloque, prop) => {
    const m = new RegExp(`\\b${prop}:\\s*("([^"]+)"|'([^']+)')`).exec(bloque);
    return m ? (m[2] ?? m[3]) : null;
  };
  for (const inicio of [...codigo.matchAll(/style=\{\{/g)].map((m) => m.index)) {
    let nivel = 0, fin = inicio;
    for (let i = inicio + 7; i < codigo.length; i += 1) {
      if (codigo[i] === "{") nivel += 1;
      else if (codigo[i] === "}") { if (nivel === 0) { fin = i; break; } nivel -= 1; }
    }
    const bloque = codigo.slice(inicio, fin);
    const fondo = literal(bloque, "background") || literal(bloque, "backgroundColor");
    const color = literal(bloque, "color");
    if (fondo && color) {
      pares.push({ fondo, color, linea: codigo.slice(0, inicio).split("\n").length });
    }
  }
  return pares;
}

test("ningún texto se pinta del color de su propio fondo", () => {
  const tokens = leeTokens();
  const invisibles = [];
  for (const fichero of ficherosJs(RAIZ)) {
    const codigo = fs.readFileSync(fichero, "utf8");
    for (const { fondo, color, linea } of paresDeColor(codigo)) {
      const f = resuelveColor(fondo, tokens);
      const c = resuelveColor(color, tokens);
      if (f && c && f === c) {
        invisibles.push(`${path.relative(RAIZ, fichero)}:${linea} — ${color} sobre ${fondo}, los dos ${f}`);
      }
    }
  }
  expect(invisibles).toEqual([]);
});

test("la marca y el gris más oscuro son el mismo negro, que es de donde venía el lío", () => {
  const tokens = leeTokens();
  expect(tokens["marca"]).toBe(tokens["gris-900"]);
});
