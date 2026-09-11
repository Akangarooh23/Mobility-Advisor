/**
 * Las puertas del encargo, contadas al cliente.
 *
 * Lo que se protege son dos cosas distintas. Una, que el semáforo diga lo
 * mismo que el del ERP: si el cliente lee «ya está» mientras el ERP dice que
 * falta la ITV, es peor que no enseñarle nada. Y dos, que cada puerta cerrada
 * diga **dónde** se hace — una lista que dice «falta la ITV» sin decir dónde
 * subirla es la mitad del problema.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  FOTOS_MINIMAS, FRANJAS_MINIMAS, DIAS_DE_FRANJAS, PAPELES_DEL_COCHE, INFORME_HECHO,
  franjasQueValen, lasPuertas, cuantasLeFaltan, aDondeSeHace,
} = require('./puertas-del-encargo');

/** Un coche al que no le falta nada. */
const enHora = (d) => new Date(Date.now() + d * 24 * 3600 * 1000).toISOString();
const COMPLETO = {
  matricula: '8888LXR', marca: 'Volkswagen', modelo: 'T-Roc', ano: 2022, kilometros: 60000,
  fotos: 6,
  papeles: ['circulation_permit', 'technical_sheet', 'itv'],
  tasacion: 18500,
  informe: 'informe_listo',
  franjas: [1, 2, 3, 4, 5, 6].map((d) => enHora(d)),
};

const porClave = (p, clave) => p.find((x) => x.clave === clave);

describe('el semáforo', () => {
  test('con todo hecho, las cinco abiertas', () => {
    const p = lasPuertas(COMPLETO);
    assert.equal(p.length, 5);
    assert.deepEqual(p.filter((x) => !x.abierta), []);
    assert.equal(cuantasLeFaltan(p), 0);
  });

  test('y se devuelven las cinco aunque estén cerradas', () => {
    /*
     * Enseñarle solo lo que falta convierte cada avance en una lista que se
     * acorta sin decir hacia dónde. La lista entera es lo que le dice cuánto
     * le queda.
     */
    const p = lasPuertas({});
    assert.equal(p.length, 5);
    assert.equal(cuantasLeFaltan(p), 5);
  });

  test('le faltan fotos y lo dice en plural o singular', () => {
    assert.match(porClave(lasPuertas({ ...COMPLETO, fotos: 5 }), 'idcar').falta, /1 foto\b/);
    assert.match(porClave(lasPuertas({ ...COMPLETO, fotos: 4 }), 'idcar').falta, /2 fotos/);
  });

  test('los papeles que faltan salen por su nombre', () => {
    const p = porClave(lasPuertas({ ...COMPLETO, papeles: ['itv'] }), 'papeles');
    assert.equal(p.abierta, false);
    assert.match(p.falta, /el permiso de circulación y la ficha técnica/);
  });

  test('una tasación a cero no es una tasación', () => {
    // Alguien que empezó el cuestionario y lo dejó. Tomarlo por un precio sería
    // publicar un número que no ha dicho nadie.
    assert.equal(porClave(lasPuertas({ ...COMPLETO, tasacion: 0 }), 'tasacion').abierta, false);
  });

  test('el informe a medias se distingue del que no empezó', () => {
    assert.match(porClave(lasPuertas({ ...COMPLETO, informe: 'capturando' }), 'informe').falta, /a medias/);
    assert.match(porClave(lasPuertas({ ...COMPLETO, informe: null }), 'informe').falta, /sin hacer/);
  });

  test('las franjas de más allá del plazo no cuentan', () => {
    const lejos = [20, 21, 22, 23, 24, 25].map((d) => enHora(d));
    assert.equal(porClave(lasPuertas({ ...COMPLETO, franjas: lejos }), 'franjas').abierta, false);
  });

  test('ni las de fecha ilegible', () => {
    assert.equal(franjasQueValen(['esto no es una fecha', enHora(1)]), 1);
  });
});

describe('cada puerta cerrada dice dónde se hace', () => {
  test('todas las cerradas llevan a algún sitio', () => {
    const p = lasPuertas({});
    for (const x of p.filter((y) => !y.abierta)) {
      assert.ok(x.donde, `«${x.nombre}» no dice dónde se hace`);
      assert.ok(x.donde.url.startsWith('/panel/'), x.donde.url);
      assert.ok(x.donde.texto.trim(), `«${x.nombre}» sin texto de enlace`);
    }
  });

  test('y la abierta no lleva a ninguno', () => {
    // Un enlace para algo que ya está hecho invita a volver a hacerlo.
    for (const x of lasPuertas(COMPLETO)) assert.equal(x.donde, null);
  });

  test('el enlace lleva la matrícula, para quien tiene tres coches', () => {
    const p = porClave(lasPuertas({ ...COMPLETO, papeles: [] }), 'papeles');
    assert.match(p.donde.url, /matricula=8888LXR/);
  });

  test('y cada una a su sitio, no todas al mismo', () => {
    /*
     * Mandarle a la página y que busque la sección es lo mismo que no decirle
     * dónde. Si dos puertas apuntaran al mismo ancla, una de las dos estaría
     * mintiendo.
     */
    const anclas = ['idcar', 'papeles', 'tasacion', 'informe', 'franjas']
      .map((c) => aDondeSeHace(c, '8888LXR').url);
    assert.equal(new Set(anclas).size, anclas.length, anclas.join('\n'));
  });

  test('sin matrícula el enlace sigue siendo válido', () => {
    // Un coche recién creado no la tiene todavía, y el enlace tiene que llevar
    // igual: es justamente el que va a ponerla.
    assert.equal(aDondeSeHace('papeles', null).url, '/panel/vehiculos#documentos');
  });
});

/**
 * Y que digan lo mismo que el ERP.
 *
 * El cálculo de verdad vive allí. Aquí está repetido porque son dos
 * repositorios que no se pueden importar. Esta prueba lee **su código** —no una
 * copia escrita a mano, que se quedaría vieja igual— y compara los números.
 *
 * Si el ERP no está al lado, no se puede comparar y se dice. Solo se anda con
 * esto en la máquina donde están los dos, que es donde se cambian.
 */
describe('no se separa del ERP', () => {
  const ERP = path.join(
    __dirname, '..', '..', 'carswise-erp-backoffice',
    'apps', 'api', 'src', 'lib', 'encargo-de-venta.ts'
  );
  const hayErp = fs.existsSync(ERP);
  const fuente = hayErp ? fs.readFileSync(ERP, 'utf8') : '';

  const numeroDeAlla = (nombre) => {
    const m = fuente.match(new RegExp(`export const ${nombre} = (\\d+)`));
    assert.ok(m, `no encuentro ${nombre} en el ERP`);
    return Number(m[1]);
  };
  /*
   * El `(?::[^=]*)?` es por la anotación de tipo: allí `LAS_PUERTAS` se declara
   * como `export const LAS_PUERTAS: Puerta['clave'][] = [...]`, y sin esto la
   * prueba no encontraba la constante y fallaba diciendo que no existe — que es
   * justo lo que no pasaba.
   */
  const listaDeAlla = (nombre) => {
    const m = fuente.match(new RegExp(`export const ${nombre}(?::[^=]*)? = \\[([^\\]]*)\\]`));
    assert.ok(m, `no encuentro ${nombre} en el ERP`);
    return m[1].split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean);
  };

  test(hayErp ? 'los números son los suyos' : 'los números son los suyos (SIN COMPROBAR: el ERP no está al lado)', (t) => {
    if (!hayErp) return t.skip(`no está ${ERP}`);
    assert.equal(FOTOS_MINIMAS, numeroDeAlla('FOTOS_MINIMAS'));
    assert.equal(FRANJAS_MINIMAS, numeroDeAlla('FRANJAS_MINIMAS'));
    assert.equal(DIAS_DE_FRANJAS, numeroDeAlla('DIAS_DE_FRANJAS'));
  });

  test('y las listas también', (t) => {
    if (!hayErp) return t.skip(`no está ${ERP}`);
    assert.deepEqual(PAPELES_DEL_COCHE, listaDeAlla('PAPELES_DEL_COCHE'));
    assert.deepEqual(INFORME_HECHO, listaDeAlla('INFORME_HECHO'));
  });

  test('y las cinco puertas son las mismas y en el mismo orden', (t) => {
    if (!hayErp) return t.skip(`no está ${ERP}`);
    const suyas = listaDeAlla('LAS_PUERTAS');
    assert.deepEqual(lasPuertas({}).map((p) => p.clave), suyas);
  });
});
