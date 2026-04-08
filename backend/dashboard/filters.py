"""
Filtros compartidos por todos los routers.
"""

TAXA_LEVELS = ["kingdom", "phylum", "class", "order"]


def apply_taxa(df, kingdom="", phylum="", klass="", order=""):
    """Filtra un DataFrame por selecciones taxonómicas (comma-separated)."""
    for col, val in [("kingdom", kingdom), ("phylum", phylum), ("class", klass), ("order", order)]:
        if val and col in df.columns:
            df = df[df[col].isin(val.split(","))]
    return df


def apply_ecoregions(df, eco_ids_str="", eco_h3=None):
    """
    Filtra un DataFrame por ecorregiones seleccionadas.
    eco_ids_str: comma-separated eco_ids (e.g. "480,508,465")
    eco_h3: dict[int, set[str]] from cache.ECO_H3
    Filtra filas donde h3_r3 está en la unión de celdas de las eco seleccionadas.
    """
    if not eco_ids_str or eco_h3 is None or "h3_r3" not in df.columns:
        return df

    eco_ids = [int(x) for x in eco_ids_str.split(",")]
    cells = set()
    for eid in eco_ids:
        cells |= eco_h3.get(eid, set())

    if not cells:
        return df

    return df[df["h3_r3"].isin(cells)]