"""
etl/build_amazon_boundaries.py

Pre-computa:
  1. GeoJSON simplificado de cada boundary (para overlay en el mapa)
  2. Set de celdas H3 r3 y r5 que intersectan cada boundary

Salida en data/processed/boundaries/:
  eva2005.geojson          ← overlay frontend
  dinerstein2017.geojson   ← overlay frontend
  eva2005_h3.parquet       ← {h3_r3, h3_r5} para filtrar obs
  dinerstein2017_h3.parquet

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
ROOT     = Path(__file__).parent.parent
DATA     = ROOT / 'data'
OUT      = DATA / 'processed' / 'boundaries'
OUT.mkdir(parents=True, exist_ok=True)

DINERSTEIN_SHP = DATA / 'ecobiomes' / 'dinerstein2017' / 'Ecoregions2017.shp'
EVA_SHP        = DATA / 'ecobiomes' / 'eva2005'        / 'amazonia_polygons.shp'

# IDs de ecorregiones amazónicas en Dinerstein 2017 (ECO_ID)
AMAZON_ECO_IDS = {
    480,508,465,466,490,464,484,498,446,570,483,460,512,505,444,
    565,476,469,496,474,497,463,481,518,507,511,473,482,503,467,
    493,479,
}

H3_RESOLUTIONS = [3, 5]

# ── Helpers ────────────────────────────────────────────────────────────────

def cells_for_polygon(geom, resolution: int) -> set[str]:
    """Celdas H3 que intersectan un polígono shapely."""
    geojson = mapping(geom)
    try:
        cells = h3.geo_to_cells(geojson, resolution)
        return set(cells)
    except Exception:
        # Geometría compleja — dividir en partes si es MultiPolygon
        cells = set()
        if geom.geom_type == 'MultiPolygon':
            for part in geom.geoms:
                try:
                    cells |= set(h3.geo_to_cells(mapping(part), resolution))
                except Exception:
                    pass
        return cells


def cells_for_gdf(gdf: gpd.GeoDataFrame, resolution: int) -> set[str]:
    """Todas las celdas H3 que intersectan cualquier geometría del GeoDataFrame."""
    all_cells = set()
    for geom in tqdm(gdf.geometry, desc=f"  H3 r{resolution}", unit="poly"):
        if geom is None or geom.is_empty:
            continue
        all_cells |= cells_for_polygon(geom, resolution)
    return all_cells


def save_h3(cells_r3: set, cells_r5: set, name: str) -> None:
    """Guarda las celdas H3 como Parquet con columnas h3_r3 y h3_r5."""
    # Crear DataFrame con todas las celdas r3 y sus hijos r5
    rows = []
    for c3 in cells_r3:
        rows.append({'h3_r3': c3, 'h3_r5': None})
    for c5 in cells_r5:
        rows.append({'h3_r3': None, 'h3_r5': c5})

    # Forma más útil: un parquet por resolución
    for res, cells in [(3, cells_r3), (5, cells_r5)]:
        path = OUT / f'{name}_h3_r{res}.parquet'
        df = pd.DataFrame({'h3': list(cells)})
        pq.write_table(
            pa.Table.from_pandas(df, preserve_index=False),
            path, compression='zstd',
        )
        print(f"  ✓  {path}  ({len(cells):,} celdas)")


def save_geojson(gdf: gpd.GeoDataFrame, name: str, tolerance: float = 0.01) -> None:
    """
    Guarda GeoJSON simplificado para el frontend.
    tolerance=0.01 grados ≈ ~1km — reduce tamaño sin perder forma general.
    """
    # Reproyectar a WGS84 si es necesario
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    # Disolver en un solo feature y simplificar
    dissolved = gdf.dissolve()
    dissolved['geometry'] = dissolved['geometry'].simplify(
        tolerance, preserve_topology=True
    )

    path = OUT / f'{name}.geojson'
    dissolved.to_file(path, driver='GeoJSON')
    size_kb = path.stat().st_size / 1024
    print(f"  ✓  {path}  ({size_kb:.0f} KB)")


# ── Pipeline ───────────────────────────────────────────────────────────────

def process_eva() -> None:
    print("\n[Eva 2005] Cargando...")
    gdf = gpd.read_file(EVA_SHP)
    print(f"  {len(gdf)} features, CRS: {gdf.crs}")

    print("  Generando GeoJSON...")
    save_geojson(gdf, 'eva2005')

    print("  Computando celdas H3...")
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    cells_r3 = cells_for_gdf(gdf, 3)
    cells_r5 = cells_for_gdf(gdf, 5)
    save_h3(cells_r3, cells_r5, 'eva2005')


def process_dinerstein() -> None:
    print("\n[Dinerstein 2017] Cargando...")
    gdf = gpd.read_file(DINERSTEIN_SHP)

    # Filtrar ecorregiones amazónicas
    amazon = gdf[gdf['ECO_ID'].isin(AMAZON_ECO_IDS)].copy()
    print(f"  {len(amazon)} ecorregiones amazónicas seleccionadas")

    print("  Generando GeoJSON...")
    save_geojson(amazon, 'dinerstein2017')

    print("  Computando celdas H3...")
    if amazon.crs and amazon.crs.to_epsg() != 4326:
        amazon = amazon.to_crs(epsg=4326)

    cells_r3 = cells_for_gdf(amazon, 3)
    cells_r5 = cells_for_gdf(amazon, 5)
    save_h3(cells_r3, cells_r5, 'dinerstein2017')

    # Guardar también metadata de ecorregiones para el frontend
    meta = amazon[['ECO_ID','ECO_NAME','BIOME_NAME','NNH_NAME']].copy()
    meta_path = OUT / 'dinerstein2017_ecoregions.json'
    meta.to_json(meta_path, orient='records', force_ascii=False)
    print(f"  ✓  {meta_path}")


def run() -> None:
    process_eva()
    process_dinerstein()
    print("\n✓  Boundaries listos en", OUT)


if __name__ == '__main__':
    run()