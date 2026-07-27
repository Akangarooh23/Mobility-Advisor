#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INVENTORY_PATH = path.join(ROOT, "data", "inventory-offers.json");
const SRC_CATALOG_PATH = path.join(ROOT, "src", "data", "vehicle-catalog.json");
const DATA_CATALOG_PATH = path.join(ROOT, "data", "vehicle-catalog.json");

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function foldKey(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function readJsonFile(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function coerceOffers(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.offers)) {
    return payload.offers;
  }

  if (payload && typeof payload === "object") {
    return Object.values(payload).flat().filter((item) => item && typeof item === "object");
  }

  return [];
}

function buildCatalogMap(inputCatalog) {
  const map = new Map();
  const brandCaseMap = new Map();

  const source = inputCatalog && typeof inputCatalog === "object" && !Array.isArray(inputCatalog)
    ? inputCatalog
    : {};

  for (const [brandRaw, modelsRaw] of Object.entries(source)) {
    const brand = normalizeText(brandRaw);
    if (!brand) {
      continue;
    }

    const brandKey = foldKey(brand);
    if (!brandCaseMap.has(brandKey)) {
      brandCaseMap.set(brandKey, brand);
    }

    if (!map.has(brandKey)) {
      map.set(brandKey, new Map());
    }

    const brandModels = map.get(brandKey);
    const models = Array.isArray(modelsRaw) ? modelsRaw : [];

    for (const modelRaw of models) {
      const model = normalizeText(modelRaw);
      if (!model) {
        continue;
      }

      const modelKey = foldKey(model);
      if (!brandModels.has(modelKey)) {
        brandModels.set(modelKey, model);
      }
    }
  }

  return { map, brandCaseMap };
}

function mergeCatalogs(catalogObjects) {
  const mergedMap = new Map();
  const mergedBrandCaseMap = new Map();

  for (const catalogObject of catalogObjects) {
    const { map, brandCaseMap } = buildCatalogMap(catalogObject);

    for (const [brandKey, brandName] of brandCaseMap.entries()) {
      if (!mergedBrandCaseMap.has(brandKey)) {
        mergedBrandCaseMap.set(brandKey, brandName);
      }
    }

    for (const [brandKey, modelsMap] of map.entries()) {
      if (!mergedMap.has(brandKey)) {
        mergedMap.set(brandKey, new Map());
      }

      const targetModelsMap = mergedMap.get(brandKey);
      for (const [modelKey, modelName] of modelsMap.entries()) {
        if (!targetModelsMap.has(modelKey)) {
          targetModelsMap.set(modelKey, modelName);
        }
      }
    }
  }

  return { mergedMap, mergedBrandCaseMap };
}

function catalogMapToObject(brandCaseMap, catalogMap) {
  const brandRows = Array.from(catalogMap.entries()).map(([brandKey, modelsMap]) => {
    const brandName = brandCaseMap.get(brandKey) || brandKey;
    const models = Array.from(modelsMap.values()).sort((a, b) => a.localeCompare(b, "es"));
    return { brandName, models };
  });

  brandRows.sort((a, b) => a.brandName.localeCompare(b.brandName, "es"));

  return brandRows.reduce((acc, row) => {
    acc[row.brandName] = row.models;
    return acc;
  }, {});
}

function main() {
  const inventoryPayload = readJsonFile(INVENTORY_PATH, []);
  const inventoryOffers = coerceOffers(inventoryPayload);

  const srcCatalog = readJsonFile(SRC_CATALOG_PATH, {});
  const dataCatalog = readJsonFile(DATA_CATALOG_PATH, {});
  const { mergedMap, mergedBrandCaseMap } = mergeCatalogs([srcCatalog, dataCatalog]);

  const addedBrands = new Set();
  const addedModelsByBrand = new Map();

  for (const offer of inventoryOffers) {
    const offerBrand = normalizeText(offer?.brand || offer?.Brand);
    const offerModel = normalizeText(offer?.model || offer?.Model);

    if (!offerBrand || !offerModel) {
      continue;
    }

    const brandKey = foldKey(offerBrand);
    const modelKey = foldKey(offerModel);

    if (!mergedBrandCaseMap.has(brandKey)) {
      mergedBrandCaseMap.set(brandKey, offerBrand);
      addedBrands.add(offerBrand);
    }

    if (!mergedMap.has(brandKey)) {
      mergedMap.set(brandKey, new Map());
    }

    const brandModelsMap = mergedMap.get(brandKey);
    if (!brandModelsMap.has(modelKey)) {
      brandModelsMap.set(modelKey, offerModel);
      const displayBrand = mergedBrandCaseMap.get(brandKey) || offerBrand;
      if (!addedModelsByBrand.has(displayBrand)) {
        addedModelsByBrand.set(displayBrand, []);
      }
      addedModelsByBrand.get(displayBrand).push(offerModel);
    }
  }

  const nextCatalogObject = catalogMapToObject(mergedBrandCaseMap, mergedMap);

  const totalAddedModels = Array.from(addedModelsByBrand.values()).reduce((sum, list) => sum + list.length, 0);
  const totalBrands = Object.keys(nextCatalogObject).length;
  const totalModels = Object.values(nextCatalogObject).reduce((sum, models) => sum + models.length, 0);

  console.log("Catalog sync from offers");
  console.log(`- Offers processed: ${inventoryOffers.length}`);
  console.log(`- Brands in catalog: ${totalBrands}`);
  console.log(`- Models in catalog: ${totalModels}`);
  console.log(`- New brands added: ${addedBrands.size}`);
  console.log(`- New models added: ${totalAddedModels}`);

  if (addedModelsByBrand.size > 0) {
    const topBrands = Array.from(addedModelsByBrand.entries())
      .map(([brand, models]) => ({ brand, count: models.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    console.log("- Top brands with new models:");
    for (const item of topBrands) {
      console.log(`  * ${item.brand}: ${item.count}`);
    }
  }

  if (!shouldWrite) {
    console.log("Dry run complete. Re-run with --write to update catalog files.");
    return;
  }

  writeJsonFile(SRC_CATALOG_PATH, nextCatalogObject);
  writeJsonFile(DATA_CATALOG_PATH, nextCatalogObject);

  console.log("Catalog files updated:");
  console.log(`- ${SRC_CATALOG_PATH}`);
  console.log(`- ${DATA_CATALOG_PATH}`);
}

main();
