/**
 * Lo que le falta al cliente para que podamos vender su coche, contado a él.
 *
 * ## Por qué existe
 *
 * El ERP ya sabía esto: en el encargo salen las cinco puertas con su semáforo y
 * qué falta en cada una. El cliente no veía nada. Se enteraba de lo que le
 * faltaba **cuando le llamábamos**, que es tarde y es caro: la llamada se gasta
 * en leerle una lista que podía haber leído él.
 *
 * Así que son las mismas cinco puertas, con las mismas reglas, y además dicen
 * **dónde se hace cada una**. Una lista que dice «falta la ITV» y no dice dónde
 * subirla es la mitad del problema.
 *
 * ## Las reglas están escritas dos veces, y hay una prueba que lo vigila
 *
 * El cálculo de verdad vive en el ERP (`apps/api/src/lib/encargo-de-venta.ts`).
 * Aquí está repetido porque son dos repositorios y no se pueden importar el uno
 * al otro. Es la misma disciplina que `lib/marca.js` con `src/marca.js`: dos
 * copias y una prueba que las compara.
 *
 * La prueba lee los números **del código del ERP**, no de una lista escrita a
 * mano. Si mañana se piden ocho fotos y solo se cambia un lado, se cae. Sin eso,
 * el cliente vería «ya está» mientras el ERP dice que falta, que es peor que no
 * enseñarle nada.
 *
 * ## Lo que cambia respecto al ERP: cómo se dice
 *
 * El ERP escribe para nosotros —«No se la ha hecho»— y esto escribe para él
 * —«No te la has hecho»—. El semáforo es el mismo; el texto no puede serlo. Un
 * panel que le habla del cliente en tercera persona se lee como un error.
 */

/** Las mismas que el ERP. La prueba las compara con su fichero. */
const FOTOS_MINIMAS = 6;
const FRANJAS_MINIMAS = 6;
const DIAS_DE_FRANJAS = 14;
const PAPELES_DEL_COCHE = ['circulation_permit', 'technical_sheet', 'itv'];
const INFORME_HECHO = ['informe_listo', 'verificada', 'publicada'];

/** Cómo se llama cada papel cuando se le pide a él. */
const COMO_SE_LLAMAN = {
  circulation_permit: 'el permiso de circulación',
  technical_sheet: 'la ficha técnica',
  itv: 'la ITV',
};

const hayAlgo = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/** «la matrícula, el año y 2 fotos» */
function enLista(cosas) {
  if (cosas.length === 1) return cosas[0];
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/** Cuántas franjas suyas caen dentro del plazo. Igual que el ERP. */
function franjasQueValen(franjas, ahora = new Date()) {
  const hasta = new Date(ahora);
  hasta.setDate(hasta.getDate() + DIAS_DE_FRANJAS);
  return (franjas || []).filter((f) => {
    const d = new Date(f);
    // Una fecha ilegible no cuenta: no se puede citar a nadie a una hora que no
    // se sabe cuál es.
    if (Number.isNaN(d.getTime())) return false;
    return d > ahora && d <= hasta;
  }).length;
}

/**
 * A dónde se va a hacer cada cosa.
 *
 * Con la matrícula dentro, porque quien tiene tres coches en el garaje llega a
 * la lista y no sabe cuál de los tres es el del encargo. El ancla dice además
 * qué parte de la ficha abrir: mandarle a la página y que la busque es lo mismo
 * que no decirle dónde.
 */
function aDondeSeHace(clave, matricula) {
  const suyo = matricula ? `?matricula=${encodeURIComponent(matricula)}` : '';
  const enSuCoche = (ancla, texto) => ({ texto, url: `/panel/vehiculos${suyo}#${ancla}` });
  switch (clave) {
    case 'idcar':    return enSuCoche('datos', 'Completar la ficha y las fotos');
    case 'papeles':  return enSuCoche('documentos', 'Subir los documentos');
    case 'tasacion': return { texto: 'Hacer la tasación gratuita', url: `/panel/tasaciones${suyo}` };
    case 'informe':  return enSuCoche('informe', 'Hacer el informe de estado');
    case 'franjas':  return enSuCoche('franjas', 'Elegir cuándo puedes enseñarlo');
    default:         return null;
  }
}

/**
 * Las cinco puertas, tal y como se le enseñan a él.
 *
 * Se devuelven **siempre las cinco**, abiertas o no. La lista entera con su
 * semáforo es lo que le dice cuánto le queda; enseñarle solo lo que falta
 * convierte cada avance en una lista que se acorta sin decir hacia dónde.
 */
function lasPuertas(hay, ahora = new Date()) {
  const faltaDelCoche = [
    hayAlgo(hay.matricula) ? '' : 'la matrícula',
    hayAlgo(hay.marca) ? '' : 'la marca',
    hayAlgo(hay.modelo) ? '' : 'el modelo',
    hayAlgo(hay.ano) ? '' : 'el año',
    hayAlgo(hay.kilometros) ? '' : 'los kilómetros',
  ].filter(Boolean);

  const fotos = Number(hay.fotos || 0);
  if (fotos < FOTOS_MINIMAS) {
    const quedan = FOTOS_MINIMAS - fotos;
    faltaDelCoche.push(`${quedan} foto${quedan === 1 ? '' : 's'}`);
  }

  const tiene = new Set(hay.papeles || []);
  const faltanPapeles = PAPELES_DEL_COCHE.filter((p) => !tiene.has(p)).map((p) => COMO_SE_LLAMAN[p]);

  const libres = franjasQueValen(hay.franjas, ahora);
  const empezoElInforme = hayAlgo(hay.informe);

  const puertas = [
    {
      clave: 'idcar',
      nombre: 'El coche',
      abierta: faltaDelCoche.length === 0,
      falta: faltaDelCoche.length ? `Te falta ${enLista(faltaDelCoche)}` : '',
    },
    {
      clave: 'papeles',
      nombre: 'Los papeles',
      abierta: faltanPapeles.length === 0,
      falta: faltanPapeles.length ? `Te falta ${enLista(faltanPapeles)}` : '',
    },
    {
      clave: 'tasacion',
      nombre: 'La tasación',
      abierta: Number(hay.tasacion || 0) > 0,
      falta: 'No te la has hecho todavía. Es gratis y se hace desde aquí',
    },
    {
      clave: 'informe',
      nombre: 'El informe de estado',
      abierta: INFORME_HECHO.includes(String(hay.informe || '').trim()),
      falta: empezoElInforme ? 'Lo empezaste y quedó a medias' : 'Está sin hacer. Son fotos guiadas desde el móvil',
    },
    {
      clave: 'franjas',
      nombre: 'Las franjas de visita',
      abierta: libres >= FRANJAS_MINIMAS,
      falta: `Tienes ${libres} de ${FRANJAS_MINIMAS} en los próximos ${DIAS_DE_FRANJAS} días`,
    },
  ];

  return puertas.map((p) => ({
    ...p,
    // La abierta no lleva a ningún sitio: un enlace para algo que ya está hecho
    // invita a volver a hacerlo.
    donde: p.abierta ? null : aDondeSeHace(p.clave, hay.matricula),
  }));
}

/** Cuántas le quedan. Es el número de la campana y el del resumen. */
function cuantasLeFaltan(puertas) {
  return (puertas || []).filter((p) => !p.abierta).length;
}

/**
 * Lo que hay de su coche, de la base.
 *
 * Las seis consultas son las del ERP y en el mismo orden, para que se puedan
 * comparar de un vistazo. Cada una se traga su fallo: que falte una tabla no
 * puede dejar al cliente sin panel, y una puerta sin datos sale cerrada, que es
 * el lado prudente — le pide algo que a lo mejor ya tiene, en vez de decirle
 * que está listo cuando no lo está.
 */
async function loQueHayDe(pool, vehicleId) {
  const pide = async (sql, args, siFalla) => {
    try {
      return await pool.query(sql, args);
    } catch {
      return { rows: siFalla || [] };
    }
  };

  const coche = await pide(
    `SELECT plate, brand, model, year, mileage
       FROM moveadvisor_user_vehicles WHERE id = $1`,
    [vehicleId]
  );
  const fotos = await pide(
    `SELECT COUNT(*)::int AS n FROM moveadvisor_user_vehicle_files
      WHERE vehicle_id = $1 AND file_type = 'photo' AND COALESCE(file_url, '') <> ''`,
    [vehicleId], [{ n: 0 }]
  );
  const papeles = await pide(
    `SELECT DISTINCT document_type FROM moveadvisor_user_vehicle_documents
      WHERE vehicle_id = $1`,
    [vehicleId]
  );
  const informe = await pide(
    `SELECT status FROM moveadvisor_vehicle_condition_reports
      WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [vehicleId]
  );
  const tasacion = await pide(
    `SELECT estimate_value FROM moveadvisor_user_valuations
      WHERE vehicle_id = $1 AND COALESCE(estimate_value, 0) > 0
      ORDER BY created_at DESC LIMIT 1`,
    [vehicleId]
  );
  const franjas = await pide(
    `SELECT starts_at FROM vehicle_visit_availability
      WHERE offer_id = $1 AND status = 'available' AND starts_at > NOW()`,
    [`idcar-${vehicleId}`]
  );

  const v = coche.rows[0] || {};
  return {
    matricula: v.plate || null,
    marca: v.brand || null,
    modelo: v.model || null,
    ano: v.year || null,
    kilometros: v.mileage || null,
    fotos: (fotos.rows[0] && fotos.rows[0].n) || 0,
    papeles: papeles.rows.map((r) => String(r.document_type)),
    tasacion: Number((tasacion.rows[0] || {}).estimate_value || 0) || null,
    informe: (informe.rows[0] || {}).status || null,
    franjas: franjas.rows.map((r) => new Date(r.starts_at).toISOString()),
  };
}

module.exports = {
  FOTOS_MINIMAS,
  FRANJAS_MINIMAS,
  DIAS_DE_FRANJAS,
  PAPELES_DEL_COCHE,
  INFORME_HECHO,
  franjasQueValen,
  aDondeSeHace,
  lasPuertas,
  cuantasLeFaltan,
  loQueHayDe,
};
