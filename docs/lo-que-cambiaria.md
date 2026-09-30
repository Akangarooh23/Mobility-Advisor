# Lo que cambiaría — revisión a fondo, zona por zona

Revisión de ingeniería del 30 de septiembre de 2026. Cada hallazgo lleva su
evidencia y su gravedad, y **los que resultaron no ser nada también están
apuntados**, porque saber que algo se miró y estaba bien vale tanto como saber
que está mal.

**Contexto que recontextualiza todo**: la base de producción tiene **7 usuarios y
3 coches**. Está pre-lanzamiento. Nada de lo que hay aquí está haciendo daño
ahora mismo; varias cosas empiezan a hacerlo el día que haya tráfico.

Las zonas revisadas van marcadas. Las que faltan están al final, con su tamaño.

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

## Lo que falta por revisar

Con su tamaño, para que nadie lea esto como si cubriera todo:

| Zona | Tamaño | Qué buscar |
|---|---|---|
| `scripts/`, la parte no destructiva | 229 ficheros | los scrapers: qué rascan y qué escriben |
| `api/auth.js` por dentro | 1.873 líneas | revisado por fuera, no leído entero |

Y lo que no entra en ninguna zona y tampoco he hecho: las **cabeceras de
seguridad** (hay `docs/cabeceras-de-seguridad.md`, no he verificado que se
apliquen).

Además, lo de §9 deja una tarea que **no es de leer código**: dejar
`pg_stat_statements` acumulando unos días de tráfico real y volver a
`npm run consultas-lentas`. Las decisiones de rendimiento que quedan —qué índices
tirar, si subir `work_mem`, si pagar más memoria de Neon— se toman con esos
números, no con los míos medidos a mano.
