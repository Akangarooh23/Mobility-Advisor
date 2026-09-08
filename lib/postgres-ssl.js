/**
 * Como se verifica el certificado de la base de datos. Un solo sitio.
 *
 * Esta linea estaba escrita 55 veces, siempre igual y siempre diciendo
 * `rejectUnauthorized: false`: acepta cualquier certificado que le presenten.
 * Eso significa que quien se coloque en medio de la conexion puede enseñar uno
 * suyo, y el cliente se lo cree: lee y modifica todo lo que va y viene,
 * empezando por la contraseña de la base.
 *
 * No era una decision, era el copiar y pegar de la primera vez. Neon verifica
 * perfectamente con su cadena normal —comprobado contra el servidor de verdad
 * antes de cambiar esto—, asi que no habia nada que ganar dejandolo abierto.
 *
 * Escrito una vez, y no 55, porque la proxima vez que haya que tocarlo tiene
 * que poder tocarse en un sitio. Un ajuste de seguridad repetido cincuenta
 * veces no se cambia nunca: siempre queda uno.
 *
 * Si algun dia un servidor deja de verificar y hay que salir del paso, se pone
 * PGSSL_SIN_VERIFICAR=1 en el entorno. Es una puerta de emergencia y se nota
 * que lo es: deja aviso en el arranque, para que no se quede puesta.
 */
"use strict";

const sinVerificar = process.env.PGSSL_SIN_VERIFICAR === "1";

if (sinVerificar) {
  console.warn(
    "[postgres-ssl] AVISO: PGSSL_SIN_VERIFICAR=1 — se acepta cualquier certificado de la base de datos. " +
      "Esto es una puerta de emergencia, no un ajuste. Quitala en cuanto se pueda."
  );
}

/** Lo que se le pasa a `new Pool({ ssl })`. */
const SSL_POSTGRES = { rejectUnauthorized: !sinVerificar };

module.exports = { SSL_POSTGRES };
