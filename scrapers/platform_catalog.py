from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlatformSpec:
    key: str
    tier: str
    priority: int
    status: str
    notes: str
    domains: tuple[str, ...]
    listing_hints: tuple[str, ...]


PLATFORM_CATALOG = [
    PlatformSpec("coches.net", "tier1", 1, "enabled", "Core Spain marketplace.", ("coches.net",), ("segunda-mano", "coches")),
    PlatformSpec("autoscout24", "tier1", 2, "enabled", "Core EU marketplace.", ("autoscout24.es", "autoscout24.com", "autoscout24"), ("lst", "offer", "search")),
    PlatformSpec("milanuncios", "tier1", 3, "enabled", "High local volume.", ("milanuncios.com",), ("coches-de-segunda-mano", "coches")),
    PlatformSpec("wallapop", "tier1", 4, "planned", "Needs anti-bot handling.", ("wallapop.com",), ("item", "coches", "app/search")),

    PlatformSpec("autocasion", "tier2", 1, "planned", "Enrichment source.", ("autoocasion.com", "autocasion.com"), ("coches-segunda-mano", "coches")),
    PlatformSpec("coches.com", "tier2", 2, "planned", "Enrichment source.", ("coches.com",), ("coches-segunda-mano", "coches", "/ficha/", "/id/")),
    PlatformSpec("motor.es", "tier2", 3, "planned", "Dealer network coverage.", ("motor.es",), ("coches-segunda-mano", "segunda-mano", "coches", "/ficha/", "/id/")),
    PlatformSpec("heycar", "tier2", 4, "planned", "Enrichment source.", ("heycar.com", "hey.car"), ("used-cars", "coches")),
    PlatformSpec("auto10", "tier2", 5, "planned", "Optional enrichment source.", ("auto10.com",), ("coches", "segunda-mano")),
    PlatformSpec("canalcar", "tier2", 6, "planned", "Optional enrichment source.", ("canalcar.es",), ("coches", "segunda-mano")),
    PlatformSpec("automercadillo", "tier2", 7, "planned", "Optional enrichment source.", ("automercadillo.es",), ("coches", "vehiculos")),
    PlatformSpec("motorvision", "tier2", 8, "planned", "Optional enrichment source.", ("motorvision.es",), ("coches", "ocasion")),

    PlatformSpec("clicars", "tier3", 1, "planned", "Dealer inventory.", ("clicars.com",), ("coches-segunda-mano", "coches")),
    PlatformSpec("autohero", "tier3", 2, "planned", "Dealer inventory.", ("autohero.com",), ("search", "id")),
    PlatformSpec("flexicar", "tier3", 3, "planned", "Dealer inventory.", ("flexicar.es",), ("coches-ocasion", "segunda-mano")),
    PlatformSpec("ocasionplus", "tier3", 4, "planned", "Dealer inventory.", ("ocasionplus.com",), ("coches-segunda-mano", "coches-ocasion")),
    PlatformSpec("spoticar", "tier3", 5, "planned", "Dealer inventory.", ("spoticar.es",), ("coches-ocasion", "coches")),

    PlatformSpec("facebook-marketplace", "backlog", 1, "blocked", "Difficult scraping and legal risk.", ("facebook.com",), ("marketplace",)),
    PlatformSpec("autotempest", "backlog", 2, "blocked", "Aggregator with unstable extraction paths.", ("autotempest.com",), ("cars-for-sale", "results")),
    PlatformSpec("bca-subastas", "backlog", 3, "blocked", "Auction auth walls.", ("bca.com",), ("auction", "vehicle")),
    PlatformSpec("autorola-subastas", "backlog", 4, "blocked", "Auction auth walls.", ("autorola.com",), ("auction", "vehicle")),
    PlatformSpec("importadores-alemania", "backlog", 5, "planned", "Need source-by-source strategy.", ("mobile.de", "autoscout24.de"), ("fahrzeuge", "cars")),
    PlatformSpec("concesionarios-api-privada", "backlog", 6, "blocked", "Private APIs and contracts needed.", (), ("api", "dealer")),
]


def get_platform_map() -> dict[str, PlatformSpec]:
    return {item.key: item for item in PLATFORM_CATALOG}


def select_platforms(requested_tiers: list[str], requested_platforms: list[str]) -> list[PlatformSpec]:
    by_key = get_platform_map()
    normalized_tiers = {value.strip().lower() for value in requested_tiers if value.strip()}
    normalized_platforms = {value.strip().lower() for value in requested_platforms if value.strip()}

    selected: list[PlatformSpec] = []
    for spec in PLATFORM_CATALOG:
        if normalized_platforms and spec.key not in normalized_platforms:
            continue

        if normalized_tiers and spec.tier not in normalized_tiers:
            continue

        selected.append(spec)

    if normalized_platforms and not selected:
        # Keep explicit failure visible to caller.
        missing = sorted([item for item in normalized_platforms if item not in by_key])
        raise ValueError(f"Unknown platform keys: {', '.join(missing)}")

    return sorted(selected, key=lambda item: (item.tier, item.priority, item.key))
