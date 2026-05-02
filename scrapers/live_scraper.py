from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from platform_catalog import PlatformSpec


DUCKDUCKGO_HTML = "https://html.duckduckgo.com/html/"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}

PRICE_RE = re.compile(r"(?<!\d)(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})(?:,\d{2})?\s*(?:€|EUR?)", re.IGNORECASE)
MONTHLY_PRICE_RE = re.compile(r"(?<!\d)(\d{1,3}(?:[.\s]\d{3})+|\d{2,4})(?:,\d{2})?\s*(?:€|EUR?)\s*(?:/|por)?\s*(?:mes|month)", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")
MILEAGE_RE = re.compile(r"(\d{1,3}(?:[.\s]\d{3})+)\s*km", re.IGNORECASE)
DOORS_RE = re.compile(r"\b([2-7])\s*puertas?\b", re.IGNORECASE)
SEATS_RE = re.compile(r"\b([2-9])\s*(?:plazas?|asientos?)\b", re.IGNORECASE)
POWER_CV_RE = re.compile(r"\b(\d{2,4})\s*(?:cv|hp)\b", re.IGNORECASE)
POWER_KW_RE = re.compile(r"\b(\d{2,4})\s*kw\b", re.IGNORECASE)

MODEL_CANDIDATES = [
    ("Volkswagen", "Golf"),
    ("Toyota", "Corolla"),
    ("SEAT", "Leon"),
    ("Renault", "Captur"),
    ("Hyundai", "Kona"),
    ("Kia", "Niro"),
    ("Nissan", "Qashqai"),
    ("Peugeot", "3008"),
    ("Skoda", "Octavia"),
    ("BMW", "X1"),
    ("Mercedes", "Clase A"),
    ("Audi", "A3"),
    ("BYD", "Dolphin"),
    ("MG", "MG4"),
]

TARGET_FOCUS_QUERIES = (
    ("Volkswagen", "Golf", "2.0 TDI 150CV diesel Madrid 2015"),
    ("Volkswagen", "Golf", "2.0 TDI diesel Madrid"),
)

KNOWN_BRANDS = tuple({brand.lower() for brand, _ in MODEL_CANDIDATES})
COMMON_BRANDS = (
    "audi", "bmw", "byd", "citroen", "cupra", "dacia", "ds", "fiat", "ford", "honda", "hyundai",
    "jaguar", "jeep", "kia", "lexus", "mazda", "mercedes", "mini", "mitsubishi", "nissan", "opel",
    "peugeot", "porsche", "renault", "seat", "skoda", "smart", "subaru", "suzuki", "tesla", "toyota",
    "volkswagen", "volvo", "mg", "alfa", "land", "range", "polestar", "omoda", "jaecoo", "xpeng",
)
MODEL_BY_BRAND = {
    brand.lower(): tuple({model.lower() for candidate_brand, model in MODEL_CANDIDATES if candidate_brand.lower() == brand.lower()})
    for brand, _ in MODEL_CANDIDATES
}

KNOWN_MODEL_TO_BRANDS: dict[str, set[str]] = {}
for candidate_brand, candidate_model in MODEL_CANDIDATES:
    key = " ".join(str(candidate_model).strip().lower().split())
    brand_key = " ".join(str(candidate_brand).strip().lower().split())
    KNOWN_MODEL_TO_BRANDS.setdefault(key, set()).add(brand_key)

VEHICLE_URL_HINTS = (
    "coches",
    "coche",
    "ocasion",
    "ocasi",
    "segunda-mano",
    "vehiculo",
    "vehiculos",
    "anuncio",
    "listing",
    "used",
    "/id/",
)

NON_DIRECT_PATH_HINTS = (
    "/coches-segunda-mano",
    "/coches-ocasion",
    "/segunda-mano",
    "/coches/",
    "/lst",
    "/search",
    "/app/search",
)

DIRECT_OFFER_PATH_HINTS = (
    "/id/",
    "/oferta/",
    "/offers/",
    "/angebote/",
    "/detalle/",
    "/ficha/",
    "/vehiculo/",
    "/anuncio/",
    "/ad/",
)

FORBIDDEN_NON_LISTING_PATH_HINTS = (
    "/noticias",
    "/news",
    "/blog",
    "/reportaje",
    "/prueba",
    "/opinion",
    "/actualidad",
    "/guia",
    "/comparativa",
    "/fichas_tecnicas",
    "/fichas-tecnicas",
    "/ficha-tecnica",
    "/ficha_tecnica",
)

COCHES_NET_ALLOWED_DETAIL_PATH_HINTS = (
    "/segunda-mano/",
    "/km-0/",
    "/ocasion/",
)

COCHES_NET_FORBIDDEN_PATH_HINTS = (
    "/videos/",
    "/video/",
    "/renting/",
    "/buscador-gasolineras",
    "/autocaravanas",
    "/remolques",
    "/motos/",
    "/moto/",
    "/industrial/",
    "/vehiculos-industriales/",
    "/clkn/",
)

FALLBACK_STOPWORDS = {
    "de", "del", "la", "el", "los", "las", "the", "new", "nuevo", "nueva", "segunda", "mano",
    "coche", "coches", "ocasion", "vehiculo", "vehiculos", "km", "eur", "euro",
}

KNOWN_COLORS = (
    "blanco", "negro", "gris", "plata", "azul", "rojo", "verde", "naranja", "amarillo", "marron",
    "beige", "dorado", "granate", "burdeos", "violeta", "morado", "antracita", "grafito", "crema",
)

KNOWN_CITIES = (
    "madrid", "barcelona", "valencia", "sevilla", "zaragoza", "malaga", "murcia", "palma", "bilbao",
    "alicante", "cordoba", "valladolid", "vigo", "gijon", "granada", "a coruna", "oviedo", "santander",
    "pamplona", "toledo", "burgos", "cadiz", "leon", "salamanca", "huelva", "almeria", "jaen",
)


def slugify(value: str) -> str:
    slug = normalize_token(value)
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


@dataclass
class PlatformRunReport:
    platform: str
    selected: bool
    attempted: int
    extracted: int
    valid: int
    errors: int
    status: str
    message: str


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_text(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def normalize_token(value: str) -> str:
    return normalize_text(value).lower()


def normalize_domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def parse_price(value: str) -> int | None:
    if not value:
        return None
    cleaned = value.replace(" ", "").replace(".", "")
    if "," in cleaned:
        cleaned = cleaned.split(",", 1)[0]
    try:
        amount = int(cleaned)
    except ValueError:
        return None
    if amount < 1500 or amount > 500000:
        return None
    return amount


def extract_udgg_url(raw_href: str) -> str:
    if not raw_href:
        return ""
    href = raw_href.strip()
    if href.startswith("//"):
        href = f"https:{href}"
    elif href.startswith("/"):
        href = urljoin("https://html.duckduckgo.com", href)

    try:
        parsed = urlparse(href)
    except Exception:
        return ""

    query = parse_qs(parsed.query)
    if "uddg" in query and query["uddg"]:
        return unquote(query["uddg"][0])
    return href


def build_queries_for_platform(platform: PlatformSpec) -> list[tuple[str, str, str]]:
    queries: list[tuple[str, str, str]] = []
    primary_domain = platform.domains[0] if platform.domains else ""

    # Prioritize high-intent seed queries for known hard targets.
    if platform.key in {"coches.net", "autoscout24"}:
        for brand, model, extra in TARGET_FOCUS_QUERIES:
            if primary_domain:
                q = f"site:{primary_domain} {brand} {model} {extra}"
            else:
                q = f"{brand} {model} {extra} Espana"
            queries.append((q, brand, model))

    # Rotate candidates by platform and hour so fast mode does not always hit the same model.
    if MODEL_CANDIDATES:
        hour_seed = datetime.now(timezone.utc).hour
        platform_seed = sum(ord(ch) for ch in platform.key)
        offset = (platform_seed + hour_seed) % len(MODEL_CANDIDATES)
        rotated_candidates = MODEL_CANDIDATES[offset:] + MODEL_CANDIDATES[:offset]
    else:
        rotated_candidates = MODEL_CANDIDATES

    for brand, model in rotated_candidates:
        if primary_domain:
            q = f"site:{primary_domain} {brand} {model} coche segunda mano"
        else:
            q = f"{brand} {model} coche segunda mano Espana"
        queries.append((q, brand, model))
    return queries


def build_direct_candidate_urls(platform: PlatformSpec, brand: str, model: str) -> list[str]:
    key = platform.key
    brand_slug = slugify(brand)
    model_slug = slugify(model)
    full_model = slugify(f"{brand} {model}")

    if key == "coches.net":
        return [
            f"https://www.coches.net/{brand_slug}/{model_slug}/segunda-mano/",
            f"https://www.coches.net/segunda-mano/?Key={brand}%20{model}",
            f"https://www.coches.net/segunda-mano/?Key={brand}%20{model}%202.0%20TDI%20diesel%20Madrid%202015",
        ]

    if key == "autoscout24":
        return [
            f"https://www.autoscout24.es/lst/{brand_slug}/{model_slug}",
            f"https://www.autoscout24.es/lst?sort=standard&desc=0&q={brand}%20{model}",
            f"https://www.autoscout24.es/lst?sort=standard&desc=0&q={brand}%20{model}%202.0%20TDI%20diesel%20Madrid%202015",
        ]

    if key == "milanuncios":
        return [
            f"https://www.milanuncios.com/coches-de-segunda-mano/?fromSearch=1&text={brand}%20{model}",
        ]

    if key == "wallapop":
        return [
            f"https://es.wallapop.com/app/search?keywords={brand}%20{model}",
        ]

    if key in {"autocasion", "autoocasion"}:
        return [
            f"https://www.autoocasion.com/coches-segunda-mano?f%5Bq%5D={brand}%20{model}",
        ]

    if key == "coches.com":
        return [
            f"https://www.coches.com/coches-segunda-mano/?q={brand}%20{model}",
        ]

    if key == "motor.es":
        return [
            f"https://www.motor.es/coches-segunda-mano/{full_model}",
        ]

    if key == "heycar":
        return [
            f"https://heycar.com/es-es/coches/{brand_slug}/{model_slug}",
        ]

    if key == "auto10":
        return [
            f"https://www.auto10.com/coches-segunda-mano/{brand_slug}/{model_slug}",
            f"https://www.auto10.com/coches-segunda-mano/",
        ]

    if key == "canalcar":
        return [
            f"https://www.canalcar.es/coches-ocasion/{brand_slug}/{model_slug}",
            f"https://www.canalcar.es/coches-ocasion/",
        ]

    if key == "automercadillo":
        return [
            f"https://www.automercadillo.es/coches-segunda-mano/{brand_slug}/{model_slug}",
            f"https://www.automercadillo.es/coches-segunda-mano/",
        ]

    if key == "motorvision":
        return [
            f"https://www.motorvision.es/coches-ocasion/{brand_slug}/{model_slug}",
            f"https://www.motorvision.es/coches-ocasion/",
        ]

    if key == "clicars":
        return [
            f"https://www.clicars.com/coches-segunda-mano?search={brand}%20{model}",
        ]

    if key == "autohero":
        return [
            f"https://www.autohero.com/es/search/?q={brand}%20{model}",
        ]

    if key == "flexicar":
        return [
            f"https://www.flexicar.es/{brand_slug}/{model_slug}/segunda-mano/",
            f"https://www.flexicar.es/coches-segunda-mano/?s={brand}%20{model}",
        ]

    if key == "ocasionplus":
        return [
            f"https://www.ocasionplus.com/coches-segunda-mano/{brand_slug}/{model_slug}",
            f"https://www.ocasionplus.com/coches-ocasion?search={brand}%20{model}",
        ]

    if key == "spoticar":
        return [
            "https://www.spoticar.es/coches-ocasion",
        ]

    return []


def build_platform_listing_seed_urls(platform: PlatformSpec) -> list[str]:
    key = platform.key
    if key == "coches.net":
        return ["https://www.coches.net/segunda-mano/", "https://www.coches.net/sitemap.xml"]
    if key == "autoscout24":
        return ["https://www.autoscout24.es/lst", "https://www.autoscout24.es/sitemap.xml"]
    if key == "milanuncios":
        return ["https://www.milanuncios.com/coches-de-segunda-mano/", "https://www.milanuncios.com/sitemap.xml"]
    if key == "wallapop":
        return ["https://es.wallapop.com/app/search?keywords=coche"]
    if key in {"autocasion", "autoocasion"}:
        return ["https://www.autoocasion.com/coches-segunda-mano"]
    if key == "coches.com":
        return ["https://www.coches.com/coches-segunda-mano/"]
    if key == "motor.es":
        return ["https://www.motor.es/coches-segunda-mano/"]
    if key == "heycar":
        return ["https://heycar.com/es-es/coches"]
    if key == "auto10":
        return ["https://www.auto10.com/coches-segunda-mano/"]
    if key == "canalcar":
        return ["https://www.canalcar.es/coches-ocasion/"]
    if key == "automercadillo":
        return ["https://www.automercadillo.es/coches-segunda-mano/"]
    if key == "motorvision":
        return ["https://www.motorvision.es/coches-ocasion/"]
    if key == "clicars":
        return ["https://www.clicars.com/coches-segunda-mano"]
    if key == "autohero":
        return ["https://www.autohero.com/es/search/"]
    if key == "flexicar":
        return ["https://www.flexicar.es/coches-segunda-mano/"]
    if key == "ocasionplus":
        return ["https://www.ocasionplus.com/coches-ocasion"]
    if key == "spoticar":
        return ["https://www.spoticar.es/coches-ocasion"]
    return []


def domain_matches_platform(url: str, platform: PlatformSpec) -> bool:
    host = normalize_domain(url)
    if not host:
        return False
    return any(host.endswith(domain.lower()) for domain in platform.domains)


def listing_path_matches(url: str, platform: PlatformSpec) -> bool:
    lowered = normalize_token(url)
    if not platform.listing_hints:
        return True
    return any(hint in lowered for hint in platform.listing_hints)


def parse_brand_model_from_text(title: str, url: str) -> tuple[str, str]:
    haystack = normalize_token(f"{title} {url}")
    if "alfa romeo" in haystack or "alfa-romeo" in haystack:
        tokens = [token for token in re.findall(r"[a-zA-Z0-9]+", normalize_text(title).lower()) if len(token) > 1]
        model = ""
        for idx, token in enumerate(tokens):
            if token == "romeo" and idx + 1 < len(tokens):
                nxt = tokens[idx + 1]
                if nxt not in FALLBACK_STOPWORDS and not nxt.isdigit():
                    model = nxt.capitalize()
                break
        return "Alfa Romeo", model or "Unknown"

    for brand in KNOWN_BRANDS:
        if brand not in haystack:
            continue
        models = MODEL_BY_BRAND.get(brand, ())
        for model in models:
            if model in haystack:
                return brand.title(), " ".join(part.capitalize() for part in model.split())
        return brand.title(), ""

    title_tokens = [token for token in re.findall(r"[a-zA-Z0-9]+", normalize_text(title).lower()) if len(token) > 1]
    for idx, token in enumerate(title_tokens):
        if token in COMMON_BRANDS:
            brand = token.capitalize()
            next_token = ""
            if idx + 1 < len(title_tokens):
                candidate = title_tokens[idx + 1]
                if candidate not in FALLBACK_STOPWORDS and not candidate.isdigit():
                    next_token = candidate.capitalize()
            return brand, next_token or "Unknown"

    return "", ""


def parse_brand_model_from_url(url: str) -> tuple[str, str]:
    try:
        parsed = urlparse(url)
    except Exception:
        return "", ""

    path = normalize_token(parsed.path)
    if not path:
        return "", ""

    raw_tail = path.rstrip("/").split("/")[-1]
    if not raw_tail:
        return "", ""

    tail = re.sub(r"\.(?:html?|aspx?)$", "", raw_tail, flags=re.IGNORECASE)
    tail = re.sub(r"-\d{4,}$", "", tail)
    tail = re.sub(r"[^a-z0-9\-]", "-", tail)
    tokens = [item for item in re.split(r"[-_]+", tail) if item]
    if not tokens:
        return "", ""

    # Composite brands first.
    joined = "-".join(tokens)
    if "alfa-romeo" in joined:
        start = tokens.index("romeo") + 1 if "romeo" in tokens else 0
        model_tokens = [tok for tok in tokens[start:start + 3] if tok not in FALLBACK_STOPWORDS and not tok.isdigit()]
        model = " ".join(tok.capitalize() for tok in model_tokens).strip()
        return "Alfa Romeo", model or "Unknown"

    for idx, token in enumerate(tokens):
        if token not in COMMON_BRANDS:
            continue

        # Map split brand aliases to canonical names.
        if token == "mercedes":
            brand = "Mercedes"
        elif token == "seat":
            brand = "SEAT"
        elif token == "mg":
            brand = "MG"
        else:
            brand = token.capitalize()

        model_tokens: list[str] = []
        for nxt in tokens[idx + 1: idx + 5]:
            if nxt in FALLBACK_STOPWORDS:
                continue
            if re.fullmatch(r"\d{4,}", nxt):
                continue
            if nxt in COMMON_BRANDS:
                break
            model_tokens.append(nxt)
            if len(model_tokens) >= 2:
                break

        model = " ".join(tok.capitalize() for tok in model_tokens).strip()
        return brand, model or "Unknown"

    return "", ""


def normalize_fuel_value(value: str) -> str:
    return fuel_from_text(value)


def parse_intish(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        number = int(round(float(value)))
        return number if number >= 0 else None
    text = normalize_text(str(value))
    if not text:
        return None
    digits = re.search(r"\d{1,7}", text.replace(".", "").replace(" ", ""))
    if not digits:
        return None
    try:
        return int(digits.group(0))
    except Exception:
        return None


def parse_locality_from_obj(value) -> str:
    if isinstance(value, dict):
        for key in ("addressLocality", "addressRegion", "address"):
            if key in value:
                out = parse_locality_from_obj(value[key])
                if out:
                    return out
        return ""
    if isinstance(value, list):
        for item in value:
            out = parse_locality_from_obj(item)
            if out:
                return out
        return ""
    return normalize_text(str(value or ""))[:80]


def iter_jsonld_objects(value):
    if isinstance(value, list):
        for item in value:
            yield from iter_jsonld_objects(item)
        return

    if isinstance(value, dict):
        yield value
        graph = value.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                yield from iter_jsonld_objects(item)


def extract_structured_vehicle_data(soup: BeautifulSoup) -> dict:
    result = {
        "brand": "",
        "model": "",
        "version": "",
        "price": None,
        "year": None,
        "mileage": None,
        "fuel": "",
        "transmission": "",
        "bodyType": "",
        "doors": None,
        "seats": None,
        "powerCv": None,
        "city": "",
        "color": "",
    }

    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    for script in scripts:
        content = normalize_text(script.get_text(" ", strip=True))
        if not content:
            continue

        try:
            payload = json.loads(content)
        except Exception:
            continue

        for obj in iter_jsonld_objects(payload):
            if not isinstance(obj, dict):
                continue
            type_value = normalize_token(" ".join(obj.get("@type", [])) if isinstance(obj.get("@type"), list) else obj.get("@type", ""))

            brand_value = obj.get("brand")
            if isinstance(brand_value, dict):
                brand_value = brand_value.get("name", "")
            if not result["brand"]:
                result["brand"] = normalize_text(str(brand_value or ""))

            if not result["model"]:
                result["model"] = normalize_text(str(obj.get("model", "")))

            if not result["version"]:
                result["version"] = normalize_text(str(obj.get("vehicleConfiguration") or obj.get("alternateName") or ""))

            if result["year"] is None:
                result["year"] = parse_intish(obj.get("modelDate") or obj.get("vehicleModelDate"))

            if result["mileage"] is None:
                mileage_obj = obj.get("mileageFromOdometer")
                if isinstance(mileage_obj, dict):
                    result["mileage"] = parse_intish(mileage_obj.get("value") or mileage_obj.get("valueReference"))
                else:
                    result["mileage"] = parse_intish(mileage_obj)

            if not result["fuel"]:
                result["fuel"] = normalize_fuel_value(str(obj.get("fuelType", "")))

            if not result["transmission"]:
                result["transmission"] = transmission_from_text(str(obj.get("vehicleTransmission", "")))

            if not result["bodyType"]:
                result["bodyType"] = normalize_text(str(obj.get("bodyType", "")))

            if result["doors"] is None:
                result["doors"] = parse_intish(obj.get("numberOfDoors"))

            if result["seats"] is None:
                result["seats"] = parse_intish(obj.get("vehicleSeatingCapacity") or obj.get("seatingCapacity"))

            if result["powerCv"] is None:
                result["powerCv"] = parse_intish(obj.get("horsepower") or obj.get("powerOutput"))

            if not result["city"]:
                result["city"] = parse_locality_from_obj(obj.get("address") or obj.get("seller") or obj.get("offers"))

            if not result["color"]:
                result["color"] = normalize_text(str(obj.get("color", "")))

            if result["price"] is None:
                result["price"] = find_first_numeric_price(obj.get("offers") or obj)

            if "vehicle" in type_value or "car" in type_value or "product" in type_value:
                # Keep scanning to enrich fields, but this marks a relevant object.
                pass

    if result["powerCv"] is not None and (result["powerCv"] < 40 or result["powerCv"] > 1500):
        result["powerCv"] = None
    if result["doors"] is not None and (result["doors"] < 2 or result["doors"] > 7):
        result["doors"] = None
    if result["seats"] is not None and (result["seats"] < 2 or result["seats"] > 9):
        result["seats"] = None

    return result


def has_id_like_tail(path: str) -> bool:
    # Many portals include listing identifiers in the last path segment.
    tail = normalize_text(path).rstrip("/").split("/")[-1]
    if not tail:
        return False
    return bool(re.search(r"\d{4,}", tail) or re.search(r"[a-f0-9]{8,}", tail, re.IGNORECASE))


def is_coches_net_detail_url(path: str) -> bool:
    if not path:
        return False
    if any(token in path for token in COCHES_NET_FORBIDDEN_PATH_HINTS):
        return False
    if "http/" in path or "https/" in path:
        return False
    if not any(token in path for token in COCHES_NET_ALLOWED_DETAIL_PATH_HINTS):
        return False
    if not (path.endswith(".htm") or path.endswith(".html") or path.endswith(".aspx")):
        return False
    tail = path.rstrip("/").split("/")[-1]
    return any(char.isdigit() for char in tail)


def is_direct_offer_url(platform: PlatformSpec, url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    path = normalize_token(parsed.path)
    query = normalize_token(parsed.query)
    if not path or path in {"", "/"}:
        return False
    if any(token in path for token in FORBIDDEN_NON_LISTING_PATH_HINTS):
        return False

    # Platform-specific direct listing URL patterns.
    if platform.key == "coches.net":
        return is_coches_net_detail_url(path)
    if platform.key == "autoscout24":
        if any(token in path for token in ("/offers/", "/oferta/", "/angebote/", "/anuncios/")):
            if has_id_like_tail(path):
                return True
            return bool(re.search(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", path, re.IGNORECASE))
        return False
    if platform.key == "milanuncios":
        return "/coches-de-segunda-mano/" in path and (path.endswith(".htm") or path.endswith(".html") or has_id_like_tail(path))
    if platform.key == "coches.com":
        return "/coches-segunda-mano/" in path and ("/ocasion-" in path or ("id=" in query and path.endswith(".htm")))
    if platform.key == "motor.es":
        return "/coches-segunda-mano/" in path and ("-" in path and (path.endswith(".html") or has_id_like_tail(path)))

    # Explicit search/filter pages are never direct ads.
    if any(token in path for token in NON_DIRECT_PATH_HINTS):
        if any(hint in path for hint in DIRECT_OFFER_PATH_HINTS) or has_id_like_tail(path):
            return True
        return False
    if any(token in query for token in ("q=", "search", "keywords", "sort=", "page=")):
        if any(hint in path for hint in DIRECT_OFFER_PATH_HINTS) or has_id_like_tail(path):
            return True
        return False

    if any(hint in path for hint in DIRECT_OFFER_PATH_HINTS):
        return True
    if has_id_like_tail(path):
        return True

    # Generic fallback for very custom URLs with long, specific slug paths.
    segments = [seg for seg in path.split("/") if seg]
    return len(segments) >= 3 and any(char.isdigit() for char in segments[-1])


def looks_like_vehicle_listing_url(url: str) -> bool:
    lowered = normalize_token(url)
    return any(hint in lowered for hint in VEHICLE_URL_HINTS)


def extract_sitemap_locs(xml_text: str) -> list[str]:
    if not xml_text:
        return []
    matches = re.findall(r"<loc>(.*?)</loc>", xml_text, flags=re.IGNORECASE)
    return [normalize_text(item) for item in matches if normalize_text(item)]


def discover_embedded_urls(raw_html: str, base_url: str, platform: PlatformSpec) -> list[str]:
    if not raw_html:
        return []

    sample = raw_html[:450000]
    escaped = sample.replace("\\/", "/")
    url_like = set()

    # Absolute URLs in JS/JSON blobs.
    for match in re.findall(r"https?://[^\"'\s<>]+", escaped, flags=re.IGNORECASE):
        cleaned = normalize_text(match).strip("\"'()[]{}<>,;")
        if cleaned:
            url_like.add(cleaned)

    # Root-relative URLs that often contain listing paths.
    for match in re.findall(r"/(?:[^\"'\s<>]{5,})", escaped):
        candidate = normalize_text(match).strip("\"'()[]{}<>,;")
        if not candidate.startswith("/"):
            continue
        if any(tok in normalize_token(candidate) for tok in (".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", "api/", "graphql", "favicon")):
            continue
        try:
            absolute = urljoin(base_url, candidate)
        except Exception:
            continue
        url_like.add(absolute)

    ranked = []
    seen = set()
    for item in url_like:
        key = normalize_token(item)
        if not key or key in seen:
            continue
        if not domain_matches_platform(item, platform):
            continue
        seen.add(key)
        ranked.append(item)

    return ranked


def expand_autoscout_detail_urls(
    client: httpx.Client,
    platform: PlatformSpec,
    candidate_urls: list[str],
    max_results: int,
) -> list[str]:
    expanded: list[str] = []
    seen: set[str] = set()

    def push(url: str) -> None:
        normalized = normalize_token(url)
        if not normalized or normalized in seen:
            return
        if not domain_matches_platform(url, platform):
            return
        if not is_direct_offer_url(platform, url):
            return
        seen.add(normalized)
        expanded.append(url)

    for raw in candidate_urls:
        if len(expanded) >= max_results:
            break
        if not raw:
            continue

        try:
            parsed = urlparse(raw)
        except Exception:
            continue

        path = normalize_token(parsed.path)
        if is_direct_offer_url(platform, raw):
            push(raw)
            continue

        # Listing/search pages: extract detail links from anchors and embedded JSON/JS.
        if "/lst" not in path and "/search" not in path and "/app/search" not in path:
            continue

        try:
            response = client.get(raw, timeout=10.0, follow_redirects=True)
        except Exception:
            continue
        if response.status_code >= 400:
            continue

        final_url = str(response.url)
        if not domain_matches_platform(final_url, platform):
            continue

        html = response.text[:350000]
        soup = BeautifulSoup(html, "html.parser")

        for anchor in soup.find_all("a", href=True):
            detail_url = urljoin(final_url, normalize_text(anchor.get("href", "")))
            push(detail_url)
            if len(expanded) >= max_results:
                return expanded[:max_results]

        for embedded in discover_embedded_urls(html, final_url, platform):
            push(embedded)
            if len(expanded) >= max_results:
                return expanded[:max_results]

    return expanded[:max_results]


def discover_listing_links(client: httpx.Client, platform: PlatformSpec, seed_urls: list[str], max_pages: int, max_links: int) -> list[str]:
    queue = [item for item in seed_urls if item]
    visited_pages: set[str] = set()
    listing_links: list[str] = []
    listing_seen: set[str] = set()

    while queue and len(visited_pages) < max_pages and len(listing_links) < max_links:
        page_url = queue.pop(0)
        page_key = normalize_token(page_url)
        if not page_key or page_key in visited_pages:
            continue
        visited_pages.add(page_key)

        try:
            response = client.get(page_url, timeout=10.0, follow_redirects=True)
        except Exception:
            continue
        if response.status_code >= 400:
            continue

        final_url = str(response.url)
        if not domain_matches_platform(final_url, platform):
            continue

        content_type = normalize_token(response.headers.get("content-type", ""))
        if final_url.lower().endswith(".xml") or "xml" in content_type:
            for loc in extract_sitemap_locs(response.text[:400000]):
                if not domain_matches_platform(loc, platform):
                    continue
                loc_key = normalize_token(loc)
                if loc.lower().endswith(".xml"):
                    if loc_key not in visited_pages and loc_key not in queue:
                        queue.append(loc)
                    continue
                if is_direct_offer_url(platform, loc) and loc_key not in listing_seen:
                    listing_seen.add(loc_key)
                    listing_links.append(loc)
                    if len(listing_links) >= max_links:
                        break
            continue

        soup = BeautifulSoup(response.text[:220000], "html.parser")
        for anchor in soup.find_all("a", href=True):
            href = normalize_text(anchor.get("href", ""))
            if not href:
                continue
            candidate = urljoin(final_url, href)
            if not domain_matches_platform(candidate, platform):
                continue

            lowered = normalize_token(candidate)
            if listing_path_matches(candidate, platform):
                if is_direct_offer_url(platform, candidate) and lowered not in listing_seen:
                    listing_seen.add(lowered)
                    listing_links.append(candidate)
                elif lowered not in visited_pages:
                    queue.append(candidate)
                continue

            # Generic listing candidates when per-platform hints are too strict.
            if looks_like_vehicle_listing_url(candidate):
                if is_direct_offer_url(platform, candidate) and lowered not in listing_seen:
                    listing_seen.add(lowered)
                    listing_links.append(candidate)
                continue

            # Follow pagination/discovery pages to continue crawling listings.
            if any(token in lowered for token in ("page=", "pagina=", "/pagina-", "/p/", "offset=")):
                if lowered not in visited_pages:
                    queue.append(candidate)

        # Some portals render listing links inside scripts/JSON rather than anchors.
        for embedded in discover_embedded_urls(response.text, final_url, platform):
            lowered = normalize_token(embedded)
            if is_direct_offer_url(platform, embedded):
                if lowered not in listing_seen:
                    listing_seen.add(lowered)
                    listing_links.append(embedded)
                continue

            if listing_path_matches(embedded, platform) and lowered not in visited_pages:
                queue.append(embedded)

    return listing_links[:max_links]


def fuel_from_text(text: str) -> str:
    lowered = normalize_token(text)
    if "electrico" in lowered or "electric" in lowered:
        return "Electrico"
    if "hibrid" in lowered or "hybrid" in lowered:
        return "Hibrido"
    if "diesel" in lowered:
        return "Diesel"
    if "gasolina" in lowered:
        return "Gasolina"
    return ""


def transmission_from_text(text: str) -> str:
    lowered = normalize_token(text)
    if "automatic" in lowered or "auto " in lowered or "dsg" in lowered or "cvt" in lowered:
        return "Automatica"
    if "manual" in lowered:
        return "Manual"
    return ""


def body_type_from_text(text: str) -> str:
    lowered = normalize_token(text)
    if "suv" in lowered or "todoterreno" in lowered:
        return "SUV"
    if "berlina" in lowered or "sedan" in lowered:
        return "Berlina"
    if "familiar" in lowered or "wagon" in lowered:
        return "Familiar"
    if "monovolumen" in lowered:
        return "Monovolumen"
    if "cabrio" in lowered or "descapotable" in lowered:
        return "Cabrio"
    if "coupe" in lowered or "coup" in lowered:
        return "Coupe"
    if "pickup" in lowered or "pick-up" in lowered:
        return "Pickup"
    if "compact" in lowered:
        return "Compacto"
    if "furgon" in lowered:
        return "Furgoneta"
    return ""


def environmental_label_from_text(text: str) -> str:
    lowered = normalize_token(text)
    if "etiqueta cero" in lowered or "distintivo cero" in lowered or "etiqueta 0" in lowered:
        return "CERO"
    if "etiqueta eco" in lowered or "distintivo eco" in lowered:
        return "ECO"
    if "etiqueta c" in lowered or "distintivo c" in lowered:
        return "C"
    if "etiqueta b" in lowered or "distintivo b" in lowered:
        return "B"
    return ""


def seller_type_from_text(text: str) -> str:
    lowered = normalize_token(text)
    if "particular" in lowered:
        return "particular"
    if "concesionario" in lowered or "profesional" in lowered or "dealer" in lowered:
        return "profesional"
    return ""


def parse_int_match(match: re.Match[str] | None) -> int | None:
    if not match:
        return None
    try:
        return int(match.group(1))
    except Exception:
        return None


def parse_power_cv(text: str) -> int | None:
    direct = parse_int_match(POWER_CV_RE.search(text))
    if direct and 40 <= direct <= 1500:
        return direct
    kw = parse_int_match(POWER_KW_RE.search(text))
    if kw and 30 <= kw <= 1000:
        converted = int(round(kw * 1.35962))
        if 40 <= converted <= 1500:
            return converted
    return None


def parse_monthly_price(text: str) -> int | None:
    match = MONTHLY_PRICE_RE.search(text)
    if not match:
        return None
    return parse_price(match.group(1))


def parse_city_from_text(text: str) -> str:
    lowered = normalize_token(text)
    for city in KNOWN_CITIES:
        if city in lowered:
            return " ".join(part.capitalize() for part in city.split())
    return ""


def parse_color_from_text(text: str) -> str:
    lowered = normalize_token(text)
    for color in KNOWN_COLORS:
        if re.search(rf"\b{re.escape(color)}\b", lowered):
            return color.capitalize()
    return ""


def parse_version_from_title(title: str, brand: str, model: str) -> str:
    clean_title = normalize_text(title)
    if not clean_title:
        return ""

    version = clean_title
    if brand:
        version = re.sub(rf"\b{re.escape(brand)}\b", "", version, flags=re.IGNORECASE)
    if model:
        version = re.sub(rf"\b{re.escape(model)}\b", "", version, flags=re.IGNORECASE)

    version = re.sub(r"\b(19\d{2}|20\d{2})\b", "", version)
    version = re.sub(r"\s+", " ", version).strip(" -|,")

    if len(version) < 2:
        return ""
    return version[:90]


def model_matches_known_brand(model: str, brand: str) -> bool:
    model_token = normalize_token(model)
    brand_token = normalize_token(brand)
    if not model_token or not brand_token:
        return True

    allowed_brands = KNOWN_MODEL_TO_BRANDS.get(model_token)
    if not allowed_brands:
        return True

    return brand_token in allowed_brands


def find_first_numeric_price(value) -> int | None:
    if isinstance(value, dict):
        for key in ("price", "offers", "priceSpecification", "priceRange"):
            if key in value:
                found = find_first_numeric_price(value[key])
                if found:
                    return found
        for nested in value.values():
            found = find_first_numeric_price(nested)
            if found:
                return found
        return None

    if isinstance(value, list):
        for item in value:
            found = find_first_numeric_price(item)
            if found:
                return found
        return None

    if isinstance(value, (int, float)):
        return parse_price(str(int(value)))

    if isinstance(value, str):
        numeric = re.search(r"\d{1,3}(?:[.\s]\d{3})+|\d{4,6}", value)
        if numeric:
            return parse_price(numeric.group(0))
    return None


def extract_structured_price(soup: BeautifulSoup) -> int | None:
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    for script in scripts:
        content = normalize_text(script.get_text(" ", strip=True))
        if not content:
            continue
        try:
            payload = json.loads(content)
        except Exception:
            continue
        found = find_first_numeric_price(payload)
        if found:
            return found
    return None


def quality_is_valid(offer: dict) -> bool:
    brand = normalize_text(str(offer.get("brand", "")))
    model = normalize_text(str(offer.get("model", "")))
    title = normalize_token(str(offer.get("title", "")))
    brand_token = normalize_token(brand)
    model_token = normalize_token(model)
    banned_tokens = {"qu", "que", "coche", "coches", "ocasion", "noticias", "news", "motor", "mercado", "ocasi", "dime"}

    if not (offer.get("portal") and offer.get("url") and isinstance(offer.get("price"), int)):
        return False
    if not brand or not model or brand_token == "unknown" or model_token == "unknown":
        return False
    if brand_token in banned_tokens or model_token in banned_tokens:
        return False
    if model_token in set(re.split(r"\s+", brand_token)):
        return False
    if len(model) < 3:
        return False
    if any(tok in title for tok in ("noticia", "actualidad", "reportaje", "guia", "comparativa")):
        return False

    return True


def is_probable_listing_page(url: str, platform: PlatformSpec, haystack: str, brand: str, model: str) -> bool:
    parsed = urlparse(url)
    path = normalize_text(parsed.path)
    query = normalize_text(parsed.query)
    lowered_haystack = normalize_token(haystack)
    brand_token = normalize_token(brand)
    model_token = normalize_token(model)
    has_brand_model = bool(brand_token and model_token and brand_token in lowered_haystack and model_token in lowered_haystack)
    has_vehicle_words = any(token in lowered_haystack for token in ("coche", "vehiculo", "segunda mano", "ocasion", "km", "diesel", "gasolina", "hibrid", "electr"))

    # Reject plain homepages to avoid generic, non-listing prices.
    is_homepage = path in {"", "/"} and not query
    if is_homepage:
        return False
    if any(token in normalize_token(path) for token in FORBIDDEN_NON_LISTING_PATH_HINTS):
        return False

    if listing_path_matches(url, platform) and (has_brand_model or has_vehicle_words):
        return True

    if has_brand_model:
        return True

    return has_vehicle_words


def extract_offer_from_page(client: httpx.Client, platform: PlatformSpec, url: str, brand: str = "", model: str = "") -> dict | None:
    try:
        response = client.get(url, timeout=8.0, follow_redirects=True)
    except Exception:
        return None

    if response.status_code >= 400:
        return None

    final_url = str(response.url)
    if not domain_matches_platform(final_url, platform):
        return None
    if not is_direct_offer_url(platform, final_url):
        return None

    content = response.text[:180000]
    soup = BeautifulSoup(content, "html.parser")
    title = normalize_text(soup.title.get_text(" ", strip=True) if soup.title else "")
    body_text = normalize_text(soup.get_text(" ", strip=True))
    haystack = f"{title} {body_text}"[:100000]
    structured = extract_structured_vehicle_data(soup)

    guessed_brand, guessed_model = parse_brand_model_from_text(title, final_url)
    url_brand, url_model = parse_brand_model_from_url(final_url)
    resolved_brand = normalize_text(structured.get("brand", "")) or guessed_brand or url_brand or normalize_text(brand)
    resolved_model = normalize_text(structured.get("model", "")) or guessed_model or url_model or normalize_text(model)

    if not resolved_brand:
        resolved_brand = "Unknown"
    if not resolved_model:
        resolved_model = "Unknown"

    # Prevent cross-brand false positives (e.g. model Golf with non-Volkswagen brands).
    if not model_matches_known_brand(resolved_model, resolved_brand):
        return None

    # Sanity check: resolved brand/model should be visible in title or URL.
    title_url_haystack = normalize_token(f"{title} {final_url}")
    brand_token = normalize_token(resolved_brand)
    model_core = normalize_token(resolved_model).split(" ")[0] if normalize_token(resolved_model) else ""
    if brand_token and brand_token not in title_url_haystack:
        return None
    if model_core and model_core not in title_url_haystack:
        return None

    resolved_version = normalize_text(structured.get("version", "")) or parse_version_from_title(title, resolved_brand, resolved_model)

    if not is_probable_listing_page(final_url, platform, haystack, resolved_brand, resolved_model):
        return None

    price_match = PRICE_RE.search(haystack)
    price = parse_price(price_match.group(1) if price_match else "")
    if not price:
        price = extract_structured_price(soup)
    if not price:
        structured_price = structured.get("price")
        price = structured_price if isinstance(structured_price, int) else None
    if not price:
        return None
    monthly_price = parse_monthly_price(haystack)

    year_match = YEAR_RE.search(haystack)
    year = int(year_match.group(1)) if year_match else structured.get("year")
    if year and (year < 2005 or year > datetime.now(timezone.utc).year + 1):
        year = None
    mileage_match = MILEAGE_RE.search(haystack)
    mileage = parse_price(mileage_match.group(1)) if mileage_match else structured.get("mileage")
    fuel = fuel_from_text(haystack) or normalize_text(structured.get("fuel", ""))
    transmission = transmission_from_text(haystack) or normalize_text(structured.get("transmission", ""))
    body_type = body_type_from_text(haystack) or normalize_text(structured.get("bodyType", ""))
    environmental_label = environmental_label_from_text(haystack)
    doors = parse_int_match(DOORS_RE.search(haystack)) or structured.get("doors")
    seats = parse_int_match(SEATS_RE.search(haystack)) or structured.get("seats")
    power_cv = parse_power_cv(haystack) or structured.get("powerCv")
    seller_type = seller_type_from_text(haystack)
    city = parse_city_from_text(haystack) or normalize_text(structured.get("city", ""))
    color = parse_color_from_text(haystack) or normalize_text(structured.get("color", ""))

    return {
        "portal": platform.key,
        "url": final_url,
        "brand": resolved_brand,
        "model": resolved_model,
        "version": resolved_version,
        "year": year,
        "mileage": mileage,
        "fuel": fuel,
        "price": price,
        "monthlyPrice": monthly_price,
        "province": "",
        "city": city,
        "color": color,
        "image": "",
        "listingType": "compra",
        "transmission": transmission,
        "bodyType": body_type,
        "environmentalLabel": environmental_label,
        "doors": doors,
        "seats": seats,
        "powerCv": power_cv,
        "sellerType": seller_type,
        "updatedAt": now_iso(),
        "listedAt": now_iso(),
        "title": title,
    }


def search_duckduckgo(client: httpx.Client, query: str) -> list[str]:
    responses = []

    try:
        response = client.post(
            DUCKDUCKGO_HTML,
            data={"q": query, "kl": "es-es"},
            timeout=10.0,
            follow_redirects=True,
        )
        responses.append(response)
    except Exception:
        pass

    try:
        response = client.get(
            DUCKDUCKGO_HTML,
            params={"q": query, "kl": "es-es"},
            timeout=10.0,
            follow_redirects=True,
        )
        responses.append(response)
    except Exception:
        pass

    if not responses:
        return []

    urls: list[str] = []
    for response in responses:
        if response.status_code >= 400:
            continue

        soup = BeautifulSoup(response.text, "html.parser")

        # Primary selector used in classic DDG html responses.
        for anchor in soup.select("a.result__a"):
            href = normalize_text(anchor.get("href", ""))
            target = extract_udgg_url(href)
            if target:
                urls.append(target)

        # Fallback: capture all links and resolve uddg redirect when present.
        if not urls:
            for anchor in soup.find_all("a", href=True):
                href = normalize_text(anchor.get("href", ""))
                if not href:
                    continue
                if "duckduckgo.com" not in href and "/l/?" not in href and "uddg=" not in href:
                    continue
                target = extract_udgg_url(href)
                if target:
                    urls.append(target)

    deduped: list[str] = []
    seen: set[str] = set()
    for item in urls:
        key = normalize_text(item).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped


def dedupe_offers(offers: Iterable[dict]) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for offer in offers:
        raw_url = normalize_text(offer.get("url", "")).lower()
        key = raw_url[:-1] if raw_url.endswith("/") else raw_url
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(offer)
    return result


def run_live_scrape(
    platforms: list[PlatformSpec],
    include_planned: bool = False,
    max_models: int = 2,
    max_links_per_query: int = 2,
    crawl_all: bool = False,
    max_pages_per_platform: int = 20,
    max_links_per_platform: int = 600,
) -> tuple[list[dict], list[dict]]:
    offers: list[dict] = []
    reports: list[dict] = []

    with httpx.Client(headers=DEFAULT_HEADERS) as client:
        for platform in platforms:
            if platform.status == "blocked":
                reports.append(
                    PlatformRunReport(
                        platform=platform.key,
                        selected=True,
                        attempted=0,
                        extracted=0,
                        valid=0,
                        errors=0,
                        status="blocked",
                        message=platform.notes,
                    ).__dict__
                )
                continue

            if platform.status == "planned" and not include_planned:
                reports.append(
                    PlatformRunReport(
                        platform=platform.key,
                        selected=True,
                        attempted=0,
                        extracted=0,
                        valid=0,
                        errors=0,
                        status="skipped",
                        message="planned source skipped (enable include_planned)",
                    ).__dict__
                )
                continue

            attempted = 0
            extracted = 0
            valid = 0
            errors = 0
            platform_offers: list[dict] = []

            if crawl_all:
                seed_urls = build_platform_listing_seed_urls(platform)
                listing_urls = discover_listing_links(
                    client,
                    platform,
                    seed_urls,
                    max_pages=max(1, max_pages_per_platform),
                    max_links=max(1, max_links_per_platform),
                )

                # Fallback to search-engine discovery when platform listing pages are JS-heavy.
                if not listing_urls:
                    fallback_urls: list[str] = []
                    fallback_seen: set[str] = set()
                    fallback_queries = build_queries_for_platform(platform)[: max(1, min(max_models, 3))]
                    for query, q_brand, q_model in fallback_queries:
                        candidates = [
                            *build_direct_candidate_urls(platform, q_brand, q_model),
                            *search_duckduckgo(client, query),
                        ]
                        for candidate in candidates:
                            key = normalize_token(candidate)
                            if not key or key in fallback_seen:
                                continue
                            if not domain_matches_platform(candidate, platform):
                                continue
                            if not is_direct_offer_url(platform, candidate):
                                continue
                            fallback_seen.add(key)
                            fallback_urls.append(candidate)

                    listing_urls = fallback_urls[: max(1, max_links_per_platform)]

                if platform.key == "autoscout24":
                    listing_urls = expand_autoscout_detail_urls(
                        client,
                        platform,
                        listing_urls,
                        max_results=max(1, max_links_per_platform),
                    )

                for listing_url in listing_urls:
                    attempted += 1
                    offer = extract_offer_from_page(client, platform, listing_url)
                    if not offer:
                        errors += 1
                        continue
                    extracted += 1
                    if quality_is_valid(offer):
                        valid += 1
                        platform_offers.append(offer)
                    else:
                        errors += 1

                platform_offers = dedupe_offers(platform_offers)
                offers.extend(platform_offers)

                status = "ok" if valid > 0 else "no-data"
                message = "valid offers extracted" if valid > 0 else "no valid offers returned"
                reports.append(
                    PlatformRunReport(
                        platform=platform.key,
                        selected=True,
                        attempted=attempted,
                        extracted=extracted,
                        valid=valid,
                        errors=errors,
                        status=status,
                        message=message,
                    ).__dict__
                )
                continue

            queries = build_queries_for_platform(platform)[: max(1, max_models)]
            for query, brand, model in queries:
                result_urls = search_duckduckgo(client, query)
                direct_urls = build_direct_candidate_urls(platform, brand, model)

                strict_urls = [
                    item
                    for item in [*direct_urls, *result_urls]
                    if domain_matches_platform(item, platform) and listing_path_matches(item, platform)
                ]

                # Fallback to domain-only matches if strict path hints produce no candidates.
                fallback_direct = [
                    item
                    for item in direct_urls
                    if domain_matches_platform(item, platform)
                ]
                fallback_search = [
                    item
                    for item in result_urls
                    if domain_matches_platform(item, platform)
                ]

                merged_urls = [*strict_urls, *fallback_direct, *fallback_search]
                filtered_urls: list[str] = []
                seen_urls: set[str] = set()
                for item in merged_urls:
                    key = normalize_token(item)
                    if not key or key in seen_urls:
                        continue
                    seen_urls.add(key)
                    filtered_urls.append(item)

                if platform.key == "autoscout24":
                    filtered_urls = expand_autoscout_detail_urls(
                        client,
                        platform,
                        filtered_urls,
                        max_results=max(1, max_links_per_query * 6),
                    )

                for listing_url in filtered_urls[: max(1, max_links_per_query)]:
                    attempted += 1
                    offer = extract_offer_from_page(client, platform, listing_url, brand, model)
                    if not offer:
                        errors += 1
                        continue
                    extracted += 1
                    if quality_is_valid(offer):
                        valid += 1
                        platform_offers.append(offer)
                    else:
                        errors += 1

            platform_offers = dedupe_offers(platform_offers)
            offers.extend(platform_offers)

            status = "ok" if valid > 0 else "no-data"
            message = "valid offers extracted" if valid > 0 else "no valid offers returned"
            reports.append(
                PlatformRunReport(
                    platform=platform.key,
                    selected=True,
                    attempted=attempted,
                    extracted=extracted,
                    valid=valid,
                    errors=errors,
                    status=status,
                    message=message,
                ).__dict__
            )

    return dedupe_offers(offers), reports
