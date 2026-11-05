# Grow the Grid BC

Source for [growthegrid.ca](https://growthegrid.ca), a one-page campaign site. It asks British Columbians to email their MLA: let data centres connect to BC Hydro's grid if they pay for more new power than they use.

Visitors find their MLA by postal code, location or riding, edit a ready-made letter, and send it from their own email app. The site never sends or stores the letter.

## Stack

- [Astro](https://astro.build) 7, prerendered, on Cloudflare Workers through `@astrojs/cloudflare` 15 (beta) and `@cloudflare/vite-plugin` 2 (beta). Both are pinned to exact versions.
- Deployed with Cloudflare's [`cf` CLI](https://developers.cloudflare.com/). Config lives in `cloudflare.config.ts`; there is no Wrangler file (the adapter refuses to run if one exists).
- Riding lookup: [OpenNorth Represent](https://represent.opennorth.ca), called from the browser.
- MLA names and emails: `src/data/mlas.json`, keyed by Represent's riding names, maintained by hand.

| Path | What it is |
| --- | --- |
| `src/pages/index.astro` | The page: copy, sources (`U` at the top), chart data, FAQ |
| `src/data/letter.ts` | The letter template (kept short so it fits in a `mailto:` link) |
| `src/scripts/app.ts` | Lookup, letter, send, share, update-list forms, share bubbles |
| `src/pages/api/` | `sent` (letter counter), `event` (anonymous funnel steps), `subscribe` and `unsubscribe` (update list) |
| `src/pages/confirm.astro`, `unsubscribe.astro` | Update-list confirm and unsubscribe pages |
| `src/pages/privacy.astro` | What the site keeps. Update it with any change to data handling. |
| `migrations/` | D1 schema for the update list |
| `scripts/` | Funnel report, list export and the mail sender |
| `docs/DESIGN.md` | The design system: tokens, type, spacing, components |

## Run locally

Needs Node 22.23.4 or later.

```sh
npm install
npm run dev
```

The page works without any Cloudflare resources. The counter, funnel and update list need the bindings below.

## Deploy your own copy

1. Change `domains` in `cloudflare.config.ts`, the site URL in `astro.config.mjs`, and the copy, sources and contact address throughout.
2. Sign in: `cf auth login`.
3. Deploy: `npm run deploy`. On the first deploy `cf` creates the bindings:
   - KV `COUNTER`: the letter count, plus a one-day salted code per connection to stop double counting.
   - Analytics Engine `EVENTS`: anonymous funnel steps (no IP, cookie or ID).
   - D1 `LIST`: the opt-in update list.
   - KV `SESSION`: added by the Astro adapter; the site doesn't use it.
4. Create the update-list tables: `cf d1 migrations apply <database-id> --dir migrations` (the ID is in `cf d1 list`).
5. Set the secrets (`cf workers secrets update <NAME> --worker <worker> --type secret_text --text <value>`):
   - `IP_SALT`: any long random string.
   - `TURNSTILE_SECRET`: from a [Turnstile](https://developers.cloudflare.com/turnstile/) widget for your domain. Put its public site key in `src/data/list.ts`.
6. To send update emails, onboard your domain for [Cloudflare Email Sending](https://developers.cloudflare.com/email-service/) and set the sender in `scripts/mail.mjs`.

Request logs are turned off (`observability.logs.invocationLogs: false`), because the privacy page promises no per-visitor logs.

## Scripts

The scripts read `CLOUDFLARE_ACCOUNT_ID` and `LIST_DB_ID` from the environment or from an untracked `.env` file at the repo root:

```sh
CLOUDFLARE_ACCOUNT_ID=...
LIST_DB_ID=...
```

- `scripts/funnel.sh [days]`: lookups, letters opened, sends and shares, and which share links bring people in.
- `scripts/list.sh` counts the update list; `scripts/list.sh export <file.csv>` exports it without printing addresses.
- `node scripts/mail.mjs confirm`: sends the confirmation email to new sign-ups. Nobody gets updates until they confirm.
- `node scripts/mail.mjs send --campaign <id> --subject "..." --file body.txt [--test you@example.com] [--dry-run]`: plain-text update to confirmed addresses only. Re-running with the same `--campaign` never sends twice. Every email has an unsubscribe link and one-click unsubscribe headers.
- `node scripts/mail.mjs prune`: deletes addresses that never confirmed, 14 days after their confirmation email.

## Updating the MLA list

Each entry in `src/data/mlas.json` has `name`, `party`, `email`, `status` and `source`. While `status` is `"preliminary"`, the page shows the member as "MLA-elect" with a note that results are not final. Set it to `"verified"` once the name and email are checked against Elections BC and [leg.bc.ca/members](https://www.leg.bc.ca/members).

## License

The code is under the [MIT License](LICENSE). The campaign's words, letter and images are © Nicholas Rempel. Reuse the code freely, but write your own campaign. Archivo is under the SIL Open Font License (`public/fonts/ARCHIVO-OFL.txt`), and the Lucide link icon under ISC (`public/licenses/LUCIDE-ISC.txt`). The social icons are from Simple Icons (CC0); their brands are their owners' trademarks.
