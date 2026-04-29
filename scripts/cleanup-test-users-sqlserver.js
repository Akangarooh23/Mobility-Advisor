const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const MSSQL_SERVER = process.env.MSSQL_SERVER || "localhost\\SQLEXPRESS";
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || "Mobilityadvisor";
const SQLCMD_PATH = process.env.SQLCMD_PATH || "sqlcmd";
const MSSQL_USER = String(process.env.MSSQL_USER || "").trim();
const MSSQL_PASSWORD = String(process.env.MSSQL_PASSWORD || "");
const DEFAULT_PATTERNS = ["mobility.e2e.%@example.com", "auth.local.%@example.com"];

function getPatterns() {
  const raw = String(process.env.TEST_EMAIL_PATTERNS || "").trim();
  if (!raw) {
    return DEFAULT_PATTERNS;
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeSqlString(value) {
  return String(value || "").replace(/'/g, "''");
}

function buildTargetValues(patterns) {
  return patterns.map((pattern) => `(N'${escapeSqlString(pattern)}')`).join(",\n    ");
}

function runSqlFile(sqlText) {
  const tempPath = path.join(os.tmpdir(), `moveadvisor-cleanup-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);

  try {
    fs.writeFileSync(tempPath, sqlText, "utf8");
    const authArgs = MSSQL_USER ? ["-U", MSSQL_USER, "-P", MSSQL_PASSWORD] : ["-E"];
    return execFileSync(SQLCMD_PATH, ["-S", MSSQL_SERVER, "-d", MSSQL_DATABASE, ...authArgs, "-b", "-y", "0", "-i", tempPath], {
      encoding: "utf8",
    });
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  }
}

function parseJsonFromSqlcmd(output) {
  const flat = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("");
  const start = flat.search(/[\[{]/);
  if (start === -1) {
    return null;
  }

  const open = flat[start];
  const close = open === "[" ? "]" : "}";
  const end = flat.lastIndexOf(close);
  if (end === -1 || end < start) {
    return null;
  }

  try {
    return JSON.parse(flat.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildCleanupSql(patterns) {
  const targetValues = buildTargetValues(patterns);

  return `
SET NOCOUNT ON;

DECLARE @Targets TABLE (Pattern NVARCHAR(255) NOT NULL PRIMARY KEY);
INSERT INTO @Targets (Pattern)
VALUES
    ${targetValues};

DECLARE @TargetUsers TABLE (Id NVARCHAR(64) NOT NULL PRIMARY KEY, Email NVARCHAR(255) NOT NULL);
INSERT INTO @TargetUsers (Id, Email)
SELECT u.Id, u.Email
FROM dbo.MoveAdvisorUsers u
WHERE EXISTS (
  SELECT 1
  FROM @Targets t
  WHERE u.Email LIKE t.Pattern
);

SELECT
  (SELECT COUNT(*) FROM @TargetUsers) AS usersBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorSessions s INNER JOIN @TargetUsers u ON u.Id = s.UserId) AS sessionsBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserPreferences p WHERE EXISTS (SELECT 1 FROM @Targets t WHERE p.UserEmail LIKE t.Pattern)) AS preferencesBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserSavedComparisons c WHERE EXISTS (SELECT 1 FROM @Targets t WHERE c.UserEmail LIKE t.Pattern)) AS savedComparisonsBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserMarketAlertStatus st WHERE EXISTS (SELECT 1 FROM @Targets t WHERE st.UserEmail LIKE t.Pattern)) AS marketAlertStatusBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserMarketAlerts a WHERE EXISTS (SELECT 1 FROM @Targets t WHERE a.UserEmail LIKE t.Pattern)) AS marketAlertsBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserSavedOffers so WHERE EXISTS (SELECT 1 FROM @Targets t WHERE so.UserEmail LIKE t.Pattern)) AS savedOffersBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserVehicleStates vs WHERE EXISTS (SELECT 1 FROM @Targets t WHERE vs.UserEmail LIKE t.Pattern)) AS vehicleStatesBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserValuations v WHERE EXISTS (SELECT 1 FROM @Targets t WHERE v.UserEmail LIKE t.Pattern)) AS valuationsBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserMaintenances m WHERE EXISTS (SELECT 1 FROM @Targets t WHERE m.UserEmail LIKE t.Pattern)) AS maintenancesBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserInsurances i WHERE EXISTS (SELECT 1 FROM @Targets t WHERE i.UserEmail LIKE t.Pattern)) AS insurancesBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserAppointments ap WHERE EXISTS (SELECT 1 FROM @Targets t WHERE ap.UserEmail LIKE t.Pattern)) AS appointmentsBefore,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserVehicles ve WHERE EXISTS (SELECT 1 FROM @Targets t WHERE ve.UserEmail LIKE t.Pattern)) AS vehiclesBefore
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;

BEGIN TRANSACTION;

DELETE s
FROM dbo.MoveAdvisorSessions s
INNER JOIN @TargetUsers u ON u.Id = s.UserId;

DELETE FROM dbo.MoveAdvisorUserMarketAlertStatus
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserPreferences
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserSavedComparisons
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserMarketAlerts
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserSavedOffers
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserVehicleStates
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserValuations
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserMaintenanceInvoices
WHERE EXISTS (
  SELECT 1
  FROM dbo.MoveAdvisorUserMaintenances m
  JOIN @Targets t ON m.UserEmail LIKE t.Pattern
  WHERE m.Id = dbo.MoveAdvisorUserMaintenanceInvoices.MaintenanceId
);

DELETE FROM dbo.MoveAdvisorUserMaintenances
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserInsuranceDocuments
WHERE EXISTS (
  SELECT 1
  FROM dbo.MoveAdvisorUserInsurances i
  JOIN @Targets t ON i.UserEmail LIKE t.Pattern
  WHERE i.Id = dbo.MoveAdvisorUserInsuranceDocuments.InsuranceId
);

DELETE FROM dbo.MoveAdvisorUserInsurances
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE FROM dbo.MoveAdvisorUserAppointments
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE files
FROM dbo.MoveAdvisorUserVehicleFiles files
JOIN dbo.MoveAdvisorUserVehicles ve ON ve.Id = files.VehicleId
JOIN @Targets t ON ve.UserEmail LIKE t.Pattern;

DELETE characteristics
FROM dbo.MoveAdvisorUserVehicleCharacteristics characteristics
JOIN dbo.MoveAdvisorUserVehicles ve ON ve.Id = characteristics.VehicleId
JOIN @Targets t ON ve.UserEmail LIKE t.Pattern;

DELETE docs
FROM dbo.MoveAdvisorUserVehicleDocuments docs
JOIN dbo.MoveAdvisorUserVehicles ve ON ve.Id = docs.VehicleId
JOIN @Targets t ON ve.UserEmail LIKE t.Pattern;

DELETE FROM dbo.MoveAdvisorUserVehicles
WHERE EXISTS (SELECT 1 FROM @Targets t WHERE UserEmail LIKE t.Pattern);

DELETE u
FROM dbo.MoveAdvisorUsers u
JOIN @TargetUsers tu ON tu.Id = u.Id;

COMMIT TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUsers u WHERE EXISTS (SELECT 1 FROM @Targets t WHERE u.Email LIKE t.Pattern)) AS usersAfter,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorSessions s INNER JOIN dbo.MoveAdvisorUsers u ON u.Id = s.UserId WHERE EXISTS (SELECT 1 FROM @Targets t WHERE u.Email LIKE t.Pattern)) AS sessionsAfter,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserPreferences p WHERE EXISTS (SELECT 1 FROM @Targets t WHERE p.UserEmail LIKE t.Pattern)) AS preferencesAfter,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserSavedComparisons c WHERE EXISTS (SELECT 1 FROM @Targets t WHERE c.UserEmail LIKE t.Pattern)) AS savedComparisonsAfter,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserMarketAlertStatus st WHERE EXISTS (SELECT 1 FROM @Targets t WHERE st.UserEmail LIKE t.Pattern)) AS marketAlertStatusAfter,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorUserMarketAlerts a WHERE EXISTS (SELECT 1 FROM @Targets t WHERE a.UserEmail LIKE t.Pattern)) AS marketAlertsAfter
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`;
}

function run() {
  const patterns = getPatterns();
  console.log(`[cleanup-test-users] SQL Server: ${MSSQL_SERVER} / ${MSSQL_DATABASE}`);
  console.log(`[cleanup-test-users] Auth: ${MSSQL_USER ? "sql-login" : "windows-auth"}`);
  console.log(`[cleanup-test-users] Patterns: ${patterns.join(", ")}`);

  const sql = buildCleanupSql(patterns);
  const raw = runSqlFile(sql);
  const jsonMatches = String(raw || "").match(/\{[\s\S]*?\}/g) || [];

  if (jsonMatches.length < 2) {
    throw new Error("No se pudo leer el resumen JSON de la limpieza SQL.");
  }

  const before = parseJsonFromSqlcmd(jsonMatches[0]);
  const after = parseJsonFromSqlcmd(jsonMatches[1]);

  console.log(JSON.stringify({ before, after }, null, 2));
}

try {
  run();
} catch (error) {
  console.error("[cleanup-test-users] FAIL:", error?.message || error);
  process.exit(1);
}