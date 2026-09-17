/**
 * El mandato que el cliente sube firmado desde su panel.
 *
 * ## Lo que había
 *
 * El correo del mandato le decía «puedes devolverlo firmado contestando a este
 * correo». Y entonces el papel se quedaba en una bandeja de entrada, y alguien
 * tenía que acordarse de entrar al ERP y marcar a mano que lo había firmado:
 * fecha y cómo nos consta.
 *
 * Mientras eso no pasara, el encargo decía «sin mandato firmado · no se le
 * puede facturar» **con el papel firmado ya en nuestro poder**. Y sin mandato
 * firmado no se le cobra nada, ni los 299 € si el coche se vende ni los 150 si
 * se va.
 *
 * ## Y por qué es mejor prueba
 *
 * De las cuatro maneras de que nos conste firmado, tres las escribimos
 * nosotros: «lo firmó delante», «nos mandó el papel», «lo aceptó por correo».
 * El día que alguien discuta una factura, lo único que hay es nuestra palabra.
 *
 * Con el documento subido hay documento. Por eso ésta es la que se le propone
 * en el correo, y la única que **no se puede marcar a mano** en el ERP: marcarla
 * sería decir que subió un papel que no está.
 *
 * ## Las dos cifras están escritas dos veces
 *
 * `DIAS_HASTA_SALIR_GRATIS` y el nombre de la firma viven en el ERP
 * (`apps/api/src/lib/`). Aquí están repetidos porque son dos repositorios que no
 * se pueden importar, y una prueba lee **el código del ERP** y los compara. Si
 * mañana el plazo cambia y solo se toca un lado, se cae.
 */

/** Los mismos que el ERP. La prueba los compara con su fichero. */
const DIAS_HASTA_SALIR_GRATIS = 30;

/** Cómo queda apuntado que lo firmó. Es el valor que el ERP entiende. */
const FIRMA_COMO = 'subido_por_el';

/** Dónde se guarda el documento, para que el ERP lo encuentre en la ficha. */
const AMBITO = 'encargo';
const PAPEL = 'mandato_firmado';

/**
 * Lo que se acepta.
 *
 * PDF, Word y fotos. Word está porque **el mandato se le manda como `.doc`**:
 * el ERP lo genera así para que se abra en Word y se pueda imprimir o rellenar.
 * Pedirle que lo devuelva en otro formato es pedirle una conversión, y eso es
 * justo donde la gente lo deja para luego.
 *
 * Las fotos, porque lo normal será que lo imprima, lo firme a mano y le haga
 * una foto con el móvil.
 */
const TIPOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf', 'text/rtf',
  'image/jpeg', 'image/png', 'image/heic', 'image/webp',
];

/**
 * Y por extensión, que es lo que de verdad aguanta.
 *
 * El navegador no siempre sabe decir el tipo de un `.doc`: unas veces manda
 * `application/msword`, otras `application/octet-stream` y otras nada. Peor
 * todavía con el nuestro — el mandato que le mandamos es HTML con extensión
 * `.doc`, para que Word lo abra, así que al devolvérnoslo tal cual puede llegar
 * como `text/html`.
 *
 * Rechazarle por eso el papel que acaba de firmar sería culparle de cómo su
 * sistema etiqueta un fichero. Vale con que una de las dos cosas encaje.
 */
const EXTENSIONES = [
  '.pdf', '.doc', '.docx', '.odt', '.rtf',
  '.jpg', '.jpeg', '.png', '.heic', '.webp',
];

function suExtension(nombre) {
  const n = String(nombre ?? '').trim().toLowerCase();
  const punto = n.lastIndexOf('.');
  return punto > 0 ? n.slice(punto) : '';
}

function esUnaExtensionQueVale(nombre) {
  return EXTENSIONES.includes(suExtension(nombre));
}

/**
 * Ocho megas, como el resto de adjuntos del ERP.
 *
 * Una foto de un móvil moderno pasa de cuatro con facilidad, y rechazarle el
 * papel por el tamaño después de haberlo firmado es la peor forma de perder un
 * mandato.
 */
const TAMANO_MAXIMO = 8 * 1024 * 1024;

function esUnTipoQueVale(tipo) {
  return TIPOS.includes(String(tipo ?? '').trim().toLowerCase());
}

/**
 * Su encargo pendiente de firma, buscado por su correo y su coche.
 *
 * Por el correo del cliente y no solo por el identificador: el identificador
 * viaja por la red y no prueba nada. Lo que autoriza a subir el mandato de un
 * encargo es ser el dueño de ese encargo.
 *
 * Y solo los que no están cerrados ni firmados: subir el papel dos veces no
 * puede reescribir la fecha de la primera, que es la que hace correr el plazo.
 */
const SQL_SU_ENCARGO = `
  SELECT e.id, e.mandato_id, e.acepto_el_precio, e.firmado_at, v.plate
    FROM erp_encargos_venta e
    LEFT JOIN moveadvisor_user_vehicles v ON v.id = e.vehicle_id
   WHERE e.id = $1
     AND lower(e.cliente_email) = lower($2)
     AND e.cerrado_at IS NULL`;

/**
 * Se marca firmado, con la fecha de ahora y el plazo arrancando.
 *
 * `libre_desde` sale de la publicación y solo si aceptó el precio: es lo que decide
 * si se le puede cobrar la cancelación. Va en la misma sentencia para que no
 * pueda quedar un encargo firmado sin plazo — dos escrituras separadas se
 * quedan a medias el día que una falle.
 *
 * Solo si no estaba firmado: la fecha que importa es la primera.
 */
const SQL_MARCA_FIRMADO = `
  UPDATE erp_encargos_venta
     SET firmado_at = NOW(),
         firma_como = '${FIRMA_COMO}',
         firma_nota = $2,
         -- Los 30 dias cuentan desde que se publica, no desde esta firma: sin
         -- publicar no corre nada, y publicar exige esta firma.
         libre_desde = CASE WHEN acepto_el_precio AND publicado_at IS NOT NULL
                            THEN publicado_at + INTERVAL '${DIAS_HASTA_SALIR_GRATIS} days'
                            ELSE NULL END,
         updated_at = NOW()
   WHERE id = $1 AND firmado_at IS NULL AND cerrado_at IS NULL
  RETURNING id, firmado_at, libre_desde`;

/** Y el documento queda guardado donde el ERP lo enseña. */
const SQL_GUARDA_DOCUMENTO = `
  INSERT INTO erp_documentos (ambito, ambito_id, papel, nombre, tipo, ruta, tamano, subido_por)
  VALUES ('${AMBITO}', $1, '${PAPEL}', $2, $3, $4, $5, $6)`;

/**
 * Qué falta para poder aceptar la subida, dicho para la pantalla.
 *
 * Devuelve el porqué y no un booleano: «no se puede subir» a secas hace que
 * vuelva a intentarlo con el mismo fichero.
 */
function porQueNoSePuedeSubir({ tipo, tamano, nombre } = {}) {
  // Con que encaje una de las dos vale: ver arriba por que el tipo no basta.
  if (!esUnTipoQueVale(tipo) && !esUnaExtensionQueVale(nombre)) {
    return 'Ese archivo no vale. Sube el mandato en PDF, Word o una foto del papel firmado.';
  }
  const n = Number(tamano);
  if (!Number.isFinite(n) || n <= 0) return 'El archivo está vacío.';
  if (n > TAMANO_MAXIMO) {
    return `El archivo pesa demasiado. El máximo son ${Math.round(TAMANO_MAXIMO / (1024 * 1024))} MB.`;
  }
  return '';
}

module.exports = {
  DIAS_HASTA_SALIR_GRATIS,
  FIRMA_COMO,
  AMBITO,
  PAPEL,
  TIPOS,
  EXTENSIONES,
  TAMANO_MAXIMO,
  esUnTipoQueVale,
  esUnaExtensionQueVale,
  porQueNoSePuedeSubir,
  SQL_SU_ENCARGO,
  SQL_MARCA_FIRMADO,
  SQL_GUARDA_DOCUMENTO,
};
