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

: "${DJANGO_DEBUG:=1}"
: "${CORS_ALLOW_ALL_ORIGINS:=1}"
export DJANGO_DEBUG
export CORS_ALLOW_ALL_ORIGINS

if [[ ! -x ./.venv/bin/python ]]; then
  echo "Missing .venv python at ./.venv/bin/python"
  echo "Create it first, then install dependencies from requirements.txt."
  exit 1
fi

HOST_PORT="${1:-127.0.0.1:8000}"
./.venv/bin/python manage.py migrate --noinput
exec ./.venv/bin/python manage.py runserver "$HOST_PORT"
