#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: pnpm discover <job-id>" >&2
  exit 1
fi

JOB_ID="$1"

docker compose --profile workers build worker-playwright
exec docker compose --profile workers run --rm worker-playwright \
  discover --job-id "$JOB_ID"
