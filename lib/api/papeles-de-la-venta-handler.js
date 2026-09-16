"use strict";

/**
 * Los papeles firmados de su encargo, para que pueda volver a bajárselos.
 *
 * Firma el mandato y la aceptación del precio, los sube, y desaparecen: se
 * guardan en el cajón privado y los enseña el ERP, que es nuestro. Del suyo no
 * queda copia — y son los dos papeles que dicen qué ha aceptado y por cuánto
 * sale su coche.
 *
 * Que el cliente no tenga acceso a lo que ha firmado es el tipo de detalle que
 * no se nota hasta el día que discute una factura. Y ese día lo tiene todo
 * nuestro y nada suyo.
 *
 * ## Por qué una URL firmada y no el fichero
 *
 * El cajón privado no tiene dirección pública: esa es toda la gracia. Se
 * comprueba aquí que el papel es suyo y se le da una dirección que caduca en
 * cinco minutos. Servir el fichero desde aquí obligaría a pasar megas por la
 * función, y dejarlo en el cajón público lo haría alcanzable por cualquiera con
 * el enlace.
 */
const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../postgres-ssl");
const { urlFirmada } = require("../supabaseStorage");
const { identidadDeLaPeticion } = require("./identidad");

/**
 * Los papeles que se le enseñan, y solo estos.
 *
 * Los dos que firma él. En `erp_documentos` hay más cosas colgando del
 * encargo —notas nuestras, lo que suba quien lleva el expediente— y eso no es
 * suyo: una lista abierta acabaría enseñándole cualquier cosa que alguien
 * guarde ahí mañana.
 */
const LOS_SUYOS = {
  mandato_firmado: "El mandato firmado",
  clausula_precio_firmada: "El precio de salida firmado",
};

/**
 * Sus papeles, buscados por su correo.
 *
 * Por el correo del cliente y no por el identificador del encargo: el
 * identificador viaja por la red y no prueba nada.
 */
const SQL_SUS_PAPELES = `
  SELECT d.id, d.nombre, d.papel, d.ruta, d.created_at
    FROM erp_documentos d
    JOIN erp_encargos_venta e ON e.id = d.ambito_id
    LEFT JOIN moveadvisor_user_vehicles v ON v.id = e.vehicle_id
   WHERE d.ambito = 'encargo'
     AND d.papel = ANY($3)
     AND lower(e.cliente_email) = lower($1)
     AND ($2 = '' OR e.vehicle_id = $2 OR upper(replace(COALESCE(v.plate, ''), ' ', '')) = upper(replace($2, ' ', '')))
   ORDER BY d.created_at DESC`;

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 5, ssl: SSL_POSTGRES });
  }
  return _pool;
}

module.exports = async function papelesDeLaVentaHandler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { email } = await identidadDeLaPeticion(req);
  if (!email) {
    return res.status(401).json({ ok: false, error: "Inicia sesión para ver tus papeles." });
  }

  const coche = String(req.query?.coche || "").trim();
  const cual = String(req.query?.id || "").trim();

  try {
    const { rows } = await getPool().query(SQL_SUS_PAPELES, [email, coche, Object.keys(LOS_SUYOS)]);

    /*
     * Sin `id` se devuelve la lista; con `id`, se le manda a su fichero.
     *
     * La comprobación es la misma en los dos casos: la consulta ya filtra por su
     * correo, así que un identificador que no sea suyo sencillamente no aparece.
     */
    if (!cual) {
      return res.status(200).json({
        ok: true,
        data: {
          papeles: rows.map((r) => ({
            id: String(r.id),
            nombre: String(r.nombre || ""),
            que_es: LOS_SUYOS[r.papel] || "Documento",
            cuando: r.created_at ? new Date(r.created_at).toISOString() : "",
          })),
        },
      });
    }

    const suyo = rows.find((r) => String(r.id) === cual);
    if (!suyo) {
      return res.status(404).json({ ok: false, error: "No encontramos ese documento." });
    }

    const url = await urlFirmada(String(suyo.ruta || ""), 300);
    if (!url) {
      return res.status(502).json({ ok: false, error: "No hemos podido preparar la descarga." });
    }
    res.setHeader("Location", url);
    return res.status(302).end();
  } catch (e) {
    console.error("[papeles-venta]", e.message);
    return res.status(500).json({ ok: false, error: "No se han podido leer tus papeles." });
  }
};

module.exports.LOS_SUYOS = LOS_SUYOS;
module.exports.SQL_SUS_PAPELES = SQL_SUS_PAPELES;
