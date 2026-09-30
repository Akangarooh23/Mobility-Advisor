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

108 tablas, **7,63 GB**, y el 88% es una sola: `moveadvisor_market_offers`
(2,8 millones de filas, 6,7 GB).

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

## Lo que falta por revisar

Con su tamaño, para que nadie lea esto como si cubriera todo:

| Zona | Tamaño | Qué buscar |
|---|---|---|
| 4. `api/analyze.js` | 2.068 líneas | inyección de prompt, control de coste del modelo |
| 5. `lib/billingStore.js` | 3.599 líneas | sin prueba propia, y es dinero |
| 6. Las 64 pantallas | 38.900 líneas | estado, validación de formularios, estados de error |
| 7. `scripts/` | 232 ficheros, 52.300 líneas | los scrapers y lo que tocan de la base |

Y lo que no entra en ninguna zona y tampoco he hecho: revisar los **planes de
consulta** más allá de los dos índices arreglados, y las **cabeceras de
seguridad** (hay `docs/cabeceras-de-seguridad.md`, no he verificado que se
apliquen).
