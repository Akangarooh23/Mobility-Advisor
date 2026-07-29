-- ─────────────────────────────────────────────────────────────────────────────
-- 011 — Flexicar city → province enrichment
--
-- Flexicar tiene city al 100% pero province vacío al 100%.
-- Este script construye el mapa ciudad→provincia y hace el UPDATE.
--
-- Pasos:
--   1. Ejecutar el SELECT de preview para confirmar que 0 filas quedan sin mapear.
--   2. Ejecutar el UPDATE.
--   3. Ejecutar el SELECT de verificación.
--
-- Ejecutar en Neon.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── STEP 1: Preview — qué ciudades NO están en el mapa (deben ser 0) ─────────
-- Si esta query devuelve filas, hay ciudades nuevas que añadir antes del UPDATE.
SELECT city, COUNT(*) AS n
FROM moveadvisor_market_offers
WHERE portal = 'flexicar'
  AND city <> ''
  AND CASE city
    -- Madrid
    WHEN 'Madrid'                             THEN 'Madrid'
    WHEN 'Rivas'                              THEN 'Madrid'
    WHEN 'Móstoles'                           THEN 'Madrid'
    WHEN 'Alcorcón'                           THEN 'Madrid'
    WHEN 'Las Rozas Européolis'               THEN 'Madrid'
    WHEN 'San Fernando de Henares'            THEN 'Madrid'
    WHEN 'Majadahonda'                        THEN 'Madrid'
    WHEN 'Alcobendas'                         THEN 'Madrid'
    WHEN 'San Sebastián de los Reyes'         THEN 'Madrid'
    WHEN 'Villalba'                           THEN 'Madrid'
    WHEN 'Leganés'                            THEN 'Madrid'
    WHEN 'Alcalá de Henares'                  THEN 'Madrid'
    WHEN 'Coslada'                            THEN 'Madrid'
    WHEN 'Getafe-Fuenlabrada'                 THEN 'Madrid'
    WHEN 'Colmenar Viejo'                     THEN 'Madrid'
    WHEN 'Fuenlabrada'                        THEN 'Madrid'
    WHEN 'Arganda del Rey'                    THEN 'Madrid'
    WHEN 'Aranjuez'                           THEN 'Madrid'
    WHEN 'Aravaca'                            THEN 'Madrid'
    WHEN 'Pinto'                              THEN 'Madrid'
    WHEN 'Autosmadrid Alcalá'                 THEN 'Madrid'
    WHEN 'Autosmadrid Móstoles'               THEN 'Madrid'
    WHEN 'Autosmadrid Leganés'                THEN 'Madrid'
    WHEN 'Autosmadrid Aranjuez'               THEN 'Madrid'
    WHEN 'Autosmadrid SS Reyes'               THEN 'Madrid'
    WHEN 'Autosmadrid Alcorcón'               THEN 'Madrid'
    WHEN 'Green Madrid'                       THEN 'Madrid'
    WHEN 'Arval Algete'                       THEN 'Madrid'
    WHEN 'Arval Loeches'                      THEN 'Madrid'
    WHEN 'San José de Valderas'               THEN 'Madrid'
    -- Barcelona
    WHEN 'Sabadell'                           THEN 'Barcelona'
    WHEN 'Terrassa'                           THEN 'Barcelona'
    WHEN 'Badalona'                           THEN 'Barcelona'
    WHEN 'Sant Boi de Llobregat'              THEN 'Barcelona'
    WHEN 'Esplugues'                          THEN 'Barcelona'
    WHEN 'Vilanova'                           THEN 'Barcelona'
    WHEN 'Martorell'                          THEN 'Barcelona'
    WHEN 'Vilafranca del Penedés'             THEN 'Barcelona'
    WHEN 'Cabrera de Mar'                     THEN 'Barcelona'
    WHEN 'Arval Barcelona'                    THEN 'Barcelona'
    WHEN 'La Maquinista'                      THEN 'Barcelona'
    WHEN 'Vic'                                THEN 'Barcelona'
    WHEN 'Cornellà'                           THEN 'Barcelona'
    WHEN 'Hospitalet de Llobregat'            THEN 'Barcelona'
    WHEN 'Granollers'                         THEN 'Barcelona'
    WHEN 'Cerdanyola'                         THEN 'Barcelona'
    WHEN 'Parets del Vallès'                  THEN 'Barcelona'
    WHEN 'Viladecans'                         THEN 'Barcelona'
    WHEN 'Sitges'                             THEN 'Barcelona'
    WHEN 'Mataró'                             THEN 'Barcelona'
    WHEN 'Manresa'                            THEN 'Barcelona'
    WHEN 'Sant Just'                          THEN 'Barcelona'
    WHEN 'Gavà'                               THEN 'Barcelona'
    WHEN 'Esplugues - Laureà Miró'            THEN 'Barcelona'
    -- Valencia (provincia)
    WHEN 'Valencia'                           THEN 'Valencia'
    WHEN 'Quart de Poblet'                    THEN 'Valencia'
    WHEN 'Sagunto'                            THEN 'Valencia'
    WHEN 'Alzira'                             THEN 'Valencia'
    WHEN 'Llíria'                             THEN 'Valencia'
    WHEN 'Gandía'                             THEN 'Valencia'
    WHEN 'Xátiva'                             THEN 'Valencia'
    WHEN 'Arval Valencia'                     THEN 'Valencia'
    -- Sevilla
    WHEN 'Sevilla'                            THEN 'Sevilla'
    WHEN 'Dos Hermanas'                       THEN 'Sevilla'
    WHEN 'Utrera'                             THEN 'Sevilla'
    WHEN 'Arval Sevilla'                      THEN 'Sevilla'
    WHEN 'Sevilla - Los Arcos'                THEN 'Sevilla'
    -- Zaragoza
    WHEN 'Zaragoza'                           THEN 'Zaragoza'
    -- Toledo
    WHEN 'Toledo'                             THEN 'Toledo'
    WHEN 'Talavera de la Reina'               THEN 'Toledo'
    WHEN 'Illescas'                           THEN 'Toledo'
    -- Alicante
    WHEN 'Alicante'                           THEN 'Alicante'
    WHEN 'Elche'                              THEN 'Alicante'
    WHEN 'Benidorm'                           THEN 'Alicante'
    WHEN 'Orihuela'                           THEN 'Alicante'
    WHEN 'San Vicente del Raspeig'            THEN 'Alicante'
    WHEN 'Torrevieja'                         THEN 'Alicante'
    WHEN 'Denia'                              THEN 'Alicante'
    -- A Coruña
    WHEN 'A Coruña'                           THEN 'A Coruña'
    WHEN 'Santiago de Compostela'             THEN 'A Coruña'
    WHEN 'Arteixo'                            THEN 'A Coruña'
    WHEN 'Arval Coruña'                       THEN 'A Coruña'
    -- Girona
    WHEN 'Girona'                             THEN 'Girona'
    WHEN 'Olot'                               THEN 'Girona'
    WHEN 'Figueres'                           THEN 'Girona'
    WHEN 'Blanes'                             THEN 'Girona'
    -- Cádiz
    WHEN 'Jerez'                              THEN 'Cádiz'
    WHEN 'El Puerto de Santa María'           THEN 'Cádiz'
    WHEN 'Algeciras'                          THEN 'Cádiz'
    WHEN 'La Línea'                           THEN 'Cádiz'
    WHEN 'Cádiz'                              THEN 'Cádiz'
    -- Granada
    WHEN 'Granada'                            THEN 'Granada'
    WHEN 'Armilla'                            THEN 'Granada'
    WHEN 'Motril'                             THEN 'Granada'
    WHEN 'Atarfe'                             THEN 'Granada'
    -- Málaga
    WHEN 'Málaga'                             THEN 'Málaga'
    WHEN 'Marbella'                           THEN 'Málaga'
    WHEN 'Vélez-Málaga'                       THEN 'Málaga'
    WHEN 'Estepona'                           THEN 'Málaga'
    WHEN 'Coín'                               THEN 'Málaga'
    -- Tarragona
    WHEN 'Tarragona'                          THEN 'Tarragona'
    WHEN 'Reus'                               THEN 'Tarragona'
    WHEN 'Tarragona - Carr. Valencia'         THEN 'Tarragona'
    -- Pontevedra
    WHEN 'Vigo'                               THEN 'Pontevedra'
    WHEN 'Pontevedra'                         THEN 'Pontevedra'
    WHEN 'Vilagarcía'                         THEN 'Pontevedra'
    -- Almería
    WHEN 'Almería'                            THEN 'Almería'
    WHEN 'Roquetas'                           THEN 'Almería'
    WHEN 'El Ejido'                           THEN 'Almería'
    WHEN 'Almería - Torrecárdenas'            THEN 'Almería'
    -- Murcia
    WHEN 'Murcia'                             THEN 'Murcia'
    WHEN 'Cartagena'                          THEN 'Murcia'
    -- Asturias
    WHEN 'Gijón'                              THEN 'Asturias'
    WHEN 'Oviedo'                             THEN 'Asturias'
    WHEN 'Langreo'                            THEN 'Asturias'
    WHEN 'Avilés'                             THEN 'Asturias'
    -- Vizcaya
    WHEN 'Arrigorriaga'                       THEN 'Vizcaya'
    WHEN 'Bilbao'                             THEN 'Vizcaya'
    WHEN 'Barakaldo'                          THEN 'Vizcaya'
    WHEN 'Enekuri'                            THEN 'Vizcaya'
    -- Guipúzcoa
    WHEN 'Tolosa'                             THEN 'Guipúzcoa'
    WHEN 'Irún'                               THEN 'Guipúzcoa'
    -- Álava
    WHEN 'Vitoria'                            THEN 'Álava'
    -- Navarra
    WHEN 'Pamplona'                           THEN 'Navarra'
    -- Cantabria
    WHEN 'Santander'                          THEN 'Cantabria'
    WHEN 'Torrelavega'                        THEN 'Cantabria'
    -- Lleida
    WHEN 'Lleida'                             THEN 'Lleida'
    -- Cáceres
    WHEN 'Cáceres'                            THEN 'Cáceres'
    WHEN 'Plasencia'                          THEN 'Cáceres'
    -- Badajoz
    WHEN 'Badajoz'                            THEN 'Badajoz'
    WHEN 'Zafra'                              THEN 'Badajoz'
    WHEN 'Don Benito'                         THEN 'Badajoz'
    -- Ciudad Real
    WHEN 'Ciudad Real'                        THEN 'Ciudad Real'
    WHEN 'Valdepeñas'                         THEN 'Ciudad Real'
    WHEN 'Alcázar de San Juan'                THEN 'Ciudad Real'
    -- Córdoba
    WHEN 'Córdoba'                            THEN 'Córdoba'
    -- Jaén
    WHEN 'Jaén'                               THEN 'Jaén'
    WHEN 'Jaén - PI Los Olivares Mancha Real' THEN 'Jaén'
    -- Huelva
    WHEN 'Huelva'                             THEN 'Huelva'
    -- Castellón
    WHEN 'Villarreal'                         THEN 'Castellón'
    WHEN 'Castellón'                          THEN 'Castellón'
    -- Albacete
    WHEN 'Albacete'                           THEN 'Albacete'
    -- Valladolid
    WHEN 'Valladolid'                         THEN 'Valladolid'
    -- La Rioja
    WHEN 'Logroño'                            THEN 'La Rioja'
    -- Guadalajara
    WHEN 'Guadalajara'                        THEN 'Guadalajara'
    -- Salamanca
    WHEN 'Salamanca'                          THEN 'Salamanca'
    -- Huesca
    WHEN 'Huesca'                             THEN 'Huesca'
    -- Burgos
    WHEN 'Burgos'                             THEN 'Burgos'
    -- Segovia
    WHEN 'Segovia'                            THEN 'Segovia'
    -- Lugo
    WHEN 'Lugo'                               THEN 'Lugo'
    -- Ourense
    WHEN 'Ourense'                            THEN 'Ourense'
    -- León
    WHEN 'León'                               THEN 'León'
    -- Zamora
    WHEN 'Zamora'                             THEN 'Zamora'
    -- Illes Balears
    WHEN 'Palma de Mallorca'                  THEN 'Illes Balears'
    WHEN 'Manacor'                            THEN 'Illes Balears'
    -- Canarias — Las Palmas
    WHEN 'Gran Canaria'                       THEN 'Las Palmas'
    WHEN 'Lanzarote'                          THEN 'Las Palmas'
    -- Canarias — Santa Cruz de Tenerife
    WHEN 'Tenerife Sur'                       THEN 'Santa Cruz de Tenerife'
    WHEN 'Tenerife Norte'                     THEN 'Santa Cruz de Tenerife'
    WHEN 'Tenerife'                           THEN 'Santa Cruz de Tenerife'
    ELSE NULL
  END IS NULL
GROUP BY city
ORDER BY n DESC;


-- ── STEP 2: UPDATE ───────────────────────────────────────────────────────────
-- Ejecutar solo si STEP 1 devuelve 0 filas.
-- Solo toca filas Flexicar con city poblada y province vacío.
UPDATE moveadvisor_market_offers
SET province = CASE city
    -- Madrid
    WHEN 'Madrid'                             THEN 'Madrid'
    WHEN 'Rivas'                              THEN 'Madrid'
    WHEN 'Móstoles'                           THEN 'Madrid'
    WHEN 'Alcorcón'                           THEN 'Madrid'
    WHEN 'Las Rozas Européolis'               THEN 'Madrid'
    WHEN 'San Fernando de Henares'            THEN 'Madrid'
    WHEN 'Majadahonda'                        THEN 'Madrid'
    WHEN 'Alcobendas'                         THEN 'Madrid'
    WHEN 'San Sebastián de los Reyes'         THEN 'Madrid'
    WHEN 'Villalba'                           THEN 'Madrid'
    WHEN 'Leganés'                            THEN 'Madrid'
    WHEN 'Alcalá de Henares'                  THEN 'Madrid'
    WHEN 'Coslada'                            THEN 'Madrid'
    WHEN 'Getafe-Fuenlabrada'                 THEN 'Madrid'
    WHEN 'Colmenar Viejo'                     THEN 'Madrid'
    WHEN 'Fuenlabrada'                        THEN 'Madrid'
    WHEN 'Arganda del Rey'                    THEN 'Madrid'
    WHEN 'Aranjuez'                           THEN 'Madrid'
    WHEN 'Aravaca'                            THEN 'Madrid'
    WHEN 'Pinto'                              THEN 'Madrid'
    WHEN 'Autosmadrid Alcalá'                 THEN 'Madrid'
    WHEN 'Autosmadrid Móstoles'               THEN 'Madrid'
    WHEN 'Autosmadrid Leganés'                THEN 'Madrid'
    WHEN 'Autosmadrid Aranjuez'               THEN 'Madrid'
    WHEN 'Autosmadrid SS Reyes'               THEN 'Madrid'
    WHEN 'Autosmadrid Alcorcón'               THEN 'Madrid'
    WHEN 'Green Madrid'                       THEN 'Madrid'
    WHEN 'Arval Algete'                       THEN 'Madrid'
    WHEN 'Arval Loeches'                      THEN 'Madrid'
    WHEN 'San José de Valderas'               THEN 'Madrid'
    -- Barcelona
    WHEN 'Sabadell'                           THEN 'Barcelona'
    WHEN 'Terrassa'                           THEN 'Barcelona'
    WHEN 'Badalona'                           THEN 'Barcelona'
    WHEN 'Sant Boi de Llobregat'              THEN 'Barcelona'
    WHEN 'Esplugues'                          THEN 'Barcelona'
    WHEN 'Vilanova'                           THEN 'Barcelona'
    WHEN 'Martorell'                          THEN 'Barcelona'
    WHEN 'Vilafranca del Penedés'             THEN 'Barcelona'
    WHEN 'Cabrera de Mar'                     THEN 'Barcelona'
    WHEN 'Arval Barcelona'                    THEN 'Barcelona'
    WHEN 'La Maquinista'                      THEN 'Barcelona'
    WHEN 'Vic'                                THEN 'Barcelona'
    WHEN 'Cornellà'                           THEN 'Barcelona'
    WHEN 'Hospitalet de Llobregat'            THEN 'Barcelona'
    WHEN 'Granollers'                         THEN 'Barcelona'
    WHEN 'Cerdanyola'                         THEN 'Barcelona'
    WHEN 'Parets del Vallès'                  THEN 'Barcelona'
    WHEN 'Viladecans'                         THEN 'Barcelona'
    WHEN 'Sitges'                             THEN 'Barcelona'
    WHEN 'Mataró'                             THEN 'Barcelona'
    WHEN 'Manresa'                            THEN 'Barcelona'
    WHEN 'Sant Just'                          THEN 'Barcelona'
    WHEN 'Gavà'                               THEN 'Barcelona'
    WHEN 'Esplugues - Laureà Miró'            THEN 'Barcelona'
    -- Valencia (provincia)
    WHEN 'Valencia'                           THEN 'Valencia'
    WHEN 'Quart de Poblet'                    THEN 'Valencia'
    WHEN 'Sagunto'                            THEN 'Valencia'
    WHEN 'Alzira'                             THEN 'Valencia'
    WHEN 'Llíria'                             THEN 'Valencia'
    WHEN 'Gandía'                             THEN 'Valencia'
    WHEN 'Xátiva'                             THEN 'Valencia'
    WHEN 'Arval Valencia'                     THEN 'Valencia'
    -- Sevilla
    WHEN 'Sevilla'                            THEN 'Sevilla'
    WHEN 'Dos Hermanas'                       THEN 'Sevilla'
    WHEN 'Utrera'                             THEN 'Sevilla'
    WHEN 'Arval Sevilla'                      THEN 'Sevilla'
    WHEN 'Sevilla - Los Arcos'                THEN 'Sevilla'
    -- Zaragoza
    WHEN 'Zaragoza'                           THEN 'Zaragoza'
    -- Toledo
    WHEN 'Toledo'                             THEN 'Toledo'
    WHEN 'Talavera de la Reina'               THEN 'Toledo'
    WHEN 'Illescas'                           THEN 'Toledo'
    -- Alicante
    WHEN 'Alicante'                           THEN 'Alicante'
    WHEN 'Elche'                              THEN 'Alicante'
    WHEN 'Benidorm'                           THEN 'Alicante'
    WHEN 'Orihuela'                           THEN 'Alicante'
    WHEN 'San Vicente del Raspeig'            THEN 'Alicante'
    WHEN 'Torrevieja'                         THEN 'Alicante'
    WHEN 'Denia'                              THEN 'Alicante'
    -- A Coruña
    WHEN 'A Coruña'                           THEN 'A Coruña'
    WHEN 'Santiago de Compostela'             THEN 'A Coruña'
    WHEN 'Arteixo'                            THEN 'A Coruña'
    WHEN 'Arval Coruña'                       THEN 'A Coruña'
    -- Girona
    WHEN 'Girona'                             THEN 'Girona'
    WHEN 'Olot'                               THEN 'Girona'
    WHEN 'Figueres'                           THEN 'Girona'
    WHEN 'Blanes'                             THEN 'Girona'
    -- Cádiz
    WHEN 'Jerez'                              THEN 'Cádiz'
    WHEN 'El Puerto de Santa María'           THEN 'Cádiz'
    WHEN 'Algeciras'                          THEN 'Cádiz'
    WHEN 'La Línea'                           THEN 'Cádiz'
    WHEN 'Cádiz'                              THEN 'Cádiz'
    -- Granada
    WHEN 'Granada'                            THEN 'Granada'
    WHEN 'Armilla'                            THEN 'Granada'
    WHEN 'Motril'                             THEN 'Granada'
    WHEN 'Atarfe'                             THEN 'Granada'
    -- Málaga
    WHEN 'Málaga'                             THEN 'Málaga'
    WHEN 'Marbella'                           THEN 'Málaga'
    WHEN 'Vélez-Málaga'                       THEN 'Málaga'
    WHEN 'Estepona'                           THEN 'Málaga'
    WHEN 'Coín'                               THEN 'Málaga'
    -- Tarragona
    WHEN 'Tarragona'                          THEN 'Tarragona'
    WHEN 'Reus'                               THEN 'Tarragona'
    WHEN 'Tarragona - Carr. Valencia'         THEN 'Tarragona'
    -- Pontevedra
    WHEN 'Vigo'                               THEN 'Pontevedra'
    WHEN 'Pontevedra'                         THEN 'Pontevedra'
    WHEN 'Vilagarcía'                         THEN 'Pontevedra'
    -- Almería
    WHEN 'Almería'                            THEN 'Almería'
    WHEN 'Roquetas'                           THEN 'Almería'
    WHEN 'El Ejido'                           THEN 'Almería'
    WHEN 'Almería - Torrecárdenas'            THEN 'Almería'
    -- Murcia
    WHEN 'Murcia'                             THEN 'Murcia'
    WHEN 'Cartagena'                          THEN 'Murcia'
    -- Asturias
    WHEN 'Gijón'                              THEN 'Asturias'
    WHEN 'Oviedo'                             THEN 'Asturias'
    WHEN 'Langreo'                            THEN 'Asturias'
    WHEN 'Avilés'                             THEN 'Asturias'
    -- Vizcaya
    WHEN 'Arrigorriaga'                       THEN 'Vizcaya'
    WHEN 'Bilbao'                             THEN 'Vizcaya'
    WHEN 'Barakaldo'                          THEN 'Vizcaya'
    WHEN 'Enekuri'                            THEN 'Vizcaya'
    -- Guipúzcoa
    WHEN 'Tolosa'                             THEN 'Guipúzcoa'
    WHEN 'Irún'                               THEN 'Guipúzcoa'
    -- Álava
    WHEN 'Vitoria'                            THEN 'Álava'
    -- Navarra
    WHEN 'Pamplona'                           THEN 'Navarra'
    -- Cantabria
    WHEN 'Santander'                          THEN 'Cantabria'
    WHEN 'Torrelavega'                        THEN 'Cantabria'
    -- Lleida
    WHEN 'Lleida'                             THEN 'Lleida'
    -- Cáceres
    WHEN 'Cáceres'                            THEN 'Cáceres'
    WHEN 'Plasencia'                          THEN 'Cáceres'
    -- Badajoz
    WHEN 'Badajoz'                            THEN 'Badajoz'
    WHEN 'Zafra'                              THEN 'Badajoz'
    WHEN 'Don Benito'                         THEN 'Badajoz'
    -- Ciudad Real
    WHEN 'Ciudad Real'                        THEN 'Ciudad Real'
    WHEN 'Valdepeñas'                         THEN 'Ciudad Real'
    WHEN 'Alcázar de San Juan'                THEN 'Ciudad Real'
    -- Córdoba
    WHEN 'Córdoba'                            THEN 'Córdoba'
    -- Jaén
    WHEN 'Jaén'                               THEN 'Jaén'
    WHEN 'Jaén - PI Los Olivares Mancha Real' THEN 'Jaén'
    -- Huelva
    WHEN 'Huelva'                             THEN 'Huelva'
    -- Castellón
    WHEN 'Villarreal'                         THEN 'Castellón'
    WHEN 'Castellón'                          THEN 'Castellón'
    -- Albacete
    WHEN 'Albacete'                           THEN 'Albacete'
    -- Valladolid
    WHEN 'Valladolid'                         THEN 'Valladolid'
    -- La Rioja
    WHEN 'Logroño'                            THEN 'La Rioja'
    -- Guadalajara
    WHEN 'Guadalajara'                        THEN 'Guadalajara'
    -- Salamanca
    WHEN 'Salamanca'                          THEN 'Salamanca'
    -- Huesca
    WHEN 'Huesca'                             THEN 'Huesca'
    -- Burgos
    WHEN 'Burgos'                             THEN 'Burgos'
    -- Segovia
    WHEN 'Segovia'                            THEN 'Segovia'
    -- Lugo
    WHEN 'Lugo'                               THEN 'Lugo'
    -- Ourense
    WHEN 'Ourense'                            THEN 'Ourense'
    -- León
    WHEN 'León'                               THEN 'León'
    -- Zamora
    WHEN 'Zamora'                             THEN 'Zamora'
    -- Illes Balears
    WHEN 'Palma de Mallorca'                  THEN 'Illes Balears'
    WHEN 'Manacor'                            THEN 'Illes Balears'
    -- Canarias — Las Palmas
    WHEN 'Gran Canaria'                       THEN 'Las Palmas'
    WHEN 'Lanzarote'                          THEN 'Las Palmas'
    -- Canarias — Santa Cruz de Tenerife
    WHEN 'Tenerife Sur'                       THEN 'Santa Cruz de Tenerife'
    WHEN 'Tenerife Norte'                     THEN 'Santa Cruz de Tenerife'
    WHEN 'Tenerife'                           THEN 'Santa Cruz de Tenerife'
    ELSE province
  END
WHERE portal = 'flexicar'
  AND city <> ''
  AND (province = '' OR province IS NULL);


-- ── STEP 3: Verificación post-UPDATE ─────────────────────────────────────────
SELECT
  province,
  COUNT(*)    AS n,
  COUNT(NULLIF(city, '')) AS con_city
FROM moveadvisor_market_offers
WHERE portal = 'flexicar'
  AND is_active = TRUE
GROUP BY province
ORDER BY n DESC
LIMIT 40;
