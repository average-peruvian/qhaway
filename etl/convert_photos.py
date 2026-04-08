"""
photos.csv  →  data/processed/photos.parquet

Solo retiene la foto principal (position=0) por observación
y construye la URL directa al CDN de iNaturalist.
"""

import duckdb
from config import INAT_DIR, PROCESSED, DUCKDB_MEMORY, DUCKDB_THREADS


INAT_CDN = 'https://inaturalist-open-data.s3.amazonaws.com/photos/'


def run() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)

    src = str(INAT_DIR / 'photos.csv')
    out = str(PROCESSED / 'photos.parquet')

    con = duckdb.connect()
    con.execute(f"SET memory_limit='{DUCKDB_MEMORY}'")
    con.execute(f"SET threads={DUCKDB_THREADS}")

    con.execute(f"""
        COPY (
            SELECT
                photo_id::INTEGER          AS photo_id,
                photo_uuid::VARCHAR        AS photo_uuid,
                observation_uuid::VARCHAR  AS observation_uuid,
                observer_id::INTEGER       AS observer_id,
                extension::VARCHAR         AS extension,
                license::VARCHAR           AS license,
                width::SMALLINT            AS width,
                height::SMALLINT           AS height,
                '{INAT_CDN}' || photo_id || '/medium.' || extension AS photo_url
            FROM read_csv_auto('{src}', delim='\t', ignore_errors=true)
            WHERE position = 0
              AND extension IS NOT NULL
        )
        TO '{out}'
        (FORMAT PARQUET, COMPRESSION zstd)
    """)

    con.close()

    import os
    mb = os.path.getsize(out) / 1e6
    print(f"✓  {out}  ({mb:.1f} MB)")


if __name__ == '__main__':
    run()