/**
 * Genera el workflow «Wallapop – Confirmar vivas por vendedor».
 *
 *   npm run genera-confirmador-wallapop
 *
 * Escribe n8n-workflows/wallapop-confirmar-por-vendedor.json. Hay que
 * importarlo en n8n a mano, encima del que hubiera.
 *
 * ── El problema ────────────────────────────────────────────────────────────
 *
 * Wallapop tiene 531.264 ofertas vivas y el verificador las comprueba UNA POR
 * UNA, con medio segundo de espera, diez veces al día. Son 8.000 al día: una
 * vuelta completa cada 69 días. Medido el 30-sep-2026, el 89 % del catálogo
 * llevaba más de un mes sin comprobar. Eso no es un duplicado, es mandar a un
 * cliente a por un coche que ya no está.
 *
 * ── Lo que cambia ──────────────────────────────────────────────────────────
 *
 * La API tiene un endpoint por vendedor -/api/v3/users/{id}/items- que
 * devuelve 40 anuncios por petición. Y el catálogo está concentradísimo: 5.350
 * vendedores con diez o más coches suman 390.268 ofertas, el 73,5 %. Los 89
 * más gordos, ellos solos, 208.441.
 *
 * Eso convierte 390.268 peticiones en unas 10.000.
 *
 * ── LO QUE ESTE WORKFLOW NO HACE, Y ES LO MÁS IMPORTANTE ──────────────────
 *
 * **No da ni una baja.**
 *
 * La idea evidente era dar por vendido lo que no apareciera en el catálogo del
 * vendedor. Se probó contra un vendedor pequeño del que ya sabíamos la
 * respuesta, y de sus 12 ofertas ausentes del catálogo **2 seguían vivas**
 * -HTTP 200 en /items/{id}-. El catálogo por vendedor está incompleto: dar de
 * baja por ausencia mataría coches buenos, un 17 % de los ausentes.
 *
 * Es el mismo error del que protege scripts/comprueba-canalcar-verify.js:
 * allí, cruzar por url en vez de por id daba por muertos 154 coches vivos.
 *
 * Así que esto solo CONFIRMA VIDAS. Lo que aparece en el catálogo del vendedor
 * está a la venta -4 de 4 en el control- y se le refresca `last_checked_at`.
 * Lo que no aparece no se toca: se queda con su fecha vieja y por eso sube
 * solo a lo alto de la cola del verificador de uno en uno, que es el único que
 * puede dar una baja y solo lo hace con un 404 en la mano.
 *
 * Los dos workflows encajan sin hablarse: éste quita de la cola lo que ya
 * sabe vivo, y el otro se concentra en lo dudoso.
 *
 * ── La paginación ──────────────────────────────────────────────────────────
 *
 * Con `?since=<cursor>`, y el cursor viene en `meta.next`. NO es `next_page`
 * ni `next` ni `cursor`: se probaron los cuatro y los tres primeros devuelven
 * otra vez la primera página, en silencio y con HTTP 200. Un bucle que use el
 * nombre equivocado da vueltas sobre los mismos 40 anuncios para siempre y
 * parece que funciona.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/**
 * Vendedores por ejecución.
 *
 * Cada vendedor cuesta una petición por cada 40 anuncios suyos. Con 60
 * vendedores de tamaño medio -unos 73 coches- salen unas 110 peticiones por
 * pasada, y con 8 pasadas al día se recorren los 5.350 en unos once días.
 *
 * El número que hay que subir cuando haga falta más ritmo es el de PASADAS,
 * no éste: una pasada larga es una ejecución larga, y una ejecución larga
 * ocupa uno de los tres huecos de concurrencia de n8n y forma cola detrás.
 */
const VENDEDORES_POR_PASADA = 60;

/** Páginas como mucho por vendedor. 25 × 40 = 1.000 anuncios, de sobra. */
const PAGINAS_MAX = 25;

/** Desde cuántas ofertas compensa ir por vendedor en vez de una a una. */
const MINIMO_OFERTAS = 10;

const CABECERAS = [
  { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
  { name: "Accept", value: "application/json" },
  /* Sin esto la API responde 403. Está apuntado y ya costó una tarde. */
  { name: "X-DeviceOS", value: "0" },
];

const PG = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };

/*
 * La cola: los vendedores gordos, empezando por el que lleva más tiempo sin
 * que le miremos nada.
 *
 * Se ordena por la oferta MÁS RECIENTEMENTE comprobada de cada vendedor -un
 * `max`, no un `min`-. Suena al revés y no lo es: si a un vendedor le miramos
 * algo hace una hora, no hace falta volver; el que lleva un mes sin que le
 * miremos NADA es el urgente.
 */
const SQL_COLA = `
-- Vendedores de wallapop con ${MINIMO_OFERTAS} o mas ofertas vivas, los mas
-- desatendidos primero.
--
-- El id del vendedor no esta en la oferta: hay que cruzarlo por nombre con la
-- tabla de concesionarios. Se comprobo el 30-sep-2026 y cubre el 100 % de los
-- 5.350 vendedores gordos, que son 390.268 ofertas.
SELECT d.dealer_id,
       o.dealer_name,
       count(*)::int AS ofertas,
       max(o.last_checked_at) AS ultima
  FROM moveadvisor_market_offers o
  JOIN LATERAL (
        SELECT dealer_id FROM moveadvisor_market_dealers
         WHERE portal = 'wallapop' AND company_name = o.dealer_name
         LIMIT 1
       ) d ON true
 WHERE o.portal = 'wallapop'
   AND o.is_active
   AND COALESCE(o.dealer_name, '') <> ''
 GROUP BY d.dealer_id, o.dealer_name
HAVING count(*) >= ${MINIMO_OFERTAS}
 ORDER BY max(o.last_checked_at) ASC NULLS FIRST
 LIMIT ${VENDEDORES_POR_PASADA}
`.trim();

/*
 * El veredicto. Solo confirma; no da bajas.
 *
 * Llegan todas las paginas del vendedor como items separados -la paginacion
 * de n8n devuelve una por pagina- y hay que juntarlas.
 */
const CODE_VEREDICTO = `
// Wallapop - confirmar vivas por vendedor.
//
// ESTE NODO NO DA BAJAS, Y NO ES UN OLVIDO. El catalogo por vendedor esta
// incompleto: probado el 30-sep-2026 contra un vendedor del que sabiamos la
// respuesta, de 12 ofertas ausentes de su catalogo 2 seguian vivas. Dar de
// baja por ausencia mataria coches buenos.
//
// Lo que aparece, vive -4 de 4 en el control-. Lo que no aparece se queda
// como esta y sube solo a lo alto de la cola del verificador de uno en uno,
// que es el unico que puede matar y solo con un 404 delante.

const vendedor = $('Loop: vendedor por vendedor').item.json;

// Todas las paginas de este vendedor, juntas.
const ids = [];
for (const it of $input.all()) {
  const lote = (it.json && it.json.data) || [];
  for (const x of lote) if (x && x.id) ids.push(String(x.id));
}

const s = $getWorkflowStaticData('global');
s.wp_vendedores = (s.wp_vendedores || 0) + 1;
s.wp_vistos = (s.wp_vistos || 0) + ids.length;

if (!ids.length) {
  // Un vendedor sin catalogo puede ser una cuenta cerrada, pero tambien una
  // peticion que fue mal. No se confirma nada y no se toca nada.
  s.wp_vacios = (s.wp_vacios || 0) + 1;
  console.log('[wp-confirmar] ' + vendedor.dealer_name + ': catalogo vacio, no se toca');
  return [{ json: { seguir: '', sql: null } }];
}

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const nuestros = ids.map(x => esc('wp_' + x)).join(', ');

return [{ json: {
  seguir: 'si',
  vendedor: vendedor.dealer_name,
  vistos: ids.length,
  sql:
    'UPDATE moveadvisor_market_offers' +
    " SET last_checked_at = NOW()" +
    ' WHERE portal = ' + esc('wallapop') +
    '   AND is_active' +
    '   AND id IN (' + nuestros + ')',
} }];
`.trim();

const CODE_RESUMEN = `
// El parte de la pasada, y limpiar la memoria del workflow.
const s = $getWorkflowStaticData('global');
const parte = {
  vendedores: s.wp_vendedores || 0,
  anuncios_vistos: s.wp_vistos || 0,
  catalogos_vacios: s.wp_vacios || 0,
};
// La memoria es del WORKFLOW, no de la pasada: si no se limpia, la siguiente
// empieza con los numeros de esta y el parte deja de significar nada.
for (const k of Object.keys(s)) if (k.indexOf('wp_') === 0) delete s[k];
console.log('[wp-confirmar] ' + parte.vendedores + ' vendedores, '
  + parte.anuncios_vistos + ' anuncios confirmados vivos, '
  + parte.catalogos_vacios + ' catalogos vacios');
return [{ json: parte }];
`.trim();

const nodos = [
  {
    parameters: {},
    id: "a1000000-0000-4000-8000-000000000001",
    name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger",
    typeVersion: 1,
    position: [-400, 100],
  },
  {
    parameters: {
      rule: {
        /*
         * Ocho pasadas, dentro de la ventana de 08:00 a 00:00 que respetan
         * todos los flujos. Separadas dos horas: cada una dura unos diez
         * minutos y asi nunca se solapa consigo misma.
         */
        interval: [{ field: "cronExpression", expression: "0 15 8,10,12,14,16,18,20,22 * * *" }],
      },
    },
    id: "a1000000-0000-4000-8000-000000000002",
    name: "8 veces/día (08-22 h)",
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    position: [-400, 280],
  },
  {
    parameters: { operation: "executeQuery", query: SQL_COLA, options: {} },
    id: "a1000000-0000-4000-8000-000000000003",
    name: "PG: Cola de vendedores",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [-140, 190],
    credentials: PG,
  },
  {
    parameters: { batchSize: 1, options: {} },
    id: "a1000000-0000-4000-8000-000000000004",
    name: "Loop: vendedor por vendedor",
    type: "n8n-nodes-base.splitInBatches",
    typeVersion: 3,
    position: [120, 190],
  },
  {
    parameters: {
      url: "={{ 'https://api.wallapop.com/api/v3/users/' + $json.dealer_id + '/items' }}",
      sendHeaders: true,
      headerParameters: { parameters: CABECERAS },
      options: {
        timeout: 20000,
        response: { response: { neverError: true } },
        /*
         * La paginacion la hace n8n, no un bucle nuestro. El cursor viene en
         * `meta.next` y se manda como `?since=`.
         *
         * OJO CON EL NOMBRE. Se probaron next_page, next y cursor: los tres
         * devuelven OTRA VEZ la primera pagina, con HTTP 200 y sin queja. Un
         * bucle con el nombre equivocado da vueltas sobre los mismos 40
         * anuncios para siempre y parece que funciona.
         */
        pagination: {
          pagination: {
            paginationMode: "updateAParameterInEachRequest",
            parameters: {
              parameters: [
                { type: "qs", name: "since", value: "={{ $response.body.meta.next }}" },
              ],
            },
            paginationCompleteWhen: "other",
            completeExpression: "={{ !$response.body.meta || !$response.body.meta.next }}",
            limitPagesFetched: true,
            maxRequests: PAGINAS_MAX,
            requestInterval: 400,
          },
        },
      },
    },
    id: "a1000000-0000-4000-8000-000000000005",
    name: "HTTP: Catálogo del vendedor",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [400, 300],
  },
  {
    parameters: { jsCode: CODE_VEREDICTO },
    id: "a1000000-0000-4000-8000-000000000006",
    name: "Code: Confirmar vivas",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [660, 300],
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
        conditions: [{
          id: "hay-algo",
          leftValue: "={{ $json.seguir }}",
          rightValue: "si",
          operator: { type: "string", operation: "equals" },
        }],
        combinator: "and",
      },
      options: {},
    },
    id: "a1000000-0000-4000-8000-000000000007",
    name: "IF: ¿hay que confirmar?",
    type: "n8n-nodes-base.if",
    typeVersion: 2,
    position: [920, 300],
  },
  {
    parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "a1000000-0000-4000-8000-000000000008",
    name: "PG: Confirmar vivas",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [1180, 220],
    credentials: PG,
  },
  {
    parameters: {
      /*
       * `amount` y `unit` van EXPLICITOS. n8n borra los valores por defecto al
       * importar, y un «esperar 1» sin unidad se convirtio una vez en esperar
       * una hora, en verde y sin avisar.
       */
      amount: 2,
      unit: "seconds",
    },
    id: "a1000000-0000-4000-8000-000000000009",
    name: "Esperar 2s",
    type: "n8n-nodes-base.wait",
    typeVersion: 1.1,
    position: [1440, 300],
    webhookId: "a1000000-0000-4000-8000-00000000000a",
  },
  {
    parameters: { jsCode: CODE_RESUMEN },
    id: "a1000000-0000-4000-8000-00000000000b",
    name: "Code: Resumen",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [400, 80],
  },
];

/*
 * El bucle: la salida 0 de splitInBatches es «se acabo» y la 1 es «aqui va
 * uno». Al reves de lo que parece, y cambiarlas hace que el flujo corra una
 * sola vez y termine en verde.
 */
const conexiones = {
  "Ejecutar manualmente": { main: [[{ node: "PG: Cola de vendedores", type: "main", index: 0 }]] },
  "8 veces/día (08-22 h)": { main: [[{ node: "PG: Cola de vendedores", type: "main", index: 0 }]] },
  "PG: Cola de vendedores": { main: [[{ node: "Loop: vendedor por vendedor", type: "main", index: 0 }]] },
  "Loop: vendedor por vendedor": {
    main: [
      [{ node: "Code: Resumen", type: "main", index: 0 }],
      [{ node: "HTTP: Catálogo del vendedor", type: "main", index: 0 }],
    ],
  },
  "HTTP: Catálogo del vendedor": { main: [[{ node: "Code: Confirmar vivas", type: "main", index: 0 }]] },
  "Code: Confirmar vivas": { main: [[{ node: "IF: ¿hay que confirmar?", type: "main", index: 0 }]] },
  "IF: ¿hay que confirmar?": {
    main: [
      [{ node: "PG: Confirmar vivas", type: "main", index: 0 }],
      [{ node: "Esperar 2s", type: "main", index: 0 }],
    ],
  },
  "PG: Confirmar vivas": { main: [[{ node: "Esperar 2s", type: "main", index: 0 }]] },
  "Esperar 2s": { main: [[{ node: "Loop: vendedor por vendedor", type: "main", index: 0 }]] },
};

const wf = {
  /*
   * EL ID QUE LE DIO n8n, no uno inventado.
   *
   * Tiene que tener 16 caracteres, pero eso no basta: tiene que ser
   * EXACTAMENTE el que n8n ya tiene guardado. La primera version llevaba
   * «WallapopConf0001» y al importarla el 30-sep-2026 n8n la ignoro y le
   * asigno el suyo. Si se dejara el inventado, la siguiente importacion
   * crearia una COPIA en vez de sustituir: dos workflows, dos crones y el
   * doble de peticiones a wallapop, y n8n lo da por bueno sin avisar.
   *
   * Se saca de la URL al abrirlo en n8n, o de su base:
   *   SELECT id, name FROM workflow_entity WHERE name LIKE '%Confirmar%'
   */
  id: "ddnBIkp12vd6YhAQ",
  name: "Wallapop – Confirmar vivas por vendedor",
  active: false,
  nodes: nodos,
  connections: conexiones,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveDataSuccessExecution: "none",
    saveDataErrorExecution: "all",
    callerPolicy: "workflowsFromSameOwner",
    errorWorkflow: "9BwKOPMIzjj3owho",
  },
  pinData: {},
};

const destino = path.join(RAIZ, "n8n-workflows", "wallapop-confirmar-por-vendedor.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos");
console.log("  " + VENDEDORES_POR_PASADA + " vendedores por pasada, 8 pasadas al día");
console.log("  hasta " + PAGINAS_MAX + " páginas por vendedor (" + PAGINAS_MAX * 40 + " anuncios)");
console.log("\n  NO DA BAJAS: solo confirma vivas. Las bajas siguen siendo del");
console.log("  verificador de uno en uno, que es el único que ve un 404.\n");
