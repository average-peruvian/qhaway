"""
GET /api/taxon/tree

Árbol taxonómico agregado para el sunburst.
Lee desde AGG['taxon_tree'] (RAM).

Query params:
  kingdom  str | "all"
  depth    2..6  (default: 4  →  kingdom/phylum/class/order)
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import pandas as pd

from dashboard.cache import AGG

router = APIRouter()

LEVELS = ["kingdom", "phylum", "class", "order", "family", "genus"]


@router.get("/tree")
def taxon_tree(
    kingdom: str = Query("all"),
    depth:   int = Query(4, ge=2, le=6),
):
    df: pd.DataFrame = AGG["taxon_tree"].copy()

    if kingdom != "all":
        df = df[df["kingdom"] == kingdom]

    group_cols = LEVELS[:depth]

    agg = (
        df.groupby(group_cols, dropna=True)
        .agg(n_species=("n_species","sum"), n_obs=("n_obs","sum"))
        .reset_index()
    )

    # Formato jerárquico para Observable Plot / D3 sunburst
    # [{path: "Animalia/Chordata/Aves", n_species: 123, n_obs: 456}, ...]
    agg["path"] = agg[group_cols].apply(
        lambda r: "/".join(str(v) for v in r if pd.notna(v) and v != ""),
        axis=1,
    )

    records = agg[["path","n_species","n_obs"]].to_dict(orient="records")

    return JSONResponse({
        "depth":   depth,
        "kingdom": kingdom,
        "n_nodes": len(records),
        "data":    records,
    })