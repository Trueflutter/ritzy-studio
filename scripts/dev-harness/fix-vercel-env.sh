#!/usr/bin/env bash
# Fix the Evolink/matching env vars on Vercel (production + preview).
#
# Why this exists: `printf value | vercel env add` breaks when several commands
# are pasted at once (later commands get empty stdin and store EMPTY values,
# which fail env-schema validation and crash the app), and the CLI's
# interactive "which Git branch?" prompt cannot be answered through a pipe.
# This script talks to the Vercel API directly: it deletes any existing entries
# for these keys, then recreates each one with the correct value targeting
# BOTH production and preview. Values are never printed.
#
# Run from the repo root: bash scripts/dev-harness/fix-vercel-env.sh
set -euo pipefail

EVOLINK_KEY=$(grep '^EVOLINK_API_KEY=' .env.local | head -1 | cut -d= -f2-)
if [ -z "$EVOLINK_KEY" ]; then
  echo "EVOLINK_API_KEY not found in .env.local" >&2
  exit 1
fi

export EVOLINK_KEY
python3 - <<'PYEOF'
import json, os, pathlib, urllib.request, urllib.parse

auth_path = pathlib.Path.home() / "Library/Application Support/com.vercel.cli/auth.json"
token = json.loads(auth_path.read_text())["token"]
project = json.loads(pathlib.Path(".vercel/project.json").read_text())
project_id, team_id = project["projectId"], project.get("orgId")
team_q = f"?teamId={team_id}" if team_id else ""

def api(method, path, body=None):
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)

desired = {
    "RITZY_IMAGE_PROVIDER": "evolink",
    "EVOLINK_API_KEY": os.environ["EVOLINK_KEY"],
    "EVOLINK_IMAGE_MODEL": "gemini-3.1-flash-image-preview",
    "EVOLINK_IMAGE_QUALITY": "1K",
    "RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED": "true",
}

existing = api("GET", f"/v9/projects/{project_id}/env{team_q}")["envs"]
for env in existing:
    if env["key"] in desired:
        api("DELETE", f"/v9/projects/{project_id}/env/{env['id']}{team_q}")
        print(f"deleted stale {env['key']} ({'+'.join(env['target'])})")

for key, value in desired.items():
    api("POST", f"/v10/projects/{project_id}/env{team_q}", {
        "key": key, "value": value, "type": "encrypted",
        "target": ["production", "preview"],
    })
    print(f"created {key} (production+preview, {len(value)} chars)")

print("done — redeploy for the changes to take effect")
PYEOF
