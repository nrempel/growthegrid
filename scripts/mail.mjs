#!/usr/bin/env node
// Update-list mail, plain text only, sent with Cloudflare Email Sending through the cf CLI.
//
//   node scripts/mail.mjs confirm [--limit 50] [--dry-run]
//       Sends the confirmation email to everyone who joined and hasn't had one yet.
//       Nobody gets an update until they press Confirm in this email.
//   node scripts/mail.mjs send --campaign <id> --subject "<subject>" --file <body.txt> [--limit N] [--dry-run] [--test you@example.com]
//       Sends an update to confirmed addresses only. <id> is a short name like cap-decision; a re-run
//       with the same id skips everyone who already got it. --test sends one copy to you only.
//   node scripts/mail.mjs prune [--days 14] [--dry-run]
//       Deletes addresses that never confirmed, <days> after their confirmation email.
//
// Addresses are never printed in full. Every email carries an unsubscribe link and the
// List-Unsubscribe headers mail apps use for their one-click "Unsubscribe" button.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// Settings come from the environment or an untracked .env at the repo root (see README).
const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const DB = process.env.LIST_DB_ID; // D1 database id, from `cf d1 list`
if (!ACCOUNT || !DB) {
  console.error('Set CLOUDFLARE_ACCOUNT_ID and LIST_DB_ID (environment or .env at the repo root).');
  process.exit(2);
}
const SITE = 'https://growthegrid.ca';
const FROM = { address: 'hello@growthegrid.ca', name: 'Grow the Grid BC' };
const SIGNATURE = 'Nicholas Rempel\nGrow the Grid BC · hello@growthegrid.ca\nhttps://growthegrid.ca';

const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, PATH: `/opt/homebrew/bin:${process.env.PATH}` };
const cf = (args) => execFileSync('npx', ['cf', '-q', ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const query = (sql, params = []) => JSON.parse(cf(['d1', 'query', DB, '--body', JSON.stringify({ sql, params })]))[0].results;
const mask = (email) => email.replace(/^(.).*(@.*)$/, '$1***$2');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const dryRun = arg('dry-run', false) === true;

function sendMail(to, token, subject, text) {
  const body = {
    from: FROM,
    to: { address: to },
    reply_to: { address: FROM.address },
    subject,
    text,
    headers: {
      'List-Unsubscribe': `<${SITE}/api/unsubscribe?t=${token}>, <mailto:${FROM.address}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
  cf(['email-sending', 'send', '--body', JSON.stringify(body)]);
}

const footer = (token) =>
  `\n\n--\nYou're getting this because you joined the Grow the Grid BC update list at growthegrid.ca.\nUnsubscribe: ${SITE}/unsubscribe?t=${token}\n${SIGNATURE.split('\n').join(' · ')}`;

function run(rows, label, each) {
  console.log(`${rows.length} ${label}${dryRun ? ' (dry run: nothing sent)' : ''}`);
  if (dryRun) return;
  let sent = 0;
  for (const r of rows) {
    try {
      each(r);
      sent++;
    } catch (e) {
      const why = String(e.stderr || e.message).split('\n').find((l) => l.trim()) ?? 'unknown error';
      console.error(`Stopped after ${sent} of ${rows.length} at ${mask(r.email)}: ${why}`);
      console.error('Run the same command again later; nobody who already got it will get it twice.');
      process.exit(1);
    }
  }
  console.log(`Sent ${sent}.`);
}

const cmd = process.argv[2];

if (cmd === 'confirm') {
  const limit = Number(arg('limit', 50));
  const rows = query(
    'SELECT email, token FROM subscribers WHERE confirmed_at IS NULL AND confirm_sent_at IS NULL ORDER BY created_at LIMIT ?',
    [limit],
  );
  run(rows, 'confirmation emails to send', (r) => {
    sendMail(
      r.email,
      r.token,
      'Confirm your Grow the Grid BC updates',
      `Hi,\n\nYou (or someone using this address) asked for updates from Grow the Grid BC about BC's data centre power rules.\n\nTo stay on the list, confirm here:\n${SITE}/confirm?t=${r.token}\n\nIf you didn't ask for this, ignore this email. You won't get any more emails.\n\n${SIGNATURE}`,
    );
    query('UPDATE subscribers SET confirm_sent_at = ? WHERE email = ?', [new Date().toISOString(), r.email]);
  });
} else if (cmd === 'send') {
  const campaign = arg('campaign');
  const subject = arg('subject');
  const file = arg('file');
  if (typeof campaign !== 'string' || typeof subject !== 'string' || typeof file !== 'string') {
    console.error('Usage: node scripts/mail.mjs send --campaign <id> --subject "<subject>" --file <body.txt> [--limit N] [--dry-run] [--test you@example.com]');
    process.exit(2);
  }
  const text = readFileSync(file, 'utf8').trim();
  const test = arg('test');
  if (typeof test === 'string') {
    const known = query('SELECT token FROM subscribers WHERE email = ?', [test.toLowerCase()])[0];
    if (dryRun) {
      console.log(`Would send one test copy to ${mask(test)}.\n\n--- ${subject} ---\n${text}${footer(known?.token ?? 'TEST')}`);
    } else {
      sendMail(test, known?.token ?? 'test', `[Test] ${subject}`, text + footer(known?.token ?? 'test'));
      console.log(`Sent one test copy to ${mask(test)}.`);
    }
    process.exit(0);
  }
  const limit = Number(arg('limit', 1000));
  const rows = query(
    `SELECT s.email, s.token FROM subscribers s
     WHERE s.confirmed_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sends d WHERE d.campaign = ? AND d.email = s.email)
     ORDER BY s.created_at LIMIT ?`,
    [campaign, limit],
  );
  run(rows, `confirmed addresses still to get "${campaign}"`, (r) => {
    sendMail(r.email, r.token, subject, text + footer(r.token));
    query('INSERT OR IGNORE INTO sends (campaign, email, sent_at) VALUES (?, ?, ?)', [campaign, r.email, new Date().toISOString()]);
  });
} else if (cmd === 'prune') {
  const days = Number(arg('days', 14));
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const where = 'confirmed_at IS NULL AND confirm_sent_at IS NOT NULL AND confirm_sent_at < ?';
  const [{ n }] = query(`SELECT count(*) AS n FROM subscribers WHERE ${where}`, [cutoff]);
  console.log(`${n} unconfirmed addresses older than ${days} days${dryRun ? ' (dry run: nothing deleted)' : ''}`);
  if (!dryRun && n) {
    query(`DELETE FROM subscribers WHERE ${where}`, [cutoff]);
    console.log(`Deleted ${n}.`);
  }
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
