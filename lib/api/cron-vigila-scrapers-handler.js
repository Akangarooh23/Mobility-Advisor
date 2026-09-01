/**
 * Aviso diario de que ha dejado de entrar catalogo.
 *
 * Ver `lib/vigila-scrapers.js` para el porque. En corto: habia aviso de flujo
 * que falla y no de flujo que no se ejecuta, y lo segundo estuvo pasando quince
 * dias sin que nadie se enterara.
 *
 * No manda nada al cliente. Va al correo interno, una vez al dia, y solo si hay
 * algo que decir: un aviso que llega todos los dias diciendo que todo va bien
 * deja de leerse en una semana.
 */
const { Pool } = require("pg");
const { MARCA, remitente, correoInterno } = require("../marca");
const { plantilla, parrafo, datos, aviso } = require("../correo");
const {
  fuentesCalladas, asuntoDelAviso, lineasDelAviso, DIAS_DE_SILENCIO, IMPORTACION,
} = require("../vigila-scrapers");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

/**
 * Quien puede dispararlo. El mismo criterio que las otras tareas: con
 * `CRON_SECRET` puesto se exige, y sin el solo pasa la llamada de Vercel Cron.
 */
function autorizado(req) {
  const secreto = String(process.env.CRON_SECRET || "").trim();
  if (secreto) return String(req.headers?.authorization || "") === `Bearer ${secreto}`;
  return String(req.headers?.["user-agent"] || "").toLowerCase().includes("vercel-cron");
}

/**
 * El ultimo raspado de cada fuente.
 *
 * La importacion va aparte y no mezclada con el AutoScout24 español: son el
 * mismo portal pero dos flujos distintos, y el de importacion puede llevar
 * semanas parado mientras el otro corre. Agrupados, el bueno tapa al malo.
 */
const CONSULTA = `
  SELECT CASE WHEN COALESCE(country, 'ES') = 'DE' THEN portal || '-de' ELSE portal END AS fuente,
         MAX(scraped_at) AS ultimo,
         COUNT(*)::int   AS ofertas
    FROM moveadvisor_market_offers
   WHERE COALESCE(portal, '') <> ''
   GROUP BY 1`;

async function mandaElAviso(calladas) {
  const apiKey = process.env.RESEND_API_KEY;
  const destino = correoInterno();
  if (!apiKey || !destino) return false;

  const html = plantilla({
    titulo: "No está entrando catálogo",
    cuerpo: [
      parrafo(
        `Estas fuentes llevan más de ${DIAS_DE_SILENCIO} días sin raspar nada. ` +
        `Mientras no entren ofertas nuevas, las que hay se van vendiendo en su portal ` +
        `de origen y el catálogo enseña coches que ya no existen.`
      ),
      // Se señala cuál es la de importación: es la única que tiene un cliente
      // pagando una fianza al otro lado, así que no es una fila más.
      datos(calladas.map((c) => [
        c.fuente === IMPORTACION ? `${c.fuente} (importación)` : c.fuente,
        `${c.dias} días · el último, el ${c.ultimo.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`,
      ])),
      aviso(
        "Qué mirar",
        "En n8n: si el flujo está desactivado, si está fallando, o si el servidor se cayó."
      ),
    ].join(""),
  });

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente(),
      to: destino,
      subject: `${MARCA.nombre}: ${asuntoDelAviso(calladas)}`,
      html,
    }),
  });
  return r.ok;
}

module.exports = async function cronVigilaScrapers(req, res) {
  if (!autorizado(req)) return res.status(401).json({ error: "Unauthorized" });

  let filas = [];
  try {
    const r = await getPool().query(CONSULTA);
    filas = r.rows;
  } catch (e) {
    console.error("[vigila-scrapers] no se pudo consultar:", e.message);
    return res.status(500).json({ ok: false, error: "consulta_fallida" });
  }

  const calladas = fuentesCalladas(filas, new Date());

  // Sin nada que decir, no se dice nada. Es la mitad del valor del aviso.
  if (!calladas.length) {
    return res.status(200).json({ ok: true, calladas: 0, fuentes: filas.length });
  }

  console.warn("[vigila-scrapers] " + lineasDelAviso(calladas).join(" | "));
  const enviado = await mandaElAviso(calladas).catch((e) => {
    console.error("[vigila-scrapers] no se pudo avisar:", e.message);
    return false;
  });

  return res.status(200).json({
    ok: true,
    calladas: calladas.length,
    enviado,
    detalle: calladas.map((c) => ({ fuente: c.fuente, dias: c.dias })),
  });
};
