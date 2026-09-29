# La arquitectura por dentro — Mobility-Advisor

Escrito el 29 de septiembre de 2026, leyendo el código como quien llega nuevo.
Todas las cifras de este documento están medidas contra el repositorio y la base
de producción, no estimadas. Donde no he podido comprobar algo, lo digo.

---

## 1. Cómo está montado

### 1.1 Qué es este repositorio

No es una aplicación: son **cuatro cosas conviviendo en un árbol de ficheros**.

| Carpeta | Qué es | Tamaño |
|---|---|---|
| `src/` | La web pública (Create React App) | 71.000 líneas, 84 páginas |
| `api/` + `lib/api/` | La API sin servidor (funciones de Vercel) | 52 manejadores |
| `lib/` | El dominio y los almacenes | 56.000 líneas |
| `scripts/` | Scrapers, migraciones sueltas, tareas de mano | 232 ficheros, 52.000 líneas |

Más `scrapers/`, `db/`, `android/`, `n8n-workflows/` y `migrations/`.

Los cuatro comparten `package.json` (27 dependencias, **124 scripts**) y el mismo
`node_modules`. Eso significa que el paquete de la web arrastra el mismo árbol de
dependencias que el scraper de Wallapop, y que cambiar una versión para uno la
cambia para los cuatro.

### 1.2 Por dónde entra una petición

```
  navegador / app
        │
        ▼
  vercel.json  ── 49 reglas de reescritura
        │
        ├──► /api/market   (23 reglas)  ─┐
        ├──► /api/user     (17 reglas)   ├─ tres funciones que reparten por ?route=
        ├──► /api/billing  ( 5 reglas)  ─┘
        ├──► /api/billing-webhook  (aparte: necesita el cuerpo en crudo)
        └──► /index.html   (todo lo demás: la web)
        │
        ▼
  lib/api/<algo>-handler.js     52 manejadores
        │
        ▼
  lib/<algo>Store.js  ·  SQL a mano  ·  servicios externos
        │
        ▼
  Postgres (Neon)  ·  Supabase Storage  ·  Stripe  ·  Resend  ·  Gemini
```

**Por qué tres funciones y no cincuenta.** Vercel cobra por función desplegada.
Consolidar es correcto y no se toca. Lo que sobraba era que la mecánica del
reparto estuviera escrita tres veces; eso ya está arreglado (§4).

### 1.3 Quién guarda qué

Una sola base de Postgres en Neon, **compartida con el ERP**. Las tablas centrales,
por uso en el código:

| Tabla | Qué es |
|---|---|
| `moveadvisor_market_offers` | El pool de anuncios raspados. 2,36 M de filas. La tabla caliente. |
| `moveadvisor_user_vehicles` | El garaje del cliente |
| `moveadvisor_market_leads` | El lead, desde que pide hasta que se entrega |
| `vehicle_visit_bookings` / `_availability` | Las visitas y sus franjas |
| `moveadvisor_marketplace_vo_offers` | El marketplace propio (VO) |
| `moveadvisor_users` | Las personas |
| `erp_*` | Del ERP, pero se leen desde aquí |

Ficheros y PDFs en Supabase Storage: `vehicle-files` en abierto para las fotos,
`erp-documentos` privado con URL firmada para los papeles.

### 1.4 Lo que corre solo

Siete tareas en `vercel.json`, todas por `/api/user?route=cron-*`:

| Cuándo | Qué |
|---|---|
| `0 8 * * *` | Recordatorios de cita |
| `10 * * * *` | Seguimiento de citas |
| `0 9,17 * * *` | Alertas de mercado |
| `*/15 * * * *` | Avisar de informes de estado listos |
| `0 10 * * *` | Vigilar que los scrapers sigan vivos |
| `20 * * * *` y `40 * * * *` | Refrescar las facetas del buscador |

---

## 2. Zonas críticas

Ordenadas por lo que cuesta que sigan como están.

### 2.1 🔴 `src/App.js`: 127 `useState` en un componente de 6.072 líneas

```
  fichero completo          7.757 líneas
  export default App()      empieza en la 1685
  → el componente           ~6.072 líneas
  useState dentro           127
  useEffect dentro           14
  componentes en el fichero  65
```

Ciento veintisiete piezas de estado en un mismo ámbito. Cualquiera de ellas puede
provocar un repintado de todo lo demás, y no hay forma de saber cuál sin leerlo
entero. No existe un «cambiar el filtro de precio»: existe «tocar uno de los 127
y ver qué pasa».

**Y no hay router.** No está `react-router`. La navegación se hace leyendo
`window.location.pathname` a mano, con funciones como `normalizePublicPath`,
`resolveEntryModeFromPublicPath` y `readVehicleDetailIdFromPath`. Cada ruta nueva
es otro `if` dentro del mismo componente.

Lo que sí está bien: las 84 páginas se cargan con `lazy()`, y hay una capa de
cliente API (`src/utils/apiClient.js`) **con una prueba que la vigila**. De las 35
llamadas `fetch` de `src/`, **cero** escriben la ruta a pelo. Eso está resuelto.

> **Corrección de lo que puse aquí al escribir este informe.** Dije que la prueba
> estaba en rojo por `LoQueTeFaltaDelEncargo.js:58`, que declara
> `ruta = "/api/mandato-firmado"`, y que eso estaba roto dentro del APK. **Era
> falso**: esa ruta se usa como `fetch(rutaApi(ruta))`, así que lleva la base y
> funciona. Lo que estaba mal era la regla del comprobador.
>
> Al arreglarla apareció lo de verdad, que la regla anterior **no veía**:
> `src/components/AvailabilityEditor.js` hacía
> `const API = apiBase || "/api/visit-availability"` y de ahí salían cuatro
> `fetch` sin base — y ninguno de los cuatro sitios que montan ese componente
> pasa `apiBase`. Dentro del APK, poner franjas de visita fallaba sin decir por
> qué. Arreglado, con la regla reescrita y una prueba que fija las dos formas.

### 2.2 🔴 Dos esquemas de base de datos a la vez

Hay **12 migraciones** en `migrations/`, con huella sha256 y registro en
`migraciones_aplicadas`. Bien.

Y hay **25 ficheros que crean esquema en caliente**, dentro de las peticiones:

| Fichero | Sentencias DDL |
|---|---|
| `lib/billingStore.js` | 78 |
| `api/auth.js` | 37 |
| `lib/inventoryStore.js` | 23 |
| `lib/quiero-comprarlo.js` | 16 |
| `lib/api/leads-handler.js` | 16 |

Las dos describen el mismo esquema. Ninguna manda sobre la otra.

Y el atajo con el que `billingStore` evita repetirlo lo dice todo, en su propio
comentario:

> *«Quien añada una columna nueva tiene que cambiar **también** esta consulta. Si
> no, el atajo salta con la columna vieja, se salta todos los ALTER de abajo y la
> columna nueva no se crea nunca en producción — y el fallo no se ve al arrancar,
> se ve al guardar.»*

Eso es un trinquete manual que falla en silencio y en producción. Hay una prueba
que lo vigila, lo cual es mejor que nada, pero el arreglo de verdad es que el
esquema tenga un solo dueño.

**Y tiene coste hoy, no en abstracto.** El 24 de septiembre, con la base ocupada,
en los registros del ERP se veían pasar `CREATE TABLE IF NOT EXISTS erp_peritaciones`
y `CREATE INDEX IF NOT EXISTS idx_erp_audit_log_resource` **en peticiones de
pantalla**, cada una a 660 ms. Con la base tranquila no se nota; con la base
ocupada, cada carga se pone a la cola detrás de una sentencia de esquema.

### 2.3 🟠 49 clientes de Postgres distintos

```
  ficheros en lib/ + api/ que hacen `new Pool(...)`   49
  con `max:` declarado                                21
  sin declararlo (pg pone 10 por defecto)             28
  copias literales de la función getPool()            29
```

En una función sin servidor esto se paga en conexiones. Una instancia caliente que
atienda varias rutas puede acabar con varios pools abiertos a la vez contra la
misma base, cada uno con su propio límite. Neon tiene un tope, y cuando se toca no
se ve como «faltan conexiones»: se ve como el 500 que dio el ERP el 24 de
septiembre, cuando su pool se rindió a los 5 segundos esperando una libre.

### 2.4 🟠 Dos maneras de saber quién llama

Existe `lib/api/identidad.js`, con `identidadDeLaPeticion()`. Lo usan **19**
ficheros.

Y sigue vivo el anterior, `authHandler.getSessionUserFromRequest()`, en **13**.
No son equivalentes: el segundo devuelve el **correo** y con él se consulta. El
primero trabaja con el identificador del usuario.

Esa es exactamente la migración que hizo la migración `0006-el-correo-deja-de-ser-la-atadura`,
y está a medias. Mientras lo esté, cambiar de correo es una operación con dos
significados según por qué puerta entre la petición.

Además, la llamada se hace con `?.`:

```js
const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
```

Si ese export desapareciera, esto no falla: devuelve `undefined`, el correo queda
vacío y la respuesta es un 401. Cierra en seguro, que es lo correcto, pero un
fallo de programación se disfrazaría de sesión caducada y nadie lo encontraría.

### 2.5 🟠 Un almacén de SQL Server enchufado a manejadores vivos

`lib/sqlserverMobilityStore.js`, 2.618 líneas, habla con SQL Server
**lanzando `sqlcmd.exe` con `execFileSync`** — un proceso externo, de forma
bloqueante, desde dentro de una petición. Escribe la consulta a un fichero
temporal cuando es larga.

Lo importan tres ficheros, y dos son manejadores en producción:
`user-saved-handler` y `user-preferences-handler`.

En Vercel no hay `sqlcmd`. Y el resultado no es un error, es peor:

```js
if (!shouldUseSqlServerMobility()) {
  if (method === "GET") {
    return res.status(200).json({ ok: true, comparisons: [], fallback: true });
  }
  return res.status(503).json({ error: "Backend de movilidad no configurado." });
}
```

**Guardar comparaciones y las preferencias del usuario contestan 200 con la lista
vacía.** Para quien lo usa, no es «esto está roto»: es «no tengo nada guardado».

*(Comprobado en el código. No he verificado contra producción si `AUTH_PROVIDER`
está puesto en Vercel — no tengo acceso a esas variables —, pero el binario no
existe en ese entorno, así que el camino no puede completarse.)*

Y el escape de esas consultas es `String(value).replace(/'/g, "''")`: concatenación
de cadenas. Hoy es inalcanzable; el día que alguien levante este camino, deja de
serlo.

### 2.6 🟡 Dos funciones que son un programa cada una

| Fichero | Líneas | Funciones dentro |
|---|---|---|
| `api/find-listing.js` | 4.607 | 114 |
| `api/analyze.js` | 2.068 | 49 |
| `lib/billingStore.js` | 4.344 | — |
| `lib/inventoryStore.js` | 3.240 | — |

`find-listing.js` mezcla en un solo fichero: un buscador contra DuckDuckGo, un
mapa escrito a mano de compañía→dominio, el emparejado de anuncios, el cálculo de
medianas y la ordenación por calidad-precio. Cada una de esas cosas es
comprobable por separado y ninguna lo es hoy.

### 2.7 🟡 La resolución de rutas mira la URL entera

Cuando no viene `?route=`, se resuelve así:

```js
const url = String(req.url || "").toLowerCase();
if (url.includes("leads")) return "leads";
```

`req.url` incluye la query. Una petición a `/api/user?route=&algo=/leads` resuelve
«leads». En producción las 49 reglas ponen siempre el `?route=`, así que esto casi
nunca decide nada — pero está ahí, y el orden de la lista es lo único que impide
que `import-lead` se coma a `import-offers`.

**No lo he cambiado**, porque arreglarlo cambia comportamiento. Lo correcto es
mirar solo el camino, no la query. Va en el plan (§3).

---

## 3. Estrategia de refactorización

Ordenada por relación entre lo que arregla y lo que arriesga. La red de pruebas
—**1.454 pruebas en verde en 7 segundos**— es lo que hace viable todo esto.

### Ya hecho

**0. Juntar el reparto de rutas y cargar los manejadores al usarse.** §4.

### Siguiente, por orden

**1. Un solo cliente de Postgres.** *(bajo riesgo, alto retorno)*

Un `lib/postgres.js` que exporte un pool único con su `max` declarado, y sustituir
las 29 copias de `getPool()`. Es mecánico y cada sustitución es comprobable. Quita
el riesgo de agotar conexiones y deja un único sitio donde ajustar tiempos.

**2. Que el esquema tenga un solo dueño.** *(riesgo medio, retorno muy alto)*

Las 12 migraciones ya son la fuente buena. El trabajo es, por almacén:

1. comprobar que la migración de base describe lo mismo que el DDL en caliente;
2. quitar el DDL del camino de la petición;
3. dejar una prueba que falle si alguien vuelve a meter un `CREATE TABLE` en un
   manejador.

Ese último punto es el que lo hace permanente. Sin él, vuelve.

**3. Terminar la migración de la identidad.** *(riesgo medio)*

Llevar los 13 ficheros de `getSessionUserFromRequest` a `identidadDeLaPeticion`,
uno a uno, y quitar el `?.` al final para que una avería suene como una avería.

**4. Decidir qué pasa con el almacén de SQL Server.** *(decisión, no código)*

Dos salidas honradas:
- **llevar «comparaciones guardadas» y «preferencias» a Postgres** —son dos tablas
  pequeñas— y borrar las 2.618 líneas;
- o **quitar esas dos funciones de la interfaz** mientras no existan.

Lo que no puede quedarse es contestar 200 con la lista vacía.

**5. Partir `find-listing.js` y `analyze.js`.** *(riesgo bajo, trabajo largo)*

Sacar a `lib/` lo que ya es dominio —el buscador externo, el emparejado, las
medianas— y dejar en `api/` la función que orquesta. Se puede hacer pieza a pieza,
y cada pieza que sale gana pruebas propias.

**6. Poner un router en la web y partir `App.js`.** *(el más caro)*

No se hace de una sentada. El camino es sacar bloques de estado del componente a
hooks propios (`useAdvisorAnswers`, `useVehicleDetail`), que ya es el patrón de los
24 ficheros de `src/hooks/`. Cuando el estado esté fuera, meter `react-router` es
un cambio pequeño.

### Lo que NO recomiendo tocar

- **Las tres funciones que reparten.** Es la forma correcta de vivir con el modelo
  de precios de Vercel.
- **Los nombres en castellano.** Son consistentes y describen el dominio. Un
  renombrado masivo es riesgo puro sin retorno.
- **`migrations/` + `migra.mjs`.** Está bien hecho: huella, transacción por
  fichero, trinquete. Es el modelo al que traer lo demás.
- **`src/utils/apiClient.js`.** Resuelto y vigilado.

---

## 4. El código, antes y después

La muestra que ya está aplicada: el reparto de rutas.

### El problema

Tres ficheros con la misma mecánica copiada: `resolveRoute` idéntico, la misma
llamada a `aplicaCors`, un `switch` de veinte casos y su 404. Cambiar cómo se
resuelve una ruta obligaba a acordarse de los tres.

Y se notaba que había pasado: `api/billing.js` resolvía `"webhook"` para una ruta
que su `switch` no tenía. La rama llevaba ahí sin hacer nada, tapada por el 404.

Además, `api/market.js` requería sus 24 manejadores arriba del todo, con sus
almacenes y sus generadores de PDF detrás.

### Antes

```js
// api/market.js  — 24 require en la cabecera
const marketPriceHandler = require("../lib/api/market-price-handler");
const marketplaceVoHandler = require("../lib/api/marketplace-vo-handler");
// … 22 más

function resolveRoute(req) {                    // copiado en los otros dos
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) return explicitRoute;
  const url = String(req.url || "").toLowerCase();
  if (url.includes("market-price")) return "price";
  // … 14 más
}

module.exports = async function marketRouter(req, res) {
  if (aplicaCors(req, res)) return undefined;
  switch (resolveRoute(req)) {
    case "price": return marketPriceHandler(req, res);
    // … 23 más
    default: return res.status(404).json({ error: "Market route not found" });
  }
};
```

### Después

```js
// api/market.js — una tabla, y los require dentro
const { creaEnrutador } = require("../lib/api/enrutador");

const ALIAS = [
  ["market-price", "price"],
  ["import-lead", "import-lead"],     // antes que import-offers, y no es casualidad
  // …
];

const RUTAS = {
  price: () => require("../lib/api/market-price-handler"),
  vo:    () => require("../lib/api/marketplace-vo-handler"),
  // …
};

module.exports = creaEnrutador({
  rutas: RUTAS,
  alias: ALIAS,
  noEncontrada: "Market route not found",
});
```

Y en `lib/api/enrutador.js`, la comprobación que convierte la avería de
`billing.js` en algo que no se puede escribir:

```js
for (const [trozo, ruta] of alias) {
  if (!Object.prototype.hasOwnProperty.call(rutas, ruta)) {
    throw new Error(
      `creaEnrutador: el alias "${trozo}" apunta a la ruta "${ruta}", que no existe`
    );
  }
}
```

### Qué se gana, medido

| | antes | después |
|---|---|---|
| `api/market.js`, arranque en frío | **313 ms** | **4 ms** |
| módulos cargados | **311** | **3** |
| `resolveRoute` escrito | 3 veces | 1 |
| alias apuntando a rutas que no existen | 1, en silencio | imposible |

### Qué se comprobó antes de darlo por bueno

- **Las rutas son las mismas**: 24 / 19 / 5, comparadas contra `HEAD`.
- **Los alias son los mismos y en el mismo orden**, comparados contra `HEAD`. La
  única baja es `billing-webhook`, que acababa en el mismo 404 por los dos caminos.
- **1.454 pruebas en verde.**
- **El paquete de Vercel sigue completo**: trazado con `@vercel/nft`, la misma
  herramienta que usa Vercel, para confirmar que los `require` dentro de una
  función se siguen incluyendo. Entran los 29 ficheros de `lib/api/` de market,
  los 19 de user y los 7 de billing.

### El precio, dicho en voz alta

Cargar los manejadores al arrancar tenía una virtud: un fallo de sintaxis en
cualquiera reventaba el despliegue, alto y claro. Cargándolos al usarse, ese fallo
esperaría a que alguien pidiera esa ruta.

Por eso `lib/api/enrutador.test.js` carga los 45 manejadores de las tres puertas y
comprueba que cada uno devuelve una función. El ruido se ha movido de producción a
las pruebas, que es antes y más barato — pero es un cambio de sitio, no una
desaparición, y conviene saberlo.

---

## 5. Lo que no he mirado

- `scrapers/`, `db/`, `android/`, `n8n-workflows/`.
- Los 232 ficheros de `scripts/`, más allá de contarlos.
- El rendimiento de las consultas, salvo la que rompía el panel del ERP
  (arreglada el 24 de septiembre con la migración `0011`).
- Los otros tres repositorios: `carswise-erp-backoffice` (435 ficheros),
  `popcar-pocket-advisor` (260) y `Carswise-check` (113).
