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

## El plan, en cuatro montones

Los 122 hallazgos, agrupados por **lo que hay que hacer con ellos** en vez de por
dónde están. Salido del propio documento y no de memoria: la lista se extrae de los
encabezados, así que si aparece un hallazgo nuevo arriba, aquí no se olvida.

**Cuarenta y ocho están cerrados** —✅—. De los 74 que quedan, esto es el orden en
que yo los tocaría: **7 🔴, 20 🟠, 33 🟡 y 14 ⚪**.

De los cerrados, unos se arreglaron en esta revisión —llevan **hecho** o
**arreglado** en el título— y otros estaban bien desde antes y lo único que hice fue
comprobarlo. La distinción importa: trece veces me puse a arreglar algo que resultó
que ya estaba resuelto, y eso es trabajo que no hay que volver a hacer.

Los recuentos de este párrafo salen de contar los encabezados del propio documento,
no de memoria. Estuvieron nueve hallazgos por detrás hasta el 1 de octubre.

### A — Arreglos de código pequeños. Ninguno cambia lo que ve un cliente

**Los dieciséis están hechos.** Se hicieron en este orden, cada uno con su prueba, y
cada fila tiene su commit. La columna de la derecha era la estimación; se deja a la
vista porque la tarde salió por diez horas y eso también es información.

| | Qué | Dónde | Cuánto |
|---|---|---|---|
| ✅ A0 | **El índice único de las rectificativas** en el ERP: hoy dos peticiones a la vez emiten **dos abonos** del mismo importe | §20.1 | 20 min |
| ✅ A0b | **Envolver el `fetch` de `client.ts`** del ERP: seis líneas que curan 46 pantallas que hoy se quedan girando si se cae la red | §25.1 | 30 min |
| ✅ A1 | El `DELETE FROM … WHERE user_id` ya está; falta **quitar `mantenimiento-activas.json`** o vaciar su `DELETE`, que hoy borraría 52.768 ofertas si alguien lo enciende | §13.2 | minutos |
| ✅ A2 | **Reexportar el avisador de fallos de n8n** al repositorio: la copia guardada manda desde `onboarding@resend.dev` | §13.1 | minutos |
| ✅ A3 | El `catch` del guardián de n8n: que **un fallo de Postgres no impida levantar n8n** —el enfriamiento, a un fichero local— | §15.1 | 1 h |
| ✅ A4 | **Caducidad al freno de mano** (media hora) y el PID dentro | §15.3 | 20 min |
| ✅ A5 | `registra()` en el `catch` de `el-motor-de-la-ficha`, para que se sepa que está apagado | §12.2 | 20 min |
| ✅ A6 | Que el valor de un parámetro no pueda elegir la ruta (**no** era exigir `?route=`: eso rompía el servidor local) | §12.4 | 1 h |
| ✅ A7 | `timingSafeEqual` en el secreto compartido del ERP | §19.5 | 20 min |
| ✅ A8 | Escapar `<` como `<` en el JSON-LD, que hoy no es explotable pero es una trampa | §6 | 5 min |
| ✅ A9 | Firmar `/api/whatsapp` **aquí**: el ERP ya lo hacía y este lado no. Falla cerrado: **pide `WHATSAPP_APP_SECRET` en Vercel** | §3.1, §19.6 | 2 h |
| ✅ A10 | Subir la contraseña mínima a 8 | §10.7 | 5 min |
| ✅ A11 | Los tres campos del alta de empresa, ya hechos; falta **quitar las 7 entradas muertas** de `package.json` y las 3.406 líneas de Python de SQL Server | §11.5, §18.2 | 1 h |
| ✅ A12 | `*.log` al `.gitignore` y quitar los seis del índice | §18.1 | 5 min |
| ✅ A13 | Las 9 claves ajenas sin índice: **gratis ahora**, que las tablas están vacías | §1.2 | 30 min |

### B — Decisiones tuyas. No son trabajo, son un sí o un no

Ninguna la puedo tomar yo, y tres de ellas bloquean el lanzamiento:

1. 🔴 **`AUTH_EXPOSE_RESET_CODE` en Vercel**, verificada como falsa o ausente. En
   `.env.local` está en `true`, y con ese valor la API devuelve el código de
   recuperación de cualquier cuenta. Es una comprobación de treinta segundos.
2. 🔴 **`AUTH_BILLING_REQUIRE_SESSION` que no esté en `false`** en Vercel.
3. 🟠 **Las siete lecturas** que devuelven lista vacía cuando la base falla (§5.8).
   Cambiarlo enseña un aviso de error en vez de «no tienes nada». Yo lo cambiaría.
4. 🟠 **Los 87 `leasys-%`** vivos en el marketplace, de un proveedor que ningún
   código nombra (§7.2): borrar o marcar inactivos.
5. 🟠 **El 409 del alta** (§10.2): hoy dice si un correo tiene cuenta. Cerrarlo es
   contestar lo mismo que en un alta buena y avisar por correo al dueño.
6. 🟡 **Los dos crones de facetas**, de cada hora a una vez al día tras la carga de
   las 07h: 46 minutos diarios de escaneo y dos vaciados de caché por hora (§9.4).
7. 🟡 **Los 126 MB de `moveadvisor_market_dealers`** que nada de lo desplegado lee
   (§12.5): si no hacen falta, es el único sitio donde se gana caché gratis.
8. 🟡 **El consentimiento del alta** (lo documenta `useLosConsentimientosDelRegistro.js`).
9. 🟡 **Si el ERP lleva su propia base de datos.** Un commit de julio dice que sí y
   `ERP_DATABASE_URL` no existe.
10. ⚪ **Entrar en la lista de precarga de HSTS** (§17.5). Es de una sola dirección.
11. ⚪ **Borrar los 7 `tmp_*` de `scripts/`** y el flujo vacío de n8n (§11.6, §13.4).

### C — Tareas que no son leer código ni arreglar una línea

- 🔴 **Dejar `pg_stat_statements` unos días y volver a `npm run consultas-lentas`.**
  Es lo primero de toda la lista. Qué índices tirar de los 523 MB (§1.1), si subir
  `work_mem` (§9.2), si pagar más memoria de Neon (§9.1): **nada de eso se decide sin
  esos números**, y mis medidas a mano fallaron cuatro veces —la última porque un
  `SET` no llega donde yo creía (§19.4)—.
- 🟠 **Un `npm run` que exporte los 61 flujos de n8n por su API.** A mano no va a
  pasar; §13.1 es la prueba.
- 🟡 **Un cron semanal** que lance `test:cabeceras` (§17.4), y el `report-uri` de la
  CSP apuntando a `/api/error`, que ya existe entero (§17.3).
- 🟡 **Añadir la tabla de latidos de n8n** a `cron-avisa-de-los-fallos`, que ya manda
  correos desde Vercel: es la mitad del diseño que falta (§15.2).
- 🟡 **Averiguar quién escribe a las 07h.** Lo achaqué a los scrapers y demostré que
  no es eso (§13.5). Lo dirá `pg_stat_statements`.

### D — Trabajo de fondo, con coste real. Aquí hay que elegir

- 🔴 **El 36,8 % de acierto de caché** (§9.1). La base pesa 7.294 MB contra 128 MB de
  `shared_buffers` y 3 GB de caché de Neon. **No se arregla con SQL**: o el conjunto
  de trabajo se hace más pequeño —tirar los 523 MB de índices muertos, archivar
  ofertas viejas— o se paga una instancia con más memoria. De aquí sale la mitad de
  lo demás: los 8,6 segundos del consejero (§8.1), los 253 de la búsqueda (§8.2) y
  que nada se pueda medir a mano.
- 🟠 **La tercera vista materializada** `(provincia, combustible, banda de precio)`
  (§8.3). El patrón ya existe y funciona —leer `mmo_modelos` tarda 58 ms—; esto
  convierte 8,6 segundos en milisegundos. Es el arreglo grande con mejor relación
  esfuerzo/resultado, y la decisión de diseño es la banda de precio.
- 🟠 **Las 280 sentencias de esquema del ERP** y su falta de migraciones (§19.1). Hoy
  no hay divergencia —lo medí, 10 columnas de 1.391 y todas en tablas `erp_*`— pero
  dos repositorios definiendo las mismas tablas es una avería esperando el día en
  que no coincidan.
- 🟡 **La duplicación de `src/`**: cuatro funciones del garaje con seis
  comportamientos (§6.1), `normalizeText` en 10 pantallas (§6.2), 2.725 estilos en
  línea (§6.3). No rompe nada; se paga en cada cambio.
- 🟡 **Los dos frenos de ritmo**, y que el de memoria no frena en serverless (§3.4);
  y que las defensas vivan en capas distintas (§3.3).

### E — Lo que ya está arreglado en esta revisión

Catorce, y cada uno con su prueba y su commit. Los cinco que más importan:

1. **Ocho manejadores cerraban el pool compartido** y tiraban la instancia entera.
2. **`/api/analyze` era un proxy abierto** a la cuenta de Gemini.
3. **Un `node scripts/reset-…`** borraba 2,8 millones de filas sin preguntar.
4. **Ocho acciones contestaban «guardado»** con un 200 cuando la base había dicho no
   (§5.8), y la tasación **tasaba con precios del 14 de agosto** presentándolos como
   de hoy (§12.1).
5. **Cambiar la contraseña no cerraba ninguna sesión** (§10.1), el login **decía por
   el reloj** qué correos existen (§10.3), y el CI **no corría 2.624 pruebas** (§11.1).

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

### ✅ 3.1 — `/api/whatsapp` no verificaba la firma de Meta — **hecho**

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

#### Lo que se hizo

`loMandaMeta(req, res)` en `lib/api/whatsapp-handler.js`, llamada **antes** de leer
el cuerpo. Recalcula el HMAC-SHA256 sobre el cuerpo en bruto y lo compara en tiempo
constante, comprobando la longitud primero —`timingSafeEqual` levanta con búferes
desiguales, y eso convertiría un 401 en un 500—. Seis pruebas en
`lib/api/solo-meta-escribe-en-whatsapp.test.js`.

**Falla cerrado.** Sin `WHATSAPP_APP_SECRET` no se atiende a nadie: 503. Es a
propósito, y es la versión que el webhook de Stripe tenía mal —`if (secreto) { … }`:
sin variable, puerta abierta, y nadie se enteraba—. Tiene una consecuencia
inmediata:

> 🔴 **Hay que poner `WHATSAPP_APP_SECRET` en Vercel** —el «App Secret» de la app de
> Meta, el mismo valor que ya usa el ERP— **o los leads de WhatsApp dejan de
> llegar**. Mientras falte, cada aviso de Meta se rechaza con 503 y se apunta con
> `registra()`, así que sale en el aviso horario en vez de perderse callando.

Y el recurso del cuerpo en bruto tiene un límite que hay que decir: cuando
`req.rawBody` no viene, se rearma con `JSON.stringify(req.body)`, que **no garantiza
los mismos bytes** que mandó Meta. Es el mismo recurso que usa el webhook de Stripe.
Si no cuadra, el rechazo queda apuntado y se ve en una hora; no se pierde nada en
silencio. Es la razón de que cada rechazo pase por `registra()` y no por un
`console.error`.

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

> **Y aquella medición era peor que inconcluyente: no medía lo que yo creía.** Lo
> descubrí en §19.4. Las conexiones van por pgbouncer, y un `SET work_mem` se queda
> en el backend del servidor, no en el cliente: probado con dos clientes, el que
> hace el `SET` **no lo ve** y el otro **sí**. Así que no sé si los 32 MB llegaron a
> la consulta que cronometré. Lo que escribí de que «32 MB es el único con varianza
> estrecha» hay que tacharlo.

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

## Zona 18 — Lo que no había nombrado nunca ✔ revisada

Al preguntarme si quedaba algo, conté los tipos de fichero versionados en vez de
contestar de memoria. Y había categorías que no había mencionado ni una vez: 8
ficheros `.py`, 6 `.log`, 12 `.csv`, 30 `.xml`, 7 `.docx`.

### ⚪ 18.1 — Seis ficheros de registro versionados, y no llevan nada grave

`cochesnet-refill.log`, `phase1`, `phase2`, `phase3`, `incremental-top4` e
`incremental-secondary12`. Están en UTF-16 y suman 139 líneas.

Importa porque **el repositorio es público**, así que los miré uno a uno buscando
correos, tokens, contraseñas, claves y matrículas. **No hay nada de eso.** Lo que
hay es:

- el nombre de la instancia de SQL Server: `localhost\SQLEXPRESS / Mobilityadvisor`,
  con `Auth: windows-auth`, o sea sin contraseña que filtrar;
- la ruta de Python con el usuario de Windows dentro
  (`C:\Users\Anapi\AppData\Local\...`), que además ya se deduce del autor de los
  commits.

No es una fuga. Es basura de una ejecución de agosto que se colgó del repositorio,
y `*.log` debería estar en el `.gitignore` como está `.env*`.

### 🟡 18.2 — 3.406 líneas de Python que son el scraping de la era SQL Server

| Fichero | Líneas |
|---|---:|
| `scrapers/live_scraper.py` | 1.569 |
| `scraper_coches_net.py` | 605 |
| `docs/planning/generate_premium_planning_files.py` | 564 |
| `scrapers/main.py` | 233 |
| `docs/planning/generate_import_files.py` | 212 |
| `run_scraper.py` | 112 |
| `scrapers/platform_catalog.py` | 71 |
| `docs/planning/extract_docx_to_txt.py` | 40 |

`scrapers/main.py` es el único al que llama algo, y lo que le llama lo dice todo:

```
"inventory:scrape:live:sqlserver":    "python scrapers/main.py … --persist-sqlserver"
"inventory:scrape:all:sqlserver":     "python scrapers/main.py … --persist-sqlserver"
"inventory:scrape:massive:sqlserver": "python scrapers/main.py … --persist-sqlserver"
```

Más `scripts/run-inventory-sqlserver.cmd`, que hace lo mismo. **Los tres acaban en
`--persist-sqlserver`**, y SQL Server no existe en ninguna parte —lo dice
`api/auth.js` al retirar el proveedor `mssql`, y lo confirma §11.5—.

O sea que esto es el stack de scraping **anterior a los 52 flujos de n8n**, con su
propio catálogo de plataformas y su propio scraper en vivo de 1.569 líneas. No
corre, no puede correr, y nadie lo ha mirado en meses.

**Esto amplía §11.5**: las entradas muertas de `package.json` no son cuatro, son
**siete**, y detrás de tres de ellas hay 3.406 líneas de Python y un `.cmd`. Yo lo
borraría entero en un commit con el motivo escrito —la historia de git lo guarda—,
pero borrar es decisión de Ana.

### ⚪ 18.3 — Y el resto de esas categorías no es código

Los 30 `.xml` y los 6 `.gradle` son del envoltorio Android, que nunca se llegó a
montar. Los 7 `.docx` y los `.csv` de `docs/planning/` son documentos de
planificación de sprints y ficheros de importación para Jira y Linear, con 15
líneas cada uno. Los 22 `.css` son de `src/styles/`, y el único con decisiones
dentro es `fuentes.css`, que ya sale en §17 por autoservirse Nunito Sans.

---

## Zona 19 — El ERP, primera pasada, y una corrección mía que sale de ahí ✔ revisada

`carswise-erp-backoffice`: 80.232 líneas, 40.752 en `apps/api` y 37.561 en
`apps/web`. Es otro repositorio y **escribe en la misma base de datos que éste**,
así que le pasé de checklist lo que había encontrado aquí. No está revisado entero
—es una primera pasada— pero lo que sale ya cambia dos cosas de este documento.

### 🟠 19.1 — 280 sentencias de esquema dentro de las peticiones, y ninguna migración

42 ficheros de `apps/api/src` ejecutan `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS` o `CREATE INDEX IF NOT EXISTS` en medio de una
petición. **280 sentencias.** Y no hay carpeta de migraciones: ni `migrations/`,
ni `prisma/`, ni nada.

Es exactamente la enfermedad que se curó en este repositorio, y a mayor escala:
`el-esquema-tiene-un-dueno.test.js` nació porque había **25 ficheros y 224
sentencias** haciendo esto, y la avería concreta fue que descargar una factura en
PDF estaba roto en producción —`column i.rectifica_numero does not exist`— porque
las tres columnas las creaba un fichero al que nadie llamaba.

Y lo que lo hace peor aquí es que **el ERP crea y altera tablas de este
repositorio**:

```
moveadvisor_user_vehicles        moveadvisor_invoice_counters
moveadvisor_user_vehicle_files   moveadvisor_marketplace_vo_units
moveadvisor_market_leads         moveadvisor_renting_contracts
moveadvisor_workshop_reservations, _blocks    vehicle_visit_bookings (×4)
moveadvisor_provider_invoices (×2)
```

O sea que el esquema de la base compartida lo definen dos sitios: las 19
migraciones de aquí, con sus huellas sha256 en `migraciones_aplicadas`, y 280
sentencias repartidas por los manejadores del ERP.

### ✅ 19.2 — Pero hoy no hay divergencia, y eso lo medí antes de alarmar

Iba a escribir que las dos definiciones se han separado. **No se han separado.**
Comparé las columnas de la base contra todo el SQL de `migrations/`:

| | |
|---|---:|
| Columnas en tablas que `migrations/` declara | **1.391** |
| De ésas, columnas que ninguna migración nombra | **10** |

Y las diez están en dos tablas `erp_*`, que son del ERP: nueve en
`erp_encargos_venta` (`ingreso_at`, `gestoria_at`, `liberado_at`…) y una en
`erp_revisiones_taller` (`taller_id`). **Cero en tablas `moveadvisor_*`.**

Así que el `CREATE TABLE IF NOT EXISTS` del ERP sobre las tablas compartidas hoy
es **redundante, no divergente**. El riesgo es estructural: `IF NOT EXISTS` sobre
una tabla que ya existe con otra forma **no hace nada y no avisa**, así que el día
que las dos definiciones no coincidan, la consulta del ERP falla en caliente y
nadie se entera. Y una base nueva creada desde `migrations/` no tendría esas diez
columnas.

### ✅ 19.3 — Y en lo demás el ERP está mejor que este repositorio

Le pasé el resto del checklist y sale bien parado:

- **Ni un `catch {}` vacío** en `apps/api/src`. Aquí hay 31 solo en
  `billingStore.js` (§5.9).
- **Un solo pool**, en `apps/api/src/db/pool.ts`, con `max: 10` y
  `idleTimeoutMillis`. Y **nadie lo cierra**: cero `.end()` en los manejadores, que
  es el fallo que tumbaba instancias enteras aquí (§2).
- **Los `DELETE` van acotados y parametrizados.** Miré los cuatro que salieron:
  los de `moveadvisor_workshop_blocks` llevan `WHERE workshop_id = $1 AND dia = $2`
  y los de `erp_tramites` cinco condiciones.
- **Ni una credencial.** Lo único con forma de secreto es
  `SECRET = 'secreto-de-mentira'` en un test.

### 🔴 19.4 — Corrección: dije que probar `work_mem` «en mi sesión» no afectaba a nadie, y es falso

Esto salió tirando del hilo de las conexiones, y corrige la zona 9.

Todas las conexiones a esta base pasan por **pgbouncer** —lo dice
`pg_stat_activity`: `application_name = pgbouncer`—, y el límite es de 450
conexiones con 4 en uso, así que agotarlas no es el riesgo que yo iba buscando.

Lo que sí es un riesgo lo encontré probándolo. Abrí **dos clientes independientes**
contra la misma base, hice `SET work_mem = '32MB'` en uno y pregunté desde el otro:

```
  B antes de que A toque nada:   4MB
  A despues de su propio SET:    4MB     <- A no ve lo que acaba de poner
  B despues, seis veces:        32MB, 32MB, 32MB, 32MB, 32MB, 32MB
```

**A no ve su propio ajuste y B sí lo ve.** El `SET` se queda en el backend del
servidor que pgbouncer le asignó, y ese backend se le entrega después a quien
pregunte.

Dos consecuencias, y la primera es mía:

1. **Le dije a Ana que la prueba de `work_mem` la hacía «en mi sesión, que no
   afecta a nadie».** Era falso: ese ajuste se fue a backends compartidos con el
   tráfico de producción. No ha pasado nada —7 usuarios, prelanzamiento— pero lo
   afirmé sin comprobarlo. Ya está limpio: lancé `RESET ALL` en varias rondas y
   `work_mem` vuelve a leerse como `4MB` ocho veces seguidas.
2. **Y la medición de §9.2 no medía lo que yo creía.** Los tiempos de 8.513, 2.965
   y 16.031 ms se tomaron sin saber si el `SET` había llegado a la consulta medida
   o a la de otro. Con lo cual lo que escribí allí —«32 MB es el único con varianza
   estrecha»— **no vale**, y la conclusión de esa zona se refuerza: esto no se mide
   a mano, se mide con `pg_stat_statements`.

**Cómo se hace bien.** Lo comprobé en la misma pasada: `SET LOCAL` dentro de un
`BEGIN` sí queda acotado —64MB dentro de la transacción, 4MB después del
`COMMIT`—. Para un cambio permanente, `ALTER DATABASE`. Y cualquier guion que haga
`SET` contra este `DATABASE_URL` está tocando a los demás, así que eso merece un
aviso en `lib/postgres.js`.

### 🟡 19.5 — El secreto compartido se compara con `!==` y el resto del repositorio no

`apps/api/src/routes/idcars.ts`, la puerta por la que este repositorio le pide al
ERP que lea una ficha técnica:

```ts
if (String(req.headers.authorization ?? '') !== `Bearer ${secreto}`) {
  res.status(401).json({ ok: false, error: 'no_autorizado' });
```

Comparación de cadenas, que corta en el primer carácter distinto. Y el mismo
repositorio usa `timingSafeEqual` en **cuatro** sitios: `lib/personal.ts`,
`lib/whatsapp.ts`, y dos en `routes/auth.ts`. O sea que la costumbre está y aquí
no se aplicó.

A diferencia de comparar hashes —donde da igual, §10.10—, aquí **el atacante
controla lo que se compara**: puede mandar el token que quiera y medir. Sacar un
secreto byte a byte por la red es difícil y ruidoso, pero no imposible con
suficientes muestras, y la puerta que protege es la que lee documentos de coches
de clientes.

**Cómo se arregla**, y es lo que hacen los otros cuatro: recortar a la misma
longitud primero —`timingSafeEqual` **levanta** si los búferes miden distinto— y
comparar con él.

### ✅ 19.6 — Y la firma del webhook de WhatsApp está bien hecha (en el ERP; la de la web se añadió en §3.1)

Miré `lib/whatsapp.ts` esperando encontrar justo ese fallo, porque es el clásico:

```ts
const recibida = cabecera.slice('sha256='.length);
if (recibida.length !== esperada.length) return false;
return timingSafeEqual(Buffer.from(recibida, 'utf8'), Buffer.from(esperada, 'utf8'));
```

La comprobación de longitud **está antes**, que es lo que evita que
`timingSafeEqual` levante con una firma de tamaño raro y convierta un 401 en un
500. Y si falta `WHATSAPP_APP_SECRET` el webhook **rechaza todo** en vez de dejar
pasar, con el aviso explicando dónde se pone.

Vale la pena decirlo porque en este repositorio `/api/whatsapp` **no verifica
ninguna firma** (§3). Los dos lados hablan con Meta y solo uno comprueba quién
llama.

### ✅ 19.7 — La autorización del ERP está bien, y mejor que la de aquí

Vine buscando el fallo clásico y **no está**. Primero conté: `requireAuth` aparece
en **un solo sitio** de 281 rutas, y ningún `app.use(requireAuth)` delante de los
38 routers. Eso parecía el hallazgo más grave de toda la revisión.

No lo era: el ERP usa `requireRole`, no `requireAuth`, y `requireRole` llama a
`requireAuth` por dentro antes de mirar el rol. Medido ruta por ruta —la primera
medida contaba el fichero entero y daba 262 de 265, que no vale—:

| | |
|---|---:|
| Rutas | **264** |
| Con comprobación propia | **255** |
| Sin ninguna | **9** |

Y las nueve son las que deben estarlo: los cinco de `auth.ts` (login, refresh,
logout, olvidé la contraseña, resetear), `health`, y los webhooks. Los dos de
`/cron/` sí comprueban, con un `autorizado(req)` que mi lista de señales no
conocía.

Además los roles son de privilegio mínimo de verdad, no decorativos:
`/contabilidad` solo `admin`, `/billing` `admin` y `operations`, `/users` los
cuatro. Y **`JWT_SECRET` se valida con `z.string().min(16)`**: sin él la
aplicación no arranca. Aquí, en cambio, `AUTH_SESSION_SECRET` tiene un valor de
reserva escrito en el repositorio (§10.10) — que no permite falsificar nada, pero
la disciplina del ERP es la buena.

Lo único que le pondría: `jwt.verify(token, secreto, { algorithms: ['HS256'] })`.
Sin fijar el algoritmo se acepta el que diga el token; con un secreto de texto
`jsonwebtoken` ya limita a HMAC, así que no es explotable hoy, pero fijarlo cuesta
nada.

### Lo que NO he revisado del ERP

Casi todo: 80.232 líneas y he mirado cuatro cosas concretas. No he entrado en
`apps/web` (37.561 líneas), ni en la lógica de encargos, pedidos, trámites,
peritaciones o facturación, ni en sus 20 guiones `comprueba-*`, ni en cómo
autentica. Lo de arriba es lo que se ve pasándole el checklist de este documento,
no una revisión.

---

## Zona 20 — Las facturas del ERP ✔ revisada

Fui a la numeración porque en España tiene que ser correlativa y sin huecos —Real
Decreto 1619/2012— y porque una carrera en un contador de facturas no es un fallo
de estilo. El contador está bien. Lo que hay alrededor, no del todo.

### 🟠 20.1 — Dos rectificativas de la misma factura, si se piden a la vez

`routes/invoice-download.ts`, la ruta que emite una rectificativa:

```ts
const existing = await query(`… WHERE rectifies_id = $1`);
if (existing.rows.length) {
  res.status(409).json({ ok: false, error: 'already_rectified', … });
  return;
}
const rectId = await nextInvoiceNumber('RECT');
await query(`INSERT INTO moveadvisor_provider_invoices (…) VALUES (…)`, [rectId, …, -origAmount, …]);
```

Comprobar y luego actuar, sin nada en medio que lo haga atómico. Dos peticiones a
la vez pasan las dos el `SELECT`, cogen **dos números RECT distintos** y hacen dos
`INSERT` que **los dos funcionan**, porque la clave primaria es el propio número y
son distintos.

Y miré si alguna restricción lo salvaba: en `db/schema.ts`,
`moveadvisor_provider_invoices` tiene `id VARCHAR(40) PRIMARY KEY` y **ni un
`UNIQUE`** sobre `rectifies_id` ni sobre `invoice_number`.

El resultado no es un duplicado cosmético: son **dos abonos del mismo importe**
—`-origAmount` dos veces— contra una factura que solo se emitió una vez. Eso sale
en el modelo 303 y hay que explicarlo.

**El arreglo son dos líneas y la primera es la que importa**:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_invoices_rectifies
  ON moveadvisor_provider_invoices (rectifies_id)
  WHERE rectifies_id IS NOT NULL;
```

Con eso el segundo `INSERT` falla limpio y el 409 pasa a ser verdad en vez de una
apariencia. Lo segundo, envolver las dos sentencias en una transacción.

### 🟡 20.2 — El número se coge fuera de cualquier transacción, y no hay ninguna en todo el ERP

`nextInvoiceNumber()` y el guardado del número son **dos sentencias sueltas**:

```ts
invoiceNumber = await nextInvoiceNumber('SUBS');
await query(`UPDATE moveadvisor_user_invoices SET cw_invoice_number = $1 WHERE id = $2`, …);
```

Si el proceso muere entre las dos —o el `UPDATE` falla— el número queda consumido y
ninguna factura lo lleva: **un hueco en la serie**, que es justo lo que la ley no
quiere. La ventana es estrecha, pero en la rectificativa es más ancha, porque lo que
va después es un `INSERT` de doce columnas con una clave ajena.

Y lo de fondo: **no hay ni una transacción en toda la API del ERP.** Busqué `BEGIN`,
`withTransaction` y `transaction(` en los 40.752 líneas de `apps/api` y los únicos
resultados son `BEGIN:VCALENDAR` y `BEGIN:VEVENT`, de un fichero de calendario.

### ✅ 20.3 — El contador en sí está bien hecho, y es lo difícil

Esto es lo que esperaba encontrar mal y está bien:

```sql
INSERT INTO moveadvisor_invoice_counters (series, year, last_n)
VALUES ($1, $2, 1)
ON CONFLICT (series, year) DO UPDATE
  SET last_n = moveadvisor_invoice_counters.last_n + 1
RETURNING last_n
```

Una sola sentencia, así que dos peticiones simultáneas se serializan en el bloqueo
de la fila y **no puede salir el mismo número dos veces**. Es la forma correcta, la
misma que usa `lib/freno.js` en el otro repositorio para contar intentos.

Y el camino de las facturas de suscripción es **idempotente**: si la fila ya tiene
`cw_invoice_number`, se reutiliza en vez de coger otro. Así que un reintento tras un
fallo de Supabase no gasta un número, que es el error obvio y no lo comete.

### ✅ 20.4 — Y las facturas ya no están en un cubo público

Lo leí de pasada y merece quedar apuntado, porque es un acierto con su motivo
escrito:

> *«Era el mismo que el de las fotos, que es público porque las fotos tienen que
> serlo. Una factura no: lleva nombre, NIF, dirección y matrícula, y con la
> dirección delante se abría sin sesión.»*

Ahora van a `erp-documentos`, el cubo privado, y el nombre del fichero lleva un
trozo aleatorio **porque las facturas van numeradas seguidas** y con la numeración
se adivina la siguiente.

---

## Zona 21 — El dinero del ERP ✔ revisada

Después de §20 fui a la aritmética, que es donde un error no se ve y se acumula.
**Busqué tres fallos concretos y los tres estaban ya resueltos**, con el
razonamiento escrito en el código. Lo apunto porque saber que el dinero está bien
hecho vale tanto como encontrar que no.

### ✅ 21.1 — Los importes van en `NUMERIC`, no en coma flotante

`base_amount NUMERIC(10,2)`, `invoice_amount NUMERIC(10,2)`,
`iva_amount NUMERIC(12,2)`, `iva_rate NUMERIC(5,4)`. Decimal exacto, que es el
tipo correcto: `REAL` o `DOUBLE` para dinero es el error clásico y no está.

(Mobility guarda en céntimos enteros y el ERP en `NUMERIC` con dos decimales. Son
dos soluciones buenas del mismo problema, y conviven porque cada uno manda en sus
tablas.)

### ✅ 21.2 — La cuota se calcula restando, y está dicho por qué

Esto es lo que iba buscando. Si la base sale de `total / 1,21` y la cuota de
`base × 0,21`, **son dos redondeos independientes** y para ciertos importes
`base + cuota` se separa un céntimo del total. En una factura española eso está
mal: base + cuota tiene que dar el total.

`lib/comision-de-financiacion.ts`:

```ts
const base = dosDecimales(total / (1 + IVA_GENERAL / 100));
/*
 * La cuota, restando y no multiplicando.
 *
 * […] con dos redondeos independientes la factura se separa un céntimo para
 * ciertos importes, y el guardián de `provider-billing` admite dos céntimos de
 * holgura — así que no saltaría y la factura estaría mal sin que nadie se enterara.
 */
return { total: dosDecimales(total), base, cuota: dosDecimales(total - base), … };
```

`cuota = total - base`. Y el comentario va más lejos que el arreglo: dice que el
guardián que debería cazarlo **no lo cazaría**, porque tiene holgura. Eso es
entender un fallo, no solo taparlo.

### ✅ 21.3 — Y esa holgura de dos céntimos está en el lado correcto

Iba a apuntarla como sospechosa —una tolerancia en una comprobación de dinero suele
estar tapando algo—. Es lo contrario. `routes/provider-billing.ts`:

```sql
WHERE id = $1 AND direction = 'received'
  AND ( $6::numeric IS NULL
        OR ABS(COALESCE($5::numeric, base_amount) + $6::numeric - invoice_amount) <= 0.02 )
```

Solo aplica a `direction = 'received'`: facturas que **nos manda un proveedor** y
que teclea una persona, donde el redondeo del proveedor puede no ser el nuestro.
Exigir un cuadre exacto ahí rechazaría facturas válidas. Lo que emitimos nosotros
va por el camino exacto de §21.2.

Y está puesta **en el `WHERE` de un `UPDATE`**, así que la base la hace cumplir; no
es una comprobación en JavaScript que alguien pueda saltarse llamando por otro
lado. Cuando no cuadra, `rowCount` es 0 y el código distingue *«o no existe, o la
cuota no cuadra»* en vez de dar un error genérico.

### Lo que esto dice, y lo que no

Tres sitios, tres aciertos. No he revisado la contabilidad entera del ERP —queda
`lib/apuntes.ts`, `lib/coste.ts`, `lib/cierre-del-encargo.ts`, los trámites y los
gastos—, así que esto no es «el dinero del ERP está bien»: es «los tres fallos
clásicos que fui a buscar no están, y el código explica por qué».

Lo que sí digo es que **el patrón de §20.1 no se repite aquí**. Aquella carrera de
las rectificativas no era descuido con el dinero: era falta de una restricción en la
base, en un sitio donde el resto del razonamiento está bien hecho.

---

## Zona 22 — `src/` entero, barrido por clase de defecto ✔ primera pasada

Para llegar al 100 % de las 64.612 líneas de `src/` sin leerlas una a una, la forma
que funciona es al contrario: coger una clase de defecto y pasarla por **todos** los
ficheros. Esta pasada cubre **170 de 170** y busca tres cosas, las tres de dinero,
porque es lo que se nota:

| Clase | Encontradas |
|---|---:|
| `Math.round(x).toLocaleString()` sin comprobar `x` | 2 |
| `.toLocaleString("es…")` sobre un valor sin guardia | **0** |
| `Number(precio) \|\| 0` | 3 |

Cinco candidatas en 170 ficheros, y **cero de la clase más común**. El front está
más limpio de lo que esperaba: formatea después de comprobar, casi siempre.

De las cinco, una es real y llega al cliente.

### 🟠 22.1 — Un coche sin precio se enseña a 0 €, y ese 0 llega a la cuota y al depósito

`src/pages/PortalVoDetailPage.js`, la ficha de un coche del marketplace:

```js
const precioConGarantia = (Number(selectedPortalVoOffer.price) || 0) + diferenciaGarantia;
…
const precioFinanciable = isImport ? precioConGarantia
  : Number(selectedPortalVoOffer.salePrice ?? selectedPortalVoOffer.price) || 0;
```

`Number(null) || 0` es `0`. Así que sin precio, lo que se pinta en la línea 798 con
`formatCurrency(precioConGarantia)` es **la diferencia de la garantía sola** —o 0 €
si no hay ampliación elegida—, presentada como el precio del coche. Y `0` sigue
hacia `precioFinanciable`, de donde salen —lo dice el comentario de la línea 262—
*«el grande de arriba, la cuota del mes, la fianza y el ahorro»*.

**Y llega, no es teórico.** Lo conté en la base:

| | |
|---|---:|
| Ofertas totales | 2.464.301 |
| Sin precio (`NULL` o `0`) | **32** |
| De ésas, **activas** | **32** |
| De ésas, **con `visible_desde`** | **32** |

Las 32 están vivas y visibles: 19 de Wallapop, 7 de Autocasión, 6 de Milanuncios.
Portales de particulares, donde «a consultar» es normal.

**Lo que más me convence de que es un descuido y no una decisión**: el ahorro **sí
está protegido**, tres líneas más abajo.

```js
const ahorroConGarantia = precioEspanolMedio > 0 && precioConGarantia > 0
  ? Math.round(precioEspanolMedio - precioConGarantia) : …
```

O sea que ya se sabía que `precioConGarantia` puede ser cero. Se guardó la cifra
derivada y no la que se pinta.

**Qué haría**: si no hay precio, no hay precio. «Precio a consultar», que es lo que
pone cualquier portal español, y el camino de financiación y depósito desactivado —
porque no se puede calcular una cuota sobre un importe que no existe, ni cobrar un
depósito de un coche sin precio—.

Y **una prueba con esas 32 ofertas de verdad**: es un caso que la base tiene hoy y
que ninguna prueba mira.

### ⚪ 22.2 — Y las otras cuatro, por qué no son nada

Lo apunto para que nadie las persiga otra vez:

- `EscenaMercado.js:65` — `Math.round(n).toLocaleString("es-ES")` en una escena
  animada que recibe números de un guion propio, no de la base.
- `ServiceMaintenancePage.js:383` — `Math.round(estimation.kmToNext)`, y
  `estimation` solo existe si se pudo estimar; el bloque entero va detrás de esa
  comprobación.
- `PortalVoDetailPage.js:269` y `:295` — el mismo `|| 0` de §22.1, contados aparte
  porque son otras dos expresiones; se arreglan con el mismo cambio.

### Lo que esta pasada cubre, y lo que no

Cubre **el 100 % de los ficheros de `src/`** para tres clases de defecto. No cubre
las demás clases: fechas y zonas horarias, estados de error que no se enseñan,
efectos sin limpieza que escriben después de desmontar, dependencias de `useMemo`
que mienten. Cada una es otra pasada, y cada pasada vuelve a ser sobre los 170.

Es así como se llega a una cobertura que se puede defender sin leer 64.612 líneas:
no «he mirado este fichero», sino «este defecto no está en ninguno».

---

## Zona 23 — Las fechas, en los 309 ficheros de `src/`, `lib/` y `api/` ✔ primera pasada

Segunda pasada por clase de defecto. Cuatro trampas de fechas, las cuatro reales en
España, sobre **309 ficheros**: los 170 de `src/`, los de `lib/` y los de `api/`.

| Trampa | Candidatas | Reales |
|---|---:|---:|
| `toISOString().slice(0,10)` sobre una fecha local | 6 | **4** |
| `new Date()` de una cadena de solo fecha | 10 | 0 |
| Desplazamiento de zona escrito a mano | 2 | 0 |
| `getDate()` y `getUTCDate()` mezclados | **0** | 0 |

### 🟡 23.1 — Entre medianoche y las 02:00, «hoy» es ayer

Tres pantallas comparan una fecha con «hoy» así:

```js
return dateStr === new Date().toISOString().slice(0, 10);
```

`toISOString()` da **UTC**. España va una o dos horas por delante, así que entre las
00:00 y las 02:00 el día en UTC todavía es el anterior. Lo demostré en esta máquina,
que está en `Europe/Madrid`:

```
A las 00:30 del 1 de octubre en España:
   la hora local es            1/10/2026, 0:30:00
   y el código dice que hoy es 2026-09-30   <-- el día anterior
```

Donde está: `src/components/SlotPicker.js:25` y `src/pages/MiCitaPage.js:22`, que
marcan si un hueco es «hoy», y `src/components/AvailabilityEditor.js:19` y `:47`,
que es la rejilla con la que el taller abre y cierra su disponibilidad.

Lo que pasa: quien entre a reservar a la una de la mañana ve el día de hoy marcado
como pasado, o un hueco de hoy ofrecido como si fuera de ayer. Y el taller que
edite su agenda a esa hora abre el día equivocado.

Es una ventana de dos horas, así que no es grave. Pero **para un taller abrir el día
equivocado sí lo es**, y el arreglo es una línea: formatear en local en vez de en
UTC.

```js
const hoyEnEspana = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
// "2026-10-01" — en local, sin pasar por UTC
```

### 🟡 23.2 — El aviso de las citas acierta en Vercel y falla en local

`lib/api/cron-appointment-reminders-handler.js:20` hace lo mismo sobre una columna
que **es de tipo `date`**: `moveadvisor_workshop_reservations.dia`.

`pg` convierte una columna `DATE` a un objeto de fecha **a medianoche local**. Así
que:

| Dónde corre | Zona | Qué sale de `dia` = 2026-10-01 |
|---|---|---|
| Vercel | UTC | `2026-10-01` ✅ |
| Tu máquina | Europe/Madrid | **`2026-09-30`** ❌ |

Lo comprobé: una fecha construida como medianoche del 1 de octubre en Madrid pasa
por `toISOString().slice(0,10)` y sale 2026-09-30.

O sea que **el recordatorio funciona en producción y miente en desarrollo**. Es lo
peor de los dos mundos para depurar: cualquiera que lo pruebe en local verá
recordatorios del día anterior y buscará un fallo que allí no existe. Y si algún día
se mueve la región de Vercel a una zona que no sea UTC, empieza a fallar en
producción sin que nadie haya tocado nada.

### ✅ 23.3 — Y las doce candidatas restantes no son nada, una por una

Esto es la mitad del valor de la pasada: dejar dicho qué no hay que volver a mirar.

- **Los dos `3600000`** son **duraciones**, no desplazamientos de zona:
  `Date.now() >= empezo + 3600000` es «¿ha pasado una hora?» y
  `new Date(cuando.getTime() + 3600000)` es «la visita acaba una hora después». El
  cambio de hora no les afecta. Mi patrón era demasiado ancho.
- **Cinco `new Date(row.…)` de `lib/api/`** —facturas, próximo cobro— leen columnas
  que son `timestamp with time zone`, y `pg` las devuelve ya como objetos de fecha.
  Pasarlas por `new Date()` las **clona**, no las reinterpreta. Lo comprobé en el
  esquema de la base, no de memoria.
- **`inventoryStore.js:292`, el `next_itv`**: la columna es `character varying` y me
  olía mal. Los 7.573 valores son `YYYY-MM-DD` y **siempre día 01**, porque la ITV
  vence por meses. Una cadena así se interpreta como UTC y se vuelve a formatear
  como UTC, así que da la vuelta entera sin moverse. España va por delante de UTC,
  así que ni siquiera al mostrarla se adelanta un día.
- **Cuatro `new Date(baseDate)`** en pantallas de citas y mantenimiento: `baseDate`
  ya es un objeto de fecha en los cuatro. Clonar.
- **Cero** casos de `getDate()` mezclado con `getUTCDate()`, que es el error que más
  me esperaba encontrar en un código con fechas por todas partes.

### Y una cuenta de la propia pasada

Dieciocho candidatas, **cuatro reales**. Es decir que **catorce de dieciocho eran
ruido de mi patrón o código correcto**, y las catorce costaron ir a mirar la columna
en la base, el formato de los valores o qué tipo tiene una variable.

Lo apunto porque es la lección de todas las pasadas de hoy: el barrido encuentra
candidatas, no hallazgos. Lo que convierte una candidata en un hallazgo es ir a
medirla, y lo que la descarta es exactamente el mismo trabajo.

---

## Zona 24 — Los estados de carga y de error, en los 170 ficheros ✅ sin hallazgos

Tercera pasada por clase de defecto, y la primera que sale **entera en verde**. Lo
cuento igual, porque «no hay nada» es un resultado y porque lo que costó llegar a
él es la lección.

El defecto que buscaba: una pantalla que se queda girando para siempre porque el
indicador de «cargando» se enciende y solo se apaga en el camino bueno; y su
hermano, un error que se guarda en un estado y no se pinta nunca.

| | |
|---|---:|
| Ficheros barridos | **170 de 170** |
| Indicadores de carga encontrados | **64** |
| Que se apagan también si algo falla | **64** |
| Estados de error, mensaje o aviso | **33** |
| Que se leen en algún sitio | **33** |

Sesenta y cuatro de sesenta y cuatro, y treinta y tres de treinta y tres. No hay
ninguna pantalla que pueda quedarse girando, y no hay ningún error que se guarde y
no se cuente.

### Lo que costó saberlo, que es el apunte de verdad

Mi barrido dijo primero **20 candidatas**, luego **5**, y al final **0**. Las veinte
y las cinco eran mi herramienta, no el código:

1. **Diecisiete se apagaban con `.then().catch().finally()` en cadena** y mi patrón
   solo buscaba `} catch` y `finally {`, la forma con llaves. `BuscarCochePage.js`
   salía como candidata siendo un ejemplo de cómo se hace bien: `.catch()` pone el
   error y `.finally()` apaga la rueda, las dos con su comprobación de petición
   obsoleta (`if (mio !== peticion.current) return`).
2. **Las cinco restantes tenían el `finally` fuera de mi ventana de 2.500
   caracteres.** Son funciones de guardado de 125, 132, 147, 205 y 251 líneas, y el
   `finally` está al final. Lo resolví buscando la función entera contando llaves en
   vez de mirar un trozo fijo.

Y una de ellas me lo decía a la cara. `UserDashboardVehicles.js`, tres líneas debajo
del encendido:

> *«Todo el guardado va en try/finally, y ésta es la corrección de verdad.»*

O sea que alguien ya había tenido este fallo, lo había arreglado y lo había dejado
escrito. Mi herramienta lo marcó como roto de todas formas.

### Lo que esta pasada no cubre

Que el indicador se apague y el error se guarde no significa que el mensaje sea
**útil**. No he mirado si lo que se enseña dice algo que se pueda hacer —«Error» a
secas cumple las dos comprobaciones de arriba y no sirve de nada—. Eso no se barre:
se lee.

Tampoco cubre los errores que nunca llegan a un estado porque se tragan antes. Eso
es lo que miré en §5.8 y §5.9 por el lado del servidor.

---

## Zona 25 — El `apps/web` del ERP, tres clases de defecto ✔ primera pasada

Las tres clases de §22, §23 y §24 aplicadas a las 37.561 líneas del back-office, con
las cinco correcciones que me costaron aquellas pasadas ya metidas en la herramienta.
**115 ficheros, los 115.**

| Clase | Candidatas | Reales |
|---|---:|---:|
| Dinero sin guardia | 8 | **2** |
| Fechas en UTC | 9 | **9** |
| Carga que no se apaga | 46 de 91 | **46, y por una sola causa** |
| Errores que nadie lee | 0 de 27 | 0 |

### 🟠 25.1 — Un corte de red deja 46 pantallas girando para siempre, y la causa es una

`apps/web/src/api/client.ts`:

```ts
const token = getToken();
const res = await fetch(`${BASE}${path}`, { … });        // ← sin try/catch
const body = await res.json().catch(() => ({ ok: false, error: 'invalid_json' }));
…
return conFormaUnica<T>(body);
```

El cliente está diseñado con la idea correcta —**los errores son valores, no
excepciones**—: devuelve `{ ok, data, error }` y quien llama hace
`if (res.ok) … else …`. Por eso las pantallas no llevan `try/catch`, y por eso
apagan el indicador de carga en la línea recta:

```ts
const res = await api.get<Agenda>(`/workshop-locations/${tallerId}/agenda?mes=${mes}`);
if (res.ok && res.data) setAgenda(res.data);
else { setAgenda(null); setFallo('No se ha podido leer la agenda de este taller.'); }
setCargando(false);
```

Eso es **mejor** que un `try/catch`, y el comentario que lleva encima explica incluso
el porqué de producto: *«un calendario en blanco se lee como "no hay nada cerrado",
que es justo lo contrario de "no lo sé"»*.

**Pero el `fetch` no está envuelto.** Y `fetch` rechaza —no devuelve— cuando no hay
red: sin conexión, DNS caído, servidor inalcanzable, CORS. En ese caso:

1. `api.get` lanza en vez de devolver.
2. El `await` de la pantalla lanza.
3. **`setCargando(false)` no llega a ejecutarse.**
4. Y `setFallo(...)` tampoco, así que no hay mensaje: solo la rueda, para siempre.

Un error HTTP —un 500, un 404— sí está cubierto: `res.json()` devuelve el cuerpo y
`conFormaUnica` lo convierte en `{ ok: false }`. Lo que se escapa es exactamente el
caso de **no llegar al servidor**, que en un back-office que se usa desde un taller
con wifi regular es el más probable de los dos.

**Lo bueno: se arregla en un sitio y cura las 46.**

```ts
let res: Response;
try {
  res = await fetch(`${BASE}${path}`, { … });
} catch {
  // Sin red no hay respuesta que interpretar, pero sí hay que contestar algo:
  // quien llama espera `{ ok }`, no una excepción.
  return { ok: false, data: undefined as T, error: 'sin_conexion' } as ApiResponse<T>;
}
```

Son seis líneas en `client.ts` y ninguna de las 46 pantallas se toca. Y un mensaje
que se pueda leer —«Sin conexión»— en vez de una rueda eterna.

### 🟡 25.2 — «Hoy» en UTC, nueve veces, y una de ellas es la fecha de un contrato

El mismo defecto de §23.1, aquí nueve veces y todas con la misma forma:

```ts
new Date().toISOString().slice(0, 10)
```

Entre las 00:00 y las 02:00 en España eso devuelve **el día anterior**. Dónde está:

| Fichero | Para qué |
|---|---|
| `LeadsPage.tsx:337` y `:543` | **la fecha de inicio de un contrato** |
| `BookingsPage.tsx:114` y `:116` | «hoy» y «hoy ± n días» de las reservas de taller |
| `BillingPage.tsx:167` | «hoy» en facturación |
| `ProveedoresPage.tsx:158` | «hoy» en proveedores |
| `FunnelPage.tsx:25`, `LeadsPage.tsx:267` | los rangos de los informes |
| `marketplace/formato.ts:17` | un `todayStr()` compartido |

La que más pesa es la del contrato: `contractStart` se inicializa a «hoy», así que un
contrato que se cree a las 00:30 del 1 de octubre **queda fechado el 30 de
septiembre**. Es un documento con una fecha que importa.

El resto desplaza un día un informe o una rejilla, lo cual se nota menos pero se
nota. Y `formato.ts:17` es el sitio natural para poner la versión buena una vez y que
las demás la usen.

### ⚪ 25.3 — Dos precios que se pintan como «0,00 €» cuando no hay precio

De las ocho candidatas de dinero, **seis son correctas**: son `reduce` sumando una
columna, y ahí un nulo que aporta 0 a un total es lo que se quiere.

Las dos que no: `ProviderBillingPage.tsx:647` y `:1136`,
`fmtEur(Number(g.precio) || 0)`. Es el mismo caso de §22.1 —una garantía sin precio
se enseña como 0,00 €— pero en el back-office, así que lo ve el personal y no un
cliente. Baja, y el arreglo es el mismo.

### ✅ 25.4 — Y los 27 estados de error del ERP se leen todos

Veintisiete declarados, cero que solo se escriban. Igual que en Mobility (33 de 33).
En los dos repositorios, cuando alguien se molesta en guardar un error, lo enseña.

---

## Zona 26 — Capa 5: arrancar la aplicación ✔ y el día que me cazó a mí

Arranqué la API local como la arranca el CI y pedí una referencia de mercado de
verdad. La primera llamada contestó esto:

```json
{"error":"hasPostgresConnection is not defined"}
```

**Lo había roto yo el día anterior**, arreglando §12.1. Esa función existe en
`billingStore.js` y no en `inventoryStore.js`, y los confundí. Un `ReferenceError` en
**cada** llamada a `readInventoryUniverse`: la referencia de mercado y la tasación,
caídas en producción varias horas, empujadas por mí.

### 🔴 26.1 — Y nada lo cazó: `lib/` y `api/` no se lintan

46.514 líneas que corren en producción y nunca pasaron por un lint. El
`eslintConfig` del `package.json` extiende `react-app`, que CRA aplica **solo a
`src/`**, y no había ningún guion `lint`.

La primera vez que les pasé `no-undef` salieron **cinco identificadores que no
existen**, y dos de ellos en caminos de error:

| Dónde | Qué falta | Qué pasaba |
|---|---|---|
| `lib/api/marketplace-og-handler.js` ×2 | `registra` sin importar | **El manejador de errores era el error**: los dos `catch` que existen para distinguir «la base no contesta» de «ese coche no existe» —lo dice su comentario— levantaban un `ReferenceError` |
| `lib/api/whatsapp-handler.js` | `remitente` sin importar | El `from:` del aviso interno. O sea que ese aviso **no se mandaba nunca** |
| `api/vehicle-catalog.js` ×2 | dos `ensureCatalogTables*` | Restos de SQL Server, detrás de `provider === "mssql"`: inalcanzables |

Los dos primeros son de manual: **fallos que solo se ejecutan cuando algo ya ha
fallado**, así que se esconden detrás de otro fallo y pueden estar meses ahí. Los dos
arreglados con una palabra cada uno.

Y con el conjunto completo de reglas —claves duplicadas, código inalcanzable,
reasignar una constante, comparar con NaN, `typeof` mal escrito— **no hay nada más en
46.514 líneas**. El problema no era la calidad: era que nadie miraba.

**Puesta la puerta**: `.eslintrc.servidor.json`, `npm run lint:servidor`, y un paso en
el CI **antes** de las pruebas. Y comprobé que caza: le metí un
`funcionQueNoExiste(1)` a `lib/freno.js` y el lint salió con código 1; restaurado,
con 0.

### Por qué ninguna de mis 1.701 pruebas lo vio

Esto es lo que más me importa dejar escrito, porque lo había hecho bien y no bastó.

Para §12.1 escribí una prueba que comprueba que la caída al fichero de agosto va
detrás de la comprobación de «no hay base de datos». Afirmaba así:

```js
assert.match(antes, /if \(!hasPostgresConnection\(\)\)/, …);
```

Y **pasaba**. Encontraba el texto, porque el texto estaba escrito. Lo que no puede
saber una prueba que lee el fuente es si ese nombre **se refiere a algo**.

En §16 rompí el código a propósito seis veces para demostrar que las pruebas de forma
cazan lo que dicen cazar, y lo demostré. Lo que §16 no podía demostrar es lo que las
pruebas de forma **no pueden ver nunca**: un identificador que no existe, una
dependencia que no está instalada, un `await` que falta. Para eso hace falta ejecutar,
o un lint.

La prueba ahora comprueba las dos cosas: la forma, y que todo lo que llama esa función
esté declarado en el fichero.

### ✅ 26.2 — Y lo que sí funciona, ejecutado

Con el arreglo puesto, y contra la base de producción:

```
Peugeot 3008 diésel 2019, 90.000 km
  source: postgres · comparables: 388 · mediana: 14.900 € · p25/p75: 13.197 / 16.618

una marca inventada
  source: unresolved-brand · comparables: 0 · mediana: null · universo: 0
```

La segunda es la verificación de §12.1 de punta a punta: **cero comparables llegan
como cero**, sin fichero de agosto y sin precio inventado. Y hay un guardia incluso
antes del que puse yo —`unresolved-brand`— que corta cuando la marca no se resuelve.

### Lo que esta capa deja claro

Las cuatro capas anteriores barrieron 255.185 líneas y encontraron cosas reales. La
quinta encontró, en su **primera llamada**, un fallo que tumbaba la función central
del producto y que ninguna de las otras cuatro podía ver.

No porque las otras estén mal: porque un barrido lee y un lint comprueba nombres, pero
solo ejecutar demuestra que la cosa funciona.

---

## Zona 27 — El ERP, ejecutado: una suite en rojo que nadie ve ✔ revisada

Después de §26 le hice al ERP lo mismo: comprobar que lo que debería protegerlo está
funcionando. Y la respuesta es que sí existe y nadie lo mira.

### ✅ 27.1 — Su protección por tipos es buena, y mejor que un lint

El ERP es TypeScript y lo tiene bien puesto:

- `tsconfig.base.json` con **`strict: true`**, heredado por la API y por la web.
- `apps/api` con **`noEmitOnError: true`**: si hay un error de tipos, no se construye.
- Y compila limpio: lancé `tsc --noEmit` sobre los dos y **salen con código 0**.

O sea que el fallo de §26 —un identificador que no existe— aquí es **imposible por
diseño**: TypeScript no compila. Eso es mejor que el lint que acabo de poner en
Mobility, porque no hay que acordarse de activar una regla.

### 🟠 27.2 — Pero la suite está en rojo, y el ERP no tiene CI

Lancé `npm test` por primera vez:

```
ℹ tests 2783
ℹ pass 2782
ℹ fail 1
```

**2.783 pruebas, una roja.** Y no hay `.github/workflows` en el repositorio: ni un
CI, ni una comprobación automática. Así que su `tsc`, sus 2.783 pruebas y sus 20
guiones `comprueba-*` **solo corren cuando alguien se acuerda**, y la roja lleva ahí
sin que nadie lo sepa.

Es la sexta vez hoy que aparece la misma forma: §11.1 (el CI de Mobility no corría
2.624 pruebas), §16.3 (una tarea podía desaparecer sin que nada gritara), §17.4 (nada
comprueba las cabeceras), §15.2 (nadie lee los latidos), §13.1 (nadie reexporta los
flujos). **La ausencia no hace ruido.**

### 🟠 27.3 — Y la que está roja es justo el guardia de §19.1

La prueba se llama `las-tablas-del-taller-son-gemelas.test.ts`, y su cabecera explica
exactamente el riesgo que apunté en §19.1 sin conocerla:

> *«Las reservas las escribe PopCar y los cierres el ERP, sobre las mismas dos tablas
> de la misma base. Cada repositorio las crea con su `CREATE TABLE IF NOT EXISTS`: la
> que arranca primero crea, y la otra no hace nada. […] Un `IF NOT EXISTS` no avisa de
> que la tabla que ya estaba no es la que él iba a crear.»*

Compara las dos declaraciones leyendo `../Mobility-Advisor/lib/huecos-del-taller.js`.
**Y ese fichero ya no declara nada.** Lo dice su propio comentario, aquí:

> *«Aquí vivía `ASEGURA`, el `CREATE TABLE IF NOT EXISTS` de las dos tablas del taller
> —`moveadvisor_workshop_reservations` y `moveadvisor_workshop_blocks`—, que se
> ejecutaba en cada reserva y en cada bloqueo.»*

Se movió a `migrations/0013-lo-que-solo-existia-si-alguien-pasaba-por-ahi.sql`, que es
**lo correcto** y es lo que exige `el-esquema-tiene-un-dueno.test.js`.

Así que: **el guardia se rompió porque el otro repositorio mejoró**. Compara 8
columnas del ERP contra una lista vacía, falla, y con él se perdió en silencio la
única comprobación que vigilaba que las dos declaraciones digan lo mismo.

**Lo comprobé a mano, que es lo que el guardia debería hacer**, contra la migración
0013 en vez de contra el fichero viejo:

| Tabla | ERP | `migrations/` | Diferencias |
|---|---:|---:|---|
| `moveadvisor_workshop_reservations` | 8 columnas | 8 | **ninguna** |
| `moveadvisor_workshop_blocks` | 7 columnas | 7 | **ninguna** |

En la segunda salió una «diferencia» —`hora text, -- nulo = el día entero`— y era mi
limpiador de comentarios, que no quita los que van después de una coma en la misma
línea. Sexta vez hoy que mi herramienta da un falso positivo.

O sea que **están de acuerdo hoy**, igual que las columnas de §19.2. El problema es
que ya nada lo comprueba.

**El arreglo es un camino**: que la prueba lea `../Mobility-Advisor/migrations/` en vez
de `lib/huecos-del-taller.js`. Con eso el guardia vuelve a funcionar y vuelve a
proteger de lo que §19.1 describe. No lo he hecho yo porque es un cambio en el otro
repositorio y nunca he commiteado ahí.

### Lo que esto añade al plan

| | Qué | Dónde |
|---|---|---|
| A14 | Apuntar la prueba de las tablas gemelas a `migrations/` del otro repositorio | §27.3 |
| C6 | **Un CI para el ERP**: `tsc`, `npm test` y los `comprueba-*`. El de Mobility sirve de plantilla | §27.2 |

---

## Zona 28 — Capa 5: los tres arreglos de auth, ejecutados ✔

Verifiqué con pruebas los tres cambios de §10 y nunca los había ejecutado. Después de
lo de §26 —romper la tasación y enterarme un día después— no me parecía razonable
dejarlo así. Arranqué la API con `AUTH_PROVIDER=local`, que escribe en un JSON y no en
la base, con copia de seguridad de los dos ficheros antes y restaurados después.

### ✅ 28.1 — Cambiar la contraseña echa a los demás, y no a ti

El recorrido, con dos tarros de cookies distintos para simular dos dispositivos:

```
1) alta                                 ok  · sesión creada
2) login desde un segundo dispositivo    ok
3) ¿las dos vivas?        dispositivo 1: DENTRO   dispositivo 2: DENTRO
4) cambio la contraseña desde el 1       ok
5) ¿y ahora?              dispositivo 1: DENTRO   dispositivo 2: FUERA
```

Es exactamente lo que tenía que pasar, y lo que importa es el paso 5 completo: el
dispositivo 2 queda fuera **y el 1 sigue dentro**. Esa segunda mitad es la que depende
del orden —el borrado antes de crear la sesión nueva— y es la que habría convertido el
arreglo en un bloqueo de la propia cuenta si lo hubiera puesto al revés. La prueba
comprobaba el orden leyendo el fuente; esto lo comprueba ejecutándolo.

### ✅ 28.2 — Y el reloj ya no dice qué correos existen, aunque no del todo

Nueve intentos de cada caso, medianas, contra el servidor de verdad:

| | Mediana | |
|---|---:|---|
| Cuenta que **existe**, contraseña mala | **130,7 ms** | HTTP 401 |
| Cuenta que **no existe** | **119,1 ms** | HTTP 401 |
| | **11,6 ms de diferencia** | |

Antes del arreglo la diferencia era el coste entero de `scrypt`: **46 ms medidos**. Eso
ha desaparecido, que era el 80 % de la señal.

**Pero no digo que esté cerrado.** Quedan 11,6 ms, y no son ruido: son la búsqueda del
usuario, que para una cuenta que existe devuelve una fila y para una que no, nada. Con
suficientes muestras eso sigue siendo medible. Cerrarlo del todo significaría igualar
también la búsqueda, y eso ya es más caro que el problema — pero el problema no está
en cero, está en un quinto de lo que estaba.

### ✅ 28.3 — Y el calendario del taller está bien hecho, con la forma correcta a la vista

Fui a ejecutar la reserva de taller esperando ver ahí el desfase de §23 —solo el lado
de leer, que no escribe nada en producción— y el servidor lo hace bien:

```
GET /api/workshop-availability?workshopId=…&monthKey=2026-10
  31 días · del 2026-10-01 al 2026-10-31 · ninguno fuera de octubre
  cerrados: 2026-10-04, 11, 18, 25
```

Los cuatro cerrados son **los domingos exactos** de octubre de 2026, **incluido el
25**, que es el día en que España cambia de hora. Y ningún día se escapa a septiembre
o a noviembre, que es justo lo que haría el error de UTC en los bordes del mes.

El motivo está en tres líneas:

```js
function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
```

**Componentes locales, sin pasar por UTC.** Eso es inmune a la zona horaria y al
cambio de hora, y es exactamente lo que les falta a las tres pantallas de §23.1.

Lo cual mejora ese hallazgo en vez de añadir uno nuevo: **la forma correcta ya está
escrita en este repositorio**, en `lib/api/workshop-availability-handler.js`. El
arreglo de §23.1 no es inventar nada, es usar eso — y el sitio natural para dejarlo
una vez es `src/utils/`, donde lo vean las tres.


### Lo que no se puede comprobar así, y lo digo en vez de fingirlo

El tercer arreglo de §10 —el freno del alta— **no se ejecuta en este recorrido**, y no
por casualidad:

```js
const frenoAlta = usePostgres ? getPgPool() : null;
```

Con `AUTH_PROVIDER=local` no hay pool, y `FRENO.pide` devuelve `{ paso: true }` cuando
no se lo dan. Así que en local **no hay freno ninguno**, por diseño: el freno cuenta en
la base para que valga entre instancias de Vercel.

Lo correcto sería probarlo contra una base de pruebas. No la hay, y montarla pasa por
decidir si el ERP y la web comparten base (§B9), así que queda apuntado y no probado.
Lo que sí está probado es que el límite existe en `LIMITES` y que la llamada está antes
del 409, por las pruebas de §10.

---

## Lo que queda, y de qué tamaño

Contado, no de memoria. Este repositorio tiene **170.166 líneas** de código sin
contar pruebas, y las dieciocho zonas de arriba no son «todo leído»: son todo lo
que puede hacer daño, leído, más el resto medido con comprobaciones dirigidas.

### De este repositorio

| Lo que queda | Tamaño | Por qué no lo he hecho |
|---|---:|---|
| Los scrapers de `scripts/` uno a uno | ~55.000 líneas | §13 cubre lo que de ellos **se ejecuta**: los 52 flujos activos, comparados contra la instancia de n8n. Leer los 212 ficheros daría hallazgos de estilo |
| `src/` línea a línea | 64.612 líneas | §6 midió lo estructural —395 `useState`, 2.725 estilos en línea, `readGarageVehicles` en 7 pantallas con 6 versiones— y §12/§18 fueron a los sitios concretos donde algo podía romperse |

Y una cosa que **no es leer código** y es lo que de verdad falta: dejar
`pg_stat_statements` unos días y volver a `npm run consultas-lentas`. Las
decisiones de rendimiento que quedan —qué índices tirar de los 523 MB, si subir
`work_mem`, si pagar más memoria de Neon— se toman con medias de miles de llamadas
reales. Las mías a mano ya fallaron tres veces (§9).

### Cuánto se ha revisado, en porcentaje y por capas

Un solo porcentaje engañaría: leer mil líneas de autenticación no es lo mismo que
leer mil de estilos. Van cuatro capas, de la más engañosa a la más útil, y solo la
primera es una estimación.

Denominadores con el mismo filtro en los dos: código `.js .jsx .mjs .ts .tsx .sql`,
sin ficheros de prueba.

| | Mobility-Advisor | ERP |
|---|---:|---:|
| Código | **174.953 líneas** | **80.232 líneas** |

#### Capa 1 — leído de verdad: 13 % y 2 %

Ficheros abiertos y leídos, no barridos. En Mobility: `api/auth.js` entero,
`src/App.js` durante el refactor, los trozos concretos de `billingStore`,
`inventoryStore`, `sellReportGenerator`, `BuscarCochePage`, `PortalVoDetailPage`,
`enrutador`, `freno`, `registra`, `postgres`, seis migraciones, el workflow del CI y
las pruebas que escribí o audité. En el ERP: `middleware/auth.ts`, `app.ts`,
`db/pool.ts`, `api/client.ts`, `invoice-pdf.ts`, `invoice-download.ts`,
`comision-de-financiacion.ts`, `AgendaDelTaller.tsx` y trozos de `schema.ts`.

| | Mobility | ERP |
|---|---:|---:|
| Leído | ~23.500 líneas | ~1.500 líneas |
| **Porcentaje** | **≈ 13 %** | **≈ 2 %** |

Es la cifra que suena a poco y la que menos dice.

#### Capa 2 — barrido con comprobaciones: 100 % y 100 %

Exacto, porque los guiones recorrieron todos los ficheros de los dos repositorios.

#### Capa 3 — las superficies completas: 100 %

| Superficie | Cobertura |
|---|---|
| Entradas HTTP de Mobility | **49 de 49** reescrituras, 6 funciones |
| Entradas HTTP del ERP | **264 de 264** rutas, guardia a guardia |
| Tareas programadas | **8 de 8** de Vercel, **61 de 61** de n8n |
| Flujos de n8n | **61 de 61** contra la instancia que corre |
| Esquema de la base | **110 tablas, 1.391 columnas** contra las migraciones |
| Guiones que borran | **todos** |
| Ficheros de prueba | **217 de 217**, más seis mutaciones reales |
| Cabeceras de seguridad | los **3** dominios contra producción |

#### Capa 4 — clases de defecto, que es donde se mide el avance ahora

Esta es la que importa desde §22. Cada clase se pasa por **todos** los ficheros, y
cerrarla significa «este defecto no está en ninguno», que es más fuerte que «he
mirado este fichero».

| Clase de defecto | Mobility | ERP |
|---|---|---|
| Credenciales en el código | ✅ | ✅ |
| Esquema creado en caliente | ✅ | ✅ §19.1 |
| Pool compartido mal usado | ✅ §2 | ✅ |
| Borrados sin guardia | ✅ §7, §13.2 | ✅ |
| SQL concatenado | ✅ | ✅ |
| Rutas sin autorización | ✅ §10 | ✅ §19.7 |
| Entradas sin freno de ritmo | ✅ §10.2 | — |
| `catch` que tragan escrituras | ✅ §5.8 | ✅ |
| Dinero mal formateado | ✅ §22 | ✅ §25.3 |
| Fechas y zonas horarias | ✅ §23 | ✅ §25.2 |
| Carga y error sin enseñar | ✅ §24 | ✅ §25.1 |
| Pruebas que no pueden fallar | ✅ §16 | ✗ |
| Cabeceras de seguridad | ✅ §17 | ✅ §17 |
| Numeración y aritmética de facturas | — | ✅ §20, §21 |
| Efectos sin limpieza | ✗ | ✗ |
| Dependencias que mienten | ✗ | ✗ |
| Accesibilidad | ✗ | ✗ |
| Fugas de datos en las respuestas | parcial §3.2 | ✗ |
| Validación y límites de tamaño | parcial §4 | ✗ |

**Mobility: 13 clases cerradas, 2 parciales, 4 sin pasar — ≈ 70 %.**
**ERP: 11 cerradas, 0 parciales, 5 sin pasar — ≈ 65 %.**

### Y por qué la capa 1 no va a llegar al 100 %

Leer las 232.000 líneas que quedan son unas diez sesiones como esta, y **las tres
últimas pasadas dicen que no es ahí donde está el rendimiento**: §24 salió entera en
cero, §22 dio un hallazgo y §23 cuatro. Mientras que §25 —una clase nueva sobre un
repositorio sin tocar— dio el mejor hallazgo del día: 46 pantallas que se quedan
girando por una línea.

O sea que lo que avanza no es leer más código, es **pasarle una clase nueva a todo el
código**. Por eso la capa 4 es la que llevo contando desde §22.

Lo que daría hallazgos que ningún barrido ve es cambiar de método otra vez:
**arrancar la aplicación y recorrer los caminos de verdad** —el alta, la tasación,
reservar un taller, el pago—. Eso es la capa 5, y está sin empezar.

## Y las tareas que no son leer código

- **Dejar `pg_stat_statements` unos días y volver a `npm run consultas-lentas`.**
  Es lo primero de esta lista. Qué índices tirar de los 523 MB, si subir
  `work_mem`, si pagar más memoria de Neon: eso se decide con medias de miles de
  llamadas reales, y mis medidas a mano fallaron tres veces (§9).
- **Un `npm run` que exporte los 61 flujos de n8n por su API.** Hacerlo a mano no
  va a pasar, y §13.1 es la prueba: el avisador de fallos lleva meses mejor en n8n
  que en el repositorio.
- **Averiguar quién escribe a las 07h.** En §9.4 lo achaqué a los scrapers
  pisándose y §13.5 demuestra que no es eso: están escalonados a mano. Lo dirá
  `pg_stat_statements`, no otra suposición mía.
- **Un cron semanal que compruebe las cabeceras** (§17.4), y el `report-uri` de la
  CSP apuntando a `/api/error`, que ya existe (§17.3).

## Y las decisiones que son tuyas, no trabajo

1. `AUTH_EXPOSE_RESET_CODE` verificada como falsa o ausente en Vercel. En
   `.env.local` está en `true`, y con ese valor la API devuelve el código de
   recuperación.
2. Las **siete lecturas** que devuelven lista vacía cuando la base falla (§5.8).
   Cambiarlo es un aviso de error en vez de una lista vacía: se nota.
3. Los **87 `leasys-%`** vivos en el marketplace, sin código que nombre ese
   proveedor.
4. Si el ERP debe tener **su propia base de datos**. Un commit de julio dice que
   sí y `ERP_DATABASE_URL` no existe.
5. El **consentimiento del alta** (`useLosConsentimientosDelRegistro.js` lo
   documenta).

Y tres que salieron después: mover los dos crones de facetas de cada hora a una
vez al día (§9.4), qué hacer con los 126 MB de `moveadvisor_market_dealers` que
nada lee (§12.5), y si entrar en la lista de precarga de HSTS (§17.5), que es de
una sola dirección.

## Nota de método

Tres cosas que hacer diferente la próxima vez, sacadas de equivocarme en esta:

**Una diferencia contada no es una diferencia vista.** Comparando n8n contra el
repositorio saqué 52 y luego 54 divergencias, y las dos veces eran artefactos de
mi comparación. Lo vi al mirar **un caso concreto** (§13.6).

**Una prueba escrita después del arreglo hay que lanzarla contra el antes.** Si no
falla contra el código viejo, no vigila nada. Lo hice con `git show HEAD` y las
nueve de §5.8/§10.1 fallaron; las de rutas que generé desde la tabla que probaban,
no habrían fallado nunca.

**Leer el resto del fichero antes de decir que algo falta.** Diez veces en esta
revisión iba a apuntar un hallazgo y estaba resuelto y explicado unas líneas más
arriba, o en el `docs/` de al lado.
