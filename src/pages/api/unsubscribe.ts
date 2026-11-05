import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

type D1 = { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown> } } };

// POST /api/unsubscribe?t=<token> deletes the row. Mail apps call this for their one-click
// "Unsubscribe" button (RFC 8058: List-Unsubscribe-Post), with no Origin header and no cookies.
// It answers 200 even for an unknown token, so it reveals nothing about who is on the list.
export const POST: APIRoute = async ({ url }) => {
  const db = (env as unknown as { LIST?: D1 }).LIST;
  const token = (url.searchParams.get('t') ?? '').replace(/[^a-f0-9]/g, '').slice(0, 64);
  if (db && token) {
    await db.prepare('DELETE FROM subscribers WHERE token = ?').bind(token).run();
    await db.prepare('DELETE FROM sends WHERE email NOT IN (SELECT email FROM subscribers)').bind().run();
  }
  return new Response('You’re unsubscribed.', {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
};
