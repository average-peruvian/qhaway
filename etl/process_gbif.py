"""
GBIF DwC archive  →  data/processed/gbif_*.parquet
                  →  data/processed/taxon_join.parquet
"""

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from config import GBIF_DIR, PROCESSED

LANGS_VERNACULAR = {'es', 'en', 'ES', 'EN', 'spa', 'eng'}


def _write(df: pd.DataFrame, name: str) -> None:
    path = PROCESSED / f'gbif_{name}.parquet'
    pq.write_table(
        pa.Table.from_pandas(df, preserve_index=False),
        path, compression='zstd',
    )
    print(f"  ✓  {path}  ({len(df):,} filas)")


def process_taxon() -> pd.DataFrame:
    print("Taxon.tsv...")
    df = pd.read_csv(
        GBIF_DIR / 'Taxon.tsv', sep='\t',
        usecols=[
            'taxonID', 'canonicalName', 'scientificName',
            'kingdom', 'phylum', 'class', 'order', 'family', 'genus',
            'taxonRank', 'taxonomicStatus',
        ],
        low_memory=False,
        on_bad_lines='skip',
    )
    df = df[df['taxonomicStatus'] == 'accepted'].copy()
    df.rename(columns={'taxonID': 'gbif_id'}, inplace=True)
    _write(df, 'taxon')
    return df


def process_distribution() -> None:
    print("Distribution.tsv...")
    df = pd.read_csv(
        GBIF_DIR / 'Distribution.tsv', sep='\t',
        usecols=['taxonID', 'countryCode', 'occurrenceStatus', 'threatStatus'],
        low_memory=False,
        on_bad_lines='skip',
    )
    df.rename(columns={'taxonID': 'gbif_id'}, inplace=True)
    _write(df, 'distribution')


def process_vernacular() -> None:
    print("VernacularName.tsv...")
    df = pd.read_csv(
        GBIF_DIR / 'VernacularName.tsv', sep='\t',
        usecols=['taxonID', 'vernacularName', 'language'],
        low_memory=False,
        on_bad_lines='skip',
    )
    df = df[df['language'].isin(LANGS_VERNACULAR)].copy()
    df.rename(columns={'taxonID': 'gbif_id'}, inplace=True)
    _write(df, 'vernacular')


def process_description() -> None:
    print("Description.tsv...")
    df = pd.read_csv(
        GBIF_DIR / 'Description.tsv', sep='\t',
        usecols=['taxonID', 'description', 'language'],
        low_memory=False,
        on_bad_lines='skip',
    )
    df = df[df['language'].str.lower().isin({'en', 'eng', 'english'})].copy()
    df.rename(columns={'taxonID': 'gbif_id'}, inplace=True)
    _write(df, 'description')


def process_multimedia() -> None:
    print("Multimedia.tsv...")
    df = pd.read_csv(
        GBIF_DIR / 'Multimedia.tsv', sep='\t',
        usecols=['taxonID', 'identifier', 'license', 'creator'],
        low_memory=False,
        on_bad_lines='skip',
    )
    df.rename(columns={'taxonID': 'gbif_id', 'identifier': 'photo_url'}, inplace=True)
    _write(df, 'multimedia')


def build_taxon_join(gbif_taxon: pd.DataFrame) -> None:
    print("Construyendo taxon_join.parquet...")

    inat_taxa = pd.read_parquet(
        PROCESSED / 'taxa_enriched.parquet',
        columns=['taxon_id', 'name', 'rank'],
    )

    inat_taxa['_name_lower']  = inat_taxa['name'].str.lower().str.strip()
    gbif_taxon['_name_lower'] = gbif_taxon['canonicalName'].str.lower().str.strip()

    join = inat_taxa.merge(
        gbif_taxon[['gbif_id', '_name_lower']],
        on='_name_lower', how='left',
    )[['taxon_id', 'gbif_id']].drop_duplicates('taxon_id')

    path = PROCESSED / 'taxon_join.parquet'
    pq.write_table(
        pa.Table.from_pandas(join, preserve_index=False),
        path, compression='zstd',
    )
    match_rate = join['gbif_id'].notna().mean()
    print(f"  ✓  {path}  ({len(join):,} filas, {match_rate:.1%} match rate)")


def run() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)

    gbif_taxon = process_taxon()
    process_distribution()
    process_vernacular()
    process_description()
    process_multimedia()
    build_taxon_join(gbif_taxon)


if __name__ == '__main__':
    run()