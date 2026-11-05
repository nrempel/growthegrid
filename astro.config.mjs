// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://growthegrid.ca',
  adapter: cloudflare({ imageService: 'passthrough' }),
});
