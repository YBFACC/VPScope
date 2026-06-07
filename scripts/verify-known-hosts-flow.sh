#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  VPSCOPE_TEST_SSH_HOST=<host-or-ip> \
  VPSCOPE_TEST_SSH_USER=<username> \
  VPSCOPE_TEST_SSH_PORT=<port> \
  scripts/verify-known-hosts-flow.sh

Optional:
  VPSCOPE_TEST_SSH_KEY_PATH=<absolute-key-path>

This runs the gated real SSH known_hosts flow test with a 60 second hard timeout.
The Rust test points OpenSSH at a temporary known_hosts file and does not modify
the user's real ~/.ssh/known_hosts file.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${VPSCOPE_TEST_SSH_HOST:-}" ]]; then
  echo "VPSCOPE_TEST_SSH_HOST is required." >&2
  usage >&2
  exit 2
fi

if [[ -z "${VPSCOPE_TEST_SSH_USER:-}" ]]; then
  echo "VPSCOPE_TEST_SSH_USER is required." >&2
  usage >&2
  exit 2
fi

cd "$(dirname "$0")/../src-tauri"

VPSCOPE_TEST_KNOWN_HOSTS_FLOW=1 perl -e '
  my $seconds = shift @ARGV;
  alarm $seconds;
  exec @ARGV or die "exec failed: $!";
' 60 cargo test validates_real_known_hosts_flow_when_enabled -- --nocapture
