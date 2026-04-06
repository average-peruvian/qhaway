"""
Genera las 5 tablas pre-agregadas que el dashboard carga al startup.

Salida en data/processed/agg/:
  hex_density.parquet
  country_stats.parquet
  temporal.parquet
  taxon_tree.parquet
  species_list.parquet
"""

import os
import duckdb
from config import PROCESSED, AGG, DUCKDB_MEMORY, DUCKDB_THREADS

BASE_QUERY = """
    FROM obs o
    JOIN taxa_enriched t ON o.taxon_id = t.taxon_id
"""

AGGREGATIONS = {

    'hex_density': f"""
        SELECT
            o.h3_r3,
            o.h3_r5,
            t.kingdom,
            o.quality_grade,
            o.year,
            COUNT(*)                      AS n_obs,
            COUNT(DISTINCT o.taxon_id)    AS n_species,
            COUNT(DISTINCT o.observer_id) AS n_observers
        {BASE_QUERY}
        WHERE o.h3_r3 IS NOT NULL
        GROUP BY 1, 2, 3, 4, 5
    """,

    'country_stats': f"""
        SELECT
            o.h3_r3,
            t.kingdom,
            t.phylum,
            o.quality_grade,
            o.year,
            COUNT(*)                      AS n_obs,
            COUNT(DISTINCT o.taxon_id)    AS n_species,
            COUNT(DISTINCT o.observer_id) AS n_observers
        {BASE_QUERY}
        WHERE o.h3_r3 IS NOT NULL
        GROUP BY 1, 2, 3, 4, 5
    """,

    'temporal': f"""
        SELECT
            o.year,
            o.month,
            t.kingdom,
            o.quality_grade,
            COUNT(*)                   AS n_obs,
            COUNT(DISTINCT o.taxon_id) AS n_species
        {BASE_QUERY}
        WHERE o.year IS NOT NULL AND o.month IS NOT NULL
        GROUP BY 1, 2, 3, 4
    """,

    'taxon_tree': f"""
        SELECT
            t.kingdom,
            t.phylum,
            t.class,
            t.order,
            t.family,
            t.genus,
            o.quality_grade,
            COUNT(DISTINCT o.taxon_id) AS n_species,
            COUNT(*)                   AS n_obs
        {BASE_QUERY}
        GROUP BY 1, 2, 3, 4, 5, 6, 7
    """,

    'species_list': f"""
        SELECT
            o.taxon_id,
            t.name,
            t.rank,
            t.kingdom,
            t.phylum,
            t.class,
            t.order,
            t.family,
            t.genus,
            o.quality_grade,
            COUNT(*)                      AS n_obs,
            COUNT(DISTINCT o.observer_id) AS n_observers,
            MIN(o.year)                   AS first_year,
            MAX(o.year)                   AS last_year,
            COUNT(DISTINCT o.h3_r3)       AS n_cells
        {BASE_QUERY}
        WHERE t.rank = 'species'
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    """,
}


def run() -> None:
    AGG.mkdir(parents=True, exist_ok=True)

    obs_path  = str(PROCESSED / 'obs.parquet')
    taxa_path = str(PROCESSED / 'taxa_enriched.parquet')
    out_dir   = str(AGG)

    con = duckdb.connect()
    con.execute(f"SET memory_limit='{DUCKDB_MEMORY}'")
    con.execute(f"SET threads={DUCKDB_THREADS}")
    con.execute("SET preserve_insertion_order=false")

    con.execute(f"CREATE VIEW obs           AS SELECT * FROM read_parquet('{obs_path}')")
    con.execute(f"CREATE VIEW taxa_enriched AS SELECT * FROM read_parquet('{taxa_path}')")

    for name, sql in AGGREGATIONS.items():
        out = f"{out_dir}/{name}.parquet"
        print(f"  Agregando {name}...")
        con.execute(f"""
            COPY ({sql})
            TO '{out}'
            (FORMAT PARQUET, COMPRESSION zstd)
        """)
        mb = os.path.getsize(out) / 1e6
        print(f"  ✓  {out}  ({mb:.1f} MB)")

    con.close()


if __name__ == '__main__':
    run()