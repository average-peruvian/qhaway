#!/bin/bash
set -euo pipefail
 
DEST="${1:?Uso: $0 <directorio>}"
BUCKET="s3://inaturalist-open-data"
mkdir -p "$DEST" && cd "$DEST"
 
for f in projects.csv.gz observations_projects.csv.gz; do
    aws s3 cp "${BUCKET}/${f}" . --no-sign-request
    gunzip -f "$f"
done
 
