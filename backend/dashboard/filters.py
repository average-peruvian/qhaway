"""
Filtro taxonómico multi-nivel compartido por todos los routers.
"""

TAXA_LEVELS = ["kingdom", "phylum", "class", "order"]


def apply_taxa(df, kingdom="", phylum="", klass="", order=""):
    """Filtra un DataFrame por selecciones taxonómicas (comma-separated)."""
    for col, val in [("kingdom", kingdom), ("phylum", phylum), ("class", klass), ("order", order)]:
        if val and col in df.columns:
            df = df[df[col].isin(val.split(","))]
    return df