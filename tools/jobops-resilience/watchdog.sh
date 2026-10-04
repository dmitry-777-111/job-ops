#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.jobops-runtime"
LOGS="$ROOT/.jobops-logs"
LOCK="$RUNTIME/watchdog.lock"
mkdir -p "$RUNTIME" "$LOGS"
source "$ROOT/tools/jobops-resilience/log-guard.sh"
exec 9>"$LOCK"; flock -n 9 || exit 0
for META in "$RUNTIME"/*.meta; do
  [ -e "$META" ] || continue
  unset job retry_safe retries command_b64 started_at
  . "$META"
  PIDF="$RUNTIME/$job.pid"; EXITF="$RUNTIME/$job.exit"; HEART="$RUNTIME/$job.heartbeat"; LOG="$LOGS/$job.log"
  jobops_rotate_log_if_needed "$LOG"
  jobops_rotate_log_if_needed "$LOGS/watchdog.log"
  [ -f "$EXITF" ] && continue
  pid="$(cat "$PIDF" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then continue; fi
  if [ "${retry_safe:-0}" != 1 ]; then
    printf '%s abnormal-stop job=%s action=manual-recovery-required\n' "$(date -Is)" "$job" >> "$LOGS/watchdog.log"
    continue
  fi
  if [ "${retries:-0}" -ge 1 ]; then
    printf '%s abnormal-stop job=%s action=retry-limit-reached\n' "$(date -Is)" "$job" >> "$LOGS/watchdog.log"
    continue
  fi
  cmd="$(printf '%s' "$command_b64" | base64 -d)"
  sed -i 's/^retries=.*/retries=1/' "$META"
  printf '%s restarting job=%s\n' "$(date -Is)" "$job" >> "$LOGS/watchdog.log"
  nohup bash -lc '
    job="$1"; cmd="$2"; root="$3";
    runtime="$root/.jobops-runtime"; logs="$root/.jobops-logs";
    trap '\''echo 130 > "$runtime/$job.exit"'\'' INT TERM;
    (while :; do date -Is > "$runtime/$job.heartbeat"; sleep 30; done) & hb=$!;
    bash -lc "$cmd" >> "$logs/$job.log" 2>&1; rc=$?;
    kill "$hb" 2>/dev/null || true; wait "$hb" 2>/dev/null || true;
    echo "$rc" > "$runtime/$job.exit"; date -Is > "$runtime/$job.heartbeat"; exit "$rc"
  ' _ "$job" "$cmd" "$ROOT" >/dev/null 2>&1 &
  echo $! > "$PIDF"
done
