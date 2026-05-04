SET XACT_ABORT ON;
BEGIN TRAN;

WITH src AS (
  SELECT *
  FROM (VALUES
    (N'https://www.ocasionplus.com/coches-segunda-mano/dacia-sandero-stepway-essential-tce-glp-con-94269km-2018-pmx73qah', N'ocasionplus', N'Dacia', N'Sandero', N'Essential TCE (90 CV) GLP', N'GLP', N'compra', CAST(9800 AS decimal(18,2)), CAST(174 AS decimal(18,2)), CAST(8910 AS decimal(18,2)), 2018, 94269, N'Ciudad Real', N'Valdepeñas', N'https://img.ocasionplus.com/RbfE1_VX85rhM-DHj7NSACHPwywXvvMYH9795iOk2Nw/normal_ao_auto/aHR0cHM6Ly9mb3Rvcy5lc3RhdGljb3NtZi5jb20vZm90b3NfYW51bmNpb3MvMDAvMDgvMzMvODQvMDMvNS94MDEuanBnPzE0OTA5NTIxMDEy', N'Dacia Sandero Essential TCE (90 CV) GLP GLP', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Manual', N'SUV', N'ECO', 5, 5, 90, N'Negro', N'profesional', N'', 0, N'Delantera', N'898CC', N'114g/km', N'01/10/2026', 66, CAST(7.0 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/ford-fiesta-10-ecoboost-70kw-95cv-active-ss-5p-gasolina-manual-getafe-fuenlabrada_903000000258816/', N'flexicar', N'Ford', N'Fiesta', N'1.0 EcoBoost 70kW (95CV) Active S/S 5p', N'gasolina', N'compra', CAST(10490 AS decimal(18,2)), CAST(140 AS decimal(18,2)), CAST(8990 AS decimal(18,2)), 2019, 139926, N'Madrid', N'Getafe', N'https://www.flexicar.es/images/903000000258816/imp2f_3PbI7gDtTj__8091KWN_ed01df3e95d94dc8a589b8ecc43cb0db_Exterior_7.jpeg-1440x856.webp', N'Ford Fiesta 1.0 EcoBoost 70kW (95CV) Active S/S 5p gasolina', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Manual', N'SUV', N'C', 5, 5, 95, N'Negro', N'profesional', N'', 0, N'Delantera', N'998CC', N'94g/km', NULL, 70, CAST(4.7 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-t-roc-rline-20-tdi-110kw-190cv-dsg-5p-2019-diesel-automatica-vilafranca-del-penedes_903000000150734/', N'flexicar', N'Volkswagen', N'T-Roc', N'Rline 2.0 TDI 110kW (190CV) DSG - 5P (2019)', N'Diesel', N'compra', CAST(24990 AS decimal(18,2)), CAST(324 AS decimal(18,2)), CAST(20790 AS decimal(18,2)), 2019, 75000, N'Barcelona', N'Vilafranca del Penedés', N'https://www.flexicar.es/images/903000000150734/imp2f_CZuShkWJR1__0094MCT_9fe69e8cd0814309af4733a852345d37_Exterior_2.jpg-1440x856.webp', N'Volkswagen T-Roc Rline 2.0 TDI 110kW (190CV) DSG - 5P (2019) Diesel', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Automática', N'SUV', N'C', 5, 5, 190, N'Negro', N'profesional', N'', 0, N'Delantera', N'1968CC', N'131g/km', NULL, 110, CAST(4.7 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-10-tsi-81kw-110cv-gasolina-manual-dos-hermanas_903000000228918/', N'flexicar', N'Volkswagen', N'Golf', N'1.0 TSI 81kW (110CV)', N'gasolina', N'compra', CAST(16490 AS decimal(18,2)), CAST(225 AS decimal(18,2)), CAST(14470 AS decimal(18,2)), 2021, 81106, N'Sevilla', N'Sevilla', N'https://www.flexicar.es/images/903000000228918/imp2f_X43K99t8pP__img-6a0e787e-bf6f-49a9-9aa9-ec12b15253d4-1440x856.webp', N'Volkswagen Golf 1.0 TSI 81kW (110CV) gasolina', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Manual', N'Turismo', N'C', 5, 5, 110, N'Blanco', N'profesional', N'', 0, N'Delantera', N'999CC', N'120g/km', NULL, 81, CAST(5.3 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-tiguan-20-150cv-rline-diesel-automatica-getafe-fuenlabrada_903000000251908/', N'flexicar', N'Volkswagen', N'Tiguan', N'2.0 150CV RLINE', N'Diesel', N'compra', CAST(23990 AS decimal(18,2)), CAST(335 AS decimal(18,2)), CAST(21490 AS decimal(18,2)), 2019, 146642, N'Madrid', N'Fuenlabrada', N'https://www.flexicar.es/images/903000000251908/imp2f_uRdEilPLzP__4372LCT_312869f5c0e740a89a8bf53b2222401d_Exterior_1.jpeg-1440x856.webp', N'Volkswagen Tiguan 2.0 150CV RLINE Diesel', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Automática', N'SUV', N'C', 5, 5, 150, N'Blanco', N'profesional', N'', 0, N'Delantera', N'1968CC', N'150g/km', NULL, 110, CAST(5.5 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-t-cross-advance-10-tsi-81kw-110cv-dsg-gasolina-automatica-roquetas_903000000244752/', N'flexicar', N'Volkswagen', N'T-Cross', N'Advance 1.0 TSI 81kW (110CV) DSG', N'gasolina', N'compra', CAST(17990 AS decimal(18,2)), CAST(249 AS decimal(18,2)), CAST(15990 AS decimal(18,2)), 2021, 82500, N'Almería', N'Almería', N'https://www.flexicar.es/images/903000000244752/imp2f_R50YidXSz5__WhatsApp%20Image%202026-04-30%20at%2017.35.20-1440x856.webp', N'Volkswagen T-Cross Advance 1.0 TSI 81kW (110CV) DSG gasolina', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Automática', N'SUV', N'C', 5, 5, 110, N'Blanco', N'profesional', N'', 0, N'Delantera', N'999CC', N'112g/km', NULL, 81, CAST(4.9 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-20-tdi-110kw-150cv-diesel-manual-coslada_903000000252318/', N'flexicar', N'Volkswagen', N'Golf', N'Life 2.0 TDI 110kW (150CV)', N'Diesel', N'compra', CAST(25890 AS decimal(18,2)), CAST(363 AS decimal(18,2)), CAST(23290 AS decimal(18,2)), 2021, 48378, N'Madrid', N'Coslada', N'https://www.flexicar.es/images/903000000252318/imp2f_rcSYOjvYbQ__img-fbbcab0c-9018-4f4b-ab8f-d6483d156ca3-1440x856.webp', N'Volkswagen Golf Life 2.0 TDI 110kW (150CV) Diesel', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Manual', N'Turismo', N'C', 5, 5, 150, N'Rojo', N'profesional', N'', 0, N'Delantera', N'1968CC', N'113g/km', NULL, 110, CAST(3.9 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-20-tdi-85kw-115cv-variant-diesel-manual-sevilla-4_903000000242219/', N'flexicar', N'Volkswagen', N'Golf', N'Life 2.0 TDI 85kW (115CV) Variant', N'Diesel', N'compra', CAST(15490 AS decimal(18,2)), CAST(210 AS decimal(18,2)), CAST(13470 AS decimal(18,2)), 2021, 160409, N'Sevilla', N'Montes Sierra', N'https://www.flexicar.es/images/903000000242219/imp2f_VYCfmnObta__img-01b64c56-f199-4385-872a-1dce3312a2a8-1440x856.webp', N'Volkswagen Golf Life 2.0 TDI 85kW (115CV) Variant Diesel', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Manual', N'Turismo', N'C', 5, 5, 115, N'Gris', N'profesional', N'', 0, N'Delantera', N'1968CC', N'114g/km', NULL, 85, CAST(3.9 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-10-etsi-81kw-110cv-dsg-hibrido-no-enchufable-automatica-mostoles-2_903000000232889/', N'flexicar', N'Volkswagen', N'Golf', N'Life 1.0 eTSI 81kW (110CV) DSG', N'Hibrido', N'compra', CAST(21490 AS decimal(18,2)), CAST(295 AS decimal(18,2)), CAST(18990 AS decimal(18,2)), 2023, 79630, N'Madrid', N'Móstoles', N'https://www.flexicar.es/images/903000000232889/imp2f_LDRkUDpnTa__img-7f147792-bb91-4ac4-99b0-8c999f19c9a6-1440x856.webp', N'Volkswagen Golf Life 1.0 eTSI 81kW (110CV) DSG Hibrido', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Automática', N'Turismo', N'ECO', 5, 5, 110, N'Blanco', N'profesional', N'', 0, N'Delantera', N'999CC', N'112g/km', NULL, 81, CAST(5.2 AS decimal(6,2))),
    (N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-15-etsi-96kw-130cv-dsg-variant-hibrido-no-enchufable-automatica-san-sebastian-de-los-reyes_903000000235604/', N'flexicar', N'Volkswagen', N'Golf', N'Life 1.5 eTSI 96kW (130CV) DSG Variant', N'Hibrido', N'compra', CAST(18790 AS decimal(18,2)), CAST(258 AS decimal(18,2)), CAST(16590 AS decimal(18,2)), 2021, 85081, N'Madrid', N'San Sebastián de los Reyes', N'https://www.flexicar.es/images/903000000235604/imp2f_uXsjBWAdZF__6433LTN_317ed50a908b40459a3c85936d41af16_Exterior_7.jpeg-1440x856.webp', N'Volkswagen Golf Life 1.5 eTSI 96kW (130CV) DSG Variant Hibrido', CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 09:54:12.0000000' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), CAST('2026-05-03 10:12:31.1587200' AS datetime2), N'Automática', N'Turismo', N'ECO', 5, 5, 131, N'Blanco', N'profesional', N'', 0, N'Delantera', N'1498CC', N'124g/km', NULL, 96, CAST(4.8 AS decimal(6,2)))
  ) AS v(
    Url, Portal, Brand, Model, Version, Fuel, ListingType, Price, MonthlyPrice, FinancePrice,
    [Year], Mileage, Province, City, ImageUrl, Title, ListedAt, SourceUpdatedAt, FirstSeenAt, LastSeenAt,
    Transmission, BodyType, EnvironmentalLabel, Doors, Seats, PowerCv, Color, SellerType, DealerName,
    WarrantyMonths, Traction, Displacement, Co2, NextITV, PowerKw, Consumption
  )
)
MERGE dbo.MoveAdvisorMarketOffers AS target
USING src
ON target.Url = src.Url
WHEN MATCHED THEN
  UPDATE SET
    target.Portal = src.Portal,
    target.Brand = src.Brand,
    target.Model = src.Model,
    target.Version = src.Version,
    target.Fuel = src.Fuel,
    target.ListingType = src.ListingType,
    target.Price = src.Price,
    target.MonthlyPrice = src.MonthlyPrice,
    target.FinancePrice = src.FinancePrice,
    target.[Year] = src.[Year],
    target.Mileage = src.Mileage,
    target.Province = src.Province,
    target.City = src.City,
    target.ImageUrl = src.ImageUrl,
    target.Title = src.Title,
    target.ListedAt = src.ListedAt,
    target.SourceUpdatedAt = src.SourceUpdatedAt,
    target.FirstSeenAt = src.FirstSeenAt,
    target.LastSeenAt = src.LastSeenAt,
    target.Transmission = src.Transmission,
    target.BodyType = src.BodyType,
    target.EnvironmentalLabel = src.EnvironmentalLabel,
    target.Doors = src.Doors,
    target.Seats = src.Seats,
    target.PowerCv = src.PowerCv,
    target.Color = src.Color,
    target.SellerType = src.SellerType,
    target.DealerName = src.DealerName,
    target.WarrantyMonths = src.WarrantyMonths,
    target.Traction = src.Traction,
    target.Displacement = src.Displacement,
    target.Co2 = src.Co2,
    target.NextITV = src.NextITV,
    target.PowerKw = src.PowerKw,
    target.Consumption = src.Consumption,
    target.RawPayload = N'{}'
WHEN NOT MATCHED THEN
  INSERT (
    Id, Url, Portal, Brand, Model, Version, Fuel, ListingType, Price, MonthlyPrice, FinancePrice,
    [Year], Mileage, Province, City, ImageUrl, Title, ListedAt, SourceUpdatedAt, FirstSeenAt, LastSeenAt,
    RawPayload, Transmission, BodyType, EnvironmentalLabel, Doors, Seats, PowerCv, Color, SellerType,
    DealerName, WarrantyMonths, Traction, Displacement, Co2, NextITV, PowerKw, Consumption
  )
  VALUES (
    LOWER(CONVERT(varchar(40), HASHBYTES('SHA1', src.Url), 2)),
    src.Url, src.Portal, src.Brand, src.Model, src.Version, src.Fuel, src.ListingType, src.Price, src.MonthlyPrice, src.FinancePrice,
    src.[Year], src.Mileage, src.Province, src.City, src.ImageUrl, src.Title, src.ListedAt, src.SourceUpdatedAt, src.FirstSeenAt, src.LastSeenAt,
    N'{}', src.Transmission, src.BodyType, src.EnvironmentalLabel, src.Doors, src.Seats, src.PowerCv, src.Color, src.SellerType,
    ISNULL(src.DealerName, N''), src.WarrantyMonths, src.Traction, src.Displacement, src.Co2, src.NextITV, src.PowerKw, src.Consumption
  );

COMMIT;

SELECT COUNT(*) AS inserted_or_updated
FROM dbo.MoveAdvisorMarketOffers
WHERE Url IN (
  N'https://www.ocasionplus.com/coches-segunda-mano/dacia-sandero-stepway-essential-tce-glp-con-94269km-2018-pmx73qah',
  N'https://www.flexicar.es/coches-ocasion/ford-fiesta-10-ecoboost-70kw-95cv-active-ss-5p-gasolina-manual-getafe-fuenlabrada_903000000258816/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-t-roc-rline-20-tdi-110kw-190cv-dsg-5p-2019-diesel-automatica-vilafranca-del-penedes_903000000150734/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-10-tsi-81kw-110cv-gasolina-manual-dos-hermanas_903000000228918/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-tiguan-20-150cv-rline-diesel-automatica-getafe-fuenlabrada_903000000251908/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-t-cross-advance-10-tsi-81kw-110cv-dsg-gasolina-automatica-roquetas_903000000244752/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-20-tdi-110kw-150cv-diesel-manual-coslada_903000000252318/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-20-tdi-85kw-115cv-variant-diesel-manual-sevilla-4_903000000242219/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-10-etsi-81kw-110cv-dsg-hibrido-no-enchufable-automatica-mostoles-2_903000000232889/',
  N'https://www.flexicar.es/coches-ocasion/volkswagen-golf-life-15-etsi-96kw-130cv-dsg-variant-hibrido-no-enchufable-automatica-san-sebastian-de-los-reyes_903000000235604/'
);