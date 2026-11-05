import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import mlas from '../../data/mlas.json';

export const prerender = false;

type Dataset = { writeDataPoint(p: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void };

// Funnel steps the page may report. Anything else is dropped.
const EVENTS = new Set(['lookup', 'lookup_fail', 'compose', 'letter_edited', 'send_click', 'send_confirm', 'share', 'join']);
const clean = (v: unknown) => String(v ?? '').replace(/[^a-z_]/gi, '').slice(0, 24);

// POST /api/event { event, detail[], riding, via } -> one Analytics Engine row. No IP, cookie or ID is stored.
export const POST: APIRoute = async ({ request }) => {
  const events = (env as unknown as { EVENTS?: Dataset }).EVENTS;
  let data: { event?: string; detail?: unknown[]; riding?: string; via?: string };
  try {
    data = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return new Response(null, { status: 400 });
  const event = clean(data.event);
  if (!EVENTS.has(event)) return new Response(null, { status: 400 });
  const detail = (Array.isArray(data.detail) ? data.detail : []).slice(0, 3).map(clean);
  const riding = typeof data.riding === 'string' && Object.hasOwn(mlas, data.riding) ? data.riding : '';
  // The share tag that brought the visit, e.g. foot-x or bubble-fb (blob6).
  const via = String(data.via ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  events?.writeDataPoint({ indexes: [event], blobs: [event, detail[0] ?? '', detail[1] ?? '', detail[2] ?? '', riding, via], doubles: [1] });
  return new Response(null, { status: 204, headers: { 'x-robots-tag': 'noindex' } });
};
