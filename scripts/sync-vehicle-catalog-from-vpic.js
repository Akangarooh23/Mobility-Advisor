/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = path.join(__dirname, "..", "data", "vehicle-catalog.json");
const BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles";
const CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 15000;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "MoveAdvisorCatalogSync/1.0",
      },
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const rawText = await response.text();

    if (!contentType.includes("application/json")) {
      const error = new Error(`Non-JSON response from VPIC (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return JSON.parse(rawText);
  } finally {
    clearTimeout(timeout);
  }
}

async function retryJson(url, attempts = 6) {
  let lastError = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const backoffMs = status === 403 ? 1800 * (i + 1) : 350 * (i + 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  const error = lastError || new Error("Unknown fetch error");
  error.url = url;
  throw error;
}

function sortUnique(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}

async function getPassengerCarMakes() {
  const payload = await retryJson(`${BASE_URL}/GetMakesForVehicleType/car?format=json`);

  const makeRows = Array.isArray(payload?.Results)
    ? payload.Results
        .map((item) => ({
          id: Number(item?.MakeId),
          name: normalizeText(item?.MakeName),
        }))
        .filter((item) => item.name && Number.isFinite(item.id) && item.id > 0)
    : [];

  const dedup = new Map();
  for (const item of makeRows) {
    if (!dedup.has(item.name)) {
      dedup.set(item.name, item);
    }
  }

  return Array.from(dedup.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

async function getModelsForMake(makeId, makeName) {
  const payloadById = await retryJson(`${BASE_URL}/GetModelsForMakeId/${encodeURIComponent(String(makeId))}?format=json`);

  let models = Array.isArray(payloadById?.Results)
    ? payloadById.Results
        .map((item) => normalizeText(item?.Model_Name || item?.ModelName || item?.Model))
        .filter(Boolean)
    : [];

  if (models.length === 0 && makeName) {
    const encodedMake = encodeURIComponent(makeName);
    const payloadByName = await retryJson(`${BASE_URL}/GetModelsForMake/${encodedMake}?format=json`);
    models = Array.isArray(payloadByName?.Results)
      ? payloadByName.Results
          .map((item) => normalizeText(item?.Model_Name || item?.ModelName || item?.Model))
          .filter(Boolean)
      : [];
  }

  return sortUnique(models);
}

async function runQueue(items, worker, concurrency = 6) {
  const results = [];
  const queue = [...items];

  async function consume() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const result = await worker(item);
      results.push(result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
  return results;
}

async function main() {
  console.log("Fetching makes for vehicle type 'car'...");
  const makes = await getPassengerCarMakes();
  console.log(`Makes found: ${makes.length}`);

  const catalog = {};
  let processed = 0;
  const failedMakes = [];

  await runQueue(
    makes,
    async (make) => {
      try {
        const models = await getModelsForMake(make.id, make.name);
        if (models.length > 0) {
          catalog[make.name] = models;
        }
      } catch (error) {
        failedMakes.push({ makeName: make.name, error: error?.message || "Unknown error" });
      }

      processed += 1;
      if (processed % 20 === 0 || processed === makes.length) {
        console.log(`Progress: ${processed}/${makes.length} makes processed`);
      }

      return make.name;
    },
    CONCURRENCY
  );

  const sortedCatalog = Object.keys(catalog)
    .sort((a, b) => a.localeCompare(b, "es"))
    .reduce((acc, brandName) => {
      acc[brandName] = sortUnique(catalog[brandName]);
      return acc;
    }, {});

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(sortedCatalog, null, 2)}\n`, "utf8");

  const totalModels = Object.values(sortedCatalog).reduce((sum, models) => sum + models.length, 0);
  console.log(`Catalog written: ${OUTPUT_PATH}`);
  console.log(`Brands: ${Object.keys(sortedCatalog).length}`);
  console.log(`Models: ${totalModels}`);
  if (failedMakes.length > 0) {
    console.log(`Failed makes: ${failedMakes.length}`);
    failedMakes.slice(0, 20).forEach((item) => {
      console.log(`- ${item.makeName}: ${item.error}`);
    });
  }
}

main().catch((error) => {
  console.error("Catalog sync failed:", error?.message || error);
  process.exit(1);
});
