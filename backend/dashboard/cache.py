"""
Capa de caché del dashboard.
"""

import pandas as pd
import pyarrow.parquet as pq
from cachetools import LRUCache
from pathlib import Path
from typing import Any

from .db import get_con

_ROOT = Path(__file__).parent.parent.parent
_AGG  = _ROOT / 'data' / 'processed' / 'agg'

AGG: dict[str, pd.DataFrame] = {}

_AGG_FILES = [
    'hex_density',
    'country_stats',
    'temporal',
    'taxon_tree',
    'species_list',
]

_species_cache: LRUCache = LRUCache(maxsize=5_000)


def init() -> None:
    _load_agg_tables()
    get_con()
    print("[cache] Listo.")


def get_species(taxon_id: int) -> dict[str, Any]:
    if taxon_id in _species_cache:
        return _species_cache[taxon_id]
    result = _fetch_species(taxon_id)
    _species_cache[taxon_id] = result
    return result


def cache_stats() -> dict:
    return {
        'species_cache_size':    len(_species_cache),
        'species_cache_maxsize': _species_cache.maxsize,
        'agg_tables_loaded':     list(AGG.keys()),
        'agg_total_rows':        {k: len(v) for k, v in AGG.items()},
    }


def _load_agg_tables() -> None:
    print("[cache] Cargando tablas pre-agregadas...")
    for name in _AGG_FILES:
        path = _AGG / f'{name}.parquet'
        if not path.exists():
            print(f"  [WARN] {path} no existe — ejecuta el ETL primero")
            continue
        AGG[name] = pq.read_table(path).to_pandas()
        mb = AGG[name].memory_usage(deep=True).sum() / 1e6
        print(f"  ✓  {name}: {len(AGG[name]):,} filas  ({mb:.1f} MB en RAM)")


def _fetch_species(taxon_id: int) -> dict[str, Any]:
    con = get_con()

    taxa_row = con.execute("""
        SELECT name, rank, kingdom, phylum, class, "order", family, genus
        FROM taxa_enriched WHERE taxon_id = ? LIMIT 1
    """, [taxon_id]).fetchone()

    obs_row = con.execute("""
        SELECT COUNT(*), COUNT(DISTINCT observer_id), MIN(year), MAX(year)
        FROM obs WHERE taxon_id = ?
    """, [taxon_id]).fetchone()

    photo_row = con.execute("""
        SELECT p.photo_url FROM photos p
        JOIN obs o ON p.observation_uuid = o.observation_uuid
        WHERE o.taxon_id = ? AND p.photo_url IS NOT NULL LIMIT 1
    """, [taxon_id]).fetchone()

    vernac_row = con.execute("""
        SELECT v.vernacularName, v.language FROM gbif_vernac v
        JOIN taxon_join j ON v.gbif_id = j.gbif_id
        WHERE j.taxon_id = ?
          AND v.language IN ('es', 'ES', 'spa', 'en', 'EN', 'eng')
        ORDER BY CASE WHEN v.language IN ('es','ES','spa') THEN 0 ELSE 1 END
        LIMIT 1
    """, [taxon_id]).fetchone()

    desc_row = con.execute("""
        SELECT d.description FROM gbif_desc d
        JOIN taxon_join j ON d.gbif_id = j.gbif_id
        WHERE j.taxon_id = ? LIMIT 1
    """, [taxon_id]).fetchone()

    return {
        'taxon_id':        taxon_id,
        'name':            taxa_row[0] if taxa_row else None,
        'rank':            taxa_row[1] if taxa_row else None,
        'kingdom':         taxa_row[2] if taxa_row else None,
        'phylum':          taxa_row[3] if taxa_row else None,
        'class':           taxa_row[4] if taxa_row else None,
        'order':           taxa_row[5] if taxa_row else None,
        'family':          taxa_row[6] if taxa_row else None,
        'genus':           taxa_row[7] if taxa_row else None,
        'n_obs':           obs_row[0]  if obs_row  else 0,
        'n_observers':     obs_row[1]  if obs_row  else 0,
        'first_year':      obs_row[2]  if obs_row  else None,
        'last_year':       obs_row[3]  if obs_row  else None,
        'vernacular_name': vernac_row[0] if vernac_row else None,
        'vernac_lang':     vernac_row[1] if vernac_row else None,
        'description':     desc_row[0]  if desc_row  else None,
        'photo_url':       photo_row[0] if photo_row  else None,
    }