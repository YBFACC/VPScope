#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/collect-vps-baseline.sh --target <ssh-target> [--interval 10] [--duration 300] [--out <file>]

Examples:
  scripts/collect-vps-baseline.sh --target my-vps
  scripts/collect-vps-baseline.sh --target user@203.0.113.10 --interval 15 --duration 300 --out /tmp/vpscope-baseline.log

Notes:
  - <ssh-target> may be a ~/.ssh/config alias or user@host.
  - OpenSSH host key trust must already be established for this target.
  - The script only runs read-only commands used by the MVP monitoring contract.
  - Do not paste private keys, passwords, or passphrases into the output file.
USAGE
}

target=""
interval=10
duration=300
out=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      target="${2:-}"
      shift 2
      ;;
    --interval)
      interval="${2:-}"
      shift 2
      ;;
    --duration)
      duration="${2:-}"
      shift 2
      ;;
    --out)
      out="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$target" ]]; then
  echo "Missing required --target." >&2
  usage >&2
  exit 2
fi

if ! [[ "$interval" =~ ^[0-9]+$ ]] || [[ "$interval" -lt 1 ]]; then
  echo "--interval must be a positive integer." >&2
  exit 2
fi

if ! [[ "$duration" =~ ^[0-9]+$ ]] || [[ "$duration" -lt 1 ]]; then
  echo "--duration must be a positive integer." >&2
  exit 2
fi

if [[ -z "$out" ]]; then
  safe_target="$(printf '%s' "$target" | tr -c '[:alnum:]_.-' '_')"
  out="docs/roles/manual-vps-baseline-${safe_target}-$(date +%Y%m%d-%H%M%S).log"
fi

mkdir -p "$(dirname "$out")"

remote_script='
set -eu
echo "### remote-date"
date -u +"%Y-%m-%dT%H:%M:%SZ"
echo
echo "### uname"
uname -a
echo
echo "### hostname"
hostname
echo
echo "### uptime"
cat /proc/uptime
echo
echo "### loadavg"
cat /proc/loadavg
echo
echo "### free-m"
free -m
echo
echo "### df-h"
df -h
echo
echo "### df-P"
df -P
echo
echo "### top-bn1-head"
COLUMNS=160 top -bn1 | head -n 20
echo
echo "### proc-stat-head"
head -n 12 /proc/stat
echo
echo "### proc-net-dev"
cat /proc/net/dev
'

sample_count=$(( (duration + interval - 1) / interval ))

{
  echo "# VPScope real VPS baseline"
  echo "localStartedAt=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "target=$target"
  echo "intervalSec=$interval"
  echo "durationSec=$duration"
  echo "sampleCount=$sample_count"
  echo
} | tee "$out"

for ((i = 1; i <= sample_count; i += 1)); do
  {
    echo "===== sample $i/$sample_count local=$(date -u +"%Y-%m-%dT%H:%M:%SZ") ====="
    ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 "$target" "$remote_script"
    echo
  } | tee -a "$out"

  if [[ "$i" -lt "$sample_count" ]]; then
    sleep "$interval"
  fi
done

{
  echo "localFinishedAt=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "output=$out"
} | tee -a "$out"
