#!/usr/bin/env bash
# Build and serve the optimized production site locally.
#
#   ./deploy.sh       # production build, then serve on :3000
#
# This runs the real production build (the same one tests gate on), not the dev
# server: minified, prerendered, no hot reload. Stop with Ctrl-C.
#
# Override the port with:  PORT=8080 ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"

if [ ! -d node_modules ]; then
  echo "→ Installing dependencies (first run)…"
  npm install
fi

echo "→ Building production bundle…"
npm run build

echo
echo "→ Serving production build on http://localhost:${PORT}"
echo "  (Ctrl-C to stop)"
exec npx next start --port "$PORT"
