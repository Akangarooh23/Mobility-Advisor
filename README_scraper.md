# CarWise Scraper — coches.net

## Instalación

```bash
pip install httpx[http2] fake-useragent tqdm
```

## Uso básico

```bash
# Todos los coches (máx. 50 páginas)
python scraper_coches_net.py

# Filtrar por marca
python scraper_coches_net.py --brand volkswagen --output out/vw.csv

# Rango de precio + año + km
python scraper_coches_net.py --min-price 8000 --max-price 20000 \
  --min-year 2018 --max-km 100000 --output out/usados.csv

# Solo eléctricos en Madrid
python scraper_coches_net.py --fuel electric --province madrid --output out/ev_mad.csv

# Limitar páginas (útil para pruebas)
python scraper_coches_net.py --brand bmw --max-pages 3 --output out/test.csv
```

## Multi-segmento (poblar toda la BBDD)

Edita los `SEGMENTS` en `run_scraper.py` y lanza:

```bash
python run_scraper.py               # todos los segmentos
python run_scraper.py --segment 2   # solo el segmento 2
python run_scraper.py --delay 60    # 60s entre segmentos
```

## Columnas de salida (CSV)

| Columna | Descripción |
|---|---|
| `Id` | SHA-1 de la URL (clave única) |
| `Url` | URL del anuncio |
| `Portal` | `coches.net` |
| `Brand` | Marca |
| `Model` | Modelo |
| `Version` | Versión / acabado |
| `Fuel` | Combustible normalizado |
| `ListingType` | `compra` |
| `Price` | Precio €  |
| `MonthlyPrice` | Cuota mensual € |
| `Year` | Año de matriculación |
| `Mileage` | Kilómetros |
| `Province` | Provincia |
| `City` | Ciudad |
| `ImageUrl` | URL primera foto |
| `Title` | Título del anuncio |
| `ListedAt` | Fecha de publicación |
| `SourceUpdatedAt` | Última actualización en el portal |
| `FirstSeenAt` | Primera vez que lo ve el scraper |
| `LastSeenAt` | Última vez que lo ve el scraper |
| `RawPayload` | JSON raw completo de la API |
| `Transmission` | `Manual` / `Automático` |
| `BodyType` | Berlina, SUV, Coupé… |
| `EnvironmentalLabel` | 0 / ECO / C / B |
| `Doors` | Puertas |
| `Seats` | Plazas |
| `PowerCv` | Potencia CV |
| `Color` | Color |
| `SellerType` | `profesional` / `particular` |
| `DealerName` | Nombre del concesionario |
| `WarrantyMonths` | Garantía en meses |

## Medidas anti-bot incluidas

- Delay aleatorio entre peticiones (2.5–6s) y entre páginas (4–10s)
- Pausa larga cada 5 páginas (simula lectura humana)
- Rotación de User-Agent por petición (`fake-useragent`)
- Visita previa a la home para obtener cookies reales
- Headers idénticos a los del navegador Chrome
- Retry con backoff exponencial en errores 429/503
- Rotación de idioma de `Accept-Language`

## Notas legales

Úsalo solo para datos propios de mercado con fines de análisis.
Respeta el `robots.txt` del portal y sus términos de servicio.
Limita la frecuencia para no sobrecargar los servidores.
