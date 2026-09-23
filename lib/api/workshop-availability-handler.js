/**
 * Las horas del taller. El almacén está en `lib/huecos-del-taller.js`.
 *
 * Esto guardaba las reservas en un JSON dentro del propio despliegue. En
 * Vercel el disco es de solo lectura, así que en producción la reserva se iba
 * en un 500; y el lado de leer devolvía listas vacías cuando el fichero no
 * estaba, con lo que **todas las horas salían libres siempre**. El cálculo de
 * huecos de aquí abajo estaba bien y no se toca: lo único que cambia es de
 * dónde salen los datos.
 */
const { loQueHay, reserva, bloquea, desbloquea } = require("../huecos-del-taller");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSlotsForWeekday(weekday) {
  if (weekday === 0) return null; // Sunday — closed
  if (weekday === 6) return ["09:00", "10:00", "11:00", "12:00", "13:00"]; // Saturday
  return ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00", "18:00", "19:00"]; // Mon–Fri
}

function addDays(baseDate, daysToAdd) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + Number(daysToAdd || 0));
  return next;
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildSlotsForDate(date) {
  const weekday = date.getDay();
  const times = getSlotsForWeekday(weekday);
  if (!times) return []; // Sunday
  return times.map((time) => ({ time, available: true }));
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

function buildAvailability({ workshopId = "", monthKey = "", reservations = [], blockedDays = [], blockedSlots = [] }) {
  const bounds = getMonthBounds(monthKey);
  if (!bounds) {
    return null;
  }

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
    const weekday = date.getDay();
    const isSunday = weekday === 0;
    const manuallyBlockedDay = blockedDaysSet.has(dateKey);

    const baseSlots = (isSunday || manuallyBlockedDay) ? [] : buildSlotsForDate(date);
    const reservedTimes = reservedByDate.get(dateKey) || new Set();
    const manuallyBlockedSlots = blockedSlotsByDate.get(dateKey) || new Set();

    const slots = baseSlots.map((slot) => ({
      time: slot.time,
      available: !reservedTimes.has(slot.time) && !manuallyBlockedSlots.has(slot.time),
    }));

    const hasAvailable = slots.some((slot) => slot.available);

    availabilityByDate[dateKey] = {
      closed: isSunday,
      fullyBooked: isSunday || manuallyBlockedDay || (slots.length > 0 && !hasAvailable),
      slots,
    };
  }

  return {
    workshopId,
    monthKey,
    availabilityByDate,
  };
}

/**
 * La red.
 *
 * Antes no había: la escritura del fichero fallaba y la función se caía sin
 * decir nada, que es lo que veía el cliente al confirmar su cita.
 */
module.exports = async function workshopAvailabilityHandler(req, res) {
  try {
    return await responde(req, res);
  } catch (err) {
    console.error("[taller] la peticion de horas ha fallado:", err && err.message);
    return res.status(500).json({ error: "No se ha podido consultar el calendario del taller" });
  }
};

async function responde(req, res) {
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

    const store = await loQueHay({ workshopId, monthKey });
    const availability = buildAvailability({
      workshopId,
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

  if (action === "block_day") {
    if (!workshopId || !isValidDateKey(dateKey)) {
      return res.status(400).json({ error: "workshopId and valid dateKey are required" });
    }

    await bloquea({ workshopId, provider, dateKey });
    return res.status(200).json({ ok: true, action: "block_day", workshopId, dateKey });
  }

  if (action === "unblock_day") {
    if (!workshopId || !isValidDateKey(dateKey)) {
      return res.status(400).json({ error: "workshopId and valid dateKey are required" });
    }

    await desbloquea({ workshopId, dateKey });
    return res.status(200).json({ ok: true, action: "unblock_day", workshopId, dateKey });
  }

  if (action === "block_slot") {
    if (!workshopId || !isValidDateKey(dateKey) || !time) {
      return res.status(400).json({ error: "workshopId, valid dateKey and time are required" });
    }

    await bloquea({ workshopId, provider, dateKey, time });
    return res.status(200).json({ ok: true, action: "block_slot", workshopId, dateKey, time });
  }

  if (action === "unblock_slot") {
    if (!workshopId || !isValidDateKey(dateKey) || !time) {
      return res.status(400).json({ error: "workshopId, valid dateKey and time are required" });
    }

    await desbloquea({ workshopId, dateKey, time });
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

  const store = await loQueHay({ workshopId, monthKey });
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

  /*
   * Quien decide si la hora estaba libre es la base, no la comprobación de
   * arriba: entre mirar el calendario y pulsar cabe otra persona haciendo lo
   * mismo, y con el fichero eso daba dos citas a la misma hora, con una sola
   * apuntada.
   */
  const problema = await reserva({
    workshopId,
    provider,
    dateKey,
    time,
    userEmail: normalizeText(body?.userEmail),
  });

  if (problema === "ocupada") {
    return res.status(409).json({
      error: "Slot no disponible",
      code: "SLOT_NOT_AVAILABLE",
    });
  }

  return res.status(200).json({
    ok: true,
    reservation: {
      workshopId,
      provider,
      dateKey,
      time,
    },
  });
}