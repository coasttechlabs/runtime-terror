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
    BACKEND_PORT="${BACKEND_PORT:-8000}"
    FRONTEND_PORT="${FRONTEND_PORT:-10000}"
    BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
    FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"

    PORT="$BACKEND_PORT" HOST="$BACKEND_HOST" "$ROOT_DIR/backend/run.sh" &
    BACKEND_PID=$!
    PORT="$FRONTEND_PORT" HOST="$FRONTEND_HOST" "$ROOT_DIR/frontend/run.sh" &
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
