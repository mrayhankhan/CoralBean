#!/usr/bin/env bash
# One-shot setup for the dependency risk auditor.
#
# 1. Install the Coral CLI (Homebrew on macOS; instructions otherwise)
# 2. Install the Coral source-spec authoring skill (helps Claude Code
#    iterate on the YAML if you want to extend it)
# 3. Add the OSV + npm + npm_downloads source specs from this repo to Coral
# 4. Run the test_queries to confirm they work
#
# Safe to re-run: `coral source add` is idempotent.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v coral >/dev/null 2>&1; then
  if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    echo "→ Installing coral via Homebrew…"
    brew install withcoral/tap/coral
  else
    echo "Please install Coral first: https://withcoral.com/docs/installation"
    exit 1
  fi
fi

echo "→ Coral version: $(coral --version 2>/dev/null || echo unknown)"

# Optional but recommended for editing the YAML specs with an AI agent.
if command -v npx >/dev/null 2>&1; then
  echo "→ Installing the Coral source-spec authoring skill (npx skills add withcoral/skills)…"
  npx --yes skills add withcoral/skills || true
fi

echo "→ Linting source specs…"
coral source lint ./sources/osv.yaml
coral source lint ./sources/npm.yaml
coral source lint ./sources/npm_downloads.yaml

echo "→ Adding source specs (idempotent)…"
coral source add --file ./sources/osv.yaml
coral source add --file ./sources/npm.yaml
coral source add --file ./sources/npm_downloads.yaml

echo "→ Running test_queries…"
coral source test osv
coral source test npm
coral source test npm_downloads

cat <<'EOF'

✅  Coral is wired up.

Try a smoke query:

  coral sql "SELECT id, summary, database_specific__severity \
             FROM osv.vulnerabilities \
             WHERE package_name = 'minimist' AND ecosystem = 'npm' \
             LIMIT 5"

Then launch the dashboard:

  npm install
  npm run dev

EOF
