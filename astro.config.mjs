import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.redlavendercompany.com',
  trailingSlash: 'always',
  // Old JetSite addresses, so existing links and search results still land somewhere useful.
  redirects: {
    '/en-us': '/en/',
    '/hakkinda': '/tr/#about',
    '/hizmetlerimiz': '/tr/#services',
    '/ekip': '/tr/#about',
    '/fiyat-listesi': '/tr/#catalog',
    '/iletisim': '/tr/#contact',
  },
});
