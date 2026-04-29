const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SQLSERVER_MOBILITY_SCHEMA_PATH = path.join(__dirname, "..", "db", "sqlserver", "init-moveadvisor-mobility.sql");

let _sqlServerSchemaEnsured = false;
const MAX_ATTACHMENT_CONTENT_LENGTH = 2_800_000;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function toEsDateTimeText(value) {
  try {
    return new Date(value || Date.now()).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getAuthProvider() {
  const provider = normalizeText(process.env.AUTH_PROVIDER).toLowerCase();

  if (["mssql", "sqlserver"].includes(provider)) {
    return "mssql";
  }

  if (["sqlcmd-windows", "windows", "mssql-windows"].includes(provider)) {
    return "sqlcmd-windows";
  }

  return provider || "";
}

function shouldUseSqlServerMobility() {
  return ["sqlcmd-windows", "mssql"].includes(getAuthProvider());
}

function escapeSqlValue(value) {
  return String(value || "").replace(/'/g, "''");
}

function sqlString(value) {
  return `N'${escapeSqlValue(value)}'`;
}

function getSqlcmdPath() {
  return normalizeText(process.env.SQLCMD_PATH) || "sqlcmd";
}

function getSqlcmdConnectionArgs(database) {
  const server = normalizeText(process.env.MSSQL_SERVER) || "localhost\\SQLEXPRESS";
  const dbName = normalizeText(database) || normalizeText(process.env.MSSQL_DATABASE) || "Mobilityadvisor";
  const user = normalizeText(process.env.MSSQL_USER);
  const password = String(process.env.MSSQL_PASSWORD || "");

  if (user) {
    return ["-S", server, "-d", dbName, "-U", user, "-P", password, "-b", "-y", "0"];
  }

  return ["-S", server, "-d", dbName, "-E", "-b", "-y", "0"];
}

function runSqlcmd(query, { database } = {}) {
  const normalizedQuery = String(query || "");

  if (normalizedQuery.length > 3500 || normalizedQuery.includes('"')) {
    const tempFilePath = path.join(__dirname, "..", "db", "sqlserver", `tmp-mobility-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);

    try {
      fs.writeFileSync(tempFilePath, normalizedQuery, "utf8");
      return runSqlcmdFile(tempFilePath, { database });
    } finally {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
    }
  }

  const args = [...getSqlcmdConnectionArgs(database), "-Q", query];

  try {
    return execFileSync(getSqlcmdPath(), args, { encoding: "utf8" });
  } catch (error) {
    const stderr = normalizeText(error?.stderr || "");
    const stdout = normalizeText(error?.stdout || "");
    throw new Error(stderr || stdout || "Error ejecutando sqlcmd contra SQL Server.");
  }
}

function runSqlcmdFile(filePath, { database } = {}) {
  const args = [...getSqlcmdConnectionArgs(database), "-i", filePath];

  try {
    return execFileSync(getSqlcmdPath(), args, { encoding: "utf8" });
  } catch (error) {
    const stderr = normalizeText(error?.stderr || "");
    const stdout = normalizeText(error?.stdout || "");
    throw new Error(stderr || stdout || "Error ejecutando script SQL con sqlcmd.");
  }
}

function parseSqlcmdJsonOutput(rawOutput = "") {
  const output = String(rawOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("");
  const firstJsonChar = output.search(/[\[{]/);

  if (firstJsonChar === -1) {
    return null;
  }

  const jsonStart = output[firstJsonChar];
  const jsonEnd = jsonStart === "[" ? "]" : "}";
  const lastJsonChar = output.lastIndexOf(jsonEnd);

  if (lastJsonChar === -1 || lastJsonChar < firstJsonChar) {
    return null;
  }

  const jsonChunk = output.slice(firstJsonChar, lastJsonChar + 1).trim();

  try {
    return JSON.parse(jsonChunk);
  } catch {
    return null;
  }
}

function ensureSqlServerMobilitySchema() {
  if (_sqlServerSchemaEnsured) {
    return;
  }

  if (!fs.existsSync(SQLSERVER_MOBILITY_SCHEMA_PATH)) {
    throw new Error("No se encuentra db/sqlserver/init-moveadvisor-mobility.sql");
  }

  runSqlcmdFile(SQLSERVER_MOBILITY_SCHEMA_PATH);
  _sqlServerSchemaEnsured = true;
}

function resolveSqlServerUserIdentity(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { normalizedEmail: "", userId: "" };
  }

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    IF OBJECT_ID(N'dbo.MoveAdvisorUsers', N'U') IS NOT NULL
    BEGIN
      SELECT TOP (1) Id AS [id]
      FROM dbo.MoveAdvisorUsers
      WHERE LOWER(Email) = LOWER(${sqlString(normalizedEmail)})
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
    END
    ELSE
    BEGIN
      SELECT CAST(NULL AS NVARCHAR(64)) AS [id]
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
    END
  `);

  const row = parseSqlcmdJsonOutput(output) || {};
  return {
    normalizedEmail,
    userId: normalizeText(row?.id),
  };
}

function sqlOwnershipClause(alias = "", userId = "", normalizedEmail = "") {
  const prefix = alias ? `${alias}.` : "";

  if (userId) {
    return `(${prefix}UserId = ${sqlString(userId)} OR (${prefix}UserId IS NULL AND ${prefix}UserEmail = ${sqlString(normalizedEmail)}))`;
  }

  return `${prefix}UserEmail = ${sqlString(normalizedEmail)}`;
}

function sanitizeGarageAttachment(input = {}) {
  let safeInput = input;

  if (typeof safeInput === "string") {
    try {
      safeInput = JSON.parse(safeInput);
    } catch {
      safeInput = { name: safeInput };
    }
  }

  if (!safeInput || typeof safeInput !== "object" || Array.isArray(safeInput)) {
    safeInput = {};
  }

  return {
    name: normalizeText(safeInput?.name),
    size: Number(safeInput?.size || 0),
    mimeType: normalizeText(safeInput?.mimeType),
    contentBase64: normalizeText(safeInput?.contentBase64).slice(0, MAX_ATTACHMENT_CONTENT_LENGTH),
  };
}

function sanitizeAttachmentArray(input, limit = 30) {
  let safeInput = input;

  if (typeof safeInput === "string") {
    try {
      safeInput = JSON.parse(safeInput);
    } catch {
      safeInput = [];
    }
  }

  if (!Array.isArray(safeInput)) {
    if (safeInput && typeof safeInput === "object") {
      safeInput = [safeInput];
    } else {
      safeInput = [];
    }
  }

  return safeInput
    .map((item) => sanitizeGarageAttachment(item))
    .filter((item) => item.name)
    .slice(0, limit);
}

function sanitizeGarageVehicle(input = {}) {
  const brand = normalizeText(input?.brand);
  const model = normalizeText(input?.model);
  const version = normalizeText(input?.version);
  const title = normalizeText(input?.title) || `${brand} ${model} ${version}`.trim();
  const photos = sanitizeAttachmentArray(input?.photos, 30);
  const documents = sanitizeAttachmentArray(input?.documents, 30);

  return {
    id: normalizeText(input?.id),
    title,
    brand,
    model,
    version,
    transmissionType: normalizeText(input?.transmissionType),
    cv: normalizeText(input?.cv),
    color: normalizeText(input?.color),
    horsepower: normalizeText(input?.horsepower),
    seats: normalizeText(input?.seats),
    doors: normalizeText(input?.doors),
    location: normalizeText(input?.location),
    bodyType: normalizeText(input?.bodyType),
    environmentalLabel: normalizeText(input?.environmentalLabel),
    lastIvt: normalizeText(input?.lastIvt),
    nextIvt: normalizeText(input?.nextIvt),
    co2: normalizeText(input?.co2),
    price: normalizeText(input?.price),
    marketplacePricingMode: ["manual", "valuation"].includes(normalizeText(input?.marketplacePricingMode).toLowerCase())
      ? normalizeText(input?.marketplacePricingMode).toLowerCase()
      : "manual",
    year: normalizeText(input?.year),
    plate: normalizeText(input?.plate),
    mileage: normalizeText(input?.mileage),
    fuel: normalizeText(input?.fuel),
    policyCompany: normalizeText(input?.policyCompany),
    policyNumber: normalizeText(input?.policyNumber),
    coverageType: normalizeText(input?.coverageType),
    notes: normalizeText(input?.notes),
    photos: photos.slice(0, 30),
    documents: documents.slice(0, 30),
    technicalSheetDocuments: sanitizeAttachmentArray(input?.technicalSheetDocuments),
    circulationPermitDocuments: sanitizeAttachmentArray(input?.circulationPermitDocuments),
    itvDocuments: sanitizeAttachmentArray(input?.itvDocuments),
    insuranceDocuments: sanitizeAttachmentArray(input?.insuranceDocuments),
    initialMaintenance: {
      type: normalizeText(input?.initialMaintenance?.type || "maintenance"),
      title: normalizeText(input?.initialMaintenance?.title),
      notes: normalizeText(input?.initialMaintenance?.notes),
      invoices: sanitizeAttachmentArray(input?.initialMaintenance?.invoices),
    },
    createdAt: normalizeText(input?.createdAt) || new Date().toISOString(),
  };
}

function listGarageVehiclesByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const vehiclesOutput = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      Id AS [id],
      Title AS [title],
      Brand AS [brand],
      Model AS [model],
      [Version] AS [version],
      TransmissionType AS [transmissionType],
      Cv AS [cv],
      Color AS [color],
      Horsepower AS [horsepower],
      Seats AS [seats],
      Doors AS [doors],
      VehicleLocation AS [location],
      BodyType AS [bodyType],
      EnvironmentalLabel AS [environmentalLabel],
      LastIvt AS [lastIvt],
      NextIvt AS [nextIvt],
      Co2 AS [co2],
      Price AS [price],
      MarketplacePricingMode AS [marketplacePricingMode],
      [Year] AS [year],
      Plate AS [plate],
      Mileage AS [mileage],
      Fuel AS [fuel],
      PolicyCompany AS [policyCompany],
      Notes AS [notes],
      CreatedAt AS [createdAt]
    FROM dbo.MoveAdvisorUserVehicles
    WHERE ${sqlOwnershipClause("", userId, normalizedEmail)}
    ORDER BY CreatedAt DESC
    FOR JSON PATH;
  `);

  const vehicles = Array.isArray(parseSqlcmdJsonOutput(vehiclesOutput)) ? parseSqlcmdJsonOutput(vehiclesOutput) : [];

  if (vehicles.length === 0) {
    return [];
  }

  const filesOutput = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      f.VehicleId AS [vehicleId],
      f.FileType AS [fileType],
      f.FileName AS [fileName],
      f.FileSize AS [fileSize],
      f.FileMimeType AS [mimeType],
      f.FileContentBase64 AS [contentBase64]
    FROM dbo.MoveAdvisorUserVehicleFiles f
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = f.VehicleId
    WHERE ${sqlOwnershipClause("v", userId, normalizedEmail)}
    ORDER BY f.Id ASC
    FOR JSON PATH;
  `);

  const files = Array.isArray(parseSqlcmdJsonOutput(filesOutput)) ? parseSqlcmdJsonOutput(filesOutput) : [];

  const vehicleDocumentsOutput = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      d.VehicleId AS [vehicleId],
      d.DocumentType AS [documentType],
      d.FileName AS [fileName],
      d.FileSize AS [fileSize],
      d.FileMimeType AS [mimeType],
      d.FileContentBase64 AS [contentBase64]
    FROM dbo.MoveAdvisorUserVehicleDocuments d
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = d.VehicleId
    WHERE ${sqlOwnershipClause("v", userId, normalizedEmail)}
    ORDER BY d.Id ASC
    FOR JSON PATH;
  `);

  const vehicleDocuments = Array.isArray(parseSqlcmdJsonOutput(vehicleDocumentsOutput)) ? parseSqlcmdJsonOutput(vehicleDocumentsOutput) : [];

  const insurancesOutput = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      i.VehicleId AS [vehicleId],
      i.PolicyNumber AS [policyNumber],
      i.CoverageType AS [coverageType]
    FROM dbo.MoveAdvisorUserInsurances i
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = i.VehicleId
    WHERE ${sqlOwnershipClause("v", userId, normalizedEmail)}
    FOR JSON PATH;
  `);

  const insurances = Array.isArray(parseSqlcmdJsonOutput(insurancesOutput)) ? parseSqlcmdJsonOutput(insurancesOutput) : [];

  const insuranceDocsOutput = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      i.VehicleId AS [vehicleId],
      d.FileName AS [fileName],
      d.FileSize AS [fileSize],
      d.FileMimeType AS [mimeType],
      d.FileContentBase64 AS [contentBase64]
    FROM dbo.MoveAdvisorUserInsuranceDocuments d
    INNER JOIN dbo.MoveAdvisorUserInsurances i ON i.Id = d.InsuranceId
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = i.VehicleId
    WHERE ${sqlOwnershipClause("v", userId, normalizedEmail)}
    ORDER BY d.Id ASC
    FOR JSON PATH;
  `);

  const insuranceDocs = Array.isArray(parseSqlcmdJsonOutput(insuranceDocsOutput)) ? parseSqlcmdJsonOutput(insuranceDocsOutput) : [];

  const insuranceByVehicle = insurances.reduce((acc, row) => {
    const key = normalizeText(row?.vehicleId);
    if (key) {
      acc[key] = { policyNumber: normalizeText(row?.policyNumber), coverageType: normalizeText(row?.coverageType) };
    }
    return acc;
  }, {});

  const insuranceDocsByVehicle = insuranceDocs.reduce((acc, row) => {
    const key = normalizeText(row?.vehicleId);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    const doc = { name: normalizeText(row?.fileName), size: Number(row?.fileSize || 0), mimeType: normalizeText(row?.mimeType), contentBase64: normalizeText(row?.contentBase64) };
    if (doc.name) acc[key].push(doc);
    return acc;
  }, {});

  const filesByVehicle = files.reduce((acc, row) => {
    const key = normalizeText(row?.vehicleId);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = { photos: [], documents: [] };
    }

    const attachment = {
      name: normalizeText(row?.fileName),
      size: Number(row?.fileSize || 0),
      mimeType: normalizeText(row?.mimeType),
      contentBase64: normalizeText(row?.contentBase64),
    };

    if (!attachment.name) {
      return acc;
    }

    if (normalizeText(row?.fileType) === "photo") {
      acc[key].photos.push(attachment);
    } else {
      acc[key].documents.push(attachment);
    }

    return acc;
  }, {});

  const typedDocumentsByVehicle = vehicleDocuments.reduce((acc, row) => {
    const key = normalizeText(row?.vehicleId);
    const type = normalizeText(row?.documentType);
    if (!key || !type) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = { technicalSheetDocuments: [], circulationPermitDocuments: [], itvDocuments: [] };
    }

    const doc = {
      name: normalizeText(row?.fileName),
      size: Number(row?.fileSize || 0),
      mimeType: normalizeText(row?.mimeType),
      contentBase64: normalizeText(row?.contentBase64),
    };

    if (!doc.name) {
      return acc;
    }

    if (type === "technical_sheet") {
      acc[key].technicalSheetDocuments.push(doc);
    } else if (type === "circulation_permit") {
      acc[key].circulationPermitDocuments.push(doc);
    } else if (type === "itv") {
      acc[key].itvDocuments.push(doc);
    }

    return acc;
  }, {});

  return vehicles.map((row) => {
    const key = normalizeText(row?.id);
    const grouped = filesByVehicle[key] || { photos: [], documents: [] };
    const typedDocuments = typedDocumentsByVehicle[key] || {
      technicalSheetDocuments: [],
      circulationPermitDocuments: [],
      itvDocuments: [],
    };
    const ins = insuranceByVehicle[key] || {};
    return sanitizeGarageVehicle({
      id: row?.id,
      title: row?.title,
      brand: row?.brand,
      model: row?.model,
      version: row?.version,
      transmissionType: row?.transmissionType,
      cv: row?.cv,
      color: row?.color,
      horsepower: row?.horsepower,
      seats: row?.seats,
      doors: row?.doors,
      location: row?.location,
      bodyType: row?.bodyType,
      environmentalLabel: row?.environmentalLabel,
      lastIvt: row?.lastIvt,
      nextIvt: row?.nextIvt,
      co2: row?.co2,
      price: row?.price,
      marketplacePricingMode: row?.marketplacePricingMode,
      year: row?.year,
      plate: row?.plate,
      mileage: row?.mileage,
      fuel: row?.fuel,
      policyCompany: row?.policyCompany,
      policyNumber: ins.policyNumber || "",
      coverageType: ins.coverageType || "",
      notes: row?.notes,
      photos: grouped.photos,
      documents: grouped.documents,
      technicalSheetDocuments: typedDocuments.technicalSheetDocuments,
      circulationPermitDocuments: typedDocuments.circulationPermitDocuments,
      itvDocuments: typedDocuments.itvDocuments,
      insuranceDocuments: insuranceDocsByVehicle[key] || [],
      createdAt: row?.createdAt,
    });
  });
}

function addGarageVehicleByEmailSqlServer(email = "", vehicle = {}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedVehicle = sanitizeGarageVehicle(vehicle);

  if (!normalizedEmail || !normalizedVehicle.brand || !normalizedVehicle.model || !normalizedVehicle.version) {
    return listGarageVehiclesByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const vehicleId = normalizedVehicle.id || `garage-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const statements = [
    "SET NOCOUNT ON;",
    `IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserVehicles WHERE Id = ${sqlString(vehicleId)})`,
    "BEGIN",
    `  UPDATE dbo.MoveAdvisorUserVehicles
       SET UserEmail = ${sqlString(normalizedEmail)},
         UserId = ${userId ? sqlString(userId) : "NULL"},
           Title = ${sqlString(normalizedVehicle.title)},
           Brand = ${sqlString(normalizedVehicle.brand)},
           Model = ${sqlString(normalizedVehicle.model)},
           [Version] = ${sqlString(normalizedVehicle.version)},
           TransmissionType = ${sqlString(normalizedVehicle.transmissionType)},
           Cv = ${sqlString(normalizedVehicle.cv)},
           Color = ${sqlString(normalizedVehicle.color)},
           Horsepower = ${sqlString(normalizedVehicle.horsepower)},
           Seats = ${sqlString(normalizedVehicle.seats)},
           Doors = ${sqlString(normalizedVehicle.doors)},
           VehicleLocation = ${sqlString(normalizedVehicle.location)},
           BodyType = ${sqlString(normalizedVehicle.bodyType)},
           EnvironmentalLabel = ${sqlString(normalizedVehicle.environmentalLabel)},
           LastIvt = ${sqlString(normalizedVehicle.lastIvt)},
           NextIvt = ${sqlString(normalizedVehicle.nextIvt)},
           Co2 = ${sqlString(normalizedVehicle.co2)},
           Price = ${sqlString(normalizedVehicle.price)},
           MarketplacePricingMode = ${sqlString(normalizedVehicle.marketplacePricingMode)},
           [Year] = ${sqlString(normalizedVehicle.year)},
           Plate = ${sqlString(normalizedVehicle.plate)},
           Mileage = ${sqlString(normalizedVehicle.mileage)},
           Fuel = ${sqlString(normalizedVehicle.fuel)},
           PolicyCompany = ${sqlString(normalizedVehicle.policyCompany)},
           Notes = ${sqlString(normalizedVehicle.notes)},
           UpdatedAt = ${sqlString(nowIso)}
     WHERE Id = ${sqlString(vehicleId)};`,
    "END",
    "ELSE",
    "BEGIN",
    `  INSERT INTO dbo.MoveAdvisorUserVehicles
         (Id, UserEmail, UserId, Title, Brand, Model, [Version], TransmissionType, Cv, Color, Horsepower, Seats, Doors, VehicleLocation, BodyType, EnvironmentalLabel, LastIvt, NextIvt, Co2, Price, MarketplacePricingMode, [Year], Plate, Mileage, Fuel, PolicyCompany, Notes, CreatedAt, UpdatedAt)
       VALUES
         (${sqlString(vehicleId)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${sqlString(normalizedVehicle.title)},
          ${sqlString(normalizedVehicle.brand)}, ${sqlString(normalizedVehicle.model)}, ${sqlString(normalizedVehicle.version)},
          ${sqlString(normalizedVehicle.transmissionType)}, ${sqlString(normalizedVehicle.cv)}, ${sqlString(normalizedVehicle.color)},
          ${sqlString(normalizedVehicle.horsepower)}, ${sqlString(normalizedVehicle.seats)}, ${sqlString(normalizedVehicle.doors)},
          ${sqlString(normalizedVehicle.location)}, ${sqlString(normalizedVehicle.bodyType)}, ${sqlString(normalizedVehicle.environmentalLabel)},
          ${sqlString(normalizedVehicle.lastIvt)}, ${sqlString(normalizedVehicle.nextIvt)}, ${sqlString(normalizedVehicle.co2)}, ${sqlString(normalizedVehicle.price)}, ${sqlString(normalizedVehicle.marketplacePricingMode)}, ${sqlString(normalizedVehicle.year)},
          ${sqlString(normalizedVehicle.plate)}, ${sqlString(normalizedVehicle.mileage)}, ${sqlString(normalizedVehicle.fuel)},
          ${sqlString(normalizedVehicle.policyCompany)}, ${sqlString(normalizedVehicle.notes)}, ${sqlString(nowIso)}, ${sqlString(nowIso)});`,
    "END",
    `DELETE FROM dbo.MoveAdvisorUserVehicleFiles WHERE VehicleId = ${sqlString(vehicleId)};`,
    `DELETE FROM dbo.MoveAdvisorUserVehicleDocuments WHERE VehicleId = ${sqlString(vehicleId)};`,
  ];

  const photos = Array.isArray(normalizedVehicle.photos) ? normalizedVehicle.photos : [];
  const documents = Array.isArray(normalizedVehicle.documents) ? normalizedVehicle.documents : [];

  photos.forEach((photo) => {
    if (!normalizeText(photo?.name)) {
      return;
    }

    statements.push(`
      INSERT INTO dbo.MoveAdvisorUserVehicleFiles (VehicleId, FileType, FileName, FileSize, FileMimeType, FileContentBase64, CreatedAt)
      VALUES (${sqlString(vehicleId)}, N'photo', ${sqlString(photo.name)}, ${Number(photo.size || 0)}, ${sqlString(normalizeText(photo.mimeType))}, ${sqlString(normalizeText(photo.contentBase64))}, ${sqlString(nowIso)});
    `);
  });

  documents.forEach((document) => {
    if (!normalizeText(document?.name)) {
      return;
    }

    statements.push(`
      INSERT INTO dbo.MoveAdvisorUserVehicleFiles (VehicleId, FileType, FileName, FileSize, FileMimeType, FileContentBase64, CreatedAt)
      VALUES (${sqlString(vehicleId)}, N'document', ${sqlString(document.name)}, ${Number(document.size || 0)}, ${sqlString(normalizeText(document.mimeType))}, ${sqlString(normalizeText(document.contentBase64))}, ${sqlString(nowIso)});
    `);
  });

  const technicalSheetDocuments = sanitizeAttachmentArray(normalizedVehicle.technicalSheetDocuments);
  const circulationPermitDocuments = sanitizeAttachmentArray(normalizedVehicle.circulationPermitDocuments);
  const itvDocuments = sanitizeAttachmentArray(normalizedVehicle.itvDocuments);

  technicalSheetDocuments.forEach((document) => {
    statements.push(`
      INSERT INTO dbo.MoveAdvisorUserVehicleDocuments (VehicleId, DocumentType, FileName, FileSize, FileMimeType, FileContentBase64, CreatedAt)
      VALUES (${sqlString(vehicleId)}, N'technical_sheet', ${sqlString(document.name)}, ${Number(document.size || 0)}, ${sqlString(normalizeText(document.mimeType))}, ${sqlString(normalizeText(document.contentBase64))}, ${sqlString(nowIso)});
    `);
  });

  circulationPermitDocuments.forEach((document) => {
    statements.push(`
      INSERT INTO dbo.MoveAdvisorUserVehicleDocuments (VehicleId, DocumentType, FileName, FileSize, FileMimeType, FileContentBase64, CreatedAt)
      VALUES (${sqlString(vehicleId)}, N'circulation_permit', ${sqlString(document.name)}, ${Number(document.size || 0)}, ${sqlString(normalizeText(document.mimeType))}, ${sqlString(normalizeText(document.contentBase64))}, ${sqlString(nowIso)});
    `);
  });

  itvDocuments.forEach((document) => {
    statements.push(`
      INSERT INTO dbo.MoveAdvisorUserVehicleDocuments (VehicleId, DocumentType, FileName, FileSize, FileMimeType, FileContentBase64, CreatedAt)
      VALUES (${sqlString(vehicleId)}, N'itv', ${sqlString(document.name)}, ${Number(document.size || 0)}, ${sqlString(normalizeText(document.mimeType))}, ${sqlString(normalizeText(document.contentBase64))}, ${sqlString(nowIso)});
    `);
  });

  runSqlcmd(statements.join("\n"));

  if (normalizedVehicle.policyCompany || normalizedVehicle.policyNumber || normalizedVehicle.coverageType || (normalizedVehicle.insuranceDocuments || []).length) {
    upsertInsuranceByEmailSqlServer(normalizedEmail, {
      id: `ins-${vehicleId}`,
      vehicleId,
      provider: normalizedVehicle.policyCompany,
      policyNumber: normalizedVehicle.policyNumber,
      coverageType: normalizedVehicle.coverageType,
      documents: normalizedVehicle.insuranceDocuments,
      status: "active",
    });
  }

  if (normalizedVehicle.initialMaintenance?.title || (normalizedVehicle.initialMaintenance?.invoices || []).length) {
    addMaintenanceByEmailSqlServer(normalizedEmail, {
      vehicleId,
      type: normalizeText(normalizedVehicle.initialMaintenance?.type || "maintenance"),
      title: normalizeText(normalizedVehicle.initialMaintenance?.title || "Mantenimiento"),
      notes: normalizeText(normalizedVehicle.initialMaintenance?.notes),
      invoices: normalizedVehicle.initialMaintenance?.invoices,
      status: "Pendiente",
    });
  }

  return listGarageVehiclesByEmailSqlServer(normalizedEmail);
}

function removeGarageVehicleByEmailSqlServer(email = "", vehicleId = "") {
  const normalizedEmail = normalizeEmail(email);
  const normalizedVehicleId = normalizeText(vehicleId);

  if (!normalizedEmail || !normalizedVehicleId) {
    return listGarageVehiclesByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  runSqlcmd(`
    SET NOCOUNT ON;
    DELETE FROM dbo.MoveAdvisorUserVehicles
    WHERE Id = ${sqlString(normalizedVehicleId)} AND ${sqlOwnershipClause("", userId, normalizedEmail)};
  `);

  return listGarageVehiclesByEmailSqlServer(normalizedEmail);
}

function listAppointmentsByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      a.Id AS [id],
      a.AppointmentType AS [type],
      a.Title AS [title],
      a.Meta AS [meta],
      a.Status AS [status],
      a.RequestedAtText AS [requestedAt],
      a.VehicleId AS [vehicleId],
      v.Title AS [vehicleTitle],
      v.Plate AS [vehiclePlate]
    FROM dbo.MoveAdvisorUserAppointments a
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = a.VehicleId
    WHERE ${sqlOwnershipClause("a", userId, normalizedEmail)}
    ORDER BY a.CreatedAt DESC
    FOR JSON PATH;
  `);

  const rows = Array.isArray(parseSqlcmdJsonOutput(output)) ? parseSqlcmdJsonOutput(output) : [];

  const appointmentIds = rows.map((row) => normalizeText(row?.id)).filter(Boolean);
  const historyOutput = appointmentIds.length
    ? runSqlcmd(`
        SET NOCOUNT ON;
        SELECT
          AppointmentId AS [appointmentId],
          PreviousStatus AS [previousStatus],
          NextStatus AS [nextStatus],
          ChangedAt AS [changedAt]
        FROM dbo.MoveAdvisorUserAppointmentStatusHistory
        WHERE AppointmentId IN (${appointmentIds.map((id) => sqlString(id)).join(",")})
        ORDER BY ChangedAt DESC
        FOR JSON PATH;
      `)
    : "[]";

  const historyRows = Array.isArray(parseSqlcmdJsonOutput(historyOutput)) ? parseSqlcmdJsonOutput(historyOutput) : [];
  const historyByAppointmentId = historyRows.reduce((acc, row) => {
    const key = normalizeText(row?.appointmentId);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push({
      previousStatus: normalizeText(row?.previousStatus),
      nextStatus: normalizeText(row?.nextStatus),
      changedAt: normalizeText(row?.changedAt),
    });

    return acc;
  }, {});

  const insuranceIds = rows.map((row) => normalizeText(row?.id)).filter(Boolean);
  const documentsOutput = insuranceIds.length
    ? runSqlcmd(`
        SET NOCOUNT ON;
        SELECT InsuranceId AS [insuranceId], FileName AS [fileName], FileSize AS [fileSize], FileMimeType AS [mimeType], FileContentBase64 AS [contentBase64]
        FROM dbo.MoveAdvisorUserInsuranceDocuments
        WHERE InsuranceId IN (${insuranceIds.map((id) => sqlString(id)).join(",")})
        ORDER BY Id ASC
        FOR JSON PATH;
      `)
    : "[]";

  const insuranceDocuments = Array.isArray(parseSqlcmdJsonOutput(documentsOutput)) ? parseSqlcmdJsonOutput(documentsOutput) : [];
  const documentsByInsuranceId = insuranceDocuments.reduce((acc, row) => {
    const key = normalizeText(row?.insuranceId);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const doc = {
      name: normalizeText(row?.fileName),
      size: Number(row?.fileSize || 0),
      mimeType: normalizeText(row?.mimeType),
      contentBase64: normalizeText(row?.contentBase64),
    };
    if (doc.name) {
      acc[key].push(doc);
    }

    return acc;
  }, {});

  return rows.map((row) => ({
    id: normalizeText(row?.id),
    type: normalizeText(row?.type),
    title: normalizeText(row?.title),
    meta: normalizeText(row?.meta),
    status: normalizeText(row?.status),
    requestedAt: normalizeText(row?.requestedAt),
    vehicleId: normalizeText(row?.vehicleId),
    vehicleTitle: normalizeText(row?.vehicleTitle),
    vehiclePlate: normalizeText(row?.vehiclePlate),
    statusHistory: historyByAppointmentId[normalizeText(row?.id)] || [],
  }));
}

function addAppointmentByEmailSqlServer(email = "", appointment = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(appointment?.vehicleId);

  if (!normalizedEmail || !vehicleId) {
    return listAppointmentsByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const id = normalizeText(appointment?.id) || `appt-${Date.now()}`;
  const appointmentType = normalizeText(appointment?.type || "workshop") || "workshop";
  const nowIso = new Date().toISOString();
  const nextStatus = normalizeText(appointment?.status || "Pendiente");

  const previousStatusOutput = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT TOP (1) Status AS [status]
    FROM dbo.MoveAdvisorUserAppointments
    WHERE Id = ${sqlString(id)}
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);
  const previousStatusRow = parseSqlcmdJsonOutput(previousStatusOutput) || {};
  const previousStatus = normalizeText(previousStatusRow?.status);

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserVehicles WHERE Id = ${sqlString(vehicleId)} AND ${sqlOwnershipClause("", userId, normalizedEmail)})
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserAppointments WHERE Id = ${sqlString(id)})
      BEGIN
        UPDATE dbo.MoveAdvisorUserAppointments
        SET UserEmail = ${sqlString(normalizedEmail)},
            UserId = ${userId ? sqlString(userId) : "NULL"},
            VehicleId = ${sqlString(vehicleId)},
            AppointmentType = ${sqlString(appointmentType)},
            Title = ${sqlString(normalizeText(appointment?.title || "Cita"))},
            Meta = ${sqlString(normalizeText(appointment?.meta))},
            Status = ${sqlString(nextStatus)},
            RequestedAtText = ${sqlString(normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso))},
            UpdatedAt = ${sqlString(nowIso)}
        WHERE Id = ${sqlString(id)};
      END
      ELSE
      BEGIN
        INSERT INTO dbo.MoveAdvisorUserAppointments
          (Id, UserEmail, UserId, VehicleId, AppointmentType, Title, Meta, Status, RequestedAtText, CreatedAt, UpdatedAt)
        VALUES
          (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${sqlString(vehicleId)}, ${sqlString(appointmentType)},
           ${sqlString(normalizeText(appointment?.title || "Cita"))}, ${sqlString(normalizeText(appointment?.meta))},
           ${sqlString(nextStatus)}, ${sqlString(normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso))},
           ${sqlString(nowIso)}, ${sqlString(nowIso)});
      END
    END
  `);

  if (previousStatus && previousStatus !== nextStatus) {
    runSqlcmd(`
      SET NOCOUNT ON;
      INSERT INTO dbo.MoveAdvisorUserAppointmentStatusHistory
        (AppointmentId, PreviousStatus, NextStatus, ChangedAt)
      VALUES
        (${sqlString(id)}, ${sqlString(previousStatus)}, ${sqlString(nextStatus)}, ${sqlString(nowIso)});
    `);
  }

  if (appointmentType === "maintenance") {
    addMaintenanceByEmailSqlServer(normalizedEmail, {
      id: `mnt-${id}`,
      vehicleId,
      type: "maintenance",
      title: normalizeText(appointment?.title || "Mantenimiento"),
      status: nextStatus,
      scheduledAt: normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso),
      notes: normalizeText(appointment?.meta),
    });
  }

  if (appointmentType === "insurance") {
    upsertInsuranceByEmailSqlServer(normalizedEmail, {
      id: `ins-${vehicleId}`,
      vehicleId,
      status: "active",
      renewalAt: normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso),
      notes: normalizeText(appointment?.meta),
    });
  }

  return listAppointmentsByEmailSqlServer(normalizedEmail);
}

function listMaintenancesByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      m.Id AS [id],
      m.VehicleId AS [vehicleId],
      v.Title AS [vehicleTitle],
      v.Plate AS [vehiclePlate],
      m.MaintenanceType AS [type],
      m.Title AS [title],
      m.Status AS [status],
      m.ScheduledAtText AS [scheduledAt],
      m.WorkshopName AS [workshopName],
      m.MileageText AS [mileage],
      m.EstimatedCost AS [estimatedCost],
      m.Notes AS [notes]
    FROM dbo.MoveAdvisorUserMaintenances m
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = m.VehicleId
    WHERE ${sqlOwnershipClause("m", userId, normalizedEmail)}
    ORDER BY m.CreatedAt DESC
    FOR JSON PATH;
  `);

  const rows = Array.isArray(parseSqlcmdJsonOutput(output)) ? parseSqlcmdJsonOutput(output) : [];

  const maintenanceIds = rows.map((row) => normalizeText(row?.id)).filter(Boolean);
  const invoicesOutput = maintenanceIds.length
    ? runSqlcmd(`
        SET NOCOUNT ON;
        SELECT MaintenanceId AS [maintenanceId], FileName AS [fileName], FileSize AS [fileSize], FileMimeType AS [mimeType], FileContentBase64 AS [contentBase64]
        FROM dbo.MoveAdvisorUserMaintenanceInvoices
        WHERE MaintenanceId IN (${maintenanceIds.map((id) => sqlString(id)).join(",")})
        ORDER BY Id ASC
        FOR JSON PATH;
      `)
    : "[]";

  const invoices = Array.isArray(parseSqlcmdJsonOutput(invoicesOutput)) ? parseSqlcmdJsonOutput(invoicesOutput) : [];
  const invoicesByMaintenanceId = invoices.reduce((acc, row) => {
    const key = normalizeText(row?.maintenanceId);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const invoice = {
      name: normalizeText(row?.fileName),
      size: Number(row?.fileSize || 0),
      mimeType: normalizeText(row?.mimeType),
      contentBase64: normalizeText(row?.contentBase64),
    };
    if (invoice.name) {
      acc[key].push(invoice);
    }

    return acc;
  }, {});

  return rows.map((row) => ({
    id: normalizeText(row?.id),
    vehicleId: normalizeText(row?.vehicleId),
    vehicleTitle: normalizeText(row?.vehicleTitle),
    vehiclePlate: normalizeText(row?.vehiclePlate),
    type: normalizeText(row?.type),
    title: normalizeText(row?.title),
    status: normalizeText(row?.status),
    scheduledAt: normalizeText(row?.scheduledAt),
    workshopName: normalizeText(row?.workshopName),
    mileage: normalizeText(row?.mileage),
    estimatedCost: Number(row?.estimatedCost || 0),
    notes: normalizeText(row?.notes),
    invoices: invoicesByMaintenanceId[normalizeText(row?.id)] || [],
  }));
}

function addMaintenanceByEmailSqlServer(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(payload?.vehicleId);

  if (!normalizedEmail || !vehicleId) {
    return listMaintenancesByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const id = normalizeText(payload?.id) || `mnt-${Date.now()}`;
  const nowIso = new Date().toISOString();

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserVehicles WHERE Id = ${sqlString(vehicleId)} AND ${sqlOwnershipClause("", userId, normalizedEmail)})
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserMaintenances WHERE Id = ${sqlString(id)})
      BEGIN
        UPDATE dbo.MoveAdvisorUserMaintenances
        SET UserEmail = ${sqlString(normalizedEmail)},
            UserId = ${userId ? sqlString(userId) : "NULL"},
            VehicleId = ${sqlString(vehicleId)},
            MaintenanceType = ${sqlString(normalizeText(payload?.type || "maintenance"))},
            Title = ${sqlString(normalizeText(payload?.title || "Mantenimiento"))},
            Status = ${sqlString(normalizeText(payload?.status || "Pendiente"))},
            ScheduledAtText = ${sqlString(normalizeText(payload?.scheduledAt))},
            WorkshopName = ${sqlString(normalizeText(payload?.workshopName))},
            MileageText = ${sqlString(normalizeText(payload?.mileage))},
            EstimatedCost = ${Number(payload?.estimatedCost || 0) || "NULL"},
            Notes = ${sqlString(normalizeText(payload?.notes))},
            UpdatedAt = ${sqlString(nowIso)}
        WHERE Id = ${sqlString(id)};
      END
      ELSE
      BEGIN
        INSERT INTO dbo.MoveAdvisorUserMaintenances
          (Id, UserEmail, UserId, VehicleId, MaintenanceType, Title, Status, ScheduledAtText, WorkshopName, MileageText, EstimatedCost, Notes, CreatedAt, UpdatedAt)
        VALUES
          (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${sqlString(vehicleId)}, ${sqlString(normalizeText(payload?.type || "maintenance"))},
           ${sqlString(normalizeText(payload?.title || "Mantenimiento"))}, ${sqlString(normalizeText(payload?.status || "Pendiente"))},
           ${sqlString(normalizeText(payload?.scheduledAt))}, ${sqlString(normalizeText(payload?.workshopName))}, ${sqlString(normalizeText(payload?.mileage))},
           ${Number(payload?.estimatedCost || 0) || "NULL"}, ${sqlString(normalizeText(payload?.notes))}, ${sqlString(nowIso)}, ${sqlString(nowIso)});
      END
    END
  `);

  runSqlcmd(`
    SET NOCOUNT ON;
    DELETE FROM dbo.MoveAdvisorUserMaintenanceInvoices WHERE MaintenanceId = ${sqlString(id)};
  `);

  const invoices = sanitizeAttachmentArray(payload?.invoices);
  invoices.forEach((invoice) => {
    runSqlcmd(`
      SET NOCOUNT ON;
      INSERT INTO dbo.MoveAdvisorUserMaintenanceInvoices (MaintenanceId, FileName, FileSize, FileMimeType, FileContentBase64, CreatedAt)
      VALUES (${sqlString(id)}, ${sqlString(invoice.name)}, ${Number(invoice.size || 0)}, ${sqlString(normalizeText(invoice.mimeType))}, ${sqlString(normalizeText(invoice.contentBase64))}, ${sqlString(nowIso)});
    `);
  });

  return listMaintenancesByEmailSqlServer(normalizedEmail);
}

function listInsurancesByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      i.Id AS [id],
      i.VehicleId AS [vehicleId],
      v.Title AS [vehicleTitle],
      v.Plate AS [vehiclePlate],
      i.Provider AS [provider],
      i.PolicyNumber AS [policyNumber],
      i.CoverageType AS [coverageType],
      i.Status AS [status],
      i.RenewalAtText AS [renewalAt],
      i.MonthlyPremium AS [monthlyPremium],
      i.Notes AS [notes]
    FROM dbo.MoveAdvisorUserInsurances i
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = i.VehicleId
    WHERE ${sqlOwnershipClause("i", userId, normalizedEmail)}
    ORDER BY i.UpdatedAt DESC
    FOR JSON PATH;
  `);

  const rows = Array.isArray(parseSqlcmdJsonOutput(output)) ? parseSqlcmdJsonOutput(output) : [];
  const insuranceIds = rows.map((row) => normalizeText(row?.id)).filter(Boolean);
  const documentsOutput = insuranceIds.length
    ? runSqlcmd(`
        SET NOCOUNT ON;
        SELECT
          InsuranceId AS [insuranceId],
          FileName AS [fileName],
          FileSize AS [fileSize],
          FileMimeType AS [mimeType],
          FileContentBase64 AS [contentBase64]
        FROM dbo.MoveAdvisorUserInsuranceDocuments
        WHERE InsuranceId IN (${insuranceIds.map((insuranceId) => sqlString(insuranceId)).join(",")})
        ORDER BY Id ASC
        FOR JSON PATH;
      `)
    : "[]";

  const insuranceDocuments = Array.isArray(parseSqlcmdJsonOutput(documentsOutput)) ? parseSqlcmdJsonOutput(documentsOutput) : [];
  const documentsByInsuranceId = insuranceDocuments.reduce((acc, row) => {
    const key = normalizeText(row?.insuranceId);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const doc = {
      name: normalizeText(row?.fileName),
      size: Number(row?.fileSize || 0),
      mimeType: normalizeText(row?.mimeType),
      contentBase64: normalizeText(row?.contentBase64),
    };

    if (doc.name) {
      acc[key].push(doc);
    }

    return acc;
  }, {});

  return rows.map((row) => ({
    id: normalizeText(row?.id),
    vehicleId: normalizeText(row?.vehicleId),
    vehicleTitle: normalizeText(row?.vehicleTitle),
    vehiclePlate: normalizeText(row?.vehiclePlate),
    provider: normalizeText(row?.provider),
    policyNumber: normalizeText(row?.policyNumber),
    coverageType: normalizeText(row?.coverageType),
    status: normalizeText(row?.status),
    renewalAt: normalizeText(row?.renewalAt),
    monthlyPremium: Number(row?.monthlyPremium || 0),
    notes: normalizeText(row?.notes),
    documents: documentsByInsuranceId[normalizeText(row?.id)] || [],
  }));
}

function upsertInsuranceByEmailSqlServer(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(payload?.vehicleId);

  if (!normalizedEmail || !vehicleId) {
    return listInsurancesByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const id = normalizeText(payload?.id) || `ins-${vehicleId}`;
  const nowIso = new Date().toISOString();

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserVehicles WHERE Id = ${sqlString(vehicleId)} AND ${sqlOwnershipClause("", userId, normalizedEmail)})
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserInsurances WHERE ${sqlOwnershipClause("", userId, normalizedEmail)} AND VehicleId = ${sqlString(vehicleId)})
      BEGIN
        UPDATE dbo.MoveAdvisorUserInsurances
        SET Id = ${sqlString(id)},
            UserEmail = ${sqlString(normalizedEmail)},
            UserId = ${userId ? sqlString(userId) : "NULL"},
            Provider = ${sqlString(normalizeText(payload?.provider))},
            PolicyNumber = ${sqlString(normalizeText(payload?.policyNumber))},
            CoverageType = ${sqlString(normalizeText(payload?.coverageType))},
            Status = ${sqlString(normalizeText(payload?.status || "active"))},
            RenewalAtText = ${sqlString(normalizeText(payload?.renewalAt))},
            MonthlyPremium = ${Number(payload?.monthlyPremium || 0) || "NULL"},
            Notes = ${sqlString(normalizeText(payload?.notes))},
            UpdatedAt = ${sqlString(nowIso)}
        WHERE ${sqlOwnershipClause("", userId, normalizedEmail)}
          AND VehicleId = ${sqlString(vehicleId)};
      END
      ELSE
      BEGIN
        INSERT INTO dbo.MoveAdvisorUserInsurances
          (Id, UserEmail, UserId, VehicleId, Provider, PolicyNumber, CoverageType, Status, RenewalAtText, MonthlyPremium, Notes, CreatedAt, UpdatedAt)
        VALUES
          (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${sqlString(vehicleId)},
           ${sqlString(normalizeText(payload?.provider))}, ${sqlString(normalizeText(payload?.policyNumber))},
           ${sqlString(normalizeText(payload?.coverageType))}, ${sqlString(normalizeText(payload?.status || "active"))},
           ${sqlString(normalizeText(payload?.renewalAt))}, ${Number(payload?.monthlyPremium || 0) || "NULL"},
           ${sqlString(normalizeText(payload?.notes))}, ${sqlString(nowIso)}, ${sqlString(nowIso)});
      END
    END
  `);

  runSqlcmd(`
    SET NOCOUNT ON;
    DELETE FROM dbo.MoveAdvisorUserInsuranceDocuments WHERE InsuranceId = ${sqlString(id)};
  `);

  const insuranceDocuments = sanitizeAttachmentArray(payload?.documents);
  insuranceDocuments.forEach((document) => {
    runSqlcmd(`
      SET NOCOUNT ON;
      INSERT INTO dbo.MoveAdvisorUserInsuranceDocuments (InsuranceId, FileName, FileSize, FileMimeType, FileContentBase64, CreatedAt)
      VALUES (${sqlString(id)}, ${sqlString(document.name)}, ${Number(document.size || 0)}, ${sqlString(normalizeText(document.mimeType))}, ${sqlString(normalizeText(document.contentBase64))}, ${sqlString(nowIso)});
    `);
  });

  return listInsurancesByEmailSqlServer(normalizedEmail);
}

function listValuationsByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      val.Id AS [id],
      val.Title AS [title],
      val.Meta AS [meta],
      val.Status AS [status],
      val.Report AS [report],
      val.EstimateValue AS [estimateValue],
      val.VehicleId AS [vehicleId],
      v.Title AS [vehicleTitle]
    FROM dbo.MoveAdvisorUserValuations val
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = val.VehicleId
    WHERE ${sqlOwnershipClause("val", userId, normalizedEmail)}
    ORDER BY val.CreatedAt DESC
    FOR JSON PATH;
  `);

  const rows = Array.isArray(parseSqlcmdJsonOutput(output)) ? parseSqlcmdJsonOutput(output) : [];
  return rows.map((row) => ({
    id: normalizeText(row?.id),
    title: normalizeText(row?.title),
    meta: normalizeText(row?.meta),
    status: normalizeText(row?.status),
    report: normalizeText(row?.report),
    estimateValue: Number(row?.estimateValue || 0),
    vehicleId: normalizeText(row?.vehicleId),
    vehicleTitle: normalizeText(row?.vehicleTitle),
  }));
}

function addValuationByEmailSqlServer(email = "", valuation = {}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return listValuationsByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const vehicleId = normalizeText(valuation?.vehicleId) || null;
  const vehicleTitle = normalizeText(valuation?.title) || "Vehiculo en valoracion";

  // If vehicleId is given, verify ownership first
  if (vehicleId) {
    const checkOutput = runSqlcmd(`
      SET NOCOUNT ON;
      SELECT Id FROM dbo.MoveAdvisorUserVehicles
      WHERE Id = ${sqlString(vehicleId)} AND ${sqlOwnershipClause("", userId, normalizedEmail)};
    `);
    const owned = parseSqlcmdJsonOutput(checkOutput);
    if (!Array.isArray(owned) || owned.length === 0) {
      return listValuationsByEmailSqlServer(normalizedEmail);
    }
  }

  const id = normalizeText(valuation?.id) || `valuation-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const vehicleIdSql = vehicleId ? sqlString(vehicleId) : "NULL";

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserValuations WHERE Id = ${sqlString(id)})
    BEGIN
      UPDATE dbo.MoveAdvisorUserValuations
      SET UserEmail = ${sqlString(normalizedEmail)},
          UserId = ${userId ? sqlString(userId) : "NULL"},
          VehicleId = ${vehicleIdSql},
          Title = ${sqlString(vehicleTitle)},
          Meta = ${sqlString(normalizeText(valuation?.meta))},
          Status = ${sqlString(normalizeText(valuation?.status || "Ultima tasacion disponible"))},
          Report = ${sqlString(normalizeText(valuation?.report))},
          EstimateValue = ${Number(valuation?.estimateValue || 0) || "NULL"},
          UpdatedAt = ${sqlString(nowIso)}
      WHERE Id = ${sqlString(id)};
    END
    ELSE
    BEGIN
      INSERT INTO dbo.MoveAdvisorUserValuations
        (Id, UserEmail, UserId, VehicleId, Title, Meta, Status, Report, EstimateValue, CreatedAt, UpdatedAt)
      VALUES
        (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${vehicleIdSql},
         ${sqlString(vehicleTitle)}, ${sqlString(normalizeText(valuation?.meta))},
         ${sqlString(normalizeText(valuation?.status || "Ultima tasacion disponible"))}, ${sqlString(normalizeText(valuation?.report))},
         ${Number(valuation?.estimateValue || 0) || "NULL"}, ${sqlString(nowIso)}, ${sqlString(nowIso)});
    END
  `);

  return listValuationsByEmailSqlServer(normalizedEmail);
}

function listVehicleStatesByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      s.VehicleId AS [vehicleId],
      s.[State] AS [state],
      s.ListingUrl AS [listingUrl],
      s.Notes AS [notes],
      s.UpdatedAt AS [updatedAt],
      v.Title AS [title],
      v.Brand AS [brand],
      v.Model AS [model],
      v.[Year] AS [year]
    FROM dbo.MoveAdvisorUserVehicleStates s
    INNER JOIN dbo.MoveAdvisorUserVehicles v ON v.Id = s.VehicleId
    WHERE ${sqlOwnershipClause("s", userId, normalizedEmail)}
    ORDER BY s.UpdatedAt DESC
    FOR JSON PATH;
  `);

  const rows = Array.isArray(parseSqlcmdJsonOutput(output)) ? parseSqlcmdJsonOutput(output) : [];
  return rows.map((row) => ({
    vehicleId: normalizeText(row?.vehicleId),
    state: normalizeText(row?.state),
    listingUrl: normalizeText(row?.listingUrl),
    notes: normalizeText(row?.notes),
    updatedAt: normalizeText(row?.updatedAt),
    title: normalizeText(row?.title),
    brand: normalizeText(row?.brand),
    model: normalizeText(row?.model),
    year: normalizeText(row?.year),
  }));
}

function upsertVehicleStateByEmailSqlServer(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(payload?.vehicleId);
  const state = normalizeText(payload?.state).toLowerCase();

  if (!normalizedEmail || !vehicleId || !["owned", "active_sale", "sold"].includes(state)) {
    return listVehicleStatesByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const nowIso = new Date().toISOString();

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserVehicles WHERE Id = ${sqlString(vehicleId)} AND ${sqlOwnershipClause("", userId, normalizedEmail)})
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserVehicleStates WHERE ${sqlOwnershipClause("", userId, normalizedEmail)} AND VehicleId = ${sqlString(vehicleId)})
      BEGIN
        UPDATE dbo.MoveAdvisorUserVehicleStates
        SET UserEmail = ${sqlString(normalizedEmail)},
            UserId = ${userId ? sqlString(userId) : "NULL"},
            [State] = ${sqlString(state)},
            ListingUrl = ${sqlString(normalizeText(payload?.listingUrl))},
            Notes = ${sqlString(normalizeText(payload?.notes))},
            UpdatedAt = ${sqlString(nowIso)}
        WHERE ${sqlOwnershipClause("", userId, normalizedEmail)}
          AND VehicleId = ${sqlString(vehicleId)};
      END
      ELSE
      BEGIN
        INSERT INTO dbo.MoveAdvisorUserVehicleStates
          (UserEmail, UserId, VehicleId, [State], ListingUrl, Notes, UpdatedAt)
        VALUES
          (${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${sqlString(vehicleId)}, ${sqlString(state)},
           ${sqlString(normalizeText(payload?.listingUrl))}, ${sqlString(normalizeText(payload?.notes))}, ${sqlString(nowIso)});
      END
    END
  `);

  return listVehicleStatesByEmailSqlServer(normalizedEmail);
}

function listSavedOffersByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      Id AS [id],
      VehicleId AS [vehicleId],
      Title AS [title],
      OfferPayload AS [offerPayload]
    FROM dbo.MoveAdvisorUserSavedOffers so
    WHERE ${sqlOwnershipClause("so", userId, normalizedEmail)}
    ORDER BY CreatedAt DESC
    FOR JSON PATH;
  `);

  const rows = Array.isArray(parseSqlcmdJsonOutput(output)) ? parseSqlcmdJsonOutput(output) : [];
  return rows.map((row) => {
    let payload = {};

    try {
      const parsed = JSON.parse(String(row?.offerPayload || "{}"));
      if (parsed && typeof parsed === "object") {
        payload = parsed;
      }
    } catch {
      payload = {};
    }

    return {
      ...payload,
      id: normalizeText(row?.id) || normalizeText(payload?.id),
      vehicleId: normalizeText(row?.vehicleId) || normalizeText(payload?.vehicleId),
      title: normalizeText(row?.title) || normalizeText(payload?.title),
    };
  });
}

function addSavedOfferByEmailSqlServer(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(payload?.id);

  if (!normalizedEmail || !id) {
    return listSavedOffersByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const nowIso = new Date().toISOString();
  const vehicleId = normalizeText(payload?.vehicleId);
  const safePayload = JSON.stringify(payload || {});

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserSavedOffers WHERE Id = ${sqlString(id)})
    BEGIN
      UPDATE dbo.MoveAdvisorUserSavedOffers
      SET UserEmail = ${sqlString(normalizedEmail)},
          UserId = ${userId ? sqlString(userId) : "NULL"},
          VehicleId = ${vehicleId ? sqlString(vehicleId) : "NULL"},
          Title = ${sqlString(normalizeText(payload?.title))},
          OfferPayload = ${sqlString(safePayload)},
          UpdatedAt = ${sqlString(nowIso)}
      WHERE Id = ${sqlString(id)};
    END
    ELSE
    BEGIN
      INSERT INTO dbo.MoveAdvisorUserSavedOffers
        (Id, UserEmail, UserId, VehicleId, Title, OfferPayload, CreatedAt, UpdatedAt)
      VALUES
        (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${vehicleId ? sqlString(vehicleId) : "NULL"},
         ${sqlString(normalizeText(payload?.title))}, ${sqlString(safePayload)}, ${sqlString(nowIso)}, ${sqlString(nowIso)});
    END
  `);

  return listSavedOffersByEmailSqlServer(normalizedEmail);
}

function removeSavedOfferByEmailSqlServer(email = "", offerId = "") {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(offerId);

  if (!normalizedEmail || !id) {
    return listSavedOffersByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  runSqlcmd(`
    SET NOCOUNT ON;
    DELETE FROM dbo.MoveAdvisorUserSavedOffers
    WHERE Id = ${sqlString(id)} AND ${sqlOwnershipClause("", userId, normalizedEmail)};
  `);

  return listSavedOffersByEmailSqlServer(normalizedEmail);
}

function getUserMobilityDataByEmailSqlServer(email = "") {
  return {
    vehicles: listGarageVehiclesByEmailSqlServer(email),
    appointments: listAppointmentsByEmailSqlServer(email),
    maintenances: listMaintenancesByEmailSqlServer(email),
    insurances: listInsurancesByEmailSqlServer(email),
    valuations: listValuationsByEmailSqlServer(email),
    vehicleStates: listVehicleStatesByEmailSqlServer(email),
    savedOffers: listSavedOffersByEmailSqlServer(email),
  };
}

function normalizeIdentityEmail(identityOrEmail = "") {
  if (typeof identityOrEmail === "string") {
    return normalizeEmail(identityOrEmail);
  }

  if (!identityOrEmail || typeof identityOrEmail !== "object") {
    return "";
  }

  return normalizeEmail(
    identityOrEmail?.email || identityOrEmail?.userEmail || identityOrEmail?.user?.email || identityOrEmail?.sessionEmail
  );
}

function listGarageVehiclesSqlServer(identityOrEmail = "") {
  return listGarageVehiclesByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function addGarageVehicleSqlServer(identityOrEmail = "", vehicle = {}) {
  return addGarageVehicleByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), vehicle);
}

function removeGarageVehicleSqlServer(identityOrEmail = "", vehicleId = "") {
  return removeGarageVehicleByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), vehicleId);
}

function listAppointmentsSqlServer(identityOrEmail = "") {
  return listAppointmentsByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function addAppointmentSqlServer(identityOrEmail = "", appointment = {}) {
  return addAppointmentByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), appointment);
}

function listMaintenancesSqlServer(identityOrEmail = "") {
  return listMaintenancesByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function addMaintenanceSqlServer(identityOrEmail = "", payload = {}) {
  return addMaintenanceByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), payload);
}

function listInsurancesSqlServer(identityOrEmail = "") {
  return listInsurancesByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function upsertInsuranceSqlServer(identityOrEmail = "", payload = {}) {
  return upsertInsuranceByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), payload);
}

function listValuationsSqlServer(identityOrEmail = "") {
  return listValuationsByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function addValuationSqlServer(identityOrEmail = "", valuation = {}) {
  return addValuationByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), valuation);
}

function listVehicleStatesSqlServer(identityOrEmail = "") {
  return listVehicleStatesByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function upsertVehicleStateSqlServer(identityOrEmail = "", payload = {}) {
  return upsertVehicleStateByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), payload);
}

function listSavedOffersSqlServer(identityOrEmail = "") {
  return listSavedOffersByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function addSavedOfferSqlServer(identityOrEmail = "", payload = {}) {
  return addSavedOfferByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), payload);
}

function removeSavedOfferSqlServer(identityOrEmail = "", offerId = "") {
  return removeSavedOfferByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), offerId);
}

function getUserMobilityDataSqlServer(identityOrEmail = "") {
  return getUserMobilityDataByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

// ─────────────────────────────────────────────────────────────────────────────
// SavedComparisons
// ─────────────────────────────────────────────────────────────────────────────

function listSavedComparisonsByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      Id AS [id],
      Title AS [title],
      Mode AS [mode],
      ComparisonPayload AS [comparisonPayload]
    FROM dbo.MoveAdvisorUserSavedComparisons sc
    WHERE ${sqlOwnershipClause("sc", userId, normalizedEmail)}
    ORDER BY CreatedAt DESC
    FOR JSON PATH;
  `);

  const rows = parseSqlcmdJsonOutput(output);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => {
    let payload = {};
    try {
      const parsed = JSON.parse(String(row?.comparisonPayload || "{}"));
      if (parsed && typeof parsed === "object") {
        payload = parsed;
      }
    } catch {
      payload = {};
    }

    return {
      ...payload,
      id: normalizeText(row?.id) || normalizeText(payload?.id),
      title: normalizeText(row?.title) || normalizeText(payload?.title),
      mode: normalizeText(row?.mode) || normalizeText(payload?.mode) || "buy",
    };
  });
}

function upsertSavedComparisonByEmailSqlServer(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(payload?.id);

  if (!normalizedEmail || !id) {
    return listSavedComparisonsByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);
  const nowIso = new Date().toISOString();
  const safePayload = JSON.stringify(payload || {});

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserSavedComparisons WHERE Id = ${sqlString(id)})
    BEGIN
      UPDATE dbo.MoveAdvisorUserSavedComparisons
      SET UserEmail = ${sqlString(normalizedEmail)},
          UserId = ${userId ? sqlString(userId) : "NULL"},
          Title = ${sqlString(normalizeText(payload?.title))},
          Mode = ${sqlString(normalizeText(payload?.mode) || "buy")},
          ComparisonPayload = ${sqlString(safePayload)},
          UpdatedAt = ${sqlString(nowIso)}
      WHERE Id = ${sqlString(id)};
    END
    ELSE
    BEGIN
      INSERT INTO dbo.MoveAdvisorUserSavedComparisons
        (Id, UserEmail, UserId, Title, Mode, ComparisonPayload, CreatedAt, UpdatedAt)
      VALUES
        (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"},
         ${sqlString(normalizeText(payload?.title))}, ${sqlString(normalizeText(payload?.mode) || "buy")},
         ${sqlString(safePayload)}, ${sqlString(nowIso)}, ${sqlString(nowIso)});
    END
  `);

  return listSavedComparisonsByEmailSqlServer(normalizedEmail);
}

function removeSavedComparisonByEmailSqlServer(email = "", comparisonId = "") {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(comparisonId);

  if (!normalizedEmail || !id) {
    return listSavedComparisonsByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  runSqlcmd(`
    SET NOCOUNT ON;
    DELETE FROM dbo.MoveAdvisorUserSavedComparisons
    WHERE Id = ${sqlString(id)} AND ${sqlOwnershipClause("", userId, normalizedEmail)};
  `);

  return listSavedComparisonsByEmailSqlServer(normalizedEmail);
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketAlerts
// ─────────────────────────────────────────────────────────────────────────────

function listMarketAlertsByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      a.Id AS [id],
      a.Title AS [title],
      a.Mode AS [mode],
      a.Brand AS [brand],
      a.Model AS [model],
      a.MaxPrice AS [maxPrice],
      a.MaxMileage AS [maxMileage],
      a.Fuel AS [fuel],
      a.Location AS [location],
      a.Color AS [color],
      a.NotifyByEmail AS [notifyByEmail],
      a.AlertEmail AS [email],
      a.Status AS [status],
      a.AlertPayload AS [alertPayload],
      a.CreatedAt AS [createdAt]
    FROM dbo.MoveAdvisorUserMarketAlerts a
    WHERE ${sqlOwnershipClause("a", userId, normalizedEmail)}
      AND a.Status <> N'deleted'
    ORDER BY a.CreatedAt DESC
    FOR JSON PATH;
  `);

  const rows = parseSqlcmdJsonOutput(output);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => {
    let payload = {};
    try {
      const parsed = JSON.parse(String(row?.alertPayload || "{}"));
      if (parsed && typeof parsed === "object") {
        payload = parsed;
      }
    } catch {
      payload = {};
    }

    return {
      ...payload,
      id: normalizeText(row?.id) || normalizeText(payload?.id),
      title: normalizeText(row?.title) || normalizeText(payload?.title),
      mode: normalizeText(row?.mode) || "buy",
      brand: normalizeText(row?.brand),
      model: normalizeText(row?.model),
      maxPrice: normalizeText(row?.maxPrice),
      maxMileage: normalizeText(row?.maxMileage),
      fuel: normalizeText(row?.fuel),
      location: normalizeText(row?.location),
      color: normalizeText(row?.color),
      notifyByEmail: Boolean(row?.notifyByEmail),
      email: normalizeText(row?.email),
      status: normalizeText(row?.status) || "active",
      createdAt: normalizeText(row?.createdAt),
    };
  });
}

function upsertMarketAlertByEmailSqlServer(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(payload?.id);

  if (!normalizedEmail || !id) {
    return listMarketAlertsByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);
  const nowIso = new Date().toISOString();
  const safePayload = JSON.stringify(payload || {});
  const notifyByEmail = payload?.notifyByEmail ? 1 : 0;

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserMarketAlerts WHERE Id = ${sqlString(id)})
    BEGIN
      UPDATE dbo.MoveAdvisorUserMarketAlerts
      SET UserEmail     = ${sqlString(normalizedEmail)},
          UserId        = ${userId ? sqlString(userId) : "NULL"},
          Title         = ${sqlString(normalizeText(payload?.title))},
          Mode          = ${sqlString(normalizeText(payload?.mode) || "buy")},
          Brand         = ${sqlString(normalizeText(payload?.brand))},
          Model         = ${sqlString(normalizeText(payload?.model))},
          MaxPrice      = ${sqlString(normalizeText(payload?.maxPrice))},
          MaxMileage    = ${sqlString(normalizeText(payload?.maxMileage))},
          Fuel          = ${sqlString(normalizeText(payload?.fuel))},
          Location      = ${sqlString(normalizeText(payload?.location))},
          Color         = ${sqlString(normalizeText(payload?.color))},
          NotifyByEmail = ${notifyByEmail},
          AlertEmail    = ${sqlString(normalizeText(payload?.email || normalizedEmail))},
          Status        = ${sqlString(normalizeText(payload?.status) || "active")},
          AlertPayload  = ${sqlString(safePayload)},
          UpdatedAt     = ${sqlString(nowIso)}
      WHERE Id = ${sqlString(id)};
    END
    ELSE
    BEGIN
      INSERT INTO dbo.MoveAdvisorUserMarketAlerts
        (Id, UserEmail, UserId, Title, Mode, Brand, Model, MaxPrice, MaxMileage,
         Fuel, Location, Color, NotifyByEmail, AlertEmail, Status, AlertPayload, CreatedAt, UpdatedAt)
      VALUES
        (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"},
         ${sqlString(normalizeText(payload?.title))}, ${sqlString(normalizeText(payload?.mode) || "buy")},
         ${sqlString(normalizeText(payload?.brand))}, ${sqlString(normalizeText(payload?.model))},
         ${sqlString(normalizeText(payload?.maxPrice))}, ${sqlString(normalizeText(payload?.maxMileage))},
         ${sqlString(normalizeText(payload?.fuel))}, ${sqlString(normalizeText(payload?.location))},
         ${sqlString(normalizeText(payload?.color))}, ${notifyByEmail},
         ${sqlString(normalizeText(payload?.email || normalizedEmail))},
         ${sqlString(normalizeText(payload?.status) || "active")},
         ${sqlString(safePayload)}, ${sqlString(nowIso)}, ${sqlString(nowIso)});
    END
  `);

  return listMarketAlertsByEmailSqlServer(normalizedEmail);
}

function removeMarketAlertByEmailSqlServer(email = "", alertId = "") {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(alertId);

  if (!normalizedEmail || !id) {
    return listMarketAlertsByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);

  runSqlcmd(`
    SET NOCOUNT ON;
    DELETE FROM dbo.MoveAdvisorUserMarketAlerts
    WHERE Id = ${sqlString(id)} AND ${sqlOwnershipClause("", userId, normalizedEmail)};
  `);

  return listMarketAlertsByEmailSqlServer(normalizedEmail);
}

function getMarketAlertStatusByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {};
  }

  ensureSqlServerMobilitySchema();

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT
      s.AlertId AS [alertId],
      s.SeenCount AS [seenCount],
      s.LastSeenAt AS [lastSeenAt]
    FROM dbo.MoveAdvisorUserMarketAlertStatus s
    WHERE s.UserEmail = ${sqlString(normalizedEmail)}
    FOR JSON PATH;
  `);

  const rows = parseSqlcmdJsonOutput(output);
  if (!Array.isArray(rows)) {
    return {};
  }

  return rows.reduce((acc, row) => {
    const alertId = normalizeText(row?.alertId);
    if (alertId) {
      acc[alertId] = {
        seenCount: Number(row?.seenCount || 0),
        lastSeenAt: normalizeText(row?.lastSeenAt),
      };
    }
    return acc;
  }, {});
}

function upsertMarketAlertStatusByEmailSqlServer(email = "", alertId = "", seenCount = 0) {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(alertId);
  const count = Math.max(Number(seenCount || 0), 0);

  if (!normalizedEmail || !id) {
    return getMarketAlertStatusByEmailSqlServer(normalizedEmail);
  }

  ensureSqlServerMobilitySchema();
  const nowIso = new Date().toISOString();

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserMarketAlertStatus WHERE AlertId = ${sqlString(id)})
    BEGIN
      UPDATE dbo.MoveAdvisorUserMarketAlertStatus
      SET SeenCount = ${count},
          LastSeenAt = ${sqlString(nowIso)}
      WHERE AlertId = ${sqlString(id)};
    END
    ELSE
    BEGIN
      INSERT INTO dbo.MoveAdvisorUserMarketAlertStatus (AlertId, UserEmail, SeenCount, LastSeenAt)
      VALUES (${sqlString(id)}, ${sqlString(normalizedEmail)}, ${count}, ${sqlString(nowIso)});
    END
  `);

  return getMarketAlertStatusByEmailSqlServer(normalizedEmail);
}

// ─────────────────────────────────────────────────────────────────────────────
// UserPreferences
// ─────────────────────────────────────────────────────────────────────────────

function getUserPreferencesByEmailSqlServer(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  ensureSqlServerMobilitySchema();

  const output = runSqlcmd(`
    SET NOCOUNT ON;
    SELECT TOP (1)
      FullName AS [fullName],
      Language AS [language],
      Region AS [region],
      NotifyPriceAlerts AS [notifyPriceAlerts],
      NotifyAppointments AS [notifyAppointments],
      NotifyAnalysisReady AS [notifyAnalysisReady],
      WeeklyDigest AS [weeklyDigest]
    FROM dbo.MoveAdvisorUserPreferences
    WHERE UserEmail = ${sqlString(normalizedEmail)}
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  const row = parseSqlcmdJsonOutput(output);
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    fullName: normalizeText(row?.fullName),
    language: normalizeText(row?.language) || "es",
    region: normalizeText(row?.region) || "es",
    notifyPriceAlerts: row?.notifyPriceAlerts !== false && row?.notifyPriceAlerts !== 0,
    notifyAppointments: row?.notifyAppointments !== false && row?.notifyAppointments !== 0,
    notifyAnalysisReady: row?.notifyAnalysisReady !== false && row?.notifyAnalysisReady !== 0,
    weeklyDigest: row?.weeklyDigest !== false && row?.weeklyDigest !== 0,
  };
}

function upsertUserPreferencesByEmailSqlServer(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  ensureSqlServerMobilitySchema();
  const { userId } = resolveSqlServerUserIdentity(normalizedEmail);
  const nowIso = new Date().toISOString();

  const fullName = normalizeText(payload?.fullName);
  const language = normalizeText(payload?.language) || "es";
  const region = normalizeText(payload?.region) || "es";
  const notifyPriceAlerts = payload?.notifyPriceAlerts === false ? 0 : 1;
  const notifyAppointments = payload?.notifyAppointments === false ? 0 : 1;
  const notifyAnalysisReady = payload?.notifyAnalysisReady === false ? 0 : 1;
  const weeklyDigest = payload?.weeklyDigest === false ? 0 : 1;

  runSqlcmd(`
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorUserPreferences WHERE UserEmail = ${sqlString(normalizedEmail)})
    BEGIN
      UPDATE dbo.MoveAdvisorUserPreferences
      SET UserId              = ${userId ? sqlString(userId) : "NULL"},
          FullName            = ${sqlString(fullName)},
          Language            = ${sqlString(language)},
          Region              = ${sqlString(region)},
          NotifyPriceAlerts   = ${notifyPriceAlerts},
          NotifyAppointments  = ${notifyAppointments},
          NotifyAnalysisReady = ${notifyAnalysisReady},
          WeeklyDigest        = ${weeklyDigest},
          UpdatedAt           = ${sqlString(nowIso)}
      WHERE UserEmail = ${sqlString(normalizedEmail)};
    END
    ELSE
    BEGIN
      INSERT INTO dbo.MoveAdvisorUserPreferences
        (UserEmail, UserId, FullName, Language, Region,
         NotifyPriceAlerts, NotifyAppointments, NotifyAnalysisReady, WeeklyDigest, UpdatedAt)
      VALUES
        (${sqlString(normalizedEmail)}, ${userId ? sqlString(userId) : "NULL"}, ${sqlString(fullName)},
         ${sqlString(language)}, ${sqlString(region)},
         ${notifyPriceAlerts}, ${notifyAppointments}, ${notifyAnalysisReady}, ${weeklyDigest},
         ${sqlString(nowIso)});
    END
  `);

  return getUserPreferencesByEmailSqlServer(normalizedEmail);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public wrappers (normalizeIdentityEmail pattern to match rest of store)
// ─────────────────────────────────────────────────────────────────────────────

function listSavedComparisonsSqlServer(identityOrEmail = "") {
  return listSavedComparisonsByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function upsertSavedComparisonSqlServer(identityOrEmail = "", payload = {}) {
  return upsertSavedComparisonByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), payload);
}

function removeSavedComparisonSqlServer(identityOrEmail = "", comparisonId = "") {
  return removeSavedComparisonByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), comparisonId);
}

function listMarketAlertsSqlServer(identityOrEmail = "") {
  return listMarketAlertsByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function upsertMarketAlertSqlServer(identityOrEmail = "", payload = {}) {
  return upsertMarketAlertByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), payload);
}

function removeMarketAlertSqlServer(identityOrEmail = "", alertId = "") {
  return removeMarketAlertByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), alertId);
}

function getMarketAlertStatusSqlServer(identityOrEmail = "") {
  return getMarketAlertStatusByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function upsertMarketAlertStatusSqlServer(identityOrEmail = "", alertId = "", seenCount = 0) {
  return upsertMarketAlertStatusByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), alertId, seenCount);
}

function getUserPreferencesSqlServer(identityOrEmail = "") {
  return getUserPreferencesByEmailSqlServer(normalizeIdentityEmail(identityOrEmail));
}

function upsertUserPreferencesSqlServer(identityOrEmail = "", payload = {}) {
  return upsertUserPreferencesByEmailSqlServer(normalizeIdentityEmail(identityOrEmail), payload);
}

module.exports = {
  shouldUseSqlServerMobility,
  listGarageVehiclesSqlServer,
  // Deprecated alias kept for compatibility.
  listGarageVehiclesByEmailSqlServer: listGarageVehiclesSqlServer,
  addGarageVehicleSqlServer,
  // Deprecated alias kept for compatibility.
  addGarageVehicleByEmailSqlServer: addGarageVehicleSqlServer,
  removeGarageVehicleSqlServer,
  // Deprecated alias kept for compatibility.
  removeGarageVehicleByEmailSqlServer: removeGarageVehicleSqlServer,
  listAppointmentsSqlServer,
  // Deprecated alias kept for compatibility.
  listAppointmentsByEmailSqlServer: listAppointmentsSqlServer,
  addAppointmentSqlServer,
  // Deprecated alias kept for compatibility.
  addAppointmentByEmailSqlServer: addAppointmentSqlServer,
  listMaintenancesSqlServer,
  // Deprecated alias kept for compatibility.
  listMaintenancesByEmailSqlServer: listMaintenancesSqlServer,
  addMaintenanceSqlServer,
  // Deprecated alias kept for compatibility.
  addMaintenanceByEmailSqlServer: addMaintenanceSqlServer,
  listInsurancesSqlServer,
  // Deprecated alias kept for compatibility.
  listInsurancesByEmailSqlServer: listInsurancesSqlServer,
  upsertInsuranceSqlServer,
  // Deprecated alias kept for compatibility.
  upsertInsuranceByEmailSqlServer: upsertInsuranceSqlServer,
  listValuationsSqlServer,
  // Deprecated alias kept for compatibility.
  listValuationsByEmailSqlServer: listValuationsSqlServer,
  addValuationSqlServer,
  // Deprecated alias kept for compatibility.
  addValuationByEmailSqlServer: addValuationSqlServer,
  listVehicleStatesSqlServer,
  // Deprecated alias kept for compatibility.
  listVehicleStatesByEmailSqlServer: listVehicleStatesSqlServer,
  upsertVehicleStateSqlServer,
  // Deprecated alias kept for compatibility.
  upsertVehicleStateByEmailSqlServer: upsertVehicleStateSqlServer,
  listSavedOffersSqlServer,
  // Deprecated alias kept for compatibility.
  listSavedOffersByEmailSqlServer: listSavedOffersSqlServer,
  addSavedOfferSqlServer,
  // Deprecated alias kept for compatibility.
  addSavedOfferByEmailSqlServer: addSavedOfferSqlServer,
  removeSavedOfferSqlServer,
  // Deprecated alias kept for compatibility.
  removeSavedOfferByEmailSqlServer: removeSavedOfferSqlServer,
  getUserMobilityDataSqlServer,
  // Deprecated alias kept for compatibility.
  getUserMobilityDataByEmailSqlServer: getUserMobilityDataSqlServer,
  // SavedComparisons
  listSavedComparisonsSqlServer,
  upsertSavedComparisonSqlServer,
  removeSavedComparisonSqlServer,
  // MarketAlerts
  listMarketAlertsSqlServer,
  upsertMarketAlertSqlServer,
  removeMarketAlertSqlServer,
  getMarketAlertStatusSqlServer,
  upsertMarketAlertStatusSqlServer,
  // UserPreferences
  getUserPreferencesSqlServer,
  upsertUserPreferencesSqlServer,
};
