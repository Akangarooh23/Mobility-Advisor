SET XACT_ABORT ON;

IF OBJECT_ID('dbo.MoveAdvisorMarketOffers', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.MoveAdvisorMarketOffers;
END
GO

CREATE TABLE dbo.MoveAdvisorMarketOffers (
  Id nvarchar(40) NOT NULL,
  Url nvarchar(2000) NOT NULL,
  Portal nvarchar(100) NOT NULL,
  Brand nvarchar(120) NOT NULL,
  Model nvarchar(160) NOT NULL,
  Version nvarchar(500) NOT NULL,
  Fuel nvarchar(80) NOT NULL,
  ListingType nvarchar(40) NOT NULL,
  Price decimal(18,2) NULL,
  MonthlyPrice decimal(18,2) NULL,
  FinancePrice decimal(18,2) NULL,
  [Year] int NULL,
  Mileage int NULL,
  Province nvarchar(120) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Province DEFAULT (N''),
  City nvarchar(120) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_City DEFAULT (N''),
  ImageUrl nvarchar(2000) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_ImageUrl DEFAULT (N''),
  Title nvarchar(500) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Title DEFAULT (N''),
  ListedAt datetime2 NULL,
  SourceUpdatedAt datetime2 NULL,
  FirstSeenAt datetime2 NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_FirstSeenAt DEFAULT (SYSUTCDATETIME()),
  LastSeenAt datetime2 NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_LastSeenAt DEFAULT (SYSUTCDATETIME()),
  RawPayload nvarchar(max) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_RawPayload DEFAULT (N'{}'),
  Transmission nvarchar(80) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Transmission DEFAULT (N''),
  BodyType nvarchar(80) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_BodyType DEFAULT (N''),
  EnvironmentalLabel nvarchar(50) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_EnvironmentalLabel DEFAULT (N''),
  Doors int NULL,
  Seats int NULL,
  PowerCv int NULL,
  Color nvarchar(80) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Color DEFAULT (N''),
  SellerType nvarchar(80) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_SellerType DEFAULT (N''),
  DealerName nvarchar(200) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_DealerName DEFAULT (N''),
  WarrantyMonths int NULL,
  Traction nvarchar(100) NULL,
  Displacement nvarchar(50) NULL,
  Co2 nvarchar(50) NULL,
  NextITV nvarchar(50) NULL,
  PowerKw int NULL,
  Consumption decimal(6,2) NULL,
  CONSTRAINT PK_MoveAdvisorMarketOffers PRIMARY KEY CLUSTERED (Id)
);
GO

CREATE INDEX IX_MoveAdvisorMarketOffers_Url ON dbo.MoveAdvisorMarketOffers (Url);
CREATE INDEX IX_MoveAdvisorMarketOffers_Portal ON dbo.MoveAdvisorMarketOffers (Portal);
GO

SELECT COUNT(*) AS total_after_recreate FROM dbo.MoveAdvisorMarketOffers;
