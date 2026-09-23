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
  LAS_OPCIONALES,
  franjasQueValen, lasPuertas, cuantasLeFaltan, aDondeSeHace, loQueHayDe,
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
  seguros: 1,
  mantenimientos: 1,
};

/* Cuantas son. Se cuenta de la propia lista para que no se quede vieja sola. */
const CUANTAS = lasPuertas({}).length;
/* Y cuáles son, sacadas de la lista de verdad y no escritas a mano: una lista
   escrita aparte deja fuera a la puerta nueva sin que nadie se entere. */
const TODAS_LAS_CLAVES = lasPuertas({}).map((p) => p.clave);

const porClave = (p, clave) => p.find((x) => x.clave === clave);

describe('el semáforo', () => {
  test('con todo hecho, todas abiertas', () => {
    const p = lasPuertas(COMPLETO);
    assert.equal(p.length, CUANTAS);
    assert.deepEqual(p.filter((x) => !x.abierta), []);
    assert.equal(cuantasLeFaltan(p), 0);
  });

  test('y se devuelven todas aunque estén cerradas', () => {
    /*
     * Enseñarle solo lo que falta convierte cada avance en una lista que se
     * acorta sin decir hacia dónde. La lista entera es lo que le dice cuánto
     * le queda.
     */
    const p = lasPuertas({});
    assert.equal(p.length, CUANTAS);
    /*
     * Pero el contador cuenta lo que para el anuncio, no las filas.
     *
     * El seguro y el historial de revisiones se le piden y salen en la lista;
     * lo que no hacen es impedir publicar. Contándolos, el panel le decía «te
     * quedan 4 cosas para que podamos publicarlo» metiendo dentro una factura
     * de hace tres años que no para nada.
     */
    assert.equal(cuantasLeFaltan(p), CUANTAS - LAS_OPCIONALES.length);
  });

  test('las opcionales van marcadas, y solo ellas', () => {
    const p = lasPuertas({});
    for (const clave of LAS_OPCIONALES) {
      assert.equal(porClave(p, clave).opcional, true, `«${clave}» tendría que ser opcional`);
    }
    for (const q of p) {
      if (LAS_OPCIONALES.includes(q.clave)) continue;
      assert.ok(!q.opcional, `«${q.clave}» no es opcional`);
    }
  });

  test('y tenerlas sin hacer no cambia el número: se publica igual', () => {
    const conTodo = lasPuertas(COMPLETO);
    const sinPapeleo = lasPuertas({ ...COMPLETO, seguros: 0, mantenimientos: 0 });
    assert.equal(cuantasLeFaltan(conTodo), 0);
    assert.equal(cuantasLeFaltan(sinPapeleo), 0);
  });

  test('la tasación espera a la ficha técnica y manda a subirla', () => {
    /*
     * De la ficha técnica salen la versión, la cilindrada, el CO₂ y la
     * potencia. Un «1.5 TSI» tiene tres versiones que no valen lo mismo, así
     * que tasar antes es poner un número sobre un coche que todavía no sabemos
     * cuál es — y de ese número sale la conversación del precio de salida.
     */
    const sinPapeles = porClave(lasPuertas({ ...COMPLETO, tasacion: 0, papeles: [] }), 'tasacion');
    assert.equal(sinPapeles.bloqueada, true);
    assert.match(sinPapeles.falta, /ficha técnica/);
    // Y el enlace lleva a los papeles, no al tasador: ahí no puede hacer nada.
    assert.match(sinPapeles.donde.url, /#documentos/);

    const conPapeles = porClave(lasPuertas({ ...COMPLETO, tasacion: 0 }), 'tasacion');
    assert.ok(!conPapeles.bloqueada);
    assert.match(conPapeles.donde.url, /\/panel\/tasaciones/);
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

describe('lo que se trae de la base llega entero a las puertas', () => {
  /**
   * Un `pool` de mentira que contesta a cada consulta por lo que pregunta.
   *
   * Esto está aquí por un sabotaje que no cazó nadie: quitando de `loQueHayDe`
   * la línea que cuenta los papeles del seguro, todo seguía en verde. Y el
   * efecto real es el peor de todos — la puerta se queda cerrada para siempre
   * aunque el cliente suba el papel, así que le pedimos una y otra vez algo que
   * ya nos dio y no puede publicar nunca.
   */
  const poolDeMentira = (respuestas = {}) => ({
    query: async (sql) => {
      const s = String(sql);
      if (s.includes('FROM moveadvisor_user_vehicles')) {
        return { rows: [{ plate: '8888LXR', brand: 'VW', model: 'T-Roc', year: 2022, mileage: 60000 }] };
      }
      if (s.includes("file_type = 'photo'")) return { rows: [{ n: 6 }] };
      if (s.includes('vehicle_documents')) {
        return { rows: PAPELES_DEL_COCHE.map((p) => ({ document_type: p })) };
      }
      if (s.includes('condition_reports')) return { rows: [{ status: 'informe_listo' }] };
      if (s.includes('user_valuations')) return { rows: [{ estimate_value: 18500 }] };
      if (s.includes('visit_availability')) {
        return { rows: [1, 2, 3, 4, 5, 6].map((d) => ({ starts_at: enHora(d) })) };
      }
      if (s.includes('insurance_documents')) return { rows: [{ n: respuestas.seguros ?? 2 }] };
      if (s.includes('maintenance_invoices')) return { rows: [{ n: respuestas.mantenimientos ?? 3 }] };
      throw new Error(`consulta sin contestar: ${s.slice(0, 60)}`);
    },
  });

  test('trae los papeles del seguro y las facturas contados', async () => {
    const hay = await loQueHayDe(poolDeMentira(), 'veh-1');
    assert.equal(hay.seguros, 2);
    assert.equal(hay.mantenimientos, 3);
  });

  test('y con eso las puertas salen abiertas', async () => {
    // El camino entero: base → lo que hay → semáforo.
    const hay = await loQueHayDe(poolDeMentira(), 'veh-1');
    assert.deepEqual(lasPuertas(hay).filter((p) => !p.abierta), []);
  });

  test('sin papeles subidos, cerradas', async () => {
    const hay = await loQueHayDe(poolDeMentira({ seguros: 0, mantenimientos: 0 }), 'veh-1');
    const p = lasPuertas(hay);
    assert.equal(porClave(p, 'seguro').abierta, false);
    assert.equal(porClave(p, 'mantenimiento').abierta, false);
  });

  test('ninguna puerta se queda sin su dato', async () => {
    /*
     * El guardián general: cada clave que `lasPuertas` mira tiene que venir de
     * `loQueHayDe`. La que falte sale cerrada para siempre y no hay manera de
     * abrirla desde la pantalla.
     */
    const hay = await loQueHayDe(poolDeMentira(), 'veh-1');
    const fuente = fs.readFileSync(path.join(__dirname, 'puertas-del-encargo.js'), 'utf8');
    const trozo = fuente.slice(fuente.indexOf('function lasPuertas'), fuente.indexOf('function cuantasLeFaltan'));
    const usadas = new Set([...trozo.matchAll(/hay\.([a-zA-Z]+)/g)].map((m) => m[1]));
    assert.ok(usadas.size >= 8, `solo veo ${usadas.size}: ${[...usadas].join(', ')}`);
    for (const clave of usadas) {
      assert.ok(clave in hay, `«${clave}» lo miran las puertas y no lo trae loQueHayDe`);
    }
  });
});

describe('el seguro y el mantenimiento piden papel', () => {
  test('sin nada subido, cerradas', () => {
    const p = lasPuertas({ ...COMPLETO, seguros: 0, mantenimientos: 0 });
    assert.equal(porClave(p, 'seguro').abierta, false);
    assert.equal(porClave(p, 'mantenimiento').abierta, false);
  });

  test('con un papel, abiertas', () => {
    const p = lasPuertas({ ...COMPLETO, seguros: 1, mantenimientos: 1 });
    assert.equal(porClave(p, 'seguro').abierta, true);
    assert.equal(porClave(p, 'mantenimiento').abierta, true);
  });

  test('se cuentan ficheros, no lo que escribió a mano', () => {
    /*
     * Una compañía y un número de póliza se teclean de memoria y no prueban
     * nada. Lo que hace falta el día del traspaso es el papel.
     */
    const p = lasPuertas({
      ...COMPLETO, seguros: 0, mantenimientos: 0,
      policyCompany: 'Mapfre', policyNumber: 'P-1', maintenanceTitle: 'Revisión de los 100.000',
    });
    assert.equal(porClave(p, 'seguro').abierta, false);
    assert.equal(porClave(p, 'mantenimiento').abierta, false);
  });

  test('y cada una dice dónde se sube', () => {
    const p = lasPuertas({ ...COMPLETO, seguros: 0, mantenimientos: 0 });
    assert.match(porClave(p, 'seguro').donde.url, /#seguros$/);
    assert.match(porClave(p, 'mantenimiento').donde.url, /#mantenimientos$/);
  });

  test('sin datos salen cerradas, que es el lado prudente', () => {
    // Le pide algo que a lo mejor ya tiene, en vez de decirle que está listo.
    const p = lasPuertas({});
    assert.equal(porClave(p, 'seguro').abierta, false);
    assert.equal(porClave(p, 'mantenimiento').abierta, false);
  });
});

describe('cada puerta cerrada dice dónde se hace', () => {
  test('todas las cerradas llevan a algún sitio', () => {
    const p = lasPuertas({});
    for (const x of p.filter((y) => !y.abierta)) {
      assert.ok(x.donde, `«${x.nombre}» no dice dónde se hace`);
      // Dos pantallas: la ficha del IDCar y el panel. Lo que no vale es una
      // dirección de fuera o relativa a nada.
      assert.match(x.donde.url, /^\/(panel|mis-coches)/, x.donde.url);
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
    const anclas = TODAS_LAS_CLAVES
      .map((c) => aDondeSeHace(c, '8888LXR').url);
    assert.equal(new Set(anclas).size, anclas.length, anclas.join('\n'));
  });

  test('las direcciones a las que enlaza existen de verdad', () => {
    /*
     * `/mis-coches` la resuelve `PUBLIC_ROUTE_BY_ENTRY_MODE` en App.js. Esa
     * pantalla no tenía dirección y se le dio una para poder enlazarla desde
     * aquí; si alguien la quita, este enlace abre la home y el cliente no
     * encuentra dónde subir los papeles — con el enlace «funcionando».
     */
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');
    const bases = new Set(
      TODAS_LAS_CLAVES
        .map((c) => aDondeSeHace(c, '8888LXR').url.split('?')[0].split('#')[0])
    );
    for (const base of bases) {
      if (base.startsWith('/panel/')) continue; // ésas las resuelve el panel
      assert.ok(
        app.includes(`idCarsManage: "${base}"`),
        `App.js no enruta ${base}: el enlace no llevaria a ningun sitio`
      );
    }
  });

  test('y la pantalla sabe aterrizar en todas', () => {
    /*
     * Los nombres de ancla están en dos sitios: aquí, que los emite, y
     * `src/utils/aterrizajeDelEncargo.js`, que los reconoce al llegar. Si se
     * separan, el enlace abre la página y no baja a ningún lado — que es
     * exactamente lo que este trabajo venía a arreglar, y sin nada que lo
     * delate porque el enlace «funciona».
     */
    const fuente = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'utils', 'aterrizajeDelEncargo.js'), 'utf8'
    );
    const m = fuente.match(/export const SECCIONES = \[([^\]]*)\]/);
    assert.ok(m, 'no encuentro SECCIONES en la pantalla');
    const conocidas = m[1].split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean);

    for (const clave of TODAS_LAS_CLAVES) {
      const url = aDondeSeHace(clave, '8888LXR').url;
      const ancla = url.includes('#') ? url.split('#')[1] : '';
      // La tasación tiene página propia y no lleva ancla: no hay a qué bajar.
      if (!ancla) continue;
      assert.ok(conocidas.includes(ancla), `«${ancla}» no lo reconoce la pantalla`);
    }
  });

  test('las franjas llevan a su propia pantalla, no a la lista de coches', () => {
    /*
     * Esto apuntaba a `/panel/vehiculos#franjas`, y allí las franjas estaban
     * dentro de un botón de la tarjeta del coche: el enlace bajaba hasta el
     * botón sin abrir nada y quien lo seguía se quedaba mirando su lista. El
     * aviso decía «pendiente indicar franjas horarias» y llevaba a un sitio
     * donde no se indicaban — con el enlace «funcionando».
     */
    const url = aDondeSeHace('franjas', '8888LXR').url;
    assert.equal(url, '/panel/visitas?matricula=8888LXR');

    // Y que el panel sepa abrir esa dirección: si nadie la enruta, abre el
    // resumen y volvemos a dejarle donde no es.
    const rutas = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'utils', 'offerHelpers.js'), 'utf8'
    );
    const mapa = rutas.match(/USER_DASHBOARD_ROUTE_MAP = \{([\s\S]*?)\}/);
    assert.ok(mapa, 'no encuentro el mapa de rutas del panel');
    assert.match(mapa[1], /"\/panel\/visitas"/, 'el panel no enruta /panel/visitas');
  });

  test('sin matrícula el enlace sigue siendo válido', () => {
    // Un coche recién creado no la tiene todavía, y el enlace tiene que llevar
    // igual: es justamente el que va a ponerla.
    assert.equal(aDondeSeHace('papeles', null).url, '/mis-coches#documentos');
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

  test('y cuáles no paran el anuncio, igual en los dos', (t) => {
    if (!hayErp) return t.skip(`no está ${ERP}`);
    /*
     * Si se separan, el cliente lee en su panel que ya está todo y el ERP no
     * le deja publicar —o al revés—, que es el peor de los dos fallos: le
     * hemos dicho que su coche sale y no sale.
     */
    assert.deepEqual(LAS_OPCIONALES, listaDeAlla('LAS_OPCIONALES'));
  });

  test('y las cinco puertas son las mismas y en el mismo orden', (t) => {
    if (!hayErp) return t.skip(`no está ${ERP}`);
    const suyas = listaDeAlla('LAS_PUERTAS');
    assert.deepEqual(lasPuertas({}).map((p) => p.clave), suyas);
  });
});
