"""
taxa.csv  →  data/processed/taxa_enriched.parquet

Expande la columna ancestry (slash-separated de taxon_ids) en columnas
planas: kingdom, phylum, class, order, family, genus.
"""

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from config import INAT_DIR, PROCESSED, RANK_LEVELS


def _build_lookup(taxa: pd.DataFrame) -> dict:
    """taxon_id → {rank_level, name}"""
    return (
        taxa[['taxon_id', 'rank_level', 'name']]
        .set_index('taxon_id')
        .to_dict('index')
    )


def _parse_ancestry(ancestry: str, lookup: dict) -> dict:
    """Dado un ancestry string, devuelve {kingdom: ..., phylum: ..., ...}."""
    result = {}
    if not isinstance(ancestry, str):
        return result
    for id_str in ancestry.split('/'):
        try:
            anc_id = int(id_str)
        except ValueError:
            continue
        info = lookup.get(anc_id)
        if info is None:
            continue
        rl = int(info['rank_level']) if not pd.isna(info['rank_level']) else None
        if rl in RANK_LEVELS:
            result[RANK_LEVELS[rl]] = info['name']
    return result


def run() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    out = PROCESSED / 'taxa_enriched.parquet'

    print("Leyendo taxa.csv...")
    taxa = pd.read_csv(
        INAT_DIR / 'taxa.csv',
        usecols=['taxon_id', 'ancestry', 'rank_level', 'rank', 'name', 'active'],
        dtype={'taxon_id': 'int32', 'rank_level': 'float32'},
        low_memory=False,
        sep='\t'
    )

    # Sólo taxa activos
    taxa = taxa[taxa['active'] == True].copy()
    taxa.drop(columns=['active'], inplace=True)

    print(f"  {len(taxa):,} taxa activos")

    lookup = _build_lookup(taxa)

    print("Parseando ancestry (puede tardar 1-2 min)...")
    parsed = taxa['ancestry'].map(lambda a: _parse_ancestry(a, lookup))
    hierarchy = pd.json_normalize(parsed)

    # Asegurar que existan todas las columnas aunque algún rank falte
    for col in RANK_LEVELS.values():
        if col not in hierarchy.columns:
            hierarchy[col] = pd.NA

    taxa = pd.concat([taxa.reset_index(drop=True),
                      hierarchy.reset_index(drop=True)], axis=1)

    # Reordenar columnas
    hier_cols = list(RANK_LEVELS.values())
    base_cols  = ['taxon_id', 'rank_level', 'rank', 'name', 'ancestry']
    taxa = taxa[base_cols + hier_cols]

    pq.write_table(
        pa.Table.from_pandas(taxa, preserve_index=False),
        out,
        compression='zstd',
    )
    print(f"✓  {out}  ({taxa.shape[0]:,} filas, {taxa.shape[1]} cols)")


if __name__ == '__main__':
    run()
