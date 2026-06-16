/**
 * Importa el catálogo de renting de Leasys al marketplace VO de Neon.
 * Uso: node scripts/import-leasys-renting.js
 *
 * Crea las ofertas como DESPUBLICADAS (is_active=false).
 * Cada oferta incluye la tabla completa de precios por plazo y km/año.
 * Requiere: DATABASE_URL en .env.local
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  max: 3,
  ssl: { rejectUnauthorized: false },
});

// km_options: [10000, 15000, 20000, 25000, 30000]
// Precios leídos de la tabla Leasys (€/mes), un valor por cada km_option
// null = plazo no disponible para este vehículo

const LEASYS_RENTING = [
  // ─── TURISMOS ───────────────────────────────────────────────────────────────
  {
    id: "leasys-renting-citroen-c3-turbo-100",
    title: "Citroën C3 Turbo 100 CV Business",
    brand: "Citroën", model: "C3", version: "Turbo 100 CV 6V Business",
    fuel: "Gasolina", power: "100 CV",
    prices: { "24m": [243, 259, 273, 287, 300], "36m": [237, 253, 267, 280, 294] },
  },
  {
    id: "leasys-renting-citroen-c4-hybrid-145",
    title: "Citroën C4 Hybrid 145 E-DC56 Max",
    brand: "Citroën", model: "C4", version: "Hybrid 145 E-DC56 Max",
    fuel: "Híbrido enchufable", power: "145 CV",
    prices: { "24m": [283, 301, 318, 334, 350], "36m": [286, 305, 321, 338, 354] },
  },
  {
    id: "leasys-renting-ds-7-bluehdi-130",
    title: "DS 7 BlueHDi 130CV Pallas",
    brand: "DS", model: "7", version: "BlueHDi 130CV Pallas",
    fuel: "Diésel", power: "130 CV",
    prices: { "24m": [359, 387, 412, 436, 460], "36m": [443, 467, 488, 509, 530] },
  },
  {
    id: "leasys-renting-fiat-600-mhev-145",
    title: "Fiat 600 MHEV Sport 145CV",
    brand: "Fiat", model: "600", version: "MHEV Sport 1.2 106kW (145CV) DDCT",
    fuel: "Híbrido", power: "145 CV",
    prices: { "24m": [261, 278, 293, 308, 322], "36m": [258, 275, 290, 305, 320] },
  },
  {
    id: "leasys-renting-kia-stonic-mhev-115",
    title: "Kia Stonic 1.0 MHEV Concept 115",
    brand: "Kia", model: "Stonic", version: "1.0 MHEV Concept 115",
    fuel: "Híbrido", power: "115 CV",
    prices: { "24m": [298, 318, 335, 352, 369], "36m": [294, 310, 326, 342, 358] },
  },
  {
    id: "leasys-renting-lancia-ypsilon-hybrid-110",
    title: "Lancia Ypsilon LX Hybrid 110CV",
    brand: "Lancia", model: "Ypsilon", version: "LX Hybrid 81kW (110CV)",
    fuel: "Híbrido", power: "110 CV",
    prices: { "24m": [279, 299, 316, 333, 350], "36m": [305, 325, 342, 360, 377] },
  },
  {
    id: "leasys-renting-nissan-qashqai-epower-190",
    title: "Nissan Qashqai Acenta e-POWER 190CV",
    brand: "Nissan", model: "Qashqai", version: "Acenta e-POWER 140kW (190CV)",
    fuel: "Híbrido", power: "190 CV",
    prices: { "24m": [370, 393, 418, 440, 462], "36m": [370, 390, 411, 432, 453] },
  },
  {
    id: "leasys-renting-opel-corsa-gs-100",
    title: "Opel Corsa GS 1.2T 100CV",
    brand: "Opel", model: "Corsa GS", version: "1.2T Gasolina 100CV",
    fuel: "Gasolina", power: "100 CV",
    prices: { "24m": [232, 247, 260, 273, 287], "36m": [210, 225, 238, 251, 264] },
  },
  {
    id: "leasys-renting-peugeot-208-allure-100",
    title: "Peugeot 208 Allure Turbo 100CV",
    brand: "Peugeot", model: "208", version: "Allure Turbo 100 S&S 6 Vel Man",
    fuel: "Gasolina", power: "100 CV",
    prices: { "24m": [211, 226, 239, 251, 264], "36m": [215, 229, 241, 254, 265] },
  },
  {
    id: "leasys-renting-peugeot-208-man-allure-100",
    title: "Peugeot 208 Allure Turbo 100CV (con mantenimiento)",
    brand: "Peugeot", model: "208", version: "Allure Turbo 100 S&S 6 Vel Man (Mantenimiento incluido)",
    fuel: "Gasolina", power: "100 CV",
    prices: { "24m": [250, 266, 280, 294, 308], "36m": [254, 271, 285, 300, 314] },
  },
  {
    id: "leasys-renting-peugeot-3008-allure-107",
    title: "Peugeot 3008 Allure Exclusive 107kW",
    brand: "Peugeot", model: "3008", version: "1.2 107kW Allure Exclusive EDC56",
    fuel: "Gasolina", power: "107 CV",
    prices: { "24m": [371, 396, 417, 438, 460], "36m": [390, 411, 432, 453, 474] },
  },
  {
    id: "leasys-renting-renault-captur-ecog-120",
    title: "Renault Captur Evolution ECO-G 120CV",
    brand: "Renault", model: "Captur", version: "Evolution ECO-G 120CV (90kW)",
    fuel: "GLP", power: "120 CV",
    prices: { "24m": [276, 294, 310, 326, 342], "36m": [261, 278, 293, 308, 322] },
  },
  {
    id: "leasys-renting-seat-ibiza-tsi-95",
    title: "Seat Ibiza 1.0 TSI 95CV Ibiza+",
    brand: "Seat", model: "Ibiza", version: "1.0 TSI 70kW (95CV) Start&Stop Ibiza+",
    fuel: "Gasolina", power: "95 CV",
    prices: { "24m": [219, 233, 245, 258, 270], "36m": [208, 221, 233, 245, 258] },
  },
  {
    id: "leasys-renting-skoda-kamiq-tsi-115",
    title: "Skoda Kamiq Selection 1.0 TSI 115CV DSG",
    brand: "Skoda", model: "Kamiq", version: "Selection 1.0 TSI 85kW (115CV) DSG 7 Vel",
    fuel: "Gasolina", power: "115 CV",
    prices: { "24m": [261, 278, 293, 308, 322], "36m": [254, 271, 285, 300, 314] },
  },
  {
    id: "leasys-renting-tesla-model3",
    title: "Tesla Model 3",
    brand: "Tesla", model: "Model 3", version: "Model 3",
    fuel: "Eléctrico", power: "",
    prices: { "24m": [849, 871, 893, 915, 937], "36m": [690, 712, 734, 756, 778] },
  },

  // ─── INDUSTRIALES ────────────────────────────────────────────────────────────
  {
    id: "leasys-renting-citroen-berlingo-bluehdi-100",
    title: "Citroën Berlingo Combi BlueHDi 100CV N1",
    brand: "Citroën", model: "Berlingo Combi", version: "Talla M BlueHDi 100 S&S Plus N1",
    fuel: "Diésel", power: "100 CV",
    prices: { "24m": [339, 362, 382, 402, 422], "36m": [316, 337, 355, 373, 391] },
  },
  {
    id: "leasys-renting-citroen-jumpy-hdi-120",
    title: "Citroën Jumpy Furgón HDi 120CV",
    brand: "Citroën", model: "Jumpy", version: "Furgón Talla M HDi 120CV 6V",
    fuel: "Diésel", power: "120 CV",
    prices: { "24m": [371, 396, 417, 438, 460], "36m": [384, 405, 425, 446, 467] },
  },
  {
    id: "leasys-renting-opel-combo-gs-combi-100",
    title: "Opel Combo GS Combi 1.5 TD 100CV",
    brand: "Opel", model: "Combo GS Combi", version: "100CV 1.5 TD 5/5 MT6 €6.4 EBIS",
    fuel: "Diésel", power: "100 CV",
    prices: { "24m": [338, 358, 380, 399, 419], "36m": [352, 354, 373, 393, 412] },
  },
  {
    id: "leasys-renting-opel-movano-l2h1-bluehdi-140",
    title: "Opel Movano L2H1 Furgón BlueHDi 140CV",
    brand: "Opel", model: "Movano L2H1", version: "Furgón 3.5T 2.2 BlueHDi 140 DPF STT €6.4",
    fuel: "Diésel", power: "140 CV",
    prices: { "24m": [398, 425, 448, 471, 494], "36m": [419, 442, 465, 487, 508] },
  },
  {
    id: "leasys-renting-opel-combo-cargo-100",
    title: "Opel Combo Cargo Furgón 1.5 100CV",
    brand: "Opel", model: "Combo Cargo", version: "Furgón Talla M 650kg Diesel 1.5 100CV S&S MT €6.4",
    fuel: "Diésel", power: "100 CV",
    prices: { "24m": [294, 306, 321, 342, 363], "36m": [288, 307, 324, 340, 357] },
  },
  {
    id: "leasys-renting-opel-movano-l2h2-bluehdi-140",
    title: "Opel Movano L2H2 Furgón BlueHDi 140CV",
    brand: "Opel", model: "Movano L2H2", version: "Furgón 3.5T 2.2 BlueHDi 140CV DPF STT €6.4",
    fuel: "Diésel", power: "140 CV",
    prices: { "24m": [393, 419, 445, 466, 487], "36m": [413, 438, 458, 481, 498] },
  },
  {
    id: "leasys-renting-peugeot-expert-bluehdi-120",
    title: "Peugeot Expert Furgón BlueHDi 120CV",
    brand: "Peugeot", model: "Expert", version: "Furgón BlueHDi 120 S&S 6 Vel Man Standard",
    fuel: "Diésel", power: "120 CV",
    prices: { "24m": [361, 385, 406, 427, 448], "36m": [343, 365, 385, 406, 426] },
  },
  {
    id: "leasys-renting-peugeot-rifter-bluehdi-100",
    title: "Peugeot Rifter Allure Business BlueHDi 100CV N1",
    brand: "Peugeot", model: "Rifter", version: "Allure Business Standard BlueHDi 100 S&S Manual 6 Vel (N1)",
    fuel: "Diésel", power: "100 CV",
    prices: { "24m": [342, 365, 385, 404, 424], "36m": [340, 362, 380, 400, 419] },
  },
];

const KM_OPTIONS = [10000, 15000, 20000, 25000, 30000];
const KM_15K_IDX = KM_OPTIONS.indexOf(15000);

async function main() {
  let inserted = 0;
  let updated  = 0;
  let errors   = 0;

  for (const v of LEASYS_RENTING) {
    // Build renting_prices_json
    const pricesJson = {
      km_options: KM_OPTIONS,
      "12m": v.prices["12m"] ?? null,
      "24m": v.prices["24m"] ?? null,
      "36m": v.prices["36m"] ?? null,
      "48m": v.prices["48m"] ?? null,
      "60m": v.prices["60m"] ?? null,
    };

    // 15k standard prices for the simple backward-compat columns
    const r24 = v.prices["24m"]?.[KM_15K_IDX] ?? null;
    const r36 = v.prices["36m"]?.[KM_15K_IDX] ?? null;
    const r12 = v.prices["12m"]?.[KM_15K_IDX] ?? null;
    const r48 = v.prices["48m"]?.[KM_15K_IDX] ?? null;
    const r60 = v.prices["60m"]?.[KM_15K_IDX] ?? null;

    try {
      const result = await pool.query(
        `INSERT INTO moveadvisor_marketplace_vo_offers
           (id, title, brand, model, version, fuel, power,
            location, seller, seller_type,
            price, mileage, year,
            available_for_purchase, renting_available, renting_km_year,
            renting_12m, renting_24m, renting_36m, renting_48m, renting_60m,
            renting_prices_json,
            portal_score, is_active, portal, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,
                 'España','Leasys','professional',
                 0, 0, $8,
                 false, true, 15000,
                 $9,$10,$11,$12,$13,
                 $14::jsonb,
                 80, false, 'renting-leasys', NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           title=$2, brand=$3, model=$4, version=$5, fuel=$6, power=$7,
           renting_12m=$9, renting_24m=$10, renting_36m=$11, renting_48m=$12, renting_60m=$13,
           renting_prices_json=$14::jsonb,
           updated_at=NOW()
         RETURNING xmax`,
        [
          v.id, v.title, v.brand, v.model, v.version, v.fuel, v.power,
          new Date().getFullYear(),
          r12, r24, r36, r48, r60,
          JSON.stringify(pricesJson),
        ]
      );

      const wasUpdate = result.rows[0]?.xmax !== "0";
      wasUpdate ? updated++ : inserted++;
      console.log(`  ${wasUpdate ? "↑" : "+"} ${v.title}`);
    } catch (err) {
      errors++;
      console.error(`  ✗ ${v.title}: ${err.message}`);
    }
  }

  console.log(`\n✓ Importación completada:`);
  console.log(`  Nuevas:       ${inserted}`);
  console.log(`  Actualizadas: ${updated}`);
  console.log(`  Errores:      ${errors}`);
  console.log(`\nLas ofertas se han creado como DESPUBLICADAS.`);
  console.log(`Publica las que quieras desde el ERP → Marketplace → Ofertas Renting.`);

  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
