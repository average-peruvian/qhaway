"""
Conexión DuckDB singleton para el dashboard.
"""

import sys
import duckdb
from pathlib import Path

_ROOT      = Path(__file__).parent.parent.parent
_PROCESSED = _ROOT / 'data' / 'processed'

_DUCKDB_MEMORY  = '6GB'
_DUCKDB_THREADS = 4

_con: duckdb.DuckDBPyConnection | None = None


def get_con() -> duckdb.DuckDBPyConnection:
    global _con
    if _con is None:
        _con = _init()
    return _con


def _init() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(database=':memory:')
    con.execute(f"SET memory_limit='{_DUCKDB_MEMORY}'")
    con.execute(f"SET threads={_DUCKDB_THREADS}")
    _register_views(con)
    return con


def _register_views(con: duckdb.DuckDBPyConnection) -> None:
    views = {
        'obs':           _PROCESSED / 'obs.parquet',
        'taxa_enriched': _PROCESSED / 'taxa_enriched.parquet',
        'photos':        _PROCESSED / 'photos.parquet',
        'taxon_join':    _PROCESSED / 'taxon_join.parquet',
        'gbif_dist':     _PROCESSED / 'gbif_distribution.parquet',
        'gbif_vernac':   _PROCESSED / 'gbif_vernacular.parquet',
        'gbif_desc':     _PROCESSED / 'gbif_description.parquet',
    }

    missing = [name for name, path in views.items() if not path.exists()]
    if missing:
        print(f"[db] WARN: faltan Parquets: {missing}", file=sys.stderr)
        print("[db]       Ejecuta el ETL primero: cd etl && python run_all.py",
              file=sys.stderr)

    for name, path in views.items():
        if path.exists():
            con.execute(
                f"CREATE OR REPLACE VIEW {name} AS "
                f"SELECT * FROM read_parquet('{path}')"
            )

    # Observers from raw CSV (small lookup table)
    observers_csv = _ROOT / 'data' / 'raw' / 'inaturalist' / 'observers.csv'
    if observers_csv.exists():
        con.execute(
            f"CREATE OR REPLACE VIEW observers AS "
            f"SELECT * FROM read_csv_auto('{observers_csv}', delim='\\t', ignore_errors=true)"
        )

    registered = [n for n, p in views.items() if p.exists()]
    if observers_csv.exists():
        registered.append('observers')
    print(f"[db] Views registradas: {registered}")