"use strict";

/**
 * El cliente elige cómo se hace la peritación y dice cuándo puede.
 *
 * Hasta ahora solo había una manera: alguien de Operaciones le daba cita en un
 * taller de la red y se lo decía por correo. Eso deja fuera a quien no puede
 * mover el coche, y mete por medio un desplazamiento que retrasa su anuncio —
 * entre cuadrar la hora con el taller y que él pueda ir se van días en los que,
 * para él, no se mueve nada.
 *
 * Aquí elige: llevarlo a un taller, o que vaya un perito a su dirección. Y si
 * elige lo segundo, propone hasta tres franjas.
 *
 * ## Lo que esto NO hace
 *
 * **No confirma la hora.** La agenda del perito es nuestra: él propone y
 * confirmamos nosotros. Darle por buena la franja que elija sería prometer una
 * hora que después se mueve, que es peor que tardar un día en confirmarla.
 *
 * **No cancela la peritación.** Sigue siendo obligatoria para publicar, y
 * quitarla desde aquí dejaría un encargo que no puede avanzar sin que nadie se
 * entere. La misma regla que `cita-del-taller-handler`.
 *
 * ## Por qué escribe en la tabla del ERP
 *
 * Porque es la misma peritación. Lo que abre la puerta de publicar es una fila
 * de `erp_revisiones_taller` y una sola función que la lee; si lo que pide el
 * cliente viviera en otra tabla habría que bifurcar esa puerta, y por ahí es
 * por donde un día sale publicado un coche sin comprobar. Es lo mismo que ya
 * hace el manejador de «no puedo ir ese día».
 */
const { elPoolObligatorio } = require("../postgres");
const { identidadDeLaPeticion } = require("./identidad");

/** Dónde se hace. Gemelo del `MODALIDADES` del ERP. */
const MODALIDADES = ["en_taller", "a_domicilio"];

/**
 * Cuántas franjas se le piden.
 *
 * Tres. Con una, cualquier choque con la agenda del perito obliga a llamarle;
 * con diez, elegir deja de ser elegir y nadie las rellena.
 */
const CUANTAS_FRANJAS = 3;

/** Lo lejos que puede proponer. Más allá no es una cita, es una intención. */
const DIAS_POR_DELANTE = 60;

/** Lo que cabe como dirección. Más que esto es otra cosa. */
const LARGO_DE_LA_DIRECCION = 300;

let _pool = null;
function getPool() {
  return elPoolObligatorio();
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") { try { return JSON.parse(body); } catch { return {}; } }
  return body;
}

function nt(v) {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

/**
 * Las franjas que valen.
 *
 * Una fecha ilegible, una que ya pasó o una a un año vista no son franjas: son
 * un formulario mal rellenado. Se quitan en vez de guardarse, porque una franja
 * mala en la lista hace que quien tiene que elegir dude de las otras dos.
 *
 * Y se quitan las repetidas aquí además de en el índice: así el cliente recibe
 * de vuelta lo que de verdad se ha guardado.
 */
function lasFranjasQueValen(horas, ahora = new Date()) {
  const tope = new Date(ahora.getTime() + DIAS_POR_DELANTE * 86400000);
  const vistas = new Set();
  const buenas = [];
  for (const h of Array.isArray(horas) ? horas : []) {
    const cuando = new Date(nt(h));
    if (Number.isNaN(cuando.getTime())) continue;
    if (cuando <= ahora || cuando > tope) continue;
    const iso = cuando.toISOString();
    if (vistas.has(iso)) continue;
    vistas.add(iso);
    buenas.push(iso);
    if (buenas.length >= CUANTAS_FRANJAS) break;
  }
  return buenas;
}

/**
 * Su coche, su encargo y su revisión si ya la hay.
 *
 * Por el correo de la sesión y no por el identificador del coche: el
 * identificador viaja por la red y no prueba nada. Sin encargo abierto no hay
 * peritación que pedir — es nuestra parte de un encargo de venta, no un
 * servicio suelto.
 */
const SQL_LO_SUYO = `
  SELECT e.id AS encargo_id,
         (SELECT r.id FROM erp_revisiones_taller r
           WHERE r.vehicle_id = v.id AND r.estado <> 'Hecha'
           ORDER BY r.created_at DESC LIMIT 1) AS revision_id,
         (SELECT r.cita_at FROM erp_revisiones_taller r
           WHERE r.vehicle_id = v.id AND r.estado <> 'Hecha'
           ORDER BY r.created_at DESC LIMIT 1) AS cita_at
    FROM moveadvisor_user_vehicles v
    JOIN erp_encargos_venta e ON e.vehicle_id = v.id AND e.cerrado_at IS NULL
   WHERE v.id = $1 AND lower(v.user_email) = $2
   ORDER BY e.created_at DESC
   LIMIT 1`;

module.exports = async function peritacionHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const { email } = await identidadDeLaPeticion(req, { cuerpo: body });
  if (!email) {
    return res.status(401).json({ ok: false, error: "Inicia sesión para pedir la peritación." });
  }

  const vehicleId = nt(body.vehicle_id);
  const modalidad = nt(body.modalidad).toLowerCase();
  const direccion = nt(body.direccion).slice(0, LARGO_DE_LA_DIRECCION);

  if (!vehicleId) {
    return res.status(400).json({ ok: false, error: "Falta de qué coche es." });
  }
  if (!MODALIDADES.includes(modalidad)) {
    return res.status(400).json({ ok: false, error: "No sabemos dónde quieres hacerla." });
  }

  const franjas = modalidad === "a_domicilio" ? lasFranjasQueValen(body.horas) : [];
  if (modalidad === "a_domicilio" && !direccion) {
    return res.status(400).json({ ok: false, error: "Dinos en qué dirección está el coche." });
  }
  if (modalidad === "a_domicilio" && !franjas.length) {
    return res.status(400).json({ ok: false, error: "Dinos al menos una hora a la que puedas." });
  }

  const pool = getPool();
  try {
    const suyo = (await pool.query(SQL_LO_SUYO, [vehicleId, email.toLowerCase()])).rows[0];
    if (!suyo) {
      // O el coche no es suyo, o no tiene encargo abierto. No se dice cuál:
      // al que prueba con el identificador de otro no se le confirma nada.
      return res.status(404).json({ ok: false, error: "No encontramos ese encargo." });
    }

    /*
     * Con la hora ya confirmada, esto no la mueve.
     *
     * Cambiar de idea cuando ya hay perito y hora avisada no es elegir
     * modalidad: es pedir que se cambie la cita, y para eso está el otro
     * camino —el de «no puedo ese día»—, que deja aviso a quien la atiende.
     */
    if (suyo.cita_at) {
      return res.status(409).json({
        ok: false,
        error: "Ya tienes día para la peritación. Si no te viene bien, pídenos cambiarla.",
        ya_tiene_cita: true,
      });
    }

    let revisionId = suyo.revision_id;
    if (!revisionId) {
      /*
       * La fila nace aquí, con lo que él ha elegido.
       *
       * Antes solo nacía cuando Operaciones daba la cita. Si el cliente puede
       * pedirla, la fila tiene que existir desde que la pide: es lo que hace
       * que salga en la lista de lo que nos toca hacer.
       */
      revisionId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await pool.query(
        `INSERT INTO erp_revisiones_taller
           (id, vehicle_id, encargo_id, estado, modalidad, direccion, creado_por)
         VALUES ($1, $2, $3, 'Por llevar', $4, $5, 'el cliente')`,
        [revisionId, vehicleId, suyo.encargo_id, modalidad, direccion]
      );
    } else {
      await pool.query(
        `UPDATE erp_revisiones_taller
            SET modalidad = $2, direccion = $3, updated_at = NOW()
          WHERE id = $1`,
        [revisionId, modalidad, direccion]
      );
    }

    /*
     * Las franjas se reemplazan, no se acumulan.
     *
     * Volver a mandarlas es corregirse —«el martes no, el miércoles»—, y si se
     * añadieran, quien tiene que elegir una vería las descartadas mezcladas
     * con las buenas sin saber cuáles son cuáles.
     */
    await pool.query(
      `DELETE FROM erp_revisiones_taller_horas WHERE revision_id = $1 AND la_puso = 'cliente'`,
      [revisionId]
    );
    for (const cuando of franjas) {
      await pool.query(
        `INSERT INTO erp_revisiones_taller_horas (revision_id, empieza_at, la_puso)
         VALUES ($1, $2, 'cliente')
         ON CONFLICT DO NOTHING`,
        [revisionId, cuando]
      );
    }

    return res.status(200).json({
      ok: true,
      data: { modalidad, direccion, horas: franjas },
    });
  } catch (err) {
    console.error("[peritacion]", err?.message);
    return res.status(500).json({ ok: false, error: "No hemos podido guardarlo. Prueba otra vez." });
  }
};

module.exports.MODALIDADES = MODALIDADES;
module.exports.CUANTAS_FRANJAS = CUANTAS_FRANJAS;
module.exports.DIAS_POR_DELANTE = DIAS_POR_DELANTE;
module.exports.lasFranjasQueValen = lasFranjasQueValen;
