IF OBJECT_ID(N'dbo.MoveAdvisorUserVehicles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserVehicles (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    Title NVARCHAR(180) NOT NULL,
    Brand NVARCHAR(100) NOT NULL,
    Model NVARCHAR(120) NOT NULL,
    [Version] NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Version DEFAULT (N''),
    TransmissionType NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_TransmissionType DEFAULT (N''),
    Cv NVARCHAR(20) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Cv DEFAULT (N''),
    Color NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Color DEFAULT (N''),
    Horsepower NVARCHAR(20) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Horsepower DEFAULT (N''),
    Seats NVARCHAR(10) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Seats DEFAULT (N''),
    Doors NVARCHAR(10) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Doors DEFAULT (N''),
    VehicleLocation NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_VehicleLocation DEFAULT (N''),
    BodyType NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_BodyType DEFAULT (N''),
    EnvironmentalLabel NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_EnvironmentalLabel DEFAULT (N''),
    LastIvt NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_LastIvt DEFAULT (N''),
    NextIvt NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_NextIvt DEFAULT (N''),
    Co2 NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Co2 DEFAULT (N''),
    Price NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Price DEFAULT (N''),
    MarketplacePricingMode NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_MarketplacePricingMode DEFAULT (N'manual'),
    [Year] NVARCHAR(20) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Year DEFAULT (N''),
    Plate NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Plate DEFAULT (N''),
    Mileage NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Mileage DEFAULT (N''),
    Fuel NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Fuel DEFAULT (N''),
    PolicyCompany NVARCHAR(120) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_PolicyCompany DEFAULT (N''),
    Notes NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Notes DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL
  );

  CREATE INDEX IX_MoveAdvisorUserVehicles_UserEmail_CreatedAt
    ON dbo.MoveAdvisorUserVehicles (UserEmail, CreatedAt DESC);
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Version') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD [Version] NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Version DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'TransmissionType') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD TransmissionType NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_TransmissionType DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Cv') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD Cv NVARCHAR(20) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Cv DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Color') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD Color NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Color DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Horsepower') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD Horsepower NVARCHAR(20) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Horsepower DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Seats') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD Seats NVARCHAR(10) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Seats DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Doors') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD Doors NVARCHAR(10) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Doors DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'VehicleLocation') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD VehicleLocation NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_VehicleLocation DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'BodyType') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD BodyType NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_BodyType DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'EnvironmentalLabel') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD EnvironmentalLabel NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_EnvironmentalLabel DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'LastIvt') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD LastIvt NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_LastIvt DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'NextIvt') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD NextIvt NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_NextIvt DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Co2') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD Co2 NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Co2 DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Price') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD Price NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_Price DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'MarketplacePricingMode') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD MarketplacePricingMode NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicles_MarketplacePricingMode DEFAULT (N'manual');
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserVehicleFiles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserVehicleFiles (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VehicleId NVARCHAR(64) NOT NULL,
    FileType NVARCHAR(20) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileSize BIGINT NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleFiles_FileSize DEFAULT (0),
    FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleFiles_FileMimeType DEFAULT (N''),
    FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleFiles_FileContentBase64 DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserVehicleFiles_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE,
    CONSTRAINT CK_MoveAdvisorUserVehicleFiles_FileType
      CHECK (FileType IN (N'photo', N'document'))
  );

  CREATE INDEX IX_MoveAdvisorUserVehicleFiles_VehicleId_FileType
    ON dbo.MoveAdvisorUserVehicleFiles (VehicleId, FileType);
END;

GO

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicleFiles', N'FileMimeType') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicleFiles
    ADD FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleFiles_FileMimeType DEFAULT (N'');
END;

GO

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicleFiles', N'FileContentBase64') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicleFiles
    ADD FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleFiles_FileContentBase64 DEFAULT (N'');
END;

GO

IF OBJECT_ID(N'dbo.MoveAdvisorUserVehicleCharacteristics', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserVehicleCharacteristics (
    VehicleId NVARCHAR(64) NOT NULL PRIMARY KEY,
    TransmissionType NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_TransmissionType DEFAULT (N''),
    Cv NVARCHAR(20) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_Cv DEFAULT (N''),
    Color NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_Color DEFAULT (N''),
    Horsepower NVARCHAR(20) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_Horsepower DEFAULT (N''),
    Seats NVARCHAR(10) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_Seats DEFAULT (N''),
    Doors NVARCHAR(10) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_Doors DEFAULT (N''),
    VehicleLocation NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_VehicleLocation DEFAULT (N''),
    BodyType NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_BodyType DEFAULT (N''),
    EnvironmentalLabel NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_EnvironmentalLabel DEFAULT (N''),
    LastIvt NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_LastIvt DEFAULT (N''),
    NextIvt NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_NextIvt DEFAULT (N''),
    Co2 NVARCHAR(30) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_Co2 DEFAULT (N''),
    Price NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleCharacteristics_Price DEFAULT (N''),
    UpdatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserVehicleCharacteristics_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserVehicleDocuments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserVehicleDocuments (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VehicleId NVARCHAR(64) NOT NULL,
    DocumentType NVARCHAR(40) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileSize BIGINT NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleDocuments_FileSize DEFAULT (0),
    FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleDocuments_FileMimeType DEFAULT (N''),
    FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleDocuments_FileContentBase64 DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserVehicleDocuments_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE,
    CONSTRAINT CK_MoveAdvisorUserVehicleDocuments_DocumentType
      CHECK (DocumentType IN (N'technical_sheet', N'circulation_permit', N'itv'))
  );

  CREATE INDEX IX_MoveAdvisorUserVehicleDocuments_VehicleId_DocumentType
    ON dbo.MoveAdvisorUserVehicleDocuments (VehicleId, DocumentType);
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicleDocuments', N'FileMimeType') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicleDocuments
    ADD FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleDocuments_FileMimeType DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicleDocuments', N'FileContentBase64') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicleDocuments
    ADD FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleDocuments_FileContentBase64 DEFAULT (N'');
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserAppointments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserAppointments (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    VehicleId NVARCHAR(64) NOT NULL,
    AppointmentType NVARCHAR(40) NOT NULL,
    Title NVARCHAR(180) NOT NULL,
    Meta NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserAppointments_Meta DEFAULT (N''),
    Status NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorUserAppointments_Status DEFAULT (N'Pendiente'),
    RequestedAtText NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserAppointments_RequestedAtText DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserAppointments_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_MoveAdvisorUserAppointments_UserEmail_CreatedAt
    ON dbo.MoveAdvisorUserAppointments (UserEmail, CreatedAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserAppointmentStatusHistory', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserAppointmentStatusHistory (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    AppointmentId NVARCHAR(64) NOT NULL,
    PreviousStatus NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorUserAppointmentStatusHistory_PreviousStatus DEFAULT (N''),
    NextStatus NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorUserAppointmentStatusHistory_NextStatus DEFAULT (N''),
    ChangedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserAppointmentStatusHistory_Appointment
      FOREIGN KEY (AppointmentId) REFERENCES dbo.MoveAdvisorUserAppointments(Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_MoveAdvisorUserAppointmentStatusHistory_AppointmentId_ChangedAt
    ON dbo.MoveAdvisorUserAppointmentStatusHistory (AppointmentId, ChangedAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserInsurances', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserInsurances (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    VehicleId NVARCHAR(64) NOT NULL,
    Provider NVARCHAR(140) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsurances_Provider DEFAULT (N''),
    PolicyNumber NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsurances_PolicyNumber DEFAULT (N''),
    CoverageType NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsurances_CoverageType DEFAULT (N''),
    Status NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsurances_Status DEFAULT (N'active'),
    RenewalAtText NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsurances_RenewalAtText DEFAULT (N''),
    MonthlyPremium DECIMAL(12,2) NULL,
    Notes NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsurances_Notes DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserInsurances_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX UX_MoveAdvisorUserInsurances_UserEmail_VehicleId
    ON dbo.MoveAdvisorUserInsurances (UserEmail, VehicleId);

  CREATE INDEX IX_MoveAdvisorUserInsurances_UserEmail_UpdatedAt
    ON dbo.MoveAdvisorUserInsurances (UserEmail, UpdatedAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserInsuranceDocuments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserInsuranceDocuments (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    InsuranceId NVARCHAR(64) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileSize BIGINT NOT NULL CONSTRAINT DF_MoveAdvisorUserInsuranceDocuments_FileSize DEFAULT (0),
    FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsuranceDocuments_FileMimeType DEFAULT (N''),
    FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsuranceDocuments_FileContentBase64 DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserInsuranceDocuments_Insurance
      FOREIGN KEY (InsuranceId) REFERENCES dbo.MoveAdvisorUserInsurances(Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_MoveAdvisorUserInsuranceDocuments_InsuranceId
    ON dbo.MoveAdvisorUserInsuranceDocuments (InsuranceId);
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserInsuranceDocuments', N'FileMimeType') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserInsuranceDocuments
    ADD FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsuranceDocuments_FileMimeType DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserInsuranceDocuments', N'FileContentBase64') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserInsuranceDocuments
    ADD FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserInsuranceDocuments_FileContentBase64 DEFAULT (N'');
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserMaintenances', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserMaintenances (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    VehicleId NVARCHAR(64) NOT NULL,
    MaintenanceType NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenances_MaintenanceType DEFAULT (N'maintenance'),
    Title NVARCHAR(180) NOT NULL,
    Status NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenances_Status DEFAULT (N'Pendiente'),
    ScheduledAtText NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenances_ScheduledAtText DEFAULT (N''),
    WorkshopName NVARCHAR(140) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenances_WorkshopName DEFAULT (N''),
    MileageText NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenances_MileageText DEFAULT (N''),
    EstimatedCost DECIMAL(12,2) NULL,
    Notes NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenances_Notes DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserMaintenances_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_MoveAdvisorUserMaintenances_UserEmail_CreatedAt
    ON dbo.MoveAdvisorUserMaintenances (UserEmail, CreatedAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserMaintenanceInvoices', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserMaintenanceInvoices (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaintenanceId NVARCHAR(64) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileSize BIGINT NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenanceInvoices_FileSize DEFAULT (0),
    FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenanceInvoices_FileMimeType DEFAULT (N''),
    FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenanceInvoices_FileContentBase64 DEFAULT (N''),
    CreatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserMaintenanceInvoices_Maintenance
      FOREIGN KEY (MaintenanceId) REFERENCES dbo.MoveAdvisorUserMaintenances(Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_MoveAdvisorUserMaintenanceInvoices_MaintenanceId
    ON dbo.MoveAdvisorUserMaintenanceInvoices (MaintenanceId);
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserMaintenanceInvoices', N'FileMimeType') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserMaintenanceInvoices
    ADD FileMimeType NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenanceInvoices_FileMimeType DEFAULT (N'');
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserMaintenanceInvoices', N'FileContentBase64') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserMaintenanceInvoices
    ADD FileContentBase64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserMaintenanceInvoices_FileContentBase64 DEFAULT (N'');
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserValuations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserValuations (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    VehicleId NVARCHAR(64) NOT NULL,
    Title NVARCHAR(180) NOT NULL,
    Meta NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserValuations_Meta DEFAULT (N''),
    Status NVARCHAR(100) NOT NULL CONSTRAINT DF_MoveAdvisorUserValuations_Status DEFAULT (N'Ultima tasacion disponible'),
    Report NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserValuations_Report DEFAULT (N''),
    EstimateValue DECIMAL(12,2) NULL,
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserValuations_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_MoveAdvisorUserValuations_UserEmail_CreatedAt
    ON dbo.MoveAdvisorUserValuations (UserEmail, CreatedAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserVehicleStates', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserVehicleStates (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    VehicleId NVARCHAR(64) NOT NULL,
    [State] NVARCHAR(30) NOT NULL,
    ListingUrl NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleStates_ListingUrl DEFAULT (N''),
    Notes NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleStates_Notes DEFAULT (N''),
    UpdatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserVehicleStates_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE,
    CONSTRAINT CK_MoveAdvisorUserVehicleStates_State
      CHECK ([State] IN (N'owned', N'active_sale', N'sold'))
  );

  CREATE UNIQUE INDEX UX_MoveAdvisorUserVehicleStates_UserEmail_VehicleId
    ON dbo.MoveAdvisorUserVehicleStates (UserEmail, VehicleId);

  CREATE INDEX IX_MoveAdvisorUserVehicleStates_UserEmail_State_UpdatedAt
    ON dbo.MoveAdvisorUserVehicleStates (UserEmail, [State], UpdatedAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUserSavedOffers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserSavedOffers (
    Id NVARCHAR(80) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    VehicleId NVARCHAR(64) NULL,
    Title NVARCHAR(180) NOT NULL CONSTRAINT DF_MoveAdvisorUserSavedOffers_Title DEFAULT (N''),
    OfferPayload NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserSavedOffers_OfferPayload DEFAULT (N'{}'),
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserSavedOffers_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE SET NULL
  );

  CREATE INDEX IX_MoveAdvisorUserSavedOffers_UserEmail_CreatedAt
    ON dbo.MoveAdvisorUserSavedOffers (UserEmail, CreatedAt DESC);
END;

-- BEGIN 3NF NORMALIZATION (compatible migration)
IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles ADD UserId NVARCHAR(64) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserAppointments', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserAppointments ADD UserId NVARCHAR(64) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserInsurances', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserInsurances ADD UserId NVARCHAR(64) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserMaintenances', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserMaintenances ADD UserId NVARCHAR(64) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserValuations', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserValuations ADD UserId NVARCHAR(64) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicleStates', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicleStates ADD UserId NVARCHAR(64) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserSavedOffers', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserSavedOffers ADD UserId NVARCHAR(64) NULL;
END;

GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserVehicles_UserId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserVehicles'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserVehicles_UserId_CreatedAt ON dbo.MoveAdvisorUserVehicles (UserId, CreatedAt DESC);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserAppointments_UserId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserAppointments'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserAppointments_UserId_CreatedAt ON dbo.MoveAdvisorUserAppointments (UserId, CreatedAt DESC);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserInsurances_UserId_UpdatedAt' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserInsurances'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserInsurances_UserId_UpdatedAt ON dbo.MoveAdvisorUserInsurances (UserId, UpdatedAt DESC);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserMaintenances_UserId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserMaintenances'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserMaintenances_UserId_CreatedAt ON dbo.MoveAdvisorUserMaintenances (UserId, CreatedAt DESC);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserValuations_UserId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserValuations'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserValuations_UserId_CreatedAt ON dbo.MoveAdvisorUserValuations (UserId, CreatedAt DESC);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserVehicleStates_UserId_State_UpdatedAt' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserVehicleStates'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserVehicleStates_UserId_State_UpdatedAt ON dbo.MoveAdvisorUserVehicleStates (UserId, [State], UpdatedAt DESC);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserSavedOffers_UserId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserSavedOffers'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserSavedOffers_UserId_CreatedAt ON dbo.MoveAdvisorUserSavedOffers (UserId, CreatedAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorUsers', N'U') IS NOT NULL
BEGIN
  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserVehicles t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;

  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserAppointments t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;

  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserInsurances t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;

  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserMaintenances t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;

  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserValuations t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;

  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserVehicleStates t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;

  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserSavedOffers t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'YearInt') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles ADD YearInt SMALLINT NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'MileageKm') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles ADD MileageKm INT NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'PriceAmount') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles ADD PriceAmount DECIMAL(12,2) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'Co2GKm') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles ADD Co2GKm DECIMAL(10,2) NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'LastIvtDate') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles ADD LastIvtDate DATE NULL;
END;
IF COL_LENGTH(N'dbo.MoveAdvisorUserVehicles', N'NextIvtDate') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles ADD NextIvtDate DATE NULL;
END;

GO

UPDATE dbo.MoveAdvisorUserVehicles
SET
  YearInt = COALESCE(YearInt, TRY_CONVERT(SMALLINT, NULLIF([Year], N''))),
  MileageKm = COALESCE(MileageKm, TRY_CONVERT(INT, NULLIF(REPLACE(REPLACE(Mileage, N'.', N''), N',', N''), N''))),
  PriceAmount = COALESCE(PriceAmount, TRY_CONVERT(DECIMAL(12,2), NULLIF(REPLACE(REPLACE(Price, N'.', N''), N',', N'.'), N''))),
  Co2GKm = COALESCE(Co2GKm, TRY_CONVERT(DECIMAL(10,2), NULLIF(REPLACE(REPLACE(Co2, N'.', N''), N',', N'.'), N''))),
  LastIvtDate = COALESCE(LastIvtDate, TRY_CONVERT(DATE, NULLIF(LastIvt, N''), 103), TRY_CONVERT(DATE, NULLIF(LastIvt, N''), 120)),
  NextIvtDate = COALESCE(NextIvtDate, TRY_CONVERT(DATE, NULLIF(NextIvt, N''), 103), TRY_CONVERT(DATE, NULLIF(NextIvt, N''), 120));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_MoveAdvisorUserVehicles_YearInt_Valid')
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD CONSTRAINT CK_MoveAdvisorUserVehicles_YearInt_Valid CHECK (YearInt IS NULL OR (YearInt BETWEEN 1950 AND 2100));
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_MoveAdvisorUserVehicles_MileageKm_Valid')
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD CONSTRAINT CK_MoveAdvisorUserVehicles_MileageKm_Valid CHECK (MileageKm IS NULL OR MileageKm >= 0);
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_MoveAdvisorUserVehicles_PriceAmount_Valid')
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserVehicles
    ADD CONSTRAINT CK_MoveAdvisorUserVehicles_PriceAmount_Valid CHECK (PriceAmount IS NULL OR PriceAmount >= 0);
END;
-- END 3NF NORMALIZATION

-- Allow sell-flow valuations without a garage vehicle (VehicleId becomes optional)
IF EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = N'FK_MoveAdvisorUserValuations_Vehicle'
    AND parent_object_id = OBJECT_ID(N'dbo.MoveAdvisorUserValuations')
)
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserValuations
    DROP CONSTRAINT FK_MoveAdvisorUserValuations_Vehicle;
END;

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.MoveAdvisorUserValuations')
    AND name = N'VehicleId'
    AND is_nullable = 0
)
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserValuations ALTER COLUMN VehicleId NVARCHAR(64) NULL;
END;

-- =========================================================
-- BEGIN USER DATA EXTENSIONS (comparaciones, alertas, prefs)
-- =========================================================

-- Comparaciones / análisis guardados por usuario
IF OBJECT_ID(N'dbo.MoveAdvisorUserSavedComparisons', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserSavedComparisons (
    Id           NVARCHAR(64)   NOT NULL PRIMARY KEY,
    UserEmail    NVARCHAR(255)  NOT NULL,
    UserId       NVARCHAR(64)   NULL,
    Title        NVARCHAR(255)  NOT NULL CONSTRAINT DF_MoveAdvisorUserSavedComparisons_Title DEFAULT (N''),
    Mode         NVARCHAR(30)   NOT NULL CONSTRAINT DF_MoveAdvisorUserSavedComparisons_Mode  DEFAULT (N'buy'),
    ComparisonPayload NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorUserSavedComparisons_Payload DEFAULT (N'{}'),
    CreatedAt    DATETIME2      NOT NULL,
    UpdatedAt    DATETIME2      NOT NULL
  );

  CREATE INDEX IX_MoveAdvisorUserSavedComparisons_UserEmail_CreatedAt
    ON dbo.MoveAdvisorUserSavedComparisons (UserEmail, CreatedAt DESC);
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserSavedComparisons', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserSavedComparisons ADD UserId NVARCHAR(64) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserSavedComparisons_UserId_CreatedAt'
               AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserSavedComparisons'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserSavedComparisons_UserId_CreatedAt
    ON dbo.MoveAdvisorUserSavedComparisons (UserId, CreatedAt DESC);
END;

-- Alertas de mercado (reglas de precio)
IF OBJECT_ID(N'dbo.MoveAdvisorUserMarketAlerts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserMarketAlerts (
    Id             NVARCHAR(64)   NOT NULL PRIMARY KEY,
    UserEmail      NVARCHAR(255)  NOT NULL,
    UserId         NVARCHAR(64)   NULL,
    Title          NVARCHAR(255)  NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Title DEFAULT (N''),
    Mode           NVARCHAR(30)   NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Mode  DEFAULT (N'buy'),
    Brand          NVARCHAR(100)  NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Brand DEFAULT (N''),
    Model          NVARCHAR(120)  NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Model DEFAULT (N''),
    MaxPrice       NVARCHAR(40)   NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_MaxPrice DEFAULT (N''),
    MaxMileage     NVARCHAR(40)   NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_MaxMileage DEFAULT (N''),
    Fuel           NVARCHAR(60)   NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Fuel DEFAULT (N''),
    Location       NVARCHAR(160)  NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Location DEFAULT (N''),
    Color          NVARCHAR(60)   NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Color DEFAULT (N''),
    NotifyByEmail  BIT            NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_NotifyByEmail DEFAULT (0),
    AlertEmail     NVARCHAR(255)  NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_AlertEmail DEFAULT (N''),
    Status         NVARCHAR(30)   NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_Status DEFAULT (N'active'),
    AlertPayload   NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlerts_AlertPayload DEFAULT (N'{}'),
    CreatedAt      DATETIME2      NOT NULL,
    UpdatedAt      DATETIME2      NOT NULL,
    CONSTRAINT CK_MoveAdvisorUserMarketAlerts_Status
      CHECK (Status IN (N'active', N'paused', N'deleted'))
  );

  CREATE INDEX IX_MoveAdvisorUserMarketAlerts_UserEmail_CreatedAt
    ON dbo.MoveAdvisorUserMarketAlerts (UserEmail, CreatedAt DESC);
END;

IF COL_LENGTH(N'dbo.MoveAdvisorUserMarketAlerts', N'UserId') IS NULL
BEGIN
  ALTER TABLE dbo.MoveAdvisorUserMarketAlerts ADD UserId NVARCHAR(64) NULL;
END;

GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveAdvisorUserMarketAlerts_UserId_CreatedAt'
               AND object_id = OBJECT_ID(N'dbo.MoveAdvisorUserMarketAlerts'))
BEGIN
  CREATE INDEX IX_MoveAdvisorUserMarketAlerts_UserId_CreatedAt
    ON dbo.MoveAdvisorUserMarketAlerts (UserId, CreatedAt DESC);
END;

-- Estado de visto de cada alerta por usuario (1:1 con la alerta)
IF OBJECT_ID(N'dbo.MoveAdvisorUserMarketAlertStatus', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserMarketAlertStatus (
    AlertId    NVARCHAR(64)  NOT NULL PRIMARY KEY,
    UserEmail  NVARCHAR(255) NOT NULL,
    SeenCount  INT           NOT NULL CONSTRAINT DF_MoveAdvisorUserMarketAlertStatus_SeenCount DEFAULT (0),
    LastSeenAt DATETIME2     NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserMarketAlertStatus_Alert
      FOREIGN KEY (AlertId) REFERENCES dbo.MoveAdvisorUserMarketAlerts(Id) ON DELETE CASCADE,
    CONSTRAINT CK_MoveAdvisorUserMarketAlertStatus_SeenCount
      CHECK (SeenCount >= 0)
  );

  CREATE INDEX IX_MoveAdvisorUserMarketAlertStatus_UserEmail
    ON dbo.MoveAdvisorUserMarketAlertStatus (UserEmail);
END;

-- Preferencias de usuario (una fila por usuario, PK = email)
IF OBJECT_ID(N'dbo.MoveAdvisorUserPreferences', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserPreferences (
    UserEmail            NVARCHAR(255) NOT NULL PRIMARY KEY,
    UserId               NVARCHAR(64)  NULL,
    FullName             NVARCHAR(120) NOT NULL CONSTRAINT DF_MoveAdvisorUserPreferences_FullName DEFAULT (N''),
    Language             NVARCHAR(10)  NOT NULL CONSTRAINT DF_MoveAdvisorUserPreferences_Language DEFAULT (N'es'),
    Region               NVARCHAR(10)  NOT NULL CONSTRAINT DF_MoveAdvisorUserPreferences_Region   DEFAULT (N'es'),
    NotifyPriceAlerts    BIT           NOT NULL CONSTRAINT DF_MoveAdvisorUserPreferences_NPAlerts  DEFAULT (1),
    NotifyAppointments   BIT           NOT NULL CONSTRAINT DF_MoveAdvisorUserPreferences_NAppts    DEFAULT (1),
    NotifyAnalysisReady  BIT           NOT NULL CONSTRAINT DF_MoveAdvisorUserPreferences_NAnalysis DEFAULT (1),
    WeeklyDigest         BIT           NOT NULL CONSTRAINT DF_MoveAdvisorUserPreferences_WDigest   DEFAULT (1),
    UpdatedAt            DATETIME2     NOT NULL
  );
END;

-- Backfill UserId en nuevas tablas para usuarios ya existentes
IF OBJECT_ID(N'dbo.MoveAdvisorUsers', N'U') IS NOT NULL
BEGIN
  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserSavedComparisons t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;

  UPDATE t SET UserId = u.Id
  FROM dbo.MoveAdvisorUserMarketAlerts t
  INNER JOIN dbo.MoveAdvisorUsers u ON LOWER(u.Email) = LOWER(t.UserEmail)
  WHERE t.UserId IS NULL;
END;

-- =========================================================
-- END USER DATA EXTENSIONS
-- =========================================================
