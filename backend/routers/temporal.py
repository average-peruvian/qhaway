"""
GET /api/temporal

Serie temporal mensual/anual de observaciones.
Lee desde AGG['temporal'] (RAM).

Query params:
  kingdom   str | "all"
  year_min  int
  year_max  int
  granularity  monthly | yearly  (default: monthly)
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import pandas as pd

from dashboard.cache import AGG

router = APIRouter()


@router.get("")
def temporal(
    kingdom:     str = Query("all"),
    year_min:    int = Query(None),
    year_max:    int = Query(None),
    granularity: str = Query("monthly"),
    grade:       str = Query("all"),
):
    df: pd.DataFrame = AGG["temporal"].copy()

    if kingdom != "all":
        df = df[df["kingdom"] == kingdom]
    if grade != "all":
        df = df[df["quality_grade"] == grade]
    if year_min is not None:
        df = df[df["year"] >= year_min]
    if year_max is not None:
        df = df[df["year"] <= year_max]

    if granularity == "yearly":
        df = (
            df.groupby("year")
            .agg(n_obs=("n_obs","sum"), n_species=("n_species","sum"))
            .reset_index()
        )
        df["date"] = df["year"].astype(str)
    else:
        df = (
            df.groupby(["year","month"])
            .agg(n_obs=("n_obs","sum"), n_species=("n_species","sum"))
            .reset_index()
        )
        df["date"] = df["year"].astype(str) + "-" + df["month"].astype(str).str.zfill(2)
        df = df.sort_values("date")

    return JSONResponse({
        "granularity": granularity,
        "data": df[["date","n_obs","n_species"]].to_dict(orient="records"),
    })