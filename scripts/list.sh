#!/usr/bin/env bash
# Update list: count it, or export it to a CSV file. Never prints addresses to the terminal.
#   scripts/list.sh                 -> counts
#   scripts/list.sh export <file>   -> writes email,riding,source,created_at,confirmed_at,token to <file>
set -euo pipefail
export PATH="/opt/homebrew/bin:${PATH}"
# Settings come from the environment or an untracked .env at the repo root (see README).
root="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "${root}/.env" ] && set -a && . "${root}/.env" && set +a
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID (env or .env)}"
: "${LIST_DB_ID:?set LIST_DB_ID to the D1 database id (cf d1 list)}"
export CLOUDFLARE_ACCOUNT_ID
DB="${LIST_DB_ID}"
q() { npx cf -q d1 query "${DB}" --sql "$1"; }
if [ "${1:-}" = "export" ]; then
  file="${2:?usage: scripts/list.sh export <file.csv>}"
  q "SELECT email, riding, source, created_at, confirmed_at, token FROM subscribers ORDER BY created_at" |
    python3 -c '
import csv, json, sys
rows = json.load(sys.stdin)[0]["results"]
w = csv.writer(open(sys.argv[1], "w", newline=""))
w.writerow(["email", "riding", "source", "created_at", "confirmed_at", "token"])
for r in rows:
    w.writerow([r["email"], r["riding"] or "", r["source"] or "", r["created_at"], r["confirmed_at"] or "", r["token"]])
print(f"Wrote {len(rows)} rows to {sys.argv[1]}")
' "${file}"
  chmod 600 "${file}"
else
  q "SELECT count(*) AS total, sum(confirmed_at IS NOT NULL) AS confirmed FROM subscribers" |
    python3 -c '
import json, sys
r = json.load(sys.stdin)[0]["results"][0]
print("%d on the list, %d confirmed" % (r["total"], r["confirmed"] or 0))
'
fi
