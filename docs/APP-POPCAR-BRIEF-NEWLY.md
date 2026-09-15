# App PopCar — brief para newly.app

Documento para pegar en newly.app y para que cualquiera que la construya sepa qué se está pidiendo. Lo que hay aquí no es una idea: es el producto que ya funciona en `www.popcar.com.es`, recortado a dos cosas —**el IDCar** y **la venta**— y llevado a un móvil.

Las tablas, los endpoints y las reglas que se citan existen hoy en el repositorio `Mobility-Advisor`. Están puestos con su nombre real a propósito: un brief que inventa nombres obliga a rehacer el trabajo cuando se conecta.

---

## 0. Qué es la app, en una frase

**El panel de PopCar en el bolsillo: subes tu coche, lo tienes documentado, lo tasas, sabes cuánto vale en el mercado, ves tus citas y tus avisos — y desde ahí lo vendes, lo publicas o lo llevas al taller.**

### Qué NO lleva

Esto es la mitad del recorte, y es tan importante como lo que sí lleva. La app **no** incluye:

- El buscador de coches de compra, el comparador ni las ofertas guardadas.
- Las alertas de mercado de coches que quieres comprar.
- La importación desde Alemania.
- El renting, los seguros como producto de venta, los planes de suscripción.
- El marketplace como escaparate para navegar. Sí aparece como **destino** donde publicas tu coche, no como catálogo que exploras.

Quien quiera comprar, entra por la web. La app es de **quien ya tiene coche**.

---

## 1. La regla de oro: una cuenta, una base

> El mismo usuario y la misma contraseña que en `www.popcar.com.es`. Si subo un documento desde el móvil, está en la web al recargar. Si pido una cita desde la web, la app la enseña. No hay "cuenta de la app".

Esto no es un deseo, es una restricción de arquitectura y condiciona todo lo demás:

**La app no tiene base de datos propia, ni tabla de usuarios, ni registro independiente, ni almacenamiento local como fuente de verdad.** Es un cliente de la API que ya existe.

```
  App móvil (newly.app)  ─┐
                          ├─→  https://www.popcar.com.es/api/*  ─→  PostgreSQL (Neon)
  Web popcar.com.es      ─┘                                          tablas moveadvisor_*
```

- **Base**: PostgreSQL. La conexión llega por `POSTGRES_URL` (o `DATABASE_URL`, que se mapea al arrancar). Las mismas tablas `moveadvisor_*` para web y app.
- **Sesión**: `POST /api/auth` con `action: "login"`. Devuelve una cookie de sesión `moveadvisor_session`, HttpOnly, con TTL por defecto de 720 horas (30 días), configurable con `AUTH_SESSION_TTL_HOURS`.
- **Toda llamada** a la API va con la sesión adjunta. En la web es `credentials: "include"`; en la app tiene que ser el equivalente nativo.
- El servidor resuelve el usuario **del lado del servidor** con `getSessionUserFromRequest(req)` y filtra por `lower(user_email)`. Mandar el email desde el cliente no sirve para saltarse nada, y tampoco hace falta.

### Cómo se autentica la app — ya está montado

La web se identifica con una cookie `HttpOnly`, que es lo correcto en un navegador pero inservible en una app: un cliente HTTP nativo no persiste cookies entre arranques y el usuario se desloguearía al cerrar. Así que **la API acepta las dos vías**:

**1· Pedir el token al entrar.** En el login (o el registro), la app manda la cabecera `X-PopCar-Client: app`:

```
POST /api/auth
X-PopCar-Client: app
{ "action": "login", "email": "...", "password": "..." }

→ { "ok": true, "user": {...},
    "session": { "sessionId": "...", "expiresAt": "...", "token": "<sessionId>.<token>" } }
```

Sin esa cabecera —o sea, desde la web— la respuesta **no lleva token** y es byte a byte la de siempre. Es deliberado: devolvérselo al navegador sería regalarle a cualquier script de la página justo lo que la cookie le esconde.

**2· Usar el token en todo lo demás.** `Authorization: Bearer <sessionId>.<token>` en cada petición. No es un segundo mecanismo de autenticación: es el mismo registro de `moveadvisor_sessions`, leído por otra vía. La cookie sigue teniendo preferencia cuando la hay, así que el navegador se comporta exactamente igual que antes.

**Guardar el token en el llavero del sistema** (Keychain / Keystore), nunca en almacenamiento normal. Caduca a los 30 días; cuando `GET /api/auth` responda `authenticated: false`, volver a pedir credenciales.

**CORS**: hay que declarar los orígenes de la app en la variable de entorno `CORS_ORIGENES`, separados por comas — para Capacitor, `capacitor://localhost,https://localhost`. Sin esa variable la API no añade ninguna cabecera de CORS y las llamadas desde fuera del dominio fallan.

**Escribir esto tal cual en el prompt de newly.app**: *"la autenticación es contra una API externa existente; no generes tabla de usuarios ni login propio"*. Si no se dice, el generador monta su propio auth y se pierde la mitad del sentido de la app.

### Mientras tanto, lo local es caché, no verdad

La web guarda una copia del garaje en `localStorage` (`movilidad-advisor.userGarage.v1.<email>`) para pintar rápido, pero **relee de la API al abrir** y la API manda. La app debe hacer lo mismo: caché local para que la lista aparezca al instante y para leer sin cobertura, y refresco contra el servidor en cada apertura de pantalla.

---

## 2. Identidad visual

Los valores son los reales del producto (`src/styles/tokens.css`). No improvisar colores.

### Paleta

| Token | Valor | Uso |
|---|---|---|
| `--gris-900` Pop Black | `#111111` | Texto principal, **fondo de botones** |
| `--gris-800` | `#1F1F1D` | |
| `--gris-700` | `#333330` | Valores de ficha |
| `--gris-600` | `#4A4A45` | |
| `--gris-500` | `#5E5E59` | Texto secundario |
| `--gris-400` | `#96968F` | Texto de apoyo, etiquetas |
| `--gris-300` | `#CFCFC8` | Bordes |
| `--gris-200` | `#E4E4DF` | Separadores |
| `--gris-100` | `#F2F2ED` | Fondos de bloque |
| `--gris-50` | `#FAFAF8` | Relleno suave |
| `--acento` Pop Yellow | `#FFC400` | Acento, fondos, badges |
| `--acento-oscuro` | `#E6B000` | |
| `--acento-tenue` | `#FFF6D9` | Fondo de aviso |
| `--acento-texto` | `#6B5200` | **El amarillo cuando es texto** |
| `--blanco` | `#FFFFFF` | |

**La regla del amarillo, que es donde todo el mundo se equivoca:** la marca es **el negro**, no el amarillo. Los botones primarios son negros con texto blanco. El amarillo es relleno, o texto sobre negro; nunca texto pequeño sobre blanco, porque da 1,7:1 de contraste y no se lee. Para texto amarillo sobre fondo claro existe `--acento-texto` (`#6B5200`, 7,4:1).

### Tipografía

- Interfaz y **todas las cifras**: **Nunito Sans**. Sus dígitos alinean solos en columna.
- Titulares grandes, y solo esos: **Bricolage Grotesque**. Nunca en números, precios, kilómetros ni tablas: sus dígitos varían casi un tercio de eme de ancho y descuadran cualquier columna.

### Semáforos de estado (consistentes en toda la app)

| Estado | Color | Dónde |
|---|---|---|
| Hecho / publicado / disponible | `#047857` sobre `rgba(16,185,129,0.08)` | Puerta abierta, chip Marketplace |
| Pendiente / en curso | `#b45309` sobre `rgba(245,158,11,0.08)` | Puerta cerrada, cita por confirmar |
| Informe de estado | `#0f766e` sobre `rgba(20,184,166,0.10)` | Botones de PopCar Check |
| Destructivo | `#dc2626` sobre `rgba(239,68,68,0.07)` | Quitar, despublicar |

### Etiqueta medioambiental (badge en cada coche)

`0` → verde `#22c55e` · `ECO` → `--gris-700` · `C` → `#f59e0b` · `B` → `#ef4444`

---

## 3. Mapa de la app

Cinco pestañas abajo. Nada más.

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Inicio  │   Mis    │  Vender  │  Taller  │  Perfil  │
│    ⌂     │ coches 🚗│    💶    │    🔧    │    ⚙     │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

Y una **campana** arriba a la derecha, presente en todas.

---

## 4. Pantalla por pantalla

### 4.1 Entrada — login y registro

Sin pantallas de bienvenida largas. Logo, dos campos, entrar.

- **Campos**: correo, contraseña.
- **Acciones**: `POST /api/auth` con `{ action: "login", email, password }` y `{ action: "register", ... }`. Contraseña olvidada: `{ action: "request_password_reset" }` → llega un correo con un código → `{ action: "reset_password" }`.
- **Al abrir la app**, antes de enseñar nada: `GET /api/auth` para la sesión. Si hay sesión viva, directo a Inicio. Si no, login.
- **Biometría**: tras el primer login correcto, ofrecer Face ID / huella para las siguientes aperturas. Guarda el token en el llavero, nunca la contraseña.
- **Registro** pide consentimientos; existe `action: "save_consents"`.
- **Texto que tiene que estar**: *"La misma cuenta que en popcar.com.es."* Es literalmente la pregunta que va a hacerse todo el mundo.

### 4.2 Inicio — el resumen

Lo que se ve al abrir, en este orden:

1. **Saludo y coche principal.** Foto del primer IDCar a ancho completo, con el nombre encima sobre degradado oscuro y la etiqueta medioambiental en una esquina. Si hay varios, carrusel horizontal.
2. **Lo que te falta**, si hay un encargo de venta en marcha. Es el bloque de las cinco puertas (§4.9). Va arriba del todo porque es lo que desbloquea la venta.
3. **Tu próxima cita.** Fecha, hora, taller, servicio. Botón para añadirla al calendario del móvil.
4. **Valor estimado**, si hay tasación. Cifra grande y la variación con flecha (`↑`/`↓ %`) respecto a la anterior.
5. **Avisos del coche**: próxima ITV, seguro que vence, mantenimiento que toca.
6. **Cuatro accesos rápidos** en cuadrícula: Subir coche · Tasar · Informe de mercado · Pedir cita.

Estado vacío (sin ningún coche): una sola tarjeta grande, *"Sube tu coche y tenlo todo en un sitio"*, con el botón de alta. Nada más — la cuadrícula de accesos vacía es ruido.

### 4.3 Mis coches — la lista

Una tarjeta por IDCar. Es la pantalla más usada de la app.

**Cada tarjeta lleva:**
- Foto principal, degradado y nombre del coche encima.
- Rejilla de especificaciones: marca, modelo, año, km, combustible, cambio, CV, matrícula, color, seguro, próxima ITV, carrocería. En móvil, dos columnas, y se enseñan las 9 primeras que tengan valor.
- **Chips de documentación**: `📄 n` documentos · `🛡️ n` seguro · `🔧 n` mantenimiento · `🟢 Marketplace` si está publicado.
- **Código QR** del coche. En la web apunta a `/idcar/<id>`. En la app: enseñarlo a pantalla completa al tocarlo, con el brillo al máximo, para escanearlo en un taller o enseñárselo a un comprador.
- Cuatro botones: **Ver ficha** · **Editar** · **Gestionar** · **Quitar**.

**"Gestionar"** despliega dentro de la tarjeta la rejilla de acciones, que es el corazón de la app:

| Acción | Qué hace |
|---|---|
| Hacer el informe de estado | Abre la captura guiada de PopCar Check (§4.7) |
| Descargar el informe | PDF, cuando está listo |
| Ver en 3D / AR | Modelo del coche, cuando existe |
| Pedir cita | Va al flujo de taller (§4.10) con el coche ya elegido |
| Solicitar tasación | Va a la tasación (§4.8) con el coche ya elegido |
| Gestionar seguro | Abre la ficha en la sección de seguros |
| Publicar en Marketplace VO | O **Despublicar**, si ya está publicado |

El botón del informe cambia de texto según el estado real: *Hacer el informe de estado* → *Continuar el informe de estado* (si quedó a medias) → *Repetir el informe de estado* (si está hecho). Repetirlo es legítimo, el coche cambia.

**Datos**: `GET /api/billing-account?email=&scope=garage`. Tabla `moveadvisor_user_vehicles`.

### 4.4 Alta de IDCar — el asistente

En la web es un formulario largo con secciones plegables. **En el móvil tiene que ser un asistente por pasos**, porque un formulario de 25 campos en una pantalla de seis pulgadas no lo termina nadie.

**Paso 1 — La matrícula.** Un solo campo, grande, en mayúsculas, con formato `0000 XXX`. Es el gancho: *"Empieza por la matrícula, el resto lo rellenamos nosotros."*

**Paso 2 — Marca, modelo y versión.** Desplegables encadenados contra el catálogo real del ERP:
- `GET /api/erp-catalog?scope=brands`
- `GET /api/erp-catalog?scope=models&brandId=`
- `GET /api/erp-catalog?scope=versions&modelId=&brandId=`
- `GET /api/erp-catalog?scope=version-detail&codversion=` → **rellena solo** combustible, cambio, CV, carrocería, plazas, puertas y CO₂.

Con salida manual: si su coche no está en el catálogo, que pueda escribirlo.

**Paso 3 — Estado del coche.** Año, kilómetros, color, provincia, etiqueta medioambiental, última y próxima ITV.

**Paso 4 — Fotos.** Cámara o galería, múltiple. **Mínimo 6** — el número no es decorativo, es el que exige el encargo de venta. Se pueden reordenar arrastrando y marcar cuál es la principal. Límite de 12 MB por fichero.

**Paso 5 — Documentos.** Cuatro cajas separadas, no un montón: permiso de circulación · ficha técnica · ITV · otros. Cámara con recorte automático de documento, o PDF del carrete.

**Paso 6 — Seguro y mantenimiento** (saltable). Compañía, número de póliza, tipo de cobertura; tipo y notas del último mantenimiento, con sus facturas.

Guardado: `POST /api/billing-account` con `{ action: "garage_add", email, vehicle }`. Que se pueda guardar a medias y seguir después — la mitad de las altas se hacen en dos ratos.

**Campos exactos del formulario** (nombres reales, respetarlos): `nickname, brand, model, version, transmissionType, bodyType, cv, horsepower, color, seats, doors, location, environmentalLabel, lastIvt, nextIvt, co2, year, plate, mileage, fuel, price, policyCompany, policyNumber, coverageType, maintenanceType, maintenanceTitle, maintenanceNotes, notes`

### 4.5 Ficha del IDCar — el detalle

Cabecera tipo portada: foto grande, degradado, nombre del coche, chips con año · km · combustible · matrícula · color · cambio, y la etiqueta medioambiental arriba a la derecha. Debajo, **Editar ficha** y **Quitar**.

Después, la rejilla completa de especificaciones y las secciones plegables:

1. **Características del vehículo** — datos base y ficha técnica.
2. **Precio de venta en el Marketplace VO** — el valor manual.
3. **Documentos del vehículo** — las cuatro cajas.
4. **Informe de estado** — PopCar Check (§4.7).
5. **Seguros** — póliza y sus documentos.
6. **Mantenimientos** — facturas y avisos.
7. **Notas internas.**

Cada sección lleva en el subtítulo su propio recuento: *"3 guardados · 1 preparado"*. Es lo que hace ver de un vistazo qué está completo.

### 4.6 Documentos — la caja fuerte

Lo que más se va a usar en la calle: **abrir la ficha técnica en un aparcamiento o enseñar la ITV en una revisión.**

- Cada documento con su miniatura, nombre, tamaño y fecha.
- Tres acciones: **abrir** (visor dentro de la app), **descargar**, **eliminar**.
- **Disponibles sin cobertura.** Este es el requisito diferencial de la app frente a la web: los documentos del coche se descargan y se guardan cifrados en el dispositivo, y se abren aunque no haya red.
- Compartir por el menú nativo del sistema.

Los ficheros viven en `moveadvisor_user_vehicle_files` y en almacenamiento de objetos; hay subida firmada (`POST /api/user?route=storage-presign`) para no mandar base64 grande. **Usar la subida firmada desde el móvil**, no el base64 en el cuerpo.

### 4.7 Informe de estado — PopCar Check

Es el servicio hermano, en `check.popcar.com.es`. La app **no guarda informes**: el expediente vive allí, donde el esquema impide afirmar mecánica sin verificación física y ata cada daño a una pieza de una lista cerrada. Aquí solo se recuerda que ese coche tiene un expediente y por dónde va.

- Se abre con `POST /api/market?route=condition-report` para el vehículo, y se navega a la URL de captura que devuelve.
- **La captura es guiada por cámara: en el móvil esto es nativo, y es donde la app gana de verdad a la web.** Contorno en pantalla por ángulo, aviso si la foto sale movida, progreso por pasos.
- Estados que hay que pintar:
  - `iniciada` · `capturando` · `subida_completa` · `procesando` → **abiertos**, se puede continuar.
  - `informe_listo` · `verificada` · `publicada` → **listo**: se puede descargar el PDF y ver el modelo 3D.
  - `caducada` → hay que rehacerlo.
- Descarga del PDF: el mismo endpoint con `&descargar=<session_id>`. Modelo 3D: `/api/informe-3d/<vehicleId>/<sessionId>`.
- Cuando pasa a listo llega un correo (hay una tarea programada que lo vigila). **En la app, eso tiene que ser además una notificación push.**

### 4.8 Tasación

- Una tarjeta por tasación: coche, valor estimado, horquilla (±7 % sobre el valor), fecha y la variación respecto a la anterior.
- Botón de **volver a tasar** — el valor se mueve y el coche envejece.
- Guarda en `moveadvisor_user_valuations` vía `POST /api/billing-account` con `{ action: "valuation_add" }`.
- Desde aquí se encadena a vender: *"Con este precio, ¿lo vendemos?"*.

### 4.9 Vender — la pestaña de venta

Dos caminos, dos tarjetas, y por debajo el estado de lo que ya esté en marcha.

#### Camino A — Informe de mercado

Información de mercado, **no una tasación**: qué se está pidiendo hoy por coches como el tuyo.

- Paso 1: eliges el IDCar (o rellenas los datos a mano).
- Paso 2: se genera el informe personalizado con precio óptimo, histórico de mercado y recomendación de momento de venta. Llega por correo y **se ve en la app**.
- `POST /api/market-price`. Se apoya en `moveadvisor_market_offers`, que es lo que se recoge de los portales.

#### Camino B — Venta gestionada

Lo vendemos nosotros. Formulario corto, cinco campos y ninguno de relleno: qué coche · en cuánto tiempo · nombre · teléfono · correo. `POST /api/leads`.

Y después, **el bloque que importa: las cinco puertas.**

> Son las mismas cinco que ve el ERP en el encargo, con el mismo semáforo. El cliente antes se enteraba de lo que le faltaba **cuando le llamábamos**, que es tarde y es caro: la llamada se gastaba en leerle una lista que podía haber leído él.

| Puerta | Se abre cuando | Si falta, dice |
|---|---|---|
| **El coche** | Están matrícula, marca, modelo, año, kilómetros **y 6 fotos** | *"Te falta la matrícula, el año y 2 fotos"* |
| **Los papeles** | Están permiso de circulación, ficha técnica e ITV | *"Te falta la ITV"* |
| **La tasación** | Hay al menos una | *"No te la has hecho todavía. Es gratis y se hace desde aquí"* |
| **El informe de estado** | Está en `informe_listo`, `verificada` o `publicada` | *"Lo empezaste y quedó a medias"* / *"Está sin hacer. Son fotos guiadas desde el móvil"* |
| **Las franjas de visita** | Hay **6 franjas libres en los próximos 14 días** | *"Tienes 2 de 6 en los próximos 14 días"* |

Reglas de pintado, que no son negociables porque están razonadas:

- **Se enseñan siempre las cinco**, abiertas y cerradas. Enseñar solo lo que falta convierte cada avance en una lista que se acorta sin decir hacia dónde: no se ve cuánto queda ni cuánto se lleva andado, que es justo lo que sostiene a quien va por la tercera de cinco.
- **La puerta abierta no es pulsable.** Un enlace para algo que ya está hecho invita a volver a hacerlo. Se queda en gris con su tic.
- **La cerrada lleva a donde se hace**, no a una página genérica. Una lista que dice "falta la ITV" y no dice dónde subirla es la mitad del problema. En la app, a la pantalla concreta con el coche ya seleccionado.
- **Se le habla a él en segunda persona.** El ERP escribe *"No se la ha hecho"*; aquí es *"No te la has hecho"*. El semáforo es el mismo; el texto no puede serlo — un panel que le habla del cliente en tercera persona se lee como un error.

**Las franjas de visita en el móvil**: calendario a dos semanas vista donde marca las horas a las que puede enseñar el coche. Es la puerta que más se atasca y la que más gana con el móvil.

#### Camino C — Marketplace VO (desde "Gestionar")

Publicar el coche uno mismo.

- Exige **precio de venta**; sin él, el servidor responde *"Indica un precio de venta antes de publicar"*. En la app, el botón se enseña deshabilitado con ese motivo escrito; no se deja pulsar para que falle.
- `POST /api/user?route=vehicle-publish` con el `vehicleId`. Crea la oferta en `moveadvisor_market_offers` y devuelve `action: "published"` con el `offer_id`.
- Despublicar es el mismo endpoint, y devuelve `action: "unpublished"`.
- Publicado: chip verde `🟢 Marketplace` en la tarjeta, y acceso a ver el anuncio como lo ve un comprador.
- Las visitas que pidan los compradores entran por `/api/user?route=viewing-request|viewing-propose|viewing-confirm`.

### 4.10 Taller — servicios y citas

**Pedir servicio.** Los tipos son los reales: pre-ITV, cambio de aceite y filtro, revisión oficial, frenos (pastillas por eje), neumáticos (cambio x4 con montaje), diagnosis, cristales, carrocería.

- Se elige IDCar, provincia y código postal. **Sin IDCar no se puede pedir cita**: el estado vacío dice *"No tienes ningún IDCar disponible. Sube primero un IDCar para poder pedir la cita"* y lleva al alta.
- Talleres cercanos **en mapa**, que en el móvil es lo natural: geolocalización del dispositivo en vez de escribir el código postal. `GET /api/workshops-nearby`.
- Horquilla de precio orientativa por servicio y por cadena (Norauto, Midas).
- Calendario de huecos reales (`GET /api/workshop-availability`) y reserva.
- `POST /api/service-requests` con `service_type, vehicle_id, vehicle_title, preferred_partner, preferred_province, preferred_dates, notes`. Nace en estado `pending`, y salen dos correos: confirmación al cliente y aviso interno.

**Mis citas.** Listado de lo pedido, con su estado y su histórico. `GET /api/service-requests` y `GET /api/user-erp-appointments?userId=`. Cada cita, al calendario del móvil con un toque.

**Calendario de mantenimiento.** Vista mensual que combina las revisiones de todos los IDCars: primero el mes, luego el detalle por día. Filtro por IDCar (*"Todos los IDCars"* o uno concreto).

### 4.11 La campana — avisos

Es un contador honesto, no un buzón. Hoy suma dos cosas:

- **Citas próximas**: *"Tienes 2 citas próximas"*.
- **Lo que le falta del encargo**: *"…y 3 cosas que traernos"*.

Reglas:

- **Si no hay nada, la campana no se dibuja.** Un icono permanentemente apagado es ruido en una cabecera que ya tiene bastante.
- **No hay "marcar como leído".** Una cita desaparece cuando pasa; una cosa del encargo, cuando la trae. Lo que hay que gestionar para que deje de avisar acaba ignorado.

**En la app se añade lo que la web no puede: notificaciones push.** Y estas son las que valen la pena, ninguna más:

| Cuándo | Qué dice |
|---|---|
| El informe de estado está listo | *"El informe de tu Golf ya está. Ábrelo aquí."* |
| 24 h antes de una cita | *"Mañana a las 10:00 en Norauto Alcobendas."* |
| La ITV vence en 30 días | *"A tu Golf le toca la ITV el 12 de marzo."* |
| El seguro vence en 30 días | *"Tu póliza vence el 3 de abril."* |
| Alguien pide ver tu coche publicado | *"Tienes una visita propuesta para el sábado."* |
| Falta una sola puerta del encargo | *"Solo te falta la ITV para que salgamos a vender."* |

Nada de promociones. En cuanto la campana avisa de cosas que no hay que hacer, se desactivan las notificaciones y se pierden también las que importan.

### 4.12 Perfil

Datos de la cuenta, cambio de contraseña (`action: "change_password"`), preferencias (`GET|PUT /api/user-preferences`), idioma **español / inglés** —la app entera está en los dos, hay fichero de traducciones completo—, tema claro y oscuro, gestión de notificaciones, documentos legales y cerrar sesión (`action: "logout"`).

Facturación: si hay algo que cobrar, abre el portal de pagos existente (`POST /api/billing-portal`). No rehacer pagos dentro de la app.

---

## 5. Modelo de datos — las tablas que ya existen

No crear tablas nuevas. Estas son las que toca la app:

| Tabla | Qué guarda |
|---|---|
| `moveadvisor_users` | La cuenta. **Compartida con la web.** |
| `moveadvisor_sessions` | Las sesiones vivas |
| `moveadvisor_user_vehicles` | El IDCar. Clave `id`, dueño `user_email` |
| `moveadvisor_user_vehicle_files` | Fotos y documentos (`file_type`: `photo` / `document`) |
| `moveadvisor_user_vehicle_characteristics` | Características extra |
| `moveadvisor_user_vehicle_documents` | Documentos por tipo |
| `moveadvisor_user_appointments` | Citas |
| `moveadvisor_user_appointment_status_history` | Su histórico |
| `moveadvisor_user_insurances` + `_documents` | Seguro y pólizas |
| `moveadvisor_user_maintenances` + `_invoices` | Mantenimientos y facturas |
| `moveadvisor_user_valuations` | Tasaciones |
| `moveadvisor_user_vehicle_states` | Estado del coche |
| `moveadvisor_service_requests` | Solicitudes de servicio |
| `moveadvisor_vehicle_condition_reports` | Espejo del informe de PopCar Check |
| `moveadvisor_market_offers` | Ofertas del mercado y las publicadas |
| `moveadvisor_user_preferences` | Preferencias |

Columnas de `moveadvisor_user_vehicles` (las que pinta la ficha): `id, user_email, title, brand, model, version, transmission_type, cv, color, horsepower, seats, doors, vehicle_location, body_type, environmental_label, last_itv, next_itv, co2, price, marketplace_pricing_mode, year, plate, mileage, fuel, policy_company, notes, created_at, updated_at`

---

## 6. Endpoints — la lista que consume la app

Base: `https://www.popcar.com.es`. Ojo: varios van **enrutados** por `/api/billing-account`, `/api/user?route=` y `/api/market?route=` — no son rutas sueltas, y el nombre del fichero no es el nombre de la ruta.

Dos cabeceras en **todas** las peticiones de la app:

```
Authorization: Bearer <sessionId>.<token>
X-PopCar-Client: app
```

**Cuenta**
- `POST /api/auth` — `login` · `register` · `logout` · `change_password` · `request_password_reset` · `reset_password` · `save_consents`
- `GET /api/auth` — sesión actual

**IDCar y datos del usuario** (todo por el enrutador de la cuenta)
- `GET /api/billing-account?email=&scope=garage` — garaje completo
- `GET /api/billing-account?email=&scope=garage&summary=true` — lista ligera, para el arranque
- `GET /api/billing-account?email=&scope=mobility` — citas, tasaciones, seguros y mantenimientos de una vez
- `POST /api/billing-account` con `action`: `garage_add` · `garage_remove` · `valuation_add` · `maintenance_add` · `insurance_upsert` · `vehicle_state_upsert` · `appointment_add` · `appointment_delete`

**Ficheros**
- `POST /api/user?route=storage-presign` — subida firmada
- `/api/user?route=attachment-file` — adjuntos

**Catálogo**
- `GET /api/erp-catalog?scope=brands|models|versions|version-detail`
- `GET /api/vehicle-catalog`

**Venta**
- `POST /api/user?route=vehicle-publish` — publicar y despublicar en Marketplace VO
- `GET /api/marketplace-vo` · `GET /api/marketplace-vo?id=`
- `POST /api/market-price` — informe de mercado
- `POST /api/leads` — el encargo de venta gestionada
- `GET|POST /api/market?route=condition-report` — informe de estado; PDF con `&descargar=<session_id>`; 3D en `/api/informe-3d/<vehicleId>/<sessionId>`
- `/api/user?route=viewing-request|viewing-propose|viewing-confirm|viewing-get` — las visitas al coche publicado

**Taller**
- `GET|POST /api/service-requests`
- `GET /api/workshops-nearby` · `GET /api/workshop-availability`
- `POST /api/erp-appointment` · `GET /api/user-erp-appointments?userId=`

**Otros**
- `GET|PUT /api/user-preferences`
- `POST /api/billing-portal` — portal de pagos

Límite del cuerpo de petición: **20 MB**. Adjunto individual: **12 MB**.

---

## 7. Lo que la app hace y la web no

Si la app no aporta esto, no merece la pena construirla:

1. **Cámara nativa** para la captura guiada del informe de estado y para las fotos del coche. Es el flujo más largo del producto y el que peor se da en un navegador móvil.
2. **Escáner de documentos** con recorte y enderezado automático.
3. **Documentos sin cobertura**, cifrados en el dispositivo.
4. **Notificaciones push** (la lista de §4.11).
5. **Biometría** para entrar.
6. **QR a pantalla completa** con brillo al máximo.
7. **Citas al calendario** del sistema con un toque.
8. **Geolocalización** para talleres cercanos, sin escribir el código postal.
9. **Widget de pantalla de inicio**: próxima cita y próxima ITV.

---

## 8. Estados vacíos, errores y detalles

- **Sin coches**: una sola tarjeta con el alta. No pintar secciones vacías.
- **Sin cobertura**: banner discreto arriba, *"Sin conexión — estás viendo la última copia"*, y los documentos descargados siguen abriéndose.
- **Error del servidor**: decir qué pasó y ofrecer reintentar. Nunca un genérico.
- **Guardado**: optimista en pantalla, confirmado contra el servidor. Si falla, revertir y decirlo.
- **Nunca una acción que se sabe que va a fallar.** Si falta el precio para publicar, el botón va deshabilitado con el motivo escrito; no se deja pulsar para que el servidor diga que no.
- **Nunca prometer lo que no hace.** Si el informe está a medias, el botón dice *"Continuar"*, no *"Ver informe"*.
- **Cifras con Nunito Sans y `tabular-nums`** en cualquier columna.
- **Fechas en español**: `12 mar 2026`. Miles con punto: `128.500 km`.

---

## 9. Prompt corto para newly.app

Para el primer intento, si el generador pide algo breve:

> App móvil en español (con inglés disponible) llamada **PopCar**, para que el dueño de un coche lo gestione entero desde el móvil. **No lleva base de datos ni login propios: se conecta por API REST a `https://www.popcar.com.es/api` con la misma cuenta que la web, sesión por cookie `moveadvisor_session` o token Bearer.**
>
> Cinco pestañas: **Inicio** (resumen: coche, lo que falta del encargo, próxima cita, valor estimado, avisos) · **Mis coches** (lista de IDCars con fotos, ficha técnica, documentos, QR y un panel de acciones por coche) · **Vender** (informe de mercado, venta gestionada con un checklist de cinco requisitos, y publicar en el Marketplace) · **Taller** (pedir servicio, talleres en mapa, mis citas, calendario de mantenimiento) · **Perfil**.
>
> Campana de avisos arriba, que solo aparece cuando hay algo, y notificaciones push para: informe listo, cita mañana, ITV o seguro que vencen, visita propuesta.
>
> Diseño: fondo claro `#FAFAF8`, texto y **botones en negro `#111111`**, amarillo `#FFC400` solo como acento —nunca texto pequeño amarillo sobre blanco—, tipografía Nunito Sans, esquinas de 10-12 px, tarjetas con borde gris `#E4E4DF` y sombra muy suave. Tema claro y oscuro.
>
> Nativo obligatorio: cámara con captura guiada, escáner de documentos, documentos accesibles sin conexión, biometría, QR a pantalla completa, añadir citas al calendario y geolocalización para talleres.

---

## 10. Antes de construir: lo que hay que decidir

### Hecho (no hace falta decidirlo)

- **El token de sesión.** `api/auth.js` acepta `Authorization: Bearer` y devuelve el token a quien mande `X-PopCar-Client: app`. Lo vigila `npm run test:sesion-app`, que comprueba además que la respuesta de la web no cambió.
- **CORS.** `lib/cors.js`, aplicado en los nueve puntos de entrada de la API. Apagado mientras no haya `CORS_ORIGENES` en el entorno.
- **Las rutas relativas.** Las 38 llamadas que tenían la ruta escrita a mano pasan ya por `rutaApi()`, que antepone `REACT_APP_API_BASE_URL`. En el navegador esa variable está vacía y el string resultante es idéntico al de antes. Lo vigila `npm run test:rutas-api`.

### Por decidir

1. **El identificador de la app.** `capacitor.config.ts` todavía dice `com.carswiseai.app` / `CarsWise AI`. Para PopCar tocaría `es.com.popcar.app` y `PopCar`. Como no está publicada en Google Play, aún se puede cambiar; después de publicar, no. Arrastra la carpeta `android/app/src/main/java/com/carswiseai/app/` y el `namespace` del `build.gradle`.
2. **Subida de ficheros.** Usar `/api/user?route=storage-presign` desde el móvil, no base64 en el cuerpo. Con fotos de móvil de 8 MP, el límite de 20 MB se alcanza en cuatro fotos.
3. **Qué pasa con el informe de estado**: ¿se abre PopCar Check en un navegador dentro de la app, o se reimplementa la captura en nativo? Lo primero es inmediato; lo segundo es lo que hace que la app valga la pena. Se puede empezar por lo primero y cambiarlo después.
4. **Si al final se envuelve la web con Capacitor** en vez de generar una app nueva: `android/` ya está en el repo pero nunca se sincronizó (`assets/public/` está vacío). Haría falta `npx cap sync`, un keystore y poner `REACT_APP_API_BASE_URL=https://www.popcar.com.es` en el build.
