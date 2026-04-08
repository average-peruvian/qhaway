"""
etl/build_ecoregions.py

Procesa TODAS las ecorregiones de Dinerstein 2017 (846 features).

Salida en data/processed/boundaries/:
  ecoregions_meta.json       ← sidebar: bioma → ecorregión
  ecoregions_h3_r3.parquet   ← backend: eco_id → h3_r3 para filtrar
  ecoregions.geojson         ← frontend: shapes para vista Ecorregiones

Requisitos:
  pip install geopandas shapely h3 pyarrow tqdm
"""

import json
from pathlib import Path

import geopandas as gpd
import h3
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from shapely.geometry import mapping
from tqdm import tqdm

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA = ROOT / 'data'
OUT  = DATA / 'processed' / 'boundaries'
OUT.mkdir(parents=True, exist_ok=True)

DINERSTEIN_SHP = DATA / 'ecobiomes' / 'dinerstein2017' / 'Ecoregions2017.shp'

# ── H3 helpers ─────────────────────────────────────────────────────────────

def cells_for_polygon(geom, resolution):
    """Celdas H3 que intersectan un polígono shapely."""
    geojson = mapping(geom)
    try:
        return set(h3.geo_to_cells(geojson, resolution))
    except Exception:
        cells = set()
        if geom.geom_type == 'MultiPolygon':
            for part in geom.geoms:
                try:
                    cells |= set(h3.geo_to_cells(mapping(part), resolution))
                except Exception:
                    pass
        return cells


# ── Pipeline ───────────────────────────────────────────────────────────────

def run():
    print("[Ecoregions] Cargando shapefile...")
    gdf = gpd.read_file(DINERSTEIN_SHP)
    print(f"  {len(gdf)} ecorregiones, CRS: {gdf.crs}")

    # Asegurar WGS84
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    # Filtrar ECO_ID = -9999 (water bodies, rock/ice)
    gdf = gdf[gdf['ECO_ID'] > 0].copy()
    print(f"  {len(gdf)} ecorregiones válidas (sin water/rock)")

    # ── 1. Metadata ────────────────────────────────────────────────────
    print("\n[1/3] Generando metadata...")
    meta_cols = ['ECO_ID', 'ECO_NAME', 'BIOME_NUM', 'BIOME_NAME', 'REALM']
    meta = gdf[meta_cols].copy()
    meta.columns = ['eco_id', 'eco_name', 'biome_num', 'biome_name', 'realm']
    meta = meta.sort_values(['biome_num', 'eco_name'])

    meta_path = OUT / 'ecoregions_meta.json'
    meta.to_json(meta_path, orient='records', force_ascii=False, indent=2)
    print(f"  ✓  {meta_path}  ({len(meta)} ecorregiones)")

    n_biomes = meta['biome_num'].nunique()
    n_realms = meta['realm'].nunique()
    print(f"     {n_biomes} biomas, {n_realms} realms")

    # ── 2. H3 r3 celdas por ecorregión ─────────────────────────────────
    print("\n[2/3] Computando celdas H3 r3 por ecorregión...")
    rows = []
    for _, row in tqdm(gdf.iterrows(), total=len(gdf), unit="eco"):
        eco_id = int(row['ECO_ID'])
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        cells = cells_for_polygon(geom, 3)
        for c in cells:
            rows.append({'eco_id': eco_id, 'h3_r3': c})

    h3_df = pd.DataFrame(rows)
    h3_path = OUT / 'ecoregions_h3_r3.parquet'
    pq.write_table(
        pa.Table.from_pandas(h3_df, preserve_index=False),
        h3_path, compression='zstd',
    )
    n_cells = h3_df['h3_r3'].nunique()
    print(f"  ✓  {h3_path}  ({len(h3_df):,} filas, {n_cells:,} celdas únicas)")

    # ── 3. GeoJSON simplificado ────────────────────────────────────────
    print("\n[3/3] Generando GeoJSON simplificado...")
    geo = gdf[['ECO_ID', 'ECO_NAME', 'BIOME_NUM', 'BIOME_NAME', 'REALM', 'geometry']].copy()
    geo.columns = ['eco_id', 'eco_name', 'biome_num', 'biome_name', 'realm', 'geometry']

    # Simplificar geometrías (~0.01° ≈ 1km)
    geo['geometry'] = geo['geometry'].simplify(0.01, preserve_topology=True)

    geo_path = OUT / 'ecoregions.geojson'
    geo.to_file(geo_path, driver='GeoJSON')
    size_mb = geo_path.stat().st_size / 1e6
    print(f"  ✓  {geo_path}  ({size_mb:.1f} MB)")

    print(f"\n✓  Ecoregions listos en {OUT}")


if __name__ == '__main__':
    run()