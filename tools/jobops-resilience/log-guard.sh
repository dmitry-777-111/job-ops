#!/usr/bin/env bash
set -u
JOBOPS_LOG_MAX_BYTES="${JOBOPS_LOG_MAX_BYTES:-5242880}"
JOBOPS_LOG_KEEP="${JOBOPS_LOG_KEEP:-2}"
jobops_rotate_log_if_needed() {
  local log="$1"
  local max_bytes="${2:-$JOBOPS_LOG_MAX_BYTES}"
  local keep="${3:-$JOBOPS_LOG_KEEP}"
  [[ "$max_bytes" =~ ^[0-9]+$ ]] || return 2
  [[ "$keep" =~ ^[0-9]+$ ]] || return 2
  [ -f "$log" ] || return 0
  local size
  size="$(wc -c < "$log" 2>/dev/null || echo 0)"
  [ "$size" -lt "$max_bytes" ] && return 0
  if [ "$keep" -eq 0 ]; then
    : > "$log"
    return 0
  fi
  rm -f "$log.$keep"
  local i
  for ((i=keep-1; i>=1; i--)); do
    [ -f "$log.$i" ] && mv -f "$log.$i" "$log.$((i+1))"
  done
  mv -f "$log" "$log.1"
}
