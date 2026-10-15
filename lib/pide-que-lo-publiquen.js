"use strict";

/**
 * Pedirle al ERP que publique el coche, en cuanto el cliente firma el precio.
 *
 * Hasta ahora, firmado el papel, el coche se quedaba quieto hasta que alguien
 * entraba al ERP y pulsaba «Publicar». Y mientras tanto no es que el anuncio
 * tardara: es que **los enlaces no servían**. Los que da el ERP para pegar en
 * coches.net o Wallapop apuntan a la ficha pública del coche, y esa ficha solo
 * existe mientras el anuncio está activo. Sin publicar, el comprador que llega
 * del portal lee «este coche ya no está a la venta» — que encima es mentira:
 * no se ha vendido, es que no ha salido.
 *
 * Quien lo pega no lo ve nunca. Lo ve el comprador.
 *
 * ## Por qué lo publica el ERP y no esto
 *
 * Porque publicar es más que meter una fila: comprueba las puertas, arma el
 * título con marca, modelo y versión, elige la foto principal respetando la
 * que alguien marcara a mano, apunta la fecha en el encargo y manda el correo
 * de «ya está anunciado». Eso vive en el ERP y ahí se queda; copiarlo aquí
 * sería tener dos versiones de la misma decisión, que es el error que más
 * caro nos ha salido esta semana.
 *
 * ## Y por qué esto no revienta nunca
 *
 * Porque el papel del cliente **ya está firmado y guardado**. Que el anuncio
 * no salga es un problema nuestro y de después; dejar sin guardar su firma
 * porque el ERP no contesta sería perder lo único que hizo él.
 *
 * Es el mismo trato que `avisa-de-la-ficha`: se intenta, se apunta si falla y
 * se sigue.
 */

/** Lo que se espera al ERP. Pasado esto, se sigue sin él. */
const ESPERA_MS = 8000;

/**
 * Avisa al ERP. No lanza nunca y no devuelve nada que haya que mirar.
 *
 * Sin `ERP_API_URL` o sin `INTERNAL_API_SECRET` se calla: en local no hay ERP
 * al lado y reventar por eso dejaría sin firmar precios por una publicación
 * que es de después.
 */
async function pideQueLoPubliquen(vehicleId) {
  const id = String(vehicleId || "").trim();
  const erp = String(process.env.ERP_API_URL || "").trim().replace(/\/$/, "");
  const secreto = String(process.env.INTERNAL_API_SECRET || "").trim();
  if (!id || !erp || !secreto) return;

  const corta = new AbortController();
  const reloj = setTimeout(() => corta.abort(), ESPERA_MS);
  try {
    const res = await fetch(`${erp}/api/interno/publicar-idcar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secreto}` },
      body: JSON.stringify({ vehicleId: id }),
      signal: corta.signal,
    });
    /*
     * Y si el ERP dice que no, se apunta con su motivo.
     *
     * No es un fallo: puede faltarle el informe o las franjas, y entonces el
     * coche no debe salir. Pero sin esta línea, un coche con el precio firmado
     * y sin anuncio no tiene explicación en ninguna parte, y lo siguiente es
     * alguien mirando la base a mano.
     */
    if (!res.ok) {
      const porQue = await res.json().catch(() => null);
      console.error(
        "[publicar] el ERP no ha publicado %s: %s",
        id, (porQue && (porQue.detail || porQue.error)) || res.status
      );
    }
  } catch (err) {
    console.error("[publicar] no se ha podido avisar al ERP:", err && err.message);
  } finally {
    clearTimeout(reloj);
  }
}

module.exports = { ESPERA_MS, pideQueLoPubliquen };
