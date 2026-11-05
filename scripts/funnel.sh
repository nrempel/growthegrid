#!/usr/bin/env bash
# Weekly funnel: where people drop off. Usage: scripts/funnel.sh [days]  (default 7)
set -euo pipefail
days="${1:-7}"
# The SQL counts only rows after launch (2026-11-04 22:20 UTC); earlier rows are test runs.
# Prefer Homebrew's Node when present (Astro and cf need Node 22.23.4 or later).
export PATH="/opt/homebrew/bin:${PATH}"
# Settings come from the environment or an untracked .env at the repo root (see README).
root="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "${root}/.env" ] && set -a && . "${root}/.env" && set +a
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID (env or .env)}"
sql="$(mktemp)"
sed "s/INTERVAL '7' DAY/INTERVAL '${days}' DAY/" "$(dirname "$0")/funnel.sql" > "${sql}"
export CLOUDFLARE_ACCOUNT_ID
err="$(mktemp)"
trap 'rm -f "${sql}" "${err}"' EXIT
# cf draws a spinner on the terminal; keep its output apart so the report starts on a clean line.
if ! out="$(npx cf -q analytics-engine sql query --file "${sql}" 2> "${err}")"; then
  cat "${err}" >&2
  exit 1
fi
printf '%s' "${out}" | python3 -c '
import json, sys
rows = json.load(sys.stdin)["data"]
if not rows:
    print("No events yet since launch (2026-11-04 22:20 UTC).")
order = ["lookup", "lookup_fail", "compose", "letter_edited", "send_click", "send_confirm", "share"]
by = {}
for r in rows:
    by.setdefault(r["step"], []).append((r["detail"] or "-", int(r["count"])))
for step in order + sorted(set(by) - set(order)):
    if step not in by:
        continue
    total = sum(n for _, n in by[step])
    parts = ", ".join(f"{d} {n}" for d, n in sorted(by[step], key=lambda x: -x[1]))
    print(f"{step:<14} {total:>6}   {parts}")
'

# Where letters come from: lookups and sends by the share tag that brought the visit ("direct" = no tag).
sed "s/INTERVAL '7' DAY/INTERVAL '${days}' DAY/" "$(dirname "$0")/funnel_via.sql" > "${sql}"
if ! out="$(npx cf -q analytics-engine sql query --file "${sql}" 2> "${err}")"; then
  cat "${err}" >&2
  exit 1
fi
printf '%s' "${out}" | python3 -c '
import json, sys
rows = json.load(sys.stdin)["data"]
if not rows:
    sys.exit(0)
by = {}
for r in rows:
    by.setdefault(r["via"] or "direct", {})[r["step"]] = int(r["count"])
print()
print("%-14s %8s %6s" % ("source", "lookups", "sends"))
for via, s in sorted(by.items(), key=lambda kv: -kv[1].get("send_click", 0)):
    print("%-14s %8d %6d" % (via, s.get("lookup", 0), s.get("send_click", 0)))
'
