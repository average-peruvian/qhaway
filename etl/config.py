from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent.parent
RAW       = ROOT / 'data' / 'raw'
PROCESSED = ROOT / 'data' / 'processed'
AGG       = PROCESSED / 'agg'

INAT_DIR  = RAW / 'inaturalist'
GBIF_DIR  = RAW / 'gbif'

# ── DuckDB ─────────────────────────────────────────────────────────────────
DUCKDB_MEMORY  = '6GB'
DUCKDB_THREADS = 4

# ── H3 resolutions ─────────────────────────────────────────────────────────
H3_GLOBAL   = 3   # ~1,000 km²  — mapa mundial
H3_REGIONAL = 5   # ~25 km²     — drilldown regional

# ── iNat rank levels ───────────────────────────────────────────────────────
# iNat usa floats/doubles para rank_level (columna rank_level)
RANK_LEVELS = {
    70: 'kingdom',
    60: 'phylum',
    50: 'class',
    40: 'order',
    30: 'family',
    20: 'genus',
}

# ── Filtros de calidad ──────────────────────────────────────────────────────
QUALITY_GRADE          = 'research'
MAX_POSITIONAL_ACCURACY = 10_000   # metros

# ── Columnas a retener de observations.csv ──────────────────────────────────
OBS_KEEP_COLS = [
    'observation_uuid', 'observer_id',
    'latitude', 'longitude', 'positional_accuracy',
    'taxon_id', 'quality_grade',
    'observed_on', 'anomaly_score',
]

# ── Columnas a retener de Taxon.tsv (GBIF backbone) ────────────────────────
GBIF_TAXON_COLS = [
    'id', 'canonicalName', 'scientificName',
    'kingdom', 'phylum', 'class', 'order', 'family', 'genus',
    'taxonRank', 'taxonomicStatus', 'parentNameUsageID', 'acceptedNameUsageID',
]

# ── Batch size para el paso de H3 (rows en RAM a la vez) ────────────────────
H3_BATCH_SIZE = 500_000
