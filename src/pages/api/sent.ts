import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import mlas from '../../data/mlas.json';

export const prerender = false;

type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
};

const kv = (): KV | undefined => (env as unknown as { COUNTER?: KV }).COUNTER;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });

// ISO week key, e.g. week:2026-W45. The page shows weekly growth once it passes 50.
const weekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `week:${year}-W${String(week).padStart(2, '0')}`;
};

// GET /api/sent -> { total, week }
export const GET: APIRoute = async () => {
  const store = kv();
  if (!store) return json({ total: 0, week: 0 });
  const [total, week] = await Promise.all([store.get('total'), store.get(weekKey())]);
  return json({ total: Number(total ?? 0), week: Number(week ?? 0) });
};

// POST /api/sent { riding } -> increments the counter.
// Counts are "letters started": we can't see whether the visitor actually hits send.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const store = kv();
  if (!store) return json({ total: 0 });

  let riding = '';
  try {
    riding = String(((await request.json()) as { riding?: string }).riding ?? '');
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (!Object.hasOwn(mlas, riding)) return json({ error: 'unknown riding' }, 400);

  // Light abuse guard: one count per IP per riding per day. Store a one-way hash, never the IP itself.
  // Without the secret salt the hash could be reversed, so the guard is skipped instead.
  const salt = (env as unknown as { IP_SALT?: string }).IP_SALT;
  if (salt) {
    const ip = clientAddress ?? request.headers.get('cf-connecting-ip') ?? 'anon';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
    const ipHash = [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const seenKey = `seen:${ipHash}:${riding}`;
    if (await store.get(seenKey)) {
      const [total, week] = await Promise.all([store.get('total'), store.get(weekKey())]);
      return json({ total: Number(total ?? 0), week: Number(week ?? 0), counted: false });
    }
    await store.put(seenKey, '1', { expirationTtl: 86400 });
  }

  // KV isn't transactional; fine for a campaign counter.
  const total = Number((await store.get('total')) ?? 0) + 1;
  const rk = `riding:${riding}`;
  const wk = weekKey();
  const perRiding = Number((await store.get(rk)) ?? 0) + 1;
  const week = Number((await store.get(wk)) ?? 0) + 1;
  await Promise.all([
    store.put('total', String(total)),
    store.put(rk, String(perRiding)),
    store.put(wk, String(week), { expirationTtl: 60 * 60 * 24 * 21 }),
  ]);

  return json({ total, week, counted: true });
};
