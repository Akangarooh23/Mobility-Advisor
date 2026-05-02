const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.join(__dirname, "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "inventory-offers.json");
const DEFAULT_SITEMAP_INDEX = "https://www.coches.net/servicios/sitemaps/sitemap-index.xml";
const DEFAULT_EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const DEFAULT_HEADERS = {
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    persistSqlServer: false,
    maxSitemaps: 1,
    maxUrls: 50,
    startOffset: 0,
    concurrency: 1,
    headful: true,
    sitemapIndex: DEFAULT_SITEMAP_INDEX,
    userDataDir: path.join(os.tmpdir(), "moveadvisor-cochesnet-profile"),
    maxRetries: 3,
    minDelayMs: 1000,
    maxDelayMs: 2600,
    seedUrlsFile: "",
    seedUrlsUrl: "",
    stopOnBlockedStreak: 2,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--output" && next) {
      args.output = path.resolve(next);
      index += 1;
      continue;
    }
    if (token === "--persist-sqlserver") {
      args.persistSqlServer = true;
      continue;
    }
    if (token === "--max-sitemaps" && next) {
      args.maxSitemaps = Math.max(1, Number.parseInt(next, 10) || 1);
      index += 1;
      continue;
    }
    if (token === "--max-urls" && next) {
      args.maxUrls = Math.max(1, Number.parseInt(next, 10) || 1);
      index += 1;
      continue;
    }
    if (token === "--start-offset" && next) {
      args.startOffset = Math.max(0, Number.parseInt(next, 10) || 0);
      index += 1;
      continue;
    }
    if (token === "--concurrency" && next) {
      args.concurrency = Math.min(4, Math.max(1, Number.parseInt(next, 10) || 1));
      index += 1;
      continue;
    }
    if (token === "--headful") {
      args.headful = true;
      continue;
    }
    if (token === "--headless") {
      args.headful = false;
      continue;
    }
    if (token === "--sitemap-index" && next) {
      args.sitemapIndex = next;
      index += 1;
      continue;
    }
    if (token === "--user-data-dir" && next) {
      args.userDataDir = path.resolve(next);
      index += 1;
      continue;
    }
    if (token === "--max-retries" && next) {
      args.maxRetries = Math.max(1, Math.min(8, Number.parseInt(next, 10) || 3));
      index += 1;
      continue;
    }
    if (token === "--min-delay-ms" && next) {
      args.minDelayMs = Math.max(100, Number.parseInt(next, 10) || 1000);
      index += 1;
      continue;
    }
    if (token === "--max-delay-ms" && next) {
      args.maxDelayMs = Math.max(args.minDelayMs, Number.parseInt(next, 10) || args.maxDelayMs);
      index += 1;
      continue;
    }
    if (token === "--seed-urls-file" && next) {
      args.seedUrlsFile = path.resolve(next);
      index += 1;
      continue;
    }
    if (token === "--seed-urls-url" && next) {
      args.seedUrlsUrl = String(next);
      index += 1;
      continue;
    }
    if (token === "--stop-on-blocked-streak" && next) {
      args.stopOnBlockedStreak = Math.max(1, Math.min(10, Number.parseInt(next, 10) || 2));
      index += 1;
    }
  }

  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseNumeric(value) {
  const text = normalizeText(value).replace(/\./g, "").replace(/,/g, ".");
  const match = text.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function parseIntValue(value) {
  const number = parseNumeric(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function getBrowserExecutablePath() {
  const custom = process.env.CURRENT_BROWSER_PATH || process.env.PLAYWRIGHT_BROWSER_PATH || process.env.COHESNET_BROWSER_PATH;
  if (custom && fs.existsSync(custom)) {
    return custom;
  }
  for (const candidate of DEFAULT_EDGE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("No Edge browser executable found. Set CURRENT_BROWSER_PATH or PLAYWRIGHT_BROWSER_PATH.");
}

function isBlockedTitle(title) {
  const lowered = normalizeText(title).toLowerCase();
  return lowered.includes("ups! parece que algo no va bien") || lowered.includes("eres un bot");
}

function parseXmlLocs(xmlText) {
  return [...String(xmlText || "").matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => normalizeText(match[1])).filter(Boolean);
}

function parseSeedUrls(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => /^https?:\/\//i.test(line))
    .filter((line) => /coches\.net\/.+covo\.aspx/i.test(line));
}

function chunkArray(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function randomBetween(min, max) {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ts() {
  return new Date().toISOString();
}

async function loadXmlLocs(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const title = await page.title();
  if (isBlockedTitle(title)) {
    throw new Error(`Blocked while loading XML sitemap: ${url}`);
  }
  const [content, bodyText] = await Promise.all([
    page.content(),
    page.locator("body").innerText().catch(() => ""),
  ]);
  const locs = parseXmlLocs(content);
  if (locs.length) {
    return locs;
  }
  return parseXmlLocs(bodyText);
}

async function fetchText(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const title = await page.title();
  if (isBlockedTitle(title)) {
    throw new Error(`Blocked while loading text source: ${url}`);
  }
  return page.locator("body").innerText().catch(async () => page.content());
}

async function acceptCookiesIfPresent(page) {
  const selectors = [
    "#didomi-notice-agree-button",
    "button:has-text('Aceptar')",
    "button:has-text('Acepto')",
    "button:has-text('Accept all')",
  ];
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1500 })) {
        await button.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        return true;
      }
    } catch {}
  }
  return false;
}

function normalizeFuel(value) {
  const lowered = normalizeText(value).toLowerCase();
  if (lowered.includes("diesel")) return "Diesel";
  if (lowered.includes("gasolina")) return "Gasolina";
  if (lowered.includes("elect")) return "Electrico";
  if (lowered.includes("hibr")) return "Hibrido";
  return normalizeText(value);
}

function normalizeTransmission(value) {
  const lowered = normalizeText(value).toLowerCase();
  if (lowered.includes("manual")) return "Manual";
  if (lowered.includes("auto")) return "Automatica";
  return normalizeText(value);
}

async function extractOffer(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
  } catch {}

  return page.evaluate(() => {
    function normalizeTextInner(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function parseNumber(value) {
      const text = normalizeTextInner(value).replace(/\./g, "").replace(/,/g, ".");
      const match = text.match(/\d+(?:\.\d+)?/);
      if (!match) return null;
      const number = Number(match[0]);
      return Number.isFinite(number) ? number : null;
    }

    function parseInteger(value) {
      const number = parseNumber(value);
      return Number.isFinite(number) ? Math.round(number) : null;
    }

    function extractJsonLdObjects() {
      return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map((node) => {
          try {
            return JSON.parse(node.textContent || "");
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }

    function flattenJsonLd(value) {
      if (Array.isArray(value)) {
        return value.flatMap(flattenJsonLd);
      }
      if (value && typeof value === "object") {
        const graph = Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJsonLd) : [];
        return [value, ...graph];
      }
      return [];
    }

    function pickCarObject(objects) {
      return objects.find((item) => {
        const typeValue = item && item["@type"];
        const types = Array.isArray(typeValue) ? typeValue : [typeValue];
        return types.filter(Boolean).some((entry) => String(entry).toLowerCase() === "car" || String(entry).toLowerCase() === "product");
      }) || null;
    }

    function pickBreadcrumbObject(objects) {
      return objects.find((item) => {
        const typeValue = item && item["@type"];
        const types = Array.isArray(typeValue) ? typeValue : [typeValue];
        return types.filter(Boolean).some((entry) => String(entry).toLowerCase() === "breadcrumblist");
      }) || null;
    }

    const pageTitle = document.title || "";
    if (pageTitle.toLowerCase().includes("ups! parece que algo no va bien") || document.body.innerText.toLowerCase().includes("eres un bot")) {
      return { blocked: true, pageTitle };
    }

    const rawJsonLd = flattenJsonLd(extractJsonLdObjects());
    const carObject = pickCarObject(rawJsonLd) || {};
    const breadcrumbObject = pickBreadcrumbObject(rawJsonLd) || {};
    const breadcrumbItems = Array.isArray(breadcrumbObject.itemListElement) ? breadcrumbObject.itemListElement : [];
    const breadcrumbTail = breadcrumbItems.length ? breadcrumbItems[breadcrumbItems.length - 1]?.item?.name || "" : "";

    const specTexts = Array.from(document.querySelectorAll("li strong, li"))
      .map((node) => normalizeTextInner(node.textContent || ""))
      .filter(Boolean);
    const bodyText = normalizeTextInner(document.body.innerText || "");

    const imageValue = Array.isArray(carObject.image) ? carObject.image[0]?.url || carObject.image[0] : carObject.image;
    const brandValue = typeof carObject.brand === "object" ? carObject.brand?.name : carObject.brand;
    const offerValue = Array.isArray(carObject.offers) ? carObject.offers[0] : carObject.offers;
    const mileageValue = typeof carObject.mileageFromOdometer === "object"
      ? carObject.mileageFromOdometer?.value || carObject.mileageFromOdometer?.name
      : carObject.mileageFromOdometer;

    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, strong"))
      .map((node) => normalizeTextInner(node.textContent || ""))
      .filter(Boolean);
    const priceText = headings.find((text) => /\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*€/.test(text)) || "";
    const colorText = specTexts.find((text) => /blanco|negro|gris|plata|azul|rojo|verde|naranja|amarillo|marron|beige/i.test(text)) || "";
    const fuelText = specTexts.find((text) => /diesel|gasolina|electrico|hibr/i.test(text)) || "";
    const transmissionText = specTexts.find((text) => /manual|autom/i.test(text)) || "";
    const doorsText = specTexts.find((text) => /puertas?/i.test(text)) || "";
    const seatsText = specTexts.find((text) => /plazas?/i.test(text)) || "";
    const powerText = specTexts.find((text) => /cv/i.test(text)) || "";
    const yearText = specTexts.find((text) => /^20\d{2}$|^19\d{2}$/.test(text)) || "";
    const cityText = specTexts.find((text) => /madrid|barcelona|murcia|sevilla|valencia|alicante|malaga|zaragoza|cadiz|granada|huelva|jaen|almeria|navarra|asturias|vizcaya|bizkaia|coruna|a coruna|toledo|burgos|cordoba|vigo|valladolid|leon|palmas|salamanca|oviedo|gijon/i.test(text)) || breadcrumbTail;

    return {
      blocked: false,
      pageTitle,
      title: normalizeTextInner(carObject.name || document.querySelector("h1")?.textContent || pageTitle),
      url: window.location.href,
      brand: normalizeTextInner(brandValue || ""),
      model: normalizeTextInner(carObject.model || ""),
      image: normalizeTextInner(typeof imageValue === "string" ? imageValue : ""),
      price: parseNumber(offerValue?.price || priceText),
      year: parseInteger(carObject.vehicleModelDate || carObject.modelDate || yearText),
      mileage: parseInteger(mileageValue || specTexts.find((text) => /km/i.test(text)) || ""),
      fuel: normalizeTextInner(carObject.fuelType || fuelText),
      transmission: normalizeTextInner(carObject.vehicleTransmission || transmissionText),
      bodyType: normalizeTextInner(carObject.bodyType || ""),
      doors: parseInteger(carObject.numberOfDoors || doorsText),
      seats: parseInteger(carObject.vehicleSeatingCapacity || seatsText),
      powerCv: parseInteger(carObject.horsepower || powerText),
      color: normalizeTextInner(carObject.color || colorText),
      city: normalizeTextInner(cityText),
      breadcrumbLocation: normalizeTextInner(breadcrumbTail),
      description: normalizeTextInner(carObject.description || bodyText.slice(0, 5000)),
      sellerType: bodyText.toLowerCase().includes("particular") ? "particular" : "profesional",
      rawJsonLd: rawJsonLd,
    };
  });
}

async function humanizePage(page, args, attempt) {
  try {
    await page.mouse.move(randomBetween(40, 240), randomBetween(80, 280), { steps: randomBetween(6, 16) });
    await page.waitForTimeout(randomBetween(150, 550));
    await page.mouse.wheel(0, randomBetween(220, 780));
    await page.waitForTimeout(randomBetween(200, 700));
    if (attempt > 0) {
      await page.mouse.wheel(0, -randomBetween(120, 420));
      await page.waitForTimeout(randomBetween(180, 520));
    }
  } catch {}
}

function mapOffer(raw) {
  const title = normalizeText(raw.title || raw.pageTitle || "");
  const brand = normalizeText(raw.brand || title.split(" ")[0] || "");
  const location = normalizeText(raw.city || raw.breadcrumbLocation || "");
  return {
    portal: "coches.net",
    url: normalizeText(raw.url),
    brand,
    model: normalizeText(raw.model),
    version: title.replace(new RegExp(`^${brand}\s+`, "i"), "").trim(),
    year: parseIntValue(raw.year),
    mileage: parseIntValue(raw.mileage),
    fuel: normalizeFuel(raw.fuel),
    transmission: normalizeTransmission(raw.transmission),
    bodyType: normalizeText(raw.bodyType),
    price: parseNumeric(raw.price),
    monthlyPrice: null,
    province: location,
    city: location,
    color: normalizeText(raw.color),
    image: normalizeText(raw.image),
    listingType: "compra",
    doors: parseIntValue(raw.doors),
    seats: parseIntValue(raw.seats),
    powerCv: parseIntValue(raw.powerCv),
    sellerType: normalizeText(raw.sellerType),
    dealerName: "",
    warrantyMonths: null,
    title,
    updatedAt: nowIso(),
    listedAt: nowIso(),
    rawPayload: raw,
  };
}

function isValidOffer(offer) {
  if (!offer.url || !offer.brand || !offer.model) return false;
  if (!Number.isFinite(Number(offer.price)) || Number(offer.price) < 1000) return false;
  if (!/coches\.net\/.*covo\.aspx/i.test(offer.url)) return false;
  return true;
}

async function scrapeBatch(context, initialPage, urls, args) {
  let page = initialPage;
  const results = [];
  let blockedStreak = 0;
  for (let urlIndex = 0; urlIndex < urls.length; urlIndex += 1) {
    const url = urls[urlIndex];
    console.log(`[cochesnet-playwright] [${ts()}] url ${urlIndex + 1}/${urls.length} start ${url}`);
    let extracted = null;
    let lastError = "";
    for (let attempt = 0; attempt < args.maxRetries; attempt += 1) {
      const attemptNo = attempt + 1;
      try {
        if (!page || page.isClosed()) {
          page = await context.newPage();
          console.log(`[cochesnet-playwright] [${ts()}] reopened page for url ${urlIndex + 1}/${urls.length}`);
        }
        await humanizePage(page, args, attempt);
        console.log(`[cochesnet-playwright] [${ts()}] url ${urlIndex + 1}/${urls.length} attempt ${attemptNo}/${args.maxRetries}`);
        const raw = await extractOffer(page, url);
        if (raw && !raw.blocked) {
          extracted = raw;
          console.log(`[cochesnet-playwright] [${ts()}] url ${urlIndex + 1}/${urls.length} extracted ok`);
          break;
        }
        lastError = raw && raw.blocked ? "blocked" : "empty";
        console.log(`[cochesnet-playwright] [${ts()}] url ${urlIndex + 1}/${urls.length} attempt ${attemptNo} failed (${lastError})`);
      } catch (error) {
        lastError = error.message;
        console.log(`[cochesnet-playwright] [${ts()}] url ${urlIndex + 1}/${urls.length} attempt ${attemptNo} error: ${lastError}`);
        if (/has been closed/i.test(lastError)) {
          try {
            page = await context.newPage();
            console.log(`[cochesnet-playwright] [${ts()}] recreated page after close error`);
          } catch {}
        }
      }
      if (attempt < args.maxRetries - 1) {
        const retryPauseMs = randomBetween(6000, 15000);
        console.log(`[cochesnet-playwright] [${ts()}] url ${urlIndex + 1}/${urls.length} retrying in ${retryPauseMs}ms`);
        await sleep(retryPauseMs);
      }
    }

    if (!extracted) {
      const isBlocked = lastError === "blocked";
      results.push({ url, blocked: isBlocked, error: lastError || "blocked" });
      blockedStreak = isBlocked ? blockedStreak + 1 : 0;
      if (blockedStreak >= args.stopOnBlockedStreak) {
        console.log(`[cochesnet-playwright] [${ts()}] blocked streak ${blockedStreak} reached; aborting remaining URLs`);
        break;
      }
    } else {
      const normalized = mapOffer(extracted);
      if (isValidOffer(normalized)) {
        results.push(normalized);
      } else {
        results.push({ url, invalid: true });
      }
      blockedStreak = 0;
    }

    if (urlIndex < urls.length - 1) {
      const interOfferDelayMs = randomBetween(args.minDelayMs, args.maxDelayMs);
      console.log(`[cochesnet-playwright] [${ts()}] url ${urlIndex + 1}/${urls.length} completed; waiting ${interOfferDelayMs}ms before next URL`);
      await sleep(interOfferDelayMs);
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const executablePath = getBrowserExecutablePath();
  fs.mkdirSync(args.userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(args.userDataDir, {
    headless: !args.headful,
    executablePath,
    slowMo: 250,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-dev-shm-usage",
      "--no-default-browser-check",
      "--disable-infobars",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    userAgent: DEFAULT_USER_AGENT,
    extraHTTPHeaders: DEFAULT_HEADERS,
    locale: "es-ES",
    viewport: { width: 1440, height: 1600 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  const page = await context.newPage();

  try {
    console.log(`[cochesnet-playwright] browser=${executablePath}`);
    console.log(`[cochesnet-playwright] userDataDir=${args.userDataDir}`);
    console.log(`[cochesnet-playwright] sitemapIndex=${args.sitemapIndex}`);

    const detailUrls = [];
    let sourceMode = "sitemap";
    let adSitemaps = [];

    if (args.seedUrlsFile || args.seedUrlsUrl) {
      sourceMode = "seed-list";
      if (args.seedUrlsFile) {
        const raw = fs.readFileSync(args.seedUrlsFile, "utf8");
        detailUrls.push(...parseSeedUrls(raw));
      }
      if (args.seedUrlsUrl) {
        console.log(`[cochesnet-playwright] loading seed URL list ${args.seedUrlsUrl}`);
        const raw = await fetchText(page, args.seedUrlsUrl);
        detailUrls.push(...parseSeedUrls(raw));
      }
    } else {
      await page.goto("https://www.coches.net/", { waitUntil: "domcontentloaded", timeout: 45000 });
      await acceptCookiesIfPresent(page);
      await sleep(randomBetween(800, 1800));

      const sitemapIndexLocs = await loadXmlLocs(page, args.sitemapIndex);
      adSitemaps = sitemapIndexLocs.filter((url) => /sitemap-ad-sm-\d+\.xml$/i.test(url)).slice(0, args.maxSitemaps);
      console.log(`[cochesnet-playwright] adSitemaps=${adSitemaps.length}`);

      for (const sitemapUrl of adSitemaps) {
        console.log(`[cochesnet-playwright] loading sitemap ${sitemapUrl}`);
        const locs = await loadXmlLocs(page, sitemapUrl);
        for (const url of locs) {
          if (/coches\.net\/.*covo\.aspx$/i.test(url)) {
            detailUrls.push(url);
          }
        }
      }
    }

    console.log(`[cochesnet-playwright] sourceMode=${sourceMode}`);

    const selectedWindow = [...new Set(detailUrls)].slice(args.startOffset, args.startOffset + args.maxUrls);
    const dedupedUrls = shuffleArray(selectedWindow);
    console.log(`[cochesnet-playwright] detailUrls=${dedupedUrls.length} (offset=${args.startOffset})`);

    const batches = chunkArray(dedupedUrls, Math.max(1, Math.ceil(dedupedUrls.length / args.concurrency)));
    const collected = [];
    for (const batch of batches) {
      const batchResults = await scrapeBatch(context, page, batch, args);
      collected.push(...batchResults);
    }

    const offers = collected.filter((item) => item && item.portal === "coches.net");
    const blocked = collected.filter((item) => item && item.blocked).length;
    const invalid = collected.filter((item) => item && item.invalid).length;
    const errors = collected.filter((item) => item && item.error).length;

    const payload = {
      generatedAt: nowIso(),
      pipeline: {
        mode: "browser-playwright",
        selected: ["coches.net"],
        tiers: ["tier1"],
        report: [
          {
            platform: "coches.net",
            selected: true,
            attempted: dedupedUrls.length,
            extracted: offers.length,
            valid: offers.length,
            errors: blocked + invalid + errors,
            status: offers.length ? "ok" : "no-data",
            message: offers.length
              ? `playwright extracted ${offers.length} offers from ${sourceMode === "seed-list" ? "seed list" : `${adSitemaps.length} sitemap(s)`}`
              : "no valid offers returned",
          },
        ],
      },
      offers,
    };

    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, JSON.stringify(payload, null, 2), "utf8");

    console.log(`[cochesnet-playwright] output=${args.output}`);
    console.log(`[cochesnet-playwright] validOffers=${offers.length} blocked=${blocked} invalid=${invalid} errors=${errors}`);

    if (args.persistSqlServer) {
      console.log("[cochesnet-playwright] syncing to SQL Server...");
      execFileSync("node", [path.join(ROOT, "scripts", "sync-inventory-sqlserver.js"), args.output], {
        cwd: ROOT,
        stdio: "inherit",
      });
    }
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(`[cochesnet-playwright] ${error.stack || error.message}`);
  process.exitCode = 1;
});