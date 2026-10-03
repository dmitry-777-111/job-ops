#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
R="$ROOT/.jobops-runtime"
for M in "$R"/*.meta; do
  [ -e "$M" ] || { echo 'no managed jobs'; exit 0; }
  unset job retry_safe retries
  . "$M"
  pid="$(cat "$R/$job.pid" 2>/dev/null || true)"
  if [ -f "$R/$job.exit" ]; then state="finished(exit=$(cat "$R/$job.exit"))";
  elif [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then state="running(pid=$pid)";
  else state="abnormal-stop"; fi
  echo "$job $state retry_safe=${retry_safe:-0} retries=${retries:-0} heartbeat=$(cat "$R/$job.heartbeat" 2>/dev/null || echo none)"
done
