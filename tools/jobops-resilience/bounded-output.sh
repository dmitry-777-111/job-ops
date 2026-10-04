#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -lt 2 ]; then
  echo "usage: bounded-output.sh <max-lines> <command...>" >&2
  exit 2
fi
MAX="$1"; shift
[[ "$MAX" =~ ^[1-9][0-9]*$ ]] || { echo "max-lines must be a positive integer" >&2; exit 2; }
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
set +e
"$@" >"$TMP" 2>&1
RC=$?
set -e
LINES="$(wc -l < "$TMP" | tr -d ' ')"
if [ "$LINES" -le "$MAX" ]; then
  cat "$TMP"
else
  echo "[output truncated: ${LINES} lines total; showing last ${MAX}]"
  tail -n "$MAX" "$TMP"
fi
exit "$RC"
