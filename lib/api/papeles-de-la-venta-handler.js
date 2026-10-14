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
const { elPoolObligatorio } = require("../postgres");
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
/**
 * Y lo que le abramos a mano, papel a papel.
 *
 * La lista cerrada de arriba no cubre el caso que aparece con la peritación a
 * domicilio: el **informe del perito**. Lo ha pagado él, es lo que justifica
 * el precio que le vamos a proponer, y enseñárselo hace la conversación del
 * precio mucho más fácil.
 *
 * Pero no se puede abrir la categoría entera: de la misma visita cuelga el
 * informe que se le enseña y el presupuesto interno de la reparación, que no.
 * Así que lo que manda es una marca **por documento**, que pone una persona
 * desde el ERP. Sin marcar, nada se ve: lo contrario de la lista cerrada, que
 * sería abrir el cajón y confiar en que nadie guarde ahí algo que no toca.
 *
 * ## Por qué se lee con `to_jsonb` y no con `d.visible_cliente`
 *
 * Para que esto funcione **antes** de que la columna exista. Si se nombrara
 * directamente, Postgres rechazaría la consulta entera —mira la frase antes
 * de ejecutarla— y el cliente se quedaría sin ver ni su mandato, que lleva
 * funcionando desde septiembre, por una columna que no usa.
 *
 * Esta mañana pasó justo eso en el ERP con `perito_email`: el guardado de la
 * revisión fallaba por una columna que ni se estaba tocando. Sin la columna,
 * esto devuelve NULL, nada sale marcado, y la lista cerrada sigue intacta.
 */
const SQL_SUS_PAPELES = `
  WITH mios AS (
    SELECT e.id AS encargo_id, e.vehicle_id
      FROM erp_encargos_venta e
      LEFT JOIN moveadvisor_user_vehicles v ON v.id = e.vehicle_id
     WHERE lower(e.cliente_email) = lower($1)
       AND ($2 = '' OR e.vehicle_id = $2 OR upper(replace(COALESCE(v.plate, ''), ' ', '')) = upper(replace($2, ' ', '')))
  )
  SELECT d.id, d.nombre, d.papel, d.ruta, d.created_at, d.ambito
    FROM erp_documentos d
    JOIN mios m ON m.encargo_id = d.ambito_id
   WHERE d.ambito = 'encargo'
     AND (d.papel = ANY($3) OR to_jsonb(d)->>'visible_cliente' = 'true')

  UNION ALL

  /*
   * Los de la visita que le hemos abierto.
   *
   * Aquí NO hay lista cerrada que valga: de una revisión no hay ningún papel
   * que sea suyo por defecto. O está marcado, o no existe para él.
   */
  SELECT d.id, d.nombre, d.papel, d.ruta, d.created_at, d.ambito
    FROM erp_documentos d
    JOIN erp_revisiones_taller r ON r.id = d.ambito_id
    JOIN mios m ON m.vehicle_id = r.vehicle_id
   WHERE d.ambito = 'revision'
     AND to_jsonb(d)->>'visible_cliente' = 'true'

   ORDER BY created_at DESC`;

let _pool = null;
function getPool() {
  return elPoolObligatorio();
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
            /*
             * Cómo se le llama a cada papel.
             *
             * Los dos que firma él tienen su nombre escrito aquí. Los que le
             * abrimos a mano llevan el que eligió quien lo subió —«Informe de
             * la revisión»—, que es mejor que «Documento» y lo escribió una
             * persona. Y si ni eso, «Documento», que al menos no miente.
             */
            que_es: LOS_SUYOS[r.papel] || String(r.papel || "").trim() || "Documento",
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
