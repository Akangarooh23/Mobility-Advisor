const { execFileSync } = require("child_process");

const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const MSSQL_SERVER = process.env.MSSQL_SERVER || "localhost\\SQLEXPRESS";
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || "Mobilityadvisor";
const MSSQL_USER = String(process.env.MSSQL_USER || "").trim();
const MSSQL_PASSWORD = String(process.env.MSSQL_PASSWORD || "");

function randomEmail(prefix = "mobility.e2e") {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
}

function toCookieHeader(setCookieValue = "") {
  return String(setCookieValue)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.toLowerCase().startsWith("moveadvisor_session="))
    .map((part) => part.split(";")[0])
    .join("; ");
}

async function requestJson(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    response,
    data,
    setCookie: response.headers.get("set-cookie") || "",
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeSqlString(value) {
  return String(value || "").replace(/'/g, "''");
}

function querySqlRows(email) {
  const safeEmail = escapeSqlString(email);
  const query = [
    "SET NOCOUNT ON;",
    `SELECT 'saved' AS Kind, COUNT(*) AS Total, CAST(NULL AS NVARCHAR(50)) AS Detail FROM dbo.MoveAdvisorUserSavedComparisons WHERE UserEmail = N'${safeEmail}'`,
    "UNION ALL",
    `SELECT 'alerts' AS Kind, COUNT(*) AS Total, CAST(NULL AS NVARCHAR(50)) AS Detail FROM dbo.MoveAdvisorUserMarketAlerts WHERE UserEmail = N'${safeEmail}'`,
    "UNION ALL",
    `SELECT 'alert_status' AS Kind, COUNT(*) AS Total, CAST(MAX(CAST(SeenCount AS NVARCHAR(50))) AS NVARCHAR(50)) AS Detail FROM dbo.MoveAdvisorUserMarketAlertStatus WHERE UserEmail = N'${safeEmail}'`,
    "UNION ALL",
    `SELECT 'preferences' AS Kind, COUNT(*) AS Total, MAX(CASE WHEN WeeklyDigest = 1 THEN N'1' ELSE N'0' END) AS Detail FROM dbo.MoveAdvisorUserPreferences WHERE UserEmail = N'${safeEmail}'`,
  ].join(" ");

  const authArgs = MSSQL_USER ? ["-U", MSSQL_USER, "-P", MSSQL_PASSWORD] : ["-E"];
  const output = execFileSync(
    "sqlcmd",
    ["-S", MSSQL_SERVER, "-d", MSSQL_DATABASE, ...authArgs, "-W", "-h", "-1", "-s", "|", "-Q", query],
    { encoding: "utf8" }
  );

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [kind, total, detail] = line.split("|");
      return {
        kind: String(kind || "").trim(),
        total: Number(total || 0),
        detail: String(detail || "").trim(),
      };
    });
}

async function run() {
  const email = randomEmail();
  const password = "Mobility123!";
  const comparisonId = `cmp:${Date.now()}`;
  const alertId = `alert:${Date.now()}`;

  console.log(`[mobility-e2e] API: ${API_BASE_URL}`);
  console.log(`[mobility-e2e] User: ${email}`);
  console.log(`[mobility-e2e] SQL auth: ${MSSQL_USER ? "sql-login" : "windows-auth"}`);

  const register = await requestJson("/api/auth", {
    method: "POST",
    body: {
      action: "register",
      name: "Mobility E2E",
      email,
      password,
    },
  });

  assert(register.response.ok, `Register failed: ${register.data?.error || register.response.status}`);

  const login = await requestJson("/api/auth", {
    method: "POST",
    body: {
      action: "login",
      email,
      password,
    },
  });

  assert(login.response.ok, `Login failed: ${login.data?.error || login.response.status}`);
  const cookie = toCookieHeader(login.setCookie);
  assert(cookie, "No session cookie received after login.");

  const initialPrefs = await requestJson("/api/user-preferences", { cookie });
  assert(initialPrefs.response.ok, `Initial preferences GET failed: ${initialPrefs.data?.error || initialPrefs.response.status}`);
  assert(initialPrefs.response.status !== 503 && !initialPrefs.data?.fallback, "Preferences endpoint fell back instead of using SQL backend.");

  const savedPrefs = await requestJson("/api/user-preferences", {
    method: "POST",
    cookie,
    body: {
      preferences: {
        fullName: "Mobility E2E",
        language: "es",
        region: "es",
        notifyPriceAlerts: true,
        notifyAppointments: false,
        notifyAnalysisReady: true,
        weeklyDigest: false,
      },
    },
  });
  assert(savedPrefs.response.ok, `Preferences save failed: ${savedPrefs.data?.error || savedPrefs.response.status}`);

  const savedComparison = await requestJson("/api/user-saved", {
    method: "POST",
    cookie,
    body: {
      comparison: {
        id: comparisonId,
        title: "Comparacion E2E",
        mode: "buy",
        selectedOfferId: "offer:test",
      },
    },
  });
  assert(savedComparison.response.ok, `Saved comparison POST failed: ${savedComparison.data?.error || savedComparison.response.status}`);
  assert(Array.isArray(savedComparison.data?.comparisons) && savedComparison.data.comparisons.some((item) => item.id === comparisonId), "Saved comparison was not returned by the API.");

  const savedAlert = await requestJson("/api/user-alerts", {
    method: "POST",
    cookie,
    body: {
      alert: {
        id: alertId,
        title: "Alerta E2E",
        mode: "buy",
        brand: "Seat",
        model: "Leon",
        maxPrice: "25000",
        maxMileage: "50000",
        fuel: "Gasolina",
        location: "Madrid",
        color: "Azul",
        notifyByEmail: true,
        alertEmail: email,
        status: "active",
      },
    },
  });
  assert(savedAlert.response.ok, `Market alert POST failed: ${savedAlert.data?.error || savedAlert.response.status}`);
  assert(Array.isArray(savedAlert.data?.alerts) && savedAlert.data.alerts.some((item) => item.id === alertId), "Saved alert was not returned by the API.");

  const alertStatus = await requestJson("/api/user-alerts?scope=status", {
    method: "POST",
    cookie,
    body: {
      alertId,
      seenCount: 3,
    },
  });
  assert(alertStatus.response.ok, `Alert status POST failed: ${alertStatus.data?.error || alertStatus.response.status}`);
  assert(alertStatus.data?.alertStatus?.[alertId]?.seenCount === 3, "Alert status was not persisted through the API.");

  const alertList = await requestJson("/api/user-alerts", { cookie });
  assert(alertList.response.ok, `Market alerts GET failed: ${alertList.data?.error || alertList.response.status}`);
  assert(alertList.data?.alertStatus?.[alertId]?.seenCount === 3, "Alert status GET does not reflect the persisted seenCount.");

  const sqlRows = querySqlRows(email);
  const sqlByKind = Object.fromEntries(sqlRows.map((row) => [row.kind, row]));

  assert(sqlByKind.saved?.total === 1, `Expected 1 saved comparison row in SQL, got ${sqlByKind.saved?.total ?? 0}.`);
  assert(sqlByKind.alerts?.total === 1, `Expected 1 market alert row in SQL, got ${sqlByKind.alerts?.total ?? 0}.`);
  assert(sqlByKind.alert_status?.total === 1, `Expected 1 market alert status row in SQL, got ${sqlByKind.alert_status?.total ?? 0}.`);
  assert(sqlByKind.alert_status?.detail === "3", `Expected seenCount 3 in SQL, got ${sqlByKind.alert_status?.detail || "<empty>"}.`);
  assert(sqlByKind.preferences?.total === 1, `Expected 1 user preferences row in SQL, got ${sqlByKind.preferences?.total ?? 0}.`);
  assert(sqlByKind.preferences?.detail === "0", `Expected WeeklyDigest=false in SQL, got ${sqlByKind.preferences?.detail || "<empty>"}.`);

  const removedAlert = await requestJson(`/api/user-alerts?id=${encodeURIComponent(alertId)}`, {
    method: "DELETE",
    cookie,
  });
  assert(removedAlert.response.ok, `Alert delete failed: ${removedAlert.data?.error || removedAlert.response.status}`);

  const removedComparison = await requestJson(`/api/user-saved?id=${encodeURIComponent(comparisonId)}`, {
    method: "DELETE",
    cookie,
  });
  assert(removedComparison.response.ok, `Saved comparison delete failed: ${removedComparison.data?.error || removedComparison.response.status}`);

  console.log("[mobility-e2e] OK: endpoints persisted data in SQL Server without fallback.");
  console.log(JSON.stringify({ sqlRows }, null, 2));
}

run().catch((error) => {
  console.error("[mobility-e2e] FAIL:", error?.message || error);
  process.exit(1);
});