# La arquitectura por dentro — Mobility-Advisor

Lo que encontraría alguien que entra hoy a este repositorio sin conocerlo, medido
y no recordado. Todas las cifras salen de contar los ficheros el **30 de
septiembre de 2026**; los comandos están al pie de cada sección para que se puedan
volver a medir.

Está escrito para la persona que llegue después. Por eso dice también lo que está
mal, lo que se decidió a propósito y lo que no he mirado.

---

## 1. Cómo está montado

### 1.1 Qué es este repositorio

Cuatro cosas en un solo sitio:

| Qué | Dónde | Tamaño |
|---|---|---|
| La web pública (`www.popcar.com.es`) | `src/` | 170 ficheros, 64.600 líneas |
| La API sin servidor | `api/` + `lib/api/` | 72 ficheros, 26.600 líneas |
| La lógica de negocio y los almacenes | `lib/` (incluye `lib/api/`) | 120 ficheros, 35.200 líneas |
| Los scrapers y utilidades de consola | `scripts/` | **232 ficheros, 52.300 líneas** |

Las pruebas van al lado del código: 78 ficheros de prueba en `src/` y 134 en
`lib/`, y **cero en `api/`** —vuelve en §3.1—.

Eso último es la mitad del repositorio y no se despliega: son programas que se
lanzan a mano o desde n8n. Conviene saberlo antes de sacar conclusiones de un
`wc -l` global.

La web es Create React App 5. **No hay `react-router`**: la navegación se deduce a
mano de `window.location.pathname`. Vuelve en §2.4.

### 1.2 Por dónde entra una petición

`vercel.json` tiene **49 reglas para `/api`**, pero no apuntan a 49 ficheros:
apuntan a **seis funciones**.

```
  22 reglas  ->  /api/market      (24 rutas)
  19 reglas  ->  /api/user        (21 rutas)
   5 reglas  ->  /api/billing     ( 5 rutas)
   1 regla   ->  /api/search-offers
   1 regla   ->  /api/billing-webhook
   1 regla   ->  /api/$1          (el resto, directo)
```

Vercel cobra por función desplegada, así que tres de ellas son **repartidores**:
miran `?route=` y cargan el manejador que toca desde `lib/api/`. La mecánica del
reparto vive una sola vez, en `lib/api/enrutador.js`.

Dos detalles que importan:

- **los manejadores se cargan al usarse.** `api/market.js` requería sus 24
  manejadores arriba del fichero: medido, **311 módulos y 313 ms solo en cargar**,
  y lo pagaba cada petición a cualquiera de sus rutas. Ahora cada ruta trae una
  función que hace el `require` cuando toca;
- **el precio de eso** es que un fallo de sintaxis en un manejador ya no revienta
  al arrancar, sino al pedir esa ruta. Por eso `lib/api/enrutador.test.js` carga
  todos los manejadores de las tres puertas y falla en las pruebas, que es antes.

Y una regla más que hay que conocer: `/(.*)` → `/index.html`. Es lo que hace que
las 24 direcciones públicas funcionen en una carga directa. **Si desaparece, las
24 dan 404 y ninguna prueba de este repositorio lo nota.**

### 1.3 Quién guarda qué

Una sola base: **Neon Postgres**, compartida por la web, la app y el ERP. Por eso
las migraciones de los tres viven aquí, en `migrations/` (16 ficheros).

Un solo cliente: `lib/postgres.js`, que **52 ficheros** piden con `elPool()` o
`elPoolObligatorio()`. Quedan **tres** `new Pool(` a mano:

- `lib/api/billing-ping-handler.js` — una comprobación de vida, deliberada;
- `lib/inventoryStore.js` — el almacén del inventario, pendiente;
- `lib/postgres-ssl.js` — es un comentario, no una llamada.

El esquema se cambia **solo** en `migrations/`, aplicado con `npm run migra`. Hay
un vigilante (`scripts/comprueba-migraciones.js`) que cuenta los ficheros que
crean tablas por su cuenta y solo deja que el número baje. Hoy son 3 en la web
(el tope está en 22, se puede bajar) y **26 en el ERP, por encima de su tope de
25 desde el 24 de septiembre**. Eso último no es de este repositorio pero se mide
desde aquí, porque la base es la misma.

### 1.4 Lo que corre solo

Ocho tareas programadas en `vercel.json`, todas colgando de `/api/user`:

| Cuándo | Qué |
|---|---|
| 08:00 | recordatorios de cita |
| cada hora :10 | seguimiento de citas |
| 09:00 y 17:00 | alertas de mercado |
| cada 15 min | informes de estado listos |
| 10:00 | vigilar los scrapers |
| cada hora :20 y :40 | facetas del buscador |
| **cada hora :05** | **avisar de los fallos** (nuevo) |

Todas exigen `CRON_SECRET`: sin secreto configurado **no pasa nadie**. Antes era
al revés —el secreto habilitaba la defensa en vez de exigirla—, así que olvidarse
de configurarlo no daba error, solo quitaba la cerradura.

> Medido con: `node -e` sobre `vercel.json`; `find src api lib -name "*.js"`;
> `grep -rl "elPool" lib/ api/`.

---

## 2. El flujo completo de datos

### 2.1 Una búsqueda de coche, que es el caso caro

```
  la persona contesta el cuestionario
        │
        ▼
  POST /api/analyze          ← el modelo devuelve un perfil     (maxDuration 300)
        │
        ▼
  POST /api/find-listing     ← y aquí está el problema          (maxDuration 300)
        │
        ├── html.duckduckgo.com          (buscar)
        ├── r.jina.ai                    (leer páginas)
        └── 8 portales: bipicar, idoneo, kinto, leasecom,
            ayvens, okmobility, swipcar, vamos
        │
        ▼
  se puntúa y se ordena en memoria     (2.860 líneas de lógica pura)
        │
        ▼
  la web lo pinta
```

**El navegador espera 295 segundos** (`LO_QUE_ESPERA_EL_NAVEGADOR_MS`). Y no es
un margen de seguridad: una búsqueda con los siete criterios contestados **tarda
253 segundos medidos contra producción**. Vuelve en §3.3.

### 2.2 El mercado de VO, que es el caso normal

```
  /marketplace-vo
        │
        ▼
  GET /api/market?route=marketplace-vo     ← página de 15, desde Postgres
        │
        ▼
  moveadvisor_marketplace_vo_offers        ← la tabla dedicada
```

Rápido, paginado y sin red externa. La diferencia con §2.1 es la que hay entre
leer una tabla propia y rascar ocho portales en vivo.

### 2.3 Quién eres

```
  navegador ──cookie moveadvisor_session──▶ api/auth ──▶ moveadvisor_users
                                                │
  la web además guarda el usuario en localStorage
  (para no ver la portada un instante al recargar)
```

Dos fuentes, y `useLaSesion` es quien las mantiene de acuerdo: escribe en el
navegador y en el estado **a la vez**, en `entra()` y `sale()`. Antes eran dos
estados movidos por separado en cuatro ficheros.

### 2.4 Y una dirección, cómo se convierte en pantalla

```
  window.location.pathname
        │
        ▼
  src/utils/rutas.js          ← 24 direcciones públicas, tabla única
        │                        (+ las de /panel, que resuelve offerHelpers)
        ▼
  entryMode (una cadena)  +  step === -1
        │
        ▼
  el JSX de App.js elige qué pantalla pinta
```

Esto es lo que hace `react-router` en otros proyectos, y aquí lo hace un efecto de
120 líneas con promesas anidadas. Vuelve en §3.4.

---

## 3. Zonas críticas

Ordenadas por lo que costaría que fallasen, no por lo feas que son.

### 3.1 🔴 `api/find-listing.js` — 4.628 líneas sin una sola prueba propia

Es el corazón del producto: decide **qué coches ve la gente**. Y de las 18
funciones de `api/`, **ninguna tiene fichero de prueba propio**.

Pero la medición cambia el plan. De sus **114 funciones, 106 son puras**: 2.860
líneas sin red, sin `process.env` y sin `await`. Solo 8 tocan el mundo exterior,
y una de ellas —`findListing`— son **995 líneas en una sola función**.

O sea: parece intestable y es tres cuartas partes lógica pura. `scoreListingForProfile`
(140 líneas), `buildRankedListingResponse` (164), `buildVehicleCandidates` (132),
`buildQueries` (86) y `buildWhyMatches` (91) son «entra un perfil y una oferta,
sale una puntuación». Se prueban en milisegundos.

**Qué haría**: sacar las 106 a `lib/` y probarlas ahí, empezando por las cinco de
arriba. Lo que quede —`findListing`— partirlo en fases con nombre: buscar,
filtrar, puntuar, responder.

### 3.2 🔴 395 `useState` en `src/pages`

Aquí está el hallazgo que más cambia desde la versión anterior de este documento,
y lo encontré midiendo mal primero: con `-maxdepth 1` salían 287, pero `src/pages`
tiene carpetas dentro —`userDashboard/`, `adviceResults/`— y el recuento de verdad
es peor.

El trabajo sobre `App.js` bajó sus estados de 127 a 40, pero el reparto real es:

| Dónde | `useState` |
|---|---|
| `src/pages` (64 ficheros) | **395** |
| `src/hooks` (29 ficheros) | 82 |
| `src/components` (20 ficheros) | 59 |
| `src/App.js` | 40 |

De los **576 `useState` del front, 395 están en las pantallas** y 82 en los hooks,
que es donde deberían estar.

Y en las pantallas grandes la densidad es **peor** que la que tenía `App.js`:

| Fichero | Líneas | Estados |
|---|---|---|
| `UserDashboardVehicles.js` | 3.340 | 32 |
| `ServiceIdCarsManagePage.js` | 2.676 | 31 |
| `DecisionPage.js` | 2.060 | **37** |
| `SellReportMarketPage.js` | 1.958 | 31 |
| `PortalVoDetailPage.js` | 1.770 | 24 |

`DecisionPage.js` tiene **más estados que `App.js`** en la cuarta parte de líneas.
Y `src/pages` tiene **64 ficheros con 20 pruebas**.

**Qué haría**: la misma receta, que ya está probada quince veces —medir el grupo,
sacarlo a un hook con la regla escrita, y una prueba con el nombre del defecto que
la medición encuentre—. Con una diferencia: `UserDashboardVehicles` recibe **15
props**. Ahí el problema no son los estados, es que no hay frontera; antes de
mover estado hay que decidir si esa pantalla debería leer del hook de datos en vez
de recibirlo masticado.

### 3.3 🟠 Una función de 300 segundos es un techo de escalabilidad

`find-listing` y `analyze` están declarados con `maxDuration: 300`. La búsqueda
tarda 253 segundos medidos.

Eso no es solo una mala experiencia —cuatro minutos mirando una pantalla de
carga—: es el límite de cuánta gente cabe. Cada búsqueda ocupa una función
durante cuatro minutos, y las funciones concurrentes se pagan y se acaban. Cien
personas buscando a la vez son cien funciones de cuatro minutos.

**Qué haría, y no es un refactor**: sacar la búsqueda de la petición. Se acepta el
encargo, se devuelve un identificador, se trabaja en una cola y la web pregunta o
recibe un aviso. Y por debajo, cachear: los ocho portales no cambian sus precios
cada minuto, así que rascarlos en vivo por cada persona es pagar ocho veces lo
mismo.

Es el cambio más grande de esta lista y el único que no se puede hacer sin
decidir producto: qué se le enseña a alguien mientras espera.

### 3.4 🟠 No hay router

La navegación se deduce a mano: 22 lecturas de `pathname`, 37 escrituras, y un
efecto de 120 líneas con promesas anidadas que incluye un comentario avisando de
que poner `entryMode` antes de pedir la oferta **entra en bucle**.

Lo que ya está hecho para poder abordarlo:

- la tabla de rutas vive en `src/utils/rutas.js`, sin React y sin `window`, con
  **85 pruebas** que describen lo que hace hoy;
- «ir a una pantalla» es **una función**, `vasA(modo)`, en 89 sitios. Antes eran
  dos instrucciones —`setEntryMode(X); setStep(-1);`— escritas **87 veces**.

Con esas dos cosas, migrar a `react-router` pasa a ser «cambiar el cuerpo de una
función» en vez de «reescribir 87 manejadores y un efecto de 120 líneas a la vez».

**Qué haría**: eso, **después del lanzamiento**. Es lo que decide en qué pantalla
aterriza quien llega de un correo o de Google, y `/marketplace-vo/:id` tiene
además una regla especial en servidor (la vista previa al compartir) que no se
puede romper.

### 3.5 🟡 SQL Server sigue cargándose, y con `execFileSync`

`api/erp-catalog.js` y `api/vehicle-catalog.js` conservan `require("mssql")` **y
`execFileSync` para lanzar `sqlcmd`**, gobernados por `VEHICLE_CATALOG_PROVIDER`
—una variable que está **vacía en `.env.example` y ausente en `.env.local`**—. Las
dos rutas van a Postgres de verdad.

Que sea inalcanzable hoy no es garantía. Un `execFileSync` en una función sin
servidor bloquea el proceso y ejecuta un binario externo; que lo despierte una
variable mal puesta es un riesgo que no compensa mantener.

**Qué haría**: comprobar en el panel de Vercel que la variable no está, y
**borrar** —las ramas, el `execFileSync` y la dependencia—. Hay un vigilante
(`lib/nadie-lanza-sqlcmd.test.js`) que hoy solo deja menguar el número; pasaría a
exigir cero.

### 3.6 🟡 Dos pantallas que son un programa cada una

`api/analyze.js` (2.068 líneas) y `api/auth.js` (1.873) son las otras dos
funciones grandes sin prueba propia. `analyze` tiene además una cascada de cinco
intentos de interpretar el JSON que devuelve el modelo, cada uno con su `catch`
vacío —y eso está bien: que uno falle es lo normal y el siguiente lo intenta—.

---

## 4. Estrategia de refactorización

### 4.1 Lo que ya está hecho

Dieciséis rebanadas, del 29 al 30 de septiembre. El método fue siempre el mismo:
**medir el grupo antes de moverlo**, y escribir una prueba con el nombre del
defecto que la medición encontrara. En catorce de las dieciséis apareció uno real.

`src/App.js`: **127 → 40 estados**, 7.757 → 7.328 líneas.
Pruebas: **667 → 934** en el front, **~1.580 → 1.653** en el backend.

Lo que la medición sacó a la luz, que es el motivo de trabajar así:

| Qué se movía | Qué se encontró |
|---|---|
| la búsqueda de ofertas | tres listas distintas de «esto ya no vale»; la línea de cobertura seguía en pantalla con los números de la búsqueda anterior, 253 segundos o para siempre |
| el mercado de VO | el paginador resaltaba una página que no había llegado |
| los consentimientos | la regla «quitar el legal quita los otros cuatro» vivía en un `onChange`, y la condición «están los cinco» estaba escrita tres veces en diecisiete líneas |
| recuperar la cuenta | dos copias de «ya estás dentro» que **no coincidían**: una no volvía a donde estabas y no contaba el acceso en el embudo |
| el diálogo de acceso | `authForm` se vaciaba de **cuatro formas**; la razón social era el único campo que se perdía al reabrir |
| la sesión | dos estados para el mismo hecho, movidos en cuatro ficheros; y 20 líneas muertas con una tercera copia de «ya estás dentro» |
| la navegación | «abrir la ficha» escrito cuatro veces, y a una le faltaba una línea |

Y aparte del refactor, tres cosas que no eran deuda sino fallos:

- **el acceso se veía con la eñe partida**: 38 letras con doble codificación en
  los mensajes que ve quien **no** consigue entrar;
- **no había forma de enterarse de un fallo**: ni seguimiento de errores, ni
  avisos. `billing-account` se tragaba el `UPDATE` que activa el plan —Stripe
  cobra y la base puede no enterarse— y `vehicle-publish` se traga **seis
  `UPDATE`**, precio incluido, y responde `{ ok: true }`;
- **una migración con `CONCURRENTLY` no podía aplicarse nunca**, porque el runner
  metía todo en una transacción. Bloqueaba también a las siguientes.

### 4.2 El orden que seguiría ahora

**Antes del lanzamiento** — nada que pueda romper lo que funciona:

1. **Cerrar las dos decisiones de producto** (§5).
2. Comprobar que el seguimiento de errores funciona de punta a punta.

**Las dos semanas siguientes:**

3. **§3.5, borrar SQL Server.** Barato, y quita un `execFileSync` de un endpoint.
4. **§3.1, probar las 106 funciones puras de `find-listing`.** Es lo único crítico
   sin red, y donde un fallo cuesta dinero directamente.

**Después del lanzamiento:**

5. **§3.2, las cinco pantallas grandes.** El patrón está hecho quince veces.
6. **§3.4, `react-router`.**
7. **§3.3, sacar la búsqueda de la petición.** El más grande, y el que necesita
   decisión de producto.

### 4.3 Lo que NO recomiendo tocar

- **Los 40 estados que quedan en `App.js`.** Caben en una pantalla, están
  agrupados y comentados. Es un componente grande, que no es lo mismo que deuda.
- **Los tres repartidores.** Que 49 reglas apunten a seis funciones es una
  decisión correcta: Vercel cobra por función.
- **Los cinco `catch` vacíos de `api/analyze.js`.** Son la cascada de intentos de
  interpretar el JSON del modelo. Registrarlos sería ruido que tapa lo demás.
- **`scripts/`.** 232 ficheros que no se despliegan. Tienen sus propios
  comprobadores (`npm run test:marca`, `test:wallapop`, …) y su riesgo es otro.

---

## 5. Lo que hace falta decidir, y no es mío

Dos cosas que encontré, que no he cambiado porque cambiarlas es decidir producto:

1. **Se puede registrar sin aceptar las condiciones.** El bloque de las cinco
   casillas solo se dibuja mientras se enseña el aviso de cookies, y ese aviso
   desaparece en cuanto alguien lo contestó una vez. Quien vuelve ve el formulario
   **sin casillas**, y el servidor acepta `consentLegalAt` a nulo
   (`api/auth.js:1193`). La red es el aviso de revisión, pero salta **al entrar**,
   no al registrarse: entre registrarse y el siguiente acceso, esa cuenta existe
   sin condiciones aceptadas. Está escrito en
   `src/hooks/useLosConsentimientosDelRegistro.js`.

2. **Los seis `UPDATE` del publicador.** Ahora dejan rastro, pero seguir adelante
   con `{ ok: true }` cuando uno falla es una decisión: hace falta una transacción
   y decidir si un fallo debe deshacer la publicación.

Y una que falta por hacer y es pequeña: cuando falla una página del mercado que no
es la primera, el clic **no hace nada**. Ya no miente —antes resaltaba una página
que no había llegado— pero hay que decidir qué se enseña.

---

## 6. Lo que no he mirado

Para que nadie lea este documento como si cubriera todo:

- **`scripts/`** — 232 ficheros, 52.300 líneas. Los scrapers, el scoring de
  importación, las facetas. Es la mitad del repositorio.
- **`api/analyze.js`** por dentro — sé que son 2.068 líneas y que no tiene prueba
  propia; no he leído su lógica.
- **El rendimiento de la base** más allá de los dos índices que se arreglaron.
  No he hecho un repaso de planes de consulta.
- **La seguridad**, más allá de lo que salió de paso: el `execFileSync`, los
  `CRON_SECRET` y el ReDoS que yo mismo metí y arreglé. No es una auditoría.
- **Los otros tres repositorios**: `carswise-erp-backoffice` (435 ficheros),
  `popcar-pocket-advisor` (260) y `Carswise-check` (113). El ERP es el que usa el
  equipo todos los días, y es el que nadie ha abierto.

---

## Cómo volver a medir esto

```bash
# Forma del repositorio
find src api lib -name "*.js" ! -name "*.test.js" | wc -l

# Dónde vive el estado.
# SIN -maxdepth: src/pages tiene carpetas dentro (userDashboard/, adviceResults/)
# y con -maxdepth 1 salen 287 en vez de 395.
for d in src src/pages src/hooks src/components; do
  echo -n "$d: "
  find $d -name "*.js" ! -name "*.test.js" \
    -exec grep -c "= useState(" {} + | awk -F: '{s+=$NF} END {print s+0}'
done

# Entradas y funciones
node -e 'const v=require("./vercel.json");
  console.log(v.rewrites.filter(r=>r.source.startsWith("/api")).length + " reglas");
  console.log(v.crons.length + " crons")'

# Las dos suites
npm run test:todo
```
