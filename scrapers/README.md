# Scrapers (MVP)

This folder contains the first rollout of the Python inventory pipeline.

## Goal

Generate `data/inventory-offers.json` with normalized offers used by:

- `api/find-listing.js` (inventory-first mode for buy flow)
- `api/market-price.js` (real comparables for sell flow)

## Platform tiers

Current catalog is defined in `scrapers/platform_catalog.py`.

- Tier 1 (mandatory)
	- `coches.net` (enabled)
	- `autoscout24` (enabled)
	- `milanuncios` (enabled)
	- `wallapop` (planned)
- Tier 2 (enrichment)
	- `autocasion`, `coches.com`, `motor.es`, `heycar` (planned)
	- `auto10`, `canalcar`, `automercadillo`, `motorvision` (planned)
- Tier 3 (dealers)
	- `clicars`, `autohero`, `flexicar`, `ocasionplus`, `spoticar` (planned)
- Backlog/blocked
	- `facebook-marketplace`, `autotempest`, `bca-subastas`, `autorola-subastas`,
		`importadores-alemania`, `concesionarios-api-privada`

## Local run

1. Create venv:

```bash
python -m venv .venv
```

2. Install requirements:

```bash
.venv\Scripts\pip install -r scrapers/requirements.txt
```

3. Run Tier 1 only:

```bash
.venv\Scripts\python scrapers/main.py --tiers tier1
```

4. Run explicit platform subset:

```bash
.venv\Scripts\python scrapers/main.py --platforms coches.net,autoscout24,milanuncios
```

5. Include planned platforms in output summary (no offers yet until implemented):

```bash
.venv\Scripts\python scrapers/main.py --tiers tier1,tier2,tier3 --allow-planned
```

## Output contract

Each offer should include at least:

- `portal`
- `url`
- `brand`
- `model`
- `price` (buy) or `monthlyPrice` (renting)
- `updatedAt` (ISO)

Recommended extra fields:

- `version`, `year`, `mileage`, `fuel`, `province`, `city`, `image`, `listingType`
