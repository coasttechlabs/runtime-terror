#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [[ -x ./.venv/bin/python ]]; then
  PYTHON_BIN="./.venv/bin/python"
elif ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-backend.settings}"
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

"$PYTHON_BIN" manage.py migrate --noinput

if "$PYTHON_BIN" -c "import gunicorn" >/dev/null 2>&1; then
  exec "$PYTHON_BIN" -m gunicorn backend.wsgi:application \
    --bind "${HOST}:${PORT}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --timeout "${GUNICORN_TIMEOUT:-120}"
fi

exec "$PYTHON_BIN" manage.py runserver "${HOST}:${PORT}"
