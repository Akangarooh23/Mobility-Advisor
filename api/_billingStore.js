const fs = require("fs");
const path = require("path");

const BILLING_STORE_PATH = path.join(__dirname, "..", "db", "billing-data.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
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
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
};
