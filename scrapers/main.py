from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from live_scraper import run_live_scrape
from platform_catalog import PlatformSpec, select_platforms


ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "inventory-offers.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def build_seed_offer_for_platform(platform: PlatformSpec, ts: str) -> list[dict]:
    if platform.key == "coches.net":
        return [
            {
                "portal": "coches.net",
                "url": "https://www.coches.net/volkswagen-golf-segunda-mano/",
                "brand": "Volkswagen",
                "model": "Golf",
                "version": "1.5 TSI Life",
                "year": 2020,
                "mileage": 45000,
                "fuel": "Gasolina",
                "price": 18990,
                "province": "Madrid",
                "city": "Madrid",
                "image": "",
                "listingType": "compra",
                "updatedAt": ts,
                "listedAt": ts,
            }
        ]

    if platform.key == "autoscout24":
        return [
            {
                "portal": "autoscout24",
                "url": "https://www.autoscout24.es/lst/volkswagen/golf",
                "brand": "Volkswagen",
                "model": "Golf",
                "version": "2.0 TDI DSG",
                "year": 2019,
                "mileage": 62000,
                "fuel": "Diesel",
                "price": 17900,
                "province": "Barcelona",
                "city": "Barcelona",
                "image": "",
                "listingType": "compra",
                "updatedAt": ts,
                "listedAt": ts,
            }
        ]

    if platform.key == "milanuncios":
        return [
            {
                "portal": "milanuncios",
                "url": "https://www.milanuncios.com/coches-de-segunda-mano/volkswagen-golf.htm",
                "brand": "Volkswagen",
                "model": "Golf",
                "version": "1.6 TDI",
                "year": 2018,
                "mileage": 78000,
                "fuel": "Diesel",
                "price": 15450,
                "province": "Valencia",
                "city": "Valencia",
                "image": "",
                "listingType": "compra",
                "updatedAt": ts,
                "listedAt": ts,
            }
        ]

    return []


def build_seed_offers(platforms: list[PlatformSpec]) -> list[dict]:
    # First rollout keeps deterministic seed output per enabled source.
    # Replace each platform seed with real extraction logic incrementally.
    ts = now_iso()
    offers: list[dict] = []
    for platform in platforms:
        if platform.status != "enabled":
            continue
        offers.extend(build_seed_offer_for_platform(platform, ts))
    return offers


def build_generation_report(platforms: list[PlatformSpec], offers: list[dict]) -> list[dict]:
    report = []
    for platform in platforms:
        generated = [item for item in offers if item.get("portal") == platform.key]
        report.append(
            {
                "platform": platform.key,
                "tier": platform.tier,
                "status": platform.status,
                "offers": len(generated),
                "notes": platform.notes,
            }
        )
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate inventory payload for buy/sell market engine")
    parser.add_argument(
        "--tiers",
        default="tier1",
        help="Comma separated tiers to include. Example: tier1,tier2,tier3",
    )
    parser.add_argument(
        "--platforms",
        default="",
        help="Comma separated platform keys. Example: coches.net,autoscout24,milanuncios",
    )
    parser.add_argument(
        "--allow-planned",
        action="store_true",
        help="Include planned platforms in summary (they still output no offers until implemented).",
    )
    parser.add_argument(
        "--mode",
        default="live",
        choices=["live", "seed"],
        help="Scraping mode. live runs extraction, seed writes deterministic sample records.",
    )
    parser.add_argument(
        "--max-models",
        type=int,
        default=2,
        help="Max model queries per platform in live mode.",
    )
    parser.add_argument(
        "--max-links",
        type=int,
        default=2,
        help="Max candidate links per query in live mode.",
    )
    parser.add_argument(
        "--crawl-all",
        action="store_true",
        help="Crawl listing pages without brand/model filters to maximize inventory volume.",
    )
    parser.add_argument(
        "--max-pages-per-platform",
        type=int,
        default=20,
        help="Max listing/discovery pages to crawl per platform in crawl-all mode.",
    )
    parser.add_argument(
        "--max-links-per-platform",
        type=int,
        default=600,
        help="Max candidate listing links per platform in crawl-all mode.",
    )
    parser.add_argument(
        "--persist-sqlserver",
        action="store_true",
        help="After generation, sync inventory payload into SQL Server.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    requested_tiers = [part.strip().lower() for part in args.tiers.split(",") if part.strip()]
    requested_platforms = [part.strip().lower() for part in args.platforms.split(",") if part.strip()]
    selected_platforms = select_platforms(requested_tiers, requested_platforms)

    report_rows: list[dict]
    if args.mode == "seed":
        if not args.allow_planned:
            selected_platforms = [item for item in selected_platforms if item.status == "enabled"]
        generated_offers = build_seed_offers(selected_platforms)
        report_rows = build_generation_report(selected_platforms, generated_offers)
    else:
        generated_offers, report_rows = run_live_scrape(
            selected_platforms,
            include_planned=args.allow_planned,
            max_models=max(1, int(args.max_models or 1)),
            max_links_per_query=max(1, int(args.max_links or 1)),
            crawl_all=bool(args.crawl_all),
            max_pages_per_platform=max(1, int(args.max_pages_per_platform or 1)),
            max_links_per_platform=max(1, int(args.max_links_per_platform or 1)),
        )

    payload = {
        "generatedAt": now_iso(),
        "pipeline": {
            "mode": args.mode,
            "selected": [item.key for item in selected_platforms],
            "tiers": sorted({item.tier for item in selected_platforms}),
            "report": report_rows,
        },
        "offers": generated_offers,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Inventario generado: {OUT_FILE}")
    print(f"Modo: {args.mode}")
    print(f"Plataformas seleccionadas: {', '.join(payload['pipeline']['selected']) if payload['pipeline']['selected'] else 'none'}")
    pending = [row["platform"] for row in payload["pipeline"]["report"] if row.get("valid", row.get("offers", 0)) == 0]
    if pending:
        print(f"Sin datos validos: {', '.join(pending)}")
    print(f"Ofertas: {len(payload['offers'])}")

    if args.persist_sqlserver:
        sync_script = ROOT / "scripts" / "sync-inventory-sqlserver.js"
        if not sync_script.exists():
            raise FileNotFoundError(f"No se encuentra script de sync SQL Server: {sync_script}")
        print("Sincronizando inventario en SQL Server...")
        subprocess.run(
            ["node", str(sync_script), str(OUT_FILE)],
            check=True,
            cwd=str(ROOT),
        )


if __name__ == "__main__":
    main()
