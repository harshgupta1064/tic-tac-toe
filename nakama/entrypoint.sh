#!/bin/sh
set -eu

if [ -z "${NAKAMA_DB_ADDRESS:-}" ]; then
  echo "NAKAMA_DB_ADDRESS is required."
  exit 1
fi

RUNTIME_PATH="${NAKAMA_RUNTIME_PATH:-/nakama/data/modules/build}"
LOGGER_LEVEL="${NAKAMA_LOGGER_LEVEL:-INFO}"
TOKEN_EXPIRY="${NAKAMA_SESSION_TOKEN_EXPIRY_SEC:-7200}"
SERVER_NAME="${NAKAMA_NAME:-tictactoe}"

echo "Running Nakama migration..."
/nakama/nakama migrate up --database.address "${NAKAMA_DB_ADDRESS}"

echo "Starting Nakama server..."
exec /nakama/nakama \
  --name "${SERVER_NAME}" \
  --database.address "${NAKAMA_DB_ADDRESS}" \
  --runtime.path "${RUNTIME_PATH}" \
  --runtime.js_entrypoint "main.js" \
  --logger.level "${LOGGER_LEVEL}" \
  --session.token_expiry_sec "${TOKEN_EXPIRY}"
