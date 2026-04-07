from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import pandas as pd

from dashboard.cache import AGG
from dashboard.filters import apply_taxa

router = APIRouter()


@router.get("")
def stats(
    kingdom:  str = Query(""),
    phylum:   str = Query(""),
    klass:    str = Query("", alias="class"),
    order:    str = Query(""),
    year_min: int = Query(None),
    year_max: int = Query(None),
    grade:    str = Query("all"),
):
    df = AGG["hex_density"].copy()
    df = apply_taxa(df, kingdom, phylum, klass, order)
    if grade != "all":
        df = df[df["quality_grade"] == grade]
    if year_min is not None:
        df = df[df["year"] >= year_min]
    if year_max is not None:
        df = df[df["year"] <= year_max]

    tree = AGG["taxon_tree"].copy()
    tree = apply_taxa(tree, kingdom, phylum, klass, order)
    if grade != "all":
        tree = tree[tree["quality_grade"] == grade]

    return JSONResponse({
        "n_obs":     int(df["n_obs"].sum()),
        "n_species": int(tree["n_species"].sum()),
        "n_cells":   int(df["h3_r3"].nunique()),
    })