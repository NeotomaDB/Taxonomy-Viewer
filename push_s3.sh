#!/usr/bin/env bash

set -euo pipefail

: "${S3_BUCKET:?S3_BUCKET must be set}"

S3_PREFIX="${S3_PREFIX:-taxonomy-viewer}"

# This guard prevents an accidental sync (especially --delete) from touching
# Explorer or the root of the shared apps.neotomadb.org bucket.
if [[ "${S3_PREFIX}" != "taxonomy-viewer" ]]; then
  echo "Refusing to deploy to unexpected S3 prefix: ${S3_PREFIX}" >&2
  exit 1
fi

DEPLOY_DIR="$(mktemp -d)"
trap 'rm -rf "${DEPLOY_DIR}"' EXIT

mkdir -p "${DEPLOY_DIR}/data"

# Copy only files required by the static application at runtime.
cp index.html index.css taxon_group_viz.js "${DEPLOY_DIR}/"
cp -R assets src "${DEPLOY_DIR}/"

cp data/taxon_paths_ids.json "${DEPLOY_DIR}/data/"
cp data/taxon_names.json "${DEPLOY_DIR}/data/"
cp data/taxagroup_names.json "${DEPLOY_DIR}/data/"
cp data/anchor_analysis.json "${DEPLOY_DIR}/data/"
cp data/taxa_changes.json "${DEPLOY_DIR}/data/"
cp data/all_synonyms.json "${DEPLOY_DIR}/data/"
cp data/taxon_metadata.json "${DEPLOY_DIR}/data/"
cp -R data/terminal_nodes_datasetids "${DEPLOY_DIR}/data/"

aws s3 sync \
  "${DEPLOY_DIR}/" \
  "s3://${S3_BUCKET}/${S3_PREFIX}/" \
  --delete \
  --exclude '.DS_Store' \
  --cache-control 'public,max-age=300'

# Always make the entry page and weekly change summary revalidate promptly.
aws s3 cp \
  "${DEPLOY_DIR}/index.html" \
  "s3://${S3_BUCKET}/${S3_PREFIX}/index.html" \
  --content-type 'text/html' \
  --cache-control 'no-cache'

aws s3 cp \
  "${DEPLOY_DIR}/data/taxa_changes.json" \
  "s3://${S3_BUCKET}/${S3_PREFIX}/data/taxa_changes.json" \
  --content-type 'application/json' \
  --cache-control 'no-cache'
