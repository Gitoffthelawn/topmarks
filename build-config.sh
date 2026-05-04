#!/bin/sh
# Reads .env and writes config.local.js with only the variables this
# extension needs. Re-run after editing .env.
#
# config.local.js is gitignored. .env is gitignored. Neither should be
# committed.

set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Error: .env not found in $(pwd)" >&2
  echo "Copy .env.example to .env and fill in your values." >&2
  exit 1
fi

# Allowlist: only these variables get emitted to the client-side config.
# The Unsplash secret key MUST NOT appear here — it's for server-side OAuth
# and would be a security risk in a browser extension.
ALLOWED="UNSPLASH_ACCESS_KEY"

OUT=config.local.js

{
  echo "// Auto-generated from .env by build-config.sh — do not edit or commit."
  for name in $ALLOWED; do
    line=$(grep -E "^[[:space:]]*${name}=" .env | head -n1 || true)
    [ -z "$line" ] && continue
    value=$(printf '%s' "$line" | sed -E "s/^[[:space:]]*${name}=//")
    # Strip surrounding single or double quotes
    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    # Escape backslashes and double quotes for the JS string literal
    escaped=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf 'const %s = "%s";\n' "$name" "$escaped"
  done
} > "$OUT"

echo "Wrote $OUT"
