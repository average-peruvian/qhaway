"""
Orquestador del ETL completo.

Uso:
    cd etl/
    python run_all.py              # pipeline completo
    python run_all.py --step obs   # solo un paso
    python run_all.py --step taxa
    python run_all.py --step gbif
    python run_all.py --step agg

Orden de dependencias:
    obs  →  (independiente)
    taxa →  (independiente)
    gbif →  requiere taxa (para taxon_join)
    agg  →  requiere obs + taxa
"""

import argparse
import time

import convert_obs
import enrich_taxa
import process_gbif
import preaggregate
import convert_photos

STEPS = {
    'obs':  ('observations.csv → obs.parquet',          convert_obs.run),
    'taxa': ('taxa.csv → taxa_enriched.parquet',         enrich_taxa.run),
    'photos': ('photos.csv → photos.parquet', convert_photos.run),
    'gbif': ('GBIF TSVs → gbif_*.parquet + taxon_join', process_gbif.run),
    'agg':  ('obs + taxa → 5 tablas pre-agregadas',      preaggregate.run),
}

# Orden correcto para el pipeline completo
PIPELINE_ORDER = ['obs', 'taxa', 'photos', 'gbif', 'agg']


def run_step(key: str) -> None:
    label, fn = STEPS[key]
    print(f"\n{'='*60}")
    print(f"  [{key.upper()}]  {label}")
    print(f"{'='*60}")
    t0 = time.time()
    fn()
    elapsed = time.time() - t0
    print(f"  → completado en {elapsed/60:.1f} min\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--step', choices=list(STEPS.keys()),
                        help='Ejecutar solo un paso del pipeline')
    args = parser.parse_args()

    if args.step:
        run_step(args.step)
    else:
        print("Iniciando pipeline completo...")
        t0 = time.time()
        for key in PIPELINE_ORDER:
            run_step(key)
        total = time.time() - t0
        print(f"\n✓  Pipeline completo en {total/60:.1f} min")


if __name__ == '__main__':
    main()
