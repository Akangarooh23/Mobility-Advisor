/**
 * Mide cuántas páginas tiene cada marca en Autocasión y lo guarda.
 *
 *   npm run mide-autocasion            (solo mira)
 *   npm run mide-autocasion -- --aplica
 *
 * POR QUE
 *
 * El orquestador reparte ventanas de 25 páginas. Para repartir bien tiene que
 * saber dónde acaba cada marca, y si solo conoce la de turno pasa una de dos:
 *
 *   - o reparte a ciegas hasta la página 625 y doce de cada veinte ventanas
 *     apuntan al vacío -lo que hacía ayer-,
 *   - o se planta al acabar la marca y desperdicia media pasada, con lo que las
 *     61 marcas tardan 30 días en barrerse en vez de 5.
 *
 * Con los números guardados puede encadenar marcas dentro de la misma pasada:
 * 14 ventanas de BMW y las 6 que sobran para Mercedes.
 *
 * Los números cambian poco -una marca no pasa de 300 a 30 páginas de un día
 * para otro- y además el propio workflow refresca el de la marca de turno en
 * cada pasada. Esto es solo para tener los 61 desde el primer día.
 */
"use strict";
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");

// La MISMA lista que el generador, y en el mismo orden: el índice es la clave.
const MARCAS = ["audi", "bmw", "mercedes-benz", "volkswagen", "peugeot", "renault", "seat",
  "citroen", "ford", "opel", "toyota", "kia", "hyundai", "nissan", "fiat", "dacia", "skoda",
  "volvo", "mazda", "mini", "land-rover", "jeep", "honda", "suzuki", "mitsubishi", "lexus",
  "porsche", "alfa-romeo", "jaguar", "cupra", "ds", "smart", "subaru", "ssangyong", "tesla",
  "abarth", "lancia", "chevrolet", "chrysler", "dodge", "infiniti", "isuzu", "maserati",
  "bentley", "ferrari", "lamborghini", "aston-martin", "lotus", "alpine", "polestar", "mg",
  "byd", "omoda", "ebro", "gwm", "leapmotor", "xpeng", "zeekr", "seres", "maxus", "genesis"];

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // Se comprueba contra el generador que la lista no se haya separado: si una
  // marca cambia de sitio, los índices guardados apuntan a otra cosa.
  const gen = fs.readFileSync(path.join(RAIZ, "scripts", "genera-scraper-autocasion.js"), "utf8");
  const enGen = (gen.match(/const MARCAS = (\[[^\]]+\])/) || [])[1];
  if (!enGen || JSON.stringify(MARCAS) !== JSON.stringify(JSON.parse(enGen))) {
    console.error("  La lista de marcas NO coincide con la del generador.");
    console.error("  Los índices guardados apuntarían a la marca equivocada. Arréglalo antes.");
    process.exit(1);
  }
  console.log("  la lista coincide con la del generador (" + MARCAS.length + " marcas)\n");

  const medidas = [];
  for (let i = 0; i < MARCAS.length; i++) {
    const marca = MARCAS[i];
    let paginas = 0;
    try {
      const r = await fetch("https://www.autocasion.com/coches-segunda-mano/" + marca + "-ocasion",
        { headers: H, signal: AbortSignal.timeout(40000) });
      if (r.status === 200) {
        const html = await r.text();
        const nums = [...html.matchAll(/[?&]page=([0-9]+)/g)].map((m) => Number(m[1]))
          .filter((n) => Number.isFinite(n));
        paginas = nums.length ? Math.min(Math.max(...nums), 625) : 1;
      } else {
        console.log("      " + marca.padEnd(16) + "HTTP " + r.status);
      }
    } catch (e) {
      console.log("      " + marca.padEnd(16) + "no responde: " + String(e.message).slice(0, 40));
    }
    if (paginas) {
      medidas.push({ i, marca, paginas });
      console.log("      " + String(i).padStart(2) + "  " + marca.padEnd(16)
        + String(paginas).padStart(4) + " páginas   ~"
        + (paginas * 25).toLocaleString("es") + " coches");
    }
    await dormir(900);
  }

  const total = medidas.reduce((a, b) => a + b.paginas, 0);
  console.log("\n  TOTAL: " + total.toLocaleString("es") + " páginas ≈ "
    + (total * 25).toLocaleString("es") + " coches");
  console.log("      a 7,1 páginas/min son " + Math.round(total / 7.1 / 60) + " horas de trabajo");
  console.log("      con 500 páginas por pasada y 2 pasadas al día: "
    + Math.ceil(total / 1000) + " días por vuelta");

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para guardarlo:");
    console.log("      npm run mide-autocasion -- --aplica");
    return;
  }

  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const valores = medidas.map((m) => "('autocasion_pag_" + m.i + "', " + m.paginas + ", NOW())").join(", ");
  await c.query("INSERT INTO moveadvisor_cursores (clave, valor, actualizado) VALUES " + valores
    + " ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = NOW()");
  const n = (await c.query("SELECT count(*)::int n FROM moveadvisor_cursores WHERE clave LIKE 'autocasion_pag_%'")).rows[0].n;
  console.log("\n  GUARDADO: " + n + " marcas con su número de páginas");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
