SET NOCOUNT ON;

-- 1) Nuevas columnas para enriquecimiento de oferta (si no existen)
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'FinancePrice') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD FinancePrice DECIMAL(18,2) NULL;

IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Traction') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Traction NVARCHAR(80) NULL;

IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Displacement') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Displacement NVARCHAR(40) NULL;

IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Co2') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Co2 NVARCHAR(40) NULL;

IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'NextITV') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD NextITV NVARCHAR(40) NULL;

IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'PowerKw') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD PowerKw INT NULL;

IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Consumption') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Consumption DECIMAL(6,2) NULL;

GO

-- 2) Actualización de 10 registros por Id (referencia del usuario)
;WITH src AS (
  SELECT *
  FROM (VALUES
    (
      N'0014c17d9788005b1198c744ab5a279dac021c2d', N'https://www.autohero.com/es/audi-a-3-sportback/id/5b102f9a-c026-4f28-a09c-5ffd9c5a2e29/', N'autohero', N'Audi', N'A3 Sportback', N'1.6 TDI (110CV) 81kW', N'Diesel', N'compra',
      CAST(13299 AS DECIMAL(18,2)), CAST(233 AS DECIMAL(18,2)), CAST(12666 AS DECIMAL(18,2)),
      2016, 149721, N'', N'',
      N'https://img-eu-c1.autohero.com/img/7355861b95b0f49778674c655ff87f8d7ff93792907be361db98de33a23b038c/exterior/1/1116x744-95258203087f426fa9731b4836244dd2.jpg',
      N'Audi A3 Sportback 1.6 TDI (110CV) 81kW Diesel',
      CAST('2026-05-03T09:54:12' AS DATETIME2), CAST('2026-05-03T09:54:12' AS DATETIME2), CAST('2026-05-03T10:12:31.1587200' AS DATETIME2), CAST('2026-05-03T10:12:31.1587200' AS DATETIME2),
      N'Manual', N'Berlina', N'C', 5, 5, 110, N'Negro', N'profesional', N'', 0,
      N'Delantera', N'1598cc', N'105g/km', N'46206', 81, CAST(4.5 AS DECIMAL(6,2))
    ),
    (
      N'001912e02246cf66528031a7d8f9db9074812922', N'https://www.flexicar.es/coches-ocasion/bmw-serie-1-118d-diesel-automatica-marbella_903000000224575/', N'flexicar', N'BMW', N'Serie 1', N'118d', N'Diesel', N'compra',
      CAST(28990 AS DECIMAL(18,2)), CAST(403 AS DECIMAL(18,2)), CAST(25970 AS DECIMAL(18,2)),
      2024, 14823, N'Málaga', N'Marbella',
      N'https://www.flexicar.es/images/903000000224575/imp2f_u8nwMxYTF3__img-b1b2545b-ec63-433d-9daf-cf03b7ba4dcb-1440x856.webp',
      N'BMW Serie 1 118d Diesel',
      CAST('2026-05-02T16:19:39' AS DATETIME2), CAST('2026-05-02T16:19:39' AS DATETIME2), CAST('2026-05-02T16:21:18.5371147' AS DATETIME2), CAST('2026-05-02T16:21:18.5371147' AS DATETIME2),
      N'Automatica', N'Berlina', N'C', 5, 5, 150, N'Gris', N'profesional', N'', 0,
      N'Delantera', N'1995CC', N'122g/km', NULL, 112, CAST(4.7 AS DECIMAL(6,2))
    ),
    (
      N'001a03de10a0b8d87ade85f955db34d7cd42684f', N'https://www.flexicar.es/coches-ocasion/jaecoo-7-select-16-tgdi-108kw-145cv-fwd-gasolina-automatica-gijon_903000000225154/', N'flexicar', N'Jaecoo', N'7', N'Select 1.6 TGDI 108kW (145CV) FWD', N'Gasolina', N'compra',
      CAST(25990 AS DECIMAL(18,2)), CAST(347 AS DECIMAL(18,2)), CAST(22380 AS DECIMAL(18,2)),
      2025, 14987, N'Gijon', N'Gijon',
      N'https://www.flexicar.es/images/903000000225154/imp2f_Df0S69pi1D__img-8354399b-2a2e-4fc9-bdd9-fb173f2f2eaa-1440x856.webp',
      N'Jaecoo 7 Select 1.6 TGDI 108kW (145CV) FWD Gasolina',
      CAST('2026-05-02T18:12:53' AS DATETIME2), CAST('2026-05-02T18:12:53' AS DATETIME2), CAST('2026-05-02T16:21:14.5752561' AS DATETIME2), CAST('2026-05-02T18:14:06.9538225' AS DATETIME2),
      N'Automatica', N'SUV', N'C', 5, 5, 147, N'Azul', N'profesional', N'', 0,
      N'Delantera', N'1598CC', N'169g/km', NULL, 108, CAST(7.5 AS DECIMAL(6,2))
    ),
    (
      N'0030ff3cbcbf5f894499f72056070577012e476a', N'https://www.flexicar.es/coches-ocasion/ford-s-max-20-tdci-132kw-titanium-powershift-diesel-automatica-coruna_903000000176689/', N'flexicar', N'Ford', N'S-Max', N'2.0 TDCi 132kW Titanium PowerShift', N'Diesel', N'compra',
      CAST(19990 AS DECIMAL(18,2)), CAST(288 AS DECIMAL(18,2)), CAST(17490 AS DECIMAL(18,2)),
      2017, 127993, N'A Coruña', N'A Coruña',
      N'https://www.flexicar.es/images/903000000176689/imp2f_Pg6cHiXKlS__img-40d1b26f-07b4-45ef-9b02-41eb84f6d37e-1440x856.webp',
      N'Ford S-Max 2.0 TDCi 132kW Titanium PowerShift Diesel',
      CAST('2026-05-03T09:59:41' AS DATETIME2), CAST('2026-05-03T09:59:41' AS DATETIME2), CAST('2026-05-03T10:12:42.3313007' AS DATETIME2), CAST('2026-05-03T10:12:42.3313007' AS DATETIME2),
      N'Automatica', N'Monovolumen', N'C', 5, 5, 180, N'Granate', N'profesional', N'Pedro Fernández', 0,
      N'Delantera', N'1997CC', N'129g/km', NULL, 132, CAST(5.4 AS DECIMAL(6,2))
    ),
    (
      N'0045f6b5857b79b51a92efe4bf11b0252331f27c', N'https://www.flexicar.es/coches-ocasion/toyota-rav4-25l-220h-business-hibrido-no-enchufable-automatica-san-sebastian-de-los-reyes_903000000166327/', N'flexicar', N'Toyota', N'Rav4', N'2.5l 220H Business', N'Hibrido', N'compra',
      CAST(25490 AS DECIMAL(18,2)), CAST(350 AS DECIMAL(18,2)), CAST(22490 AS DECIMAL(18,2)),
      2020, 118704, N'Madrid', N'San Sebastián de los Reyes',
      N'https://www.flexicar.es/images/903000000166327/imp2f_bgMOhXFdbu__1655LJH_5948c94d9158418a8b911fa4743b376c_Exterior_1.jpeg-1440x856.webp',
      N'Toyota Rav4 2.5l 220H Business Hibrido',
      CAST('2026-05-03T09:57:48' AS DATETIME2), CAST('2026-05-03T09:57:48' AS DATETIME2), CAST('2026-05-02T16:21:14.5691442' AS DATETIME2), CAST('2026-05-03T10:12:42.1880808' AS DATETIME2),
      N'Automatica', N'SUV', N'ECO', 5, 5, 218, N'Blanco', N'profesional', N'', 0,
      N'Delantera', N'2487CC', N'102g/km', NULL, 160, CAST(4.5 AS DECIMAL(6,2))
    ),
    (
      N'004b6ae66607e843fc960193fc92e6c949d0410a', N'https://www.flexicar.es/coches-ocasion/dacia-dokker-ambiance-dci-55kw-75cv-diesel-manual-cordoba_903000000173392/', N'flexicar', N'Dacia', N'Dokker', N'Ambiance dci 55kW (75CV)', N'Diesel', N'compra',
      CAST(11190 AS DECIMAL(18,2)), CAST(152 AS DECIMAL(18,2)), CAST(9790 AS DECIMAL(18,2)),
      2017, 117864, N'Cordoba', N'Cordoba',
      N'https://www.flexicar.es/images/903000000173392/imp2f_ISj4qh8avj__IMG-20250806-WA0673-1440x856.webp',
      N'Dacia Dokker Ambiance dci 55kW (75CV) Diesel',
      CAST('2026-05-02T16:23:15' AS DATETIME2), CAST('2026-05-02T16:23:15' AS DATETIME2), CAST('2026-05-02T16:24:10.9559373' AS DATETIME2), CAST('2026-05-02T16:24:10.9559373' AS DATETIME2),
      N'Manual', N'Furgoneta', N'C', 4, 5, 75, N'Blanco', N'profesional', N'', 0,
      N'Delantera', N'1461CC', N'108g/km', NULL, 55, CAST(4.2 AS DECIMAL(6,2))
    ),
    (
      N'005650b07d94383079c31980e53f7b0f7e6220fc', N'https://www.autoscout24.es/anuncios/omoda-5-hibrido-1-tgdi-premium-electro-gasolina-gris-b18e9379-17af-4349-9d00-0fed8e37f69c', N'autoscout24', N'Omoda', N'5', N'1. TGDI Premium', N'Hibrido', N'compra',
      CAST(27500 AS DECIMAL(18,2)), CAST(0 AS DECIMAL(18,2)), CAST(0 AS DECIMAL(18,2)),
      2026, 5, N'Salamanca', N'Villares de la Reina',
      N'https://prod.pictures.autoscout24.net/listing-images/b18e9379-17af-4349-9d00-0fed8e37f69c_f1efc590-ac40-4c8e-be62-9851e079fc57.jpg/720x540.webp',
      N'Omoda 5 1. TGDI Premium Hibrido',
      CAST('2026-05-02T18:01:23' AS DATETIME2), CAST('2026-05-02T18:01:23' AS DATETIME2), CAST('2026-05-02T17:22:29.3316005' AS DATETIME2), CAST('2026-05-02T18:13:56.3996127' AS DATETIME2),
      N'Automatica', N'SUV', N'ECO', 5, 5, 224, N'Blanco', N'profesional', N'', 0,
      N'Delantera', N'1499CC', N'120g/km', NULL, 165, CAST(5.3 AS DECIMAL(6,2))
    ),
    (
      N'0064909363c423428820f551843b6d38689b472d', N'https://www.flexicar.es/coches-ocasion/dacia-sandero-essential-74kw-100cv-eco-g-glp-manual-lugo_903000000224492/', N'flexicar', N'Dacia', N'Sandero', N'Essential 74kW (100CV) ECO-G', N'GLP', N'compra',
      CAST(14790 AS DECIMAL(18,2)), CAST(202 AS DECIMAL(18,2)), CAST(12990 AS DECIMAL(18,2)),
      2025, 11084, N'Lugo', N'Lugo',
      N'https://www.flexicar.es/images/903000000224492/imp2f_UrRmxTCpuN__img-85cfcd61-6767-4b9f-98d2-b4e6dbca87bb-1440x856.webp',
      N'Dacia Sandero Essential 74kW (100CV) ECO-G GLP',
      CAST('2026-05-02T16:22:59' AS DATETIME2), CAST('2026-05-02T16:22:59' AS DATETIME2), CAST('2026-05-02T16:21:18.5543508' AS DATETIME2), CAST('2026-05-02T16:24:10.9385365' AS DATETIME2),
      N'Manual', N'Berlina', N'ECO', 5, 0, 101, N'Blanco', N'profesional', N'', 0,
      N'Delantera', N'999CC', N'105g/km', NULL, 74, CAST(5.4 AS DECIMAL(6,2))
    ),
    (
      N'00662e3ca0dd3bd75cdf3259e8de1ce4f4723da3', N'https://www.flexicar.es/coches-ocasion/opel-corsa-12t-xhl-74kw-100cv-gs-gasolina-manual-arrigorriaga_903000000172431/', N'flexicar', N'Opel', N'Corsa', N'1.2T XHL 74kW (100CV) GS', N'Gasolina', N'compra',
      CAST(13990 AS DECIMAL(18,2)), CAST(178 AS DECIMAL(18,2)), CAST(11490 AS DECIMAL(18,2)),
      2024, 34772, N'Vizcaya', N'Arrigorriaga',
      N'https://www.flexicar.es/images/903000000172431/imp2f_Y2RzeEYRpx__XGxRQSouQV__6577%20MNR_e91c731cc6434e64a05c78a96e2764c6_Exterior_1.jpeg-1440x856.webp',
      N'Opel Corsa 1.2T XHL 74kW (100CV) GS Gasolina',
      CAST('2026-05-03T09:59:16' AS DATETIME2), CAST('2026-05-03T09:59:16' AS DATETIME2), CAST('2026-05-02T16:21:14.8649718' AS DATETIME2), CAST('2026-05-03T10:12:42.3061330' AS DATETIME2),
      N'Manual', N'Berlina', N'C', 5, 5, 100, N'Negro', N'profesional', N'', 0,
      N'Delantera', N'1199CC', N'118g/km', NULL, 74, CAST(5.1 AS DECIMAL(6,2))
    ),
    (
      N'0067dd5ac5408dda5e9695b295227073d55f73fa', N'https://www.coches.com/coches-segunda-mano/ocasion-ford-focus-155-sportbreak-10-ecoboost-mhev-st-line.htm?id=ummxFcl9sdpp', N'coches.com', N'Ford', N'Focus', N'1.0 Ecoboost MHEV 114kW ST-Line', N'Hibrido', N'compra',
      CAST(15450 AS DECIMAL(18,2)), CAST(0 AS DECIMAL(18,2)), CAST(0 AS DECIMAL(18,2)),
      2022, 92000, N'Madrid', N'Madrid',
      N'https://img.coches.com/_ccom_/a3fccea3-a9bf-4b2d-ba61-cf609833e40d/72f29b89-706e-4cff-9b0f-fd945456e2c1.jpg?q=202605031402550000&p=cc_vo_high&w=720&ar=4:3',
      N'Ford Focus 1.0 Ecoboost MHEV 114kW ST-Line Hibrido',
      CAST('2026-05-03T09:36:57' AS DATETIME2), CAST('2026-05-03T09:36:57' AS DATETIME2), CAST('2026-05-02T15:49:26.9189893' AS DATETIME2), CAST('2026-05-03T10:12:30.8313661' AS DATETIME2),
      N'Manual', N'Berlina', N'ECO', 5, 5, 155, N'Negro', N'particular', N'', 12,
      N'Delantera', N'999CC', N'94g/km', NULL, 115, CAST(4.0 AS DECIMAL(6,2))
    )
  ) AS t(
    Id, Url, Portal, Brand, Model, Version, Fuel, ListingType,
    Price, MonthlyPrice, FinancePrice,
    [Year], Mileage, Province, City,
    ImageUrl, Title,
    ListedAt, SourceUpdatedAt, FirstSeenAt, LastSeenAt,
    Transmission, BodyType, EnvironmentalLabel, Doors, Seats, PowerCv, Color, SellerType, DealerName, WarrantyMonths,
    Traction, Displacement, Co2, NextITV, PowerKw, Consumption
  )
)
UPDATE m
SET
  m.Url = s.Url,
  m.Portal = s.Portal,
  m.Brand = s.Brand,
  m.Model = s.Model,
  m.Version = s.Version,
  m.Fuel = s.Fuel,
  m.ListingType = s.ListingType,
  m.Price = s.Price,
  m.MonthlyPrice = s.MonthlyPrice,
  m.FinancePrice = s.FinancePrice,
  m.[Year] = s.[Year],
  m.Mileage = s.Mileage,
  m.Province = s.Province,
  m.City = s.City,
  m.ImageUrl = s.ImageUrl,
  m.Title = s.Title,
  m.ListedAt = s.ListedAt,
  m.SourceUpdatedAt = s.SourceUpdatedAt,
  m.FirstSeenAt = s.FirstSeenAt,
  m.LastSeenAt = s.LastSeenAt,
  m.Transmission = s.Transmission,
  m.BodyType = s.BodyType,
  m.EnvironmentalLabel = s.EnvironmentalLabel,
  m.Doors = s.Doors,
  m.Seats = s.Seats,
  m.PowerCv = s.PowerCv,
  m.Color = s.Color,
  m.SellerType = s.SellerType,
  m.DealerName = s.DealerName,
  m.WarrantyMonths = s.WarrantyMonths,
  m.Traction = s.Traction,
  m.Displacement = s.Displacement,
  m.Co2 = s.Co2,
  m.NextITV = s.NextITV,
  m.PowerKw = s.PowerKw,
  m.Consumption = s.Consumption
FROM dbo.MoveAdvisorMarketOffers m
INNER JOIN src s ON s.Id = m.Id;

SELECT
  COUNT(*) AS updated_rows
FROM dbo.MoveAdvisorMarketOffers
WHERE Id IN (
  N'0014c17d9788005b1198c744ab5a279dac021c2d',
  N'001912e02246cf66528031a7d8f9db9074812922',
  N'001a03de10a0b8d87ade85f955db34d7cd42684f',
  N'0030ff3cbcbf5f894499f72056070577012e476a',
  N'0045f6b5857b79b51a92efe4bf11b0252331f27c',
  N'004b6ae66607e843fc960193fc92e6c949d0410a',
  N'005650b07d94383079c31980e53f7b0f7e6220fc',
  N'0064909363c423428820f551843b6d38689b472d',
  N'00662e3ca0dd3bd75cdf3259e8de1ce4f4723da3',
  N'0067dd5ac5408dda5e9695b295227073d55f73fa'
);
