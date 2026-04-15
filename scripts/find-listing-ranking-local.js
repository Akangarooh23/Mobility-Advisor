/**
 * Regression test for api/find-listing.js ranking logic.
 * Runs directly with Node – no live API needed.
 * Usage: node scripts/find-listing-ranking-local.js
 *        npm run test:ranking
 */

const { buildRankedListingResponse } = require("../api/find-listing");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function group(title, fn) {
  console.log(`\n${title}`);
  fn();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const makeListing = (overrides = {}) => ({
  title: "Generic Car, Gasolina, 20.000 €",
  source: "Flexicar",
  listingType: "compra",
  synthetic: false,
  isFallbackMatch: false,
  profileScore: 40,
  rankingScore: 40,
  url: "https://www.flexicar.es/coches-segunda-mano/generic/id/aaa",
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────────

group("1. Real listing beats synthetic when model objective has a real match", () => {
  const listings = [
    makeListing({
      title: "BMW Serie 1 · unidad sugerida en Flexicar",
      source: "Flexicar",
      synthetic: true,
      profileScore: 66,
      rankingScore: 66,
      url: "https://www.flexicar.es/coches-segunda-mano/?s=BMW%20X1",
    }),
    makeListing({
      title: "BMW X1 sDrive18d, Diesel, 28.500 €",
      source: "Autohero",
      synthetic: false,
      profileScore: 43,
      rankingScore: 39,
      url: "https://www.autohero.com/es/bmw-x-1/id/abc123/",
    }),
  ];

  const result = buildRankedListingResponse(listings, {
    fallbackMode: true,
    answers: { modelo_objetivo: "BMW X1", marca_preferencia: "premium_alemana" },
    models: ["BMW X1"],
  });

  const topTitle = result?.listing?.title || "";
  assert(!result?.listing?.synthetic, `Top listing is real (synthetic=${result?.listing?.synthetic})`);
  assert(
    topTitle.toLowerCase().includes("x1"),
    `Top title includes 'X1' (got: "${topTitle}")`
  );
});

group("2. Synthetic stays on top when no real listing matches model objective", () => {
  const listings = [
    makeListing({
      title: "BMW X1 · renting sugerido en Ayvens",
      source: "Ayvens",
      listingType: "renting",
      synthetic: true,
      profileScore: 66,
      rankingScore: 66,
      url: "https://ofertas-renting.ayvens.es/ofertas/",
    }),
    makeListing({
      title: "Audi A6 Avant TDI, Diesel, 34.000 €",
      source: "Autohero",
      synthetic: false,
      listingType: "renting",
      profileScore: 35,
      rankingScore: 32,
      url: "https://www.autohero.com/es/audi-a-6-avant/id/zzz",
    }),
  ];

  const result = buildRankedListingResponse(listings, {
    fallbackMode: true,
    answers: { modelo_objetivo: "BMW X1" },
    models: ["BMW X1"],
  });

  const topTitle = result?.listing?.title || "";
  const matchReason = result?.listing?.matchReason || "";
  const whyMatches = result?.listing?.whyMatches || [];
  assert(
    topTitle.toLowerCase().includes("x1"),
    `Synthetic BMW X1 stays on top when Audi has no X1 match (got: "${topTitle}")`
  );
  assert(
    matchReason.toLowerCase().includes("bmw x1"),
    `matchReason mentions model objective (got: "${matchReason}")`
  );
  assert(
    whyMatches.some((w) => w.toLowerCase().includes("bmw x1")),
    `whyMatches includes model name (first: "${whyMatches[0]}")`
  );
});

group("3. Without modelo_objetivo, native score/image ordering applies", () => {
  const listings = [
    makeListing({ title: "Seat León, Gasolina, 18.000 €", profileScore: 30, rankingScore: 28, synthetic: false }),
    makeListing({ title: "Toyota Corolla Hybrid, 22.000 €", profileScore: 55, rankingScore: 58, synthetic: false }),
  ];

  const result = buildRankedListingResponse(listings, {
    fallbackMode: false,
    answers: { marca_preferencia: "generalista_europea" },
    models: [],
  });

  assert(result?.listing !== null, "Returns a listing when no modelo_objetivo is set");
  assert(typeof result?.listing?.title === "string", "Top listing has a title");
});

group("4. listingType is preserved after ranking", () => {
  const listings = [
    makeListing({
      title: "Audi A3 · renting sugerido en Arval",
      source: "Arval",
      listingType: "renting",
      synthetic: true,
      profileScore: 60,
      rankingScore: 65,
      url: "https://www.arval.es/renting-coches",
    }),
  ];

  const result = buildRankedListingResponse(listings, {
    fallbackMode: true,
    answers: { flexibilidad: "renting", modelo_objetivo: "Audi A3" },
    models: ["Audi A3"],
  });

  assert(result?.listing?.listingType === "renting", `listingType=renting preserved (got=${result?.listing?.listingType})`);
});

group("5. Returns null for empty listings", () => {
  const result = buildRankedListingResponse([], { answers: {}, models: [] });
  assert(result === null, "Returns null for empty pool");
});

group("6. alternatives array populated correctly", () => {
  const listings = [
    makeListing({ title: "Car A", source: "Flexicar", url: "https://flexicar.es/a", profileScore: 50, rankingScore: 50 }),
    makeListing({ title: "Car B", source: "Autohero", url: "https://autohero.es/b", profileScore: 45, rankingScore: 45 }),
  ];

  const result = buildRankedListingResponse(listings, { answers: {}, models: [] });

  assert(Array.isArray(result?.listings), "listings is an array");
  assert(Array.isArray(result?.alternatives), "alternatives is an array");
  assert(result?.listings?.length > 0, `listings has entries (got=${result?.listings?.length})`);
});

// ─── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`${passed + failed} checks: ${passed} passed, ${failed} failed`);
console.log("─".repeat(50));

if (failed > 0) {
  process.exit(1);
}
