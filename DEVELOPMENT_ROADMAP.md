# Mobility Advisor: Hoja de Ruta de Desarrollo
## Scraping Offline, Inventario Centralizado y Selección por IA

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Objetivo:** Migración desde scraping live a modelo híbrido con inventario offline y ranking determinista + IA

---

## 1. Resumen Ejecutivo

### Problem Statement
El scraping live actual en `api/find-listing.js` es frágil:
- HTML variable por portal
- Antibot y bloqueos frecuentes
- Tiempos de respuesta inconsistentes
- Poca trazabilidad de por qué falla una búsqueda
- No captura toda la cobertura del mercado

### Solución
Pipeline de separación de responsabilidades:
1. **Capa de recolección:** Scrapers dedicados por portal, off-line, ejecutados periódicamente.
2. **Capa de almacenamiento:** Base de datos de ofertas normalizadas e histórico.
3. **Capa de ranking:** Reglas deterministas + scoring clásico.
4. **Capa de IA:** Selección inteligente y explicación sobre inventario consolidado.
5. **Capa de servicio:** Endpoints ligeros en Vercel que consultan el inventario.

### Beneficios
- Mayor cobertura y estabilidad
- Mejor trazabilidad
- Menor latencia para el usuario
- IA enfocada en priorización, no en búsqueda
- Posibilidad de auditar y mejorar continuamente

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│           Vercel (gratis)/Netlify                        │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────────────┐
│          Backend Ligero (Node.js) - Vercel              │
│  • /api/inventory: consulta base de ofertas             │
│  • /api/select: ranking + IA sobre inventario           │
│  • /api/analyze: análisis y recomendación               │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐    ┌──────▼────────────┐
│  PostgreSQL    │    │  Python Scrapers  │
│  (Supabase/    │    │  (VPS/Heroku/    │
│   Neon)        │    │   Railway/cron)   │
└────────────────┘    └───────────────────┘
        ▲                      │
        │       Escribe cada   │
        │       6-12 horas     │
        └──────────────────────┘
```

---

## 3. Modelo de Datos

### Tablas Principales

#### `offers` (tabla principal de ofertas normalizadas)
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación y trazabilidad
  portal VARCHAR(50) NOT NULL,           -- coches.net, autoscout24, etc.
  original_url TEXT UNIQUE NOT NULL,     -- URL única del anuncio
  portal_id VARCHAR(100),                -- ID del anuncio en el portal
  content_hash VARCHAR(64),              -- Hash del contenido para deduplicación
  
  -- Información del vehículo
  marca VARCHAR(50),
  modelo VARCHAR(100),
  version VARCHAR(150),
  año INT,
  km INT,
  combustible VARCHAR(30),               -- gasolina, diesel, hibrido, electrico, etc.
  transmision VARCHAR(30),               -- manual, automatico
  puertas INT,
  plazas INT,
  
  -- Pricing
  precio_compra DECIMAL(10,2),
  precio_cuota_mensual DECIMAL(8,2),     -- Si es financiado
  precio_alquiler_mensual DECIMAL(8,2),  -- Si es renting
  
  -- Ubicación y contexto
  provincia VARCHAR(50),
  ciudad VARCHAR(100),
  
  -- Imágenes y multimedia
  imagen_principal_url TEXT,
  imagenes_count INT DEFAULT 1,
  
  -- Contexto de venta
  tipo_vendedor VARCHAR(30),             -- particular, profesional, concesionario
  dias_activo INT,
  
  -- Temporal
  fecha_scrape TIMESTAMP DEFAULT NOW(),
  fecha_ultima_actualizacion TIMESTAMP DEFAULT NOW(),
  fecha_ultima_vista TIMESTAMP DEFAULT NOW(),
  
  -- Validación y calidad
  es_valida BOOLEAN DEFAULT true,
  motivo_invalida VARCHAR(255),
  
  -- Índices para búsqueda
  INDEX idx_portal (portal),
  INDEX idx_marca_modelo (marca, modelo),
  INDEX idx_precio (precio_compra),
  INDEX idx_fecha_scrape (fecha_scrape),
  INDEX idx_content_hash (content_hash)
);
```

#### `offer_history` (histórico de cambios)
```sql
CREATE TABLE offer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL,
  
  -- Campo que cambió
  campo_cambiado VARCHAR(50),
  valor_anterior TEXT,
  valor_nuevo TEXT,
  
  -- Temporal
  fecha_cambio TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  INDEX idx_offer_id (offer_id),
  INDEX idx_fecha (fecha_cambio)
);
```

#### `scraping_logs` (trazabilidad de ejecuciones)
```sql
CREATE TABLE scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ejecución
  portal VARCHAR(50),
  fecha_inicio TIMESTAMP DEFAULT NOW(),
  fecha_fin TIMESTAMP,
  
  -- Resultados
  total_paginas_visitadas INT,
  total_ofertas_encontradas INT,
  total_ofertas_guardadas INT,
  total_errores INT,
  
  -- Calidad
  tasa_exito DECIMAL(5,2),
  
  -- Diagnóstico
  bloqueado BOOLEAN DEFAULT false,
  error_mensaje TEXT,
  
  INDEX idx_portal (portal),
  INDEX idx_fecha (fecha_inicio)
);
```

#### `portal_config` (configuración por portal)
```sql
CREATE TABLE portal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Portal
  nombre VARCHAR(50) UNIQUE NOT NULL,
  url_base TEXT NOT NULL,
  
  -- Scraping
  frequency_hours INT DEFAULT 12,        -- Cada cuántas horas scrapear
  max_offers_per_run INT DEFAULT 500,
  timeout_seconds INT DEFAULT 30,
  
  -- Selectors y parsers
  selector_offer_card VARCHAR(255),
  selector_title VARCHAR(255),
  selector_price VARCHAR(255),
  selector_image VARCHAR(255),
  parser_type VARCHAR(50),               -- htmlparse, playwright, json-ld
  
  -- Trust score
  trust_score DECIMAL(3,2),              -- 0.0 a 1.0
  
  -- Control
  activo BOOLEAN DEFAULT true,
  
  UNIQUE KEY unique_portal (nombre)
);
```

---

## 4. Stack Tecnológico Recomendado

### Frontend (Vercel gratis)
- **React (CRA actual)** - sin cambios
- **Vercel** - hosting estático + edge functions
- **Coste:** $0 gratis

### Backend (Vercel + node.js)
- **Node.js + Express** - APIs ligeras de consulta/ranking
- **Vercel Serverless** - hosting de funciones
- **Coste:** $0 gratis (dentro de límites)

### Base de Datos
- **PostgreSQL** (Supabase o Neon)
- **Opción 1: Neon** - free tier 0.5 GB, $15/mes con generoso
- **Opción 2: Supabase** - free tier generoso, $25/mes producción
- **Coste:** $0-25/mes

### Scraping
- **Python 3.11+** con:
  - `Scrapy` - framework base
  - `Playwright` - navegador automatizado para JS-heavy
  - `BeautifulSoup4` - parsing HTML ligero
  - `httpx` - cliente HTTP async
  - `psycopg2` / `asyncpg` - connectorPostgreSQL
  - `pydantic` - validación de datos

- **Hosting opciones:**
  - **Railway:** $5/mes pay-as-you-go, bueno para scrapers
  - **Heroku:** sustituido, pero alternativas como **Render** $7-15/mes
  - **VPS barato:** Linode $5/mes, DigitalOcean $5/mes
  - **Cron local:** tu propia máquina si está siempre encendida

- **Orquestación:**
  - `APScheduler` para jobs periódicos en Python
  - O usar crontab en Linux + script Python

- **Coste:** $5-15/mes

### CI/CD (Opcional)
- **GitHub Actions** - gratis, integrado
- Para ejecutar jobs de scraping automáticos

### Observabilidad
- **Logs:** PostgreSQL + queries ad-hoc
- **Alertas:** email simple o Slack

---

## 5. Fases de Desarrollo

### Fase 1: Base Técnica
**Duración:** 3-5 días laborables  
**Owner:** Backend + DB setup

#### Tareas

1. **Diseño de esquema de datos**
   - Revisar y refinar modelo SQL anterior
   - Decidir: ¿Neon o Supabase?
   - Crear tablas en BD
   - Archivo: `db/schema.sql`

2. **Estructura de scrapers**
   - Crear carpeta `scrapers/` en raíz del repo
   - Estructura base:
     ```
     scrapers/
       ├── requirements.txt
       ├── config/
       │   └── portals.yaml
       ├── base_scraper.py
       ├── parsers/
       │   ├── __init__.py
       │   ├── html_parser.py
       │   └── json_ld_parser.py
       ├── portals/
       │   ├── __init__.py
       │   ├── coches_net.py
       │   ├── autoscout24.py
       │   └── ...
       ├── utils/
       │   ├── dedup.py
       │   ├── normalize.py
       │   └── db.py
       └── main.py
     ```

3. **Configuración de conectividad**
   - Archivo `.env` con `DATABASE_URL` y credenciales
   - Script `test_db_connection.py`
   - Repositorio utilities para conectarse a PostgreSQL

4. **Control de versiones**
   - Crear rama `feature/offline-scraping`
   - Commit: `"setup: database schema y base scraper structure"`

#### Entregables
- ✅ Tablas en BD funcionales
- ✅ Archivo `scrapers/base_scraper.py` base
- ✅ Conectividad a BD verificada
- ✅ Documentación de configuración BD en `README.md`

---

### Fase 2: Primer Inventario Útil
**Duración:** 4-6 días laborables  
**Owner:** Scrapers

#### Portales Prioritarios (MVP)
1. **Coches.net**
2. **AutoScout24**
3. **Flexicar**
4. **OcasionPlus**
5. **Clicars**

#### Tareas

1. **Scraper para Coches.net**
   - Archivo: `scrapers/portals/coches_net.py`
   - Responsabilidades:
     - búsqueda por marca/modelo
     - extracción de ofertas
     - normalización
     - deduplicación
     - guardado en BD
   - Flujo:
     ```python
     class CochesNetScraper(BaseScraper):
       def search(self, marca, modelo, presupuesto_max):
           # construir URL de búsqueda
           # hacer request
           # parsear HTML
           # extraer ofertas
           # normalizar
           # verificar duplicados
           # guardar en BD
           # registrar en logs
     ```

2. **Scraper para AutoScout24**
   - Similar a Coches.net pero adaptado a su estructura HTML
   - Archivo: `scrapers/portals/autoscout24.py`

3. **Scrapers para Flexicar, OcasionPlus, Clicars**
   - Patterns similares, ajustados a cada portal

4. **Parser general + normalizador**
   - Archivo: `scrapers/parsers/html_parser.py`
   - Responsabilidad: HTML → dict normalizado
   - Archivo: `scrapers/utils/normalize.py`
   - Responsabilidad: dict genérico → modelo `Offer` estructurado

5. **Deduplicación**
   - Archivo: `scrapers/utils/dedup.py`
   - Estrategia:
     - Hash de content-hash
     - Búsqueda de duplicados por marca/modelo/precio/km
     - Actualizar `fecha_ultima_vista` si ya existe

6. **Main orchestrator**
   - Archivo: `scrapers/main.py`
   - Responsabilidad:
     - Ejecutar scrapers secuencialmente o en paralelo
     - Registrar logs
     - Incrementar fecha_ultima_actualizacion
     - Salida: logging de cobertura por portal

7. **Testing**
   - `scrapers/test_scrapers.py`
   - Verificar que extrae correctamente
   - Mock de respuestas HTML
   - Pruebas de normalización

#### Configuración
- Archivo `scrapers/config/portals.yaml`:
  ```yaml
  portals:
    coches_net:
      url_base: "https://www.coches.net"
      search_url: "https://www.coches.net/buscar?..."
      frequency_hours: 12
      trust_score: 0.95
      selectors:
        offer_card: "div.offerCard"
        title: "h2.title"
        price: "span.price"
    autoscout24:
      # ...
  ```

#### Entregables
- ✅ 5 scrapers funcionales
- ✅ Normalización de ofertas
- ✅ Deduplicación activa
- ✅ Logs de scraping guardados
- ✅ ≥ 1000 ofertas reales guardadas en BD
- ✅ Tests básicos pasando

---

### Fase 3: Integración con la App
**Duración:** 3-5 días laborables  
**Owner:** Backend + Frontend

#### Tareas

1. **Endpoint de consulta de inventario**
   - Archivo: `api/inventory.js`
   - Nueva ruta: `POST /api/inventory`
   - Entrada:
     ```json
     {
       "marca": "BMW",
       "modelo": "X1",
       "presupuesto_max": 700,
       "combustible": ["diesel", "hibrido"],
       "tipo": "compra",
       "limit": 50
     }
     ```
   - Salida:
     ```json
     {
       "total": 245,
       "ofertas": [...],
       "fuentes": { "coches_net": 89, "autoscout24": 156, ... }
     }
     ```
   - Lógica:
     - Consulta BD con filtros
     - Ordena por fecha_scrape DESC (más frescos primero)
     - Limita a ofertas válidas (`es_valida = true`)

2. **Endpoint de cobertura del inventario**
   - Archivo: `api/inventory-coverage.js`
   - Nueva ruta: `GET /api/inventory-coverage?marca=BMW&modelo=X1`
   - Responde:
     ```json
     {
       "marca": "BMW",
       "modelo": "X1",
       "total_ofertas": 245,
       "edad_promedio_horas": 6.5,
       "portales": {
         "coches_net": { "count": 89, "edad_horas": 5 },
         "autoscout24": { "count": 156, "edad_horas": 7 }
       },
       "frescura": "verde"  // verde/amarillo/rojo
     }
     ```

3. **Fallback a scraping live**
   - Si cobertura < 5 ofertas, entonces:
     - Ejecutar scraping live (actual)
     - Complementar resultados
   - Archivo: `api/find-listing.js` (mantener, usar como fallback)
   - Lógica en `api/inventory.js`:
     ```javascript
     if (results.length < MIN_COVERAGE) {
       const liveResults = await findListing(req, res);
       results = [...results, ...liveResults];
     }
     ```

4. **Integración en App.js**
   - Cambiar flujo de análisis para:
     - Llamar primero a `/api/inventory`
     - Si respuesta válida, usarla
     - Si no, fallback a scraping live

5. **Actualizar tests**
   - `src/App.test.js` - tests de inventario
   - `scripts/find-listing-ranking-local.js` - adaptar para inventario local

#### Entregables
- ✅ `/api/inventory` funcionando
- ✅ `/api/inventory-coverage` funcionando
- ✅ App consulta inventario primero
- ✅ Fallback live integrado
- ✅ Tests actualizados
- ✅ No degradación de UX

---

### Fase 4: Ranking + IA
**Duración:** 4-6 días laborables  
**Owner:** Backend + IA

#### Tareas

1. **Ranking determinista mejorado**
   - Archivo: `api/ranking-engine.js`
   - Responsabilidades:
     - Filtros duros: presupuesto, combustible, tipo de uso
     - Score por portal (confiabilidad)
     - Score de coherencia: marca/modelo/año/km/precio
     - Score de encaje con perfil del usuario
   - Output: ofertas ordenadas por score

2. **Clase Offer normalizada**
   - Archivo: `lib/Offer.js`
   - Métodos:
     - `isCoherent()` - chequea coherencia km/año/precio
     - `scoreForProfile(profile)` - score de encaje
     - `scorePortalTrust()` - confiabilidad del portal
     - `toFrontendFormat()` - serialización

3. **Motor de selección**
   - Archivo: `api/select-offers.js`
   - Nueva ruta: `POST /api/select-offers`
   - Entrada: top 10-15 ofertas del ranking
   - Output: top 3-5 recomendadas + explicación
   - Lógica:
     ```
     TOP 5 = ranking_determinista(TOP 15)
     PARA cada offer en TOP 5:
       explanation = IA.generateExplanation(offer, perfil, mercado)
     ```

4. **Integración de IA**
   - Usar endpoint de IA existente
   - Llamar con:
     ```json
     {
       "task": "explain_offer_selection",
       "profile": {...},
       "offers": [...],
       "context": "market_insights"
     }
     ```

5. **Re-ranking final**
   - Archivo: `api/analyze.js` (modificar)
   - Cambiar lógica:
     1. Consulta inventario
     2. Ranking determinista
     3. Selección por IA
     4. Explicación

#### Entregables
- ✅ Ranking determinista funcional
- ✅ Selección por IA sobre inventario
- ✅ Explicaciones claras
- ✅ No regresión en tests
- ✅ Latencia < 500ms

---

### Fase 5: Robustez y Operación
**Duración:** 1-2 semanas  
**Owner:** DevOps + Backend

#### Tareas

1. **Jobs periódicos**
   - `scrapers/scheduler.py`:
     - APScheduler para ejecutar scrapers cada 6-12 horas
     - Escalable para agregar más portales
   - Dockerfile para empaquetar
   - Deploy en Railway/Render/VPS

2. **Histórico de cambios**
   - Tracking de precio/km/stock
   - Alertas simples: "Bajó 50€", "Plus 5000km"
   - Archivo: `scrapers/utils/track_changes.py`

3. **Métricas y observabilidad**
   - Dashboard simple:
     - Ofertas totales por portal
     - Edad promedio de ofertas
     - Tasa de éxito de scraping
     - Errores últimas 24h
   - Archivo: `api/metrics.js`

4. **Logs mejorados**
   - Cada ejecución de scraper registra:
     - Ofertas encontradas vs guardadas
     - Duplicados eliminados
     - Errores específicos
     - Tiempos (inicio, fin, duración)

5. **Detección de bloqueos**
   - Monitorear respuestas 403/429
   - Actualizar proxy/headers si es necesario
   - Registrar en alerts

6. **Ampliación a más portales**
   - Agregar más portales siguiendo template:
     - Config en YAML
     - Scraper class
     - Parser específico si es necesario
   - Portales adicionales: Autoocasion, Milanuncios, Cars&Cars, Coches.com

7. **Documentación operativa**
   - Archivo: `SCRAPING_OPERATIONS.md`
   - Cómo agregar un portal nuevo
   - Cómo debugging de un scraper roto
   - Cómo escalar con más recursos
   - SLA esperado

#### Entregables
- ✅ Scrapers ejecutándose cada 6-12h
- ✅ Histórico de cambios
- ✅ Dashboard de métricas
- ✅ Documentación operativa
- ✅ Sistema estable para producción

---

## 6. Estructura de Carpetas Final

```
movilidad-advisor/
├── README.md
├── DEVELOPMENT_ROADMAP.md       (este archivo)
├── SCRAPING_OPERATIONS.md       (fase 5)
├── package.json
├── local-dev.js
├── local-api-server.js
│
├── api/                          (backends Node.js)
│   ├── analyze.js               (MODIFICADO: usa inventory)
│   ├── find-listing.js          (fallback live)
│   ├── inventory.js             (NUEVO: consulta BD)
│   ├── inventory-coverage.js    (NUEVO: cobertura)
│   ├── select-offers.js         (NUEVO: ranking + IA)
│   ├── ranking-engine.js        (NUEVO: scoring)
│   └── ...
│
├── lib/
│   ├── Offer.js                 (NUEVO: modelo normalizado)
│   └── ...
│
├── scrapers/                     (NUEVA CARPETA: scraping Python)
│   ├── requirements.txt
│   ├── main.py                  (orquestador)
│   ├── scheduler.py             (jobs periódicos)
│   ├── base_scraper.py         (clase base)
│   │
│   ├── config/
│   │   └── portals.yaml
│   │
│   ├── portals/
│   │   ├── __init__.py
│   │   ├── coches_net.py
│   │   ├── autoscout24.py
│   │   ├── flexicar.py
│   │   ├── ocasionplus.py
│   │   └── clicars.py
│   │
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── html_parser.py
│   │   └── json_ld_parser.py
│   │
│   ├── utils/
│   │   ├── db.py
│   │   ├── normalize.py
│   │   ├── dedup.py
│   │   ├── track_changes.py
│   │   └── validators.py
│   │
│   └── tests/
│       ├── test_scrapers.py
│       └── test_normalize.py
│
├── db/
│   ├── schema.sql               (NUEVO: tablas)
│   ├── seed.sql                 (opcional: datos de prueba)
│   └── migrations/              (opcional: versionado)
│
├── src/
│   ├── components/
│   ├── pages/
│   └── ...
│
└── .env.example
    (DATABASE_URL, API_KEYS, etc.)
```

---

## 7. Especificaciones Técnicas Clave

### Performance
- **Consulta de inventario:** < 100ms
- **Scraping de 1 portal:** 2-5 minutos
- **Tiempo total scraping (5 portales):** < 30 minutos
- **Frescura del inventario:** máximo 12 horas de antigüedad

### Calidad de datos
- **Tasa de validez de ofertas:** ≥ 95%
- **Tasa de duplicación encontrada:** ≥ 85%
- **Cobertura por búsqueda:** ≥ 50 ofertas válidas (MVPThen) → 200+ (full)

### Resilencia
- **Reintentos en timeout:** 3x con backoff exponencial
- **Fallback a scraping live:** si cobertura < 5 ofertas
- **Alertas en fallo:** email o Slack si scraping falla > 2 veces seguidas

---

## 8. Infraestructura de Despliegue

### Frontend
```bash
# Ya está en Vercel
# No cambios
```

### Backend Ligero
```bash
# Vercel Serverless Functions
# api/ como antes
# Actualizar functions con nuevos endpoints
```

### Scraping
**Opción A: Railway (Recomendado para MVP)**
```bash
# Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY scrapers/ .
CMD ["python", "scheduler.py"]
```
- Ccoste: $5/mes máximo
- Deploy: `git push` automático

**Opción B: Cron Local**
```bash
# En tu máquina o servidor local
# crontab -e
0 */6 * * * /usr/bin/python3 /path/to/scrapers/main.py >> /var/log/scraper.log 2>&1
```
- Coste: $0 (si tienes máquina)
- Simple pero menos robusto

### Base de Datos
**Neon (Recomendado)**
```
urlPostgreSQL: postgresql://user:pass@neon.tech/movilidad_db
Free tier: 0.5GB
Paid tier: $15/mes -> 100GB
```

---

## 9. Guía de API para Frontend

### Endpoint: `/api/inventory`
Consultar ofertas del inventario offline.

**Request:**
```json
{
  "marca": "BMW",
  "modelo": "X1",
  "presupuesto_max": 700,
  "presupuesto_min": 300,
  "combustibles": ["diesel", "hibrido"],
  "tipo_oferta": "compra",
  "provincia": "Madrid",
  "edad_maxima_horas": 24,
  "limit": 50
}
```

**Response:**
```json
{
  "total": 245,
  "ofertas": [
    {
      "id": "uuid",
      "portal": "coches.net",
      "titulo": "BMW X1 2020 Diesel",
      "url": "https://...",
      "precio": 450,
      "km": 125000,
      "año": 2020,
      "imagen": "https://...",
      "provincia": "Madrid",
      "coherencia_score": 0.95,
      "encaje_profile_score": 0.88,
      "fecha_scrape": "2026-04-18T10:30:00Z"
    }
  ],
  "cobertura": {
    "portales_consultados": 5,
    "ofertas_validas": 245,
    "edad_promedio_horas": 6.5,
    "es_fresca": true
  }
}
```

### Endpoint: `/api/select-offers`
Ranking e IA sobre inventario.

**Request:**
```json
{
  "offers_ids": ["uuid1", "uuid2", ...],  // TOP 15 del ranking
  "profile": {
    "perfil": "particular",
    "flexibilidad": "propiedad_financiada",
    "presupuesto": 600,
    "uso_km_anuales": "20k_35k",
    "entorno": "autopista"
  },
  "context": "market_insights"
}
```

**Response:**
```json
{
  "top_seleccionadas": 3,
  "recomendaciones": [
    {
      "ranking": 1,
      "offer_id": "uuid1",
      "titulo": "BMW X1 2020 Diesel",
      "razon_seleccion": "Perfecta relación km/precio/año para tu perfil. Diesel recomendado para autopista. Vendedor profesional con historial bueno.",
      "score": 0.94
    }
  ]
}
```

---

## 10. Plan de Testing

### Unit Tests
- **Normalize.py:** pruebas de conversión de datos
- **Dedup.py:** pruebas de detección de duplicados
- **Offer.js:** métodos de coherencia y scoring

### Integration Tests
- **Scraper + BD:** guardar y recuperar
- **API Inventory:** filtros y ordenamiento
- **Ranking:** scores correctos

### E2E Tests
- **Flujo completo:** scraping → BD → API → App
- **Fallback:** si BD vacía, funciona scraping live

### Test Data
- Mock HTML responses de portales
- Datos de prueba en `db/seed.sql`
- Fixtures en `scrapers/tests/fixtures/`

---

## 11. Roadmap de Rollout en Producción

### Pre-Launch
1. Setup BD en Neon
2. Deploy scrapers en Railway
3. Desplegar APIs nuevas en Vercel
4. Testing E2E en staging
5. Monitoreo de logs

### Launch (Day 1)
- Scraping inicial: cargar primer batch de ofertas
- App consulta inventario
- Monitoreo de errors

### Post-Launch (Week 1)
- Monitoreo de frescura de datos
- Ajustes en scrapers según fallos
- Feedback de usuarios

### Mejoras (Week 2-4)
- Agregar más portales
- Mejorar deduplicación
- Optimizar scoring

---

## 12. Matriz de Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|---|---|---|
| Cambio de HTML en portal | Alta | Medio | Tests de parsing, alertas rápidas |
| Bloqueos/antibot | Media | Alto | Proxies, user-agents, backoff exponencial |
| Duplicados no detectados | Media | Bajo | Mejora en hash + normalización |
| Cobertura insuficiente | Baja | Alto | Fallback a scraping live |
| BD fuera de servicio | Baja | Alto | Backups automáticos, failover |
| Scrapers colgados | Media | Medio | Timeouts, monitoreo con alertas |

---

## 13. Cronograma Estimado

| Fase | Duración | Start | End | Hitos |
|------|----------|-------|-----|-------|
| 1 | 3-5 días | Semana 1 L | Semana 1 V | BD + estructura |
| 2 | 4-6 días | Semana 2 L | Semana 2 V | 5 scrapers + inventario |
| 3 | 3-5 días | Semana 3 L | Semana 3 V | App consulta inventario |
| 4 | 4-6 días | Semana 4 L | Semana 4 V | IA + ranking |
| 5 | 7-14 días | Semana 5 L | Semana 6 V | Jobs + observabilidad |
| **Total** | **21-35 días** | - | - | **MVP estable en 3-5 semanas** |

---

## 14. Métricas de Éxito

- ✅ 300+ ofertas en BD
- ✅ Scraping ejecutándose cada 12h sin errores
- ✅ Consulta de inventario < 100ms
- ✅ Cobertura >= 50 ofertas por búsqueda
- ✅ Ranking determinista + IA funcionando
- ✅ Interfaz sin degradación
- ✅ Tests E2E estables
- ✅ Observabilidad sobre infraestructura

---

## 15. Contact & Support

Para preguntas sobre este roadmap:
- GitHub Issues con tag `scraping`
- PR reviews en rama `feature/offline-scraping`
- Docs en `/docs/` para detalles técnicos

---

**Versión:** 1.0 | **Actualizado:** Abril 2026 | **Autor:** Development Team
