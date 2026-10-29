import { copyFileSync, mkdirSync } from 'node:fs';
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
        copyFileSync(dist('index.html'), dist(`${page}/index.html`));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), otherPages()],
});
