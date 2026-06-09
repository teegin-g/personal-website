#!/usr/bin/env bash
# Boot the site locally for development.
#
#   ./run.sh          # start the Next.js dev server (hot reload) on :3000
#   ./run.sh prod     # production build, then serve the optimized build on :3000
#
# Stop with Ctrl-C.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"
MODE="${1:-dev}"

# Install dependencies on first run (no node_modules yet).
if [ ! -d node_modules ]; then
  echo "→ Installing dependencies (first run)…"
  npm install
fi

case "$MODE" in
  dev)
    echo "→ Dev server (hot reload) on http://localhost:${PORT}"
    exec npm run dev -- --port "$PORT"
    ;;
  prod)
    echo "→ Production build…"
    npm run build
    echo "→ Serving production build on http://localhost:${PORT}"
    exec npx next start --port "$PORT"
    ;;
  *)
    echo "Usage: ./run.sh [dev|prod]" >&2
    exit 1
    ;;
esac
