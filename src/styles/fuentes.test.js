/**
 * Las dos tipografías, y dónde puede ir cada una.
 *
 * Esto no comprueba cómo se ve nada: comprueba la regla que sostiene la
 * decisión. Bricolage Grotesque va en los titulares grandes porque ahí habla la
 * marca, y no va en el producto porque sus diez dígitos no miden lo mismo —una
 * columna de precios sale desalineada—. Es una regla fácil de romper sin darse
 * cuenta al añadir una pantalla, y por eso está escrita aquí y no solo en un
 * comentario.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/** Todos los .css del proyecto, con su ruta relativa. */
function hojas(dir = RAIZ, acc = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) hojas(p, acc);
    else if (entrada.name.endsWith(".css")) acc.push(p);
  }
  return acc;
}

const leer = (p) => fs.readFileSync(p, "utf8");
const relativa = (p) => path.relative(RAIZ, p).replace(/\\/g, "/");

test("la fuente se declara en un solo sitio", () => {
  /* Antes había cuarenta y siete declaraciones repartidas por veinte ficheros y
     cuatro familias distintas. Si vuelven a aparecer, vuelve el problema: una
     acaba pisando a la otra y nadie sabe cuál manda. */
  const sueltas = [];
  for (const hoja of hojas()) {
    const nombre = path.basename(hoja);
    if (["tokens.css", "fuentes.css", "index.css"].includes(nombre)) continue;
    for (const linea of leer(hoja).split("\n")) {
      if (!/font-family/.test(linea)) continue;
      if (/var\(--fuente/.test(linea)) continue;          // pide la del token
      if (/inherit|monospace|source-code-pro/.test(linea)) continue;
      sueltas.push(`${relativa(hoja)}: ${linea.trim()}`);
    }
  }
  expect(sueltas).toEqual([]);
});

test("la letra de titulares no toca el producto", () => {
  /* Solo los cuatro titulares grandes: el del home, el de la portada de cómo
     funciona, el de cada bloque y el del cierre. Ni una tabla, ni un precio, ni
     el panel. */
  const usos = [];
  for (const hoja of hojas()) {
    if (path.basename(hoja) === "tokens.css") continue;
    leer(hoja).split("\n").forEach((linea) => {
      if (/font-family:\s*var\(--fuente-titulos\)/.test(linea)) usos.push(relativa(hoja));
    });
  }
  expect(usos.sort()).toEqual([
    "pages/ComoFuncionaPage.css",
    "pages/ComoFuncionaPage.css",
    "pages/ComoFuncionaPage.css",
    "pages/LandingPage.css",
  ]);
});

test("las dos fuentes se sirven desde aquí, no desde Google", () => {
  /* Un enlace a fonts.googleapis.com manda la IP de cada visitante a un tercero
     antes de que haya aceptado nada. */
  /* Se miran los enlaces, no las palabras: el propio comentario del fichero
     nombra a Google para explicar por qué no se usa. */
  const fuentes = leer(path.join(RAIZ, "styles/fuentes.css"));
  const sinComentarios = fuentes.replace(/\/\*[\s\S]*?\*\//g, "");
  expect(sinComentarios).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  expect(fuentes).toMatch(/url\("\.\.\/fonts\/nunito-sans-latin\.woff2"\)/);
  expect(fuentes).toMatch(/url\("\.\.\/fonts\/bricolage-latin\.woff2"\)/);

  const indice = leer(path.join(RAIZ, "..", "public", "index.html"));
  expect(indice).not.toMatch(/fonts\.googleapis\.com/);
});

test("los ficheros de fuente existen y son woff2", () => {
  // Un `@font-face` que apunta a un fichero que no está falla en silencio: la
  // página se pinta con el sustituto y nadie se entera.
  for (const f of ["nunito-sans-latin", "nunito-sans-latin-ext", "bricolage-latin", "bricolage-latin-ext"]) {
    const ruta = path.join(RAIZ, "fonts", `${f}.woff2`);
    expect(fs.existsSync(ruta)).toBe(true);
    expect(fs.readFileSync(ruta).subarray(0, 4).toString("ascii")).toBe("wOF2");
  }
});
