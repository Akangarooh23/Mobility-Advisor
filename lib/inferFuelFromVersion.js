'use strict';

// Infers normalized fuel token from offer version text when offer.fuel is empty.
// Returns a normalizeToken()-compatible string or null (pass-through, sin dato = pasa).
//
// Precedence is load-bearing: each group intercepts before the next.
// Don't reorder without re-running the validation harness.
//
// Vocabulary contract — must match what normalizeToken() produces from DB labels:
//   'gasolina', 'diesel', 'hibrido', 'hibrido enchufable', 'electrico'

const GASOLINA           = 'gasolina';
const DIESEL             = 'diesel';
const HIBRIDO            = 'hibrido';
const HIBRIDO_ENCHUFABLE = 'hibrido enchufable';
const ELECTRICO          = 'electrico';

// ─── Group 0: Ambiguous / Mild Hybrid — always null ────────────────────────
// eTSI: 'e' is a word char → no \b before TSI — safe from group 5.
//   But 'e-TSI' has a hyphen (\b) before TSI → would match group 5 without interception.
// e-HDi: hyphen IS a word boundary → 'hdi' would match group 6 without interception.
// Both are 48V mild hybrids; portals label them inconsistently (Gasolina/Híbrido).
// "Mild Hybrid" / "Mild-Hybrid" / "Micro Híbrido" must be caught here before HEV group,
// whose /\bhybrid\b/ and /\bhibrido\b/ would otherwise match and return 'hibrido' for
// what portals label as Gasolina or Diesel (false exclusion under subject-conditional gating).
const AMBIGUOUS = [
  /\bmild.?hybrid\b/i,            // Mild Hybrid / Mild-Hybrid — 48V; portal labels: Gas/Diesel/Híbrido
  /\bmicro.?h[ií]brido\b/i,      // Micro Híbrido — Renault/Nissan 48V (e.g. TCe GPF Micro Híbrido)
  /\be-?tsi\b/i,                  // eTSI / e-TSI — VW 48V mild hybrid
  /\be-?hdi\b/i,                  // e-HDi — PSA 48V mild hybrid
  /\betdi\b/i,                    // eTDI — VW 48V diesel mild hybrid
  /\bmhev\b/i,                    // generic mild hybrid badge
  /\b48v\b/i,
  /\bioniq(?!\s*[56])\b/i,        // bare "Ioniq" — HEV/PHEV/BEV depending on year; Ioniq 5/6 are BEV
];

// ─── Group 1: Electric (BEV) ─────────────────────────────────────────────────
const ELECTRIC = [
  /\bbev\b/i,
  /\belectrico\b/i,
  /\belectric\b/i,
  /\b100\s*%\s*electr/i,
  /\bioniq\s*[56]\b/i,      // Ioniq 5, Ioniq 6
  /\be-tron\b/i,
  /\bmotor\s*electrico\b/i,
  /\bid\s*\.\s*[34567]\b/i, // ID.3, ID.4…
  /\bzoe\b/i,
  /\bleaf\b/i,
  /\bi3\b/i,                // BMW i3
  /\bi4\b/i,
  /\bpolestar\s*[23456]\b/i,  // Polestar 2/3/4/5/6 (standalone EV brand); bare "Polestar" = Volvo performance trim (gasoline)
  /\be-208\b/i,
  /\be-2008\b/i,
  /\be-301\b/i,
  /\bmodel\s*[s3xy]\b/i,    // Tesla Model S/3/X/Y
  /\bul[ée]ctric\b/i,       // variant spellings
];

// ─── Group 2: PHEV (Plug-in Hybrid → hibrido enchufable) ────────────────────
const PHEV = [
  /\bphev\b/i,
  /\bplug.?in\b/i,
  /\brecharge\b/i,           // Volvo badge
  // Mercedes diesel+electric PHEV: 300de, 350de, 400de — always 3+ digits before 'de'.
  // \d+ would also match "2.2DE" (Mazda diesel engine naming, after the decimal word boundary),
  // incorrectly inferring PHEV. Requiring 3+ digits avoids the decimal-separator false match.
  /\b\d{3,}de\b/i,           // e.g. 300de → diesel PHEV; must come before diesel group
  // BMW PHEV codes: 330e, 530e, 740e, X5 xDrive45e — 'e' suffix on known model numbers
  // Too risky to catch generically; e.g. 500e could be PHEV or Fiat 500e (BEV).
  // Left to future Tier B if validation justifies it.
];

// ─── Group 3: HEV (full hybrid → hibrido) ───────────────────────────────────
const HEV = [
  /\bhev\b/i,
  /\bfull.?hybrid\b/i,
  /\bhybrid\b/i,
  /\bhibrido\b/i,            // version text may already say it
  /\b[23456]00h\b/i,         // Lexus 200h, 300h, 400h, 450h, 500h, 600h
  /\b[34]00e\b(?!.*phev)/i,  // some older hybrids use 'e' suffix (not PHEV); conservative
  /\bself.?charg/i,          // Hyundai "self-charging hybrid"
];

// ─── Group 4: Bifuel — always null (before gasoline group) ──────────────────
// These are gasoline/diesel engines adapted for LPG or CNG.
// "gas" ⊂ "gasolina" is a pre-existing comparator bug (independent of this module).
// GLP/GNC → <900 offers, incompatible labels under substring comparator; don't infer.
const BIFUEL = [
  /\beco-?g\b/i,             // Dacia/Renault LPG bifuel
  /\btgi\b/i,                // Seat 1.5 TGI (Natural Gas)
  /\bcng\b/i,
  /\bglp\b/i,
  /\bgnc\b/i,
  /\bnatural\s*gas\b/i,
  /\bgas\s*natural\b/i,
  /\bgpl\b/i,
];

// ─── Group 6: Gasoline (Tier A) — evaluated AFTER diesel in inferFuelFromVersion ────────────
// Diesel before gasoline: if a diesel token is present it fires first, so e.g. "dCi Turbo"
// returns diesel rather than gasoline (Turbo would otherwise fire here).
// e-TSI/e-HDi intercepted in Group 0. \b before TSI is safe because 'e' is a word char
// in "eTSI", so \bTSI\b won't match inside it. But explicit e-? forms still caught above.
const GASOLINE = [
  /\btsi\b/i,                // VW group (eTSI and e-TSI already caught)
  /\btfsi\b/i,               // Audi
  /\bthp\b/i,                // PSA (not a PHEV badge)
  /\bgti\b/i,                // GTI badge
  /\bfsi\b/i,
  /\btce\b(?!.*eco-?g)/i,    // Renault TCe (ECO-G variant is bifuel, caught above)
  /\btgdi\b/i,               // Hyundai/Kia T-GDi
  /\bt-gdi\b/i,
  /\bgdi\b/i,
  /\bscti\b/i,               // Ford EcoBoost variant
  /\bturbo\b(?!.*diesel)/i,  // "Turbo" without diesel context
  // Tier B (disabled): /\b[12]\.[0-9]t\b/i — too risky (1.6t could be diesel in some brands)
];

// ─── Group 5: Diesel (Tier A) — evaluated BEFORE gasoline in inferFuelFromVersion ───────────
// e-HDi intercepted in Group 0. \bHDi\b would match inside "e-HDi" (hyphen is \b) — safe.
const DIESEL_TOKENS = [
  /\btdi\b/i,                // VW group (eTDI in Group 0)
  /\bhdi\b/i,                // PSA (e-HDi in Group 0)
  /\bdci\b/i,                // Renault (Blue dCi, dCi)
  /\bcdti\b/i,               // Opel
  /\bblue-?hdi\b/i,
  /\bblue-?dci\b/i,
  /\bjtd\b/i,                // Fiat/Alfa JTD
  /\bjtdm\b/i,
  /\bd4d\b/i,                // Toyota Diesel
  /\bd-4d\b/i,
  /\bdiesel\b/i,
  /\bcrdi\b/i,               // Hyundai/Kia CRDi
  /\btdci\b/i,               // Ford TDCi
  /\bsdci\b/i,               // Ford SDCi (smaller diesel)
  // Tier B (disabled): /\b[0-9]{3}d\b(?!e)/i — 320d, 220d etc; high coverage, some FP
];

function normalizeForInference(version) {
  return String(version || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function matchAny(patterns, text) {
  return patterns.some((p) => p.test(text));
}

/**
 * Infer normalized fuel token from version string.
 * @param {string} version — offer.version field
 * @returns {'gasolina'|'diesel'|'hibrido'|'hibrido enchufable'|'electrico'|null}
 */
function inferFuelFromVersion(version) {
  if (!version) return null;
  const v = normalizeForInference(version);

  if (matchAny(AMBIGUOUS, v))       return null;
  if (matchAny(ELECTRIC, v))        return ELECTRICO;
  if (matchAny(PHEV, v))            return HIBRIDO_ENCHUFABLE;
  if (matchAny(HEV, v))             return HIBRIDO;
  if (matchAny(BIFUEL, v))          return null;
  // Diesel before gasoline: "dCi 160 Twin Turbo" — dCi fires here before Turbo reaches GASOLINE.
  // Gasoline tokens (TSI, GTI, TFSI, TCe...) don't collide with diesel patterns, so the swap is safe.
  if (matchAny(DIESEL_TOKENS, v))   return DIESEL;
  if (matchAny(GASOLINE, v))        return GASOLINA;
  return null;
}

module.exports = { inferFuelFromVersion };
