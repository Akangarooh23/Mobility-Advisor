const fs = require("fs");
const path = require("path");

const BILLING_STORE_PATH = path.join(__dirname, "..", "db", "billing-data.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function sanitizeGarageAttachment(input = {}) {
  return {
    name: normalizeText(input?.name),
    size: Number(input?.size || 0),
  };
}

function sanitizeGarageVehicle(input = {}) {
  const brand = normalizeText(input?.brand);
  const model = normalizeText(input?.model);
  const title = normalizeText(input?.title) || `${brand} ${model}`.trim();
  const photos = Array.isArray(input?.photos)
    ? input.photos.map((item) => sanitizeGarageAttachment(item)).filter((item) => item.name)
    : [];
  const documents = Array.isArray(input?.documents)
    ? input.documents.map((item) => sanitizeGarageAttachment(item)).filter((item) => item.name)
    : [];

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

function getSeedGarageVehicles(email = "") {
  if (normalizeEmail(email) !== "anapicazoh@gmail.com") {
    return [];
  }

  return [
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
      createdAt: "2026-04-17T00:00:00.000Z",
    },
  ];
}

function ensureStoreDirectory() {
  const dirPath = path.dirname(BILLING_STORE_PATH);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createDefaultStore() {
  return {
    customersByEmail: {},
    stripeCustomerToEmail: {},
    stripeSubscriptionToEmail: {},
    updatedAt: new Date().toISOString(),
  };
}

function readStore() {
  ensureStoreDirectory();

  if (!fs.existsSync(BILLING_STORE_PATH)) {
    return createDefaultStore();
  }

  try {
    const raw = fs.readFileSync(BILLING_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");

    return {
      customersByEmail: parsed && typeof parsed.customersByEmail === "object" ? parsed.customersByEmail : {},
      stripeCustomerToEmail:
        parsed && typeof parsed.stripeCustomerToEmail === "object" ? parsed.stripeCustomerToEmail : {},
      stripeSubscriptionToEmail:
        parsed && typeof parsed.stripeSubscriptionToEmail === "object" ? parsed.stripeSubscriptionToEmail : {},
      updatedAt: normalizeText(parsed?.updatedAt) || "",
    };
  } catch {
    return createDefaultStore();
  }
}

function writeStore(nextStore) {
  ensureStoreDirectory();

  const safeStore = {
    customersByEmail: nextStore?.customersByEmail || {},
    stripeCustomerToEmail: nextStore?.stripeCustomerToEmail || {},
    stripeSubscriptionToEmail: nextStore?.stripeSubscriptionToEmail || {},
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(BILLING_STORE_PATH, JSON.stringify(safeStore, null, 2));
  return safeStore;
}

function getDefaultAccount(email = "") {
  return {
    email,
    profile: {
      fullName: "",
      email,
      phone: "",
      companyName: "",
      taxId: "",
      billingAddress: "",
      iban: "",
      updatedAt: "",
    },
    billingState: {
      planId: "gratis",
      planLabel: "Plan Gratis",
      status: "inactivo",
      nextBillingDate: "",
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      invoices: [
        {
          id: "demo-invoice-001",
          number: "MA-2026-001",
          date: "2026-04-01",
          amount: 0,
          status: "Pagada",
          pdfUrl: "",
        },
      ],
    },
    garageVehicles: getSeedGarageVehicles(email),
    updatedAt: "",
  };
}

function resolveAccountByEmail(email = "") {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const store = readStore();
  const existing = store.customersByEmail[normalizedEmail];

  if (!existing || typeof existing !== "object") {
    return getDefaultAccount(normalizedEmail);
  }

  const fallback = getDefaultAccount(normalizedEmail);
  const safeInvoices = Array.isArray(existing?.billingState?.invoices)
    ? existing.billingState.invoices
        .map((invoice) => ({
          id: normalizeText(invoice?.id),
          number: normalizeText(invoice?.number),
          date: normalizeText(invoice?.date),
          amount: Number(invoice?.amount || 0),
          status: normalizeText(invoice?.status),
          pdfUrl: normalizeText(invoice?.pdfUrl),
        }))
        .filter((invoice) => invoice.id || invoice.number)
    : [];
  const safeGarageVehicles = Array.isArray(existing?.garageVehicles)
    ? existing.garageVehicles
        .map((vehicle) => sanitizeGarageVehicle(vehicle))
        .filter((vehicle) => vehicle.id && vehicle.brand && vehicle.model)
        .slice(0, 20)
    : fallback.garageVehicles;

  return {
    email: normalizedEmail,
    profile: {
      ...fallback.profile,
      ...(existing.profile && typeof existing.profile === "object" ? existing.profile : {}),
      email: normalizedEmail,
    },
    billingState: {
      ...fallback.billingState,
      ...(existing.billingState && typeof existing.billingState === "object" ? existing.billingState : {}),
      invoices: safeInvoices.length > 0 ? safeInvoices.slice(0, 40) : fallback.billingState.invoices,
    },
    garageVehicles: safeGarageVehicles,
    updatedAt: normalizeText(existing.updatedAt),
  };
}

function upsertAccount(email = "", updater) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const store = readStore();
  const current = resolveAccountByEmail(normalizedEmail);
  const updated = typeof updater === "function" ? updater(current) : current;

  if (!updated || typeof updated !== "object") {
    return current;
  }

  const nextAccount = {
    ...current,
    ...updated,
    email: normalizedEmail,
    profile: {
      ...(current?.profile || {}),
      ...(updated?.profile || {}),
      email: normalizedEmail,
    },
    billingState: {
      ...(current?.billingState || {}),
      ...(updated?.billingState || {}),
      invoices: Array.isArray(updated?.billingState?.invoices)
        ? updated.billingState.invoices.slice(0, 40)
        : Array.isArray(current?.billingState?.invoices)
        ? current.billingState.invoices.slice(0, 40)
        : [],
    },
    garageVehicles: Array.isArray(updated?.garageVehicles)
      ? updated.garageVehicles
          .map((vehicle) => sanitizeGarageVehicle(vehicle))
          .filter((vehicle) => vehicle.id && vehicle.brand && vehicle.model)
          .slice(0, 20)
      : Array.isArray(current?.garageVehicles)
      ? current.garageVehicles
          .map((vehicle) => sanitizeGarageVehicle(vehicle))
          .filter((vehicle) => vehicle.id && vehicle.brand && vehicle.model)
          .slice(0, 20)
      : [],
    updatedAt: new Date().toISOString(),
  };

  store.customersByEmail[normalizedEmail] = nextAccount;

  const stripeCustomerId = normalizeText(nextAccount?.billingState?.stripeCustomerId);
  if (stripeCustomerId) {
    store.stripeCustomerToEmail[stripeCustomerId] = normalizedEmail;
  }

  const stripeSubscriptionId = normalizeText(nextAccount?.billingState?.stripeSubscriptionId);
  if (stripeSubscriptionId) {
    store.stripeSubscriptionToEmail[stripeSubscriptionId] = normalizedEmail;
  }

  writeStore(store);
  return nextAccount;
}

function updateProfile(email = "", profile = {}) {
  return upsertAccount(email, (current) => ({
    ...current,
    profile: {
      ...(current?.profile || {}),
      fullName: normalizeText(profile?.fullName),
      phone: normalizeText(profile?.phone),
      companyName: normalizeText(profile?.companyName),
      taxId: normalizeText(profile?.taxId),
      billingAddress: normalizeText(profile?.billingAddress),
      iban: normalizeText(profile?.iban),
      updatedAt: new Date().toISOString(),
    },
  }));
}

function updateBillingState(email = "", patch = {}) {
  return upsertAccount(email, (current) => ({
    ...current,
    billingState: {
      ...(current?.billingState || {}),
      ...patch,
    },
  }));
}

function appendOrUpdateInvoice(email = "", invoice = {}) {
  return upsertAccount(email, (current) => {
    const existingInvoices = Array.isArray(current?.billingState?.invoices)
      ? current.billingState.invoices.slice(0, 40)
      : [];
    const invoiceId = normalizeText(invoice?.id) || normalizeText(invoice?.number);

    const safeInvoice = {
      id: normalizeText(invoice?.id),
      number: normalizeText(invoice?.number),
      date: normalizeText(invoice?.date),
      amount: Number(invoice?.amount || 0),
      status: normalizeText(invoice?.status),
      pdfUrl: normalizeText(invoice?.pdfUrl),
    };

    let nextInvoices = existingInvoices;

    if (invoiceId) {
      const idx = existingInvoices.findIndex(
        (item) => normalizeText(item?.id) === invoiceId || normalizeText(item?.number) === invoiceId
      );

      if (idx >= 0) {
        nextInvoices = existingInvoices.map((item, index) => (index === idx ? { ...item, ...safeInvoice } : item));
      } else {
        nextInvoices = [safeInvoice, ...existingInvoices].slice(0, 40);
      }
    }

    return {
      ...current,
      billingState: {
        ...(current?.billingState || {}),
        invoices: nextInvoices,
      },
    };
  });
}

function listGarageVehiclesByEmail(email = "") {
  return resolveAccountByEmail(email)?.garageVehicles || [];
}

function addGarageVehicleByEmail(email = "", vehicle = {}) {
  const normalizedVehicle = sanitizeGarageVehicle(vehicle);

  if (!normalizedVehicle.brand || !normalizedVehicle.model) {
    return listGarageVehiclesByEmail(email);
  }

  const nextVehicle = {
    ...normalizedVehicle,
    id: normalizedVehicle.id || `garage-${Date.now()}`,
  };

  const account = upsertAccount(email, (current) => {
    const currentVehicles = Array.isArray(current?.garageVehicles) ? current.garageVehicles : [];
    const deduped = currentVehicles
      .map((item) => sanitizeGarageVehicle(item))
      .filter((item) => item.id !== nextVehicle.id);

    return {
      ...current,
      garageVehicles: [nextVehicle, ...deduped].slice(0, 20),
    };
  });

  return account?.garageVehicles || [];
}

function removeGarageVehicleByEmail(email = "", vehicleId = "") {
  const normalizedVehicleId = normalizeText(vehicleId);

  if (!normalizedVehicleId) {
    return listGarageVehiclesByEmail(email);
  }

  const account = upsertAccount(email, (current) => {
    const currentVehicles = Array.isArray(current?.garageVehicles) ? current.garageVehicles : [];

    return {
      ...current,
      garageVehicles: currentVehicles
        .map((item) => sanitizeGarageVehicle(item))
        .filter((item) => item.id !== normalizedVehicleId)
        .slice(0, 20),
    };
  });

  return account?.garageVehicles || [];
}

function getEmailByStripeCustomerId(customerId = "") {
  const normalized = normalizeText(customerId);
  if (!normalized) {
    return "";
  }

  const store = readStore();
  return normalizeEmail(store?.stripeCustomerToEmail?.[normalized]);
}

function getEmailByStripeSubscriptionId(subscriptionId = "") {
  const normalized = normalizeText(subscriptionId);
  if (!normalized) {
    return "";
  }

  const store = readStore();
  return normalizeEmail(store?.stripeSubscriptionToEmail?.[normalized]);
}

module.exports = {
  resolveAccountByEmail,
  updateProfile,
  updateBillingState,
  listGarageVehiclesByEmail,
  addGarageVehicleByEmail,
  removeGarageVehicleByEmail,
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
};