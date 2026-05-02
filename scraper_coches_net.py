"""
CarWise — Scraper de coches.net
================================
Extrae anuncios de coches.net usando su API interna (la misma que usa el navegador).
Anti-detección: delays aleatorios, headers realistas, rotación de user-agents,
sesión con cookies y backoff en errores.

Requisitos:
    pip install requests httpx fake-useragent tqdm python-dotenv

Uso:
    python scraper_coches_net.py                     # búsqueda por defecto
    python scraper_coches_net.py --brand bmw          # filtrar por marca
    python scraper_coches_net.py --max-pages 10       # limitar páginas
    python scraper_coches_net.py --output mi_bbdd.csv # fichero de salida
"""

import hashlib
import json
import random
import time
import argparse
import csv
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fake_useragent import UserAgent

# ─── CONFIGURACIÓN ─────────────────────────────────────────────────────────────

API_BASE_CANDIDATES = [
    "https://ms-mt--api-web.spain.advgo.net",
    "https://web.gw.coches.net",
]
SEARCH_ENDPOINT = "/search"

# Rangos de espera entre peticiones (segundos) — parecer humano
DELAY_MIN = 2.5
DELAY_MAX = 6.0
DELAY_BETWEEN_PAGES = (4.0, 10.0)  # más larga entre páginas

# Tamaño de página (máximo permitido por coches.net es 30)
PAGE_SIZE = 20

# Número máximo de reintentos por página
MAX_RETRIES = 3

# ─── HELPERS ───────────────────────────────────────────────────────────────────

ua = UserAgent()

PORTAL = "coches.net"
PORTAL_BASE_URL = "https://www.coches.net"


def make_id(url: str) -> str:
    """SHA-1 del URL, igual que la tabla de ejemplo."""
    return hashlib.sha1(url.encode()).hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.0000000")


def jitter(min_s: float = DELAY_MIN, max_s: float = DELAY_MAX) -> None:
    """Espera aleatoria para no parecer robot."""
    t = random.uniform(min_s, max_s)
    time.sleep(t)


def build_headers(referer: str = "https://www.coches.net/") -> dict:
    """Cabeceras que imitan un navegador real."""
    return {
        "User-Agent": ua.random,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": random.choice([
            "es-ES,es;q=0.9",
            "es-ES,es;q=0.9,en;q=0.8",
            "es;q=0.9,en-US;q=0.8,en;q=0.7",
        ]),
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": referer,
        "Origin": "https://www.coches.net",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "DNT": "1",
    }


# ─── CLIENTE HTTP ──────────────────────────────────────────────────────────────

def make_client() -> httpx.Client:
    """Crea una sesión httpx con cookies de coches.net."""
    client = httpx.Client(
        timeout=30,
        follow_redirects=True,
        http2=True,
    )
    # Visita previa para obtener cookies (simula abrir el navegador)
    try:
        client.get(
            "https://www.coches.net/",
            headers=build_headers(),
        )
        jitter(1.5, 3.0)
        client.get(
            "https://www.coches.net/segunda-mano/",
            headers=build_headers(),
        )
        jitter(1.0, 2.5)
    except Exception:
        pass  # Si falla, continuamos sin cookies iniciales
    return client


# ─── PARÁMETROS DE BÚSQUEDA ────────────────────────────────────────────────────

def build_params(
    page: int = 1,
    page_size: int = PAGE_SIZE,
    brand: str | None = None,
    model: str | None = None,
    fuel: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    max_km: int | None = None,
    province: str | None = None,
    listing_type: str = "segunda-mano",  # "segunda-mano" | "km0"
) -> dict:
    """Construye los query params para la API de coches.net."""
    params: dict = {
        "pagination[page]": page,
        "pagination[limit]": page_size,
        "sort[order]": "desc",
        "sort[field]": "relevance",
        "category": listing_type,
        "country": "es",
    }
    if brand:
        params["brand"] = brand.lower()
    if model:
        params["model"] = model.lower()
    if fuel:
        params["fuel"] = fuel          # "gasoline" | "diesel" | "electric" | "hybrid"
    if min_price is not None:
        params["price[from]"] = min_price
    if max_price is not None:
        params["price[to]"] = max_price
    if min_year is not None:
        params["year[from]"] = min_year
    if max_year is not None:
        params["year[to]"] = max_year
    if max_km is not None:
        params["km[to]"] = max_km
    if province:
        params["province"] = province

    return params


def build_post_payload(
    page: int = 1,
    page_size: int = PAGE_SIZE,
    brand: str | None = None,
    model: str | None = None,
    fuel: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    max_km: int | None = None,
) -> dict:
    """Construye payload JSON para endpoint POST alternativo."""
    payload: dict = {
        "pagination": {
            "page": page,
            "size": page_size,
        },
        "sort": {
            "order": "desc",
            "term": "relevance",
        },
        "filters": {
            "offerTypeIds": [10],
        },
    }

    vehicle_filters: dict = {}
    if brand:
        vehicle_filters["make"] = brand.lower()
    if model:
        vehicle_filters["model"] = model.lower()
    if fuel:
        vehicle_filters["fuelType"] = fuel.lower()
    if min_year is not None:
        vehicle_filters["fromYear"] = int(min_year)
    if max_year is not None:
        vehicle_filters["toYear"] = int(max_year)
    if max_km is not None:
        vehicle_filters["toKms"] = int(max_km)

    price_filters: dict = {}
    if min_price is not None:
        price_filters["from"] = int(min_price)
    if max_price is not None:
        price_filters["to"] = int(max_price)

    if vehicle_filters:
        payload["filters"]["vehicle"] = vehicle_filters
    if price_filters:
        payload["filters"]["price"] = price_filters

    return payload


# ─── NORMALIZACIÓN DE CAMPOS ───────────────────────────────────────────────────

FUEL_MAP = {
    "gasoline": "Gasolina",
    "diesel": "Diésel",
    "electric": "Eléctrico",
    "hybrid": "Híbrido",
    "plug_in_hybrid": "PHEV",
    "lpg": "GLP",
    "cng": "GNC",
    "hydrogen": "Hidrógeno",
}

TRANSMISSION_MAP = {
    "manual": "Manual",
    "automatic": "Automático",
}

BODY_MAP = {
    "sedan": "Berlina",
    "suv": "SUV",
    "coupe": "Coupé",
    "convertible": "Descapotable",
    "minivan": "Monovolumen",
    "combi": "Familiar",
    "pickup": "Pick-up",
    "van": "Furgoneta",
    "minibus": "Microbús",
}

SELLER_MAP = {
    "professional": "profesional",
    "private": "particular",
    "dealer": "profesional",
}

LABEL_MAP = {
    "zero": "0",
    "eco": "ECO",
    "c": "C",
    "b": "B",
    None: "",
}


def normalize(raw: dict) -> dict:
    """
    Transforma un anuncio raw de la API de coches.net
    en la estructura de la base de datos de CarWise.
    """
    url = raw.get("url", "") or ""
    if url and not url.startswith("http"):
        url = PORTAL_BASE_URL + url

    ts_now = now_iso()
    listed_at = raw.get("publishedAt") or raw.get("publishAt") or ts_now
    updated_at = raw.get("updatedAt") or ts_now

    price_raw = raw.get("price") or {}
    price = price_raw.get("amount") if isinstance(price_raw, dict) else (raw.get("price") or 0)
    monthly = price_raw.get("monthlyFee") if isinstance(price_raw, dict) else 0

    vehicle = raw.get("vehicle") or raw
    seller  = raw.get("seller") or {}
    images  = raw.get("images") or raw.get("photos") or []
    image_url = images[0].get("url", "") if images and isinstance(images[0], dict) else (images[0] if images else "")

    fuel_key = (vehicle.get("fuel") or "").lower()
    trans_key = (vehicle.get("transmission") or "").lower()
    body_key  = (vehicle.get("body") or vehicle.get("bodyType") or "").lower()
    seller_key = (seller.get("type") or raw.get("sellerType") or "").lower()
    label_key  = (vehicle.get("environmentalLabel") or "").lower() or None

    brand  = vehicle.get("brand") or vehicle.get("make") or ""
    model  = vehicle.get("model") or ""
    version = vehicle.get("version") or vehicle.get("trim") or ""
    year   = vehicle.get("year") or 0
    km     = vehicle.get("km") or vehicle.get("mileage") or 0
    province = (raw.get("location") or {}).get("province") or raw.get("province") or ""
    city     = (raw.get("location") or {}).get("city") or raw.get("city") or ""
    color    = vehicle.get("color") or ""
    doors    = vehicle.get("doors") or 0
    seats    = vehicle.get("seats") or 0
    power    = vehicle.get("power") or vehicle.get("powerCv") or 0
    dealer   = seller.get("name") or raw.get("dealerName") or ""
    warranty = raw.get("warrantyMonths") or 0
    title    = raw.get("title") or f"{brand} {model} {version}".strip()
    listing_type = raw.get("category") or raw.get("listingType") or "compra"

    row = {
        "Id":                 make_id(url),
        "Url":                url,
        "Portal":             PORTAL,
        "Brand":              brand.title(),
        "Model":              model,
        "Version":            version,
        "Fuel":               FUEL_MAP.get(fuel_key, fuel_key.title()),
        "ListingType":        listing_type,
        "Price":              f"{float(price or 0):.2f}",
        "MonthlyPrice":       f"{float(monthly or 0):.2f}",
        "Year":               year,
        "Mileage":            km,
        "Province":           province,
        "City":               city,
        "ImageUrl":           image_url,
        "Title":              title,
        "ListedAt":           listed_at,
        "SourceUpdatedAt":    updated_at,
        "FirstSeenAt":        ts_now,
        "LastSeenAt":         ts_now,
        "RawPayload":         json.dumps(raw, ensure_ascii=False),
        "Transmission":       TRANSMISSION_MAP.get(trans_key, trans_key.title()),
        "BodyType":           BODY_MAP.get(body_key, body_key.title()),
        "EnvironmentalLabel": LABEL_MAP.get(label_key, label_key or ""),
        "Doors":              doors,
        "Seats":              seats or 0,
        "PowerCv":            power,
        "Color":              color,
        "SellerType":         SELLER_MAP.get(seller_key, seller_key),
        "DealerName":         dealer,
        "WarrantyMonths":     warranty,
    }
    return row


# ─── LÓGICA DE SCRAPING ────────────────────────────────────────────────────────

def fetch_page(
    client: httpx.Client,
    params: dict,
    api_base: str,
    attempt: int = 1,
) -> dict | None:
    """Solicita una página a la API con retry + backoff."""
    headers = build_headers(referer="https://www.coches.net/segunda-mano/")
    try:
        r = client.get(
            api_base + SEARCH_ENDPOINT,
            params=params,
            headers=headers,
        )
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            wait = 30 * attempt
            print(f"  ⚠ Rate limit (429). Esperando {wait}s antes de reintentar…")
            time.sleep(wait)
            if attempt < MAX_RETRIES:
                return fetch_page(client, params, attempt + 1)
        elif e.response.status_code in (403, 401):
            print(f"  ✗ Bloqueado ({e.response.status_code}). Rotando sesión…")
            time.sleep(15)
            return None
        elif e.response.status_code in (500, 502, 503, 504):
            backoff = 10 * attempt
            print(f"  ⚠ HTTP {e.response.status_code}. Reintentando en {backoff}s…")
            time.sleep(backoff)
            if attempt < MAX_RETRIES:
                return fetch_page(client, params, api_base, attempt + 1)
        else:
            print(f"  ✗ HTTP {e.response.status_code}: {e}")
        return None


def fetch_page_post(
    client: httpx.Client,
    api_base: str,
    payload: dict,
    attempt: int = 1,
) -> dict | None:
    """Solicita una página por POST (endpoint alternativo web.gw.coches.net)."""
    headers = build_headers(referer="https://www.coches.net/segunda-mano/")
    headers["Content-Type"] = "application/json"
    try:
        r = client.post(
            api_base + SEARCH_ENDPOINT,
            json=payload,
            headers=headers,
        )
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (429, 500, 502, 503, 504):
            backoff = 10 * attempt
            print(f"  ⚠ POST HTTP {e.response.status_code}. Reintentando en {backoff}s…")
            time.sleep(backoff)
            if attempt < MAX_RETRIES:
                return fetch_page_post(client, api_base, payload, attempt + 1)
        else:
            print(f"  ✗ POST HTTP {e.response.status_code}: {e}")
        return None
    except (httpx.RequestError, json.JSONDecodeError) as e:
        backoff = 5 * attempt
        print(f"  ✗ Error POST red/parse: {e}. Reintentando en {backoff}s…")
        time.sleep(backoff)
        if attempt < MAX_RETRIES:
            return fetch_page_post(client, api_base, payload, attempt + 1)
        return None
    except (httpx.RequestError, json.JSONDecodeError) as e:
        backoff = 5 * attempt
        print(f"  ✗ Error de red/parse: {e}. Reintentando en {backoff}s…")
        time.sleep(backoff)
        if attempt < MAX_RETRIES:
            return fetch_page(client, params, api_base, attempt + 1)
        return None


def scrape(
    brand: str | None = None,
    model: str | None = None,
    fuel: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    max_km: int | None = None,
    province: str | None = None,
    max_pages: int = 50,
    output_path: str = "coches_net.csv",
    listing_type: str = "segunda-mano",
) -> list[dict]:

    print(f"\n🚗  CarWise Scraper — coches.net")
    print(f"    Filtros: marca={brand} modelo={model} precio=[{min_price}-{max_price}] "
          f"año=[{min_year}-{max_year}] km≤{max_km}")
    print(f"    Salida: {output_path}\n")

    client = make_client()
    all_rows: list[dict] = []
    seen_ids: set[str] = set()

    # Cabeceras CSV (orden exacto de la base de datos)
    FIELDNAMES = [
        "Id","Url","Portal","Brand","Model","Version","Fuel","ListingType",
        "Price","MonthlyPrice","Year","Mileage","Province","City","ImageUrl",
        "Title","ListedAt","SourceUpdatedAt","FirstSeenAt","LastSeenAt",
        "RawPayload","Transmission","BodyType","EnvironmentalLabel","Doors",
        "Seats","PowerCv","Color","SellerType","DealerName","WarrantyMonths",
    ]

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    write_header = not out.exists()
    csv_file = open(out, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
    if write_header:
        writer.writeheader()

    try:
        for page in range(1, max_pages + 1):
            params = build_params(
                page=page,
                brand=brand,
                model=model,
                fuel=fuel,
                min_price=min_price,
                max_price=max_price,
                min_year=min_year,
                max_year=max_year,
                max_km=max_km,
                province=province,
                listing_type=listing_type,
            )
            payload = build_post_payload(
                page=page,
                page_size=PAGE_SIZE,
                brand=brand,
                model=model,
                fuel=fuel,
                min_price=min_price,
                max_price=max_price,
                min_year=min_year,
                max_year=max_year,
                max_km=max_km,
            )

            print(f"  📄 Página {page}/{max_pages}…", end=" ", flush=True)
            data = None
            for api_base in API_BASE_CANDIDATES:
                data = fetch_page(client, params, api_base)
                if data is None and "web.gw.coches.net" in api_base:
                    data = fetch_page_post(client, api_base, payload)
                if data is not None:
                    break

            if data is None:
                print("sin datos — deteniendo.")
                break

            # La API puede devolver los items bajo distintas keys
            items = (
                data.get("items")
                or data.get("data")
                or data.get("results")
                or data.get("ads")
                or []
            )
            total = (
                data.get("total")
                or (data.get("pagination") or {}).get("total")
                or len(items)
            )

            if not items:
                print(f"sin resultados (total declarado: {total}) — fin.")
                break

            new_this_page = 0
            for raw in items:
                row = normalize(raw)
                rid = row["Id"]
                if rid not in seen_ids:
                    seen_ids.add(rid)
                    all_rows.append(row)
                    writer.writerow(row)
                    new_this_page += 1

            csv_file.flush()
            print(f"{new_this_page} nuevos | total acumulado: {len(all_rows)} / {total}")

            # ¿Hemos llegado al final?
            total_pages = (
                (data.get("pagination") or {}).get("totalPages")
                or max(1, ((int(total) + PAGE_SIZE - 1) // PAGE_SIZE))
            )
            if page >= total_pages:
                print(f"\n  ✅ Scraping completo. {len(all_rows)} anuncios exportados a {output_path}")
                break

            # Pausa entre páginas (más larga para no levantar sospechas)
            wait = random.uniform(*DELAY_BETWEEN_PAGES)
            # Cada 5 páginas, pausa extra (simula que el usuario lee)
            if page % 5 == 0:
                wait += random.uniform(5, 15)
                print(f"  ⏸  Pausa larga ({wait:.1f}s)…")
            time.sleep(wait)

    finally:
        csv_file.close()
        client.close()

    return all_rows


# ─── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CarWise scraper — coches.net")
    parser.add_argument("--brand",      help="Marca (ej: volkswagen, bmw)")
    parser.add_argument("--model",      help="Modelo (ej: golf, serie-3)")
    parser.add_argument("--fuel",       help="Combustible: gasoline|diesel|electric|hybrid")
    parser.add_argument("--min-price",  type=int, help="Precio mínimo €")
    parser.add_argument("--max-price",  type=int, help="Precio máximo €")
    parser.add_argument("--min-year",   type=int, help="Año mínimo")
    parser.add_argument("--max-year",   type=int, help="Año máximo")
    parser.add_argument("--max-km",     type=int, help="Kilómetros máximos")
    parser.add_argument("--province",   help="Provincia (ej: madrid, barcelona)")
    parser.add_argument("--listing-type", default="segunda-mano", help="Tipo de anuncio: segunda-mano|km0")
    parser.add_argument("--max-pages",  type=int, default=50, help="Páginas máximas a raspar")
    parser.add_argument("--output",     default="coches_net.csv", help="Fichero CSV de salida")
    args = parser.parse_args()

    scrape(
        brand=args.brand,
        model=args.model,
        fuel=args.fuel,
        min_price=args.min_price,
        max_price=args.max_price,
        min_year=args.min_year,
        max_year=args.max_year,
        max_km=args.max_km,
        province=args.province,
        listing_type=args.listing_type,
        max_pages=args.max_pages,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
