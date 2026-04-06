"""
observations.csv  →  data/processed/obs.parquet

Dos pasos:
  1. DuckDB: filtra, castea tipos, escribe Parquet intermedio (sin H3).
  2. pyarrow + h3: añade h3_r3 y h3_r5 en batches vectorizados.
"""

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import duckdb
from tqdm import tqdm

from config import (
    INAT_DIR, PROCESSED,
    DUCKDB_MEMORY, DUCKDB_THREADS,
    QUALITY_GRADE, MAX_POSITIONAL_ACCURACY,
    H3_GLOBAL, H3_REGIONAL, H3_BATCH_SIZE,
)

try:
    import h3
    _h3_r3 = np.vectorize(lambda lat, lon: h3.latlng_to_cell(lat, lon, H3_GLOBAL))
    _h3_r5 = np.vectorize(lambda lat, lon: h3.latlng_to_cell(lat, lon, H3_REGIONAL))
except ImportError:
    raise SystemExit("pip install h3>=4.0.0")

# Schema fijo — evita mismatch entre batches cuando hay NULLs en year/month
# (DuckDB emite SMALLINT/TINYINT pero pandas los convierte a float si hay NULLs
#  en el primer batch, y a int en batches posteriores sin NULLs)
SCHEMA = pa.schema([
    pa.field("observation_uuid",    pa.large_utf8()),
    pa.field("observer_id",         pa.int32()),
    pa.field("latitude",            pa.float64()),
    pa.field("longitude",           pa.float64()),
    pa.field("positional_accuracy", pa.int32()),
    pa.field("taxon_id",            pa.int32()),
    pa.field("quality_grade",       pa.large_utf8()),
    pa.field("year",                pa.int16()),
    pa.field("month",               pa.int8()),
    pa.field("anomaly_score",       pa.float32()),
    pa.field("h3_r3",               pa.large_utf8()),
    pa.field("h3_r5",               pa.large_utf8()),
])


def _step1_csv_to_parquet(src: str, tmp: str) -> None:
    """DuckDB lee el CSV y escribe un Parquet limpio sin columna H3."""
    con = duckdb.connect()
    con.execute(f"SET memory_limit='{DUCKDB_MEMORY}'")
    con.execute(f"SET threads={DUCKDB_THREADS}")

    con.execute(f"""
        COPY (
            SELECT
                observation_uuid::VARCHAR                           AS observation_uuid,
                observer_id::INTEGER                               AS observer_id,
                latitude::DOUBLE                                   AS latitude,
                longitude::DOUBLE                                  AS longitude,
                positional_accuracy::INTEGER                       AS positional_accuracy,
                taxon_id::INTEGER                                  AS taxon_id,
                quality_grade::VARCHAR                             AS quality_grade,
                YEAR(TRY_CAST(observed_on AS DATE))::SMALLINT      AS year,
                MONTH(TRY_CAST(observed_on AS DATE))::TINYINT      AS month,
                anomaly_score::FLOAT                               AS anomaly_score
            FROM read_csv_auto('{src}', ignore_errors=true, parallel=true)
            WHERE latitude  IS NOT NULL
              AND longitude IS NOT NULL
              AND TRY_CAST(positional_accuracy AS INTEGER) < {MAX_POSITIONAL_ACCURACY}
        )
        TO '{tmp}'
        (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE 200000)
    """)
    con.close()


def _step2_add_h3(tmp: str, out: str) -> None:
    """Añade h3_r3 y h3_r5 leyendo el Parquet en batches con schema fijo."""
    pf     = pq.ParquetFile(tmp)
    writer = pq.ParquetWriter(out, SCHEMA, compression='zstd')

    for batch in tqdm(pf.iter_batches(batch_size=H3_BATCH_SIZE),
                      desc="H3 batches", unit="batch"):
        df = batch.to_pandas()

        lat = df['latitude'].values
        lon = df['longitude'].values

        df['h3_r3'] = _h3_r3(lat, lon)
        df['h3_r5'] = _h3_r5(lat, lon)

        # Castear year/month explícitamente antes de convertir a Arrow
        # (evita que NULLs los promuevan a float64 en pandas)
        df['year']  = df['year'].astype('Int16')
        df['month'] = df['month'].astype('Int8')

        table = pa.Table.from_pandas(df, schema=SCHEMA, preserve_index=False)
        writer.write_table(table)

    writer.close()


def run() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)

    src = str(INAT_DIR / 'observations.csv')
    tmp = str(PROCESSED / 'obs_tmp.parquet')
    out = str(PROCESSED / 'obs.parquet')

    print("[1/2] CSV → Parquet (DuckDB)...")
    _step1_csv_to_parquet(src, tmp)

    print("[2/2] Añadiendo columnas H3...")
    _step2_add_h3(tmp, out)

    import os
    os.remove(tmp)
    print(f"✓  {out}")


if __name__ == '__main__':
    run()