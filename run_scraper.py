"""
CarWise — Runner multi-portal / multi-búsqueda
================================================
Lanza el scraper de coches.net con múltiples combinaciones de filtros,
útil para poblar la base de datos con distintos segmentos de mercado.

Uso:
    python run_scraper.py              # ejecuta todos los segmentos definidos
    python run_scraper.py --segment 0  # solo el segmento 0
"""

import argparse
import subprocess
import sys
import time
import random
from datetime import datetime

# ─── SEGMENTOS DE BÚSQUEDA ─────────────────────────────────────────────────────
# Define aquí los bloques de búsqueda que quieres lanzar.
# Cada dict se traduce en una llamada al scraper con esos filtros.

SEGMENTS = [
    # --- Coches generalistas económicos ---
    {"max_price": 15000, "max_km": 120000, "min_year": 2016, "output": "out/economicos.csv"},

    # --- Eléctricos e híbridos ---
    {"fuel": "electric", "max_pages": 30, "output": "out/electricos.csv"},
    {"fuel": "hybrid",   "max_pages": 30, "output": "out/hibridos.csv"},
    {"fuel": "plug_in_hybrid", "max_pages": 20, "output": "out/phev.csv"},

    # --- Por marcas populares ---
    {"brand": "volkswagen", "max_pages": 40, "output": "out/vw.csv"},
    {"brand": "seat",       "max_pages": 40, "output": "out/seat.csv"},
    {"brand": "toyota",     "max_pages": 40, "output": "out/toyota.csv"},
    {"brand": "bmw",        "max_pages": 30, "output": "out/bmw.csv"},
    {"brand": "mercedes",   "max_pages": 30, "output": "out/mercedes.csv"},
    {"brand": "renault",    "max_pages": 40, "output": "out/renault.csv"},

    # --- Por provincias ---
    {"province": "madrid",    "max_pages": 50, "output": "out/madrid.csv"},
    {"province": "barcelona", "max_pages": 50, "output": "out/barcelona.csv"},
    {"province": "valencia",  "max_pages": 30, "output": "out/valencia.csv"},
    {"province": "sevilla",   "max_pages": 20, "output": "out/sevilla.csv"},

    # --- Rango premium ---
    {"min_price": 30000, "max_price": 80000, "min_year": 2020, "output": "out/premium.csv"},
]


def run_segment(idx: int, seg: dict) -> int:
    """Ejecuta un segmento del scraper como subproceso."""
    import os
    os.makedirs("out", exist_ok=True)

    cmd = [sys.executable, "scraper_coches_net.py"]
    for key, val in seg.items():
        if val is not None:
            flag = "--" + key.replace("_", "-")
            cmd += [flag, str(val)]

    print(f"\n{'═'*60}")
    print(f"  Segmento {idx}: {seg}")
    print(f"  Comando: {' '.join(cmd)}")
    print(f"{'═'*60}")

    result = subprocess.run(cmd)
    return result.returncode


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--segment", type=int, default=None,
                        help="Índice del segmento a ejecutar (0-based). Sin valor = todos.")
    parser.add_argument("--delay",   type=float, default=30.0,
                        help="Pausa entre segmentos en segundos (default: 30)")
    args = parser.parse_args()

    if args.segment is not None and (args.segment < 0 or args.segment >= len(SEGMENTS)):
        print(f"\n❌ Segmento inválido: {args.segment}. Rango permitido: 0..{len(SEGMENTS)-1}\n")
        sys.exit(2)

    segments = SEGMENTS if args.segment is None else [SEGMENTS[args.segment]]
    start_idx = 0 if args.segment is None else args.segment

    print(f"\n🚗  CarWise Multi-runner — {len(segments)} segmento(s)")
    print(f"    Inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    errors = []
    for local_idx, seg in enumerate(segments):
        i = start_idx + local_idx
        rc = run_segment(i, seg)
        if rc != 0:
            errors.append(i)

        if local_idx < len(segments) - 1:
            # Pausa entre segmentos con jitter
            wait = args.delay + random.uniform(0, args.delay * 0.5)
            print(f"\n  ⏸  Pausa entre segmentos: {wait:.0f}s…")
            time.sleep(wait)

    print(f"\n{'═'*60}")
    print(f"  Fin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if errors:
        print(f"  ⚠ Segmentos con error: {errors}")
    else:
        print(f"  ✅ Todos los segmentos completados.")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
