#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-all}"

case "$MODE" in
  backend)
    exec "$ROOT_DIR/backend/run.sh"
    ;;
  frontend)
    exec "$ROOT_DIR/frontend/run.sh"
    ;;
  all)
    "$ROOT_DIR/backend/run.sh" &
    BACKEND_PID=$!
    "$ROOT_DIR/frontend/run.sh" &
    FRONTEND_PID=$!

    cleanup() {
      kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    while true; do
      if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        break
      fi
      if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        break
      fi
      sleep 1
    done

    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    ;;
  *)
    echo "Usage: ./run.sh [all|backend|frontend]"
    exit 1
    ;;
esac
