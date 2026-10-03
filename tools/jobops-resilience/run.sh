#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.jobops-runtime"
LOGS="$ROOT/.jobops-logs"
mkdir -p "$RUNTIME" "$LOGS"
if [ "$#" -lt 3 ]; then echo "usage: run.sh <job-id> <retry-safe:0|1> <command...>" >&2; exit 2; fi
JOB="$1"; SAFE="$2"; shift 2; CMD="$*"
case "$JOB" in (*[!A-Za-z0-9._-]*|'') echo "invalid job id" >&2; exit 2;; esac
[ "$SAFE" = 0 ] || [ "$SAFE" = 1 ] || { echo "retry-safe must be 0 or 1" >&2; exit 2; }
META="$RUNTIME/$JOB.meta"; PIDF="$RUNTIME/$JOB.pid"; EXITF="$RUNTIME/$JOB.exit"; HEART="$RUNTIME/$JOB.heartbeat"; LOG="$LOGS/$JOB.log"
rm -f "$EXITF"
printf 'job=%s\nretry_safe=%s\nretries=0\ncommand_b64=%s\nstarted_at=%s\n' "$JOB" "$SAFE" "$(printf '%s' "$CMD" | base64 -w0)" "$(date -Is)" > "$META"
nohup bash -lc '
  job="$1"; cmd="$2"; root="$3";
  runtime="$root/.jobops-runtime"; logs="$root/.jobops-logs";
  trap '\''echo 130 > "$runtime/$job.exit"'\'' INT TERM;
  (while :; do date -Is > "$runtime/$job.heartbeat"; sleep 30; done) & hb=$!;
  bash -lc "$cmd" >> "$logs/$job.log" 2>&1; rc=$?;
  kill "$hb" 2>/dev/null || true; wait "$hb" 2>/dev/null || true;
  echo "$rc" > "$runtime/$job.exit"; date -Is > "$runtime/$job.heartbeat"; exit "$rc"
' _ "$JOB" "$CMD" "$ROOT" >/dev/null 2>&1 &
echo $! > "$PIDF"
echo "started job=$JOB pid=$(cat "$PIDF") retry_safe=$SAFE log=$LOG"
