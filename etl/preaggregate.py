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
from config import PROCESSED, AGG, INAT_DIR, DUCKDB_MEMORY, DUCKDB_THREADS

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
            t.phylum,
            o.quality_grade,
            o.year,
            COUNT(*)                      AS n_obs,
            COUNT(DISTINCT o.taxon_id)    AS n_species,
            COUNT(DISTINCT o.observer_id) AS n_observers
        {BASE_QUERY}
        WHERE o.h3_r3 IS NOT NULL
        GROUP BY 1, 2, 3, 4, 5, 6
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
            t.phylum,
            o.quality_grade,
            COUNT(*)                   AS n_obs,
            COUNT(DISTINCT o.taxon_id) AS n_species
        {BASE_QUERY}
        WHERE o.year IS NOT NULL AND o.month IS NOT NULL
        GROUP BY 1, 2, 3, 4, 5
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
            s.*,
            ph.photo_url,
            ph.photo_license,
            ph.photo_attribution,
            vn.vernacular_name
        FROM (
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
        ) s
        LEFT JOIN (
            SELECT
                o2.taxon_id,
                FIRST(p.photo_url)  AS photo_url,
                FIRST(p.license)    AS photo_license,
                FIRST(ob.login)     AS photo_attribution
            FROM obs o2
            JOIN photos p ON p.observation_uuid = o2.observation_uuid
            LEFT JOIN observers ob ON ob.observer_id = o2.observer_id
            WHERE p.photo_url IS NOT NULL
            GROUP BY o2.taxon_id
        ) ph ON s.taxon_id = ph.taxon_id
        LEFT JOIN (
            SELECT j.taxon_id, FIRST(v.vernacularName) AS vernacular_name
            FROM taxon_join j
            JOIN gbif_vernac v ON v.gbif_id = j.gbif_id
            WHERE v.language IN ('es','ES','spa','en','EN','eng')
            GROUP BY j.taxon_id
        ) vn ON s.taxon_id = vn.taxon_id
    """,
}


def run(tables=None) -> None:
    """tables: lista de nombres a generar, o None para todas."""
    AGG.mkdir(parents=True, exist_ok=True)

    obs_path    = str(PROCESSED / 'obs.parquet')
    taxa_path   = str(PROCESSED / 'taxa_enriched.parquet')
    photos_path = str(PROCESSED / 'photos.parquet')
    join_path   = str(PROCESSED / 'taxon_join.parquet')
    vernac_path = str(PROCESSED / 'gbif_vernacular.parquet')
    obs_csv     = str(INAT_DIR / 'observers.csv')
    out_dir     = str(AGG)

    con = duckdb.connect()
    con.execute(f"SET memory_limit='{DUCKDB_MEMORY}'")
    con.execute(f"SET threads={DUCKDB_THREADS}")
    con.execute("SET preserve_insertion_order=false")

    con.execute(f"CREATE VIEW obs           AS SELECT * FROM read_parquet('{obs_path}')")
    con.execute(f"CREATE VIEW taxa_enriched AS SELECT * FROM read_parquet('{taxa_path}')")
    con.execute(f"CREATE VIEW photos        AS SELECT * FROM read_parquet('{photos_path}')")
    con.execute(f"CREATE VIEW taxon_join    AS SELECT * FROM read_parquet('{join_path}')")
    con.execute(f"CREATE VIEW gbif_vernac   AS SELECT * FROM read_parquet('{vernac_path}')")
    con.execute(f"CREATE VIEW observers     AS SELECT * FROM read_csv_auto('{obs_csv}', delim='\\t', ignore_errors=true)")

    to_build = {k: v for k, v in AGGREGATIONS.items() if tables is None or k in tables}

    for name, sql in to_build.items():
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
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--tables', nargs='+', choices=list(AGGREGATIONS.keys()),
                        help='Tablas específicas a generar (default: todas)')
    args = parser.parse_args()
    run(tables=args.tables)