#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

PORT="${PORT:-10000}"
HOST="${HOST:-0.0.0.0}"

exec "$PYTHON_BIN" -m http.server "$PORT" --bind "$HOST"
