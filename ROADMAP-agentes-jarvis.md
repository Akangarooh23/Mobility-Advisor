# ROADMAP — Oficina de Agentes de CarsWise + Jarvis

> **Documento de traspaso.** Si estás leyendo esto recién llegado al repo (persona o
> agente), este fichero es el **plan** y la **realidad corregida** del proyecto de agentes
> de CarsWise. No te fíes de suposiciones de stack: **lee el código real** (rutas citadas
> abajo) antes de escribir nada. Este plan nació de una auditoría de los repos reales, no
> de un diseño en abstracto.
>
> Estado del producto: **en pruebas, sin lanzamiento público ni campañas.** Las métricas
> bajas (pocos usuarios/leads, 0 valoraciones registradas) son pre-lanzamiento, no fallo
> de conversión.

---

## 0. Cómo usar este documento

1. Lee el **mapa real** (§2) y verifica cada afirmación contra el código antes de construir.
2. La fuente de verdad del **motor de tasación** es `ROADMAP-sell-report.md`. Léelo antes de
   tocar precios. Este documento NO lo sustituye.
3. El trabajo se hace **por fases** (§8). No empieces la Fase 1 sin cerrar la Fase 0.
4. Los **invariantes** (§9) no se negocian.

---

## 1. Qué estamos construyendo

Dos cosas, que son **un proyecto SEPARADO** (`carswise-jarvis`) conectado a este repo
(`movilidad-advisor`) por interfaces de **solo lectura**:

- **Jarvis** — asistente personal de monitorización (bot de Telegram/WhatsApp + parte
  matinal). Te da KPIs, salud del pipeline, estado de deploys/errores; responde preguntas
  del negocio; delega "ve y averigua X" a agentes de solo lectura; prepara borradores.
- **La Oficina de Agentes** — una plantilla de agentes acotados que ejecutan tareas
  concretas (verificar golden tests, triar errores, explorar código, completar datos,
  leer PDFs) + un **dashboard visual** ("la oficina") que visualiza su estado real.

**Por qué separado:** al ser otro repo/servicio, la frontera de permisos es **física**.
El proyecto de agentes solo tiene en disco una connection string de **solo lectura** de
Neon y **clones de solo lectura** de los repos. Por construcción no puede romper producción
ni tocar datos de cliente, aunque un agente se descarríe.

---

## 2. Mapa real del ecosistema (realidad corregida)

**No es un monorepo. Son dos repos que comparten la MISMA base de datos Neon.**

| Repo | Qué es | Deploy |
|---|---|---|
| **`movilidad-advisor`** (este) | Web pública **CRA / react-scripts (NO Next.js)** + funciones serverless en `/api` + **lógica de negocio en `lib/`** + **el motor de tasación** + scripts + workflows n8n + golden tests | Vercel (carswiseai.com) |
| **`carswise-erp-backoffice`** | ERP: `apps/api` (Express/TS, :4000) + `apps/web` (Vite/React, :5174). Repo separado (remoto propio). En local vive en la carpeta `carswise-erp-backoffice-review/` (gitignored). El submódulo `carswise-erp-backoffice/` está **vacío** | Vercel |

**Base de datos: Neon Postgres** (rol `neondb_owner`, una sola `DATABASE_URL` con
privilegios totales DML **y DDL**; **sin RLS, sin rol de solo lectura**). **NO es Supabase.**
Supabase se usa **solo como Storage** (bucket `vehicle-files`, con service key). El
aislamiento por usuario es a mano (`WHERE user_email=$1`).

**El motor de tasación NO es un repo aparte** ni es `api/analyze.js` (eso es el *asesor de
compra*, usa Gemini). Vive dentro de este repo:
- `lib/sellReportGenerator.js` → `generateSellReport(vehicle)` — ensambla precio + PDF.
  Usa **Gemini** solo para el factor de daño semántico y la narrativa (con fallback).
- `lib/inventoryStore.js` — toda la matemática: `getMarketPriceSnapshot`, `computeUsageImpact`,
  `solveOLS2x2`, `USAGE_DEFAULTS`.
- **Entrada real:** se invoca desde el **webhook de Stripe** (`lib/api/billing-webhook-handler.js`)
  tras un pago. `POST /api/market?route=price` (`lib/api/market-price-handler.js`) devuelve solo
  el *snapshot* de mercado.
- **Golden tests:** `scripts/golden-tests/run.js` — herméticos (sin DB ni Gemini), `exit(1)`
  en drift. **Listos para CI pero NO enganchados** (el CI actual solo corre `test:backend-ci`
  + build en `.github/workflows/backend-validation.yml`).

**Tablas clave (Neon, prefijo `moveadvisor_`):**
- Motor de precios (input): `moveadvisor_market_offers` + `moveadvisor_brand_aliases` /
  `moveadvisor_model_aliases` → output `moveadvisor_user_valuations` + `sell_report_telemetry`.
- Marketplace propio: `moveadvisor_marketplace_vo_offers` / `_units`.
- Demanda/telemetría: `moveadvisor_market_leads` (maduro, máquina de estados + emails Resend),
  `moveadvisor_funnel_events` (funnel anónimo→identificado, con UTM), `moveadvisor_vehicle_alerts`.
- Garaje/cliente (dato sensible): `moveadvisor_user_vehicles` + `_files` / `_documents`
  (adjuntos en Supabase).
- Facturación: `moveadvisor_user_invoices`, `moveadvisor_invoice_counters` (ERP).
- Talleres/servicio: `workshop_locations`, `moveadvisor_service_requests`.

**n8n:** ~29 workflows (25 activos), scrapers + enrichers + scoring de importación +
mantenimiento. Corre en el mini PC vía pm2 (con auto-arranque por tarea programada de Windows).

---

## 3. Arquitectura decidida (no relitigar sin que el código lo contradiga)

- **Especialización por PERMISOS/radio de impacto, no por persona.** Un agente no es
  "financiero" o "de tecnología"; es el mismo modelo. Lo que cambia es **a qué puede escribir,
  qué credenciales lleva y qué tests debe pasar**. La "sala" = el llavero.
- **No hay agente líder.** Coordinación por **estado compartido** (`ROADMAP-sell-report.md`,
  golden tests, telemetría, tabla `tasks`). Se delega "ve y averigua X", **nunca "implementa X"**.
- **Preguntar a los DATOS, no a los agentes.** "¿Cuántos registros?" → una tool con SQL, un
  salto, número exacto. "¿Por qué han bajado?" → eso sí es razonamiento de un agente.
- **Detección determinista.** El LLM no "se da cuenta" por sondeo. Detectan: cron con SQL
  (frescura de datos), health checks, Sentry (cuando exista), error workflows de n8n. El
  enrutado es una tabla (YAML), no una llamada a un modelo.
- **La costura con `movilidad-advisor` (todo solo lectura):**

  | Conexión | Para qué | Permiso |
  |---|---|---|
  | **Neon** rol `carswise_readonly` | KPIs de Jarvis + estado real de la oficina | SELECT |
  | **`tasks`** (tabla nueva) | eventos (n8n/cron/humano) → oficina + dispatcher | la escribe n8n, la lee Jarvis |
  | **Clones git** de los dos repos | los agentes leen código; proponen PR, no mergean | Lectura |
  | **Vercel API / Sentry / `/healthz`** | deploys, errores, uptime | Lectura |
  | **Langfuse** (self-host) | trazas + coste en tokens (KPI) | Lectura |

  **Nunca cruzan la costura:** escrituras a `moveadvisor_*`, la URL de `neondb_owner`, la
  service key de Supabase, ni PDFs de cliente hacia un runtime con llaves.

- **Instalar vs escribir:** Cola/cron/historial → **Trigger.dev** (self-host). Trazas/coste →
  **Langfuse** (self-host). Disparadores → **n8n** (ya). Runtimes de agentes, dispatcher y
  puerta de aprobación → **escribir** (Claude Agent SDK / Claude Code headless). Oficina visual
  → escribir, al final.

---

## 4. Las salas (runtimes) y sus agentes

### Ola 1 — Tecnología / Datos (donde está el riesgo real ahora)

| Sala (runtime) | Radio de impacto | Agentes | Permisos |
|---|---|---|---|
| **Precios** | El motor (`lib/inventoryStore.js`, `lib/sellReportGenerator.js`). Fallo = precios erróneos a clientes que pagan | Verificador golden, Arqueólogo de datos | Lectura + ejecutar golden tests + **INSERT solo en `enrichment_proposals`**. Merge a producción solo si golden verdes |
| **Backend** | ERP/API + Sentry. Fallo = ERP roto, no precios malos | Triador de errores | Solo lectura. Diagnostica, no arregla |
| **Web** | `src/` + web pública + bot WhatsApp | Explorador (cross-repo) | Solo lectura. Propone PR, no deploya |
| **Cuarentena** | Input hostil: PDFs de IDCars + webs scrapeadas | Lector | **CERO credenciales.** Devuelve dato inerte que otro runtime con llaves valida |

### Ola 2/3 — Negocio / Monetización (nacen como VIGÍAS de solo lectura en el parte matinal; ascienden a "proponen" cuando el volumen lo justifique; **Juan** es el humano que aprueba lo comercial)

| Sala | Radio | Agentes (read + propose, gated) |
|---|---|---|
| **Ingresos** | Stripe + planes. El webhook de Stripe **dispara el sell-report** | Vigía de ingresos (MRR, pagos fallidos, upgrades), Conciliador (pagos vs facturas) |
| **Clientes / CRM** | `moveadvisor_market_leads` + bot WhatsApp. Contactar = irreversible | Triador de leads (borradores de seguimiento), Asistente de atención |
| **Proveedores / Compras** | ERP `provider-billing`, `moveadvisor_invoice_counters` | Cuentas de proveedor (cuadre, duplicados, vencimientos) |
| **Operaciones / Talleres** | `workshop_locations`, `moveadvisor_service_requests` | Coordinador de servicio, Curador de talleres |
| **Inventario / Marketplace VO** | `moveadvisor_marketplace_vo_offers`, flujo IDCars publish | Curador de marketplace (duplicados, precios fuera de mercado vía el motor, fotos rotas) |
| **Marketing** | Meta/Google + contenido + SEO/SEM | ver §5 |

**Regla transversal:** *generar* contenido/propuestas = seguro (read+propose). *Publicar,
enviar, cobrar o GASTAR* = outward/irreversible → **aprobación humana** (invariante 9.4).

---

## 5. Marketing y SEO/SEM (detalle, porque tiene una dependencia dura de ingeniería)

Se parte en dos por radio de impacto:
- **Generar** (ideas de campaña, copy, borradores de posts, ángulos) = read+propose, sin riesgo.
- **Publicar y GASTAR** en Meta/Google Ads = misma sala blindada que Ingresos, con aprobación
  previa por lanzamiento y presupuesto.

**Dependencia dura (ingeniería, sala Web) — el mayor lever de SEO NO es un agente:**
la web pública es un **CRA (SPA)**: HTML inicial vacío, meta/OG por página pobres, sin SSR.
Para un marketplace de VO que vive del long-tail, es un handicap estructural. **Antes de que
ningún agente de SEO aporte**, hay que:
- Resolver indexabilidad: **SSR/SSG (Next.js) o prerender**, meta/OG por página, datos
  estructurados (schema.org `Vehicle`/`Product`), sitemap, **URLs slug** (hoy son ids feos:
  `/marketplace-vo/as_8d16f9ad-…`; el mockup ya definió `slugAnuncio`, falta cablearlo).
- Instrumentar para medir el lanzamiento: **Meta CAPI server-side** (hoy solo hay pixel
  client-side en `src/utils/metaPixel.js`), Search Console, GA.

**Arma orgánica más grande: SEO programático.** Con `moveadvisor_market_offers` (400k+) +
catálogo + provincias + el motor de precios se generan **miles de páginas long-tail**
respaldadas por inventario real. Requiere el SSR de arriba.

**Agentes de marketing:**
- *Analista de embudo* (solo lectura): por qué no convierte, ROAS real por campaña cruzando
  Meta/Google × UTM × conversiones. Vigía en el parte matinal.
- *Generador de campañas/contenido* (read+propose): anuncios, posts, páginas SEO, on-brand
  (ámbar `#BA7517`, teal `#137370`, Inter/DM Sans). Publicar/gastar = aprobación.

**DECISIÓN ABIERTA que condiciona toda la capa SEO:** ¿migrar la web pública a **SSR (Next.js)**
o quedarse en CRA con prerender? (ver §10).

---

## 6. Jarvis (el asistente)

Servicio pequeño + bot (Telegram/WhatsApp):
- **Parte matinal** (cron Trigger.dev): KPIs (leads, registros, valoraciones, coste en tokens),
  salud del pipeline (frescura por portal), estado de deploys/errores. *El prototipo de este
  parte ya se generó con datos reales; su primer sensor (frescura por portal) ya está probado.*
- **Preguntas del negocio** → tools de SQL de **solo lectura** (un salto, número exacto).
- **"Ve y averigua X"** → delega en el Explorador (solo lectura) y resume.
- **Borradores** de correo/búsquedas → enviar lo apruebas tú.
- **Voz (opcional, capa encima):** nota de voz → STT (Whisper/OpenAI/Deepgram) → cerebro →
  respuesta → TTS (ElevenLabs/OpenAI) → nota de voz. No cambia el modelo de seguridad (solo I/O).

---

## 7. La Oficina (el escaparate) — AL FINAL

Dashboard web donde **cada píxel mapea a una fila real** (no una simulación):
- Barra superior: los 4 KPIs.
- Planta con **4 salas = 4 runtimes** (Precios/Backend/Web/Cuarentena; luego la segunda ala),
  con los agentes y su estado real (idle / corriendo / **esperando aprobación**) leído de
  `tasks` + Langfuse.
- Tira de salud del pipeline (frescura por portal).
- Bandeja de aprobaciones (la puerta humana).
- Feed de actividad = la tabla `tasks` en vivo.
- Piel isométrica opcional por encima; debajo, siempre estado real.

**Ojo:** organizar por **runtimes**, NO por "departamentos-persona" (eso es el antipatrón que
se descartó). Se construye al final porque es la *visualización* de lo que ya existe; si se hace
primero, es una simulación que miente.

---

## 8. Plan paso a paso (fases)

### Fase 0 — Cimientos (antes de diseñar NADA de agentes)
0. **Auditoría de secretos en git** — HECHO: `.env.local`/Neon **no están** en el historial de
   ninguno de los dos repos; solo en disco. Rotación = higiene, no emergencia.
1. **Rotar secretos** y sacarlos del árbol de trabajo. Riesgo real: `.env.local` conviviendo
   con agentes que leen input hostil. (Manos de Ana.)
2. **PR del gate golden en CI:** meter `node scripts/golden-tests/run.js` en
   `.github/workflows/backend-validation.yml` + `npm run test:golden`. **Es el mayor lever del
   plan** (activa el invariante 9.1; el runner ya sale `exit(1)`).
3. **Rol `carswise_readonly` en Neon** + segunda connection string. Cimiento de TODOS los agentes.
   (El rol es **para los agentes**; la app sigue como `neondb_owner` de momento — no mezclar.)
4. **Diagnóstico de n8n** — HECHO: solo 5/29 workflows tienen error handler y la key de Resend
   es placeholder. El modo de fallo real es **éxito parcial silencioso** (131 `continueOnFail`):
   un scraper que devuelve 0 filas NO genera error. La detección que importa es **cron-SQL de
   frescura**, no `n8n.workflow_failed`.

### Fase 1 — Andamiaje + primer valor visible
5. **Runtime de agentes** (Claude Agent SDK): `maxTurns`, tope de presupuesto, trazas Langfuse.
6. **Explorador** (solo lectura) — el agente más seguro; sobre él se prueba el andamiaje.
7. **Jarvis-lite:** el parte matinal (SQL read-only) entregado por Telegram. **Aquí ya "tienes"
   a Jarvis monitorizando CarsWise.** (Falta: crear bot con @BotFather → token.)
8. **Emisor de eventos:** un workflow central de n8n que en fallo **inserte fila en `tasks`**
   (no email) + el **cron-SQL de frescura** que inserta alertas de portal muerto. Ahora el
   dispatcher tiene fuente real.

### Fase 2 — Precios (el core del valor)
9. **Cablear los alias al motor** (ver §hallazgos: hoy están muertos), crear `enrichment_proposals`,
   y estrenar **Verificador golden** + **Arqueólogo** detrás del gate.

### Fase 3 — Resto
10. Triador de errores (cuando haya Sentry/eventos), Lector + runtime de cuarentena, Trigger.dev,
    y **uptime EXTERNO** (fuera del mini PC).

### Fase 4 — Negocio/Monetización + Marketing/SEO
11. Vigías de solo lectura (Ingresos, CRM, Proveedores, Talleres, Marketing) en el parte matinal.
12. SEO técnico (SSR/slug/meta/structured data) — **prerrequisito de ingeniería** para marketing.
13. Ascender vigías a "proponen" con Juan/tú como puerta de aprobación.

### Fase 5 — La Oficina visual
14. Dashboard sobre `tasks` + Langfuse, 4 salas = 4 runtimes. La guinda.

**Primer paso concreto:** el PR del gate golden (Fase 0.2). Cero infra nueva, protege la joya.

---

## 9. Invariantes que NO se negocian

1. **Ningún agente hace UPDATE sobre datos que alimentan el motor de precios.** Escribe a
   `enrichment_proposals` (valor, fuente, confianza, timestamp). El merge a producción solo si
   pasan los golden tests.
2. **El runtime que procesa contenido de terceros NO lleva credenciales.** Lectores primero,
   agentes con llaves después, **nunca el mismo**.
3. **Rol de Postgres de solo lectura (`carswise_readonly`) para los agentes.** Nunca la
   `DATABASE_URL` de `neondb_owner`. La service key de Supabase **no sale del backend de Storage**.
4. **Nada irreversible sin aprobación humana:** enviar correos, mergear a main, escribir en
   producción, contactar clientes, **cobrar o gastar en publicidad**.
5. **`maxTurns` y tope de presupuesto** en cada ejecución.
6. **Backups automáticos de BD y Storage antes de cualquier agente.** (Neon tiene PITR/branching
   — se puede branchear la DB para sandboxes de agente. Supabase Storage necesita backup aparte.)
7. **La monitorización de uptime NO vive en el mini PC.** Hoy n8n + pm2 + verify-liveness viven
   todos ahí → **ticket abierto**, no principio cumplido.

---

## 10. Hallazgos concretos ya detectados (deuda/bugs que arreglar)

- **Alias muertos (posible victoria más barata del roadmap de precios):**
  `resolveBrandWithAliases` / `resolveModelWithAliases` (`lib/inventoryStore.js`) están
  **exportadas y sin llamar**; `getMarketPriceSnapshot` filtra por el token de marca **en crudo**.
  El defecto "filtro de pool de marca sin resolver" del roadmap puede NO ser un bug de lógica,
  sino una capa nunca cableada. **Verificar esto antes que nada del roadmap de precios.**
- **IDCars — carga de documentación falla:** `express.json({ limit: '4mb' })` vs ficheros en
  **base64 (+33%)** → cualquier archivo >~3MB da 413. Además, si Supabase no está configurado,
  las fotos caen a base64-en-DB con `file_url=''` y al **publicar** la oferta sale **sin fotos**.
- **cochesnet muerto ~1 mes:** workflow activo, 0 filas nuevas desde 02-07, 0 errores (fallo
  silencioso). Arreglar o retirar.
- **Claves de portal duplicadas:** `coches.com`/`coches.net` (basura, ~pocas filas) vs
  `cochescom`/`cochesnet` (canónicas). Normalizar.
- **Golden tests no están en CI** (Fase 0.2).
- **Secretos en `.env.local` en disco** (rotar, Fase 0.1).
- **CRA = handicap de SEO** + **URLs feas** (ids en vez de slugs). Ver §5.
- **`moveadvisor_user_valuations` a 0 total** — o el motor no escribe ahí o no hay informes de
  pago aún (pre-lanzamiento). Verificar cuando se lance.

---

## 11. Decisiones abiertas (pendientes de Ana)

1. **SSR:** ¿migrar la web pública a **Next.js (SSR/SSG)** o quedarse en CRA con prerender?
   Condiciona toda la capa de SEO programático.
2. **Canal de Jarvis:** ¿Telegram, WhatsApp, o los dos? (WhatsApp Business API ya está tocado en
   `lib/api/whatsapp-handler.js`.)
3. **Voz:** ¿se quiere desde el principio o se añade después sobre el cerebro de texto?
4. **Trigger.dev/Langfuse:** confirmar self-host en Docker sobre el mini PC (i7-8700T, sin GPU —
   todo por API, sin modelos locales).

---

## 12. Entorno de la máquina nueva (potente)

- Windows 11 → **WSL2 + Ubuntu**, repos en `~/dev/` (**nunca** en `/mnt/c/`), Node 22 LTS, pnpm,
  VS Code (Windows) con Remote-WSL, Claude Code nativo dentro de WSL.
- Trigger.dev + Langfuse + n8n en Docker.
- **La app puede seguir corriendo como `neondb_owner`; los AGENTES usan `carswise_readonly`.**
