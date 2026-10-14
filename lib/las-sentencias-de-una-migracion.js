/**
 * Partir una migración en sus sentencias.
 *
 * Hace falta por una regla de Postgres que no está escrita en ningún sitio
 * evidente: **varias sentencias en un mismo envío van en una transacción
 * implícita**, aunque nadie escriba BEGIN. El servidor las envuelve él.
 *
 * Y eso choca de frente con `CREATE INDEX CONCURRENTLY`, que no puede ir
 * dentro de una transacción. El resultado es el error más desconcertante del
 * aplicador:
 *
 *     CREATE INDEX CONCURRENTLY cannot run inside a transaction block
 *
 * ...en una migración donde no hay ninguna transacción. El aplicador ya se
 * saltaba el BEGIN al ver CONCURRENTLY; lo que no sabía es que mandar las dos
 * sentencias juntas abría otra por su cuenta. Pasó con la 0024, que crea el
 * índice nuevo y tira el viejo: dos sentencias, y por eso falló.
 *
 * Así que cuando una migración va sin transacción, sus sentencias se mandan
 * **de una en una**. Para eso hay que saber dónde acaba cada una, y ahí está
 * la gracia de este fichero: un `;` dentro de un texto, de un comentario o de
 * un cuerpo de función **no** separa nada.
 *
 *     SELECT 'hola; adiós';        → una sentencia, no dos
 *     -- borra esto; y esto        → un comentario, no una sentencia
 *     $$ BEGIN ...; END $$         → un cuerpo, no tres
 *
 * Cortar por `;` a secas parece que funciona hasta el día que no, y ese día
 * se parte una migración por la mitad y se aplica media.
 */
"use strict";

/**
 * Las sentencias de una migración, en orden y sin las vacías.
 *
 * Se recorre el texto carácter a carácter llevando la cuenta de dónde estamos.
 * Es más largo que una expresión regular y es la razón de que sea correcto:
 * las comillas y los comentarios **se anidan y se escapan**, y eso una
 * expresión regular no lo sabe mirar.
 *
 * @param {string} texto El contenido del fichero .sql
 * @returns {string[]} Cada sentencia, recortada. Las que solo son comentarios
 *   no salen: no hay nada que ejecutar en ellas.
 */
function lasSentencias(texto) {
  const fuente = String(texto ?? "");
  const sentencias = [];
  let desde = 0;
  let i = 0;

  /** Lo que queda entre el último corte y aquí, si hay algo que ejecutar. */
  const corta = (hasta) => {
    const trozo = fuente.slice(desde, hasta);
    if (tieneAlgoQueEjecutar(trozo)) sentencias.push(trozo.trim());
    desde = hasta;
  };

  while (i < fuente.length) {
    const c = fuente[i];
    const siguiente = fuente[i + 1];

    // ── Comentario de línea: hasta el salto, y el salto no es nuestro ──────
    if (c === "-" && siguiente === "-") {
      const fin = fuente.indexOf("\n", i);
      i = fin === -1 ? fuente.length : fin + 1;
      continue;
    }

    /*
     * ── Comentario de bloque, que en Postgres SE ANIDA ────────────────────
     *
     * A diferencia de C, un comentario de bloque puede llevar otro dentro, y
     * el primer cierre que aparece cierra solo el de dentro. Por eso se
     * cuentan aperturas y cierres en vez de buscar el primer cierre: con lo
     * segundo se sale antes de tiempo y se toma por código lo que todavía es
     * comentario.
     */
    if (c === "/" && siguiente === "*") {
      let hondo = 1;
      i += 2;
      while (i < fuente.length && hondo > 0) {
        if (fuente[i] === "/" && fuente[i + 1] === "*") { hondo += 1; i += 2; continue; }
        if (fuente[i] === "*" && fuente[i + 1] === "/") { hondo -= 1; i += 2; continue; }
        i += 1;
      }
      continue;
    }

    /*
     * ── Texto entre comillas simples ──────────────────────────────────────
     *
     * Dos comillas seguidas son una comilla, no el final. Y si la cadena
     * viene marcada con `E`, la barra invertida escapa: `E'no\'acaba'`.
     */
    if (c === "'") {
      const esEscapada = /[Ee]$/.test(fuente.slice(Math.max(0, i - 1), i));
      i += 1;
      while (i < fuente.length) {
        if (esEscapada && fuente[i] === "\\") { i += 2; continue; }
        if (fuente[i] === "'") {
          if (fuente[i + 1] === "'") { i += 2; continue; }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // ── Identificador entre comillas dobles, con la misma regla del doblete ─
    if (c === '"') {
      i += 1;
      while (i < fuente.length) {
        if (fuente[i] === '"') {
          if (fuente[i + 1] === '"') { i += 2; continue; }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    /*
     * ── Comillas de dólar ─────────────────────────────────────────────────
     *
     * `$$ ... $$` o `$loquesea$ ... $loquesea$`, que es como se escribe el
     * cuerpo de una función. Dentro hay `;` a montones y ninguno separa nada.
     * La etiqueta de cierre tiene que ser la misma que la de apertura.
     */
    if (c === "$") {
      const abre = /^\$[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*\$|^\$\$/.exec(fuente.slice(i));
      if (abre) {
        const etiqueta = abre[0];
        const cierra = fuente.indexOf(etiqueta, i + etiqueta.length);
        i = cierra === -1 ? fuente.length : cierra + etiqueta.length;
        continue;
      }
      i += 1;
      continue;
    }

    // ── Y el punto y coma de verdad, que es el único que corta ─────────────
    if (c === ";") {
      i += 1;
      corta(i);
      continue;
    }

    i += 1;
  }

  // Lo que quede suelto al final cuenta: la última sentencia puede no llevar
  // punto y coma, y perderla sería aplicar la migración a medias en silencio.
  corta(fuente.length);

  return sentencias;
}

/**
 * Si en este trozo hay algo más que comentarios y espacios.
 *
 * El rabo de una migración suele ser un comentario final o una línea en
 * blanco. Mandárselo a Postgres no rompe nada, pero contarlo como sentencia sí
 * engaña: el aplicador diría «3 sentencias» de un fichero que tiene dos.
 */
function tieneAlgoQueEjecutar(trozo) {
  const limpio = String(trozo ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/[\s;]+/g, "");
  return limpio.length > 0;
}

/**
 * Si esta migración tiene que ir fuera de transacción.
 *
 * Se mira **sin los comentarios**: una migración que solo menciona
 * `CONCURRENTLY` al explicarse no necesita salir de la transacción, y sacarla
 * es perder la vuelta atrás a cambio de nada. Ya pasó con la 0020, cuyo
 * comentario decía «con tráfico habría que usar CONCURRENTLY».
 */
function vaSinTransaccion(texto) {
  const sinComentarios = String(texto ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
  return /\bCONCURRENTLY\b/i.test(sinComentarios);
}

exports.lasSentencias = lasSentencias;
exports.vaSinTransaccion = vaSinTransaccion;
