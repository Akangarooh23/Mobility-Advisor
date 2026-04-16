const fs = require("fs");
const path = require("path");

const USER_VEHICLES_STORE_PATH = path.join(__dirname, "..", "db", "user-vehicles.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function ensureStoreDirectory() {
  const dirPath = path.dirname(USER_VEHICLES_STORE_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createDefaultStore() {
  return {
    vehiclesByEmail: {
      "anapicazoh@gmail.com": [
        {
          id: "garage-seed-audi-a3-sportback-s-line",
          title: "Audi A3 Sportback S line",
          brand: "Audi",
          model: "A3 Sportback S line",
          year: "",
          plate: "",
          mileage: "",
          fuel: "",
          policyCompany: "",
          notes: "Vehiculo asignado desde marketplace.",
          photos: [],
          documents: [],
          createdAt: "2026-04-17T00:00:00.000Z"
        }
      ]
    },
    updatedAt: new Date().toISOString(),
  };
}

function readStore() {
  ensureStoreDirectory();

  if (!fs.existsSync(USER_VEHICLES_STORE_PATH)) {
    return createDefaultStore();
  }

  try {
    const raw = fs.readFileSync(USER_VEHICLES_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");

    return {
      vehiclesByEmail: parsed && typeof parsed.vehiclesByEmail === "object" ? parsed.vehiclesByEmail : {},
      updatedAt: normalizeText(parsed?.updatedAt),
    };
  } catch {
    return createDefaultStore();
  }
}

function writeStore(nextStore) {
  ensureStoreDirectory();

  const safeStore = {
    vehiclesByEmail: nextStore?.vehiclesByEmail && typeof nextStore.vehiclesByEmail === "object"
      ? nextStore.vehiclesByEmail
      : {},
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(USER_VEHICLES_STORE_PATH, JSON.stringify(safeStore, null, 2));
  return safeStore;
}

function sanitizeVehicle(input = {}) {
  const photos = Array.isArray(input?.photos)
    ? input.photos.map((item) => ({
        name: normalizeText(item?.name),
        size: Number(item?.size || 0),
      })).filter((item) => item.name)
    : [];

  const documents = Array.isArray(input?.documents)
    ? input.documents.map((item) => ({
        name: normalizeText(item?.name),
        size: Number(item?.size || 0),
      })).filter((item) => item.name)
    : [];

  const brand = normalizeText(input?.brand);
  const model = normalizeText(input?.model);
  const title = normalizeText(input?.title) || `${brand} ${model}`.trim();

  return {
    id: normalizeText(input?.id),
    title,
    brand,
    model,
    year: normalizeText(input?.year),
    plate: normalizeText(input?.plate),
    mileage: normalizeText(input?.mileage),
    fuel: normalizeText(input?.fuel),
    policyCompany: normalizeText(input?.policyCompany),
    notes: normalizeText(input?.notes),
    photos: photos.slice(0, 30),
    documents: documents.slice(0, 30),
    createdAt: normalizeText(input?.createdAt) || new Date().toISOString(),
  };
}

function listVehiclesByEmail(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const store = readStore();
  const items = Array.isArray(store?.vehiclesByEmail?.[normalizedEmail])
    ? store.vehiclesByEmail[normalizedEmail]
    : [];

  return items
    .map((item) => sanitizeVehicle(item))
    .filter((item) => item.id && item.brand && item.model)
    .slice(0, 20);
}

function addVehicleByEmail(email = "", vehicle = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const store = readStore();
  const current = Array.isArray(store?.vehiclesByEmail?.[normalizedEmail])
    ? store.vehiclesByEmail[normalizedEmail].map((item) => sanitizeVehicle(item))
    : [];

  const normalizedVehicle = sanitizeVehicle(vehicle);

  if (!normalizedVehicle.brand || !normalizedVehicle.model) {
    return current.slice(0, 20);
  }

  const nextVehicle = {
    ...normalizedVehicle,
    id: normalizedVehicle.id || `garage-${Date.now()}`,
  };

  const deduped = current.filter((item) => item.id !== nextVehicle.id);
  store.vehiclesByEmail[normalizedEmail] = [nextVehicle, ...deduped].slice(0, 20);
  writeStore(store);

  return store.vehiclesByEmail[normalizedEmail].map((item) => sanitizeVehicle(item));
}

function removeVehicleByEmail(email = "", vehicleId = "") {
  const normalizedEmail = normalizeEmail(email);
  const normalizedVehicleId = normalizeText(vehicleId);

  if (!normalizedEmail || !normalizedVehicleId) {
    return listVehiclesByEmail(normalizedEmail);
  }

  const store = readStore();
  const current = Array.isArray(store?.vehiclesByEmail?.[normalizedEmail])
    ? store.vehiclesByEmail[normalizedEmail]
    : [];

  store.vehiclesByEmail[normalizedEmail] = current
    .map((item) => sanitizeVehicle(item))
    .filter((item) => item.id !== normalizedVehicleId)
    .slice(0, 20);

  writeStore(store);
  return store.vehiclesByEmail[normalizedEmail];
}

module.exports = {
  listVehiclesByEmail,
  addVehicleByEmail,
  removeVehicleByEmail,
};
