import type { APIRoute } from 'astro';
import { UPDATED } from '../data/site';

// Prerendered at build time. lastmod comes from the same date as the footer and the page's dateModified.
export const GET: APIRoute = ({ site }) => {
  const base = site?.toString() ?? 'https://growthegrid.ca/';
  const urls = ['/', '/privacy/'].map((p) => `  <url><loc>${new URL(p, base).toString()}</loc><lastmod>${UPDATED}</lastmod></url>`);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    { headers: { 'content-type': 'application/xml' } },
  );
};
