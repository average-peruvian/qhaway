from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import pandas as pd
from dashboard.cache import AGG

router = APIRouter()

@router.get("")
def stats(
    kingdom:  str = Query("all"),
    year_min: int = Query(None),
    year_max: int = Query(None),
    grade:    str = Query("all"),
):
    df = AGG["hex_density"].copy()
    if kingdom != "all":
        df = df[df["kingdom"] == kingdom]
    if grade != "all":
        df = df[df["quality_grade"] == grade]
    if year_min is not None:
        df = df[df["year"] >= year_min]
    if year_max is not None:
        df = df[df["year"] <= year_max]

    tree = AGG["taxon_tree"].copy()
    if kingdom != "all":
        tree = tree[tree["kingdom"] == kingdom]
    if grade != "all":
        tree = tree[tree["quality_grade"] == grade]

    return JSONResponse({
        "n_obs":     int(df["n_obs"].sum()),
        "n_species": int(tree["n_species"].sum()),
        "n_cells":   int(df["h3_r3"].nunique()),
    })