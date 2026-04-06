# biodiversity-dashboard

Dashboard de exploración global de datos iNaturalist + GBIF.

## Estructura

```
data/
  raw/
    inaturalist/        ← observations.csv, taxa.csv, photos.csv, observers.csv
    gbif/               ← Taxon.tsv, Distribution.tsv, VernacularName.tsv, ...
  processed/            ← Parquets generados por el ETL (no al repo)
    agg/                ← 5 tablas pre-agregadas para el dashboard

etl/
  config.py             ← paths, constantes, filtros
  convert_obs.py        ← observations.csv → obs.parquet + H3
  enrich_taxa.py        ← taxa.csv → taxa_enriched.parquet
  process_gbif.py       ← GBIF TSVs → gbif_*.parquet + taxon_join
  preaggregate.py       ← 5 queries de agregación vía DuckDB
  run_all.py            ← orquestador

dashboard/              ← (próximo paso)
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## ETL

Coloca los archivos en `data/raw/` según la estructura de arriba, luego:

```bash
cd etl/

# Pipeline completo (puede tardar 30-90 min según hardware)
python run_all.py

# O paso a paso
python run_all.py --step obs    # lo más lento (~50 GB CSV)
python run_all.py --step taxa   # rápido (~1-2 min)
python run_all.py --step gbif   # rápido (~2-5 min)
python run_all.py --step agg    # medio (~5-15 min, DuckDB JOIN en streaming)
```

## Capas de datos en runtime

| capa | tamaño | cómo se accede |
|---|---|---|
| `obs.parquet` | ~3-8 GB | DuckDB streaming (nunca en RAM completo) |
| `taxa_enriched.parquet` | ~50 MB | DuckDB VIEW |
| `gbif_*.parquet` | ~100-500 MB total | pandas en RAM |
| `agg/*.parquet` | ~30-50 MB total | pandas en RAM al startup |
| fotos | 0 | URLs construidas on-demand desde iNat CDN |
