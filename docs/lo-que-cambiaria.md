# Lo que cambiaría — revisión a fondo, zona por zona

Revisión de ingeniería del 30 de septiembre de 2026. Cada hallazgo lleva su
evidencia y su gravedad, y **los que resultaron no ser nada también están
apuntados**, porque saber que algo se miró y estaba bien vale tanto como saber
que está mal.

**Contexto que recontextualiza todo**: la base de producción tiene **7 usuarios y
3 coches**. Está pre-lanzamiento. Nada de lo que hay aquí está haciendo daño
ahora mismo; varias cosas empiezan a hacerlo el día que haya tráfico.

Las once zonas están revisadas, y **eso no quiere decir que esté todo mirado**.
Son 170.166 líneas sin contar pruebas: leí entero lo que podía hacer daño y medí
el resto con comprobaciones dirigidas. §5.7 es la prueba de que eso no es lo
mismo — lo encontré después de dar la zona 5 por buena—. Y §13 no se pudo revisar
leyendo: lo que hace un flujo de n8n depende de si **eso** es lo que corre, así que
está comparado contra la instancia de verdad. Lo que queda, con su
tamaño, está al final.

---

## Cómo leer la gravedad

| | Qué significa |
|---|---|
| 🔴 | Hay que decidir o arreglar antes de lanzar |
| 🟠 | Rompe con tráfico, o cuesta dinero |
| 🟡 | Mantenimiento: hoy funciona, mañana se paga |
| ⚪ | Higiene |
| ✅ | Lo miré y **está bien** — no volver a mirarlo |

---

## Zona 1 — Base de datos ✔ revisada

108 tablas, **7.294 MB** —7,12 GB—, y el 88% es una sola:
`moveadvisor_market_offers` (2,8 millones de filas, 6,7 GB).

(Escribí 7,63 GB la primera vez. Son 7.294 MB hoy, medidos con
`pg_database_size`, y la suma de tablas e índices da 7.281 MB: casi todo el peso
está en tablas, no en cosas del sistema. Parte de la diferencia son los dos índices
de 124 y 131 MB que creé y tiré al medir §8; el resto, que la primera cifra la
saqué de otra forma. Lo apunto porque la de §9.1 —el peso contra la caché— depende
de este número.)

### 🟠 1.1 — 523 MB de índices que casi nadie ha leído nunca

La tabla grande tiene **31 índices, 2,35 GB**. Las estadísticas no se han
reiniciado nunca y registran **38 millones de actualizaciones**, así que los
contadores son fiables. Y estos ocho suman 523 MB con ≤11 lecturas en toda la
vida de la base:

| Usos | Tamaño | Índice |
|---:|---:|---|
| 0 | 95 MB | `ix_mmo_presentables` |
| 0 | 14 MB | `idx_market_offers_visibles` |
| 3 | 101 MB | `ix_mmo_visible_precio_desc` |
| 5 | 101 MB | `ix_mmo_visible_precio` |
| 11 | 115 MB | `ix_mmo_activas_precio` |
| 9 | 32 MB | `ix_mmo_visible_km` |
| 10 | 34 MB | `ix_mmo_visible_anio` |
| 10 | 31 MB | `idx_market_offers_provincia` |

Cada una de esas 38 millones de escrituras mantiene los 31 índices. Es lo que ya
dice la migración 0015: «lo caro no era leer, era **escribir**».

**Qué haría**: `DROP INDEX CONCURRENTLY` uno a uno, midiendo entre cada uno.

**Y el aviso, que importa más que el hallazgo**: en esa misma lista de «poco uso»
aparece `idx_market_offers_import_publicadas` con 12 usos —**y es el que bajó el
panel del ERP de 68 segundos a 1**—. Tiene pocos usos porque ese panel se
consulta poco, pero cada vez ahorra 67 segundos. Lo mismo vale para los índices
parciales pequeños (`ix_offers_no_es_coche`, `idx_market_offers_danos_pendientes`):
ocupan casi nada y sirven a una consulta concreta.

**«Poco uso» no es «se borra». Solo los ocho grandes de la tabla.**

### 🟡 1.2 — 9 claves ajenas sin índice

`vehicle_id` en seis tablas del usuario (`appointments`, `insurances`,
`maintenances`, `vehicle_states`, `saved_offers`), más `erp_tickets.user_id`,
`vehicle_visit_bookings.availability_id`, `check_app.report_findings.asset_id` y
`whatsapp_leads.pre_cliente_id`.

Sin índice, borrar el padre escanea la tabla hija entera y toma un bloqueo. Hoy
esas tablas tienen entre 0 y 9 filas, así que **no duele**. Y por eso mismo:
**añadirlos ahora es instantáneo y gratis**. Hacerlo con un millón de filas no lo
será.

### ⚪ 1.3 — Dos tablas de respaldo del 22 de agosto, en producción

`moveadvisor_vehicle_brands_copia_20260822` (99 filas) y
`moveadvisor_vehicle_models_copia_20260822` (1.910 filas). Son **las dos únicas
de las 108 sin clave primaria**. No molestan; confunden a quien llegue y tenga
que decidir cuál es la de verdad.

### ⚪ 1.4 — Cinco tablas que ningún código menciona

Ni aquí ni en el ERP: `erp_inventory`, `erp_invoices`, `erp_leads`,
`erp_user_status_overrides`, `moveadvisor_user_vehicle_characteristics`.

Comprobado a propósito contra los dos repositorios, porque de las 28 tablas
vacías **23 sí tienen código esperándolas**: son funciones pre-lanzamiento, no
restos. Esa distinción es la que evita borrar algo que hace falta.

### ✅ 1.5 — Filas muertas: bien

6,4% en la tabla grande, autovacuum corrió hoy. No es problema y no hay que
tocar la configuración.

---

## Zona 2 — Conexiones ✔ revisada

### 🔴 2.1 — Ocho manejadores cerraban el pool compartido *(arreglado: `2f0b412`)*

`elPool()` memoriza el pool. `pool.end()` **no** resetea esa memoria, así que la
siguiente petición de la misma instancia de Vercel recibía **el pool cerrado** y
toda consulta fallaba con «Cannot use a pool after calling end on the pool».

Reproducido contra la base real:

```
peticion 1: consulta ok
peticion 1: pool.end() llamado
peticion 2: elPool() devuelve EL MISMO pool cerrado
peticion 2: FALLA -> Cannot use a pool after calling end on the pool
```

Eran **21 sitios en 8 ficheros**: informe de estado, publicar coche, pedir
visita, subir fichero, vista 3D, papel del coche y dos crons.

**No se había notado porque hay 7 usuarios.** Con tan poco tráfico una instancia
caliente casi nunca recibe otra petición entre el cierre y su reciclado. Es el
fallo que aparece **el día del lanzamiento**.

Lo más revelador: la regla **ya estaba escrita** en `lib/postgres.js`
(`cierraElPool()` y su documentación). Los ocho no la seguían porque llamaban al
`end()` del objeto en vez de a la función del módulo, y nada lo impedía. Ahora
hay vigilante.

### ✅ 2.2 — El resto del pool: bien

Un solo pool para 52 ficheros, `max` configurable, `ssl` explícito, manejador de
`error` en conexiones ociosas —sin él un error de una conexión en reposo se lleva
el proceso—, y reinicio si cambia la cadena. Solo quedan **tres** `new Pool(` a
mano y los tres tienen motivo (`billing-ping`, `inventoryStore`, un comentario).

---

## Zona 3 — Los 53 manejadores de `lib/api/` ✔ revisada

Revisados los 53 en seis dimensiones: control de acceso, método HTTP, CORS,
freno, manejo de errores y si escriben.

### 🟠 3.1 — `/api/whatsapp` no verifica la firma de Meta

El `GET` verifica el token de Meta correctamente. El **`POST` no verifica nada**:
lee `req.body.entry[0].changes[0].value.messages[0]` y sigue.

Meta firma cada aviso con `X-Hub-Signature-256`. Sin verificarlo, **cualquiera
puede inventarse un mensaje de WhatsApp** y meter filas en `whatsapp_sessions`,
`whatsapp_leads` y `pre_clientes` con el teléfono que quiera. Sin freno y sin
tope.

**Y lo que lo hace 🟠 y no 🟡**: el manejador llama a `sendWhatsApp(from, …)` con
el teléfono **que viene en la petición**. Hoy `META_WA_TOKEN` no está
configurada, así que esa llamada sale antes de hacer nada. **El día que la
configures para lanzar WhatsApp, el endpoint se convierte en un relé abierto**:
cualquiera podría hacer que tu cuenta de Meta mande mensajes a números
arbitrarios. Eso es suspensión de cuenta y coste.

**Qué haría**: verificar `X-Hub-Signature-256` con el secreto de la app, antes de
tocar la base. Es lo mismo que ya se hace bien en el webhook de Stripe.

Y de paso: el manejador responde `200` **antes** de hacer el trabajo (correcto
para Meta) pero luego hace `await sendWhatsApp(...)`. En Vercel el proceso puede
congelarse al mandar la respuesta, así que **la contestación puede no llegar
nunca**. Es la misma trampa que el guardado de errores.

### 🟡 3.2 — Tres endpoints de facturación devuelven el mensaje del error

`billing-account`, `billing-checkout` y `billing-portal` hacen
`error: error instanceof Error ? error.message : "…"`. Si ese error viene de
Postgres, el mensaje lleva **nombres de tabla y trozos de SQL** al navegador.

**Qué haría**: mensaje genérico al cliente y el detalle a `registra()`, que ya
existe. Tres líneas.

(`cron-appointment-reminders` hace lo mismo con `detail: err.message`, pero
detrás de `CRON_SECRET`, así que es ⚪.)

### 🟡 3.3 — Las defensas viven en capas distintas, y eso hace inauditable el código

Esto no es un fallo: es el motivo por el que **me equivoqué dos veces** en esta
zona.

1. Dije que `reset_password` no tenía freno. **Lo tiene**, pero de un segundo
   mecanismo distinto: `api/auth.js` usa `lib/freno.js` (Postgres) para el login
   y **ocho `new Map()` en memoria** para la recuperación.
2. Dije que `marketplace-vo` no acotaba el `limit`. **Lo acota**, pero en
   `inventoryStore.js`, una capa más abajo (`Math.min(…, 2500)`).

Las dos veces la protección existía **donde no estaba mirando**. Si a mí me pasa
leyendo con intención, le pasará a quien toque esto con prisa: **no se puede
saber si un manejador es seguro leyendo el manejador.**

**Qué haría**: una sola puerta. Que `lib/api/` tenga un envoltorio que declare lo
que cada ruta exige —sesión, freno, método, tope— en un sitio, y que el manejador
solo tenga la lógica. Es el mismo movimiento que ya se hizo con `enrutador.js`
para el reparto.

### 🟠 3.4 — Dos frenos, y el de memoria no funciona en serverless

`api/auth.js` tiene **ocho `new Map()` a nivel de módulo** como limitador. En
Vercel cada instancia tiene su propia memoria, así que «20 intentos por IP cada
10 minutos» son 20 **por instancia** — y cuanto más fuerte se ataque, más
instancias levanta Vercel y **más sube el límite real**.

El login usa el bueno (`lib/freno.js`, contra Postgres). La confirmación de la
recuperación usa el débil, y es la que protege un código de **32 bits**
(`randomBytes(4)`, 8 caracteres hex).

Con 15 minutos de vida, **no es explotable**: harían falta millones de peticiones
por segundo. Por eso es 🟠 y no 🔴. Pero la defensa es mucho más débil de lo que
parece, y alguien copiará el patrón equivocado.

**Qué haría**: mover esos ocho `Map` a `lib/freno.js`, y subir el código a 6
dígitos con bloqueo tras 5 intentos —o mejor, un enlace con testigo largo.

### ✅ 3.5 — Lo que miré y está bien

- **El método HTTP**: 12 manejadores no lo comprueban, pero **todos los que
  escriben sin comprobarlo tienen control de acceso** (son crons). No hay agujero.
- **Autorización por correo del cuerpo**: tres manejadores lo aceptan
  (`entrega-direccion`, `fianza-confirmar`, `import-lead`) y los tres pasan por
  `identidadDeLaPeticion`, donde **el correo de la sesión gana**. En producción
  exige sesión por omisión, porque `VERCEL` siempre está puesta.
- **`marketplace-vo` escribiendo sin sesión**: solo incrementa `view_count`. Lo
  peor que se puede hacer es inflar un número.
- **`workshops-enrich` sin sesión**: tiene `GOOGLE_API_DISABLED = true` escrito a
  mano («cuenta sin crédito»), así que no llama a Google y no hay coste.
- **El webhook de Stripe**: firma HMAC-SHA256 **con `timingSafeEqual`**, y **se
  niega si falta el secreto** (la condición estaba al revés y ya se arregló). La
  escritura de facturas es idempotente (`ON CONFLICT`), así que un reenvío no
  cobra dos veces.
- **Inyección SQL**: cuatro sitios con SQL interpolado y **tres son seguros** —
  lista blanca en `facetas-del-buscador`, constante en `visit-availability`, `$N`
  con array en `import-offers`. El cuarto está en el código muerto de SQL Server.

### 🟡 3.6 — Stripe no garantiza el orden de los eventos

`status = EXCLUDED.status` sin comprobar orden: un `invoice.payment_failed` que
llegue **después** de un `invoice.paid` marca como fallida una factura pagada. No
hace falta un atacante —Stripe no promete orden— y tampoco hay ventana de
reenvío.

**Qué haría**: no bajar de «pagada» a «fallida» si ya hay `cw_paid_at`, y
rechazar firmas con más de cinco minutos.

---

## Lo de fuera de estas tres zonas

Ya estaba en la revisión anterior y sigue en pie:

- 🔴 **`AUTH_EXPOSE_RESET_CODE`** — verificar en Vercel que no es `true`. En
  `.env.local` lo es. Con ese valor la API **devuelve el código de recuperación**
  y cualquiera cambia la contraseña de cualquiera sabiendo solo su correo.
- 🔴 **`AUTH_BILLING_REQUIRE_SESSION`** — verificar que no es `false`.
- 🟠 **`scripts/drop-erp-appointments-main-db.js`** — `DROP TABLE` sin
  confirmación, leyendo `DATABASE_URL` (producción). La tabla existe y la usan 9
  ficheros.
- 🟠 **`api/vehicle-catalog.js`** — código muerto de SQL Server **con inyección
  SQL dentro** (`N'${sb}'`) y `execFileSync`. Borrarlo se lleva también la cadena
  `mssql → tedious → @azure/identity → @azure/msal-node` de `npm audit`.
- 🟠 **`api/find-listing.js`** — 4.628 líneas, cero pruebas, decide qué coches ve
  la gente. **106 de sus 114 funciones son puras**: se prueban en milisegundos.
- 🟠 **Funciones de 300 segundos** — la búsqueda tarda 253 medidos. Cien personas
  buscando a la vez son cien funciones de cuatro minutos.
- 🟡 **395 `useState` en `src/pages`** — `DecisionPage.js` tiene 37 en 2.060
  líneas, más que los 40 de `App.js` en 7.328.
- 🟡 **`JSON.stringify` en `dangerouslySetInnerHTML`** — no escapa `</script>`.
  Hoy solo lleva contenido del repositorio; el día que alguien añada el esquema
  `Vehicle` con el título de un coche rascado, es XSS almacenado.
- 🟡 **Contraseñas** — `scrypt` con los parámetros por omisión de Node (41 ms
  medidos), y comparadas con `===` en vez de `timingSafeEqual`.
- ✅ **`npm audit`** — 52 avisos, 3 críticos, y **ninguno llega al código
  desplegado**: entran por `react-scripts`, `@capacitor/cli`, `mssql` y `docx`.
- ✅ **Secretos en git** — `.env*` está ignorado y **nunca ha habido un `.env` en
  el historial**.

---

## Zona 4 — `api/analyze.js` y `api/find-listing.js` ✔ revisada

### 🔴 4.1 — `/api/analyze` era un proxy abierto a la cuenta de Gemini *(arreglado: `e8e59c0`)*

Acepta `body.prompt` —una cadena **arbitraria** de quien llama—, el navegador
construye el prompt entero (`src/utils/analysisFlows.js`) y el servidor lo relaya
a Gemini sin mirarlo, añadiéndole instrucciones detrás. 8.192 tokens de salida por
llamada, con reintento, en una función de 300 segundos. Y accesible por el comodín
`/api/$1`, **sin sesión, sin clave interna y sin freno**.

Cualquiera podía usar la clave de Gemini como si fuera suya, sin límite.

Lo que más duele no es la factura: si alguien genera contenido que viola las
políticas de Google a través de esa clave, **el incumplimiento es del proyecto**.
Eso no se paga, se pierde. Y hay una tercera consecuencia, invisible: al agotarse
la cuota el análisis cae al respaldo determinista, que contesta 200 con un análisis
de aspecto normal. Quemar la cuota empeora el producto **sin que nada dé error**
—lo dice un comentario del propio fichero.

**`find-listing`**, igual de abierto: cada llamada golpea siete portales,
DuckDuckGo y r.jina.ai durante hasta 300 segundos. Ahí lo caro es que alguien
puede hacer que **los portales de los que depende el producto bloqueen las IPs de
Vercel**.

**Arreglado con freno por IP y no con sesión**, porque el cuestionario no la exige
y pedirla rompería el flujo anónimo: 20 análisis y 12 búsquedas por IP y hora, más
un tope de 40.000 caracteres de prompt. Los dos frenos viven juntos en
`lib/lo-que-cuesta-dinero.js`, no uno en cada endpoint.

### 🟡 4.2 — El arreglo de fondo, que sí es un cambio

Que **el prompt lo construya el servidor** a partir de `answers`, que ya recibe.
Eso convierte el endpoint en «dame un consejo para este perfil» en vez de «ejecuta
este texto». No lo hice porque cambia comportamiento.

### 🟡 4.3 — SSRF por los resultados del buscador

El servidor descarga las URLs que aparecen en los resultados de DuckDuckGo, y
`extractSearchResults` **solo excluye duckduckgo.com**: no hay lista blanca de
dominios. Para dirigir la búsqueda haría falta texto libre en el cuestionario, y
las 29 preguntas son de opciones fijas, así que **no es explotable hoy**. Es una
trampa armada: el día que haya un campo de texto libre, lo es.

---

## Zona 5 — `lib/billingStore.js` ✔ revisada

**Conclusión: es la parte mejor cuidada del repositorio.** Se dice porque saber
dónde NO hace falta esfuerzo vale tanto como saber dónde sí.

### ✅ 5.1 — El dinero está bien representado

`numeric` en las columnas de Postgres —el tipo correcto, sin coma flotante— y
**céntimos como enteros** en el código (`{ hasta: 1, centimos: 199 }`). Ni un
`parseFloat` sobre un importe.

### ✅ 5.2 — El cálculo tiene 11 pruebas

`lib/tasacion.test.js` cubre los tramos, los saltos, que la gratuita descuente un
coche **y no el tramo**, que descuente una vez y no una por coche, que ningún
importe cobrado caiga por debajo del mínimo de Stripe, y que una flota de más de 99
no tenga precio.

### ✅ 5.3 — La gratuita no se regala otra vez cambiando de correo

`contarTasacionesDe` cuenta por `user_id` —con el correo solo como respaldo para
filas viejas— y **nadie puede cambiar su correo**: no hay ningún `UPDATE` de esa
columna. Y ante un fallo al contar, **cobra**, con el motivo escrito: «equivocarse
cobrando se ve y se devuelve; equivocarse regalando no se ve».

### 🟡 5.4 — Tres funciones de dinero sin prueba directa

`updateBillingState`, `contarTasacionesDe` y `appendOrUpdateInvoice`. La última la
leí y es correcta (`ON CONFLICT` idempotente). Las otras dos deciden qué plan tiene
alguien y si se le cobra.

### ⚪ 5.5 — Dos precios tipados como texto

`moveadvisor_user_vehicles.price` y `moveadvisor_user_market_alerts.max_price` son
`character varying`. **Nadie ordena ni compara por ellas** —comprobado—, así que es
un olor y no un fallo. Con texto, «9000» ordena por encima de «10000».

### ⚪ 5.6 — La gratuita se puede pedir dos veces a la vez

Dos clics simultáneos ven los dos `cuantas === 0`. La exposición es **1,99 €**, así
que no merece un cerrojo; queda apuntado para que nadie lo descubra creyendo que es
grave.


### 🟠 5.7 — Si Postgres falla, el garaje contestaba que sí — **las escrituras arregladas, las lecturas no**

Esto lo encontré **después** de dar la zona 5 por revisada, y por eso está al
final: revisé el dinero —los precios, los planes, las carreras— y no revisé
**dónde vive el dato**.

`lib/billingStore.js` tiene dos almacenes. El de verdad es Postgres. El otro es
un fichero del repositorio, `db/billing-data.json`, y en producción ese fichero
**no se puede escribir** —el disco de Vercel es de solo lectura—, así que:

```js
try {
  fs.writeFileSync(BILLING_STORE_PATH, JSON.stringify(safeStore, null, 2));
} catch {
  // read-only filesystem (Vercel serverless) — keep in memory for this invocation
  _memoryStore = safeStore;
}
```

Hasta aquí es una decisión consciente y está comentada. El problema son las
**cuatro funciones del garaje**, que hacen esto:

```js
async function addGarageVehicleByEmail(email = "", vehicle = {}) {
  if (hasPostgresConnection()) {
    try {
      return await addGarageVehicleByEmailPostgres(email, vehicle);
    } catch {
      // Fallback to local JSON store.
    }
  }
  // …y aquí sigue, escribiendo en el almacén local
```

Son `listGarageVehiclesByEmail`, `listGarageVehicleSummariesByEmail`,
`addGarageVehicleByEmail` y `removeGarageVehicleByEmail`. **Cualquier error de
Postgres cae en ese `catch {}` vacío y sigue como si no hubiera pasado nada**,
contra un almacén que en producción es la memoria de una instancia.

Lo que ve la persona, en orden de gravedad:

1. **Añade su coche y se lo guarda «bien».** La función devuelve la lista con el
   coche dentro, la pantalla lo enseña, y desaparece cuando esa instancia se
   recicla. Es un éxito falso sobre los datos de alguien.
2. **Borra un coche y vuelve.** El borrado «funciona» contra un almacén vacío;
   en Postgres el coche sigue estando.
3. **Abre «Mis coches» y está vacío.** La lista devuelve `[]` porque la memoria
   está vacía, no porque no tenga coches.

Y «un error de Postgres» aquí no es hipotético. Es exactamente lo que devolvían
los ocho manejadores que cerraban el pool compartido (§2): *«Cannot use a pool
after calling end on the pool»*. Con el 36,8% de acierto de caché y consultas de
entre 8 y 48 segundos (§9), un tiempo agotado también entra por ahí.

**Lo peor es que la regla correcta ya está escrita en este mismo fichero**, 300
líneas más abajo, para la búsqueda de clientes de Stripe:

> *«Levanta, y no devuelve "no lo conozco". No poder mirar no es lo mismo que no
> ser nuestro: con lo segundo el webhook responde 200, Stripe da el evento por
> entregado y la baja se pierde para siempre.»*

Eso es palabra por palabra lo que les pasa a estas cuatro. Alguien encontró el
caso de Stripe, lo entendió y lo arregló; las cuatro del garaje se quedaron.

**Qué haría**: que el `catch` no exista. La caída al almacén local solo tiene
sentido cuando `hasPostgresConnection()` es falso, que es el desarrollo en local:

```js
async function addGarageVehicleByEmail(email = "", vehicle = {}) {
  if (hasPostgresConnection()) {
    // Si la base no contesta, levanta. Guardar en la memoria de una instancia
    // y decir que sí es peor que decir que no se pudo.
    return addGarageVehicleByEmailPostgres(email, vehicle);
  }
  …
```

En las dos de escribir es que sí o que sí: un guardado que falla no puede
contestar que fue bien. **Hechas**: `addGarageVehicleByEmail` y
`removeGarageVehicleByEmail` ya no caen al almacén local cuando hay base; la caída
solo queda para cuando no hay `DATABASE_URL`, que es desarrollar en local.

En las dos de leer cambia lo que ve la persona —un aviso de error en vez de un
garaje vacío—, y eso es mejor, pero se nota, así que **sigue siendo tu decisión**
junto con las otras cinco de §5.8.

Y de fondo: **31 `catch {}` vacíos en este fichero**. Cuatro son estos. Los
demás hay que mirarlos uno a uno, porque `registra()` ya existe y no hay motivo
para que ninguno siga tragándose el porqué.


### ✅ 5.8 — Ocho acciones contestaban «guardado» cuando la base había dicho no — **arreglado**

§5.7 era el garaje. Esto es lo mismo en **todo el área del cliente**, y lo encontré
al repasar los 31 `catch {}` de `lib/billingStore.js` uno a uno, que era lo que
quedaba pendiente.

Las diecinueve funciones de datos del cliente tienen todas esta forma:

```js
async function addAppointmentByEmail(email = "", appointment = {}) {
  if (hasPostgresConnection()) {
    try {
      return await addAppointmentByEmailPostgres(email, appointment);
    } catch {
      return [];
    }
  }
  return [];
}
```

Y `lib/api/billing-account-handler.js` las usa así:

```js
const appointments = await addAppointment(identity, body.appointment || body);
return res.status(200).json({ ok: true, appointments, message: "Cita guardada." });
```

Si el `INSERT` falla, el `catch` devuelve `[]` y la respuesta es:

```json
{ "ok": true, "appointments": [], "message": "Cita guardada." }
```

**HTTP 200, `ok: true`, y la palabra «guardada».** Nada se guardó.

Las ocho que escriben, con su mensaje literal:

| Acción | Lo que contestaba |
|---|---|
| `appointment_add` | «Cita guardada.» |
| `appointment_delete` | «Cita eliminada.» |
| `valuation_add` | **«Tasacion guardada.»** |
| `vehicle_state_upsert` | «Estado de vehiculo actualizado.» |
| `saved_offer_add` | «Oferta guardada.» |
| `saved_offer_remove` | «Oferta eliminada.» |
| `garage_add` | (sin mensaje, pero 200 y `ok: true`) |
| `garage_remove` | «Vehiculo eliminado.» |

**Corrección.** Escribí diez y son ocho: puse `maintenance_add` y
`insurance_upsert` en la lista y esas dos **ya estaban bien**. Sus funciones no
tienen `catch`: llaman a Postgres y dejan pasar el error, que es exactamente lo
que había que hacer con las otras seis. Me equivoqué al contarlas con una lista
escrita a mano en vez de mirar cada función, y me di cuenta al ir a arreglarlas.

Y resultaron ser la prueba de que el arreglo era el correcto: lo único que hice
fue dejar las demás como esas dos.

Y las siete que leen —`appointments_list`, `valuations_list`,
`maintenances_list`, `insurances_list`, `vehicle_states_list`,
`saved_offers_list` y el re-listado de `appointment_delete`— contestan **lista
vacía**: no «no he podido mirar», sino «no tienes nada».

**Quince acciones en total.** Y la peor es `valuation_add`: la tasación es el
producto.

Además el array vacío se devuelve al navegador, así que la pantalla enseña la
lista **vacía justo después de decir que se guardó**. Quien esté delante ve las
dos cosas a la vez y no puede saber cuál es la verdad.

**Cómo llega a pasar.** Hace falta que Postgres falle, y en esta base falla:
son los ocho manejadores que cerraban el pool compartido (§2), y con el 36,8 % de
acierto de caché y consultas de 8 a 48 segundos (§9) un tiempo agotado entra por
la misma puerta. No es un caso de laboratorio.

**Qué haría.** Esto no es un `catch` que haya que mejorar, es un `catch` que no
tiene que existir:

```js
async function addAppointmentByEmail(email = "", appointment = {}) {
  if (hasPostgresConnection()) {
    // Si la base no acepta la cita, quien llama tiene que enterarse. Decir que
    // se guardó y devolver una lista vacía es lo peor de las dos opciones.
    return addAppointmentByEmailPostgres(email, appointment);
  }
  return [];
}
```

Y el manejador contesta 503 con un mensaje que se pueda leer. **Un guardado que
falla no puede contestar en pasado.**

**Hecho, las ocho.** El `catch` fuera, y `billing-account-handler.js` envuelto:
si algo levanta, va a `registra()` y contesta 503 con *«No hemos podido
guardarlo. Vuelve a intentarlo en un momento.»* Un 503 y no un 500 porque lo que
ha pasado es que la base no pudo atender, y eso se reintenta.

**Las siete de leer siguen igual, y es tu decisión.** Cambian lo que ve la gente:
un aviso de error en vez de una lista vacía. Yo lo cambiaría, y es la misma frase
que ya está escrita en este repositorio: *«No poder mirar no es lo mismo que no
ser nuestro.»*

### ✅ 5.9 — Y los otros quince `catch {}` de ese fichero están bien

Repasé los 31. Quince no son el problema:

- **Cinco son de limpiar la entrada o dar formato**: `sanitizeAttachment` y
  `sanitizeAttachmentArray` recomponen lo que llega mal, `toEsDateTimeText`
  devuelve cadena vacía si la fecha no se puede formatear,
  `resolvePostgresUserIdentity` devuelve identidad sin id. Tragar ahí es correcto.
- **Cinco son caídas a una segunda consulta**, que es resistencia de verdad y no
  silencio: `listSolicitudesByEmailPostgres` tiene dos, y
  `getUserMobilityDataByEmailPostgres` cae de una CTE a consultas sueltas si la
  CTE falla. El dato acaba llegando.
- **Tres son del almacén en fichero** y están comentados: `ensureStoreDirectory`,
  `writeStore` y `readStore`, el asunto de §5.7.
- **Dos devuelven un cero o un vacío que no afirma nada de nadie**:
  `countGarageVehiclesByEmailPostgres` y el aviso de escaparate de
  `getUserMobilityDataByEmailPostgres`, que tiene su comentario: *«Sin escaparate
  legible se dice lo que sí se sabe y nada más.»*

O sea que el problema no es que el fichero trague errores por costumbre. Es que
dieciséis sitios concretos eligieron el vacío como respuesta, y en diez de ellos
el vacío va acompañado de un «hecho».

---

## Zona 6 — Las 64 pantallas ✔ revisada

38.938 líneas, **395 `useState`**, 30 que piden datos.

### 🟡 6.1 — Cuatro funciones del garaje, copiadas, con seis comportamientos

El garaje del usuario se cachea en `localStorage`, y las funciones que lo leen y
escriben están **copiadas**, no importadas:

| Función | Copias | Versiones distintas |
|---|---:|---:|
| `getGarageStorageKey` | 7 | 1 |
| `getDashboardGarageStorageKey` | 3 | 1 |
| **`readGarageVehicles`** | **7** | **6** |
| `writeGarageVehiclesCache` | 3 | 3 |

Y hay **tres sitios de almacenamiento**: la clave del garaje, la del panel y un
prefijo genérico sin correo. Cada pantalla mira en un subconjunto distinto:

- `ServiceAppointment` y `ServiceMaintenance` leen **las dos** claves y mezclan;
- `ServiceIdCarsManage` lee la del garaje y, si está vacía, cae al **prefijo
  genérico**, que hoy **nadie escribe**;
- `UserDashboardVehicles` y `UserDashboardOperations` leen **solo** la del garaje.

**No hay fallo hoy**, y lo comprobé: todos los que escriben escriben la clave del
garaje, así que el dato siempre aterriza donde todos miran. Lo que queda es la
fragilidad: la corrección depende de un invariante que **nadie ha escrito** —«todo
el que escriba tiene que escribir la clave del garaje»—. Rómpelo en una pantalla y
otra enseña un garaje vacío, en silencio, a alguien que sí tiene coches.

Y no está cubierto: `lib/el-garaje-es-de-su-dueno.test.js` prueba el garaje del
**servidor** —propiedad por correo en Postgres—, no esta caché.

**Qué haría**: un módulo, `src/utils/elGarajeGuardado.js`, con `laClave`, `lee` y
`escribe`, importado por las siete. Y decidir si la clave del panel hace falta: hoy
la escriben dos pantallas y **nadie depende de ella en exclusiva**.

### 🟡 6.2 — `normalizeText` definida en 10 pantallas

Y `src/utils/offerHelpers.js` **ya la exporta**. Diez copias de una función que
existe. Igual `Logo` (5 pantallas) y `fmtDia` (3).

### 🟡 6.3 — 2.725 objetos de estilo en línea

`style={{ … }}` escrito 2.725 veces, 251 de ellas en `UserDashboardVehicles.js`.
Dos consecuencias: cada uno crea un objeto nuevo en cada pintada —lo que anula
cualquier `React.memo` de los hijos— y **no hay sistema de diseño**: cambiar un
color son 2.725 sitios.

### ✅ 6.4 — Los estados de carga y error están mejor de lo que parece

Cinco pantallas salieron «sin estado de carga» con mi patrón y al mirarlas eran
falsos positivos. `ConfirmarVisitaPage` —el enlace que llega por correo— tiene una
**máquina de estados** con cinco ramas (`confirmando`, `hecha`, `ocupada`,
`caducada`, `fallo`), que es mejor que un booleano. Mi patrón buscaba la palabra
«cargando».

---

## Zona 7 — `scripts/`, la parte destructiva ✔ revisada

### 🔴 7.1 — Un `node scripts/reset-…` borraba 2,8 millones de filas *(arreglado: `357fa8f`)*

Tres de los ocho guiones destructivos no pedían nada. El peor terminaba en un
`(async () => { … })()`: bastaba ejecutarlo para hacer
`DELETE FROM moveadvisor_market_offers` —**el 88% de la base**— y reponer 42 filas
escritas a mano. Dentro de una transacción, así que **el desastre es el éxito**.

Dos se borraron porque **no tenían propósito**: eran de mayo y abril, de la época
de SQL Server. El tercero era peor de lo que yo mismo dije: `erp_appointments`
**está viva en la base principal** y la mudanza a `ERP_DATABASE_URL` que anunciaba
el commit de julio **nunca se hizo** —esa variable no existe en ningún sitio.

El de leasys se quedó con `--borra`, y dice a qué base apunta antes de nada.

### 🟠 7.2 — 87 ofertas de un proveedor que ya no existe, servidas a los usuarios

No hay **ni una línea** de código que mencione leasys, y hay **87 ofertas
`leasys-%`** vivas en el marketplace. Nadie las verifica. Si se borran o se marcan
inactivas es decisión de producto.

### 🟡 7.3 — 119 guiones leen `DATABASE_URL` sin distinguir entorno

Y en la máquina de trabajo esa variable apunta a **producción**. El vigilante nuevo
cubre los destructivos; los otros escriben, y un error ahí se arregla, pero
conviene saberlo antes que después.

---

## Zona 8 — Los planes de consulta ✔ revisada

Medido contra la base de producción con `EXPLAIN (ANALYZE, BUFFERS)`.

### 🟠 8.1 — La consulta central del consejero tarda 8,6 segundos y toca 520 MB

Perfil realista —diésel en Madrid, 5.000-30.000 €—:

```
Execution Time: 8594 ms
Buffers: shared hit=3302 read=67126 dirtied=66170 written=52343
Index Scan using ix_mmo_activas_provincia_combustible
  (cost=0.43..100.80 rows=24) (actual rows=69426)
```

Tres cosas, en orden de importancia:

1. **El índice de la migración 0015 sí se usa.** Ese arreglo funcionó.
2. **Toca 67.126 páginas —unos 520 MB— para contestar una pregunta.** Porque
   agrupa **69.426 filas** en tiempo de petición. No es un problema de índice: es
   la forma de la pregunta.
3. **El planificador estima 24 filas donde hay 69.426**: se equivoca por 2.900×.
   Son columnas correlacionadas —«Madrid» y «diésel» no son independientes, y el
   planificador multiplica sus frecuencias como si lo fueran— y por eso acaba
   ordenando en disco (`external merge Disk: 2144kB`).

**Lancé `ANALYZE` y no lo arregla**: la estimación sigue en 24, y la segunda
pasada no es más rápida —lo que descarta que sean bits de ayuda por asentar—.

### 🔴 8.2 — Y eso explica los 253 segundos de la búsqueda

`lib/los-modelos-que-hay.js` la ejecuta **dos veces** cuando el perfil es
estrecho:

```js
const conTres = await preguntar(LOS_MINIMOS);
return conTres.length ? conTres : preguntar(1);
```

Y el propio fichero ya tiene medido el caso malo: *«Con un perfil de SUV premium
alemán en Madrid la consulta tardó **104 segundos**»*. Dos veces eso, más los ocho
portales que se rascan en vivo, es la búsqueda de 253 segundos.

Alguien midió los 104 segundos y **envolvió la consulta en un tiempo límite** para
que no se llevara por delante el análisis. Es una tirita razonable; no es el
arreglo.

### 🟠 8.3 — El arreglo ya está inventado en este repositorio, pero no cubre esta pregunta

Hay **dos vistas materializadas** refrescadas por un cron cada hora:

| Vista | Filas | Columnas |
|---|---:|---|
| `mmo_modelos` | 24.775 | `marca, grafia, modelo, del_catalogo, n` |
| `mmo_facetas` | 7.130 | `tipo, valor, n` |

O sea: el patrón existe y funciona —leer `mmo_modelos` tarda **58 ms**—. Pero
guarda marca y modelo **globales**, sin provincia, sin combustible y sin precio,
que son justo las tres dimensiones que el consejero necesita.

**Qué haría**: una tercera vista con `(provincia, combustible, banda de precio) →
marca, modelo, cuántos, desde`, refrescada por el cron que ya existe. Eso convierte
8,6 segundos en milisegundos y se lleva por delante la mitad de los 253.

La banda de precio es la decisión de diseño: en tramos (0-10k, 10-20k…) la vista
es pequeña y la respuesta aproximada; sin tramos no cabe.

### ✅ 8.4 — No se podía saber qué consulta es lenta en producción — **hecho**

`pg_stat_statements` no estaba instalada —las extensiones eran `plpgsql` y
`unaccent`—. Sin ella, cualquier trabajo de rendimiento era a ciegas: no había
forma de saber qué consulta consume el tiempo, cuántas veces se llama ni desde
cuándo. Y todo lo de arriba lo encontré a mano, buscando donde se me ocurrió mirar.

La declara `migrations/0018` y se lee con `npm run consultas-lentas`. En el primer
minuto ya enseñó cuatro cosas que yo no había mirado, dos de ellas en §9.

### 🟡 8.5 — Planificar cuesta más que ejecutar en las consultas pequeñas

En el listado del marketplace: `Planning Time: 9,0 ms` contra
`Execution Time: 3,7 ms`. No es grave, pero con **31 índices** en la tabla grande
el planificador tiene mucho que evaluar en cada consulta. Es un argumento más para
tirar los ocho índices de 523 MB que nadie lee (§1.1).

### ⚪ 8.6 — Las facetas se construyen con texto sin normalizar

Una fila de muestra de `mmo_modelos`:

```json
{"marca":"\"furgoneta camper ford\".", "modelo":"Transit custom \"Negociable\"", "del_catalogo":false}
```

Marca y modelo vienen de lo rascado, con comillas, puntos y texto descriptivo
dentro. Hay un `del_catalogo` que distingue los que están en el catálogo de los que
no, así que alguien lo pensó y se filtran en algún sitio; conviene comprobar que el
filtro se aplica en **todas** las pantallas que enseñan facetas.

---

## Zona 9 — La base, por debajo de las consultas ✔ revisada

Con `pg_stat_statements` encendida y los contadores de `pg_stat_database`. Esta zona
es la que reencuadra todo lo demás.

### 🔴 9.1 — El acierto de caché es del 36,8 %

Una base sana está por encima del 99 %. Con 36,8 %, **dos de cada tres lecturas de
página van al almacenamiento** en vez de a memoria.

La razón, con los números delante:

| | |
|---|---|
| La base pesa | **7.294 MB** |
| `shared_buffers` | **128 MB** |
| `neon.file_cache_size_limit` | 2.997 MB (y cambia solo: se vio en 607, 1.461, 2.229 y 2.997) |

El conjunto de trabajo —la tabla de 6,7 GB más sus 2,35 GB de índices— es **tres
veces la caché**. De ahí salen los 67.000 saltos aleatorios de la consulta del
consejero, y de ahí sale que la misma consulta tarde 4.384 o 18.721 milisegundos
según lo que esté cacheado en ese instante.

Esto **no se arregla con SQL**. Las dos salidas son: hacer el conjunto de trabajo
más pequeño —tirar los 523 MB de índices que nadie lee (§1.1), archivar ofertas
viejas— o pagar una instancia de Neon con más memoria. Es una decisión de coste.

### 🟠 9.2 — 294 GB escritos en ficheros temporales

25.957 ficheros temporales, **294 GB**. Con `work_mem = 4 MB`, cualquier ordenación
o agrupación mayor de eso se va a disco.

Probé a subirlo en mi sesión —4, 32 y 64 MB— sobre la consulta del consejero y **no
pude demostrar nada**: las tres ordenaban en memoria y los tiempos salieron 8.513,
2.965 y 16.031 ms de mediana, con un caso de 48 segundos en la primera. O sea: para
**esa** consulta `work_mem` no es la restricción.

Así que los 294 GB vienen de otras: el `REFRESH MATERIALIZED VIEW` sobre 2,8
millones de filas y las cargas masivas, que son las que de verdad ordenan mucho.
Subir `work_mem` sigue siendo probablemente lo correcto, pero **hay que decidirlo
con datos de esas consultas**, no con las que se me ocurrieron a mí.

### 🟠 9.3 — 11 bloqueos mutuos, y un 3,8 % de transacciones deshechas

`deadlocks = 11` y 120.621 transacciones deshechas de 3.190.293. Los catorce
scrapers que insertan usan `ON CONFLICT` —comprobado uno a uno— así que no es un
problema de duplicados; son escrituras concurrentes tocando las mismas filas en
distinto orden. Once no es una emergencia, pero no es cero, y con más scrapers en
paralelo sube.

### 🟡 9.4 — El refresco de las facetas cuesta 63 s y corre cada hora

`REFRESH MATERIALIZED VIEW CONCURRENTLY mmo_facetas`: **63 segundos**, medido. Y hay
dos crones horarios, uno por vista.

Pero el **63 % de todas las escrituras de la semana caen en una sola hora, las
07h** —808.326 filas de 1.289.768—. El resto del día son entre 2.000 y 44.000
cambios por hora.

Y el propio manejador dice que **«si no se refresca, no se rompe nada»**: los
desplegables enseñan lo de la vez anterior y una marca nueva tarda en aparecer.

O sea: se refresca 24 veces al día para recoger algo que cambia una vez al día. Son
unos **46 minutos diarios escaneando 4,3 GB**, y lo que es peor, vacían la caché dos
veces por hora — que es justo lo que hace inmedibles todas las demás consultas.

**Qué haría**: mover los dos crones de cada hora a una vez al día, después de la
carga de las 07h. Cambia el ritmo de frescura de los desplegables, así que es
decisión de producto, pero el propio código ya dice que la frescura ahí no importa.

### ✅ 9.5 — Los catorce scrapers insertan bien

Los 14 flujos de n8n que escriben en la tabla grande usan `ON CONFLICT` —los miré
uno a uno—. Ni claves duplicadas ni filas repetidas por esa vía.

(Dos `comprueba-as24-*.js` salieron «sin ON CONFLICT» en mi primer barrido y era
falso positivo: son comprobadores que verifican el SQL *generado*, no scripts que
inserten.)

### ✅ 9.6 — Los 1.098 `UPDATE` de una fila no son un problema

Salieron los cuartos en tiempo total —17,9 s en 1.098 llamadas de 16 ms— y los
apunté como algo a agrupar. Mirándolo: vienen de un flujo de n8n que procesa anuncio
por anuncio porque n8n funciona así, repartidos en una pasada nocturna. 18 segundos
de base al día no es nada. **Le di más importancia de la que tiene.**

### Y la conclusión de método, que vale más que los hallazgos

Intenté optimizar esta base midiendo, tres veces, y las tres fallé:

1. propuse una vista materializada que habría dado cuentas equivocadas;
2. creé dos índices cubridores; el planificador no usó ninguno, y uno **empeoró** el
   caso estrecho de 6,7 a 11 segundos;
3. probé tres valores de `work_mem` y los tiempos salieron sin orden ni sentido.

La causa está en §9.1: con un 36,8 % de acierto de caché y una caché que Neon
redimensiona sola, **el ruido de fondo es mayor que cualquier mejora que se quiera
demostrar**. Tres medidas de la misma consulta: 4.384, 5.920 y 18.721 ms.

Lo que toca ahora **no es más `EXPLAIN` a mano**: es dejar que
`pg_stat_statements` acumule unos días de tráfico real y decidir sobre medias de
miles de llamadas. Está encendida y hay `npm run consultas-lentas`.

---

## Zona 10 — `api/auth.js` entero ✔ revisada

1.873 líneas, leídas de arriba abajo. Las nueve acciones —`login`, `register`,
`logout`, `change_password`, `request_password_reset`, `reset_password`,
`get_consents`, `update_consents`, `save_consents`— más el `GET` que contesta
quién eres.

Lo primero, porque importa: **esto está bien escrito**. El login tiene freno en
base por correo y por IP, un solo mensaje para «no existe» y «contraseña mala»
—con su comentario explicando que la diferencia es una lista de clientes—, las
sesiones son un testigo aleatorio guardado en hash, todo el SQL va
parametrizado, los correos y las IP se enmascaran en el registro. Los hallazgos
de abajo son cosas que faltan, no cosas hechas mal.

### ✅ 10.1 — Cambiar la contraseña no echaba a nadie de las otras sesiones — **hecho**

Ni `change_password` ni `reset_password` borran las demás sesiones del usuario.
Lo único que se borra en el reset es la fila que guardaba el código:

```js
await updateUserPasswordPostgres({ userId: user.id, passwordSalt, passwordHash });
await deleteSessionByIdPostgres(resetSessionId);   // la del código, no las del usuario
```

Y no hay ningún `DELETE FROM moveadvisor_sessions WHERE user_id = …` en todo el
fichero —lo busqué—.

Por qué es lo peor de la zona: **recuperar la contraseña es justo lo que hace
alguien que cree que le han entrado**. Hace el reset, cree que ha cerrado la
puerta, y la cookie del otro sigue sirviendo. Y sigue sirviendo **para siempre**:
la sesión es deslizante —30 días que se renuevan en cada petición, §10.6— sin
tope absoluto, así que basta con usarla una vez al mes.

**El arreglo es una línea** y el índice ya existe
(`ix_moveadvisor_sessions_user_id`): antes de crear la sesión nueva,

```sql
DELETE FROM moveadvisor_sessions WHERE user_id = $1
```

en las dos acciones. **Puesto**, con `deleteAllSessionsForUserPostgres` y su
versión local, y llamado **antes** de crear la sesión nueva: al revés se borraría
también la que se acaba de dar y la persona se quedaría fuera de su propio cambio
de contraseña. La prueba comprueba ese orden, no solo que la llamada exista.

En el reset sustituye al borrado de la fila del código, porque esa fila lleva el
`user_id` del usuario —así la encuentra `findValidResetPostgres`— y el borrado por
usuario ya se la lleva.

Sí cambia lo que nota la gente: te desloguea del móvil al cambiar la contraseña en
el portátil. Es lo que hace todo el mundo y es lo que se espera de ese botón.

### 🟠 10.2 — `register` contesta si un correo tiene cuenta — **el freno hecho, el 409 no**

El login se cuida mucho de no decirlo. Y luego `register` contesta esto:

```js
if (existingUser) {
  return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
}
```

Con una lista de correos y una petición por cada uno se sabe quién tiene cuenta
aquí, sin acertar ni una contraseña. **El trabajo de `login` queda deshecho por
el de al lado.**

Y `register` **no tiene freno de ningún tipo**: los únicos `FRENO.pide` del
fichero están en `login` y en `request_password_reset` (líneas 1416, 1417, 1758,
1759). Así que el barrido se puede hacer tan rápido como aguante la máquina, y
además se pueden crear cuentas sin límite.

**Qué haría**, en dos pasos que se pueden hacer por separado:

1. **Hecho**: `registro` (5 por correo cada cuarto de hora) y `registroPorIp`
   (10) en `LIMITES`, y el `FRENO.pide` al principio de `register`. No cambia
   nada de lo que ve nadie que no esté barriendo.
2. **Pendiente, y es tuyo**: el 409. Lo que hacen las tiendas grandes es
   contestar lo mismo que en un alta buena y mandar un correo al dueño de la
   dirección diciendo que alguien ha intentado registrarse con ella. Eso cambia
   lo que ve la gente, así que es decisión de producto.

Y hay que decirlo claro: **el freno estrecha el agujero, no lo cierra**. Quien
tenga paciencia y muchas IP sigue pudiendo preguntar de una en una. El que cierra
es el punto 2.

### ✅ 10.3 — El mensaje único del login se delataba por el tiempo — **hecho**

El comentario dice, literalmente: *«se cuenta antes de comprobar nada, para que
un intento fallido cueste igual que uno acertado y no se pueda medir la
diferencia»*. **No se cumple.** El código es:

```js
const acierta = Boolean(user) && hashPassword(password, user.passwordSalt) === user.passwordHash;
```

Si la cuenta no existe, `user` es `null`, el `&&` corta y `hashPassword` **no se
llama**. Si existe, se llama. Y medido en esta máquina:

```
scryptSync 64B, 7 pasadas:  43,7  43,8  44,1  46,2  46,4  46,6  47,9 ms
```

**46 milisegundos de diferencia** entre un correo que existe y uno que no. Eso
se mide desde cualquier parte con promediar unas cuantas peticiones: está muy
por encima del ruido de la red. O sea, el 401 idéntico no sirve de nada porque
el reloj lo cuenta.

**El arreglo** es el de siempre: calcular el hash igual cuando no hay usuario,
contra una sal de pega, y tirar el resultado.

```js
const SAL_DE_PEGA = crypto.randomBytes(16).toString("hex");
const hashRecibido = hashPassword(password, user?.passwordSalt || SAL_DE_PEGA);
const acierta = Boolean(user) && hashRecibido === user.passwordHash;
```

Cuesta 46 ms en el caso que antes era gratis. Es el precio de que los dos casos
se parezcan. Puesto, con el comentario y las medidas dentro.

### ✅ 10.4 — El 500 de auth devolvía el mensaje de error de Postgres — **hecho**

```js
} catch (err) {
  return res.status(500).json({
    ok: false,
    error: "Error interno del servidor. Intentalo de nuevo.",
    details: normalizeText(err?.message) || "Unexpected auth handler error",
```

Es el mismo fallo que los tres de facturación (§5): `err.message` de Postgres
lleva nombres de tabla, de columna, de restricción y a veces el valor que
falló. En el endpoint de autenticación es donde más se busca esa información.

`details` fuera, y el error a `registra()` —que ya existe y ya guarda en
`moveadvisor_errores`—. Y el front no se queda sin mensaje: `App.js` lee
`data.details || data.error` en los dos sitios donde lo usa, así que ahora enseña
el de `error`, que además está escrito para una persona.

### 🟡 10.5 — Los códigos de recuperación viven en la tabla de sesiones

El reset no tiene tabla propia: se guarda como una fila de
`moveadvisor_sessions` marcada poniendo el literal `RESET` en la columna
`user_agent`.

```sql
WHERE user_id = $1 AND token_hash = $2 AND user_agent = 'RESET' AND expires_at > NOW()
```

Miré si se puede abusar —mandar `User-Agent: RESET` al entrar, y usar el testigo
de tu sesión como código de recuperación— y **no se puede**, porque el `user_id`
está en el `WHERE`: como mucho te resetearías tu propia contraseña, que ya
podrías. Está bien.

Pero la seguridad de esto depende **de esa única cláusula**. Quien mañana añada
un «cerrar todas las sesiones» y escriba la condición del `user_agent` al revés,
o quien haga una consulta de sesiones por testigo sin el `user_id`, abre una
puerta sin darse cuenta. Una columna `tipo` o una tabla aparte cuesta una
migración y quita el truco de en medio.

### 🟡 10.6 — Cada petición autenticada escribe en la base

`resolveSessionUser` alarga la caducidad **en cada acceso válido**:

```js
const newExpiresAt = getSessionExpiryIso();
await extendSessionExpiryPostgres(session.id, newExpiresAt);
```

Es lo normal en una sesión deslizante, pero significa que **no hay ni una lectura
de sesión que no escriba**: un `UPDATE` por carga de página y por usuario. Hoy,
con 7 usuarios, da igual. Con tráfico es la tabla más escrita del sistema por
algo que no lo necesita.

**Qué haría**: alargarla solo cuando quede menos de la mitad del plazo. Misma
sesión deslizante, una escritura de cada muchas. Y de paso poner un **tope
absoluto** —90 días desde que se creó, se use o no—, que es la otra mitad de
§10.1.

### 🟡 10.7 — Seis caracteres de contraseña

`password.length < 6`, en el alta y en el cambio. Para 2026 es poco —la
recomendación estándar son 8 como mínimo, sin reglas de composición—, y aquí la
gente sube su coche y sus papeles. No hay comprobación contra las contraseñas
más usadas.

Subirlo a 8 es una línea. Y **está bien puesto donde está**: la comprobación va
en el alta y en el cambio, no en el login, así que quien ya tiene una de 6 sigue
entrando y se le pide la nueva cuando la cambie.

### ✅ 10.8 — Tres campos del alta se leían del cuerpo sin parsear — **hecho**

Veinte campos se leen de `body`, que es `parseBody(req.body)`. Pero tres se leen
de `req.body` directamente:

```js
const clientType = String(req.body?.clientType || "individual");
const company_name = String(req.body?.company_name || "");
```

Si el cuerpo llega como cadena en vez de objeto —que es para lo que existe
`parseBody`—, esos tres se pierden en silencio: un alta de empresa se guardaría
como particular, sin razón social y sin un error. Hoy Vercel entrega el JSON ya
parseado, así que no pasa; el día que cambie el camino de entrada, sí.

Ahora los tres se leen de `body`, como los otros veinte.

### ✅ 10.9 — Tres restos — **hechos**

- `execFileSync` se importa en la línea 5 y **no se usa en ninguna parte**. En el
  fichero de autenticación, un `require("child_process")` que no hace nada es lo
  primero que quitaría.
- `let _pgPool = null;` en la 586, tampoco se usa: quedó de cuando había pool
  propio, antes de `elPoolObligatorio()`.
- La línea 12 tiene el guion largo roto —el mismo destrozo de codificación que
  vigila el test de las tildes en `src/`; este fichero no entra—. Y el fichero
  empieza con un BOM (`ef bb bf`).

### ✅ 10.10 — Cosas que miré y están bien

- **Los ocho `Map` de frenos en memoria no gotean.** Iba a apuntarlo como fuga
  —una instancia caliente acumulando una entrada por cada correo y cada IP— y
  `runSecurityMaintenance()` se llama al principio de cada petición y **borra las
  claves**, no solo los sellos de tiempo (`cleanupLimiterBucket`, línea 545).
  Séptima vez que doy algo por ausente y está unas líneas más arriba.
- **Todo el SQL va parametrizado.** Ni una interpolación en las doce consultas.
- **Comparar hashes con `===` no es un problema aquí.** No es tiempo constante,
  pero lo que se compara es un digest de 64 bytes que el atacante no controla:
  para aprovechar el tiempo habría que ir adivinando el hash byte a byte, y cada
  byte cambia el resultado entero. Distinto de §10.3, donde lo que se mide no es
  la comparación sino si se hace o no.
- **Una contraseña gigante no tumba nada.** Pensé que `scryptSync` sobre una
  cadena enorme sería un ahogo fácil. Medido: 4 millones de caracteres cuestan
  80 ms contra los 44 de una normal, menos del doble. Y el cuerpo de la petición
  ya lo limita Vercel.
- **`AUTH_COOKIE_SECURE` está bien resuelto.** Por omisión `Secure` en
  producción y en Vercel, sin él en local, con el comentario explicando por qué
  era al revés antes. Y tiene pruebas: `cookieSegura` se exporta solo para eso.
- **La sesión por `Authorization: Bearer` es el mismo papel en otro sobre**, no
  un segundo mecanismo: mismo `sessionId.token`, misma fila, misma comprobación.
- **El secreto de sesión por omisión no permite falsificar nada.** Iba a
  apuntarlo como grave —`AUTH_SESSION_SECRET` tiene un valor de reserva escrito
  en el repositorio— y no lo es: el testigo no va firmado, es aleatorio y se
  busca por su hash en la tabla. El secreto es un pimiento, no una llave. Sin un
  testigo válido no hay nada que firmar.


### 10.11 — Lo que vigila que no vuelva

`lib/ninguna-puerta-sin-freno.test.js`, cinco comprobaciones. La regla general
es la primera: **toda acción de auth que se pueda llamar sin cookie de sesión
tiene que frenar dentro de su bloque**. Hoy son cuatro —`login`, `register`,
`request_password_reset`, `reset_password`—; la que se añada mañana entra sola.

Las otras cuatro son de forma: que el alta frene por IP y no solo por correo, que
el hash del login no viva detrás de un cortocircuito, que `SAL_DE_PEGA` salga de
`randomBytes`, y que el 500 no devuelva `err.message`.

**Comprobé que cazan.** Las lancé contra el `api/auth.js` de antes del arreglo
—el de `git show HEAD:api/auth.js`— y las cinco fallaron. Una prueba escrita
después del arreglo y que no se prueba contra el antes no vale nada, y ya me pasó
en esta revisión: escribí unas de rutas generadas a partir de la misma tabla que
probaban, y pasaban aunque renombrara una ruta.

Y **falló contra sí misma la primera vez**: el comentario que puse en `auth.js`
para explicar el cortocircuito cita el cortocircuito, y el patrón lo encontró en
la prosa. Tercera vez en esta revisión que un ejemplo dentro de un comentario
dispara mi propia prueba. Ahora se quitan los comentarios antes de mirar, lo que
además hace más fuertes las cinco: hablan del código y no de lo que el código
dice de sí mismo.

---

## Zona 11 — `scripts/`, el resto, y lo que los lanza ✔ revisada

212 ficheros. No los he leído uno a uno; he ido a lo que puede hacer daño:
credenciales, quién escribe en la base, cómo se conectan y **quién lanza todo
esto**. Y lo que ha salido no está en `scripts/`, está en el fichero que decide
qué se comprueba antes de desplegar.

### ✅ 11.1 — El CI no corría 2.624 de las pruebas del repositorio — **arreglado**

`.github/workflows/backend-validation.yml` corre en cada empujón a `main` y en
cada PR. Y lo que corría era:

```
npm run test:backend-ci   →  marca, og, correo, auth-local, auth-local:strict,
                             auth-security-local
npm run build
```

Eso es todo. **Ni `test:lib` —1.690 pruebas— ni las 934 del front.**

O sea que toda la red de seguridad de este repositorio —incluidas las de esta
revisión: el pool compartido, los scripts que borran, lo que cuesta dinero, las
puertas sin freno— dependía de que alguien se acordara de lanzarla a mano antes
de empujar. Y yo mismo me dejé de correrla dos commits en esta sesión, y empujé
dos pruebas rojas.

Puestos los dos pasos, antes del `build`.

### 🟠 11.2 — Y `npm run test:lib` corre 934 de las 1.690 en Linux

Esto lo encontré al ir a añadirlo. El script es:

```json
"test:lib": "node --test lib/**/*.test.js"
```

Sin comillas. En Windows funciona porque `cmd` no expande nada y el patrón llega
entero a node, que sí entiende `**`. **En Linux y en macOS lo expande la shell
primero**, y `bash` sin `globstar` convierte `lib/**/*.test.js` en
`lib/*/*.test.js`: solo las subcarpetas.

Medido:

| Lo que se corre | Ficheros | Pruebas |
|---|---:|---:|
| `lib/*/*.test.js` —lo que ve bash— | 77 | **934** |
| `lib/*.test.js` —lo que se queda fuera— | 61 | **756** |
| Con el patrón entre comillas | 138 | **1.690** |

Y los 61 que se caen son los que están **directamente en `lib/`**, que es donde
vive casi todo lo que he escrito esta revisión.

En el workflow lo he escrito con `find`, y el camino hasta ahí tiene una segunda
parte que vale más que la primera.

**Lo puse entre comillas y el CI se puso rojo en el primer empujón.** node sabe
expandir ese patrón él mismo, pero **solo desde la versión 22**, y el workflow usa
`node-version: 20`:

```
Could not find '/home/runner/work/Mobility-Advisor/Mobility-Advisor/lib/**/*.test.js'
```

En local pasó porque aquí hay una Node 24. Había verificado los finales de línea
—cloné el repositorio con LF y corrí las dos suites— y **no verifiqué la versión
de node**, que era el otro eje. Dije que el CI iba a pasar y no pasó.

Queda con `node --test $(find lib -name '*.test.js')`, que no depende ni de la
shell ni de la versión de node. 1.699 pruebas, comprobado.

Y de paso: el CI que acabo de añadir cazó un fallo de mi propio cambio a los
cuarenta segundos de empujarlo. Es exactamente para eso.

**El script de `package.json` sigue mal** y no lo he tocado porque tu otra sesión
lo tiene abierto: cámbialo a `node --test $(find lib -name '*.test.js')` cuando
cierres lo tuyo —o a las comillas, si subes la Node del proyecto a la 22—.

### ✅ 11.3 — El importador de talleres no verificaba el certificado — **arreglado**

`scripts/import-official-workshops.js`, que baja los registros oficiales de
talleres de tres comunidades **y los mete en la base**:

```js
const sslAgent = new https.Agent({ rejectUnauthorized: false });
```

Sin un comentario que dijera por qué. Eso acepta cualquier certificado: quien se
coloque en medio sirve sus propios datos, y lo que se guarda son los talleres que
se le acaban enseñando a un cliente.

**Y no hacía falta.** Lo comprobé con la verificación puesta, siguiendo los
saltos, contra las cinco máquinas que intervienen:

```
analisi.transparenciacatalunya.cat   HTTP 200
abertos.xunta.gal                    HTTP 302 → oficinavirtualindustria.xunta.gal  HTTP 200
datosabiertos.jcyl.es                HTTP 302 → transparencia.jcyl.es              HTTP 200
```

Las cinco verifican con la cadena normal. Era el copiar y pegar de la primera
vez, el mismo que `lib/postgres-ssl.js` cuenta que estaba escrito 55 veces.

### 🟡 11.4 — El trabajo de CI contra SQL Server no puede correr

`backend-sql`, en el mismo workflow. Tres motivos, cada uno suficiente:

- Pide `AUTH_PROVIDER: mssql`, y `api/auth.js` **ya no atiende ese nombre**: está
  en `PROVEEDORES_RETIRADOS`, avisa por el registro y sigue por Postgres.
- Pide un runner propio de Windows con `sqlcmd`, que no está en ninguna parte.
- Su paso de limpieza llama a `cleanup:test-users-local`, y ese script **lo quité
  yo** al revisar los destructivos, sin comprobar que el workflow lo llamaba. No
  rompe nada porque el trabajo solo arranca a mano y con su interruptor puesto,
  pero lo apunto porque fue un descuido mío.

Le he puesto el nombre y un comentario diciendo que está retirado y por qué. No
lo he borrado: es el único sitio donde queda escrito cómo era la validación
contra SQL Server, y arranca solo a mano. Cuando decidas que SQL Server no
vuelve, se va entero.

### 🟡 11.5 — Cuatro entradas de `package.json` que no llevan a ninguna parte

- `migrate:attachments:sqlserver` → `scripts/migrate-attachments-filesystem-sqlserver.js`,
  **que no existe**. Lo comprobé contra el disco.
- `inventory:sync:sqlserver` → un script que llama a `sqlcmd`.
- `test:mobility-backend-local` → su mensaje de éxito es literalmente *«OK:
  endpoints persisted data in SQL Server without fallback»*, y consulta tablas
  `dbo.MoveAdvisorUser…`.
- `cleanup:test-users-local`, ya quitada, pero el workflow la sigue llamando
  (§11.4).

Las tres primeras fallarían con un error que no explica nada —«no encuentro el
módulo», «sqlcmd no se reconoce»—. Tampoco las he tocado por lo mismo que §11.2:
`package.json` está abierto en tu otra sesión.

### ⚪ 11.6 — Siete scripts `tmp_*` en el repositorio

`tmp_add_service_type`, `tmp_analyze_batch_007_duplicates`,
`tmp_check_locations_power`, `tmp_check_norauto_cities`, `tmp_fix_lat_nullable`,
`tmp_inspect_galicia_ods`, `tmp_inspect_official_sources`.

Son de explorar: se escribieron para mirar una cosa un día. Dos de ellos
(`tmp_inspect_*`) también desactivan la verificación del certificado, y uno
(`tmp_fix_lat_nullable`) toca el esquema. Nadie los llama.

El problema de un `tmp_` que se queda es que el siguiente que lo encuentre no
sabe si sigue haciendo falta. Yo los borraría, pero borrar es tuyo.

### ⚪ 11.7 — Once variables de entorno usadas y no documentadas

Comparando los **nombres** —no los valores— de `.env.local` contra
`.env.example`, once están en uso y no en el ejemplo:

```
ANTHROPIC_API_KEY  API_PORT  BRIGHTDATA_API_KEY  DANGEROUSLY_DISABLE_HOST_CHECK
HERE_API_KEY  HOST  INTERNAL_EMAIL  JARVIS_API_URL  JARVIS_PROCESSOR_TOKEN
N8N_API_KEY  REPLY_TO_EMAIL
```

De ésas, **tres las lee el código que se despliega**, y miré qué pasa sin ellas:

| Variable | Dónde | Sin ella |
|---|---|---|
| `ANTHROPIC_API_KEY` | `lib/el-cerebro-elige.js` | tira por Gemini, que ya se paga |
| `REPLY_TO_EMAIL` | `lib/marca.js` | usa `correoSoporte()` |
| `INTERNAL_EMAIL` | `lib/marca.js` | usa `correoSoporte()`, y avisa una vez por el registro si no hay ninguno |

O sea que las tres tienen su salida y nada se cae. Pero quien monte un entorno
nuevo desde `.env.example` se queda sin las once sin que nada se lo diga, y dos
de ellas cambian a dónde llegan los correos de los clientes.

### ✅ 11.8 — Lo que miré y está bien

- **No hay ni una credencial en el repositorio.** Busqué claves, tokens,
  contraseñas y cadenas de conexión con credenciales dentro por todo el árbol. Lo
  único que sale son valores de mentira evidentes: `"UnaClaveLarga123"` en un
  test, `"clave-de-mentira-para-el-ensayo"` en el ensayo del cron, dos
  `postgres://quien:sea@ninguna-parte.invalid` en las pruebas del pool, y un
  `postgresql://user:pass@neon.tech/…` de ejemplo en el roadmap.
- **`.gitignore` está bien puesto**: `.env*` con `!.env.example`, y solo
  `.env.example` en el índice. Hay un `.env.local.bak-procesador` en el disco,
  correctamente ignorado. El propio `.gitignore` lleva el comentario de que *«una
  copia .env.local.bak con credenciales dentro casi acaba en el repo»*, así que
  esto ya se pagó una vez.
- **`.env.example` no tiene ni un valor real.** 74 variables, todas con
  marcadores.
- **Los 41 scripts que abren base de datos lo hacen bien, y al contrario que los
  manejadores.** Los 41 se crean su propio `new Pool` y **los 41 llaman a
  `.end()`** —los conté—. Ninguno usa `lib/postgres.js`, y **eso es correcto**:
  un script de una pasada tiene que ser dueño de su pool y cerrarlo, mientras que
  un manejador de Vercel tiene que compartirlo y no cerrarlo nunca (§2, donde
  ocho lo cerraban y tiraban la instancia entera). Mismo repositorio, reglas
  opuestas, y las dos bien.
- **`lib/postgres-ssl.js` es el patrón que hay que copiar.** Un ajuste de
  seguridad escrito una vez en vez de 55, con la puerta de emergencia
  (`PGSSL_SIN_VERIFICAR=1`) que avisa por el registro para que no se quede
  puesta. §11.3 es exactamente lo que ese fichero describe, en otro sitio.
- **Solo tres sitios del árbol desactivan la verificación de certificados** y los
  tres estaban en `scripts/`: el de talleres (arreglado) y dos `tmp_inspect_*`.
  Nada en `api/` ni en `lib/`.

---

## Zona 12 — Tres de los cinco sitios que no había abierto ✔ revisada

De los cinco que quedaban apuntados abrí tres: `db/`, `data/` y los ficheros de
la raíz. **`n8n-workflows/` sigue sin revisar** —solo lo busqué por nombres de
tabla, que no es lo mismo— y `mockups/` tampoco. Lo digo en el encabezado porque
el título de una zona es lo único que mucha gente lee.

Salieron seis cosas, y la primera es la más cara de todo este documento.

### ✅ 12.1 — La tasación tenía un plan B de hace 47 días que entraba sin avisar — **hecho**

`readInventoryUniverse` en `lib/inventoryStore.js`, que es de donde salen los
comparables con los que se valora el coche de alguien:

```js
const fromPostgres = await readPostgresInventory(…);
if (fromPostgres.length > 0) {
  return { offers: fromPostgres, source: "postgres" };
}

const fromSqlServer = await readSqlServerInventory(12000, options);   // siempre []
if (fromSqlServer.length > 0) { … }

return {
  offers: readLocalInventory(),
  source: "local-json",
};
```

`readLocalInventory()` lee `data/inventory-offers.json`, que está en el
repositorio. Lo abrí y lo medí:

| | |
|---|---|
| Ofertas | **2.749** |
| Fecha de todas ellas | **14 de agosto de 2026** |
| Último commit que lo tocó | 14 de agosto (`0dcd57b`), hace **47 días** |
| Portales | 7 |
| Precio mediano | 17.490 € |
| Contra lo que hay en Postgres | 2.749 de 2,8 millones: el **0,1 %** |

Son ofertas de verdad —urls reales, 71 marcas—, no datos de prueba. Y eso es
justo lo que lo hace peligroso: el resultado parece bueno.

**Cuándo entra.** No hace falta que nada se rompa. `readPostgresInventory`
devuelve `[]` en dos casos que no distingue:

1. **La consulta falla.** Su `catch` escribe en consola y devuelve `[]` (línea
   986). Y fallar aquí no es hipotético: es lo que hacían los ocho manejadores
   que cerraban el pool compartido (§2), y con consultas de 8 a 48 segundos (§9)
   un tiempo agotado entra por la misma puerta.
2. **El filtro no encuentra nada, legítimamente.** Un perfil estrecho —una
   versión concreta en una provincia concreta— puede dar cero de 2,8 millones.

En los dos casos se tasa contra el fichero.

### Corrección: escribí que se tasaba contra 2.749 coches sin relación, y no era eso

Lo dije como hecho medido y estaba mal. `readLocalInventory()` no filtra, cierto,
pero **`listInventoryOffers` sí filtra después, en JavaScript**: marca, modelo,
combustible, cambio, año, kilómetros. Lo vi al revisar qué hace la pantalla con
un informe sin comparables, que es lo que este arreglo provoca.

Lo que de verdad pasaba, contado de las 2.749 del fichero:

| Perfil | Comparables que salían del fichero |
|---|---:|
| Peugeot 3008, gasolina, 2019 ±4 | **32** |
| Volkswagen Golf, gasolina, 2019 ±4 | **27** |
| Hyundai Tucson, gasolina, 2019 ±4 | **27** |
| Kia Sportage, gasolina, 2019 ±4 | **23** |
| Opel Corsa, gasolina, 2019 ±4 | **22** |
| una marca de las 60 que no están en el fichero | 0 |

Y eso es **peor** que lo que yo había escrito, no mejor. Un universo de 2.749
coches sin relación se nota: las cifras salen absurdas y alguien lo ve. Treinta y
dos comparables de la marca y el modelo correctos, con el año correcto, **y
precios del 14 de agosto**, no se nota en nada: la mediana es plausible, el rango
es plausible, y el informe la presenta como mercado de hoy.

Lo remata el porcentaje de confianza. `sellReportGenerator.js` la calcula con
`confidencePct(comparables, cv, usedFallback)`, y con 32 comparables y
`usedFallback = false` sale un **65 %**. O sea que el informe afirmaba una
confianza del 65 % sobre un mercado de hace mes y medio.

El único rastro era el campo `source: "local-json"`, y nadie lo mira.

### Y el arreglo destapa un camino que ya existía y no se usaba nunca

Esto también lo encontré después, y refuerza el arreglo. `sellReportGenerator.js`
**ya sabe** qué hacer sin comparables:

```js
if (comps >= 3 && median > 0) {
  base = median;                      // mercado
} else {
  usedFallback = true;
  base = depreciationEst.optimal;     // modelo de depreciación por edad y km
}
```

Cae a un modelo de depreciación, lo marca con `usedFallback` y **baja el
porcentaje de confianza por ello**. Es exactamente la respuesta correcta.

Y era inalcanzable siempre que el fichero contuviera la marca del coche: con 32
comparables, `comps >= 3` es verdad y el modelo de depreciación no se llegaba a
consultar. O sea que la tercera rama no solo metía datos viejos: **tapaba el
camino bueno que ya estaba escrito**.

**Hecho, y en dos sitios.** `readPostgresInventory` levanta en vez de devolver
`[]`, que es lo que hacía indistinguibles «no hay comparables» y «no he podido
preguntar». Y `readInventoryUniverse` sale por el fichero **solo** cuando no hay
`DATABASE_URL` —desarrollar en local—; con base, cero comparables se devuelve como
cero, con `source: "postgres-sin-comparables"` para que se sepa que está vacío
porque no hay y no porque falló algo.

Antes de tocarlo comprobé que la tasación aguanta un universo vacío, porque si no
habría cambiado un precio malo por una división por cero: la escalera de criterios
ya ensancha cinco veces, y `percentile` de una lista vacía devuelve `null`,
`tukeyFence` devuelve una valla abierta y `removeOutliers` devuelve `[]`. Las
estadísticas salen en `null`, que es lo que hay que decir.

### 🟡 12.2 — Una tabla de otro repositorio, vacía, y un `catch` que lo tapa

`lib/el-motor-de-la-ficha.js` ordena la lista de versiones del coche usando la
cilindrada y los kilovatios de su ficha técnica:

```sql
SELECT codigos FROM erp_fichas_tecnicas_leidas WHERE vehicle_id = $1
```

Esa tabla **no la declara ninguna migración de este repositorio**, y no es un
descuido: la escribe el ERP. Lo comprobé en el otro repositorio —
`apps/api/src/lib/la-ficha-leida.ts`— y hace `INSERT … ON CONFLICT` después de
un `aseguraLaTabla()` que la crea al vuelo.

Tres cosas de eso:

1. **La tabla tiene 0 filas en producción.** Así que hoy la función devuelve
   vacío siempre y la lista de versiones sale sin ordenar.
2. **Nadie se puede enterar.** `elMotorDeLaFicha` envuelve la consulta en
   `try { … } catch { return vacio; }`. El comentario del manejador dice «nunca
   falla: sin ficha leída devuelve el motor vacío», y **es verdad** —lo
   comprobé—. Pero eso significa que «la tabla no existe», «la base no
   contesta» y «este coche no tiene ficha» son la misma respuesta.
3. **Es la forma exacta del fallo que este repositorio ya se comió una vez.**
   `lib/el-esquema-tiene-un-dueno.test.js` nació porque descargar una factura
   estaba roto en producción por una columna que creaba otro fichero al vuelo.
   La regla que puso —el esquema se declara en `migrations/`— **no puede ver lo
   que pasa entre dos repositorios**, y su lista de tablas de muestra no incluye
   ésta; su propio comentario admite que no es la lista entera.

**Qué haría**: que el `catch` llame a `registra()` antes de devolver vacío. Sigue
sin romper nada y deja de ser invisible. Y añadir la tabla a la lista de esa
prueba, con una nota de que la dueña es el ERP.

### 🟡 12.3 — El CI prueba la autenticación contra un servidor que sirve 31 de 49 rutas

`local-api-server.js` es lo que el CI arranca para las pruebas de auth y de
seguridad. Despacha así:

```js
const handler = handlers[url.pathname];
if (!handler) { sendJson(res, 404, { error: "Not Found" }); return; }
```

Búsqueda exacta en una tabla escrita a mano, y 404. Ni prefijos, ni parámetros,
ni `?route=`. Comparado con los 49 caminos `/api` de `vercel.json`, **28 no
existen en el servidor local**: los ocho crones, `/api/whatsapp`,
`/api/fianza-confirmar`, `/api/fianza-devolucion`, `/api/mandato-firmado`,
`/api/papeles-venta`, `/api/informe-publico/…`, `/api/modelo-3d/…` y
**`/api/invoice-pdf`**.

Ese último es el que duele. `el-esquema-tiene-un-dueno.test.js` cuenta que
descargar una factura en PDF **estuvo roto en producción** —`column
i.rectifica_numero does not exist`— y que nadie podía verlo. Es una de las 28 que
ninguna prueba local puede tocar.

No digo que haya que servir las 49 en local; algunas no tienen sentido fuera de
Vercel. Digo que **hay que saber cuáles no se prueban**, porque ahora mismo la
lista no está escrita en ninguna parte y la diferencia se descubre en producción.

### 🟡 12.4 — Sin `?route=`, la ruta se decide buscando trozos en la URL entera

Los tres enrutadores reparten por `?route=`. Cuando no viene, `lib/api/enrutador.js`
cae a una lista de alias:

```js
const url = String(req.url || "").toLowerCase();
for (const [trozo, ruta] of alias) {
  if (url.includes(trozo)) return ruta;
}
```

`includes` sobre la URL entera, **query incluida**. Su propio comentario lo llama
frágil y dice que arreglarlo cambia comportamiento. Lo que el comentario no dice
es la consecuencia concreta, y dos alias de `/api/user` son cortos:

```js
["leads", "leads"],
["error", "error"],
```

Así que una petición a `/api/user?email=alguien@error.com`, sin `route`, se
resuelve a la ruta `error`. Y se puede llegar ahí desde fuera, porque
`vercel.json` tiene un `/api/(.*) → /api/$1` que sirve el fichero por su nombre.

**Y no es un agujero de permisos**: cada ruta es alcanzable por su propio camino
de todas formas, así que no se llega a nada nuevo. Lo que es, es una trampa
puesta: el día que alguien añada un alias corto para una ruta con privilegios
—`market.js` ya tiene `fianza-devolucion`, que lleva la clave de Stripe— deja de
ser inofensivo. Yo exigiría el `?route=` y devolvería 404 sin él.

### 🟡 12.5 — 126 MB y 490.033 filas que nada de lo que se despliega lee

Comparé las tablas de la base contra las que declaran las migraciones. De los
siete objetos que ninguna migración crea, cinco tienen explicación (§12.7). El
que no:

```
moveadvisor_market_dealers        tabla      126 MB     490.033 filas
```

La crea `scripts/carga-dealers-cochesnet.js` con un `CREATE TABLE IF NOT EXISTS`
propio, y la leen esos dos guiones de carga y nadie más: no aparece en `api/`, ni
en `lib/`, ni en los 60 flujos de n8n. Lo busqué en los tres sitios.

Son 126 MB en una base de 7.294 MB cuyo problema, medido, es que el conjunto de
trabajo es tres veces la caché y el acierto es del 36,8 % (§9.1). No sé si esos
concesionarios hacen falta para algo que venga después; si no hacen falta,
tirarlos es el único sitio de todo este documento donde se gana espacio de caché
gratis.

### ⚪ 12.6 — 340 líneas de SQL Server dentro del fichero más caliente

`lib/inventoryStore.js` tiene 3.176 líneas y sirve el marketplace. Dentro:

- `buildSqlServerWhereClause` — líneas 356 a 582, **227 líneas** que construyen
  un `WHERE` de T-SQL (`N'…'`, `NVARCHAR(32)`, columnas en PascalCase)
  **concatenando cadenas**, con un escapador escrito a mano:
  `String(v).replace(/'/g, "''")`.
- `readSqlServerInventory` — 105 líneas que llaman a `sqlcmd` por la línea de
  órdenes.

**No es un agujero de inyección**, y lo comprobé antes de escribirlo:
`readSqlServerInventory` sale por la puerta con `[]` si no hay configuración de
SQL Server, así que el `WHERE` no se construye nunca; y `sqlcmd` no existe en
ninguna parte —lo dice el propio `api/auth.js` al retirar el proveedor `mssql`—.

Lo que es: que `readInventoryUniverse` aparenta tener tres fuentes cuando dos
están muertas, en la función de la que sale el precio. Y un escapador de SQL
hecho a mano esperando a que alguien reconecte esto.

### ✅ 12.7 — Lo que miré de estos cinco sitios y está bien

- **`db/postgres/init.sql` no contradice a `migrations/`.** Me olía a segundo
  esquema con vida propia. Comparé las tres cosas —las 24 tablas de `init.sql`,
  las 105 de `migrations/` y las 110 de la base— y las 24 están todas en
  `migrations/`, sin una columna en desacuerdo. Es un subconjunto redundante, no
  una verdad paralela.
- **Las dos vistas materializadas son la excepción documentada.** `mmo_modelos` y
  `mmo_facetas` no las crea ninguna migración, y eso es a propósito:
  `el-esquema-tiene-un-dueno.test.js` tiene una lista de `PUEDEN` con un solo
  nombre —`lib/facetas-del-buscador.js`— y su motivo escrito, más una tercera
  prueba que comprueba que la excepción sigue existiendo. Iba a apuntarlo como
  hallazgo y lo leí antes.
- **`migraciones_aplicadas`, `pg_stat_statements` y `pg_stat_statements_info`**
  salieron en la misma lista y son artefactos: el registro de `scripts/migra.mjs`
  y las vistas que trae la extensión de la migración 0018.
- **El pool propio de `inventoryStore` está justificado y escrito.** Es la otra
  excepción a lo de §2, y el comentario explica la razón: `getEnvValue` también
  lee el `.env` del disco, de lo que viven los guiones, y eso no debe estar en el
  módulo compartido.
- **`data/inventory-offers.json` son ofertas de verdad, no datos de prueba.** Lo
  digo porque sus vecinos en `data/` sí lo son (`cochesnet-…-test.json`), y me
  esperaba lo mismo. Que sean reales es lo que hace a §12.1 peor, no mejor.

---

## Zona 13 — `n8n-workflows/` y lo que de verdad corre ✔ revisada

60 ficheros, 22.598 líneas. Y aquí no valía leer los ficheros: lo que importa de
un flujo de n8n es si **eso** es lo que se está ejecutando. n8n estaba levantado
en el 5678 y la clave del `.env.local` funciona, así que comparé los 60 ficheros
contra los 61 flujos que hay dentro, uno a uno, por su contenido.

Me costó tres intentos y los dos primeros los di por buenos antes de mirarlos
(§13.6). El resultado, después de quitar el ruido:

### 🟠 13.1 — El avisador de fallos que corre es mejor que la copia guardada

De las 60 parejas, **una divergencia de verdad en un flujo activo**, y es
justamente el que avisa cuando fallan los demás: `⚠️ Error Handler – Aviso por
Email`.

| | Lo que corre | `n8n-workflows/error-notify-email.json` |
|---|---|---|
| Líneas del `jsCode` | 37 | 15 |
| Remitente | `avisos@popcarmobility.com` | **`onboarding@resend.dev`** |
| `reply_to` | `hola@popcarmobility.com` | no lleva |
| Parte de texto plano | sí | **no** |

Alguien lo mejoró en la interfaz de n8n y no lo volvió a exportar. El que corre
lleva incluso el comentario de por qué añade el texto plano: *«Un correo que solo
lleva HTML puntúa peor en los filtros, y es de las pocas señales que están en
nuestra mano.»*

**Por qué es un hallazgo y no una curiosidad.** Esa carpeta es la copia de
seguridad. Para el único flujo cuyo trabajo es contarte que algo se ha roto, la
copia de seguridad es peor que el original: si alguien reimporta ese fichero, los
avisos vuelven al remitente de pruebas de Resend y pierden el texto plano. Y
reimportar encima **duplica el flujo** en vez de reemplazarlo, así que acabarías
con dos avisadores, uno bueno y uno malo.

**Qué haría**: exportar ese flujo otra vez y commitear. Y, en general, que la
exportación no dependa de que alguien se acuerde: `npm run` con la llamada al API
de n8n y los 61 ficheros al disco.

### 🟠 13.2 — Un `DELETE` sin límite sobre la tabla de 2,8 millones, guardado y esperando

`n8n-workflows/mantenimiento-activas.json`, nodo «PG: Recalcular is_active»:

```sql
-- Limpieza diaria: borrar ofertas basura de mercado (precio < 2000 EUR)
DELETE FROM moveadvisor_market_offers WHERE price < 2000;
```

Disparador diario a las 07:00. Hoy eso borraría **52.768 ofertas** —lo conté—, de
las que 52.736 tienen un precio de verdad:

| Portal | Ofertas por debajo de 2.000 € |
|---|---:|
| wallapop | 22.860 |
| autoscout24 | 10.867 |
| milanuncios | 10.558 |
| coches.net | 8.237 |
| el resto | 214 |

**No está corriendo, y lo comprobé por dos caminos que no se apoyan uno en otro.**
En n8n el flujo se llama `Mantenimiento – Borrar ofertas por debajo de 2.000 €` y
está **parado**. Y en la base:

- la oferta barata más antigua es del **2 de julio**, y si eso se ejecutara a
  diario no sobreviviría ninguna de más de un día;
- `n_tup_del` de la tabla es **8.487** en toda su vida, contra 2.484.006
  inserciones. Un borrado diario de 50.000 filas dejaría millones.

Así que está apagado. Lo que queda es un fichero destructivo esperando a que
alguien lo importe y lo encienda, y de paso una pregunta de producto: un coche de
1.500 € es un coche. Si la idea es no enseñarlos, eso es `is_active = false`, no
un `DELETE` —hay una columna `visible_desde` y toda la maquinaria de
presentables—. Borrarlos garantiza que el scraper los vuelva a traer mañana.

### 🟡 13.3 — Tres flujos a las 07:00 exactas, y uno de ellos sin avisador

Los minutos están escalonados con cuidado en todos los demás —`:00`, `:05`,
`:10`, `:15`, `:20`, `:25`…, portal por portal—, lo que es trabajo bien hecho
(§13.5). La excepción son tres, los tres «universales», que arrancan a la misma
hora y el mismo minuto:

```
07:00  mantenimiento-activas      (parado)
07:00  universal-derivar          ACTIVO
07:00  universal-enrich-color     (parado)
```

Hoy solo corre uno, así que no se pisan. Pero los tres son los que recorren la
tabla entera en vez de un portal, y son los que hay que separar el día que se
enciendan los otros dos.

Y de los tres, `universal-enrich-color` es **uno de los dos flujos sin
`errorWorkflow`** de los 60 (el otro es `workshops-enrich-google-places`; el
tercero sin él es el propio avisador, que es lo correcto). Si se encienden, fallan
en silencio.

### 🟡 13.4 — Un flujo vacío, creado el 21 de septiembre y nunca terminado

En n8n hay 61 flujos y en el repositorio 60. El que sobra:

```
Importación – Publicar (regla de la ficha)
  activo: false   nodos: 0   conexiones: 0
  creado: 2026-09-21   tocado: 2026-09-21
```

Cero nodos. Es un nombre reservado y nada más. No hace daño estando parado, pero
en una lista de 61 es una promesa de que existe algo que no existe, y el 21 de
septiembre es la fecha del volcado único de coches.net, así que alguien empezó a
montar la publicación de importaciones ese día y lo dejó.

### ✅ 13.5 — Lo que está bien hecho aquí, y es bastante

- **Ni una credencial en los 60 ficheros.** Importa porque **este repositorio es
  público** —lo confirmé con la API de GitHub: `"visibility": "PUBLIC"`—. Lo único
  con forma de secreto es un `Bearer REEMPLAZAR…` de plantilla. Ninguna cadena de
  conexión con contraseña dentro.
- **57 de 60 flujos tienen `errorWorkflow` configurado.** Con 52 flujos activos
  rascando ocho portales, eso es lo que hace que un fallo se sepa.
- **Los horarios están repartidos a mano, y bien.** 53 disparadores con expresión
  cron, con las horas escalonadas por portal y los minutos separados de cinco en
  cinco. Yo esperaba encontrar un montón a la misma hora —venía buscando el 63 %
  de escrituras de las 07h de §9.4— y no es eso.
- **Los 52 flujos activos del n8n que corre se corresponden con ficheros del
  repositorio.** Salvo §13.1 y una consulta de `importacion-scoring` —que está
  parado—, lo guardado es lo que se ejecuta. Mi nota de trabajo decía que la copia
  podía ser más vieja que la regla; hoy, para 59 de 60, no lo es. Nada lo
  garantiza, eso sí: ningún guion exporta, es a mano.

### Y una corrección a la zona 9

En §9.4 escribí que el refresco de facetas *«vacía la caché dos veces por hora»* y
dejé caer que el 63 % de escrituras de las 07h venía de los scrapers pisándose.
**Eso último no lo sé, y con esto medido, no es por ahí**: los scrapers están
escalonados y a las 07:00 solo corre uno de los tres universales.

Así que la causa de esa concentración sigue sin identificar. Lo que la dirá es
`pg_stat_statements` con unos días de tráfico, no otra suposición mía.

### 13.6 — Cómo me equivoqué tres veces seguidas midiendo esto

Lo dejo escrito porque quien vuelva a comparar n8n contra el repositorio se va a
tropezar con lo mismo.

**Primer intento:** emparejé por nombre. No funciona: el fichero se llama
`autocasion-enrich-offers` y el flujo «Autocasión – Enriquecer Ofertas». Salieron
58 «sin pareja» y era puro ruido.

**Segundo:** emparejé por la huella de los nodos y comparé el SQL. Salieron 52
«con el SQL cambiado». Fui a mirar uno y la única diferencia era:

```
corre : {{ $json.sql }}
repo  : ={{ $json.sql }}
```

n8n marca con un `=` delante los campos que son expresión. El fichero exportado
lo conserva; **el API lo quita al devolverlo**.

**Tercero:** normalicé el `=`. Salieron 54. Fui a mirar otro y era
`looseTypeValidation: true`, una opción con su valor por omisión que el fichero
escribe y el API no devuelve. Lo mismo pasa con `method: "GET"`, `options`,
`language`, `batchSize`.

Lo que por fin funcionó no fue contar diferencias: fue **enseñar qué campos
difieren** y mirar solo los que cambian lo que un flujo hace —`query`, `url`,
`jsCode`, `cronExpression`—. De doce flujos que salían con algo sustancial, cuatro
eran las dos parejas ES/DE de AutoScout24 cruzadas entre sí por mi emparejador
—tienen los mismos nombres de nodo— y el resto `method: GET`. Quedaron dos reales:
§13.1 y `importacion-scoring`.

Tres medidas, tres falsos positivos, y los dos primeros los habría publicado si no
hubiera ido a mirar un caso concreto. **Una diferencia contada no es una
diferencia vista.**

---

## Zona 14 — `mockups/` ✔ revisada

Seis mil líneas de prototipos de diseño: dos versiones de la portada, un
prototipo llamado `popgo`, las fuentes Inter, una foto y un servidor de 30 líneas
para verlos. Nada de esto se despliega —ningún fichero de `src/` los referencia—
y el único hallazgo es el servidor.

### ⚪ 14.1 — El servidor de los mockups sirve cualquier fichero del disco

`mockups/servidor.mjs`, treinta líneas para ver los prototipos en local:

```js
let ruta = req.url === '/' ? '/home-v3.html' : decodeURIComponent(req.url.split('?')[0])
const destino = ruta.startsWith('/fotos/') ? join(FOTOS, …) : join(RAIZ, ruta)
const datos = await readFile(destino)
```

`join` normaliza los `..`, así que una petición a `/../.env.local` sale de
`mockups/` y lee lo que quiera del disco. Y `listen(4173)` sin dirección escucha en
**todas las interfaces**, no solo en `localhost`: mientras esté arrancado,
cualquiera de la red puede pedir ficheros de tu máquina.

No está en producción ni lo arranca nada automáticamente, y por eso es blanco. Pero
son dos líneas:

```js
const destino = resolve(base, '.' + ruta);
if (!destino.startsWith(resolve(base))) { res.writeHead(403); return res.end('No'); }
…
.listen(4173, '127.0.0.1', …)
```

### ⚪ 14.2 — Dos prototipos de portada que nadie abre

`home-v2.html` (500 líneas) y `home-v3.html` (809) son versiones anteriores de la
portada, con sus propias fuentes Inter dentro. La aplicación real se sirve Nunito
Sans desde `src/fonts/` —está explicado en `src/styles/fuentes.css`, y la razón
escrita—, así que las Inter de aquí no las usa nadie.

Es carpeta de trabajo de diseño y está bien que exista; lo que no está escrito en
ninguna parte es que `home-v3.html` es la última y `home-v2.html` la anterior.
Dentro de seis meses eso no se deduce del nombre.

---

## Zona 15 — El guardián de n8n y la limpieza de su base ✔ revisada

Código de la otra sesión, empujado el 30 de septiembre: `scripts/vigila-n8n.js`,
`scripts/limpia-n8n.js`, `migrations/0019-el-vigilante-de-n8n.sql` y un cambio en
`ecosystem.config.js`. Lo reviso porque acaba de entrar y porque toca dos cosas
delicadas: levantar procesos y borrar de una base con el fichero abierto.

**Está bien hecho**, y §15.4 lo detalla. Los tres hallazgos son de lo que pasa
cuando falla algo de alrededor, y **el peor sale de cómo se juntan los dos
scripts**, no de ninguno por separado.

### 🟠 15.1 — El guardián necesita Postgres para poder levantar n8n

`scripts/vigila-n8n.js`, línea 126:

```js
const c = new Client({ connectionString: DB_URL, statement_timeout: 60000 });
await c.connect();
```

Eso está **fuera de todo `try`**. Si Neon no contesta —o la contraseña cambia, o
la red se va— el `connect` levanta, el `.catch` del final imprime `ERROR:` y sale
con 1. O sea: **n8n se queda caído**.

Y la base solo se usa para dos cosas: apuntar el latido y consultar el
enfriamiento. Ninguna de las dos es el trabajo del guardián. Que un vigilante de
n8n dependa de Postgres para poder reiniciar n8n es la dependencia al revés: el
día que fallen las dos cosas a la vez —y una parada de n8n y un problema de base
no son sucesos independientes, comparten máquina y red— no hay quien levante nada.

**Qué haría**: el enfriamiento en un fichero local, que es donde ya vive el freno
de mano. La fecha de modificación de `~/.n8n/ultimo-intento` responde «¿se
intentó hace menos de cinco minutos?» sin salir de la máquina. El latido en
Postgres se queda como está —es un registro, no una condición— dentro de un `try`
que si falla no impida levantar n8n.

### 🟠 15.2 — Nadie lee los latidos, que son la mitad del diseño

La migración explica para qué está la tabla, y lo dice sin rodeos:

> *«Lo que NO puede cubrir es que la máquina entera esté apagada: si no hay
> máquina, no hay guardián. Por eso cada pasada deja su latido aquí, y desde
> fuera se puede ver que el último es de hace tres horas y avisar.»*

Busqué quién mira `moveadvisor_latidos_n8n` en todo el repositorio. Sale en tres
sitios: la migración que la crea, el guardián que escribe en ella, y un
**comentario** de `ecosystem.config.js`. **Nadie la lee.**

Así que los dos casos que la tabla existe para cubrir siguen descubiertos:

1. **La máquina apagada.** No hay guardián, no hay latidos, y nada nota la
   ausencia.
2. **El guardián se rinde.** Después de `MAX_INTENTOS` en una hora deja de
   intentarlo —con razón: insistir cada cinco minutos no arregla un problema de
   fondo— y apunta *«no arranca solo, hay que mirarlo»*. A nadie.

**Y el sitio donde ponerlo ya existe.** Hay dos crones que ya avisan por correo y
que corren **en Vercel**, o sea fuera de esta máquina, que es justo lo que hace
falta para detectar que la máquina está apagada:

- `cron-avisa-de-los-fallos`, que ya lee `moveadvisor_errores WHERE avisado_en IS
  NULL` y manda el correo.
- `lib/vigila-scrapers.js`, que avisa cuando deja de entrar catálogo.

Añadirle al primero un «¿el último latido es de hace más de media hora?» son unas
líneas, y cierra el diseño que la migración describe.

### 🟡 15.3 — Un freno de mano sin caducidad es un interruptor de apagado

Los dos scripts se coordinan con un fichero, `~/.n8n/no-me-levantes`: la limpieza
lo pone antes de parar n8n y el guardián no toca nada mientras exista. Es la
decisión correcta y está bien pensada.

Pero el guardián solo mira si **existe**:

```js
if (fs.existsSync(FRENO)) {
  await apunta(escucha(), false, "freno de mano puesto: alguien lo ha parado a proposito");
  return;
}
```

Sin mirar de cuándo es. Y la limpieza lo borra en un `finally`, que cubre una
excepción pero **no cubre que el proceso muera de golpe**: un Ctrl-C, un reinicio
de la máquina, un corte de luz o un `kill` entre el `ponFreno()` y el `finally`.
La limpieza corre a las **03:00 y sin nadie delante**, que es exactamente cuando
un reinicio no lo ve nadie.

Si eso pasa, el resultado es: n8n apagado, el guardián viéndolo apagado cada cinco
minutos y decidiendo no hacer nada, y el latido diciendo *«alguien lo ha parado a
propósito»* — que es lo que uno leería como normal—. Sumado a §15.2, nadie lo lee
tampoco. **Un fichero de cero bytes apagando los 52 flujos indefinidamente.**

**Qué haría**: que el freno caduque. Ignorarlo si tiene más de media hora —la
limpieza entera tarda minutos— y escribir dentro el PID del proceso que lo puso,
para poder comprobar si sigue vivo. Dos líneas, y el modo de fallo desaparece.

### ✅ 15.4 — Y lo que está bien hecho, que es la mayor parte

Lo digo con detalle porque es lo que no hay que tocar al arreglar lo de arriba.

- **El enfriamiento que evita dos n8n está probado, no supuesto.** Su comentario
  dice: *«Probado: dos pasadas con tres segundos de diferencia lanzaron DOS n8n»*.
  Y el código hace lo que el comentario dice —lo comprobé, porque esta misma
  revisión se encontró un comentario que afirmaba algo que su código no cumplía—:
  cinco minutos de margen sobre los 60-100 segundos que n8n tarda en escuchar,
  más un `hayProceso()` antes, más un tope de intentos por hora.
- **La limpieza se niega tres veces antes de tocar la base.** Sin `--hazlo` no
  hace nada. Con `--hazlo` pero n8n escuchando y sin `--con-parada`, se niega y
  dice por qué: *«Tocar el fichero con n8n dentro corrompe la base.»* Y si hay
  ejecuciones de verdad en marcha, se niega a parar n8n aunque se lo pidan. Es la
  misma disciplina que se le puso a los tres scripts destructivos de §7, aplicada
  sin que nadie la pidiera.
- **Y si para n8n, lo vuelve a levantar pase lo que pase**, en un `finally`, con
  el motivo escrito: *«Un fallo a mitad que deje el sistema apagado es peor que la
  base gorda: en agosto estuvo quince días sin raspar y nadie se enteró.»*
- **La tabla de latidos se poda sola** a los treinta días, en cada pasada del
  guardián, con la cuenta hecha: 288 latidos al día, 105.000 al año sin podar.
  Contra las otras tablas de este sistema que crecen sin fin, esto es lo
  contrario de lo que suele pasar.
- **El índice es el de la pregunta que se hace.** `(momento DESC)`, porque lo que
  se pide siempre es el último. Después de las §1.1 y §8.5 —523 MB de índices que
  nadie lee y dos que creé yo y tuve que tirar—, ver un índice puesto por una
  consulta concreta y no por si acaso se agradece.

---

## Zona 16 — Las pruebas ✔ revisada

Todo lo que se ha arreglado en esta revisión queda sujeto por pruebas, así que la
pregunta siguiente es si las pruebas sujetan. No es retórica: **esta misma sesión
escribí dos que no cazaban nada** —unas de rutas generadas a partir de la tabla
que probaban, y una cuyo ayudante devolvía `{}` como cuerpo de función y pasaba
mirando el vacío—. Si eso pasa dos veces en un día, toca mirar las 217 que ya
estaban.

**217 ficheros, 2.479 pruebas declaradas.** Y el resultado es bueno: una sola
laguna, y está arreglada.

### ✅ 16.1 — Ni una prueba que no pueda fallar, y solo dos sin afirmar

De las 2.479, **dos no tienen ninguna afirmación**, y las dos a propósito:

```js
test("un error de red no revienta el guardado de su coche", async () => {
  global.fetch = async () => { throw new Error("ECONNREFUSED"); };
  await AVISA.avisaDeLaFicha(conFicha);   // no lanza
});
```

La prueba es «esto no debe levantar», y `node:test` la suspende si levanta. Es
legítimo. Lo único que cambiaría es escribirlo con `assert.doesNotReject`, para
que la intención esté en el código y no en un comentario al final de la línea.

Y además: **cero pruebas saltadas**, cero `.todo`, cero `.only` olvidado, cero
afirmaciones imposibles de fallar del tipo `assert.ok(true)`, y **cero ficheros de
prueba que no toquen el proyecto** —los 217 importan algo de `lib/`, `src/` o
`api/`, o leen un fuente—. 44 de ellos solo leen el fuente sin ejecutarlo, que es
el patrón de las pruebas de forma.

### ✅ 16.2 — Y fallan cuando el código cambia: seis de seis

«Tener una afirmación» es un listón bajo. La única pregunta que importa de una
prueba es si se pone roja cuando el código se rompe, y eso no se contesta
leyéndola. Así que rompí el código a propósito, en un clon, con seis averías **del
tipo que este sistema ya ha sufrido**:

| Lo que se estropeó | La prueba que debía gritar | |
|---|---|---|
| un manejador cierra el pool compartido | `nadie-cierra-el-pool-compartido` | ✅ falló |
| un guion destructivo pierde su `--borra` | `nada-borra-sin-pedir-permiso` | ✅ falló |
| vuelve un `execFileSync("sqlcmd")` | `nadie-lanza-sqlcmd` | ✅ falló |
| se rompe una tilde en `lib/marca.js` | `las-tildes-no-se-rompen-dos-veces` | ✅ falló |
| el login vuelve a devolver 404 si no existe la cuenta | `el-login-no-dice-quien-existe` | ✅ falló |
| desaparece una tarea de `vercel.json` | `las-tareas-programadas-existen` | ❌ **siguió verde** |

Cinco de seis a la primera. Y de las dos que sobrevivieron en la primera vuelta,
una era **mi mutación mal hecha**: escribí `p.end()` sobre un parámetro cualquiera
y la prueba busca `/(pool|Pool)\w*\.end\(\)/`; `p` no es el pool compartido por
ninguna lectura, así que no cazarlo era lo correcto. Reescrita como
`const pool = elPool(); await pool.end();`, la cazó.

### ✅ 16.3 — La laguna que había, y era la mitad del caso — **arreglada**

`las-tareas-programadas-existen.test.js` recorre las tareas de `vercel.json` y
comprueba que cada una llega a su manejador. Nació de una avería real y grande:
`/api/cron-vigila-scrapers` estaba declarada y **no existía**; Vercel la llamaba
cada día, recibía la página web con un 200 y se quedaba contento, mientras la
alarma que vigila si entra catálogo llevaba un mes sin ejecutarse.

Pero al recorrer **lo declarado**, solo cubre una dirección. Quité la primera tarea
del fichero y las pruebas pasaron igual: con una menos, las siete que quedan siguen
siendo válidas. O sea que faltaba justo la mitad que no hace ruido, y es la mitad
peligrosa — lo dice su propio vecino `lib/vigila-scrapers.js`: *«Un fallo grita;
una ausencia no hace ruido.»*

**Puesta la lista de las ocho que tienen que estar**, con dos comprobaciones en los
dos sentidos: ninguna desaparece, y una nueva en `vercel.json` obliga a apuntarla
—si no, tampoco estaría vigilada—. Con eso, la sexta mutación también falla: **seis
de seis**.

### Lo que esto dice del resto

No he mutado las 2.479; he mutado seis guardias escogidas por ser las que protegen
las averías más caras que ha tenido este sistema. Cinco funcionaban y la sexta no,
y la que no funcionaba llevaba dentro exactamente el tipo de hueco que se pasa por
alto: **la prueba mira lo que hay, no lo que debería haber**.

Ese es el patrón que buscaría en las otras: cualquier prueba que recorra una lista
del propio fichero que examina —`for (const x of LO_QUE_HAY)`— caza lo que está mal
puesto y no caza lo que falta. Es el mismo error que la tabla de rutas que generé
desde la tabla que probaba.

---

## Zona 17 — Las cabeceras de seguridad, contra el dominio ✔ revisada

Era el último hueco con nombre de este documento: había un
`docs/cabeceras-de-seguridad.md` y yo nunca había comprobado que lo que dice se
cumpla de verdad. Ya está comprobado, y **estaba bien**.

### ✅ 17.1 — Las cinco están puestas en los tres sitios

`npm run test:cabeceras` —que ya existía, y está escrito para distinguir «no pude
preguntar» de «la respuesta es mala»— contra los tres sitios publicados:

```
la web (200)   la app (200)   el ERP (200)
  strict-transport-security   x-content-type-options   x-frame-options
  referrer-policy             content-security-policy
```

Las cinco, en los tres. `max-age=63072000` —dos años—, `nosniff`, `DENY`,
`strict-origin-when-cross-origin`, y una CSP con `frame-ancestors 'none'`,
`base-uri 'self'`, `object-src 'none'`, `form-action 'self'` y
`upgrade-insecure-requests`.

### ✅ 17.2 — Y que la CSP no lleve `script-src` es una decisión, no un olvido

Iba a apuntarlo. La CSP no tiene `default-src` ni `script-src`, que es la parte
que de verdad frena un XSS —y hay un XSS latente apuntado en §6—. Pero el
documento lo explica antes de que yo llegue, y lo explica bien: la web carga
imágenes de decenas de dominios, el CRA mete un script en línea en su
`index.html`, y una CSP puesta a ciegas deja el escaparate en blanco **sin dar
ningún error**.

Y propone el camino correcto: publicarla en `Report-Only`, recoger una semana de
avisos y cerrar a partir de lo que salga.

### 🟡 17.3 — Y ese plan ya no tiene el obstáculo que dice tener

El documento cierra esa parte con: *«Eso necesita un sitio donde recoger los
avisos, y es trabajo aparte.»*

**Ese sitio se construyó en esta revisión y nadie ha atado los dos cabos.** Está
entero:

- `moveadvisor_errores` (migración 0016), con su huella para agrupar repetidos y
  su índice parcial por lo no avisado;
- `/api/error` → `lib/api/error-del-navegador-handler.js`, que acepta POST y
  guarda con `guarda()`;
- `cron-avisa-de-los-fallos`, que cada hora manda por correo lo que no se ha
  avisado.

Lo único que falta es que el manejador entienda la forma de un informe de CSP: un
navegador manda `{"csp-report": {"violated-directive": …, "blocked-uri": …}}`, y
hoy el manejador exige `sitio` y `mensaje` y descarta lo que no los traiga. Son
unas líneas para mapear uno a otro.

Con eso, poner `Content-Security-Policy-Report-Only` con su `report-uri /api/error`
pasa de «trabajo aparte» a una tarde, y la semana de medición empieza sola.

### 🟡 17.4 — Nada comprueba las cabeceras por su cuenta

`npm run test:cabeceras` no está en el CI, y con motivo: necesita internet y
pregunta a producción, que no es algo que deba pasar en cada empujón.

Pero entonces solo corre cuando alguien se acuerda, y el propio script dice de qué
está protegiendo: *«una cabecera que falta no da ningún error: el sitio funciona
igual de bien y deja de estar protegido»*. Es la misma forma que §16.3 y que los
quince días de n8n: **la ausencia no hace ruido**.

Su sitio no es el CI, es un cron semanal. Y ya hay ocho en `vercel.json` y un
mecanismo de avisos por correo que funciona.

### ✅ 17.5 — La diferencia de HSTS entre los tres no es nuestra

Medido: el ERP sirve `max-age=63072000; includeSubDomains; preload` y la web y la
app solo `max-age=63072000`.

Fui a buscar la inconsistencia en la configuración y **no está**: ni el
`vercel.json` de este repositorio ni el del ERP declaran `Strict-Transport-Security`
—lo busqué en los dos—. La pone Vercel. Y el corte cae exactamente en un sitio:
el ERP es el único de los tres que vive en un `*.vercel.app`, que es un sufijo que
está en la lista de precarga de HSTS de los navegadores; los otros dos son dominio
propio.

O sea que no hay nada mal configurado. Lo que hay es **una decisión que nadie ha
tomado**: `popcar.com.es` no está en la lista de precarga, así que la primerísima
visita de alguien que escriba la dirección sin `https://` viaja en claro una vez.
Entrar en esa lista exige servir `includeSubDomains; preload` y **salir de ella es
lento y penoso**, así que es una decisión de una sola dirección. No digo que se
haga; digo que hoy está sin decidir y parece un descuido cuando no lo es.

---

## Lo que queda, que ya no es leer código

Ya no queda código por mirar: las once zonas están revisadas. Lo que queda es
esto, y ninguna de las dos cosas es leer ficheros:

- ~~Las cabeceras de seguridad~~ — comprobadas contra los tres dominios: §17.
  Estaban bien. Lo que sale de ahí es otra cosa: la CSP en `Report-Only` ya tiene
  dónde recoger los avisos (§17.3) y las cabeceras no las vigila nada por su
  cuenta (§17.4).
- **De `scripts/` sigo sin leer los scrapers uno a uno.** Es lo único que queda de
  código sin abrir, y §13 cubre lo que de ellos se ejecuta de verdad: los 52 flujos
  activos de n8n, comparados contra la instancia.
- **Exportar los 61 flujos de n8n a mano nunca va a pasar.** §13.1 es la prueba:
  el avisador de fallos lleva meses mejor en n8n que en el repositorio. Hace falta
  un `npm run` que llame al API y los deje en el disco.
- **Volver a mirar quién escribe a las 07h.** En §9.4 lo achaqué a los scrapers y
  §13.5 demuestra que no es eso. Lo dirá `pg_stat_statements`.
- ~~Los 31 `catch {}` vacíos de `billingStore.js`~~ — repasados: §5.8 y §5.9.
- **Dejar que `pg_stat_statements` acumule unos días de tráfico real** y volver a
  `npm run consultas-lentas`. Las decisiones de rendimiento que quedan —qué
  índices tirar, si subir `work_mem`, si pagar más memoria de Neon— se toman con
  esos números y no con los míos medidos a mano (§9).

Y de los 212 scripts no he leído los 212: fui a lo que puede hacer daño
—credenciales, quién escribe en la base, cómo se conecta, quién lanza qué— y está
en §11. Lo que no he hecho es leer los scrapers uno a uno para ver si lo que
rascan sigue cuadrando con lo que enseña cada portal; eso se rompe solo cuando
un portal cambia, y para eso están los 55 `comprueba-*` y el cron que vigila los
scrapers.

Además, lo de §9 deja una tarea que **no es de leer código**: dejar
`pg_stat_statements` acumulando unos días de tráfico real y volver a
`npm run consultas-lentas`. Las decisiones de rendimiento que quedan —qué índices
tirar, si subir `work_mem`, si pagar más memoria de Neon— se toman con esos
números, no con los míos medidos a mano.
