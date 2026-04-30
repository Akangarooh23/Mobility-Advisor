const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, "..", "db", "workshop-availability.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hashText(value = "") {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 1000003;
  }
  return hash;
}

function buildWorkshopProfile(workshopId = "", provider = "") {
  const profileSeed = normalizeText(workshopId) || normalizeText(provider) || "carswise-workshop";
  const hash = hashText(profileSeed);

  return {
    busySlotModulo: 3 + (hash % 3),
    fullDayModulo: 5 + (hash % 4),
    weekendOpenBias: hash % 2 === 0,
    eveningOpenBias: hash % 5 <= 2,
  };
}

function addDays(baseDate, daysToAdd) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + Number(daysToAdd || 0));
  return next;
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildSlotsForDate(date, seed = "", profile = null) {
  const weekday = date.getDay();
  const weekend = weekday === 0 || weekday === 6;
  const workshopProfile = profile || buildWorkshopProfile();

  const baseSlots = weekend
    ? (workshopProfile.weekendOpenBias
      ? ["09:30", "11:00", "12:30", "16:00"]
      : ["10:00", "11:30", "13:00"])
    : (workshopProfile.eveningOpenBias
      ? ["09:00", "10:30", "12:00", "13:30", "16:00", "17:30", "19:00"]
      : ["08:30", "10:00", "11:30", "13:00", "15:30", "17:00"]);

  return baseSlots.map((timeText) => {
    const slotHash = hashText(`${seed}-${dateKeyFromDate(date)}-${timeText}`);
    const available = slotHash % workshopProfile.busySlotModulo !== 0;
    return {
      time: timeText,
      available,
    };
  });
}

function isDayFullyBooked(date, seed = "", profile = null) {
  const workshopProfile = profile || buildWorkshopProfile();
  const dayHash = hashText(`${seed}-${dateKeyFromDate(date)}-day`);
  return dayHash % workshopProfile.fullDayModulo === 0;
}

function ensureStoreDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return { reservations: [], blockedDays: [], blockedSlots: [] };
    }

    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      reservations: Array.isArray(parsed?.reservations) ? parsed.reservations : [],
      blockedDays: Array.isArray(parsed?.blockedDays) ? parsed.blockedDays : [],
      blockedSlots: Array.isArray(parsed?.blockedSlots) ? parsed.blockedSlots : [],
    };
  } catch {
    return { reservations: [], blockedDays: [], blockedSlots: [] };
  }
}

function writeStore(payload = { reservations: [], blockedDays: [], blockedSlots: [] }) {
  ensureStoreDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  try {
    return JSON.parse(String(req.body || "{}"));
  } catch {
    return {};
  }
}

function getMonthBounds(monthKey = "") {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) {
    return null;
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

function isValidDateKey(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(value));
}

function removeMatchingEntry(items = [], matcher = () => false) {
  return (Array.isArray(items) ? items : []).filter((item) => !matcher(item));
}

function upsertDayBlock(store, { workshopId, provider, dateKey }) {
  store.blockedDays = removeMatchingEntry(store.blockedDays, (item) =>
    normalizeText(item?.workshopId) === workshopId && normalizeText(item?.dateKey) === dateKey
  );

  store.blockedDays.push({
    id: `wday-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workshopId,
    provider,
    dateKey,
    createdAt: new Date().toISOString(),
  });
}

function removeDayBlock(store, { workshopId, dateKey }) {
  store.blockedDays = removeMatchingEntry(store.blockedDays, (item) =>
    normalizeText(item?.workshopId) === workshopId && normalizeText(item?.dateKey) === dateKey
  );
}

function upsertSlotBlock(store, { workshopId, provider, dateKey, time }) {
  store.blockedSlots = removeMatchingEntry(store.blockedSlots, (item) =>
    normalizeText(item?.workshopId) === workshopId &&
    normalizeText(item?.dateKey) === dateKey &&
    normalizeText(item?.time) === time
  );

  store.blockedSlots.push({
    id: `wslot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workshopId,
    provider,
    dateKey,
    time,
    createdAt: new Date().toISOString(),
  });
}

function removeSlotBlock(store, { workshopId, dateKey, time }) {
  store.blockedSlots = removeMatchingEntry(store.blockedSlots, (item) =>
    normalizeText(item?.workshopId) === workshopId &&
    normalizeText(item?.dateKey) === dateKey &&
    normalizeText(item?.time) === time
  );
}

function buildAvailability({ workshopId = "", provider = "", monthKey = "", reservations = [], blockedDays = [], blockedSlots = [] }) {
  const bounds = getMonthBounds(monthKey);
  if (!bounds) {
    return null;
  }

  const profile = buildWorkshopProfile(workshopId, provider);
  const seed = [workshopId, provider, monthKey].filter(Boolean).join("-") || "carswise";

  const monthReservations = reservations.filter((item) =>
    normalizeText(item?.workshopId) === workshopId &&
    normalizeText(item?.dateKey).startsWith(`${monthKey}-`) &&
    normalizeToken(item?.status || "booked") !== "cancelled"
  );

  const reservedByDate = new Map();
  monthReservations.forEach((item) => {
    const key = normalizeText(item?.dateKey);
    if (!reservedByDate.has(key)) {
      reservedByDate.set(key, new Set());
    }
    reservedByDate.get(key).add(normalizeText(item?.time));
  });

  const blockedDaysSet = new Set(
    (Array.isArray(blockedDays) ? blockedDays : [])
      .filter((item) =>
        normalizeText(item?.workshopId) === workshopId &&
        normalizeText(item?.dateKey).startsWith(`${monthKey}-`)
      )
      .map((item) => normalizeText(item?.dateKey))
      .filter(Boolean)
  );

  const blockedSlotsByDate = new Map();
  (Array.isArray(blockedSlots) ? blockedSlots : [])
    .filter((item) =>
      normalizeText(item?.workshopId) === workshopId &&
      normalizeText(item?.dateKey).startsWith(`${monthKey}-`)
    )
    .forEach((item) => {
      const key = normalizeText(item?.dateKey);
      const time = normalizeText(item?.time);
      if (!key || !time) {
        return;
      }
      if (!blockedSlotsByDate.has(key)) {
        blockedSlotsByDate.set(key, new Set());
      }
      blockedSlotsByDate.get(key).add(time);
    });

  const availabilityByDate = {};

  for (let date = new Date(bounds.start); date <= bounds.end; date = addDays(date, 1)) {
    const dateKey = dateKeyFromDate(date);
    const fullyBookedByPattern = isDayFullyBooked(date, seed, profile);
    const manuallyBlockedDay = blockedDaysSet.has(dateKey);
    const baseSlots = (fullyBookedByPattern || manuallyBlockedDay) ? [] : buildSlotsForDate(date, seed, profile);
    const reservedTimes = reservedByDate.get(dateKey) || new Set();
    const manuallyBlockedSlots = blockedSlotsByDate.get(dateKey) || new Set();

    const slots = baseSlots.map((slot) => ({
      time: slot.time,
      available: slot.available && !reservedTimes.has(slot.time) && !manuallyBlockedSlots.has(slot.time),
    }));

    const hasAvailable = slots.some((slot) => slot.available);

    availabilityByDate[dateKey] = {
      fullyBooked: fullyBookedByPattern || manuallyBlockedDay || (!hasAvailable && slots.length > 0),
      slots,
    };
  }

  return {
    workshopId,
    monthKey,
    availabilityByDate,
  };
}

module.exports = async function workshopAvailabilityHandler(req, res) {
  if (!req.method || !["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.method === "GET") {
    const workshopId = normalizeText(req.query?.workshopId);
    const provider = normalizeText(req.query?.provider);
    const monthKey = normalizeText(req.query?.monthKey);

    if (!workshopId || !monthKey) {
      return res.status(400).json({ error: "workshopId and monthKey are required" });
    }

    const store = readStore();
    const availability = buildAvailability({
      workshopId,
      provider,
      monthKey,
      reservations: store.reservations,
      blockedDays: store.blockedDays,
      blockedSlots: store.blockedSlots,
    });

    if (!availability) {
      return res.status(400).json({ error: "monthKey must be YYYY-MM" });
    }

    if (normalizeToken(req.query?.scope) === "admin") {
      return res.status(200).json({
        ok: true,
        ...availability,
        blockedDays: store.blockedDays.filter((item) =>
          normalizeText(item?.workshopId) === workshopId && normalizeText(item?.dateKey).startsWith(`${monthKey}-`)
        ),
        blockedSlots: store.blockedSlots.filter((item) =>
          normalizeText(item?.workshopId) === workshopId && normalizeText(item?.dateKey).startsWith(`${monthKey}-`)
        ),
      });
    }

    return res.status(200).json({ ok: true, ...availability });
  }

  const body = parseBody(req);
  const action = normalizeToken(body?.action || "reserve");

  const workshopId = normalizeText(body?.workshopId);
  const provider = normalizeText(body?.provider);
  const dateKey = normalizeText(body?.dateKey);
  const time = normalizeText(body?.time);

  const store = readStore();

  if (action === "block_day") {
    if (!workshopId || !isValidDateKey(dateKey)) {
      return res.status(400).json({ error: "workshopId and valid dateKey are required" });
    }

    upsertDayBlock(store, { workshopId, provider, dateKey });
    writeStore(store);
    return res.status(200).json({ ok: true, action: "block_day", workshopId, dateKey });
  }

  if (action === "unblock_day") {
    if (!workshopId || !isValidDateKey(dateKey)) {
      return res.status(400).json({ error: "workshopId and valid dateKey are required" });
    }

    removeDayBlock(store, { workshopId, dateKey });
    writeStore(store);
    return res.status(200).json({ ok: true, action: "unblock_day", workshopId, dateKey });
  }

  if (action === "block_slot") {
    if (!workshopId || !isValidDateKey(dateKey) || !time) {
      return res.status(400).json({ error: "workshopId, valid dateKey and time are required" });
    }

    upsertSlotBlock(store, { workshopId, provider, dateKey, time });
    writeStore(store);
    return res.status(200).json({ ok: true, action: "block_slot", workshopId, dateKey, time });
  }

  if (action === "unblock_slot") {
    if (!workshopId || !isValidDateKey(dateKey) || !time) {
      return res.status(400).json({ error: "workshopId, valid dateKey and time are required" });
    }

    removeSlotBlock(store, { workshopId, dateKey, time });
    writeStore(store);
    return res.status(200).json({ ok: true, action: "unblock_slot", workshopId, dateKey, time });
  }

  if (action !== "reserve") {
    return res.status(400).json({ error: "Unsupported action" });
  }

  if (!workshopId || !dateKey || !time) {
    return res.status(400).json({ error: "workshopId, dateKey and time are required" });
  }

  const monthKey = dateKey.slice(0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: "Invalid dateKey format (expected YYYY-MM-DD)" });
  }

  const availability = buildAvailability({
    workshopId,
    provider,
    monthKey,
    reservations: store.reservations,
    blockedDays: store.blockedDays,
    blockedSlots: store.blockedSlots,
  });

  if (!availability) {
    return res.status(400).json({ error: "Unable to evaluate availability" });
  }

  const dayData = availability.availabilityByDate?.[dateKey];
  const slotData = Array.isArray(dayData?.slots) ? dayData.slots.find((slot) => slot.time === time) : null;

  if (!slotData || !slotData.available) {
    return res.status(409).json({
      error: "Slot no disponible",
      code: "SLOT_NOT_AVAILABLE",
    });
  }

  store.reservations.push({
    id: `wres-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workshopId,
    provider,
    dateKey,
    time,
    status: "booked",
    createdAt: new Date().toISOString(),
  });

  writeStore(store);

  return res.status(200).json({
    ok: true,
    reservation: {
      workshopId,
      provider,
      dateKey,
      time,
    },
  });
};
