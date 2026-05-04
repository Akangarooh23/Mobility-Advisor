# Movilidad Advisor — AI Coding Agent Session Export #2
**Platform:** GitHub Copilot (Claude Sonnet 4.6) in VS Code  
**Date:** April–May 2026  
**Project:** Movilidad Advisor — AI-powered vehicle mobility advisor (React + Node.js + SQL Server + PostgreSQL)

---

## Project Background

Movilidad Advisor uses a **dual-database inventory system**: SQL Server as primary and PostgreSQL as replica, with a local JSON file as last-resort fallback. The `inventoryStore.js` module abstracts this with a priority chain:

```
SQL Server  →  (if unavailable)  →  PostgreSQL  →  (if unavailable)  →  local JSON
```

The system had worked with a single database. After migrating to dual-DB, a subtle routing bug emerged that took several hours of debugging to identify.

---

## The Problem

### Symptom
The `/api/find-listing` endpoint appeared to work correctly in all environments — it returned results, the UI showed offers, no errors were logged. But users and the team noticed results were **stale**: vehicles that had been added to the inventory days ago were not showing up when expected.

Running a manual verification query:

```powershell
$env:INVENTORY_PROVIDER='sqlserver'; node -e "
const {listInventoryOffers} = require('./lib/inventoryStore');
(async () => {
  const r = await listInventoryOffers({ desiredType: 'compra', modelCandidates: [], limit: 5000 });
  console.log('sqlserver-totalUniverse=', r.totalUniverse, 'offersReturned=', r.offers.length);
  console.log('sample=', r.offers.slice(0, 5).map(o => o.url));
})();
"
```

With `INVENTORY_PROVIDER=sqlserver` forced explicitly, the correct up-to-date offers appeared. Without it, the stale results returned. Something in the auto-detection was broken.

---

## Root Cause Investigation

### Step 1 — Trace the provider resolution path

The agent read `lib/inventoryStore.js` and traced `getEnvValue()`:

```js
function getEnvValue(key) {
  const fromProcess = normalizeText(process.env[key]);
  if (fromProcess) return fromProcess;

  const fromLocal = normalizeText(readLocalEnvFallback()[key]);
  return fromLocal;
}
```

```js
function readLocalEnvFallback() {
  // reads .env.local and .env from project root
  // caches result in cachedLocalEnv
  ...
}
```

**Finding:** The `getEnvValue` function reads from `process.env` first, then falls back to a manual parse of `.env.local`. The function cached the parsed env file in memory (`cachedLocalEnv`). This was the first suspect.

### Step 2 — Check when the cache is populated

The cache (`cachedLocalEnv`) was populated on the first call to `readLocalEnvFallback()`. In Vercel serverless functions, each invocation can be a cold start, so this was not the issue in production. But in the local dev server (`local-api-server.js`), the process was long-lived — and the cache was populated at first request.

**The problem:** The `.env.local` file had been updated to add `SQL_SERVER_*` credentials, but the long-running `local-api-server.js` process had read and cached an older version of the file before those keys existed. Subsequent requests used the stale cache and never found the SQL Server credentials.

The provider selection logic then silently fell through:

```
SQL Server credentials not found in cached env
  → try PostgreSQL credentials … also not found in cache
    → fall back to local data/inventory-offers.json
      → returns stale local JSON with 37 offers from weeks ago
```

No error was thrown. The function returned valid results. The bug was invisible.

### Step 3 — Confirm with a side-by-side test

```powershell
# Without explicit override (uses long-running process with stale cache)
node -e "
  const payload = { result: { solucion_principal: { titulo: 'Fiat 500', marca: 'Fiat', modelo: '500' } },
    answers: { modelo_objetivo: 'Fiat 500', presupuesto_max: 25000, tipo_operacion: 'compra' }, filters: {} };
  fetch('http://127.0.0.1:3001/api/find-listing', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload) }).then(r => r.json())
    .then(d => console.log('listings:', d.listings?.length, 'universe:', d.universe, 'source:', d.source))
    .catch(e => console.error(e.message))
"
# Output: listings: 1  universe: 37  source: local-json
```

```powershell
# After restarting local-api-server (fresh process reads updated .env.local)
# Output: listings: 4  universe: 42  source: sqlserver
```

The `source` field in the response confirmed the data origin. `universe: 37` vs `universe: 42` was the smoking gun — 37 was the stale local JSON count, 42 was the current SQL Server count.

---

## The Fix

### Fix 1 — Invalidate env cache on file change (development)

The environment cache was made invalidatable in development mode:

```js
function readLocalEnvFallback(forceRefresh = false) {
  if (cachedLocalEnv && !forceRefresh) {
    return cachedLocalEnv;
  }
  // ... parse .env.local and .env
  cachedLocalEnv = values;
  return cachedLocalEnv;
}
```

And the local dev server was updated to call `readLocalEnvFallback(true)` on each new request in development, bypassing the cache:

```js
// local-api-server.js
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    // invalidate env cache so credential changes are picked up immediately
    readLocalEnvFallback(true);
  }
  next();
});
```

### Fix 2 — Add source telemetry to all inventory responses

The `listInventoryOffers` return value was already including a `source` field, but it wasn't being logged or surfaced clearly in the API response. The agent made this explicit so the data source is always visible in `/api/find-listing` responses:

```js
// api/find-listing.js — added to response envelope
return res.json({
  listings,
  universe: totalUniverse,
  source: inventoryResult.source,   // 'sqlserver' | 'postgres' | 'local-json'
  // ...
});
```

This meant that any future silent fallback would be immediately visible in the browser network tab or logs — without needing a manual debug session.

### Fix 3 — Add explicit health check for credentials at startup

A startup check was added to `local-api-server.js` to verify database credentials are resolved correctly and log a warning if the system falls back to local JSON:

```js
async function checkInventoryHealth() {
  const { listInventoryOffers } = require('./lib/inventoryStore');
  const probe = await listInventoryOffers({ desiredType: 'compra', modelCandidates: [], limit: 1 });
  if (probe.source === 'local-json') {
    console.warn('[WARNING] inventoryStore is using LOCAL JSON fallback — DB credentials may be missing or stale.');
    console.warn('  Expected sources: sqlserver, postgres');
    console.warn('  Check .env.local for SQL_SERVER_* or DATABASE_URL variables.');
  } else {
    console.log(`[OK] inventoryStore source: ${probe.source} | universe: ${probe.totalUniverse} offers`);
  }
}
checkInventoryHealth();
```

---

## Why This Bug Was Hard to Find

1. **No error was thrown.** The fallback chain was designed to be graceful — which is correct for production resilience, but made local dev bugs invisible.

2. **Results looked valid.** The local JSON file had real offers from a previous sync. Results came back with correct structure, prices, and URLs. There was no obvious signal that anything was wrong.

3. **The stale cache only manifested in long-running processes.** In Vercel (serverless), each function is a fresh process, so credentials were always read fresh. The bug only existed locally — which is where development and testing happened.

4. **The `source` field existed but wasn't surfaced clearly.** The data source was tracked internally but wasn't visible in the UI or logs by default.

---

## Result

After the fix:

```
[OK] inventoryStore source: sqlserver | universe: 42 offers

# Fiat 500 test
listings: 4  universe: 42  source: sqlserver  top: Fiat 500 1.0 Hybrid 70CV

# Audi A3 test  
listings: 3  universe: 42  source: sqlserver  top: Audi A3 Sportback 35 TDI 150CV

# Seat Leon test
listings: 5  universe: 42  source: sqlserver  top: Seat Leon 1.5 eTSI 150CV DSG
```

All three vehicles that had been failing (showing stale 0–1 results from local JSON) now returned correct results from the live SQL Server inventory.

The migration parity check was re-run to confirm both databases were in sync:

```
npm run migrate:sqlserver-to-postgres

✓ SQL Server → Postgres migration OK
  sqlserver: 42  postgres: 42  missing: 0  extra: 0
```

---

## Files Modified

| File | Change |
|------|--------|
| `lib/inventoryStore.js` | `readLocalEnvFallback` accepts `forceRefresh` param; cache invalidated in dev |
| `local-api-server.js` | Added startup health check; per-request cache invalidation in dev mode |
| `api/find-listing.js` | `source` field surfaced in all response envelopes |

---

## What This Session Demonstrates

- **Silent failure diagnosis** — The bug produced no errors and valid-looking output. Finding it required building a mental model of the full data path and designing a targeted probe (`universe` count comparison) to distinguish data sources.
- **Environment-specific reasoning** — The bug only manifested in long-running local processes, not in production serverless. The agent correctly isolated this as the distinguishing factor.
- **Fix with observability first** — Rather than just patching the cache, the fix also added startup health checks and response telemetry so the same class of bug would be catch-able immediately in the future.
- **Multi-process, multi-database stack** — The session required reasoning across env file parsing, env caching, dual-DB connection routing, API response structure, and the React frontend's interpretation of results simultaneously.
