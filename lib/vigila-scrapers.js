"use strict";

/**
 * Avisar cuando deja de entrar catalogo.
 *
 * Hay un aviso para cuando un flujo de n8n **falla**. No habia ninguno para lo
 * contrario, que resulto ser lo que pasa de verdad: que un flujo **no se
 * ejecuta**. Un fallo grita; una ausencia no hace ruido.
 *
 * El 1 de septiembre de 2026 se descubrio que n8n llevaba **quince dias**
 * parado —ningun portal raspado desde el 17 de agosto— y que el de importacion
 * llevaba **cuarenta y siete**, desde el 16 de julio. Nadie se entero. Entre
 * medias, 25.462 de las 25.498 ofertas alemanas se vendieron en Alemania
 * mientras el catalogo las seguia enseñando, con su boton de pagar la fianza.
 *
 * Un aviso de «hace dos dias que no entran ofertas de X» lo habria cazado el
 * 19 de agosto.
 */

/**
 * Cuantos dias de silencio se toleran antes de avisar.
 *
 * Dos, no uno: un flujo diario que se retrasa unas horas o una noche que falla
 * y se recupera sola no son una averia, y un aviso por eso se convierte en ruido
 * que se acaba ignorando —que es como se pierden los avisos de verdad.
 */
const DIAS_DE_SILENCIO = 2;

/** El de importacion tiene su propio ritmo y su propio aviso. */
const IMPORTACION = "autoscout24-de";

/**
 * Que fuentes estan calladas, y desde cuando.
 *
 * `fuentes` es lo que devuelve la consulta: una fila por portal con la fecha del
 * ultimo raspado. Se devuelve la lista de las que llevan demasiado tiempo sin
 * dar señales, ordenadas por la que peor esta.
 *
 * `ahora` se pasa siempre para poder probarlo sin depender del reloj.
 */
function fuentesCalladas(fuentes, ahora, dias = DIAS_DE_SILENCIO) {
  if (!Array.isArray(fuentes)) return [];
  const limite = Number(dias) * 24 * 60 * 60 * 1000;
  const t = ahora instanceof Date ? ahora.getTime() : new Date(ahora).getTime();

  return fuentes
    .map((f) => {
      const ultimo = f.ultimo ? new Date(f.ultimo) : null;
      // Una fuente que no ha raspado nunca no esta callada: no ha empezado.
      // Avisar de eso el primer dia seria avisar de que un portal nuevo todavia
      // no tiene datos.
      if (!ultimo || Number.isNaN(ultimo.getTime())) return null;
      const silencio = t - ultimo.getTime();
      return {
        fuente: String(f.fuente || "(sin nombre)"),
        ofertas: Number(f.ofertas) || 0,
        ultimo,
        dias: Math.floor(silencio / (24 * 60 * 60 * 1000)),
        callada: silencio > limite,
      };
    })
    .filter((x) => x && x.callada)
    .sort((a, b) => b.dias - a.dias);
}

/**
 * Como se cuenta en el correo.
 *
 * El asunto lleva la cifra que importa: cuantos dias lleva callada la peor. Un
 * asunto que diga «Aviso del sistema» se archiva sin abrirlo.
 */
function asuntoDelAviso(calladas) {
  if (!calladas.length) return "";
  const peor = calladas[0];
  const cuantas = calladas.length;
  const dias = `${peor.dias} ${peor.dias === 1 ? "día" : "días"}`;
  return cuantas === 1
    ? `No entra catálogo de ${peor.fuente} desde hace ${dias}`
    : `No entra catálogo de ${cuantas} portales — el peor, ${peor.fuente}, ${dias}`;
}

/** Una linea por fuente callada, para el cuerpo del correo. */
function lineasDelAviso(calladas) {
  return calladas.map((c) => {
    const cuando = c.ultimo.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
    const cuantas = c.ofertas ? ` · ${c.ofertas.toLocaleString("es-ES")} ofertas guardadas` : "";
    const marca = c.fuente === IMPORTACION ? " ← importación" : "";
    return `${c.fuente}: ${c.dias} días sin raspar, el último fue el ${cuando}${cuantas}${marca}`;
  });
}

module.exports = {
  DIAS_DE_SILENCIO,
  IMPORTACION,
  fuentesCalladas,
  asuntoDelAviso,
  lineasDelAviso,
};
