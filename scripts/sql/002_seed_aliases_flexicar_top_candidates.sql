-- Auto-generated candidate alias seed for Flexicar + current portfolio
-- Generated on: 2026-05-15T13:49:14.038Z
-- Review before executing in production.

-- Summary
-- Brand candidates: 19
-- Model candidates (top): 50

INSERT INTO moveadvisor_brand_aliases (alias_name, canonical_name, source, is_active)
VALUES
  ('Ssangyong', 'Ssangyong', 'auto-flexicar-candidate', TRUE), -- offers=92; portals=autohero, flexicar
  ('Abarth', 'Abarth', 'auto-flexicar-candidate', TRUE), -- offers=63; portals=autohero, flexicar
  ('Iveco', 'Iveco', 'auto-flexicar-candidate', TRUE), -- offers=16; portals=flexicar
  ('Maserati', 'Maserati', 'auto-flexicar-candidate', TRUE), -- offers=11; portals=flexicar
  ('Infiniti', 'Infiniti', 'auto-flexicar-candidate', TRUE), -- offers=9; portals=flexicar
  ('DFSK', 'DFSK', 'auto-flexicar-candidate', TRUE), -- offers=6; portals=autohero, flexicar
  ('Dr Automobiles', 'Dr Automobiles', 'auto-flexicar-candidate', TRUE), -- offers=4; portals=flexicar
  ('Ebro', 'Ebro', 'auto-flexicar-candidate', TRUE), -- offers=4; portals=autohero, flexicar
  ('Swm', 'Swm', 'auto-flexicar-candidate', TRUE), -- offers=3; portals=flexicar
  ('XEV', 'XEV', 'auto-flexicar-candidate', TRUE), -- offers=2; portals=flexicar
  ('Aiways', 'Aiways', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=flexicar
  ('Chevrolet', 'Chevrolet', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=autohero
  ('CitroǮn', 'Citroen', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=ocasionplus
  ('Ineos', 'Ineos', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=flexicar
  ('Lancia', 'Lancia', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=flexicar
  ('Leapmotor', 'Leapmotor', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=flexicar
  ('Lifan', 'Lifan', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=flexicar
  ('Mahindra', 'Mahindra', 'auto-flexicar-candidate', TRUE), -- offers=1; portals=flexicar
  ('Maxus', 'Maxus', 'auto-flexicar-candidate', TRUE) -- offers=1; portals=flexicar
ON CONFLICT (alias_key)
DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO moveadvisor_model_aliases (brand_canonical_name, canonical_name, alias_name, source, is_active)
VALUES
  ('Mercedes-Benz', 'Clase A', 'Clase A', 'auto-flexicar-candidate', TRUE), -- offers=333; portals=autohero, flexicar
  ('Peugeot', '5008', '5008', 'auto-flexicar-candidate', TRUE), -- offers=238; portals=autohero, flexicar
  ('Kia', 'Stonic', 'Stonic', 'auto-flexicar-candidate', TRUE), -- offers=226; portals=autohero, flexicar
  ('Renault', 'Arkana', 'Arkana', 'auto-flexicar-candidate', TRUE), -- offers=207; portals=autohero, flexicar
  ('Citroen', 'C3 Aircross', 'C3 Aircross', 'auto-flexicar-candidate', TRUE), -- offers=204; portals=autohero, flexicar
  ('Kia', 'XCeed', 'XCeed', 'auto-flexicar-candidate', TRUE), -- offers=197; portals=autohero, flexicar
  ('Peugeot', 'Rifter', 'Rifter', 'auto-flexicar-candidate', TRUE), -- offers=179; portals=autohero, flexicar
  ('Mercedes-Benz', 'Clase GLC', 'Clase GLC', 'auto-flexicar-candidate', TRUE), -- offers=175; portals=autohero, flexicar
  ('BMW', 'X2', 'X2', 'auto-flexicar-candidate', TRUE), -- offers=169; portals=autohero, flexicar
  ('Mercedes-Benz', 'Clase C', 'Clase C', 'auto-flexicar-candidate', TRUE), -- offers=165; portals=autohero, flexicar
  ('Mercedes-Benz', 'Clase CLA', 'Clase CLA', 'auto-flexicar-candidate', TRUE), -- offers=160; portals=autohero, flexicar
  ('Mercedes-Benz', 'Clase GLA', 'Clase GLA', 'auto-flexicar-candidate', TRUE), -- offers=138; portals=autohero, flexicar
  ('Hyundai', 'Bayon', 'Bayon', 'auto-flexicar-candidate', TRUE), -- offers=137; portals=autohero, flexicar
  ('Audi', 'Q5', 'Q5', 'auto-flexicar-candidate', TRUE), -- offers=131; portals=autohero, flexicar
  ('Skoda', 'Karoq', 'Karoq', 'auto-flexicar-candidate', TRUE), -- offers=127; portals=autohero, flexicar
  ('Mini', 'Mini', 'Mini', 'auto-flexicar-candidate', TRUE), -- offers=126; portals=flexicar
  ('BMW', 'Serie 2', 'Serie 2', 'auto-flexicar-candidate', TRUE), -- offers=120; portals=autohero, flexicar
  ('MG', 'MG3', 'MG3', 'auto-flexicar-candidate', TRUE), -- offers=105; portals=flexicar
  ('Opel', 'Crossland', 'Crossland', 'auto-flexicar-candidate', TRUE), -- offers=101; portals=flexicar
  ('Peugeot', 'Traveller', 'Traveller', 'auto-flexicar-candidate', TRUE), -- offers=96; portals=flexicar
  ('Peugeot', '508', '508', 'auto-flexicar-candidate', TRUE), -- offers=95; portals=autohero, flexicar
  ('DS', 'DS 7 Crossback', 'DS 7 Crossback', 'auto-flexicar-candidate', TRUE), -- offers=93; portals=flexicar
  ('Kia', 'Picanto', 'Picanto', 'auto-flexicar-candidate', TRUE), -- offers=90; portals=autohero, flexicar
  ('Kia', 'Sorento', 'Sorento', 'auto-flexicar-candidate', TRUE), -- offers=90; portals=autohero, flexicar
  ('Omoda', '5', '5', 'auto-flexicar-candidate', TRUE), -- offers=90; portals=flexicar
  ('Seat', 'Tarraco', 'Tarraco', 'auto-flexicar-candidate', TRUE), -- offers=90; portals=autohero, flexicar
  ('Renault', 'Kadjar', 'Kadjar', 'auto-flexicar-candidate', TRUE), -- offers=89; portals=autohero, flexicar
  ('Fiat', '500X', '500X', 'auto-flexicar-candidate', TRUE), -- offers=88; portals=autohero, flexicar
  ('Audi', 'A4', 'A4', 'auto-flexicar-candidate', TRUE), -- offers=84; portals=autohero, flexicar
  ('Hyundai', 'i10', 'i10', 'auto-flexicar-candidate', TRUE), -- offers=84; portals=autohero, flexicar
  ('Kia', 'Rio', 'Rio', 'auto-flexicar-candidate', TRUE), -- offers=82; portals=autohero, flexicar
  ('Toyota', 'Yaris Cross', 'Yaris Cross', 'auto-flexicar-candidate', TRUE), -- offers=78; portals=autohero, flexicar
  ('BMW', 'Serie 4', 'Serie 4', 'auto-flexicar-candidate', TRUE), -- offers=77; portals=autohero, flexicar
  ('Ford', 'Transit Custom', 'Transit Custom', 'auto-flexicar-candidate', TRUE), -- offers=77; portals=autohero, flexicar
  ('Mercedes-Benz', 'Clase B', 'Clase B', 'auto-flexicar-candidate', TRUE), -- offers=77; portals=autohero, flexicar
  ('Opel', 'Combo', 'Combo', 'auto-flexicar-candidate', TRUE), -- offers=76; portals=flexicar
  ('Citroen', 'C4 Cactus', 'C4 Cactus', 'auto-flexicar-candidate', TRUE), -- offers=74; portals=autohero, flexicar
  ('Volkswagen', 'Taigo', 'Taigo', 'auto-flexicar-candidate', TRUE), -- offers=70; portals=autohero, flexicar
  ('Audi', 'Q3 Sportback', 'Q3 Sportback', 'auto-flexicar-candidate', TRUE), -- offers=69; portals=autohero, flexicar
  ('Peugeot', 'Partner', 'Partner', 'auto-flexicar-candidate', TRUE), -- offers=68; portals=autohero, flexicar
  ('Volkswagen', 'Caddy', 'Caddy', 'auto-flexicar-candidate', TRUE), -- offers=68; portals=autohero, flexicar
  ('Fiat', 'Ducato', 'Ducato', 'auto-flexicar-candidate', TRUE), -- offers=67; portals=flexicar
  ('Opel', 'Crossland X', 'Crossland X', 'auto-flexicar-candidate', TRUE), -- offers=66; portals=autohero, flexicar
  ('Opel', 'Grandland X', 'Grandland X', 'auto-flexicar-candidate', TRUE), -- offers=66; portals=autohero, flexicar
  ('Mercedes-Benz', 'Clase GLB', 'Clase GLB', 'auto-flexicar-candidate', TRUE), -- offers=60; portals=autohero, flexicar
  ('Volkswagen', 'Passat', 'Passat', 'auto-flexicar-candidate', TRUE), -- offers=60; portals=autohero, flexicar
  ('Ford', 'EcoSport', 'EcoSport', 'auto-flexicar-candidate', TRUE), -- offers=59; portals=flexicar
  ('Abarth', '500', '500', 'auto-flexicar-candidate', TRUE), -- offers=57; portals=autohero, flexicar
  ('BMW', 'X4', 'X4', 'auto-flexicar-candidate', TRUE), -- offers=57; portals=autohero, flexicar
  ('Audi', 'A5', 'A5', 'auto-flexicar-candidate', TRUE) -- offers=55; portals=flexicar
ON CONFLICT (alias_key, brand_key)
DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  is_active = TRUE,
  updated_at = NOW();

-- 3) Quick validation for this batch
SELECT 'brand_aliases' AS table_name, source, COUNT(*) AS rows_count
FROM moveadvisor_brand_aliases
WHERE source = 'auto-flexicar-candidate'
GROUP BY source
UNION ALL
SELECT 'model_aliases' AS table_name, source, COUNT(*) AS rows_count
FROM moveadvisor_model_aliases
WHERE source = 'auto-flexicar-candidate'
GROUP BY source;