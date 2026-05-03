"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MSSQL_SERVER = process.env.MSSQL_SERVER || "localhost\\SQLEXPRESS";
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || "Mobilityadvisor";
const MSSQL_USER = String(process.env.MSSQL_USER || "").trim();
const MSSQL_PASSWORD = String(process.env.MSSQL_PASSWORD || "");
const SQLCMD_PATH = process.env.SQLCMD_PATH || "sqlcmd";
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL o POSTGRES_URL no definido.");
  process.exit(1);
}

const CANONICAL_ROWS = [
  {
    id: 1,
    url: "https://www.autohero.com/es/audi-a-3-sportback/id/5b102f9a-c026-4f28-a09c-5ffd9c5a2e29/",
    portal: "autohero",
    brand: "Audi",
    model: "A3 Sportback",
    version: "1.6 TDI (110CV) 81kW",
    fuel: "Diesel",
    listingType: "compra",
    price: "13299",
    monthlyPrice: "233",
    financePrice: "12666",
    year: "2016",
    mileage: "149721",
    province: "",
    city: "",
    imageUrl: "https://img-eu-c1.autohero.com/img/7355861b95b0f49778674c655ff87f8d7ff93792907be361db98de33a23b038c/exterior/1/1116x744-95258203087f426fa9731b4836244dd2.jpg",
    title: "Audi A3 Sportback 1.6 TDI (110CV) 81kW Diesel",
    listedAt: "2026-05-03 09:54:12.0000000",
    sourceUpdatedAt: "2026-05-03 09:54:12.0000000",
    firstSeenAt: "2026-05-03 10:12:31.1587200",
    lastSeenAt: "2026-05-03 10:12:31.1587200",
    transmission: "Manual",
    bodyType: "Berlina",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "110",
    color: "Negro",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1598cc",
    co2: "105g/km",
    nextITV: "46206",
    powerKw: "81",
    consumption: "4,5",
  },
  {
    id: 2,
    url: "https://www.flexicar.es/coches-ocasion/bmw-serie-1-118d-diesel-automatica-marbella_903000000224575/",
    portal: "flexicar",
    brand: "BMW",
    model: "Serie 1",
    version: "118d",
    fuel: "Diesel",
    listingType: "compra",
    price: "28990",
    monthlyPrice: "403",
    financePrice: "25970",
    year: "2024",
    mileage: "14823",
    province: "Málaga",
    city: "Marbella",
    imageUrl: "https://www.flexicar.es/images/903000000224575/imp2f_u8nwMxYTF3__img-b1b2545b-ec63-433d-9daf-cf03b7ba4dcb-1440x856.webp",
    title: "BMW Serie 1 118d Diesel",
    listedAt: "2026-05-02 16:19:39.0000000",
    sourceUpdatedAt: "2026-05-02 16:19:39.0000000",
    firstSeenAt: "2026-05-02 16:21:18.5371147",
    lastSeenAt: "2026-05-02 16:21:18.5371147",
    transmission: "Automatica",
    bodyType: "Berlina",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "150",
    color: "Gris",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1995CC",
    co2: "122g/km",
    nextITV: "",
    powerKw: "112",
    consumption: "4,7",
  },
  {
    id: 3,
    url: "https://www.flexicar.es/coches-ocasion/jaecoo-7-select-16-tgdi-108kw-145cv-fwd-gasolina-automatica-gijon_903000000225154/",
    portal: "flexicar",
    brand: "Jaecoo",
    model: "7",
    version: "Select 1.6 TGDI 108kW (145CV) FWD",
    fuel: "Gasolina",
    listingType: "compra",
    price: "25990",
    monthlyPrice: "347",
    financePrice: "22380",
    year: "2025",
    mileage: "14987",
    province: "Gijon",
    city: "Gijon",
    imageUrl: "https://www.flexicar.es/images/903000000225154/imp2f_Df0S69pi1D__img-8354399b-2a2e-4fc9-bdd9-fb173f2f2eaa-1440x856.webp",
    title: "Jaecoo 7 Select 1.6 TGDI 108kW (145CV) FWD Gasolina",
    listedAt: "2026-05-02 18:12:53.0000000",
    sourceUpdatedAt: "2026-05-02 18:12:53.0000000",
    firstSeenAt: "2026-05-02 16:21:14.5752561",
    lastSeenAt: "2026-05-02 18:14:06.9538225",
    transmission: "Automatica",
    bodyType: "SUV",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "147",
    color: "Azul",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1598CC",
    co2: "169g/km",
    nextITV: "",
    powerKw: "108",
    consumption: "7,5",
  },
  {
    id: 4,
    url: "https://www.flexicar.es/coches-ocasion/ford-s-max-20-tdci-132kw-titanium-powershift-diesel-automatica-coruna_903000000176689/",
    portal: "flexicar",
    brand: "Ford",
    model: "S-Max",
    version: "2.0 TDCi 132kW Titanium PowerShift",
    fuel: "Diesel",
    listingType: "compra",
    price: "19990",
    monthlyPrice: "288",
    financePrice: "17490",
    year: "2017",
    mileage: "127993",
    province: "A Coruña",
    city: "A Coruña",
    imageUrl: "https://www.flexicar.es/images/903000000176689/imp2f_Pg6cHiXKlS__img-40d1b26f-07b4-45ef-9b02-41eb84f6d37e-1440x856.webp",
    title: "Ford S-Max 2.0 TDCi 132kW Titanium PowerShift Diesel",
    listedAt: "2026-05-03 09:59:41.0000000",
    sourceUpdatedAt: "2026-05-03 09:59:41.0000000",
    firstSeenAt: "2026-05-03 10:12:42.3313007",
    lastSeenAt: "2026-05-03 10:12:42.3313007",
    transmission: "Automatica",
    bodyType: "Monovolumen",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "180",
    color: "Granate",
    sellerType: "profesional",
    dealerName: "Pedro Fernández",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1997CC",
    co2: "129g/km",
    nextITV: "",
    powerKw: "132",
    consumption: "5,4",
  },
  {
    id: 5,
    url: "https://www.flexicar.es/coches-ocasion/toyota-rav4-25l-220h-business-hibrido-no-enchufable-automatica-san-sebastian-de-los-reyes_903000000166327/",
    portal: "flexicar",
    brand: "Toyota",
    model: "Rav4",
    version: "2.5l 220H Business",
    fuel: "Hibrido",
    listingType: "compra",
    price: "25490",
    monthlyPrice: "350",
    financePrice: "22490",
    year: "2020",
    mileage: "118704",
    province: "Madrid",
    city: "San Sebastián de los Reyes",
    imageUrl: "https://www.flexicar.es/images/903000000166327/imp2f_bgMOhXFdbu__1655LJH_5948c94d9158418a8b911fa4743b376c_Exterior_1.jpeg-1440x856.webp",
    title: "Toyota Rav4 2.5l 220H Business Hibrido",
    listedAt: "2026-05-03 09:57:48.0000000",
    sourceUpdatedAt: "2026-05-03 09:57:48.0000000",
    firstSeenAt: "2026-05-02 16:21:14.5691442",
    lastSeenAt: "2026-05-03 10:12:42.1880808",
    transmission: "Automatica",
    bodyType: "SUV",
    environmentalLabel: "ECO",
    doors: "5",
    seats: "5",
    powerCv: "218",
    color: "Blanco",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "2487CC",
    co2: "102g/km",
    nextITV: "",
    powerKw: "160",
    consumption: "4,5",
  },
  {
    id: 6,
    url: "https://www.flexicar.es/coches-ocasion/dacia-dokker-ambiance-dci-55kw-75cv-diesel-manual-cordoba_903000000173392/",
    portal: "flexicar",
    brand: "Dacia",
    model: "Dokker",
    version: "Ambiance dci 55kW (75CV)",
    fuel: "Diesel",
    listingType: "compra",
    price: "11190",
    monthlyPrice: "152",
    financePrice: "9790",
    year: "2017",
    mileage: "117864",
    province: "Cordoba",
    city: "Cordoba",
    imageUrl: "https://www.flexicar.es/images/903000000173392/imp2f_ISj4qh8avj__IMG-20250806-WA0673-1440x856.webp",
    title: "Dacia Dokker Ambiance dci 55kW (75CV) Diesel",
    listedAt: "2026-05-02 16:23:15.0000000",
    sourceUpdatedAt: "2026-05-02 16:23:15.0000000",
    firstSeenAt: "2026-05-02 16:24:10.9559373",
    lastSeenAt: "2026-05-02 16:24:10.9559373",
    transmission: "Manual",
    bodyType: "Furgoneta",
    environmentalLabel: "C",
    doors: "4",
    seats: "5",
    powerCv: "75",
    color: "Blanco",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1461CC",
    co2: "108g/km",
    nextITV: "",
    powerKw: "55",
    consumption: "4,2",
  },
  {
    id: 7,
    url: "https://www.autoscout24.es/anuncios/omoda-5-hibrido-1-tgdi-premium-electro-gasolina-gris-b18e9379-17af-4349-9d00-0fed8e37f69c",
    portal: "autoscout24",
    brand: "Omoda",
    model: "5",
    version: "1. TGDI Premium",
    fuel: "Hibrido",
    listingType: "compra",
    price: "27500",
    monthlyPrice: "0",
    financePrice: "0",
    year: "2026",
    mileage: "5",
    province: "Salamanca",
    city: "Villares de la Reina",
    imageUrl: "https://prod.pictures.autoscout24.net/listing-images/b18e9379-17af-4349-9d00-0fed8e37f69c_f1efc590-ac40-4c8e-be62-9851e079fc57.jpg/720x540.webp",
    title: "Omoda 5 1. TGDI Premium Hibrido",
    listedAt: "2026-05-02 18:01:23.0000000",
    sourceUpdatedAt: "2026-05-02 18:01:23.0000000",
    firstSeenAt: "2026-05-02 17:22:29.3316005",
    lastSeenAt: "2026-05-02 18:13:56.3996127",
    transmission: "Automatica",
    bodyType: "SUV",
    environmentalLabel: "ECO",
    doors: "5",
    seats: "5",
    powerCv: "224",
    color: "Blanco",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1499CC",
    co2: "120g/km",
    nextITV: "",
    powerKw: "165",
    consumption: "5,3",
  },
  {
    id: 8,
    url: "https://www.flexicar.es/coches-ocasion/dacia-sandero-essential-74kw-100cv-eco-g-glp-manual-lugo_903000000224492/",
    portal: "flexicar",
    brand: "Dacia",
    model: "Sandero",
    version: "Essential 74kW (100CV) ECO-G",
    fuel: "GLP",
    listingType: "compra",
    price: "14790",
    monthlyPrice: "202",
    financePrice: "12990",
    year: "2025",
    mileage: "11084",
    province: "Lugo",
    city: "Lugo",
    imageUrl: "https://www.flexicar.es/images/903000000224492/imp2f_UrRmxTCpuN__img-85cfcd61-6767-4b9f-98d2-b4e6dbca87bb-1440x856.webp",
    title: "Dacia Sandero Essential 74kW (100CV) ECO-G GLP",
    listedAt: "2026-05-02 16:22:59.0000000",
    sourceUpdatedAt: "2026-05-02 16:22:59.0000000",
    firstSeenAt: "2026-05-02 16:21:18.5543508",
    lastSeenAt: "2026-05-02 16:24:10.9385365",
    transmission: "Manual",
    bodyType: "Berlina",
    environmentalLabel: "ECO",
    doors: "5",
    seats: "0",
    powerCv: "101",
    color: "Blanco",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "999CC",
    co2: "105g/km",
    nextITV: "",
    powerKw: "74",
    consumption: "5,4",
  },
  {
    id: 9,
    url: "https://www.flexicar.es/coches-ocasion/opel-corsa-12t-xhl-74kw-100cv-gs-gasolina-manual-arrigorriaga_903000000172431/",
    portal: "flexicar",
    brand: "Opel",
    model: "Corsa",
    version: "1.2T XHL 74kW (100CV) GS",
    fuel: "Gasolina",
    listingType: "compra",
    price: "13990",
    monthlyPrice: "178",
    financePrice: "11490",
    year: "2024",
    mileage: "34772",
    province: "Vizcaya",
    city: "Arrigorriaga",
    imageUrl: "https://www.flexicar.es/images/903000000172431/imp2f_Y2RzeEYRpx__XGxRQSouQV__6577%20MNR_e91c731cc6434e64a05c78a96e2764c6_Exterior_1.jpeg-1440x856.webp",
    title: "Opel Corsa 1.2T XHL 74kW (100CV) GS Gasolina",
    listedAt: "2026-05-03 09:59:16.0000000",
    sourceUpdatedAt: "2026-05-03 09:59:16.0000000",
    firstSeenAt: "2026-05-02 16:21:14.8649718",
    lastSeenAt: "2026-05-03 10:12:42.3061330",
    transmission: "Manual",
    bodyType: "Berlina",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "100",
    color: "Negro",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1199CC",
    co2: "118g/km",
    nextITV: "",
    powerKw: "74",
    consumption: "5,1",
  },
  {
    id: 10,
    url: "https://www.coches.com/coches-segunda-mano/ocasion-ford-focus-155-sportbreak-10-ecoboost-mhev-st-line.htm?id=ummxFcl9sdpp",
    portal: "coches.com",
    brand: "Ford",
    model: "Focus",
    version: "1.0 Ecoboost MHEV 114kW ST-Line",
    fuel: "Hibrido",
    listingType: "compra",
    price: "15450",
    monthlyPrice: "0",
    financePrice: "0",
    year: "2022",
    mileage: "92000",
    province: "Madrid",
    city: "Madrid",
    imageUrl: "https://img.coches.com/_ccom_/a3fccea3-a9bf-4b2d-ba61-cf609833e40d/72f29b89-706e-4cff-9b0f-fd945456e2c1.jpg?q=202605031402550000&p=cc_vo_high&w=720&ar=4:3",
    title: "Ford Focus 1.0 Ecoboost MHEV 114kW ST-Line Hibrido",
    listedAt: "2026-05-03 09:36:57.0000000",
    sourceUpdatedAt: "2026-05-03 09:36:57.0000000",
    firstSeenAt: "2026-05-02 15:49:26.9189893",
    lastSeenAt: "2026-05-03 10:12:30.8313661",
    transmission: "Manual",
    bodyType: "Berlina",
    environmentalLabel: "ECO",
    doors: "5",
    seats: "5",
    powerCv: "155",
    color: "Negro",
    sellerType: "particular",
    dealerName: "",
    warrantyMonths: "12",
    traction: "Delantera",
    displacement: "999CC",
    co2: "94g/km",
    nextITV: "",
    powerKw: "115",
    consumption: "4",
  },
  {
    id: 11,
    url: "https://www.autohero.com/es/mercedes-benz-clase-cla/id/ecbe4f52-32e3-4b6d-b440-2833d3e1c7a4/",
    portal: "autohero",
    brand: "Mercedes-Benz",
    model: "CLA",
    version: "CLA 200 d AMG Line",
    fuel: "Diesel",
    listingType: "compra",
    price: "27499",
    monthlyPrice: "364",
    financePrice: "24999",
    year: "2020",
    mileage: "123086",
    province: "",
    city: "",
    imageUrl: "https://img-eu-c1.autohero.com/img/8bc561fe0edf181f6e502fb7c6587f5cb1d00cfd8f4256a0d7c1530488593f71/exterior/1/1116x744-2b1d3d33fe844ff9a28655f0f0e4c738.jpg",
    title: "Mercedes-Benz CLA CLA 200 d AMG Line Diesel",
    listedAt: "2026-05-03 09:53:22.0000000",
    sourceUpdatedAt: "2026-05-03 09:53:22.0000000",
    firstSeenAt: "2026-05-03 10:12:31.1126486",
    lastSeenAt: "2026-05-03 10:12:31.1126486",
    transmission: "Automatica",
    bodyType: "Berlina",
    environmentalLabel: "C",
    doors: "4",
    seats: "5",
    powerCv: "150",
    color: "Blanco",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1950CC",
    co2: "110g/km",
    nextITV: "46389",
    powerKw: "110",
    consumption: "5,1",
  },
  {
    id: 12,
    url: "https://www.flexicar.es/coches-ocasion/kia-rio-12-dpi-62kw-84cv-concept-gasolina-manual-gran-canaria-2-miller-bajo_903000000238374/",
    portal: "flexicar",
    brand: "Kia",
    model: "Rio",
    version: "1.2 DPi 62kW (84CV) Concept",
    fuel: "Gasolina",
    listingType: "compra",
    price: "13990",
    monthlyPrice: "186",
    financePrice: "11990",
    year: "2023",
    mileage: "31300",
    province: "Gran Canaria",
    city: "Gran Canaria",
    imageUrl: "https://www.flexicar.es/images/903000000238374/imp2f_gNWPedVq87__img-02bdd00a-c229-4d6a-9d7b-15a19dc61d01-1440x856.webp",
    title: "Kia Rio 1.2 DPi 62kW (84CV) Concept Gasolina",
    listedAt: "2026-05-03 09:56:59.0000000",
    sourceUpdatedAt: "2026-05-03 09:56:59.0000000",
    firstSeenAt: "2026-05-02 16:24:07.3686911",
    lastSeenAt: "2026-05-03 10:12:42.1344541",
    transmission: "Manual",
    bodyType: "Berlina",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "84",
    color: "Rojo",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1197CC",
    co2: "122g/km",
    nextITV: "",
    powerKw: "62",
    consumption: "5,4",
  },
  {
    id: 13,
    url: "https://www.coches.com/coches-segunda-mano/ocasion-ford-kuga-190-25-duratec-fhev-st-line-x-4x2-aut.htm?id=U_aOlIS2BZBj",
    portal: "coches.com",
    brand: "Ford",
    model: "Kuga",
    version: "2.5 Duratec FHEV ST-Line Auto 140 kW (190 CV)",
    fuel: "Hibrido",
    listingType: "compra",
    price: "24800",
    monthlyPrice: "0",
    financePrice: "22546",
    year: "2023",
    mileage: "24202",
    province: "Madrid",
    city: "Collado Villalba",
    imageUrl: "https://img.coches.com/_ccom_/d5e5b767-daae-44d2-b088-974d30c6ce0f/cb303092-d81c-46c4-accc-036a0e350d8a.jpg?q=202605031010110000&p=cc_vo_high&w=720&ar=4:3",
    title: "Ford Kuga 2.5 Duratec FHEV ST-Line Auto 140 kW (190 CV) Hibrido",
    listedAt: "2026-05-03 09:37:04.0000000",
    sourceUpdatedAt: "2026-05-03 09:37:04.0000000",
    firstSeenAt: "2026-05-02 16:55:37.3612239",
    lastSeenAt: "2026-05-03 10:12:30.8350875",
    transmission: "Automatica",
    bodyType: "Berlina",
    environmentalLabel: "ECO",
    doors: "5",
    seats: "5",
    powerCv: "190",
    color: "Blanco",
    sellerType: "particular",
    dealerName: "",
    warrantyMonths: "12",
    traction: "Delantera",
    displacement: "2488CC",
    co2: "119g/km",
    nextITV: "",
    powerKw: "142",
    consumption: "5",
  },
  {
    id: 14,
    url: "https://www.coches.com/coches-segunda-mano/ocasion-skoda-kamiq-115-10-tsi-selection-85kw.htm?id=LeMNw_3KRHM-",
    portal: "coches.com",
    brand: "Skoda",
    model: "Kamiq",
    version: "1.0 TSI Selection 85 kW (115 CV)",
    fuel: "Gasolina",
    listingType: "compra",
    price: "19200",
    monthlyPrice: "0",
    financePrice: "17455",
    year: "2025",
    mileage: "16694",
    province: "Madrid",
    city: "Collado Villalba",
    imageUrl: "https://img.coches.com/_ccom_/329cf4b1-f0de-4306-b0eb-d73a52e8c537/4df46cc5-ba3d-45af-a949-75207870484a.jpg?q=202605031805150000&p=cc_vo_high&w=720&ar=4:3",
    title: "Skoda Kamiq 1.0 TSI Selection 85 kW (115 CV) Gasolina",
    listedAt: "2026-05-03 09:40:15.0000000",
    sourceUpdatedAt: "2026-05-03 09:40:15.0000000",
    firstSeenAt: "2026-05-02 16:06:00.2853944",
    lastSeenAt: "2026-05-03 10:12:30.9718414",
    transmission: "Manual",
    bodyType: "SUV",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "115",
    color: "Gris",
    sellerType: "particular",
    dealerName: "",
    warrantyMonths: "12",
    traction: "Delantera",
    displacement: "999CC",
    co2: "121g/km",
    nextITV: "",
    powerKw: "86",
    consumption: "5,4",
  },
  {
    id: 15,
    url: "https://www.coches.com/coches-segunda-mano/ocasion-renault-captur-160-e-tech-hibrido-enchufable-zen-117kw.htm?id=Vu8eLn-s7P5T",
    portal: "coches.com",
    brand: "Renault",
    model: "Captur",
    version: "E-TECH Hibrido Enchufable Zen 117kW",
    fuel: "Hibrido",
    listingType: "compra",
    price: "16900",
    monthlyPrice: "0",
    financePrice: "16900",
    year: "2022",
    mileage: "72000",
    province: "Las Palmas",
    city: "Las Palmas",
    imageUrl: "https://img.coches.com/_ccom_/b9256282-d7ca-4c8b-aac0-a4ab073aa8c9/9592bf6e-b78d-40a5-b19e-0c3aeb3a5fc0.jpg?q=202605031227580000&w=768&ar=4:3",
    title: "Renault Captur E-TECH Hibrido Enchufable Zen 117kW Hibrido",
    listedAt: "2026-05-03 09:41:23.0000000",
    sourceUpdatedAt: "2026-05-03 09:41:23.0000000",
    firstSeenAt: "2026-05-02 16:06:00.3244645",
    lastSeenAt: "2026-05-03 10:12:31.0181353",
    transmission: "Automatica",
    bodyType: "SUV",
    environmentalLabel: "CERO",
    doors: "5",
    seats: "5",
    powerCv: "160",
    color: "Azul",
    sellerType: "particular",
    dealerName: "",
    warrantyMonths: "12",
    traction: "Delantera",
    displacement: "1598CC",
    co2: "30g/km",
    nextITV: "",
    powerKw: "119",
    consumption: "1,3",
  },
  {
    id: 16,
    url: "https://www.motorvision.es/byd-refuerza-el-atto-2-con-la-version-comfort-mas-potencia-mas-espacio-y-mejor-equipamiento-1531.html",
    portal: "coches.net",
    brand: "Byd",
    model: "Atto 2",
    version: "Boost",
    fuel: "Electrico",
    listingType: "compra",
    price: "26890",
    monthlyPrice: "360,88",
    financePrice: "24450",
    year: "2025",
    mileage: "2953",
    province: "Madrid",
    city: "Madrid",
    imageUrl: "https://a.ccdn.es/cnet/vehicles/19928554/0d14576c-d3a7-4fd1-8f4b-99538ace5919.jpg/712x535cut/",
    title: "Byd Atto 2 Boost Electrico",
    listedAt: "2026-04-29 09:49:29.0000000",
    sourceUpdatedAt: "2026-04-29 09:49:29.0000000",
    firstSeenAt: "2026-04-29 09:49:29.0000000",
    lastSeenAt: "2026-04-29 09:49:29.0000000",
    transmission: "Automatica",
    bodyType: "SUV",
    environmentalLabel: "CERO",
    doors: "5",
    seats: "5",
    powerCv: "177",
    color: "Verde",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "60",
    traction: "Delantera",
    displacement: "1498CC",
    co2: "41g/km",
    nextITV: "",
    powerKw: "45",
    consumption: "1,8",
  },
  {
    id: 17,
    url: "https://www.flexicar.es/coches-ocasion/hyundai-bayon-12-mpi-maxx-gasolina-manual-pamplona_903000000240715/",
    portal: "flexicar",
    brand: "Hyundai",
    model: "Bayon",
    version: "1.2 MPI Maxx",
    fuel: "Gasolina",
    listingType: "compra",
    price: "12990",
    monthlyPrice: "177",
    financePrice: "11390",
    year: "2023",
    mileage: "97900",
    province: "Pamplona",
    city: "Pamplona",
    imageUrl: "https://www.flexicar.es/images/903000000240715/imp2f_8grDF2UJQe__img-a700d5ca-f29d-48c4-bc02-967aea7d395c-1440x856.webp",
    title: "Hyundai Bayon 1.2 MPI Maxx Gasolina",
    listedAt: "2026-05-02 18:10:57.0000000",
    sourceUpdatedAt: "2026-05-02 18:10:57.0000000",
    firstSeenAt: "2026-05-02 16:21:14.9249568",
    lastSeenAt: "2026-05-02 18:14:06.7437367",
    transmission: "Manual",
    bodyType: "SUV",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "84",
    color: "Blanco",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1197CC",
    co2: "126g/km",
    nextITV: "",
    powerKw: "62",
    consumption: "5,6",
  },
  {
    id: 18,
    url: "https://www.flexicar.es/coches-ocasion/bmw-serie-3-320d-efficientdynamics-diesel-automatica-illescas_903000000219440/",
    portal: "flexicar",
    brand: "BMW",
    model: "Serie 3",
    version: "320d EfficientDynamics",
    fuel: "Diesel",
    listingType: "compra",
    price: "27490",
    monthlyPrice: "373",
    financePrice: "23990",
    year: "2019",
    mileage: "57700",
    province: "Toledo",
    city: "Illescas",
    imageUrl: "https://www.flexicar.es/images/903000000219440/imp2f_QhvG5XJPGl__img-6ce76a8f-266c-42b9-9716-a38573200b26-1440x856.webp",
    title: "BMW Serie 3 320d EfficientDynamics Diesel",
    listedAt: "2026-05-02 18:10:47.0000000",
    sourceUpdatedAt: "2026-05-02 18:10:47.0000000",
    firstSeenAt: "2026-05-02 16:21:14.6920102",
    lastSeenAt: "2026-05-02 18:14:06.7239053",
    transmission: "Automatica",
    bodyType: "Sedan",
    environmentalLabel: "C",
    doors: "4",
    seats: "5",
    powerCv: "163",
    color: "Rojo",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Trasera",
    displacement: "1995CC",
    co2: "117g/km",
    nextITV: "",
    powerKw: "120",
    consumption: "4,4",
  },
  {
    id: 19,
    url: "https://www.coches.com/coches-segunda-mano/ocasion-byd-seal-u-217-dm-i-boost-160kw.htm?id=XYloyS-Nz953",
    portal: "coches.com",
    brand: "BYD",
    model: "Seal U",
    version: "Comfort",
    fuel: "Hibrido",
    listingType: "compra",
    price: "31990",
    monthlyPrice: "0",
    financePrice: "29090",
    year: "2025",
    mileage: "18315",
    province: "Madrid",
    city: "Leganes",
    imageUrl: "https://img.coches.com/_ccom_/1bb06e4d-8ed5-4324-8070-b8c9e970a2b1/3202cace-c161-4ef2-b530-2d987d98a816.jpg?q=202605031912150000&p=cc_vo_high&w=720&ar=4:3",
    title: "BYD Seal U Comfort Hibrido",
    listedAt: "2026-05-02 18:04:36.0000000",
    sourceUpdatedAt: "2026-05-02 18:04:36.0000000",
    firstSeenAt: "2026-05-02 17:49:26.2001736",
    lastSeenAt: "2026-05-02 18:13:56.5846139",
    transmission: "Automatica",
    bodyType: "Todoterreno",
    environmentalLabel: "CERO",
    doors: "5",
    seats: "5",
    powerCv: "218",
    color: "Negro",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "12",
    traction: "Delantera",
    displacement: "1498CC",
    co2: "0g/km",
    nextITV: "",
    powerKw: "162",
    consumption: "0",
  },
  {
    id: 20,
    url: "https://www.coches.com/coches-segunda-mano/ocasion-toyota-c-hr-223-220ph-advance.htm?id=iiOqxj24j5AL",
    portal: "coches.com",
    brand: "Toyota",
    model: "C-HR",
    version: "220PH Advance 164 kW (223 CV)",
    fuel: "Hibrido",
    listingType: "compra",
    price: "29590",
    monthlyPrice: "0",
    financePrice: "26303",
    year: "2024",
    mileage: "44538",
    province: "Madrid",
    city: "Collado Villalba",
    imageUrl: "https://img.coches.com/_ccom_/cca90d7b-3fe3-4ebb-8483-3d1e392acefe/959fb861-c86c-4408-9a4f-30ccf208f1b5.jpg?q=202605031805240000&p=cc_vo_high&w=720&ar=4:3",
    title: "Toyota C-HR 220PH Advance 164 kW (223 CV) Hibrido",
    listedAt: "2026-05-02 17:19:42.0000000",
    sourceUpdatedAt: "2026-05-02 17:19:42.0000000",
    firstSeenAt: "2026-05-02 16:55:37.3079347",
    lastSeenAt: "2026-05-02 17:34:36.1077282",
    transmission: "Automatica",
    bodyType: "Todoterreno",
    environmentalLabel: "CERO",
    doors: "5",
    seats: "5",
    powerCv: "223",
    color: "Blanco",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1987CC",
    co2: "0g/km",
    nextITV: "",
    powerKw: "166",
    consumption: "0",
  },
  {
    id: 21,
    url: "https://www.flexicar.es/coches-ocasion/mercedes-benz-cle-cle-220-d-coupe-hibrido-no-enchufable-automatica-mataro_903000000226482/",
    portal: "flexicar",
    brand: "Mercedes-Benz",
    model: "CLE",
    version: "CLE 220 d Coupe",
    fuel: "Hibrido",
    listingType: "compra",
    price: "49890",
    monthlyPrice: "680",
    financePrice: "43790",
    year: "2024",
    mileage: "51213",
    province: "Barcelona",
    city: "Mataro",
    imageUrl: "https://www.flexicar.es/images/903000000226482/imp2f_KzY1DThK5Y__img-a5104fa3-d1a4-4620-9f8c-849d17cd2c5e-1440x856.webp",
    title: "Mercedes-Benz CLE CLE 220 d Coupe Hibrido",
    listedAt: "2026-05-03 09:59:37.0000000",
    sourceUpdatedAt: "2026-05-03 09:59:37.0000000",
    firstSeenAt: "2026-05-02 16:21:14.9133166",
    lastSeenAt: "2026-05-03 10:12:42.3289975",
    transmission: "Automatica",
    bodyType: "Coupe",
    environmentalLabel: "ECO",
    doors: "2",
    seats: "4",
    powerCv: "197",
    color: "Gris",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Trasera",
    displacement: "1993CC",
    co2: "123g/km",
    nextITV: "",
    powerKw: "145",
    consumption: "4,7",
  },
  {
    id: 22,
    url: "https://www.ocasionplus.com/coches-segunda-mano/volvo-v90-d4-momentum-auto-con-148793km-2019-qtqs2qaj",
    portal: "ocasionplus",
    brand: "Volvo",
    model: "V90",
    version: "D4 Momentum Auto (190 CV)",
    fuel: "Diesel",
    listingType: "compra",
    price: "22900",
    monthlyPrice: "391",
    financePrice: "20819",
    year: "2019",
    mileage: "148793",
    province: "Madrid",
    city: "Colmenar Viejo",
    imageUrl: "https://img.ocasionplus.com/oMv-pgcp3t8d0F8bepy7Z5uMhX8a-HuIS9AwlStqcHo/normal_ao_auto/aHR0cHM6Ly9mb3Rvcy5lc3RhdGljb3NtZi5jb20vZm90b3NfYW51bmNpb3MvMDAvMTMvMjEvNzUvODUvMy94MDEuanBnPzE1MTM0MzMxMzk0",
    title: "Volvo V90 D4 Momentum Auto (190 CV) Diesel",
    listedAt: "2026-05-02 16:43:24.0000000",
    sourceUpdatedAt: "2026-05-02 16:43:24.0000000",
    firstSeenAt: "2026-05-02 16:46:02.1243315",
    lastSeenAt: "2026-05-02 16:46:15.2281594",
    transmission: "Automatica",
    bodyType: "Familiar",
    environmentalLabel: "C",
    doors: "5",
    seats: "5",
    powerCv: "190",
    color: "Gris",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1969CC",
    co2: "129g/km",
    nextITV: "",
    powerKw: "140",
    consumption: "4,9",
  },
  {
    id: 23,
    url: "https://www.flexicar.es/coches-ocasion/toyota-corolla-200h-gr-sport-hibrido-no-enchufable-automatica-segovia_903000000229782/",
    portal: "flexicar",
    brand: "Toyota",
    model: "Corolla",
    version: "200H GR-Sport",
    fuel: "Hibrido",
    listingType: "compra",
    price: "29990",
    monthlyPrice: "419",
    financePrice: "26990",
    year: "2024",
    mileage: "22591",
    province: "Segovia",
    city: "Segovia",
    imageUrl: "https://www.flexicar.es/images/903000000229782/imp2f_S9J4tTmTS1__img-3473821c-131f-4390-9780-52ec93669287-1440x856.webp",
    title: "Toyota Corolla 200H GR-Sport Hibrido",
    listedAt: "2026-05-02 16:19:12.0000000",
    sourceUpdatedAt: "2026-05-02 16:19:12.0000000",
    firstSeenAt: "2026-05-02 16:21:14.9754245",
    lastSeenAt: "2026-05-02 16:21:14.9754245",
    transmission: "Automatica",
    bodyType: "Berlina",
    environmentalLabel: "ECO",
    doors: "5",
    seats: "5",
    powerCv: "196",
    color: "Gris",
    sellerType: "profesional",
    dealerName: "",
    warrantyMonths: "0",
    traction: "Delantera",
    displacement: "1987CC",
    co2: "103g/km",
    nextITV: "",
    powerKw: "144",
    consumption: "4,6",
  },
];

function runSqlcmdQuery(sql) {
  const tmp = path.join(os.tmpdir(), `reset-market-offers-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  const authArgs = MSSQL_USER ? ["-U", MSSQL_USER, "-P", MSSQL_PASSWORD] : ["-E"];
  try {
    return execFileSync(
      SQLCMD_PATH,
      ["-S", MSSQL_SERVER, "-d", MSSQL_DATABASE, ...authArgs, "-b", "-y", "0", "-i", tmp],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (error) {
    const stdout = error && typeof error.stdout === "string" ? error.stdout.trim() : "";
    const stderr = error && typeof error.stderr === "string" ? error.stderr.trim() : "";
    const details = [stdout, stderr].filter(Boolean).join("\n");
    throw new Error(details || (error && error.message) || "sqlcmd execution failed");
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function sqlEsc(value) {
  return String(value || "").replace(/'/g, "''");
}

function sqlStr(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "N''";
  return `N'${sqlEsc(value)}'`;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const normalized = str.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = toNumber(value);
  return n === null ? null : Math.trunc(n);
}

function sqlNum(value) {
  const n = toNumber(value);
  return n === null ? "NULL" : String(n);
}

function sqlInt(value) {
  const n = toInt(value);
  return n === null ? "NULL" : String(n);
}

function pgDate(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const clean = String(value).trim().replace(" ", "T");
  const dt = new Date(clean);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

async function syncSqlServer(rows) {
  const valuesSql = rows
    .map((r) => `(${[
      sqlStr(r.id),
      sqlStr(r.url),
      sqlStr(r.portal),
      sqlStr(r.brand),
      sqlStr(r.model),
      sqlStr(r.version),
      sqlStr(r.fuel),
      sqlStr(r.listingType),
      sqlNum(r.price),
      sqlNum(r.monthlyPrice),
      sqlNum(r.financePrice),
      sqlInt(r.year),
      sqlInt(r.mileage),
      sqlStr(r.province),
      sqlStr(r.city),
      sqlStr(r.imageUrl),
      sqlStr(r.title),
      sqlStr(r.listedAt),
      sqlStr(r.sourceUpdatedAt),
      sqlStr(r.firstSeenAt),
      sqlStr(r.lastSeenAt),
      sqlStr(r.transmission),
      sqlStr(r.bodyType),
      sqlStr(r.environmentalLabel),
      sqlInt(r.doors),
      sqlInt(r.seats),
      sqlInt(r.powerCv),
      sqlStr(r.color),
      sqlStr(r.sellerType),
      sqlStr(r.dealerName),
      sqlInt(r.warrantyMonths),
      sqlStr(r.traction),
      sqlStr(r.displacement),
      sqlStr(r.co2),
      sqlStr(r.nextITV),
      sqlInt(r.powerKw),
      sqlNum(r.consumption),
    ].join(", ")})`)
    .join(",\n");

  const sql = `
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

DELETE FROM dbo.MoveAdvisorMarketOffers;

INSERT INTO dbo.MoveAdvisorMarketOffers (
  [Id],[Url],[Portal],[Brand],[Model],[Version],[Fuel],[ListingType],[Price],[MonthlyPrice],[FinancePrice],
  [Year],[Mileage],[Province],[City],[ImageUrl],[Title],[ListedAt],[SourceUpdatedAt],[FirstSeenAt],[LastSeenAt],
  [Transmission],[BodyType],[EnvironmentalLabel],[Doors],[Seats],[PowerCv],[Color],[SellerType],[DealerName],
  [WarrantyMonths],[Traction],[Displacement],[Co2],[NextITV],[PowerKw],[Consumption]
)
VALUES
${valuesSql};

COMMIT TRAN;

SELECT COUNT(*) AS cnt FROM dbo.MoveAdvisorMarketOffers;
`;

  const out = runSqlcmdQuery(sql);
  console.log("SQL Server sync OK");
  console.log(String(out || "").trim());
}

async function syncPostgres(rows) {
  let pg;
  try {
    pg = require("pg");
  } catch {
    console.error("ERROR: falta el modulo pg. Ejecuta npm install pg");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM moveadvisor_market_offers");

    const insertSql = `
      INSERT INTO moveadvisor_market_offers (
        id, url, portal, brand, model, version, fuel, listing_type, price, monthly_price, finance_price,
        year, mileage, province, city, image_url, title, listed_at, source_updated_at, first_seen_at, last_seen_at,
        raw_payload, transmission, body_type, environmental_label, doors, seats, power_cv, color, seller_type,
        dealer_name, warranty_months, traction, displacement, co2, next_itv, power_kw, consumption,
        location, images, scraped_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
        $22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,
        $39,$40,$41,$42
      )`;

    for (const r of rows) {
      const province = String(r.province || "").trim();
      const city = String(r.city || "").trim();
      const location = [city, province].filter(Boolean).join(", ");
      const imageUrl = String(r.imageUrl || "").trim();
      const nowIso = new Date().toISOString();

      await client.query(insertSql, [
        String(r.id),
        String(r.url || ""),
        String(r.portal || ""),
        String(r.brand || ""),
        String(r.model || ""),
        String(r.version || ""),
        String(r.fuel || ""),
        String(r.listingType || ""),
        toNumber(r.price),
        toNumber(r.monthlyPrice),
        toNumber(r.financePrice),
        toInt(r.year),
        toInt(r.mileage),
        province,
        city,
        imageUrl,
        String(r.title || ""),
        pgDate(r.listedAt),
        pgDate(r.sourceUpdatedAt),
        pgDate(r.firstSeenAt) || nowIso,
        pgDate(r.lastSeenAt) || pgDate(r.firstSeenAt) || nowIso,
        "{}",
        String(r.transmission || ""),
        String(r.bodyType || ""),
        String(r.environmentalLabel || ""),
        toInt(r.doors),
        toInt(r.seats),
        toInt(r.powerCv),
        String(r.color || ""),
        String(r.sellerType || ""),
        String(r.dealerName || ""),
        toInt(r.warrantyMonths),
        String(r.traction || ""),
        String(r.displacement || ""),
        String(r.co2 || ""),
        String(r.nextITV || ""),
        toInt(r.powerKw),
        toNumber(r.consumption),
        location,
        imageUrl ? JSON.stringify([imageUrl]) : "[]",
        pgDate(r.firstSeenAt) || pgDate(r.lastSeenAt) || nowIso,
        pgDate(r.lastSeenAt) || pgDate(r.firstSeenAt) || nowIso,
      ]);
    }

    await client.query("COMMIT");

    const { rows: countRows } = await client.query("SELECT COUNT(*)::int AS cnt FROM moveadvisor_market_offers");
    console.log("Postgres sync OK");
    console.log("count:", countRows[0]?.cnt || 0);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function verifyParity(rows) {
  const urlsExpected = new Set(rows.map((r) => String(r.url || "").trim()));

  const sqlOut = runSqlcmdQuery(`
SET NOCOUNT ON;
SELECT Url FROM dbo.MoveAdvisorMarketOffers ORDER BY Id FOR JSON PATH;
`);
  const flat = String(sqlOut || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("");
  const start = flat.indexOf("[");
  const end = flat.lastIndexOf("]");
  const sqlRows = start >= 0 && end > start ? JSON.parse(flat.slice(start, end + 1)) : [];
  const sqlUrls = new Set((sqlRows || []).map((r) => String(r.Url || "").trim()).filter(Boolean));

  let pg;
  try {
    pg = require("pg");
  } catch {
    throw new Error("Falta modulo pg");
  }

  const pgClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();
  const { rows: pgRows } = await pgClient.query("SELECT url FROM moveadvisor_market_offers ORDER BY id::int");
  await pgClient.end();
  const pgUrls = new Set((pgRows || []).map((r) => String(r.url || "").trim()).filter(Boolean));

  const missingInSql = [...urlsExpected].filter((u) => !sqlUrls.has(u));
  const missingInPg = [...urlsExpected].filter((u) => !pgUrls.has(u));
  const extraInSql = [...sqlUrls].filter((u) => !urlsExpected.has(u));
  const extraInPg = [...pgUrls].filter((u) => !urlsExpected.has(u));

  console.log("Parity check:");
  console.log("  expected:", urlsExpected.size);
  console.log("  sqlserver:", sqlUrls.size);
  console.log("  postgres:", pgUrls.size);
  console.log("  missingInSql:", missingInSql.length);
  console.log("  missingInPg:", missingInPg.length);
  console.log("  extraInSql:", extraInSql.length);
  console.log("  extraInPg:", extraInPg.length);

  if (missingInSql.length || missingInPg.length || extraInSql.length || extraInPg.length) {
    throw new Error("Paridad no valida entre set esperado y bases de datos");
  }
}

(async () => {
  try {
    console.log("Reset snapshot de MoveAdvisorMarketOffers (SQL Server + Postgres)");
    await syncSqlServer(CANONICAL_ROWS);
    await syncPostgres(CANONICAL_ROWS);
    await verifyParity(CANONICAL_ROWS);
    console.log(`OK: ambas bases quedaron con las ${CANONICAL_ROWS.length} filas canonicas`);
  } catch (error) {
    console.error("ERROR:", error?.message || error);
    process.exit(1);
  }
})();
