import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages only serves files that exist: /next, /how-it-works and /legal need their own index.html.
// Same page as the home page; the app reads the URL to know which one it is.
const PAGES = ['next', 'how-it-works', 'legal'];

function otherPages(): Plugin {
  return {
    name: 'other-pages',
    apply: 'build',
    closeBundle() {
      const dist = (p: string) => fileURLToPath(new URL(`./dist/${p}`, import.meta.url));
      for (const page of PAGES) {
        mkdirSync(dist(page), { recursive: true });
        // Each copy says its own address to search engines (canonical and link previews)
        const html = readFileSync(dist('index.html'), 'utf8')
          .replace('<link rel="canonical" href="https://unmissable.watch/" />', `<link rel="canonical" href="https://unmissable.watch/${page}/" />`)
          .replace('<meta property="og:url" content="https://unmissable.watch/" />', `<meta property="og:url" content="https://unmissable.watch/${page}/" />`);
        writeFileSync(dist(`${page}/index.html`), html);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), otherPages()],
});
