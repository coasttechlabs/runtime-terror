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

echo "Running Django tests..."
./.venv/bin/python manage.py test

HOST="${1:-127.0.0.1}"
PORT="${2:-8000}"
BASE_URL="http://${HOST}:${PORT}"
HEALTH_URL="${BASE_URL}/api/admin/health"
SERVER_LOG="$(mktemp -t runtime-terror-backend.XXXXXX.log)"
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Starting server on ${BASE_URL} for a live probe..."
./.venv/bin/python manage.py runserver "${HOST}:${PORT}" --noreload >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

for _ in {1..20}; do
  if curl -sS -o /tmp/runtime-terror-health.json -w "%{http_code}" "${HEALTH_URL}" >/tmp/runtime-terror-health.code 2>/dev/null; then
    break
  fi
  sleep 0.25
done

HTTP_CODE="$(cat /tmp/runtime-terror-health.code 2>/dev/null || echo 000)"
BODY="$(cat /tmp/runtime-terror-health.json 2>/dev/null || true)"

if [[ "${HTTP_CODE}" != "403" ]]; then
  echo "Health probe failed. Expected HTTP 403 (unauthenticated), got ${HTTP_CODE}."
  echo "Response body: ${BODY}"
  echo "Server log:"
  cat "${SERVER_LOG}"
  exit 1
fi

echo "Live probe passed (HTTP ${HTTP_CODE}): ${HEALTH_URL}"
echo "Response body: ${BODY}"
