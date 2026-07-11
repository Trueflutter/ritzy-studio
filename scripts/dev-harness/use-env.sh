#!/usr/bin/env bash
# Switch the app's active env between the local Supabase stack and hosted Supabase without
# hand-editing .env.local (which is error-prone and once left the app pointed at prod).
#
#   bash scripts/dev-harness/use-env.sh local    # colima Supabase :55321, 60-item fixture catalogue
#   bash scripts/dev-harness/use-env.sh hosted    # real 3,309-product catalogue (WRITES TO PROD DB)
#
# It copies .env.local.<target> onto .env.local. Both source files and .env.local are gitignored and
# live at the repo root. LOCAL is the safe default for day-to-day dev. Only switch to hosted for a
# real-catalogue verification pass, then switch back — hosted writes test data to the production DB
# and burns real Evolink/OpenAI credits.
set -euo pipefail

target="${1:-}"
case "$target" in
  local | hosted) ;;
  *)
    echo "usage: use-env.sh local|hosted" >&2
    exit 1
    ;;
esac

root="$(cd "$(dirname "$0")/../.." && pwd)"
src="$root/.env.local.$target"
if [ ! -f "$src" ]; then
  echo "missing $src — create it (copy .env.local and point NEXT_PUBLIC_SUPABASE_URL/keys at $target)" >&2
  exit 1
fi

cp "$src" "$root/.env.local"
url="$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$root/.env.local" | cut -d= -f2-)"
echo "Switched .env.local -> $target  (Supabase: $url)"
echo "Restart 'pnpm dev' to pick it up."
