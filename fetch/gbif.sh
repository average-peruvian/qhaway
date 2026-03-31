#!/bin/bash
set -euo pipefail
 
DEST="${1:?Uso: $0 <directorio>}"
mkdir -p "$DEST" && cd "$DEST"
 
wget -q --show-progress https://hosted-datasets.gbif.org/datasets/backbone/current/backbone.zip
unzip -o backbone.zip && rm backbone.zip
