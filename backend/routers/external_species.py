"""API minimal para los datos externos copiados desde TF.

GET /api/external_species  — lista paginada desde `data/processed/external_tf/species_list.parquet`
GET /api/external_species/{taxon_id} — detalle
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi import File, UploadFile, Form
from fastapi.responses import JSONResponse
import pandas as pd
import json
from pathlib import Path
from difflib import SequenceMatcher
import tempfile
import shutil

router = APIRouter()

_DF = None
_PATH = Path('data/processed/external_tf/species_list.parquet')


def _load_df():
    global _DF
    if _DF is None:
        if not _PATH.exists():
            _DF = pd.DataFrame()
        else:
            _DF = pd.read_parquet(_PATH)
    return _DF


def _species_meta(name: str) -> dict:
    if not name:
        return {}

    df = _load_df()
    if df.empty:
        return {}

    match = df[df['name'].str.lower() == name.lower()]
    if match.empty:
        return {}

    row = match.iloc[0]
    return {
        'taxon_id': int(row['taxon_id']) if pd.notna(row.get('taxon_id')) else None,
        'family': row.get('family'),
        'order': row.get('order'),
        'image_url': row.get('image_url'),
        'dataset_records': int(row['dataset_records']) if pd.notna(row.get('dataset_records')) else None,
    }


def _augment_prediction(pred: dict) -> dict:
    pred = dict(pred)
    name = pred.get('name') or pred.get('target_species') or pred.get('species')
    if name:
        pred['name'] = name
        pred.update({k: v for k, v in _species_meta(name).items() if v is not None})
    return pred


@router.get("")
def list_external_species(
    q: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=200),
    sort_by: str = Query("name"),
):
    df = _load_df().copy()
    if df.empty:
        return JSONResponse({"page": page, "page_size": page_size, "total": 0, "data": []})

    if q:
        df = df[df['name'].str.contains(q, case=False, na=False)]

    sort_col = {'name': 'name', 'obs': 'dataset_records'}.get(sort_by, 'name')
    df = df.sort_values(sort_col, ascending=(sort_col == 'name'))

    total = len(df)
    start = (page - 1) * page_size
    page_df = df.iloc[start:start + page_size]

    records = json.loads(page_df.to_json(orient='records', force_ascii=False))

    return JSONResponse({"page": page, "page_size": page_size, "total": total, "data": records})


@router.get("/{taxon_id}")
def external_species_detail(taxon_id: int):
    df = _load_df()
    if df.empty:
        raise HTTPException(status_code=404, detail="external species data not found")

    row = df[df['taxon_id'] == int(taxon_id)]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"taxon_id {taxon_id} not found")
    result = json.loads(row.iloc[0].to_json(force_ascii=False))
    return JSONResponse(result)


@router.post("/predict")
async def predict_external_species(
    file: UploadFile = File(...),
    known_species: str = Form(None),
    family: str = Form(None),
):
    """Prediction endpoint (heuristic):
    - If uploaded filename matches a local image in the copied JSONs, return that image's batch_results/top5 if available.
    - Otherwise return top-5 text matches against known species names using fuzzy ratio.
    """
    base = Path('data/processed/external_tf')
    json_root = base / 'jsons'

    # Build species name list and image->species mapping from available JSONs
    species_names = set()
    image_map = {}  # basename -> species_name
    batch_map = {}  # species_name -> prediction records (if available)

    for p in json_root.rglob('*.json'):
        try:
            obj = json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue
        # knowledge_base style
        if isinstance(obj, dict) and all(isinstance(v, dict) for v in obj.values()):
            for name, v in obj.items():
                sp = v.get('species') or v.get('name') or name
                species_names.add(sp)
                for li in (v.get('local_images') or []):
                    image_map[Path(li).name.lower()] = sp
        # batch_results preview
        if isinstance(obj, dict) and 'preview' in obj and isinstance(obj['preview'], list):
            for entry in obj['preview']:
                sp = entry.get('target_species') or entry.get('species') or entry.get('name')
                if sp:
                    batch_map.setdefault(sp, []).append(entry)
        # list-style JSON
        if isinstance(obj, list):
            for entry in obj:
                if not isinstance(entry, dict):
                    continue
                sp = entry.get('species') or entry.get('name')
                if sp:
                    species_names.add(sp)
                    for li in (entry.get('local_images') or []):
                        image_map[Path(li).name.lower()] = sp

    # save uploaded file temporarily
    tmpdir = Path(tempfile.gettempdir())
    tmp_path = tmpdir / file.filename
    with tmp_path.open('wb') as out:
        shutil.copyfileobj(file.file, out)

    fname = tmp_path.name.lower()

    # If image filename matches
    if fname in image_map:
        sp = image_map[fname]
        preds = batch_map.get(sp)
        if preds:
            # return top5 from first matching pred list
            top5 = preds[0].get('top5') if isinstance(preds[0].get('top5'), list) else None
            if isinstance(top5, list):
                top5 = [_augment_prediction(p) for p in top5]
            result = {'source': 'batch_results', 'matched_species': sp, 'predictions': top5 or []}
        else:
            result = {'source': 'local_match', 'matched_species': sp, 'predictions': []}
    else:
        # fuzzy match against species_names
        def score(a, b):
            return SequenceMatcher(None, a.lower(), b.lower()).ratio()

        candidates = []
        for s in species_names:
            candidates.append((s, score(file.filename, s)))
        candidates.sort(key=lambda x: x[1], reverse=True)
        top5 = [
            _augment_prediction({'name': c[0], 'score': round(c[1], 3), 'source': 'text_match'})
            for c in candidates[:5]
        ]
        result = {'source': 'text_match', 'predictions': top5}

    # if known_species provided, add accuracy flag
    if known_species and result.get('predictions'):
        top1 = result['predictions'][0]
        top1_name = top1.get('name') or top1.get('rank') or top1.get('target_species')
        result['known_species'] = known_species
        result['top1_is_known'] = (top1_name and top1_name.lower() == known_species.lower())

    return JSONResponse(result)
