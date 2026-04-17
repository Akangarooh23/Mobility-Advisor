IF OBJECT_ID(N'dbo.MoveAdvisorUserVehicles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserVehicles (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    UserEmail NVARCHAR(255) NOT NULL,
    Title NVARCHAR(180) NOT NULL,
    Brand NVARCHAR(100) NOT NULL,
    Model NVARCHAR(120) NOT NULL,
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

IF OBJECT_ID(N'dbo.MoveAdvisorUserVehicleFiles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUserVehicleFiles (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VehicleId NVARCHAR(64) NOT NULL,
    FileType NVARCHAR(20) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileSize BIGINT NOT NULL CONSTRAINT DF_MoveAdvisorUserVehicleFiles_FileSize DEFAULT (0),
    CreatedAt DATETIME2 NOT NULL,
    CONSTRAINT FK_MoveAdvisorUserVehicleFiles_Vehicle
      FOREIGN KEY (VehicleId) REFERENCES dbo.MoveAdvisorUserVehicles(Id) ON DELETE CASCADE,
    CONSTRAINT CK_MoveAdvisorUserVehicleFiles_FileType
      CHECK (FileType IN (N'photo', N'document'))
  );

  CREATE INDEX IX_MoveAdvisorUserVehicleFiles_VehicleId_FileType
    ON dbo.MoveAdvisorUserVehicleFiles (VehicleId, FileType);
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
