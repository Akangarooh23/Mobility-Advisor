/**
 * Quién puede disparar una tarea programada. La regla, en un solo sitio.
 *
 * ── Lo que había ──────────────────────────────────────────────────────────
 *
 * Cuatro copias de esto:
 *
 *     if (secreto) return authorization === `Bearer ${secreto}`;
 *     return userAgent.includes("vercel-cron");
 *
 * Es decir: **sin secreto configurado, basta con decir que eres Vercel**. Y el
 * agente lo escribe quien llama; es una línea de texto, no una credencial.
 * Detrás de esas direcciones están los correos a los clientes: recordatorios de
 * visita, avisos de alertas, informes listos. Cualquiera podía dispararlos en
 * bucle y mandar correos en nuestro nombre —y de paso quemar los testigos de
 * «ya avisado», que es lo que hace que el recordatorio de verdad no se mande—.
 *
 * ── Lo que hace ahora ─────────────────────────────────────────────────────
 *
 * Sin secreto, **no pasa nadie**. Un secreto que falta es un fallo de
 * configuración, y un fallo de configuración no puede abrir una puerta: como
 * mucho puede cerrarla, que es lo que se nota y se arregla.
 *
 * `CRON_SECRET` está puesto en Vercel desde hace meses, y Vercel manda ese
 * mismo valor en la cabecera `Authorization` cuando dispara una tarea: por eso
 * cerrar aquí no apaga nada. Si algún día desaparece la variable, las tareas
 * dejan de correr y el registro lo dice con todas las letras, en vez de quedar
 * abiertas en silencio.
 *
 * `INTERNAL_API_KEY` sigue valiendo donde ya valía: es la llave que usa un
 * servicio nuestro para llamar a otro.
 */

function nt(v) {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

/**
 * ¿Puede esta petición disparar la tarea?
 *
 * `conLlaveInterna` lo ponen las tareas que además se llaman desde otro
 * servicio nuestro con `x-internal-key`.
 */
function cronAutorizado(req, { conLlaveInterna = false } = {}) {
  if (conLlaveInterna) {
    const interna = nt(process.env.INTERNAL_API_KEY);
    const recibida = nt(req?.headers?.["x-internal-key"]);
    if (interna && recibida && recibida === interna) return true;
  }

  const secreto = nt(process.env.CRON_SECRET);
  if (!secreto) {
    // Ruidoso a propósito: esto solo pasa si alguien borró la variable, y hay
    // que enterarse por el registro y no porque falten los recordatorios.
    console.error(
      "[cron] CRON_SECRET no está configurado: las tareas programadas no se ejecutan. " +
      "Ponlo en Vercel (Settings → Environment Variables) y vuelve a desplegar."
    );
    return false;
  }

  return nt(req?.headers?.authorization) === `Bearer ${secreto}`;
}

module.exports = { cronAutorizado };
