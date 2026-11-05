import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import mlas from '../../data/mlas.json';
import { CONSENT_TEXT } from '../../data/list';

export const prerender = false;

type D1 = { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown> } } };
type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
};
const bound = env as unknown as { LIST?: D1; COUNTER?: KV; IP_SALT?: string; TURNSTILE_SECRET?: string };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

// POST /api/subscribe { email, consent: true, riding?, via? } -> { ok }
// The answer is the same whether or not the address was already on the list, and an existing row is
// never changed, so nobody can alter someone else's entry.
// Rows start unconfirmed (confirmed_at NULL). Anyone can type any address here, so the first email ever
// sent to a row must be a confirmation link; never send updates to a row whose confirmed_at is NULL,
// and delete rows that stay unconfirmed after that first email.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const db = bound.LIST;
  if (!db) return json({ error: 'unavailable' }, 503);

  let data: { email?: unknown; consent?: unknown; riding?: unknown; via?: unknown; turnstile?: unknown };
  try {
    data = await request.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const email = String(data.email ?? '').trim().toLowerCase();
  if (data.consent !== true) return json({ error: 'consent' }, 400);
  if (email.length > 254 || !EMAIL.test(email)) return json({ error: 'email' }, 400);
  // Cloudflare Turnstile: the form sends a one-time token; nothing is saved unless Cloudflare vouches for it.
  if (bound.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append('secret', bound.TURNSTILE_SECRET);
    form.append('response', String(data.turnstile ?? '').slice(0, 2048));
    const ip = clientAddress ?? request.headers.get('cf-connecting-ip');
    if (ip) form.append('remoteip', ip);
    const check = (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
      .then((r) => r.json())
      .catch(() => ({ success: false }))) as { success?: boolean; hostname?: string };
    if (!check.success || !['growthegrid.ca', 'www.growthegrid.ca'].includes(check.hostname ?? '')) return json({ error: 'bot' }, 403);
  }
  const riding = typeof data.riding === 'string' && Object.hasOwn(mlas, data.riding) ? data.riding : null;
  const source = String(data.via ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || null;

  // At most 5 sign-ups a day from one connection, using the same one-way IP code as the letter counter.
  if (bound.COUNTER && bound.IP_SALT) {
    const ip = clientAddress ?? request.headers.get('cf-connecting-ip') ?? 'anon';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${bound.IP_SALT}:list:${ip}`));
    const key = `list:${[...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    const n = Number((await bound.COUNTER.get(key)) ?? 0);
    if (n >= 5) return json({ error: 'busy' }, 429);
    await bound.COUNTER.put(key, String(n + 1), { expirationTtl: 86400 });
  }

  const token = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await db
    .prepare(
      `INSERT INTO subscribers (email, riding, consent_text, source, created_at, token) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO NOTHING`,
    )
    .bind(email, riding, CONSENT_TEXT, source, new Date().toISOString(), token)
    .run();
  return json({ ok: true });
};
