#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo "usage: compact-ci.sh <github-run-id>" >&2
  exit 2
fi
RUN_ID="$1"
gh run view "$RUN_ID" -R dmitry-777-111/job-ops \
  --json status,conclusion,headSha,jobs \
  --jq '{run:'"$RUN_ID"',sha:(.headSha[0:7]),status,conclusion,failed:[.jobs[]|select(.conclusion=="failure")|.name],running:[.jobs[]|select(.status!="completed")|.name]}'
