const SAVED_COMPARISONS_KEY = "movilidad-advisor.savedComparisons.v1";
const USER_APPOINTMENTS_KEY = "movilidad-advisor.userAppointments.v1";
const QUESTIONNAIRE_DRAFT_KEY = "movilidad-advisor.questionnaireDraft.v1";
const MARKET_ALERTS_KEY = "movilidad-advisor.marketAlerts.v1";
const MARKET_ALERT_STATUS_KEY = "movilidad-advisor.marketAlertStatus.v1";
const AUTH_USER_KEY = "movilidad-advisor.authUser.v1";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readCollection(key) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id) : [];
  } catch {
    return [];
  }
}

function writeCollection(key, items = [], limit = 6) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeItems = Array.isArray(items) ? items.slice(0, limit) : [];
    window.localStorage.setItem(key, JSON.stringify(safeItems));
  } catch {}
}

export function readSavedComparisons() {
  return readCollection(SAVED_COMPARISONS_KEY);
}

export function writeSavedComparisons(items = []) {
  writeCollection(SAVED_COMPARISONS_KEY, items, 6);
}

export function readUserAppointments() {
  return readCollection(USER_APPOINTMENTS_KEY);
}

export function writeUserAppointments(items = []) {
  writeCollection(USER_APPOINTMENTS_KEY, items, 8);
}

export function readQuestionnaireDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(QUESTIONNAIRE_DRAFT_KEY);
    const parsed = JSON.parse(raw || "null");

    if (!parsed || typeof parsed !== "object" || typeof parsed.answers !== "object") {
      return null;
    }

    const normalizedAnswers = parsed.answers || {};
    const fallbackAnsweredSteps = Object.values(normalizedAnswers).reduce((count, value) => {
      if (Array.isArray(value)) {
        return count + (value.length > 0 ? 1 : 0);
      }

      return count + (value ? 1 : 0);
    }, 0);

    return {
      ...parsed,
      answers: normalizedAnswers,
      answeredSteps: Number(parsed.answeredSteps ?? fallbackAnsweredSteps),
      totalSteps: Number(parsed.totalSteps ?? 0),
    };
  } catch {
    return null;
  }
}

export function writeQuestionnaireDraft(draft = null) {
  if (typeof window === "undefined" || !draft || typeof draft !== "object") {
    return;
  }

  try {
    window.localStorage.setItem(QUESTIONNAIRE_DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

export function clearQuestionnaireDraft() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(QUESTIONNAIRE_DRAFT_KEY);
  } catch {}
}

export function readMarketAlerts() {
  return readCollection(MARKET_ALERTS_KEY);
}

export function writeMarketAlerts(items = []) {
  writeCollection(MARKET_ALERTS_KEY, items, 20);
}

export function readMarketAlertStatus() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(MARKET_ALERT_STATUS_KEY);
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeMarketAlertStatus(status = {}) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeStatus = status && typeof status === "object" && !Array.isArray(status) ? status : {};
    window.localStorage.setItem(MARKET_ALERT_STATUS_KEY, JSON.stringify(safeStatus));
  } catch {}
}

export function readAuthUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    const parsed = JSON.parse(raw || "null");

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const email = normalizeText(parsed.email).toLowerCase();
    if (!email) {
      return null;
    }

    return {
      id: normalizeText(parsed.id) || `user:${email}`,
      name: normalizeText(parsed.name) || email.split("@")[0],
      email,
      createdAt: normalizeText(parsed.createdAt),
      lastLoginAt: normalizeText(parsed.lastLoginAt),
    };
  } catch {
    return null;
  }
}

export function writeAuthUser(user = null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeUser = user && typeof user === "object" ? user : null;
    const email = normalizeText(safeUser?.email).toLowerCase();

    if (!safeUser || !email) {
      window.localStorage.removeItem(AUTH_USER_KEY);
      return;
    }

    window.localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify({
        id: normalizeText(safeUser.id) || `user:${email}`,
        name: normalizeText(safeUser.name) || email.split("@")[0],
        email,
        createdAt: normalizeText(safeUser.createdAt),
        lastLoginAt: normalizeText(safeUser.lastLoginAt),
      })
    );
  } catch {}
}

export function clearAuthUser() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(AUTH_USER_KEY);
  } catch {}
}
